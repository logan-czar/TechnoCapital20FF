// The top bar (ui/top_bar.rs; spec 8 main screen and time controls rows): the quarter clock, the
// date and hour, pause, speeds 1 to 5 (5 is max), the Skip menu, the Panes menu (D979), the alerts
// indicator and the command bar button. Keys: Space pauses or resumes, 1 to 5 set the speed (and
// resume, D8).

import { MAX_SPEED, QUARTER_PHASE_NAME, weekdayShortName } from "@tc20ff/sim";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useClock, useNotices, useSim } from "../sim/hooks.ts";
import { date as fmtDate } from "../widgets/cells.ts";
import { FIXED_PANES, type WorkspaceControl } from "./panes.ts";
import { SKIPS, skipName } from "./text.ts";

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

const SPEEDS = [1, 2, 3, 4, 5] as const;

/** Closes a dropdown menu on a press outside it; returns the ref for the menu's root. */
function useCloseOutside(open: boolean, close: () => void) {
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target instanceof Node && menu.current?.contains(e.target))) close();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open, close]);
  return menu;
}

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
  const menu = useCloseOutside(
    open,
    useCallback(() => setOpen(false), []),
  );

  const toggle = useCallback(() => {
    void sim.control(paused ? { kind: "Resume" } : { kind: "Pause" });
  }, [sim, paused]);
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
      } else if (e.key >= "1" && e.key <= String(MAX_SPEED)) {
        setSpeed(Number(e.key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, setSpeed]);

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
                  void sim.control({ kind: "SkipTo", skip: kind });
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

/**
 * The Panes menu (D979): reopens the pane closed last, opens or focuses a fixed pane, reopens a
 * closed page. It reads the workspace when it opens, and any choice or outside press closes it.
 */
export function PanesMenu({ workspace }: { workspace: () => WorkspaceControl | null }) {
  const [open, setOpen] = useState(false);
  const menu = useCloseOutside(
    open,
    useCallback(() => setOpen(false), []),
  );
  const ws = open ? workspace() : null;
  const closed = ws?.closed() ?? [];
  const last = closed[0];
  const act = (f: () => void) => {
    setOpen(false);
    f();
  };
  return (
    <div className="menu" ref={menu}>
      <button type="button" onClick={() => setOpen((o) => !o)} title="Open or reopen a pane">
        Panes
      </button>
      {ws && (
        <div className="items panes-menu">
          <button type="button" disabled={!last} onClick={() => act(() => ws.reopen())}>
            <span>{last ? `Reopen ${last.title}` : "Nothing to reopen"}</span>
            <span className="detail">Alt+Shift+R</span>
          </button>
          <div className="heading">Panes</div>
          {FIXED_PANES.map((spec) => (
            <button type="button" key={spec.id} onClick={() => act(() => ws.open(spec))}>
              <span>{spec.title}</span>
              {ws.isOpen(spec.id) && <span className="detail">open</span>}
            </button>
          ))}
          {closed.some((c) => c.kind === "page") && <div className="heading">Recently closed pages</div>}
          {closed
            .filter((c) => c.kind === "page")
            .map((c) => (
              <button type="button" key={c.id} onClick={() => act(() => ws.reopen(c))}>
                <span>{c.title}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export interface TopBarProps {
  seen: number;
  onOpenAlerts: () => void;
  onOpenCommands: () => void;
  workspace: () => WorkspaceControl | null;
  onSave: () => void;
  onLoad: () => void;
}

function TopBarInner({ seen, onOpenAlerts, onOpenCommands, workspace, onSave, onLoad }: TopBarProps) {
  return (
    <header className="topbar">
      <Clock />
      <SpeedControls />
      <span className="grow" />
      <PanesMenu workspace={workspace} />
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
