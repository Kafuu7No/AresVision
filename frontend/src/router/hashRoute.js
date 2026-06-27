export function getPageFromHashValue(hashValue, validPages) {
  const normalized = String(hashValue || '').replace(/^#\/?/, '');
  const page = normalized.split(/[?#]/)[0] || 'home';
  return validPages.includes(page) ? page : 'home';
}

export function getCurrentPageFromHash(validPages) {
  if (typeof window === 'undefined') return 'home';
  return getPageFromHashValue(window.location.hash, validPages);
}
