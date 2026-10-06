// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "Jotter",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "Jotter",
            path: "Sources/Jotter",
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("WebKit"),
                .linkedFramework("Carbon"),
            ]
        ),
    ]
)
