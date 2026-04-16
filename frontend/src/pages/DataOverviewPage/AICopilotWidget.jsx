import React, { useEffect, useMemo, useState } from 'react';
import C from '../../constants/colors';
import { useDataOverview } from '../../contexts/DataOverviewContext';
import { copilotChat } from '../../services/api';

const CARD_TITLES = {
  realtime: '昼夜变化',
  seasonal: '季节交替',
  seasonalExtremes: '季节极值',
  globalTrend: '全局趋势',
  correlation: '点位相关性',
  environment: '多因子环境',
  solarsens: '光化学辐射',
  coupling: '沙尘冲刷',
  polar: '极点聚集',
  wave: '行星波异常',
  waveDiag: '波动诊断',
  distribution: '点位分布',
};

function briefValue(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NaN';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const preview = value.slice(0, 3).map((item) => {
      if (item && typeof item === 'object') return JSON.stringify(item);
      return briefValue(item);
    }).join('; ');
    return `[${preview}${value.length > 3 ? '; ...' : ''}] (n=${value.length})`;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function flattenSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return '';
  const lines = [];
  const MAX_LINES = 100;
  const walk = (node, path = '') => {
    if (lines.length >= MAX_LINES) return;
    if (node === null || node === undefined || typeof node !== 'object' || Array.isArray(node)) {
      lines.push(`${path}: ${briefValue(node)}`);
      return;
    }
    const entries = Object.entries(node);
    if (!entries.length) {
      lines.push(`${path}: {}`);
      return;
    }
    entries.forEach(([key, value]) => {
      if (lines.length >= MAX_LINES) return;
      walk(value, path ? `${path}.${key}` : key);
    });
  };
  walk(snapshot);
  return lines.join('\n');
}

function normalizeAiText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^\s*最终回答正文[:：]\s*/gm, '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*---+\s*$/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`{1,3}/g, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compactAnswer(text, maxChars = 220) {
  const input = (text || '').trim();
  if (!input) return input;
  if (input.length <= maxChars) return input;

  const sentences = input
    .split(/(?<=[。！？.!?])/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!sentences.length) return `${input.slice(0, maxChars)}...`;

  let merged = '';
  for (const sentence of sentences) {
    const next = merged ? `${merged}${sentence}` : sentence;
    if (next.length > maxChars) break;
    merged = next;
    if (merged.length >= Math.floor(maxChars * 0.7)) break;
  }

  if (!merged) merged = input.slice(0, maxChars);
  return `${merged}${merged.length < input.length ? '...' : ''}`;
}

