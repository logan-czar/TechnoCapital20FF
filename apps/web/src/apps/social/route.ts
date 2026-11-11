// The Social app's route grammar (pivot 8.3, 15.3): the whole state that matters is the route
// string, so links, back and forward and a saved desktop all work. `home` (also null) is the
// timeline of followed accounts, `all` every post, `rumours` the rumour lens, `handle/<id>` an
// account's page (the string `entityRoute` writes for a Handle) and `post/<id>` one post with its
// thread. Anything else reads as home.

export type SocialRoute =
  | { page: "home" }
  | { page: "all" }
  | { page: "rumours" }
  | { page: "handle"; id: number }
  | { page: "post"; id: number };

/** Reads a route string; null and anything unknown or malformed is the home timeline. */
export function parseSocialRoute(route: string | null): SocialRoute {
  if (route === null) return { page: "home" };
  if (route === "home" || route === "all" || route === "rumours") return { page: route };
  const m = /^(handle|post)\/(\d+)$/.exec(route);
  if (m !== null) return { page: m[1] as "handle" | "post", id: Number(m[2]) };
  return { page: "home" };
}

/** The route string of `r`: parseSocialRoute(formatSocialRoute(r)) gives `r` back. */
export function formatSocialRoute(r: SocialRoute): string {
  return r.page === "handle" || r.page === "post" ? `${r.page}/${r.id}` : r.page;
}

/** The same place written one way, so two spellings of home do not count as two pages. */
export function canonicalRoute(route: string | null): string {
  return formatSocialRoute(parseSocialRoute(route));
}
