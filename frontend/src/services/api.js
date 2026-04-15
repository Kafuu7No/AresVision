/**
 * AresVision API 请求封装
 * Vite proxy: 前端 /api/* → localhost:8000/api/*
 */

const BASE = '/api';

// ─── 认证工具 ───

/** 从 localStorage 读取 token，自动附加到请求头 */
async function authedFetch(url, options = {}) {
  const token = localStorage.getItem('aresvision_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    // token 过期或无效，清除本地状态，触发全局事件让 AuthContext 响应
    localStorage.removeItem('aresvision_token');
    window.dispatchEvent(new Event('aresvision:logout'));
  }
  return res;
}

// ─── 认证接口 ───

export async function apiLogin(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function apiRegister(email, username, password, verificationCode) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password, verification_code: verificationCode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function apiSendCode(email, purpose = 'register') {
  const res = await fetch(`${BASE}/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, purpose }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function apiResetPassword(email, verificationCode, newPassword) {
  const res = await fetch(`${BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, verification_code: verificationCode, new_password: newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function apiGetMe() {
  const res = await authedFetch(`${BASE}/auth/me`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function apiChangePassword(oldPassword, newPassword) {
  const res = await authedFetch(`${BASE}/auth/change-password`, {
    method: 'PUT',
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function fetchGlobeData(marsYear = 27, ls = 10, variableOrSignal = 'o3col', maybeSignal = null) {
  const variable = typeof variableOrSignal === 'string' ? variableOrSignal : 'o3col';
  const signal = typeof variableOrSignal === 'string' ? maybeSignal : variableOrSignal;
  const opts = signal ? { signal } : {};
  const res = await fetch(`${BASE}/explore/globe?my=${marsYear}&ls=${ls}&variable=${encodeURIComponent(variable)}`, opts);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchSeasonalHeatmap(marsYear = 27) {
  const res = await fetch(`${BASE}/explore/seasonal-heatmap?my=${marsYear}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchSeasonalBands(marsYear = 27) {
  const res = await fetch(`${BASE}/explore/seasonal-bands?my=${marsYear}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchEnvHeatmap(marsYear = 27, variable) {
  const res = await fetch(`${BASE}/explore/env-heatmap?my=${marsYear}&variable=${variable}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchCorrelation(marsYear = 27) {
  const res = await fetch(`${BASE}/explore/correlation?my=${marsYear}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchDataInfo() {
  const res = await fetch(`${BASE}/explore/info`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchCouplingData(marsYear = 27, var1 = 'o3col', var2 = 'Dust_Optical_Depth') {
  const res = await fetch(`${BASE}/explore/coupling?my=${marsYear}&var1=${var1}&var2=${var2}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchZonalAnomaly(marsYear = 27, variable = 'o3col') {
  const res = await fetch(`${BASE}/explore/zonal-anomaly?my=${marsYear}&variable=${variable}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchSolarPhotochemical(marsYear = 27, latBand = 'Equatorial (30S-30N)') {
  const res = await fetch(`${BASE}/explore/solar-photochemical?my=${marsYear}&lat_band=${encodeURIComponent(latBand)}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchPolarDynamics(marsYear = 27) {
  const res = await fetch(`${BASE}/explore/polar-dynamics?my=${marsYear}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchResearchSuite(marsYear = 27) {
  const res = await fetch(`${BASE}/explore/research-suite?my=${marsYear}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchPhaseSpace(marsYear = 27, driver = 'Dust_Optical_Depth') {
  const res = await fetch(`${BASE}/explore/phase-space?my=${marsYear}&driver=${encodeURIComponent(driver)}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function runPrediction(body) {
  const res = await fetch(`${BASE}/predict/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchPredictMetrics(body) {
  const res = await fetch(`${BASE}/predict/metrics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchPerformanceCurve(body) {
  const res = await fetch(`${BASE}/predict/performance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchPerformanceComparison(configs) {
  const res = await fetch(`${BASE}/predict/performance-compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ configs }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchAblation(marsYear = 27, ls = 90) {
  const res = await fetch(`${BASE}/predict/ablation?my=${marsYear}&ls=${ls}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchDiurnal(marsYear = 27, ls = 90, latBand = 'Equatorial (30S-30N)') {
  const res = await fetch(`${BASE}/predict/diurnal?my=${marsYear}&ls=${ls}&lat_band=${encodeURIComponent(latBand)}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchShapleyValues(metric = 'r2') {
  const res = await fetch(`${BASE}/predict/shapley?metric=${metric}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchShapleyGlobal() {
  const res = await fetch(`${BASE}/predict/shapley-global`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchErrorDistribution(vars = []) {
  const varsStr = vars.length > 0 ? vars.join(',') : 'Temperature,Dust_Optical_Depth,Solar_Flux_DN,U_Wind,V_Wind';
  const res = await fetch(`${BASE}/predict/error-distribution?vars=${encodeURIComponent(varsStr)}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchPermutationImportance(vars = []) {
  const varsStr = vars.length > 0 ? vars.join(',') : 'Temperature,Dust_Optical_Depth,Solar_Flux_DN,U_Wind,V_Wind';
  const res = await fetch(`${BASE}/predict/permutation-importance?vars=${encodeURIComponent(varsStr)}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
// ─── 上传接口 ───

export async function getMyUploads() {
  const res = await authedFetch(`${BASE}/upload/my-uploads`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function deleteUpload(uploadId) {
  const res = await authedFetch(`${BASE}/upload/${uploadId}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function contributeUpload(uploadId, description = '') {
  const res = await authedFetch(`${BASE}/upload/${uploadId}/contribute`, {
    method: 'POST',
    body: JSON.stringify({ description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function getPendingReviews() {
  const res = await authedFetch(`${BASE}/upload/pending-reviews`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function reviewUpload(uploadId, action, reason = '') {
  const res = await authedFetch(`${BASE}/upload/${uploadId}/review`, {
    method: 'POST',
    body: JSON.stringify({ action, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function getApprovedDatasets() {
  const res = await authedFetch(`${BASE}/upload/approved-datasets`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function revokeDataset(uploadId) {
  const res = await authedFetch(`${BASE}/upload/${uploadId}/revoke`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function getNotifications() {
  const res = await authedFetch(`${BASE}/notification/list`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function getUnreadCount() {
  const res = await authedFetch(`${BASE}/notification/unread-count`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function markNotificationRead(id) {
  const res = await authedFetch(`${BASE}/notification/mark-read/${id}`, { method: 'POST' });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function markAllNotificationsRead() {
  const res = await authedFetch(`${BASE}/notification/mark-all-read`, { method: 'POST' });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ─── 反馈接口 ───

export async function submitFeedback(formData) {
  const token = localStorage.getItem('aresvision_token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/feedback/submit`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function getFeedbackList(status = '') {
  const url = status ? `${BASE}/feedback/list?status=${encodeURIComponent(status)}` : `${BASE}/feedback/list`;
  const res = await authedFetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function getFeedbackCount() {
  const res = await authedFetch(`${BASE}/feedback/count`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function resolveFeedback(feedbackId) {
  const res = await authedFetch(`${BASE}/feedback/${feedbackId}/resolve`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

// ─── 用户数据分析接口 ───

export async function fetchUserDataSummary(uploadId) {
  const res = await authedFetch(`${BASE}/user-data/summary/${uploadId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function fetchUserGlobeData(uploadId, ls = 10) {
  const res = await authedFetch(`${BASE}/user-data/globe/${uploadId}?ls=${ls}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function fetchUserHeatmap(uploadId, variable = 'o3col') {
  const res = await authedFetch(`${BASE}/user-data/seasonal-heatmap/${uploadId}?variable=${encodeURIComponent(variable)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function fetchUserBands(uploadId) {
  const res = await authedFetch(`${BASE}/user-data/seasonal-bands/${uploadId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function aiChat(question, context = null, history = null) {
  const payload = { question, context };
  if (Array.isArray(history) && history.length > 0) {
    payload.history = history;
  }
  const res = await fetch(`${BASE}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ─── 模型训练接口 ───

export async function copilotChat(question, context = null, history = null) {
  const payload = { question, context };
  if (Array.isArray(history) && history.length > 0) {
    payload.history = history;
  }
  const res = await fetch(`${BASE}/copilot/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchScripts() {
  const res = await authedFetch(`${BASE}/training/scripts`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function startTrainingTask(model_script, hyperparameters, model_name = null) {
  const res = await authedFetch(`${BASE}/training/start`, {
    method: 'POST',
    body: JSON.stringify({ model_script, hyperparameters, model_name }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function fetchTasks() {
  const res = await authedFetch(`${BASE}/training/tasks`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function fetchLogs(taskId) {
  const res = await authedFetch(`${BASE}/training/tasks/${taskId}/logs`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function stopTrainingTask(taskId) {
  const res = await authedFetch(`${BASE}/training/tasks/${taskId}/stop`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function deleteTrainingTask(taskId) {
  const res = await authedFetch(`${BASE}/training/tasks/${taskId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function performTaskAction(taskId, action) {
  const res = await authedFetch(`${BASE}/training/tasks/${taskId}/action?action=${encodeURIComponent(action)}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

