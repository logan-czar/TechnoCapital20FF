// The vector map (D954): province polygons drawn by deck.gl in OrthographicViews over
// pre-projected Miller coordinates (y up). Geometry layers are built once per model; a color
// change goes through updateTriggers, hover and selection through two tiny overlay layers, so none
// of them rebuilds the 3,963-polygon geometry.

import type { Color, PickingInfo } from "@deck.gl/core";
import { OrthographicView } from "@deck.gl/core";
import { PathLayer, PolygonLayer, SolidPolygonLayer } from "@deck.gl/layers";
import DeckGL from "@deck.gl/react";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { politicalColors } from "./colors.ts";
import type { MapModel, ProvincePart, XY } from "./model.ts";
import {
  clampView,
  FRAME_WIDTH,
  initialView,
  type MapViewState,
  provinceLineAlpha,
  spanDeg,
} from "./view.ts";

const SEA = "#070a10";
const BORDER_COLOR: Color = [4, 6, 10, 120];
const COUNTRY_BORDER_COLOR: Color = [214, 224, 238, 210];
const HOVER_LINE: Color = [255, 255, 255, 230];
const HOVER_FILL: Color = [255, 255, 255, 38];
const SELECT_LINE: Color = [0, 229, 255, 255];
const SELECT_FILL: Color = [0, 229, 255, 46];

// The map repeats east to west (D600, D636): the same layers are drawn in three views, the
// centre and copies one map width to each side, sharing the GPU attributes of the layers (nothing
// is re-tessellated).
const COPIES = [-1, 0, 1] as const;
type Copy = (typeof COPIES)[number];
const CONTROLLER = { scrollZoom: { speed: 0.004, smooth: true }, doubleClickZoom: true, inertia: 150 };
const viewId = (k: Copy): string => `map${k}`;
const VIEWS = COPIES.map(
  (k) => new OrthographicView({ id: viewId(k), flipY: false, controller: CONTROLLER }),
);
const NO_PARTS: ProvincePart[] = [];

/** Reads the view state deck hands back, or null if it is not an orthographic one. */
function readView(vs: unknown): MapViewState | null {
  if (typeof vs !== "object" || vs === null) return null;
  const target: unknown = Reflect.get(vs, "target");
  const zoom: unknown = Reflect.get(vs, "zoom");
  if (!Array.isArray(target) || typeof target[0] !== "number" || typeof target[1] !== "number") return null;
  if (typeof zoom !== "number") return null;
  return { target: [target[0], target[1], 0], zoom };
}

/** The province ordinal under a picking result, or null over the sea. */
function pickedOrdinal(info: PickingInfo): number | null {
  const obj: unknown = info.object;
  if (typeof obj === "object" && obj !== null) {
    const ordinal: unknown = Reflect.get(obj, "ordinal");
    if (typeof ordinal === "number") return ordinal;
  }
  return null;
}

export interface ProvinceMapProps {
  model: MapModel;
}

export function ProvinceMap({ model }: ProvinceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<MapViewState | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

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

  // One map mode for now (Political); a later mode swaps this array, which bumps the trigger.
  const colors = useMemo(() => politicalColors(model), [model]);

  // Province lines fade in from Country towards Province zoom (render.rs line_alphas, D636).
  // Opacity is a uniform: the line geometry is not touched. Region lines are not drawn.
  const lineAlpha = view ? provinceLineAlpha(spanDeg(view.zoom, size.width)) : 0;
  // Quantized so a wheel tick re-evaluates the layers only when the opacity visibly changes.
  const lineOpacity = Math.round(lineAlpha * 64) / 64;

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
    ],
    [model, colors, lineOpacity],
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
    return [
      highlight("hover", hover !== null && hover !== selected ? hover : null, HOVER_LINE, HOVER_FILL, 1.5),
      highlight("selected", selected, SELECT_LINE, SELECT_FILL, 2.5),
    ];
  }, [model, hover, selected]);

  const onHover = useCallback((info: PickingInfo) => {
    const next = pickedOrdinal(info);
    setHover((prev) => (prev === next ? prev : next));
  }, []);

  const onClick = useCallback((info: PickingInfo) => {
    setSelected(pickedOrdinal(info));
  }, []);

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
  const row = selected === null ? null : model.rows[selected];

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0, background: SEA }}>
      {viewState && (
        <DeckGL
          views={VIEWS}
          viewState={viewState}
          onViewStateChange={onViewStateChange}
          layers={[...layers, ...overlays]}
          onHover={onHover}
          onClick={onClick}
          getCursor={({ isDragging }) => (isDragging ? "grabbing" : hover !== null ? "pointer" : "grab")}
        />
      )}
      {row && (
        <div style={card}>
          <div style={{ color: "#00e5ff", fontSize: 11, letterSpacing: 1 }}>{row.id}</div>
          <div style={{ fontSize: 16, fontWeight: 600, margin: "2px 0" }}>{row.name}</div>
          <div style={{ color: "#9aa7b8" }}>{row.country}</div>
        </div>
      )}
    </div>
  );
}

const card: CSSProperties = {
  position: "absolute",
  top: 16,
  left: 16,
  minWidth: 180,
  padding: "10px 14px",
  background: "rgba(10, 14, 22, 0.92)",
  border: "1px solid #1d2a3a",
  borderRadius: 4,
  color: "#e6edf5",
  font: "13px system-ui, sans-serif",
  pointerEvents: "none",
};
