import {
  CHANNEL_DEFS,
  DEFAULT_MODEL_CONFIG,
  WORKFLOW_NODE_TYPES,
  WORKFLOW_OUTPUTS,
} from './workflowSchema.js';

function makeNode(id, workflowType, label, position, data = {}) {
  return {
    id,
    type: 'workflowNode',
    position,
    data: {
      workflowType,
      label,
      status: 'idle',
      ...data,
    },
  };
}

function makeEdge(source, target, extra = {}) {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: 'bezier',
    animated: false,
    style: { stroke: 'rgba(194, 215, 222, 0.56)', strokeWidth: 1.6 },
    ...extra,
  };
}

export function createInitialWorkflow() {
  const channelNodes = CHANNEL_DEFS.map((channel, index) => makeNode(
    `channel-${channel.short}`,
    WORKFLOW_NODE_TYPES.INPUT_CHANNEL,
    channel.short,
    { x: 80, y: 220 + index * 86 },
    {
      variableId: channel.variableId,
      channelShort: channel.short,
      color: channel.color,
    },
  ));

  const nodes = [
    ...channelNodes,
    makeNode(
      'predrnn-model',
      WORKFLOW_NODE_TYPES.PREDRNN_MODEL,
      'PredRNNv2',
      { x: 420, y: 255 },
      DEFAULT_MODEL_CONFIG,
    ),
    makeNode(
      'output-triptych',
      WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT,
      'Triptych',
      { x: 760, y: 220 },
      { outputId: WORKFLOW_OUTPUTS.TRIPTYCH },
    ),
    makeNode(
      'output-metrics',
      WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT,
      'Metrics',
      { x: 760, y: 330 },
      { outputId: WORKFLOW_OUTPUTS.METRICS },
    ),
    makeNode(
      'output-pfi',
      WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT,
      'PFI',
      { x: 760, y: 440 },
      { outputId: WORKFLOW_OUTPUTS.PFI },
    ),
  ];

  const edges = [
    ...CHANNEL_DEFS.map((channel) => makeEdge(`channel-${channel.short}`, 'predrnn-model')),
    makeEdge('predrnn-model', 'output-triptych'),
    makeEdge('predrnn-model', 'output-metrics'),
    makeEdge('predrnn-model', 'output-pfi'),
  ];

  return { nodes, edges };
}

export function autoArrangeWorkflow(nodes) {
  const buckets = {
    [WORKFLOW_NODE_TYPES.INPUT_CHANNEL]: { x: 92, y: 120 },
    [WORKFLOW_NODE_TYPES.PREDRNN_MODEL]: { x: 430, y: 260 },
    [WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT]: { x: 780, y: 220 },
  };
  const counters = {};

  return nodes.map((node) => {
    const workflowType = node.data?.workflowType;
    const bucket = buckets[workflowType] || { x: node.position?.x || 0, y: node.position?.y || 0 };
    const index = counters[workflowType] || 0;
    counters[workflowType] = index + 1;

    const verticalStep = workflowType === WORKFLOW_NODE_TYPES.INPUT_CHANNEL ? 86 : 110;
    const offset = index * verticalStep;

    return {
      ...node,
      position: {
        x: bucket.x,
        y: bucket.y + offset,
      },
    };
  });
}

export const PALETTE_NODE_TEMPLATES = [
  {
    group: 'Input Channels',
    items: CHANNEL_DEFS.map((channel) => ({
      workflowType: WORKFLOW_NODE_TYPES.INPUT_CHANNEL,
      label: channel.short,
      data: {
        variableId: channel.variableId,
        channelShort: channel.short,
        color: channel.color,
      },
    })),
  },
  {
    group: 'Model',
    items: [
      { workflowType: WORKFLOW_NODE_TYPES.PREDRNN_MODEL, label: 'PredRNNv2', data: DEFAULT_MODEL_CONFIG },
    ],
  },
  {
    group: 'Outputs',
    items: [
      { workflowType: WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT, label: 'Triptych', data: { outputId: WORKFLOW_OUTPUTS.TRIPTYCH } },
      { workflowType: WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT, label: 'Metrics', data: { outputId: WORKFLOW_OUTPUTS.METRICS } },
      { workflowType: WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT, label: 'Error Distribution', data: { outputId: WORKFLOW_OUTPUTS.ERROR_DISTRIBUTION } },
      { workflowType: WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT, label: 'PFI', data: { outputId: WORKFLOW_OUTPUTS.PFI } },
      { workflowType: WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT, label: 'SHAP', data: { outputId: WORKFLOW_OUTPUTS.SHAP } },
    ],
  },
];
