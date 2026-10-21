//! An append-only history kept in chunks behind `Arc`s (spec 9.4 "only changed rows are
//! rebuilt"; D139, D148): ten years of daily bars per company and the news feed.
//!
//! A view copies a log by cloning two `Arc`s, whatever its length. Appending writes only the
//! open chunk (copied once if a view still shares it, a month of rows at most); closing a chunk
//! copies the list of closed chunks once, when a view still shares it. So the daily cost of a
//! view that holds every company's bars no longer grows with the history.

use std::sync::Arc;

use serde::{Deserialize, Serialize};

/// An append-only list in chunks: the closed chunks, oldest first, behind one `Arc`, and the
/// open chunk behind another. Rows arrive in order; the caller says when a row starts a new
/// chunk (a new month).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(bound(serialize = "T: Serialize", deserialize = "T: Deserialize<'de>"))]
pub struct ChunkLog<T> {
    closed: Arc<Vec<Arc<Vec<T>>>>,
    open: Arc<Vec<T>>,
}

impl<T> Default for ChunkLog<T> {
    fn default() -> Self {
        ChunkLog {
            closed: Arc::new(Vec::new()),
            open: Arc::new(Vec::new()),
        }
    }
}

impl<T: Clone> ChunkLog<T> {
    /// Appends `row`. When `same_chunk(last row, row)` is false the open chunk is closed first.
    pub fn push(&mut self, row: T, same_chunk: impl Fn(&T, &T) -> bool) {
        if let Some(last) = self.open.last()
            && !same_chunk(last, &row)
        {
            let full = std::mem::take(&mut self.open);
            Arc::make_mut(&mut self.closed).push(full);
        }
        Arc::make_mut(&mut self.open).push(row);
    }

    /// Drops the oldest rows while `old(row)` holds (rows are in order, so `old` holds for a
    /// prefix). Whole chunks go; a chunk that straddles the edge is trimmed.
    pub fn drop_while(&mut self, old: impl Fn(&T) -> bool) {
        let gone = self
            .closed
            .iter()
            .take_while(|c| c.last().is_none_or(&old))
            .count();
        if gone > 0 {
            Arc::make_mut(&mut self.closed).drain(..gone);
        }
        if let Some(first) = self.closed.first()
            && first.first().is_some_and(&old)
        {
            let closed = Arc::make_mut(&mut self.closed);
            Arc::make_mut(&mut closed[0]).retain(|r| !old(r));
        }
        if self.closed.is_empty() && self.open.first().is_some_and(&old) {
            Arc::make_mut(&mut self.open).retain(|r| !old(r));
        }
    }
}

impl<T> ChunkLog<T> {
    /// Every row, oldest first.
    pub fn iter(&self) -> impl DoubleEndedIterator<Item = &T> {
        self.closed
            .iter()
            .flat_map(|c| c.iter())
            .chain(self.open.iter())
    }

    /// The number of rows kept.
    pub fn len(&self) -> usize {
        self.closed.iter().map(|c| c.len()).sum::<usize>() + self.open.len()
    }

    pub fn is_empty(&self) -> bool {
        self.open.is_empty() && self.closed.iter().all(|c| c.is_empty())
    }

    /// The newest row.
    pub fn last(&self) -> Option<&T> {
        self.open
            .last()
            .or_else(|| self.closed.last().and_then(|c| c.last()))
    }

    /// The open chunk (the newest rows, at most a chunk's worth).
    pub fn open_chunk(&self) -> &[T] {
        &self.open
    }

    /// True if `other` shares this log's chunks (a cheap copy, not a rebuild).
    pub fn shares_with(&self, other: &ChunkLog<T>) -> bool {
        Arc::ptr_eq(&self.closed, &other.closed) && Arc::ptr_eq(&self.open, &other.open)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn by_ten(a: &u32, b: &u32) -> bool {
        a / 10 == b / 10
    }

    #[test]
    fn chunks_by_key_and_drops_a_prefix() {
        let mut log = ChunkLog::default();
        for i in [1, 2, 11, 12, 13, 25, 31] {
            log.push(i, by_ten);
        }
        assert_eq!(
            log.iter().copied().collect::<Vec<_>>(),
            [1, 2, 11, 12, 13, 25, 31]
        );
        assert_eq!((log.len(), log.last()), (7, Some(&31)));
        assert_eq!(log.open_chunk(), [31]);
        let copy = log.clone();
        assert!(copy.shares_with(&log));
        log.push(32, by_ten);
        assert!(!copy.shares_with(&log));
        assert_eq!(copy.len(), 7, "the copy keeps what it saw");
        log.drop_while(|&r| r < 12);
        assert_eq!(
            log.iter().copied().collect::<Vec<_>>(),
            [12, 13, 25, 31, 32]
        );
        log.drop_while(|&r| r < 40);
        assert!(log.is_empty());
    }
}
