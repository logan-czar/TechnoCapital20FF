//! The tiling workspace's model (M9 A2; D450), with no Bevy entities: a binary tree of splits
//! whose leaves are panes, each pane with its own back and forward history. The workspace UI
//! ([`super`]) draws it and turns input into calls here; tests drive it directly.

use std::collections::BTreeMap;

use bevy::prelude::Resource;
use serde::{Deserialize, Serialize};

use crate::pages::PageRef;

/// Most panes open at once (D450): more would make each too small to read.
pub const MAX_PANES: usize = 12;
/// Pages kept in each of a pane's back and forward lists.
pub const HISTORY_CAP: usize = 64;
/// The smallest share of a split either side keeps.
pub const MIN_RATIO: f32 = 0.1;
/// How far a keyboard resize moves a divider (a share of the split).
pub const NUDGE: f32 = 0.05;
/// The smallest pane a split may make, in logical pixels: a header and a few rows.
pub const MIN_PANE_W: f32 = 160.0;
pub const MIN_PANE_H: f32 = 80.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct PaneId(pub u32);

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct SplitId(pub u32);

/// How a split lays out its two sides.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Axis {
    /// Side by side, with a vertical divider ("split right").
    Row,
    /// One above the other, with a horizontal divider ("split down").
    Column,
}

/// A direction, for keyboard focus moves and resizes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Dir {
    Left,
    Right,
    Up,
    Down,
}

impl Dir {
    fn axis(self) -> Axis {
        match self {
            Dir::Left | Dir::Right => Axis::Row,
            Dir::Up | Dir::Down => Axis::Column,
        }
    }
}

/// One pane's history: the page shown, the pages behind it and ahead of it.
#[derive(Debug, Clone, PartialEq)]
pub struct History {
    back: Vec<PageRef>,
    current: PageRef,
    forward: Vec<PageRef>,
}

impl History {
    pub fn new(page: PageRef) -> History {
        History {
            back: Vec::new(),
            current: page,
            forward: Vec::new(),
        }
    }

    pub fn current(&self) -> &PageRef {
        &self.current
    }

    /// The pages behind the current one, oldest first.
    pub fn back_list(&self) -> &[PageRef] {
        &self.back
    }

    /// The pages ahead, the next one last.
    pub fn forward_list(&self) -> &[PageRef] {
        &self.forward
    }

    pub fn can_back(&self) -> bool {
        !self.back.is_empty()
    }

    pub fn can_forward(&self) -> bool {
        !self.forward.is_empty()
    }

    /// Opens `page`: the current one goes on the back list and the forward list clears, as in a
    /// browser. Opening the page already shown does nothing.
    pub fn open(&mut self, page: PageRef) -> bool {
        if page == self.current {
            return false;
        }
        let old = std::mem::replace(&mut self.current, page);
        self.back.push(old);
        if self.back.len() > HISTORY_CAP {
            self.back.remove(0);
        }
        self.forward.clear();
        true
    }

    pub fn back(&mut self) -> bool {
        let Some(prev) = self.back.pop() else {
            return false;
        };
        let cur = std::mem::replace(&mut self.current, prev);
        self.forward.push(cur);
        if self.forward.len() > HISTORY_CAP {
            self.forward.remove(0);
        }
        true
    }

    pub fn forward(&mut self) -> bool {
        let Some(next) = self.forward.pop() else {
            return false;
        };
        let cur = std::mem::replace(&mut self.current, next);
        self.back.push(cur);
        true
    }

    /// Goes back to `back_list()[i]` (a breadcrumb click): the pages after it move to the
    /// forward list, so Forward retraces them.
    pub fn back_to(&mut self, i: usize) -> bool {
        if i >= self.back.len() {
            return false;
        }
        while self.back.len() > i {
            self.back();
        }
        true
    }
}

/// A node of the pane tree.
#[derive(Debug, Clone, PartialEq)]
pub enum Layout {
    Pane(PaneId),
    Split(Split),
}

#[derive(Debug, Clone, PartialEq)]
pub struct Split {
    pub id: SplitId,
    pub axis: Axis,
    /// The first side's share, `MIN_RATIO..=1 - MIN_RATIO`.
    pub ratio: f32,
    pub first: Box<Layout>,
    pub second: Box<Layout>,
}

/// A rectangle in any unit (the UI passes logical pixels).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

impl Rect {
    fn split(self, axis: Axis, ratio: f32) -> (Rect, Rect) {
        match axis {
            Axis::Row => {
                let w = self.w * ratio;
                (
                    Rect { w, ..self },
                    Rect {
                        x: self.x + w,
                        w: self.w - w,
                        ..self
                    },
                )
            }
            Axis::Column => {
                let h = self.h * ratio;
                (
                    Rect { h, ..self },
                    Rect {
                        y: self.y + h,
                        h: self.h - h,
                        ..self
                    },
                )
            }
        }
    }
}

