// The new-game screen (pivot 3.5; 1995-rework 4.1): the baked starts the build ships (instant), "Generate a
// new history" (the 1995 world run forward to 2020 behind a progress screen that can be cancelled)
// and loading a save. The old seed-and-scenario picker of the 1995 world stays for developers (the dev
// server, and the end-to-end runs' test hooks); the player never picks the hidden scenario (pivot 3.2).
//
// The picker is told what to do through `NewGameApi`, whose requests answer with the sim's `Reply`,
// so it can say why a start did not happen (a mock that cannot generate, a refused start) and go back
// to the choices when the player cancels.

import type { BakedStart, NewGameChoices, Reply } from "@tc20ff/sim";
import { useRef, useState } from "react";
import { replyProblem } from "../sim/client.ts";
import type { ProgressInfo, Status } from "../sim/store.ts";
import { date as fmtDate } from "../widgets/cells.ts";
import "./new-game.css";

/** What each scenario means to a player choosing it, by scenario id (the developer picker). */
const SCENARIO_BLURB: Readonly<Record<string, string>> = {
  stable: "Long expansions and mild recessions. New industries arrive early and grow fast.",
  unstable: "Strong growth broken by deep downturns, tight credit and more failures.",
  stagnation: "Slow growth and low rates. Few new firms, and new industries arrive late.",
  random: "The seed picks one of the three, and its name stays hidden until 2020.",
};

/** Seeds the picker offers stay below this, a whole number any save or log can carry. */
const SEED_RANGE = 2 ** 31;

function randomSeed(): number {
  return Math.floor(Math.random() * SEED_RANGE);
}

