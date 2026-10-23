//! The workspace's model (M9 A2, D450; M8 floating windows, D635), with no Bevy entities:
//! floating windows over the map, each a binary tree of splits whose leaves are panes, each pane
//! with its own back and forward history. The workspace UI ([`super`]) draws it and turns input
//! into calls here; tests drive it directly.

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
/// Most floating windows open at once (D635).
pub const MAX_WINDOWS: usize = 8;
/// A window's title bar and frame, in logical pixels (D635).
pub const TITLE_BAR_H: f32 = 22.0;
pub const WINDOW_BORDER: f32 = 1.0;

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

/// A floating window's rectangle in logical pixels, inside the area the windows float in.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct WinRect {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

impl From<WinRect> for Rect {
    fn from(r: WinRect) -> Rect {
        Rect {
            x: r.x,
            y: r.y,
            w: r.w,
            h: r.h,
        }
    }
}

/// A saved window (D635): its pane tree, focused pane (position in tree order), rectangle
/// (`None` fills the area: an M9 layout migrated) and whether it is minimized.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SavedWindow {
    pub root: SavedNode,
    #[serde(default)]
    pub focused: usize,
    #[serde(default)]
    pub rect: Option<WinRect>,
    #[serde(default)]
    pub minimized: bool,
}

impl SavedWindow {
    fn panes(&self) -> usize {
        fn n(node: &SavedNode) -> usize {
            match node {
                SavedNode::Pane { .. } => 1,
                SavedNode::Split { first, second, .. } => n(first) + n(second),
            }
        }
        n(&self.root)
    }
}

/// A named layout, or the last session's (D450, D635): the windows bottom to top and the
/// focused window. An M9 layout (one tree, `root` and the focused pane) loads as one window
/// filling the area.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SavedLayout {
    #[serde(default)]
    pub windows: Vec<SavedWindow>,
    /// The focused window's position in `windows` (in an M9 layout: the focused pane's).
    #[serde(default)]
    pub focused: usize,
    /// An M9 layout's tree, moved into `windows` by [`SavedLayout::sanitized`]; never written.
    #[serde(
        default,
        skip_serializing,
        deserialize_with = "legacy_root",
        rename = "root"
    )]
    pub legacy_root: Option<SavedNode>,
}

fn legacy_root<'de, D: serde::Deserializer<'de>>(d: D) -> Result<Option<SavedNode>, D::Error> {
    SavedNode::deserialize(d).map(Some)
}

impl SavedLayout {
    /// One window holding `root`, filling the area, with pane `focused` focused.
    pub fn single(root: SavedNode, focused: usize) -> SavedLayout {
        SavedLayout {
            windows: vec![SavedWindow {
                root,
                focused,
                rect: None,
                minimized: false,
            }],
            focused: 0,
            legacy_root: None,
        }
    }

    /// Every pane of every window.
    pub fn panes(&self) -> usize {
        self.windows.iter().map(SavedWindow::panes).sum::<usize>()
            + self.legacy_root.as_ref().map_or(0, |r| {
                SavedWindow {
                    root: r.clone(),
                    focused: 0,
                    rect: None,
                    minimized: false,
                }
                .panes()
            })
    }

    /// The layout with an M9 tree moved into one window, ratios in range, rectangles finite and
    /// the focus indices valid, or `None` if a window has more than [`MAX_PANES`] panes, there
    /// are more than [`MAX_WINDOWS`] windows, or none.
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
        if let Some(root) = self.legacy_root.take() {
            let focused = std::mem::take(&mut self.focused);
            self.windows.insert(
                0,
                SavedWindow {
                    root,
                    focused,
                    rect: None,
                    minimized: false,
                },
            );
        }
        if self.windows.is_empty()
            || self.windows.len() > MAX_WINDOWS
            || self.windows.iter().any(|w| w.panes() > MAX_PANES)
        {
            return None;
        }
        for w in &mut self.windows {
            fix(&mut w.root);
            if w.focused >= w.panes() {
                w.focused = 0;
            }
            if let Some(r) = w.rect
                && ![r.x, r.y, r.w, r.h].iter().all(|v| v.is_finite())
            {
                w.rect = None;
            }
        }
        if self.focused >= self.windows.len() {
            self.focused = self.windows.len() - 1;
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

/// A floating window's id.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct WindowId(pub u32);

/// One floating window over the map (D635): an M9 pane tree with its focused pane.
#[derive(Debug, Clone, PartialEq)]
pub struct PaneWindow {
    pub id: WindowId,
    pub root: Layout,
    pub focused: PaneId,
    pub rect: WinRect,
    /// The rectangle the player (or a saved layout) last chose: `rect` is it clamped to the
    /// area, so a window shrunk by a smaller area grows back when the area grows again (review
    /// of PR #35; D708).
    pub preferred: WinRect,
    pub minimized: bool,
    /// How the rectangle follows the area (D635).
    pub fit: Fit,
}

/// How a window's rectangle follows the area it floats in (D635).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Fit {
    /// Placed by the player (or a saved layout): only kept inside the area.
    Fixed,
    /// A fresh workspace's first window: laid out at the right of the area once the area is
    /// measured, then fixed.
    First,
    /// Fills the area and follows it as it grows or shrinks (an M9 layout migrated), until the
    /// player moves or resizes it.
    Fill,
}

impl PaneWindow {
    /// The area the window's panes tile: its rectangle less the title bar and frame.
    pub fn body(&self) -> (f32, f32) {
        body_of(self.rect)
    }

