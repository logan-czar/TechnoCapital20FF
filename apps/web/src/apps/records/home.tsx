// The front page of the records site: where Congress stands, the latest actions on bills, the
// latest roll calls and executive actions, and ways into the other sections.

import { useMemo, useState } from "react";
import { useViewData } from "../../sim/hooks.ts";
import { formatDay } from "../_shared/index.ts";
import {
  Empty,
  Loading,
  NavLink,
  Page,
  Person,
  Section,
  useNav,
  usePageTitle,
  usePeople,
} from "./common.tsx";
import { billLabel, dayKey, EXEC_LABEL, rollLabel } from "./data.ts";
import { MakeUpRow } from "./officials.tsx";

const RECENT = 6;

function Search() {
  const { go } = useNav();
  const [q, setQ] = useState("");
  return (
    <form
      className="rec-search"
      onSubmit={(e) => {
        e.preventDefault();
        go({ page: "bills", filter: { stage: null, chamber: null, subject: "", q: q.trim() } });
      }}
    >
      <label>
        <span className="rec-sr">Search bills</span>
        <input
          type="search"
          data-testid="home-search"
          value={q}
          placeholder="Find a bill by title, sponsor or number"
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <button type="submit" className="rec-button" data-testid="home-search-go">
        Search bills
      </button>
    </form>
  );
}

export function HomePage() {
  const records = useViewData("records");
  const people = usePeople();
  const peopleView = useViewData("people");
  usePageTitle(null);
  const latest = useMemo(() => {
    if (records === undefined) return [];
    const all = records.bills.flatMap((b, bi) =>
      b.actions.map((a, ai) => ({ bill: b, action: a, seq: bi * 10_000 + ai })),
    );
    return all
      .sort((a, b) => dayKey(b.action.date) - dayKey(a.action.date) || b.seq - a.seq)
      .slice(0, RECENT);
  }, [records]);
  return (
    <Page
      name="home"
      title="Official public records"
      lede={
        <p>
          Bills and votes in Congress, executive actions, campaign finance reports, certified election results
          and district maps. Every entry is published as it stands on the record.
        </p>
      }
    >
      <Search />
      <div className="rec-grid">
        <Section
          title="Congress now"
          aside={
            <NavLink to={{ page: "officials", chamber: "House" }} testId="nav-home-officials">
              Officeholders
            </NavLink>
          }
        >
          {peopleView === undefined ? (
            <Loading what="the chambers" />
          ) : peopleView.chambers.length === 0 ? (
            <Empty>No seats have been filled yet.</Empty>
          ) : (
            peopleView.chambers.map((c) => <MakeUpRow key={c.chamber} row={c} />)
          )}
        </Section>
        <Section
          title="Latest action on bills"
          aside={
            <NavLink
              to={{ page: "bills", filter: { stage: null, chamber: null, subject: "", q: "" } }}
              testId="nav-home-bills"
            >
              All bills
            </NavLink>
          }
        >
          {records === undefined ? (
            <Loading what="the bills" />
          ) : latest.length === 0 ? (
            <Empty>No bill has been introduced.</Empty>
          ) : (
            <ul className="rec-feed" data-testid="home-actions">
              {latest.map((x) => (
                <li key={x.seq}>
                  <time>{formatDay(x.action.date)}</time>
                  <NavLink
                    to={{ page: "bill", id: x.bill.id }}
                    testId={`nav-home-bill-${x.bill.id}-${x.seq}`}
                  >
                    {billLabel(x.bill)} {x.bill.title}
                  </NavLink>
                  <span>{x.action.text}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Recent roll calls">
          {records === undefined ? (
            <Loading what="the roll calls" />
          ) : records.roll_calls.length === 0 ? (
            <Empty>No roll call has been held.</Empty>
          ) : (
            <ul className="rec-feed" data-testid="home-rollcalls">
              {records.roll_calls
                .slice(-RECENT)
                .reverse()
                .map((r) => (
                  <li key={r.id}>
                    <time>{formatDay(r.date)}</time>
                    <NavLink to={{ page: "rollcall", id: r.id }} testId={`nav-home-rollcall-${r.id}`}>
                      {rollLabel(r.id)}
                    </NavLink>
                    <span>
                      {r.chamber}: {r.question}, {r.yeas} to {r.nays}, {r.passed ? "passed" : "failed"}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Section>
        <Section
          title="Executive actions"
          aside={
            <NavLink to={{ page: "exec", kind: null }} testId="nav-home-exec">
              All actions
            </NavLink>
          }
        >
          {records === undefined ? (
            <Loading what="the executive record" />
          ) : records.actions.length === 0 ? (
            <Empty>No executive action is on record.</Empty>
          ) : (
            <ul className="rec-feed" data-testid="home-exec">
              {records.actions
                .slice(-4)
                .reverse()
                .map((a) => (
                  <li key={a.id}>
                    <time>{formatDay(a.date)}</time>
                    <span>{EXEC_LABEL[a.kind]}</span>
                    {a.subject === null ? null : <Person id={a.subject} people={people} />}
                    <span>{a.text}</span>
                  </li>
                ))}
            </ul>
          )}
        </Section>
      </div>
      <Section title="Elsewhere on this site">
        <ul className="rec-links">
          <li>
            <NavLink to={{ page: "finance" }} testId="nav-home-finance">
              Campaign finance reports
            </NavLink>
          </li>
          <li>
            <NavLink to={{ page: "results", cycle: null }} testId="nav-home-results">
              Election results
            </NavLink>
          </li>
          <li>
            <NavLink to={{ page: "districts", state: null }} testId="nav-home-districts">
              House district plans
            </NavLink>
          </li>
        </ul>
      </Section>
    </Page>
  );
}
