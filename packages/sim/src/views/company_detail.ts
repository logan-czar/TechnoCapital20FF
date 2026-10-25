// v_company_detail: `get_company` and `get_company_board` (spec 9.2), the Company screen's header,
// its Overview tab (management score, confidence factor, cash, line, rating, status, archetype; M5
// adds value and price, M6 the next release's projection) and its Board tab (seat cards for labor
// units 1 to 5 with the skill used, spec 8). Rebuilt monthly and on load (spec 9.4), and when
// Omniscient is toggled (D423). Removed companies stay in the list (ids are row indices) with
// status Removed; screens drop them (spec 5.12 step 3). A private company's or new listing's cash,
// line and value are estimate bands (D420). Ported from crates/sim/src/views/company_detail.rs;
// the types are in types/views/company_detail.ts.

import { companyFinanceStatus } from "../finance/state.ts";
import { confidenceFactor, EMPTY_SEAT_SKILL, memberSkill } from "../people/management.ts";
import type { CharacterId, CompanyId } from "../types/ids.ts";
import { SEAT_LABOR } from "../types/state/people.ts";
import type {
  CompanyDetail,
  CompanyDetailView,
  SeatCard,
  SeatPerson,
} from "../types/views/company_detail.ts";
import type { Director, SeatHolder, SimpleSeat, World } from "../types/world.ts";
import { valueShown } from "./company_rows.ts";
import {
  estimatorBanded,
  estimatorCompanyNow,
  figureExactOf,
  figureOver,
  viewInputEstimator,
} from "./estimate.ts";
import type { ViewInput } from "./index.ts";

/** `get_company(id)` and `get_company_board(id)`. */
export function companyDetailViewGet(v: CompanyDetailView, id: CompanyId): CompanyDetail | undefined {
  return v.companies[id];
}

function simplePerson(s: SimpleSeat): SeatPerson {
  return {
    name: s.character.name,
    age: s.character.age,
    skills: { ...s.character.skills },
    traits: s.character.traits.slice(),
    partial: true,
    character: null,
    partial_id: s.id,
  };
}

function fullPerson(w: World, id: CharacterId): SeatPerson {
  const ch = w.characters[id]!;
  return {
    name: ch.name,
    age: ch.age,
    skills: { ...ch.skills },
    traits: ch.traits.slice(),
    partial: false,
    character: id,
    partial_id: null,
  };
}

function person(w: World, holder: SeatHolder): SeatPerson {
  return holder.kind === "Simple" ? simplePerson(holder.seat) : fullPerson(w, holder.character);
}

/** A director as a seat person (5.19.4 step 4). */
function director(w: World, d: Director): SeatPerson {
  return d.kind === "Simple" ? simplePerson(d.seat) : fullPerson(w, d.character);
}

/** Rust `ViewData::build`. */
export function buildCompanyDetail(input: ViewInput): CompanyDetailView {
  const w = input.world;
  const est = viewInputEstimator(input);
  const companies = w.companies.map((c, i): CompanyDetail => {
    const id = i as CompanyId;
    const board: SeatCard[] = SEAT_LABOR.map((seat, k): SeatCard => {
      const h = c.board[k] ?? null;
      const holder = h === null ? null : person(w, h);
      const skill_used =
        holder === null
          ? EMPTY_SEAT_SKILL
          : memberSkill({ skills: holder.skills, traits: holder.traits }, seat);
      return { seat, open: k < c.labor_units, skill_used, holder };
    });
    board.push({ seat: "Chair", open: false, skill_used: EMPTY_SEAT_SKILL, holder: null });
    const s = w.market.stocks[id]!;
    const banded = estimatorBanded(est, w, id);
    // A private company's value a share is its total band over the shares (D430).
    const shown =
      s.exchange !== null
        ? figureExactOf(s.value * (1.0 + s.efv_error))
        : figureOver(valueShown(est, w, id, banded), Math.max(c.shares_out, 1));
    return {
      id,
      key: c.key,
      name: c.name,
      ticker: c.ticker,
      public: c.public,
      industry: c.industry,
      hq_country: c.hq_country,
      hq_province: c.hq_province,
      controller: c.controller,
      controller_name: c.controller === null ? null : w.characters[c.controller]!.name,
      management_score: c.management_score,
      confidence_factor: confidenceFactor(c.management_score),
      cash_usd: estimatorCompanyNow(est, banded, id, { kind: "Line", line: "Cash" }, c.cash_usd),
      line_drawn_usd: estimatorCompanyNow(
        est,
        banded,
        id,
        { kind: "Line", line: "BalanceLineDrawn" },
        c.finance.line.drawn,
      ),
      line_limit_usd: estimatorCompanyNow(est, banded, id, { kind: "LineLimit" }, c.finance.line.limit),
      rating: c.finance.rating,
      status: companyFinanceStatus(c.finance),
      archetype: c.archetype,
      origin: { ...c.origin },
      founders: c.founders.slice(),
      directors: c.directors.map((d) => director(w, d)),
      ipo_last_vote: c.ipo_last_vote === null ? null : { ...c.ipo_last_vote },
      ipo_next_vote: c.ipo_next_vote,
      shares_out: c.shares_out,
      exchange: s.exchange,
      quoted: s.quoted,
      price: s.price,
      shown_value_per_share: shown,
      estimated: banded,
      buzz: s.buzz,
      board,
    };
  });
  return { companies };
}
