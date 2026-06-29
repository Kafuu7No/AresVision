import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAssessmentConfigKey, buildDeepSpaceAssessment } from './deepSpaceAssessment.js';

const lowRiskMetrics = {
  rmse: 0.7,
  mae: 0.4,
  ssim: 0.97,
  r2: 0.99,
};

const highRiskMetrics = {
  rmse: 5.8,
  mae: 3.1,
  ssim: 0.61,
  r2: 0.42,
};

const dustDominantPfi = {
  baseline_r2: 0.96,
  importances: [
    { variable: 'Dust_Optical_Depth', delta_r2: 0.42 },
    { variable: 'V_Wind', delta_r2: 0.21 },
    { variable: 'Temperature', delta_r2: 0.12 },
  ],
};

test('maps strong diagnostics to a recommended mission window', () => {
  const result = buildDeepSpaceAssessment({
    mode: 'window',
    taskType: 'orbital-observation',
    targetRegion: 'global',
    riskPosture: 'standard',
    marsYear: 27,
    lsStart: 90,
    horizon: 3,
    metrics: lowRiskMetrics,
    pfi: dustDominantPfi,
  });

  assert.equal(result.level, 'recommended');
  assert.ok(result.score < 35);
  assert.equal(result.recommendedStep, 2);
  assert.ok(result.riskDrivers.some((driver) => driver.key === 'dust'));
  assert.ok(result.narrative.includes('MY27'));
});

test('maps weak diagnostics and landing exposure to delayed execution', () => {
  const result = buildDeepSpaceAssessment({
    mode: 'landing',
    taskType: 'landing-rover',
    targetRegion: 'south-polar',
    riskPosture: 'standard',
    marsYear: 28,
    lsStart: 180,
    horizon: 3,
    metrics: highRiskMetrics,
    pfi: dustDominantPfi,
  });

  assert.equal(result.level, 'delay');
  assert.ok(result.score >= 70);
  assert.ok(result.avoidRegions.includes('南极区'));
  assert.ok(result.monitoringVariables.includes('Dust'));
});

test('conservative posture increases risk compared with aggressive posture', () => {
  const conservative = buildDeepSpaceAssessment({
    mode: 'window',
    taskType: 'crewed-precheck',
    targetRegion: 'equatorial',
    riskPosture: 'conservative',
    metrics: lowRiskMetrics,
    pfi: dustDominantPfi,
  });
  const aggressive = buildDeepSpaceAssessment({
    mode: 'window',
    taskType: 'crewed-precheck',
    targetRegion: 'equatorial',
    riskPosture: 'aggressive',
    metrics: lowRiskMetrics,
    pfi: dustDominantPfi,
  });

  assert.ok(conservative.score > aggressive.score);
});

test('uses overall metrics payload from prediction metrics endpoint', () => {
  const result = buildDeepSpaceAssessment({
    mode: 'landing',
    riskPosture: 'standard',
    targetRegion: 'south-polar',
    metrics: { overall: highRiskMetrics },
    pfi: dustDominantPfi,
  });

  assert.equal(result.level, 'delay');
  assert.ok(result.score >= 70);
});

test('builds distinct config keys when mission mode changes', () => {
  const base = {
    mode: 'window',
    taskType: 'orbital-observation',
    targetRegion: 'global',
    riskPosture: 'standard',
    marsYear: 27,
    lsStart: 90,
    horizon: 3,
  };

  assert.notEqual(
    buildAssessmentConfigKey(base),
    buildAssessmentConfigKey({ ...base, mode: 'landing', targetRegion: 'equatorial' })
  );
});
