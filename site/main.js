document.addEventListener('DOMContentLoaded', function () {
  // ── Fetch version from npm registry ──────────────────
  var badge = document.getElementById('version-badge');
  if (badge) {
    fetch('https://registry.npmjs.org/llm-usage-metrics/latest')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.version) {
          badge.textContent = 'v' + data.version + ' on npm';
          badge.classList.remove('loading');
        }
      })
      .catch(function () {
        badge.textContent = 'available on npm';
        badge.classList.remove('loading');
      });
  }

  // ── Copy install command ─────────────────────────────
  var installBar = document.querySelector('.install');
  if (installBar) {
    function doCopy() {
      navigator.clipboard.writeText('npm install -g llm-usage-metrics').then(function () {
        var tip = installBar.querySelector('.toast');
        tip.classList.add('show');
        setTimeout(function () { tip.classList.remove('show'); }, 1200);
      });
    }
    installBar.addEventListener('click', doCopy);
    installBar.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doCopy(); }
    });
  }

  // ── Example tabs ─────────────────────────────────────
  var tabs = document.querySelectorAll('.ex-tab');
  var panels = document.querySelectorAll('.ex-panel');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); });
      panels.forEach(function (p) { p.classList.remove('active'); });
      tab.classList.add('active');
      var target = document.getElementById(tab.dataset.panel);
      if (target) target.classList.add('active');
    });
  });
});
