import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildErrorDistributionFromPrediction,
  buildPerformanceMetricsFromEval,
} from './trainedModelAnalysisData.js';

const field = (values) => ({
  field: values,
});

test('builds error distribution from selected trained model prediction payload', () => {
  const payload = {
    ground_truth: [
      field([
        [1, 2],
        [3, 4],
      ]),
    ],
    prediction: [
      field([
        [1, 3],
        [5, 4],
      ]),
    ],
  };

  const data = buildErrorDistributionFromPrediction(payload, { bins: 4, maxPoints: 10 });

  assert.equal(data.scatter.trues.length, 4);
  assert.equal(data.scatter.preds.length, 4);
  assert.equal(data.hist_errors.counts.reduce((sum, value) => sum + value, 0), 4);
  assert.equal(data.mae, 0.75);
  assert.equal(data.rmse, Math.sqrt(1.25));
});

test('maps trained model eval metrics into current selected model performance shape', () => {
  assert.deepEqual(buildPerformanceMetricsFromEval({
    overall: {
      r2: 0.91,
      rmse: 1.2,
      mae: 0.8,
      ssim: 0.87,
    },
  }), {
    global_r2: 0.91,
    global_rmse: 1.2,
    global_mae: 0.8,
    global_ssim: 0.87,
  });
});
