/**
 * Centsnap — Subscription Manager + Cloud Sync
 * Injected by native bridge (iOS StoreKit) or falls back to localStorage mock for web dev.
 */
window.CentsnapSubscription = (function () {
  var SUB_KEY = 'centsnap_sub_status';

  // Mock prices for web-dev mode (real prices come from native)
  var MOCK_PRODUCTS = [
    { id: 'com.royhug.centsnap.sub.monthly', displayPrice: '$4.99', period: 'month', title: 'Premium Monthly' },
    { id: 'com.royhug.centsnap.sub.yearly',  displayPrice: '$39.99', period: 'year',  title: 'Premium Yearly' }
  ];

  var state = {
    isPremium: false,
    expiry: 0,
    products: [],
    env: 'web' // 'native' or 'web'
  };

  function init() {
    // Detect if running in native wrapper (iOS WKWebView)
    state.env = (typeof window.webkit !== 'undefined' && window.webkit.messageHandlers && window.webkit.messageHandlers.centsnap) ? 'native' : 'web';

    // Listen for native subscription updates
    window.addEventListener('centsnap-update', function () {
      if (window.__centsnap) {
        state.isPremium = window.__centsnap.isPremium;
        state.isLifetime = false;
        state.expiry = window.__centsnap.expiry;
        save();
        renderAll();
      }
    });

    window.addEventListener('centsnap-prices', function () {
      if (window.__centsnapPrices && window.__centsnapPrices.length > 0) {
        state.products = window.__centsnapPrices;
      }
    });

    // Listen for purchase results
    window.addEventListener('centsnap-purchaseResult', function (e) {
      if (e.detail.success) {
        alert('Subscription successful! Thank you for your support.');
      } else if (e.detail.error !== 'cancelled') {
        alert('Subscription failed: ' + (e.detail.error || 'Unknown error'));
      }
    });

    window.addEventListener('centsnap-restoreResult', function (e) {
      if (e.detail.success) {
        alert('Purchases restored.');
      } else {
        alert('No purchases found to restore.');
      }
    });

    // If native, request status
    if (state.env === 'native') {
      try { window.centsnapGetStatus(); } catch (e) { console.warn('centsnapGetStatus not available'); }
      try { window.centsnapGetPrices(); } catch (e) { console.warn('centsnapGetPrices not available'); }
      // Set fallback prices until real prices arrive from StoreKit
      state.products = MOCK_PRODUCTS;
    } else {
      // Web dev mode: restore from localStorage
      var saved = localStorage.getItem(SUB_KEY);
      if (saved) {
        try {
          var p = JSON.parse(saved);
          state.isPremium = p.isPremium || false;
          state.isLifetime = false;
          state.expiry = p.expiry || 0;
        } catch (e) {}
      }
      state.products = MOCK_PRODUCTS;
    }
  }

  function save() {
    localStorage.setItem(SUB_KEY, JSON.stringify({
      isPremium: state.isPremium,
      isLifetime: state.isLifetime,
      expiry: state.expiry
    }));
  }

  // === Public API ===

  function isPremium() { return state.isPremium; }

  function expiryDate() {
    if (!state.expiry) return null;
    return new Date(state.expiry * 1000).toLocaleDateString();
  }

  function subscribe(plan) {
    if (state.env === 'native') {
      window.centsnapSubscribe(plan);
      return;
    }
    // Web dev mode: mock
    var ok = confirm('[DEV] Mock subscription ' + plan + '?');
    if (!ok) return;
    state.isPremium = true;
    state.expiry = Date.now() + 30 * 86400000;
    save();
    renderAll();
  }

  function restore() {
    if (state.env === 'native') {
      window.centsnapRestore();
      return;
    }
    // Web dev mode
    state.isPremium = true;
    state.expiry = Date.now() + 30 * 86400000;
    save();
    renderAll();
  }

  function getDisplayPrice(productId) {
    var p = state.products.find(function (x) { return x.id === productId; });
    return p ? p.displayPrice : productId;
  }

  function showPaywall() {
    if (isPremium()) return;
    var html = [
      '<div class="card" style="border:2px solid #facc15;background:#fffbe6;">',
      '<h3 style="margin:0 0 6px;">🌟 Upgrade to Premium</h3>',
      '<p class="small" style="margin-bottom:10px;">Cloud Sync + Advanced Charts + Multi-device. Subscription auto-renews unless cancelled.</p>',
      '<div class="row" style="margin-bottom:6px;">',
      '<button onclick="window.CentsnapSubscription.subscribe(\'com.royhug.centsnap.sub.monthly\')" style="background:#1f2937;color:#fff;padding:10px;border:0;border-radius:10px;font-weight:700;cursor:pointer;">' + getDisplayPrice('com.royhug.centsnap.sub.monthly') + '<span style="font-size:11px;font-weight:400;">/month</span><br><span style="font-size:9px;font-weight:400;">Premium Monthly</span></button>',
      '<button onclick="window.CentsnapSubscription.subscribe(\'com.royhug.centsnap.sub.yearly\')" style="background:#facc15;color:#111827;padding:10px;border:0;border-radius:10px;font-weight:700;cursor:pointer;">' + getDisplayPrice('com.royhug.centsnap.sub.yearly') + '<span style="font-size:11px;font-weight:400;">/year</span><br><span style="font-size:9px;font-weight:400;">Premium Yearly</span></button>',
      '</div>',
      '<div style="text-align:center;font-size:10px;color:#6b7280;line-height:1.6;">',
      '<button onclick="window.CentsnapSubscription.restore()" style="background:none;border:none;color:#6b7280;font-size:12px;cursor:pointer;text-decoration:underline;padding:4px;">Restore Purchases</button><br>',
      '<a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" style="color:#6b7280;">Terms of Service (EULA)</a>',
      ' · ',
      '<a href="https://royhug.online/privacy" target="_blank" style="color:#6b7280;">Privacy Policy</a>',
      '</div>',
      '</div>'
    ].join('\n');
    return html;
  }

  function showStatusBadge() {
    if (state.isPremium) return '<span style="font-size:11px;color:#059669;font-weight:700;">✨ Premium · till ' + expiryDate() + '</span>';
    return '<span style="font-size:11px;color:#6b7280;">Free Plan</span>';
  }

  function isFeatureAvailable(feature) {
    if (!isPremium()) return false;
    return true;
  }

  // === Cloud Sync ===
  function getSyncStatus() {
    var lastSync = localStorage.getItem('centsnap_last_sync');
    return lastSync ? new Date(lastSync).toLocaleString() : null;
  }

  function syncToCloud() {
    if (!isPremium()) { alert('Upgrade to Premium for cloud sync.'); return; }
    var data = localStorage.getItem('sbh3_data');
    if (!data) return;
    fetch('https://cheetah-budget.onrender.com/mvp-api/data/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (localStorage.getItem('sbh3_token') || '')
      },
      body: JSON.stringify({ data: data })
    })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (res.ok) {
        localStorage.setItem('centsnap_last_sync', new Date().toISOString());
        alert('Synced to cloud.');
      } else {
        alert('Sync failed: ' + (res.error || 'unknown'));
      }
    })
    .catch(function (e) {
      alert('Network error. Please try again.');
    });
  }

  function syncFromCloud() {
    if (!isPremium()) { alert('Upgrade to Premium for cloud sync.'); return; }
    return fetch('https://cheetah-budget.onrender.com/mvp-api/data/load', {
      headers: {
        'Authorization': 'Bearer ' + (localStorage.getItem('sbh3_token') || '')
      }
    })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (res.ok && res.data) {
        localStorage.setItem('sbh3_data', res.data);
        return true;
      }
      return false;
    })
    .catch(function () { return false; });
  }

  // Hook into existing render chain
  function patchRenderAll() {
    var original = window.renderAll || function(){};
    window.renderAll = function() {
      original();
      renderSubscriptionUI();
    };
  }

  function renderSubscriptionUI() {
    // Add subscription badge to header
    var brandEl = document.querySelector('.brand');
    if (brandEl && !document.getElementById('sub-badge')) {
      var badge = document.createElement('span');
      badge.id = 'sub-badge';
      badge.style.cssText = 'font-size:10px;margin-left:6px;';
      brandEl.appendChild(badge);
    }
    var badgeEl = document.getElementById('sub-badge');
    if (badgeEl) badgeEl.innerHTML = showStatusBadge();
  }

  // Initialize on load
  function initAndBind() {
    init();
    patchRenderAll();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAndBind);
  } else {
    initAndBind();
  }
  // Bind paywall buttons (delegated, always works)
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.premium-btn');
    if (btn) subscribe(btn.dataset.plan);
    var lifeBtn = e.target.closest('.life-btn');
    if (lifeBtn) subscribe(lifeBtn.dataset.plan);
    var restoreBtn = e.target.closest('.restore-btn');
    if (restoreBtn) restore();
  });

  return {
    isPremium: isPremium,
    expiryDate: expiryDate,
    subscribe: subscribe,
    restore: restore,
    showPaywall: showPaywall,
    showStatusBadge: showStatusBadge,
    isFeatureAvailable: isFeatureAvailable,
    syncToCloud: syncToCloud,
    syncFromCloud: syncFromCloud,
    getSyncStatus: getSyncStatus
  };
})();
