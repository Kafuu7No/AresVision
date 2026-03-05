import { useState } from 'react';
import C from '../constants/colors';
import SectionTitle from '../components/SectionTitle';
import GlowCard from '../components/GlowCard';
import ChartPlaceholder from '../components/ChartPlaceholder';

const CONTEXT_ITEMS = [
  { label: 'Mars Year', value: 'MY 27' },
  { label: 'Ls Range', value: '90° – 180°' },
  { label: 'Model', value: 'PredRNNv2' },
  { label: 'Horizon', value: '+3 steps' },
  { label: 'Variables', value: 'Full (7ch)' },
];

const QUICK_QUESTIONS = [
  '预测偏差最大的区域在哪？',
  '沙尘暴如何影响臭氧？',
  '为什么极地臭氧有季节峰值？',
  '模型在哪些季节表现最差？',
  '昼夜变化规律是什么？',
];

const WELCOME_MSG = {
  role: 'assistant',
  content:
    '你好！我是 AresVision AI 助手，可以帮你解读火星臭氧预测结果。\n\n你可以问我：\n• 当前预测场中，哪些区域臭氧偏差最大？\n• 为什么极地在 Ls=200° 附近出现臭氧峰值？\n• 沙尘暴对臭氧分布有什么影响？',
};

const DEMO_REPLY = {
  role: 'assistant',
  content:
    '基于当前 PredRNNv2 模型在 Ls=90°–180° 的预测结果分析：\n\n🔍 关键发现：北极区域（60°N–90°N）在 Ls≈120° 附近臭氧柱浓度预测值偏高约 12%，这可能与模型对北半球夏季光化学反应速率的过估计有关。\n\n建议关注沙尘光学厚度（DOD）的影响——消融实验表明，移除 DOD 后该区域预测误差增加 23%，说明沙尘是该区域臭氧预测的关键驱动因子。',
};

export default function AIPage() {
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', content: input }]);
    setInput('');
    // Simulated AI reply
    setTimeout(() => {
      setMessages((prev) => [...prev, DEMO_REPLY]);
    }, 1200);
  };

  return (
    <div className="page-enter" style={{ padding: '100px 40px 60px', maxWidth: 1000, margin: '0 auto' }}>
      <SectionTitle title="AI 智能解读" subtitle="AI-POWERED INSIGHT" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* ─── Chat Panel ─── */}
        <GlowCard style={{ padding: 0, display: 'flex', flexDirection: 'column', height: 600 }}>
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: `1px solid ${C.border}`,
              fontSize: 12,
              fontWeight: 700,
              color: C.ice60,
              fontFamily: "'Orbitron', sans-serif",
              letterSpacing: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4acfac', boxShadow: '0 0 8px #4acfac' }} />
            CHAT — 智能问答
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  padding: '12px 16px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background:
                    msg.role === 'user'
                      ? `linear-gradient(135deg, ${C.mars}, ${C.marsLight})`
                      : 'rgba(255,255,255,0.04)',
                  border: msg.role === 'user' ? 'none' : `1px solid ${C.border}`,
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: C.ice,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.content}
              </div>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="输入你的问题..."
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: '10px 16px',
                color: C.ice,
                fontSize: 13,
                fontFamily: "'Exo 2', sans-serif",
                outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              style={{
                background: `linear-gradient(135deg, ${C.mars}, ${C.marsLight})`,
                border: 'none',
                borderRadius: 10,
                padding: '10px 20px',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Orbitron', sans-serif",
              }}
            >
              发送
            </button>
          </div>
        </GlowCard>

        {/* ─── Right Sidebar ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Context */}
          <GlowCard style={{ padding: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, marginBottom: 12 }}>
              当前分析上下文
            </div>
            {CONTEXT_ITEMS.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: 12,
                }}
              >
                <span style={{ color: C.ice30 }}>{item.label}</span>
                <span style={{ color: C.ice, fontWeight: 600 }}>{item.value}</span>
              </div>
            ))}
          </GlowCard>

          {/* Quick Questions */}
          <GlowCard style={{ padding: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, marginBottom: 12 }}>
              快捷问题
            </div>
            {QUICK_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => setInput(q)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  marginBottom: 6,
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: C.ice60,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: "'Exo 2', sans-serif",
                }}
              >
                → {q}
              </button>
            ))}
          </GlowCard>

          {/* Mini chart */}
          <GlowCard style={{ padding: 16 }}>
            <ChartPlaceholder title="实时预测误差分布" type="heatmap" h={160} />
          </GlowCard>
        </div>
      </div>
    </div>
  );
}
