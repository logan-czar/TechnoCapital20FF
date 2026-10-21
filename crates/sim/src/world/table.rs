//! Vec-backed tables indexed by ordinal ids (build-plan 2.3, 4.3): rows live in a `Vec` in id
//! order, so every pass over a table is in a fixed order (no `HashMap` iteration, CLAUDE.md).

use std::marker::PhantomData;
use std::ops::{Index, IndexMut};

use serde::{Deserialize, Serialize};

use super::ids::Ordinal;

/// The rows of one entity type, addressed by `I`. Serializes as a plain sequence in id order, so
/// saves and the state hash cover every row and every field without per-table code.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(
    transparent,
    bound(serialize = "T: Serialize", deserialize = "T: Deserialize<'de>")
)]
pub struct Table<I, T> {
    rows: Vec<T>,
    #[serde(skip)]
    _id: PhantomData<fn() -> I>,
}

impl<I: Ordinal, T> Default for Table<I, T> {
    fn default() -> Self {
        Self::from_rows(Vec::new())
    }
}

impl<I: Ordinal, T> Table<I, T> {
    /// A table whose row `i` gets id `i`. Rows must already be in id order.
    pub fn from_rows(rows: Vec<T>) -> Self {
        Self {
            rows,
            _id: PhantomData,
        }
    }

    /// Appends a row and returns its id (the next ordinal).
    pub fn push(&mut self, row: T) -> I {
        self.rows.push(row);
        I::from_index(self.rows.len() - 1)
    }

    pub fn get(&self, id: I) -> Option<&T> {
        self.rows.get(id.index())
    }

    pub fn get_mut(&mut self, id: I) -> Option<&mut T> {
        self.rows.get_mut(id.index())
    }

    pub fn len(&self) -> usize {
        self.rows.len()
    }

    pub fn is_empty(&self) -> bool {
        self.rows.is_empty()
    }

    /// Every id, in order.
    pub fn ids(&self) -> impl Iterator<Item = I> + use<I, T> {
        (0..self.rows.len()).map(I::from_index)
    }

    /// Rows with their ids, in id order.
    pub fn iter(&self) -> impl Iterator<Item = (I, &T)> {
        self.rows
            .iter()
            .enumerate()
            .map(|(i, r)| (I::from_index(i), r))
    }

    /// Mutable rows with their ids, in id order.
    pub fn iter_mut(&mut self) -> impl Iterator<Item = (I, &mut T)> {
        self.rows
            .iter_mut()
            .enumerate()
            .map(|(i, r)| (I::from_index(i), r))
    }

    /// The rows as a slice, in id order.
    pub fn rows(&self) -> &[T] {
        &self.rows
    }
}

impl<I: Ordinal, T> Index<I> for Table<I, T> {
    type Output = T;

    fn index(&self, id: I) -> &T {
        &self.rows[id.index()]
    }
}

impl<I: Ordinal, T> IndexMut<I> for Table<I, T> {
    fn index_mut(&mut self, id: I) -> &mut T {
        &mut self.rows[id.index()]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::world::ids::CompanyId;

    #[test]
    fn ids_are_positions() {
        let mut t: Table<CompanyId, &str> = Table::default();
        assert_eq!(t.push("a"), CompanyId(0));
        assert_eq!(t.push("b"), CompanyId(1));
        assert_eq!(t[CompanyId(1)], "b");
        assert_eq!(
            t.iter().collect::<Vec<_>>(),
            [(CompanyId(0), &"a"), (CompanyId(1), &"b")]
        );
        assert!(t.get(CompanyId(2)).is_none());
    }
}
