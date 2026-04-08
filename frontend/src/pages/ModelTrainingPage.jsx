import React, { useState, useEffect, useRef } from 'react';
import C from '../constants/colors';
import { useT } from '../i18n';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { fetchScripts, startTrainingTask, fetchTasks, fetchLogs, stopTrainingTask, deleteTrainingTask } from '../services/api';
import ConfirmDialog from '../components/ConfirmDialog';
import ModelTestModal from '../components/ModelTestModal';

export default function ModelTrainingPage() {
  const t = useT();
  const { settings } = useSettings();
  const { user, openAuthModal } = useAuth();
  const isLight = settings.theme === 'light';

  // --- STATE ---
  const [scripts, setScripts] = useState([]);
  const [tasks, setTasks] = useState([]);
  
  // Script Selection & Channel Mapping
  const CHANNELS = React.useMemo(() => ['U', 'V', 'D', 'S', 'T'], []);
  const CHANNEL_MAP = {
    U: { name: '纬向风 U', icon: '🌬️' },
    V: { name: '经向风 V', icon: '💨' },
    D: { name: '沙尘 D', icon: '🌪️' },
    S: { name: '太阳辐射 S', icon: '☀️' },
    T: { name: '温度 T', icon: '🌡️' }
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
    if (!name || !name.trim()) return '模型命名不能为空';
    const existingNames = tasks.map(tk => tk.custom_model_name).filter(Boolean);
    if (existingNames.includes(name.trim())) return `名称 "${name.trim()}" 已被使用`;
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

  // Logs & active task
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);
  const logContainerRef = useRef(null);
  const autoScrollRef = useRef(true);

  // Load scripts and tasks on mount
  useEffect(() => {
    fetchScripts().then(data => {
      setScripts(data);
      if (data.length > 0) setSelectedScript(data[0]);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (user) {
      loadTasks();
    } else {
      setTasks([]);
      setActiveTaskId(null);
    }
  }, [user]);

  const loadTasks = () => {
    if (!user) return;
    fetchTasks().then(data => {
      setTasks(data);
      // Auto-set latest running task as active
      const runningTask = data.find(tk => tk.status === 'running' || tk.status === 'pending');
      if (runningTask) {
        setActiveTaskId(runningTask.id);
      }
    }).catch(console.error);
  };

  // Poll logs for active task
  useEffect(() => {
    if (!activeTaskId || !user) return;

    const pollLogs = () => {
      fetchLogs(activeTaskId).then(data => {
        setLogs(data.lines || []);
        // 同时刷新任务列表以同步状态
        loadTasks();
      }).catch(err => {
        console.error('Error fetching logs', err);
      });
    };

    pollLogs();
    const timer = setInterval(pollLogs, 3000); // 稍微调高间隔，3秒刷新一次状态和日志
    return () => clearInterval(timer);
  }, [activeTaskId]);

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
        alert('请先为本次训练的模型命名后再开始训练');
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
      const task = await startTrainingTask(selectedScript, hypers, customModelName);
      setActiveTaskId(task.id);
      loadTasks(); // refresh list
    } catch (e) {
      alert('Error starting training: ' + e.message);
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
      alert('Error stopping task: ' + e.message);
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
      alert('Error deleting task: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- STYLES ---
  const containerStyle = {
    padding: '120px 48px 48px 48px',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
    color: isLight ? '#222' : '#eee',
    maxWidth: 1400,
    margin: '0 auto',
  };

  const cardStyle = {
    background: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(15,20,35,0.7)',
    backdropFilter: 'blur(10px)',
    border: `1px solid ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 12,
    padding: 24,
    boxShadow: isLight ? '0 4px 12px rgba(0,0,0,0.05)' : '0 4px 12px rgba(0,0,0,0.3)',
  };

  const titleStyle = {
    fontSize: 24,
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
    fontSize: 13,
    fontWeight: 600,
    opacity: 0.8,
  };

  // --- SUB-COMPONENTS for cleaner UI ---
  const TrainingTaskCard = ({ tk, onLog, onStop, onDelete, onTest, isLight, isProcessing, C }) => {
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
      fontSize: 13,
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
                fontSize: 11, fontWeight: 800, opacity: 0.3, letterSpacing: 1,
                padding: '2px 8px', borderRadius: 6, background: 'rgba(128,128,128,0.1)'
              }}>ID:{tk.id}</span>
              
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: isLight ? '#1a1a1a' : '#efefef', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>模型名称:</span>
                {tk.custom_model_name || <span style={{ opacity: 0.3, fontStyle: 'italic' }}>未命名模型</span>}
              </h3>
              
              {/* Metadata Cluster: Script first, then Date */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 15, fontSize: 13, opacity: 0.45, fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span>📄</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isLight ? '#555' : '#ccc' }}>
                    {(() => {
                      const suffix = tk.model_script.replace('demo3-', '').replace('.py', '');
                      if (!suffix) return 'O₃ 基线';
                      return suffix.split('').map(char => CHANNEL_MAP[char]?.name || char).join(', ');
                    })()}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span>📅</span>
                  <span>{new Date(tk.start_time).toLocaleString('zh-CN', {
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
                <span style={{ fontSize: 12, fontWeight: 700, color: statusColor, letterSpacing: 0.5 }}>{statusLabel}</span>
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
                  <span style={{ fontSize: 10, fontWeight: 800, opacity: 0.4, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    {k.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: statusColor }}>
                    {Array.isArray(v) ? `[${v.join(', ')}]` : (k === 'learning_rate' ? v.toFixed(5) : (v === 0 ? 'Disabled' : v))}
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
              📊 查看日志
            </button>

            {(tk.status === 'running' || tk.status === 'pending') && (
              <button 
                onClick={() => onStop(tk.id)} 
                disabled={isProcessing}
                style={ghostButtonStyle('#F44336', false)}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, ghostButtonStyle('#F44336', true))}
                onMouseLeave={(e) => Object.assign(e.currentTarget.style, ghostButtonStyle('#F44336', false))}
              >
                🛑 停止训练
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
              🗑️ 删除记录
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: 1200, margin: '0 auto', minHeight: '100vh', background: isLight ? '#f9f9f9' : '#0a0a0f', color: isLight ? '#333' : '#eee' }}>
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
        input[type="number"]::-webkit-inner-spin-button { opacity: 0.3; }
      `}</style>
      <header>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, color: isLight ? '#111' : '#fff' }}>
          {t('modelTraining.title')}
        </h1>
        <p style={{ fontSize: 14, color: isLight ? '#666' : C.ice60, letterSpacing: 2 }}>
          {t('modelTraining.subtitle')}
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: 24 }}>

        {/* Left Col: Config Form */}
        <div style={cardStyle}>
          <div style={titleStyle}>{t('modelTraining.parameters')}</div>
          <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 20 }}>
            {t('modelTraining.newTrainingInfo')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                      <span style={{ fontSize: 18 }}>{info.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{info.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div style={labelStyle}>
                模型文件命名
                <span style={{ color: '#F44336', marginLeft: 4 }}>*</span>
              </div>
              <input
                type="text" style={{
                  ...inputStyle,
                  borderColor: modelNameError ? '#F44336' : (customModelName.trim() ? '#4CAF50' : (isLight ? '#ccc' : '#444'))
                }}
                placeholder="例如: predrnn_UDT_v1"
                value={customModelName}
                onChange={handleModelNameChange}
              />
              {modelNameError && (
                <div style={{ fontSize: 11, color: '#F44336', marginTop: 4 }}>⚠ {modelNameError}</div>
              )}
              {!modelNameError && customModelName.trim() && (
                <div style={{ fontSize: 11, color: '#4CAF50', marginTop: 4 }}>✓ 名称可用</div>
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
                <div style={labelStyle}>输入窗口 (Window)</div>
                <input
                  type="number" style={inputStyle}
                  value={window_} min="1" max="30"
                  onChange={e => setWindow(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                />
              </div>
              <div>
                <div style={labelStyle}>输出窗口 (Horizon)</div>
                <input
                  type="number" style={inputStyle}
                  value={horizon} min="1" max="30"
                  onChange={e => setHorizon(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                />
              </div>
            </div>

            <div>
              <div style={labelStyle}>早停耐心值 (Early Stop Patience)</div>
              <input
                type="number" style={inputStyle}
                value={earlyStoppingPatience} min="0" max="200"
                onChange={e => setEarlyStoppingPatience(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
              />
              <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
                0 = 禁用早停；建议值：5–20
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
                    <div style={{ ...labelStyle, fontSize: 11, opacity: 0.6 }}>Layer {i + 1} {t('modelTraining.layerDim')}</div>
                    <input
                      type="number" style={{ ...inputStyle, padding: '4px 8px', fontSize: 13 }}
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
                fontSize: 15,
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
                <span style={{ fontSize: 12, padding: '4px 8px', background: C.blue, color: '#fff', borderRadius: 4 }}>
                  Task ID: {activeTaskId}
                </span>
              )}
              {activeTaskId && tasks.find(t => t.id === activeTaskId)?.status === 'running' && (
                <button
                  onClick={() => handleStopTask(activeTaskId)}
                  disabled={isProcessing}
                  style={{
                    fontSize: 11, padding: '4px 8px', background: 'rgba(244,67,54,0.15)',
                    color: '#F44336', border: '1px solid #F44336', borderRadius: 4, cursor: 'pointer'
                  }}>
                  {isProcessing ? '...' : '停止训练'}
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
              fontSize: 13,
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
        </div>

      </div>

      {/* Bottom: Training History */}
      <div style={{ ...cardStyle, background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
        <div style={{ ...titleStyle, fontSize: 24, marginBottom: 24 }}>{t('modelTraining.historyTitle')}</div>

        {tasks.length === 0 ? (
          <div style={{ 
            textAlign: 'center', padding: '60px 0', opacity: 0.4, fontSize: 16, 
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
          title="确认删除"
          message={`确认要删除训练任务 #${confirmDeleteId} 及其关联的所有日志和模型文件吗？此操作不可恢复。`}
          confirmLabel={isProcessing ? "正在删除..." : "确认删除"}
          cancelLabel="取消"
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
