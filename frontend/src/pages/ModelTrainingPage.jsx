import React, { useState, useEffect, useRef } from 'react';
import C from '../constants/colors';
import { useT } from '../i18n';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { fetchScripts, startTrainingTask, fetchTasks, fetchLogs, stopTrainingTask, deleteTrainingTask } from '../services/api';
import ConfirmDialog from '../components/ConfirmDialog';

export default function ModelTrainingPage() {
  const t = useT();
  const { settings } = useSettings();
  const { user, openAuthModal } = useAuth();
  const isLight = settings.theme === 'light';

  // --- STATE ---
  const [scripts, setScripts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedScript, setSelectedScript] = useState('');

  // Form State
  const [epochs, setEpochs] = useState(10);
  const [batchSize, setBatchSize] = useState(32);
  const [learningRate, setLearningRate] = useState(0.001);
  const [stlstmLayers, setStlstmLayers] = useState(3);
  const [customModelName, setCustomModelName] = useState('');
  const [hiddenDims, setHiddenDims] = useState([64, 64, 64]);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleLayersChange = (e) => {
    let newLayers = parseInt(e.target.value, 10);
    if (isNaN(newLayers) || newLayers < 1) newLayers = 1;
    if (newLayers > 10) newLayers = 10;

    setStlstmLayers(newLayers);
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

  const handleDimChange = (index, value) => {
    const next = [...hiddenDims];
    next[index] = Number(value);
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
    try {
      setIsProcessing(true);
      const hypers = {
        epochs,
        batch_size: batchSize,
        learning_rate: learningRate,
        stlstm_hidden_dims: hiddenDims
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

  return (
    <div style={containerStyle}>
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
            <div>
              <div style={labelStyle}>{t('modelTraining.scriptList')}</div>
              <select
                style={{ ...inputStyle, appearance: 'auto' }}
                value={selectedScript}
                onChange={e => setSelectedScript(e.target.value)}
              >
                {scripts.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <div style={labelStyle}>模型文件命名 (可选)</div>
              <input
                type="text" style={inputStyle}
                placeholder="例如: predrnn_v1"
                value={customModelName} onChange={e => setCustomModelName(e.target.value)}
              />
            </div>

            <div>
              <div style={labelStyle}>{t('modelTraining.epochs')}</div>
              <input
                type="number" style={inputStyle}
                value={epochs} onChange={e => setEpochs(Number(e.target.value))}
              />
            </div>

            <div>
              <div style={labelStyle}>{t('modelTraining.batchSize')}</div>
              <input
                type="number" style={inputStyle}
                value={batchSize} onChange={e => setBatchSize(Number(e.target.value))}
              />
            </div>

            <div>
              <div style={labelStyle}>{t('modelTraining.learningRate')}</div>
              <input
                type="number" step="0.0001" style={inputStyle}
                value={learningRate} onChange={e => setLearningRate(Number(e.target.value))}
              />
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
              disabled={user ? !selectedScript : false}
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

      {/* Bottom: History Table */}
      <div style={cardStyle}>
        <div style={titleStyle}>{t('modelTraining.historyTitle')}</div>
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${isLight ? '#eee' : '#333'}`, color: C.mars }}>
                <th style={{ padding: '12px 8px' }}>{t('modelTraining.tableId')}</th>
                <th style={{ padding: '12px 8px' }}>{t('modelTraining.tableScript')}</th>
                <th style={{ padding: '12px 8px' }}>{t('modelTraining.parameters')}</th>
                <th style={{ padding: '12px 8px' }}>{t('modelTraining.tableTime')}</th>
                <th style={{ padding: '12px 8px' }}>{t('modelTraining.tableStatus')}</th>
                <th style={{ padding: '12px 8px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: 24, opacity: 0.5 }}>
                    {t('modelTraining.historyEmpty')}
                  </td>
                </tr>
              ) : tasks.map(tk => (
                <tr key={tk.id} style={{ borderBottom: `1px solid ${isLight ? '#f0f0f0' : '#222'}` }}>
                  <td style={{ padding: '12px 8px' }}>#{tk.id}</td>
                  <td style={{ padding: '12px 8px' }}>{tk.model_script}</td>
                  <td style={{ padding: '12px 8px', fontSize: 12, opacity: 0.8 }}>
                    {tk.hyperparameters}
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: 12 }}>
                    {new Date(tk.start_time).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{
                      padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 'bold',
                      background: tk.status === 'completed' ? 'rgba(76,175,80,0.2)' :
                        tk.status === 'failed' ? 'rgba(244,67,54,0.2)' : 'rgba(255,152,0,0.2)',
                      color: tk.status === 'completed' ? '#4CAF50' :
                        tk.status === 'failed' ? '#F44336' : '#FF9800'
                    }}>
                      {tk.status === 'completed' ? t('modelTraining.statusCompleted') :
                        tk.status === 'failed' ? t('modelTraining.statusFailed') :
                          tk.status === 'running' ? t('modelTraining.statusRunning') :
                            t('modelTraining.statusPending')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <button
                      onClick={() => setActiveTaskId(tk.id)}
                      style={{
                        marginRight: 8, background: 'none', border: `1px solid ${C.blue}`,
                        color: C.blue, borderRadius: 4, padding: '4px 8px', cursor: 'pointer'
                      }}>
                      看日志
                    </button>
                    {(tk.status === 'running' || tk.status === 'pending') && (
                      <button
                        onClick={() => handleStopTask(tk.id)}
                        disabled={isProcessing}
                        style={{
                          marginRight: 8, background: 'none', border: '1px solid #F44336',
                          color: '#F44336', borderRadius: 4, padding: '4px 8px', cursor: 'pointer'
                        }}>
                        停止
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDeleteId(tk.id)}
                      disabled={isProcessing}
                      style={{
                        marginRight: 8, background: 'none', border: `1px solid ${isLight ? '#999' : '#555'}`,
                        color: isLight ? '#666' : '#999', borderRadius: 4, padding: '4px 8px', cursor: 'pointer'
                      }}>
                      删除
                    </button>
                    {tk.status === 'completed' && (
                      <button style={{
                        background: 'none', border: `1px solid ${C.mars}`,
                        color: C.mars, borderRadius: 4, padding: '4px 8px', cursor: 'pointer'
                      }}>
                        测试
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    </div>
  );
}
