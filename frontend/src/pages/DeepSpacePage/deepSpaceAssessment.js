const REGION_LABELS = {
  global: '全球',
  north: '北半球',
  south: '南半球',
  equatorial: '赤道带',
  polar: '极区',
  'north-polar': '北极区',
  'north-mid': '北中纬',
  'south-mid': '南中纬',
  'south-polar': '南极区',
};

const VARIABLE_LABELS = {
  Temperature: 'Temperature',
  Dust_Optical_Depth: 'Dust',
  Solar_Flux_DN: 'Solar Flux',
  U_Wind: 'U Wind',
  V_Wind: 'V Wind',
  o3col: 'Ozone',
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function numberOr(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeImportanceItems(pfi) {
  const raw = Array.isArray(pfi?.importances)
    ? pfi.importances
    : Array.isArray(pfi?.features)
      ? pfi.features
      : Array.isArray(pfi)
        ? pfi
        : [];

  return raw
    .map((item) => {
      const variable = item.variable || item.feature || item.name || item.key;
      const value = numberOr(item.delta_r2 ?? item.importance ?? item.value ?? item.score, 0);
      return variable ? { variable, value } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.value - a.value);
}

function buildRiskDrivers(pfiItems, metrics) {
  const drivers = [];
  const topItems = pfiItems.slice(0, 4);

  for (const item of topItems) {
    const variableLabel = VARIABLE_LABELS[item.variable] || item.variable;
    const key = item.variable === 'Dust_Optical_Depth'
      ? 'dust'
      : item.variable === 'Solar_Flux_DN'
        ? 'solar'
        : item.variable === 'U_Wind' || item.variable === 'V_Wind'
          ? 'wind'
          : item.variable === 'Temperature'
            ? 'temperature'
            : 'feature';
    drivers.push({
      key,
      label: variableLabel,
      impact: item.value,
      description: `${variableLabel} 对当前风险判定贡献较高，需要作为任务监测变量。`,
    });
  }

  if (numberOr(metrics?.rmse, 0) > 3 || numberOr(metrics?.mae, 0) > 2) {
    drivers.push({
      key: 'uncertainty',
      label: '预测不确定性',
      impact: numberOr(metrics?.rmse, 0),
      description: '误差指标偏高，任务窗口需要更保守的执行策略。',
    });
  }

  if (drivers.length === 0) {
    drivers.push({
      key: 'stable',
      label: '环境稳定',
      impact: 0,
      description: '当前诊断未显示突出的单一风险驱动因子。',
    });
  }

  return drivers;
}

function deriveMonitoringVariables(pfiItems, mode) {
  const variables = pfiItems
    .slice(0, 5)
    .map((item) => VARIABLE_LABELS[item.variable] || item.variable)
    .filter(Boolean);
  const defaults = mode === 'landing'
    ? ['Dust', 'U Wind', 'V Wind', 'Solar Flux']
    : ['Dust', 'Solar Flux', 'Temperature'];
  return Array.from(new Set([...variables, ...defaults])).slice(0, 6);
}

function deriveRegions(targetRegion, score) {
  const targetLabel = REGION_LABELS[targetRegion] || REGION_LABELS.global;
  const avoidRegions = [];

  if (targetRegion === 'south-polar' || targetRegion === 'polar') avoidRegions.push('南极区');
  if (targetRegion === 'north-polar' || targetRegion === 'polar') avoidRegions.push('北极区');
  if (score >= 70 && targetRegion !== 'global') avoidRegions.push(targetLabel);
  if (score >= 55 && avoidRegions.length === 0) avoidRegions.push('极区');

  const recommendedRegions = score >= 70
    ? ['赤道带', '北中纬']
    : targetRegion === 'global'
      ? ['赤道带', '北半球']
      : [targetLabel];

  return {
    recommendedRegions: Array.from(new Set(recommendedRegions)),
    avoidRegions: Array.from(new Set(avoidRegions)),
  };
}

export function buildAssessmentConfigKey({
  mode = 'window',
  taskType = 'orbital-observation',
  targetRegion = 'global',
  riskPosture = 'standard',
  marsYear = 27,
  lsStart = 90,
  horizon = 3,
  landingDuration = 'short',
} = {}) {
  return [
    mode,
    taskType,
    targetRegion,
    riskPosture,
    marsYear,
    lsStart,
    horizon,
    landingDuration,
  ].join('|');
}

export function buildDeepSpaceAssessment({
  mode = 'window',
  taskType = 'orbital-observation',
  targetRegion = 'global',
  riskPosture = 'standard',
  marsYear = 27,
  lsStart = 90,
  horizon = 3,
  metrics = {},
  pfi = {},
} = {}) {
  const metricSource = metrics?.overall || metrics || {};
  const rmse = numberOr(metricSource.rmse ?? metricSource.global_rmse, 1.5);
  const mae = numberOr(metricSource.mae ?? metricSource.global_mae, 0.9);
  const ssim = numberOr(metricSource.ssim ?? metricSource.global_ssim, 0.9);
  const r2 = numberOr(metricSource.r2 ?? metricSource.global_r2, 0.9);
  const pfiItems = normalizeImportanceItems(pfi);
  const topImportance = pfiItems[0]?.value ?? 0;
  const dustImportance = pfiItems.find((item) => item.variable === 'Dust_Optical_Depth')?.value ?? 0;
  const windImportance = pfiItems
    .filter((item) => item.variable === 'U_Wind' || item.variable === 'V_Wind')
    .reduce((sum, item) => sum + item.value, 0);
  const solarImportance = pfiItems.find((item) => item.variable === 'Solar_Flux_DN')?.value ?? 0;

  let score = 0;
  score += clamp(rmse / 6, 0, 1) * 24;
  score += clamp(mae / 4, 0, 1) * 16;
  score += clamp((0.92 - ssim) / 0.42, 0, 1) * 18;
  score += clamp((0.9 - r2) / 0.6, 0, 1) * 20;
  score += clamp(topImportance / 0.5, 0, 1) * 10;
  score += clamp((dustImportance + solarImportance + windImportance) / 0.8, 0, 1) * 12;

  if (mode === 'landing') score += 8;
  if (taskType === 'crewed-precheck') score += 6;
  if (targetRegion.includes('polar')) score += 6;
  if (riskPosture === 'conservative') score += 12;
  if (riskPosture === 'aggressive') score -= 10;

  score = Math.round(clamp(score, 0, 100));

  const level = score >= 70 ? 'delay' : score >= 35 ? 'caution' : 'recommended';
  const { recommendedRegions, avoidRegions } = deriveRegions(targetRegion, score);
  const riskDrivers = buildRiskDrivers(pfiItems, { rmse, mae, ssim, r2 });
  const monitoringVariables = deriveMonitoringVariables(pfiItems, mode);
  const recommendedStep = level === 'delay' ? Math.max(1, Math.min(horizon, 1)) : Math.max(1, Math.min(horizon, 2));
  const targetLabel = REGION_LABELS[targetRegion] || REGION_LABELS.global;
  const levelText = level === 'recommended' ? '推荐' : level === 'caution' ? '谨慎' : '暂缓';

  return {
    score,
    level,
    levelText,
    recommendedStep,
    recommendedRegions,
    avoidRegions,
    riskDrivers,
    monitoringVariables,
    narrative: `MY${marsYear} Ls=${lsStart}° ${targetLabel}窗口评估为${levelText}，建议优先检查第 ${recommendedStep} 步预测结果。`,
  };
}
