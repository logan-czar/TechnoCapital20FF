// The tour suite (`pnpm e2e -- --tour`, tag @tour): the built app on the mock sim, every app of the
// desktop opened at every main route of its grammar, at three moments of the mock's calendar (the
// start, election night, after certification). It exists because development React and Vitest
// tolerate faults the production build does not (an effect that returns a non-function crashed one
// app only in the build). A route fails when
//
//   - the page throws (`pageerror`) or logs a console error while it is drawn,
//   - an app's error boundary shows its fault pane (`.os-window-fault`, os/Window.tsx),
//   - the app's root draws (almost) nothing, or
//   - the app answers with its own "no such page" screen for a route that should exist.
//
// How routes are opened: the shell has no hook that opens an app at a route (`openApp` is a module
// function of the page, `window.__tcSim` is the only hook), so the tour does what a player can do:
// it types `orr://<app>/<route>` into the address bar of a Browser window (browser/BrowserApp.tsx
// `submitAddress`, which calls `openApp`). A missing hook would be `window.__tcOpenApp(app, route)`
// behind `--test-hooks`; with it the Browser window and its bar would not be needed.
//
// Ids come from the mock's views through the page (`__tcSim.store`), never hard-coded. One app is
// launched for the whole file and moved forward in time between the phases; a test that fails
// restarts Playwright's worker, and the next test launches again and catches up (`session`).

import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { closeApp, type Launched, launchApp } from "../scripts/drive.ts";
import { expect, test, WINDOW } from "./fixtures.ts";
import { userDataRoot } from "./paths.ts";

const tour = { tag: "@tour" };

// biome-ignore lint/suspicious/noExplicitAny: the page's views are read untyped here; the tour only reads a few fields
type Loose = any;

/** The mock's first hour (00:00 on 20 Oct 2020), in hours since 2020-01-01. */
const START = 7032;
/** Election day, 00:00 on 3 Nov: two 168-hour steps on. */
const ELECTION_DAY = START + 336;
/** Election night, 02:00 on 4 Nov: polls have closed, counties report, outlets have called races. */
const NIGHT = ELECTION_DAY + 26;
/** 10:00 on 9 Nov: certification (09:00) has happened. */
const CERTIFIED = ELECTION_DAY + 6 * 24 + 10;
/** The most a Step may run (control.ts MAX_STEP_HOURS is larger; a week keeps each step short). */
const STEP_HOURS = 168;

/** The views the tour reads the ids from; the page itself only keeps the ones it draws. */
const VIEWS = [
  "feed",
  "social",
  "polls",
  "races",
  "records",
  "people",
  "districts",
  "usmap_layers",
  "company_rows",
  "industry_rows",
  "exchanges",
  "returns",
  "forecast",
] as const;

/** The route markers each app has for "I have no page for that" (grep the apps for them). */
const MISSING_TEST_IDS = ["news-notfound", "rec-missing", "route-unknown", "page-error", "races-none"];
const MISSING_TEXT =
  /No article yet|No race has this number|No such state on this map|Unknown county|has no such district|No such outlet|Article not found|\bnot found\b/i;

// ---------------------------------------------------------------- the session

interface Session {
  launched: Launched;
  page: Page;
  /** Page errors and console errors since the launch. */
  errors: string[];
  /** The mock's clock, in hours, as last advanced to. */
  hour: number;
  userDataDir: string;
  /** The test id of the Browser window the addresses are typed in; it is never closed. */
  typing: string;
}

let current: Session | null = null;

/** The one app of this worker, launched on first use with a Browser window for typing addresses. */
async function session(): Promise<Session> {
  if (current !== null) return current;
  const userDataDir = join(userDataRoot, `${process.pid}-tour`);
  rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  mkdirSync(userDataDir, { recursive: true });
  const launched = await launchApp({ userDataDir, flags: ["--mock"], size: WINDOW });
  const page = launched.page;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await expect(page.getByTestId("desktop")).toBeVisible();
  // Read the views the tour needs, and turn off the two fixed pauses that can be switched off, so a
  // Step runs its hours (the mock still pauses for the player's own fills and resolutions).
  await page.evaluate(
    (views) => {
      const sim = (globalThis as unknown as { __tcSim: Loose }).__tcSim;
      for (const v of views) sim.store.subscribe(v, () => {});
      void sim.control({ kind: "SetFixedPause", pause: "Holding", on: false });
      void sim.control({ kind: "SetFixedPause", pause: "ElectionDay", on: false });
    },
    [...VIEWS],
  );
  await page.waitForFunction(
    (views) =>
      views.every(
        (v) =>
          v === "exchanges" ||
          (globalThis as unknown as { __tcSim: Loose }).__tcSim.store.getView(v)?.data !== undefined,
      ),
    [...VIEWS],
  );
  // A new game opens the News window on an empty desktop (os/Desktop.tsx firstApp), covering the
  // icons: close it, then open the window the addresses are typed in from the launcher.
  const first = page.locator('section.os-window [data-testid$="-close"]');
  await first.first().waitFor({ timeout: 5000 });
  while ((await first.count()) > 0) await first.first().click();
  await page.getByTestId("tb-launcher").click();
  await page.getByTestId("launch-browser").click();
  await expect(page.getByTestId("browser-address").first()).toBeVisible();
  const typing =
    (await page.locator('section.os-window[data-app="browser"]').first().getAttribute("data-testid")) ?? "";
  current = { launched, page, errors, hour: START, userDataDir, typing };
  return current;
}

