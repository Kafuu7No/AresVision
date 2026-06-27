import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDefaultWorkflowConfig,
  migrateWorkflowConfigFromGraph,
} from './workflowConfig.js';
import { PALETTE_NODE_TEMPLATES, createInitialWorkflow } from './workflowLayout.js';
import { WORKFLOW_NODE_TYPES } from './workflowSchema.js';

const node = (id, type, data = {}) => ({ id, type: 'workflowNode', data: { workflowType: type, ...data } });
const edge = (source, target) => ({ id: `${source}-${target}`, source, target });

test('default workflow training config includes model structure controls', () => {
  const config = getDefaultWorkflowConfig();

  assert.equal(config.training.seed, 11);
  assert.equal(config.training.model_architecture, 'predrnnv2');
  assert.equal(config.training.use_sphere, false);
});

test('initial workflow keeps data source, Mars context, and training config outside the canvas graph', () => {
  const workflow = createInitialWorkflow();
  const graphTypes = new Set(workflow.nodes.map((item) => item.data.workflowType));
  const paletteTypes = new Set(PALETTE_NODE_TEMPLATES.flatMap((group) => group.items.map((item) => item.workflowType)));

  assert.equal(graphTypes.has(WORKFLOW_NODE_TYPES.DATA_SOURCE), false);
  assert.equal(graphTypes.has(WORKFLOW_NODE_TYPES.MARS_CONTEXT), false);
  assert.equal(graphTypes.has(WORKFLOW_NODE_TYPES.TRAINING_CONFIG), false);
  assert.equal(paletteTypes.has(WORKFLOW_NODE_TYPES.DATA_SOURCE), false);
  assert.equal(paletteTypes.has(WORKFLOW_NODE_TYPES.MARS_CONTEXT), false);
  assert.equal(paletteTypes.has(WORKFLOW_NODE_TYPES.TRAINING_CONFIG), false);
});

test('migrates legacy config nodes into external workflow config and removes their edges', () => {
  const legacyGraph = {
    nodes: [
      node('source', WORKFLOW_NODE_TYPES.DATA_SOURCE, { dataSource: 'personal' }),
      node('context', WORKFLOW_NODE_TYPES.MARS_CONTEXT, { marsYear: 28, lsStart: 127.5 }),
      node('u', WORKFLOW_NODE_TYPES.INPUT_CHANNEL, { variableId: 'U_Wind' }),
      node('model', WORKFLOW_NODE_TYPES.PREDRNN_MODEL, { horizon: 2 }),
      node('training', WORKFLOW_NODE_TYPES.TRAINING_CONFIG, {
        epochs: 14,
        batch_size: 8,
        learning_rate: 0.002,
        stlstm_hidden_dims: [32, 64],
        window: 5,
        horizon: 2,
        early_stopping_patience: 3,
        seed: 21,
        model_architecture: 'simvp',
        use_sphere: true,
      }),
    ],
    edges: [
      edge('source', 'model'),
      edge('context', 'model'),
      edge('u', 'model'),
      edge('source', 'training'),
      edge('u', 'training'),
    ],
  };

  const migrated = migrateWorkflowConfigFromGraph(legacyGraph, getDefaultWorkflowConfig());

  assert.deepEqual({
    ...migrated.config,
    training: {
      ...migrated.config.training,
      architecture_params_by_model: undefined,
    },
  }, {
    dataSource: 'personal',
    marsYear: 28,
    lsStart: 127.5,
    training: {
      epochs: 14,
      batch_size: 8,
      learning_rate: 0.002,
      stlstm_hidden_dims: [32, 64],
      window: 5,
      horizon: 2,
      early_stopping_patience: 3,
      seed: 21,
      model_architecture: 'simvp',
      use_sphere: true,
      architecture_params_by_model: undefined,
    },
  });
  assert.equal(migrated.config.training.architecture_params_by_model.simvp.temporal_hidden_dim, 128);
  assert.equal(migrated.config.training.architecture_params_by_model.patchtst.patch_len, 2);
  assert.deepEqual(migrated.graph.nodes.map((item) => item.id), ['u', 'model']);
  assert.deepEqual(migrated.graph.edges.map((item) => item.id), ['u-model']);
});
