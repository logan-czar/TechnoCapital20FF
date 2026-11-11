// The map's canvas (pivot 15.3; D1048): deck.gl in one OrthographicView over the Albers plane (y
// down). The county polygons are tessellated once per geometry; their colours come from the typed
// array the app paints, re-read through `updateTriggers` when its version moves, so a colour change
// (election night's waves) re-uploads one colour buffer and nothing else. Borders are path layers
// over the precomputed edge filters; hover and selection are two tiny overlay layers.
//
// Loaded lazily, and only where WebGL2 exists (the DOM tests have none).

import type { Color, PickingInfo } from "@deck.gl/core";
import { OrthographicView } from "@deck.gl/core";
import { PathLayer, PolygonLayer, ScatterplotLayer, SolidPolygonLayer, TextLayer } from "@deck.gl/layers";
import DeckGL from "@deck.gl/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapGeometry, Part, XY } from "./geometry.ts";

const COUNTY_LINE: Color = [10, 14, 22, 150];
const DISTRICT_LINE: Color = [239, 230, 207, 235];
const STATE_LINE: Color = [242, 193, 78, 255];
const BACKDROP_LINE: Color = [120, 132, 150, 110];
const OUTLINE: Color = [242, 193, 78, 255];
const HOVER_LINE: Color = [255, 255, 255, 230];
const HOVER_FILL: Color = [255, 255, 255, 40];
const SELECT_FILL: Color = [242, 193, 78, 50];
const MARKER_FILL: Color = [22, 29, 43, 230];
const MARKER_LINE: Color = [239, 230, 207, 255];
const LABEL_COLOR: Color = [239, 230, 207, 235];
const LABEL_HALO: Color = [10, 14, 22, 240];
// The map pane's label face (map/ProvinceMap.tsx): its SDF atlas renders thin glyphs cleanly at
// small sizes, where the app's display face dropped strokes.
const LABEL_FONT = "'Fira Mono', ui-monospace, monospace";
/** The view's zoom range, in powers of two over the fitted map. */
const MIN_ZOOM_BELOW_FIT = 1;
const MAX_ZOOM_ABOVE_FIT = 7;
/** Room left round a box the map zooms to, as a share of it. */
const FIT_PAD = 0.12;
const NO_PARTS: Part[] = [];

export interface MapLabel {
  text: string;
  at: XY;
}

export interface MapCanvasProps {
  geometry: MapGeometry;
  /** RGBA a county, painted by the layer. */
  colours: Uint8Array;
  colourVersion: number;
  countyLines: XY[][];
  districtLines: XY[][];
  stateLines: XY[][];
  outline: XY[][];
  markers: XY[];
  labels: MapLabel[];
  hover: number | null;
  selected: number | null;
  /** Fit the view to this box whenever `key` changes. */
  focus: { box: [number, number, number, number]; key: string };
  onHover: (county: number | null, x: number, y: number) => void;
  onPick: (county: number | null) => void;
}

interface ViewState {
  target: [number, number, number];
  zoom: number;
  minZoom: number;
  maxZoom: number;
}

/** The zoom that shows `box` (with its pad) in a w by h canvas. */
function fitZoom(box: [number, number, number, number], w: number, h: number): number {
  const bw = Math.max(1, box[2] - box[0]) * (1 + 2 * FIT_PAD);
  const bh = Math.max(1, box[3] - box[1]) * (1 + 2 * FIT_PAD);
  return Math.log2(Math.max(1e-6, Math.min(w / bw, h / bh)));
}

function fit(box: [number, number, number, number], w: number, h: number, base: number): ViewState {
  const zoom = fitZoom(box, w, h);
  return {
    target: [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2, 0],
    zoom: Math.max(base - MIN_ZOOM_BELOW_FIT, Math.min(base + MAX_ZOOM_ABOVE_FIT, zoom)),
    minZoom: base - MIN_ZOOM_BELOW_FIT,
    maxZoom: base + MAX_ZOOM_ABOVE_FIT,
  };
}

const VIEW = new OrthographicView({
  id: "usmap",
  controller: {
    scrollZoom: { speed: 0.01, smooth: true },
    doubleClickZoom: true,
    keyboard: true,
    inertia: 120,
  },
});

function pickedCounty(info: PickingInfo): number | null {
  const obj: unknown = info.object;
  if (info.layer?.id !== "counties" || typeof obj !== "object" || obj === null) return null;
  const c: unknown = Reflect.get(obj, "county");
  return typeof c === "number" ? c : null;
}