/// A saved pane tree with the page each pane shows (histories are not saved).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SavedNode {
    Pane {
        /// A page key the game no longer knows (a hand edit, an old file) loads as the World
        /// page, so one bad key costs one pane, not the whole config (D452).
        #[serde(deserialize_with = "lenient_page")]
        page: PageRef,
    },
    Split {
        axis: Axis,
        ratio: f32,
        first: Box<SavedNode>,
        second: Box<SavedNode>,
    },
}

fn lenient_page<'de, D: serde::Deserializer<'de>>(d: D) -> Result<PageRef, D::Error> {
    let key = String::deserialize(d)?;
    Ok(PageRef::from_key(&key).unwrap_or_else(|| {
        bevy::log::warn!("UI config: unknown page {key:?} in a layout; it opens the World page");
        PageRef::World
    }))
}

/// A named layout, or the last session's (D450).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SavedLayout {
    pub root: SavedNode,
    /// The focused pane's position in the tree's left-to-right order.
    pub focused: usize,
}

impl SavedLayout {
    fn panes(&self) -> usize {
        fn n(node: &SavedNode) -> usize {
            match node {
                SavedNode::Pane { .. } => 1,
                SavedNode::Split { first, second, .. } => n(first) + n(second),
            }
        }
        n(&self.root)
    }

    /// The layout with ratios in range and the focus index valid, or `None` if it has more
    /// than [`MAX_PANES`] panes.
    pub fn sanitized(mut self) -> Option<SavedLayout> {
        fn fix(node: &mut SavedNode) {
            if let SavedNode::Split {
                ratio,
                first,
                second,
                ..
            } = node
            {
                *ratio = clamp_ratio(*ratio);
                fix(first);
                fix(second);
            }
        }
        if self.panes() > MAX_PANES {
            return None;
        }
        fix(&mut self.root);
        if self.focused >= self.panes() {
            self.focused = 0;
        }
        Some(self)
    }
}

pub fn clamp_ratio(r: f32) -> f32 {
    if r.is_finite() {
        r.clamp(MIN_RATIO, 1.0 - MIN_RATIO)
    } else {
        0.5
    }
}

/// The workspace: the pane tree, every pane's history and the focused pane.
#[derive(Resource, Debug, Clone, PartialEq)]
pub struct Workspace {
    root: Layout,
    panes: BTreeMap<PaneId, History>,
    focused: PaneId,
    next_pane: u32,
    next_split: u32,
    /// Bumped whenever the tree's shape changes (split, close, load), so the UI rebuilds.
    structure: u64,
}

impl Default for Workspace {
    fn default() -> Self {
        Workspace::new(PageRef::World)
    }
}

impl Workspace {
    /// One pane showing `page`.
    pub fn new(page: PageRef) -> Workspace {
        let id = PaneId(0);
        Workspace {
            root: Layout::Pane(id),
            panes: BTreeMap::from([(id, History::new(page))]),
            focused: id,
            next_pane: 1,
            next_split: 0,
            structure: 0,
        }
    }

    pub fn root(&self) -> &Layout {
        &self.root
    }

    pub fn focused(&self) -> PaneId {
        self.focused
    }

    pub fn structure_version(&self) -> u64 {
        self.structure
    }

    pub fn len(&self) -> usize {
        self.panes.len()
    }

    pub fn is_empty(&self) -> bool {
        self.panes.is_empty()
    }

    pub fn history(&self, pane: PaneId) -> Option<&History> {
        self.panes.get(&pane)
    }

    /// The page a pane shows.
    pub fn page(&self, pane: PaneId) -> Option<&PageRef> {
        self.panes.get(&pane).map(History::current)
    }

    /// Panes in the tree's left-to-right (top-to-bottom) order.
    pub fn pane_ids(&self) -> Vec<PaneId> {
        fn walk(l: &Layout, out: &mut Vec<PaneId>) {
            match l {
                Layout::Pane(p) => out.push(*p),
                Layout::Split(s) => {
                    walk(&s.first, out);
                    walk(&s.second, out);
                }
            }
        }
        let mut out = Vec::with_capacity(self.panes.len());
        walk(&self.root, &mut out);
        out
    }

    pub fn focus(&mut self, pane: PaneId) -> bool {
        if self.panes.contains_key(&pane) && self.focused != pane {
            self.focused = pane;
            true
        } else {
            false
        }
    }

    /// Opens `page` in `pane` (its history grows).
    pub fn open(&mut self, pane: PaneId, page: PageRef) -> bool {
        self.panes.get_mut(&pane).is_some_and(|h| h.open(page))
    }

    pub fn back(&mut self, pane: PaneId) -> bool {
        self.panes.get_mut(&pane).is_some_and(History::back)
    }

    pub fn forward(&mut self, pane: PaneId) -> bool {
        self.panes.get_mut(&pane).is_some_and(History::forward)
    }

    pub fn back_to(&mut self, pane: PaneId, i: usize) -> bool {
        self.panes.get_mut(&pane).is_some_and(|h| h.back_to(i))
    }

