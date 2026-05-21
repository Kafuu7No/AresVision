import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import C from '../constants/colors';
import { useT } from '../i18n';
import SectionTitle from '../components/SectionTitle';
import GlowCard from '../components/GlowCard';
import { aiChat } from '../services/api';
import { getPredictCache } from '../stores/predictCache';
import { ChatMessage, SidebarContext, QuickQuestions, ErrorSummary } from './AIPage/AIComponents';

const LATITUDE_BANDS_FOR_SUMMARY = [
  { id: 'north_polar', label: '60N~90N', min: 60, max: 90 },
  { id: 'north_mid', label: '30N~60N', min: 30, max: 60 },
  { id: 'equatorial', label: '30S~30N', min: -30, max: 30 },
  { id: 'south_mid', label: '60S~30S', min: -60, max: -30 },
  { id: 'south_polar', label: '90S~60S', min: -90, max: -60 },
];

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function roundTo(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function normalizeLongitude(lng) {
  if (!Number.isFinite(lng)) return null;
  if (lng > 180) return lng - 360;
  if (lng < -180) return lng + 360;
  return lng;
}

function pickLatitudeBand(lat) {
  return LATITUDE_BANDS_FOR_SUMMARY.find((band) => lat >= band.min && lat <= band.max) || null;
}

function buildSpatialErrorSummary(snapshot, options = {}) {
  const { topK = 6, gridSizeDeg = 20 } = options;
  const residualSteps = snapshot?.results?.residual;
  const lsValues = Array.isArray(snapshot?.results?.ls_values) ? snapshot.results.ls_values : [];

  if (!Array.isArray(residualSteps) || residualSteps.length === 0) return null;

  const topCandidates = [];
  const stepAgg = new Map();
  const latBandAgg = new Map();
  const cellAgg = new Map();
  let totalPoints = 0;

  residualSteps.forEach((stepData, stepIndex) => {
    const points = stepData?.points;
    if (!Array.isArray(points) || points.length === 0) return;

    points.forEach((point) => {
      const lat = toFiniteNumber(point?.lat);
      const lngRaw = toFiniteNumber(point?.lng);
      const err = toFiniteNumber(point?.val);
      if (lat === null || lngRaw === null || err === null) return;

      const lng = normalizeLongitude(lngRaw);
      if (lng === null) return;

      const absErr = Math.abs(err);
      totalPoints += 1;

      topCandidates.push({
        step: stepIndex,
        ls: toFiniteNumber(lsValues[stepIndex]),
        lat,
        lng,
        error: err,
        abs_error: absErr,
      });

      const stepKey = String(stepIndex);
      const stepItem = stepAgg.get(stepKey) || { step: stepIndex, ls: toFiniteNumber(lsValues[stepIndex]), sumAbs: 0, count: 0, maxAbs: 0 };
      stepItem.sumAbs += absErr;
      stepItem.count += 1;
      stepItem.maxAbs = Math.max(stepItem.maxAbs, absErr);
      stepAgg.set(stepKey, stepItem);

      const band = pickLatitudeBand(lat);
      if (band) {
        const bandItem = latBandAgg.get(band.id) || {
          id: band.id,
          label: band.label,
          sumAbs: 0,
          count: 0,
          maxAbs: 0,
        };
        bandItem.sumAbs += absErr;
        bandItem.count += 1;
        bandItem.maxAbs = Math.max(bandItem.maxAbs, absErr);
        latBandAgg.set(band.id, bandItem);
      }

      const latStart = Math.floor((lat + 90) / gridSizeDeg) * gridSizeDeg - 90;
      const latEnd = Math.min(90, latStart + gridSizeDeg);
      const lonStart = Math.floor((lng + 180) / gridSizeDeg) * gridSizeDeg - 180;
      const lonEnd = Math.min(180, lonStart + gridSizeDeg);
      const cellKey = `${latStart}_${lonStart}`;
      const cellItem = cellAgg.get(cellKey) || {
        lat_range: [latStart, latEnd],
        lon_range: [lonStart, lonEnd],
        sumAbs: 0,
        count: 0,
        maxAbs: 0,
      };
      cellItem.sumAbs += absErr;
      cellItem.count += 1;
      cellItem.maxAbs = Math.max(cellItem.maxAbs, absErr);
      cellAgg.set(cellKey, cellItem);
    });
  });

  if (!topCandidates.length) return null;

  const topBiasPoints = topCandidates
    .sort((a, b) => b.abs_error - a.abs_error)
    .slice(0, topK)
    .map((item) => ({
      step: item.step + 1,
      ls: roundTo(item.ls, 2),
      lat: roundTo(item.lat, 2),
      lng: roundTo(item.lng, 2),
      error: roundTo(item.error, 6),
      abs_error: roundTo(item.abs_error, 6),
    }));

  const latitudeBandSummary = Array.from(latBandAgg.values())
    .filter((item) => item.count > 0)
    .map((item) => ({
      label: item.label,
      mean_abs_error: roundTo(item.sumAbs / item.count, 6),
      max_abs_error: roundTo(item.maxAbs, 6),
      sample_count: item.count,
    }))
    .sort((a, b) => (b.mean_abs_error || 0) - (a.mean_abs_error || 0));

  const topBiasCells = Array.from(cellAgg.values())
    .filter((item) => item.count > 0)
    .map((item) => ({
      lat_range: item.lat_range,
      lon_range: item.lon_range,
      mean_abs_error: roundTo(item.sumAbs / item.count, 6),
      max_abs_error: roundTo(item.maxAbs, 6),
      sample_count: item.count,
    }))
    .sort((a, b) => (b.mean_abs_error || 0) - (a.mean_abs_error || 0))
    .slice(0, topK);

  const worstStep = Array.from(stepAgg.values())
    .filter((item) => item.count > 0)
    .map((item) => ({
      step: item.step + 1,
      ls: roundTo(item.ls, 2),
      mean_abs_error: roundTo(item.sumAbs / item.count, 6),
      max_abs_error: roundTo(item.maxAbs, 6),
    }))
    .sort((a, b) => (b.mean_abs_error || 0) - (a.mean_abs_error || 0))[0] || null;

  return {
    source: 'prediction_residual_snapshot',
    point_count: totalPoints,
    top_bias_points: topBiasPoints,
    top_bias_cells: topBiasCells,
    latitude_band_summary: latitudeBandSummary,
    worst_latitude_band: latitudeBandSummary[0] || null,
    worst_step: worstStep,
  };
}

function formatLsRange(snapshot) {
  const lsValues = snapshot?.results?.ls_values;
  if (Array.isArray(lsValues) && lsValues.length > 0) {
    const start = Number(lsValues[0]).toFixed(1);
    const end = Number(lsValues[lsValues.length - 1]).toFixed(1);
    return `${start}° - ${end}°`;
  }

  const lsStart = snapshot?.params?.lsStart;
  const horizon = snapshot?.params?.predStep;
  if (typeof lsStart === 'number' && typeof horizon === 'number') {
    const end = lsStart + Math.max(0, horizon - 1) * 5;
    return `${lsStart.toFixed(1)}° - ${end.toFixed(1)}°`;
  }

  return '--';
}

function formatNumber(v, digits = 4) {
  return Number.isFinite(v) ? Number(v).toFixed(digits) : '--';
}

function buildConversationHistory(messages) {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content }));
}

