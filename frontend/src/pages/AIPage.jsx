import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import C from '../constants/colors';
import { useT } from '../i18n';
import SectionTitle from '../components/SectionTitle';
import GlowCard from '../components/GlowCard';
import { aiChat } from '../services/api';
import { getPredictCache } from '../stores/predictCache';
import { ChatMessage, SidebarContext, QuickQuestions, ErrorSummary } from './AIPage/AIComponents';

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
  const pfiTop3 = Array.isArray(snapshot?.pfiData?.items)
    ? snapshot.pfiData.items.slice(0, 3).map((it) => `${it.name}:${it.importance}`)
    : [];

  return {
    mars_year: params.marsYear ?? null,
    ls_range: formatLsRange(snapshot),
    selected_variables: selectedVars,
    metrics,
    model_name: snapshot?.results?.model_info?.model_name || 'PredRNNv2',
    horizon: params.predStep ?? snapshot?.results?.horizon ?? null,
    dynamic_metrics: {
      error_distribution: errorDist
        ? {
            mae: errorDist.mae,
            rmse: errorDist.rmse,
            samples: Array.isArray(errorDist.scatter?.trues) ? errorDist.scatter.trues.length : 0,
          }
        : null,
      permutation_importance_top3: pfiTop3,
    },
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
                fontSize: 12,
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
                fontSize: 11,
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
                fontSize: 13,
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
                fontSize: 13,
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