export default function AICopilotWidget() {
  const {
    globalTimeLs,
    setActiveAnalysisMode,
    activeAnalysisMode,
    leftPanelWidth,
    rightPanelWidth,
    marsYear,
    selectedCoordinate,
    expandedCard,
    selectedVariables,
    globeVariable,
    getAiInsight,
  } = useDataOverview();
  const bubbleWidth = `clamp(300px, calc(100vw - ${leftPanelWidth + rightPanelWidth + 220}px), 420px)`;

  const [showBubble, setShowBubble] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [hasResult, setHasResult] = useState(false);

  useEffect(() => {
    if (globalTimeLs >= 240 && globalTimeLs <= 270 && !hasTriggered) {
      setShowBubble(true);
      setPulse(true);
      setHasTriggered(true);
    }
  }, [globalTimeLs, hasTriggered]);

  const selectedCardTitle = useMemo(
    () => CARD_TITLES[expandedCard] || expandedCard || '未命名图表',
    [expandedCard],
  );

  const handleAction = () => {
    setActiveAnalysisMode('dynamics');
    setShowBubble(false);
    setPulse(false);
  };

  const handleAIChat = async () => {
    setIsAnalyzing(true);
    setAiResponse('');
    setHasResult(false);
    try {
      const snapshot = expandedCard ? getAiInsight(expandedCard) : null;
      const snapshotText = flattenSnapshot(snapshot);
      const dynamicMetrics = snapshotText || '当前图表尚未返回可解读数据，可能仍在加载。';
      const context = {
        mars_year: marsYear,
        ls_range: [globalTimeLs, globalTimeLs],
        selected_variables: Array.from(new Set([globeVariable, ...(selectedVariables || [])])),
        active_mode: activeAnalysisMode,
        expanded_card: expandedCard,
        expanded_card_title: selectedCardTitle,
        coordinate: selectedCoordinate,
        card_snapshot: snapshot || null,
        dynamic_metrics: dynamicMetrics,
      };

      const question = `请基于“当前右侧展开图表”的实时数据快照进行解读。
图表名称：${selectedCardTitle}（card=${expandedCard || 'none'}）
要求：
1. 你的目标是帮助用户“快速看懂这张图表在干什么”，不是写长报告。
2. 只输出 2-3 句中文，总长度控制在 80-160 字。
3. 至少包含：图表用途 + 1个关键变量关系或现象（有数值就带数值）。
4. 如果 status=loading 或 empty，只需一句提示“数据未就绪”并给1条操作建议。
5. 不要使用 Markdown 标题符号（如 ###）与分隔线（如 ---）。`;

      const res = await copilotChat(question, context);
      const rawAnswer = typeof res?.answer === 'string' ? res.answer : String(res?.answer ?? '');
      let normalizedAnswer = normalizeAiText(rawAnswer);
      if (!normalizedAnswer && rawAnswer.trim()) {
        normalizedAnswer = rawAnswer.trim();
      }

      if (normalizedAnswer.length > 0 && normalizedAnswer.length < 40) {
        const retryQuestion = `${question}\n请按“短摘要模式”重写：2-3句，80-160字。`;
        const retryRes = await copilotChat(retryQuestion, context);
        const retryNormalized = normalizeAiText(retryRes?.answer);
        if (retryNormalized.length > normalizedAnswer.length) {
          normalizedAnswer = retryNormalized;
        }
      }

      setAiResponse(compactAnswer(normalizedAnswer || '本次解读未返回有效文本，请重试一次。'));
      setHasResult(true);
    } catch (error) {
      setAiResponse(`AI 解读请求失败：${error.message}`);
      setHasResult(true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClose = (event) => {
    event.stopPropagation();
    setShowBubble(false);
    setPulse(false);
    setTimeout(() => {
      setAiResponse('');
      setHasResult(false);
    }, 500);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '100px',
        right: `${rightPanelWidth + 40}px`,
        zIndex: 2500,
        display: 'flex',
        alignItems: 'flex-end',
        gap: '16px',
        transition: 'none',
      }}
    >
      {showBubble && (
        <div
          style={{
            width: bubbleWidth,
            background: 'rgba(10, 14, 23, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${C.blue}`,
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 8px 32px rgba(74, 158, 255, 0.2), inset 0 0 10px rgba(74, 158, 255, 0.1)',
            position: 'relative',
            animation: 'fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            onClick={handleClose}
            style={{ position: 'absolute', top: '10px', right: '14px', color: C.ice30, cursor: 'pointer', fontSize: '14px', padding: '4px' }}
          >
            ✕
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '20px' }}>🧠</span>
            <span style={{ color: C.blue, fontFamily: "'Orbitron', sans-serif", fontSize: '14px', fontWeight: 'bold' }}>
              Ares Copilot
            </span>
            {hasResult && !isAnalyzing && (
              <span style={{ color: C.ice, fontSize: '10px', background: 'rgba(255, 255, 255, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                已完成解读
              </span>
            )}
          </div>

          <div
            style={{
              color: C.ice80,
              fontSize: '12px',
              fontFamily: "'Exo 2', sans-serif",
              lineHeight: 1.6,
              marginBottom: '16px',
              maxHeight: '300px',
              overflowY: 'auto',
              paddingRight: '8px',
            }}
          >
            {!hasResult && !isAnalyzing ? (
              <div style={{ marginBottom: 12 }}>
                当前目标图表：<span style={{ color: C.blue }}>{selectedCardTitle}</span>
                <br />
                我会读取这张图表当前控件状态与数据快照，再给出面向科研分析的中文解读。
              </div>
            ) : null}

            {isAnalyzing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: C.blue, height: '40px' }}>
                <span className="copilot-dot-pulse">正在基于当前图表数据进行推理...</span>
              </div>
            ) : null}

            {hasResult && !isAnalyzing ? (
              <div style={{ color: C.ice, background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', borderLeft: `3px solid ${C.blue}` }}>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {aiResponse}
                </div>
              </div>
            ) : null}
          </div>

          {!hasResult && !isAnalyzing && (
            <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
              <button
                onClick={handleAIChat}
                style={{
                  padding: '10px',
                  background: 'transparent',
                  border: `1px solid ${C.blue}`,
                  borderRadius: '6px',
                  color: C.blue,
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: '0.3s',
                }}
                onMouseEnter={(event) => { event.currentTarget.style.background = 'rgba(74, 158, 255, 0.1)'; }}
                onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent'; }}
              >
                AI 解读当前图表
              </button>

              <button
                onClick={handleAction}
                style={{
                  padding: '10px',
                  background: `linear-gradient(135deg, ${C.mars}, #ff8e53)`,
                  border: 'none',
                  borderRadius: '6px',
                  color: '#000',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 0 12px rgba(199,91,57,0.4)',
                }}
              >
                调取极端环境耦合分析
              </button>
            </div>
          )}
        </div>
      )}

      <div
        onClick={() => { setShowBubble((value) => !value); setPulse(false); }}
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'rgba(10, 14, 23, 0.8)',
          border: `2px solid ${C.blue}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: pulse ? '0 0 0 0 rgba(74, 158, 255, 0.7)' : '0 4px 12px rgba(0,0,0,0.5)',
          animation: pulse ? 'pulseBlue 2s infinite' : 'none',
          backdropFilter: 'blur(10px)',
          fontSize: '24px',
        }}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @keyframes pulseBlue {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 158, 255, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 15px rgba(74, 158, 255, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 158, 255, 0); }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .copilot-dot-pulse {
            animation: blink 1.5s infinite;
          }
          @keyframes blink { 0% { opacity: 0.2; } 50% { opacity: 1; } 100% { opacity: 0.2; } }
        `,
          }}
        />
        🧠
      </div>
    </div>
  );
}
