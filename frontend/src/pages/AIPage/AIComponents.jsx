import C from '../../constants/colors';

export function ChatMessage({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '84%',
        padding: '12px 16px',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isUser
          ? `linear-gradient(135deg, ${C.mars}, ${C.marsLight})`
          : 'rgba(255,255,255,0.04)',
        border: isUser ? 'none' : `1px solid ${C.border}`,
        fontSize: 'calc(13px * var(--font-scale, 1))',
        lineHeight: 1.7,
        color: C.ice,
        whiteSpace: 'pre-wrap',
      }}
    >
      {msg.content}
    </div>
  );
}

function ContextRow({ item }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 8,
        padding: '8px 0',
        borderBottom: `1px solid ${C.border}`,
        fontSize: 'calc(12px * var(--font-scale, 1))',
      }}
    >
      <span style={{ color: C.ice30, minWidth: 88 }}>{item.label}</span>
      <span style={{ color: C.ice, fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>
        {item.value}
      </span>
    </div>
  );
}

export function SidebarContext({ t, items, contextReady, onRefresh }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        padding: 18,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 'calc(10px * var(--font-scale, 1))',
            fontWeight: 700,
            color: C.blue,
            fontFamily: "'Orbitron', sans-serif",
            letterSpacing: 1,
          }}
        >
          {t('ai.contextTitle')}
        </div>
        <button
          onClick={onRefresh}
          style={{
            border: `1px solid ${C.border}`,
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 6,
            color: C.ice60,
            fontSize: 'calc(11px * var(--font-scale, 1))',
            padding: '3px 8px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {t('ai.refreshContext')}
        </button>
      </div>

      <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: contextReady ? C.green : C.ice30, marginBottom: 8 }}>
        {contextReady ? t('ai.contextReady') : t('ai.contextEmpty')}
      </div>

      {items.map((item) => (
        <ContextRow key={item.label} item={item} />
      ))}
    </div>
  );
}

export function QuickQuestions({ t, questions, onAsk, disabled }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        padding: 18,
      }}
    >
      <div
        style={{
          fontSize: 'calc(10px * var(--font-scale, 1))',
          fontWeight: 700,
          color: C.mars,
          fontFamily: "'Orbitron', sans-serif",
          letterSpacing: 1,
          marginBottom: 12,
        }}
      >
        {t('ai.quickTitle')}
      </div>

      {Array.isArray(questions) &&
        questions.map((q) => (
          <button
            key={q}
            disabled={disabled}
            onClick={() => onAsk(q)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '10px 12px',
              marginBottom: 6,
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              fontSize: 'calc(12px * var(--font-scale, 1))',
              color: C.ice60,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              transition: 'all 0.2s',
              fontFamily: "'Exo 2', sans-serif",
            }}
          >
            {`→ ${q}`}
          </button>
        ))}
    </div>
  );
}

export function ErrorSummary({ t, summary }) {
  const hasData = Boolean(summary);
  const metrics = hasData
    ? [
        { label: t('ai.ctxMae'), value: summary.mae },
        { label: t('ai.ctxRmse'), value: summary.rmse },
        { label: t('ai.ctxSamples'), value: summary.samples },
      ]
    : [];

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        padding: 18,
      }}
    >
      <div
        style={{
          fontSize: 'calc(10px * var(--font-scale, 1))',
          fontWeight: 700,
          color: C.blue,
          fontFamily: "'Orbitron', sans-serif",
          letterSpacing: 1,
          marginBottom: 10,
        }}
      >
        {t('ai.errorSummaryTitle')}
      </div>

      {!hasData && <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice30 }}>{t('ai.errorSummaryEmpty')}</div>}

      {hasData &&
        metrics.map((metric) => (
          <div
            key={metric.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 'calc(12px * var(--font-scale, 1))',
              padding: '6px 0',
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <span style={{ color: C.ice30 }}>{metric.label}</span>
            <span style={{ color: C.ice, fontWeight: 600 }}>{metric.value}</span>
          </div>
        ))}
    </div>
  );
}
