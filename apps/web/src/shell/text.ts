// Player-facing text for notices and alerts (spec 8 time controls row; ui/alerts.rs).

import {
  type AlertKind,
  type AlertLevel,
  type AlertPayload,
  formatQuarter,
  type Notice,
  type SkipKind,
} from "@tc20ff/sim";

export const ALERT_LABEL: Readonly<Record<AlertKind, string>> = {
  EarningsDay: "Earnings day",
  QuarterlyRecap: "Quarterly recap",
  PlanLock: "Plan lock",
  BankruptcyInWatchlist: "Bankruptcy in watchlist",
  WorldEvent: "World event",
  QuarterStart: "Quarter start",
};

export const LEVEL_LABEL: Readonly<Record<AlertLevel, string>> = {
  Pause: "Pause",
  Notify: "Notify",
  Log: "Log only",
  Off: "Off",
};

/** The Skip menu entries (spec 8, 9.1). */
export const SKIPS: readonly (readonly [SkipKind, string])[] = [
  ["NextRelease", "Next release"],
  ["NextLock", "Next plan lock"],
  ["NextRecap", "Next recap"],
  ["MonthEnd", "Month end"],
];

export function skipName(kind: SkipKind): string {
  return SKIPS.find(([k]) => k === kind)?.[1] ?? kind;
}

function payloadText(p: AlertPayload, companyName: (id: number) => string): string {
  switch (p.kind) {
    case "None":
      return "";
    case "Quarter":
      return ` (${formatQuarter(p.quarter)})`;
    case "Company":
      return ` (${companyName(p.company)})`;
  }
}

/** One line for a notice; the `severity` says whether the list highlights it. */
export function describeNotice(
  n: Notice,
  companyName: (id: number) => string,
): { text: string; severity: "info" | "alert" } {
  switch (n.kind) {
    case "Alert":
      return {
        text: `${ALERT_LABEL[n.alert_kind]}${payloadText(n.payload, companyName)}`,
        severity: n.level === "Pause" || n.level === "Notify" ? "alert" : "info",
      };
    case "Paused": {
      const r = n.reason;
      const why =
        r.kind === "Player"
          ? "by you"
          : r.kind === "Alert"
            ? `by ${ALERT_LABEL[r.alert_kind]}`
            : r.kind === "SkipDone"
              ? `skip done (${skipName(r.skip)})`
              : "save loaded";
      return { text: `Paused ${why}`, severity: "info" };
    }
    case "EarningsReleased":
      return { text: `${formatQuarter(n.quarter)} statements published`, severity: "info" };
    case "PlanLocked":
      return { text: `Plans locked for ${formatQuarter(n.quarter)}`, severity: "info" };
    case "CompanyBorn":
      return { text: `${companyName(n.company)} was founded`, severity: "info" };
    case "CompanyListed":
      return { text: `${companyName(n.company)} listed`, severity: "info" };
    case "IpoVote":
      return {
        text: `${companyName(n.company)} IPO vote ${n.passed ? "passed" : "failed"}`,
        severity: "info",
      };
    case "StartupEvent":
      return { text: "Startup event", severity: "info" };
    case "TickDone":
    case "DayDone":
    case "MonthDone":
      return { text: "", severity: "info" };
  }
}
