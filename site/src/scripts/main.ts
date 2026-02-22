/**
 * Main client-side entry point for landing page interactivity
 * Initializes all interactive modules with feature detection
 */

import { initCopyInstall } from './copy-install';
import { initExamplesTabs } from './examples-tabs';
import { initScreenshotLightbox } from './screenshot-lightbox';
import { initNpmVersionBadge } from './npm-version-badge';

document.addEventListener('DOMContentLoaded', () => {
  // Copy install command
  initCopyInstall({
    selector: '.install-command',
    command: 'npm install -g llm-usage-metrics',
    toastSelector: '.install-toast',
  });

  // Examples tabs
  initExamplesTabs({
    tabSelector: '.ex-tab',
    panelSelector: '.ex-panel',
  });

  // Screenshot lightbox
  initScreenshotLightbox({
    triggerSelector: '.screenshot',
    lightboxId: 'lightbox',
    closeSelector: '.lightbox-close',
  });

  // NPM version badge
  initNpmVersionBadge({
    badgeId: 'version-badge',
    packageName: 'llm-usage-metrics',
  });
});
