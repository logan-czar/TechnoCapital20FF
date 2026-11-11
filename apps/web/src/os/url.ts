// The desktop's fake addresses (pivot 15.2): every place in every app has one, "orr://news/race/12",
// shown in a window's title bar and written by links between apps. An address is the app's id and
// the app's own route (os/apps.ts `AppProps.route`); nothing is ever fetched from one.

/** The scheme of every address on the desktop. */
export const URL_SCHEME = "orr";

/** A place on the desktop: an app and a route inside it (null for the app's home). */
export interface AppPlace {
  app: string;
  route: string | null;
}

/** An app id as the registry writes them: lower case, digits and hyphens. */
const APP_ID = /^[a-z0-9][a-z0-9-]*$/;

/** Each route segment percent-encoded, the slashes between them kept. */
function encodeRoute(route: string): string {
  return route.split("/").map(encodeURIComponent).join("/");
}

/** The address of a place: "orr://betting" or "orr://betting/contract/7". */
export function formatUrl(place: AppPlace): string {
  const route = place.route === null || place.route === "" ? "" : `/${encodeRoute(place.route)}`;
  return `${URL_SCHEME}://${place.app}${route}`;
}

/**
 * The place an address names, or null when it is not one of the desktop's: another scheme, no app,
 * an app id that could not be registered, or an escape that does not decode. A trailing slash and
 * the scheme's case are forgiven (a player may type one).
 */
export function parseUrl(url: string): AppPlace | null {
  const text = url.trim();
  const prefix = `${URL_SCHEME}://`;
  if (text.slice(0, prefix.length).toLowerCase() !== prefix) return null;
  const rest = text.slice(prefix.length);
  const slash = rest.indexOf("/");
  const app = (slash < 0 ? rest : rest.slice(0, slash)).toLowerCase();
  if (!APP_ID.test(app)) return null;
  const raw = slash < 0 ? "" : rest.slice(slash + 1).replace(/\/+$/, "");
  if (raw === "") return { app, route: null };
  try {
    return { app, route: raw.split("/").map(decodeURIComponent).join("/") };
  } catch {
    return null;
  }
}
