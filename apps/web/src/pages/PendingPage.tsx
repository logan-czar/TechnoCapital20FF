// The page of a kind that has no registered page yet (the TS port's stand-in for the Rust
// placeholder pages): its title and kind, a note saying it is not ported, and a way home. The
// later page lanes replace it kind by kind (docs/build/ts-pages-guide.md).

import { Link } from "../links/Link.tsx";
import type { NameIndex } from "../links/names.ts";
import { ChipRow, Note, PageHeader } from "./parts.tsx";
import { kindName, type PageRef } from "./ref.ts";

/** The note a pending page shows (the tests look for it). */
export const PENDING_NOTE = "Not ported yet";

export function PendingPage({ page, index }: { page: PageRef; index: NameIndex }) {
  return (
    <div className="doc">
      <PageHeader title={index.title(page)} kind={kindName(page.kind)} note={PENDING_NOTE} />
      <Note>
        This page comes in a later step of the TypeScript port. Its links and figures will read the views.
      </Note>
      <ChipRow>
        <Link page={{ kind: "world" }}>World</Link>
        <Link page={{ kind: "settings" }}>Settings</Link>
      </ChipRow>
    </div>
  );
}
