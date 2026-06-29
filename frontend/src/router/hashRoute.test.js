import test from 'node:test';
import assert from 'node:assert/strict';

import { getPageFromHashValue } from './hashRoute.js';

const validPages = ['home', 'overview', 'explore', 'predict', 'training', 'deep-space', 'ai', 'about'];

test('parses hash routes with query parameters', () => {
  assert.equal(getPageFromHashValue('#/training?from=workflow', validPages), 'training');
});

test('falls back to home for unknown hash routes', () => {
  assert.equal(getPageFromHashValue('#/unknown?from=workflow', validPages), 'home');
});

test('parses deep space exploration hash route', () => {
  assert.equal(getPageFromHashValue('#/deep-space', validPages), 'deep-space');
});
