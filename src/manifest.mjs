/** Validate local publication metadata. Server registration remains authoritative. */
export function validateManifest(value) {
  const issues = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [{ field: '$', message: 'Expected a manifest object.' }];
  }
  if (value.schemaVersion !== 1) {
    issues.push({ field: 'schemaVersion', message: 'Expected schemaVersion 1.' });
  }
  for (const [field, max] of [['name', 100], ['description', 4096]]) {
    const text = value[field];
    if (typeof text !== 'string' || !text.trim() || text.length > max) {
      issues.push({ field, message: `Expected non-empty text up to ${max} characters.` });
    }
  }
  for (const field of ['entryUrl', 'iconUrl', 'termsUrl']) {
    try {
      if (typeof value[field] !== 'string' || value[field] !== value[field].trim()) throw new Error();
      const url = new URL(value[field]);
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error();
    } catch {
      issues.push({ field, message: 'Expected an absolute HTTPS URL without credentials.' });
    }
  }
  if (value.privacyUrl !== undefined) {
    try {
      if (typeof value.privacyUrl !== 'string' || value.privacyUrl !== value.privacyUrl.trim()) throw new Error();
      const url = new URL(value.privacyUrl);
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error();
    } catch {
      issues.push({ field: 'privacyUrl', message: 'Expected an absolute HTTPS URL without credentials.' });
    }
  }
  if (value.capabilities !== undefined && (
    !Array.isArray(value.capabilities) ||
    value.capabilities.some(x => typeof x !== 'string' || !/^[a-z][a-zA-Z0-9.]*$/.test(x)) ||
    new Set(value.capabilities).size !== value.capabilities.length
  )) {
    issues.push({ field: 'capabilities', message: 'Expected unique capability names.' });
  }
  return issues;
}