test.afterAll(async () => {
  if (current === null) return;
  const s = current;
  current = null;
  const closed = await closeApp(s.launched, "if-killed");
  expect(closed.stray, "processes left behind").toEqual([]);
  rmSync(s.userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

/** Runs the mock forward to `hour`, Step by Step, resuming after any pause that stops one early. */
async function advanceTo(s: Session, hour: number): Promise<void> {
  while (s.hour < hour) {
    const now = await s.page.evaluate(
      () => (globalThis as unknown as { __tcSim: { clock: { now: number } } }).__tcSim.clock.now,
    );
    if (now >= hour) break;
    const hours = Math.min(STEP_HOURS, hour - now);
    await s.page.evaluate(
      (h) => (globalThis as unknown as { __tcSim: Loose }).__tcSim.control({ kind: "Step", hours: h }),
      hours,
    );
    // The step is done when the game is paused again at a later hour (a pause may cut it short).
    await s.page.waitForFunction(
      ({ before }) => {
        const c = (globalThis as unknown as { __tcSim: { clock: { now: number; paused: boolean } } }).__tcSim
          .clock;
        return c.paused && c.now > before;
      },
      { before: now },
      { timeout: 60_000 },
    );
    const after = await s.page.evaluate(
      () => (globalThis as unknown as { __tcSim: { clock: { now: number } } }).__tcSim.clock.now,
    );
    s.hour = after;
  }
}

/** The mock's clock now, in hours. */
async function clockNow(page: Page): Promise<number> {
  return page.evaluate(
    () => (globalThis as unknown as { __tcSim: { clock: { now: number } } }).__tcSim.clock.now,
  );
}

// ---------------------------------------------------------------- ids from the views

interface Ids {
  date: { year: number; month: number; day: number };
  outlets: { id: number; kind: string; state: number | null }[];
  /** Article ids: the first, the last and one of each kind. */
  articles: { id: number; kind: string }[];
  articleCount: number;
  handles: { id: number; kind: string }[];
  /** A post with a rumour, the last post, a post that names something. */
  posts: { id: number; rumour: string | null }[];
  pollsters: number[];
  races: {
    id: number;
    office: string;
    state: number | null;
    status: string;
    primaries: number;
    candidates: number[];
    winner: number | null;
  }[];
  states: number[];
  bills: number[];
  rollCalls: number[];
  actions: number;
  people: number[];
  districts: { id: number; state: number; number: number; ref: number }[];
  fips: string[];
  companies: { id: number; ticker: string; public: boolean }[];
  industries: number[];
  exchanges: number[];
  cycle: number | null;
  /** Races with returns (election night). */
  returned: number[];
}

/** Everything the route lists need, read from the page's store. */
async function readIds(page: Page): Promise<Ids> {
  return page.evaluate(() => {
    const sim = (globalThis as unknown as { __tcSim: Loose }).__tcSim;
    const v = (n: string): Loose => sim.store.getView(n)?.data;
    const feed = v("feed");
    const social = v("social");
    const polls = v("polls");
    const races = v("races");
    const records = v("records");
    const people = v("people");
    const districts = v("districts");
    const map = v("usmap_layers");
    const rows = v("company_rows");
    const ret = v("returns");
    const kinds = new Map<string, Loose>();
    for (const a of feed.articles) if (!kinds.has(a.kind)) kinds.set(a.kind, a);
    const arts = new Map<number, string>();
    if (feed.articles.length > 0) {
      arts.set(feed.articles[0].id, feed.articles[0].kind);
      const last = feed.articles[feed.articles.length - 1];
      arts.set(last.id, last.kind);
    }
    for (const a of kinds.values()) arts.set(a.id, a.kind);
    const posts: { id: number; rumour: string | null }[] = [];
    const seen = new Set<number>();
    const addPost = (p: Loose) => {
      if (p === undefined || seen.has(p.id)) return;
      seen.add(p.id);
      posts.push({ id: p.id, rumour: p.rumour });
    };
    for (const p of social.posts) if (p.rumour !== null && p.rumour !== undefined) addPost(p);
    addPost(social.posts[0]);
    addPost(social.posts[social.posts.length - 1]);
    addPost(social.posts.find((p: Loose) => p.refs.length > 0));
    return {
      date: sim.clock.date,
      outlets: feed.outlets.map((o: Loose) => ({ id: o.id, kind: o.kind, state: o.state })),
      articles: [...arts].map(([id, kind]) => ({ id, kind })),
      articleCount: feed.articles.length,
      handles: social.handles.map((h: Loose) => ({ id: h.id, kind: h.kind })),
      posts,
      pollsters: polls.pollsters.map((p: Loose) => p.id),
      races: races.races.map((r: Loose) => ({
        id: r.id,
        office: r.office,
        state: r.state,
        status: r.status,
        primaries: r.primaries.length,
        candidates: r.candidates.map((c: Loose) => c.person),
        winner: r.winner,
      })),
      states: map.states.map((s: Loose) => s.id),
      bills: records.bills.map((b: Loose) => b.id),
      rollCalls: records.roll_calls.map((r: Loose) => r.id),
      actions: records.actions.length,
      people: people.people.map((p: Loose) => p.id),
      districts: districts.districts.map((d: Loose) => ({
        id: d.id,
        state: d.state,
        number: d.number,
        ref: d.state * 100 + d.number,
      })),
      fips: map.counties.fips,
      companies: rows.rows.map((c: Loose) => ({ id: c.id, ticker: c.ticker, public: c.public })),
      industries: v("industry_rows").rows.map((i: Loose) => i.id),
      exchanges: (v("exchanges")?.exchanges ?? []).map((e: Loose) => e.zone),
      cycle: races.cycle,
      returned: ret.races.map((r: Loose) => r.race),
    };
  });
}

// ---------------------------------------------------------------- opening a route and judging the page

/** The test id of an app's root element (apps/*, each App component). */
function rootId(app: string): string {
  return app === "debug" ? "debug-workspace" : `app-root-${app}`;
}

interface Visited {
  app: string;
  route: string | null;
  /** The address bar's text of the window after the visit. */
  address: string;
  fault: string | null;
  missing: string | null;
  textLength: number;
  /** New page or console errors raised while this route was drawn. */
  errors: string[];
}

/** `orr://app/route` as typed (os/url.ts formatUrl without escaping: the routes here need none). */
function addressOf(app: string, route: string | null): string {
  return `orr://${app}${route === null || route === "" ? "" : `/${route}`}`;
}

/** The window an `openApp` just focused. */
function focusedWindow(page: Page, app: string): Locator {
  return page.locator(`section.os-window[data-app="${app}"][data-focused="true"]`);
}

/** Types `orr://app/route` into the first Browser window's bar and returns once the page has drawn. */
async function open(s: Session, app: string, route: string | null): Promise<Locator> {
  const page = s.page;
  const bar = page.getByTestId("browser-address").first();
  await bar.fill(addressOf(app, route));
  await bar.press("Enter");
  // The Browser's own addresses navigate its typing window (BrowserApp `go`), which may not be
  // the focused one; any other app's window is the one `openApp` just focused.
  const win = app === "browser" ? page.getByTestId(s.typing) : focusedWindow(page, app).last();
  await expect(win).toBeVisible();
  await expect(win.getByTestId(rootId(app))).toBeVisible();
  // A window that was already open (a singleton, or the typing window) takes the route a frame on.
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));
  return win;
}

/** What is wrong with the page a window shows now (waits a moment for views and chunks to arrive). */
async function judge(page: Page, win: Locator): Promise<Pick<Visited, "fault" | "missing" | "textLength">> {
  const body = win.locator(".os-window-body");
  let text = "";
  // A page may show "Opening..." or "Loading" first: give it a few seconds to have content.
  for (let i = 0; i < 40; i++) {
    text = (await body.innerText()).trim();
    if (text.length >= 40 && !/^(Opening|Loading)\b/.test(text)) break;
    await page.waitForTimeout(100);
  }
  const faults = await page.locator(".os-window-fault").allInnerTexts();
  const fault = faults.length === 0 ? null : faults.join(" | ").replace(/\s+/g, " ");
  let missing: string | null = null;
  for (const id of MISSING_TEST_IDS) {
    if ((await win.getByTestId(id).count()) > 0) {
      missing = `${id}: ${(await win.getByTestId(id).first().innerText()).replace(/\s+/g, " ").slice(0, 120)}`;
      break;
    }
  }
  if (missing === null) {
    const m = MISSING_TEXT.exec(text);
    if (m !== null) missing = `text "${m[0]}"`;
  }
  return { fault, missing, textLength: text.length };
}

/** Closes a window opened for a visit, unless the app is a singleton (it stays, and is reused). */
async function dismiss(win: Locator): Promise<void> {
  const app = await win.getAttribute("data-app");
  if (app === "usmap" || app === "terminal" || app === "debug") return;
  // An address of the browser navigates the typing window itself (BrowserApp `go`): it stays.
  if ((await win.getAttribute("data-testid")) === current?.typing) return;
  await win.locator('[data-testid$="-close"]').click();
}

/**
 * True for a page that may rightly say "no article": the encyclopedia covers only the USA
 * (browser/sanitize.ts `isOutside`), so the page of a company, industry or exchange of another
 * country is a "no article yet" page by design (D1047). The mock's companies are mostly not American.
 */
function mayBeOutside(app: string, route: string | null): boolean {
  return app === "browser" && route !== null && /^(company|industry|exchange)\/\d+$/.test(route);
}

/** Opens one route, judges it, and closes the window again. */
async function visit(s: Session, app: string, route: string | null): Promise<Visited> {
  const before = s.errors.length;
  const win = await open(s, app, route);
  const verdict = await judge(s.page, win);
  const address = (await win.locator(".os-address").innerText()).trim();
  // One more frame, so an effect's fault raised just after the first paint is in the log.
  await s.page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
  const errors = s.errors.slice(before);
  const fault =
    verdict.fault ?? ((await s.page.locator(".os-window-fault").count()) > 0 ? "fault pane" : null);
  await dismiss(win);
  if (mayBeOutside(app, route)) verdict.missing = null;
  return { app, route, address, ...verdict, fault, errors };
}

/** Each problem of the visits, one line each; an empty list is a clean tour. */
function problems(visits: readonly Visited[]): string[] {
  const out: string[] = [];
  for (const v of visits) {
    const at = `${v.app} ${v.route ?? "(home)"}`;
    if (v.fault !== null) out.push(`${at}: error boundary: ${v.fault}`);
    if (v.errors.length > 0) out.push(`${at}: ${v.errors.join(" || ").slice(0, 400)}`);
    if (v.textLength < 40) out.push(`${at}: empty root (${v.textLength} characters)`);
    if (v.missing !== null) out.push(`${at}: no such page: ${v.missing}`);
  }
  return out;
}

/** Visits every route of `routes` and asserts the tour found nothing, naming each failure. */
async function tourRoutes(s: Session, app: string, routes: readonly (string | null)[]): Promise<Visited[]> {
  const visits: Visited[] = [];
  for (const r of routes) visits.push(await visit(s, app, r));
  test.info().annotations.push({ type: "routes", description: `${routes.length} visited` });
  expect(problems(visits), `${app}: routes with problems`).toEqual([]);
  return visits;
}

// ---------------------------------------------------------------- the route lists

const isoDate = (d: { year: number; month: number; day: number }, delta: number): string => {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + delta));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
};