export default function MapCanvas(p: MapCanvasProps) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<ViewState | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const whole: [number, number, number, number] = useMemo(
    () => [0, 0, p.geometry.width, p.geometry.height],
    [p.geometry],
  );
  // The zoom that fits the whole plane: the floor and ceiling are set from it.
  const base = size.width > 0 ? fitZoom(whole, size.width, size.height) : 0;

  // biome-ignore lint/correctness/useExhaustiveDependencies: refit on a new focus or a resize only
  useEffect(() => {
    if (size.width === 0 || size.height === 0) return;
    const b = fitZoom(whole, size.width, size.height);
    setView(fit(p.focus.box, size.width, size.height, b));
  }, [p.focus.key, size.width, size.height]);

  // A colour update is timed from its paint (UsMapApp) to the frame that shows it.
  const shown = useRef(p.colourVersion);
  const onAfterRender = useCallback(() => {
    if (shown.current === p.colourVersion) return;
    shown.current = p.colourVersion;
    try {
      if (performance.getEntriesByName("usmap:paint", "mark").length > 0) {
        performance.measure("usmap:colour-update", "usmap:paint");
        performance.clearMarks("usmap:paint");
      }
    } catch {
      // No user timing (old engines): nothing to record.
    }
  }, [p.colourVersion]);

  const { colours, colourVersion } = p;
  const fill = useMemo(
    () =>
      new SolidPolygonLayer<Part>({
        id: "counties",
        data: p.geometry.parts,
        getPolygon: (d) => d.polygon,
        getFillColor: (d) => colours.subarray(d.county * 4, d.county * 4 + 4) as unknown as Color,
        updateTriggers: { getFillColor: colourVersion },
        pickable: true,
      }),
    [p.geometry, colours, colourVersion],
  );
  const zoomAbove = view ? view.zoom - base : 0;
  // County lines fade in as the map zooms past the fitted view (a uniform: no geometry is touched).
  const countyAlpha = Math.max(0, Math.min(1, (zoomAbove + 0.2) / 1.4));
  const lines = useMemo(
    () => [
      new PathLayer<XY[]>({
        id: "backdrop",
        data: p.geometry.backdrop,
        getPath: (d) => d,
        getColor: BACKDROP_LINE,
        getWidth: 0.8,
        widthUnits: "pixels",
        visible: p.geometry.backdrop.length > 0,
      }),
      new PathLayer<XY[]>({
        id: "county-lines",
        data: p.countyLines,
        getPath: (d) => d,
        getColor: COUNTY_LINE,
        getWidth: 0.6,
        widthUnits: "pixels",
        opacity: Math.round(countyAlpha * 16) / 16,
        visible: countyAlpha > 0,
      }),
      new PathLayer<XY[]>({
        id: "district-lines",
        data: p.districtLines,
        getPath: (d) => d,
        getColor: DISTRICT_LINE,
        getWidth: 1.8,
        widthUnits: "pixels",
        jointRounded: true,
      }),
      new PathLayer<XY[]>({
        id: "state-lines",
        data: p.stateLines,
        getPath: (d) => d,
        getColor: STATE_LINE,
        getWidth: 1.3,
        widthUnits: "pixels",
        jointRounded: true,
        opacity: 0.75,
      }),
    ],
    [p.geometry, p.countyLines, p.districtLines, p.stateLines, countyAlpha],
  );
  const overlays = useMemo(() => {
    const parts = (i: number | null) => (i === null ? NO_PARTS : (p.geometry.partsOf[i] ?? NO_PARTS));
    return [
      new ScatterplotLayer<XY>({
        id: "split-markers",
        data: p.markers,
        getPosition: (d) => d,
        getRadius: 3.2,
        radiusUnits: "pixels",
        stroked: true,
        getFillColor: MARKER_FILL,
        getLineColor: MARKER_LINE,
        getLineWidth: 1.2,
        lineWidthUnits: "pixels",
        visible: p.markers.length > 0,
      }),
      new PolygonLayer<Part>({
        id: "selected",
        data: parts(p.selected),
        getPolygon: (d) => d.polygon,
        getFillColor: SELECT_FILL,
        getLineColor: OUTLINE,
        getLineWidth: 2,
        lineWidthUnits: "pixels",
        stroked: true,
      }),
      new PathLayer<XY[]>({
        id: "outline",
        data: p.outline,
        getPath: (d) => d,
        getColor: OUTLINE,
        getWidth: 2.6,
        widthUnits: "pixels",
        jointRounded: true,
        capRounded: true,
      }),
      new PolygonLayer<Part>({
        id: "hover",
        data: p.hover === p.selected ? NO_PARTS : parts(p.hover),
        getPolygon: (d) => d.polygon,
        getFillColor: HOVER_FILL,
        getLineColor: HOVER_LINE,
        getLineWidth: 1.4,
        lineWidthUnits: "pixels",
        stroked: true,
      }),
      new TextLayer<MapLabel>({
        id: "labels",
        data: p.labels,
        getPosition: (d) => d.at,
        getText: (d) => d.text,
        getSize: 12,
        sizeUnits: "pixels",
        getColor: LABEL_COLOR,
        fontFamily: LABEL_FONT,
        characterSet: "auto",
        fontSettings: { sdf: true },
        outlineWidth: 3,
        outlineColor: LABEL_HALO,
      }),
    ];
  }, [p.geometry, p.markers, p.selected, p.hover, p.outline, p.labels]);

  const { onHover: hoverCb, onPick } = p;
  const onHover = useCallback(
    (info: PickingInfo, e: { srcEvent?: { clientX?: number; clientY?: number } }) =>
      hoverCb(pickedCounty(info), e.srcEvent?.clientX ?? 0, e.srcEvent?.clientY ?? 0),
    [hoverCb],
  );
  const onClick = useCallback((info: PickingInfo) => onPick(pickedCounty(info)), [onPick]);

  return (
    <div ref={box} className="um-canvas" data-testid="usmap-canvas">
      {view && size.width > 0 && (
        <DeckGL
          views={VIEW}
          viewState={view}
          onViewStateChange={({ viewState }) => {
            const vs = viewState as Partial<ViewState>;
            if (Array.isArray(vs.target) && typeof vs.zoom === "number")
              setView((v) =>
                v ? { ...v, target: vs.target as ViewState["target"], zoom: vs.zoom as number } : v,
              );
          }}
          layers={[fill, ...lines, ...overlays]}
          onHover={onHover}
          onClick={onClick}
          onAfterRender={onAfterRender}
          getCursor={({ isDragging }) => (isDragging ? "grabbing" : p.hover !== null ? "pointer" : "grab")}
        />
      )}
    </div>
  );
}
