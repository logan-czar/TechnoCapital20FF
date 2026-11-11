// The pre-pivot headline fixture (v_news), moved as it was from mockViews.ts. The pivot's news app
// reads v_feed (fixtures/feed.ts).

import type { Headline, SimDate } from "@tc20ff/sim";
import type { MockWorld } from "../mockWorld.ts";
import type { MockRng } from "./rng.ts";

const NEWS_TEMPLATES = [
  "{n} posts a quarterly beat as margins widen",
  "{n} warns on demand; shares slip in early trade",
  "{n} announces a share buyback",
  "{n} raises capital in a secondary offering",
  "Analysts upgrade {n} on stronger cash flow",
];

export function mockHeadline(w: MockWorld, rng: MockRng, id: number, date: SimDate): Headline {
  const c = w.companies[Math.floor(rng.next() * w.companies.length)] as (typeof w.companies)[number];
  const text = (NEWS_TEMPLATES[Math.floor(rng.next() * NEWS_TEMPLATES.length)] as string).replace(
    "{n}",
    c.name,
  );
  return {
    id,
    date,
    industry: c.industry,
    company: c.id,
    event: null,
    kind: { kind: "StartupLaunch" },
    text,
  } as Headline;
}
