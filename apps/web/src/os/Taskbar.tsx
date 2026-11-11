// The taskbar (pivot 15.2, 2.2): the launcher, a button per open window, and the clock cluster that
// took over the old top bar's job: the game date and hour, pause and resume, step one hour, and the
// speeds. Keys, as before: Space pauses or resumes and 1 to 6 set the speed (and resume, D8); new
// here, the full stop steps one hour. A key typed into a field or a dialog is not a shortcut.

import { MAX_SPEED, QUARTER_PHASE_NAME, WATCH_SPEED, weekdayShortName } from "@tc20ff/sim";
import { type Dispatch, memo, useCallback, useEffect, useRef, useState } from "react";
import { useClock, useSim } from "../sim/hooks.ts";
import { date as fmtDate } from "../widgets/cells.ts";
import type { AppSpec } from "./apps.ts";
import { Icon } from "./icons.tsx";
import { useUnread } from "./phone/Phone.tsx";
import type { Win, WmAction } from "./wm.ts";

/** The desktop's name, on the launcher. */
export const OS_NAME = "Orrery";
/** Game hours one press of Step runs (pivot 2.2 "step one hour"). */
export const STEP_HOURS = 1;

const SPEEDS: readonly number[] = Array.from({ length: MAX_SPEED }, (_, i) => i + 1);

/** A key press aimed at something the player is typing in or a dialog: not a game shortcut. */
function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return (
    t.tagName === "INPUT" ||
    t.tagName === "TEXTAREA" ||
    t.tagName === "SELECT" ||
    t.isContentEditable ||
    t.closest("[role=dialog]") !== null
  );
}