const unique = <T>(xs: readonly T[]): T[] => [...new Set(xs)];

/** news/route.ts: home, an outlet, an outlet on a past date, an article, latest with filters. */
function newsRoutes(ids: Ids): (string | null)[] {
  const o0 = ids.outlets[0]?.id ?? 0;
  const regional = ids.outlets.find((o) => o.kind === "Regional")?.id ?? o0;
  const national = ids.outlets.find((o) => o.kind === "National")?.id ?? o0;
  return [
    null,
    "home",
    `outlet/${o0}`,
    `outlet/${national}`,
    `outlet/${regional}`,
    `outlet/${o0}/${isoDate(ids.date, -1)}`,
    `outlet/${national}/${isoDate(ids.date, -5)}`,
    ...ids.articles.map((a) => `article/${a.id}`),
    "latest",
    `latest?outlet=${national}`,
    "latest?kind=Call",
    "latest?kind=Opinion",
    "latest?followed=1",
    "latest?q=poll",
    `latest?outlet=${o0}&kind=Report&q=a`,
  ];
}

/** social/route.ts: home, all, rumours, a handle, a post. */
function socialRoutes(ids: Ids): (string | null)[] {
  const handleOf = (kind: string) => ids.handles.find((h) => h.kind === kind)?.id;
  const handles = unique([
    ids.handles[0]?.id,
    handleOf("Politician"),
    handleOf("Anonymous"),
    handleOf("Pollster"),
  ])
    .filter((h): h is number => h !== undefined)
    .map((h) => `handle/${h}`);
  return [null, "home", "all", "rumours", ...handles, ...ids.posts.map((p) => `post/${p.id}`)];
}

