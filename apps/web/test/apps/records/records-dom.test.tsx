// @vitest-environment happy-dom
// The Records app on the mock sim (React Testing Library): every route renders at the start of the
// mock game; stepping the clock to scripted events shows them; links open the right app; hidden
// fields stay hidden until Omniscient is on; the app works in a small window.

import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { dayKey, STAGE_LABEL } from "../../../src/apps/records/data.ts";
import { setAppOpener } from "../../../src/links/nav.ts";
import { SCRIPT } from "../../../src/sim/mock/fixtures/script.ts";
import { mountRecords } from "./harness.tsx";

afterEach(() => {
  cleanup();
  setAppOpener(null);
});

const text = (id: string) => screen.getByTestId(id).textContent ?? "";

describe("every route renders against the mock at its start", () => {
  it("home, the lists, and the pages of one thing each", async () => {
    const m = await mountRecords(null);
    const v = m.sim.views;
    const filing = v.records.data.filings[0];
    const plan = v.districts.data.plans[0];
    if (filing === undefined || plan === undefined) throw new Error("the mock has no filing or plan");
    const routes: [string, string][] = [
      ["bills", "page-bills"],
      ["bill/1", "page-bill"],
      ["rollcall/0", "page-rollcall"],
      ["exec", "page-exec"],
      ["finance", "page-finance"],
      [`finance/race/${filing.race}`, "page-financerace"],
      [`finance/person/${filing.person}`, "page-financeperson"],
      ["results", "page-results"],
      ["officials/house", "page-officials"],
      ["officials/senate", "page-officials"],
      ["districts", "page-districts"],
      [`districts/${plan.state}`, "page-districts"],
    ];
    expect(await screen.findByTestId("page-home")).toBeTruthy();
    expect(screen.getByTestId("app-root-records")).toBeTruthy();
    m.unmount();
    for (const [route, page] of routes) {
      const r = await mountRecords(route);
      expect(await screen.findByTestId(page), route).toBeTruthy();
      expect(screen.queryByTestId("rec-missing"), route).toBeNull();
      r.unmount();
    }
  });

  it("says plainly when the record holds nothing for a route", async () => {
    const m = await mountRecords("bill/999");
    expect(await screen.findByTestId("rec-missing")).toBeTruthy();
    expect(screen.getByTestId("rec-missing").textContent).toContain("Bill 1000");
    m.unmount();
    const u = await mountRecords("not/a/page");
    expect((await screen.findByTestId("rec-missing")).textContent).toContain("not/a/page");
    u.unmount();
    // No election has been counted yet, so there is no race count to publish.
    const r = await mountRecords("results/race/0");
    expect(await screen.findByTestId("rec-missing")).toBeTruthy();
    r.unmount();
  });

  it("names the window after the page", async () => {
    const m = await mountRecords("bill/1");
    await screen.findByTestId("page-bill");
    const title = m.sim.views.records.data.bills[1]?.title ?? "";
    await waitFor(() => expect(m.titles.at(-1)).toContain(title));
    expect(m.titles.at(-1)).toMatch(/ - Records$/);
  });
});

describe("the bills index", () => {
  it("lists every bill and filters by status, chamber, subject and search", async () => {
    const m = await mountRecords("bills");
    const bills = m.sim.views.records.data.bills;
    await screen.findByTestId("page-bills");
    for (const b of bills) expect(screen.getByTestId(`bill-row-${b.id}`)).toBeTruthy();
    expect(text("bills-count")).toBe(`${bills.length} bills`);

    const law = bills.filter((b) => b.stage === "Law");
    fireEvent.change(screen.getByTestId("bills-stage"), { target: { value: "Law" } });
    for (const b of bills) {
      expect(screen.queryByTestId(`bill-row-${b.id}`) !== null, b.title).toBe(b.stage === "Law");
    }
    expect(text("bills-count")).toBe(`${law.length} of ${bills.length} bills`);
    // The filter is the route, so back/forward and a saved desktop keep it.
    expect(m.routes.at(-1)).toBe("bills?stage=Law");

    fireEvent.click(screen.getByTestId("bills-clear"));
    expect(screen.getByTestId("bills-count").textContent).toBe(`${bills.length} bills`);

    const target = bills[2];
    if (target === undefined) throw new Error("no bill");
    fireEvent.change(screen.getByTestId("bills-search"), { target: { value: target.title.toLowerCase() } });
    expect(screen.getByTestId(`bill-row-${target.id}`)).toBeTruthy();
    expect(screen.queryAllByTestId(/^bill-row-/)).toHaveLength(1);

    fireEvent.change(screen.getByTestId("bills-search"), { target: { value: "no such bill anywhere" } });
    expect(screen.getByTestId("rec-empty").textContent).toContain("No bill matches");
  });

  it("opens a bill, and back returns to the index", async () => {
    const m = await mountRecords("bills");
    const first = m.sim.views.records.data.bills[0];
    if (first === undefined) throw new Error("no bill");
    fireEvent.click(await screen.findByTestId(`nav-bill-${first.id}`));
    expect(await screen.findByTestId("page-bill")).toBeTruthy();
    expect(m.routes.at(-1)).toBe(`bill/${first.id}`);
    fireEvent.click(screen.getByTestId("records-back"));
    expect(await screen.findByTestId("page-bills")).toBeTruthy();
    expect(m.routes.at(-1)).toBe("bills");
    fireEvent.click(screen.getByTestId("records-forward"));
    expect(await screen.findByTestId("page-bill")).toBeTruthy();
  });
});

