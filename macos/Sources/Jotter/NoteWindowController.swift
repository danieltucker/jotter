import AppKit
import WebKit

/// Records the mouse-down that started a header drag; the web page reports
/// the drag asynchronously, and `performDrag(with:)` needs the original event.
final class NoteWebView: WKWebView {
    private(set) var lastMouseDown: NSEvent?

    override func mouseDown(with event: NSEvent) {
        lastMouseDown = event
        super.mouseDown(with: event)
    }

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

/// WKUserContentController retains its handlers; this breaks the cycle.
private final class WeakMessageHandler: NSObject, WKScriptMessageHandlerWithReply {
    weak var target: WKScriptMessageHandlerWithReply?

    init(_ target: WKScriptMessageHandlerWithReply) {
        self.target = target
    }

    func userContentController(
        _ controller: WKUserContentController,
        didReceive message: WKScriptMessage,
        replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void
    ) {
        target?.userContentController(controller, didReceive: message, replyHandler: replyHandler)
    }
}

@MainActor
protocol NoteWindowControllerDelegate: AnyObject {
    var store: NoteStore { get }
    func createNote()
    func createAboutNote()
    func showAllNotes()
    func noteWindowDidClose(_ controller: NoteWindowController)
}

@MainActor
final class NoteWindowController: NSWindowController, NSWindowDelegate, WKScriptMessageHandlerWithReply, NSMenuItemValidation {
    static let minSize = NSSize(width: 200, height: 180)

    let noteID: String
    private weak var app: NoteWindowControllerDelegate?
    private let webView: NoteWebView
    private var isReady = false
    private var focusWhenReady = false
    private var expandedHeight: CGFloat?
    private var isDeleting = false

    private var store: NoteStore? { app?.store }

