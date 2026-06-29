import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getModelTrainingControlVisibility,
  getVisibleTrainingHyperparameters,
} from './modelTrainingVisibility.js';

test('shows official model controls only for official model source', () => {
  assert.deepEqual(getModelTrainingControlVisibility('official'), {
    officialModelControls: true,
  });

  assert.deepEqual(getModelTrainingControlVisibility('uploaded'), {
    officialModelControls: false,
  });
});

test('falls back to official controls for unknown model source values', () => {
  assert.deepEqual(getModelTrainingControlVisibility(''), {
    officialModelControls: true,
  });
});

test('hides official architecture hyperparameters for uploaded model tasks', () => {
  assert.deepEqual(
    getVisibleTrainingHyperparameters({
      model_source: 'uploaded',
      epochs: 5,
      model_architecture: 'predrnnv2',
      use_sphere: false,
      stlstm_hidden_dims: [64, 64, 64],
      custom_model_params: { hidden_dim: 16 },
      _uploaded_model_path: 'D:/tmp/model.py',
    }),
    [
      ['epochs', 5],
      ['custom_model_params', { hidden_dim: 16 }],
    ]
  );
});

test('keeps official architecture hyperparameters for official model tasks', () => {
  assert.deepEqual(
    getVisibleTrainingHyperparameters({
      model_source: 'official',
      epochs: 5,
      model_architecture: 'simvp',
      use_sphere: true,
    }),
    [
      ['model_source', 'official'],
      ['epochs', 5],
      ['model_architecture', 'simvp'],
      ['use_sphere', true],
    ]
  );
});

test('keeps transfer metadata visible for task history cards', () => {
  assert.deepEqual(
    getVisibleTrainingHyperparameters({
      model_source: 'official',
      epochs: 5,
      transfer_learning: true,
      transfer_source_type: 'task',
      transfer_source_task_id: 12,
      transfer_load_mode: 'strict',
      freeze_mode: 'none',
      finetune_learning_rate: 0.0001,
      _transfer_weight_path: 'D:/secret/source.pth',
    }),
    [
      ['model_source', 'official'],
      ['epochs', 5],
      ['transfer_learning', true],
      ['transfer_source_type', 'task'],
      ['transfer_source_task_id', 12],
      ['transfer_load_mode', 'strict'],
      ['freeze_mode', 'none'],
      ['finetune_learning_rate', 0.0001],
    ]
  );
});
