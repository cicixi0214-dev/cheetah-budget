import StoreKit
import WebKit

/// StoreKit IAP manager + WKWebView JS bridge
@MainActor
class StoreKitManager: NSObject, ObservableObject {
    static let shared = StoreKitManager()

    @Published var isPremium = false
    @Published var isLifetime = false
    @Published var subscriptionExpiry: Date?

    var products: [Product] = []
    weak var webView: WKWebView?

    // MARK: — Product IDs (set these in App Store Connect)
    let monthlyID  = "com.royhug.centsnap.premium.monthly"
    let yearlyID   = "com.royhug.centsnap.premium.yearly"
    let lifetimeID = "com.royhug.centsnap.premium.lifetime"

    // MARK: — Setup

    func setup() async {
        await loadProducts()
        await refreshStatus()
    }

    func loadProducts() async {
        let ids: Set<String> = [monthlyID, yearlyID]
        guard let p = try? await Product.products(for: ids) else { return }
        products = p
    }

    // MARK: — Subscription status

    func refreshStatus() async {
        isPremium = false
        isLifetime = false
        subscriptionExpiry = nil

        for await result in Transaction.currentEntitlements {
            guard case .verified(let tx) = result else { continue }
            if tx.productID == lifetimeID {
                isPremium = true; isLifetime = true
            } else if [monthlyID, yearlyID].contains(tx.productID),
                      let exp = tx.expirationDate, exp > Date() {
                isPremium = true; subscriptionExpiry = exp
            }
        }
        pushStatus()
    }

    // MARK: — Purchase

    func purchase(_ productID: String) async -> Bool {
        guard let product = products.first(where: { $0.id == productID }) else {
            pushEvent(action: "purchaseResult", success: false, error: "Product not found")
            return false
        }
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                guard case .verified(let tx) = verification else {
                    pushEvent(action: "purchaseResult", success: false, error: "Verification failed")
                    return false
                }
                await tx.finish()
                await refreshStatus()
                pushEvent(action: "purchaseResult", success: true)
                return true
            case .userCancelled:
                pushEvent(action: "purchaseResult", success: false, error: "cancelled")
                return false
            case .pending:
                pushEvent(action: "purchaseResult", success: false, error: "pending")
                return false
            @unknown default:
                return false
            }
        } catch {
            pushEvent(action: "purchaseResult", success: false, error: error.localizedDescription)
            return false
        }
    }

    func restore() async {
        do {
            try await AppStore.sync()
            await refreshStatus()
            pushEvent(action: "restoreResult", success: isPremium, error: isPremium ? nil : "Nothing to restore")
        } catch {
            pushEvent(action: "restoreResult", success: false, error: error.localizedDescription)
        }
    }

    // MARK: — JS bridge

    private func pushStatus() {
        let json = """
        {"isPremium":\(isPremium),"isLifetime":\(isLifetime),"expiry":\(subscriptionExpiry?.timeIntervalSince1970 ?? 0)}
        """
        Task { try? await webView?.evaluateJavaScript("window.__centsnap = \(json); window.dispatchEvent(new Event('centsnap-update'))") }
    }

    private func pushEvent(action: String, success: Bool, error: String? = nil) {
        let err = error != nil ? "\"\(error!)\"" : "null"
        Task { try? await webView?.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('centsnap-\(action)', {detail:{success:\(success),error:\(err)}}))"
        ) }
    }

    /// Price strings for JS (e.g. "$4.99/month")
    func priceStrings() -> [[String: String]] {
        return products.map { p in
            [
                "id": p.id,
                "displayPrice": p.displayPrice,
                "period": p.subscription?.subscriptionPeriod.unit == .month ? "month" : "year",
                "title": p.displayName
            ]
        }
    }
}

// MARK: - WKScriptMessageHandler

extension StoreKitManager: WKScriptMessageHandler {
    func userContentController(_: WKUserContentController, didReceive msg: WKScriptMessage) {
        guard msg.name == "centsnap",
              let body = msg.body as? [String: Any],
              let action = body["action"] as? String else { return }

        Task { @MainActor in
            switch action {
            case "getStatus":
                pushStatus()
            case "purchase":
                if let pid = body["product"] as? String { _ = await purchase(pid) }
            case "restore":
                await restore()
            case "getPrices":
                if let data = try? JSONSerialization.data(withJSONObject: priceStrings()),
                   let str = String(data: data, encoding: .utf8) {
                    try? await webView?.evaluateJavaScript("window.__centsnapPrices = \(str); window.dispatchEvent(new Event('centsnap-prices'))")
                }
            default:
                break
            }
        }
    }
}
