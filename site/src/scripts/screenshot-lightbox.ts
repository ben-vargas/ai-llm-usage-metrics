/**
 * Screenshot lightbox with keyboard and focus management
 * ARIA-compliant dialog implementation
 */

interface LightboxOptions {
  triggerSelector: string;
  lightboxId: string;
  closeSelector: string;
}

export function initScreenshotLightbox(options: LightboxOptions): void {
  const { triggerSelector, lightboxId, closeSelector } = options;

  const trigger = document.querySelector(triggerSelector);
  const lightboxEl = document.getElementById(lightboxId);
  const closeBtn = document.querySelector(closeSelector);

  if (!trigger || !lightboxEl) return;

  const lightbox = lightboxEl;
  let lastFocusedElement: Element | null = null;
  let focusableElements: HTMLElement[] = [];

  function getFocusableElements(): HTMLElement[] {
    return Array.from(
      lightbox.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );
  }

  function trapFocus(e: KeyboardEvent): void {
    if (e.key !== 'Tab' || focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }

  function openLightbox(): void {
    lastFocusedElement = document.activeElement;
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Get focusable elements and focus the close button or first element
    focusableElements = getFocusableElements();
    const focusTarget = (closeBtn as HTMLElement) || focusableElements[0];
    if (focusTarget) {
      setTimeout(() => focusTarget.focus(), 0);
    }

    // Add event listeners
    document.addEventListener('keydown', handleKeydown);
    lightbox.addEventListener('keydown', trapFocus);
  }

  function closeLightbox(): void {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    // Remove event listeners
    document.removeEventListener('keydown', handleKeydown);
    lightbox.removeEventListener('keydown', trapFocus);

    // Restore focus
    if (lastFocusedElement && lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && lightbox.classList.contains('open')) {
      closeLightbox();
    }
  }

  // Event listeners
  trigger.addEventListener('click', openLightbox);

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeLightbox();
    });
  }

  // Close on backdrop click
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });

  // Set up ARIA
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.setAttribute('aria-hidden', 'true');
  lightbox.setAttribute('aria-label', 'Screenshot preview');
}
