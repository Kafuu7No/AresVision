import React, { useState, useEffect, useRef } from 'react';
import C from '../constants/colors';
import { useT } from '../i18n';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchScripts,
  startTrainingTask,
  fetchTasks,
  fetchLogs,
  stopTrainingTask,
  deleteTrainingTask,
  fetchDataInfo,
} from '../services/api';
import ConfirmDialog from '../components/ConfirmDialog';
import ModelTestModal from '../components/ModelTestModal';
import TrainingProgressMonitor from '../components/TrainingProgressMonitor';
import LossEvolutionChart from '../components/LossEvolutionChart';
import { useTraining } from '../contexts/TrainingContext';

export default function ModelTrainingPage() {
  const t = useT();
  const { settings } = useSettings();
  const { user, openAuthModal } = useAuth();
  const isLight = settings.theme === 'light';

  const {
    tasks,
    setTasks,
    activeTaskId,
    setActiveTaskId,
    progressData,
    logs,
    setLogs,
    loadTasks
  } = useTraining();

  const [scripts, setScripts] = useState([]);
  const [dataSourceMode, setDataSourceMode] = useState('default');
  const [sourceMeta, setSourceMeta] = useState(null);
  
  const logsEndRef = useRef(null);
  const logContainerRef = useRef(null);
  const autoScrollRef = useRef(true);

  // Script Selection & Channel Mapping
  const CHANNELS = React.useMemo(() => ['U', 'V', 'D', 'S', 'T'], []);
  const CHANNEL_MAP = {
    U: { name: t('predict.variables.U_Wind'), icon: '🌬️' },
    V: { name: t('predict.variables.V_Wind'), icon: '💨' },
    D: { name: t('predict.variables.Dust_Optical_Depth'), icon: '🌪️' },
    S: { name: t('predict.variables.Solar_Flux_DN'), icon: '☀️' },
    T: { name: t('predict.variables.Temperature'), icon: '🌡️' }
  };
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [selectedScript, setSelectedScript] = useState('demo3-.py');

  useEffect(() => {
    const suffix = CHANNELS.filter(c => selectedChannels.includes(c)).join('');
    setSelectedScript(`demo3-${suffix}.py`);
  }, [selectedChannels, CHANNELS]);

  // Form State
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

  const handleLayersChange = (e) => {
    const val = e.target.value;
    setStlstmLayers(val);

    if (val === '') return;

    let newLayers = parseInt(val, 10);
    if (isNaN(newLayers) || newLayers < 1) newLayers = 1;
    if (newLayers > 10) newLayers = 10;

    setHiddenDims(prev => {
      const next = [...prev];
      if (newLayers > next.length) {
        for (let i = next.length; i < newLayers; i++) next.push(64);
      } else {
        next.length = newLayers;
      }
      return next;
    });
  };

  const validateModelName = (name) => {
    if (!name || !name.trim()) return t('modelTraining.nameRequired');
    const existingNames = tasks.map(tk => tk.custom_model_name).filter(Boolean);
    if (existingNames.includes(name.trim())) return t('modelTraining.nameUsed', { name: name.trim() });
    return '';
  };

  const handleModelNameChange = (e) => {
    const val = e.target.value;
    setCustomModelName(val);
    setModelNameError(validateModelName(val));
  };

  const handleDimChange = (index, value) => {
    const next = [...hiddenDims];
    next[index] = value === '' ? '' : Number(value);
    setHiddenDims(next);
  };

  // Load scripts on mount
  useEffect(() => {
    fetchScripts().then(data => {
      setScripts(data);
      if (data.length > 0) setSelectedScript(data[0]);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    let active = true;
    fetchDataInfo({ dataSource: dataSourceMode })
      .then((info) => {
        if (!active) return;
        setSourceMeta(info?.source_meta || null);
      })
      .catch(() => {
        if (!active) return;
        setSourceMeta(null);
      });
    return () => {
      active = false;
    };
  }, [dataSourceMode, user?.id]);


  // Scroll to bottom of logs (internal only)
  useEffect(() => {
    if (autoScrollRef.current && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // If user is within 50px of bottom, stick to bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    autoScrollRef.current = isAtBottom;
  };

  const handleStartTraining = async () => {
    if (!user) {
      openAuthModal('login');
      return;
    }
    if (!selectedScript) return;

    // 显式校验模型名称并弹出提示
    const nameErr = validateModelName(customModelName);
    if (nameErr) {
      if (!customModelName.trim()) {
        alert(t('modelTraining.namePrompt'));
      } else {
        alert(nameErr);
      }
      setModelNameError(nameErr);
      return;
    }
    try {
      setIsProcessing(true);
      const hypers = {
        epochs: Number(epochs) || 10,
        batch_size: Number(batchSize) || 32,
        learning_rate: Number(learningRate) || 0.001,
        stlstm_hidden_dims: hiddenDims.map(d => Number(d) || 64),
        window: Number(window_) || 3,
        horizon: Number(horizon) || 3,
        early_stopping_patience: Number(earlyStoppingPatience) || 0,
      };
      const task = await startTrainingTask(selectedScript, hypers, customModelName, dataSourceMode);
      // 先同步到本地，确保渲染能找到该任务
      setTasks(prev => {
        const exists = prev.find(t => t.id === task.id);
        if (exists) return prev;
        return [task, ...prev];
      });
      setActiveTaskId(task.id);
      loadTasks(); // refresh list
    } catch (e) {
      alert(t('modelTraining.startError') + e.message);
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
    } catch (e) {
      alert(t('modelTraining.stopError') + e.message);
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
    } catch (e) {
      alert(t('modelTraining.deleteError') + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- STYLES ---
  const cardStyle = {
    background: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(15,20,35,0.7)',
    backdropFilter: 'blur(10px)',
    border: `1px solid ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 12,
    padding: 24,
    boxShadow: isLight ? '0 4px 12px rgba(0,0,0,0.05)' : '0 4px 12px rgba(0,0,0,0.3)',
  };

  const titleStyle = {
    fontSize: 'calc(24px * var(--font-scale, 1))',
    fontWeight: 700,
    letterSpacing: 1,
    marginBottom: 8,
    color: C.mars,
  };

  const inputStyle = {
    background: isLight ? '#fff' : 'rgba(0,0,0,0.3)',
    border: `1px solid ${isLight ? '#ccc' : '#444'}`,
    color: isLight ? '#000' : '#fff',
    padding: '8px 12px',
    borderRadius: 6,
    width: '100%',
    fontFamily: 'inherit',
    marginTop: 4,
  };

  const labelStyle = {
    fontSize: 'calc(13px * var(--font-scale, 1))',
    fontWeight: 600,
    opacity: 0.8,
  };
  const isPersonalMode = dataSourceMode === 'personal';
  const sourceMessage = sourceMeta?.message || '';

  // --- SUB-COMPONENTS for cleaner UI ---
  const TrainingTaskCard = ({ tk, onLog, onStop, onDelete, onTest, isLight, isProcessing, C }) => {
    const { settings } = useSettings();
    const lang = settings.language;
    const [isHovered, setIsHovered] = useState(false);
    const hypers = React.useMemo(() => {
      try { return JSON.parse(tk.hyperparameters || '{}'); } catch { return {}; }
    }, [tk.hyperparameters]);

    const statusColor = tk.status === 'completed' ? '#4CAF50' : tk.status === 'failed' ? '#F44336' : '#FF9800';
    const statusLabel = tk.status === 'completed' ? t('modelTraining.statusCompleted') :
      tk.status === 'failed' ? t('modelTraining.statusFailed') :
        tk.status === 'running' ? t('modelTraining.statusRunning') : t('modelTraining.statusPending');

    const cardStyles = {
      position: 'relative',
      borderRadius: 12,
      marginBottom: 16,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      border: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'}`,
      borderLeft: `6px solid ${statusColor}`,
      background: isLight ? 'rgba(255,255,255,0.7)' : 'rgba(30,30,45,0.4)',
      backdropFilter: 'blur(12px)',
      boxShadow: isHovered
        ? (isLight ? '0 10px 40px rgba(0,0,0,0.1)' : '0 15px 50px rgba(0,0,0,0.5)')
        : (isLight ? '0 4px 15px rgba(0,0,0,0.03)' : '0 4px 20px rgba(0,0,0,0.2)'),
      transform: isHovered ? 'scale(1.01) translateY(-2px)' : 'scale(1)',
      overflow: 'hidden',
      cursor: 'default'
    };

    const ghostButtonStyle = (color, filled) => ({
      background: filled ? color : 'transparent',
      border: `1.5px solid ${color}`,
      color: filled ? '#fff' : color,
      padding: '7px 16px',
      borderRadius: 20,
      fontSize: 'calc(13px * var(--font-scale, 1))',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6
    });

    const dotStyle = {
      width: 8, height: 8, borderRadius: '50%',
      backgroundColor: statusColor,
      boxShadow: `0 0 10px ${statusColor}`,
      animation: tk.status === 'running' ? 'pulse 2s infinite' : 'none'
    };

    return (
      <div
        style={cardStyles}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div style={{ padding: '20px 24px' }}>
          {/* Header Row: ID + Info + Status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 800, opacity: isLight ? 0.6 : 0.3, letterSpacing: 1,
                padding: '2px 8px', borderRadius: 6, background: 'rgba(128,128,128,0.1)'
              }}>{t('modelTraining.taskId')}: {tk.id}</span>

              <h3 style={{ margin: 0, fontSize: 'calc(18px * var(--font-scale, 1))', fontWeight: 700, color: isLight ? '#1a1a1a' : '#efefef', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{t('modelTraining.modelName')}</span>
                {tk.custom_model_name || <span style={{ opacity: isLight ? 0.5 : 0.3, fontStyle: 'italic' }}>{t('modelTraining.unnamedModel')}</span>}
              </h3>

              {/* Metadata Cluster: Script first, then Date */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 15, fontSize: 'calc(13px * var(--font-scale, 1))', opacity: isLight ? 0.7 : 0.45, fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span>📄</span>
                  <span style={{ fontSize: 'calc(12px * var(--font-scale, 1))', fontWeight: 700, color: isLight ? '#555' : '#ccc' }}>
                    {(() => {
                      const suffix = tk.model_script.replace('demo3-', '').replace('.py', '');
                      if (!suffix) return t('modelTraining.baselineO3');
                      return suffix.split('').map(char => CHANNEL_MAP[char]?.name || char).join(', ');
                    })()}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span>📅</span>
                  <span>{new Date(tk.start_time).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
                    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                  })}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 20,
                background: statusColor + '12', border: `1px solid ${statusColor + '30'}`
              }}>
                <div style={dotStyle} />
                <span style={{ fontSize: 'calc(12px * var(--font-scale, 1))', fontWeight: 700, color: statusColor, letterSpacing: 0.5 }}>{statusLabel}</span>
              </div>
            </div>
          </div>

          {/* Hyperparameters Grid (Always Visible) */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12,
              padding: '16px 18px', borderRadius: 10,
              background: isLight ? '#fafafa' : 'rgba(0,0,0,0.18)',
              border: `1px solid ${isLight ? '#eee' : 'rgba(255,255,255,0.04)'}`
            }}>
              {Object.entries(hypers).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 'calc(10px * var(--font-scale, 1))', fontWeight: 800, opacity: isLight ? 0.6 : 0.4, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    {t(`modelTraining.hypers.${k}`)}
                  </span>
                  <span style={{ fontSize: 'calc(14px * var(--font-scale, 1))', fontWeight: 700, color: statusColor }}>
                    {Array.isArray(v) ? `[${v.join(', ')}]` : (k === 'learning_rate' ? v.toFixed(5) : (v === 0 ? t('modelTraining.hypers.disabled') : v))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', gap: 10, borderTop: `1px dashed ${isLight ? '#eee' : '#333'}`, paddingTop: 16 }}>
            <button
              onClick={() => onLog(tk.id)}
              style={ghostButtonStyle(C.blue, false)}
              onMouseEnter={(e) => Object.assign(e.currentTarget.style, ghostButtonStyle(C.blue, true))}
              onMouseLeave={(e) => Object.assign(e.currentTarget.style, ghostButtonStyle(C.blue, false))}
            >
              {t('modelTraining.viewLogs')}
            </button>

            {(tk.status === 'running' || tk.status === 'pending') && (
              <button
                onClick={() => onStop(tk.id)}
                disabled={isProcessing}
                style={ghostButtonStyle('#F44336', false)}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, ghostButtonStyle('#F44336', true))}
                onMouseLeave={(e) => Object.assign(e.currentTarget.style, ghostButtonStyle('#F44336', false))}
              >
                {t('modelTraining.stopTraining')}
              </button>
            )}

            {tk.status === 'completed' && (
              <button
                onClick={() => onTest(tk.id)}
                style={ghostButtonStyle(C.mars, false)}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, ghostButtonStyle(C.mars, true))}
                onMouseLeave={(e) => Object.assign(e.currentTarget.style, ghostButtonStyle(C.mars, false))}
              >
                {t('modelTraining.actionTest')}
              </button>
            )}

            <button
              onClick={() => onDelete(tk.id)}
              disabled={isProcessing}
              style={ghostButtonStyle(isLight ? '#777' : '#999', false)}
              onMouseEnter={(e) => Object.assign(e.currentTarget.style, ghostButtonStyle(isLight ? '#777' : '#999', true))}
              onMouseLeave={(e) => Object.assign(e.currentTarget.style, ghostButtonStyle(isLight ? '#777' : '#999', false))}
            >
              {t('modelTraining.deleteRecord')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '110px 48px 48px 48px', maxWidth: 1400, margin: '0 auto', minHeight: '100vh', background: isLight ? '#f9f9f9' : '#0a0a0f', color: isLight ? '#333' : '#eee' }}>
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
        input[type="number"]::-webkit-inner-spin-button { opacity: 0.3; }
      `}</style>
      <header>
        <h1 style={{ fontSize: 'calc(32px * var(--font-scale, 1))', fontWeight: 800, margin: 0, color: isLight ? '#111' : '#fff' }}>
          {t('modelTraining.title')}
        </h1>
        <p style={{ fontSize: 'calc(14px * var(--font-scale, 1))', color: isLight ? '#666' : C.ice60, letterSpacing: 2 }}>
          {t('modelTraining.subtitle')}
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: 24 }}>

        {/* Left Col: Config Form */}
        <div style={cardStyle}>
          <div style={titleStyle}>{t('modelTraining.parameters')}</div>
          <p style={{ fontSize: 'calc(13px * var(--font-scale, 1))', opacity: 0.7, marginBottom: 20 }}>
            {t('modelTraining.newTrainingInfo')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ ...labelStyle, marginBottom: 6 }}>数据源</div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 8,
                background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isLight ? '#ddd' : '#444'}`,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: isLight ? '#333' : C.ice }}>Default / Personal</span>
                  <span style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: isPersonalMode ? C.blue : C.ice60, fontWeight: 700 }}>
                    {isPersonalMode ? '当前：Personal' : '当前：Default'}
                  </span>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: 32, height: 18 }}>
                  <input
                    type="checkbox"
                    checked={isPersonalMode}
                    onChange={() => setDataSourceMode(isPersonalMode ? 'default' : 'personal')}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', inset: 0, cursor: 'pointer', borderRadius: 34,
                    transition: '.3s',
                    backgroundColor: isPersonalMode ? 'rgba(74,158,255,0.3)' : 'rgba(0,0,0,0.08)',
                    border: `1px solid ${isPersonalMode ? C.blue : (isLight ? '#ccc' : '#555')}`,
                  }}>
                    <span style={{
                      position: 'absolute', width: 12, height: 12, bottom: 2,
                      left: isPersonalMode ? 16 : 2,
                      borderRadius: '50%', transition: '.3s',
                      backgroundColor: isPersonalMode ? C.blue : (isLight ? '#666' : C.ice60),
                    }} />
                  </span>
                </label>
              </div>
              {sourceMessage ? (
                <div style={{ marginTop: 8, fontSize: 'calc(11px * var(--font-scale, 1))', color: isLight ? '#666' : C.ice60, lineHeight: 1.5 }}>
                  {sourceMessage}
                </div>
              ) : null}
            </div>
            <div style={{ marginBottom: 4 }}>
              <div style={{ ...labelStyle, marginBottom: 12 }}>{t('modelTraining.inputChannels')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {CHANNELS.map(c => {
                  const active = selectedChannels.includes(c);
                  const info = CHANNEL_MAP[c];
                  return (
                    <button
                      key={c}
                      onClick={() => {
                        setSelectedChannels(prev => active ? prev.filter(x => x !== c) : [...prev, c]);
                      }}
                      style={{
                        flex: '1 1 80px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        padding: '12px 8px', borderRadius: 10,
                        cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        border: `1.5px solid ${active ? C.mars : (isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)')}`,
                        background: active ? `${C.mars}22` : (isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)'),
                        color: active ? C.mars : (isLight ? '#666' : '#999'),
                        boxShadow: active ? `0 0 15px ${C.mars}33` : 'none',
                        transform: active ? 'scale(1.05)' : 'scale(1)',
                      }}
                    >
                      <span style={{ fontSize: 'calc(18px * var(--font-scale, 1))' }}>{info.icon}</span>
                      <span style={{ fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 700 }}>{info.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div style={labelStyle}>
                {t('modelTraining.modelNaming')}
                <span style={{ color: '#F44336', marginLeft: 4 }}>*</span>
              </div>
              <input
                type="text" style={{
                  ...inputStyle,
                  borderColor: modelNameError ? '#F44336' : (customModelName.trim() ? '#4CAF50' : (isLight ? '#ccc' : '#444'))
                }}
                placeholder={t('modelTraining.modelNamingPlaceholder')}
                value={customModelName}
                onChange={handleModelNameChange}
              />
              {modelNameError && (
                <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: '#F44336', marginTop: 4 }}>⚠ {modelNameError}</div>
              )}
              {!modelNameError && customModelName.trim() && (
                <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: '#4CAF50', marginTop: 4 }}>{t('modelTraining.nameAvailable')}</div>
              )}
            </div>

            <div>
              <div style={labelStyle}>{t('modelTraining.epochs')}</div>
              <input
                type="number" style={inputStyle}
                value={epochs} onChange={e => setEpochs(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>

            <div>
              <div style={labelStyle}>{t('modelTraining.batchSize')}</div>
              <input
                type="number" style={inputStyle}
                value={batchSize} onChange={e => setBatchSize(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>

            <div>
              <div style={labelStyle}>{t('modelTraining.learningRate')}</div>
              <input
                type="number" step="0.0001" style={inputStyle}
                value={learningRate} onChange={e => setLearningRate(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={labelStyle}>{t('modelTraining.window')}</div>
                <input
                  type="number" style={inputStyle}
                  value={window_} min="1" max="30"
                  onChange={e => setWindow(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                />
              </div>
              <div>
                <div style={labelStyle}>{t('modelTraining.horizon')}</div>
                <input
                  type="number" style={inputStyle}
                  value={horizon} min="1" max="30"
                  onChange={e => setHorizon(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                />
              </div>
            </div>

            <div>
              <div style={labelStyle}>{t('modelTraining.earlyStopPatience')}</div>
              <input
                type="number" style={inputStyle}
                value={earlyStoppingPatience} min="0" max="200"
                onChange={e => setEarlyStoppingPatience(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
              />
              <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', opacity: 0.5, marginTop: 4 }}>
                {t('modelTraining.earlyStopNote')}
              </div>
            </div>

            <div>
              <div style={labelStyle}>{t('modelTraining.stlstmLayers')}</div>
              <input
                type="number" style={inputStyle}
                value={stlstmLayers} onChange={handleLayersChange}
                min="1" max="10"
              />
            </div>

            {hiddenDims.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, marginTop: -4 }}>
                {hiddenDims.map((dim, i) => (
                  <div key={i}>
                    <div style={{ ...labelStyle, fontSize: 'calc(11px * var(--font-scale, 1))', opacity: 0.6 }}>{t('modelTraining.layer')} {i + 1} {t('modelTraining.layerDim')}</div>
                    <input
                      type="number" style={{ ...inputStyle, padding: '4px 8px', fontSize: 'calc(13px * var(--font-scale, 1))' }}
                      value={dim} onChange={e => handleDimChange(i, e.target.value)}
                      min="1"
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleStartTraining}
              disabled={user ? (!selectedScript || !!modelNameError) : false}
              style={{
                marginTop: 8,
                background: !user ? C.blue : C.mars,
                color: '#fff',
                border: 'none',
                padding: '12px',
                borderRadius: 8,
                fontSize: 'calc(15px * var(--font-scale, 1))',
                fontWeight: 700,
                cursor: (user && !selectedScript) ? 'not-allowed' : 'pointer',
                opacity: (user && !selectedScript) ? 0.5 : 1,
                transition: 'background 0.2s'
              }}
            >
              {!user ? t('modelTraining.loginToStart') : t('modelTraining.startBtn')}
            </button>
          </div>
        </div>

        {/* Right Col: Logs */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={titleStyle}>{t('modelTraining.trainingStatus')}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {activeTaskId && (
                <span style={{ fontSize: 'calc(12px * var(--font-scale, 1))', padding: '4px 8px', background: C.blue, color: '#fff', borderRadius: 4 }}>
                  {t('modelTraining.taskId')}: {activeTaskId}
                </span>
              )}
              {activeTaskId && tasks.find(t => t.id === activeTaskId)?.status === 'running' && (
                <button
                  onClick={() => handleStopTask(activeTaskId)}
                  disabled={isProcessing}
                  style={{
                    fontSize: 'calc(11px * var(--font-scale, 1))', padding: '4px 8px', background: 'rgba(244,67,54,0.15)',
                    color: '#F44336', border: '1px solid #F44336', borderRadius: 4, cursor: 'pointer'
                  }}>
                  {isProcessing ? '...' : t('modelTraining.stopTraining')}
                </button>
              )}
            </div>
          </div>

          <div
            ref={logContainerRef}
            onScroll={handleScroll}
            style={{
              flexGrow: 1,
              background: isLight ? '#f5f5f5' : '#000',
              borderRadius: 8,
              padding: 16,
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: 'calc(13px * var(--font-scale, 1))',
              lineHeight: 1.5,
              color: isLight ? '#333' : '#aeea00',
              border: `1px solid ${isLight ? '#ddd' : '#333'}`,
              maxHeight: 400
            }}
          >
            {!activeTaskId ? (
              <div style={{ opacity: 0.5, fontStyle: 'italic' }}>{t('modelTraining.noActiveTask')}</div>
            ) : (
              logs.length > 0 ? logs.map((line, i) => (
                <div key={i} style={{ whiteSpace: 'pre-wrap' }}>{line}</div>
              )) : <div style={{ opacity: 0.5 }}>{t('modelTraining.logsFetchError')}...</div>
            )}
            <div ref={logsEndRef} />
          </div>

          {/* 实时进度监控组件 - 始终常驻显示 */}
          <TrainingProgressMonitor
            progress={progressData?.progress || 0}
            currentEpoch={progressData?.current_epoch || 0}
            totalEpochs={progressData?.total_epochs || 0}
            loss={progressData?.current_loss}
            eta={progressData?.eta || '--:--'}
            isLight={isLight}
            status={activeTaskId ? (tasks.find(t => t.id === activeTaskId)?.status || 'running') : 'idle'}
          />

          {/* 实时 Loss 演变图表 */}
          <LossEvolutionChart 
            lossHistory={progressData?.loss_history} 
            isLight={isLight} 
          />
        </div>

      </div>

      {/* Bottom: Training History */}
      <div style={{ ...cardStyle, background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
        <div style={{ ...titleStyle, fontSize: 'calc(24px * var(--font-scale, 1))', marginBottom: 24 }}>{t('modelTraining.historyTitle')}</div>

        {tasks.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 0', opacity: 0.4, fontSize: 'calc(16px * var(--font-scale, 1))',
            background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px dashed rgba(128,128,128,0.2)'
          }}>
            📭 {t('modelTraining.historyEmpty')}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100%, 1fr))', gap: 10 }}>
            {tasks.map(tk => (
              <TrainingTaskCard
                key={tk.id} tk={tk} isLight={isLight} isProcessing={isProcessing} C={C}
                onLog={setActiveTaskId} onStop={handleStopTask} onDelete={setConfirmDeleteId}
                onTest={setTestTaskId}
              />
            ))}
          </div>
        )}
      </div>

      {confirmDeleteId && (
        <ConfirmDialog
          title={t('modelTraining.confirmDelete')}
          message={t('modelTraining.confirmDeleteMsg', { id: confirmDeleteId })}
          confirmLabel={isProcessing ? t('modelTraining.deleting') : t('modelTraining.confirmDelete')}
          cancelLabel={t('modelTraining.cancel')}
          onConfirm={handleDeleteTask}
          onCancel={() => setConfirmDeleteId(null)}
          confirmColor="#F44336"
        />
      )}
      {testTaskId && (
        <ModelTestModal
          taskId={testTaskId}
          onClose={() => setTestTaskId(null)}
        />
      )}
    </div>
  );
}
