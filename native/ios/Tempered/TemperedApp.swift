import SwiftUI

@main
struct TemperedApp: App {
    var body: some Scene {
        WindowGroup {
            TemperedWebView()
                .ignoresSafeArea()
        }
    }
}
