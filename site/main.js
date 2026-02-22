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
    var tip = installBar.querySelector('.toast');
    var toastTimerId;

    function showToast(message, isError) {
      if (!tip) {
        return;
      }

      tip.textContent = message;
      tip.classList.toggle('error', Boolean(isError));
      tip.classList.add('show');

      clearTimeout(toastTimerId);
      toastTimerId = setTimeout(function () {
        tip.classList.remove('show');
        tip.classList.remove('error');
        tip.textContent = 'Copied!';
      }, 1200);
    }

    function fallbackCopy(text) {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      try {
        return document.execCommand('copy');
      } finally {
        document.body.removeChild(textarea);
      }
    }

    function doCopy() {
      var installCommand = 'npm install -g llm-usage-metrics';

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(installCommand)
          .then(function () {
            showToast('Copied!', false);
          })
          .catch(function (error) {
            console.error('Clipboard copy failed', error);

            try {
              if (fallbackCopy(installCommand)) {
                showToast('Copied!', false);
                return;
              }
            } catch (fallbackError) {
              console.error('Clipboard fallback copy failed', fallbackError);
            }

            showToast('Copy failed', true);
          });
        return;
      }

      try {
        if (fallbackCopy(installCommand)) {
          showToast('Copied!', false);
          return;
        }
      } catch (error) {
        console.error('Clipboard fallback copy failed', error);
      }

      showToast('Copy failed', true);
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
