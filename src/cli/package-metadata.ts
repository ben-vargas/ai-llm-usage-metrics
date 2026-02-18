import { createRequire } from 'node:module';

type PackageJson = {
  name?: string;
  version?: string;
};

export type PackageMetadata = {
  packageName: string;
  packageVersion: string;
};

const DEFAULT_PACKAGE_NAME = 'llm-usage-metrics';
const DEFAULT_PACKAGE_VERSION = '0.0.0';

const defaultPackageJsonCandidates = ['../package.json', '../../package.json'] as const;

type JsonLoader = (path: string) => unknown;

function normalizeMetadata(candidate: unknown): PackageMetadata | undefined {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return undefined;
  }

  const packageJson = candidate as PackageJson;
  const packageName = packageJson.name?.trim();
  const packageVersion = packageJson.version?.trim();

  if (!packageName || !packageVersion) {
    return undefined;
  }

  return {
    packageName,
    packageVersion,
  };
}

export function resolvePackageMetadata(
  loadJson: JsonLoader,
  packageJsonCandidates: readonly string[] = defaultPackageJsonCandidates,
): PackageMetadata {
  for (const candidatePath of packageJsonCandidates) {
    try {
      const metadata = normalizeMetadata(loadJson(candidatePath));

      if (metadata) {
        return metadata;
      }
    } catch {
      continue;
    }
  }

  return {
    packageName: DEFAULT_PACKAGE_NAME,
    packageVersion: DEFAULT_PACKAGE_VERSION,
  };
}

export function loadPackageMetadataFromRuntime(): PackageMetadata {
  const require = createRequire(import.meta.url);
  return resolvePackageMetadata((candidatePath) => require(candidatePath));
}
