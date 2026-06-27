import test from 'node:test';
import assert from 'node:assert/strict';

import { deleteWorkflowSelection } from './workflowDelete.js';

const nodes = [
  { id: 'source' },
  { id: 'model' },
  { id: 'metrics' },
];

const edges = [
  { id: 'source-model', source: 'source', target: 'model' },
  { id: 'model-metrics', source: 'model', target: 'metrics' },
];

test('deletes selected node and its connected edges', () => {
  const result = deleteWorkflowSelection(nodes, edges, { nodeIds: ['model'] });

  assert.deepEqual(result.nodes.map((node) => node.id), ['source', 'metrics']);
  assert.deepEqual(result.edges, []);
});

test('deletes selected edge without deleting nodes', () => {
  const result = deleteWorkflowSelection(nodes, edges, { edgeIds: ['source-model'] });

  assert.deepEqual(result.nodes.map((node) => node.id), ['source', 'model', 'metrics']);
  assert.deepEqual(result.edges.map((edge) => edge.id), ['model-metrics']);
});
