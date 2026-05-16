import React, { useEffect, useMemo, useRef, useState } from 'react';
import C from '../constants/colors';
import { useT } from '../i18n';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  fetchScripts,
  startTrainingTask,
  stopTrainingTask,
  deleteTrainingTask,
  fetchDataInfo,
} from '../services/api';
import {
  getPersonalSourceAvailability,
  getPersonalSourceBlockedMessage,
  getPersonalSourceCheckFailedMessage,
} from '../utils/personalSourceGuard';
import ConfirmDialog from '../components/ConfirmDialog';
import ModelTestModal from '../components/ModelTestModal';
import TrainingProgressMonitor from '../components/TrainingProgressMonitor';
import LossEvolutionChart from '../components/LossEvolutionChart';
import SectionTitle from '../components/SectionTitle';
import { useTraining } from '../contexts/TrainingContext';

const MONO_FONT = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

function getStatusMeta(status, t) {
  if (status === 'completed') {
    return {
      label: t('modelTraining.statusCompleted'),
      color: C.green,
      tint: 'rgba(74, 207, 172, 0.12)',
      border: 'rgba(74, 207, 172, 0.22)',
    };
  }
  if (status === 'failed') {
    return {
      label: t('modelTraining.statusFailed'),
      color: '#d95c5c',
      tint: 'rgba(217, 92, 92, 0.12)',
      border: 'rgba(217, 92, 92, 0.22)',
    };
  }
  if (status === 'running') {
    return {
      label: t('modelTraining.statusRunning'),
      color: C.mars,
      tint: 'rgba(199, 91, 57, 0.12)',
      border: 'rgba(199, 91, 57, 0.20)',
    };
  }
  if (status === 'pending') {
    return {
      label: t('modelTraining.statusPending'),
      color: '#c89448',
      tint: 'rgba(200, 148, 72, 0.12)',
      border: 'rgba(200, 148, 72, 0.22)',
    };
  }
  return {
    label: t('modelTraining.idle'),
    color: C.ice60,
    tint: 'rgba(255, 255, 255, 0.04)',
    border: 'rgba(255, 255, 255, 0.08)',
  };
}

function formatHyperValue(key, value, t) {
  if (Array.isArray(value)) return value.join(' / ');
  if (key === 'learning_rate' && typeof value === 'number') return value.toFixed(5);
  if (value === 0) return t('modelTraining.hypers.disabled');
  return value ?? '--';
}

