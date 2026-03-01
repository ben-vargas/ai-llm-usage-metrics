const billingProviderAliases = new Map<string, string>([
  ['openai-codex', 'openai'],
  ['github-copilot', 'github'],
]);

const billingProviderPrefixAliases: Array<[prefix: string, billingProvider: string]> = [
  ['openai-', 'openai'],
  ['openai/', 'openai'],
];

export function normalizeProviderToBillingEntity(provider: string | undefined): string | undefined {
  if (!provider) {
    return undefined;
  }

  const normalizedProvider = provider.trim().toLowerCase();

  if (normalizedProvider.length === 0) {
    return undefined;
  }

  const aliasedProvider = billingProviderAliases.get(normalizedProvider);

  if (aliasedProvider) {
    return aliasedProvider;
  }

  for (const [prefix, billingProvider] of billingProviderPrefixAliases) {
    if (normalizedProvider.startsWith(prefix)) {
      return billingProvider;
    }
  }

  return normalizedProvider;
}