    /// Splits `pane` along `axis`: the new pane is the second side, showing `page` (or a copy of
    /// the split pane's page) with a fresh history. Focus moves to it when `focus_new`. `None`
    /// at [`MAX_PANES`] or for an unknown pane.
    pub fn split(
        &mut self,
        pane: PaneId,
        axis: Axis,
        page: Option<PageRef>,
        focus_new: bool,
    ) -> Option<PaneId> {
        if self.panes.len() >= MAX_PANES {
            return None;
        }
        let page = page.or_else(|| self.page(pane).cloned())?;
        let new = PaneId(self.next_pane);
        let split = SplitId(self.next_split);
        let node = find_pane_mut(&mut self.root, pane)?;
        let old = std::mem::replace(node, Layout::Pane(new));
        *node = Layout::Split(Split {
            id: split,
            axis,
            ratio: 0.5,
            first: Box::new(old),
            second: Box::new(Layout::Pane(new)),
        });
        self.next_pane += 1;
        self.next_split += 1;
        self.panes.insert(new, History::new(page));
        if focus_new {
            self.focused = new;
        }
        self.structure += 1;
        Some(new)
    }

    /// The axis that halves `pane` along its longer side, in a workspace `w` by `h`.
    pub fn auto_axis(&self, pane: PaneId, w: f32, h: f32) -> Axis {
        match self.rects(w, h).into_iter().find(|(p, _)| *p == pane) {
            Some((_, r)) if r.h > r.w => Axis::Column,
            _ => Axis::Row,
        }
    }

    /// Closes `pane`; its sibling takes the split's place. The last pane never closes. A closed
    /// focused pane hands focus to the first pane (in tree order) of its sibling subtree, the
    /// pane that now fills its place; another pane's focus is kept.
    pub fn close(&mut self, pane: PaneId) -> bool {
        if self.panes.len() <= 1 || !self.panes.contains_key(&pane) {
            return false;
        }
        let heir = self.sibling_of(pane);
        if !remove_pane(&mut self.root, pane) {
            return false;
        }
        self.panes.remove(&pane);
        if self.focused == pane {
            self.focused = heir.unwrap_or_else(|| self.pane_ids()[0]);
        }
        self.structure += 1;
        true
    }

    /// Whether splitting `pane` along `axis`, in a workspace `w` by `h` logical pixels, leaves
    /// both halves at least [`MIN_PANE_W`] by [`MIN_PANE_H`] (D450).
    pub fn can_split(&self, pane: PaneId, axis: Axis, w: f32, h: f32) -> bool {
        if self.panes.len() >= MAX_PANES {
            return false;
        }
        let Some((_, r)) = self.rects(w, h).into_iter().find(|(p, _)| *p == pane) else {
            return false;
        };
        let (hw, hh) = match axis {
            Axis::Row => (r.w / 2.0, r.h),
            Axis::Column => (r.w, r.h / 2.0),
        };
        hw >= MIN_PANE_W && hh >= MIN_PANE_H
    }

    /// The axis a new pane split off `pane` takes: its longer side's, or the other when that one
    /// would make a pane too small; `None` when neither fits.
    pub fn new_pane_axis(&self, pane: PaneId, w: f32, h: f32) -> Option<Axis> {
        let first = self.auto_axis(pane, w, h);
        let other = match first {
            Axis::Row => Axis::Column,
            Axis::Column => Axis::Row,
        };
        [first, other]
            .into_iter()
            .find(|&a| self.can_split(pane, a, w, h))
    }

    pub fn ratio(&self, split: SplitId) -> Option<f32> {
        find_split(&self.root, split).map(|s| s.ratio)
    }

    /// Sets a split's ratio (clamped to keep [`MIN_RATIO`] each side).
    pub fn set_ratio(&mut self, split: SplitId, ratio: f32) -> bool {
        match find_split_mut(&mut self.root, split) {
            Some(s) => {
                let r = clamp_ratio(ratio);
                let moved = (s.ratio - r).abs() > f32::EPSILON;
                s.ratio = r;
                moved
            }
            None => false,
        }
    }

    /// Sets a split's ratio as a divider drag or a keyboard resize does, in a workspace `w` by
    /// `h` (D450, D571): clamped to keep [`MIN_RATIO`] each side and every pane on both sides
    /// at least [`MIN_PANE_W`] by [`MIN_PANE_H`] at the other splits' ratios. When the panes
    /// cannot all fit at any ratio (the window shrank), the ratio holds.
    pub fn set_ratio_in(&mut self, split: SplitId, ratio: f32, w: f32, h: f32) -> bool {
        let whole = Rect {
            x: 0.0,
            y: 0.0,
            w,
            h,
        };
        let Some(r) = split_rect(&self.root, split, whole) else {
            return false;
        };
        let Some(s) = find_split(&self.root, split) else {
            return false;
        };
        let len = match s.axis {
            Axis::Row => r.w,
            Axis::Column => r.h,
        };
        if len <= 0.0 {
            return false;
        }
        let lo = (min_extent(&s.first, s.axis) / len).max(MIN_RATIO);
        let hi = (1.0 - min_extent(&s.second, s.axis) / len).min(1.0 - MIN_RATIO);
        if lo > hi {
            return false;
        }
        self.set_ratio(split, clamp_ratio(ratio).clamp(lo, hi))
    }

