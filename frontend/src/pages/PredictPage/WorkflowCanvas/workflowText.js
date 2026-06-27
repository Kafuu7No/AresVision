import {
  WORKFLOW_NODE_TYPES,
  WORKFLOW_OUTPUTS,
} from './workflowSchema.js';

const EN_TEXT = {
  canvas: {
    title: 'Neural Workflow Canvas',
    subtitle: 'Build a controlled prediction flow and training draft.',
  },
  palette: {
    title: 'Workflow Nodes',
    subtitle: 'Drag modules onto the canvas, then connect them into a controlled prediction flow.',
  },
  groups: {
    Data: 'Data',
    'Input Channels': 'Input Channels',
    Model: 'Model',
    Outputs: 'Outputs',
  },
  templateSubtitles: {
    [WORKFLOW_NODE_TYPES.DATA_SOURCE]: 'Default / personal',
    [WORKFLOW_NODE_TYPES.MARS_CONTEXT]: 'MY + Ls',
    [WORKFLOW_NODE_TYPES.PREDRNN_MODEL]: 'Current inference model',
    [WORKFLOW_NODE_TYPES.TRAINING_CONFIG]: 'Draft hyperparameters',
    [WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT]: 'Result module',
  },
  nodeLabels: {
    [WORKFLOW_NODE_TYPES.DATA_SOURCE]: 'Data Source',
    [WORKFLOW_NODE_TYPES.MARS_CONTEXT]: 'Mars Context',
    [WORKFLOW_NODE_TYPES.PREDRNN_MODEL]: 'PredRNNv2',
    [WORKFLOW_NODE_TYPES.TRAINING_CONFIG]: 'Training Config',
  },
  nodeTypes: {
    [WORKFLOW_NODE_TYPES.DATA_SOURCE]: 'DATA',
    [WORKFLOW_NODE_TYPES.MARS_CONTEXT]: 'CTX',
    [WORKFLOW_NODE_TYPES.INPUT_CHANNEL]: 'CH',
    [WORKFLOW_NODE_TYPES.PREDRNN_MODEL]: 'MODEL',
    [WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT]: 'OUT',
    [WORKFLOW_NODE_TYPES.TRAINING_CONFIG]: 'TRAIN',
  },
  source: {
    default: 'Default Source',
    personal: 'Personal Source',
    defaultOption: 'Default source',
    personalOption: 'Personal source',
  },
  actions: {
    run: 'Run Prediction',
    running: 'Running...',
    sendToTraining: 'Send To Training',
    autoArrange: 'Auto Arrange',
    deleteSelection: 'Delete Selected',
    reset: 'Reset',
    openShap: 'Open SHAP Panel',
  },
  status: {
    running: 'Running',
    ready: 'Ready',
    failed: 'Failed',
    idle: 'Idle',
  },
  outputs: {
    [WORKFLOW_OUTPUTS.TRIPTYCH]: 'Triptych',
    [WORKFLOW_OUTPUTS.METRICS]: 'Metrics',
    [WORKFLOW_OUTPUTS.ERROR_DISTRIBUTION]: 'Error Distribution',
    [WORKFLOW_OUTPUTS.PFI]: 'PFI',
    [WORKFLOW_OUTPUTS.SHAP]: 'SHAP',
  },
  outputShort: {
    [WORKFLOW_OUTPUTS.TRIPTYCH]: 'Triptych',
    [WORKFLOW_OUTPUTS.METRICS]: 'Metrics',
    [WORKFLOW_OUTPUTS.ERROR_DISTRIBUTION]: 'Error Dist',
    [WORKFLOW_OUTPUTS.PFI]: 'PFI',
    [WORKFLOW_OUTPUTS.SHAP]: 'SHAP',
  },
  inspector: {
    summaryTitle: 'Workflow Summary',
    selectedSubtitle: 'Tune the selected module.',
    summarySubtitle: 'Compiled request and training draft preview.',
    baseline: 'Baseline',
    noValue: '--',
    fields: {
      dataSource: 'Data Source',
      marsYear: 'Mars Year',
      lsStart: 'Ls Start',
      predictionHorizon: 'Prediction Horizon',
      epochs: 'Epochs',
      batchSize: 'Batch Size',
      learningRate: 'Learning Rate',
      hiddenDims: 'Hidden Dims',
      modelArchitecture: 'Model Architecture',
      window: 'Window',
      horizon: 'Horizon',
      earlyStopping: 'Early Stopping',
      seed: 'Seed',
      sphere: 'SPHERE',
      output: 'Output',
      variable: 'Variable',
    },
    hints: {
      predictionHorizon: 'The current backend accepts 1-3 steps.',
      hiddenDims: 'Comma-separated dimensions, for example: 64, 64, 64',
    },
    summary: {
      dataSource: 'Data Source',
      marsContext: 'Mars Context',
      variables: 'Variables',
      predictionHorizon: 'Prediction Horizon',
      outputs: 'Outputs',
      trainingScript: 'Training Script',
      trainingChannels: 'Training Channels',
    },
  },
  results: {
    viewModes: {
      triptych: 'Triptych',
      original: 'Truth',
      prediction: 'Prediction',
      diff: 'Residual',
    },
    panels: {
      truth: 'Ground Truth',
      prediction: 'Prediction',
      residual: 'Residual',
    },
  },
  toasts: {
    invalidConnection: 'This connection is not allowed for the controlled workflow.',
    completed: 'Workflow prediction completed.',
  },
  errors: {
    invalid_edge: 'This connection is not allowed.',
    missing_model: 'Add a PredRNNv2 model node before running prediction.',
    missing_context: 'Add a Mars context node before running prediction.',
    invalid_horizon: 'Prediction horizon must be between 1 and 3.',
    missing_training_config: 'Add a training config node before sending to training.',
    invalidWorkflow: 'Invalid workflow graph',
    invalidTrainingWorkflow: 'Invalid training workflow graph',
    predictionFailed: 'Workflow prediction failed.',
    runFailed: 'Run failed',
    generatedScriptUnavailable: (script) => `Generated script ${script} is not available.`,
  },
};

