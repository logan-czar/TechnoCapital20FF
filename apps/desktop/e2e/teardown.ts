// After the whole run: nothing the tests launched may still be alive. Each test closes its own app
// (fixtures.ts); this is the one sweep by command line, over every user-data folder of the run.

import { appProcesses } from "../scripts/drive.ts";
import { userDataRoot } from "./paths.ts";

export default function teardown(): void {
  const left = appProcesses(userDataRoot);
  if (left.length === 0) return;
  for (const pid of left) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Gone between the listing and the kill.
    }
  }
  throw new Error(`the e2e run left ${left.length} app processes behind (now killed): ${left.join(", ")}`);
}
