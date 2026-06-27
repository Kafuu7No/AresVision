export const TRAINING_TASK_HANDOFF_KEY = 'aresvision_predict_training_task';

const ARCHITECTURE_LABELS = {
  predrnnv2: 'PredRNNv2',
  predrnnpp: 'PredRNN++',
  convlstm: 'ConvLSTM',
  simvp: 'SimVP',
  dlinear: 'DLinear',
  informer: 'Informer',
  autoformer: 'Autoformer',
  patchtst: 'PatchTST',
  timemixer: 'TimeMixer',
  timexer: 'TimeXer',
  tsmixer: 'TSMixer',
  crossformer: 'Crossformer',
  earthformer: 'Earthformer',
  etsformer: 'ETSformer',
  fedformer: 'FEDformer',
  itransformer: 'iTransformer',
  mau: 'MAU',
  nbeats: 'N-BEATS',
  nhits: 'N-HiTS',
  pyraformer: 'Pyraformer',
  rnn_cnn_rnn: 'RNN-CNN-RNN',
  cnn_rnn_cnn_rnn_cnn: 'CNN-RNN-CNN-RNN-CNN',
  simvp_3dconv: 'SimVP-3DConv',
  simvp_hybrid3d: 'SimVP-Hybrid3D',
  convlstm_mst: 'ConvLSTM-MST',
  dlinear_mst: 'DLinear-MST',
  convlstm_phase_gated_mst: 'ConvLSTM-PhaseGated-MST',
  convlstm_mst_feature_refiner: 'ConvLSTM-MST-Feature',
  convlstm_climatology_anomaly: 'ConvLSTM-Climatology-Anomaly',
};

const CHANNEL_LABELS = {
  U: 'U',
  V: 'V',
  D: 'D',
  S: 'S',
  T: 'T',
};

function parseHyperparameters(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getArchitectureLabel(value) {
  const normalized = String(value || 'predrnnv2').trim().toLowerCase();
  return ARCHITECTURE_LABELS[normalized] || value || 'PredRNNv2';
}

function formatValue(value) {
  if (Array.isArray(value)) return value.join(' / ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (value === 0) return '0';
  return value == null || value === '' ? '--' : String(value);
}

function addItem(items, label, value) {
  const formatted = formatValue(value);
  if (formatted === '--') return;
  items.push({ label, value: formatted });
}

export function getCompletedTrainingModelOptions(tasks = []) {
  return (Array.isArray(tasks) ? tasks : [])
    .filter((task) => task?.status === 'completed' && Boolean(task?.output_model_path))
    .map((task) => ({
      id: Number(task.id),
      label: task.custom_model_name || `Task #${task.id}`,
      task,
    }));
}

export function buildTrainingTaskHandoff(task) {
  const taskId = Number(task?.id);
  if (!Number.isFinite(taskId) || taskId <= 0) return null;
  return {
    taskId,
    modelName: task?.custom_model_name || `Task #${taskId}`,
  };
}

export function parseTrainingTaskHandoff(raw) {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const taskId = Number(parsed?.taskId);
    if (!Number.isFinite(taskId) || taskId <= 0) return null;
    return {
      taskId,
      modelName: parsed?.modelName || `Task #${taskId}`,
    };
  } catch {
    return null;
  }
}

export function buildTrainedModelParameterItems(task, { isZh = true } = {}) {
  if (!task) return [];
  const hypers = parseHyperparameters(task.hyperparameters);
  const labels = isZh
    ? {
        modelName: '模型名称',
        taskId: '任务 ID',
        source: '数据来源',
        modelType: '模型类型',
        architecture: '模型架构',
        sphere: 'SPHERE',
        inputChannels: '输入通道',
        window: '输入窗口',
        horizon: '预测步长',
        epochs: '训练轮次',
        batch: '批大小',
        learningRate: '学习率',
        earlyStopping: '早停耐心',
        seed: '随机种子',
        official: '官方',
        uploaded: '上传',
        defaultData: '默认数据',
        personalData: '个人数据',
        on: '开启',
        off: '关闭',
      }
    : {
        modelName: 'Model name',
        taskId: 'Task ID',
        source: 'Source',
        modelType: 'Model type',
        architecture: 'Architecture',
        sphere: 'SPHERE',
        inputChannels: 'Input channels',
        window: 'Window',
        horizon: 'Horizon',
        epochs: 'Epochs',
        batch: 'Batch',
        learningRate: 'Learning rate',
        earlyStopping: 'Early stopping',
        seed: 'Seed',
        official: 'Official',
        uploaded: 'Uploaded',
        defaultData: 'Default data',
        personalData: 'Personal data',
        on: 'On',
        off: 'Off',
      };

  const modelSource = String(hypers.model_source || task.model_source || 'official').toLowerCase();
  const dataSource = String(hypers._effective_data_source || hypers._data_source || 'default').toLowerCase();
  const channels = Array.isArray(hypers.selected_channels)
    ? hypers.selected_channels.map((channel) => CHANNEL_LABELS[String(channel).toUpperCase()] || String(channel).toUpperCase())
    : [];
  const items = [];

  addItem(items, labels.modelName, task.custom_model_name || `Task #${task.id}`);
  addItem(items, labels.taskId, task.id ? `#${task.id}` : null);
  addItem(items, labels.source, dataSource === 'personal' ? labels.personalData : labels.defaultData);
  addItem(items, labels.modelType, modelSource === 'uploaded' ? labels.uploaded : labels.official);
  addItem(items, labels.architecture, getArchitectureLabel(hypers.model_architecture));
  addItem(items, labels.sphere, hypers.use_sphere ? labels.on : labels.off);
  addItem(items, labels.inputChannels, channels.length ? channels : (isZh ? '仅 O3' : 'O3 only'));
  addItem(items, labels.window, hypers.window);
  addItem(items, labels.horizon, hypers.horizon);
  addItem(items, labels.epochs, hypers.epochs);
  addItem(items, labels.batch, hypers.batch_size);
  addItem(items, labels.learningRate, hypers.learning_rate);
  addItem(items, labels.earlyStopping, hypers.early_stopping_patience);
  addItem(items, labels.seed, hypers.seed);

  return items;
}