    /// Moves the divider nearest `pane` on `dir`'s axis one [`NUDGE`] towards `dir`, as
    /// [`Workspace::set_ratio_in`] in a workspace `w` by `h`.
    pub fn nudge_in(&mut self, pane: PaneId, dir: Dir, w: f32, h: f32) -> bool {
        let Some((split, r)) = self.nudged(pane, dir) else {
            return false;
        };
        self.set_ratio_in(split, r, w, h)
    }

    /// Moves the divider nearest `pane` on `dir`'s axis one [`NUDGE`] towards `dir`, with no
    /// pane-size limit (the UI uses [`Workspace::nudge_in`]).
    pub fn nudge(&mut self, pane: PaneId, dir: Dir) -> bool {
        match self.nudged(pane, dir) {
            Some((split, r)) => self.set_ratio(split, r),
            None => false,
        }
    }

    /// The split a nudge of `pane` towards `dir` moves, and the ratio it asks for: the
    /// innermost enclosing split on that axis.
    fn nudged(&self, pane: PaneId, dir: Dir) -> Option<(SplitId, f32)> {
        let path = path_to(&self.root, pane)?;
        let split = path
            .iter()
            .rev()
            .find(|(_, axis)| *axis == dir.axis())
            .map(|(id, _)| *id)?;
        let delta = match dir {
            Dir::Right | Dir::Down => NUDGE,
            Dir::Left | Dir::Up => -NUDGE,
        };
        Some((split, self.ratio(split).unwrap_or(0.5) + delta))
    }

    /// Every pane's rectangle in a workspace `w` by `h`, in tree order.
    pub fn rects(&self, w: f32, h: f32) -> Vec<(PaneId, Rect)> {
        fn walk(l: &Layout, r: Rect, out: &mut Vec<(PaneId, Rect)>) {
            match l {
                Layout::Pane(p) => out.push((*p, r)),
                Layout::Split(s) => {
                    let (a, b) = r.split(s.axis, s.ratio);
                    walk(&s.first, a, out);
                    walk(&s.second, b, out);
                }
            }
        }
        let mut out = Vec::new();
        walk(
            &self.root,
            Rect {
                x: 0.0,
                y: 0.0,
                w,
                h,
            },
            &mut out,
        );
        out
    }

    /// The pane next to `pane` towards `dir`: among panes beyond its edge that overlap it across
    /// the other axis, the nearest, then the one overlapping most, then the lower id (D2).
    pub fn neighbor(&self, pane: PaneId, dir: Dir, w: f32, h: f32) -> Option<PaneId> {
        let rects = self.rects(w, h);
        let (_, me) = *rects.iter().find(|(p, _)| *p == pane)?;
        let eps = 0.5;
        let mut best: Option<(f32, f32, PaneId)> = None;
        for &(p, r) in &rects {
            if p == pane {
                continue;
            }
            let (gap, overlap) = match dir {
                Dir::Right => (r.x - (me.x + me.w), span(me.y, me.h, r.y, r.h)),
                Dir::Left => (me.x - (r.x + r.w), span(me.y, me.h, r.y, r.h)),
                Dir::Down => (r.y - (me.y + me.h), span(me.x, me.w, r.x, r.w)),
                Dir::Up => (me.y - (r.y + r.h), span(me.x, me.w, r.x, r.w)),
            };
            if gap < -eps || overlap <= eps {
                continue;
            }
            let cand = (gap.max(0.0), -overlap, p);
            if best.is_none_or(|b| (cand.0, cand.1, cand.2) < (b.0, b.1, b.2)) {
                best = Some(cand);
            }
        }
        best.map(|(_, _, p)| p)
    }

    /// The next pane in tree order after `pane` (wrapping), for Ctrl+Tab.
    pub fn cycle(&self, pane: PaneId, step: i32) -> PaneId {
        let ids = self.pane_ids();
        let i = ids.iter().position(|p| *p == pane).unwrap_or(0) as i32;
        let n = ids.len() as i32;
        ids[((i + step).rem_euclid(n)) as usize]
    }

    /// The layout as a [`SavedLayout`].
    pub fn to_saved(&self) -> SavedLayout {
        fn save(ws: &Workspace, l: &Layout) -> SavedNode {
            match l {
                Layout::Pane(p) => SavedNode::Pane {
                    page: ws.page(*p).cloned().unwrap_or(PageRef::World),
                },
                Layout::Split(s) => SavedNode::Split {
                    axis: s.axis,
                    ratio: s.ratio,
                    first: Box::new(save(ws, &s.first)),
                    second: Box::new(save(ws, &s.second)),
                },
            }
        }
        SavedLayout {
            root: save(self, &self.root),
            focused: self
                .pane_ids()
                .iter()
                .position(|p| *p == self.focused)
                .unwrap_or(0),
        }
    }

