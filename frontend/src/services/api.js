/**
 * AresVision API 请求封装
 * Vite proxy: 前端 /api/* → localhost:8000/api/*
 */

const BASE = '/api';

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

export async function aiChat(question, context = null) {
  const res = await fetch(`${BASE}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
