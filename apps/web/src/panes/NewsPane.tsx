import { formatSimDate } from "@tc20ff/sim";
import { memo } from "react";
import { useNames } from "../shell/names.ts";
import { useViewData } from "../sim/hooks.ts";

/** Headlines shown, newest first. */
const SHOWN = 200;

function NewsPaneInner() {
  const news = useViewData("news");
  const names = useNames();
  const feed = news?.feed ?? [];
  const shown = feed.slice(-SHOWN).reverse();
  return (
    <div className="pane">
      <div className="toolbar">Pdoomberg Wire: {feed.length} stories</div>
      <div className="scroll list">
        {shown.map((h) => (
          <div className="item" key={h.id}>
            <span className="when">{formatSimDate(h.date)}</span>
            <span>{h.text}</span>
            {h.industry !== null && <span className="when">[{names.industry(h.industry)}]</span>}
          </div>
        ))}
        {shown.length === 0 && <p>No stories yet. Start the clock.</p>}
      </div>
    </div>
  );
}

export const NewsPane = memo(NewsPaneInner);
