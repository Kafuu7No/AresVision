import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PREDICT_MODEL_MODE,
  PREDICT_MODEL_MODES,
  normalizePredictModelMode,
} from './predictModelModes.js';

test('predict model source options hide the system model mode', () => {
  assert.deepEqual(PREDICT_MODEL_MODES, ['trained', 'trained_compare']);
  assert.equal(PREDICT_MODEL_MODES.includes('system'), false);
});

test('predict model mode falls back to trained when cache contains removed system mode', () => {
  assert.equal(DEFAULT_PREDICT_MODEL_MODE, 'trained');
  assert.equal(normalizePredictModelMode('system'), 'trained');
  assert.equal(normalizePredictModelMode(''), 'trained');
  assert.equal(normalizePredictModelMode(null), 'trained');
  assert.equal(normalizePredictModelMode('trained_compare'), 'trained_compare');
});
