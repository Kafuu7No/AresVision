import { fetchResearchSuite } from '../../../services/api';

const suiteCache = new Map();

export async function loadResearchSuiteCached(marsYear) {
  const key = String(marsYear);
  if (!suiteCache.has(key)) {
    suiteCache.set(key, fetchResearchSuite(marsYear));
  }
  try {
    return await suiteCache.get(key);
  } catch (error) {
    suiteCache.delete(key);
    throw error;
  }
}
