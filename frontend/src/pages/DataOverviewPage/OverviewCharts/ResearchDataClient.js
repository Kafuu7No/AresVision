import { fetchResearchSuite } from '../../../services/api';

const suiteCache = new Map();

export async function loadResearchSuiteCached(marsYear, options = {}) {
  const dataSource = options?.dataSource || 'default';
  const key = `${dataSource}:${marsYear}`;
  if (!suiteCache.has(key)) {
    suiteCache.set(key, fetchResearchSuite(marsYear, options));
  }
  try {
    return await suiteCache.get(key);
  } catch (error) {
    suiteCache.delete(key);
    throw error;
  }
}