function normalizeAiText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeAiTextPlain(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^\s*```[\w-]*\s*$/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/\*\*|__|~~/g, '')
    .replace(/[*`]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildContextPayload(snapshot) {
  const params = snapshot?.params || {};
  const metrics = snapshot?.metrics?.overall || null;
  const selectedVars = params.selectedVars || snapshot?.results?.selected_variables || [];
  const errorDist = snapshot?.errorDistData || null;
  const spatialErrorSummary = buildSpatialErrorSummary(snapshot);
  const pfiTop3 = Array.isArray(snapshot?.pfiData?.items)
    ? snapshot.pfiData.items.slice(0, 3).map((it) => `${it.name}:${it.importance}`)
    : [];

  const dynamicMetrics = {
    error_distribution: errorDist
      ? {
          mae: errorDist.mae,
          rmse: errorDist.rmse,
          samples: Array.isArray(errorDist.scatter?.trues) ? errorDist.scatter.trues.length : 0,
        }
      : null,
    permutation_importance_top3: pfiTop3,
  };

  if (spatialErrorSummary) {
    dynamicMetrics.spatial_error_summary = spatialErrorSummary;
  }

  return {
    mars_year: params.marsYear ?? null,
    ls_range: formatLsRange(snapshot),
    selected_variables: selectedVars,
    metrics,
    model_name: snapshot?.results?.model_info?.model_name || 'PredRNNv2',
    horizon: params.predStep ?? snapshot?.results?.horizon ?? null,
    dynamic_metrics: dynamicMetrics,
  };
}