    init(note: Note, owner: NoteWindowControllerDelegate) {
        self.noteID = note.id
        self.app = owner

        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: BundleSchemeHandler.scheme)
        let noteJSON = (try? String(data: JSONEncoder().encode(note), encoding: .utf8)) ?? "null"
        config.userContentController.addUserScript(WKUserScript(
            source: "window.__JOTTER_PLATFORM__ = \"macos\"; window.__NOTE__ = \(noteJSON);",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        config.userContentController.addUserScript(WKUserScript(
            source: """
            window.addEventListener("error", (e) => window.webkit.messageHandlers.bridge.postMessage(
              { cmd: "log", args: { message: String(e.message) + " @ " + e.filename + ":" + e.lineno } }));
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        webView = NoteWebView(frame: .zero, configuration: config)
        webView.setValue(false, forKey: "drawsBackground")
        if #available(macOS 13.3, *) {
            webView.isInspectable = true
        }

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: note.width, height: note.height),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.isReleasedWhenClosed = false
        window.isRestorable = false
        window.tabbingMode = .disallowed
        window.collectionBehavior.insert(.fullScreenNone)
        window.contentMinSize = Self.minSize
        window.contentView = webView
        window.title = note.title

        super.init(window: window)

        shouldCascadeWindows = false
        window.delegate = self
        injectTitlebarMetrics()
        config.userContentController.addScriptMessageHandler(
            WeakMessageHandler(self), contentWorld: .page, name: "bridge"
        )
        apply(color: note.color)
        apply(alwaysOnTop: note.alwaysOnTop)
        window.setFrame(Self.frame(for: note), display: false)

        webView.load(URLRequest(url: BundleSchemeHandler.indexURL))

        // Never leave a note invisible if the page fails to report in.
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
            guard let self, !self.isReady else { return }
            NSLog("Jotter: note \(self.noteID) did not report ready; showing anyway")
            self.isReady = true
            self.present(focus: false)
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    /// The web header sits under the transparent title bar, so it needs the
    /// title bar's height and the space the traffic lights take up.
    private func injectTitlebarMetrics() {
        guard let window else { return }
        let height = window.frame.height - window.contentLayoutRect.height
        let buttonsEnd = window.standardWindowButton(.zoomButton)?.frame.maxX ?? 70
        let css = ":root { --titlebar-height: \(Int(height.rounded()))px; --titlebar-inset: \(Int(buttonsEnd.rounded()) + 8)px; }"
        webView.configuration.userContentController.addUserScript(WKUserScript(
            source: """
            document.addEventListener("DOMContentLoaded", () => {
              const style = document.createElement("style");
              style.textContent = \(String(reflecting: css));
              document.head.appendChild(style);
            });
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
    }

    private var titlebarHeight: CGFloat {
        guard let window else { return 28 }
        return window.frame.height - window.contentLayoutRect.height
    }

    // MARK: Showing

    /// Shows the window once the page has painted (or immediately if it
    /// already has). `focus` makes it key and puts the caret in the editor.
    func present(focus: Bool) {
        if focus { focusWhenReady = true }
        guard isReady else { return }
        window?.deminiaturize(nil)
        if focusWhenReady {
            focusWhenReady = false
            NSApp.activate(ignoringOtherApps: true)
            window?.makeKeyAndOrderFront(nil)
            emit("focus")
        } else {
            window?.orderFront(nil)
        }
    }

    func emit(_ name: String, _ payload: Any? = nil) {
        var arg = "undefined"
        if let payload,
           let data = try? JSONSerialization.data(withJSONObject: [payload], options: [.fragmentsAllowed]),
           let json = String(data: data, encoding: .utf8) {
            arg = String(json.dropFirst().dropLast())
        }
        let name = name.replacingOccurrences(of: "\"", with: "")
        webView.evaluateJavaScript("window.__jotter && window.__jotter.emit(\"\(name)\", \(arg));")
    }

    // MARK: Geometry

    /// Converts the stored top-left-origin geometry to an AppKit frame,
    /// pulling the note back on screen if its display has gone away.
    static func frame(for note: Note) -> NSRect {
        let primary = NSScreen.screens.first?.frame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let width = max(note.width, minSize.width)
        let height = max(note.height, minSize.height)
        var frame = NSRect(x: note.x, y: primary.maxY - note.y - height, width: width, height: height)

        let header = NSRect(x: frame.minX, y: frame.maxY - 28, width: frame.width, height: 28)
        let onScreen = NSScreen.screens.contains { $0.visibleFrame.intersects(header.insetBy(dx: 40, dy: 0)) }
        if !onScreen, let visible = NSScreen.main?.visibleFrame {
            frame.origin = NSPoint(x: visible.midX - width / 2, y: visible.midY - height / 2)
        }
        return frame
    }

    private func persistGeometry() {
        guard let window, !isDeleting, expandedHeight == nil else { return }
        let primary = NSScreen.screens.first?.frame ?? .zero
        let frame = window.frame
        store?.update(noteID, debounce: true) { note in
            note.x = frame.minX
            note.y = primary.maxY - frame.maxY
            note.width = frame.width
            note.height = frame.height
        }
    }

    func windowDidMove(_ notification: Notification) { persistGeometry() }
    func windowDidResize(_ notification: Notification) { persistGeometry() }

    /// The close button deletes the note (as in Jotter), so ask first.
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        confirmDelete()
        return false
    }

    func windowWillClose(_ notification: Notification) {
        store?.flushPending()
        app?.noteWindowDidClose(self)
    }

    // MARK: Appearance

    private func apply(color: String) {
        window?.backgroundColor = (NoteColor(rawValue: color) ?? .yellow).background
    }

    private func apply(alwaysOnTop: Bool) {
        window?.level = alwaysOnTop ? .floating : .normal
    }

    /// Rolls the note up to just its header, like Apple's Stickies.
    @objc func toggleCollapse(_ sender: Any?) {
        guard let window else { return }
        var frame = window.frame
        if let expanded = expandedHeight {
            expandedHeight = nil
            window.contentMinSize = Self.minSize
            frame.origin.y -= expanded - frame.height
            frame.size.height = expanded
            window.setFrame(frame, display: true, animate: true)
            persistGeometry()
        } else {
            store?.flushPending()
            expandedHeight = frame.height
            let header = titlebarHeight
            window.contentMinSize = NSSize(width: Self.minSize.width, height: 0)
            frame.origin.y += frame.height - header
            frame.size.height = header
            window.setFrame(frame, display: true, animate: true)
        }
    }

    // MARK: Menu actions (reached through the responder chain)

    @objc func requestDelete(_ sender: Any?) { confirmDelete() }

    private func confirmDelete() {
        guard let window, window.attachedSheet == nil else { return }
        if window.isMiniaturized { window.deminiaturize(nil) }
        let alert = NSAlert()
        alert.messageText = "Delete this note?"
        alert.informativeText = "This can't be undone."
        alert.alertStyle = .warning
        let delete = alert.addButton(withTitle: "Delete")
        if #available(macOS 11.0, *) { delete.hasDestructiveAction = true }
        alert.addButton(withTitle: "Cancel").keyEquivalent = "\u{1b}"
        alert.beginSheetModal(for: window) { [weak self] response in
            guard response == .alertFirstButtonReturn else { return }
            self?.deleteNote()
        }
    }

    private func deleteNote() {
        isDeleting = true
        store?.delete(noteID)
        window?.close()
    }

    /// Mirrors the system "double-click a window's title bar to…" setting.
    private func titlebarDoubleClicked() {
        switch UserDefaults.standard.string(forKey: "AppleActionOnDoubleClick") {
        case "Minimize": window?.performMiniaturize(nil)
        case "None": break
        default: window?.performZoom(nil)
        }
    }
    @objc func toggleFloat(_ sender: Any?) { emit("toggle-pin") }
    @objc func noteUndo(_ sender: Any?) { emit("undo") }
    @objc func noteRedo(_ sender: Any?) { emit("redo") }

    @objc func setNoteColor(_ sender: NSMenuItem) {
        guard let color = sender.representedObject as? String else { return }
        emit("set-color", color)
    }

    func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
        guard let note = store?.note(noteID) else { return false }
        switch menuItem.action {
        case #selector(setNoteColor(_:)):
            menuItem.state = (menuItem.representedObject as? String) == note.color ? .on : .off
        case #selector(toggleFloat(_:)):
            menuItem.state = note.alwaysOnTop ? .on : .off
        case #selector(toggleCollapse(_:)):
            menuItem.title = expandedHeight == nil ? "Collapse Note" : "Expand Note"
        default:
            break
        }
        return true
    }

    // MARK: Bridge

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage,
        replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void
    ) {
        guard let body = message.body as? [String: Any], let cmd = body["cmd"] as? String else {
            replyHandler(nil, "malformed message")
            return
        }
        let args = body["args"] as? [String: Any] ?? [:]
        replyHandler(nil, nil)

        switch cmd {
        case "ready":
            isReady = true
            present(focus: false)
        case "save_note_content":
            guard let content = args["content"] as? String else { return }
            store?.update(noteID) { $0.content = content }
            window?.title = store?.note(noteID)?.title ?? "Untitled Note"
        case "set_note_color":
            guard let color = args["color"] as? String, NoteColor(rawValue: color) != nil else { return }
            store?.update(noteID) { $0.color = color }
            apply(color: color)
        case "toggle_always_on_top":
            let value = args["value"] as? Bool ?? false
            store?.update(noteID) { $0.alwaysOnTop = value }
            apply(alwaysOnTop: value)
        case "create_note":
            app?.createNote()
        case "create_about_note":
            app?.createAboutNote()
        case "show_all_notes":
            app?.showAllNotes()
        case "request_delete":
            confirmDelete()
        case "start_drag":
            startDrag()
        case "titlebar_double_click":
            titlebarDoubleClicked()
        case "log":
            NSLog("Jotter [web]: \(args["message"] as? String ?? "")")
        case "open_url":
            guard let string = args["url"] as? String, let url = URL(string: string),
                  ["http", "https", "mailto"].contains(url.scheme?.lowercased() ?? "") else { return }
            NSWorkspace.shared.open(url)
        default:
            NSLog("Jotter: unknown bridge command \(cmd)")
        }
    }

    private func startDrag() {
        guard let window, NSEvent.pressedMouseButtons & 1 != 0 else { return }
        if let event = webView.lastMouseDown, event.window === window {
            window.performDrag(with: event)
        }
    }
}