/** polls/route.ts: home, races (with filters), a race with its general and each primary, a pollster, a state. */
function pollsRoutes(ids: Ids): (string | null)[] {
  const pres = ids.races.find((r) => r.office === "President");
  const senate = ids.races.find((r) => r.office === "Senate");
  const house = ids.races.find((r) => r.office === "House");
  const gov = ids.races.find((r) => r.office === "Governor");
  const withPrimaries = ids.races.find((r) => r.primaries > 0);
  const routes: (string | null)[] = [
    null,
    "races",
    "races?office=Senate",
    "races?office=House&sort=margin&dir=desc",
    `races?state=${ids.states[0] ?? 0}`,
    "races?q=a&sort=title",
    "races?rating=toss-up",
  ];
  for (const r of [pres, senate, house, gov])
    if (r !== undefined) routes.push(`race/${r.id}`, `race/${r.id}/general`);
  if (withPrimaries !== undefined) {
    for (let n = 0; n < withPrimaries.primaries; n++) routes.push(`race/${withPrimaries.id}/primary-${n}`);
  }
  for (const p of ids.pollsters.slice(0, 2)) routes.push(`pollster/${p}`);
  for (const st of ids.states.slice(0, 2)) routes.push(`state/${st}`);
  return unique(routes);
}

/** records/route.ts: every section, a bill, a roll call, finance race and person, results, officials, districts. */
function recordsRoutes(ids: Ids): (string | null)[] {
  const pres = ids.races.find((r) => r.office === "President");
  const senate = ids.races.find((r) => r.office === "Senate");
  const house = ids.races.find((r) => r.office === "House");
  const candidate = (senate ?? pres)?.candidates[0];
  const cycle = ids.cycle ?? 2020;
  const routes: (string | null)[] = [
    null,
    "bills",
    "bills?stage=Law",
    "bills?chamber=Senate&q=a",
    ...ids.bills.map((b) => `bill/${b}`),
    ...unique([ids.rollCalls[0], ids.rollCalls[ids.rollCalls.length - 1]])
      .filter((r): r is number => r !== undefined)
      .map((r) => `rollcall/${r}`),
    "exec",
    "exec?kind=Resignation",
    "finance",
    "results",
    `results/${cycle}`,
    "officials",
    "officials/house",
    "officials/senate",
    "districts",
    `districts/${ids.states[0] ?? 0}`,
  ];
  for (const r of [pres, senate, house]) {
    if (r === undefined) continue;
    routes.push(`finance/race/${r.id}`);
    // Before the count there is no result to show: the page says so (that is not a fault).
    if (["Counting", "Recount", "Certified"].includes(r.status)) routes.push(`results/race/${r.id}`);
  }
  if (candidate !== undefined) routes.push(`finance/person/${candidate}`);
  return unique(routes);
}