export default function AIPage() {
  const t = useT();
  const quickQuestions = t('ai.quickQuestions');

  const makeWelcome = useCallback(
    () => ({ id: `welcome-${Date.now()}`, role: 'assistant', content: t('ai.welcome') }),
    [t]
  );

  const [messages, setMessages] = useState([makeWelcome()]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [snapshot, setSnapshot] = useState(() => getPredictCache());

  const messageEndRef = useRef(null);

  const refreshContext = useCallback(() => {
    setSnapshot(getPredictCache());
  }, []);

  useEffect(() => {
    refreshContext();
    const onFocus = () => refreshContext();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshContext]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const contextReady = Boolean(snapshot?.results && snapshot?.params);
  const contextPayload = useMemo(() => buildContextPayload(snapshot), [snapshot]);

  const contextItems = useMemo(
    () => [
      { label: t('ai.ctxMarsYear'), value: contextPayload.mars_year ? `MY ${contextPayload.mars_year}` : '--' },
      { label: t('ai.ctxLsRange'), value: contextPayload.ls_range || '--' },
      { label: t('ai.ctxModel'), value: contextPayload.model_name || 'PredRNNv2' },
      { label: t('ai.ctxHorizon'), value: contextPayload.horizon ? `+${contextPayload.horizon}` : '--' },
      {
        label: t('ai.ctxVariables'),
        value: Array.isArray(contextPayload.selected_variables) && contextPayload.selected_variables.length > 0
          ? contextPayload.selected_variables.join(', ')
          : '--',
      },
      { label: t('ai.ctxOverallR2'), value: formatNumber(contextPayload.metrics?.r2, 4) },
      { label: t('ai.ctxRmse'), value: formatNumber(contextPayload.metrics?.rmse, 6) },
    ],
    [contextPayload, t]
  );

  const errorSummary = useMemo(() => {
    const errorDist = snapshot?.errorDistData;
    if (!errorDist) return null;
    const samples = Array.isArray(errorDist.scatter?.trues) ? errorDist.scatter.trues.length : 0;
    return {
      mae: formatNumber(errorDist.mae, 6),
      rmse: formatNumber(errorDist.rmse, 6),
      samples: String(samples),
    };
  }, [snapshot]);

  const replacePendingMessage = useCallback((pendingId, nextContent) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === pendingId
          ? { id: `assistant-${Date.now()}`, role: 'assistant', content: nextContent }
          : msg
      )
    );
  }, []);

  const sendQuestion = useCallback(
    async (questionRaw) => {
      const question = (questionRaw ?? input).trim();
      if (!question || sending) return;

      const pendingId = `pending-${Date.now()}`;
      const history = buildConversationHistory(messages);
      const userMsg = { id: `user-${Date.now()}`, role: 'user', content: question };

      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: pendingId, role: 'assistant', content: t('ai.sending') },
      ]);
      setInput('');
      setSending(true);

      const latestSnapshot = getPredictCache();
      setSnapshot(latestSnapshot);
      const context = buildContextPayload(latestSnapshot);

      try {
        const res = await aiChat(question, context, history);
        const answer = normalizeAiTextPlain(res?.answer) || t('ai.sendFailed');
        replacePendingMessage(pendingId, answer);
      } catch (err) {
        replacePendingMessage(
          pendingId,
          `${t('ai.sendFailed')}${err?.message ? `: ${err.message}` : ''}`
        );
      } finally {
        setSending(false);
        setSnapshot(getPredictCache());
      }
    },
    [input, messages, replacePendingMessage, sending, t]
  );

  const clearChat = useCallback(() => {
    setMessages([makeWelcome()]);
  }, [makeWelcome]);

  return (
    <div className="page-enter" style={{ padding: '100px 40px 60px', maxWidth: 1100, margin: '0 auto' }}>
      <SectionTitle title={t('ai.title')} subtitle={t('ai.subtitle')} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        <GlowCard style={{ padding: 0, display: 'flex', flexDirection: 'column', height: 640 }}>
          <div
            style={{
              padding: '14px 18px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                fontSize: 'calc(12px * var(--font-scale, 1))',
                fontWeight: 700,
                color: C.ice60,
                fontFamily: "'Orbitron', sans-serif",
                letterSpacing: 1.4,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: sending ? C.mars : '#4acfac',
                  boxShadow: sending ? `0 0 8px ${C.mars}` : '0 0 8px #4acfac',
                }}
              />
              {t('ai.chatHeader')}
            </div>

            <button
              onClick={clearChat}
              style={{
                border: `1px solid ${C.border}`,
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 8,
                color: C.ice60,
                fontSize: 'calc(11px * var(--font-scale, 1))',
                padding: '5px 10px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t('ai.clearChat')}
            </button>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {messages.map((msg) => (
              <ChatMessage key={msg.id} msg={msg} />
            ))}
            <div ref={messageEndRef} />
          </div>

          <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10 }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendQuestion();
                }
              }}
              placeholder={t('ai.placeholder')}
              rows={2}
              style={{
                flex: 1,
                resize: 'none',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: '10px 12px',
                color: C.ice,
                fontSize: 'calc(13px * var(--font-scale, 1))',
                fontFamily: "'Exo 2', sans-serif",
                outline: 'none',
              }}
            />
            <button
              disabled={sending}
              onClick={() => sendQuestion()}
              style={{
                background: `linear-gradient(135deg, ${C.mars}, ${C.marsLight})`,
                border: 'none',
                borderRadius: 10,
                padding: '10px 18px',
                color: '#fff',
                fontSize: 'calc(13px * var(--font-scale, 1))',
                fontWeight: 700,
                cursor: sending ? 'not-allowed' : 'pointer',
                opacity: sending ? 0.7 : 1,
                fontFamily: "'Orbitron', sans-serif",
              }}
            >
              {sending ? '...' : t('ai.send')}
            </button>
          </div>
        </GlowCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SidebarContext
            t={t}
            items={contextItems}
            contextReady={contextReady}
            onRefresh={refreshContext}
          />
          <QuickQuestions
            t={t}
            questions={quickQuestions}
            onAsk={sendQuestion}
            disabled={sending}
          />
          <ErrorSummary t={t} summary={errorSummary} />
        </div>
      </div>
    </div>
  );
}
