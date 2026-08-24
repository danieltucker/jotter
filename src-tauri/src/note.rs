use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub const DEFAULT_WIDTH: f64 = 280.0;
pub const DEFAULT_HEIGHT: f64 = 280.0;
pub const DEFAULT_COLOR: &str = "yellow";

pub const WELCOME_CONTENT: &str = "# Welcome to Jotter\n\nA simple markdown sticky-notes app for **Linux**. Type freely like a normal sticky note, or write **Markdown**, either standard syntax (converted automatically) or via `/` for a command menu: headings, lists, to-dos, quotes, code blocks, dividers.\n\n- [ ] Try a to-do, like this one\n\n> Quotes look like this\n\n```\n// code looks like this\nfunction greet(name) {\n  return `Hello, ${name}!`\n}\n```\n\n---\n\nThe menu icon (top-left, hidden until hovered) holds New Note, colors, and Delete Note. The pin icon (top-right) keeps a note on top of every other window, handy for one you want always visible.\n";

pub const ABOUT_CONTENT: &str = "# About Jotter\n\nMade by **Daniel Tucker**.\n\n[GitHub](https://github.com/danieltucker) · [Bluesky](https://bsky.app/profile/danielgt.com) · [Website](https://danielgt.com)\n\nCtrl+click a link to open it.\n";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub content: String,
    pub color: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub always_on_top: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl Note {
    pub fn new(x: f64, y: f64) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Note {
            id: uuid::Uuid::new_v4().to_string(),
            content: String::new(),
            color: DEFAULT_COLOR.to_string(),
            x,
            y,
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
            always_on_top: false,
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

pub fn notes_dir(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("no app data dir available")
        .join("notes");
    fs::create_dir_all(&dir).ok();
    dir
}

fn note_path(dir: &Path, id: &str) -> PathBuf {
    dir.join(format!("{id}.json"))
}

pub fn load_all(dir: &Path) -> Vec<Note> {
    let mut notes = vec![];
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(text) = fs::read_to_string(&path) {
                    if let Ok(note) = serde_json::from_str::<Note>(&text) {
                        notes.push(note);
                    }
                }
            }
        }
    }
    notes.sort_by(|a, b| a.created_at.cmp(&b.created_at));
    notes
}

pub fn save(dir: &Path, note: &Note) {
    let path = note_path(dir, &note.id);
    if let Ok(text) = serde_json::to_string_pretty(note) {
        let _ = fs::write(path, text);
    }
}

pub fn delete(dir: &Path, id: &str) {
    let _ = fs::remove_file(note_path(dir, id));
}
