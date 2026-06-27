import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTrainedModelParameterItems,
  buildTrainingTaskHandoff,
  getCompletedTrainingModelOptions,
  parseTrainingTaskHandoff,
} from './trainedModelSelection.js';

test('keeps only completed training tasks with output weights as prediction model options', () => {
  const tasks = [
    { id: 1, status: 'completed', output_model_path: 'D:/models/a.pth', custom_model_name: 'Dust run' },
    { id: 2, status: 'running', output_model_path: 'D:/models/b.pth', custom_model_name: 'Running run' },
    { id: 3, status: 'completed', output_model_path: '', custom_model_name: 'No weights' },
    { id: 4, status: 'completed', output_model_path: 'D:/models/c.pth', custom_model_name: '' },
  ];

  assert.deepEqual(getCompletedTrainingModelOptions(tasks), [
    { id: 1, label: 'Dust run', task: tasks[0] },
    { id: 4, label: 'Task #4', task: tasks[3] },
  ]);
});

test('builds and parses training task handoff payloads', () => {
  const payload = buildTrainingTaskHandoff({
    id: 7,
    custom_model_name: 'MY27 UVDST',
  });

  assert.deepEqual(parseTrainingTaskHandoff(JSON.stringify(payload)), {
    taskId: 7,
    modelName: 'MY27 UVDST',
  });
});

test('ignores invalid training task handoff payloads', () => {
  assert.equal(parseTrainingTaskHandoff(''), null);
  assert.equal(parseTrainingTaskHandoff('not json'), null);
  assert.equal(parseTrainingTaskHandoff(JSON.stringify({ taskId: 'abc' })), null);
});

test('builds display parameters from selected trained model task hyperparameters', () => {
  const items = buildTrainedModelParameterItems({
    id: 8,
    custom_model_name: 'MY27 UVDST',
    hyperparameters: JSON.stringify({
      model_source: 'official',
      model_architecture: 'convlstm',
      selected_channels: ['U', 'V', 'D'],
      use_sphere: true,
      window: 4,
      horizon: 3,
      epochs: 20,
      batch_size: 16,
      learning_rate: 0.0005,
      early_stopping_patience: 5,
      seed: 11,
      _data_source: 'personal',
    }),
  }, { isZh: false });

  assert.deepEqual(items.map((item) => [item.label, item.value]), [
    ['Model name', 'MY27 UVDST'],
    ['Task ID', '#8'],
    ['Source', 'Personal data'],
    ['Model type', 'Official'],
    ['Architecture', 'ConvLSTM'],
    ['SPHERE', 'On'],
    ['Input channels', 'U / V / D'],
    ['Window', '4'],
    ['Horizon', '3'],
    ['Epochs', '20'],
    ['Batch', '16'],
    ['Learning rate', '0.0005'],
    ['Early stopping', '5'],
    ['Seed', '11'],
  ]);
});
