// The Social app's window: a placeholder until its lane builds it (D1037).

import type { AppProps } from "../../os/apps.ts";
import { ComingSoon } from "../_shared/index.ts";

export default function SocialApp({ route }: AppProps) {
  return <ComingSoon title="Social" route={route} />;
}
