import C from '../constants/colors';
import { useT } from '../i18n';

function getStageMeta(stage, t) {
  const map = {
    idle: { label: t('common.personalWarmup.stage.idle'), color: C.ice40 },
    queued: { label: t('common.personalWarmup.stage.queued'), color: '#d9a441' },
    building_cache: { label: t('common.personalWarmup.stage.buildingCache'), color: '#f59e0b' },
    warming_analysis: { label: t('common.personalWarmup.stage.warmingAnalysis'), color: C.blue },
    warming_predict: { label: t('common.personalWarmup.stage.warmingPredict'), color: '#6ee7b7' },
    ready: { label: t('common.personalWarmup.stage.ready'), color: C.green },
    failed: { label: t('common.personalWarmup.stage.failed'), color: C.mars },
  };
  return map[stage] || map.idle;
}

export default function PersonalSourceWarmupBar({
  status,
  compact = false,
  showWhenIdle = false,
}) {
  const t = useT();
  const stage = status?.stage || status?.build_stage || 'idle';
  const progress = Math.max(0, Math.min(100, Number(status?.progress ?? status?.build_progress ?? 0)));
  const message = status?.message || status?.build_stage_message || '';
  const meta = getStageMeta(stage, t);

  if (!showWhenIdle && (stage === 'idle' || stage === 'ready') && progress <= 0) {
    return null;
  }

  if (!showWhenIdle && stage === 'ready' && !compact) {
    return null;
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: compact ? 6 : 8,
        padding: compact ? '10px 12px' : '12px 14px',
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice60, fontWeight: 700 }}>
          {t('common.personalWarmup.title')}
        </div>
        <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: meta.color, fontWeight: 700 }}>
          {meta.label}
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 999, overflow: 'hidden', background: C.border }}>
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: meta.color,
            borderRadius: 999,
            transition: 'width 0.25s ease',
          }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice40, lineHeight: 1.6 }}>
          {message || t('common.personalWarmup.defaultMessage')}
        </div>
        <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice50, fontWeight: 700 }}>
          {Math.round(progress)}%
        </div>
      </div>
    </div>
  );
}