const ZH_TEXT = {
  canvas: {
    title: '神经网络工作流画布',
    subtitle: '搭建受控预测流程，并同步生成训练草稿。',
  },
  palette: {
    title: '工作流节点',
    subtitle: '将模块拖到画布上，再连线组成受控预测流程。',
  },
  groups: {
    Data: '数据',
    'Input Channels': '输入通道',
    Model: '模型',
    Outputs: '输出',
  },
  templateSubtitles: {
    [WORKFLOW_NODE_TYPES.DATA_SOURCE]: '默认 / 个人数据',
    [WORKFLOW_NODE_TYPES.MARS_CONTEXT]: '火星年 + Ls',
    [WORKFLOW_NODE_TYPES.PREDRNN_MODEL]: '当前推理模型',
    [WORKFLOW_NODE_TYPES.TRAINING_CONFIG]: '训练超参数草稿',
    [WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT]: '结果模块',
  },
  nodeLabels: {
    [WORKFLOW_NODE_TYPES.DATA_SOURCE]: '数据源',
    [WORKFLOW_NODE_TYPES.MARS_CONTEXT]: '火星环境',
    [WORKFLOW_NODE_TYPES.PREDRNN_MODEL]: 'PredRNNv2',
    [WORKFLOW_NODE_TYPES.TRAINING_CONFIG]: '训练配置',
  },
  nodeTypes: {
    [WORKFLOW_NODE_TYPES.DATA_SOURCE]: '数据',
    [WORKFLOW_NODE_TYPES.MARS_CONTEXT]: '环境',
    [WORKFLOW_NODE_TYPES.INPUT_CHANNEL]: '通道',
    [WORKFLOW_NODE_TYPES.PREDRNN_MODEL]: '模型',
    [WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT]: '输出',
    [WORKFLOW_NODE_TYPES.TRAINING_CONFIG]: '训练',
  },
  source: {
    default: '默认数据源',
    personal: '个人数据源',
    defaultOption: '默认数据源',
    personalOption: '个人数据源',
  },
  actions: {
    run: '运行预测',
    running: '运行中...',
    sendToTraining: '发送到训练',
    autoArrange: '自动排列',
    deleteSelection: '删除选中',
    reset: '重置',
    openShap: '打开 SHAP 面板',
  },
  status: {
    running: '运行中',
    ready: '就绪',
    failed: '失败',
    idle: '空闲',
  },
  outputs: {
    [WORKFLOW_OUTPUTS.TRIPTYCH]: '三联图',
    [WORKFLOW_OUTPUTS.METRICS]: '指标',
    [WORKFLOW_OUTPUTS.ERROR_DISTRIBUTION]: '误差分布',
    [WORKFLOW_OUTPUTS.PFI]: 'PFI',
    [WORKFLOW_OUTPUTS.SHAP]: 'SHAP',
  },
  outputShort: {
    [WORKFLOW_OUTPUTS.TRIPTYCH]: '三联图',
    [WORKFLOW_OUTPUTS.METRICS]: '指标',
    [WORKFLOW_OUTPUTS.ERROR_DISTRIBUTION]: '误差分布',
    [WORKFLOW_OUTPUTS.PFI]: 'PFI',
    [WORKFLOW_OUTPUTS.SHAP]: 'SHAP',
  },
  inspector: {
    summaryTitle: '工作流摘要',
    selectedSubtitle: '调整当前选中的模块。',
    summarySubtitle: '预览编译后的预测请求和训练草稿。',
    baseline: '基线',
    noValue: '--',
    fields: {
      dataSource: '数据源',
      marsYear: '火星年',
      lsStart: '起始 Ls',
      predictionHorizon: '预测步长',
      epochs: '训练轮数',
      batchSize: '批大小',
      learningRate: '学习率',
      hiddenDims: '隐藏层维度',
      modelArchitecture: '模型结构',
      window: '输入窗口',
      horizon: '预测步长',
      earlyStopping: '早停轮数',
      seed: 'Seed',
      sphere: 'SPHERE',
      output: '输出',
      variable: '变量',
    },
    hints: {
      predictionHorizon: '当前后端支持 1-3 步预测。',
      hiddenDims: '用英文逗号分隔，例如：64, 64, 64',
    },
    summary: {
      dataSource: '数据源',
      marsContext: '火星环境',
      variables: '输入变量',
      predictionHorizon: '预测步长',
      outputs: '输出模块',
      trainingScript: '训练脚本',
      trainingChannels: '训练通道',
    },
  },
  results: {
    viewModes: {
      triptych: '三联图',
      original: '真实值',
      prediction: '预测值',
      diff: '残差',
    },
    panels: {
      truth: '真实场',
      prediction: '预测场',
      residual: '残差场',
    },
  },
  toasts: {
    invalidConnection: '该连线不符合受控工作流规则。',
    completed: '工作流预测完成。',
  },
  errors: {
    invalid_edge: '该连线不允许。',
    missing_model: '运行预测前请添加 PredRNNv2 模型节点。',
    missing_context: '运行预测前请添加火星环境节点。',
    invalid_horizon: '预测步长必须在 1 到 3 之间。',
    missing_training_config: '发送到训练前请添加训练配置节点。',
    invalidWorkflow: '工作流配置无效。',
    invalidTrainingWorkflow: '训练工作流配置无效。',
    predictionFailed: '工作流预测失败。',
    runFailed: '运行失败',
    generatedScriptUnavailable: (script) => `生成的脚本 ${script} 当前不可用。`,
  },
};

