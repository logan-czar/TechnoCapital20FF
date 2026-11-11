// Where the end-to-end runs keep their files: under apps/desktop/.scratch, which is never committed.

import { join } from "node:path";
import { scratchDir } from "../scripts/common.ts";

/** Every test's user-data folder is under here; teardown.ts sweeps for processes that name it. */
export const userDataRoot = join(scratchDir, "e2e", "ud");
