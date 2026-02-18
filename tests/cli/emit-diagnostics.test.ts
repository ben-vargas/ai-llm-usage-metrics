import { describe, expect, it, vi } from 'vitest';

import { emitDiagnostics, type DiagnosticsLogger } from '../../src/cli/emit-diagnostics.js';
import type { UsageDiagnostics } from '../../src/cli/usage-data-contracts.js';

function createLoggerSpy(): DiagnosticsLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    dim: vi.fn(),
  };
}

function createDiagnostics(overrides: Partial<UsageDiagnostics> = {}): UsageDiagnostics {
  return {
    sessionStats: [],
    pricingOrigin: 'none',
    activeEnvOverrides: [],
    timezone: 'UTC',
    ...overrides,
  };
}

describe('emitDiagnostics', () => {
  it('warns when no sessions were found and pricing is not loaded', () => {
    const diagnosticsLogger = createLoggerSpy();

    emitDiagnostics(createDiagnostics(), diagnosticsLogger);

    expect(diagnosticsLogger.warn).toHaveBeenCalledWith('No sessions found');
    expect(diagnosticsLogger.info).not.toHaveBeenCalled();
    expect(diagnosticsLogger.dim).not.toHaveBeenCalled();
  });

  it('emits session stats before pricing diagnostics in terminal order', () => {
    const callSequence: string[] = [];

    const diagnosticsLogger: DiagnosticsLogger = {
      info: (message) => {
        callSequence.push(`info:${message}`);
      },
      warn: (message) => {
        callSequence.push(`warn:${message}`);
      },
      dim: (message) => {
        callSequence.push(`dim:${message}`);
      },
    };

    emitDiagnostics(
      createDiagnostics({
        sessionStats: [
          { source: 'pi', filesFound: 1, eventsParsed: 2 },
          { source: 'codex', filesFound: 2, eventsParsed: 3 },
        ],
        pricingOrigin: 'cache',
      }),
      diagnosticsLogger,
    );

    expect(callSequence).toEqual([
      'info:Found 3 session file(s) with 5 event(s)',
      'dim:  pi: 1 file(s), 2 events',
      'dim:  codex: 2 file(s), 3 events',
      'info:Loaded pricing from cache',
    ]);
  });

  it.each([
    ['cache', 'Loaded pricing from cache', 'info'],
    ['network', 'Fetched pricing from LiteLLM', 'info'],
    ['offline-cache', 'Using cached pricing (offline mode)', 'info'],
    ['fallback', 'Using bundled fallback pricing', 'warn'],
  ] as const)('emits pricing message for "%s" origin', (origin, message, level) => {
    const diagnosticsLogger = createLoggerSpy();

    emitDiagnostics(
      createDiagnostics({
        sessionStats: [{ source: 'pi', filesFound: 1, eventsParsed: 1 }],
        pricingOrigin: origin,
      }),
      diagnosticsLogger,
    );

    if (level === 'info') {
      expect(diagnosticsLogger.info).toHaveBeenCalledWith(message);
      return;
    }

    expect(diagnosticsLogger.warn).toHaveBeenCalledWith(message);
  });
});
