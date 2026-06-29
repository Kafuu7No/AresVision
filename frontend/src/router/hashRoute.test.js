import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getPageFromHashValue } from './hashRoute.js';

const validPages = ['home', 'overview', 'explore', 'predict', 'training', 'ai', 'about'];

test('parses hash routes with query parameters', () => {
  assert.equal(getPageFromHashValue('#/training?from=workflow', validPages), 'training');
});

test('falls back to home for unknown hash routes', () => {
  assert.equal(getPageFromHashValue('#/unknown?from=workflow', validPages), 'home');
});

test('falls back to home for removed deep space exploration hash route', () => {
  assert.equal(getPageFromHashValue('#/deep-space', validPages), 'home');
});

test('does not register deep space exploration in app routes or navigation', () => {
  const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  const navSource = readFileSync(new URL('../components/Navbar.jsx', import.meta.url), 'utf8');

  assert.equal(appSource.includes('deep-space'), false);
  assert.equal(appSource.includes('DeepSpacePage'), false);
  assert.equal(navSource.includes('deep-space'), false);
});
