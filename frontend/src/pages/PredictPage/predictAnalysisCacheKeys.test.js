import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildErrorDistributionKey,
  buildTrainingModelCompareKey,
  buildPermutationImportanceKey,
  buildPredictMetricsKey,
} from './predictAnalysisCacheKeys.js';

test('trained model metrics and distribution keys ignore repeated Ls changes', () => {
  const base = {
    modelMode: 'trained',
    trainingTaskId: 42,
    horizon: 3,
    selectedVars: ['Temperature'],
    marsYear: 27,
    lsStart: 90,
  };

  assert.equal(
    buildPredictMetricsKey(base),
    buildPredictMetricsKey({ ...base, lsStart: 180, selectedVars: ['U_Wind'] })
  );
  assert.equal(
    buildErrorDistributionKey(base),
    buildErrorDistributionKey({ ...base, lsStart: 180, selectedVars: ['U_Wind'] })
  );
});

test('trained model permutation importance key changes when selected variables change', () => {
  const base = {
    modelMode: 'trained',
    trainingTaskId: 42,
    horizon: 3,
    selectedVars: ['Temperature'],
  };

  assert.notEqual(
    buildPermutationImportanceKey(base),
    buildPermutationImportanceKey({ ...base, selectedVars: ['U_Wind'] })
  );
});

test('system distribution key ignores Ls but follows selected variables', () => {
  assert.equal(
    buildErrorDistributionKey({
      modelMode: 'system',
      dataSourceMode: 'default',
      selectedVars: ['V_Wind', 'Temperature'],
    }),
    buildErrorDistributionKey({
      modelMode: 'system',
      dataSourceMode: 'default',
      selectedVars: ['Temperature', 'V_Wind'],
    })
  );

  assert.notEqual(
    buildErrorDistributionKey({
      modelMode: 'system',
      dataSourceMode: 'default',
      selectedVars: ['Temperature'],
    }),
    buildErrorDistributionKey({
      modelMode: 'system',
      dataSourceMode: 'default',
      selectedVars: ['U_Wind'],
    })
  );
});

test('training model comparison key is stable for reordered task ids', () => {
  assert.equal(
    buildTrainingModelCompareKey({ taskIds: [18, 12, 23], horizon: 3, compareType: 'metrics' }),
    'compare:12,18,23:h:3:type:metrics'
  );
  assert.equal(
    buildTrainingModelCompareKey({ taskIds: [23, 18, 12], horizon: 3, compareType: 'metrics' }),
    'compare:12,18,23:h:3:type:metrics'
  );
});

test('training model comparison key requires at least two valid task ids', () => {
  assert.equal(buildTrainingModelCompareKey({ taskIds: [12], horizon: 3, compareType: 'metrics' }), null);
  assert.equal(buildTrainingModelCompareKey({ taskIds: [12, 'abc'], horizon: 3, compareType: 'metrics' }), null);
});
