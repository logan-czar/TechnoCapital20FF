// The Records app's route grammar (pivot 8.6, 15.3): the whole state that matters of the app is its
// route string, so links, back and forward and a saved desktop all work. A pure codec.
//
//   (home)                      the front page
//   bills[?stage=&chamber=&subject=&q=]
//   bill/<id>                   what Bill entity links open (apps/_shared ENTITY_APP)
//   rollcall/<id>
//   exec[?kind=]
//   finance                     every race with filings
//   finance/race/<id>           one race's campaigns
//   finance/person/<id>         one candidate's filings
//   results[/<cycle>]
//   results/race/<id>
//   officials[/<house|senate>]
//   districts[/<state>]

import type { BillStage, Chamber, ExecActionRow } from "@tc20ff/sim";

export const BILL_STAGES: readonly BillStage[] = [
  "Drafted",
  "Committee",
  "HouseFloor",
  "SenateFloor",
  "Conference",
  "President",
  "Law",
  "Dead",
];

export const EXEC_KINDS: readonly ExecActionRow["kind"][] = [
  "Nomination",
  "Confirmation",
  "Order",
  "Veto",
  "Shutdown",
  "Impeachment",
  "Resignation",
];

/** The bills index's filters; an empty string is "any". */
export interface BillFilter {
  stage: BillStage | null;
  chamber: Chamber | null;
  subject: string;
  q: string;
}

export const NO_FILTER: BillFilter = { stage: null, chamber: null, subject: "", q: "" };

export type RecordsRoute =
  | { page: "home" }
  | { page: "bills"; filter: BillFilter }
  | { page: "bill"; id: number }
  | { page: "rollcall"; id: number }
  | { page: "exec"; kind: ExecActionRow["kind"] | null }
  | { page: "finance" }
  | { page: "financeRace"; id: number }
  | { page: "financePerson"; id: number }
  | { page: "results"; cycle: number | null }
  | { page: "resultsRace"; id: number }
  | { page: "officials"; chamber: Chamber }
  | { page: "districts"; state: number | null }
  /** A route this app does not know; kept so the page can say what it was asked for. */
  | { page: "unknown"; route: string };

const HOME: RecordsRoute = { page: "home" };

const WHOLE = /^\d+$/;

function id(s: string | undefined): number | null {
  return s !== undefined && WHOLE.test(s) ? Number(s) : null;
}

/** Reads a route; null and "" are the home page, anything unreadable is `unknown`. */
export function parseRoute(route: string | null): RecordsRoute {
  if (route === null || route === "" || route === "home") return HOME;
  const [path = "", query = ""] = route.split("?", 2);
  const parts = path.split("/").filter((p) => p !== "");
  const params = new URLSearchParams(query);
  const unknown: RecordsRoute = { page: "unknown", route };
  const head = parts[0];
  const n = id(parts[1]);
  switch (head) {
    case "bills": {
      if (parts.length !== 1) return unknown;
      const stage = params.get("stage");
      const chamber = params.get("chamber");
      return {
        page: "bills",
        filter: {
          stage: BILL_STAGES.find((s) => s === stage) ?? null,
          chamber: chamber === "House" || chamber === "Senate" ? chamber : null,
          subject: params.get("subject") ?? "",
          q: params.get("q") ?? "",
        },
      };
    }
    case "bill":
      return parts.length === 2 && n !== null ? { page: "bill", id: n } : unknown;
    case "rollcall":
      return parts.length === 2 && n !== null ? { page: "rollcall", id: n } : unknown;
    case "exec": {
      if (parts.length !== 1) return unknown;
      const kind = params.get("kind");
      return { page: "exec", kind: EXEC_KINDS.find((k) => k === kind) ?? null };
    }
    case "finance": {
      if (parts.length === 1) return { page: "finance" };
      const m = id(parts[2]);
      if (parts.length !== 3 || m === null) return unknown;
      if (parts[1] === "race") return { page: "financeRace", id: m };
      if (parts[1] === "person") return { page: "financePerson", id: m };
      return unknown;
    }
    case "results": {
      if (parts.length === 1) return { page: "results", cycle: null };
      if (parts.length === 2 && n !== null) return { page: "results", cycle: n };
      const m = id(parts[2]);
      return parts.length === 3 && parts[1] === "race" && m !== null
        ? { page: "resultsRace", id: m }
        : unknown;
    }
    case "officials": {
      if (parts.length === 1) return { page: "officials", chamber: "House" };
      if (parts.length !== 2) return unknown;
      if (parts[1] === "house") return { page: "officials", chamber: "House" };
      if (parts[1] === "senate") return { page: "officials", chamber: "Senate" };
      return unknown;
    }
    case "districts": {
      if (parts.length === 1) return { page: "districts", state: null };
      return parts.length === 2 && n !== null ? { page: "districts", state: n } : unknown;
    }
    default:
      return unknown;
  }
}

/** Writes a route; the home page is null. `parseRoute(formatRoute(r))` gives `r` back. */
export function formatRoute(r: RecordsRoute): string | null {
  switch (r.page) {
    case "home":
      return null;
    case "bills": {
      const p = new URLSearchParams();
      if (r.filter.stage !== null) p.set("stage", r.filter.stage);
      if (r.filter.chamber !== null) p.set("chamber", r.filter.chamber);
      if (r.filter.subject !== "") p.set("subject", r.filter.subject);
      if (r.filter.q !== "") p.set("q", r.filter.q);
      const q = p.toString();
      return q === "" ? "bills" : `bills?${q}`;
    }
    case "bill":
      return `bill/${r.id}`;
    case "rollcall":
      return `rollcall/${r.id}`;
    case "exec":
      return r.kind === null ? "exec" : `exec?kind=${r.kind}`;
    case "finance":
      return "finance";
    case "financeRace":
      return `finance/race/${r.id}`;
    case "financePerson":
      return `finance/person/${r.id}`;
    case "results":
      return r.cycle === null ? "results" : `results/${r.cycle}`;
    case "resultsRace":
      return `results/race/${r.id}`;
    case "officials":
      return `officials/${r.chamber === "House" ? "house" : "senate"}`;
    case "districts":
      return r.state === null ? "districts" : `districts/${r.state}`;
    case "unknown":
      return r.route;
  }
}
