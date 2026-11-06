mod app;
mod commands;
mod note;
mod state;
mod window;

use state::AppState;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

fn new_note_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyN)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // Launching Jotter again from the Start menu or taskbar while it's
    // already running would otherwise start a second copy, opening a
    // duplicate window for every note with both copies writing the same
    // files. Instead the running copy brings its notes forward. (Must be
    // the first plugin registered.)
    #[cfg(windows)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        app::show_all(app);
    }));

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app_handle, shortcut, event| {
                    if event.state() == ShortcutState::Pressed && shortcut == &new_note_shortcut() {
                        app::spawn_new_note(app_handle);
                    }
                })
                .build(),
        )
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::get_note,
            commands::list_notes,
            commands::create_note,
            commands::create_about_note,
            commands::save_note_content,
            commands::set_note_color,
            commands::toggle_always_on_top,
            commands::delete_note,
            commands::minimize_note_window,
            commands::show_all_notes,
        ])
        .setup(|app| {
            let handle = app.handle();

            if let Err(err) = handle.global_shortcut().register(new_note_shortcut()) {
                eprintln!("could not register global shortcut for new note: {err}");
            }

            app::load_startup_notes(handle);

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_, _| {});
}
