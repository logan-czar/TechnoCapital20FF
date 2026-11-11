// The smoke run (`--smoke=<out.json>`): proof with no human that the built app starts, plays and
// ticks. Main runs `smokeInPage` inside the page, where it drives the page's own SimClient
// (`window.__tcSim`, apps/web/src/sim/spawn.ts) exactly as the UI would: a new game unless a save
// was loaded, max speed until enough Frames have been read, pause, and optionally a slot save.
// Each running Frame is held by the sim until the page has answered the one before (FrameDone,
// D1004), so N frames read means the whole loop went round N times: sim process, port, page, back.

import type { ClockView, Reply } from "@tc20ff/sim";

export interface SmokeOptions {
  /** A game is already there (`--save`): do not start one. */
  loaded: boolean;
  seed: number;
  /** Used only when the world offers scenarios. */
  scenario: string;
  frames: number;
  /** Ask for a Save and report its size (the real sim only). */
  readSave: boolean;
  saveSlot: string | null;
  timeoutMs: number;
}

/** What the page reports back. */
export interface SmokePage {
  frames: number;
  ticks: number;
  clock: ClockView | null;
  /** The size of a `Save` reply's bytes: they crossed the port whole. Null with the mock. */
  saveBytes: number | null;
  /** The reply to the slot save, when one was asked for. */
  slotReply: Reply | null;
  /** The first of the page's text, to see what the player would. */
  text: string;
}

/** The part of the page's SimClient the smoke run uses. */
interface PageClient {
  ready: Promise<void>;
  frames: number;
  ticks: number;
  clock: ClockView | null;
  store: {
    status: { started: boolean; fatal: string | null; choices: { scenarios: { id: string }[] } | null };
  };
  newGame(seed: number, scenario?: string): Promise<Reply>;
  control(control: { kind: "SetSpeed"; speed: number } | { kind: "Pause" | "Resume" }): Promise<Reply>;
  save(): Promise<Uint8Array | null>;
  saveSlot(slot: string): Promise<Reply>;
}

/**
 * Runs in the page (main passes its source to `executeJavaScript`), so it uses nothing from this
 * file's scope. MAX_SPEED is 6 (types/control.ts).
 */
export async function smokeInPage(o: SmokeOptions): Promise<SmokePage> {
  const started = Date.now();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const until = async (what: string, ok: () => boolean): Promise<void> => {
    while (!ok()) {
      if (Date.now() - started > o.timeoutMs) throw new Error(`timed out waiting for ${what}`);
      await sleep(20);
    }
  };
  const hook = globalThis as unknown as { __tcSim?: PageClient };
  await until("the page's sim client", () => hook.__tcSim !== undefined);
  const client = hook.__tcSim as PageClient;
  const fatal = (): void => {
    if (client.store.status.fatal !== null) throw new Error(`fatal: ${client.store.status.fatal}`);
  };
  const expectOk = (what: string, r: Reply): void => {
    if (r.kind !== "Ok") throw new Error(`${what}: ${JSON.stringify(r)}`);
  };
  await client.ready;
  fatal();
  if (o.loaded) {
    await until(
      "the loaded game's first frame",
      () => client.store.status.started || client.store.status.fatal !== null,
    );
    fatal();
  } else {
    const choices = client.store.status.choices;
    expectOk("NewGame", await client.newGame(o.seed, choices === null ? undefined : o.scenario));
  }
  if (o.frames > 0) {
    const from = client.frames;
    expectOk("SetSpeed", await client.control({ kind: "SetSpeed", speed: 6 }));
    // An alert set to pause stops the clock (pivot 2.4), and frames with it: resume and go on.
    while (client.frames - from < o.frames) {
      fatal();
      if (Date.now() - started > o.timeoutMs) {
        throw new Error(`timed out waiting for ${o.frames} frames: read ${client.frames - from}`);
      }
      if (client.clock?.paused === true) expectOk("Resume", await client.control({ kind: "Resume" }));
      await sleep(20);
    }
    expectOk("Pause", await client.control({ kind: "Pause" }));
  }
  const bytes = o.readSave ? await client.save() : null;
  const slotReply = o.saveSlot === null ? null : await client.saveSlot(o.saveSlot);
  return {
    frames: client.frames,
    ticks: client.ticks,
    clock: client.clock,
    saveBytes: bytes === null ? null : bytes.length,
    slotReply,
    text: (document.body.innerText ?? "").slice(0, 300),
  };
}
