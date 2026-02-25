import type { NumberLike } from '../domain/normalization.js';

export function asTrimmedText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

export function isBlankText(value: string): boolean {
  return value.trim().length === 0;
}

export function toNumberLike(value: unknown): NumberLike {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return value;
  }

  return undefined;
}
