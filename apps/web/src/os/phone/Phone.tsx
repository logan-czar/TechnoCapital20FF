// The phone (pivot 15.2, 12): a device docked above the right end of the taskbar. Put down, it is
// out of sight and the taskbar's phone button shows the count of new notifications; picked up, it
// shows the notifications and the apps that have a compact form (os/apps.ts `PhoneView`), one at a
// time.
//
// For now the notifications are the notices the old Alerts button counted, less the player's own
// pauses: an alert whose level is not Log only, and a pause the game made. Pivot 12's own list (the player's alert rules, 14.4, and the fixed
// list, 2.4) replaces the filter when those exist. The screen is mounted only while the phone is
// up, so a phone left down reads no views.

import { formatDateTime, type Notice } from "@tc20ff/sim";
import { memo, Suspense, useEffect, useState } from "react";
import { useNames } from "../../shell/names.ts";
import { describeNotice } from "../../shell/text.ts";
import { useClock, useNotices } from "../../sim/hooks.ts";
import type { AppSpec } from "../apps.ts";
import { Icon } from "../icons.tsx";

/** The most notifications the phone lists, newest first. */
export const PHONE_MAX_NOTIFICATIONS = 60;

/**
 * True for a notice the phone shows (see the header). A pause the player made (the pause button, a
 * step that ran out) is no news to them and is left out.
 */
export function isNotification(n: Notice): boolean {
  if (n.kind === "Alert") return n.level !== "Log";
  return n.kind === "Paused" && n.reason.kind !== "Player" && n.reason.kind !== "StepDone";
}

/** How many notifications arrived after notice number `seen`. */
export function useUnread(seen: number): number {
  const notices = useNotices();
  let count = 0;
  for (const e of notices) if (e.seq > seen && isNotification(e.notice)) count++;
  return count;
}

function Notifications() {
  const notices = useNotices();
  const names = useNames();
  const shown = notices.filter((e) => isNotification(e.notice)).slice(-PHONE_MAX_NOTIFICATIONS);
  if (shown.length === 0) {
    return <p className="os-phone-empty">Nothing yet. Alerts and pauses will show up here.</p>;
  }
  return (
    <ol className="os-phone-notes" data-testid="phone-notifications">
      {[...shown].reverse().map((e) => {
        const d = describeNotice(e.notice, names.company);
        return (
          <li key={e.seq} data-severity={d.severity}>
            <span className="os-phone-note-text">{d.text}</span>
            <time className="os-phone-note-when">{formatDateTime(e.time)}</time>
          </li>
        );
      })}
    </ol>
  );
}

function Screen({ apps, onSeen }: { apps: readonly AppSpec[]; onSeen: (seq: number) => void }) {
  const clock = useClock();
  const notices = useNotices();
  const [appId, setAppId] = useState<string | null>(null);
  // Each phone app keeps its own place while the phone is up.
  const [routes, setRoutes] = useState<Readonly<Record<string, string | null>>>({});
  const app = apps.find((a) => a.id === appId) ?? null;
  const View = app?.PhoneView;

  // Whatever arrives while the phone is up has been seen.
  const latest = notices.at(-1)?.seq ?? 0;
  useEffect(() => onSeen(latest), [latest, onSeen]);

  return (
    <div className="os-phone-screen">
      <div className="os-phone-status">
        <span>{clock ? `${String(clock.hour).padStart(2, "0")}:00` : "--:--"}</span>
        <span className="os-dim">{app ? app.title : "Notifications"}</span>
      </div>
      <div className="os-phone-content">
        {app && View ? (
          <Suspense fallback={<p className="os-phone-empty">Opening {app.title}...</p>}>
            <View
              route={routes[app.id] ?? null}
              onRoute={(r) => setRoutes((old) => ({ ...old, [app.id]: r }))}
            />
          </Suspense>
        ) : (
          <Notifications />
        )}
      </div>
      {(apps.length > 0 || app) && (
        <nav className="os-phone-dock" aria-label="Phone apps">
          <button
            type="button"
            className={app ? "" : "on"}
            data-testid="phone-home"
            title="Notifications"
            aria-label="Notifications"
            onClick={() => setAppId(null)}
          >
            <Icon name="phone" size={20} />
          </button>
          {apps.map((a) => (
            <button
              type="button"
              key={a.id}
              className={a.id === appId ? "on" : ""}
              data-testid={`phone-app-${a.id}`}
              title={a.title}
              aria-label={a.title}
              onClick={() => setAppId(a.id)}
            >
              <Icon name={a.icon} size={20} />
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

export interface PhoneProps {
  open: boolean;
  onToggle: () => void;
  /** The apps the desktop lists; the phone shows those with a `PhoneView`. */
  apps: readonly AppSpec[];
  /** Told the number of the newest notice the player has seen. */
  onSeen: (seq: number) => void;
}

function PhoneInner({ open, onToggle, apps, onSeen }: PhoneProps) {
  const phoneApps = apps.filter((a) => a.PhoneView !== undefined);
  // Put down, the device is out of sight (the taskbar's phone button brings it back) and empty.
  return (
    <aside className="os-phone" data-testid="phone" data-open={open} hidden={!open} aria-label="Phone">
      {open && (
        <>
          <button
            type="button"
            className="os-phone-lip"
            data-testid="phone-down"
            title="Put the phone down"
            onClick={onToggle}
          >
            <span className="os-phone-speaker" aria-hidden="true" />
            <span className="os-phone-lip-text">Put down</span>
          </button>
          <Screen apps={phoneApps} onSeen={onSeen} />
        </>
      )}
    </aside>
  );
}

export const Phone = memo(PhoneInner);
