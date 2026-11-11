// Bills and roll calls (pivot 7.1, 7.4, 7.5, 8.6): the bills index, one bill's page with its
// lever changes, history and roll calls, and one roll call's page with every member's vote.

import type { BillRow, BillStage, RollCallRow } from "@tc20ff/sim";
import { useEffect, useMemo, useState } from "react";
import { useSlice, useViewData } from "../../sim/hooks.ts";
import { formatDay, partyAdjective } from "../_shared/index.ts";
import {
  type Col,
  Empty,
  Facts,
  Loading,
  NavLink,
  NotOnRecord,
  Page,
  type People,
  Person,
  Section,
  SortTable,
  useLeverNames,
  useNav,
  usePageTitle,
  usePeople,
  useStates,
} from "./common.tsx";
import {
  billLabel,
  dayKey,
  filterBills,
  leverText,
  partyPlural,
  partyTotals,
  rollLabel,
  STAGE_LABEL,
  seatOf,
  thresholdOf,
  VOTE_KINDS,
  VOTE_LABEL,
  type VoteKind,
} from "./data.ts";
import { BILL_STAGES, type BillFilter, NO_FILTER } from "./route.ts";

/** The stages a bill passes through, in order (pivot 7.1); a failed bill is off the path. */
const PATH: readonly BillStage[] = BILL_STAGES.filter((s) => s !== "Dead");

export function StageBadge({ stage }: { stage: BillStage }) {
  return <span className={`rec-badge rec-stage-${stage.toLowerCase()}`}>{STAGE_LABEL[stage]}</span>;
}

function ResultBadge({ passed }: { passed: boolean }) {
  return (
    <span className={`rec-badge ${passed ? "rec-pass" : "rec-fail"}`}>{passed ? "Passed" : "Failed"}</span>
  );
}

// --- the index --------------------------------------------------------------------------------

