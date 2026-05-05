/**
 * Centsnap — Subscription Manager + Cloud Sync
 * Injected by native bridge (iOS StoreKit) or falls back to localStorage mock for web dev.
 */
window.CentsnapSubscription = (function () {
  var SUB_KEY = 'centsnap_sub_status';

  // Mock prices for web-dev mode (real prices come from native)
  var MOCK_PRODUCTS = [
    { id: 'com.royhug.centsnap.premium.monthly', displayPrice: '$4.99', period: 'month', title: 'Premium Monthly' },
    { id: 'com.royhug.centsnap.premium.yearly',  displayPrice: '$39.99', period: 'year',  title: 'Premium Yearly' }
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
      if (window.__centsnapPrices) {
        state.products = window.__centsnapPrices;
      }
    });

    // Listen for purchase results
    window.addEventListener('centsnap-purchaseResult', function (e) {
      if (e.detail.success) {
        alert('✅ 订阅成功！感谢您的支持。');
      } else if (e.detail.error !== 'cancelled') {
        alert('订阅失败: ' + (e.detail.error || '未知错误'));
      }
    });

    window.addEventListener('centsnap-restoreResult', function (e) {
      if (e.detail.success) {
        alert('✅ 已恢复您的订阅。');
      } else {
        alert('没有发现可恢复的订阅。');
      }
    });

    // If native, request status
    if (state.env === 'native') {
      window.centsnapGetStatus();
      window.centsnapGetPrices();
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
    } else {
      // Web dev mode: mock purchase
      var ok = confirm('[DEV] 模拟订阅 ' + plan + '？');
      if (!ok) return;
      state.isPremium = true;
      state.expiry = Date.now() + 30 * 86400000;
      save();
      renderAll();
    }
  }

  function restore() {
    if (state.env === 'native') {
      window.centsnapRestore();
    } else {
      state.isPremium = true;
      state.expiry = Date.now() + 30 * 86400000;
      save();
      renderAll();
    }
  }

  function getDisplayPrice(productId) {
    var p = state.products.find(function (x) { return x.id === productId; });
    return p ? p.displayPrice : productId;
  }

  function showPaywall() {
    if (isPremium()) return;
    var html = [
      '<div class="card" style="border:2px solid #facc15;background:#fffbe6;">',
      '<h3 style="margin:0 0 8px;">🌟 升级 Premium</h3>',
      '<p class="small" style="margin-bottom:10px;">云同步 + 高级报表 + 多设备支持。免费试用？现在订阅！</p>',
      '<div class="row" style="margin-bottom:8px;">',
      '<button class="premium-btn" data-plan="com.royhug.centsnap.premium.monthly" style="background:#1f2937;color:#fff;padding:10px;border:0;border-radius:10px;font-weight:700;cursor:pointer;">' + getDisplayPrice('com.royhug.centsnap.premium.monthly') + '/月</button>',
      '<button class="premium-btn" data-plan="com.royhug.centsnap.premium.yearly" style="background:#facc15;color:#111827;padding:10px;border:0;border-radius:10px;font-weight:700;cursor:pointer;">' + getDisplayPrice('com.royhug.centsnap.premium.yearly') + '/年</button>',
      '</div>',
      '<div style="margin-top:8px;text-align:center;"><button class="restore-btn" style="background:none;border:none;color:#6b7280;font-size:12px;cursor:pointer;text-decoration:underline;">恢复订阅</button></div>',
      '</div>'
    ].join('\n');
    return html;
  }

  function showStatusBadge() {
    if (state.isPremium) return '<span style="font-size:11px;color:#059669;font-weight:700;">✨ Premium · 至 ' + expiryDate() + '</span>';
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
    if (!isPremium()) { alert('请升级 Premium 以使用云同步。'); return; }
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
        alert('✅ 已同步到云端。');
      } else {
        alert('同步失败: ' + (res.error || 'unknown'));
      }
    })
    .catch(function (e) {
      alert('网络错误，请重试。');
    });
  }

  function syncFromCloud() {
    if (!isPremium()) { alert('请升级 Premium 以使用云同步。'); return; }
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
      patchRenderAll();
      // Bind paywall buttons after render
      document.addEventListener('click', function (e) {
        var btn = e.target.closest('.premium-btn');
        if (btn) subscribe(btn.dataset.plan);
        var lifeBtn = e.target.closest('.life-btn');
        if (lifeBtn) subscribe(lifeBtn.dataset.plan);
        var restoreBtn = e.target.closest('.restore-btn');
        if (restoreBtn) restore();
      });
    });
  } else {
    init();
    patchRenderAll();
  }

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
