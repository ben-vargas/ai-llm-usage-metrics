document.addEventListener('DOMContentLoaded', function () {
  // ── Fetch version from npm registry ──────────────────
  var badge = document.getElementById('version-badge');
  if (badge) {
    var textNode = badge.querySelector('.badge-text');
    fetch('https://registry.npmjs.org/llm-usage-metrics/latest')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.version && textNode) {
          textNode.textContent = 'v' + data.version + ' on npm';
          badge.classList.remove('loading');
        }
      })
      .catch(function () {
        if(textNode) textNode.textContent = 'available on npm';
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
        tip.textContent = 'Copied to clipboard';
      }, 1500);
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
            showToast('Copied to clipboard', false);
          })
          .catch(function (error) {
            console.error('Clipboard copy failed', error);

            try {
              if (fallbackCopy(installCommand)) {
                showToast('Copied to clipboard', false);
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
          showToast('Copied to clipboard', false);
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
  
  // ── Infinite Scroll Simulation ─────────────────────────
  const logContainer = document.querySelector('.infinite-scroll-y');
  if (logContainer) {
    const lines = [
      '<span class="ti">fs.scan</span> ~/.pi/sessions/2026-02-12.json',
      '<span class="ti">fs.scan</span> ~/.codex/history.log',
      '<span class="ti">sqlite.connect</span> ~/.opencode/metrics.db',
      '<span class="ti">api.fetch</span> litellm/pricing.json',
      '<span class="td">calc</span> processing token buckets...',
      '<span class="td">norm</span> aligning schema variants...',
      '<span class="td">render</span> formatting payload...',
    ];
    
    let lineIndex = 0;
    setInterval(() => {
        const div = document.createElement('div');
        div.className = 'log-line dim';
        div.innerHTML = lines[lineIndex % lines.length];
        
        logContainer.appendChild(div);
        
        // Keep only last 5
        if(logContainer.children.length > 5) {
            logContainer.removeChild(logContainer.firstElementChild);
        }
        
        // Remove dim from previous last element
        const prev = logContainer.children[logContainer.children.length - 2];
        if (prev) prev.classList.remove('dim');
        
        lineIndex++;
    }, 1500);
  }

  // ── Screenshot Lightbox ────────────────────────────────
  var screenshot = document.querySelector('.screenshot');
  var lightbox = document.getElementById('lightbox');
  var lightboxClose = lightbox ? lightbox.querySelector('.lightbox-close') : null;
  var lightboxScroll = lightbox ? lightbox.querySelector('.lightbox-scroll') : null;

  function openLightbox() {
    if (!lightbox) return;
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    // Reset scroll position for next open
    if (lightboxScroll) {
      lightboxScroll.scrollTop = 0;
      lightboxScroll.scrollLeft = 0;
    }
  }

  if (screenshot && lightbox) {
    screenshot.addEventListener('click', openLightbox);

    if (lightboxClose) {
      lightboxClose.addEventListener('click', function (e) {
        e.stopPropagation();
        closeLightbox();
      });
    }

    // Close on backdrop click (not on the image itself)
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox || e.target === lightboxScroll) {
        closeLightbox();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lightbox.classList.contains('open')) {
        closeLightbox();
      }
    });
  }
});