    /// Replaces the whole workspace with `saved` (fresh histories, new ids).
    pub fn load(&mut self, saved: &SavedLayout) {
        let Some(saved) = saved.clone().sanitized() else {
            return;
        };
        let mut ws = Workspace {
            root: Layout::Pane(PaneId(0)),
            panes: BTreeMap::new(),
            focused: PaneId(0),
            next_pane: self.next_pane,
            next_split: self.next_split,
            structure: self.structure + 1,
        };
        fn build(ws: &mut Workspace, n: &SavedNode) -> Layout {
            match n {
                SavedNode::Pane { page } => {
                    let id = PaneId(ws.next_pane);
                    ws.next_pane += 1;
                    ws.panes.insert(id, History::new(page.clone()));
                    Layout::Pane(id)
                }
                SavedNode::Split {
                    axis,
                    ratio,
                    first,
                    second,
                } => {
                    let id = SplitId(ws.next_split);
                    ws.next_split += 1;
                    let first = Box::new(build(ws, first));
                    let second = Box::new(build(ws, second));
                    Layout::Split(Split {
                        id,
                        axis: *axis,
                        ratio: *ratio,
                        first,
                        second,
                    })
                }
            }
        }
        ws.root = build(&mut ws, &saved.root);
        let ids = ws.pane_ids();
        ws.focused = ids[saved.focused.min(ids.len() - 1)];
        *self = ws;
    }

    /// Every split in tree order with its axis and ratio (for the UI's divider sync).
    pub fn splits(&self) -> Vec<(SplitId, Axis, f32)> {
        fn walk(l: &Layout, out: &mut Vec<(SplitId, Axis, f32)>) {
            if let Layout::Split(s) = l {
                out.push((s.id, s.axis, s.ratio));
                walk(&s.first, out);
                walk(&s.second, out);
            }
        }
        let mut out = Vec::new();
        walk(&self.root, &mut out);
        out
    }

    /// The pane closing `pane` should focus: the first pane of its sibling subtree.
    pub fn sibling_of(&self, pane: PaneId) -> Option<PaneId> {
        fn first(l: &Layout) -> PaneId {
            match l {
                Layout::Pane(p) => *p,
                Layout::Split(s) => first(&s.first),
            }
        }
        fn walk(l: &Layout, pane: PaneId) -> Option<PaneId> {
            let Layout::Split(s) = l else {
                return None;
            };
            if *s.first == Layout::Pane(pane) {
                return Some(first(&s.second));
            }
            if *s.second == Layout::Pane(pane) {
                return Some(first(&s.first));
            }
            walk(&s.first, pane).or_else(|| walk(&s.second, pane))
        }
        walk(&self.root, pane)
    }
}

fn span(a: f32, al: f32, b: f32, bl: f32) -> f32 {
    ((a + al).min(b + bl) - a.max(b)).max(0.0)
}

fn find_pane_mut(l: &mut Layout, pane: PaneId) -> Option<&mut Layout> {
    match l {
        Layout::Pane(p) if *p == pane => Some(l),
        Layout::Pane(_) => None,
        Layout::Split(s) => {
            if let Some(found) = find_pane_mut(&mut s.first, pane) {
                return Some(found);
            }
            find_pane_mut(&mut s.second, pane)
        }
    }
}

/// The rectangle split `id` divides, inside `r` (the area of `l`).
fn split_rect(l: &Layout, id: SplitId, r: Rect) -> Option<Rect> {
    let Layout::Split(s) = l else {
        return None;
    };
    if s.id == id {
        return Some(r);
    }
    let (a, b) = r.split(s.axis, s.ratio);
    split_rect(&s.first, id, a).or_else(|| split_rect(&s.second, id, b))
}

/// The least length along `axis` that `l` needs for every pane in it to keep [`MIN_PANE_W`] by
/// [`MIN_PANE_H`] at its splits' current ratios (D571).
fn min_extent(l: &Layout, axis: Axis) -> f32 {
    match l {
        Layout::Pane(_) => match axis {
            Axis::Row => MIN_PANE_W,
            Axis::Column => MIN_PANE_H,
        },
        Layout::Split(s) => {
            let (a, b) = (min_extent(&s.first, axis), min_extent(&s.second, axis));
            if s.axis == axis {
                (a / s.ratio).max(b / (1.0 - s.ratio))
            } else {
                a.max(b)
            }
        }
    }
}

fn find_split(l: &Layout, id: SplitId) -> Option<&Split> {
    match l {
        Layout::Pane(_) => None,
        Layout::Split(s) if s.id == id => Some(s),
        Layout::Split(s) => find_split(&s.first, id).or_else(|| find_split(&s.second, id)),
    }
}

fn find_split_mut(l: &mut Layout, id: SplitId) -> Option<&mut Split> {
    let Layout::Split(s) = l else {
        return None;
    };
    if s.id == id {
        return Some(s);
    }
    if let Some(found) = find_split_mut(&mut s.first, id) {
        return Some(found);
    }
    find_split_mut(&mut s.second, id)
}

/// Removes the leaf `pane`: its parent split is replaced by the other side.
fn remove_pane(l: &mut Layout, pane: PaneId) -> bool {
    let Layout::Split(s) = l else {
        return false;
    };
    let keep = if *s.first == Layout::Pane(pane) {
        Some(std::mem::replace(&mut *s.second, Layout::Pane(pane)))
    } else if *s.second == Layout::Pane(pane) {
        Some(std::mem::replace(&mut *s.first, Layout::Pane(pane)))
    } else {
        None
    };
    if let Some(keep) = keep {
        *l = keep;
        return true;
    }
    remove_pane(&mut s.first, pane) || remove_pane(&mut s.second, pane)
}