/** browser/route.ts: home, each article kind, each index, search, a framework page. */
function browserRoutes(ids: Ids): (string | null)[] {
  const first = <T>(xs: readonly T[]): T | undefined => xs[0];
  const routes: (string | null)[] = [null];
  const add = (kind: string, id: number | string | undefined) => {
    if (id !== undefined) routes.push(`${kind}/${id}`);
  };
  add("person", first(ids.people));
  add("race", first(ids.races)?.id);
  add("bill", first(ids.bills));
  add("state", first(ids.states));
  add("county", 0);
  add("district", first(ids.districts)?.ref);
  add("outlet", first(ids.outlets)?.id);
  add("pollster", first(ids.pollsters));
  routes.push("people", "states", "races", "bills", "outlets", "pollsters");
  routes.push("search/senate", "search/a");
  routes.push("companies", "industries", "exchanges", "world-history");
  add("company", ids.companies.find((c) => c.public)?.id ?? first(ids.companies)?.id);
  add("industry", first(ids.industries));
  add("exchange", first(ids.exchanges));
  routes.push("recap/2020-Q3");
  return routes;
}

/** usmap/route.ts: each layer, a state, a district, a county, a race live. */
function usmapRoutes(ids: Ids): (string | null)[] {
  const pres = ids.races.find((r) => r.office === "President");
  const senate = ids.races.find((r) => r.office === "Senate");
  const house = ids.races.find((r) => r.office === "House");
  const st = ids.states[0] ?? 0;
  const routes: (string | null)[] = [
    null,
    "layer/population",
    "layer/turnout",
    "layer/districts",
    "layer/lean",
    "layer/live",
    `state/${st}`,
    `state/${st}/layer/turnout`,
  ];
  const d = ids.districts[0];
  if (d !== undefined) routes.push(`district/${d.ref}`, `district/${d.ref}/layer/districts`);
  const fips = ids.fips[0];
  if (fips !== undefined) routes.push(`county/${fips}`, "county/0");
  for (const r of [pres, senate, house]) if (r !== undefined) routes.push(`race/${r.id}/live`);
  if (pres !== undefined && fips !== undefined) routes.push(`race/${pres.id}/live/county/${fips}`);
  if (pres !== undefined) routes.push(`race/${pres.id}/live/state/${st}`);
  return routes;
}

/** terminal/route.ts: each function page, the order ticket, the account. */
function terminalRoutes(ids: Ids): (string | null)[] {
  const ticker = ids.companies.find((c) => c.public && c.ticker !== "")?.ticker;
  const pages = ["F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10"].map((f) => `page/${f}`);
  const routes: (string | null)[] = [null, ...pages];
  if (ticker !== undefined)
    routes.push(`page/F3/${ticker}`, `page/F4/${ticker}`, `page/F5/${ticker}`, `page/F8/${ticker}`);
  routes.push("page/quotes", "page/account");
  return routes;
}

const APPS = ["news", "social", "polls", "records", "browser", "usmap", "terminal"] as const;
type TourApp = (typeof APPS)[number];

const ROUTES: Record<TourApp, (ids: Ids) => (string | null)[]> = {
  news: newsRoutes,
  social: socialRoutes,
  polls: pollsRoutes,
  records: recordsRoutes,
  browser: browserRoutes,
  usmap: usmapRoutes,
  terminal: terminalRoutes,
};

/** One race of each status the races have now (a count, a recount, a certified race ...), at most one each. */
function raceByStatus(ids: Ids): Ids["races"] {
  const seen = new Set<string>();
  const out: Ids["races"] = [];
  for (const r of ids.races) {
    if (seen.has(r.status)) continue;
    seen.add(r.status);
    out.push(r);
  }
  return out;
}

/**
 * The routes worth visiting again after time has passed: the pages that show returns, results,
 * calls, forecasts, the feed and the account, plus a race of each status the races now have.
 */
function lateRoutes(app: TourApp, ids: Ids): (string | null)[] {
  const statuses = raceByStatus(ids);
  const winners = unique(ids.races.map((r) => r.winner).filter((w): w is number => w !== null)).slice(0, 2);
  const extra: Record<TourApp, (string | null)[]> = {
    news: [],
    social: [],
    polls: statuses.flatMap((r) => [`race/${r.id}`, `race/${r.id}/general`]),
    records: statuses.flatMap((r) => [`results/race/${r.id}`, `finance/race/${r.id}`]),
    browser: [...statuses.map((r) => `race/${r.id}`), ...winners.map((w) => `person/${w}`)],
    usmap: statuses.map((r) => `race/${r.id}/live`),
    terminal: [],
  };
  const keep: Record<TourApp, RegExp> = {
    news: /^(null|home|latest|latest\?kind=Call|latest\?outlet=\d+|article\/\d+|outlet\/\d+\/.*)$/,
    social: /.*/,
    polls: /^(null|races|race\/\d+(\/general)?|state\/\d+|races\?office=Senate)$/,
    records: /^(null|results.*|finance.*|officials.*|bills|bill\/\d+|exec|rollcall\/\d+)$/,
    browser: /^(null|race\/\d+|person\/\d+|state\/\d+|races|people|search\/.*)$/,
    usmap: /.*/,
    terminal: /^(null|page\/(F2|F8|F3\/.*))$/,
  };
  const all = [...ROUTES[app](ids), ...extra[app]];
  return unique(all.filter((r) => keep[app].test(r ?? "null")));
}

// ---------------------------------------------------------------- cross-app links

/** The home app of each entity kind (apps/_shared/entity.ts ENTITY_APP, written out here on purpose). */
const ENTITY_APP: Record<string, string> = {
  Person: "browser",
  Race: "polls",
  Bill: "records",
  Company: "browser",
  Industry: "browser",
  State: "browser",
  County: "browser",
  District: "browser",
  Outlet: "news",
  Pollster: "polls",
  Handle: "social",
  Contract: "exchange",
};

