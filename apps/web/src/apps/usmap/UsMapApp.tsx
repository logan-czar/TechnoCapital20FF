// The USA map, "Plat & Tally" (pivot 5.1, 5.4, 9.2, 9.3, 15.3; D1048): states, counties and House
// districts, coloured by a layer (the last presidential vote, people, turnout, the House as held,
// the true lean when Omniscient, live returns), with a hover card, a side panel for the county,
// district or state selected, and on election night a race's count by county.
//
// Reads v_usmap_layers (the county columns), v_districts (the plan: district borders and split
// counties), and while their parts are on screen v_races, v_people, v_returns with its `counties`
// slice for the race shown, and v_feed for the outlets' names. The shapes are the county topology
// (./data.ts); a county set the topology does not hold (the mock's invented counties) is drawn on
// the schematic (./geometry.ts).

import "./usmap.css";
import type { Party, UsMapCounties } from "@tc20ff/sim";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppProps } from "../../os/apps.ts";
import { useViewData } from "../../sim/hooks.ts";
import { formatMargin, formatPct, partyAdjective } from "../_shared/index.ts";
import { bordersBetween, outlineOf, planIndex, stateBorders } from "./borders.ts";
import { useBaseGeometry } from "./data.ts";
import { bindGeometry, boundsOf, type XY } from "./geometry.ts";
import { type LiveInfo, LiveLayer } from "./Live.tsx";
import {
  formatInt,
  LAYER_NAMES,
  layerChoices,
  leaderOf,
  paintDistricts,
  paintLean,
  paintPopulation,
  paintPresident,
  paintTurnout,
} from "./layers.ts";
import type { MapLabel } from "./MapCanvas.tsx";
import { districtTitle, partyOf, peopleById, stateRow } from "./names.ts";
import { Panel } from "./Panel.tsx";
import {
  countyOfKey,
  formatRoute,
  type LayerId,
  type MapRoute,
  parseRoute,
  type Selection,
} from "./route.ts";

const MapCanvas = lazy(() => import("./MapCanvas.tsx"));

/** WebGL2 is what deck.gl draws with; without it (the DOM tests) the map says so and the rest works. */
export function canDrawMap(): boolean {
  return typeof window !== "undefined" && typeof window.WebGL2RenderingContext !== "undefined";
}

/** In-app back and forward over the routes this window has shown. */
function useHistory(route: string | null, onRoute: (r: string | null) => void) {
  const h = useRef<{ stack: (string | null)[]; at: number }>({ stack: [route], at: 0 });
  const [, bump] = useState(0);
  // A route set from outside (a link, a restore) joins the history.
  if (h.current.stack[h.current.at] !== route) {
    h.current.stack = [...h.current.stack.slice(0, h.current.at + 1), route];
    h.current.at = h.current.stack.length - 1;
  }
  const go = useCallback(
    (step: number) => {
      const at = h.current.at + step;
      if (at < 0 || at >= h.current.stack.length) return;
      h.current.at = at;
      bump((x) => x + 1);
      onRoute(h.current.stack[at] ?? null);
    },
    [onRoute],
  );
  return {
    back: () => go(-1),
    forward: () => go(1),
    canBack: h.current.at > 0,
    canForward: h.current.at < h.current.stack.length - 1,
  };
}

/** The House layer: subscribes to v_people only while it is shown. */
function DistrictsPainter(p: {
  district: Int32Array;
  districts: ReturnType<typeof useViewData<"districts">>;
  colours: Uint8Array;
  onPainted: () => void;
  onParty: (f: (id: number) => Party | null | undefined) => void;
}) {
  const people = useViewData("people");
  const { district, districts, colours, onPainted, onParty } = p;
  useEffect(() => {
    const byId = peopleById(people);
    const member = new Map((districts?.districts ?? []).map((d) => [d.id, d.member]));
    const party = (id: number) => {
      if (!member.has(id)) return undefined;
      const m = member.get(id) ?? null;
      return m === null ? null : partyOf(byId, m);
    };
    paintDistricts(colours, district, party);
    onParty(party);
    onPainted();
  }, [people, districts, district, colours, onPainted, onParty]);
  return null;
}

