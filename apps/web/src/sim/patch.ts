import type { ViewsPatch } from "@tc20ff/sim";

// CONTRACT: ViewsPatch only appends news, but NewGame and Load replace the feed. Until the contract
// has a reset, a frame that rebuilds every view carries `news_reset`: the client replaces its feed
// with `news_appended` instead of appending.
export type UiViewsPatch = ViewsPatch & { news_reset?: true };
