use crate::note::Note;
use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;
use std::time::Instant;

pub struct AppState {
    pub notes: Mutex<HashMap<String, Note>>,
    pub last_geometry_write: Mutex<HashMap<String, Instant>>,
    pub cascade: Mutex<(f64, f64)>,
    /// Set once the tray icon is confirmed built. Some desktop environments
    /// (e.g. plain GNOME without the AppIndicator extension) lack the
    /// libappindicator library the tray icon needs; without it, the only way
    /// to quit would otherwise be the tray's Quit item, which never appears —
    /// see `app::setup_tray`.
    pub tray_active: AtomicBool,
}

impl Default for AppState {
    fn default() -> Self {
        AppState {
            notes: Mutex::new(HashMap::new()),
            last_geometry_write: Mutex::new(HashMap::new()),
            cascade: Mutex::new((120.0, 120.0)),
            tray_active: AtomicBool::new(false),
        }
    }
}