/** The legend of a layer. */
function Legend({ layer, counties }: { layer: LayerId; counties: UsMapCounties }) {
  const empty = layer === "president" && counties.last_winner.every((w) => w === null);
  const ramp = (cls: string, lo: string, hi: string) => (
    <div className="um-legend-ramp">
      <span>{lo}</span>
      <i className={cls} />
      <span>{hi}</span>
    </div>
  );
  return (
    <div className="um-legend" data-testid="usmap-legend">
      {layer === "president" &&
        (empty ? (
          <p data-testid="usmap-no-results">
            No certified presidential vote yet. Counties fill in when one is certified.
          </p>
        ) : (
          ramp("um-ramp-margin", "R+40", "D+40")
        ))}
      {layer === "lean" && ramp("um-ramp-margin", "R+40", "D+40")}
      {layer === "population" && ramp("um-ramp-pop", "1K", "5M people")}
      {layer === "turnout" && ramp("um-ramp-turnout", "25%", "60% vote")}
      {layer === "districts" && (
        <p>
          <span className="um-dot party-a" /> Democratic <span className="um-dot party-b" /> Republican{" "}
          <span className="um-dot um-dot-none" /> Vacant or unknown
        </p>
      )}
      {layer === "live" && <p>Leader's colour, deeper with the lead; fainter where less is reported.</p>}
      <p className="um-legend-note">
        <span className="um-marker" /> County split between districts
      </p>
    </div>
  );
}

interface Hover {
  county: number;
  x: number;
  y: number;
}

export default function UsMapApp({ route, onRoute, setTitle }: AppProps) {
  const r = useMemo(() => parseRoute(route), [route]);
  const hist = useHistory(route, onRoute);
  const go = useCallback((next: MapRoute) => onRoute(formatRoute(next)), [onRoute]);

  const layers = useViewData("usmap_layers");
  const districts = useViewData("districts");
  const base = useBaseGeometry();
  const choices = useMemo(() => layerChoices(layers), [layers]);
  // A hidden layer named by a route (the lean without Omniscient) falls back to the default.
  const layer: LayerId = choices.includes(r.layer) ? r.layer : "president";

  const fips = layers?.counties.fips;
  // The geometry is rebound only when the county set changes, not when the view is rebuilt.
  const fipsKey = useMemo(() => (fips ? `${fips.length}:${fips.join("")}` : ""), [fips]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `fipsKey` stands for `fips`
  const geometry = useMemo(
    () => (base.state === "ready" && fips ? bindGeometry(base.value, fips) : null),
    [base, fipsKey],
  );
  const count = geometry?.count ?? 0;
  const stateOf = layers?.counties.state;

  const plan = useMemo(() => planIndex(districts, count), [districts, count]);
  const sameState = useCallback((a: number, b: number) => stateOf?.[a] === stateOf?.[b], [stateOf]);
  // The district borders of the plan in force: re-derived only when the plan (v_districts) moves.
  const districtLines = useMemo(
    () => (geometry ? bordersBetween(geometry.edges, plan.district, sameState) : []),
    [geometry, plan, sameState],
  );
  const stateLines = useMemo(
    () => (geometry && stateOf ? stateBorders(geometry.edges, stateOf) : []),
    [geometry, stateOf],
  );
  const countyLines = useMemo(
    () =>
      geometry && stateOf
        ? geometry.edges.filter((e) => e.b >= 0 && stateOf[e.a] === stateOf[e.b]).map((e) => e.path)
        : [],
    [geometry, stateOf],
  );
  const markers = useMemo(
    () => (geometry ? plan.split.map((c) => geometry.centroid[c] as XY) : []),
    [geometry, plan],
  );
  const labels = useMemo((): MapLabel[] => {
    if (!geometry || !layers) return [];
    return layers.states.flatMap((st) => {
      let x = 0;
      let y = 0;
      let n = 0;
      layers.counties.state.forEach((s, i) => {
        if (s !== st.id || i >= geometry.count) return;
        const c = geometry.centroid[i] as XY;
        x += c[0];
        y += c[1];
        n++;
      });
      return n > 0 ? [{ text: st.name, at: [x / n, y / n] as XY }] : [];
    });
  }, [geometry, layers]);

  // The colours: one RGBA buffer, painted in place by the layer; the version tells deck to re-read it.
  const colours = useMemo(() => new Uint8Array(Math.max(1, count) * 4), [count]);
  const [colourVersion, setColourVersion] = useState(0);
  const painted = useCallback(() => setColourVersion((v) => v + 1), []);
  useEffect(() => {
    if (!layers || count === 0 || count !== layers.counties.fips.length) return;
    const c = layers.counties;
    if (layer === "president") paintPresident(colours, c);
    else if (layer === "population") paintPopulation(colours, c);
    else if (layer === "turnout") paintTurnout(colours, c);
    else if (layer === "lean") paintLean(colours, c);
    else return;
    painted();
  }, [layers, layer, colours, count, painted]);

  const [live, setLive] = useState<LiveInfo | null>(null);
  const [districtParty, setDistrictParty] = useState<{ f: (id: number) => Party | null | undefined } | null>(
    null,
  );
  const onParty = useCallback((f: (id: number) => Party | null | undefined) => setDistrictParty({ f }), []);
  const liveRace = layer === "live" ? (r.race ?? 0) : null;
  const returns = useViewData("returns");
  const liveRaces = useMemo(() => new Set((returns?.races ?? []).map((x) => x.race as number)), [returns]);

  // The selection.
  const sel = r.sel;
  const selCounty = sel?.kind === "county" && fips ? countyOfKey(sel.key, fips) : -1;
  const selSet = useMemo((): number[] | null => {
    if (!sel || !layers) return null;
    if (sel.kind === "county") return selCounty >= 0 ? [selCounty] : [];
    if (sel.kind === "district") return plan.counties.get(sel.id) ?? [];
    return layers.counties.state.flatMap((s, i) => (s === sel.id ? [i] : []));
  }, [sel, selCounty, layers, plan]);
  const area = selSet ?? (layer === "live" ? (live?.area ?? null) : null);
  const outline = useMemo(() => {
    if (!geometry || area === null || sel?.kind === "county") return [];
    const set = new Set(area);
    return outlineOf(geometry.edges, (c) => set.has(c));
  }, [geometry, area, sel?.kind]);
  const focus = useMemo(() => {
    const whole: [number, number, number, number] = [0, 0, geometry?.width ?? 975, geometry?.height ?? 610];
    if (!geometry || area === null) return { box: whole, key: "whole" };
    const box = boundsOf(geometry, area);
    return box ? { box, key: `${formatRoute({ ...r, layer })}` } : { box: whole, key: "whole" };
  }, [geometry, area, r, layer]);

  const selTitle =
    !sel || !layers
      ? null
      : sel.kind === "county"
        ? selCounty >= 0
          ? `${layers.counties.name[selCounty]}, ${stateRow(layers, layers.counties.state[selCounty] as number)?.name ?? ""}`
          : null
        : sel.kind === "district"
          ? districtTitle(layers, sel.id)
          : (stateRow(layers, sel.id)?.name ?? null);
  useEffect(() => {
    const t = layer === "live" && live?.race ? live.race.title : selTitle;
    setTitle(t === null ? null : `${t} - USA map`);
  }, [setTitle, selTitle, layer, live?.race]);
  useEffect(() => () => setTitle(null), [setTitle]);

  const [hover, setHover] = useState<Hover | null>(null);
  const onHover = useCallback((county: number | null, x: number, y: number) => {
    setHover((h) =>
      county === null ? null : h?.county === county && h.x === x && h.y === y ? h : { county, x, y },
    );
  }, []);
  const select = useCallback((s: Selection | null) => go({ ...r, layer, sel: s }), [go, r, layer]);
  const onPick = useCallback(
    (county: number | null) => {
      if (county === null || !fips) return select(null);
      // A click on the county selected goes up to its district, then to its state.
      if (sel?.kind === "county" && selCounty === county) {
        const d = plan.district[county] ?? -1;
        if (d >= 0) return select({ kind: "district", id: d });
      }
      select({ kind: "county", key: fips[county] ?? String(county) });
    },
    [fips, select, sel, selCounty, plan],
  );

  const wrap = useRef<HTMLDivElement>(null);
  const setLayer = (l: LayerId) =>
    go(l === "live" ? { layer: l, race: r.race ?? 0, sel: null } : { layer: l, race: null, sel });

  let stage: React.ReactNode;
  if (!layers)
    stage = (
      <p className="um-state" data-testid="usmap-loading">
        Waiting for the map from the sim.
      </p>
    );
  else if (base.state === "loading")
    stage = <p className="um-state">Drawing {formatInt(layers.counties.fips.length)} counties.</p>;
  else if (base.state === "error")
    stage = (
      <p className="um-state um-error" data-testid="usmap-error">
        The county shapes did not load ({base.message}). Close and reopen the map to try again.
      </p>
    );
  else if (!geometry) stage = null;
  else if (!canDrawMap())
    stage = (
      <p className="um-state" data-testid="usmap-no-webgl">
        This window cannot draw the map: WebGL2 is not available. The panels still work.
      </p>
    );
  else
    stage = (
      <Suspense fallback={<p className="um-state">Opening the map.</p>}>
        <MapCanvas
          geometry={geometry}
          colours={colours}
          colourVersion={colourVersion}
          countyLines={countyLines}
          districtLines={districtLines}
          stateLines={stateLines}
          outline={outline}
          markers={markers}
          labels={labels}
          hover={hover?.county ?? null}
          selected={selCounty >= 0 ? selCounty : null}
          focus={focus}
          onHover={onHover}
          onPick={onPick}
        />
      </Suspense>
    );

  return (
    <div className="um-root" data-testid="app-root-usmap">
      <header className="um-mast">
        <div className="um-brand">
          <span className="um-wordmark">Plat &amp; Tally</span>
          <span className="um-tag">
            {geometry?.kind === "schematic" ? "schematic counties" : "county atlas"}
          </span>
        </div>
        <nav className="um-nav" aria-label="History">
          <button
            type="button"
            onClick={hist.back}
            disabled={!hist.canBack}
            aria-label="Back"
            data-testid="usmap-back"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={hist.forward}
            disabled={!hist.canForward}
            aria-label="Forward"
            data-testid="usmap-forward"
          >
            ›
          </button>
        </nav>
        <div className="um-layers" role="tablist" aria-label="Layer">
          {choices.map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={l === layer}
              className={l === layer ? "um-tab um-tab-on" : "um-tab"}
              data-testid={`usmap-layer-${l}`}
              onClick={() => setLayer(l)}
            >
              {LAYER_NAMES[l]}
            </button>
          ))}
        </div>
      </header>
      <div className="um-body">
        <div className="um-stage" ref={wrap} onPointerLeave={() => setHover(null)}>
          {stage}
          {layers && geometry && <Legend layer={layer} counties={layers.counties} />}
          {hover && layers && geometry && (
            <HoverCard
              hover={hover}
              wrap={wrap.current}
              layers={layers}
              layer={layer}
              plan={plan}
              live={live}
              districtParty={districtParty?.f ?? null}
            />
          )}
        </div>
        {sel && layers && (
          <Panel
            sel={sel}
            county={selCounty}
            layers={layers}
            districts={districts}
            plan={plan}
            onSelect={select}
            onLive={(race) => go({ layer: "live", race, sel })}
            onClose={() => select(null)}
            liveRaces={liveRaces}
          />
        )}
      </div>
      {layer === "live" && layers && geometry && (
        <LiveLayer
          race={liveRace}
          layers={layers}
          plan={plan}
          colours={colours}
          onPainted={painted}
          onInfo={setLive}
          onRace={(race) => go({ layer: "live", race, sel: null })}
          onState={(id) => go({ layer: "live", race: liveRace, sel: { kind: "state", id } })}
        />
      )}
      {layer === "districts" && geometry && (
        <DistrictsPainter
          district={plan.district}
          districts={districts}
          colours={colours}
          onPainted={painted}
          onParty={onParty}
        />
      )}
    </div>
  );
}

