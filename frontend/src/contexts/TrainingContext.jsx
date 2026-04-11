import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { fetchTasks, fetchLogs } from '../services/api';
import { useAuth } from './AuthContext';

const TrainingContext = createContext();

export const useTraining = () => useContext(TrainingContext);

export const TrainingProvider = ({ children }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [logs, setLogs] = useState([]);
  const wsRef = useRef(null);
  const pollingRef = useRef(null);
  const logPollingRef = useRef(null);

  const loadTasks = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchTasks();
      setTasks(data);
      
      // 如果当前没有活跃任务，自动选择最新的正在运行的任务
      if (!activeTaskId) {
        const runningTask = data.find(tk => tk.status === 'running' || tk.status === 'pending');
        if (runningTask) {
          setActiveTaskId(runningTask.id);
        }
      }
    } catch (err) {
      console.error('Failed to load tasks', err);
    }
  }, [user, activeTaskId]);

  // 定时同步任务列表
  useEffect(() => {
    if (user) {
      loadTasks();
      pollingRef.current = setInterval(loadTasks, 5000);
    } else {
      setTasks([]);
      setActiveTaskId(null);
      setProgressData(null);
      setLogs([]);
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [user, loadTasks]);

  // 定时同步活跃任务日志
  useEffect(() => {
    if (!activeTaskId || !user) {
      setLogs([]);
      if (logPollingRef.current) clearInterval(logPollingRef.current);
      return;
    }

    const pollLogs = async () => {
      try {
        const data = await fetchLogs(activeTaskId);
        setLogs(data.lines || []);
      } catch (err) {
        console.error('Error polling logs', err);
      }
    };

    pollLogs();
    logPollingRef.current = setInterval(pollLogs, 3000);

    return () => {
      if (logPollingRef.current) clearInterval(logPollingRef.current);
    };
  }, [activeTaskId, user]);

  // 当 activeTaskId 变化或任务列表更新时，同步 progressData
  useEffect(() => {
    const task = tasks.find(t => t.id === activeTaskId);
    if (task) {
      let historyBuffer = { train: [], val: [] };
      if (task.loss_history) {
        try {
          historyBuffer = JSON.parse(task.loss_history);
        } catch(e) { console.error('History parse error', e); }
      }

      setProgressData({
        progress: task.progress || 0,
        current_epoch: task.current_epoch || 0,
        total_epochs: task.total_epochs || 0,
        current_loss: task.current_loss,
        eta: task.eta || '--:--',
        loss_history: historyBuffer
      });
    }
  }, [activeTaskId, tasks]);

  // WebSocket 实时进度订阅
  useEffect(() => {
    if (!activeTaskId || !user) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const task = tasks.find(t => t.id === activeTaskId);
    if (!task || (task.status !== 'running' && task.status !== 'pending')) {
      if (wsRef.current) wsRef.current.close();
      return;
    }

    // 清理旧连接
    if (wsRef.current) wsRef.current.close();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/api/ws/training/${activeTaskId}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'training_update') {
          // 如果后端传回了 loss_history，解析它
          if (msg.data && msg.data.loss_history) {
             setProgressData(msg.data);
          } else {
             setProgressData(prev => ({...prev, ...msg.data}));
          }
        } else if (msg.type === 'status_update') {
          loadTasks();
        }
      } catch (e) {
        console.error('WS parse error', e);
      }
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [activeTaskId, user, tasks, loadTasks]);

  // 暴露给外部的值
  const value = {
    tasks,
    setTasks,
    activeTaskId,
    setActiveTaskId,
    progressData,
    setProgressData,
    logs,
    setLogs,
    loadTasks
  };

  return (
    <TrainingContext.Provider value={value}>
      {children}
    </TrainingContext.Provider>
  );
};
