// The News app's phone view: a placeholder until its lane builds it (D1037).

import type { AppProps } from "../../os/apps.ts";
import { ComingSoon } from "../_shared/index.ts";

export default function NewsAppPhone({ route }: AppProps) {
  return <ComingSoon title="News" route={route} />;
}
