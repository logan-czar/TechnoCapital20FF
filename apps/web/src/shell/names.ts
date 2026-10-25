// Names of things by id, from the views (spec 9.2: queries return ids, D426). One cache is shared
// by every component: the lookup maps are built once per set of source views, not once per reader.

import { useMemo } from "react";
import { useViewData } from "../sim/hooks.ts";

export interface Names {
  company: (id: number) => string;
  industry: (id: number) => string;
  country: (id: number) => string;
  province: (id: number) => string;
}

type Source = [unknown, unknown, unknown];
let cachedSource: Source | null = null;
let cached: Names | null = null;

type Named = readonly { id: number; name: string }[];

function build(rows: Named, industries: Named, countries: Named, provinces: Named): Names {
  const of = (list: Named, kind: string) => {
    const m = new Map(list.map((r) => [r.id, r.name]));
    return (id: number) => m.get(id) ?? `${kind} ${id}`;
  };
  return {
    company: of(rows, "Company"),
    industry: of(industries, "Industry"),
    country: of(countries, "Country"),
    province: of(provinces, "Province"),
  };
}

export function useNames(): Names {
  const rows = useViewData("company_rows");
  const industries = useViewData("industry_rows");
  const places = useViewData("places");
  return useMemo(() => {
    const src: Source = [rows, industries, places];
    if (cached && cachedSource && src.every((s, i) => s === cachedSource?.[i])) return cached;
    cachedSource = src;
    cached = build(
      rows?.rows ?? [],
      industries?.rows ?? [],
      places?.countries ?? [],
      places?.provinces ?? [],
    );
    return cached;
  }, [rows, industries, places]);
}
