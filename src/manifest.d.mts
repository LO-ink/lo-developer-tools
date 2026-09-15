export interface ManifestIssue {
  readonly field: string;
  readonly message: string;
}

export interface ManifestValidationOptions {
  /** Also require the avatar, description, and terms URL needed for publication. */
  readonly publication?: boolean;
}

/**
 * Validate a local Mini App manifest using the server's draft metadata rules.
 * This does not contact the server or prove that an app can be published.
 */
export function validateManifest(
  value: unknown,
  options?: ManifestValidationOptions,
): ManifestIssue[];
