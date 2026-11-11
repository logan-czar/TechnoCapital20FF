// The Pdoomberg app's window: a placeholder until its lane builds it (D1037).

import type { AppProps } from "../../os/apps.ts";
import { ComingSoon } from "../_shared/index.ts";

export default function TerminalApp({ route }: AppProps) {
  return <ComingSoon title="Pdoomberg" route={route} />;
}
