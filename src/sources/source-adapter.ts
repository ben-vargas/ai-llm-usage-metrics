import type { UsageEvent, SourceId } from '../domain/usage-event.js';

export interface SourceAdapter<Event extends UsageEvent = UsageEvent> {
  readonly id: SourceId;
  discoverFiles(): Promise<string[]>;
  parseFile(filePath: string): Promise<Event[]>;
}

export function isSourceAdapter(candidate: unknown): candidate is SourceAdapter {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const adapter = candidate as Partial<SourceAdapter>;

  return (
    typeof adapter.id === 'string' &&
    adapter.id.length > 0 &&
    typeof adapter.discoverFiles === 'function' &&
    typeof adapter.parseFile === 'function'
  );
}
