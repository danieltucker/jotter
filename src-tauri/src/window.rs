use crate::note::Note;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn open_note_window(app: &AppHandle, note: &Note) -> tauri::Result<()> {
    if app.get_webview_window(&note.id).is_some() {
        return Ok(());
    }

    let url = WebviewUrl::App(format!("index.html?id={}", note.id).into());
    let window = WebviewWindowBuilder::new(app, note.id.clone(), url)
        .title("Sticky Note")
        .inner_size(note.width, note.height)
        .position(note.x, note.y)
        .min_inner_size(200.0, 180.0)
        .decorations(false)
        .transparent(true)
        .resizable(true)
        .shadow(false)
        .always_on_top(note.always_on_top)
        .build()?;

    let window_for_events = window.clone();
    let app_handle = app.clone();
    let id = note.id.clone();

    window.on_window_event(move |event| match event {
        tauri::WindowEvent::Moved(_) => {
            // While docked, the window is a tiny tab being resized/positioned
            // by the dock transition itself — not a real geometry change to
            // persist, and not a user drag to settle-check either.
            if crate::edge::is_docked(&app_handle, &id) {
                return;
            }
            if let Ok(pos) = window_for_events.outer_position() {
                let scale = window_for_events.scale_factor().unwrap_or(1.0);
                let logical = pos.to_logical::<f64>(scale);
                crate::commands::persist_geometry(&app_handle, &id, Some((logical.x, logical.y)), None);
            }
            crate::edge::schedule_settle_check(&app_handle, &id);
        }
        tauri::WindowEvent::Resized(_) => {
            if crate::edge::is_docked(&app_handle, &id) {
                return;
            }
            if let Ok(size) = window_for_events.inner_size() {
                let scale = window_for_events.scale_factor().unwrap_or(1.0);
                let logical = size.to_logical::<f64>(scale);
                crate::commands::persist_geometry(
                    &app_handle,
                    &id,
                    None,
                    Some((logical.width, logical.height)),
                );
            }
        }
        tauri::WindowEvent::Destroyed => {
            crate::commands::flush_note(&app_handle, &id);
        }
        _ => {}
    });

    Ok(())
}
