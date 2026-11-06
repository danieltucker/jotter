use crate::note::Note;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn open_note_window(app: &AppHandle, note: &Note) -> tauri::Result<()> {
    if app.get_webview_window(&note.id).is_some() {
        return Ok(());
    }

    #[cfg(windows)]
    let (x, y) = on_screen_position(app, note.x, note.y);
    #[cfg(not(windows))]
    let (x, y) = (note.x, note.y);

    let url = WebviewUrl::App(format!("index.html?id={}", note.id).into());
    let builder = WebviewWindowBuilder::new(app, note.id.clone(), url)
        .title("Sticky Note")
        .inner_size(note.width, note.height)
        .position(x, y)
        .min_inner_size(200.0, 180.0)
        .decorations(false)
        // Created hidden; the frontend calls window.show() once it has
        // actually painted the note (see App.tsx), so there's nothing to
        // flash. An earlier attempt at fixing the flash by setting
        // `background_color` to the note's color, while keeping
        // `transparent(true)`, broke transparency instead: the rounded
        // corners rendered opaque white rather than see-through. Don't
        // combine those two again.
        .visible(false)
        .resizable(true)
        .always_on_top(note.always_on_top);

    // Linux draws the rounded corners and shadow itself, in CSS, on a
    // transparent window. On Windows the DWM does it instead: an opaque
    // undecorated window with the frame shadow on gets Windows 11's own
    // rounded corners, shadow and hairline border (square with a shadow on
    // Windows 10), and src/index.css turns the CSS versions off.
    #[cfg(windows)]
    let builder = builder.transparent(false).shadow(true);
    #[cfg(not(windows))]
    let builder = builder.transparent(true).shadow(false);

    let window = builder.build()?;

    let window_for_events = window.clone();
    let app_handle = app.clone();
    let id = note.id.clone();

    window.on_window_event(move |event| match event {
        // Windows parks a minimized window at (-32000, -32000) and shrinks
        // it to a stub, reporting both as ordinary moves and resizes; saving
        // those would reopen the note tiny and off-screen.
        tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_)
            if window_for_events.is_minimized().unwrap_or(false) => {}
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

/// Windows restores a window wherever it's told, even somewhere no monitor
/// covers any more (a laptop undocked from the external display a note was
/// saved on), where the note would be open but unreachable. If the note's
/// header wouldn't land on any connected monitor, bring it back onto the
/// primary one. The file keeps the old position until the note is moved.
#[cfg(windows)]
fn on_screen_position(app: &AppHandle, x: f64, y: f64) -> (f64, f64) {
    let Ok(monitors) = app.available_monitors() else {
        return (x, y);
    };
    if monitors.is_empty() {
        return (x, y);
    }

    // A point a little way into the header: enough of the note to grab.
    let (grab_x, grab_y) = (x + 40.0, y + 12.0);
    let visible = monitors.iter().any(|m| {
        let scale = m.scale_factor();
        let pos = m.position().to_logical::<f64>(scale);
        let size = m.size().to_logical::<f64>(scale);
        grab_x >= pos.x
            && grab_x < pos.x + size.width
            && grab_y >= pos.y
            && grab_y < pos.y + size.height
    });
    if visible {
        return (x, y);
    }

    let origin = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| m.position().to_logical::<f64>(m.scale_factor()))
        .map(|p| (p.x, p.y))
        .unwrap_or((0.0, 0.0));
    (origin.0 + 160.0, origin.1 + 140.0)
}
