/**
 * NPM version badge - runtime fetch with fallback
 * Displays version from npm registry or fallback text
 */

interface NpmBadgeOptions {
  badgeId: string;
  packageName: string;
  fallbackText?: string;
}

export function initNpmVersionBadge(options: NpmBadgeOptions): void {
  const { badgeId, packageName, fallbackText = 'available on npm' } = options;

  const badge = document.getElementById(badgeId);
  if (!badge) return;

  const textNode = badge.querySelector('.badge-text');
  if (!textNode) return;

  // Mark as loading
  badge.classList.add('loading');

  fetch(`https://registry.npmjs.org/${packageName}/latest`)
    .then((r) => r.json())
    .then((data: { version?: string }) => {
      if (data?.version) {
        textNode.textContent = `v${data.version} on npm`;
      } else {
        textNode.textContent = fallbackText;
      }
      badge.classList.remove('loading');
    })
    .catch(() => {
      textNode.textContent = fallbackText;
      badge.classList.remove('loading');
    });
}