    /// Its panes in tree order.
    pub fn pane_ids(&self) -> Vec<PaneId> {
        let mut out = Vec::new();
        walk_panes(&self.root, &mut out);
        out
    }
}

fn walk_panes(l: &Layout, out: &mut Vec<PaneId>) {
    match l {
        Layout::Pane(p) => out.push(*p),
        Layout::Split(s) => {
            walk_panes(&s.first, out);
            walk_panes(&s.second, out);
        }
    }
}

/// The pane area of a window rectangle.
pub fn body_of(r: WinRect) -> (f32, f32) {
    (
        (r.w - 2.0 * WINDOW_BORDER).max(0.0),
        (r.h - TITLE_BAR_H - 2.0 * WINDOW_BORDER).max(0.0),
    )
}

/// The workspace: floating windows over the map (D635), each a pane tree; every pane's history;
/// the focused window and, in each window, its focused pane. The methods M9 had act on the
/// focused window, so one window behaves as the M9 workspace did.
#[derive(Resource, Debug, Clone, PartialEq)]
pub struct Workspace {
    /// Bottom to top.
    windows: Vec<PaneWindow>,
    panes: BTreeMap<PaneId, History>,
    active: WindowId,
    next_pane: u32,
    next_split: u32,
    next_window: u32,
    /// Bumped whenever a tree's shape changes or a window opens or closes (split, close, load),
    /// so the UI rebuilds.
    structure: u64,
    /// Bumped when a window moves, resizes, rises, minimizes or the windows hide, so the UI
    /// restyles the frames without rebuilding them.
    geometry: u64,
    /// Every window hidden by the hide key, the map alone on screen.
    hidden: bool,
    /// The logical size of the area the windows float in.
    area: (f32, f32),
    /// The UI has measured the area: before that, windows are laid out on [`DEFAULT_AREA`]
    /// and not clamped, so a saved layout keeps its rectangles until the real area is known.
    measured: bool,
}

impl Default for Workspace {
    fn default() -> Self {
        Workspace::new(PageRef::World)
    }
}

/// The area before the UI has measured it (and in headless tests).
pub const DEFAULT_AREA: (f32, f32) = (1280.0, 800.0);

/// The first window's place in a fresh workspace (D635): the right part of the area, full
/// height, so the map shows on the left.
pub const FIRST_WINDOW_X_SHARE: f32 = 0.4;
/// A new window's share of the area, and the step each one is cascaded by.
pub const NEW_WINDOW_SHARE: f32 = 0.5;
pub const CASCADE: f32 = 24.0;

impl Workspace {
    /// One window with one pane showing `page`, at the right of the area.
    pub fn new(page: PageRef) -> Workspace {
        let id = PaneId(0);
        let area = DEFAULT_AREA;
        let window = PaneWindow {
            id: WindowId(0),
            root: Layout::Pane(id),
            focused: id,
            rect: first_rect(area),
            preferred: first_rect(area),
            minimized: false,
            fit: Fit::First,
        };
        Workspace {
            windows: vec![window],
            panes: BTreeMap::from([(id, History::new(page))]),
            active: WindowId(0),
            next_pane: 1,
            next_split: 0,
            next_window: 1,
            structure: 0,
            geometry: 0,
            hidden: false,
            area,
            measured: false,
        }
    }

    fn win(&self, id: WindowId) -> Option<&PaneWindow> {
        self.windows.iter().find(|w| w.id == id)
    }

    fn win_mut(&mut self, id: WindowId) -> Option<&mut PaneWindow> {
        self.windows.iter_mut().find(|w| w.id == id)
    }

    fn active_win(&self) -> &PaneWindow {
        self.win(self.active).unwrap_or(&self.windows[0])
    }

    fn active_win_mut(&mut self) -> &mut PaneWindow {
        let id = self.active;
        let i = self.windows.iter().position(|w| w.id == id).unwrap_or(0);
        &mut self.windows[i]
    }

    /// The focused window's pane tree.
    pub fn root(&self) -> &Layout {
        &self.active_win().root
    }

    /// The focused window's focused pane: where pages open and keys act.
    pub fn focused(&self) -> PaneId {
        self.active_win().focused
    }

    pub fn structure_version(&self) -> u64 {
        self.structure
    }

    pub fn geometry_version(&self) -> u64 {
        self.geometry
    }

    /// Panes in every window.
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

    /// The focused window's panes in its tree's left-to-right (top-to-bottom) order.
    pub fn pane_ids(&self) -> Vec<PaneId> {
        self.active_win().pane_ids()
    }

    /// Every window's panes, windows bottom to top.
    pub fn all_pane_ids(&self) -> Vec<PaneId> {
        self.windows.iter().flat_map(PaneWindow::pane_ids).collect()
    }

    /// The windows, bottom to top.
    pub fn windows(&self) -> &[PaneWindow] {
        &self.windows
    }

    pub fn window(&self, id: WindowId) -> Option<&PaneWindow> {
        self.win(id)
    }

    /// The focused window.
    pub fn active_window(&self) -> WindowId {
        self.active
    }

    /// The window holding `pane`.
    pub fn window_of(&self, pane: PaneId) -> Option<WindowId> {
        self.windows
            .iter()
            .find(|w| find_pane(&w.root, pane))
            .map(|w| w.id)
    }

    /// The window holding split `split`.
    pub fn window_of_split(&self, split: SplitId) -> Option<WindowId> {
        self.windows
            .iter()
            .find(|w| find_split(&w.root, split).is_some())
            .map(|w| w.id)
    }

    /// Every window is hidden (the hide key).
    pub fn hidden(&self) -> bool {
        self.hidden
    }

    /// The area the windows float in.
    pub fn area(&self) -> (f32, f32) {
        self.area
    }

    /// The focused window's pane area: what the M9 calls take as the workspace size.
    pub fn body_size(&self) -> (f32, f32) {
        self.active_win().body()
    }

