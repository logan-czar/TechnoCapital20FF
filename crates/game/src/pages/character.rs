//! The Character page (M9 B1; spec 3.7.1, 3.7.2, 9.2 `get_character`): a full character's
//! name, age, skills, traits, home province and country (links), roles (seats, directorships,
//! control, owner of record, founder) with company links, and holdings. Partial characters
//! (3.7.1) have no page; they are marked where they sit and are not linked (PR #27 notes). A
//! character's cash is private and not in the view.

use bevy::prelude::*;
use sim::SimViews;
use sim::views::characters::Role;
use sim::world::CharacterId;

use super::company::{skills_text, traits_text};
use super::doc::{Block, Field, PageDoc, SectionDoc, Span, TableDoc, spawn_doc};
use super::{PageAppExt, PageBuild, PageKind, PageRef, PageSpec, Refresh, SectionSpec, ViewKey};
use crate::bridge::Views;
use crate::command::index::NameIndex;
use crate::config::UiConfig;
use crate::links::names;
use crate::table::{Cell, Column, TableModel};

pub const SECTIONS: &[SectionSpec] = &[
    ("profile", "Profile"),
    ("roles", "Roles"),
    ("holdings", "Holdings"),
];

pub const VIEWS: &[ViewKey] = &[ViewKey::Characters, ViewKey::CompanyRows];

pub fn register(app: &mut App) {
    app.register_page(
        PageKind::Character,
        PageSpec::new(VIEWS)
            .sections(SECTIONS)
            .refresh(Refresh::OnViewChange)
            .patchable(),
        character_page,
    );
}

fn character_page(
    In(b): In<PageBuild>,
    mut commands: Commands,
    views: Res<Views>,
    index: Res<NameIndex>,
    cfg: Res<UiConfig>,
) {
    let PageRef::Character(id) = b.page else {
        return;
    };
    let doc = character_doc(id, &views, &index);
    spawn_doc(&mut commands, &b, &doc, &views, &cfg, None);
}

/// What a role is at its company, for the roles table.
fn role_kind(r: &Role) -> &'static str {
    match r {
        Role::Seat { .. } => "Board seat",
        Role::Director { .. } => "Director",
        Role::Controller { .. } => "Controller",
        Role::OwnerOfRecord { .. } => "Owner of record",
        Role::Founder { .. } => "Founder",
    }
}

/// The whole Character page as data.
pub fn character_doc(id: CharacterId, v: &SimViews, index: &NameIndex) -> PageDoc {
    let page = PageRef::Character(id);
    let mut doc = PageDoc {
        page: page.clone(),
        title: index.title(&page),
        kind: PageKind::Character.name().to_owned(),
        chips: Vec::new(),
        head: Vec::new(),
        sections: Vec::new(),
    };
    let Some(c) = v.characters.get().get(id) else {
        doc.head.push(Block::Line(vec![Span::muted(
            "No such character in the views.",
        )]));
        return doc;
    };
    let mut head = vec![Field::text("Age", c.age.to_string())];
    head.push(match &c.home {
        Some(h) => Field::new(
            "Home",
            vec![match names::place(v, h.province) {
                Some((n, p)) => Span::link(n, p),
                None => Span::text(h.province_name.clone()),
            }],
        ),
        None => Field::new("Home", vec![Span::muted("none (a partial character)")]),
    });
    if let Some(h) = &c.home {
        head.push(Field::link(
            "Country",
            h.country_name.clone(),
            PageRef::Country(h.country),
        ));
    }
    head.push(Field::text(
        "Kind",
        if c.full {
            format!("full character ({})", c.tier)
        } else {
            "partial character".to_owned()
        },
    ));
    doc.head.push(Block::Fields(head));
    // Roles, in company order.
    let company = |co| {
        let p = PageRef::Company(co);
        Cell::Link(p.clone(), index.title(&p))
    };
    let role_rows: Vec<Vec<Cell>> = c
        .roles
        .iter()
        .map(|r| {
            let (label, co) = names::role(r);
            vec![
                company(co),
                Cell::Text(role_kind(r).into()),
                Cell::Text(label.into()),
            ]
        })
        .collect();
    let mut summary = Vec::new();
    for r in &c.roles {
        let (_, co) = names::role(r);
        let p = PageRef::Company(co);
        let title = index.title(&p);
        summary.push(Field::new(
            role_kind(r),
            vec![
                Span::text(names::role(r).0),
                Span::muted("at"),
                Span::link(title, p),
            ],
        ));
    }
    let holdings: Vec<Vec<Cell>> = c
        .holdings
        .iter()
        .map(|h| {
            vec![
                company(h.company),
                Cell::Int(h.shares as i64),
                Cell::Percent(h.share),
            ]
        })
        .collect();
    doc.sections = vec![
        SectionDoc {
            id: "profile",
            blocks: vec![Block::Fields(vec![
                Field::text("Skills", skills_text(&c.skills)),
                Field::text("Traits", traits_text(&c.traits)),
            ])],
        },
        SectionDoc {
            id: "roles",
            blocks: if role_rows.is_empty() {
                vec![Block::Line(vec![Span::muted(
                    "No seat, directorship, control or founding role.",
                )])]
            } else {
                vec![
                    Block::Fields(summary),
                    Block::Table(TableDoc {
                        id: "character.roles".into(),
                        model: TableModel::new(
                            vec![
                                Column::text("Company", 220.0),
                                Column::text("Role", 120.0),
                                Column::text("As", 120.0),
                            ],
                            role_rows,
                        ),
                        live: None,
                    }),
                ]
            },
        },
        SectionDoc {
            id: "holdings",
            blocks: if holdings.is_empty() {
                vec![Block::Line(vec![Span::muted(
                    "No holdings in the cap tables.",
                )])]
            } else {
                vec![Block::Table(TableDoc {
                    id: "character.holdings".into(),
                    model: TableModel::new(
                        vec![
                            Column::text("Company", 220.0),
                            Column::number("Shares", 120.0),
                            Column::number("Share", 70.0)
                                .with_hint("Share of the company's shares outstanding"),
                        ],
                        holdings,
                    ),
                    live: None,
                })]
            },
        },
    ];
    doc
}
