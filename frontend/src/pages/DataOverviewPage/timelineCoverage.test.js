import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCoverageSegments,
  getActiveOzoneSources,
  getOzoneAvailabilityLabel,
} from './timelineCoverage.js';

test('coverage intervals are converted to clamped rail percentages', () => {
  const segments = buildCoverageSegments({
    coverage: {
      nomad: {
        34: [
          { start: -10, end: 30 },
          { start: 180, end: 450 },
        ],
      },
    },
    marsYear: 34,
    source: 'nomad',
    min: 0,
    max: 360,
  });

  assert.deepEqual(segments, [
    { start: 0, end: 30, left: 0, width: 8.333 },
    { start: 180, end: 360, left: 50, width: 50 },
  ]);
});

test('active ozone sources always include MCD and add sources covering current Ls', () => {
  const coverage = {
    openmars: { 34: [{ start: 5, end: 12 }] },
    nomad: { 34: [{ start: 10, end: 20 }] },
  };

  assert.deepEqual(getActiveOzoneSources({ coverage, marsYear: 34, ls: 4 }), ['mcd']);
  assert.deepEqual(getActiveOzoneSources({ coverage, marsYear: 34, ls: 10 }), ['mcd', 'openmars', 'nomad']);
  assert.deepEqual(getActiveOzoneSources({ coverage, marsYear: 34, ls: 16 }), ['mcd', 'nomad']);
});

test('availability label describes single and multi-source ozone states', () => {
  assert.equal(getOzoneAvailabilityLabel(['mcd'], true), '仅 MCD');
  assert.equal(getOzoneAvailabilityLabel(['mcd', 'nomad'], true), 'MCD + NOMAD');
  assert.equal(getOzoneAvailabilityLabel(['mcd', 'openmars', 'nomad'], true), '多源臭氧');
  assert.equal(getOzoneAvailabilityLabel(['mcd'], false), 'MCD only');
  assert.equal(getOzoneAvailabilityLabel(['mcd', 'openmars', 'nomad'], false), 'Multi-source ozone');
});
