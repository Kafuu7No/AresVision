import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createWorkflowText,
  getOutputLabel,
  getTemplateGroupLabel,
} from './workflowText.js';
import { WORKFLOW_OUTPUTS } from './workflowSchema.js';

test('creates Chinese workflow canvas labels from the existing language setting', () => {
  const text = createWorkflowText('zh');

  assert.equal(text.canvas.title, '神经网络工作流画布');
  assert.equal(text.palette.title, '工作流节点');
  assert.equal(text.actions.run, '运行预测');
  assert.equal(text.status.running, '运行中');
  assert.equal(text.source.default, '默认数据源');
  assert.equal(getTemplateGroupLabel('Input Channels', text), '输入通道');
  assert.equal(getOutputLabel(WORKFLOW_OUTPUTS.ERROR_DISTRIBUTION, text), '误差分布');
});

test('keeps English workflow canvas labels when language is English', () => {
  const text = createWorkflowText('en');

  assert.equal(text.canvas.title, 'Neural Workflow Canvas');
  assert.equal(text.palette.title, 'Workflow Nodes');
  assert.equal(text.actions.sendToTraining, 'Send To Training');
  assert.equal(text.source.personal, 'Personal Source');
  assert.equal(getTemplateGroupLabel('Outputs', text), 'Outputs');
  assert.equal(getOutputLabel(WORKFLOW_OUTPUTS.PFI, text), 'PFI');
});
