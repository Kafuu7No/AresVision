import test from 'node:test';
import assert from 'node:assert/strict';

import {
  nextWorkflowSelection,
  selectionFromReactFlowSelection,
} from './workflowSelection.js';

test('reuses selection object when reported node and edges are unchanged', () => {
  const current = { nodeId: null, edgeIds: [] };

  const next = nextWorkflowSelection(current, { nodeId: null, edgeIds: [] });

  assert.equal(next, current);
});

test('reuses selection object when selected edge ids are unchanged', () => {
  const current = { nodeId: null, edgeIds: ['edge-a'] };

  const next = nextWorkflowSelection(current, { nodeId: null, edgeIds: ['edge-a'] });

  assert.equal(next, current);
});

test('creates a new selection object when selected edge ids change', () => {
  const current = { nodeId: null, edgeIds: ['edge-a'] };

  const next = nextWorkflowSelection(current, { nodeId: null, edgeIds: ['edge-b'] });

  assert.deepEqual(next, { nodeId: null, edgeIds: ['edge-b'] });
  assert.notEqual(next, current);
});

test('normalizes React Flow selection payload', () => {
  const selection = selectionFromReactFlowSelection({
    nodes: [{ id: 'model' }],
    edges: [{ id: 'input-model' }, { id: 'model-output' }],
  });

  assert.deepEqual(selection, {
    nodeId: 'model',
    edgeIds: ['input-model', 'model-output'],
  });
});
