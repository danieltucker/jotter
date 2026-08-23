use crate::note::Note;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Edge {
    Left,
    Right,
}

impl Edge {
    pub fn as_str(&self) -> &'static str {
        match self {
            Edge::Left => "left",
            Edge::Right => "right",
        }
    }
}

/// A note collapsed to a tab docked at a screen edge. Deliberately never
/// persisted to disk — edge docking is a session-only UI state (see README).
#[derive(Debug, Clone)]
pub struct EdgeDockInfo {
    pub edge: Edge,
    pub restore_x: f64,
    pub restore_y: f64,
    pub restore_width: f64,
    pub restore_height: f64,
}

pub struct AppState {
    pub notes: Mutex<HashMap<String, Note>>,
    pub last_geometry_write: Mutex<HashMap<String, Instant>>,
    pub cascade: Mutex<(f64, f64)>,
    pub edge_docked: Mutex<HashMap<String, EdgeDockInfo>>,
    /// Bumped on every Moved event per note; used to detect "no further
    /// move happened since this one" (drag settled) without a poll loop.
    pub move_epoch: Mutex<HashMap<String, u64>>,
}

impl Default for AppState {
    fn default() -> Self {
        AppState {
            notes: Mutex::new(HashMap::new()),
            last_geometry_write: Mutex::new(HashMap::new()),
            cascade: Mutex::new((120.0, 120.0)),
            edge_docked: Mutex::new(HashMap::new()),
            move_epoch: Mutex::new(HashMap::new()),
        }
    }
}
