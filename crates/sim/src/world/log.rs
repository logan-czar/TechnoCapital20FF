//! An append-only history kept in chunks behind `Arc`s (spec 9.4 "only changed rows are
//! rebuilt"; D139, D148, D401): ten years of daily bars per company and the news feed.
//!
//! A view copies a log by cloning two `Arc`s, whatever its length. The open chunk and the list
//! of closed chunks are each an [`AppendBuf`]: a shared buffer of write-once slots plus the
//! number of rows this copy owns. Appending fills the next free slot in place, even while a
//! view shares the buffer, since the view's own count never reaches it; the buffer is copied
//! only when it is full or another copy already filled that slot (D401). So a day's new bar
//! costs one slot write, not a copy of the open month, and closing a month adds one chunk
//! pointer, not a copy of the list.

use std::fmt;
use std::sync::{Arc, OnceLock};

use serde::de::Deserializer;
use serde::ser::{SerializeStruct, Serializer};
use serde::{Deserialize, Serialize};

/// Slots in a new [`AppendBuf`]: a month of daily bars fits. A full buffer doubles.
pub const APPEND_BUF_MIN_SLOTS: usize = 32;

/// An append-only list whose copies share one buffer of write-once slots (D401). Each copy owns
/// the first `len` slots, all filled and never written again; a push fills slot `len` if it is
/// still empty, else (full, or filled by another copy that pushed first) copies the owned rows
/// into a new buffer. A copy therefore always reads exactly the rows it pushed or was cloned
/// with, as a plain `Vec` would give.
#[derive(Clone)]
pub struct AppendBuf<T> {
    slots: Arc<Vec<OnceLock<T>>>,
    len: usize,
}

impl<T> Default for AppendBuf<T> {
    fn default() -> Self {
        AppendBuf {
            slots: Arc::new(Vec::new()),
            len: 0,
        }
    }
}

impl<T> AppendBuf<T> {
    /// The owned rows, oldest first.
    pub fn iter(&self) -> impl DoubleEndedIterator<Item = &T> + ExactSizeIterator {
        self.slots[..self.len]
            .iter()
            .map(|s| s.get().expect("an owned slot is filled"))
    }

    pub fn len(&self) -> usize {
        self.len
    }

    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    pub fn first(&self) -> Option<&T> {
        self.iter().next()
    }

    /// The owned row at `i`.
    pub fn get(&self, i: usize) -> Option<&T> {
        self.slots[..self.len].get(i).and_then(OnceLock::get)
    }

    pub fn last(&self) -> Option<&T> {
        self.iter().next_back()
    }

    /// True if `other` is a copy of this buffer with the same rows (a cheap copy, not a rebuild).
    pub fn shares_with(&self, other: &AppendBuf<T>) -> bool {
        Arc::ptr_eq(&self.slots, &other.slots) && self.len == other.len
    }
}

impl<T: Clone> AppendBuf<T> {
    /// A buffer owning `rows`.
    pub fn from_rows(rows: impl IntoIterator<Item = T>) -> Self {
        let mut slots: Vec<OnceLock<T>> = rows.into_iter().map(OnceLock::from).collect();
        let len = slots.len();
        slots.resize_with(len.max(APPEND_BUF_MIN_SLOTS), OnceLock::new);
        AppendBuf {
            slots: Arc::new(slots),
            len,
        }
    }

    /// Appends `row` (see the type docs).
    pub fn push(&mut self, row: T) {
        let row = match self.slots.get(self.len) {
            Some(slot) => match slot.set(row) {
                Ok(()) => {
                    self.len += 1;
                    return;
                }
                Err(row) => row,
            },
            None => row,
        };
        let cap = (2 * (self.len + 1)).max(APPEND_BUF_MIN_SLOTS);
        let mut slots = Vec::with_capacity(cap);
        slots.extend(self.iter().cloned().map(OnceLock::from));
        slots.push(OnceLock::from(row));
        slots.resize_with(cap, OnceLock::new);
        self.slots = Arc::new(slots);
        self.len += 1;
    }
}

impl<T: PartialEq> PartialEq for AppendBuf<T> {
    fn eq(&self, other: &Self) -> bool {
        self.len == other.len && self.iter().eq(other.iter())
    }
}

