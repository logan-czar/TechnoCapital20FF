// The replay log's player lines (pivot 16.1, D1027; lane P, D1042): the account's opening and the
// actions round-trip through the text. The run itself is replay_player.slow.test.ts.

import { describe, expect, it } from "vitest";
import { logText, parseLog } from "../src/replay.ts";

describe("replay log text with player actions", () => {
  it("the player line and act lines parse back; a frame's controls come before its actions", () => {
    const run = {
      player: "Hard" as const,
      controls: [{ frame: 4, control: { kind: "Resume" } as const }],
      actions: [
        { frame: 4, action: { kind: "Transfer", from: "Brokerage", to: "Exchange", amount: 12.5 } as const },
        { frame: 7, action: { kind: "NotificationsRead", through: 2 } as const },
      ],
      hashes: ["hash 5 9 2020-01 abc", "end 9 20 2020-02-01 00:00 fed controls 00ff"],
    };
    const text = logText(3, 1, run);
    expect(text).toMatch(
      /^version 2\nseed 3\nyears 1\nplayer Hard\ncontrol 4 resume\nact 4 \{"kind":"Transfer"/,
    );
    expect(text.indexOf("hash 5 ")).toBeLessThan(text.indexOf("act 7 "));
    expect(parseLog(text)).toEqual({ seed: 3, years: 1, run });
    expect(() => parseLog("version 2\nseed 1\nyears 1\nplayer Medium\n")).toThrow(/log line 4/);
    expect(() => parseLog("version 2\nseed 1\nyears 1\nact 1 {nope\n")).toThrow(/log line 4/);
  });
});
