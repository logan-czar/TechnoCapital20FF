// The map's own UI over the deck canvas (crates/game/src/map/modes.rs and card.rs; D700, D702,
// D704): the mode bar (top left: the five modes and the Metros toggle, then the mode's parameter),
// the legend (bottom left) and the province hover card beside the pointer. They stop pointer
// events from reaching the map under them, except the hover card, which lets the pointer through.

import type { DevTrack, MapLayersView, MapMode, PlacesView, ProvinceId, ZoneId } from "@tc20ff/sim";
import { DEV_TRACK_VALUES, mapModeName } from "@tc20ff/sim";
import { type CSSProperties, forwardRef, type ReactNode } from "react";
import { CARD_VIEWS, card, zoneHoverCard } from "../links/cards.ts";
import { CardView } from "../links/Link.tsx";
import { useNameIndex } from "../links/names.ts";
import type { PageRef } from "../pages/ref.ts";
import { usePageViews } from "../pages/views.ts";
import type { Rgb } from "./colors.ts";
import type { LegendDoc } from "./legend.ts";
import {
  hqCountries,
  listedLabel,
  type MapModeState,
  MODE_KINDS,
  modeOf,
  nextListed,
  stepIn,
  stepIndustry,
} from "./modes.ts";

/** The bar's and the legend's distance from the map's edges, px. */
export const MAP_UI_INSET = 8;
/** The legend's width, px. */
export const LEGEND_W = 270;
/** The hover card's width and its gap from the pointer, px (D704). */
export const MAP_CARD_W = 300;
export const MAP_CARD_GAP = 18;
/** The hover card's height guess before it is measured, px. */
export const MAP_CARD_H = 360;

/** Pointer events on the map's UI stay there: no pan, no pick, no hover under the bar. */
const shield = {
  onPointerDown: (e: { stopPropagation: () => void }) => e.stopPropagation(),
  onPointerMove: (e: { stopPropagation: () => void }) => e.stopPropagation(),
  onWheel: (e: { stopPropagation: () => void }) => e.stopPropagation(),
};

function Btn({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`map-btn${active ? " active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function Cycler({ label, value, step }: { label: string; value: string; step: (d: number) => void }) {
  return (
    <div className="map-row">
      <span className="map-caption">{label}</span>
      <Btn onClick={() => step(-1)}>{"<"}</Btn>
      <span className="map-caption">{value}</span>
      <Btn onClick={() => step(1)}>{">"}</Btn>
    </div>
  );
}

export interface ModeBarProps {
  state: MapModeState;
  layers: MapLayersView | undefined;
  places: PlacesView | undefined;
  onMode: (m: MapMode) => void;
  onMetros: (on: boolean) => void;
}

/** The mode bar (D700): modes and Metros, then the mode's parameter. */
export const ModeBar = forwardRef<HTMLDivElement, ModeBarProps>(function ModeBar(
  { state, layers, places, onMode, onMetros },
  ref,
) {
  const kind = state.mode.kind;
  const industries = layers?.industry_names.length ?? 0;
  const industryName = (i: number) => layers?.industry_names[i] ?? `Industry #${i}`;
  const countryName = (c: number) => places?.countries[c]?.name ?? `Country #${c}`;
  const m = state.mode;
  return (
    <div ref={ref} className="map-bar" style={{ left: MAP_UI_INSET, top: MAP_UI_INSET }} {...shield}>
      <div className="map-col">
        {MODE_KINDS.map((k) => (
          <Btn key={k} active={k === kind} onClick={() => onMode(modeOf(state, k))}>
            {mapModeName(modeOf(state, k))}
          </Btn>
        ))}
        <Btn active={state.metros} onClick={() => onMetros(!state.metros)}>
          Metros
        </Btn>
      </div>
      <div className="map-col">
        {m.kind === "Development" &&
          DEV_TRACK_VALUES.map((t: DevTrack) => (
            <Btn key={t} active={t === m.track} onClick={() => onMode({ kind: "Development", track: t })}>
              {t}
            </Btn>
          ))}
        {m.kind === "Industry" && (
          <Cycler
            label="Show"
            value={m.industry === null ? "Industry track" : industryName(m.industry)}
            step={(d) => onMode({ kind: "Industry", industry: stepIndustry(m.industry, d, industries) })}
          />
        )}
        {m.kind === "CompanyHqs" && (
          <>
            <Cycler
              label="Industry"
              value={m.filter.industry === null ? "All" : industryName(m.filter.industry)}
              step={(d) =>
                onMode({
                  kind: "CompanyHqs",
                  filter: { ...m.filter, industry: stepIndustry(m.filter.industry, d, industries) },
                })
              }
            />
            <Cycler
              label="Country"
              value={m.filter.country === null ? "All" : countryName(m.filter.country)}
              step={(d) =>
                onMode({
                  kind: "CompanyHqs",
                  filter: {
                    ...m.filter,
                    country: stepIn(m.filter.country, d, layers ? hqCountries(layers) : []),
                  },
                })
              }
            />
            <Btn
              active={m.filter.listed !== null}
              onClick={() =>
                onMode({ kind: "CompanyHqs", filter: { ...m.filter, listed: nextListed(m.filter.listed) } })
              }
            >
              {listedLabel(m.filter.listed)}
            </Btn>
          </>
        )}
      </div>
    </div>
  );
});

const swatch = (c: Rgb): CSSProperties => ({ background: `rgb(${c[0]}, ${c[1]}, ${c[2]})` });

/** The legend (D702): what `legendDoc` says, as the leak test reads it (D705). */
export const Legend = forwardRef<HTMLDivElement, { doc: LegendDoc }>(function Legend({ doc }, ref) {
  return (
    <div
      ref={ref}
      className="map-legend"
      style={{ left: MAP_UI_INSET, bottom: MAP_UI_INSET, width: LEGEND_W }}
      {...shield}
    >
      <div className="small">{doc.title}</div>
      {doc.rows.map(([c, text], i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: legend rows have no identity but their place
        <div key={i} className="map-legend-row">
          {c && <span className="map-swatch" style={swatch(c)} />}
          <span className="muted small">{text}</span>
        </div>
      ))}
    </div>
  );
});

export interface HoverCardProps {
  province: ProvinceId;
  /** In the Financial zones mode, the province's zone: the zone card instead (D704). */
  zone: ZoneId | null;
  /** The pointer, in window pixels. */
  x: number;
  y: number;
}

/** The hover card beside the pointer (D704): the province's card, or its zone's in Financial zones. */
export function MapHoverCard({ province, zone, x, y }: HoverCardProps) {
  const v = usePageViews(zone === null ? CARD_VIEWS : ZONE_CARD_VIEWS);
  const index = useNameIndex();
  const page: PageRef = zone === null ? { kind: "province", id: province } : { kind: "zone", id: zone };
  const c = zone === null ? card(page, v, index) : zoneHoverCard(zone, province, v, index);
  const w = window.innerWidth;
  const h = window.innerHeight;
  const left =
    x + MAP_CARD_GAP + MAP_CARD_W > w ? Math.max(0, x - MAP_CARD_GAP - MAP_CARD_W) : x + MAP_CARD_GAP;
  const top = Math.max(0, Math.min(y + MAP_CARD_GAP, h - MAP_CARD_H));
  return (
    <div className="hover-card map-hover-card" style={{ left, top, width: MAP_CARD_W }}>
      <CardView card={c} page={page} />
    </div>
  );
}

/** The views the zone hover card reads. */
export const ZONE_CARD_VIEWS = ["cycle", "zones", "exchanges", "places", "countries"] as const;
