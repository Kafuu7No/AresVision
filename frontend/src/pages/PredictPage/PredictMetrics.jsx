import C from '../../constants/colors';
import { useT } from '../../i18n';
import GlowCard from '../../components/GlowCard';
import { fmtNum } from '../../utils/fmt';
import { ozoneLabel } from '../../utils/units';
import { METRIC_META } from './PredictComponents';

export default function PredictMetrics({
  loading,
  metrics,
  precision,
  ozoneUnit,
}) {
  const t = useT();

  return (
    <GlowCard style={{ padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
        {t('predict.evalTitle')}
      </div>

      {/* 四大指标卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {METRIC_META.map((m) => {
          const val = metrics?.overall?.[m.key];
          return (
            <div key={m.key} style={{
              padding: 16, borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${C.border}`, textAlign: 'center',
            }}>
              <div style={{ fontSize: 10, color: C.ice30, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>{m.name}</div>
              <div style={{
                fontSize: 26, fontWeight: 800, color: C.ice,
                fontFamily: "'Orbitron', sans-serif", marginTop: 8,
              }}>
                {loading ? '…' : val != null ? fmtNum(val, precision) : '—'}
              </div>
              <div style={{ fontSize: 10, color: m.color, marginTop: 4 }}>
                {m.better} {m.key === 'rmse' || m.key === 'mae' ? ozoneLabel(ozoneUnit) : m.unit}
              </div>
            </div>
          );
        })}
      </div>

    </GlowCard>
  );
}
