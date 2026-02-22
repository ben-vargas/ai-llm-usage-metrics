/**
 * Examples tab system with ARIA support
 * Accessible tab panel implementation
 */

interface TabOptions {
  tabSelector: string;
  panelSelector: string;
  activeClass?: string;
}

export function initExamplesTabs(options: TabOptions): void {
  const { tabSelector, panelSelector, activeClass = 'active' } = options;

  const tabs = document.querySelectorAll(tabSelector);
  const panels = document.querySelectorAll(panelSelector);

  if (tabs.length === 0 || panels.length === 0) return;

  // Set up ARIA attributes
  tabs.forEach((tab, index) => {
    const tabEl = tab as HTMLElement;
    const panelId = tabEl.dataset.panel;
    if (!panelId) return;

    tabEl.setAttribute('role', 'tab');
    tabEl.setAttribute('aria-controls', panelId);
    tabEl.setAttribute('aria-selected', tabEl.classList.contains(activeClass) ? 'true' : 'false');
    tabEl.setAttribute('tabindex', tabEl.classList.contains(activeClass) ? '0' : '-1');

    const panel = document.getElementById(panelId);
    if (panel) {
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `tab-${index}`);
      if (!tabEl.classList.contains(activeClass)) {
        panel.hidden = true;
      }
    }
  });

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const clickedTab = tab as HTMLElement;
      const targetPanelId = clickedTab.dataset.panel;
      if (!targetPanelId) return;

      // Deactivate all tabs and panels
      tabs.forEach((t) => {
        const tEl = t as HTMLElement;
        tEl.classList.remove(activeClass);
        tEl.setAttribute('aria-selected', 'false');
        tEl.setAttribute('tabindex', '-1');
      });

      panels.forEach((p) => {
        const pEl = p as HTMLElement;
        pEl.classList.remove(activeClass);
        pEl.hidden = true;
      });

      // Activate clicked tab
      clickedTab.classList.add(activeClass);
      clickedTab.setAttribute('aria-selected', 'true');
      clickedTab.setAttribute('tabindex', '0');
      clickedTab.focus();

      // Activate target panel
      const targetPanel = document.getElementById(targetPanelId);
      if (targetPanel) {
        targetPanel.classList.add(activeClass);
        targetPanel.hidden = false;
      }
    });

    // Keyboard navigation
    tab.addEventListener('keydown', (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      const currentIndex = Array.from(tabs).indexOf(tab);
      let nextIndex: number | null = null;

      switch (keyEvent.key) {
        case 'ArrowRight':
          nextIndex = (currentIndex + 1) % tabs.length;
          break;
        case 'ArrowLeft':
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = tabs.length - 1;
          break;
      }

      if (nextIndex !== null) {
        e.preventDefault();
        const nextTab = tabs[nextIndex] as HTMLElement;
        nextTab.click();
      }
    });
  });
}
