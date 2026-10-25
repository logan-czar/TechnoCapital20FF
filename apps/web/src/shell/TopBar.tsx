// The top bar (ui/top_bar.rs; spec 8 main screen and time controls rows): the quarter clock, the
// date and hour, pause, speeds 1 to 5 (5 is max), the Skip menu, the alerts indicator and the
// command bar button. Keys: Space pauses or resumes, 1 to 5 set the speed (and resume, D8).

import { MAX_SPEED, QUARTER_PHASE_NAME, type SkipKind, weekdayShortName } from "@tc20ff/sim";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useClock, useNotices, useSim } from "../sim/hooks.ts";
import { date as fmtDate } from "../widgets/cells.ts";
import { SKIPS, skipName } from "./text.ts";

const SPEEDS = [1, 2, 3, 4, 5] as const;

function Clock() {
  const clock = useClock();
  if (!clock) return <div className="clock" />;
  return (
    <div className="clock">
      <span className="date">
        {weekdayShortName(clock.weekday)} {fmtDate(clock.date)} {String(clock.hour).padStart(2, "0")}:00
      </span>
      <span className="phase">
        {QUARTER_PHASE_NAME[clock.quarter_phase]}: {clock.days_to_next_phase}d to{" "}
        {QUARTER_PHASE_NAME[clock.next_phase]}
      </span>
    </div>
  );
}

function SpeedControls() {
  const sim = useSim();
  const clock = useClock();
  const paused = clock?.paused ?? true;
  const speed = clock?.selected_speed ?? 1;
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => {
    void sim.control(paused ? { kind: "Resume" } : { kind: "Pause" });
  }, [sim, paused]);
  const setSpeed = useCallback((n: number) => void sim.control({ kind: "SetSpeed", speed: n }), [sim]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" || t.tagName === "SELECT" || t.isContentEditable)
      )
        return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.key >= "1" && e.key <= String(MAX_SPEED)) {
        setSpeed(Number(e.key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, setSpeed]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <>
      <div className="group">
        <button type="button" onClick={toggle} className={paused ? "on" : ""} title="Space">
          {paused ? "Paused" : "Pause"}
        </button>
        {SPEEDS.map((n) => (
          <button
            type="button"
            key={n}
            className={!paused && speed === n ? "on" : ""}
            onClick={() => setSpeed(n)}
            title={`Speed ${n}`}
          >
            {n === MAX_SPEED ? "Max" : n}
          </button>
        ))}
      </div>
      <div className="menu" ref={menu}>
        <button type="button" onClick={() => setOpen((o) => !o)}>
          Skip
        </button>
        {open && (
          <div className="items">
            {SKIPS.map(([kind, label]) => (
              <button
                type="button"
                key={kind}
                onClick={() => {
                  setOpen(false);
                  void sim.control({ kind: "SkipTo", skip: kind as SkipKind });
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {clock?.skipping && <span className="skipping">Skipping to {skipName(clock.skipping)}...</span>}
    </>
  );
}

/** The alerts indicator: how many alert-level notices arrived since the alerts pane was last opened. */
function AlertsButton({ seen, onOpen }: { seen: number; onOpen: () => void }) {
  const notices = useNotices();
  const unseen = notices.filter(
    (e) =>
      e.seq > seen && (e.notice.kind === "Alert" ? e.notice.level !== "Log" : e.notice.kind === "Paused"),
  ).length;
  return (
    <button type="button" className="bell" onClick={onOpen} title="Alerts">
      Alerts
      {unseen > 0 && <span className="count">{unseen}</span>}
    </button>
  );
}

export interface TopBarProps {
  seen: number;
  onOpenAlerts: () => void;
  onOpenCommands: () => void;
  onSave: () => void;
  onLoad: () => void;
}

function TopBarInner({ seen, onOpenAlerts, onOpenCommands, onSave, onLoad }: TopBarProps) {
  return (
    <header className="topbar">
      <Clock />
      <SpeedControls />
      <span className="grow" />
      <AlertsButton seen={seen} onOpen={onOpenAlerts} />
      <button type="button" onClick={onOpenCommands} title="Ctrl+K">
        Command...
      </button>
      <button type="button" onClick={onSave}>
        Save
      </button>
      <button type="button" onClick={onLoad}>
        Load
      </button>
    </header>
  );
}

export const TopBar = memo(TopBarInner);
