// The vector map (D954): province polygons drawn by deck.gl in OrthographicViews over
// pre-projected Miller coordinates (y up). Geometry layers are built once per model; a color
// change goes through updateTriggers, hover and selection through two tiny overlay layers, so none
// of them rebuilds the 3,963-polygon geometry. A click selects a province and opens its page in the
// focused pane, Shift+click in a new pane (D637; links do the same, D454). A province's ordinal here
// is its ProvinceId: both are its id's place in ascending byte order (D4).
//
// Over the polygons (crates/game/src/map; spec 8 Map row): the mode's colors from v_map_layers
// (D700, D702), contested provinces hatched and the Metro outlines, the tiny provinces' dots
// (D640), labels by zoom (D706), the HQ and hub pins (D703), and the map's own UI: the mode bar,
// the legend and the hover card (D704). W A S D pans and Q / E zooms (D636).

import type { Color, PickingInfo } from "@deck.gl/core";
import { OrthographicView } from "@deck.gl/core";
import { PathLayer, PolygonLayer, ScatterplotLayer, SolidPolygonLayer, TextLayer } from "@deck.gl/layers";
import DeckGL from "@deck.gl/react";
import type { MapMode, ProvinceId, ViewName, ZoneId } from "@tc20ff/sim";
import { mapLayersViewLayer, mapLayersViewZoneOf } from "@tc20ff/sim";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useUiConfig } from "../config/hooks.ts";
import { useHoverCards } from "../links/Link.tsx";
import { BUTTON_PRIMARY, clickTarget, useNav } from "../links/nav.ts";
import type { PageRef } from "../pages/ref.ts";
import { usePageViews } from "../pages/views.ts";
import {
  AMBER,
  layerColors,
  PANEL_RAISED,
  politicalColors,
  type Rgb,
  sectorColor,
  TEXT,
  TEXT_MUTED,
} from "./colors.ts";
import { useMapKeys } from "./keys.ts";
import { buildAnchors, fontPx, type LabelKind, type Placed, placeLabels, type Rect } from "./labels.ts";
import { legendDoc } from "./legend.ts";
import { Legend, MapHoverCard, ModeBar } from "./MapOverlays.tsx";
import type { MapModel, ProvincePart, XY } from "./model.ts";
import { DEFAULT_MODE_STATE, type MapModeState, modeKey, setMode } from "./modes.ts";
import { pick, TINY_DOT_PX, tinyTargets } from "./picking.ts";
import { hubLabel, type PlacedPin, pinLayout } from "./pins.ts";
import {
  clampView,
  FRAME_WIDTH,
  initialView,
  type MapViewState,
  panBy,
  provinceLineAlpha,
  spanDeg,
  type Viewport,
  zoomBy,
} from "./view.ts";

const SEA = "#070a10";
const BORDER_COLOR: Color = [4, 6, 10, 120];
const COUNTRY_BORDER_COLOR: Color = [214, 224, 238, 210];
const HOVER_LINE: Color = [255, 255, 255, 230];
const HOVER_FILL: Color = [255, 255, 255, 38];
const SELECT_LINE: Color = [0, 229, 255, 255];
const SELECT_FILL: Color = [0, 229, 255, 46];
/** Contested provinces: magenta over the fill at this alpha (colors.rs hatch; D702). */
const HATCH_FILL: Color = [255, 43, 214, Math.floor(0.35 * 255)];
/** The Metro outlines: amber at 0.9 (D702). */
const METRO_LINE: Color = [255, 176, 0, Math.floor(0.9 * 255)];
/** A pin's rim and a label's shadow (BG and the black text shadow, D703, D706). */
const PIN_RIM: Color = [11, 13, 18, 255];
const LABEL_SHADOW: Color = [0, 0, 0, 230];
const HUB_LABEL_BG: Color = [22, 26, 34, 217];
const LABEL_COLOR: Record<LabelKind, Rgb> = {
  Country: TEXT,
  KeyCity: AMBER,
  Region: TEXT_MUTED,
  Province: TEXT_MUTED,
};
const LABEL_FONT = "'Fira Mono', ui-monospace, monospace";

