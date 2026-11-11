// The desktop's wallpaper (pivot 15.2): an orrery that tells the game's time. Three brass rings on
// a verdigris ground, each with a body on an arm: the outer one goes round once a year (its ring is
// marked with the months), the middle one once a month (marked with the days) and the inner one
// once a day (marked with the hours). All of it is drawn here as SVG; there is no image file.
//
// The ground and its colours are in os.css; this file is the geometry.

import { daysInMonth } from "@tc20ff/sim";
import { memo } from "react";
import { useClock } from "../sim/hooks.ts";

/** The drawing's own coordinates; the SVG scales to cover the desktop. */
const VIEW_W = 1600;
const VIEW_H = 900;
/** The orrery's centre: right of the middle, clear of the column of icons. */
const CX = 1040;
const CY = 440;
/** The rings' radii: the day, the month and the year. */
const R_DAY = 130;
const R_MONTH = 235;
const R_YEAR = 350;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const HOURS_PER_DAY = 24;
/** The most days a month's ring is marked with. */
const MONTH_TICKS = 31;

/** A point on a ring: `turn` is the fraction of a full turn, clockwise from the top. */
function at(r: number, turn: number): { x: number; y: number } {
  const a = turn * 2 * Math.PI;
  return { x: CX + r * Math.sin(a), y: CY - r * Math.cos(a) };
}

const n1 = (v: number): string => v.toFixed(1);

/** `count` marks around a ring, every `major`th one longer. */
function ticks(r: number, count: number, major: number): string {
  let d = "";
  for (let i = 0; i < count; i++) {
    const len = i % major === 0 ? 12 : 5;
    const a = at(r, i / count);
    const b = at(r + len, i / count);
    d += `M${n1(a.x)} ${n1(a.y)}L${n1(b.x)} ${n1(b.y)}`;
  }
  return d;
}

/** The parts that never move: drawn once. */
const Rings = memo(function Rings() {
  return (
    <g className="os-wall-rings">
      <circle cx={CX} cy={CY} r={R_DAY} />
      <circle cx={CX} cy={CY} r={R_MONTH} />
      <circle cx={CX} cy={CY} r={R_YEAR} />
      <circle cx={CX} cy={CY} r={R_YEAR + 46} className="os-wall-faint" />
      <path d={ticks(R_DAY, HOURS_PER_DAY, 6)} />
      <path d={ticks(R_MONTH, MONTH_TICKS, MONTH_TICKS)} />
      <path d={ticks(R_YEAR, MONTHS.length * 3, 3)} />
      {MONTHS.map((m, i) => {
        // The name sits in the middle of its month's arc, outside the ring.
        const p = at(R_YEAR + 28, (i + 0.5) / MONTHS.length);
        return (
          <text key={m} x={n1(p.x)} y={n1(p.y)}>
            {m}
          </text>
        );
      })}
    </g>
  );
});

function Arm({ r, turn, size }: { r: number; turn: number; size: number }) {
  const p = at(r, turn);
  return (
    <>
      <line x1={CX} y1={CY} x2={n1(p.x)} y2={n1(p.y)} />
      <circle cx={n1(p.x)} cy={n1(p.y)} r={size} />
    </>
  );
}

function WallpaperInner() {
  const clock = useClock();
  // Before the first frame the arms rest at the top.
  const hour = clock?.hour ?? 0;
  const day = clock?.date.day ?? 1;
  const month = clock?.date.month ?? 1;
  const inMonth = clock ? daysInMonth(clock.date.year, month) : MONTH_TICKS;
  const dayTurn = hour / HOURS_PER_DAY;
  const monthTurn = (day - 1 + dayTurn) / inMonth;
  const yearTurn = (month - 1 + monthTurn) / MONTHS.length;
  return (
    <svg
      className="os-wallpaper"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <Rings />
      <g className="os-wall-arms">
        <Arm r={R_YEAR} turn={yearTurn} size={9} />
        <Arm r={R_MONTH} turn={monthTurn} size={6} />
        <Arm r={R_DAY} turn={dayTurn} size={4} />
        <circle cx={CX} cy={CY} r={14} className="os-wall-hub" />
      </g>
    </svg>
  );
}

export const Wallpaper = memo(WallpaperInner);
