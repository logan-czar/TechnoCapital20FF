//! v_news: `get_news(since, filter)` (spec 9.2; 8 News feed: Pdoomberg Wire headlines with date
//! and industry tag). Rebuilt daily (spec 9.4).
//!
//! The feed shares its month chunks with the World's wire (D148), so the daily rebuild copies
//! two pointers whatever the feed's length.

use super::{Cadence, ViewData, ViewInput};
use crate::news::Headline;
use crate::time::Date;
use crate::world::{HeadlineId, IndustryId};
use crate::world::log::ChunkLog;

#[derive(Debug, Clone, Default, PartialEq)]
pub struct NewsView {
    /// Every posted headline, oldest first.
    pub feed: ChunkLog<Headline>,
}

impl NewsView {
    /// The headline with id `id` (D544): a binary search over the month chunks.
    pub fn get(&self, id: HeadlineId) -> Option<&Headline> {
        self.feed.find_sorted(&id, |h| h.id)
    }

    /// Headlines posted on or after `since`, oldest first, optionally of one industry (spec 9.2
    /// `get_news(since, filter)`).
    pub fn get_news(&self, since: Date, industry: Option<IndustryId>) -> Vec<&Headline> {
        self.feed
            .iter()
            .filter(|h| h.date >= since && industry.is_none_or(|i| h.industry == Some(i)))
            .collect()
    }
}

impl ViewData for NewsView {
    const CADENCE: Cadence = Cadence::Daily;

    fn build(input: &ViewInput<'_>) -> Self {
        NewsView {
            feed: input.world.news.feed.clone(),
        }
    }
}
