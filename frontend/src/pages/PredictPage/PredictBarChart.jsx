import React from 'react';
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

export default function PredictBarChart({
  performanceData,
  compareConfigs,
  selectedCompareIds,
  activeMetric = 'r2',
  setActiveMetric,
  plotTextColor,
  plotText60,
  plotGridColor,
  precision,
  handleFetchPerformance,
  perfLoading = false,
  showShapley,
  setShowShapley,
}) {
  const t = useT();

  if (!performanceData || !performanceData.results || selectedCompareIds.length === 0) {
    return (
      <GlowCard style={{ padding: 20, background: 'linear-gradient(135deg, rgba(156,123,234,0.08), rgba(156,123,234,0.04))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9c7bea', fontFamily: "'Orbitron', sans-serif", letterSpacing: 2 }}>
            {t('predict.barChartTitle')}
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>📈</div>
          <div style={{ fontSize: 13, color: C.ice, marginBottom: 8, fontWeight: 600 }}>
            {selectedCompareIds.length === 0
              ? t('predict.selectModelsToCompare')
              : t('predict.readyToGenerate')}
          </div>
          <button
            onClick={handleFetchPerformance}
            disabled={selectedCompareIds.length === 0 || perfLoading}
            style={{
              marginTop: 16,
              padding: '12px 24px',
              background: selectedCompareIds.length === 0 || perfLoading
                ? 'rgba(156,123,234,0.15)'
                : 'linear-gradient(135deg, #9c7bea, #7b5acc)',
              border: `2px solid ${selectedCompareIds.length === 0 || perfLoading ? 'rgba(156,123,234,0.3)' : '#9c7bea'}`,
              borderRadius: 10,
              color: selectedCompareIds.length === 0 || perfLoading ? 'rgba(156,123,234,0.5)' : '#fff',
              fontSize: 12,
              fontWeight: 700,
              cursor: selectedCompareIds.length === 0 || perfLoading ? 'not-allowed' : 'pointer',
              fontFamily: "'Orbitron', sans-serif",
              transition: 'all 0.3s',
              boxShadow: selectedCompareIds.length === 0 || perfLoading
                ? 'none'
                : '0 4px 20px rgba(156,123,234,0.3)',
            }}
          >
            {perfLoading ? t('predict.generatingChartData') : t('predict.generateChartAction')}
          </button>
        </div>
      </GlowCard>
    );
  }

  const barData = [];
  selectedCompareIds.forEach(id => {
    const config = compareConfigs.find(c => c.id === id);
    let perfData = performanceData.results?.[id];
    if (!perfData && config) {
      const shorthand = getShorthands(config.vars);
      perfData = performanceData.results?.[shorthand];
    }
    if (!perfData) return;
    const label = config?.label || id;
    const isEnsemble = config?.isEnsemble;
    const metricKey = `global_${activeMetric}`;
    const value = perfData[metricKey] || 0;
    barData.push({
      id,
      label: isEnsemble ? `🧪 ${label}` : label,
      value,
      isEnsemble,
      order: activeMetric === 'r2' || activeMetric === 'ssim' ? -value : value,
    });
  });

  const sortedData = barData.sort((a, b) => a.order - b.order);
  const metricMeta = METRIC_META.find(m => m.key === activeMetric);
  const xAxisLabel = metricMeta?.name || activeMetric.toUpperCase();

  const getMarkerColors = (data) => {
    return data.map((d, i) => {
      if (d.isEnsemble) return '#9c7bea';
      const ratio = i / Math.max(1, data.length - 1);
      return `rgba(74, ${207 - (207 - 158) * ratio}, ${172 + (255 - 172) * ratio}, ${1 - 0.5 * ratio})`;
    });
  };

  return (
    <GlowCard style={{ padding: '16px 20px', background: 'rgba(10,10,15,0.4)', backdropFilter: 'blur(10px)', border: `1px solid ${C.border}`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 40, height: 40, borderTop: '2px dotted #9c7bea60', borderLeft: '2px dotted #9c7bea60', borderTopLeftRadius: 20 }}></div>
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottom: '2px dotted #9c7bea60', borderRight: '2px dotted #9c7bea60', borderBottomRightRadius: 20 }}></div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(156,123,234,0.4), transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(156,123,234,0.3)',
            boxShadow: '0 0 20px rgba(156,123,234,0.2)'
          }}>
            <span style={{ fontSize: 20, animation: 'pulse 2s infinite' }}>🛰️</span>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#9c7bea', fontWeight: 900, fontFamily: "'Orbitron', sans-serif", letterSpacing: 4, opacity: 0.8 }}>
              ORBITAL ANALYTICS
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.ice, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, textShadow: '0 0 15px rgba(156,123,234,0.4)' }}>
              PERFORMANCE SPECTRUM
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => setShowShapley(!showShapley)}
            style={{
              padding: '8px 16px',
              background: showShapley ? 'rgba(74,207,172,0.2)' : 'rgba(0,0,0,0.4)',
              border: `1px solid ${showShapley ? 'rgba(74,207,172,0.5)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 12,
              color: showShapley ? '#4acfac' : 'rgba(255,255,255,0.5)',
              fontSize: 10,
              fontWeight: 800,
              fontFamily: "'Orbitron', sans-serif",
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: showShapley ? '0 0 15px rgba(74,207,172,0.2)' : 'inset 0 0 10px rgba(0,0,0,0.5)',
            }}
          >
            <span style={{ fontSize: 14 }}>{showShapley ? '👁️' : '🧠'}</span>
            {t('predict.toggleShapley', 'SHAPLEY')}
          </button>
          
          <div style={{
            display: 'flex', background: 'rgba(0,0,0,0.4)',
            borderRadius: 14, padding: 4, border: `1px solid rgba(156,123,234,0.2)`,
            boxShadow: 'inset 0 0 15px rgba(0,0,0,0.8)'
          }}>
            {METRIC_META.map(m => (
              <button
                key={m.key}
                onClick={() => setActiveMetric(m.key)}
                style={{
                  padding: '6px 18px',
                  background: activeMetric === m.key ? 'rgba(156,123,234,0.3)' : 'transparent',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 10,
                  fontWeight: 900,
                  color: activeMetric === m.key ? '#fff' : 'rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  fontFamily: "'Orbitron', sans-serif",
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: activeMetric === m.key ? '0 0 20px rgba(156,123,234,0.5)' : 'none',
                  textShadow: activeMetric === m.key ? '0 0 8px rgba(255,255,255,0.8)' : 'none'
                }}
              >
                {m.name}
              </button>
            ))}
          </div>

          <button
            onClick={handleFetchPerformance}
            disabled={perfLoading}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: perfLoading ? 'rgba(0,0,0,0.5)' : 'rgba(156,123,234,0.2)',
              border: `1px solid ${perfLoading ? 'rgba(255,255,255,0.1)' : 'rgba(156,123,234,0.5)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: perfLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.5s',
              color: '#9c7bea',
              boxShadow: perfLoading ? 'none' : '0 0 15px rgba(156,123,234,0.3)'
            }}
          >
            <span style={{ fontSize: 18 }}>🔄</span>
          </button>
        </div>
      </div>

      {sortedData.length === 0 ? (
        <div style={{ fontSize: 13, color: 'rgba(156,123,234,0.5)', textAlign: 'center', padding: '100px 20px', border: `1px dashed rgba(156,123,234,0.2)`, borderRadius: 24, background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: 50, marginBottom: 24, opacity: 0.15, filter: 'hue-rotate(280deg)' }}>📡</div>
          {t('predict.noDataAvailable')}
        </div>
      ) : (
        <div style={{
          position: 'relative',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: 24,
          padding: '20px',
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: 'inset 0 0 50px rgba(0,0,0,0.8)'
        }}>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            zIndex: 1,
            pointerEvents: 'none'
          }}>
            <div style={{ fontSize: 10, color: '#9c7bea60', fontWeight: 900, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2 }}>TOP MODEL</div>
            <div style={{ fontSize: 24, color: '#fff', fontWeight: 800, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, margin: '4px 0' }}>
              {sortedData[0]?.label.replace('🧪 ', '')}
            </div>
            <div style={{ fontSize: 14, color: '#4acfac', fontWeight: 900, fontFamily: "'Orbitron', sans-serif" }}>
              {fmtNum(sortedData[0]?.value, precision)}
            </div>
          </div>

          <Plot
            data={[
              {
                type: 'barpolar',
                r: (() => {
                  const vals = sortedData.map(d => d.value);
                  const min = Math.min(...vals);
                  const max = Math.max(...vals);
                  const range = max - min || 0.001;
                  return sortedData.map(d => ((d.value - min) / range) * 70 + 30);
                })(),
                theta: sortedData.map(d => d.label),
                width: 0.8,
                marker: {
                  color: getMarkerColors(sortedData),
                  line: { color: 'rgba(255,255,255,0.7)', width: 1.5 },
                },
                hoverinfo: 'all',
                hovertemplate: '<b>%{theta}</b><br>' + xAxisLabel + ': %{customdata}<extra></extra>',
                customdata: sortedData.map(d => fmtNum(d.value, precision)),
              }
            ]}
            layout={{
              height: 600,
              margin: { l: 20, r: 20, t: 20, b: 20 },
              plot_bgcolor: 'transparent',
              paper_bgcolor: 'transparent',
              font: { family: "'Orbitron', sans-serif", color: plotTextColor },
              polar: {
                bgcolor: 'transparent',
                hole: 0.25,
                angularaxis: {
                  tickfont: { size: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600 },
                  gridcolor: 'rgba(255,255,255,0.05)',
                  linecolor: 'rgba(255,255,255,0.1)',
                  direction: 'clockwise',
                },
                radialaxis: {
                  visible: false,
                  range: [0, 105],
                }
              },
              showlegend: false,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: 600 }}
          />

          <div style={{ position: 'absolute', bottom: 15, left: 15, fontSize: 8, color: 'rgba(255,255,255,0.15)', fontFamily: "'Orbitron', sans-serif" }}>
            COORD: POLAR_SYSTEM_ALPHA
          </div>
          <div style={{ position: 'absolute', bottom: 15, right: 15, fontSize: 8, color: 'rgba(255,255,255,0.15)', fontFamily: "'Orbitron', sans-serif" }}>
            RELIABILITY: OPTIMAL
          </div>
        </div>
      )}
    </GlowCard>
  );
}