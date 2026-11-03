# TechnoCapital20FF

A modern-day cyberpunk grand strategy game: Crusader Kings style corporate feudalism and characters on top of a Wall Street Raider style economy and stock market.

Built in TypeScript for the browser: a deterministic sim in a Web Worker and a React UI with a deck.gl map
(one pnpm workspace; `corepack pnpm@10.20.0 dev` runs it). The MVP was first built in Rust with Bevy and ported
(D950, [docs/build/ts-migration-plan.md](docs/build/ts-migration-plan.md)); the Rust code is gone (D1017).

## Design

- MVP in plain English: [docs/design/mvp/mvp-summary.md](docs/design/mvp/mvp-summary.md)
- MVP spec: [docs/design/mvp/mvp-spec.md](docs/design/mvp/mvp-spec.md)
- Build plan: [docs/design/mvp/build-plan.md](docs/design/mvp/build-plan.md)
- Full design index: [docs/design/design-doc.md](docs/design/design-doc.md)

## Status

The MVP (a read-only map and business simulation) is built and ported to TypeScript. Next is the 1995 world
([docs/build/1995-rework-spec.md](docs/build/1995-rework-spec.md)); open work is in
[docs/build/ts-remaining-work.md](docs/build/ts-remaining-work.md).

## License

Proprietary. See [LICENSE](LICENSE).
