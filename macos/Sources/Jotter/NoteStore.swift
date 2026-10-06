import Foundation

@MainActor
final class NoteStore {
    let directory: URL
    private(set) var notes: [String: Note] = [:]
    private var pendingWrites: [String: DispatchWorkItem] = [:]

    init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        directory = support.appendingPathComponent("Jotter/notes", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    func loadAll() -> [Note] {
        let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        let decoder = JSONDecoder()
        for file in files where file.pathExtension == "json" {
            guard let data = try? Data(contentsOf: file),
                  let note = try? decoder.decode(Note.self, from: data) else { continue }
            notes[note.id] = note
        }
        return sorted()
    }

    func sorted() -> [Note] {
        notes.values.sorted { $0.createdAt < $1.createdAt }
    }

    func note(_ id: String) -> Note? { notes[id] }

    func insert(_ note: Note) {
        notes[note.id] = note
        write(note.id)
    }

    /// Applies a change and writes it. Pass `debounce` for high-frequency
    /// updates like window moves so the disk isn't hit on every frame.
    func update(_ id: String, debounce: Bool = false, _ change: (inout Note) -> Void) {
        guard var note = notes[id] else { return }
        change(&note)
        note.updatedAt = Note.timestamp()
        notes[id] = note
        if debounce {
            pendingWrites[id]?.cancel()
            let work = DispatchWorkItem { [weak self] in self?.write(id) }
            pendingWrites[id] = work
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4, execute: work)
        } else {
            write(id)
        }
    }

    func delete(_ id: String) {
        pendingWrites.removeValue(forKey: id)?.cancel()
        notes.removeValue(forKey: id)
        try? FileManager.default.removeItem(at: url(for: id))
    }

    func flushPending() {
        for (id, work) in pendingWrites {
            work.cancel()
            write(id)
        }
        pendingWrites.removeAll()
    }

    private func write(_ id: String) {
        pendingWrites.removeValue(forKey: id)
        guard let note = notes[id] else { return }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .withoutEscapingSlashes]
        guard let data = try? encoder.encode(note) else { return }
        try? data.write(to: url(for: id), options: .atomic)
    }

    private func url(for id: String) -> URL {
        directory.appendingPathComponent("\(id).json")
    }
}
