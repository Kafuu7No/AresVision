import test from 'node:test';
import assert from 'node:assert/strict';

import { clearPredictCache, getPredictCache } from './predictCache.js';

test('predict cache defaults to workflow mode so the new canvas is immediately visible', () => {
  clearPredictCache();

  assert.equal(getPredictCache().predictionMode, 'workflow');
});