function HoverCard(p: {
  hover: Hover;
  wrap: HTMLDivElement | null;
  layers: NonNullable<ReturnType<typeof useViewData<"usmap_layers">>>;
  layer: LayerId;
  plan: ReturnType<typeof planIndex>;
  live: LiveInfo | null;
  districtParty: ((id: number) => Party | null | undefined) | null;
}) {
  const i = p.hover.county;
  const c = p.layers.counties;
  const st = stateRow(p.layers, c.state[i] as number);
  const pieces = p.plan.pieces[i] ?? [];
  const lines: React.ReactNode[] = [];
  if (p.layer === "president") {
    const w = c.last_winner[i] ?? null;
    const m = c.last_margin[i] ?? null;
    lines.push(
      w === null || m === null
        ? "No certified presidential vote"
        : `President: ${partyAdjective(w)}, ${formatMargin(m)}`,
    );
  } else if (p.layer === "turnout") lines.push(`Turnout ${formatPct(c.turnout[i] ?? 0)}`);
  else if (p.layer === "lean" && c.lean !== null) lines.push(`True lean ${formatMargin(c.lean[i] ?? 0)}`);
  else if (p.layer === "districts") {
    const d = p.plan.district[i] ?? -1;
    const party = d >= 0 ? p.districtParty?.(d) : undefined;
    lines.push(
      d < 0
        ? "No district"
        : `${districtTitle(p.layers, d)}${party === undefined ? "" : `: ${partyAdjective(party)}${party === null ? " or vacant" : ""}`}`,
    );
  } else if (p.layer === "live") {
    const k = p.live?.counts[i] ?? null;
    if (k === null) lines.push("Not in this race");
    else {
      const l = leaderOf(k.votes);
      lines.push(`${formatPct(k.reporting)} reported`);
      if (l !== null)
        k.votes.forEach((v, j) => {
          if (v > 0 && j < 3)
            lines.push(`${p.live?.names[j] ?? `#${j}`}: ${formatInt(v)} (${formatPct(v / l.total)})`);
        });
    }
  }
  const box = p.wrap?.getBoundingClientRect();
  const x = p.hover.x - (box?.left ?? 0) + 14;
  const y = p.hover.y - (box?.top ?? 0) + 14;
  return (
    <div className="um-hover" style={{ left: x, top: y }} data-testid="usmap-hover" role="tooltip">
      <p className="um-hover-name">
        {c.name[i]}
        <span>{st?.name}</span>
      </p>
      <p>{formatInt(c.population[i] ?? 0)} people</p>
      {lines.map((l, k) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the lines are positional
        <p key={k}>{l}</p>
      ))}
      {pieces.length > 1 && (
        <ul className="um-hover-split">
          {pieces.map((x) => (
            <li key={x.district}>
              {districtTitle(p.layers, x.district)} {formatPct(x.share)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