export function createWorkflowText(language = 'zh') {
  return language === 'en' ? EN_TEXT : ZH_TEXT;
}

export function getOutputLabel(outputId, text, { short = false } = {}) {
  const labels = short ? text.outputShort : text.outputs;
  return labels[outputId] || outputId;
}

export function getTemplateGroupLabel(group, text) {
  return text.groups[group] || group;
}

export function getTemplateLabel(item, text) {
  if (item.workflowType === WORKFLOW_NODE_TYPES.INPUT_CHANNEL) return item.label;
  if (item.workflowType === WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT) {
    return getOutputLabel(item.data?.outputId, text);
  }
  return text.nodeLabels[item.workflowType] || item.label;
}

export function getWorkflowNodeLabel(data = {}, text) {
  if (data.workflowType === WORKFLOW_NODE_TYPES.INPUT_CHANNEL) return data.channelShort || data.label;
  if (data.workflowType === WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT) {
    return getOutputLabel(data.outputId, text);
  }
  return text.nodeLabels[data.workflowType] || data.label;
}

export function getWorkflowStatusLabel(status, text) {
  return text.status[status] || text.status.idle;
}

export function getWorkflowErrorMessage(errorOrCode, text) {
  if (!errorOrCode) return '';
  if (typeof errorOrCode === 'string') {
    return text.errors[errorOrCode] || errorOrCode;
  }

  const firstValidationError = errorOrCode.validation?.errors?.[0] || errorOrCode;
  if (firstValidationError?.code && text.errors[firstValidationError.code]) {
    return text.errors[firstValidationError.code];
  }

  const rawMessage = errorOrCode.message || firstValidationError?.message || '';
  const scriptMatch = rawMessage.match(/^Generated script (.+) is not available\.$/);
  if (scriptMatch) {
    return text.errors.generatedScriptUnavailable(scriptMatch[1]);
  }

  return rawMessage || text.errors.invalidWorkflow;
}
