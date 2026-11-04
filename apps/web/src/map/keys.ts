// W A S D pan and Q / E zoom (crates/game/src/map/mod.rs `map_keys`; D636): held W A S D pans at
// KEY_PAN_PX_PER_S, each Q or E press zooms one WHEEL_STEP out or in about the view's centre. Only
// plain keys: not while a text field or a dialog has the keyboard, not while Pdoomberg is up, not
// with Ctrl, Alt or Meta held.

import { useEffect, useRef } from "react";
import { KEY_PAN_PX_PER_S } from "./view.ts";

/** A key press aimed at something the player is typing in, or Pdoomberg or a dialog is up. */
export function mapKeysBlocked(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.altKey || e.metaKey) return true;
  if (document.querySelector(".pdoomberg") !== null) return true;
  const t = e.target;
  if (!(t instanceof HTMLElement)) return false;
  return (
    t.tagName === "INPUT" ||
    t.tagName === "TEXTAREA" ||
    t.tagName === "SELECT" ||
    t.isContentEditable ||
    t.closest("[role=dialog]") !== null
  );
}

/** The pan direction of a held key, screen px (y down) the map moves: A shows more west, so the map moves right. */
const PAN: Record<string, [number, number]> = {
  KeyA: [1, 0],
  KeyD: [-1, 0],
  KeyW: [0, 1],
  KeyS: [0, -1],
};

/**
 * Calls `pan(dx, dy)` every frame a pan key is held (px this frame) and `zoom(steps)` on each Q (-1)
 * or E (+1) press.
 */
export function useMapKeys(pan: (dx: number, dy: number) => void, zoom: (steps: number) => void): void {
  const handlers = useRef({ pan, zoom });
  handlers.current = { pan, zoom };
  useEffect(() => {
    const held = new Set<string>();
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = last === 0 ? 1 / 60 : Math.min(0.1, (now - last) / 1000);
      last = now;
      let [dx, dy] = [0, 0];
      for (const k of held) {
        const d = PAN[k];
        if (d) {
          dx += d[0];
          dy += d[1];
        }
      }
      if (dx !== 0 || dy !== 0) handlers.current.pan(dx * KEY_PAN_PX_PER_S * dt, dy * KEY_PAN_PX_PER_S * dt);
      frame = held.size > 0 ? requestAnimationFrame(tick) : 0;
      if (frame === 0) last = 0;
    };
    const onDown = (e: KeyboardEvent) => {
      if (mapKeysBlocked(e)) return;
      if (e.code in PAN) {
        held.add(e.code);
        if (frame === 0) frame = requestAnimationFrame(tick);
      } else if (!e.repeat && (e.code === "KeyQ" || e.code === "KeyE")) {
        handlers.current.zoom(e.code === "KeyE" ? 1 : -1);
      }
    };
    const onUp = (e: KeyboardEvent) => held.delete(e.code);
    const clear = () => held.clear();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", clear);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, []);
}