describe("a bill's page", () => {
  it("shows the summary, the changes in words, the history and each roll call by party", async () => {
    const m = await mountRecords("bill/1");
    const b = m.sim.views.records.data.bills[1];
    if (b === undefined) throw new Error("no bill");
    await screen.findByTestId("page-bill");
    expect(screen.getByText(b.summary)).toBeTruthy();
    // The infrastructure bill's one change is a fiscal push, in words rather than a lever name.
    expect(text("bill-changes")).toContain("federal spending stimulus");
    expect(text("bill-changes")).not.toContain("fiscal");
    expect(screen.getByTestId("bill-actions").querySelectorAll("li")).toHaveLength(b.actions.length);
    expect(text("bill-actions")).toContain("Introduced");
    expect(b.stage).toBe("SenateFloor");
    expect(screen.getByTestId("bill-path").querySelector('[aria-current="step"]')?.textContent).toBe(
      STAGE_LABEL[b.stage],
    );
    // Its sponsor is a link to the person.
    expect(within(screen.getByTestId("page-bill")).getByTestId(`link-person-${b.sponsor}`)).toBeTruthy();
  });

  it("after the Senate vote and the signature the page shows the law and its roll calls with party totals", async () => {
    const m = await mountRecords("bill/1");
    await screen.findByTestId("page-bill");
    expect(screen.getByTestId("bill-rollcalls").textContent).toBeTruthy();
    m.advanceTo(SCRIPT.bill_signed + 1);
    const records = m.sim.views.records.data;
    const bill = records.bills[1];
    const calls = records.roll_calls.filter((r) => r.bill === 1);
    expect(bill?.stage).toBe("Law");
    await waitFor(() =>
      expect(screen.getByTestId("bill-path").querySelector('[aria-current="step"]')?.textContent).toBe("Law"),
    );
    for (const rc of calls) {
      const card = screen.getByTestId(`rollcall-card-${rc.id}`);
      expect(card.textContent).toContain(`${rc.yeas} yeas, ${rc.nays} nays`);
      const table = await within(card).findByTestId(`rollcall-parties-${rc.id}`);
      // The party rows add up to the members who voted yea.
      const yeas = [...table.querySelectorAll("tbody tr")].reduce(
        (s, tr) => s + Number(tr.querySelectorAll("td")[0]?.textContent),
        0,
      );
      expect(yeas).toBe(rc.yeas);
    }
    expect(text("page-bill")).toContain("Changes made by this law");
  });
});