export function BillsPage({ filter }: { filter: BillFilter }) {
  const records = useViewData("records");
  const people = usePeople();
  const { replace } = useNav();
  usePageTitle("Bills");
  const [q, setQ] = useState(filter.q);
  // A route change (back, forward) puts its search in the box. A block: an effect returns nothing.
  useEffect(() => {
    setQ(filter.q);
  }, [filter.q]);
  const bills = records?.bills;
  const subjects = useMemo(() => [...new Set((bills ?? []).map((b) => b.subject))].sort(), [bills]);
  const shown = useMemo(
    () => filterBills(bills ?? [], filter, (id) => people?.get(id)?.name ?? ""),
    [bills, filter, people],
  );
  const set = (patch: Partial<BillFilter>) => replace({ page: "bills", filter: { ...filter, ...patch } });
  const cols: Col<BillRow>[] = [
    { id: "no", header: "Number", sort: (b) => b.id, render: (b) => billLabel(b) },
    {
      id: "title",
      header: "Title",
      sort: (b) => b.title,
      render: (b) => (
        <NavLink to={{ page: "bill", id: b.id }} testId={`nav-bill-${b.id}`}>
          {b.title}
        </NavLink>
      ),
    },
    {
      id: "sponsor",
      header: "Sponsor",
      sort: (b) => people?.get(b.sponsor)?.name ?? null,
      render: (b) => <Person id={b.sponsor} people={people} />,
    },
    { id: "subject", header: "Subject", sort: (b) => b.subject, render: (b) => b.subject },
    { id: "origin", header: "Origin", sort: (b) => b.chamber_of_origin, render: (b) => b.chamber_of_origin },
    {
      id: "stage",
      header: "Status",
      sort: (b) => PATH.indexOf(b.stage) + (b.stage === "Dead" ? 100 : 0),
      render: (b) => <StageBadge stage={b.stage} />,
    },
    {
      id: "last",
      header: "Last action",
      sort: (b) => dayKey(b.last_action),
      render: (b) => formatDay(b.last_action),
    },
  ];
  const filtered =
    filter.stage !== null || filter.chamber !== null || filter.subject !== "" || filter.q !== "";
  return (
    <Page
      name="bills"
      kicker="Legislation"
      title="Bills"
      lede="Every bill before the Congress, with its sponsor, its status and its full history."
    >
      <form className="rec-filters" onSubmit={(e) => e.preventDefault()}>
        <label>
          Search
          <input
            type="search"
            data-testid="bills-search"
            value={q}
            placeholder="Title, sponsor, subject, number"
            onChange={(e) => {
              setQ(e.target.value);
              set({ q: e.target.value });
            }}
          />
        </label>
        <label>
          Status
          <select
            data-testid="bills-stage"
            value={filter.stage ?? ""}
            onChange={(e) => set({ stage: BILL_STAGES.find((s) => s === e.target.value) ?? null })}
          >
            <option value="">Any</option>
            {BILL_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Chamber
          <select
            data-testid="bills-chamber"
            value={filter.chamber ?? ""}
            onChange={(e) =>
              set({
                chamber: e.target.value === "House" || e.target.value === "Senate" ? e.target.value : null,
              })
            }
          >
            <option value="">Either</option>
            <option value="House">House</option>
            <option value="Senate">Senate</option>
          </select>
        </label>
        <label>
          Subject
          <select
            data-testid="bills-subject"
            value={filter.subject}
            onChange={(e) => set({ subject: e.target.value })}
          >
            <option value="">Any</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {filtered ? (
          <button
            type="button"
            className="rec-button"
            data-testid="bills-clear"
            onClick={() => {
              setQ("");
              replace({ page: "bills", filter: NO_FILTER });
            }}
          >
            Clear
          </button>
        ) : null}
      </form>
      {bills === undefined ? (
        <Loading what="the bills" />
      ) : shown.length === 0 ? (
        <Empty>
          {bills.length === 0 ? "No bills have been introduced." : "No bill matches these filters."}
        </Empty>
      ) : (
        <>
          <p className="rec-count" data-testid="bills-count">
            {shown.length === bills.length
              ? `${bills.length} bills`
              : `${shown.length} of ${bills.length} bills`}
          </p>
          <SortTable
            table="bills"
            rows={shown}
            cols={cols}
            rowKey={(b) => b.id}
            rowKind="bill"
            initial={{ id: "last", desc: true }}
            caption="Bills"
          />
        </>
      )}
    </Page>
  );
}

// --- one bill ---------------------------------------------------------------------------------

/** A roll call's party totals, read from its votes slice: mounted only while a card shows it. */
function PartyTotals({ id, people }: { id: number; people: People | undefined }) {
  const key = useMemo(() => ({ view: "records", slice: "votes", roll_call: id }) as const, [id]);
  const votes = useSlice(key);
  if (votes === undefined) return <p className="rec-muted">Loading the vote by party...</p>;
  if (votes === null) return <p className="rec-muted">The vote by member is not on record.</p>;
  const rows = partyTotals(votes.votes, (p) => people?.get(p)?.party);
  return (
    <table className="rec-table rec-mini" data-testid={`rollcall-parties-${id}`}>
      <thead>
        <tr>
          <th scope="col">Party</th>
          <th scope="col" className="num">
            Yea
          </th>
          <th scope="col" className="num">
            Nay
          </th>
          <th scope="col" className="num">
            Not voting
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.party ?? "independent"}>
            <th scope="row">{partyPlural(r.party)}</th>
            <td className="num">{r.Yea}</td>
            <td className="num">{r.Nay}</td>
            <td className="num">{r.NotVoting}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RollCallCard({ rc, people }: { rc: RollCallRow; people: People | undefined }) {
  return (
    <li className="rec-card" data-testid={`rollcall-card-${rc.id}`}>
      <div className="rec-card-head">
        <NavLink to={{ page: "rollcall", id: rc.id }} testId={`nav-rollcall-${rc.id}`}>
          {rollLabel(rc.id)}
        </NavLink>
        <span>
          {rc.chamber}, {formatDay(rc.date)}
        </span>
        <ResultBadge passed={rc.passed} />
      </div>
      <p>
        {rc.question}: {rc.yeas} yeas, {rc.nays} nays.
      </p>
      <PartyTotals id={rc.id} people={people} />
    </li>
  );
}

export function BillPage({ id }: { id: number }) {
  const records = useViewData("records");
  const people = usePeople();
  const names = useLeverNames();
  const bill = records?.bills.find((b) => b.id === id);
  usePageTitle(bill === undefined ? null : `${billLabel(bill)} ${bill.title}`);
  if (records === undefined) return <Loading what="the bill" />;
  if (bill === undefined) return <NotOnRecord what={`Bill ${id + 1}`} hint="Bills are numbered from 1." />;
  const calls = records.roll_calls.filter((r) => r.bill === bill.id);
  const dead = bill.stage === "Dead";
  const at = PATH.indexOf(bill.stage);
  return (
    <Page
      name="bill"
      kicker={`${billLabel(bill)}, ${bill.subject}`}
      title={bill.title}
      lede={<p>{bill.summary}</p>}
    >
      <Facts
        items={[
          ["Status", <StageBadge key="s" stage={bill.stage} />],
          ["Sponsor", <Person key="p" id={bill.sponsor} people={people} />],
          ["Introduced in", `the ${bill.chamber_of_origin}, ${formatDay(bill.introduced)}`],
          ["Last action", formatDay(bill.last_action)],
          ...(bill.effective === null
            ? []
            : ([["Takes effect", formatDay(bill.effective)]] as [string, string][])),
        ]}
      />
      <Section title="Progress">
        <ol className="rec-path" data-testid="bill-path">
          {PATH.map((s, i) => (
            <li
              key={s}
              className={
                dead ? "rec-step" : i < at ? "rec-step done" : i === at ? "rec-step now" : "rec-step"
              }
              aria-current={!dead && i === at ? "step" : undefined}
            >
              {STAGE_LABEL[s]}
            </li>
          ))}
        </ol>
        {dead ? <p className="rec-note">This bill failed and cannot move further.</p> : null}
      </Section>
      <Section title={bill.stage === "Law" ? "Changes made by this law" : "Changes this bill would make"}>
        {bill.changes.length === 0 ? (
          <Empty>This bill does not change any economic lever.</Empty>
        ) : (
          <ul className="rec-changes" data-testid="bill-changes">
            {bill.changes.map((c, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a bill's changes are a fixed list
              <li key={i}>{leverText(c, names)}</li>
            ))}
          </ul>
        )}
        {bill.effective !== null && bill.stage === "Law" ? (
          <p className="rec-note">The changes take effect on {formatDay(bill.effective)}.</p>
        ) : null}
      </Section>
      <Section title="History">
        <ol className="rec-timeline" data-testid="bill-actions">
          {bill.actions.map((a, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: actions are in order and never reordered
            <li key={i} data-testid={`bill-action-${i}`}>
              <time>{formatDay(a.date)}</time>
              <span className="rec-where">{a.chamber ?? "-"}</span>
              <span>{a.text}</span>
              {a.roll_call === null ? null : (
                <NavLink
                  to={{ page: "rollcall", id: a.roll_call }}
                  testId={`nav-action-rollcall-${a.roll_call}`}
                >
                  {rollLabel(a.roll_call)}
                </NavLink>
              )}
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Roll calls">
        {calls.length === 0 ? (
          <Empty>No roll call has been held on this bill.</Empty>
        ) : (
          <ul className="rec-cards" data-testid="bill-rollcalls">
            {calls.map((rc) => (
              <RollCallCard key={rc.id} rc={rc} people={people} />
            ))}
          </ul>
        )}
      </Section>
    </Page>
  );
}

// --- one roll call ----------------------------------------------------------------------------

interface VoteLine {
  person: number;
  vote: VoteKind;
}

export function RollCallPage({ id }: { id: number }) {
  const records = useViewData("records");
  const people = usePeople();
  const states = useStates();
  const key = useMemo(() => ({ view: "records", slice: "votes", roll_call: id }) as const, [id]);
  const votes = useSlice(key);
  const rc = records?.roll_calls.find((r) => r.id === id);
  const bill = rc === undefined ? undefined : records?.bills.find((b) => b.id === rc.bill);
  const [only, setOnly] = useState<VoteKind | "">("");
  const [find, setFind] = useState("");
  usePageTitle(rc === undefined ? null : rollLabel(rc.id));
  if (records === undefined) return <Loading what="the roll call" />;
  if (rc === undefined) return <NotOnRecord what={`Roll call ${id + 1}`} />;
  const rule = thresholdOf(rc);
  const nv = votes ? votes.votes.filter((v) => v.vote === "NotVoting").length : null;
  const seat = (p: number) => {
    const row = people?.get(p);
    return row === undefined || states === undefined ? null : seatOf(row, states.list);
  };
  const stateName = (p: number): string => {
    const s = seat(p);
    if (s !== null) return states?.name(s.state) ?? "";
    const row = people?.get(p);
    return row === undefined || states === undefined ? "" : states.name(row.home_state);
  };
  const lines: VoteLine[] = (votes?.votes ?? []).filter((v) => {
    if (only !== "" && v.vote !== only) return false;
    const name = people?.get(v.person)?.name ?? "";
    return find.trim() === "" || name.toLowerCase().includes(find.trim().toLowerCase());
  });
  const cols: Col<VoteLine>[] = [
    {
      id: "member",
      header: "Member",
      sort: (v) => people?.get(v.person)?.name ?? null,
      render: (v) => <Person id={v.person} people={people} />,
    },
    {
      id: "party",
      header: "Party",
      sort: (v) => people?.get(v.person)?.party ?? "Z",
      render: (v) => partyAdjective(people?.get(v.person)?.party ?? null),
    },
    { id: "state", header: "State", sort: (v) => stateName(v.person), render: (v) => stateName(v.person) },
    {
      id: "vote",
      header: "Vote",
      sort: (v) => VOTE_KINDS.indexOf(v.vote),
      render: (v) => (
        <span className={`rec-vote rec-vote-${v.vote.toLowerCase()}`}>{VOTE_LABEL[v.vote]}</span>
      ),
    },
  ];
  return (
    <Page
      name="rollcall"
      kicker={`${rc.chamber}, ${formatDay(rc.date)}`}
      title={`${rollLabel(rc.id)}: ${rc.question}`}
      lede={
        <p>
          On{" "}
          {bill === undefined ? (
            "a bill not on record"
          ) : (
            <NavLink to={{ page: "bill", id: bill.id }} testId={`nav-bill-${bill.id}`}>
              {billLabel(bill)} {bill.title}
            </NavLink>
          )}
          .
        </p>
      }
    >
      <Facts
        items={[
          ["Result", <ResultBadge key="r" passed={rc.passed} />],
          ["Yeas", String(rc.yeas)],
          ["Nays", String(rc.nays)],
          ...(nv === null ? [] : ([["Not voting", String(nv)]] as [string, string][])),
          ["Required", rule.text],
        ]}
      />
      {rule.needed === null ? null : (
        <p className="rec-note" data-testid="rollcall-threshold">
          {rc.yeas} yeas against {rule.needed} needed: the question {rc.passed ? "passed" : "failed"}.
        </p>
      )}
      <Section title="By party">
        {votes === undefined ? (
          <Loading what="the vote by party" />
        ) : votes === null ? (
          <Empty>The vote by member is not on record.</Empty>
        ) : (
          <PartyTotals id={rc.id} people={people} />
        )}
      </Section>
      <Section
        title="How each member voted"
        aside={
          votes ? (
            <span data-testid="rollcall-shown">
              {lines.length} of {votes.votes.length}
            </span>
          ) : null
        }
      >
        {votes === undefined ? (
          <Loading what="the votes" />
        ) : votes === null ? (
          <Empty>No vote by member is on record for this roll call.</Empty>
        ) : (
          <>
            <form className="rec-filters" onSubmit={(e) => e.preventDefault()}>
              <label>
                Member
                <input
                  type="search"
                  data-testid="rollcall-find"
                  value={find}
                  onChange={(e) => setFind(e.target.value)}
                  placeholder="Name"
                />
              </label>
              <label>
                Vote
                <select
                  data-testid="rollcall-only"
                  value={only}
                  onChange={(e) => setOnly(VOTE_KINDS.find((k) => k === e.target.value) ?? "")}
                >
                  <option value="">All</option>
                  {VOTE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {VOTE_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
            </form>
            <SortTable
              table="votes"
              rows={lines}
              cols={cols}
              rowKey={(v) => v.person}
              rowKind="vote"
              initial={{ id: "member", desc: false }}
              caption="Votes by member"
            />
          </>
        )}
      </Section>
    </Page>
  );
}
