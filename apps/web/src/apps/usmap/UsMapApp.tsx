// The USA map app's window: a placeholder until its lane builds it (D1037).

import type { AppProps } from "../../os/apps.ts";
import { ComingSoon } from "../_shared/index.ts";

export default function UsMapApp({ route }: AppProps) {
  return <ComingSoon title="USA map" route={route} />;
}
