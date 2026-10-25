// The alerts list: what happened (notices since the game began) and the alert levels (spec 8: each
// alert is Pause, Notify, Log only or Off; design fix 8).

import { ALERT_KIND_VALUES, ALERT_LEVEL_VALUES, type AlertLevel, formatDateTime } from "@tc20ff/sim";
import { memo, useState } from "react";
import { useNames } from "../shell/names.ts";
import { ALERT_LABEL, describeNotice, LEVEL_LABEL } from "../shell/text.ts";
import { useNotices, useSim } from "../sim/hooks.ts";

function AlertsPaneInner() {
  const sim = useSim();
  const notices = useNotices();
  const names = useNames();
  // Levels as the player set them in this session (the mock's start in the defaults).
  const [levels, setLevels] = useState<Partial<Record<(typeof ALERT_KIND_VALUES)[number], AlertLevel>>>({});
  return (
    <div className="pane">
      <div className="toolbar">
        {ALERT_KIND_VALUES.map((k) => (
          <label key={k}>
            {ALERT_LABEL[k]}{" "}
            <select
              value={levels[k] ?? "default"}
              onChange={(e) => {
                const level = ALERT_LEVEL_VALUES.find((l) => l === e.target.value);
                if (!level) return;
                setLevels((l) => ({ ...l, [k]: level }));
                void sim.control({ kind: "SetAlert", alert_kind: k, level });
              }}
            >
              <option value="default" disabled>
                default
              </option>
              {ALERT_LEVEL_VALUES.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="scroll list">
        {[...notices].reverse().map((e) => {
          const d = describeNotice(e.notice, names.company);
          return (
            <div className="item" key={e.seq}>
              <span className="when">{formatDateTime(e.time)}</span>
              <span className={d.severity === "alert" ? "warn" : ""}>{d.text}</span>
            </div>
          );
        })}
        {notices.length === 0 && <p>Nothing yet.</p>}
      </div>
    </div>
  );
}

export const AlertsPane = memo(AlertsPaneInner);
