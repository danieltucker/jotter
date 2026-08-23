use crate::state::{AppState, Edge, EdgeDockInfo};
use std::time::Duration;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager};

const TAB_WIDTH: f64 = 26.0;
const TAB_HEIGHT: f64 = 72.0;
/// How close to a screen edge a dropped note must land to dock, in logical px.
const EDGE_ZONE: f64 = 40.0;
const SETTLE_AFTER: Duration = Duration::from_millis(280);

pub fn is_docked(app: &AppHandle, note_id: &str) -> bool {
    app.state::<AppState>().edge_docked.lock().unwrap().contains_key(note_id)
}

/// Call from the Moved handler for any note that isn't currently docked.
/// Schedules a check ~SETTLE_AFTER later; if no newer move has arrived by
/// then (the drag has settled), evaluates whether it landed in an edge zone.
pub fn schedule_settle_check(app: &AppHandle, note_id: &str) {
    let state = app.state::<AppState>();
    let epoch = {
        let mut epochs = state.move_epoch.lock().unwrap();
        let next = epochs.get(note_id).copied().unwrap_or(0) + 1;
        epochs.insert(note_id.to_string(), next);
        next
    };

    let app = app.clone();
    let note_id = note_id.to_string();
    std::thread::spawn(move || {
        std::thread::sleep(SETTLE_AFTER);
        let state = app.state::<AppState>();
        let is_latest = state.move_epoch.lock().unwrap().get(&note_id).copied() == Some(epoch);
        if is_latest {
            maybe_dock_to_edge(&app, &note_id);
        }
    });
}

fn maybe_dock_to_edge(app: &AppHandle, note_id: &str) {
    if is_docked(app, note_id) {
        return;
    }
    let Some(win) = app.get_webview_window(note_id) else { return };
    let Ok(Some(monitor)) = win.current_monitor() else { return };
    let Ok(outer_pos) = win.outer_position() else { return };
    let Ok(size) = win.inner_size() else { return };
    let scale = win.scale_factor().unwrap_or(1.0);

    let pos = outer_pos.to_logical::<f64>(scale);
    let logical_size = size.to_logical::<f64>(scale);
    let mon_pos = monitor.position().to_logical::<f64>(scale);
    let mon_size = monitor.size().to_logical::<f64>(scale);

    let edge = if pos.x <= mon_pos.x + EDGE_ZONE {
        Edge::Left
    } else if pos.x + logical_size.width >= mon_pos.x + mon_size.width - EDGE_ZONE {
        Edge::Right
    } else {
        return;
    };

    let center_y = pos.y + logical_size.height / 2.0;
    let tab_y = (center_y - TAB_HEIGHT / 2.0)
        .max(mon_pos.y)
        .min(mon_pos.y + mon_size.height - TAB_HEIGHT);
    let tab_x = match edge {
        Edge::Left => mon_pos.x,
        Edge::Right => mon_pos.x + mon_size.width - TAB_WIDTH,
    };

    let state = app.state::<AppState>();
    state.edge_docked.lock().unwrap().insert(
        note_id.to_string(),
        EdgeDockInfo {
            edge,
            restore_x: pos.x,
            restore_y: pos.y,
            restore_width: logical_size.width,
            restore_height: logical_size.height,
        },
    );

    let _ = win.set_size(tauri::Size::Logical(LogicalSize { width: TAB_WIDTH, height: TAB_HEIGHT }));
    let _ = win.set_position(tauri::Position::Logical(LogicalPosition { x: tab_x, y: tab_y }));
    let _ = app.emit_to(note_id, "dock-changed", edge.as_str());
}

pub fn undock_note(app: &AppHandle, note_id: &str) {
    let state = app.state::<AppState>();
    let info = state.edge_docked.lock().unwrap().remove(note_id);
    let Some(info) = info else { return };
    let Some(win) = app.get_webview_window(note_id) else { return };

    let _ = win.set_size(tauri::Size::Logical(LogicalSize {
        width: info.restore_width,
        height: info.restore_height,
    }));
    let _ = win.set_position(tauri::Position::Logical(LogicalPosition {
        x: info.restore_x,
        y: info.restore_y,
    }));
    let _ = app.emit_to(note_id, "dock-changed", "none");
}
