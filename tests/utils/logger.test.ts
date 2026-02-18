import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../src/utils/logger.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logger', () => {
  it('writes info, warn, and dim messages to stderr', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logger.info('info message');
    logger.warn('warn message');
    logger.dim('dim message');

    expect(errorSpy).toHaveBeenCalledTimes(3);

    const messages = errorSpy.mock.calls.map((call) => String(call[0]));
    expect(messages[0]).toContain('info message');
    expect(messages[1]).toContain('warn message');
    expect(messages[2]).toContain('dim message');
  });
});
