import { describe, expect, it } from 'vitest';

import { renderReportHeader } from '../../src/render/report-header.js';
import { visibleWidth } from '../../src/render/table-text-layout.js';

describe('renderReportHeader', () => {
  it('renders a plain boxed header when color is disabled', () => {
    const rendered = renderReportHeader({
      title: 'Monthly Token Usage Report',
      timezone: 'UTC',
      useColor: false,
    });

    expect(rendered).toContain('┌');
    expect(rendered).toContain('┐');
    expect(rendered).toContain('└');
    expect(rendered).toContain('┘');
    expect(rendered).toContain('Monthly Token Usage Report (Timezone: UTC)');
    expect(rendered.includes('\u001b[')).toBe(false);
  });

  it('renders header content when color is enabled', () => {
    const rendered = renderReportHeader({
      title: 'Daily Token Usage Report',
      timezone: 'Africa/Casablanca',
      useColor: true,
    });

    expect(rendered).toContain('Daily Token Usage Report (Timezone: Africa/Casablanca)');
    expect(rendered).toContain('┌');
    expect(rendered).toContain('┘');
  });

  it('keeps header borders aligned for wide unicode characters', () => {
    const rendered = renderReportHeader({
      title: 'Usage 漢字',
      timezone: 'UTC',
      useColor: false,
    });

    const lineWidths = rendered.split('\n').map((line) => visibleWidth(line));

    expect(new Set(lineWidths)).toEqual(new Set([lineWidths[0]]));
  });
});
