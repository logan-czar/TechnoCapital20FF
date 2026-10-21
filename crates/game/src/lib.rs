//! The TechnoCapital20FF desktop app (build-plan 2.1 `game`): the sim bridge, the UI shell, the
//! tiling page workspace and its widgets. `main.rs` builds the app; tests build it headless.

pub mod bench;
pub mod bridge;
pub mod chart;
pub mod command;
pub mod config;
pub mod links;
pub mod page_bench;
pub mod pages;
pub mod table;
#[doc(hidden)]
pub mod test_support;
pub mod ui;
pub mod workspace;
