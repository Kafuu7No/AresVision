import { useState } from 'react';
import C from '../constants/colors';
import { useT } from '../i18n';
import SectionTitle from '../components/SectionTitle';
import GlowCard from '../components/GlowCard';
import {
  ChatMessage,
  SidebarContext,
  QuickQuestions,
  ErrorChart,
} from './AIPage/AIComponents';

export default function AIPage() {
  const t = useT();

  const quickQuestions = t('ai.quickQuestions');

  const WELCOME_MSG = { role: 'assistant', content: t('ai.welcome') };
  const DEMO_REPLY = {
    role: 'assistant',
    content:
      '基于当前 PredRNNv2 模型在 Ls=90°–180° 的预测结果分析：\n\n🔍 关键发现：北极区域（60°N–90°N）在 Ls≈120° 附近臭氧柱浓度预测值偏高约 12%，这可能与模型对北半球夏季光化学反应速率的过估计有关。\n\n建议关注沙尘光学厚度（DOD）的影响——消融实验表明，移除 DOD 后该区域预测误差增加 23%，说明沙尘是该区域臭氧预测的关键驱动因子。',
  };

  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', content: input }]);
    setInput('');
    setTimeout(() => {
      setMessages((prev) => [...prev, DEMO_REPLY]);
    }, 1200);
  };

  return (
    <div className="page-enter" style={{ padding: '100px 40px 60px', maxWidth: 1000, margin: '0 auto' }}>
      <SectionTitle title={t('ai.title')} subtitle={t('ai.subtitle')} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* ─── Chat Panel ─── */}
        <GlowCard style={{ padding: 0, display: 'flex', flexDirection: 'column', height: 600 }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${C.border}`,
            fontSize: 12, fontWeight: 700, color: C.ice60,
            fontFamily: "'Orbitron', sans-serif", letterSpacing: 2,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4acfac', boxShadow: '0 0 8px #4acfac' }} />
            {t('ai.chatHeader')}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((msg, i) => (
              <ChatMessage key={i} msg={msg} i={i} />
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={t('ai.placeholder')}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: '10px 16px',
                color: C.ice, fontSize: 13,
                fontFamily: "'Exo 2', sans-serif", outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              style={{
                background: `linear-gradient(135deg, ${C.mars}, ${C.marsLight})`,
                border: 'none', borderRadius: 10,
                padding: '10px 20px', color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Orbitron', sans-serif",
              }}
            >
              {t('ai.send')}
            </button>
          </div>
        </GlowCard>

        {/* ─── Right Sidebar ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SidebarContext t={t} />
          <QuickQuestions t={t} questions={quickQuestions} onSelect={setInput} />
          <ErrorChart t={t} />
        </div>
      </div>
    </div>
  );
}