// The map repeats east to west (D600, D636): the same layers are drawn in three views, the
// centre and copies one map width to each side, sharing the GPU attributes of the layers (nothing
// is re-tessellated).
const COPIES = [-1, 0, 1] as const;
type Copy = (typeof COPIES)[number];
const CONTROLLER = {
  scrollZoom: { speed: 0.004, smooth: true },
  doubleClickZoom: true,
  inertia: 150,
  // W A S D and Q / E are the map's own keys (keys.ts, D636).
  keyboard: false,
};
const viewId = (k: Copy): string => `map${k}`;
const VIEWS = COPIES.map(
  (k) => new OrthographicView({ id: viewId(k), flipY: false, controller: CONTROLLER }),
);
const NO_PARTS: ProvincePart[] = [];

/** The views the map reads (D1016): its layer, the static map, the names; the zone mode adds two. */
const MAP_VIEWS: readonly ViewName[] = ["map_layers", "map_static", "places"];
const ZONE_MAP_VIEWS: readonly ViewName[] = [...MAP_VIEWS, "cycle", "exchanges"];

/** Reads the view state deck hands back, or null if it is not an orthographic one. */
function readView(vs: unknown): MapViewState | null {
  if (typeof vs !== "object" || vs === null) return null;
  const target: unknown = Reflect.get(vs, "target");
  const zoom: unknown = Reflect.get(vs, "zoom");
  if (!Array.isArray(target) || typeof target[0] !== "number" || typeof target[1] !== "number") return null;
  if (typeof zoom !== "number") return null;
  return { target: [target[0], target[1], 0], zoom };
}

/** The province ordinal under a picking result on the fill layer, or null. */
function pickedOrdinal(info: PickingInfo): number | null {
  if (info.layer?.id !== "fill") return null;
  const obj: unknown = info.object;
  if (typeof obj === "object" && obj !== null) {
    const ordinal: unknown = Reflect.get(obj, "ordinal");
    if (typeof ordinal === "number") return ordinal;
  }
  return null;
}

/** The pin under a picking result, or null. */
function pickedPin(info: PickingInfo): PlacedPin | null {
  if (info.layer?.id !== "pins" || info.object === null || info.object === undefined) return null;
  return info.object as PlacedPin;
}

function pinPage(p: PlacedPin): PageRef {
  const t = p.pin.target;
  return t.kind === "Company" ? { kind: "company", id: t.company } : { kind: "exchange", id: t.zone };
}

/** A pin's place: its label point moved by its pixel offset at this zoom (y down on screen, up in Miller). */
function pinPosition(model: MapModel, p: PlacedPin, zoom: number): XY {
  const s = model.shapes[p.pin.province];
  const k = 2 ** zoom;
  return s ? [s.label[0] + p.offset[0] / k, s.label[1] - p.offset[1] / k] : [0, 0];
}

const rgba = (c: Rgb, a = 255): Color => [c[0], c[1], c[2], a];

interface Hover {
  ordinal: number | null;
  /** The pointer in window pixels, for the hover card. */
  x: number;
  y: number;
}

/** A DOM element's rectangle relative to the map's container. */
function rectIn(el: HTMLElement | null, origin: DOMRect): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return [r.left - origin.left, r.top - origin.top, r.right - origin.left, r.bottom - origin.top];
}

export interface ProvinceMapProps {
  model: MapModel;
}

