/**
 * PredictPage 模块级缓存
 *
 * 在 SPA 生命周期内保持存活，不随组件卸载消失。
 * 仅在浏览器刷新（完全重载）时清空。
 */

const cache = {
  results: null,
  metrics: null,
  errorDistData: null,
  performanceData: null,
  params: null,
  activeHorizon: 0,
  viewMode: 'triptych',
  compareConfigs: [],
  selectedCompareIds: [],
};

export function getPredictCache() {
  return { ...cache };
}

export function setPredictCache(updates) {
  Object.assign(cache, updates);
}

export function clearPredictCache() {
  cache.results = null;
  cache.metrics = null;
  cache.errorDistData = null;
  cache.performanceData = null;
  cache.params = null;
  cache.activeHorizon = 0;
  cache.viewMode = 'triptych';
  cache.compareConfigs = [];
  cache.selectedCompareIds = [];
}
