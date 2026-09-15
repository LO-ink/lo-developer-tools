function codePoints(value) {
  return Array.from(value).length;
}

function utf8Bytes(value) {
  return Buffer.byteLength(value, 'utf8');
}

function isMiniAppUrl(value, { required }) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  if (!normalized) return !required;
  const authority = normalized.slice('https://'.length).split(/[/?#]/, 1)[0];
  if (
    utf8Bytes(normalized) > 2048 ||
    !normalized.startsWith('https://') ||
    !authority ||
    normalized.includes('\\') ||
    authority.includes('@') ||
    /[\u0000-\u001f\u007f]/.test(normalized) ||
    /%(?![0-9a-f]{2})/i.test(normalized)
  ) return false;
  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password && !url.hash;
  } catch {
    return false;
  }
}

/**
 * Validate a local Mini App manifest using the server's draft metadata rules.
 * Set `publication` to also require the stored profile fields needed to publish.
 */
export function validateManifest(value, options = {}) {
  const publication = options?.publication === true;
  const issues = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [{ field: '$', message: 'Expected a manifest object.' }];
  }
  if (value.schemaVersion !== 1) {
    issues.push({ field: 'schemaVersion', message: 'Expected schemaVersion 1.' });
  }
  const name = value.name;
  if (typeof name !== 'string' || !name.trim() || codePoints(name.trim()) > 64) {
    issues.push({ field: 'name', message: 'Expected non-empty text up to 64 Unicode code points.' });
  }
  const description = value.description;
  if (description !== undefined && (typeof description !== 'string' || codePoints(description.trim()) > 512)) {
    issues.push({ field: 'description', message: 'Expected text up to 512 Unicode code points.' });
  }

  if (!isMiniAppUrl(value.entryUrl, { required: true })) {
    issues.push({ field: 'entryUrl', message: 'Expected an absolute HTTPS URL up to 2048 UTF-8 bytes, without credentials or a fragment.' });
  }
  for (const field of ['iconUrl', 'termsUrl', 'privacyUrl']) {
    if (value[field] !== undefined && !isMiniAppUrl(value[field], { required: false })) {
      issues.push({ field, message: 'Expected an empty value or an absolute HTTPS URL up to 2048 UTF-8 bytes, without credentials or a fragment.' });
    }
  }
  if (value.capabilities !== undefined && (
    !Array.isArray(value.capabilities) ||
    value.capabilities.some(x => typeof x !== 'string' || !/^[a-z][a-zA-Z0-9.]*$/.test(x)) ||
    new Set(value.capabilities).size !== value.capabilities.length
  )) {
    issues.push({ field: 'capabilities', message: 'Expected unique capability names.' });
  }

  if (publication) {
    if ((typeof description !== 'string' || !description.trim()) && !issues.some(issue => issue.field === 'description')) {
      issues.push({ field: 'description', message: 'Publication requires a non-empty description.' });
    }
    if (!isMiniAppUrl(value.iconUrl, { required: true }) && !issues.some(issue => issue.field === 'iconUrl')) {
      issues.push({ field: 'iconUrl', message: 'Publication requires a valid app avatar URL.' });
    }
    if (!isMiniAppUrl(value.termsUrl, { required: true }) && !issues.some(issue => issue.field === 'termsUrl')) {
      issues.push({ field: 'termsUrl', message: 'Publication requires a valid terms URL.' });
    }
  }
  return issues;
}
