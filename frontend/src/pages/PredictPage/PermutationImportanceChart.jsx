import Plot from 'react-plotly.js';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import GlowCard from '../../components/GlowCard';

export default function PermutationImportanceChart({
  data,
  loading,
  plotTextColor,
  plotGridColor,
  plotText60
}) {
  const t = useT();

  const chartData = data?.items || [];
  const names = chartData.map(d => d.name);
  const values = chartData.map(d => d.importance);

  const trace = {
    x: values,
    y: names,
    type: 'bar',
    orientation: 'h',
    marker: {
      color: values.map((_, i) => i === 0 ? '#4acfac' : C.blue),
      opacity: 0.8,
      line: {
        color: values.map((_, i) => i === 0 ? '#4acfac' : C.blue),
        width: 1
      }
    },
    hovertemplate: '<b>%{y}</b><br>Importance Drop: <b>%{x:.6f}</b><extra></extra>',
  };

  return (
    <GlowCard style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#4acfac', fontFamily: "'Orbitron', sans-serif", letterSpacing: 2 }}>
          PERMUTATION FEATURE IMPORTANCE (ΔR²)
        </div>
        {data && (
          <div style={{ fontSize: 10, color: C.ice30, fontFamily: "'Orbitron', sans-serif" }}>
            Baseline R²: <span style={{ color: '#4acfac', fontWeight: 800 }}>{data.baseline_value?.toFixed(4)}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'rgba(255,255,255,0.01)', borderRadius: 12 }}>
          <div style={{ width: 24, height: 24, border: '2px solid rgba(74,207,172,0.2)', borderTop: '2px solid #4acfac', borderRadius: '50%', animation: 'spin-slow 0.8s linear infinite' }} />
          <div style={{ fontSize: 10, color: C.ice30 }}>{t('predict.generatingHint')}...</div>
        </div>
      ) : chartData.length > 0 ? (
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: `1px solid ${C.border}`, padding: '10px' }}>
          <Plot
            data={[trace]}
            layout={{
              autosize: true,
              height: 280,
              margin: { l: 120, r: 30, t: 10, b: 40 },
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)',
              xaxis: {
                title: { text: 'Performance Drop (R²)', font: { size: 10, color: plotTextColor } },
                tickfont: { size: 9, color: plotText60 },
                gridcolor: plotGridColor,
                zeroline: false,
              },
              yaxis: {
                autorange: 'reversed',
                tickfont: { size: 10, color: plotTextColor, fontWeight: 600 },
                gridcolor: 'transparent',
              },
              hovermode: 'closest',
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      ) : (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ice30, fontSize: 11, border: `1px dashed ${C.border}`, borderRadius: 12 }}>
          No PFI analysis data available. Run prediction to generate.
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 10, color: C.ice30, lineLine: 1.5 }}>
        <span style={{ color: C.blue, fontWeight: 700 }}>Note:</span> PFI measures feature importance by calculating the drop in R² when a feature's values are randomly permuted. A higher drop indicates greater reliance on that feature.
      </div>
    </GlowCard>
  );
}
