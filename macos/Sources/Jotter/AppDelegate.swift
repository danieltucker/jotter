import AppKit
import Carbon.HIToolbox

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NoteWindowControllerDelegate {
    static let appName = "Jotter"

    let store = NoteStore()
    private var controllers: [String: NoteWindowController] = [:]
    private var cascade = NSPoint(x: 120, y: 120)
    private var statusItem: NSStatusItem?
    private var newNoteHotKey: HotKey?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.mainMenu = buildMainMenu()
        installStatusItem()
        newNoteHotKey = HotKey(keyCode: kVK_ANSI_N, modifiers: controlKey | optionKey) { [weak self] in
            self?.createNote()
        }

        let notes = store.loadAll()
        if notes.isEmpty {
            var welcome = Note(x: 160, y: 140, content: Self.welcomeContent)
            welcome.width = 320
            welcome.height = 420
            store.insert(welcome)
            open(welcome, focus: true)
        } else {
            for note in notes { open(note, focus: false) }
        }
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag { showAllNotes() }
        return true
    }

    /// Gives each note's pending autosave a moment to reach disk before quitting.
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard !controllers.isEmpty else { return .terminateNow }
        controllers.values.forEach { $0.emit("flush") }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [store] in
            store.flushPending()
            NSApp.reply(toApplicationShouldTerminate: true)
        }
        return .terminateLater
    }

    // MARK: Notes

    private func open(_ note: Note, focus: Bool) {
        if let existing = controllers[note.id] {
            existing.present(focus: focus)
            return
        }
        let controller = NoteWindowController(note: note, owner: self)
        controllers[note.id] = controller
        controller.present(focus: focus)
    }

    private func nextCascadePosition() -> NSPoint {
        let position = cascade
        cascade.x = cascade.x + 32 > 760 ? 120 : cascade.x + 32
        cascade.y = cascade.y + 32 > 760 ? 120 : cascade.y + 32
        return position
    }

    @objc func createNote() {
        let position = nextCascadePosition()
        let note = Note(x: position.x, y: position.y)
        store.insert(note)
        open(note, focus: true)
    }

    @objc func createAboutNote() {
        let position = nextCascadePosition()
        let note = Note(x: position.x, y: position.y, content: Self.aboutContent)
        store.insert(note)
        open(note, focus: true)
    }

    @objc func showAllNotes() {
        let notes = store.sorted()
        if notes.isEmpty {
            createNote()
            return
        }
        NSApp.activate(ignoringOtherApps: true)
        for note in notes { open(note, focus: false) }
    }

    func noteWindowDidClose(_ controller: NoteWindowController) {
        controllers.removeValue(forKey: controller.noteID)
    }

    @objc private func showNotesFolder() {
        NSWorkspace.shared.open(store.directory)
    }

    // MARK: Menus

    private func buildMainMenu() -> NSMenu {
        let main = NSMenu()

        let app = submenu(in: main, title: Self.appName)
        app.addItem(withTitle: "About \(Self.appName)", action: #selector(createAboutNote), keyEquivalent: "")
        app.addItem(.separator())
        let services = NSMenu(title: "Services")
        app.addItem(withTitle: "Services", action: nil, keyEquivalent: "").submenu = services
        NSApp.servicesMenu = services
        app.addItem(.separator())
        app.addItem(withTitle: "Hide \(Self.appName)", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        app.addItem(withTitle: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
            .keyEquivalentModifierMask = [.command, .option]
        app.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        app.addItem(.separator())
        app.addItem(withTitle: "Quit \(Self.appName)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        let file = submenu(in: main, title: "File")
        file.addItem(withTitle: "New Note", action: #selector(createNote), keyEquivalent: "n")
        file.addItem(.separator())
        file.addItem(withTitle: "Delete Note…", action: #selector(NoteWindowController.requestDelete(_:)), keyEquivalent: "w")
        file.addItem(.separator())
        file.addItem(withTitle: "Show Notes Folder in Finder", action: #selector(showNotesFolder), keyEquivalent: "")

        let edit = submenu(in: main, title: "Edit")
        edit.addItem(withTitle: "Undo", action: #selector(NoteWindowController.noteUndo(_:)), keyEquivalent: "z")
        edit.addItem(withTitle: "Redo", action: #selector(NoteWindowController.noteRedo(_:)), keyEquivalent: "Z")
        edit.addItem(.separator())
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Paste and Match Style", action: #selector(NSTextView.pasteAsPlainText(_:)), keyEquivalent: "V")
            .keyEquivalentModifierMask = [.command, .option, .shift]
        edit.addItem(withTitle: "Delete", action: #selector(NSText.delete(_:)), keyEquivalent: "")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

        let note = submenu(in: main, title: "Note")
        let colorMenu = NSMenu(title: "Color")
        for (index, color) in NoteColor.allCases.enumerated() {
            let item = colorMenu.addItem(
                withTitle: color.label,
                action: #selector(NoteWindowController.setNoteColor(_:)),
                keyEquivalent: String(index + 1)
            )
            item.representedObject = color.rawValue
            item.image = swatchImage(color.swatch)
        }
        note.addItem(withTitle: "Color", action: nil, keyEquivalent: "").submenu = colorMenu
        note.addItem(withTitle: "Float on Top", action: #selector(NoteWindowController.toggleFloat(_:)), keyEquivalent: "f")
            .keyEquivalentModifierMask = [.command, .option]
        note.addItem(withTitle: "Collapse Note", action: #selector(NoteWindowController.toggleCollapse(_:)), keyEquivalent: "")

        let window = submenu(in: main, title: "Window")
        window.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        window.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        window.addItem(.separator())
        window.addItem(withTitle: "Show All Notes", action: #selector(showAllNotes), keyEquivalent: "")
        window.addItem(withTitle: "Bring All to Front", action: #selector(NSApplication.arrangeInFront(_:)), keyEquivalent: "")
        NSApp.windowsMenu = window

        let help = submenu(in: main, title: "Help")
        NSApp.helpMenu = help

        return main
    }

    private func submenu(in menu: NSMenu, title: String) -> NSMenu {
        let sub = NSMenu(title: title)
        menu.addItem(withTitle: title, action: nil, keyEquivalent: "").submenu = sub
        return sub
    }

    private func swatchImage(_ color: NSColor) -> NSImage {
        NSImage(size: NSSize(width: 12, height: 12), flipped: false) { rect in
            color.setFill()
            NSBezierPath(ovalIn: rect.insetBy(dx: 0.5, dy: 0.5)).fill()
            NSColor.black.withAlphaComponent(0.2).setStroke()
            NSBezierPath(ovalIn: rect.insetBy(dx: 0.5, dy: 0.5)).stroke()
            return true
        }
    }

    private func installStatusItem() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        item.button?.image = NSImage(systemSymbolName: "note.text", accessibilityDescription: Self.appName)
        let menu = NSMenu()
        menu.addItem(withTitle: "New Note", action: #selector(createNote), keyEquivalent: "n")
            .keyEquivalentModifierMask = [.control, .option]
        menu.addItem(withTitle: "Show All Notes", action: #selector(showAllNotes), keyEquivalent: "")
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit \(Self.appName)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "")
        for menuItem in menu.items where menuItem.action != #selector(NSApplication.terminate(_:)) {
            menuItem.target = self
        }
        item.menu = menu
        statusItem = item
    }

    // MARK: Content

    static let welcomeContent = """
    # Welcome to Jotter

    Markdown sticky notes for your **Mac**. Type freely like a normal sticky note, or write **Markdown**, either standard syntax (converted automatically) or via `/` for a command menu: headings, lists, to-dos, quotes, code blocks, dividers.

    - [ ] Try a to-do, like this one

    > Quotes look like this

    ```
    // code looks like this
    function greet(name) {
      return `Hello, ${name}!`
    }
    ```

    ---

    Hover the top of a note for its controls: the menu holds New Note, colors, and Delete Note; the pin floats a note above every other window. Closing a note deletes it (after asking), so minimize notes you want out of the way.

    Press **⌃⌥N** anywhere to start a new note.

    """

    static let aboutContent = """
    # About Jotter

    Made by **Daniel Tucker**. [jotter.rocks](https://jotter.rocks)

    [GitHub](https://github.com/danieltucker) · [Bluesky](https://bsky.app/profile/danielgt.com) · [Website](https://danielgt.com)

    ⌘-click a link to open it.

    """
}
