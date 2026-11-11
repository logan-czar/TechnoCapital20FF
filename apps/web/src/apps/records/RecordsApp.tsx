// The Records app's window: a placeholder until its lane builds it (D1037).

import type { AppProps } from "../../os/apps.ts";
import { ComingSoon } from "../_shared/index.ts";

export default function RecordsApp({ route }: AppProps) {
  return <ComingSoon title="Records" route={route} />;
}
