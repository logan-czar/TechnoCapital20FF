// People (build-plan M3.2, M3.3, M6.8): simple (partial) characters generated for board seats,
// full characters made in play, and the management score and confidence factor. Ported from
// crates/sim/src/people/mod.rs.
//
// Spec sections: 3.7, 3.7.1, 3.7.2, 5.7; simple characters are generated at load (7.1) and in
// 4.3 step 11 (`seating`).
//
// The people job (`people.new_seats`, 4.3 step 11) is `seating.newSeatsJob`, registered in jobs.ts.

export * as board from "./board.ts";
export * as full from "./full.ts";
export * as management from "./management.ts";
export * as names from "./names.ts";
export * as seating from "./seating.ts";
export * as simple from "./simple.ts";
export * as traits from "./traits.ts";
