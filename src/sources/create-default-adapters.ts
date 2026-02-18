import { CodexSourceAdapter } from './codex/codex-source-adapter.js';
import { PiSourceAdapter } from './pi/pi-source-adapter.js';
import type { SourceAdapter } from './source-adapter.js';

type MatchesProvider = (
  provider: string | undefined,
  providerFilter: string | undefined,
) => boolean;

export type CreateDefaultAdaptersOptions = {
  piDir?: string;
  codexDir?: string;
};

export type CreateDefaultAdaptersDeps = {
  matchesProvider?: MatchesProvider;
};

function defaultMatchesProvider(
  provider: string | undefined,
  providerFilter: string | undefined,
): boolean {
  if (!providerFilter) {
    return true;
  }

  return provider?.toLowerCase().includes(providerFilter) ?? false;
}

export function createDefaultAdapters(
  options: CreateDefaultAdaptersOptions,
  effectiveProviderFilter: string,
  deps: CreateDefaultAdaptersDeps = {},
): SourceAdapter[] {
  const matchesProvider = deps.matchesProvider ?? defaultMatchesProvider;

  return [
    new PiSourceAdapter({
      sessionsDir: options.piDir,
      providerFilter: (provider) => matchesProvider(provider, effectiveProviderFilter),
    }),
    new CodexSourceAdapter({
      sessionsDir: options.codexDir,
    }),
  ];
}
