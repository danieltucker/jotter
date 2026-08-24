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
        // Created hidden; the frontend calls window.show() once it has
        // actually painted the note (see App.tsx), so there's nothing to
        // flash. An earlier attempt at fixing the flash by setting
        // `background_color` to the note's color, while keeping
        // `transparent(true)`, broke transparency instead: the rounded
        // corners rendered opaque white rather than see-through. Don't
        // combine those two again.
        .visible(false)
        .resizable(true)
        .shadow(false)
        .always_on_top(note.always_on_top)
        .build()?;

    let window_for_events = window.clone();
    let app_handle = app.clone();
    let id = note.id.clone();

    window.on_window_event(move |event| match event {
        tauri::WindowEvent::Moved(_) => {
            if let Ok(pos) = window_for_events.outer_position() {
                let scale = window_for_events.scale_factor().unwrap_or(1.0);
                let logical = pos.to_logical::<f64>(scale);
                crate::commands::persist_geometry(&app_handle, &id, Some((logical.x, logical.y)), None);
            }
        }
        tauri::WindowEvent::Resized(_) => {
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
