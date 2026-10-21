//! The quarterly recap on the World (build-plan M6.5; spec 4.4 row 5, 8, 21.6.2): built at
//! 00:00 on the first day of the pre-quarter-end week, from the lock's projection and consensus.

use std::sync::Arc;

use serde::{Deserialize, Serialize};

use super::{
    CompanyRecap, ExpectedResult, Outlook, WorldRecap, company_recap, rating_watch, world_recap,
};
use crate::market::projection::elapsed_share;
use crate::people::management::confidence_factor;
use crate::time::{JobCtx, Scheduler, Slot};
use crate::world::World;

/// The recap the pre-quarter-end week shows (spec 8 Quarterly recap): the world page and one
/// company page for every company not frozen (the view keeps the watchlist's, spec 8).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Recap {
    pub world: WorldRecap,
    pub companies: Vec<CompanyRecap>,
}

/// 4.4 row 5 (spec 8, 21.6.2; D280): the world page (phase, g_t, industries by label, the five
/// largest expected beats and misses of the quoted companies by the lock's projection against
/// its consensus) and every company page (the observer's 5.16 range at today's elapsed share,
/// the expected reaction, confidence, the outlook with the rating watch).
pub fn recap_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let quarter = ctx.facts.date.quarter();
    let elapsed = elapsed_share(ctx.facts.now);
    let mut listed = Vec::new();
    let mut pages = Vec::new();
    for (id, c) in world.companies.iter() {
        if c.finance.status().is_frozen() {
            continue;
        }
        let s = &world.market.stocks[id];
        let expected = ExpectedResult::new(id, s.projection_ni, s.consensus_ni);
        if s.quoted {
            listed.push(expected);
        }
        let label = world.industries[c.industry].phase_label;
        pages.push(company_recap(
            quarter,
            expected,
            elapsed,
            confidence_factor(c.management_score),
            s.exchange
                .filter(|_| s.quoted)
                .map(|z| world.zones[z].confidence),
            Outlook {
                label,
                loss_quarters: c.loss_quarters,
                rating: c.finance.rating,
                rating_watch: rating_watch(c.finance.rating, c.finance.implied.implied),
            },
        ));
    }
    let industries: Vec<_> = world
        .industries
        .iter()
        .map(|(id, i)| (id, i.phase_label))
        .collect();
    let page = world_recap(
        quarter,
        world.cycle.phase,
        world.cycle.g_t,
        &industries,
        &listed,
    );
    world.recap = Some(Arc::new(Recap {
        world: page,
        companies: pages,
    }));
}

/// Registers the recap job (spec 4.4 row 5).
pub fn register(s: &mut Scheduler) {
    s.register(Slot::RecapBuild, "recap.build", recap_job);
}
