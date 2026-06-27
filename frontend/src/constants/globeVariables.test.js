import test from 'node:test';
import assert from 'node:assert/strict';

import { GLOBE_VARIABLE_OPTIONS } from './globeVariables.js';

test('overview globe variables exclude dust optical depth', () => {
  const ids = GLOBE_VARIABLE_OPTIONS.map((option) => option.id);

  assert.equal(ids.includes('Dust_Optical_Depth'), false);
});
