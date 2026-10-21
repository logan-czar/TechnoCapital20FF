//! The Settings page (D452, D453, D458): density, font size, saved layouts, the config file and
//! the keyboard shortcuts. It rebuilds whenever the config changes.

use bevy::prelude::*;

use super::placeholder::{chip_row, page_header};
use super::{PageAppExt, PageBuild, PageKind, PageSpec, Refresh};
use crate::config::{ConfigStore, Density, LoadOutcome, UiConfig};
use crate::ui::theme::{self, Tooltip, color, font};
use crate::workspace::{PaneAction, SHORTCUTS};

pub const SECTIONS: &[super::SectionSpec] = &[
    ("display", "Display"),
    ("layouts", "Layouts"),
    ("keys", "Keyboard"),
    ("file", "Config file"),
];

pub fn register(app: &mut App) {
    app.register_page(
        PageKind::Settings,
        PageSpec::new(&[])
            .sections(SECTIONS)
            .refresh(Refresh::OnConfigChange),
        settings_page,
    );
}

/// What a settings button does.
#[derive(Debug, Clone)]
enum Op {
    Density(Density),
    Font(i32),
    FontReset,
    Pane(PaneAction),
}

fn button(commands: &mut Commands, label: &str, active: bool, tip: &str, op: Op) -> Entity {
    commands
        .spawn((
            theme::button(label.to_owned(), color::CYAN),
            Tooltip(tip.to_owned()),
        ))
        .insert(theme::ButtonLook {
            active,
            accent: color::CYAN,
        })
        .observe(
            move |mut ev: On<PointerClick>,
                  mut cfg: ResMut<UiConfig>,
                  mut actions: MessageWriter<PaneAction>| {
                ev.propagate(false);
                match &op {
                    Op::Density(d) => cfg.density = *d,
                    Op::Font(s) => cfg.step_font(*s),
                    Op::FontReset => cfg.font_scale = 1.0,
                    Op::Pane(a) => {
                        actions.write(a.clone());
                    }
                }
            },
        )
        .id()
}

fn settings_page(
    In(b): In<PageBuild>,
    mut commands: Commands,
    cfg: Res<UiConfig>,
    store: Res<ConfigStore>,
) {
    page_header(&mut commands, b.head, "Settings", "UI config", "");
    if let Some(body) = b.section("display") {
        let row = chip_row(&mut commands, body);
        let l = commands.spawn(theme::muted("Density (Ctrl+J):")).id();
        commands.entity(row).add_child(l);
        for d in [Density::Compact, Density::Normal] {
            let e = button(
                &mut commands,
                d.name(),
                cfg.density == d,
                &format!("{} px table rows", d.row_height()),
                Op::Density(d),
            );
            commands.entity(row).add_child(e);
        }
        let row = chip_row(&mut commands, body);
        let l = commands
            .spawn(theme::muted(format!(
                "Font size {:.0}% (Ctrl+= / Ctrl+- / Ctrl+0):",
                cfg.font_scale * 100.0
            )))
            .id();
        commands.entity(row).add_child(l);
        for (label, op, tip) in [
            ("-", Op::Font(-1), "Smaller"),
            ("+", Op::Font(1), "Larger"),
            ("reset", Op::FontReset, "100%"),
        ] {
            let e = button(&mut commands, label, false, tip, op);
            commands.entity(row).add_child(e);
        }
    }
    if let Some(body) = b.section("layouts") {
        let row = chip_row(&mut commands, body);
        let next = (1..)
            .map(|i| format!("Layout {i}"))
            .find(|n| !cfg.layouts.contains_key(n))
            .unwrap_or_default();
        let save = button(
            &mut commands,
            &format!("Save the workspace as \"{next}\""),
            false,
            "Or in the command bar: layout save NAME",
            Op::Pane(PaneAction::SaveLayout(next.clone())),
        );
        commands.entity(row).add_child(save);
        if cfg.layouts.is_empty() {
            let e = commands.spawn(theme::muted("No saved layouts.")).id();
            commands.entity(body).add_child(e);
        }
        for (name, l) in &cfg.layouts {
            let row = chip_row(&mut commands, body);
            let n = commands
                .spawn(theme::text_line(
                    format!("{name} ({} panes)", count(&l.root)),
                    font::BODY,
                    color::TEXT,
                ))
                .id();
            let load = button(
                &mut commands,
                "load",
                false,
                "Replace the workspace with this layout",
                Op::Pane(PaneAction::LoadLayout(name.clone())),
            );
            let del = button(
                &mut commands,
                "delete",
                false,
                "Delete this layout",
                Op::Pane(PaneAction::DeleteLayout(name.clone())),
            );
            commands.entity(row).add_children(&[n, load, del]);
        }
    }
    if let Some(body) = b.section("keys") {
        for (keys, what) in SHORTCUTS {
            let row = chip_row(&mut commands, body);
            let k = commands
                .spawn((
                    Node {
                        width: px(230.0),
                        min_width: px(230.0),
                        ..default()
                    },
                    children![theme::text_line(*keys, font::SMALL, color::CYAN)],
                ))
                .id();
            let w = commands
                .spawn(theme::text_line(*what, font::SMALL, color::TEXT))
                .id();
            commands.entity(row).add_children(&[k, w]);
        }
    }
    if let Some(body) = b.section("file") {
        let path = store.path().map_or(
            "none (this run keeps its settings in memory)".to_owned(),
            |p| p.display().to_string(),
        );
        let outcome = match &store.outcome {
            Some(LoadOutcome::Loaded) => "loaded at startup".to_owned(),
            Some(LoadOutcome::Missing) => "not found at startup: defaults".to_owned(),
            Some(LoadOutcome::Corrupt { error, .. }) => {
                format!("unreadable at startup, moved aside: {error}")
            }
            None => String::new(),
        };
        for line in [format!("File: {path}"), outcome] {
            if !line.is_empty() {
                let e = commands.spawn(theme::muted(line)).id();
                commands.entity(body).add_child(e);
            }
        }
    }
}

fn count(n: &crate::workspace::SavedNode) -> usize {
    match n {
        crate::workspace::SavedNode::Pane { .. } => 1,
        crate::workspace::SavedNode::Split { first, second, .. } => count(first) + count(second),
    }
}
