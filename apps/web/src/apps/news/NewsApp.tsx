// The News app's window: a placeholder until its lane builds it (D1037).

import type { AppProps } from "../../os/apps.ts";
import { ComingSoon } from "../_shared/index.ts";

export default function NewsApp({ route }: AppProps) {
  return <ComingSoon title="News" route={route} />;
}
