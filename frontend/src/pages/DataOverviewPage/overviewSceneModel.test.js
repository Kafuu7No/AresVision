import test from 'node:test';
import assert from 'node:assert/strict';

import { buildOverviewSceneModel } from './overviewSceneModel.js';

test('scene model uses only the MCD layer when multi-source data is missing', () => {
  const model = buildOverviewSceneModel({
    globeVariable: 'o3col',
    ozoneDisplayMode: 'multi-source',
    ozoneDiffPair: 'MCD-OpenMARS',
    mainSlice: { variable: 'o3col', points: [{ lat: 0, lng: 0, val: 1 }], minVal: 1, maxVal: 1 },
    ozoneOverlay: {
      available_sources: ['mcd'],
      mcd: { source: 'mcd', points: [{ lat: 0, lng: 0, val: 1 }], minVal: 1, maxVal: 1 },
      openmars: null,
      diff_candidates: [],
    },
  });

  assert.equal(model.renderMode, 'single');
  assert.equal(model.layers.length, 1);
  assert.equal(model.layers[0].id, 'mcd');
});

test('scene model builds MCD minus OpenMARS diff layer', () => {
  const model = buildOverviewSceneModel({
    globeVariable: 'o3col',
    ozoneDisplayMode: 'diff',
    ozoneDiffPair: 'MCD-OpenMARS',
    mainSlice: { variable: 'o3col', points: [], minVal: 0, maxVal: 1 },
    ozoneOverlay: {
      mcd: {
        source: 'mcd',
        points: [{ lat: 0, lng: 0, val: 5 }, { lat: 5, lng: 5, val: 8 }],
        minVal: 5,
        maxVal: 8,
      },
      openmars: {
        source: 'openmars',
        points: [{ lat: 0, lng: 0, val: 2 }, { lat: 5, lng: 5, val: 3 }],
        minVal: 2,
        maxVal: 3,
      },
      diff_candidates: ['MCD-OpenMARS'],
    },
  });

  assert.equal(model.renderMode, 'diff');
  assert.equal(model.legendMode, 'diff');
  assert.equal(model.colorMode, 'rdbu');
  assert.deepEqual(model.layers[0].points.map((point) => point.val), [3, 5]);
});

test('scene model builds MCD minus NOMAD diff layer only on shared sparse cells', () => {
  const model = buildOverviewSceneModel({
    globeVariable: 'o3col',
    ozoneDisplayMode: 'diff',
    ozoneDiffPair: 'MCD-NOMAD',
    mainSlice: { variable: 'o3col', points: [], minVal: 0, maxVal: 1 },
    ozoneOverlay: {
      mcd: {
        source: 'mcd',
        points: [
          { lat: 0, lng: 0, val: 9 },
          { lat: 5, lng: 5, val: 8 },
        ],
        minVal: 8,
        maxVal: 9,
      },
      nomad: {
        source: 'nomad',
        points: [{ lat: 0, lng: 0, val: 4 }],
        minVal: 4,
        maxVal: 4,
      },
      diff_candidates: ['MCD-NOMAD'],
    },
  });

  assert.equal(model.renderMode, 'diff');
  assert.equal(model.layers[0].id, 'MCD-NOMAD');
  assert.deepEqual(model.layers[0].points, [{ lat: 0, lng: 0, val: 5 }]);
});

test('scene model builds MCD background plus NOMAD validation diff points', () => {
  const model = buildOverviewSceneModel({
    globeVariable: 'o3col',
    ozoneDisplayMode: 'validation',
    ozoneDiffPair: 'MCD-NOMAD',
    mainSlice: { variable: 'o3col', points: [], minVal: 0, maxVal: 1 },
    ozoneOverlay: {
      mcd: {
        source: 'mcd',
        points: [{ lat: 0, lng: 0, val: 9 }],
        minVal: 9,
        maxVal: 9,
      },
      validation: {
        nomad: {
          comparison: 'MCD-NOMAD',
          sample_count: 1,
          minDiff: 5,
          maxDiff: 5,
          points: [{ lat: 0, lng: 0, val: 5, mcd_value: 9, nomad_value: 4, count: 7 }],
        },
      },
    },
  });

  assert.equal(model.renderMode, 'validation');
  assert.equal(model.legendMode, 'validation');
  assert.equal(model.layers.length, 2);
  assert.equal(model.layers[0].id, 'mcd');
  assert.equal(model.layers[1].id, 'MCD-NOMAD');
  assert.equal(model.layers[1].colorMode, 'rdbu');
  assert.deepEqual(model.layers[1].points, [{ lat: 0, lng: 0, val: 5, mcd_value: 9, nomad_value: 4, count: 7 }]);
  assert.equal(model.validation.nomad.sample_count, 1);
});
