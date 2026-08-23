use crate::note::{self, Note};
use crate::state::AppState;
use crate::window::open_note_window;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager};

const CASCADE_STEP: f64 = 32.0;
const CASCADE_MAX: f64 = 640.0;
const CASCADE_MIN: f64 = 120.0;

fn next_cascade_position(app: &AppHandle) -> (f64, f64) {
    let state = app.state::<AppState>();
    let mut cascade = state.cascade.lock().unwrap();
    let (x, y) = *cascade;

    let mut next_x = x + CASCADE_STEP;
    let mut next_y = y + CASCADE_STEP;
    if next_x > CASCADE_MIN + CASCADE_MAX {
        next_x = CASCADE_MIN;
    }
    if next_y > CASCADE_MIN + CASCADE_MAX {
        next_y = CASCADE_MIN;
    }
    *cascade = (next_x, next_y);

    (x, y)
}

pub fn spawn_new_note(app: &AppHandle) -> Note {
    let (x, y) = next_cascade_position(app);
    let note = Note::new(x, y);
    let dir = note::notes_dir(app);
    note::save(&dir, &note);

    {
        let state = app.state::<AppState>();
        state.notes.lock().unwrap().insert(note.id.clone(), note.clone());
    }

    let _ = open_note_window(app, &note);
    note
}

pub fn show_all(app: &AppHandle) {
    let notes: Vec<Note> = {
        let state = app.state::<AppState>();
        let map = state.notes.lock().unwrap();
        map.values().cloned().collect()
    };

    for note in notes {
        if let Some(win) = app.get_webview_window(&note.id) {
            let _ = win.show();
            let _ = win.unminimize();
            let _ = win.set_focus();
        } else {
            let _ = open_note_window(app, &note);
        }
    }
}

pub fn load_startup_notes(app: &AppHandle) {
    let dir = note::notes_dir(app);
    let notes = note::load_all(&dir);

    if notes.is_empty() {
        let mut welcome = Note::new(160.0, 140.0);
        welcome.content = note::WELCOME_CONTENT.to_string();
        note::save(&dir, &welcome);

        {
            let state = app.state::<AppState>();
            state.notes.lock().unwrap().insert(welcome.id.clone(), welcome.clone());
        }
        let _ = open_note_window(app, &welcome);
        return;
    }

    let all: Vec<Note> = {
        let state = app.state::<AppState>();
        let mut map = state.notes.lock().unwrap();
        for n in notes {
            map.insert(n.id.clone(), n);
        }
        map.values().cloned().collect()
    };

    for note in all {
        let _ = open_note_window(app, &note);
    }
}

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let new_note = MenuItem::with_id(app, "new_note", "New Sticky Note", true, None::<&str>)?;
    let show_all_item = MenuItem::with_id(app, "show_all", "Show All Notes", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Jotter", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&new_note, &show_all_item, &sep, &quit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "new_note" => {
                spawn_new_note(app);
            }
            "show_all" => {
                show_all(app);
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
