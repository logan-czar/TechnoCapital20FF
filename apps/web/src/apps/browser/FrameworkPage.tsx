// A page of the pages/ framework drawn inside the browser (pivot 15.3; D1047): company, industry,
// exchange, recap, the company, industry and exchange lists, and the world history. It does what
// PageBody (pages/PagePane.tsx) does for a dockview pane, in this app: reads the views the page
// names, builds its doc, takes the hidden and non-US parts out (sanitize.ts) and draws it through
// DocView. Its links go through a NavContext that opens the page in this app, which is how the old
// pages navigate inside the browser instead of the debug workspace's panes.

import { useEffect, useMemo } from "react";
import { type NameIndex, useNameIndex } from "../../links/names.ts";
import { NavContext, type PageNav } from "../../links/nav.ts";
import { DocView } from "../../pages/DocView.tsx";
import type { PageDoc } from "../../pages/doc.ts";
import { type PageRef, pageId } from "../../pages/ref.ts";
import { pageSpecOf } from "../../pages/registry.ts";
import type { AnyPageSpec } from "../../pages/spec.ts";
import { mergeSlices, usePageSlices, usePageViews, type ViewsData } from "../../pages/views.ts";
import { ArticleView, type Go } from "./ArticleView.tsx";
import { noArticle } from "./articles.ts";
import { formatRoute, routeOfPage } from "./route.ts";
import { type Coverage, coverageOf, isOutside, sanitizeDoc, visibleSections } from "./sanitize.ts";

/** The views every framework page also reads, for the USA-only check (sanitize.ts `coverageOf`). */
export const COVERAGE_VIEWS = ["places", "countries", "company_rows", "exchanges"] as const;

/** The views a framework page is built from: its own and the coverage's. */
export function viewsOfPage(spec: AnyPageSpec): AnyPageSpec["views"] {
  return [...new Set([...spec.views, ...COVERAGE_VIEWS])];
}

/**
 * The doc of `page` with the hidden and non-US parts removed, or null for a page outside the
 * encyclopedia (another country's company or exchange, a kind it does not draw).
 */
export function frameworkDoc(
  spec: AnyPageSpec,
  page: PageRef,
  views: ViewsData,
  index: NameIndex,
  cov: Coverage = coverageOf(views),
): PageDoc | null {
  if (!spec.doc || isOutside(page, cov)) return null;
  return sanitizeDoc(spec.doc(page, views, index), cov);
}

function Body({
  spec,
  page,
  go,
  onTitle,
}: {
  spec: AnyPageSpec;
  page: PageRef;
  go: Go;
  onTitle: (title: string | null) => void;
}) {
  const index = useNameIndex();
  const pageViews = usePageViews(viewsOfPage(spec));
  const keys = useMemo(() => spec.slices?.(page) ?? [], [spec, page]);
  const slices = usePageSlices(keys);
  const views = useMemo(() => mergeSlices(pageViews, slices), [pageViews, slices]);
  const cov = useMemo(() => coverageOf(views), [views]);
  const built = useMemo(() => {
    try {
      return { doc: frameworkDoc(spec, page, views, index, cov), error: null };
    } catch (e) {
      return { doc: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [spec, page, views, index, cov]);
  const title = built.doc?.title ?? index.title(page);
  useEffect(() => {
    onTitle(title);
  }, [title, onTitle]);
  const sections = useMemo(() => visibleSections(page.kind, spec.sections), [page.kind, spec.sections]);
  if (built.error !== null)
    return (
      <div className="br-error" role="alert" data-testid="page-error">
        This page could not be drawn: {built.error}
      </div>
    );
  if (built.doc === null)
    return <ArticleView article={noArticle(formatRoute({ kind: "page", page }), "this page")} go={go} />;
  return (
    <div className="br-framework" data-testid="framework-page" data-page={pageId(page)}>
      <DocView doc={built.doc} views={views} sections={sections} {...(spec.tabs ? { tabs: true } : {})} />
    </div>
  );
}

/** A framework page in the browser. */
export function FrameworkPage({
  page,
  go,
  onTitle,
}: {
  page: PageRef;
  go: Go;
  onTitle: (title: string | null) => void;
}) {
  const spec = pageSpecOf(page.kind);
  const nav = useMemo<PageNav>(
    () => ({
      open: (p) => {
        const route = routeOfPage(p);
        if (route !== null) go("browser", route);
      },
    }),
    [go],
  );
  if (spec === undefined)
    return <ArticleView article={noArticle(formatRoute({ kind: "page", page }), "this page")} go={go} />;
  return (
    <NavContext.Provider value={nav}>
      {/* Keyed by the page: another page is a fresh body (its table sorts and scroll reset). */}
      <Body key={pageId(page)} spec={spec} page={page} go={go} onTitle={onTitle} />
    </NavContext.Provider>
  );
}
