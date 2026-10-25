// A page's filter picker (crates/game/src/pages/live.rs `Filter`, `spawn_picker`; D510, D511):
// "Industry: All v". A click lists the options as a wrapping row of chips (the first is "All",
// value 0); a chip sets the pick and closes them. A pick is 0 for "all", else the option's own
// code (an id plus one, D511), so `pickId` gives the id back.
//
// The rest of live.rs (Live widgets that remake a model when their views move) is what React does
// already: a page re-renders from its views (PageSpec.views), keeping its tables' scroll and sort.
// A page keeps its picks in its own state (useState), or in the settings if they should persist.

import { useState } from "react";

/** A filter value: 0 is "all"; any other value is an id plus one (D511). */
export type Pick = number;

/** The pick of an id. */
export const pickOf = (id: number): Pick => id + 1;
/** The id a pick names, or null for "all". */
export const pickId = (p: Pick): number | null => (p > 0 ? p - 1 : null);

export interface PickerProps {
  label: string;
  /** The options after "All": a label and its pick. */
  options: readonly (readonly [string, Pick])[];
  value: Pick;
  onChange: (p: Pick) => void;
}

export function Picker({ label, options, value, onChange }: PickerProps) {
  const [open, setOpen] = useState(false);
  const shown = options.find(([, v]) => v === value)?.[0] ?? "All";
  const choose = (p: Pick) => {
    onChange(p);
    setOpen(false);
  };
  return (
    <span className="picker">
      <button type="button" className="linkbtn small" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="muted">{label}:</span> {shown} v
      </button>
      {open && (
        <span className="chip-row picker-options" role="listbox" aria-label={label}>
          {[["All", 0] as const, ...options].map(([l, v]) => (
            <button
              type="button"
              role="option"
              aria-selected={v === value}
              key={v}
              className={v === value ? "on small" : "small"}
              onClick={() => choose(v)}
            >
              {l}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
