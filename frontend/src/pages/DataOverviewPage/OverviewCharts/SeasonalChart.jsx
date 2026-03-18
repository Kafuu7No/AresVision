import { useState, useEffect } from 'react'; // Re-triggering vite cache
import Plot from 'react-plotly.js';
import C from '../../../constants/colors';
import { useT } from '../../../i18n';
import { useSettings } from '../../../contexts/SettingsContext';
import { fetchSeasonalHeatmap } from '../../../services/api';
import { PLOTLY_SCALE } from '../../../utils/colormaps';
import { convertOzone, ozoneLabel } from '../../../utils/units';

export default function SeasonalChart({ marsYear }) {
  const t = useT();
  const { settings } = useSettings();
  const colormapName = settings.colormap;
  const ozoneUnit = settings.units.ozone;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchSeasonalHeatmap(marsYear).then(res => {
      if (active) {
        setData(res);
        setLoading(false);
      }
    }).catch(err => {
      console.error(err);
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [marsYear]);

  // Handle Plotly resizing issues during 0.8s slide transition
  useEffect(() => {
    if (data && !loading) {
      const dispatchResize = () => window.dispatchEvent(new Event('resize'));
      const t1 = setTimeout(dispatchResize, 100);
      const t2 = setTimeout(dispatchResize, 400);
      const t3 = setTimeout(dispatchResize, 850);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [data, loading]);

  if (loading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.ice, fontFamily: "'Orbitron', sans-serif", display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: '16px', height: '16px', border: `2px solid rgba(0,240,255,0.2)`,
            borderTop: `2px solid ${C.ice}`, borderRadius: '50%', animation: 'spin-slow 1s linear infinite'
          }} />
          LOADING HEATMAP...
        </div>
      </div>
    );
  }

  if (!data) return <div style={{ color: C.mars, padding: 20 }}>{t('overview.charts.noData')}</div>;

  return (
    <div className="seasonal-chart-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <style>{`
        .seasonal-chart-container .modebar {
          top: auto !important;
          bottom: 0px !important;
          right: 20px !important;
          left: auto !important;
          background: rgba(10, 10, 15, 0.8) !important;
          border: 1px solid rgba(0, 240, 255, 0.2);
          border-radius: 8px;
          padding: 2px 4px;
          display: flex !important;
        }
        .seasonal-chart-container .modebar-group {
          display: flex !important;
          margin-bottom: 0 !important;
        }
        .seasonal-chart-container .modebar-btn svg {
          fill: rgba(0, 240, 255, 0.6) !important;
        }
        .seasonal-chart-container .modebar-btn:hover svg,
        .seasonal-chart-container .modebar-btn.active svg {
          fill: #ff6b35 !important;
        }
      `}</style>
      <Plot
        data={[
          {
            z: data.z.map(row => row.map(v => convertOzone(v, ozoneUnit))),
            x: data.x,
            y: data.y,
            type: 'heatmap',
            zsmooth: 'best',
            colorscale: PLOTLY_SCALE[colormapName] ?? 'Jet',
            zmin: convertOzone(data.min, ozoneUnit),
            zmax: convertOzone(data.max * 0.6, ozoneUnit), 
            hovertemplate: `Ls: %{x:.1f}°<br>Lat: %{y:.1f}°<br>O₃: %{z:.2f} ${ozoneLabel(ozoneUnit)}<extra></extra>`,
            colorbar: {
              title: { text: `O₃ (${ozoneLabel(ozoneUnit)})`, font: { color: '#e8edf3', family: "'Orbitron', sans-serif", size: 10 }, side: 'top' },
              orientation: 'h',
              y: -0.25,
              yanchor: 'top',
              len: 0.8,
              thickness: 10,
              tickfont: { color: 'rgba(232,237,243,0.6)', family: "'Exo 2', sans-serif" }
            }
          }
        ]}
        layout={{
          title: { text: t('overview.charts.heatmapTitle', { year: marsYear }), font: { color: '#e8edf3', family: "'Orbitron', sans-serif", size: 14 } },
          xaxis: { title: 'Solar Longitude Ls (°)', color: 'rgba(232,237,243,0.6)', gridcolor: 'rgba(232,237,243,0.08)', titlefont: { family: "'Exo 2', sans-serif" }, showgrid: false },
          yaxis: { title: 'Latitude (°)', color: 'rgba(232,237,243,0.6)', gridcolor: 'rgba(232,237,243,0.08)', titlefont: { family: "'Exo 2', sans-serif" }, showgrid: false },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          margin: { t: 40, r: 20, l: 50, b: 120 },
          autosize: true
        }}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
        config={{ displayModeBar: true, scrollZoom: true, responsive: true, displaylogo: false }}
      />
    </div>
  );
}
