// Names of things by id, from the views (spec 9.2: queries return ids, D426), memoized per view.

import { useMemo } from "react";
import { useViewData } from "../sim/hooks.ts";

export interface Names {
  company: (id: number) => string;
  industry: (id: number) => string;
  country: (id: number) => string;
  province: (id: number) => string;
}

export function useNames(): Names {
  const rows = useViewData("company_rows");
  const industries = useViewData("industry_rows");
  const places = useViewData("places");
  return useMemo(() => {
    const companies = new Map(rows?.rows.map((r) => [r.id as number, r.name]));
    const inds = new Map(industries?.rows.map((r) => [r.id as number, r.name]));
    const countries = new Map(places?.countries.map((c) => [c.id as number, c.name]));
    const provinces = new Map(places?.provinces.map((p) => [p.id as number, p.name]));
    const of = (m: Map<number, string>, kind: string) => (id: number) => m.get(id) ?? `${kind} ${id}`;
    return {
      company: of(companies, "Company"),
      industry: of(inds, "Industry"),
      country: of(countries, "Country"),
      province: of(provinces, "Province"),
    };
  }, [rows, industries, places]);
}
