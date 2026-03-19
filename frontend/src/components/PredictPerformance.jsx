import C from '../constants/colors';
import { useT } from '../i18n';
import GlowCard from './GlowCard';
import Plot from 'react-plotly.js';
import { fmtNum } from '../utils/fmt';

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
  METRIC_META,
  selectedCompareIds, // Added for correct logic
  fusionGroups,
  t
}) {
  // We use the passed `t` or useT()
  // Actually, I'll use the passed one to be safe if translation context is high up.
  // But useT() should work too.

  return (
    <GlowCard style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4acfac', fontFamily: "'Orbitron', sans-serif", letterSpacing: 2 }}>
            {t('predict.perfTitle')}
          </div>

          {performanceData && (
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
          {/* 2D 趋势图表 */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            padding: '16px',
            height: 380
          }}>
            <Plot
              data={(() => {
                const allResults = performanceData.results;
                const traces = [];
                const colors = [C.mars, C.blue, '#9c7bea', '#ffd740', '#ff6b4a'];
                
                const selectedFusionIds = selectedCompareIds.filter(id => id.startsWith('fusion_'));
                const isAnyFusionActive = selectedFusionIds.length > 0;

                // 1. 渲染选中的原始对比模型曲线
                Object.entries(allResults).forEach(([key, perf], idx) => {
                  const config = compareConfigs.find(c => {
                    const shorthands = (vars) => vars.length === 0 ? 'baseline' : vars.map(v => v[0]).sort().join('');
                    return c.id === key || shorthands(c.vars) === key;
                  });
                  const label = config?.label || key;
                  
                  traces.push({
                    x: perf.items.map(it => it.my === 27 ? it.ls : it.ls + 360),
                    y: perf.items.map(it => it[activePerfMetric]),
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: label,
                    marker: { color: colors[idx % colors.length], size: 4 },
                    line: { color: colors[idx % colors.length], width: 2, shape: 'spline' },
                    hovertemplate: `<b>${label}</b><br>Ls: %{customdata:.2f}°<br>${activePerfMetric.toUpperCase()}: <b>%{y:.4f}</b><extra></extra>`,
                    customdata: perf.items.map(it => it.ls),
                    opacity: isAnyFusionActive ? 0.05 : 1.0 // 如果有融合组，背景原始曲线极度虚化
                  });
                });

                // 2. 渲染选中的融合组曲线
                selectedFusionIds.forEach((fid, fidx) => {
                  const group = fusionGroups.find(g => g.id === fid);
                  if (!group) return;

                  // 获取该组内所有模型的 perf 数据
                  const groupPerfs = group.modelKeys
                    .map(mkey => {
                      const config = compareConfigs.find(c => c.id === mkey);
                      if (!config) return null;
                      const key = config.vars.length === 0 ? 'baseline' : config.vars.map(v => v[0]).sort().join('');
                      return allResults[key] || allResults[mkey];
                    })
                    .filter(p => p != null);

                  if (groupPerfs.length < 2) return;

                  const firstPerf = groupPerfs[0];
                  const fusionY = [];
                  for (let i = 0; i < firstPerf.items.length; i++) {
                    const vals = groupPerfs.map(p => p.items[i][activePerfMetric]);
                    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                    fusionY.push(avg);
                  }

                  const fusionColors = ['#4acfac', '#00f7ff', '#afff00'];
                  traces.push({
                    x: firstPerf.items.map(it => it.my === 27 ? it.ls : it.ls + 360),
                    y: fusionY,
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: `🧬 ${group.label}`,
                    marker: { color: fusionColors[fidx % fusionColors.length], size: 7, symbol: 'diamond' },
                    line: { color: fusionColors[fidx % fusionColors.length], width: 4, shape: 'spline' },
                    hovertemplate: `<b>${group.label} (Fusion)</b><br>Ls: %{customdata:.2f}°<br>${activePerfMetric.toUpperCase()}: <b>%{y:.4f}</b><extra></extra>`,
                    customdata: firstPerf.items.map(it => it.ls)
                  });
                });

                return traces;
              })()}
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
                  showgrid: true
                },
                yaxis: {
                  title: { text: `${METRIC_META.find(m => m.key === activePerfMetric)?.name ?? activePerfMetric}${METRIC_META.find(m => m.key === activePerfMetric)?.unit ? ' (' + METRIC_META.find(m => m.key === activePerfMetric).unit + ')' : ''}`, font: { size: 11, color: plotTextColor } },
                  tickfont: { size: 10, color: plotText60 },
                  gridcolor: plotGridColor,
                  zeroline: false,
                  range: (activePerfMetric === 'r2' || activePerfMetric === 'ssim') ? [0.6, 1.0] : undefined,
                  autorange: !(activePerfMetric === 'r2' || activePerfMetric === 'ssim')
                },
                legend: {
                  font: { size: 10, color: C.ice60 },
                  orientation: 'h',
                  y: 1.12
                },
                shapes: [
                  {
                    type: 'line',
                    x0: 360, x1: 360,
                    y0: 0, y1: 1,
                    yref: 'paper',
                    line: { color: 'rgba(255,255,255,0.2)', width: 1, dash: 'dash' }
                  }
                ],
                annotations: [
                  {
                    x: 360, y: 1.05,
                    xref: 'x', yref: 'y',
                    text: 'NEW YEAR (MY28)',
                    showarrow: false,
                    font: { color: plotTextColor, size: 9 }
                  }
                ],
                hovermode: 'closest',
                showlegend: true
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          </div>

          {/* 底部数据明细表 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* 多项详情切换 */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
              {Object.keys(performanceData.results).map(key => {
                const label = compareConfigs.find(c => {
                  const shorthands = (vars) => vars.length === 0 ? 'baseline' : vars.map(v => v[0]).sort().join('');
                  return c.id === key || shorthands(c.vars) === key;
                })?.label || key;
                return (
                  <button key={key} onClick={() => setActiveCompareId(key)} style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                    background: activeCompareId === key ? 'rgba(74,207,172,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${activeCompareId === key ? '#4acfac' : C.border}`,
                    color: activeCompareId === key ? '#4acfac' : C.ice30,
                    cursor: 'pointer', fontFamily: "'Orbitron', sans-serif"
                  }}>
                    {label}
                  </button>
                );
              })}

              {fusionGroups.filter(g => selectedCompareIds.includes(g.id)).map(g => (
                <button key={g.id} onClick={() => setActiveCompareId(g.id)} style={{
                  padding: '4px 12px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                  background: activeCompareId === g.id ? 'rgba(74,207,172,0.15)' : 'rgba(74,207,172,0.05)',
                  border: `2px solid ${activeCompareId === g.id ? '#4acfac' : 'rgba(74,207,172,0.2)'}`,
                  color: '#4acfac', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif"
                }}>
                  🧬 {g.label}
                </button>
              ))}
            </div>

            {(() => {
              let activePerf;
              if (activeCompareId?.startsWith('fusion_')) {
                const group = fusionGroups.find(g => g.id === activeCompareId);
                if (!group) return null;

                const groupPerfs = group.modelKeys
                  .map(mkey => {
                    const config = compareConfigs.find(c => c.id === mkey);
                    if (!config) return null;
                    const key = config.vars.length === 0 ? 'baseline' : config.vars.map(v => v[0]).sort().join('');
                    return performanceData.results[key] || performanceData.results[mkey];
                  })
                  .filter(p => p != null);

                if (groupPerfs.length === 0) return null;
                
                const itemCount = groupPerfs[0].items.length;
                const fusionItems = [];
                for (let i = 0; i < itemCount; i++) {
                  const it0 = groupPerfs[0].items[i];
                  fusionItems.push({
                    my: it0.my,
                    ls: it0.ls,
                    r2: groupPerfs.reduce((s, p) => s + p.items[i].r2, 0) / groupPerfs.length,
                    rmse: groupPerfs.reduce((s, p) => s + (p.items[i].rmse || 0), 0) / groupPerfs.length,
                    mae: groupPerfs.reduce((s, p) => s + (p.items[i].mae || 0), 0) / groupPerfs.length,
                    ssim: groupPerfs.reduce((s, p) => s + (p.items[i].ssim || 1), 0) / groupPerfs.length,
                  });
                }
                
                activePerf = {
                  items: fusionItems,
                  global_r2: groupPerfs.reduce((s, p) => s + p.global_r2, 0) / groupPerfs.length,
                  global_rmse: groupPerfs.reduce((s, p) => s + p.global_rmse, 0) / groupPerfs.length,
                  global_mae: groupPerfs.reduce((s, p) => s + p.global_mae, 0) / groupPerfs.length,
                  global_ssim: groupPerfs.reduce((s, p) => s + p.global_ssim, 0) / groupPerfs.length,
                };
              } else {
                activePerf = performanceData.results[activeCompareId] || Object.values(performanceData.results)[0];
              }

              if (!activePerf) return null;
              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                    <div style={{
                      padding: '12px 16px', background: 'rgba(74,158,255,0.1)', borderRadius: 10, border: '1px solid rgba(74,158,255,0.3)',
                      display: 'flex', flexDirection: 'column', gap: 4
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, color: C.ice30, fontWeight: 600 }}>{t('predict.globalR2')}</span>
                        <div style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: 4, fontSize: 8, color: C.ice30 }}>Flattened</div>
                      </div>
                      <span style={{ fontSize: 18, color: C.blue, fontWeight: 800, fontFamily: "'Orbitron', sans-serif" }}>
                        {activePerf.global_r2 ? fmtNum(activePerf.global_r2, precision) : fmtNum(0, precision)}
                      </span>
                    </div>
                    <div style={{
                      padding: '12px 16px', background: 'rgba(199,91,57,0.1)', borderRadius: 10, border: '1px solid rgba(199,91,57,0.3)',
                      display: 'flex', flexDirection: 'column', gap: 4
                    }}>
                      <span style={{ fontSize: 10, color: C.ice30, fontWeight: 600 }}>{t('predict.globalRMSE')}</span>
                      <span style={{ fontSize: 18, color: C.mars, fontWeight: 800, fontFamily: "'Orbitron', sans-serif" }}>
                        {activePerf.global_rmse ? fmtNum(activePerf.global_rmse, precision) : fmtNum(0, precision)}
                      </span>
                    </div>
                    <div style={{
                      padding: '12px 16px', background: 'rgba(199,91,57,0.06)', borderRadius: 10, border: '1px solid rgba(199,91,57,0.2)',
                      display: 'flex', flexDirection: 'column', gap: 4
                    }}>
                      <span style={{ fontSize: 10, color: C.ice30, fontWeight: 600 }}>{t('predict.globalMAE')}</span>
                      <span style={{ fontSize: 18, color: C.mars, fontWeight: 800, fontFamily: "'Orbitron', sans-serif" }}>
                        {activePerf.global_mae ? fmtNum(activePerf.global_mae, precision) : fmtNum(0, precision)}
                      </span>
                    </div>
                    <div style={{
                      padding: '12px 16px', background: 'rgba(74,207,172,0.1)', borderRadius: 10, border: '1px solid rgba(74,207,172,0.3)',
                      display: 'flex', flexDirection: 'column', gap: 4
                    }}>
                      <span style={{ fontSize: 10, color: C.ice30, fontWeight: 600 }}>{t('predict.globalSSIM')}</span>
                      <span style={{ fontSize: 18, color: '#4acfac', fontWeight: 800, fontFamily: "'Orbitron', sans-serif" }}>
                        {activePerf.global_ssim ? fmtNum(activePerf.global_ssim, precision) : fmtNum(0, precision)}
                      </span>
                    </div>
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
                        {activePerf.items.map((it, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                            <td style={{ padding: '8px 6px', textAlign: 'center', color: C.ice60 }}>MY{it.my}</td>
                            <td style={{ padding: '8px 6px', textAlign: 'center', color: C.ice60 }}>{it.ls.toFixed(2)}°</td>
                            <td style={{
                              padding: '8px 6px', textAlign: 'center',
                              color: it.r2 > 0.9 ? '#4acfac' : it.r2 > 0.8 ? '#ffd740' : C.mars,
                              fontWeight: 700
                            }}>{fmtNum(it.r2, precision)}</td>
                            <td style={{ padding: '8px 6px', textAlign: 'center', color: C.ice }}>{fmtNum(it.rmse, precision)}</td>
                            <td style={{ padding: '8px 6px', textAlign: 'center', color: C.ice }}>{fmtNum(it.mae, precision)}</td>
                            <td style={{ padding: '8px 6px', textAlign: 'center', color: '#4acfac' }}>{fmtNum(it.ssim, precision)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
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
