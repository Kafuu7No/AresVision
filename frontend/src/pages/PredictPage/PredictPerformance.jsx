import Plot from 'react-plotly.js';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import GlowCard from '../../components/GlowCard';
import { fmtNum } from '../../utils/fmt';
import { METRIC_META } from './PredictComponents';

const SHORTHAND_MAP = {
  'Temperature': 'T',
  'Dust_Optical_Depth': 'D',
  'Surface_Pressure': 'P',
  'Solar_Flux_DN': 'S',
  'U_Wind': 'U',
  'V_Wind': 'V'
};

const getShorthands = (vars) => {
  if (!vars || vars.length === 0) return 'baseline';
  return vars.map(v => SHORTHAND_MAP[v] || v[0]).sort().join('');
};

export default function PredictPerformance({
  performanceData,
  perfLoading,
  activePerfMetric,
  setActivePerfMetric,
  handleFetchPerformance,
  compareConfigs,
  activeCompareId,
  setActiveCompareId,
  plotTextColor,
  plotText60,
  plotGridColor,
  precision,
  selectedCompareIds,
  setSelectedCompareIds,
  hiddenCompareIds = [],
  setHiddenCompareIds,
}) {
  const t = useT();

  return (
    <GlowCard style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4acfac', fontFamily: "'Orbitron', sans-serif", letterSpacing: 2 }}>
            {t('predict.perfTitle')}
          </div>

          {performanceData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 2, border: `1px solid ${C.border}` }}>
                {METRIC_META.map(m => (
                  <button
                    key={m.key}
                    onClick={() => setActivePerfMetric(m.key)}
                    style={{
                      padding: '4px 12px',
                      background: activePerfMetric === m.key ? 'rgba(74,158,255,0.12)' : 'transparent',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 700,
                      color: activePerfMetric === m.key ? C.blue : C.ice30,
                      cursor: 'pointer',
                      fontFamily: "'Orbitron', sans-serif",
                      transition: 'all 0.2s'
                    }}
                  >
                    {m.name}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                <button
                  onClick={() => {
                    const originals = compareConfigs.filter(c => !c.isEnsemble).map(c => c.id);
                    const allHidden = originals.every(id => hiddenCompareIds.includes(id));
                    if (allHidden) {
                      setHiddenCompareIds(prev => prev.filter(id => !originals.includes(id)));
                    } else {
                      setHiddenCompareIds(prev => Array.from(new Set([...prev, ...originals])));
                    }
                  }}
                  style={{
                    padding: '4px 10px', 
                    background: compareConfigs.some(c => !c.isEnsemble && hiddenCompareIds.includes(c.id)) ? 'rgba(74,207,172,0.2)' : 'rgba(74,207,172,0.05)', 
                    border: `1px solid ${C.border}`,
                    borderRadius: 6, fontSize: 10, color: '#4acfac', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif"
                  }}
                >
                  显隐原始
                </button>
                <button
                  onClick={() => {
                    const ensembles = compareConfigs.filter(c => c.isEnsemble).map(c => c.id);
                    const allHidden = ensembles.every(id => hiddenCompareIds.includes(id));
                    if (allHidden) {
                      setHiddenCompareIds(prev => prev.filter(id => !ensembles.includes(id)));
                    } else {
                      setHiddenCompareIds(prev => Array.from(new Set([...prev, ...ensembles])));
                    }
                  }}
                  style={{
                    padding: '4px 10px', 
                    background: compareConfigs.some(c => c.isEnsemble && hiddenCompareIds.includes(c.id)) ? 'rgba(156,123,234,0.2)' : 'rgba(156,123,234,0.05)', 
                    border: `1px solid ${C.border}`,
                    borderRadius: 6, fontSize: 10, color: '#9c7bea', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif"
                  }}
                >
                  显隐融合
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleFetchPerformance}
          disabled={perfLoading}
          style={{
            padding: '6px 12px', background: 'rgba(74,158,255,0.1)',
            border: `1px solid ${C.blue}`, borderRadius: 6,
            color: C.blue, fontSize: 10, cursor: 'pointer',
            fontFamily: "'Orbitron', sans-serif", transition: 'all 0.2s'
          }}
        >
          {perfLoading ? t('predict.generatingBtn') : t('predict.generateBtn')}
        </button>
      </div>

      {performanceData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {(() => {
            try {
              console.log('PredictPerformance Render Check:', {
                keys: Object.keys(performanceData.results || {}),
                activeMetric: activePerfMetric,
                hiddenIds: hiddenCompareIds
              });

              const plotTraces = Object.entries(performanceData.results || {})
                .filter(([key]) => {
                  // 如果开启了对比模式（勾选了模型），则不显示默认的 'current' 或 'baseline'
                  if (selectedCompareIds.length > 0 && (key === 'current' || key === 'baseline')) {
                    return false;
                  }
                  
                  const config = compareConfigs.find(c => c.id === key || getShorthands(c.vars) === key);
                  if (config && hiddenCompareIds.includes(config.id)) return false;
                  return true;
                })
                .map(([key, perf], idx) => {
                  if (!perf || !perf.items || perf.items.length === 0) {
                    console.warn(`Empty data for key: ${key}`);
                    return null;
                  }
                  
                  const colors = [C.mars, C.blue, '#4acfac', '#9c7bea', '#ffd740'];
                  const config = compareConfigs.find(c => c.id === key || getShorthands(c.vars) === key);
                  const label = config?.label || key;

                  return {
                    x: perf.items.map(it => (it.my === 27 ? it.ls : (it.ls != null ? it.ls + 360 : 0))),
                    y: perf.items.map(it => (it[activePerfMetric] != null ? it[activePerfMetric] : 0)),
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: label,
                    marker: {
                      color: colors[idx % colors.length],
                      size: config?.isEnsemble ? 4 : 5,
                      symbol: config?.isEnsemble ? 'diamond' : 'circle'
                    },
                    line: {
                      color: colors[idx % colors.length],
                      width: config?.isEnsemble ? 3.5 : (idx === 0 ? 3 : 2),
                      shape: 'spline',
                      dash: 'solid'
                    },
                    hovertemplate: `<b>${label}</b><br>MY%{customdata[0]} Ls: %{customdata[1]:.2f}°<br>${activePerfMetric.toUpperCase()}: <b>%{y:.4f}</b><extra></extra>`,
                    text: perf.items.map(it => it.my),
                    customdata: perf.items.map(it => [it.my, it.ls])
                  };
                })
                .filter(Boolean);

              return (
                <>
                  <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: `1px solid ${C.border}`, padding: '16px', height: 380 }}>
                    <Plot
                      data={plotTraces}
                      layout={{
                        autosize: true,
                        height: 340,
                        margin: { l: 50, r: 30, t: 20, b: 50 },
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        plot_bgcolor: 'rgba(0,0,0,0)',
                        xaxis: {
                          title: { text: 'Solar Longitude progression (MY27 → MY28)', font: { size: 11, color: plotTextColor } },
                          tickfont: { size: 10, color: plotText60 },
                          gridcolor: plotGridColor,
                          zeroline: false,
                          tickmode: 'array',
                          tickvals: [350, 360, 370, 380, 390, 400, 410, 420, 430],
                          ticktext: ['350', '360', '10', '20', '30', '40', '50', '60', '70']
                        },
                        yaxis: {
                          title: { text: `${METRIC_META.find(m => m.key === activePerfMetric)?.name || activePerfMetric}`, font: { size: 11, color: plotTextColor } },
                          tickfont: { size: 10, color: plotText60 },
                          gridcolor: plotGridColor,
                          zeroline: false,
                          range: (activePerfMetric === 'r2' || activePerfMetric === 'ssim') ? [0.6, 1.0] : undefined,
                          autorange: !(activePerfMetric === 'r2' || activePerfMetric === 'ssim')
                        },
                        legend: { font: { size: 10, color: C.ice60 }, orientation: 'h', y: 1.12 },
                        shapes: [{
                          type: 'line', x0: 360, x1: 360, y0: 0, y1: 1, yref: 'paper',
                          line: { color: 'rgba(255,255,255,0.2)', width: 1, dash: 'dash' }
                        }],
                        annotations: [{
                          x: 360, y: 1.05, xref: 'x', yref: 'y', text: 'NEW YEAR (MY28)',
                          showarrow: false, font: { color: plotTextColor, size: 9 }
                        }],
                        hovermode: 'closest',
                        showlegend: true
                      }}
                      config={{ displayModeBar: false, responsive: true }}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                      {Object.keys(performanceData.results || {}).map(key => {
                        const config = compareConfigs.find(c => c.id === key || getShorthands(c.vars) === key);
                        const label = config?.label || key;
                        const isEns = config?.isEnsemble;
                        return (
                          <button key={key} onClick={() => setActiveCompareId(key)} style={{
                            padding: '4px 12px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                            background: activeCompareId === key ? (isEns ? 'rgba(156,123,234,0.15)' : 'rgba(74,207,172,0.1)') : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${activeCompareId === key ? (isEns ? '#9c7bea' : '#4acfac') : C.border}`,
                            color: activeCompareId === key ? (isEns ? '#9c7bea' : '#4acfac') : C.ice30,
                            cursor: 'pointer', fontFamily: "'Orbitron', sans-serif"
                          }}>
                            {isEns ? '🧪 ' : ''}{label}
                          </button>
                        );
                      })}
                    </div>

                    {(() => {
                      const effectiveId = activeCompareId || Object.keys(performanceData.results || {})[0];
                      const activeItem = performanceData.results?.[effectiveId];
                      if (!activeItem || !activeItem.items) return <div style={{ color: C.mars, fontSize: 12 }}>No Data for {effectiveId}</div>;

                      return (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                            {[
                              { label: t('predict.globalR2'), val: activeItem.global_r2, color: '#4acfac' },
                              { label: t('predict.globalRMSE'), val: activeItem.global_rmse, color: C.mars },
                              { label: t('predict.globalMAE'), val: activeItem.global_mae, color: C.mars },
                              { label: t('predict.globalSSIM'), val: activeItem.global_ssim, color: '#4acfac' }
                            ].map((m, idx) => (
                              <div key={idx} style={{ padding: '12px 16px', background: `${m.color}15`, borderRadius: 10, border: `1px solid ${m.color}40`, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 10, color: C.ice30, fontWeight: 600 }}>{m.label}</span>
                                <span style={{ fontSize: 18, color: m.color, fontWeight: 800, fontFamily: "'Orbitron', sans-serif" }}>
                                  {fmtNum(m.val || 0, precision)}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div style={{ maxHeight: 220, overflowY: 'auto', borderRadius: 8, border: `1px solid ${C.border}` }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                              <thead style={{ position: 'sticky', top: 0, background: '#0a0a0f', zIndex: 1 }}>
                                <tr>
                                  {[t('predict.tableHeaders.my'), t('predict.tableHeaders.ls'), t('predict.tableHeaders.r2'), t('predict.tableHeaders.rmse'), t('predict.tableHeaders.mae'), t('predict.tableHeaders.ssim')].map(h => (
                                    <th key={h} style={{ padding: '10px 6px', textAlign: 'center', color: C.ice30, borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(activeItem.items || []).map((it, i) => (
                                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                    <td style={{ padding: '8px 6px', textAlign: 'center', color: C.ice60 }}>MY{it.my}</td>
                                    <td style={{ padding: '8px 6px', textAlign: 'center', color: C.ice60 }}>{(it.ls || 0).toFixed(2)}°</td>
                                    <td style={{ padding: '8px 6px', textAlign: 'center', color: (it.r2 || 0) > 0.9 ? '#4acfac' : C.mars, fontWeight: 700 }}>{fmtNum(it.r2 || 0, precision)}</td>
                                    <td style={{ padding: '8px 6px', textAlign: 'center', color: C.ice }}>{fmtNum(it.rmse || 0, precision)}</td>
                                    <td style={{ padding: '8px 6px', textAlign: 'center', color: C.ice }}>{fmtNum(it.mae || 0, precision)}</td>
                                    <td style={{ padding: '8px 6px', textAlign: 'center', color: '#4acfac' }}>{fmtNum(it.ssim || 0, precision)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </>
              );
            } catch (err) {
              console.error('PredictPerformance Render Error:', err);
              return <div style={{ color: C.mars, padding: 20, border: '1px solid red' }}>Render Error: {err.message}</div>;
            }
          })()}
        </div>
      ) : (
        <div style={{ padding: '40px 0', textAlign: 'center', color: C.ice30, fontSize: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px dashed ${C.border}` }}>
          {perfLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 20, height: 20, border: '2px solid rgba(74,207,172,0.2)', borderTop: '2px solid #4acfac', borderRadius: '50%', animation: 'spin-slow 0.8s linear infinite' }} />
              {t('predict.generatingHint')}
            </div>
          ) : t('predict.perfEmptyHint')}
        </div>
      )}
      <div style={{ marginTop: 12, fontSize: 10, color: C.ice30, fontStyle: 'italic' }}>
        {t('predict.testSetNote')}
      </div>
    </GlowCard>
  );
}
