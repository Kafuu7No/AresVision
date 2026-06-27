import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildCustomModelParams,
  createDefaultCustomModelParams,
  validateCustomModelParams,
} from './uploadedModelParams.js';

const schema = {
  hidden_dim: { type: 'int', default: 8, min: 4, max: 32 },
  dropout: { type: 'float', default: 0.1, min: 0, max: 0.9 },
  use_bias: { type: 'bool', default: true },
  activation: { type: 'select', default: 'relu', options: ['relu', 'gelu'] },
};

test('creates default uploaded model params from schema defaults', () => {
  assert.deepEqual(createDefaultCustomModelParams(schema), {
    hidden_dim: 8,
    dropout: 0.1,
    use_bias: true,
    activation: 'relu',
  });
});

test('builds uploaded model params by clamping and sanitizing values', () => {
  assert.deepEqual(
    buildCustomModelParams(schema, {
      hidden_dim: 100,
      dropout: -2,
      use_bias: false,
      activation: 'bad',
    }),
    {
      hidden_dim: 32,
      dropout: 0,
      use_bias: false,
      activation: 'relu',
    }
  );
});

test('builds uploaded model bool params from schema defaults when omitted or null', () => {
  assert.equal(buildCustomModelParams(schema, {}).use_bias, true);
  assert.equal(buildCustomModelParams(schema, { use_bias: null }).use_bias, true);
});

test('treats null uploaded model parameter schema as valid', () => {
  assert.deepEqual(validateCustomModelParams(null, {}), { ok: true, errors: {} });
});

test('reports uploaded model parameter range validation errors', () => {
  assert.deepEqual(validateCustomModelParams(schema, { hidden_dim: 33 }).errors, {
    hidden_dim: 'Value must be between 4 and 32',
  });
});