impl<T: fmt::Debug> fmt::Debug for AppendBuf<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_list().entries(self.iter()).finish()
    }
}

/// Serialized as the plain sequence of the owned rows, as a `Vec<T>` is.
impl<T: Serialize> Serialize for AppendBuf<T> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_seq(self.iter())
    }
}

impl<'de, T: Clone + Deserialize<'de>> Deserialize<'de> for AppendBuf<T> {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        Ok(AppendBuf::from_rows(Vec::<T>::deserialize(deserializer)?))
    }
}

/// An append-only list in chunks: the closed chunks, oldest first, and the open chunk, each an
/// [`AppendBuf`] (D401). Rows arrive in order; the caller says when a row starts a new chunk
/// (a new month).
///
/// It saves and hashes exactly as the earlier `{ closed: Arc<Vec<Arc<Vec<T>>>>, open:
/// Arc<Vec<T>> }` did (a struct of a sequence of sequences and a sequence), so neither the save
/// format nor any state hash moved with D401.
#[derive(Clone, PartialEq)]
pub struct ChunkLog<T> {
    closed: AppendBuf<Arc<Vec<T>>>,
    open: AppendBuf<T>,
}

impl<T> Default for ChunkLog<T> {
    fn default() -> Self {
        ChunkLog {
            closed: AppendBuf::default(),
            open: AppendBuf::default(),
        }
    }
}

impl<T: fmt::Debug> fmt::Debug for ChunkLog<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ChunkLog")
            .field("closed", &self.closed)
            .field("open", &self.open)
            .finish()
    }
}

impl<T: Serialize> Serialize for ChunkLog<T> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut s = serializer.serialize_struct("ChunkLog", 2)?;
        s.serialize_field("closed", &self.closed)?;
        s.serialize_field("open", &self.open)?;
        s.end()
    }
}

/// The saved form: the same fields, read as plain vectors.
#[derive(Deserialize)]
#[serde(rename = "ChunkLog")]
#[serde(bound(deserialize = "T: Deserialize<'de>"))]
struct ChunkLogRepr<T> {
    closed: Vec<Arc<Vec<T>>>,
    open: Vec<T>,
}

impl<'de, T: Clone + Deserialize<'de>> Deserialize<'de> for ChunkLog<T> {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let r = ChunkLogRepr::<T>::deserialize(deserializer)?;
        Ok(ChunkLog {
            closed: AppendBuf::from_rows(r.closed),
            open: AppendBuf::from_rows(r.open),
        })
    }
}

