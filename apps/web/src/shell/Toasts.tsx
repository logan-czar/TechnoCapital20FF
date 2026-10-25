// What went wrong, or what the player should know, from a request: a refused control, a bad save.
// A message fades after a few seconds; the player can dismiss it earlier.

import { useEffect } from "react";
import { useMessages, useSim } from "../sim/hooks.ts";
import type { Message } from "../sim/store.ts";

/** How long a message stays. */
export const TOAST_MS = 8000;

function Toast({ message }: { message: Message }) {
  const { store } = useSim();
  useEffect(() => {
    const t = setTimeout(() => store.dismissMessage(message.id), TOAST_MS);
    return () => clearTimeout(t);
  }, [store, message.id]);
  return (
    <div className={`toast ${message.level}`} role={message.level === "error" ? "alert" : "status"}>
      <span>{message.text}</span>
      <button type="button" aria-label="Dismiss" onClick={() => store.dismissMessage(message.id)}>
        x
      </button>
    </div>
  );
}

export function Toasts() {
  const messages = useMessages();
  if (messages.length === 0) return null;
  return (
    <div className="toasts">
      {messages.map((m) => (
        <Toast key={m.id} message={m} />
      ))}
    </div>
  );
}
