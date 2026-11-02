// The new-game picker of a historical world (1995-rework 4.1): which scenario, by name or left to the
// seed, and the seed itself. The 2020 world has one start, so it never shows this.

import type { NewGameChoices } from "@tc20ff/sim";
import { useRef, useState } from "react";

/** What each scenario means to a player choosing it, by scenario id. */
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

export function NewGamePicker({
  choices,
  onStart,
  onLoad,
}: {
  choices: NewGameChoices;
  onStart: (seed: number, scenario: string) => void;
  onLoad: (file: File | undefined) => void;
}) {
  const [seedText, setSeedText] = useState(() => String(randomSeed()));
  const [starting, setStarting] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const seed = parseSeed(seedText);
  return (
    <div className="new-game">
      <h1>New game: {choices.world_id}</h1>
      <p>You watch from 1 January {choices.world_id} to 2020. Pick how the world goes.</p>
      <div className="new-game-choices">
        {choices.scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={seed === null || starting}
            onClick={() => {
              if (seed === null) return;
              setStarting(true);
              onStart(seed, s.id);
            }}
          >
            <strong>{s.label}</strong>
            <span>{SCENARIO_BLURB[s.id] ?? ""}</span>
          </button>
        ))}
      </div>
      <div className="new-game-foot">
        <label>
          Seed{" "}
          <input
            value={seedText}
            inputMode="numeric"
            aria-invalid={seed === null}
            onChange={(e) => setSeedText(e.target.value)}
          />
        </label>
        <button type="button" onClick={() => setSeedText(String(randomSeed()))}>
          New seed
        </button>
        <button type="button" onClick={() => file.current?.click()}>
          Load a save
        </button>
        <input
          ref={file}
          type="file"
          hidden
          onChange={(e) => {
            onLoad(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
