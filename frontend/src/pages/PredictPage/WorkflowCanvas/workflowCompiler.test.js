import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compilePredictionWorkflow,
  compileTrainingDraft,
  validateWorkflowGraph,
} from './workflowCompiler.js';
import { WORKFLOW_NODE_TYPES } from './workflowSchema.js';

const node = (id, type, data = {}) => ({ id, type: 'workflowNode', data: { workflowType: type, ...data } });
const edge = (source, target) => ({ id: `${source}-${target}`, source, target });

function baseGraph() {
  const nodes = [
    node('source', WORKFLOW_NODE_TYPES.DATA_SOURCE, { dataSource: 'default' }),
    node('context', WORKFLOW_NODE_TYPES.MARS_CONTEXT, { marsYear: 28, lsStart: 123 }),
    node('u', WORKFLOW_NODE_TYPES.INPUT_CHANNEL, { variableId: 'U_Wind' }),
    node('v', WORKFLOW_NODE_TYPES.INPUT_CHANNEL, { variableId: 'V_Wind' }),
    node('d', WORKFLOW_NODE_TYPES.INPUT_CHANNEL, { variableId: 'Dust_Optical_Depth' }),
    node('s', WORKFLOW_NODE_TYPES.INPUT_CHANNEL, { variableId: 'Solar_Flux_DN' }),
    node('t', WORKFLOW_NODE_TYPES.INPUT_CHANNEL, { variableId: 'Temperature' }),
    node('model', WORKFLOW_NODE_TYPES.PREDRNN_MODEL, { horizon: 3 }),
    node('metrics', WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT, { outputId: 'metrics' }),
    node('triptych', WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT, { outputId: 'triptych' }),
    node('training', WORKFLOW_NODE_TYPES.TRAINING_CONFIG, {
      epochs: 12,
      batch_size: 16,
      learning_rate: 0.002,
      stlstm_hidden_dims: [32, 64, 64],
      window: 4,
      horizon: 2,
      early_stopping_patience: 5,
      seed: 27,
    }),
  ];

  const edges = [
    edge('source', 'model'),
    edge('context', 'model'),
    edge('u', 'model'),
    edge('v', 'model'),
    edge('d', 'model'),
    edge('s', 'model'),
    edge('t', 'model'),
    edge('model', 'metrics'),
    edge('model', 'triptych'),
    edge('source', 'training'),
    edge('u', 'training'),
    edge('v', 'training'),
    edge('d', 'training'),
    edge('s', 'training'),
    edge('t', 'training'),
  ];

  return { nodes, edges };
}

test('compiles prediction workflow into current API request shape', () => {
  const { nodes, edges } = baseGraph();

  const compiled = compilePredictionWorkflow(nodes, edges, {
    dataSource: 'default',
    marsYear: 28,
    lsStart: 123,
  });

  assert.deepEqual(compiled, {
    dataSource: 'default',
    marsYear: 28,
    lsStart: 123,
    horizon: 3,
    selectedVariables: [
      'U_Wind',
      'V_Wind',
      'Dust_Optical_Depth',
      'Solar_Flux_DN',
      'Temperature',
    ],
    enabledOutputs: ['metrics', 'triptych'],
    body: {
      selected_variables: [
        'U_Wind',
        'V_Wind',
        'Dust_Optical_Depth',
        'Solar_Flux_DN',
        'Temperature',
      ],
      horizon: 3,
      ls_start: 123,
      mars_year: 28,
    },
  });
});

test('compiles full channel training draft to unified demo3.py with selected channels', () => {
  const { nodes, edges } = baseGraph();

  const draft = compileTrainingDraft(nodes, edges, {
    dataSource: 'default',
    training: {
      epochs: 12,
      batch_size: 16,
      learning_rate: 0.002,
      stlstm_hidden_dims: [32, 64, 64],
      window: 4,
      horizon: 2,
      early_stopping_patience: 5,
      seed: 27,
    },
  }, ['demo3.py']);

  assert.equal(draft.selectedScript, 'demo3.py');
  assert.deepEqual(draft.selectedChannels, ['U', 'V', 'D', 'S', 'T']);
  assert.equal(draft.dataSource, 'default');
  assert.deepEqual(draft.hyperparameters, {
    epochs: 12,
    batch_size: 16,
    learning_rate: 0.002,
    training_dataset: 'openmars_mcd',
    stlstm_hidden_dims: [32, 64, 64],
    window: 4,
    horizon: 2,
    early_stopping_patience: 5,
    seed: 27,
    selected_channels: ['U', 'V', 'D', 'S', 'T'],
    model_architecture: 'predrnnv2',
    use_sphere: false,
  });
});