/** A whole, non-negative seed from the field's text, or null. */
export function parseSeed(text: string): number | null {
  const n = Number(text.trim());
  return text.trim() !== "" && Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/** What each phase of a long start is called on the progress screen (protocol.ts `ProgressPhase`). */
export const PHASE_LABEL: Readonly<Record<ProgressInfo["phase"], string>> = {
  Load: "Reading the start",
  Presim: "Living through the years to 2020",
  Hydrate: "Filling in 2020",
  Save: "Writing the save",
};

/**
 * The baked starts the sim listed in `Ready` (pivot 3.5). The store keeps them in `status.starts`
 * once the contracts change adds it (design proposal in D1050); until then there are none.
 */
export function startsOf(status: Status): readonly BakedStart[] {
  return (status as Status & { starts?: readonly BakedStart[] }).starts ?? [];
}

/** What the picker asks of the game. Each answers with the sim's reply. */
export interface NewGameApi {
  /** A baked start (`Ready.starts`). */
  baked: (id: string) => Promise<Reply>;
  /** A new history (`start: { kind: "generate" }`); `seed` drives it. */
  generate: (seed: number) => Promise<Reply>;
  /** The developer picker: the 1995 world's own first day, under a scenario. */
  scenario: (seed: number, scenario: string) => Promise<Reply>;
  /** Stops the running generation. */
  cancel: () => void;
  load: (file: File | undefined) => void;
}

type Busy = "baked" | "generate" | "scenario";

/** The progress screen of a generated history: the phase, how far, the date reached, and Cancel. */
export function GeneratingScreen({
  progress,
  onCancel,
}: {
  progress: ProgressInfo | null;
  onCancel: () => void;
}) {
  const fraction =
    progress !== null && progress.total > 0 ? Math.min(1, progress.done / progress.total) : null;
  return (
    <div className="new-game new-game-busy" data-testid="new-game-progress" aria-live="polite">
      <h1>Generating a new history</h1>
      <p className="new-game-phase" data-testid="new-game-phase">
        {progress === null ? "Starting" : PHASE_LABEL[progress.phase]}
      </p>
      {/* An indeterminate bar until the first report arrives. */}
      <progress
        data-testid="new-game-bar"
        {...(fraction === null ? {} : { value: fraction, max: 1 })}
        aria-label="Progress"
      />
      <p className="new-game-detail">
        {fraction !== null && <span data-testid="new-game-percent">{Math.floor(fraction * 100)}%</span>}
        {progress?.date != null && <span data-testid="new-game-date">Reached {fmtDate(progress.date)}</span>}
      </p>
      <button type="button" data-testid="new-game-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

export function NewGamePicker({
  choices,
  starts = [],
  progress = null,
  dev = false,
  api,
}: {
  choices: NewGameChoices;
  /** The baked starts (`startsOf(status)`). */
  starts?: readonly BakedStart[];
  /** The running request's progress (`status.progress`). */
  progress?: ProgressInfo | null;
  /** Shows the developer's scenario and seed picker. */
  dev?: boolean;
  api: NewGameApi;
}) {
  const [seedText, setSeedText] = useState(() => String(randomSeed()));
  const [busy, setBusy] = useState<Busy | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const seed = parseSeed(seedText);

  /** Runs a start; on anything but success the picker comes back and says why. */
  const run = async (kind: Busy, request: () => Promise<Reply>) => {
    setBusy(kind);
    setProblem(null);
    const r = await request();
    if (r.kind === "Ok") return;
    setBusy(null);
    setProblem(
      r.kind === "Cancelled"
        ? "Cancelled. Nothing was started."
        : (replyProblem(r) ?? "The game did not start."),
    );
  };

  if (busy === "generate") return <GeneratingScreen progress={progress} onCancel={api.cancel} />;
  return (
    <div className="new-game" data-testid="new-game">
      <h1>New game</h1>
      <p>You watch the 2020 election year unfold. Pick where it starts.</p>
      {problem !== null && (
        <p className="new-game-problem" role="alert" data-testid="new-game-error">
          {problem}
        </p>
      )}
      <div className="new-game-choices" data-testid="new-game-starts">
        {starts.map((s) => (
          <button
            key={s.id}
            type="button"
            data-testid={`new-game-baked-${s.id}`}
            disabled={busy !== null}
            onClick={() => void run("baked", () => api.baked(s.id))}
          >
            <strong>{s.label}</strong>
            <span>Ready to play, from {s.date}. Starts at once.</span>
          </button>
        ))}
        <button
          type="button"
          data-testid="new-game-generate"
          disabled={busy !== null || seed === null}
          onClick={() => seed !== null && void run("generate", () => api.generate(seed))}
        >
          <strong>Generate a new history</strong>
          <span>
            Runs the world forward from {choices.world_id} to 2020 and plays it out as a fresh history. It
            takes a few seconds to a minute, and you can cancel.
          </span>
        </button>
      </div>
      {dev && (
        <details className="new-game-dev" data-testid="new-game-dev">
          <summary>Developer start: {choices.world_id} with a scenario and a seed</summary>
          <div className="new-game-choices">
            {choices.scenarios.map((s) => (
              <button
                key={s.id}
                type="button"
                data-testid={`new-game-scenario-${s.id}`}
                disabled={seed === null || busy !== null}
                onClick={() => seed !== null && void run("scenario", () => api.scenario(seed, s.id))}
              >
                <strong>{s.label}</strong>
                <span>{SCENARIO_BLURB[s.id] ?? ""}</span>
              </button>
            ))}
          </div>
        </details>
      )}
      <div className="new-game-foot">
        {dev && (
          <>
            <label>
              Seed{" "}
              <input
                data-testid="new-game-seed"
                value={seedText}
                inputMode="numeric"
                aria-invalid={seed === null}
                onChange={(e) => setSeedText(e.target.value)}
              />
            </label>
            <button
              type="button"
              data-testid="new-game-new-seed"
              onClick={() => setSeedText(String(randomSeed()))}
            >
              New seed
            </button>
          </>
        )}
        <button type="button" data-testid="new-game-load" onClick={() => file.current?.click()}>
          Load a save
        </button>
        <input
          ref={file}
          type="file"
          hidden
          data-testid="new-game-file"
          onChange={(e) => {
            api.load(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