function parseHyperparameters(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function getVisibleHyperparameters(hyperparameters) {
  return Object.entries(hyperparameters || {}).filter(([key]) => !key.startsWith('_'));
}

function getSourceModeLabel(source, copy) {
  if (!source) return '--';
  return source === 'personal' ? copy.sourcePersonal : copy.sourceDefault;
}

function formatTaskDate(value, locale) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getScriptSummary(modelScript, channelMap, fallbackLabel) {
  const suffix = (modelScript || '').replace('demo3-', '').replace('.py', '');
  if (!suffix) return fallbackLabel;
  return suffix.split('').map((char) => channelMap[char]?.name || char).join(', ');
}

function SummaryMetric({ label, value, accent = C.ice }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 14,
        background: C.bgMuted,
        border: `1px solid ${C.border}`,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 'calc(11px * var(--font-scale, 1))',
          color: C.ice50,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 'calc(14px * var(--font-scale, 1))',
          fontWeight: 700,
          color: accent,
          minHeight: 20,
          lineHeight: 1.45,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function CompactField({ label, value, accent = C.ice }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 'calc(11px * var(--font-scale, 1))',
          color: C.ice50,
          lineHeight: 1.4,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 'calc(12px * var(--font-scale, 1))',
          fontWeight: 700,
          color: accent,
          lineHeight: 1.45,
          minWidth: 0,
          textAlign: 'right',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function TrainingTaskCard({
  task,
  t,
  locale,
  channelMap,
  baselineLabel,
  copy,
  isLight,
  isActive,
  isProcessing,
  onSelect,
  onStop,
  onDelete,
  onTest,
}) {
  const statusMeta = getStatusMeta(task.status, t);
  const hyperparameters = useMemo(() => parseHyperparameters(task.hyperparameters), [task.hyperparameters]);
  const visibleHyperparameters = useMemo(
    () => getVisibleHyperparameters(hyperparameters),
    [hyperparameters]
  );

  const modelName = task.custom_model_name || t('modelTraining.unnamedModel');
  const scriptSummary = getScriptSummary(task.model_script, channelMap, baselineLabel);
  const taskSourceLabel = getSourceModeLabel(
    hyperparameters._effective_data_source || hyperparameters._data_source || 'default',
    copy
  );
  const actionBaseStyle = {
    padding: '8px 14px',
    borderRadius: 10,
    fontSize: 'calc(12px * var(--font-scale, 1))',
    fontWeight: 600,
    cursor: isProcessing ? 'not-allowed' : 'pointer',
    transition: 'background 0.18s ease, border-color 0.18s ease, color 0.18s ease',
    fontFamily: 'var(--font-body)',
  };

  return (
    <div
      onClick={() => onSelect(task.id)}
      style={{
        padding: '18px 20px',
        borderRadius: 18,
        border: `1px solid ${isActive ? C.borderStrong : C.border}`,
        background: isActive ? (isLight ? 'rgba(255,255,255,0.96)' : 'rgba(28,35,46,0.98)') : C.bgCard,
        boxShadow: isActive ? '0 0 0 1px rgba(74,158,255,0.12), var(--card-shadow)' : 'var(--card-shadow)',
        cursor: 'pointer',
        transition: 'border-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 420px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: 'calc(17px * var(--font-scale, 1))',
                fontWeight: 700,
                color: C.ice,
                fontFamily: 'var(--font-display)',
                minWidth: 0,
              }}
            >
              {modelName}
            </div>
            <span
              style={{
                padding: '4px 8px',
                borderRadius: 999,
                background: C.bgMuted,
                border: `1px solid ${C.border}`,
                color: C.ice50,
                fontSize: 'calc(11px * var(--font-scale, 1))',
                fontWeight: 600,
                fontFamily: MONO_FONT,
              }}
            >
              #{task.id}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              color: C.ice60,
              fontSize: 'calc(12px * var(--font-scale, 1))',
              lineHeight: 1.55,
            }}
          >
            <span>{scriptSummary}</span>
            <span>{taskSourceLabel}</span>
            <span>{formatTaskDate(task.start_time, locale)}</span>
          </div>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 12px',
            borderRadius: 999,
            background: statusMeta.tint,
            border: `1px solid ${statusMeta.border}`,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: statusMeta.color,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 'calc(12px * var(--font-scale, 1))',
              fontWeight: 700,
              color: statusMeta.color,
            }}
          >
            {statusMeta.label}
          </span>
        </div>
      </div>

      <div className="training-history-metrics">
        {visibleHyperparameters.map(([key, value]) => (
          <div
            key={key}
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: isLight ? 'rgba(15,23,42,0.03)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${C.border}`,
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: 'calc(10px * var(--font-scale, 1))',
                color: C.ice50,
                marginBottom: 5,
                lineHeight: 1.4,
              }}
            >
              {t(`modelTraining.hypers.${key}`)}
            </div>
            <div
              style={{
                fontSize: 'calc(13px * var(--font-scale, 1))',
                fontWeight: 700,
                color: C.ice,
                lineHeight: 1.45,
                wordBreak: 'break-word',
              }}
            >
              {formatHyperValue(key, value, t)}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          marginTop: 16,
          paddingTop: 16,
          borderTop: `1px solid ${C.border}`,
        }}
      >
        <button
          onClick={(event) => {
            event.stopPropagation();
            onSelect(task.id);
          }}
          style={{
            ...actionBaseStyle,
            background: isActive ? 'rgba(74,158,255,0.14)' : C.bgMuted,
            border: `1px solid ${isActive ? 'rgba(74,158,255,0.22)' : C.border}`,
            color: isActive ? C.blue : C.ice,
          }}
        >
          {copy.viewLogs}
        </button>

        {(task.status === 'running' || task.status === 'pending') && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onStop(task.id);
            }}
            disabled={isProcessing}
            style={{
              ...actionBaseStyle,
              background: 'rgba(217,92,92,0.08)',
              border: '1px solid rgba(217,92,92,0.18)',
              color: '#d95c5c',
              opacity: isProcessing ? 0.6 : 1,
            }}
          >
            {copy.stopTraining}
          </button>
        )}

        {task.status === 'completed' && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onTest(task.id);
            }}
            style={{
              ...actionBaseStyle,
              background: 'rgba(199,91,57,0.10)',
              border: '1px solid rgba(199,91,57,0.18)',
              color: C.mars,
            }}
          >
            {copy.testModel}
          </button>
        )}

        <button
          onClick={(event) => {
            event.stopPropagation();
            onDelete(task.id);
          }}
          disabled={isProcessing}
          style={{
            ...actionBaseStyle,
            background: 'transparent',
            border: `1px solid ${C.border}`,
            color: C.ice60,
            opacity: isProcessing ? 0.6 : 1,
          }}
        >
          {copy.deleteRecord}
        </button>
      </div>
    </div>
  );
}

