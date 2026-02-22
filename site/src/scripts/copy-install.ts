/**
 * Copy install command interaction
 * Handles clipboard copy with fallback and toast notification
 */

interface CopyInstallOptions {
  selector: string;
  command: string;
  toastSelector: string;
  toastDuration?: number;
}

export function initCopyInstall(options: CopyInstallOptions): void {
  const { selector, command, toastSelector, toastDuration = 1500 } = options;

  const installBar = document.querySelector(selector);
  const toast = document.querySelector(toastSelector);

  if (!installBar) return;

  let toastTimerId: ReturnType<typeof setTimeout> | null = null;

  function showToast(message: string, isError = false): void {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');

    if (toastTimerId) clearTimeout(toastTimerId);
    toastTimerId = setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.remove('error');
      toast.textContent = 'Copied to clipboard';
    }, toastDuration);
  }

  function fallbackCopy(text: string): boolean {
    const textarea = document.createElement('textarea');
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

  function doCopy(): void {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(command)
        .then(() => showToast('Copied to clipboard', false))
        .catch((error) => {
          console.error('Clipboard copy failed', error);
          try {
            if (fallbackCopy(command)) {
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
      if (fallbackCopy(command)) {
        showToast('Copied to clipboard', false);
        return;
      }
    } catch (error) {
      console.error('Clipboard fallback copy failed', error);
    }

    showToast('Copy failed', true);
  }

  installBar.addEventListener('click', doCopy);
  installBar.addEventListener('keydown', (e: Event) => {
    const keyEvent = e as KeyboardEvent;
    if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
      e.preventDefault();
      doCopy();
    }
  });
}
