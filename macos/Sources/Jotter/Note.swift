import AppKit

/// Same on-disk shape as Jotter's Linux notes, so note files can be copied
/// between the two apps. `x`/`y` are the window's top-left corner measured
/// from the top-left of the primary screen (not AppKit's bottom-left origin).
struct Note: Codable {
    var id: String
    var content: String
    var color: String
    var x: Double
    var y: Double
    var width: Double
    var height: Double
    var alwaysOnTop: Bool
    var createdAt: String
    var updatedAt: String

    static let defaultWidth = 280.0
    static let defaultHeight = 280.0

    init(x: Double, y: Double, content: String = "", color: String = "yellow") {
        let now = Note.timestamp()
        self.id = UUID().uuidString.lowercased()
        self.content = content
        self.color = color
        self.x = x
        self.y = y
        self.width = Note.defaultWidth
        self.height = Note.defaultHeight
        self.alwaysOnTop = false
        self.createdAt = now
        self.updatedAt = now
    }

    static func timestamp() -> String {
        ISO8601DateFormatter().string(from: Date())
    }

    /// First line of text with markdown punctuation stripped, used as the
    /// window title (shown in the Window menu and Mission Control).
    var title: String {
        let firstLine = content
            .split(whereSeparator: \.isNewline)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .first { !$0.isEmpty } ?? ""
        let stripped = firstLine
            .replacingOccurrences(of: #"^(#+|[-*+]|\d+\.|>|- \[[ xX]\])\s*"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"[*_`~\[\]]"#, with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
        if stripped.isEmpty { return "Untitled Note" }
        return stripped.count > 40 ? String(stripped.prefix(40)) + "…" : stripped
    }
}

enum NoteColor: String, CaseIterable {
    case yellow, pink, blue, green, purple, gray

    var label: String { rawValue.capitalized }

    /// Matches `bg` in web/src/colors.ts; painted behind the web view so
    /// resizing never shows a mismatched edge.
    var background: NSColor {
        switch self {
        case .yellow: return NSColor(hex: 0xfdee9a)
        case .pink: return NSColor(hex: 0xf8cfe0)
        case .blue: return NSColor(hex: 0xbfe3f7)
        case .green: return NSColor(hex: 0xcdeac2)
        case .purple: return NSColor(hex: 0xddccf3)
        case .gray: return NSColor(hex: 0xe4e4e4)
        }
    }

    var swatch: NSColor {
        switch self {
        case .yellow: return NSColor(hex: 0xf5d93f)
        case .pink: return NSColor(hex: 0xef8bb6)
        case .blue: return NSColor(hex: 0x5cb4e3)
        case .green: return NSColor(hex: 0x79c95f)
        case .purple: return NSColor(hex: 0xa678e0)
        case .gray: return NSColor(hex: 0xa3a3a3)
        }
    }
}

extension NSColor {
    convenience init(hex: UInt32) {
        self.init(
            srgbRed: CGFloat((hex >> 16) & 0xff) / 255,
            green: CGFloat((hex >> 8) & 0xff) / 255,
            blue: CGFloat(hex & 0xff) / 255,
            alpha: 1
        )
    }
}
