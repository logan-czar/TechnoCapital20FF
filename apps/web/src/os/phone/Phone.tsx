// The phone (pivot 15.2, 12): a device docked above the right end of the taskbar. Put down, it is
// out of sight and the taskbar's phone button shows the count of unread notifications; picked up, it
// shows its home screen: a tile for each app that has a compact form (os/apps.ts `PhoneView`) and
// the notifications (v_notifications). An app opened from a tile fills the screen, and the back
// button (the phone's back gesture) returns home.
//
// A notification is read when the home screen shows it: the phone sends `NotificationsRead` for the
// newest one then (D1037; the view keeps `read_through`). Each item opens what its first `ref`
// names through `EntityLink`, and one that paused the game says so. The screen is mounted only
// while the phone is up, so a phone left down reads no views.

import { formatDateTime, type NotificationRow } from "@tc20ff/sim";
import { memo, Suspense, useEffect, useRef, useState } from "react";
import { EntityLink } from "../../apps/_shared/index.ts";
import { useClock, useSim, useViewData } from "../../sim/hooks.ts";
import type { AppSpec } from "../apps.ts";
import { Icon } from "../icons.tsx";
import { PHONE_MAX_NOTIFICATIONS, pausedTheGame } from "./notifications.ts";

export { PHONE_MAX_NOTIFICATIONS, pausedTheGame, unreadCount, useUnread } from "./notifications.ts";

/** What each kind of notification is called on the phone (pivot 2.4, 14.4). */
const KIND_LABEL: Readonly<Record<NotificationRow["kind"], string>> = {
  Fill: "Fill",
  Resolution: "Resolved",
  MarginCall: "Margin call",
  ElectionDay: "Election day",
  Holding: "Your holding",
  Alert: "Alert",
};

/** One notification: its text (a link when it names something), its kind, its time. */
function Note({
  row,
  unread,
  paused,
  current,
}: {
  row: NotificationRow;
  unread: boolean;
  paused: boolean;
  current: boolean;
}) {
  const ref = useRef<HTMLLIElement>(null);
  // The one the taskbar's pause note jumped to is brought into view.
  useEffect(() => {
    if (current) ref.current?.scrollIntoView?.({ block: "nearest" });
  }, [current]);
  const first = row.refs[0];
  return (
    <li
      ref={ref}
      data-testid={`phone-note-${row.id}`}
      data-kind={row.kind}
      data-unread={unread}
      data-paused={paused}
      data-current={current}
    >
      <span className="os-phone-note-head">
        <span className="os-phone-note-kind">{KIND_LABEL[row.kind]}</span>
        {paused && <span className="os-phone-note-pause">Paused the game</span>}
        {unread && <span className="os-phone-note-new">New</span>}
      </span>
      <span className="os-phone-note-text">
        {first === undefined ? row.text : <EntityLink to={first}>{row.text}</EntityLink>}
      </span>
      <time className="os-phone-note-when">{formatDateTime(row.time)}</time>
    </li>
  );
}

/** The notifications, newest first; marks them read while it is on screen. */
function Notifications({ jumpTo }: { jumpTo: number | null }) {
  const sim = useSim();
  const view = useViewData("notifications");
  const fixed = useClock()?.fixed_pauses;
  const items = view?.items ?? [];
  const newest = items.at(-1)?.id ?? -1;
  const readThrough = view?.read_through ?? -1;

  // Seen now: tell the sim, once for each newest notification (a refused act is not retried).
  const sent = useRef(-1);
  useEffect(() => {
    if (newest <= readThrough || newest <= sent.current) return;
    sent.current = newest;
    void sim.act({ kind: "NotificationsRead", through: newest });
  }, [sim, newest, readThrough]);

  // The unread ones stay marked for as long as this screen is up: the player sees what was new.
  const firstUnread = useRef(readThrough);
  if (items.length === 0) {
    return <p className="os-phone-empty">Nothing yet. Alerts and pauses will show up here.</p>;
  }
  return (
    <ol className="os-phone-notes" data-testid="phone-notifications">
      {items
        .slice(-PHONE_MAX_NOTIFICATIONS)
        .reverse()
        .map((n) => (
          <Note
            key={n.id}
            row={n}
            unread={n.id > firstUnread.current}
            paused={pausedTheGame(n, fixed)}
            current={n.id === jumpTo}
          />
        ))}
    </ol>
  );
}

/** The home screen: a tile for each phone app, then the notifications. */
function Home({
  apps,
  onOpen,
  jumpTo,
}: {
  apps: readonly AppSpec[];
  onOpen: (id: string) => void;
  jumpTo: number | null;
}) {
  return (
    <>
      {apps.length > 0 && (
        <ul className="os-phone-tiles" data-testid="phone-apps" aria-label="Phone apps">
          {apps.map((a) => (
            <li key={a.id}>
              <button type="button" data-testid={`phone-app-${a.id}`} onClick={() => onOpen(a.id)}>
                <Icon name={a.icon} size={26} />
                <span>{a.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <h2 className="os-phone-heading">Notifications</h2>
      <Notifications jumpTo={jumpTo} />
    </>
  );
}

function Screen({ apps, jumpTo }: { apps: readonly AppSpec[]; jumpTo: number | null }) {
  const clock = useClock();
  const [appId, setAppId] = useState<string | null>(null);
  // Each phone app keeps its own place while the phone is up.
  const [routes, setRoutes] = useState<Readonly<Record<string, string | null>>>({});
  const app = apps.find((a) => a.id === appId) ?? null;
  const View = app?.PhoneView;

  // A jump to a notification is on the home screen.
  useEffect(() => {
    if (jumpTo !== null) setAppId(null);
  }, [jumpTo]);

  return (
    <div className="os-phone-screen">
      <div className="os-phone-status">
        {app ? (
          <button
            type="button"
            className="os-phone-back"
            data-testid="phone-back"
            aria-label="Back to the home screen"
            title="Back"
            onClick={() => setAppId(null)}
          >
            <span aria-hidden="true">&lsaquo;</span> Back
          </button>
        ) : (
          <span>{clock ? `${String(clock.hour).padStart(2, "0")}:00` : "--:--"}</span>
        )}
        <span className="os-dim">{app ? app.title : "Home"}</span>
      </div>
      <div className="os-phone-content">
        {app && View ? (
          <Suspense fallback={<p className="os-phone-empty">Opening {app.title}...</p>}>
            <View
              route={routes[app.id] ?? null}
              onRoute={(r) => setRoutes((old) => ({ ...old, [app.id]: r }))}
              close={() => setAppId(null)}
              setTitle={() => {}}
            />
          </Suspense>
        ) : (
          <Home apps={apps} onOpen={setAppId} jumpTo={jumpTo} />
        )}
      </div>
    </div>
  );
}

export interface PhoneProps {
  open: boolean;
  onToggle: () => void;
  /** The apps the desktop lists; the phone shows those with a `PhoneView`. */
  apps: readonly AppSpec[];
  /** The notification the taskbar's pause note asked to show (its row id), or null. */
  jumpTo?: number | null | undefined;
}

function PhoneInner({ open, onToggle, apps, jumpTo = null }: PhoneProps) {
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
          <Screen apps={phoneApps} jumpTo={jumpTo} />
        </>
      )}
    </aside>
  );
}

export const Phone = memo(PhoneInner);
