// The Social app's phone view: a placeholder until its lane builds it (D1037).

import type { AppProps } from "../../os/apps.ts";
import { ComingSoon } from "../_shared/index.ts";

export default function SocialAppPhone({ route }: AppProps) {
  return <ComingSoon title="Social" route={route} />;
}
