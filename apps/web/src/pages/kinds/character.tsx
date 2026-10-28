// The Character page (crates/game/src/pages/character.rs, M9 B1; spec 3.7.1, 3.7.2, 9.2
// `get_character`): a full character's name, age, skills, traits, home province and country
// (links), roles (seats, directorships, control, owner of record, founder) with company links, and
// holdings. Partial characters (3.7.1) have no page; they are marked where they sit and are not
// linked (PR #27 notes). A character's cash is private and not in the view.

import type { CharacterId, CompanyId, Role } from "@tc20ff/sim";
import { type NameIndex, place, role } from "../../links/names.ts";
import type { Cell } from "../../widgets/cells.ts";
import { type Block, emptyDoc, type Field, field, notFound, type PageDoc, span } from "../doc.ts";
import { kindName, type PageRef } from "../ref.ts";
import type { SectionSpec } from "../sections.ts";
import { definePage } from "../spec.ts";
import { linkCell } from "../tables.ts";
import { byKey, type ViewsData } from "../views.ts";
import { skillsText, traitsText } from "./company.tsx";

export const SECTIONS: readonly SectionSpec[] = [
  { id: "profile", title: "Profile" },
  { id: "roles", title: "Roles" },
  { id: "holdings", title: "Holdings" },
];

/** What a role is at its company, for the roles table. */
function roleKind(r: Role): string {
  switch (r.kind) {
    case "Seat":
      return "Board seat";
    case "Director":
      return "Director";
    case "Controller":
      return "Controller";
    case "OwnerOfRecord":
      return "Owner of record";
    case "Founder":
      return "Founder";
  }
}

/** The whole Character page as data. */
export function characterDoc(id: CharacterId, v: ViewsData, index: NameIndex): PageDoc {
  const page: PageRef = { kind: "character", id };
  const doc = emptyDoc(page, index.title(page), kindName("character"));
  const c = byKey(v.characters?.full, (r) => r.id.id, id);
  if (!c) {
    doc.head.push(notFound("character"));
    return doc;
  }
  const head: Field[] = [field.text("Age", String(c.age))];
  if (c.home) {
    const pl = place(v, c.home.province);
    head.push(field.new("Home", [pl ? span.link(pl[0], pl[1]) : span.text(c.home.province_name)]));
    head.push(field.link("Country", c.home.country_name, { kind: "country", id: c.home.country }));
  } else {
    head.push(field.new("Home", [span.muted("none (a partial character)")]));
  }
  head.push(field.text("Kind", c.full ? `full character (${c.tier})` : "partial character"));
  doc.head.push({ k: "fields", fields: head });
  // Roles, in company order.
  const company = (co: CompanyId): Cell => linkCell(index, { kind: "company", id: co });
  const roleRows = c.roles.map((r): Cell[] => {
    const [label, co] = role(r);
    return [company(co), { k: "text", v: roleKind(r) }, { k: "text", v: label }];
  });
  const summary = c.roles.map((r) => {
    const [label, co] = role(r);
    const p: PageRef = { kind: "company", id: co };
    return field.new(roleKind(r), [span.text(label), span.muted("at"), span.link(index.title(p), p)]);
  });
  const holdings = c.holdings.map((h): Cell[] => [
    company(h.company),
    { k: "int", v: h.shares },
    { k: "percent", v: h.share },
  ]);
  const roles: Block[] =
    roleRows.length === 0
      ? [{ k: "line", spans: [span.muted("No seat, directorship, control or founding role.")] }]
      : [
          { k: "fields", fields: summary },
          {
            k: "table",
            table: {
              id: "character.roles",
              columns: [
                { title: "Company", width: 220 },
                { title: "Role", width: 120 },
                { title: "As", width: 120 },
              ],
              rows: roleRows,
            },
          },
        ];
  doc.sections = [
    {
      id: "profile",
      blocks: [
        {
          k: "fields",
          fields: [field.text("Skills", skillsText(c.skills)), field.text("Traits", traitsText(c.traits))],
        },
      ],
    },
    { id: "roles", blocks: roles },
    {
      id: "holdings",
      blocks:
        holdings.length === 0
          ? [{ k: "line", spans: [span.muted("No holdings in the cap tables.")] }]
          : [
              {
                k: "table",
                table: {
                  id: "character.holdings",
                  columns: [
                    { title: "Company", width: 220 },
                    { title: "Shares", width: 120 },
                    { title: "Share", width: 70, hint: "Share of the company's shares outstanding" },
                  ],
                  rows: holdings,
                },
              },
            ],
    },
  ];
  return doc;
}

export const pages = [
  definePage({
    kind: "character",
    views: ["characters", "company_rows", "places"],
    sections: SECTIONS,
    doc: (page, v, index) => characterDoc(page.id, v, index),
  }),
];