test('compiles baseline training draft to unified demo3.py with empty channels', () => {
  const nodes = [];
  const edges = [];

  const draft = compileTrainingDraft(nodes, edges, {}, ['demo3.py']);

  assert.equal(draft.selectedScript, 'demo3.py');
  assert.deepEqual(draft.selectedChannels, []);
  assert.deepEqual(draft.hyperparameters.selected_channels, []);
  assert.equal(draft.hyperparameters.model_architecture, 'predrnnv2');
  assert.equal(draft.hyperparameters.use_sphere, false);
});

test('validation reports missing model for prediction', () => {
  const nodes = [];
  const edges = [];

  const result = validateWorkflowGraph(nodes, edges, 'prediction');

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors.map((item) => item.code), ['missing_model']);
});

test('training draft rejects unavailable generated script', () => {
  const { nodes, edges } = baseGraph();

  assert.throws(
    () => compileTrainingDraft(nodes, edges, {}, []),
    /not available/,
  );
});

test('compiles prediction workflow from external workflow configuration without config nodes', () => {
  const nodes = [
    node('u', WORKFLOW_NODE_TYPES.INPUT_CHANNEL, { variableId: 'U_Wind' }),
    node('model', WORKFLOW_NODE_TYPES.PREDRNN_MODEL, { horizon: 2 }),
    node('triptych', WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT, { outputId: 'triptych' }),
  ];
  const edges = [
    edge('u', 'model'),
    edge('model', 'triptych'),
  ];

  const compiled = compilePredictionWorkflow(nodes, edges, {
    dataSource: 'personal',
    marsYear: 29,
    lsStart: 177.25,
  });

  assert.equal(compiled.dataSource, 'personal');
  assert.equal(compiled.marsYear, 29);
  assert.equal(compiled.lsStart, 177.25);
  assert.deepEqual(compiled.body, {
    selected_variables: ['U_Wind'],
    horizon: 2,
    ls_start: 177.25,
    mars_year: 29,
  });
});

test('compiles training draft from external training configuration without a training node', () => {
  const nodes = [
    node('u', WORKFLOW_NODE_TYPES.INPUT_CHANNEL, { variableId: 'U_Wind' }),
    node('v', WORKFLOW_NODE_TYPES.INPUT_CHANNEL, { variableId: 'V_Wind' }),
    node('model', WORKFLOW_NODE_TYPES.PREDRNN_MODEL, { horizon: 2 }),
  ];
  const edges = [
    edge('u', 'model'),
    edge('v', 'model'),
  ];

  const draft = compileTrainingDraft(nodes, edges, {
    dataSource: 'personal',
    training: {
      epochs: 9,
      batch_size: 4,
      learning_rate: 0.003,
      spatial_hidden_dim: -8,
      temporal_hidden_dim: '',
      temporal_depth: 3,
      dropout: 1.4,
      window: 6,
      horizon: 1,
      early_stopping_patience: 2,
      seed: -8,
      model_architecture: 'simvp',
      use_sphere: true,
    },
  }, ['demo3.py']);

  assert.equal(draft.dataSource, 'personal');
  assert.deepEqual(draft.selectedChannels, ['U', 'V']);
  assert.deepEqual(draft.hyperparameters, {
    epochs: 9,
    batch_size: 4,
    learning_rate: 0.003,
    training_dataset: 'openmars_mcd',
    window: 6,
    horizon: 1,
    early_stopping_patience: 2,
    seed: 0,
    selected_channels: ['U', 'V'],
    model_architecture: 'simvp',
    use_sphere: true,
    spatial_hidden_dim: 1,
    temporal_hidden_dim: 128,
    temporal_depth: 3,
    dropout: 0.9,
  });
});

test('compiles patchtst training draft with patchtst structure parameters only', () => {
  const nodes = [
    node('d', WORKFLOW_NODE_TYPES.INPUT_CHANNEL, { variableId: 'Dust_Optical_Depth' }),
    node('model', WORKFLOW_NODE_TYPES.PREDRNN_MODEL, { horizon: 2 }),
  ];
  const edges = [
    edge('d', 'model'),
  ];

  const draft = compileTrainingDraft(nodes, edges, {
    training: {
      model_architecture: 'patchtst',
      stlstm_hidden_dims: [32, 64],
      patch_len: 0,
      stride: 2,
      d_model: 96,
      n_heads: 4,
      e_layers: 2,
      d_ff: 192,
      dropout: -0.5,
    },
  }, ['demo3.py']);

  assert.equal('stlstm_hidden_dims' in draft.hyperparameters, false);
  assert.deepEqual(draft.hyperparameters, {
    epochs: 10,
    batch_size: 32,
    learning_rate: 0.001,
    training_dataset: 'openmars_mcd',
    window: 3,
    horizon: 3,
    early_stopping_patience: 0,
    seed: 11,
    selected_channels: ['D'],
    model_architecture: 'patchtst',
    use_sphere: false,
    patch_len: 1,
    stride: 2,
    d_model: 96,
    n_heads: 4,
    e_layers: 2,
    d_ff: 192,
    dropout: 0,
  });
});
