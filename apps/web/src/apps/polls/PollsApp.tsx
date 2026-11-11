// Plumbline, the in-world polling and forecast site (pivot 8.4, 8.5, 6.1, 6.2): national overview, race,
// pollster and state pages, and a table of every race. It reads v_polls, v_forecast and v_races
// (and v_people for names); each page mounts only the views it shows. Everything it says about odds
// is the site's own estimate, which can be wrong (pivot 8.5).
//
// The route (route.ts) is the app's whole navigation state; the window keeps it, and this component
// keeps a back/forward history of the routes it has shown.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppProps } from "../../os/apps.ts";
import { useViewData } from "../../sim/hooks.ts";
import { formatDay } from "../_shared/index.ts";
import { Empty, PageLink, PollsNav } from "./components.tsx";
import { HomePage } from "./HomePage.tsx";
import { recordForecast, usePeople, useStateNames } from "./hooks.ts";
import { PollsterPage } from "./PollsterPage.tsx";
import { RacePage } from "./RacePage.tsx";
import { RacesPage } from "./RacesPage.tsx";
import {
  canBack,
  canForward,
  currentRoute,
  goBack,
  goForward,
  newHistory,
  type PollsRoute,
  parseRoute,
  pushRoute,
  type RaceFilters,
  type StageKey,
} from "./route.ts";
import { StatePage } from "./StatePage.tsx";
import "./polls.css";

/** Sets the window's title for the page shown ("Ohio Senate - Polls"); null is the app's own. */
function useTitle(setTitle: (t: string | null) => void, title: string | null): void {
  useEffect(() => {
    setTitle(title === null ? null : `${title} - Polls`);
  }, [setTitle, title]);
}

interface PageProps {
  setTitle: (t: string | null) => void;
  go: (route: string | null) => void;
}

function HomeRoute({ setTitle }: PageProps) {
  useTitle(setTitle, null);
  const forecast = useViewData("forecast");
  const races = useViewData("races");
  const polls = useViewData("polls");
  const people = usePeople();
  const stateNames = useStateNames();
  return (
    <HomePage
      forecast={forecast}
      races={races?.races}
      polls={polls}
      people={people}
      stateNames={stateNames}
    />
  );
}

function RaceRoute({ id, stage, setTitle, go }: PageProps & { id: number; stage: StageKey | null }) {
  const races = useViewData("races");
  const polls = useViewData("polls");
  const forecast = useViewData("forecast");
  const people = usePeople();
  const stateNames = useStateNames();
  const race = races?.races.find((r) => r.id === id);
  useTitle(setTitle, race?.title ?? null);
  if (races === undefined || polls === undefined)
    return <Empty testId="polls-loading">Loading the race...</Empty>;
  if (race === undefined) {
    return (
      <Empty testId="race-missing">
        No race has this number. <PageLink to="races">See all races</PageLink>.
      </Empty>
    );
  }
  return (
    <RacePage
      race={race}
      stage={stage}
      polls={polls}
      forecast={forecast}
      people={people}
      stateName={race.state === null ? null : (stateNames.get(race.state)?.name ?? null)}
      go={go}
    />
  );
}

function PollsterRoute({ id, setTitle }: PageProps & { id: number }) {
  const polls = useViewData("polls");
  const races = useViewData("races");
  const people = usePeople();
  const stateNames = useStateNames();
  const firm = polls?.pollsters.find((p) => p.id === id);
  useTitle(setTitle, firm?.name ?? null);
  if (polls === undefined) return <Empty testId="polls-loading">Loading the polls...</Empty>;
  return (
    <PollsterPage
      id={id}
      polls={polls}
      races={races?.races}
      people={people}
      stateName={(s) => stateNames.get(s)?.name ?? `state ${s}`}
    />
  );
}

function StateRoute({ id, setTitle }: PageProps & { id: number }) {
  const polls = useViewData("polls");
  const races = useViewData("races");
  const forecast = useViewData("forecast");
  const people = usePeople();
  const stateNames = useStateNames();
  const name = stateNames.get(id)?.name ?? null;
  useTitle(setTitle, name);
  if (polls === undefined || races === undefined)
    return <Empty testId="polls-loading">Loading the state...</Empty>;
  return (
    <StatePage id={id} name={name} races={races.races} polls={polls} forecast={forecast} people={people} />
  );
}

