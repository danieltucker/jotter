import Foundation
import UniformTypeIdentifiers
import WebKit

/// Serves the bundled web UI (Contents/Resources/web) over a custom scheme.
/// WebKit won't run ES module scripts from file:// URLs, so loadFileURL
/// isn't an option for the Vite build. Vite marks its scripts `crossorigin`,
/// hence the CORS header on every response.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "jotter"
    static let indexURL = URL(string: "\(scheme)://app/index.html")!

    private let root: URL = {
        let resources = Bundle.main.resourceURL ?? URL(fileURLWithPath: ".")
        return resources.appendingPathComponent("web", isDirectory: true).standardizedFileURL
    }()

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else {
            task.didFailWithError(URLError(.badURL))
            return
        }
        let relative = url.path.isEmpty || url.path == "/" ? "index.html" : String(url.path.dropFirst())
        let file = root.appendingPathComponent(relative).standardizedFileURL
        guard file.path.hasPrefix(root.path + "/"), let data = try? Data(contentsOf: file) else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        let mime = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        let response = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: [
                "Content-Type": mime,
                "Content-Length": String(data.count),
                "Access-Control-Allow-Origin": "*",
            ]
        )!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}
