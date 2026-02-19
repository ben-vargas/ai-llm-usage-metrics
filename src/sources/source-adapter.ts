import type { UsageEvent, SourceId } from '../domain/usage-event.js';
import { asRecord } from '../utils/as-record.js';

export interface SourceAdapter<Event extends UsageEvent = UsageEvent> {
  readonly id: SourceId;
  discoverFiles(): Promise<string[]>;
  parseFile(filePath: string): Promise<Event[]>;
}

export function isSourceAdapter(candidate: unknown): candidate is SourceAdapter {
  const adapter = asRecord(candidate);

  if (!adapter) {
    return false;
  }

  return (
    typeof adapter.id === 'string' &&
    adapter.id.trim().length > 0 &&
    typeof adapter.discoverFiles === 'function' &&
    typeof adapter.parseFile === 'function'
  );
}
