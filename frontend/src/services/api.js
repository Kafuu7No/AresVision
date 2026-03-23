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

export async function apiRegister(email, username, password) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password }),
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

export async function fetchGlobeData(marsYear = 27, ls = 10, signal = null) {
  const opts = signal ? { signal } : {};
  const res = await fetch(`${BASE}/explore/globe?my=${marsYear}&ls=${ls}`, opts);
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

export async function fetchErrorDistribution(vars = []) {
  const varsStr = vars.length > 0 ? vars.join(',') : 'Temperature,Dust_Optical_Depth,Solar_Flux_DN,U_Wind,V_Wind';
  const res = await fetch(`${BASE}/predict/error-distribution?vars=${encodeURIComponent(varsStr)}`);
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

export async function aiChat(question, context = null) {
  const res = await fetch(`${BASE}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
