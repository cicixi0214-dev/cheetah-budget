import SwiftUI
import WebKit

struct ContentView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        if #available(iOS 14.5, *) {
            config.defaultWebpagePreferences.preferredContentMode = .mobile
        }
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        if #available(iOS 16.4, *) {
            config.preferences.isElementFullscreenEnabled = true
        }

        // Register JS bridge handler
        config.userContentController.add(StoreKitManager.shared, name: "centsnap")

        // Inject subscription status script
        let js = """
        window.__centsnap = {isPremium:false,isLifetime:false,expiry:0};
        window.centsnapSubscribe = function(productId) {
            window.webkit.messageHandlers.centsnap.postMessage({action:'purchase',product:productId});
        };
        window.centsnapRestore = function() {
            window.webkit.messageHandlers.centsnap.postMessage({action:'restore'});
        };
        window.centsnapGetPrices = function() {
            window.webkit.messageHandlers.centsnap.postMessage({action:'getPrices'});
        };
        window.centsnapGetStatus = function() {
            window.webkit.messageHandlers.centsnap.postMessage({action:'getStatus'});
        };
        """
        let script = WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: false)
        config.userContentController.addUserScript(script)

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.uiDelegate = context.coordinator
        webView.scrollView.bounces = false

        // Attach webView to StoreKitManager
        StoreKitManager.shared.webView = webView

        // Load app
        if let url = Bundle.main.url(forResource: "index", withExtension: "html") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }

        // Setup StoreKit and restore status
        Task { @MainActor in
            await StoreKitManager.shared.setup()
        }

        return webView
    }

    func updateUIView(_: WKWebView, context: Context) {}

    class Coordinator: NSObject, WKUIDelegate {
        func rootVC(for webView: WKWebView) -> UIViewController? {
            if let scene = webView.window?.windowScene { return scene.keyWindow?.rootViewController }
            if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene { return scene.keyWindow?.rootViewController }
            return nil
        }
        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            let alert = UIAlertController(title: "", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default, handler: { _ in completionHandler() }))
            if let vc = rootVC(for: webView) { vc.present(alert, animated: true) } else { completionHandler() }
        }
        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            let alert = UIAlertController(title: "", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel, handler: { _ in completionHandler(false) }))
            alert.addAction(UIAlertAction(title: "OK", style: .default, handler: { _ in completionHandler(true) }))
            if let vc = rootVC(for: webView) { vc.present(alert, animated: true) } else { completionHandler(true) }
        }
        func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
            let alert = UIAlertController(title: prompt, message: nil, preferredStyle: .alert)
            alert.addTextField { $0.text = defaultText }
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel, handler: { _ in completionHandler(nil) }))
            alert.addAction(UIAlertAction(title: "OK", style: .default, handler: { _ in completionHandler(alert.textFields?.first?.text) }))
            if let vc = rootVC(for: webView) { vc.present(alert, animated: true) } else { completionHandler(defaultText) }
        }
    }
}