export default function ModelTrainingPage() {
  const t = useT();
  const { settings } = useSettings();
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const isLight = settings.theme === 'light';
  const isZh = settings.language !== 'en';
  const locale = isZh ? 'zh-CN' : 'en-US';

  const {
    tasks,
    setTasks,
    activeTaskId,
    setActiveTaskId,
    progressData,
    logs,
    setLogs,
    loadTasks,
  } = useTraining();

  const [scripts, setScripts] = useState([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const [scriptsError, setScriptsError] = useState('');
  const [isSwitchingSource, setIsSwitchingSource] = useState(false);
  const [dataSourceMode, setDataSourceMode] = useState('default');
  const [sourceMeta, setSourceMeta] = useState(null);

  const logContainerRef = useRef(null);
  const autoScrollRef = useRef(true);

  const channelOrder = useMemo(() => ['U', 'V', 'D', 'S', 'T'], []);
  const channelMap = useMemo(
    () => ({
      U: { name: t('predict.variables.U_Wind'), short: 'U' },
      V: { name: t('predict.variables.V_Wind'), short: 'V' },
      D: { name: t('predict.variables.Dust_Optical_Depth'), short: 'D' },
      S: { name: t('predict.variables.Solar_Flux_DN'), short: 'S' },
      T: { name: t('predict.variables.Temperature'), short: 'T' },
    }),
    [t]
  );

  const copy = useMemo(
    () => ({
      dataSource: isZh ? '数据源' : 'Data source',
      sourceDefault: isZh ? '默认系统数据' : 'Default source',
      sourcePersonal: isZh ? '个人 / 混合数据' : 'Personal / mixed source',
      sourceHintDefault: isZh
        ? '训练将使用平台默认数据源。'
        : 'Training will run against the platform default data source.',
      sourceHintPersonal: isZh
        ? '训练将使用你的个人或混合数据源。'
        : 'Training will run against your personal or mixed data source.',
      trainingPreset: isZh ? '训练预设' : 'Training preset',
      trainingSummary: isZh ? '训练摘要' : 'Training summary',
      presetLoading: isZh ? '正在加载训练脚本...' : 'Loading training presets...',
      presetUnavailable: isZh
        ? '当前通道组合暂无可用训练脚本。'
        : 'No training preset is available for the current channel selection.',
      presetError: isZh
        ? '训练脚本加载失败，请稍后重试。'
        : 'Training presets failed to load. Please try again later.',
      presetMatched: isZh ? '已匹配可用脚本' : 'Matched to an available script',
      selectionUnavailable: isZh ? '当前组合不可训练' : 'This selection cannot be trained',
      currentSelection: isZh ? '当前选择' : 'Current selection',
      coreParameters: isZh ? '核心参数' : 'Core parameters',
      modelArchitecture: isZh ? '模型结构' : 'Model architecture',
      liveLogs: isZh ? '实时日志' : 'Live logs',
      liveLogsHint: isZh
        ? '选择历史任务即可切换当前查看的日志和进度。'
        : 'Select a training record to switch the active logs and progress view.',
      progressHint: isZh
        ? '进度、损失和日志会在这里持续刷新。'
        : 'Progress, loss, and logs refresh here while a task is active.',
      historyHint: isZh
        ? '训练记录会保留在这里，方便回看日志或继续测试。'
        : 'Training records stay here so you can revisit logs or run tests later.',
      channelSummaryEmpty: isZh ? '仅使用 O3 基线输入' : 'O3 baseline only',
      noTaskSelectedHint: isZh
        ? '还没有选中训练任务。你可以先启动新任务，或在下方历史记录中查看已有结果。'
        : 'No training task is selected yet. Start a new run or pick a record from the history below.',
      noLogsYet: isZh ? '等待训练日志输出...' : 'Waiting for training logs...',
      selectedTask: isZh ? '当前查看' : 'Selected task',
      currentModel: isZh ? '当前模型' : 'Current model',
      sourceMode: isZh ? '训练来源' : 'Source mode',
      scriptFile: isZh ? '脚本文件' : 'Script file',
      startTraining: isZh ? '开始训练' : 'Start training',
      loginToStart: isZh ? '登录后开始训练' : 'Sign in to start',
      starting: isZh ? '正在启动...' : 'Starting...',
      stopTraining: isZh ? '停止训练' : 'Stop training',
      testModel: isZh ? '模型测试' : 'Test model',
      deleteRecord: isZh ? '删除记录' : 'Delete record',
      viewLogs: isZh ? '查看日志' : 'View logs',
      modelNameAvailable: isZh ? '名称可用' : 'Name available',
      presetLoginHint: isZh ? '登录后会自动加载训练脚本。' : 'Training presets load automatically after sign-in.',
      historyCount: (count) => (isZh ? `${count} 条记录` : `${count} records`),
      noHistoryIcon: '[]',
      expand: isZh ? '\u5C55\u5F00' : 'Expand',
      collapse: isZh ? '\u6536\u8D77' : 'Collapse',
      activeModelFallback: '--',
    }),
    [isZh]
  );

  const [selectedChannels, setSelectedChannels] = useState([]);
  const [selectedScript, setSelectedScript] = useState('demo3-.py');
  const [epochs, setEpochs] = useState(10);
  const [batchSize, setBatchSize] = useState(32);
  const [learningRate, setLearningRate] = useState(0.001);
  const [stlstmLayers, setStlstmLayers] = useState(3);
  const [customModelName, setCustomModelName] = useState('');
  const [modelNameError, setModelNameError] = useState('');
  const [hiddenDims, setHiddenDims] = useState([64, 64, 64]);
  const [window_, setWindow] = useState(3);
  const [horizon, setHorizon] = useState(3);
  const [earlyStoppingPatience, setEarlyStoppingPatience] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [testTaskId, setTestTaskId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const isPersonalMode = dataSourceMode === 'personal';
  const modelNameLabel = String(t('modelTraining.modelName') || '')
    .replace(':', '')
    .replace('：', '')
    .trim();
  const baselineLabel = t('modelTraining.baselineO3');

  const preferredScript = useMemo(() => {
    const suffix = channelOrder.filter((channel) => selectedChannels.includes(channel)).join('');
    return `demo3-${suffix}.py`;
  }, [channelOrder, selectedChannels]);

  const selectedChannelsSummary = useMemo(() => {
    if (selectedChannels.length === 0) return copy.channelSummaryEmpty;
    return selectedChannels.map((channel) => channelMap[channel]?.name || channel).join(', ');
  }, [channelMap, copy.channelSummaryEmpty, selectedChannels]);

  const activeTask = useMemo(
    () => tasks.find((task) => task.id === activeTaskId) || null,
    [activeTaskId, tasks]
  );

  const activeStatusMeta = getStatusMeta(activeTask?.status || 'idle', t);

  const sourceMessage =
    sourceMeta?.message ||
    (sourceMeta?.effective_source === 'personal_mcd_plus_system_openmars'
      ? (isZh
          ? '个人 OpenMARS 数据不完整，系统会自动补充默认 OpenMARS 与个人 MCD。'
          : 'Personal OpenMARS is incomplete. The system will use default OpenMARS with personal MCD.')
      : '');

  const selectedScriptAvailable = !!selectedScript && scripts.includes(selectedScript);
  const startDisabled = user
    ? !selectedScriptAvailable || !!modelNameError || !customModelName.trim() || isProcessing
    : false;

  const summaryCardStyle = {
    padding: '14px 16px',
    borderRadius: 14,
    background: C.bgMuted,
    border: `1px solid ${C.border}`,
  };

  const sectionTitleStyle = {
    fontSize: 'calc(13px * var(--font-scale, 1))',
    fontWeight: 700,
    color: C.ice,
    marginBottom: 10,
    fontFamily: 'var(--font-display)',
  };

  const fieldLabelStyle = {
    fontSize: 'calc(12px * var(--font-scale, 1))',
    fontWeight: 600,
    color: C.ice80,
    marginBottom: 7,
    lineHeight: 1.45,
  };

  const fieldHintStyle = {
    fontSize: 'calc(11px * var(--font-scale, 1))',
    color: C.ice50,
    lineHeight: 1.6,
    marginTop: 6,
  };

  const inputStyle = {
    width: '100%',
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    background: isLight ? 'rgba(255,255,255,0.96)' : 'rgba(15,20,28,0.78)',
    color: C.ice,
    padding: '10px 12px',
    fontSize: 'calc(13px * var(--font-scale, 1))',
    lineHeight: 1.4,
    outline: 'none',
    transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
    fontFamily: 'var(--font-body)',
  };

  const headerMetaTextStyle = {
    fontSize: 'calc(12px * var(--font-scale, 1))',
    color: C.ice60,
    lineHeight: 1.7,
  };

  const panelTitleStyle = {
    fontSize: 'calc(19px * var(--font-scale, 1))',
    fontWeight: 700,
    color: C.ice,
    fontFamily: 'var(--font-display)',
    marginBottom: 6,
  };

  const validateModelName = (name) => {
    if (!name || !name.trim()) return t('modelTraining.nameRequired');
    const existingNames = tasks.map((task) => task.custom_model_name).filter(Boolean);
    if (existingNames.includes(name.trim())) {
      return t('modelTraining.nameUsed', { name: name.trim() });
    }
    return '';
  };

  const handleLayersChange = (event) => {
    const value = event.target.value;
    setStlstmLayers(value);

    if (value === '') return;

    let nextLayerCount = parseInt(value, 10);
    if (Number.isNaN(nextLayerCount) || nextLayerCount < 1) nextLayerCount = 1;
    if (nextLayerCount > 10) nextLayerCount = 10;

    setHiddenDims((previous) => {
      const next = [...previous];
      if (nextLayerCount > next.length) {
        for (let index = next.length; index < nextLayerCount; index += 1) next.push(64);
      } else {
        next.length = nextLayerCount;
      }
      return next;
    });
  };

  const handleModelNameChange = (event) => {
    const value = event.target.value;
    setCustomModelName(value);
    setModelNameError(validateModelName(value));
  };

  const handleDimChange = (index, value) => {
    const next = [...hiddenDims];
    next[index] = value === '' ? '' : Number(value);
    setHiddenDims(next);
  };

  useEffect(() => {
    if (!user) {
      setScripts([]);
      setScriptsLoading(false);
      setScriptsError('');
      return undefined;
    }

    let active = true;
    setScriptsLoading(true);
    setScriptsError('');

    fetchScripts()
      .then((data) => {
        if (!active) return;
        setScripts(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!active) return;
        setScripts([]);
        setScriptsError(copy.presetError);
      })
      .finally(() => {
        if (!active) return;
        setScriptsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [copy.presetError, user]);

  useEffect(() => {
    if (!user) {
      setSelectedScript(preferredScript);
      return;
    }

    if (scripts.length === 0) {
      setSelectedScript('');
      return;
    }

    if (scripts.includes(preferredScript)) {
      setSelectedScript(preferredScript);
      return;
    }

    setSelectedScript('');
  }, [preferredScript, scripts, user]);

  useEffect(() => {
    let active = true;
    setIsSwitchingSource(true);

    fetchDataInfo({ dataSource: dataSourceMode })
      .then((info) => {
        if (!active) return;
        setSourceMeta(info?.source_meta || null);
      })
      .catch(() => {
        if (!active) return;
        setSourceMeta(null);
      })
      .finally(() => {
        if (!active) return;
        setIsSwitchingSource(false);
      });

    return () => {
      active = false;
    };
  }, [dataSourceMode, user?.id]);

  const handleDataSourceModeChange = async (nextMode) => {
    if (isSwitchingSource || nextMode === dataSourceMode) return;
    if (nextMode !== 'personal') {
      setDataSourceMode(nextMode);
      return;
    }

    try {
      setIsSwitchingSource(true);
      const { blocked } = await getPersonalSourceAvailability();
      if (blocked) {
        showToast(getPersonalSourceBlockedMessage(isZh), 'error');
        setIsSwitchingSource(false);
        return;
      }
      setDataSourceMode('personal');
    } catch {
      showToast(getPersonalSourceCheckFailedMessage(isZh), 'error');
      setIsSwitchingSource(false);
    }
  };

  useEffect(() => {
    if (autoScrollRef.current && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleScroll = (event) => {
    const { scrollTop, scrollHeight, clientHeight } = event.target;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
  };

  const handleStartTraining = async () => {
    if (!user) {
      openAuthModal('login');
      return;
    }

    const nameError = validateModelName(customModelName);
    if (nameError) {
      alert(!customModelName.trim() ? t('modelTraining.namePrompt') : nameError);
      setModelNameError(nameError);
      return;
    }

    if (!selectedScriptAvailable) {
      alert(copy.presetUnavailable);
      return;
    }

    try {
      setIsProcessing(true);
      const hyperparameters = {
        epochs: Number(epochs) || 10,
        batch_size: Number(batchSize) || 32,
        learning_rate: Number(learningRate) || 0.001,
        stlstm_hidden_dims: hiddenDims.map((dim) => Number(dim) || 64),
        window: Number(window_) || 3,
        horizon: Number(horizon) || 3,
        early_stopping_patience: Number(earlyStoppingPatience) || 0,
      };

      const task = await startTrainingTask(
        selectedScript,
        hyperparameters,
        customModelName.trim(),
        dataSourceMode
      );

      setTasks((previous) => {
        const exists = previous.find((item) => item.id === task.id);
        if (exists) return previous;
        return [task, ...previous];
      });
      setActiveTaskId(task.id);
      loadTasks();
    } catch (error) {
      alert(t('modelTraining.startError') + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStopTask = async (taskId) => {
    if (isProcessing) return;
    try {
      setIsProcessing(true);
      await stopTrainingTask(taskId);
      loadTasks();
    } catch (error) {
      alert(t('modelTraining.stopError') + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!confirmDeleteId || isProcessing) return;
    try {
      setIsProcessing(true);
      await deleteTrainingTask(confirmDeleteId);
      if (activeTaskId === confirmDeleteId) {
        setActiveTaskId(null);
        setLogs([]);
      }
      setConfirmDeleteId(null);
      loadTasks();
    } catch (error) {
      alert(t('modelTraining.deleteError') + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const presetStatusText = !user
    ? copy.presetLoginHint
    : scriptsLoading
      ? copy.presetLoading
      : scriptsError || (selectedScriptAvailable ? copy.presetMatched : copy.presetUnavailable);

  const startButtonLabel = !user
    ? copy.loginToStart
    : isProcessing
      ? copy.starting
      : copy.startTraining;

  return (
    <div
      style={{
        position: 'relative',
        padding: '104px 36px 40px',
        maxWidth: 1460,
        margin: '0 auto',
        minHeight: '100vh',
      }}
    >
      <style>{`
        .model-training-grid {
          display: grid;
          grid-template-columns: minmax(340px, 410px) minmax(0, 1fr);
          gap: 24px;
          align-items: stretch;
        }
        .model-training-section + .model-training-section {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }
        .model-training-summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .model-training-field-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .model-training-chip-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .model-training-dim-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin-top: 12px;
        }
        .training-history-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
        }
        .model-training-stack {
          display: grid;
          gap: 12px;
        }
        .model-training-channels-compact {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        @media (max-width: 1180px) {
          .model-training-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 760px) {
          .model-training-summary-grid,
          .model-training-field-grid,
          .model-training-chip-grid {
            grid-template-columns: 1fr;
          }
          .model-training-channels-compact {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .training-history-metrics {
            grid-template-columns: 1fr 1fr;
          }
        }
        @media (max-width: 520px) {
          .training-history-metrics {
            grid-template-columns: 1fr;
          }
          .model-training-channels-compact {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 640px) {
          .model-training-page {
            padding-left: 18px;
            padding-right: 18px;
          }
        }
        input[type="number"]::-webkit-inner-spin-button {
          opacity: 0.35;
        }
      `}</style>

      <div
        style={{
          position: 'absolute',
          inset: '48px 0 auto',
          height: 320,
          pointerEvents: 'none',
          background: isLight
            ? 'radial-gradient(circle at 12% 10%, rgba(74,158,255,0.12), transparent 32%), radial-gradient(circle at 84% 0%, rgba(199,91,57,0.10), transparent 28%)'
            : 'radial-gradient(circle at 12% 10%, rgba(74,158,255,0.10), transparent 32%), radial-gradient(circle at 84% 0%, rgba(199,91,57,0.10), transparent 28%)',
        }}
      />

      <div className="model-training-page" style={{ position: 'relative', zIndex: 1 }}>
        <header style={{ marginBottom: 28 }}>
          <SectionTitle title={t('modelTraining.title')} subtitle={t('modelTraining.subtitle')} />
          <div style={{ ...headerMetaTextStyle, maxWidth: 760, marginTop: -10 }}>
            {t('modelTraining.newTrainingInfo')}
          </div>
        </header>

        <div className="model-training-grid">
          <section
            className="glass-card"
            style={{ padding: 22, display: 'flex', flexDirection: 'column', height: '100%' }}
          >
            <div className="model-training-stack" style={{ flex: 1, minHeight: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                  marginBottom: 18,
                }}
              >
                <div>
                  <div style={panelTitleStyle}>{t('modelTraining.parameters')}</div>
                  <div style={headerMetaTextStyle}>{isPersonalMode ? copy.sourceHintPersonal : copy.sourceHintDefault}</div>
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 999,
                    background: selectedScriptAvailable ? 'rgba(74,158,255,0.12)' : 'rgba(217,92,92,0.10)',
                    border: `1px solid ${selectedScriptAvailable ? 'rgba(74,158,255,0.20)' : 'rgba(217,92,92,0.16)'}`,
                    color: selectedScriptAvailable ? C.blue : '#d95c5c',
                    fontSize: 'calc(11px * var(--font-scale, 1))',
                    fontWeight: 700,
                  }}
                >
                  {selectedScriptAvailable ? copy.presetMatched : copy.selectionUnavailable}
                </div>
              </div>

              <div style={{ ...summaryCardStyle, padding: '16px 16px 14px' }}>
                <div style={{ ...sectionTitleStyle, marginBottom: 12 }}>{copy.dataSource}</div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    padding: 5,
                    borderRadius: 16,
                    background: isLight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${C.border}`,
                    marginBottom: 10,
                  }}
                >
                  {[
                    { value: 'default', label: copy.sourceDefault },
                    { value: 'personal', label: copy.sourcePersonal },
                  ].map((option) => {
                    const active = dataSourceMode === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={() => handleDataSourceModeChange(option.value)}
                        disabled={isSwitchingSource}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 12,
                          border: 'none',
                          background: active ? 'rgba(74,158,255,0.14)' : 'transparent',
                          color: active ? C.blue : C.ice60,
                          fontSize: 'calc(12px * var(--font-scale, 1))',
                          fontWeight: active ? 700 : 600,
                          cursor: isSwitchingSource ? 'not-allowed' : 'pointer',
                          opacity: isSwitchingSource ? 0.72 : 1,
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {sourceMessage ? (
                  <div style={{ ...fieldHintStyle, color: isPersonalMode ? C.blue : C.ice50 }}>{sourceMessage}</div>
                ) : (
                  <div style={{ ...fieldHintStyle, marginTop: 0 }}>
                    {isPersonalMode ? copy.sourceHintPersonal : copy.sourceHintDefault}
                  </div>
                )}
              </div>

              <div style={{ ...summaryCardStyle, padding: '16px 16px 14px' }}>
                <div style={{ ...sectionTitleStyle, marginBottom: 12 }}>{t('modelTraining.modelNaming')}</div>
                <div style={fieldLabelStyle}>
                  {modelNameLabel}
                  <span style={{ color: '#d95c5c', marginLeft: 4 }}>*</span>
                </div>
                <input
                  type="text"
                  style={{
                    ...inputStyle,
                    borderColor: modelNameError
                      ? '#d95c5c'
                      : customModelName.trim()
                        ? 'rgba(74,207,172,0.36)'
                        : C.border,
                  }}
                  placeholder={t('modelTraining.modelNamingPlaceholder')}
                  value={customModelName}
                  onChange={handleModelNameChange}
                />
                {modelNameError ? (
                  <div style={{ ...fieldHintStyle, color: '#d95c5c' }}>{modelNameError}</div>
                ) : null}
                {!modelNameError && customModelName.trim() ? (
                  <div style={{ ...fieldHintStyle, color: C.green }}>{copy.modelNameAvailable}</div>
                ) : null}
              </div>

              <div style={{ ...summaryCardStyle, padding: '14px 16px' }}>
                <div style={{ ...sectionTitleStyle, marginBottom: 10 }}>{copy.trainingSummary}</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <CompactField
                    label={t('modelTraining.inputChannels')}
                    value={selectedChannels.length > 0 ? selectedChannels.join(' + ') : 'O3'}
                    accent={C.mars}
                  />
                  <CompactField
                    label={copy.trainingPreset}
                    value={selectedScriptAvailable ? selectedScript : presetStatusText}
                    accent={selectedScriptAvailable ? C.ice : '#d95c5c'}
                  />
                  <CompactField
                    label={copy.coreParameters}
                    value={`${epochs} ep / ${batchSize} bs`}
                    accent={C.ice}
                  />
                </div>
              </div>

              <div className="model-training-section">
                <div>
                  <div style={sectionTitleStyle}>{t('modelTraining.inputChannels')}</div>
                  <div
                    className="model-training-channels-compact"
                  >
                    {channelOrder.map((channel) => {
                      const active = selectedChannels.includes(channel);
                      return (
                        <button
                          key={channel}
                          onClick={() => {
                            setSelectedChannels((previous) =>
                              active
                                ? previous.filter((item) => item !== channel)
                                : [...previous, channel]
                            );
                          }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 12,
                            border: `1px solid ${active ? 'rgba(199,91,57,0.22)' : C.border}`,
                            background: active ? 'rgba(199,91,57,0.10)' : C.bgMuted,
                            color: active ? C.mars : C.ice,
                            fontSize: 'calc(11px * var(--font-scale, 1))',
                            fontWeight: 700,
                            cursor: 'pointer',
                            textAlign: 'center',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 'calc(10px * var(--font-scale, 1))',
                              color: active ? C.mars : C.ice50,
                              marginBottom: 3,
                              fontFamily: MONO_FONT,
                            }}
                          >
                            {channelMap[channel]?.short}
                          </div>
                          <div
                            style={{
                              fontSize: 'calc(11px * var(--font-scale, 1))',
                              fontWeight: 700,
                              lineHeight: 1.35,
                            }}
                          >
                            {channelMap[channel]?.name}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="model-training-section">
                <div style={sectionTitleStyle}>{copy.coreParameters}</div>
                <div className="model-training-field-grid">
                  <div>
                    <div style={fieldLabelStyle}>{t('modelTraining.epochs')}</div>
                    <input
                      type="number"
                      style={inputStyle}
                      value={epochs}
                      onChange={(event) => setEpochs(event.target.value === '' ? '' : Number(event.target.value))}
                    />
                  </div>
                  <div>
                    <div style={fieldLabelStyle}>{t('modelTraining.batchSize')}</div>
                    <input
                      type="number"
                      style={inputStyle}
                      value={batchSize}
                      onChange={(event) => setBatchSize(event.target.value === '' ? '' : Number(event.target.value))}
                    />
                  </div>
                  <div>
                    <div style={fieldLabelStyle}>{t('modelTraining.learningRate')}</div>
                    <input
                      type="number"
                      step="0.0001"
                      style={inputStyle}
                      value={learningRate}
                      onChange={(event) =>
                        setLearningRate(event.target.value === '' ? '' : Number(event.target.value))
                      }
                    />
                  </div>
                  <div>
                    <div style={fieldLabelStyle}>{t('modelTraining.earlyStopPatience')}</div>
                    <input
                      type="number"
                      style={inputStyle}
                      value={earlyStoppingPatience}
                      min="0"
                      max="200"
                      onChange={(event) =>
                        setEarlyStoppingPatience(
                          event.target.value === '' ? '' : Math.max(0, Number(event.target.value))
                        )
                      }
                    />
                  </div>
                </div>
                <div style={{ ...fieldHintStyle, marginTop: 4 }}>{t('modelTraining.earlyStopNote')}</div>
              </div>

              <div className="model-training-section">
                <div
                  style={{
                    borderRadius: 16,
                    border: `1px solid ${C.border}`,
                    background: C.bgMuted,
                    overflow: 'hidden',
                  }}
                >
                  <button
                    onClick={() => setAdvancedOpen((previous) => !previous)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: 'none',
                      background: 'transparent',
                      color: C.ice,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ ...sectionTitleStyle, marginBottom: 4 }}>{copy.modelArchitecture}</div>
                      <div style={{ ...fieldHintStyle, marginTop: 0 }}>
                        {advancedOpen
                          ? t('modelTraining.window') + ' / ' + t('modelTraining.horizon') + ' / ' + copy.scriptFile
                          : `${t('modelTraining.stlstmLayers')}: ${stlstmLayers} / ${copy.scriptFile}: ${selectedScript || '--'}`}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 'calc(12px * var(--font-scale, 1))',
                        color: C.ice60,
                        fontWeight: 700,
                      }}
                    >
                      {advancedOpen ? copy.collapse : copy.expand}
                    </div>
                  </button>

                  {advancedOpen ? (
                    <div
                      style={{
                        padding: '0 14px 14px',
                        borderTop: `1px solid ${C.border}`,
                      }}
                    >
                      <div className="model-training-field-grid" style={{ marginTop: 16 }}>
                        <div>
                          <div style={fieldLabelStyle}>{t('modelTraining.window')}</div>
                          <input
                            type="number"
                            style={inputStyle}
                            value={window_}
                            min="1"
                            max="30"
                            onChange={(event) =>
                              setWindow(event.target.value === '' ? '' : Math.max(1, Number(event.target.value)))
                            }
                          />
                        </div>
                        <div>
                          <div style={fieldLabelStyle}>{t('modelTraining.horizon')}</div>
                          <input
                            type="number"
                            style={inputStyle}
                            value={horizon}
                            min="1"
                            max="30"
                            onChange={(event) =>
                              setHorizon(event.target.value === '' ? '' : Math.max(1, Number(event.target.value)))
                            }
                          />
                        </div>
                        <div>
                          <div style={fieldLabelStyle}>{t('modelTraining.stlstmLayers')}</div>
                          <input
                            type="number"
                            style={inputStyle}
                            value={stlstmLayers}
                            onChange={handleLayersChange}
                            min="1"
                            max="10"
                          />
                        </div>
                        <div>
                          <div style={fieldLabelStyle}>{copy.scriptFile}</div>
                          <div style={{ ...summaryCardStyle, minHeight: 44, display: 'flex', alignItems: 'center' }}>
                            <span
                              style={{
                                fontSize: 'calc(12px * var(--font-scale, 1))',
                                color: selectedScriptAvailable ? C.ice : C.ice50,
                                fontFamily: MONO_FONT,
                                lineHeight: 1.5,
                                wordBreak: 'break-word',
                              }}
                            >
                              {selectedScript || '--'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {hiddenDims.length > 0 ? (
                        <div className="model-training-dim-grid">
                          {hiddenDims.map((dim, index) => (
                            <div key={`${index}`}>
                              <div style={fieldLabelStyle}>
                                {t('modelTraining.layer')} {index + 1} {t('modelTraining.layerDim')}
                              </div>
                              <input
                                type="number"
                                style={inputStyle}
                                value={dim}
                                onChange={(event) => handleDimChange(index, event.target.value)}
                                min="1"
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="model-training-section" style={{ marginTop: 'auto', paddingTop: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={sectionTitleStyle}>{copy.trainingPreset}</div>
                    <div style={fieldHintStyle}>
                      {selectedScriptAvailable ? presetStatusText : copy.selectionUnavailable}
                    </div>
                  </div>
                  <button
                    onClick={handleStartTraining}
                    disabled={startDisabled}
                    style={{
                      minWidth: 190,
                      border: 'none',
                      borderRadius: 14,
                      background: !user ? C.blue : C.mars,
                      color: '#fff',
                      padding: '14px 18px',
                      fontSize: 'calc(15px * var(--font-scale, 1))',
                      fontWeight: 700,
                      cursor: startDisabled ? 'not-allowed' : 'pointer',
                      opacity: startDisabled ? 0.55 : 1,
                      transition: 'opacity 0.18s ease, transform 0.18s ease',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {startButtonLabel}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="glass-card" style={{ padding: 26 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
                marginBottom: 18,
              }}
            >
              <div>
                <div style={panelTitleStyle}>{t('modelTraining.trainingStatus')}</div>
                <div style={headerMetaTextStyle}>{copy.progressHint}</div>
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 999,
                  background: activeStatusMeta.tint,
                  border: `1px solid ${activeStatusMeta.border}`,
                  color: activeStatusMeta.color,
                  fontSize: 'calc(11px * var(--font-scale, 1))',
                  fontWeight: 700,
                }}
              >
                {activeStatusMeta.label}
              </div>
            </div>

            <div className="model-training-summary-grid">
              <SummaryMetric
                label={copy.selectedTask}
                value={activeTaskId ? `#${activeTaskId}` : '--'}
                accent={activeTaskId ? C.blue : C.ice60}
              />
              <SummaryMetric
                label={copy.currentModel}
                value={activeTask?.custom_model_name || copy.activeModelFallback}
                accent={activeTask?.custom_model_name ? C.ice : C.ice60}
              />
              <SummaryMetric
                label={copy.sourceMode}
                value={isPersonalMode ? copy.sourcePersonal : copy.sourceDefault}
                accent={isPersonalMode ? C.blue : C.ice}
              />
            </div>

            <TrainingProgressMonitor
              progress={progressData?.progress || 0}
              currentEpoch={progressData?.current_epoch || 0}
              totalEpochs={progressData?.total_epochs || 0}
              loss={progressData?.current_loss}
              eta={progressData?.eta || '--:--'}
              isLight={isLight}
              status={activeTask ? activeTask.status || 'running' : 'idle'}
            />

            <LossEvolutionChart lossHistory={progressData?.loss_history} isLight={isLight} />

            <div className="model-training-section">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 12,
                }}
              >
                <div>
                  <div style={sectionTitleStyle}>{copy.liveLogs}</div>
                  <div style={{ ...fieldHintStyle, marginTop: 0 }}>{copy.liveLogsHint}</div>
                </div>

                {activeTask && (activeTask.status === 'running' || activeTask.status === 'pending') ? (
                  <button
                    onClick={() => handleStopTask(activeTask.id)}
                    disabled={isProcessing}
                    style={{
                      padding: '9px 14px',
                      borderRadius: 10,
                      border: '1px solid rgba(217,92,92,0.18)',
                      background: 'rgba(217,92,92,0.08)',
                      color: '#d95c5c',
                      fontSize: 'calc(12px * var(--font-scale, 1))',
                      fontWeight: 700,
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      opacity: isProcessing ? 0.65 : 1,
                    }}
                  >
                    {copy.stopTraining}
                  </button>
                ) : null}
              </div>

              <div
                ref={logContainerRef}
                onScroll={handleScroll}
                style={{
                  minHeight: 240,
                  maxHeight: 360,
                  overflowY: 'auto',
                  borderRadius: 16,
                  padding: 16,
                  background: isLight ? 'rgba(246,248,252,0.98)' : 'rgba(11,15,21,0.94)',
                  border: `1px solid ${C.border}`,
                  color: isLight ? 'rgba(23,33,47,0.90)' : C.ice80,
                  fontFamily: MONO_FONT,
                  fontSize: 'calc(12px * var(--font-scale, 1))',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {!activeTaskId ? (
                  <div style={{ color: C.ice50, fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>
                    {copy.noTaskSelectedHint}
                  </div>
                ) : logs.length > 0 ? (
                  logs.map((line, index) => (
                    <div key={`${index}`} style={{ marginBottom: 2 }}>
                      {line}
                    </div>
                  ))
                ) : (
                  <div style={{ color: C.ice50, fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>
                    {copy.noLogsYet}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <section className="glass-card" style={{ padding: 26, marginTop: 24 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              marginBottom: 18,
            }}
          >
            <div>
              <div style={panelTitleStyle}>{t('modelTraining.historyTitle')}</div>
              <div style={headerMetaTextStyle}>{copy.historyHint}</div>
            </div>
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                background: C.bgMuted,
                border: `1px solid ${C.border}`,
                color: C.ice60,
                fontSize: 'calc(11px * var(--font-scale, 1))',
                fontWeight: 700,
              }}
            >
              {copy.historyCount(tasks.length)}
            </div>
          </div>

          {tasks.length === 0 ? (
            <div
              style={{
                padding: '52px 20px',
                textAlign: 'center',
                borderRadius: 18,
                background: C.bgMuted,
                border: `1px dashed ${C.borderStrong}`,
                color: C.ice50,
              }}
            >
              <div
                style={{
                  fontSize: 'calc(15px * var(--font-scale, 1))',
                  fontWeight: 600,
                  color: C.ice60,
                  marginBottom: 8,
                }}
              >
                {t('modelTraining.historyEmpty')}
              </div>
              <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', lineHeight: 1.65 }}>
                {copy.noTaskSelectedHint}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {tasks.map((task) => (
                <TrainingTaskCard
                  key={task.id}
                  task={task}
                  t={t}
                  locale={locale}
                  channelMap={channelMap}
                  baselineLabel={baselineLabel}
                  copy={copy}
                  isLight={isLight}
                  isActive={task.id === activeTaskId}
                  isProcessing={isProcessing}
                  onSelect={setActiveTaskId}
                  onStop={handleStopTask}
                  onDelete={setConfirmDeleteId}
                  onTest={setTestTaskId}
                />
              ))}
            </div>
          )}
        </section>

        {confirmDeleteId && (
          <ConfirmDialog
            title={t('modelTraining.confirmDelete')}
            message={t('modelTraining.confirmDeleteMsg', { id: confirmDeleteId })}
            confirmLabel={isProcessing ? t('modelTraining.deleting') : t('modelTraining.confirmDelete')}
            cancelLabel={t('modelTraining.cancel')}
            onConfirm={handleDeleteTask}
            onCancel={() => setConfirmDeleteId(null)}
            confirmColor="#d95c5c"
          />
        )}

        {testTaskId && <ModelTestModal taskId={testTaskId} onClose={() => setTestTaskId(null)} />}
      </div>
    </div>
  );
}