/** The game clock and its controls (pivot 2.2). */
function ClockCluster() {
  const sim = useSim();
  const clock = useClock();
  const paused = clock?.paused ?? true;
  const speed = clock?.selected_speed ?? 1;

  const toggle = useCallback(() => {
    void sim.control(paused ? { kind: "Resume" } : { kind: "Pause" });
  }, [sim, paused]);
  const step = useCallback(() => void sim.control({ kind: "Step", hours: STEP_HOURS }), [sim]);
  const setSpeed = useCallback((n: number) => void sim.control({ kind: "SetSpeed", speed: n }), [sim]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || isTypingTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Space on a focused button activates that button; it is not also the pause key.
      if (e.code === "Space") {
        if (e.target instanceof HTMLElement && e.target.closest("button, a, summary")) return;
        e.preventDefault();
        toggle();
      } else if (e.key === ".") {
        step();
      } else if (e.key >= "1" && e.key <= String(MAX_SPEED)) {
        setSpeed(Number(e.key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, step, setSpeed]);

  const running = clock?.skipping ? "Skipping ahead" : paused ? "Paused" : `Running at speed ${speed}`;
  return (
    <div className="os-clock-cluster" data-paused={paused}>
      <button
        type="button"
        className="os-tb-button os-tb-step"
        data-testid="tb-step"
        title="Step one hour (.)"
        aria-label="Step one hour"
        onClick={step}
      >
        <Icon name="step" size={18} />
      </button>
      <button
        type="button"
        className={paused ? "os-tb-button os-tb-pause on" : "os-tb-button os-tb-pause"}
        data-testid="tb-pause"
        title={paused ? "Resume (Space)" : "Pause (Space)"}
        aria-label={paused ? "Resume" : "Pause"}
        aria-pressed={paused}
        onClick={toggle}
      >
        <Icon name={paused ? "play" : "pause"} size={18} />
      </button>
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would bring its own frame; the group is named */}
      <div className="os-speeds" role="group" aria-label="Speed">
        {SPEEDS.map((n) => (
          <button
            type="button"
            key={n}
            className={speed === n ? (paused ? "os-speed picked" : "os-speed picked on") : "os-speed"}
            data-testid={`tb-speed-${n}`}
            aria-pressed={speed === n}
            title={
              n === MAX_SPEED
                ? "As fast as it runs"
                : n === WATCH_SPEED
                  ? "About a game year a minute"
                  : `Speed ${n}`
            }
            onClick={() => setSpeed(n)}
          >
            {n === MAX_SPEED ? "Max" : n}
          </button>
        ))}
      </div>
      <div
        className="os-clock"
        data-testid="tb-clock"
        title={
          clock
            ? `${running}. ${QUARTER_PHASE_NAME[clock.quarter_phase]}: ${clock.days_to_next_phase} days to ${QUARTER_PHASE_NAME[clock.next_phase].toLowerCase()}.`
            : "Waiting for the clock"
        }
      >
        <span className="os-clock-hour">{clock ? `${String(clock.hour).padStart(2, "0")}:00` : "--:--"}</span>
        <span className="os-clock-date">
          {clock ? `${weekdayShortName(clock.weekday)} ${fmtDate(clock.date)}` : "No date yet"}
        </span>
      </div>
    </div>
  );
}

/**
 * The Omniscient toggle (spec 1; the old top bar's): every true value instead of the estimate
 * bands, and the debug-only apps on the desktop (pivot 15.3). Only on the dev server, whose sim is
 * a debug sim (D961, D1014); a production build has neither.
 */
function OmniscientToggle() {
  const sim = useSim();
  const on = useClock()?.omniscient ?? false;
  if (!import.meta.env.DEV) return null;
  return (
    <button
      type="button"
      className={on ? "os-tb-text on" : "os-tb-text"}
      data-testid="tb-omniscient"
      aria-pressed={on}
      title="Dev server only: show every true value and the debug apps"
      onClick={() => void sim.control({ kind: "SetOmniscient", on: !on })}
    >
      Omniscient
    </button>
  );
}

/** The launcher: every app the desktop lists, opened with one press. */
function Launcher({ apps, onOpen }: { apps: readonly AppSpec[]; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Node && root.current?.contains(e.target))) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="os-launcher" ref={root}>
      <button
        type="button"
        className={open ? "os-launcher-button on" : "os-launcher-button"}
        data-testid="tb-launcher"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="orrery" size={20} />
        <span>{OS_NAME}</span>
      </button>
      {open && (
        <div className="os-launcher-menu" role="menu" aria-label="Apps">
          {apps.length === 0 && <p className="os-dim">No apps are installed.</p>}
          {apps.map((spec) => (
            <button
              type="button"
              role="menuitem"
              key={spec.id}
              data-testid={`launch-${spec.id}`}
              onClick={() => {
                setOpen(false);
                onOpen(spec.id);
              }}
            >
              <Icon name={spec.icon} size={18} />
              <span>{spec.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface TaskbarProps {
  /** The apps the launcher lists. */
  apps: readonly AppSpec[];
  /** The open windows, in the order they were opened. */
  windows: readonly Win[];
  /** An app's spec by id. */
  specOf: (app: string) => AppSpec | undefined;
  focused: string | null;
  dispatch: Dispatch<WmAction>;
  onOpenApp: (id: string) => void;
  phoneOpen: boolean;
  /** The last notice the player has seen on the phone (its number in the store). */
  seen: number;
  onTogglePhone: () => void;
}

function TaskbarInner({
  apps,
  windows,
  specOf,
  focused,
  dispatch,
  onOpenApp,
  phoneOpen,
  seen,
  onTogglePhone,
}: TaskbarProps) {
  const unread = useUnread(seen);
  return (
    <footer className="os-taskbar" data-testid="taskbar">
      <Launcher apps={apps} onOpen={onOpenApp} />
      <nav className="os-tasks" aria-label="Open windows">
        {windows.map((w) => {
          const spec = specOf(w.app);
          if (!spec) return null;
          return (
            <button
              type="button"
              key={w.id}
              className="os-task"
              data-testid={`tb-win-${w.id}`}
              data-focused={focused === w.id}
              data-state={w.state}
              title={w.state === "minimised" ? `Bring back ${spec.title}` : spec.title}
              onClick={() => dispatch({ kind: "toggle", id: w.id })}
            >
              <Icon name={spec.icon} size={16} />
              <span>{spec.title}</span>
            </button>
          );
        })}
      </nav>
      <OmniscientToggle />
      <ClockCluster />
      <button
        type="button"
        className={phoneOpen ? "os-tb-phone on" : "os-tb-phone"}
        data-testid="tb-phone"
        aria-pressed={phoneOpen}
        title={phoneOpen ? "Put the phone down" : "Pick up the phone"}
        aria-label={unread > 0 ? `Phone, ${unread} new` : "Phone"}
        onClick={onTogglePhone}
      >
        <Icon name="phone" size={20} />
        {unread > 0 && <span className="os-badge">{unread}</span>}
      </button>
    </footer>
  );
}

export const Taskbar = memo(TaskbarInner);