export function ProvinceMap({ model }: ProvinceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<MapViewState | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [pinHovered, setPinHovered] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [modes, setModes] = useState<MapModeState>(DEFAULT_MODE_STATE);
  const [blocked, setBlocked] = useState<Rect[]>([]);
  const { font_scale: fontScale } = useUiConfig();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (size.width === 0 || size.height === 0) return;
    setView((v) => (v ? clampView(v, size.width, size.height) : initialView(size.width, size.height)));
  }, [size]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sizeRef = useRef(size);
  sizeRef.current = size;
  useMapKeys(
    useCallback((dx: number, dy: number) => {
      const { width, height } = sizeRef.current;
      setView((v) => (v ? panBy({ view: v, width, height }, dx, dy) : v));
    }, []),
    useCallback((steps: number) => {
      const { width, height } = sizeRef.current;
      setView((v) => (v ? zoomBy({ view: v, width, height }, steps) : v));
    }, []),
  );

  const zones = modes.mode.kind === "FinancialZones";
  const v = usePageViews(zones ? ZONE_MAP_VIEWS : MAP_VIEWS);
  const mode: MapMode = modes.mode;
  const mk = modeKey(mode);

  // The layer is fetched again only when the mode or a view it reads moves (modes.rs
  // `refresh_layer`): the views' data objects change exactly when their versions do.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `mk` stands for `mode`
  const layer = useMemo(() => {
    if (!v.map_layers) return null;
    const z = zones && v.cycle && v.exchanges ? ([v.cycle, v.exchanges] as const) : null;
    return mapLayersViewLayer(v.map_layers, mode, z);
  }, [v.map_layers, v.cycle, v.exchanges, zones, mk]);

  const colors = useMemo(
    () => (layer ? layerColors(layer, model.rows.length) : politicalColors(model)),
    [layer, model],
  );
  const hatchedParts = useMemo(
    () => (layer ? model.parts.filter((p) => layer.hatched[p.ordinal] === true) : NO_PARTS),
    [layer, model],
  );
  const metroBorders = useMemo(() => {
    const st = v.map_static;
    if (!modes.metros || !st) return [];
    return model.groupBorders((o) => st.provinces[o]?.metro ?? null);
  }, [modes.metros, v.map_static, model]);
  const placedPins = useMemo(
    () => (layer ? pinLayout(layer.pins).filter((p) => model.shapes[p.pin.province]) : []),
    [layer, model],
  );
  const hubs = useMemo(() => placedPins.filter((p) => p.pin.target.kind === "Exchange"), [placedPins]);
  const tiny = useMemo(() => tinyTargets(model), [model]);
  const anchors = useMemo(
    () => (v.map_static && v.places ? buildAnchors(model, v.map_static, v.places) : null),
    [model, v.map_static, v.places],
  );
  const doc = useMemo(() => (layer ? legendDoc(layer, modes.metros) : null), [layer, modes.metros]);

  // The bar and the legend keep labels off them (D706): measured after each change of either.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measured when their content moves
  useLayoutEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const origin = c.getBoundingClientRect();
    const next = [rectIn(barRef.current, origin), rectIn(legendRef.current, origin)].filter(
      (r): r is Rect => r !== null,
    );
    setBlocked((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [doc, modes, size]);

  const placed = useMemo(() => {
    if (!anchors || !view) return [];
    const vp: Viewport = { view, width: size.width, height: size.height };
    return placeLabels(anchors, vp, fontScale, blocked);
  }, [anchors, view, size, fontScale, blocked]);

  // Province lines fade in from Country towards Province zoom (render.rs line_alphas, D636).
  // Opacity is a uniform: the line geometry is not touched. Region lines are not drawn.
  const lineAlpha = view ? provinceLineAlpha(spanDeg(view.zoom, size.width)) : 0;
  // Quantized so a wheel tick re-evaluates the layers only when the opacity visibly changes.
  const lineOpacity = Math.round(lineAlpha * 64) / 64;
  const zoom = view?.zoom ?? 0;

  const layers = useMemo(
    () => [
      new SolidPolygonLayer<ProvincePart>({
        id: "fill",
        data: model.parts,
        getPolygon: (d) => d.polygon,
        getFillColor: (d) => colors.subarray(d.ordinal * 3, d.ordinal * 3 + 3),
        updateTriggers: { getFillColor: colors },
        pickable: true,
      }),
      new SolidPolygonLayer<ProvincePart>({
        id: "hatch",
        data: hatchedParts,
        getPolygon: (d) => d.polygon,
        getFillColor: HATCH_FILL,
        visible: hatchedParts.length > 0,
      }),
      new PathLayer<XY[]>({
        id: "borders",
        data: model.borders,
        getPath: (d) => d,
        getColor: BORDER_COLOR,
        getWidth: 0.6,
        widthUnits: "pixels",
        opacity: lineOpacity,
        visible: lineOpacity > 0,
      }),
      new PathLayer<XY[]>({
        id: "country-borders",
        data: model.countryBorders,
        getPath: (d) => d,
        getColor: COUNTRY_BORDER_COLOR,
        getWidth: 1.6,
        widthUnits: "pixels",
        jointRounded: true,
        capRounded: true,
      }),
      new PathLayer<XY[]>({
        id: "metros",
        data: metroBorders,
        getPath: (d) => d,
        getColor: METRO_LINE,
        getWidth: 1.4,
        widthUnits: "pixels",
        visible: metroBorders.length > 0,
      }),
    ],
    [model, colors, hatchedParts, lineOpacity, metroBorders],
  );

  const overlays = useMemo(() => {
    const highlight = (id: string, ordinal: number | null, line: Color, fill: Color, width: number) =>
      new PolygonLayer<ProvincePart>({
        id,
        data: ordinal === null ? NO_PARTS : (model.partsOf[ordinal] ?? NO_PARTS),
        getPolygon: (d) => d.polygon,
        getFillColor: fill,
        getLineColor: line,
        getLineWidth: width,
        lineWidthUnits: "pixels",
        stroked: true,
        filled: true,
        pickable: false,
      });
    const h = hover?.ordinal ?? null;
    return [
      highlight("hover", h !== null && h !== selected ? h : null, HOVER_LINE, HOVER_FILL, 1.5),
      highlight("selected", selected, SELECT_LINE, SELECT_FILL, 2.5),
    ];
  }, [model, hover?.ordinal, selected]);

  // Dots, labels and pins: over the polygons, pins on top (labels.rs LABEL_Z < pins.rs PIN_Z).
  const marks = useMemo(() => {
    const k = 2 ** zoom;
    const tx = view?.target[0] ?? 0;
    const ty = view?.target[1] ?? 0;
    const { width, height } = size;
    // A placed label's screen centre back in Miller units, unwrapped about the centre view.
    const labelAt = (l: Placed): XY => [tx + (l.at[0] - width / 2) / k, ty - (l.at[1] - height / 2) / k];
    return [
      new ScatterplotLayer<[number, XY]>({
        id: "tiny-dots",
        data: tiny,
        getPosition: (d) => d[1],
        getRadius: TINY_DOT_PX / 2,
        radiusUnits: "pixels",
        stroked: true,
        getFillColor: rgba(PANEL_RAISED),
        getLineColor: rgba(TEXT_MUTED),
        getLineWidth: 1,
        lineWidthUnits: "pixels",
      }),
      new TextLayer<Placed>({
        id: "labels",
        data: placed,
        getPosition: labelAt,
        getText: (d) => d.text,
        getSize: (d) => fontPx(d.kind, fontScale),
        sizeUnits: "pixels",
        getColor: (d) => rgba(LABEL_COLOR[d.kind]),
        fontFamily: LABEL_FONT,
        characterSet: "auto",
        fontSettings: { sdf: true },
        outlineWidth: 2,
        outlineColor: LABEL_SHADOW,
        updateTriggers: { getPosition: [tx, ty, k, width, height], getSize: fontScale },
      }),
      new ScatterplotLayer<PlacedPin>({
        id: "pins",
        data: placedPins,
        getPosition: (d) => pinPosition(model, d, zoom),
        getRadius: (d) => d.diameter / 2,
        radiusUnits: "pixels",
        stroked: true,
        getFillColor: (d) =>
          d.pin.target.kind === "Company" ? rgba(sectorColor(d.pin.category)) : rgba(TEXT),
        getLineColor: PIN_RIM,
        getLineWidth: 1,
        lineWidthUnits: "pixels",
        pickable: true,
        updateTriggers: { getPosition: zoom },
      }),
      new TextLayer<PlacedPin>({
        id: "hub-labels",
        data: hubs,
        getPosition: (d) => pinPosition(model, d, zoom),
        getText: (d) => hubLabel(d.pin),
        getSize: fontPx("Region", fontScale),
        sizeUnits: "pixels",
        getColor: rgba(TEXT),
        getTextAnchor: "start",
        getAlignmentBaseline: "center",
        getPixelOffset: (d) => [d.diameter / 2 + 3, 0],
        background: true,
        getBackgroundColor: HUB_LABEL_BG,
        backgroundPadding: [3, 1],
        fontFamily: LABEL_FONT,
        updateTriggers: { getPosition: zoom },
      }),
    ];
  }, [tiny, placed, placedPins, hubs, model, zoom, view, size, fontScale]);

  const cards = useHoverCards();
  const onHover = useCallback(
    (info: PickingInfo, event: { srcEvent?: { clientX?: number; clientY?: number } }) => {
      const pin = pickedPin(info);
      if (pin) {
        if (!pinHovered)
          cards?.enter(pinPage(pin), event.srcEvent?.clientX ?? 0, event.srcEvent?.clientY ?? 0);
        setPinHovered(true);
        setHover(null);
        return;
      }
      if (pinHovered) {
        cards?.leave();
        setPinHovered(false);
      }
      const { width, height } = sizeRef.current;
      const next =
        view && info.x >= 0
          ? pick({ view, width, height }, [info.x, info.y], pickedOrdinal(info), model, tiny)
          : null;
      const x = event.srcEvent?.clientX ?? 0;
      const y = event.srcEvent?.clientY ?? 0;
      setHover((prev) =>
        prev?.ordinal === next && (next === null || (prev.x === x && prev.y === y))
          ? prev
          : { ordinal: next, x, y },
      );
    },
    [cards, pinHovered, view, model, tiny],
  );

  const nav = useNav();
  const onClick = useCallback(
    (info: PickingInfo, event: { srcEvent?: { shiftKey?: boolean } }) => {
      const target = clickTarget(BUTTON_PRIMARY, event.srcEvent?.shiftKey === true);
      const pin = pickedPin(info);
      if (pin) {
        cards?.hide();
        if (target !== null) nav.open(pinPage(pin), target);
        return;
      }
      const { width, height } = sizeRef.current;
      const picked = view
        ? pick({ view, width, height }, [info.x, info.y], pickedOrdinal(info), model, tiny)
        : null;
      setSelected(picked);
      if (picked !== null && target !== null)
        nav.open({ kind: "province", id: picked as ProvinceId }, target);
    },
    [nav, cards, view, model, tiny],
  );

  const onViewStateChange = useCallback(
    ({ viewId: id, viewState }: { viewId: string; viewState: unknown }) => {
      const next = readView(viewState);
      if (!next) return;
      // a copy reports its own offset target; the centre map is the same x less k map widths
      const k = COPIES.find((c) => viewId(c) === id) ?? 0;
      next.target[0] -= k * FRAME_WIDTH;
      setView(clampView(next, size.width, size.height));
    },
    [size],
  );

  // Each view gets its own state: the target shifted by its copy. All three are always drawn;
  // adding or removing a view while panning left the new copy blank, and the cost is only GPU.
  const viewState = view
    ? Object.fromEntries(
        COPIES.map((k) => [
          viewId(k),
          {
            target: [view.target[0] + k * FRAME_WIDTH, view.target[1], 0] as [number, number, number],
            zoom: view.zoom,
          },
        ]),
      )
    : null;

  const hoverZone: ZoneId | null =
    zones && hover?.ordinal != null && v.map_layers
      ? mapLayersViewZoneOf(v.map_layers, hover.ordinal as ProvinceId)
      : null;

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, background: SEA, overflow: "hidden" }}
      onPointerLeave={() => setHover(null)}
    >
      {viewState && (
        <DeckGL
          views={VIEWS}
          viewState={viewState}
          onViewStateChange={onViewStateChange}
          layers={[...layers, ...overlays, ...marks]}
          onHover={onHover}
          onClick={onClick}
          getCursor={({ isDragging }) =>
            isDragging ? "grabbing" : hover?.ordinal != null || pinHovered ? "pointer" : "grab"
          }
        />
      )}
      <ModeBar
        ref={barRef}
        state={modes}
        layers={v.map_layers}
        places={v.places}
        onMode={(m) => setModes((s) => setMode(s, m))}
        onMetros={(on) => setModes((s) => ({ ...s, metros: on }))}
      />
      {doc && <Legend ref={legendRef} doc={doc} />}
      {hover?.ordinal != null && !pinHovered && (
        <MapHoverCard province={hover.ordinal as ProvinceId} zone={hoverZone} x={hover.x} y={hover.y} />
      )}
    </div>
  );
}
