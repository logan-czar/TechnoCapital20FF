# App lane addendum (M2 UI lanes; read after lane-preamble.md)

You are building ONE app of the game's fake desktop OS ("Orrery"), in your own folder `apps/web/src/apps/<id>/` (and tests in `apps/web/test/apps/<id>/`). A placeholder `app.tsx` already exists there: replace its component, keep its id.

Read before writing code
- docs/build/pivot-lanes.md: your lane's row and "What each lane finds waiting".
- apps/web/src/os/apps.ts (`AppSpec`, `AppProps`: route, navigate, close, setTitle), apps/web/src/os/os.css (the OS's colour and type tokens, `--os-*`), apps/web/src/apps/_shared/ (EntityLink, PersonChip, ListTable, party colours, formatters: use them, do not copy or edit them), apps/web/src/apps/debug/ as a working example of an app.
- The view types you consume in packages/sim/src/types/views/ (read their doc comments: they say what is hidden, what is a delta, what is a slice), apps/web/src/sim/hooks.ts (`useViewData`, `useViewDataThrottled`, `useSlice`) and how the client sends actions (`client.act`, controls).
- apps/web/src/sim/mock/README.md: the mock world you build against (it starts paused on 2020-10-20; scripted events and their dates are listed; two 168-hour Steps reach election day).
- The spec sections your task names in docs/design/pivot/spec.md. The player sees only published information: never show hidden stats unless the field is non-null (Omniscient).
- If the `frontend-design:frontend-design` skill is available to you, load it and follow it.

How to build
- The UI reads only views and slices through the hooks, and sends only Controls and PlayerActions. Never import `@tc20ff/sim/internal`. Never import another app's folder (the boundary scan refuses it): cross-app navigation goes through `EntityLink` / `openApp`.
- Subscribe narrowly: an app that is closed or minimised is unmounted; inside the app, only mount hooks for the view the current route shows; heavy data comes through `useSlice` for the one item on screen. Long lists are virtualised (`ListTable`).
- Routing: the app's whole state that matters is in its `route` string (so links, back/forward and persistence work): define a small route grammar (for example `race/123`, `person/45`, `bill/7`), a pure parser/formatter with unit tests, in-app back/forward, and call `setTitle`.
- Look: each app is a distinct in-world product with its own invented name and a restrained identity (its own accent and masthead) sitting inside the OS window chrome, built from CSS variables in the app's own CSS file (`apps/<id>/<id>.css`, scoped under one root class; do not edit os.css or styles.css). Data-dense, legible at 1366x768 and in a window as small as 480x360 (use container queries or a compact layout), keyboard reachable, no external images or fonts, no real-world brands, people or outlets. Empty, loading and error states are designed, not blank.
- Stable test ids on the app root (`app-root-<id>`), primary lists, rows (`<kind>-row-<id>`) and controls.
- Tests (Node/happy-dom with React Testing Library, as apps/web/test/apps or test/os do; build the mock host in-process as apps/web/test/mock/common.ts does): the route codec; rendering each route against the mock at start; after stepping the mock to a scripted event relevant to your app the UI shows it; links produce the right `openApp` target; hidden fields are not shown when null and are shown when Omniscient is on; one test at a narrow width.
- See it for real: build nothing global, but once your tests pass, look at your app in the actual Electron shell with the driver: `bash scripts/heavy.sh node apps/desktop/scripts/drive.ts --mock --steps <your steps json>` (it launches with --background; see apps/desktop/README.md "Driving the app by hand"; it needs a current build: `corepack pnpm@10.20.0 desktop:build` under the lock) taking screenshots at 1600x900 of each main route into `.claude/scratch/`, then READ the screenshots and fix what looks wrong (overflow, clipped text, unreadable contrast, empty panes). Say in your report what you saw. Do not add e2e tests or screenshot baselines unless your task says so.
- Final check: `CHECK_FAST_BASE=<base> bash scripts/heavy.sh bash scripts/check-fast.sh web`.
