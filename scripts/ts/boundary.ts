// The sim boundary scan (D952, CLAUDE.md rules): sim code is deterministic and has no DOM, so a
// few globals are banned outright in packages/sim/src and packages/sim-data/src. Biome catches the
// globals; this catches the members it cannot (Math.round, Math.random, localeCompare) and the
// UI importing raw tables. Exits 1 with file:line for every hit.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

interface Rule {
  roots: string[];
  pattern: RegExp;
  why: string;
  allow?: string[];
}

const RULES: Rule[] = [
  {
    roots: ["packages/sim/src", "packages/sim-data/src"],
    pattern: /\bMath\.random\b/,
    why: "the sim draws only from its seeded streams (spec 3.1)",
  },
  {
    roots: ["packages/sim/src", "packages/sim-data/src"],
    pattern: /\bMath\.round\b/,
    why: "use roundHalfAway or roundTiesEven from types/num.ts (D952)",
    allow: ["packages/sim/src/types/num.ts"],
  },
  {
    roots: ["packages/sim/src", "packages/sim-data/src"],
    pattern: /\blocaleCompare\b/,
    why: "locale order differs by machine; use cmpStr (D952)",
  },
  {
    roots: ["packages/sim/src", "packages/sim-data/src"],
    pattern: /\bnew Date\b|\bDate\.now\b|\bperformance\.now\b/,
    why: "the sim reads no wall clock",
  },
  {
    roots: ["apps/web/src"],
    pattern: /@tc20ff\/sim\/internal/,
    why: "the UI reads only the views (spec 9)",
  },
];

function files(root: string): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(root, e);
    if (statSync(p).isDirectory()) out = out.concat(files(p));
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

let hits = 0;
for (const rule of RULES) {
  for (const root of rule.roots) {
    for (const f of files(root)) {
      const rel = relative(".", f).split(sep).join("/");
      if (rule.allow?.includes(rel)) continue;
      readFileSync(f, "utf8")
        .split(/\r?\n/)
        .forEach((line, i) => {
          // Comments may name what they forbid: skip line comments and JSDoc lines.
          if (/^\s*(\*|\/\*)/.test(line)) return;
          const code = line.replace(/\/\/.*$/, "");
          if (rule.pattern.test(code)) {
            console.error(`${rel}:${i + 1}: ${rule.pattern.source}: ${rule.why}`);
            hits++;
          }
        });
    }
  }
}
if (hits > 0) {
  console.error(`boundary: ${hits} hit(s)`);
  process.exit(1);
}
console.log("boundary: ok");
