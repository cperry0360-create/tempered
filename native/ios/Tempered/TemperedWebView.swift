import SwiftUI
import UIKit
import WebKit

struct TemperedWebView: UIViewRepresentable {
    private let productionURL = URL(string: "https://cperry0360-create.github.io/tempered/")!

    func makeCoordinator() -> Coordinator {
        Coordinator(productionURL: productionURL)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let userContent = WKUserContentController()
        userContent.add(context.coordinator, name: "temperedHealth")
        userContent.add(context.coordinator, name: "temperedWakeLock")
        userContent.addUserScript(WKUserScript(
            source: "window.__TEMPERED_NATIVE_IOS__ = true;",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        configuration.userContentController = userContent

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        context.coordinator.webView = webView

        var request = URLRequest(url: productionURL)
        request.cachePolicy = .returnCacheDataElseLoad
        webView.load(request)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        weak var webView: WKWebView?
        private let health = HealthKitBridge.shared
        private let productionURL: URL
        private var foregroundObserver: NSObjectProtocol?

        init(productionURL: URL) {
            self.productionURL = productionURL
            super.init()
            foregroundObserver = NotificationCenter.default.addObserver(
                forName: UIApplication.didBecomeActiveNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                self?.webView?.evaluateJavaScript(
                    "window.dispatchEvent(new Event('tempered:native-foreground'));"
                )
            }
        }

        deinit {
            if let foregroundObserver {
                NotificationCenter.default.removeObserver(foregroundObserver)
            }
            DispatchQueue.main.async {
                UIApplication.shared.isIdleTimerDisabled = false
            }
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "temperedWakeLock" {
                let active = (message.body as? [String: Any])?["active"] as? Bool ?? false
                UIApplication.shared.isIdleTimerDisabled = active
                return
            }
            guard
                message.name == "temperedHealth",
                let body = message.body as? [String: Any],
                let id = body["id"] as? String,
                let action = body["action"] as? String
            else { return }

            Task {
                do {
                    let data: [String: Any]
                    switch action {
                    case "requestAuthorization":
                        data = try await health.requestAuthorization()
                    case "read":
                        guard let date = body["date"] as? String else {
                            throw HealthKitBridgeError.invalidDate
                        }
                        data = try await health.read(dateKey: date)
                    default:
                        throw NativeBridgeError.unknownAction(action)
                    }
                    reply(id: id, ok: true, data: data)
                } catch {
                    reply(id: id, ok: false, error: error.localizedDescription)
                }
            }
        }

        private func reply(id: String, ok: Bool, data: [String: Any]? = nil, error: String? = nil) {
            var payload: [String: Any] = ["id": id, "ok": ok]
            if let data { payload["data"] = data }
            if let error { payload["error"] = error }
            guard
                JSONSerialization.isValidJSONObject(payload),
                let encoded = try? JSONSerialization.data(withJSONObject: payload),
                let json = String(data: encoded, encoding: .utf8)
            else { return }

            DispatchQueue.main.async { [weak self] in
                self?.webView?.evaluateJavaScript("window.__temperedHealthReceive(\(json));")
            }
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            let isTempered = url.host == productionURL.host && url.path.hasPrefix("/tempered")
            if isTempered || url.scheme == "about" {
                decisionHandler(.allow)
                return
            }

            if navigationAction.navigationType == .linkActivated {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}

enum NativeBridgeError: LocalizedError {
    case unknownAction(String)

    var errorDescription: String? {
        switch self {
        case .unknownAction(let action): return "Unknown native bridge action: \(action)"
        }
    }
}