/**
 * True when the app reads `route` as a page of its own. Polls, records and the browser show a "no
 * such page" screen for a route they do not know (the judge sees it); news, social, the map and the
 * terminal quietly show their home instead, so their grammars are checked here (route.ts of each).
 */
function readable(app: string, route: string): boolean {
  switch (app) {
    case "news":
      return /^(home|outlet\/\d+(\/\d{4}-\d{2}-\d{2})?|article\/\d+|latest(\?.*)?)$/.test(route);
    case "social":
      return /^(home|all|rumours|(handle|post|person)\/\d+)$/.test(route);
    case "usmap":
      return /^(race\/\d+\/live(\/|$)|(state|district|county)\/\d+)/.test(route);
    case "terminal":
      return /^page\/[A-Za-z0-9]+(\/[^/]+)?$/.test(route);
    default:
      return true;
  }
}

/** Links whose target app does not exist yet: they open nothing (the exchange arrives in M5). */
const noHomeApp: string[] = [];

interface Landing {
  from: string;
  to: string;
  problem: string | null;
}

/**
 * Opens `app` at each of `routes`, clicks one entity link of each kind found there (and every
 * Browser "elsewhere" reference to another app), and says where each landed. A landing is a problem
 * when the target app shows a fault or no page, or does not read the route it was given.
 */