/// The splits from the root down to `pane`, with their axes.
fn path_to(l: &Layout, pane: PaneId) -> Option<Vec<(SplitId, Axis)>> {
    match l {
        Layout::Pane(p) => (*p == pane).then(Vec::new),
        Layout::Split(s) => {
            let sub = path_to(&s.first, pane).or_else(|| path_to(&s.second, pane))?;
            let mut out = vec![(s.id, s.axis)];
            out.extend(sub);
            Some(out)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sim::world::{CompanyId, IndustryId};

    fn co(n: u32) -> PageRef {
        PageRef::Company(CompanyId(n))
    }

    #[test]
    fn history_is_a_browser_history() {
        let mut h = History::new(PageRef::World);
        assert!(!h.can_back() && !h.can_forward());
        assert!(h.open(co(1)));
        assert!(!h.open(co(1)), "the shown page does not stack");
        h.open(co(2));
        h.open(PageRef::Industry(IndustryId(4)));
        assert_eq!(h.back_list(), [PageRef::World, co(1), co(2)]);
        assert!(h.back());
        assert_eq!(h.current(), &co(2));
        assert!(h.back());
        assert!(h.forward());
        assert_eq!(h.current(), &co(2));
        // Opening from the middle drops the forward list.
        h.open(co(9));
        assert!(!h.can_forward());
        assert_eq!(h.back_list(), [PageRef::World, co(1), co(2)]);
        // A breadcrumb jump: back to World, the rest is forward.
        assert!(h.back_to(0));
        assert_eq!(h.current(), &PageRef::World);
        assert_eq!(h.forward_list().len(), 3);
        assert!(h.forward());
        assert_eq!(h.current(), &co(1));
        assert!(!h.back_to(5));
        // The cap.
        let mut h = History::new(co(0));
        for i in 1..=(HISTORY_CAP as u32 + 10) {
            h.open(co(i));
        }
        assert_eq!(h.back_list().len(), HISTORY_CAP);
        assert_eq!(h.back_list()[0], co(10));
    }

    #[test]
    fn split_close_and_focus() {
        let mut ws = Workspace::new(PageRef::World);
        let a = ws.focused();
        let b = ws.split(a, Axis::Row, Some(co(1)), true).unwrap();
        assert_eq!(ws.focused(), b);
        assert_eq!(ws.page(b), Some(&co(1)));
        let c = ws.split(b, Axis::Column, None, false).unwrap();
        assert_eq!(ws.focused(), b, "focus stays when asked");
        assert_eq!(ws.page(c), Some(&co(1)), "a copy of the split pane's page");
        assert_eq!(ws.pane_ids(), [a, b, c]);
        assert_eq!(ws.history(c).unwrap().back_list().len(), 0, "fresh history");
        let v = ws.structure_version();
        // Closing b: c takes the right half.
        assert_eq!(ws.sibling_of(b), Some(c));
        assert!(ws.close(b));
        assert!(ws.structure_version() > v);
        assert_eq!(ws.pane_ids(), [a, c]);
        assert_eq!(ws.focused(), c);
        let rects = ws.rects(1000.0, 500.0);
        assert_eq!(
            rects[1].1,
            Rect {
                x: 500.0,
                y: 0.0,
                w: 500.0,
                h: 500.0
            }
        );
        assert!(ws.close(a));
        assert!(!ws.close(c), "the last pane stays");
        assert_eq!(ws.pane_ids(), [c]);
        assert_eq!(ws.root(), &Layout::Pane(c));
        assert!(!ws.close(PaneId(99)));
    }

    #[test]
    fn panes_are_capped() {
        let mut ws = Workspace::new(PageRef::World);
        for _ in 1..MAX_PANES {
            let f = ws.focused();
            assert!(ws.split(f, Axis::Row, None, true).is_some());
        }
        assert_eq!(ws.len(), MAX_PANES);
        assert!(ws.split(ws.focused(), Axis::Row, None, true).is_none());
    }

    #[test]
    fn ratios_resize_and_clamp() {
        let mut ws = Workspace::new(PageRef::World);
        let a = ws.focused();
        let b = ws.split(a, Axis::Row, None, false).unwrap();
        let c = ws.split(b, Axis::Column, None, false).unwrap();
        let splits = ws.splits();
        let (outer, inner) = (splits[0].0, splits[1].0);
        assert!(ws.set_ratio(outer, 0.3));
        assert_eq!(ws.ratio(outer), Some(0.3));
        ws.set_ratio(outer, 2.0);
        assert_eq!(ws.ratio(outer), Some(1.0 - MIN_RATIO));
        ws.set_ratio(outer, f32::NAN);
        assert_eq!(ws.ratio(outer), Some(0.5));
        // Keyboard: c grows downward moves the inner (column) divider down.
        assert!(ws.nudge(c, Dir::Down));
        assert!((ws.ratio(inner).unwrap() - 0.55).abs() < 1e-6);
        // Left from c moves the outer (row) divider left.
        assert!(ws.nudge(c, Dir::Left));
        assert!((ws.ratio(outer).unwrap() - 0.45).abs() < 1e-6);
        // a has no column split above it.
        assert!(!ws.nudge(a, Dir::Up));
        let r = ws.rects(1000.0, 1000.0);
        assert!((r[0].1.w - 450.0).abs() < 1e-3);
        assert!((r[1].1.h - 550.0).abs() < 1e-3);
    }

    /// A sized resize never leaves a pane under the minimum (D571): a drag or nudge stops at
    /// the ratio where the smallest pane on either side, nested splits included, reaches it,
    /// and holds when nothing fits.
    #[test]
    fn sized_resizes_keep_the_minimum_pane() {
        // a | (b / (c | d)) in 1000 x 600.
        let (w, h) = (1000.0, 600.0);
        let mut ws = Workspace::new(PageRef::World);
        let a = ws.focused();
        let b = ws.split(a, Axis::Row, None, false).unwrap();
        let c = ws.split(b, Axis::Column, None, false).unwrap();
        let d = ws.split(c, Axis::Row, None, false).unwrap();
        let outer = ws.splits()[0].0;
        let small = |ws: &Workspace| {
            ws.rects(w, h)
                .iter()
                .map(|(_, r)| (r.w, r.h))
                .fold((f32::MAX, f32::MAX), |m, r| (m.0.min(r.0), m.1.min(r.1)))
        };
        // Right: c and d share the right side, so it keeps 2 x 160 px.
        assert!(ws.set_ratio_in(outer, 0.95, w, h));
        assert!((ws.ratio(outer).unwrap() - 0.68).abs() < 1e-4);
        assert!(small(&ws).0 >= MIN_PANE_W - 1e-3);
        // Left: a keeps 160 of 1000.
        assert!(ws.set_ratio_in(outer, 0.0, w, h));
        assert!((ws.ratio(outer).unwrap() - 0.16).abs() < 1e-4);
        for _ in 0..30 {
            for (p, dir) in [(d, Dir::Up), (c, Dir::Left), (a, Dir::Left), (b, Dir::Down)] {
                ws.nudge_in(p, dir, w, h);
                let (mw, mh) = small(&ws);
                assert!(
                    mw >= MIN_PANE_W - 1e-3 && mh >= MIN_PANE_H - 1e-3,
                    "{mw} x {mh}"
                );
            }
        }
        // In a workspace too small for the panes, a resize holds.
        let r = ws.ratio(outer);
        assert!(!ws.set_ratio_in(outer, 0.5, 300.0, 600.0));
        assert_eq!(ws.ratio(outer), r);
        // The unsized setter still clamps only to MIN_RATIO.
        ws.set_ratio(outer, 0.0);
        assert_eq!(ws.ratio(outer), Some(MIN_RATIO));
    }

    #[test]
    fn neighbors_follow_the_geometry() {
        // a | (b / c)
        let mut ws = Workspace::new(PageRef::World);
        let a = ws.focused();
        let b = ws.split(a, Axis::Row, None, false).unwrap();
        let c = ws.split(b, Axis::Column, None, false).unwrap();
        let (w, h) = (1200.0, 800.0);
        assert_eq!(
            ws.neighbor(a, Dir::Right, w, h),
            Some(b),
            "ties to the lower id"
        );
        assert_eq!(ws.neighbor(b, Dir::Down, w, h), Some(c));
        assert_eq!(ws.neighbor(c, Dir::Up, w, h), Some(b));
        assert_eq!(ws.neighbor(c, Dir::Left, w, h), Some(a));
        assert_eq!(ws.neighbor(a, Dir::Left, w, h), None);
        assert_eq!(ws.neighbor(a, Dir::Up, w, h), None);
        assert_eq!(ws.cycle(c, 1), a);
        assert_eq!(ws.cycle(a, -1), c);
        // Auto axis: a is 600 x 800 (taller), b is 600 x 400 (wider).
        assert_eq!(ws.auto_axis(a, w, h), Axis::Column);
        assert_eq!(ws.auto_axis(b, w, h), Axis::Row);
    }

    #[test]
    fn layouts_save_and_load() {
        let mut ws = Workspace::new(PageRef::World);
        let a = ws.focused();
        let b = ws.split(a, Axis::Row, Some(co(3)), true).unwrap();
        ws.split(b, Axis::Column, Some(PageRef::News), false);
        ws.set_ratio(ws.splits()[0].0, 0.35);
        ws.open(b, co(4));
        let saved = ws.to_saved();
        assert_eq!(saved.focused, 1);
        let mut other = Workspace::new(PageRef::Settings);
        let v = other.structure_version();
        other.load(&saved);
        assert!(other.structure_version() > v);
        assert_eq!(other.to_saved(), saved);
        let ids = other.pane_ids();
        assert_eq!(other.focused(), ids[1]);
        assert_eq!(other.page(ids[1]), Some(&co(4)));
        assert!(!other.history(ids[1]).unwrap().can_back());
        // A layout with too many panes is refused.
        let mut node = SavedNode::Pane {
            page: PageRef::World,
        };
        for _ in 0..MAX_PANES {
            node = SavedNode::Split {
                axis: Axis::Row,
                ratio: 0.5,
                first: Box::new(node),
                second: Box::new(SavedNode::Pane {
                    page: PageRef::World,
                }),
            };
        }
        let big = SavedLayout {
            root: node,
            focused: 0,
        };
        assert!(big.clone().sanitized().is_none());
        let before = other.clone();
        other.load(&big);
        assert_eq!(other, before);
    }

    #[test]
    fn splits_keep_panes_readable() {
        let mut ws = Workspace::new(PageRef::World);
        let a = ws.focused();
        // 400 x 300: one row split leaves 200 x 300 halves, a second would be 100 wide.
        assert!(ws.can_split(a, Axis::Row, 400.0, 300.0));
        let b = ws.split(a, Axis::Row, None, false).unwrap();
        assert!(!ws.can_split(a, Axis::Row, 400.0, 300.0));
        assert!(
            ws.can_split(a, Axis::Column, 400.0, 300.0),
            "150 px tall halves"
        );
        assert_eq!(ws.new_pane_axis(a, 400.0, 300.0), Some(Axis::Column));
        ws.split(b, Axis::Column, None, false).unwrap();
        // b is 200 x 150 now: no way to split it.
        assert_eq!(ws.new_pane_axis(b, 400.0, 300.0), None);
        assert!(!ws.can_split(PaneId(99), Axis::Row, 4000.0, 3000.0));
    }

    /// Random sequences of every operation keep the workspace whole: the tree and the pane map
    /// agree, the focus is a pane, ratios stay in range, the panes tile the area exactly, and a
    /// save loads back the same.
    #[test]
    fn random_operations_keep_the_invariants() {
        let (w, h) = (1600.0f32, 900.0f32);
        let mut seed: u64 = 0x2545_f491_4f6c_dd1d;
        let mut next = |n: u64| {
            seed ^= seed << 13;
            seed ^= seed >> 7;
            seed ^= seed << 17;
            seed % n
        };
        for run in 0..40 {
            let mut ws = Workspace::new(PageRef::World);
            for step in 0..120 {
                let ids = ws.pane_ids();
                let pane = ids[next(ids.len() as u64) as usize];
                match next(9) {
                    0 | 1 => {
                        let axis = if next(2) == 0 {
                            Axis::Row
                        } else {
                            Axis::Column
                        };
                        if ws.can_split(pane, axis, w, h) {
                            ws.split(pane, axis, Some(co(step)), next(2) == 0);
                        }
                    }
                    2 => {
                        ws.close(pane);
                    }
                    3 => {
                        if let Some(&(s, _, _)) = ws.splits().first() {
                            ws.set_ratio(s, next(1000) as f32 / 500.0 - 0.5);
                        }
                    }
                    4 => {
                        let d = [Dir::Left, Dir::Right, Dir::Up, Dir::Down][next(4) as usize];
                        ws.nudge(pane, d);
                    }
                    5 => {
                        ws.open(pane, co(step + 1000));
                    }
                    6 => {
                        ws.back(pane);
                    }
                    7 => {
                        let s = ws.to_saved();
                        ws.load(&s);
                        assert_eq!(ws.to_saved(), s, "run {run} step {step}");
                    }
                    _ => {
                        ws.focus(pane);
                    }
                }
                check(&ws, w, h, run, step);
            }
        }
    }

    fn check(ws: &Workspace, w: f32, h: f32, run: usize, step: u32) {
        let ids = ws.pane_ids();
        let mut sorted = ids.clone();
        sorted.sort_unstable();
        sorted.dedup();
        assert_eq!(sorted.len(), ids.len(), "a pane twice in the tree");
        let keys: Vec<PaneId> = ws.panes.keys().copied().collect();
        assert_eq!(sorted, keys, "tree and map agree (run {run} step {step})");
        assert!(ws.panes.contains_key(&ws.focused()), "the focus is a pane");
        assert!((1..=MAX_PANES).contains(&ws.len()));
        for (_, _, r) in ws.splits() {
            assert!((MIN_RATIO..=1.0 - MIN_RATIO).contains(&r), "ratio {r}");
        }
        let rects = ws.rects(w, h);
        let area: f32 = rects.iter().map(|(_, r)| r.w * r.h).sum();
        assert!(
            (area - w * h).abs() < 1.0,
            "the panes tile the area: {area}"
        );
        for (_, r) in &rects {
            assert!(r.x >= -0.01 && r.y >= -0.01);
            assert!(r.x + r.w <= w + 0.01 && r.y + r.h <= h + 0.01);
        }
        for (i, (_, a)) in rects.iter().enumerate() {
            for (_, b) in &rects[i + 1..] {
                let ox = (a.x + a.w).min(b.x + b.w) - a.x.max(b.x);
                let oy = (a.y + a.h).min(b.y + b.h) - a.y.max(b.y);
                assert!(ox <= 0.01 || oy <= 0.01, "panes overlap");
            }
        }
    }
}