function RacesRoute({ filters, setTitle, go }: PageProps & { filters: RaceFilters }) {
  useTitle(setTitle, "All races");
  const races = useViewData("races");
  const forecast = useViewData("forecast");
  const polls = useViewData("polls");
  const people = usePeople();
  const stateNames = useStateNames();
  return (
    <RacesPage
      filters={filters}
      races={races?.races}
      forecast={forecast}
      polls={polls}
      people={people}
      stateNames={stateNames}
      go={go}
    />
  );
}

function Page({ route, setTitle, go }: PageProps & { route: PollsRoute }) {
  switch (route.kind) {
    case "home":
      return <HomeRoute setTitle={setTitle} go={go} />;
    case "race":
      return <RaceRoute id={route.id} stage={route.stage} setTitle={setTitle} go={go} />;
    case "pollster":
      return <PollsterRoute id={route.id} setTitle={setTitle} go={go} />;
    case "state":
      return <StateRoute id={route.id} setTitle={setTitle} go={go} />;
    case "races":
      return <RacesRoute filters={route.filters} setTitle={setTitle} go={go} />;
    case "unknown":
      return (
        <Empty testId="route-unknown">
          Plumbline has no page at "{route.route}". <PageLink to={null}>Back to the overview</PageLink>.
        </Empty>
      );
  }
}

export default function PollsApp({ route, onRoute, setTitle }: AppProps) {
  const [hist, setHist] = useState(() => newHistory(route));
  // A route set from outside (a link from another app, a restored desktop) is a visit.
  useEffect(() => {
    setHist((h) => pushRoute(h, route));
  }, [route]);

  const shown = currentRoute(hist);
  const parsed = useMemo(() => parseRoute(shown), [shown]);

  const go = useCallback(
    (r: string | null) => {
      setHist((h) => pushRoute(h, r));
      onRoute(r);
    },
    [onRoute],
  );
  const back = () => {
    const h = goBack(hist);
    setHist(h);
    onRoute(currentRoute(h));
  };
  const forward = () => {
    const h = goForward(hist);
    setHist(h);
    onRoute(currentRoute(h));
  };

  // The site's history of its own odds: the forecast view holds only the latest run (D1045).
  const forecast = useViewData("forecast");
  useEffect(() => recordForecast(forecast), [forecast]);

  return (
    <PollsNav.Provider value={go}>
      <div className="polls-app" data-testid="app-root-polls">
        <header className="polls-mast">
          <div className="polls-navbtns">
            <button
              type="button"
              aria-label="Back"
              disabled={!canBack(hist)}
              onClick={back}
              data-testid="polls-back"
            >
              ◀
            </button>
            <button
              type="button"
              aria-label="Forward"
              disabled={!canForward(hist)}
              onClick={forward}
              data-testid="polls-forward"
            >
              ▶
            </button>
          </div>
          <button type="button" className="polls-brand" onClick={() => go(null)} data-testid="polls-brand">
            <span className="polls-brand-mark" aria-hidden="true" />
            <span className="polls-brand-name">Plumbline</span>
            <span className="polls-brand-sub">Polls &amp; Forecast</span>
          </button>
          <nav className="polls-nav" aria-label="Plumbline">
            <button
              type="button"
              className={parsed.kind === "home" ? "on" : ""}
              onClick={() => go(null)}
              data-testid="nav-home"
            >
              Overview
            </button>
            <button
              type="button"
              className={parsed.kind === "races" ? "on" : ""}
              onClick={() => go("races")}
              data-testid="nav-races"
            >
              All races
            </button>
          </nav>
          <span className="polls-updated" data-testid="polls-updated">
            {forecast?.updated == null ? "Model not run yet" : `Model run ${formatDay(forecast.updated)}`}
          </span>
        </header>
        <main className="polls-main">
          <Page route={parsed} setTitle={setTitle} go={go} />
          <p className="polls-foot">
            Plumbline's odds are estimates from published polls and fundamentals. The model can be wrong.
          </p>
        </main>
      </div>
    </PollsNav.Provider>
  );
}
