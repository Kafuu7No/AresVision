import test from 'node:test';
import assert from 'node:assert/strict';

import { pointsToFieldData } from './fieldGrid.js';

test('sparse overview points keep their fixed 36 by 72 Mars grid position', () => {
  const result = pointsToFieldData({
    points: [{ lat: 87.5, lng: -180, val: 4 }],
    minVal: 4,
    maxVal: 4,
  });

  assert.equal(result.field.length, 36);
  assert.equal(result.field[0].length, 72);
  assert.equal(result.field[0][0], 4);
  assert.equal(Number.isNaN(result.field[0][1]), true);
  assert.equal(Number.isNaN(result.field[1][0]), true);
});

test('sparse overview points map longitude 175 to the last grid cell', () => {
  const result = pointsToFieldData({
    points: [{ lat: -87.5, lng: 175, val: -2 }],
    minVal: -2,
    maxVal: -2,
  });

  assert.equal(result.field[35][71], -2);
});