impl<T: Clone> ChunkLog<T> {
    /// Appends `row`. When `same_chunk(last row, row)` is false the open chunk is closed first.
    pub fn push(&mut self, row: T, same_chunk: impl Fn(&T, &T) -> bool) {
        if let Some(last) = self.open.last()
            && !same_chunk(last, &row)
        {
            let full = std::mem::take(&mut self.open);
            self.closed.push(Arc::new(full.iter().cloned().collect()));
        }
        self.open.push(row);
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
            self.closed = AppendBuf::from_rows(self.closed.iter().skip(gone).cloned());
        }
        if let Some(first) = self.closed.first()
            && first.first().is_some_and(&old)
        {
            let trimmed: Vec<T> = first.iter().filter(|r| !old(r)).cloned().collect();
            let rest = self.closed.iter().skip(1).cloned();
            self.closed = AppendBuf::from_rows(std::iter::once(Arc::new(trimmed)).chain(rest));
        }
        if self.closed.is_empty() && self.open.first().is_some_and(&old) {
            self.open = AppendBuf::from_rows(self.open.iter().filter(|r| !old(r)).cloned());
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
    pub fn open_chunk(&self) -> impl DoubleEndedIterator<Item = &T> + ExactSizeIterator {
        self.open.iter()
    }

    /// The row whose key is `key`, when the rows are in ascending key order: a binary search
    /// over the closed chunks by their last row, then within the one chunk (D544).
    pub fn find_sorted<K: Ord>(&self, key: &K, key_of: impl Fn(&T) -> K) -> Option<&T> {
        let (mut lo, mut hi) = (0, self.closed.len());
        while lo < hi {
            let mid = (lo + hi) / 2;
            match self.closed.get(mid).and_then(|c| c.last()) {
                Some(last) if key_of(last) >= *key => hi = mid,
                _ => lo = mid + 1,
            }
        }
        if let Some(c) = self.closed.get(lo) {
            return c
                .binary_search_by(|r| key_of(r).cmp(key))
                .ok()
                .map(|i| &c[i]);
        }
        let (mut lo, mut hi) = (0, self.open.len());
        while lo < hi {
            let mid = (lo + hi) / 2;
            let row = self.open.get(mid)?;
            match key_of(row).cmp(key) {
                std::cmp::Ordering::Less => lo = mid + 1,
                std::cmp::Ordering::Equal => return Some(row),
                std::cmp::Ordering::Greater => hi = mid,
            }
        }
        None
    }

    /// True if `other` shares this log's chunks with the same rows (a cheap copy, not a
    /// rebuild).
    pub fn shares_with(&self, other: &ChunkLog<T>) -> bool {
        self.closed.shares_with(&other.closed) && self.open.shares_with(&other.open)
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
        assert_eq!(log.open_chunk().copied().collect::<Vec<_>>(), [31]);
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

    /// The D148 layout this log replaced, for the format check below.
    #[derive(Serialize)]
    struct OldChunkLog {
        closed: Arc<Vec<Arc<Vec<u32>>>>,
        open: Arc<Vec<u32>>,
    }

    #[test]
    fn copies_that_both_push_keep_their_own_rows() {
        let mut a = ChunkLog::default();
        for i in [1, 2, 3] {
            a.push(i, by_ten);
        }
        let mut b = a.clone();
        a.push(4, by_ten);
        // b's next slot is taken by a: b copies and goes its own way.
        b.push(9, by_ten);
        b.push(10, by_ten);
        assert_eq!(a.iter().copied().collect::<Vec<_>>(), [1, 2, 3, 4]);
        assert_eq!(b.iter().copied().collect::<Vec<_>>(), [1, 2, 3, 9, 10]);
        // Past a full buffer, and across many chunks.
        let mut c = ChunkLog::default();
        let mut want = Vec::new();
        for i in 0..1000u32 {
            let keep = c.clone();
            c.push(i, |x, y| x / 100 == y / 100);
            want.push(i);
            assert_eq!(keep.len(), want.len() - 1);
        }
        assert_eq!(c.iter().copied().collect::<Vec<_>>(), want);
        assert_eq!(c.open_chunk().len(), 100);
    }

    #[test]
    fn finds_a_row_by_its_sorted_key() {
        let mut log = ChunkLog::default();
        let rows: Vec<u32> = (0..500).map(|i| i * 3).collect();
        for &i in &rows {
            log.push(i, |a, b| a / 40 == b / 40);
        }
        for &i in &rows {
            assert_eq!(log.find_sorted(&i, |r| *r), Some(&i));
            assert_eq!(log.find_sorted(&(i + 1), |r| *r), None);
        }
        assert_eq!(log.find_sorted(&5_000, |r| *r), None);
        log.drop_while(|&r| r < 100);
        assert_eq!(log.find_sorted(&102, |r| *r), Some(&102));
        assert_eq!(log.find_sorted(&99, |r| *r), None, "dropped");
        assert_eq!(ChunkLog::<u32>::default().find_sorted(&0, |r| *r), None);
    }

    #[test]
    fn saves_and_hashes_as_the_old_layout() {
        let mut log = ChunkLog::default();
        for i in [1, 2, 11, 12, 13, 25, 31, 32] {
            log.push(i, by_ten);
        }
        let old = OldChunkLog {
            closed: Arc::new(vec![
                Arc::new(vec![1, 2]),
                Arc::new(vec![11, 12, 13]),
                Arc::new(vec![25]),
            ]),
            open: Arc::new(vec![31, 32]),
        };
        let bytes = postcard::to_stdvec(&log).unwrap();
        assert_eq!(bytes, postcard::to_stdvec(&old).unwrap());
        let back: ChunkLog<u32> = postcard::from_bytes(&bytes).unwrap();
        assert_eq!(back, log);
        assert_eq!(back.iter().count(), 8);
    }
}