async function followLinks(s: Session, app: string, routes: readonly (string | null)[]): Promise<Landing[]> {
  const page = s.page;
  const landings: Landing[] = [];
  for (const route of routes) {
    const here = `${app} ${route ?? "(home)"}`;
    const win = await open(s, app, route);
    await judge(page, win);
    const tids = await win
      .locator('[data-testid^="link-"], [data-testid^="ref-"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid") ?? ""));
    const picked = new Map<string, string>();
    for (const tid of tids) {
      const m = /^link-([a-z]+)-\d+$/.exec(tid);
      const r = /^ref-([a-z]+)-(.+)$/.exec(tid);
      // One of each kind of entity; every "elsewhere" reference of another app.
      if (m !== null && !picked.has(`kind:${m[1]}`)) picked.set(`kind:${m[1]}`, tid);
      else if (r !== null && r[1] !== "browser") picked.set(`ref:${tid}`, tid);
    }
    for (const tid of picked.values()) {
      const kindMatch = /^link-([a-z]+)-(\d+)$/.exec(tid);
      let target: string;
      let targetRoute: string;
      if (kindMatch !== null) {
        const kind = Object.keys(ENTITY_APP).find((k) => k.toLowerCase() === kindMatch[1]) ?? "";
        target = ENTITY_APP[kind] ?? "?";
        targetRoute = `${kindMatch[1]}/${kindMatch[2]}`;
      } else {
        const m = /^ref-([a-z]+)-(.+)$/.exec(tid);
        target = m?.[1] ?? "?";
        targetRoute = m?.[2] === "home" ? "home" : (m?.[2] ?? "");
      }
      const windows = page.locator("section.os-window");
      const count = await windows.count();
      const before = s.errors.length;
      await win.getByTestId(tid).first().click();
      const to = `${target} ${targetRoute}`;
      if (target === "exchange") {
        // M5's betting exchange is not built: `openApp` finds no such app and nothing opens.
        await page.waitForTimeout(150);
        const nothing = (await windows.count()) === count;
        if (nothing) noHomeApp.push(`${here} -> ${tid}`);
        landings.push({
          from: `${here} -> ${tid}`,
          to,
          problem: nothing ? null : "opened a window for a Contract",
        });
        continue;
      }
      const tw = focusedWindow(page, target).last();
      await expect(tw).toBeVisible();
      await expect(tw.getByTestId(rootId(target))).toBeVisible();
      const verdict = await judge(page, tw);
      const address = (await tw.locator(".os-address").innerText()).trim();
      let problem: string | null = null;
      if (verdict.fault !== null) problem = `error boundary: ${verdict.fault}`;
      else if (s.errors.length > before)
        problem = `errors: ${s.errors.slice(before).join(" || ").slice(0, 300)}`;
      else if (verdict.missing !== null && !mayBeOutside(target, targetRoute))
        problem = `no such page: ${verdict.missing}`;
      else if (verdict.textLength < 40) problem = "empty root";
      else if (!readable(target, targetRoute))
        problem = `the app does not read "${targetRoute}" and shows its home`;
      else if (target === "social" && /^person\/\d+$/.test(targetRoute)) {
        // Social turns a person route into that person's handle page (or its home): either is right.
        if (!/^orr:\/\/social(\/handle\/\d+)?$/.test(address)) problem = `opened ${address} for a person`;
      } else if (address !== addressOf(target, targetRoute === "home" ? null : targetRoute)) {
        problem = `opened ${address}, expected ${addressOf(target, targetRoute)}`;
      }
      landings.push({ from: `${here} -> ${tid}`, to, problem });
      await dismiss(tw);
    }
    await dismiss(win);
  }
  return landings;
}

/** The landings that went wrong, one line each. */
function bad(landings: readonly Landing[]): string[] {
  return landings.filter((l) => l.problem !== null).map((l) => `${l.from} => ${l.to}: ${l.problem}`);
}

// ---------------------------------------------------------------- the tests

/**
 * The phone's apps (os/phone/Phone.tsx): each tile opened, then the first few things in its screen
 * pressed (a story, a post, a back arrow). The phone has no error boundary of its own, so a fault
 * there would blank the whole page: the desktop must still be drawn afterwards.
 */
async function tourPhone(s: Session): Promise<string[]> {
  const page = s.page;
  const out: string[] = [];
  const phone = page.getByTestId("phone");
  if ((await phone.getAttribute("data-open")) !== "true") await page.getByTestId("tb-phone").click();
  await expect(phone).toHaveAttribute("data-open", "true");
  const tiles = await page
    .locator('[data-testid^="phone-app-"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid") ?? ""));
  expect(tiles.length, "phone apps").toBeGreaterThan(0);
  for (const tile of tiles) {
    const before = s.errors.length;
    await page.getByTestId(tile).click();
    const content = phone.locator(".os-phone-content");
    await expect(content).toContainText(/\w{4}/);
    await expect
      .poll(async () => (await content.innerText()).trim().length, { timeout: 5000 })
      .toBeGreaterThan(20);
    // Press up to three buttons that are not the back arrow, going back to the app's own screen each time.
    for (let i = 0; i < 3; i++) {
      const buttons = content.locator("button:visible");
      if ((await buttons.count()) <= i) break;
      await buttons
        .nth(i)
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.evaluate(
        () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
      );
      if ((await page.locator(".os-window-fault").count()) > 0) out.push(`${tile}: fault pane`);
      if ((await page.getByTestId("desktop").count()) === 0) out.push(`${tile}: the desktop is gone`);
      const back = page.getByTestId("phone-back");
      if ((await back.count()) > 0 && (await content.locator("button:visible").count()) === 0)
        await back.click();
    }
    const errs = s.errors.slice(before);
    if (errs.length > 0) out.push(`${tile}: ${errs.join(" || ").slice(0, 300)}`);
    if ((await page.getByTestId("desktop").count()) === 0) break;
    const back = page.getByTestId("phone-back");
    if ((await back.count()) > 0) await back.click();
  }
  await page.getByTestId("phone-down").click();
  return out;
}

/** Visits `routes` of `app` in the session at `hour` and asserts a clean tour and a quiet console. */
async function tourAt(app: TourApp, hour: number, pick: (ids: Ids) => (string | null)[]): Promise<void> {
  test.setTimeout(150_000);
  const s = await session();
  await advanceTo(s, hour);
  const before = s.errors.length;
  await tourRoutes(s, app, pick(await readIds(s.page)));
  expect(s.errors.slice(before), "page and console errors").toEqual([]);
}

test.describe("tour: the start (20 Oct 2020)", () => {
  test("the tour sees an unknown route, a page error and a console error", tour, async () => {
    // A control: the checks below would pass just as well if the harness saw nothing.
    const s = await session();
    expect((await visit(s, "polls", "bogus/route")).missing, "polls unknown route").not.toBeNull();
    expect((await visit(s, "records", "bogus")).missing, "records unknown route").not.toBeNull();
    expect((await visit(s, "browser", "bogus/route")).missing, "browser unknown route").not.toBeNull();
    const n = s.errors.length;
    await s.page.evaluate(() => {
      setTimeout(() => {
        throw new Error("tour control");
      }, 0);
      console.error("tour control");
    });
    await expect.poll(() => s.errors.length - n).toBe(2);
    s.errors.length = n;
  });

  for (const app of APPS) {
    test(`every route of ${app}`, tour, async () => {
      await tourAt(app, START, ROUTES[app]);
    });
  }

  // The debug workspace is not toured: it is listed only with Omniscient, which the built mock
  // refuses (`SetOmniscient` answers DebugOnly), so no window of it can open in the built app.

  test("the phone's apps open and hold up", tour, async () => {
    const s = await session();
    await advanceTo(s, START);
    expect(await tourPhone(s)).toEqual([]);
  });

  test("entity links open each kind in its home app", tour, async () => {
    test.setTimeout(150_000);
    const s = await session();
    await advanceTo(s, START);
    const ids = await readIds(s.page);
    const landings: Landing[] = [];
    // What `openEntity` would open for each kind of thing the mock has (apps/_shared/entity.ts).
    const sample: Record<string, number | undefined> = {
      Person: ids.people[0],
      Race: ids.races[0]?.id,
      Bill: ids.bills[0],
      Company: ids.companies.find((c) => c.public)?.id,
      Industry: ids.industries[0],
      State: ids.states[0],
      County: 0,
      District: ids.districts[0]?.ref,
      Outlet: ids.outlets[0]?.id,
      Pollster: ids.pollsters[0],
      Handle: ids.handles[0]?.id,
    };
    for (const [kind, id] of Object.entries(sample)) {
      if (id === undefined) continue;
      const app = ENTITY_APP[kind] as string;
      const route = `${kind.toLowerCase()}/${id}`;
      const v = await visit(s, app, route);
      const p = problems([v]);
      if (!readable(app, route)) p.push(`${app} does not read "${route}"`);
      landings.push({
        from: `entity ${kind}`,
        to: `${app} ${route}`,
        problem: p.length === 0 ? null : p.join("; "),
      });
    }
    expect(bad(landings)).toEqual([]);
  });

  test("links in the news, social, polls and records apps open the right page", tour, async () => {
    test.setTimeout(150_000);
    const s = await session();
    await advanceTo(s, START);
    const ids = await readIds(s.page);
    const pres = ids.races.find((r) => r.office === "President");
    const landings: Landing[] = [];
    landings.push(
      ...(await followLinks(
        s,
        "news",
        ids.articles.map((a) => `article/${a.id}`),
      )),
    );
    landings.push(
      ...(await followLinks(s, "news", [
        `outlet/${ids.outlets.find((o) => o.kind === "Regional")?.id ?? 0}`,
      ])),
    );
    landings.push(...(await followLinks(s, "social", [...ids.posts.map((p) => `post/${p.id}`), "all"])));
    landings.push(
      ...(await followLinks(
        s,
        "social",
        ids.handles
          .filter((h) => h.kind === "Politician")
          .slice(0, 1)
          .map((h) => `handle/${h.id}`),
      )),
    );
    landings.push(
      ...(await followLinks(s, "polls", [
        ...(pres === undefined ? [] : [`race/${pres.id}`]),
        `state/${ids.states[0] ?? 0}`,
      ])),
    );
    landings.push(
      ...(await followLinks(s, "records", [
        ...(pres === undefined ? [] : [`finance/race/${pres.id}`, "results"]),
        `bill/${ids.bills[0] ?? 0}`,
        `districts/${ids.states[0] ?? 0}`,
        "officials/house",
      ])),
    );
    expect(landings.length, "links found").toBeGreaterThan(10);
    expect(bad(landings)).toEqual([]);
  });

  test("links in the map, terminal and browser open the right page", tour, async () => {
    test.setTimeout(150_000);
    const s = await session();
    await advanceTo(s, START);
    const ids = await readIds(s.page);
    const pres = ids.races.find((r) => r.office === "President");
    const landings: Landing[] = [];
    const st = ids.states[0] ?? 0;
    landings.push(
      ...(await followLinks(s, "usmap", [
        `state/${st}`,
        ...(ids.districts[0] === undefined ? [] : [`district/${ids.districts[0].ref}`]),
        ...(ids.fips[0] === undefined ? [] : [`county/${ids.fips[0]}`]),
        ...(pres === undefined ? [] : [`race/${pres.id}/live`]),
      ])),
    );
    landings.push(...(await followLinks(s, "terminal", ["page/F8", "page/F4"])));
    // The browser's own "elsewhere" references, one article of each kind that has them.
    const articles = [
      `race/${pres?.id ?? 0}`,
      `bill/${ids.bills[0] ?? 0}`,
      `state/${st}`,
      "county/0",
      `district/${ids.districts[0]?.ref ?? 0}`,
      `outlet/${ids.outlets[0]?.id ?? 0}`,
      `pollster/${ids.pollsters[0] ?? 0}`,
    ];
    landings.push(...(await followLinks(s, "browser", articles)));
    expect(landings.length, "links found").toBeGreaterThan(8);
    expect(bad(landings)).toEqual([]);
  });

  test("a person's encyclopedia article links to their posts in social", tour, async () => {
    // The article's "Posts about them on Social" reference opens `orr://social/person/<id>`, which
    // social turns into that person's handle page (social/route.ts personOfRoute).
    const s = await session();
    await advanceTo(s, START);
    const ids = await readIds(s.page);
    expect(bad(await followLinks(s, "browser", [`person/${ids.people[0] ?? 0}`]))).toEqual([]);
  });
});

test.describe("tour: election night (4 Nov 02:00)", () => {
  for (const app of APPS) {
    test(`returns, calls and results in ${app}`, tour, async () => {
      await tourAt(app, NIGHT, (ids) => lateRoutes(app, ids));
    });
  }

  test("the mock is where the tour thinks it is", tour, async () => {
    const s = await session();
    await advanceTo(s, NIGHT);
    expect(await clockNow(s.page)).toBeGreaterThanOrEqual(NIGHT);
    const ids = await readIds(s.page);
    expect(ids.returned.length, "races with returns on election night").toBeGreaterThan(0);
  });
});

test.describe("tour: after certification (9 Nov 10:00)", () => {
  for (const app of APPS) {
    test(`certified results in ${app}`, tour, async () => {
      await tourAt(app, CERTIFIED, (ids) => lateRoutes(app, ids));
    });
  }

  test("links to a certified race and its winner", tour, async () => {
    test.setTimeout(150_000);
    const s = await session();
    await advanceTo(s, CERTIFIED);
    const ids = await readIds(s.page);
    const certified = ids.races.filter((r) => r.status === "Certified");
    expect(certified.length, "certified races").toBeGreaterThan(0);
    const landings = await followLinks(s, "records", [
      "results",
      ...certified.slice(0, 2).map((r) => `results/race/${r.id}`),
    ]);
    landings.push(
      ...(await followLinks(
        s,
        "usmap",
        certified.slice(0, 1).map((r) => `race/${r.id}/live`),
      )),
    );
    expect(landings.length, "links found").toBeGreaterThan(3);
    expect(bad(landings)).toEqual([]);
  });

  test("the phone's apps hold up on the new day", tour, async () => {
    const s = await session();
    await advanceTo(s, CERTIFIED);
    expect(await tourPhone(s)).toEqual([]);
  });

  test("no page or console error in the whole tour", tour, async () => {
    const s = await session();
    expect(s.errors).toEqual([]);
  });

  test("contract links have no home app yet", tour, async () => {
    // apps/_shared/entity.ts: a Contract opens in the exchange (M5), which is not an app yet, so
    // clicking one does nothing. When the exchange lands this fails: expect it to open instead.
    for (const l of noHomeApp) expect(l).toMatch(/link-contract-\d+$/);
    test
      .info()
      .annotations.push({ type: "contract links that open nothing", description: noHomeApp.join(" ; ") });
  });
});
