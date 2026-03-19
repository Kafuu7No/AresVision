import C from '../../constants/colors';
import ChartPlaceholder from '../../components/ChartPlaceholder';

export const CONTEXT_ITEMS = [
  { label: 'Mars Year', value: 'MY 27' },
  { label: 'Ls Range', value: '90° – 180°' },
  { label: 'Model', value: 'PredRNNv2' },
  { label: 'Horizon', value: '+3 steps' },
  { label: 'Variables', value: 'Full (7ch)' },
];

export function ChatMessage({ msg, i }) {
  return (
    <div key={i} style={{
      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
      maxWidth: '80%',
      padding: '12px 16px',
      borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
      background: msg.role === 'user'
        ? `linear-gradient(135deg, ${C.mars}, ${C.marsLight})`
        : 'rgba(255,255,255,0.04)',
      border: msg.role === 'user' ? 'none' : `1px solid ${C.border}`,
      fontSize: 13, lineHeight: 1.7, color: C.ice, whiteSpace: 'pre-wrap',
    }}>
      {msg.content}
    </div>
  );
}

export function SidebarContext({ t }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Context */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        padding: 20,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, marginBottom: 12 }}>
          {t('ai.contextTitle')}
        </div>
        {CONTEXT_ITEMS.map((item, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12,
          }}>
            <span style={{ color: C.ice30 }}>{item.label}</span>
            <span style={{ color: C.ice, fontWeight: 600 }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function QuickQuestions({ t, questions, onSelect }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      borderRadius: 12,
      border: `1px solid ${C.border}`,
      padding: 20,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, marginBottom: 12 }}>
        {t('ai.quickTitle')}
      </div>
      {Array.isArray(questions) && questions.map((q, i) => (
        <button
          key={i}
          onClick={() => onSelect(q)}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '10px 12px', marginBottom: 6,
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${C.border}`, borderRadius: 8,
            fontSize: 12, color: C.ice60, cursor: 'pointer',
            transition: 'all 0.2s', fontFamily: "'Exo 2', sans-serif",
          }}
        >
          → {q}
        </button>
      ))}
    </div>
  );
}

export function ErrorChart({ t }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      borderRadius: 12,
      border: `1px solid ${C.border}`,
      padding: 16,
    }}>
      <ChartPlaceholder title={t('ai.errorChart')} type="heatmap" h={160} />
    </div>
  );
}
