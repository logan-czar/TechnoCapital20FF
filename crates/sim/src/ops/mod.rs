//! Operations (build-plan M3): labor units, board seats opening and closing, stations, productive
//! compute and the PC bonus, compute and licence costs, data (create, convert, decay, retention,
//! free R&D) and productivity.
//!
//! Spec sections: 3.6, 3.7, 3.8, 5.6, 5.8, 5.9, 5.10 (labor units and seats), 7.1; scheduled in
//! 4.3 steps 4 (labor and seats), 5 (compute), 8 (data) and 10 (productivity).

pub mod compute;
pub mod data;
pub mod labor;
pub mod productivity;
pub mod stations;