describe("a roll call's page", () => {
  it("lists every member's vote through the slice, sortable, with the party breakdown and the threshold", async () => {
    const m = await mountRecords("rollcall/0");
    const rc = m.sim.views.records.data.roll_calls[0];
    const votes = m.host.slice({ view: "records", slice: "votes", roll_call: 0 });
    if (rc === undefined || votes === null) throw new Error("no roll call");
    await screen.findByTestId("page-rollcall");
    await screen.findByTestId("table-votes");
    expect(screen.getAllByTestId(/^vote-row-/)).toHaveLength(votes.votes.length);
    expect(text("rollcall-shown")).toBe(`${votes.votes.length} of ${votes.votes.length}`);
    expect(text("page-rollcall")).toContain(rc.passed ? "Passed" : "Failed");
    expect(text("rollcall-threshold")).toContain(`${rc.yeas} yeas`);
    expect(screen.getByTestId("rollcall-parties-0")).toBeTruthy();

    // Sorting by party puts one party's members first, then the other's; again reverses.
    const party = () =>
      screen.getAllByTestId(/^vote-row-/).map((r) => r.querySelectorAll("td")[1]?.textContent);
    fireEvent.click(screen.getByTestId("sort-votes-party"));
    const asc = party();
    expect(asc).toEqual([...asc].sort());
    fireEvent.click(screen.getByTestId("sort-votes-party"));
    expect(party()).toEqual([...asc].reverse());
    fireEvent.click(screen.getByTestId("sort-votes-state"));
    const states = screen
      .getAllByTestId(/^vote-row-/)
      .map((r) => r.querySelectorAll("td")[2]?.textContent ?? "");
    expect(states).toEqual([...states].sort());

    // Filter to the members who voted nay.
    fireEvent.change(screen.getByTestId("rollcall-only"), { target: { value: "Nay" } });
    expect(screen.getAllByTestId(/^vote-row-/)).toHaveLength(
      votes.votes.filter((v) => v.vote === "Nay").length,
    );
  });

  it("a cloture vote says it needs sixty", async () => {
    const m = await mountRecords("rollcall/0");
    const cloture = m.sim.views.records.data.roll_calls.find((r) =>
      r.question.toLowerCase().includes("cloture"),
    );
    if (cloture === undefined) throw new Error("the mock holds a failed cloture vote by 30 September");
    m.unmount();
    const c = await mountRecords(`rollcall/${cloture.id}`);
    await screen.findByTestId("page-rollcall");
    expect(text("page-rollcall")).toContain("60 yeas");
    expect(text("rollcall-threshold")).toContain("failed");
    c.unmount();
  });

  it("links the bill it was held on", async () => {
    const m = await mountRecords("rollcall/0");
    const rc = m.sim.views.records.data.roll_calls[0];
    await screen.findByTestId("page-rollcall");
    fireEvent.click(screen.getByTestId(`nav-bill-${rc?.bill}`));
    expect(await screen.findByTestId("page-bill")).toBeTruthy();
  });
});

describe("executive actions", () => {
  it("lists them newest first and filters by kind; a new action appears when it is taken", async () => {
    const m = await mountRecords("exec");
    const before = m.sim.views.records.data.actions;
    await screen.findByTestId("page-exec");
    expect(screen.getAllByTestId(/^exec-row-/)).toHaveLength(before.length);
    const newest = [...before].sort((a, b) => dayKey(b.date) - dayKey(a.date) || b.id - a.id)[0];
    expect(screen.getAllByTestId(/^exec-row-/)[0]?.getAttribute("data-testid")).toBe(
      `exec-row-${newest?.id}`,
    );
    fireEvent.change(screen.getByTestId("exec-kind"), { target: { value: "Order" } });
    expect(m.routes.at(-1)).toBe("exec?kind=Order");
    expect(screen.getAllByTestId(/^exec-row-/)).toHaveLength(before.filter((a) => a.kind === "Order").length);
    // The order's lever change is in words.
    expect(text("page-exec")).toContain("regulating");

    fireEvent.change(screen.getByTestId("exec-kind"), { target: { value: "" } });
    m.advanceTo(SCRIPT.nomination + 1);
    const after = m.sim.views.records.data.actions;
    expect(after.length).toBeGreaterThan(before.length);
    await waitFor(() => expect(screen.getAllByTestId(/^exec-row-/)).toHaveLength(after.length));
  });
});

describe("campaign finance", () => {
  it("shows a race's campaigns and filings, and a person's, linked to people and the race", async () => {
    const m = await mountRecords("finance");
    const { filings } = m.sim.views.records.data;
    const f = filings[0];
    if (f === undefined) throw new Error("no filing");
    await screen.findByTestId("page-finance");
    fireEvent.click(await screen.findByTestId(`nav-finance-race-${f.race}`));
    await screen.findByTestId("page-financerace");
    const inRace = filings.filter((x) => x.race === f.race);
    const people = new Set(inRace.map((x) => x.person));
    expect(screen.getAllByTestId(/^candidate-row-/)).toHaveLength(people.size);
    expect(screen.getAllByTestId(/^filing-row-/)).toHaveLength(inRace.length);
    // Cash on hand is the latest report's, receipts the sum.
    const mine = inRace.filter((x) => x.person === f.person);
    const row = screen.getByTestId(`candidate-row-${f.person}`);
    const raised = mine.reduce((s, x) => s + x.raised, 0);
    expect(row.textContent).toContain(`$${Math.round(raised).toLocaleString("en-US")}`);
    expect(within(screen.getByTestId("page-financerace")).getByTestId(`link-race-${f.race}`)).toBeTruthy();

    fireEvent.click(within(row).getByTestId(`nav-finance-person-${f.person}`));
    await screen.findByTestId("page-financeperson");
    expect(screen.getAllByTestId(/^filing-row-/)).toHaveLength(mine.length);
  });

  it("a new filing appears when it is published", async () => {
    const m = await mountRecords("finance");
    const n = m.sim.views.records.data.filings.length;
    await screen.findByTestId("page-finance");
    m.advanceTo(SCRIPT.filing_pre_general + 1);
    expect(m.sim.views.records.data.filings.length).toBeGreaterThan(n);
    const f = m.sim.views.records.data.filings.at(-1);
    if (f === undefined) throw new Error("no filing");
    await waitFor(() => expect(screen.getByTestId(`financerace-row-${f.race}`)).toBeTruthy());
  });
});

