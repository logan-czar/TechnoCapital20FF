// Party colours and labels (pivot 5.12; D1037). The colours are CSS variables in ./shared.css
// (`--party-a`, `--party-b`, `--party-none`), so a theme can change them in one place; a component
// sets the class `partyClass(party)` and reads `var(--party)` inside it.

import { PARTY_VALUES, type Party } from "@tc20ff/sim";

/** The class carrying a party's colour as `--party`: "party-a", "party-b", or "party-none" for an independent. */
export function partyClass(party: Party | null): string {
  if (party === null) return "party-none";
  return party === PARTY_VALUES[0] ? "party-a" : "party-b";
}

/** One letter for a party, as the press writes it after a name: D, R, or I for an independent. */
export function partyLetter(party: Party | null): string {
  if (party === null) return "I";
  return party === "Democrats" ? "D" : "R";
}

/** The party's name in the singular, as an adjective: "Democratic", "Republican", "Independent". */
export function partyAdjective(party: Party | null): string {
  if (party === null) return "Independent";
  return party === "Democrats" ? "Democratic" : "Republican";
}
