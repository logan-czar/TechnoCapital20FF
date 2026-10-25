// The chart demo: daily bars of one company with the EFV band (spec 8 Pdoomberg F3), live from
// v_price_bars (the mock keeps the 40 biggest listed companies' bars).

import { barRows } from "@tc20ff/sim";
import { memo, useMemo, useState } from "react";
import { useNames } from "../shell/names.ts";
import { useViewData } from "../sim/hooks.ts";
import { PriceChart } from "../widgets/PriceChart.tsx";

function ChartPaneInner({ company: initial }: { company: number | null }) {
  const history = useViewData("price_bars");
  const names = useNames();
  const [chosen, setChosen] = useState<number | null>(initial);
  const [efv, setEfv] = useState(true);
  const id = chosen ?? history?.companies[0]?.id ?? null;
  const bars = useMemo(() => {
    const h = history?.companies.find((c) => c.id === id);
    return h ? barRows(h.bars) : [];
  }, [history, id]);
  return (
    <div className="pane">
      <div className="toolbar">
        <label>
          Company{" "}
          <select value={id ?? ""} onChange={(e) => setChosen(Number(e.target.value))}>
            {history?.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {names.company(c.id)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={efv} onChange={(e) => setEfv(e.target.checked)} /> Fair value band
        </label>
        <span>{bars.length} daily bars</span>
      </div>
      <div className="fill">
        <PriceChart bars={bars} efv={efv} seriesKey={id ?? ""} />
      </div>
    </div>
  );
}

export const ChartPane = memo(ChartPaneInner);