describe("election results", () => {
  it("before the election there is nothing to publish", async () => {
    const m = await mountRecords("results");
    expect((await screen.findByTestId("page-results")).textContent).toContain(
      "No general election has been held yet",
    );
    m.unmount();
  });

  it("an uncounted-so-far race is unofficial; after certification it is official, with its winner", async () => {
    const m = await mountRecords("results/race/0", { start: SCRIPT.election_day + 30 });
    await screen.findByTestId("page-resultsrace");
    const ret = () => m.sim.views.returns.data.races.find((r) => r.race === 0);
    expect(ret()?.certified).toBeNull();
    expect(text("count-banner")).toContain("Unofficial");
    // No state has certified, so no electoral vote is official, whatever the outlets have called.
    await waitFor(() => expect(screen.getAllByTestId(/^state-row-/).length).toBeGreaterThan(0));
    for (const el of screen.queryAllByTestId(/^state-row-/)) expect(el.textContent).toContain("Unofficial");

    m.advanceTo(SCRIPT.certification + 1);
    expect(ret()?.certified).not.toBeNull();
    await waitFor(() => expect(text("count-banner")).toContain("Official result, certified"));
    expect(screen.getByTestId("page-resultsrace").textContent).toContain("Winner");
  });

  it("the cycle page lists races with certified winners only after certification", async () => {
    const m = await mountRecords("results/2020", { start: SCRIPT.certification + 2 });
    await screen.findByTestId("page-results");
    const returns = m.sim.views.returns.data;
    expect(await screen.findAllByTestId(/^race-row-/)).toHaveLength(returns.races.length);
    expect(text("page-results")).toContain("2020 general election");
    const done = returns.races.filter((r) => r.certified !== null).length;
    expect(text("page-results")).toContain(`${done} of ${returns.races.length}`);
    // The electoral votes shown are the certified states'.
    expect(screen.getByTestId("electoral-votes")).toBeTruthy();
    // A cycle the record does not hold says so.
    m.unmount();
    const other = await mountRecords("results/1996", { start: SCRIPT.certification + 2 });
    expect((await screen.findByTestId("rec-missing")).textContent).toContain("1996");
    other.unmount();
  });

  it("a race's county table comes through the slice", async () => {
    const m = await mountRecords("results/race/20", { start: SCRIPT.certification + 2 });
    await screen.findByTestId("page-resultsrace");
    const slice = m.host.slice({ view: "returns", slice: "counties", race: 20 as never });
    expect(slice?.counties.length).toBeGreaterThan(0);
    expect(await screen.findByTestId("county-table")).toBeTruthy();
  });
});

describe("officeholders", () => {
  it("lists the House and the Senate by state with the chamber's make-up", async () => {
    const m = await mountRecords("officials/house");
    await screen.findByTestId("page-officials");
    const chambers = m.sim.views.people.data.chambers;
    const house = chambers.find((c) => c.chamber === "House");
    if (house === undefined) throw new Error("no House make-up");
    await waitFor(() =>
      expect(screen.getAllByTestId(/^member-row-/)).toHaveLength(
        house.parties.reduce((s, p) => s + p.seats, 0) + house.independents,
      ),
    );
    expect(screen.getByTestId("makeup-house").textContent).toContain(String(house.vacant));
    expect(screen.getByTestId("majority-house").textContent).toContain(
      house.majority === null ? "No party" : house.majority,
    );

    fireEvent.click(screen.getByTestId("nav-officials-senate"));
    await waitFor(() => expect(screen.getByTestId("makeup-senate")).toBeTruthy());
    const senate = chambers.find((c) => c.chamber === "Senate");
    expect(screen.getAllByTestId(/^member-row-/)).toHaveLength(
      (senate?.parties.reduce((s, p) => s + p.seats, 0) ?? 0) + (senate?.independents ?? 0),
    );

    // Narrow to one state.
    const state = screen.getAllByTestId(/^member-row-/)[0]?.querySelectorAll("td")[0]?.textContent;
    fireEvent.change(screen.getByTestId("officials-state"), {
      target: {
        value: [...screen.getByTestId("officials-state").querySelectorAll("option")].find(
          (o) => o.textContent === state,
        )?.value,
      },
    });
    expect(screen.getAllByTestId(/^member-row-/).length).toBeLessThan(5);
  });
});

