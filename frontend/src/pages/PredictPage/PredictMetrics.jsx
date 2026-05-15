import C from '../../constants/colors';
import { useT } from '../../i18n';
import GlowCard from '../../components/GlowCard';
import { fmtNum } from '../../utils/fmt';
import { ozoneLabel } from '../../utils/units';
import { METRIC_META } from './PredictComponents';
import { useSettings } from '../../contexts/SettingsContext';

export default function PredictMetrics({
  loading,
  metrics,
  precision,
  ozoneUnit,
}) {
  const t = useT();
  const { settings } = useSettings();
  const isZh = settings?.language !== 'en';

  return (
    <GlowCard style={{ padding: 20 }}>
      <div style={{ fontSize: 'calc(15px * var(--font-scale, 1))', fontWeight: 700, color: C.ice, fontFamily: 'var(--font-display)', marginBottom: 6 }}>
        {t('predict.evalTitle')}
      </div>
      <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice50, marginBottom: 16 }}>
        {isZh ? '汇总当前预测结果的整体质量，帮助快速判断模型在这一轮推演中的稳定性。' : 'Summarizes overall model quality for the current prediction run.'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
        {METRIC_META.map((m) => {
          const val = metrics?.overall?.[m.key];
          const unit = m.key === 'rmse' || m.key === 'mae' ? ozoneLabel(ozoneUnit) : m.unit;

          return (
            <div
              key={m.key}
              style={{
                padding: 16,
                borderRadius: 14,
                background: C.bgMuted,
                border: `1px solid ${C.border}`,
              }}
            >
              <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice40, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {m.name}
              </div>
              <div style={{ fontSize: 'calc(28px * var(--font-scale, 1))', fontWeight: 800, color: C.ice, fontFamily: 'var(--font-display)', marginTop: 10, letterSpacing: '-0.03em' }}>
                {loading ? '--' : val != null ? fmtNum(val, precision) : '--'}
              </div>
              <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: m.color, marginTop: 6, fontWeight: 600 }}>
                {m.better} {unit}
              </div>
            </div>
          );
        })}
      </div>
    </GlowCard>
  );
}
