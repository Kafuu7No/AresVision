import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDistributionStats } from './distributionStats.js';

test('distribution stats always read the MCD main slice', () => {
  const stats = buildDistributionStats({
    points: [
      { lat: 10, lng: 0, val: 1 },
      { lat: 10, lng: 5, val: 3 },
      { lat: -10, lng: 0, val: 5 },
    ],
  });

  assert.equal(stats.mean, 3);
  assert.equal(stats.latProfile.length, 2);
});

test('distribution stats returns null for empty slices', () => {
  assert.equal(buildDistributionStats({ points: [] }), null);
  assert.equal(buildDistributionStats(null), null);
});
