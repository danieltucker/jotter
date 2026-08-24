use crate::note::Note;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

pub struct AppState {
    pub notes: Mutex<HashMap<String, Note>>,
    pub last_geometry_write: Mutex<HashMap<String, Instant>>,
    pub cascade: Mutex<(f64, f64)>,
}

impl Default for AppState {
    fn default() -> Self {
        AppState {
            notes: Mutex::new(HashMap::new()),
            last_geometry_write: Mutex::new(HashMap::new()),
            cascade: Mutex::new((120.0, 120.0)),
        }
    }
}