describe("district plans", () => {
  it("lists the states, and a state's districts with their counties and who drew the plan", async () => {
    const m = await mountRecords("districts");
    const view = m.sim.views.districts.data;
    await screen.findByTestId("page-districts");
    expect(screen.getAllByTestId(/^plan-row-/).length).toBeGreaterThanOrEqual(view.plans.length);
    const plan = view.plans.find((p) => view.districts.filter((d) => d.state === p.state).length > 1);
    if (plan === undefined) throw new Error("no multi-seat state");
    fireEvent.click(screen.getByTestId(`nav-districts-${plan.state}`));
    const rows = view.districts.filter((d) => d.state === plan.state);
    await waitFor(() => expect(screen.getAllByTestId(/^district-row-/)).toHaveLength(rows.length));
    expect(text("page-districts")).toContain(String(plan.census_year));
    expect(text("page-districts")).toContain(
      plan.drawn_by === null ? "No party" : plan.drawn_by === "Democrats" ? "Democratic" : "Republican",
    );
    const first = rows[0];
    if (first === undefined) throw new Error("no district");
    expect(screen.getByTestId(`district-counties-${first.id}`).querySelectorAll("li")).toHaveLength(
      first.shares.length,
    );
    expect(
      within(screen.getByTestId(`district-row-${first.id}`)).getByTestId(`link-district-${first.id}`),
    ).toBeTruthy();
  });

  it("shows the plan's strength and districts' lean only when Omniscient is on", async () => {
    const m = await mountRecords("districts");
    const plan = m.sim.views.districts.data.plans.find((p) => p.drawn_by !== null);
    if (plan === undefined) throw new Error("no drawn plan");
    fireEvent.click(await screen.findByTestId(`nav-districts-${plan.state}`));
    await screen.findByTestId("table-districts");
    expect(text("page-districts")).not.toContain("Gerrymander strength");
    expect(screen.queryByText("Lean")).toBeNull();
    m.omniscient(true);
    await waitFor(() => expect(text("page-districts")).toContain("Gerrymander strength"));
    expect(screen.getByText("Lean")).toBeTruthy();
    m.omniscient(false);
    await waitFor(() => expect(text("page-districts")).not.toContain("Gerrymander strength"));
  });
});

describe("links", () => {
  it("a person opens the browser's person page; a race opens the polls", async () => {
    const opened: [string, string | null][] = [];
    setAppOpener((id, route) => opened.push([id, route]));
    const m = await mountRecords("finance");
    const f = m.sim.views.records.data.filings[0];
    if (f === undefined) throw new Error("no filing");
    fireEvent.click(await screen.findByTestId(`link-race-${f.race}`));
    fireEvent.click(await screen.findByTestId(`nav-finance-race-${f.race}`));
    await screen.findByTestId("page-financerace");
    fireEvent.click(screen.getAllByTestId(`link-person-${f.person}`)[0] as HTMLElement);
    expect(opened).toEqual([
      ["polls", `race/${f.race}`],
      ["browser", `person/${f.person}`],
    ]);
  });
});

describe("a small window", () => {
  it("keeps the sections and the page reachable at 480 by 360", async () => {
    const m = await mountRecords("bill/1", { width: 480, height: 360 });
    await screen.findByTestId("page-bill");
    for (const tab of ["home", "bills", "exec", "finance", "results", "officials", "districts"]) {
      expect(screen.getByTestId(`tab-${tab}`), tab).toBeTruthy();
    }
    // The page scrolls inside the window rather than growing it.
    expect(screen.getByTestId("app-root-records").querySelector(".rec-main")).toBeTruthy();
    fireEvent.click(screen.getByTestId("tab-bills"));
    expect(await screen.findByTestId("page-bills")).toBeTruthy();
    expect(m.routes.at(-1)).toBe("bills");
  });
});

describe("a route from outside", () => {
  it("is shown when the window manager changes it, and back returns to the page before", async () => {
    const m = await mountRecords("bills");
    await screen.findByTestId("page-bills");
    m.setRoute("bill/2");
    expect(await screen.findByTestId("page-bill")).toBeTruthy();
    // It came from outside, so the app did not report it back.
    expect(m.routes).toEqual([]);
    fireEvent.click(screen.getByTestId("records-back"));
    expect(await screen.findByTestId("page-bills")).toBeTruthy();
    expect(m.routes).toEqual(["bills"]);
  });
});
