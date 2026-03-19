import C from '../constants/colors';
import { useT } from '../i18n';
import GlowCard from './GlowCard';
import { fmtNum } from '../utils/fmt';
import { ozoneLabel } from '../utils/units';

export default function PredictMetrics({
  loading,
  metrics,
  results,
  precision,
  ozoneUnit,
  activeHorizon,
  setActiveHorizon,
  lsStart,
  marsYear,
  METRIC_META
}) {
  const t = useT();

  return (
    <GlowCard style={{ padding: 20 }}>
      {/* 评估指标标题 */}
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

      {/* 逐步指标表格 */}
      {metrics?.per_step && metrics.per_step.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: C.ice30, marginBottom: 8 }}>{t('predict.perStepTitle')}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Step', 'Ls', 'RMSE', 'MAE', 'SSIM', 'R²'].map((hd) => (
                  <th key={hd} style={{
                    padding: '6px 10px', textAlign: 'center',
                    color: C.ice30, fontWeight: 600,
                    borderBottom: `1px solid ${C.border}`,
                  }}>{hd}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.per_step.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => setActiveHorizon(i)}
                  style={{
                    background: activeHorizon === i ? 'rgba(74,158,255,0.06)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <td style={{ padding: '6px 10px', textAlign: 'center', color: C.blue, fontWeight: 700 }}>Step {row.step}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', color: C.ice60 }}>
                    {results?.ls_values?.[i] != null ? `${results.ls_values[i].toFixed(3)}°` : '—'}
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', color: C.ice }}>{fmtNum(row.rmse, precision)}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', color: C.ice }}>{fmtNum(row.mae, precision)}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', color: '#4acfac' }}>{fmtNum(row.ssim, precision)}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', color: '#4acfac' }}>{fmtNum(row.r2, precision)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 指标解读文字 */}
      {metrics && results && (
        <div style={{
          background: 'rgba(199,91,57,0.06)',
          borderLeft: '3px solid rgba(199,91,57,0.4)',
          borderRadius: 8,
          padding: '12px 16px',
          fontSize: 12,
          color: C.ice60,
          lineHeight: 1.8,
        }}>
          <strong style={{ color: C.ice }}>{t('predict.summaryDone')}</strong>：{t('predict.summaryL1', { lsStart, year: marsYear, horizon: results.horizon })}<br />
          {t('predict.summaryL2a', { varCount: results.selected_variables.length })}
          {results.selected_variables.length > 0
            ? t('predict.summaryL2b', { varNames: results.selected_variables.join('、') })
            : t('predict.summaryL2c')}。<br />
          {t('predict.summaryL3a')}<span style={{ color: C.mars }}>{fmtNum(metrics.overall.rmse, precision)}{t('predict.summaryL3b')}</span>
          <span style={{ color: '#4acfac' }}>{fmtNum(metrics.overall.ssim, precision)}</span>
          {t('predict.summaryL3c')}<span style={{ color: '#4acfac' }}>{fmtNum(metrics.overall.r2, precision)}</span>。
        </div>
      )}
    </GlowCard>
  );
}
