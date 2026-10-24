// The vector map (D954): province polygons drawn by deck.gl in an OrthographicView over
// pre-projected Miller coordinates (y up). Geometry layers are built once per model; a color
// change goes through updateTriggers, hover and selection through two tiny overlay layers, so none
// of them rebuilds the 3,963-polygon geometry.

import type { Color, PickingInfo } from "@deck.gl/core";
import { OrthographicView } from "@deck.gl/core";
import { PathLayer, PolygonLayer, SolidPolygonLayer } from "@deck.gl/layers";
import DeckGL from "@deck.gl/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { politicalColors } from "./colors.ts";
import type { MapModel, ProvincePart } from "./model.ts";
import { clampView, initialView, type MapViewState } from "./view.ts";

const SEA = "#070a10";
const BORDER_COLOR: Color = [4, 6, 10, 120];
const COUNTRY_BORDER_COLOR: Color = [214, 224, 238, 210];
const HOVER_LINE: Color = [255, 255, 255, 230];
const HOVER_FILL: Color = [255, 255, 255, 38];
const SELECT_LINE: Color = [0, 229, 255, 255];
const SELECT_FILL: Color = [0, 229, 255, 46];

const VIEW = new OrthographicView({ id: "map", flipY: false });
const CONTROLLER = { scrollZoom: { speed: 0.004, smooth: true }, doubleClickZoom: true, inertia: 150 };
const NO_PARTS: ProvincePart[] = [];

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

  const layers = useMemo(
    () => [
      new SolidPolygonLayer<ProvincePart>({
        id: "fill",
        data: model.parts,
        getPolygon: (d) => d.polygon as never,
        getFillColor: (d) => colors.subarray(d.ordinal * 3, d.ordinal * 3 + 3) as unknown as Color,
        updateTriggers: { getFillColor: colors },
        pickable: true,
      }),
      new PathLayer<number[][]>({
        id: "borders",
        data: model.borders as number[][][],
        getPath: (d) => d as unknown as [number, number][],
        getColor: BORDER_COLOR,
        getWidth: 0.6,
        widthUnits: "pixels",
      }),
      new PathLayer<number[][]>({
        id: "country-borders",
        data: model.countryBorders as number[][][],
        getPath: (d) => d as unknown as [number, number][],
        getColor: COUNTRY_BORDER_COLOR,
        getWidth: 1.6,
        widthUnits: "pixels",
        jointRounded: true,
        capRounded: true,
      }),
    ],
    [model, colors],
  );

  const overlays = useMemo(() => {
    const highlight = (id: string, ordinal: number | null, line: Color, fill: Color, width: number) =>
      new PolygonLayer<ProvincePart>({
        id,
        data: ordinal === null ? NO_PARTS : (model.partsOf[ordinal] ?? NO_PARTS),
        getPolygon: (d) => d.polygon as never,
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
    const part = info.object as ProvincePart | null | undefined;
    const next = part ? part.ordinal : null;
    setHover((prev) => (prev === next ? prev : next));
  }, []);

  const onClick = useCallback((info: PickingInfo) => {
    const part = info.object as ProvincePart | null | undefined;
    setSelected(part ? part.ordinal : null);
  }, []);

  const onViewStateChange = useCallback(
    ({ viewState }: { viewState: Record<string, unknown> }) => {
      setView(clampView(viewState as unknown as MapViewState, size.width, size.height));
    },
    [size],
  );

  const row = selected === null ? null : model.rows[selected];

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0, background: SEA }}>
      {view && (
        <DeckGL
          views={VIEW}
          viewState={view}
          onViewStateChange={onViewStateChange as never}
          controller={CONTROLLER}
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

const card: React.CSSProperties = {
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
