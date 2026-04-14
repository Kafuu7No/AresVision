import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { fetchTasks, fetchLogs } from '../services/api';
import { useAuth } from './AuthContext';

const TrainingContext = createContext();

export const useTraining = () => useContext(TrainingContext);

export const TrainingProvider = ({ children, enabled = true }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [logs, setLogs] = useState([]);

  const wsRef = useRef(null);
  const pollingRef = useRef(null);
  const logPollingRef = useRef(null);

  const clearTaskPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const clearLogPolling = useCallback(() => {
    if (logPollingRef.current) {
      clearInterval(logPollingRef.current);
      logPollingRef.current = null;
    }
  }, []);

  const closeWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const loadTasks = useCallback(async () => {
    if (!enabled || !user) return;
    try {
      const data = await fetchTasks();
      setTasks(data);

      if (!activeTaskId) {
        const runningTask = data.find((tk) => tk.status === 'running' || tk.status === 'pending');
        if (runningTask) {
          setActiveTaskId(runningTask.id);
        }
      }
    } catch (err) {
      console.error('Failed to load tasks', err);
    }
  }, [enabled, user, activeTaskId]);

  // Poll training task list only when provider is enabled.
  useEffect(() => {
    clearTaskPolling();

    if (enabled && user) {
      loadTasks();
      pollingRef.current = setInterval(loadTasks, 5000);
    } else if (!user) {
      setTasks([]);
      setActiveTaskId(null);
      setProgressData(null);
      setLogs([]);
    }

    return () => clearTaskPolling();
  }, [enabled, user, loadTasks, clearTaskPolling]);

  // Poll logs only when enabled and task is selected.
  useEffect(() => {
    clearLogPolling();

    if (!enabled || !activeTaskId || !user) {
      setLogs([]);
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

    return () => clearLogPolling();
  }, [enabled, activeTaskId, user, clearLogPolling]);

  // Sync progressData from active task row.
  useEffect(() => {
    const task = tasks.find((t) => t.id === activeTaskId);
    if (!task) return;

    let historyBuffer = { train: [], val: [] };
    if (task.loss_history) {
      try {
        historyBuffer = JSON.parse(task.loss_history);
      } catch (e) {
        console.error('History parse error', e);
      }
    }

    setProgressData({
      progress: task.progress || 0,
      current_epoch: task.current_epoch || 0,
      total_epochs: task.total_epochs || 0,
      current_loss: task.current_loss,
      eta: task.eta || '--:--',
      loss_history: historyBuffer,
    });
  }, [activeTaskId, tasks]);

  // WebSocket live updates only when enabled and task is running.
  useEffect(() => {
    if (!enabled || !activeTaskId || !user) {
      closeWs();
      return;
    }

    const task = tasks.find((t) => t.id === activeTaskId);
    if (!task || (task.status !== 'running' && task.status !== 'pending')) {
      closeWs();
      return;
    }

    closeWs();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/api/ws/training/${activeTaskId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'training_update') {
          if (msg.data && msg.data.loss_history) {
            setProgressData(msg.data);
          } else {
            setProgressData((prev) => ({ ...prev, ...msg.data }));
          }
        } else if (msg.type === 'status_update') {
          loadTasks();
        }
      } catch (e) {
        console.error('WS parse error', e);
      }
    };

    return () => closeWs();
  }, [enabled, activeTaskId, user, tasks, loadTasks, closeWs]);

  const value = {
    tasks,
    setTasks,
    activeTaskId,
    setActiveTaskId,
    progressData,
    setProgressData,
    logs,
    setLogs,
    loadTasks,
  };

  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>;
};
