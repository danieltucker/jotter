use crate::note::{self, Note};
use crate::state::AppState;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

pub fn persist_geometry(
    app: &AppHandle,
    id: &str,
    pos: Option<(f64, f64)>,
    size: Option<(f64, f64)>,
) {
    let state = app.state::<AppState>();
    let dir = note::notes_dir(app);
    let mut notes = state.notes.lock().unwrap();
    let Some(n) = notes.get_mut(id) else {
        return;
    };

    if let Some((x, y)) = pos {
        n.x = x;
        n.y = y;
    }
    if let Some((w, h)) = size {
        n.width = w;
        n.height = h;
    }
    n.updated_at = chrono::Utc::now().to_rfc3339();

    let mut last_write = state.last_geometry_write.lock().unwrap();
    let now = Instant::now();
    let should_write = match last_write.get(id) {
        Some(t) => now.duration_since(*t) > Duration::from_millis(400),
        None => true,
    };
    if should_write {
        note::save(&dir, n);
        last_write.insert(id.to_string(), now);
    }
}

/// Force-write a note's current in-memory state to disk, bypassing the throttle.
/// Used when a window is destroyed so the final position/size is never lost.
pub fn flush_note(app: &AppHandle, id: &str) {
    let state = app.state::<AppState>();
    let dir = note::notes_dir(app);
    let notes = state.notes.lock().unwrap();
    if let Some(n) = notes.get(id) {
        note::save(&dir, n);
    }
}

#[tauri::command]
pub fn get_note(app: AppHandle, id: String) -> Option<Note> {
    let state = app.state::<AppState>();
    let notes = state.notes.lock().unwrap();
    notes.get(&id).cloned()
}

#[tauri::command]
pub fn list_notes(app: AppHandle) -> Vec<Note> {
    let state = app.state::<AppState>();
    let mut notes: Vec<Note> = state.notes.lock().unwrap().values().cloned().collect();
    notes.sort_by(|a, b| a.created_at.cmp(&b.created_at));
    notes
}

#[tauri::command]
pub fn create_note(app: AppHandle) -> Note {
    crate::app::spawn_new_note(&app)
}

#[tauri::command]
pub fn create_about_note(app: AppHandle) -> Note {
    crate::app::spawn_about_note(&app)
}

#[tauri::command]
pub fn save_note_content(app: AppHandle, id: String, content: String) {
    let state = app.state::<AppState>();
    let dir = note::notes_dir(&app);
    let mut notes = state.notes.lock().unwrap();
    if let Some(n) = notes.get_mut(&id) {
        n.content = content;
        n.updated_at = chrono::Utc::now().to_rfc3339();
        note::save(&dir, n);
    }
}

#[tauri::command]
pub fn set_note_color(app: AppHandle, id: String, color: String) {
    let state = app.state::<AppState>();
    let dir = note::notes_dir(&app);
    let mut notes = state.notes.lock().unwrap();
    if let Some(n) = notes.get_mut(&id) {
        n.color = color;
        n.updated_at = chrono::Utc::now().to_rfc3339();
        note::save(&dir, n);
    }
}

#[tauri::command]
pub fn toggle_always_on_top(app: AppHandle, id: String, value: bool) {
    if let Some(win) = app.get_webview_window(&id) {
        let _ = win.set_always_on_top(value);
    }
    let state = app.state::<AppState>();
    let dir = note::notes_dir(&app);
    let mut notes = state.notes.lock().unwrap();
    if let Some(n) = notes.get_mut(&id) {
        n.always_on_top = value;
        note::save(&dir, n);
    }
}

#[tauri::command]
pub fn delete_note(app: AppHandle, id: String) {
    let state = app.state::<AppState>();
    let dir = note::notes_dir(&app);
    note::delete(&dir, &id);
    state.notes.lock().unwrap().remove(&id);
    if let Some(win) = app.get_webview_window(&id) {
        let _ = win.close();
    }
}

#[tauri::command]
pub fn minimize_note_window(app: AppHandle, id: String) {
    if let Some(win) = app.get_webview_window(&id) {
        let _ = win.minimize();
    }
}

#[tauri::command]
pub fn show_all_notes(app: AppHandle) {
    crate::app::show_all(&app);
}