    /// Focuses `pane`: its window comes to the top (restored if minimized) and the pane takes
    /// its window's focus.
    pub fn focus(&mut self, pane: PaneId) -> bool {
        let Some(w) = self.window_of(pane) else {
            return false;
        };
        let raised = self.raise(w);
        let win = self.active_win_mut();
        if win.focused != pane {
            win.focused = pane;
            true
        } else {
            raised
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

    /// Splits `pane` along `axis` in its window: the new pane is the second side, showing
    /// `page` (or a copy of the split pane's page) with a fresh history. The window's focus moves
    /// to it when `focus_new`. `None` at [`MAX_PANES`] in the window or for an unknown pane.
    pub fn split(
        &mut self,
        pane: PaneId,
        axis: Axis,
        page: Option<PageRef>,
        focus_new: bool,
    ) -> Option<PaneId> {
        let w = self.window_of(pane)?;
        if self.win(w)?.pane_ids().len() >= MAX_PANES {
            return None;
        }
        let page = page.or_else(|| self.page(pane).cloned())?;
        let new = PaneId(self.next_pane);
        let split = SplitId(self.next_split);
        let win = self.win_mut(w)?;
        let node = find_pane_mut(&mut win.root, pane)?;
        let old = std::mem::replace(node, Layout::Pane(new));
        *node = Layout::Split(Split {
            id: split,
            axis,
            ratio: 0.5,
            first: Box::new(old),
            second: Box::new(Layout::Pane(new)),
        });
        if focus_new {
            win.focused = new;
        }
        self.next_pane += 1;
        self.next_split += 1;
        self.panes.insert(new, History::new(page));
        self.structure += 1;
        Some(new)
    }

    /// The rectangle of `pane` in its window's tree laid out in `w` by `h`.
    fn pane_rect(&self, pane: PaneId, w: f32, h: f32) -> Option<Rect> {
        let win = self.win(self.window_of(pane)?)?;
        tree_rects(&win.root, w, h)
            .into_iter()
            .find(|(p, _)| *p == pane)
            .map(|(_, r)| r)
    }

    /// The axis that halves `pane` along its longer side, in a window body `w` by `h`.
    pub fn auto_axis(&self, pane: PaneId, w: f32, h: f32) -> Axis {
        match self.pane_rect(pane, w, h) {
            Some(r) if r.h > r.w => Axis::Column,
            _ => Axis::Row,
        }
    }

    /// Closes `pane`; its sibling takes the split's place. A window's last pane never closes
    /// (close the window instead). A closed focused pane hands its window's focus to the first
    /// pane (in tree order) of its sibling subtree, the pane that now fills its place.
    pub fn close(&mut self, pane: PaneId) -> bool {
        let Some(w) = self.window_of(pane) else {
            return false;
        };
        let heir = self.sibling_of(pane);
        let Some(win) = self.win_mut(w) else {
            return false;
        };
        if matches!(win.root, Layout::Pane(_)) || !remove_pane(&mut win.root, pane) {
            return false;
        }
        if win.focused == pane {
            win.focused = heir.unwrap_or_else(|| win.pane_ids()[0]);
        }
        self.panes.remove(&pane);
        self.structure += 1;
        true
    }

    /// Whether splitting `pane` along `axis`, in a window body `w` by `h` logical pixels, leaves
    /// both halves at least [`MIN_PANE_W`] by [`MIN_PANE_H`] (D450).
    pub fn can_split(&self, pane: PaneId, axis: Axis, w: f32, h: f32) -> bool {
        let Some(win) = self.window_of(pane).and_then(|id| self.win(id)) else {
            return false;
        };
        if win.pane_ids().len() >= MAX_PANES {
            return false;
        }
        let Some(r) = self.pane_rect(pane, w, h) else {
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
        self.windows
            .iter()
            .find_map(|w| find_split(&w.root, split))
            .map(|s| s.ratio)
    }

    /// Sets a split's ratio (clamped to keep [`MIN_RATIO`] each side).
    pub fn set_ratio(&mut self, split: SplitId, ratio: f32) -> bool {
        match self
            .windows
            .iter_mut()
            .find_map(|w| find_split_mut(&mut w.root, split))
        {
            Some(s) => {
                let r = clamp_ratio(ratio);
                let moved = (s.ratio - r).abs() > f32::EPSILON;
                s.ratio = r;
                moved
            }
            None => false,
        }
    }

    /// Sets a split's ratio as a divider drag or a keyboard resize does, in a window body `w`
    /// by `h` (D450, D571): clamped to keep [`MIN_RATIO`] each side and every pane on both sides
    /// at least [`MIN_PANE_W`] by [`MIN_PANE_H`] at the other splits' ratios. When the panes
    /// cannot all fit at any ratio (the window shrank), the ratio holds.
    pub fn set_ratio_in(&mut self, split: SplitId, ratio: f32, w: f32, h: f32) -> bool {
        let whole = Rect {
            x: 0.0,
            y: 0.0,
            w,
            h,
        };
        let Some(win) = self.window_of_split(split).and_then(|id| self.win(id)) else {
            return false;
        };
        let Some(r) = split_rect(&win.root, split, whole) else {
            return false;
        };
        let Some(s) = find_split(&win.root, split) else {
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
    /// [`Workspace::set_ratio_in`] in a window body `w` by `h`.
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
        let win = self.win(self.window_of(pane)?)?;
        let path = path_to(&win.root, pane)?;
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

    /// Every pane's rectangle in the focused window's tree laid out in `w` by `h`, in tree
    /// order.
    pub fn rects(&self, w: f32, h: f32) -> Vec<(PaneId, Rect)> {
        tree_rects(self.root(), w, h)
    }

    /// The pane next to `pane` towards `dir` in its window: among panes beyond its edge that
    /// overlap it across the other axis, the nearest, then the one overlapping most, then the
    /// lower id (D2).
    pub fn neighbor(&self, pane: PaneId, dir: Dir, w: f32, h: f32) -> Option<PaneId> {
        let win = self.win(self.window_of(pane)?)?;
        let rects = tree_rects(&win.root, w, h);
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

    /// The next pane in the focused window's tree order after `pane` (wrapping), for Ctrl+Tab.
    pub fn cycle(&self, pane: PaneId, step: i32) -> PaneId {
        let ids = self.pane_ids();
        let i = ids.iter().position(|p| *p == pane).unwrap_or(0) as i32;
        let n = ids.len() as i32;
        ids[((i + step).rem_euclid(n)) as usize]
    }

    /// The layout as a [`SavedLayout`]: every window, bottom to top.
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
            windows: self
                .windows
                .iter()
                .map(|w| SavedWindow {
                    root: save(self, &w.root),
                    focused: w
                        .pane_ids()
                        .iter()
                        .position(|p| *p == w.focused)
                        .unwrap_or(0),
                    rect: (w.fit != Fit::Fill).then_some(w.preferred),
                    minimized: w.minimized,
                })
                .collect(),
            focused: self
                .windows
                .iter()
                .position(|w| w.id == self.active)
                .unwrap_or(0),
            legacy_root: None,
        }
    }

    /// Replaces the whole workspace with `saved` (fresh histories, new ids); a window with no
    /// rectangle fills the area. The area and the hidden flag stay.
    pub fn load(&mut self, saved: &SavedLayout) {
        let Some(saved) = saved.clone().sanitized() else {
            return;
        };
        let mut ws = Workspace {
            windows: Vec::new(),
            panes: BTreeMap::new(),
            active: WindowId(0),
            next_pane: self.next_pane,
            next_split: self.next_split,
            next_window: self.next_window,
            structure: self.structure + 1,
            geometry: self.geometry + 1,
            hidden: self.hidden,
            area: self.area,
            measured: self.measured,
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
        for sw in &saved.windows {
            let root = build(&mut ws, &sw.root);
            let mut ids = Vec::new();
            walk_panes(&root, &mut ids);
            let id = WindowId(ws.next_window);
            ws.next_window += 1;
            let fit = if sw.rect.is_some() {
                Fit::Fixed
            } else {
                Fit::Fill
            };
            let rect = sw.rect.unwrap_or(full_rect(ws.area));
            ws.windows.push(PaneWindow {
                id,
                focused: ids[sw.focused.min(ids.len() - 1)],
                root,
                rect,
                preferred: rect,
                minimized: sw.minimized,
                fit,
            });
        }
        ws.active = ws.windows[saved.focused].id;
        if ws.measured {
            ws.clamp_all();
        }
        *self = ws;
    }

    /// Every split in every window, windows bottom to top, each in tree order, with its axis and
    /// ratio (for the UI's divider sync).
    pub fn splits(&self) -> Vec<(SplitId, Axis, f32)> {
        fn walk(l: &Layout, out: &mut Vec<(SplitId, Axis, f32)>) {
            if let Layout::Split(s) = l {
                out.push((s.id, s.axis, s.ratio));
                walk(&s.first, out);
                walk(&s.second, out);
            }
        }
        let mut out = Vec::new();
        for w in &self.windows {
            walk(&w.root, &mut out);
        }
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
        let win = self.win(self.window_of(pane)?)?;
        walk(&win.root, pane)
    }

    // ---- The window layer (D635) ----

    /// Opens a new window on top showing `page` in one pane, cascaded from the area's centre,
    /// and focuses it. `None` at [`MAX_WINDOWS`].
    pub fn new_window(&mut self, page: PageRef) -> Option<WindowId> {
        if self.windows.len() >= MAX_WINDOWS {
            return None;
        }
        let pane = PaneId(self.next_pane);
        self.next_pane += 1;
        let id = WindowId(self.next_window);
        self.next_window += 1;
        let (aw, ah) = self.area;
        let (w, h) = (
            (aw * NEW_WINDOW_SHARE).max(MIN_WINDOW_W),
            (ah * NEW_WINDOW_SHARE * 1.4).min(ah).max(MIN_WINDOW_H),
        );
        let step = (self.windows.len() % 6) as f32 * CASCADE;
        let rect = WinRect {
            x: (aw - w) / 2.0 + step,
            y: (ah - h) / 3.0 + step,
            w,
            h,
        };
        self.panes.insert(pane, History::new(page));
        self.windows.push(PaneWindow {
            id,
            root: Layout::Pane(pane),
            focused: pane,
            rect,
            preferred: rect,
            minimized: false,
            fit: Fit::Fixed,
        });
        self.active = id;
        self.hidden = false;
        self.clamp(id);
        self.choose(id, [true; 4]);
        self.structure += 1;
        self.geometry += 1;
        Some(id)
    }

    /// Closes window `id` and its panes. The last window never closes; the focus goes to the
    /// top window still shown, else the top one.
    pub fn close_window(&mut self, id: WindowId) -> bool {
        if self.windows.len() <= 1 {
            return false;
        }
        let Some(i) = self.windows.iter().position(|w| w.id == id) else {
            return false;
        };
        let win = self.windows.remove(i);
        for p in win.pane_ids() {
            self.panes.remove(&p);
        }
        if self.active == id {
            self.active = self
                .top_shown()
                .unwrap_or(self.windows[self.windows.len() - 1].id);
        }
        self.structure += 1;
        self.geometry += 1;
        true
    }

    /// The top window that is not minimized.
    fn top_shown(&self) -> Option<WindowId> {
        self.windows
            .iter()
            .rev()
            .find(|w| !w.minimized)
            .map(|w| w.id)
    }

    /// Brings window `id` to the top, restored, and focuses it. True if anything changed.
    pub fn raise(&mut self, id: WindowId) -> bool {
        let Some(i) = self.windows.iter().position(|w| w.id == id) else {
            return false;
        };
        let changed = i + 1 != self.windows.len() || self.active != id || self.windows[i].minimized;
        if changed {
            let mut w = self.windows.remove(i);
            w.minimized = false;
            self.windows.push(w);
            self.active = id;
            self.geometry += 1;
        }
        changed
    }

    /// Minimizes window `id` to the dock; the focus moves to the top window still shown (it
    /// stays when every window is minimized, and the next page opened restores it).
    pub fn minimize(&mut self, id: WindowId) -> bool {
        let Some(w) = self.win_mut(id) else {
            return false;
        };
        if w.minimized {
            return false;
        }
        w.minimized = true;
        if self.active == id
            && let Some(top) = self.top_shown()
        {
            self.active = top;
        }
        self.geometry += 1;
        true
    }

    /// Shows `pane`'s window, for a page opening in it (D635): the windows un-hide and the
    /// window, if minimized, comes back on top. The focus stays where it was, unless every
    /// window was minimized and the focused one comes back.
    pub fn reveal_pane(&mut self, pane: PaneId) -> bool {
        let mut changed = std::mem::take(&mut self.hidden);
        if let Some(id) = self.window_of(pane)
            && let Some(i) = self.windows.iter().position(|w| w.id == id)
            && self.windows[i].minimized
        {
            let mut w = self.windows.remove(i);
            w.minimized = false;
            self.windows.push(w);
            if self.win(self.active).is_none_or(|a| a.minimized) {
                self.active = id;
            }
            changed = true;
        }
        if changed {
            self.geometry += 1;
        }
        changed
    }

    /// Hides or shows every window (the hide key).
    pub fn toggle_hidden(&mut self) {
        self.hidden = !self.hidden;
        self.geometry += 1;
    }

    /// The smallest window `id` may be: its panes at their minimum (D571) plus its frame.
    pub fn min_window_size(&self, id: WindowId) -> (f32, f32) {
        let Some(w) = self.win(id) else {
            return (MIN_WINDOW_W, MIN_WINDOW_H);
        };
        (
            (min_extent(&w.root, Axis::Row) + 2.0 * WINDOW_BORDER).max(MIN_WINDOW_W),
            (min_extent(&w.root, Axis::Column) + TITLE_BAR_H + 2.0 * WINDOW_BORDER)
                .max(MIN_WINDOW_H),
        )
    }

    /// Moves window `id` by `dx`, `dy`, keeping it inside the area.
    pub fn move_window(&mut self, id: WindowId, dx: f32, dy: f32) -> bool {
        let Some(w) = self.win_mut(id) else {
            return false;
        };
        let before = w.rect;
        w.rect.x += dx;
        w.rect.y += dy;
        self.clamp(id);
        // The player chose a place, not a size: a window the area shrank keeps its size to grow
        // back to.
        self.placed(id, before, true, false)
    }

    /// Resizes window `id` by `dw`, `dh` from its bottom right corner, never below
    /// [`Workspace::min_window_size`] (so no pane goes under its minimum, D571).
    pub fn resize_window(&mut self, id: WindowId, dw: f32, dh: f32) -> bool {
        let (mw, mh) = self.min_window_size(id);
        let (aw, ah) = self.area;
        let Some(w) = self.win_mut(id) else {
            return false;
        };
        let before = w.rect;
        // The corner stops at the area's edge (or at the minimum, if that is larger).
        w.rect.w = (w.rect.w + dw).max(mw).min((aw - w.rect.x).max(mw));
        w.rect.h = (w.rect.h + dh).max(mh).min((ah - w.rect.y).max(mh));
        self.clamp(id);
        self.placed(id, before, false, true)
    }

    /// Sets window `id`'s rectangle (clamped as a move and a resize are).
    pub fn set_window_rect(&mut self, id: WindowId, rect: WinRect) -> bool {
        let (mw, mh) = self.min_window_size(id);
        let Some(w) = self.win_mut(id) else {
            return false;
        };
        let before = w.rect;
        w.rect = WinRect {
            w: rect.w.max(mw),
            h: rect.h.max(mh),
            ..rect
        };
        self.clamp(id);
        self.placed(id, before, true, true)
    }

    /// After a move or resize of window `id` from `before`: when it changed anything, the
    /// window is the player's (`Fit::Fixed`) and, of its place (`at`) and size (`size`), the
    /// coordinates that actually changed become its preferred ones (a width-only resize keeps
    /// the preferred height); a drag that changed nothing leaves a filling window filling
    /// (review of PR #35 and PR #37; D708).
    fn placed(&mut self, id: WindowId, before: WinRect, at: bool, size: bool) -> bool {
        let Some(r) = self.win(id).map(|w| w.rect) else {
            return false;
        };
        if r != before {
            let mask = [
                at && r.x != before.x,
                at && r.y != before.y,
                size && r.w != before.w,
                size && r.h != before.h,
            ];
            self.choose(id, mask);
        }
        self.moved(id, before)
    }

    /// Makes the masked coordinates (x, y, w, h) of window `id`'s shown rectangle its preferred
    /// ones; a window that was not the player's yet takes its whole shown rectangle first.
    fn choose(&mut self, id: WindowId, [x, y, w_, h]: [bool; 4]) {
        let Some(w) = self.win_mut(id) else { return };
        if w.fit != Fit::Fixed {
            w.preferred = w.rect;
        }
        w.fit = Fit::Fixed;
        if x {
            w.preferred.x = w.rect.x;
        }
        if y {
            w.preferred.y = w.rect.y;
        }
        if w_ {
            w.preferred.w = w.rect.w;
        }
        if h {
            w.preferred.h = w.rect.h;
        }
    }

    fn moved(&mut self, id: WindowId, before: WinRect) -> bool {
        let changed = self.win(id).is_some_and(|w| w.rect != before);
        if changed {
            self.geometry += 1;
        }
        changed
    }

    /// Sets the area the windows float in (the UI measures it). The first measurement lays out
    /// a fresh workspace's first window; a window filling the area follows it; every window is
    /// kept inside it.
    pub fn set_area(&mut self, w: f32, h: f32) -> bool {
        let same = (self.area.0 - w).abs() < 0.5 && (self.area.1 - h).abs() < 0.5;
        if !(w > 0.0 && h > 0.0) || (same && self.measured) {
            return false;
        }
        self.area = (w, h);
        self.measured = true;
        let area = self.area;
        for win in &mut self.windows {
            match win.fit {
                Fit::First => {
                    win.rect = first_rect(area);
                    win.preferred = win.rect;
                    win.fit = Fit::Fixed;
                }
                Fit::Fill => win.rect = full_rect(area),
                // Back towards what the player chose, then clamped (D708).
                Fit::Fixed => win.rect = win.preferred,
            }
        }
        self.clamp_all();
        self.geometry += 1;
        true
    }

    fn clamp_all(&mut self) {
        let ids: Vec<WindowId> = self.windows.iter().map(|w| w.id).collect();
        for id in ids {
            self.clamp(id);
        }
    }

    /// Keeps window `id` no larger than the area (nor under [`MIN_WINDOW_W`] by
    /// [`MIN_WINDOW_H`]) and wholly inside it when it fits (its title bar, buttons and grip
    /// always reachable). It does not grow a window to its panes' minimum: as when the M9
    /// workspace shrank, the panes keep their ratios (D571); only a resize from the grip stops
    /// at the minimum.
    fn clamp(&mut self, id: WindowId) {
        let (mw, mh) = (MIN_WINDOW_W, MIN_WINDOW_H);
        let (aw, ah) = self.area;
        let Some(w) = self.win_mut(id) else {
            return;
        };
        let r = &mut w.rect;
        r.w = r.w.min(aw.max(mw)).max(mw);
        r.h = r.h.min(ah.max(mh)).max(mh);
        r.x = r.x.clamp(0.0, (aw - r.w).max(0.0));
        r.y = r.y.clamp(0.0, (ah - r.h).max(0.0));
    }

    /// The top window shown at `x`, `y` in the area, if any: where a click there goes instead
    /// of the map (D635).
    pub fn window_at(&self, x: f32, y: f32) -> Option<WindowId> {
        if self.hidden {
            return None;
        }
        self.windows
            .iter()
            .rev()
            .filter(|w| !w.minimized)
            .find(|w| {
                x >= w.rect.x && x < w.rect.x + w.rect.w && y >= w.rect.y && y < w.rect.y + w.rect.h
            })
            .map(|w| w.id)
    }
}

/// The smallest window, before its panes' own minimum (D635).
pub const MIN_WINDOW_W: f32 = MIN_PANE_W + 2.0 * WINDOW_BORDER;
pub const MIN_WINDOW_H: f32 = MIN_PANE_H + TITLE_BAR_H + 2.0 * WINDOW_BORDER;
fn full_rect((aw, ah): (f32, f32)) -> WinRect {
    WinRect {
        x: 0.0,
        y: 0.0,
        w: aw,
        h: ah,
    }
}

fn first_rect((aw, ah): (f32, f32)) -> WinRect {
    WinRect {
        x: aw * FIRST_WINDOW_X_SHARE,
        y: 0.0,
        w: aw * (1.0 - FIRST_WINDOW_X_SHARE),
        h: ah,
    }
}

fn tree_rects(root: &Layout, w: f32, h: f32) -> Vec<(PaneId, Rect)> {
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
        root,
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

fn find_pane(l: &Layout, pane: PaneId) -> bool {
    match l {
        Layout::Pane(p) => *p == pane,
        Layout::Split(s) => find_pane(&s.first, pane) || find_pane(&s.second, pane),
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
        assert_eq!(saved.windows[0].focused, 1);
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
        let big = SavedLayout::single(node, 0);
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

    // ---- The window layer (D635) ----

    #[test]
    fn a_fresh_workspace_is_one_window_at_the_right() {
        let ws = Workspace::new(PageRef::World);
        assert_eq!(ws.windows().len(), 1);
        let w = &ws.windows()[0];
        let (aw, ah) = DEFAULT_AREA;
        assert_eq!(w.rect.x, aw * FIRST_WINDOW_X_SHARE);
        assert_eq!(
            (w.rect.w, w.rect.h),
            (aw * (1.0 - FIRST_WINDOW_X_SHARE), ah)
        );
        assert_eq!(
            ws.body_size(),
            (
                w.rect.w - 2.0 * WINDOW_BORDER,
                ah - TITLE_BAR_H - 2.0 * WINDOW_BORDER
            )
        );
        // A point on the map's part of the area is no window's.
        assert_eq!(ws.window_at(10.0, 10.0), None);
        assert_eq!(ws.window_at(aw - 10.0, 10.0), Some(w.id));
    }

    #[test]
    fn windows_open_rise_minimize_and_close() {
        let mut ws = Workspace::new(PageRef::World);
        let first = ws.active_window();
        let a = ws.focused();
        let w2 = ws.new_window(co(1)).unwrap();
        assert_eq!(ws.active_window(), w2);
        let b = ws.focused();
        assert_ne!(a, b);
        assert_eq!(ws.page(b), Some(&co(1)));
        assert_eq!(ws.pane_ids(), [b], "the M9 calls act on the focused window");
        assert_eq!(ws.all_pane_ids(), [a, b]);
        assert_eq!(ws.len(), 2);
        // A split in the second window stays in it.
        let c = ws.split(b, Axis::Row, Some(co(2)), true).unwrap();
        assert_eq!(ws.window_of(c), Some(w2));
        assert_eq!(ws.windows()[0].pane_ids(), [a]);
        // Focusing a pane raises its window.
        assert!(ws.focus(a));
        assert_eq!(ws.active_window(), first);
        assert_eq!(ws.windows().last().unwrap().id, first, "on top");
        assert_eq!(ws.focused(), a);
        // The window's own focus is kept for when it comes back.
        ws.raise(w2);
        assert_eq!(ws.focused(), c);
        // Minimize hands focus to the top window still shown; a page opening restores it.
        assert!(ws.minimize(w2));
        assert_eq!(ws.active_window(), first);
        assert!(ws.window(w2).unwrap().minimized);
        let r = ws.window(w2).unwrap().rect;
        assert_ne!(ws.window_at(r.x + 5.0, r.y + 5.0), Some(w2));
        assert!(ws.reveal_pane(c));
        assert!(!ws.window(w2).unwrap().minimized);
        assert_eq!(ws.active_window(), first, "revealing keeps the focus");
        // Closing a window drops its panes; the last window stays.
        let v = ws.structure_version();
        assert!(ws.close_window(w2));
        assert!(ws.structure_version() > v);
        assert_eq!(ws.all_pane_ids(), [a]);
        assert!(ws.history(c).is_none());
        assert!(!ws.close_window(first), "the last window stays");
        // The last pane of a window does not close as a pane either.
        assert!(!ws.close(a));
        // At most MAX_WINDOWS.
        for i in 1..MAX_WINDOWS {
            assert!(ws.new_window(co(i as u32)).is_some());
        }
        assert!(ws.new_window(co(99)).is_none());
    }

    #[test]
    fn windows_move_and_resize_inside_the_area() {
        let mut ws = Workspace::new(PageRef::World);
        let id = ws.active_window();
        let (aw, ah) = DEFAULT_AREA;
        // A smaller window first, so it can move.
        ws.set_window_rect(
            id,
            WinRect {
                x: 100.0,
                y: 100.0,
                w: 500.0,
                h: 400.0,
            },
        );
        let g = ws.geometry_version();
        assert!(ws.move_window(id, -5000.0, 5000.0));
        assert!(ws.geometry_version() > g);
        let r = ws.window(id).unwrap().rect;
        assert_eq!((r.x, r.y), (0.0, ah - r.h), "wholly inside, bottom left");
        ws.move_window(id, 1e6, -1e6);
        let r = ws.window(id).unwrap().rect;
        assert_eq!(
            (r.x, r.y),
            (aw - r.w, 0.0),
            "its buttons and grip stay on screen"
        );
        // A resize never goes under the panes' minimum (D571).
        let p = ws.focused();
        ws.split(p, Axis::Row, None, false).unwrap();
        ws.resize_window(id, -1e6, -1e6);
        let (mw, mh) = ws.min_window_size(id);
        let r = ws.window(id).unwrap().rect;
        assert_eq!((r.w, r.h), (mw, mh));
        assert!(mw >= 2.0 * MIN_PANE_W);
        let (bw, bh) = ws.body_size();
        for (_, pr) in ws.rects(bw, bh) {
            assert!(pr.w >= MIN_PANE_W - 1e-3 && pr.h >= MIN_PANE_H - 1e-3);
        }
        // Nor past the area's edge.
        ws.resize_window(id, 1e6, 1e6);
        let r = ws.window(id).unwrap().rect;
        assert_eq!((r.x + r.w, r.y + r.h), (aw, ah));
        // The area shrinking pulls windows back in.
        assert!(ws.set_area(640.0, 400.0));
        let r = ws.window(id).unwrap().rect;
        assert!(r.w <= 640.0 && r.h <= 400.0);
        assert!(r.x >= 0.0 && r.x + r.w <= 640.0 + 1e-3 && r.y + r.h <= 400.0 + 1e-3);
    }

    #[test]
    fn hiding_and_the_top_window_take_the_pointer() {
        let mut ws = Workspace::new(PageRef::World);
        let first = ws.active_window();
        let second = ws.new_window(co(1)).unwrap();
        ws.set_window_rect(
            second,
            WinRect {
                x: 600.0,
                y: 100.0,
                w: 400.0,
                h: 300.0,
            },
        );
        assert_eq!(ws.window_at(700.0, 200.0), Some(second), "the top one");
        ws.raise(first);
        assert_eq!(ws.window_at(700.0, 200.0), Some(first));
        assert_eq!(ws.window_at(100.0, 200.0), None, "the map");
        ws.toggle_hidden();
        assert!(ws.hidden());
        assert_eq!(ws.window_at(700.0, 200.0), None, "hidden: all map");
        let p = ws.focused();
        assert!(ws.reveal_pane(p));
        assert!(!ws.hidden());
    }

    #[test]
    fn every_window_saves_and_loads() {
        let mut ws = Workspace::new(PageRef::World);
        let a = ws.focused();
        ws.split(a, Axis::Column, Some(co(1)), true);
        let w2 = ws.new_window(PageRef::News).unwrap();
        ws.move_window(w2, -30.0, 40.0);
        let b = ws.focused();
        ws.split(b, Axis::Row, Some(co(5)), false);
        let w3 = ws.new_window(PageRef::Settings).unwrap();
        ws.minimize(w3);
        ws.raise(w2);
        let saved = ws.to_saved();
        assert_eq!(saved.windows.len(), 3);
        assert_eq!(saved.focused, 2, "w2 on top and focused");
        assert!(saved.windows[1].minimized);
        let mut other = Workspace::new(PageRef::World);
        other.load(&saved);
        assert_eq!(other.to_saved(), saved);
        assert_eq!(other.windows().len(), 3);
        assert_eq!(other.page(other.focused()), Some(&PageRef::News));
        // Through RON, as the config file stores it.
        let text = ron::to_string(&saved).unwrap();
        assert!(!text.contains("legacy"), "{text}");
        let back: SavedLayout = ron::from_str(&text).unwrap();
        assert_eq!(back.sanitized().unwrap(), saved);
        // An M9 file (one tree) migrates to one window filling the area.
        let old: SavedLayout = ron::from_str(concat!(
            "(root: Split(axis: Row, ratio: 0.3, first: Pane(page: \"news\"), second: ",
            "Pane(page: \"world\")), focused: 1)"
        ))
        .unwrap();
        let mut ws = Workspace::new(PageRef::Settings);
        ws.load(&old);
        assert_eq!(ws.windows().len(), 1);
        let r = ws.windows()[0].rect;
        assert_eq!(
            (r.x, r.y, r.w, r.h),
            (0.0, 0.0, DEFAULT_AREA.0, DEFAULT_AREA.1)
        );
        assert_eq!(ws.page(ws.focused()), Some(&PageRef::World));
        assert!((ws.ratio(ws.splits()[0].0).unwrap() - 0.3).abs() < 1e-6);
        // Too many windows is refused.
        let many = SavedLayout {
            windows: vec![saved.windows[0].clone(); MAX_WINDOWS + 1],
            focused: 0,
            legacy_root: None,
        };
        assert!(many.sanitized().is_none());
    }

    /// Random window and pane operations keep every window whole: each tree and the pane map
    /// agree, every focus is a pane of its window, every window keeps its title bar in the area,
    /// and a save loads back the same.
    #[test]
    fn random_window_operations_keep_the_invariants() {
        let mut seed: u64 = 0x9e37_79b9_7f4a_7c15;
        let mut next = |n: u64| {
            seed ^= seed << 13;
            seed ^= seed >> 7;
            seed ^= seed << 17;
            seed % n
        };
        for run in 0..30 {
            let mut ws = Workspace::new(PageRef::World);
            ws.set_area(1600.0, 900.0);
            for step in 0..150u32 {
                if step % 37 == 36 {
                    let (w, h) = (400.0 + next(1600) as f32, 300.0 + next(900) as f32);
                    ws.set_area(w, h);
                }
                let wins: Vec<WindowId> = ws.windows().iter().map(|w| w.id).collect();
                let win = wins[next(wins.len() as u64) as usize];
                let panes = ws.all_pane_ids();
                let pane = panes[next(panes.len() as u64) as usize];
                match next(11) {
                    0 => {
                        ws.new_window(co(step));
                    }
                    1 => {
                        ws.close_window(win);
                    }
                    2 => {
                        ws.raise(win);
                    }
                    3 => {
                        ws.minimize(win);
                    }
                    4 => {
                        let (dx, dy) = (next(4000) as f32 - 2000.0, next(4000) as f32 - 2000.0);
                        ws.move_window(win, dx, dy);
                    }
                    5 => {
                        let (dx, dy) = (next(2000) as f32 - 1000.0, next(2000) as f32 - 1000.0);
                        ws.resize_window(win, dx, dy);
                    }
                    6 => {
                        let (w, h) = ws.window(ws.window_of(pane).unwrap()).unwrap().body();
                        if let Some(axis) = ws.new_pane_axis(pane, w, h) {
                            ws.split(pane, axis, Some(co(step)), next(2) == 0);
                        }
                    }
                    7 => {
                        ws.close(pane);
                    }
                    8 => {
                        ws.focus(pane);
                    }
                    9 => {
                        let s = ws.to_saved();
                        ws.load(&s);
                        assert_eq!(ws.to_saved(), s, "run {run} step {step}");
                    }
                    _ => ws.toggle_hidden(),
                }
                check_windows(&ws, run, step);
            }
        }
    }

    fn check_windows(ws: &Workspace, run: usize, step: u32) {
        let mut all = ws.all_pane_ids();
        let n = all.len();
        all.sort_unstable();
        all.dedup();
        assert_eq!(
            all.len(),
            n,
            "a pane in two windows (run {run} step {step})"
        );
        let keys: Vec<PaneId> = ws.panes.keys().copied().collect();
        assert_eq!(all, keys, "trees and map agree (run {run} step {step})");
        assert!((1..=MAX_WINDOWS).contains(&ws.windows().len()));
        assert!(ws.window(ws.active_window()).is_some());
        let (aw, ah) = ws.area();
        for w in ws.windows() {
            assert!(w.pane_ids().contains(&w.focused), "run {run} step {step}");
            assert!(w.pane_ids().len() <= MAX_PANES);
            let r = w.rect;
            // Wholly inside whenever it fits.
            if r.w <= aw {
                assert!(
                    r.x >= -1e-3 && r.x + r.w <= aw + 1e-3,
                    "run {run} step {step}"
                );
            }
            if r.h <= ah {
                assert!(
                    r.y >= -1e-3 && r.y + r.h <= ah + 1e-3,
                    "run {run} step {step}"
                );
            }
            assert!(r.w >= MIN_WINDOW_W - 1e-3 && r.h >= MIN_WINDOW_H - 1e-3);
        }
    }

    /// The real area, measured after startup, lays out the first window inside it (the
    /// review of PR #35: a 1280 x 720 window has a 996 x 676 area).
    #[test]
    fn the_first_window_is_laid_out_in_the_measured_area() {
        let mut ws = Workspace::new(PageRef::World);
        let id = ws.active_window();
        assert!(ws.set_area(996.0, 676.0));
        let r = ws.window(id).unwrap().rect;
        assert!((r.x - 996.0 * FIRST_WINDOW_X_SHARE).abs() < 1e-3);
        assert!(
            (r.x + r.w - 996.0).abs() < 1e-3,
            "its right edge is the area's: {r:?}"
        );
        assert_eq!(r.h, 676.0);
        // Measuring the default size counts too.
        let mut ws = Workspace::new(PageRef::World);
        assert!(ws.set_area(DEFAULT_AREA.0, DEFAULT_AREA.1));
        // Later area changes keep it where the player left it, inside the area.
        let mut ws = Workspace::new(PageRef::World);
        ws.set_area(996.0, 676.0);
        ws.set_area(1500.0, 900.0);
        let r = ws.window(id).unwrap().rect;
        assert!(
            (r.x - 996.0 * FIRST_WINDOW_X_SHARE).abs() < 1e-3,
            "not re-laid out"
        );
        ws.set_area(700.0, 500.0);
        let r = ws.window(id).unwrap().rect;
        assert!(r.x >= 0.0 && r.x + r.w <= 700.0 + 1e-3 && r.y + r.h <= 500.0 + 1e-3);
        // A saved rectangle from a larger area (the review run's ui.ron) is pulled inside.
        let mut saved = Workspace::new(PageRef::World).to_saved();
        saved.windows[0].rect = Some(WinRect {
            x: 512.0,
            y: 0.0,
            w: 768.0,
            h: 676.0,
        });
        let mut ws = Workspace::new(PageRef::World);
        ws.load(&saved);
        assert_eq!(
            ws.windows()[0].rect.x,
            512.0,
            "untouched before the area is known"
        );
        ws.set_area(996.0, 676.0);
        let r = ws.windows()[0].rect;
        assert_eq!((r.x, r.w), (996.0 - 768.0, 768.0));
    }

    /// An M9 layout's window fills the real area once measured and follows it, growing and
    /// shrinking, until the player moves or resizes it.
    #[test]
    fn a_migrated_window_follows_the_area() {
        let old: SavedLayout = ron::from_str("(root: Pane(page: \"news\"), focused: 0)").unwrap();
        let mut ws = Workspace::new(PageRef::World);
        ws.load(&old);
        let id = ws.active_window();
        for (w, h) in [(996.0, 676.0), (1500.0, 900.0), (800.0, 600.0)] {
            ws.set_area(w, h);
            let r = ws.window(id).unwrap().rect;
            assert_eq!((r.x, r.y, r.w, r.h), (0.0, 0.0, w, h));
            assert_eq!(
                ws.to_saved().windows[0].rect,
                None,
                "saved as filling the area"
            );
        }
        ws.move_window(id, 0.0, 10.0);
        ws.resize_window(id, -200.0, -200.0);
        ws.set_area(1500.0, 900.0);
        let r = ws.window(id).unwrap().rect;
        assert_eq!((r.w, r.h), (600.0, 400.0), "placed by the player: it stays");
        assert!(ws.to_saved().windows[0].rect.is_some());
    }

    /// A window shrunk by a smaller area grows back to the rectangle the player chose when the
    /// area grows again (review of PR #35; D708).
    #[test]
    fn a_shrunk_window_grows_back_with_the_area() {
        let mut ws = Workspace::new(PageRef::World);
        ws.set_area(1280.0, 800.0);
        let id = ws.active_window();
        let want = WinRect {
            x: 300.0,
            y: 100.0,
            w: 800.0,
            h: 600.0,
        };
        assert!(ws.set_window_rect(id, want));
        ws.set_area(700.0, 500.0);
        let r = ws.window(id).unwrap().rect;
        assert!(r.w <= 700.0 && r.h <= 500.0 && r.x + r.w <= 700.0 + 1e-3);
        assert_eq!(
            ws.to_saved().windows[0].rect,
            Some(want),
            "saves the chosen one"
        );
        ws.set_area(1280.0, 800.0);
        assert_eq!(ws.window(id).unwrap().rect, want, "grown back");
        // A move while shrunk moves it but keeps the size it grows back to.
        ws.set_area(900.0, 800.0);
        assert!(ws.move_window(id, -50.0, 0.0));
        ws.set_area(1280.0, 800.0);
        let r = ws.window(id).unwrap().rect;
        assert_eq!((r.w, r.h), (want.w, want.h));
        assert_eq!(r.x, 900.0 - 800.0 - 50.0);
    }

    /// A drag that changes nothing (a filling window pushed against the area's edge) leaves an
    /// M9 window filling the area (review of PR #35; D708).
    #[test]
    fn a_drag_that_changes_nothing_keeps_a_window_filling() {
        let old: SavedLayout = ron::from_str("(root: Pane(page: \"news\"), focused: 0)").unwrap();
        let mut ws = Workspace::new(PageRef::World);
        ws.load(&old);
        ws.set_area(1000.0, 700.0);
        let id = ws.active_window();
        assert!(!ws.move_window(id, 0.0, 25.0));
        assert!(!ws.move_window(id, -40.0, 0.0));
        assert!(!ws.resize_window(id, 30.0, 30.0));
        assert_eq!(ws.window(id).unwrap().fit, Fit::Fill);
        ws.set_area(1400.0, 900.0);
        let r = ws.window(id).unwrap().rect;
        assert_eq!((r.w, r.h), (1400.0, 900.0), "still follows the area");
        assert_eq!(ws.to_saved().windows[0].rect, None);
        // A real move makes it the player's.
        assert!(ws.resize_window(id, -100.0, 0.0));
        assert_eq!(ws.window(id).unwrap().fit, Fit::Fixed);
    }

    /// A resize keeps the preferred size of the dimension it did not change (review of PR #37).
    #[test]
    fn a_resize_changes_only_the_dimension_it_moves() {
        let mut ws = Workspace::new(PageRef::World);
        ws.set_area(1280.0, 800.0);
        let id = ws.active_window();
        let want = WinRect {
            x: 100.0,
            y: 50.0,
            w: 800.0,
            h: 700.0,
        };
        assert!(ws.set_window_rect(id, want));
        // A short area clamps the height; a width-only resize then keeps the preferred height.
        ws.set_area(1280.0, 500.0);
        assert!(ws.resize_window(id, -100.0, 0.0));
        ws.set_area(1280.0, 800.0);
        let r = ws.window(id).unwrap().rect;
        assert_eq!((r.w, r.h), (700.0, 700.0), "the height grows back");
    }
}
