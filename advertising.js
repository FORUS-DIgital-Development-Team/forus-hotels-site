(function () {
  'use strict';
  const target = document.querySelector('#forus-advertising');
  // The .forus.digital upstream and all non-home routes stay excluded.
  if (!target || target.dataset.enabled !== 'true' ||
      location.origin !== 'https://hotels.coop' || location.pathname !== '/' ||
      !/^[a-zA-Z0-9_-]{8,80}$/.test(target.dataset.placementId || '')) return;

  let controller, loading, generation = 0, away = false;
  const visible = () => document.visibilityState === 'visible' && !document.querySelector('dialog[open]');
  function sdk() {
    if (window.ForusAds) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/forus-ads.js'; script.async = true;
      script.onload = resolve;
      script.onerror = () => { script.remove(); reject(Error('Advertising unavailable')); };
      document.head.append(script);
    });
    // One local SDK load per page; a failed optional slot never loops.
    return loading;
  }
  function start() {
    if (away || controller || document.visibilityState !== 'visible') return;
    const current = generation;
    void sdk().then(() => {
      if (away || current !== generation || controller || document.visibilityState !== 'visible') return;
      controller = window.ForusAds?.mount(target, {
        baseUrl: 'https://staging-advertising.forus.digital', placementId: target.dataset.placementId,
        format: 'display', emptyBehavior: 'collapse', isVisible: visible,
        context: { country: 'ZA', language: 'en', sport: 'none', category: 'community' },
        consent: { policy_version: 'hotels-contextual-1', storage: 'denied', personalisation: 'denied' },
      });
    }).catch(() => { target.replaceChildren(); });
  }
  window.addEventListener('pagehide', () => { away = true; generation++; controller?.destroy(); controller = undefined; });
  window.addEventListener('pageshow', () => { away = false; start(); });
  document.addEventListener('visibilitychange', start);
  start();
})();
