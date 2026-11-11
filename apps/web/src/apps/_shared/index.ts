// What the desktop's apps share (D1037): written by the M2 contracts change and frozen for the M2
// app lanes, which import from here and never edit it. A lane that needs something shared asks for
// it in its report; until then it keeps its own copy in its folder.

export { ComingSoon, EntityLink, ListTable, PersonChip } from "./components.tsx";
export { ENTITY_APP, entityTarget, openEntity, parseEntityRoute } from "./entity.ts";
export {
  formatCents,
  formatDay,
  formatHour,
  formatMargin,
  formatPct,
  formatUsd,
  formatWhen,
  MONTH_NAMES_SHORT,
} from "./format.ts";
export { partyAdjective, partyClass, partyLetter } from "./party.ts";
