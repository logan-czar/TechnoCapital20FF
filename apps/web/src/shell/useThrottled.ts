import { useEffect, useRef, useState } from "react";

/**
 * The latest `value`, updated at most once per `ms`. For heavy consumers of a view that moves
 * every frame (a 10,000-row table reading the quotes): they redraw a few times a second, not 60.
 */
export function useThrottled<T>(value: T, ms: number): T {
  const [held, setHeld] = useState(value);
  const latest = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    latest.current = value;
    if (timer.current !== null) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      setHeld(latest.current);
    }, ms);
  }, [value, ms]);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  return held;
}
