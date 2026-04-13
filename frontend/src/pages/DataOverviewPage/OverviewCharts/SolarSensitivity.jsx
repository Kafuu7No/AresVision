import React, { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import C from '../../../constants/colors';
import { useT } from '../../../i18n';
import { useSettings } from '../../../contexts/SettingsContext';
import { fetchSolarPhotochemical } from '../../../services/api';

const BANDS = [
  'Equatorial (30S-30N)',
  'Mid-Lat North (30N-60N)',
  'Mid-Lat South (30S-60S)',
  'Polar North (60N-90N)',
  'Polar South (60S-90S)',
];

export default function SolarSensitivity({ marsYear }) {
  const t = useT();
  const { settings } = useSettings();
  const isZh = settings.language === 'zh';
  
  const copy = isZh ? {
    title: '太阳-光化学敏感性',
    desc: '分析紫外线辐射对不同纬度带臭氧产生效率的影响。',
    loading: '加载光化学数据...',
    noData: '暂无数据或缺少 Solar_Flux_DN 变量',
    solarAxis: '太阳辐射 (W/m²)',
    ozoneAxis: '平均臭氧含量 (m-atm cm)',
    bands: {
      'Equatorial (30S-30N)': '赤道带 (30°S-30°N)',
      'Mid-Lat North (30N-60N)': '北半球中纬度 (30°N-60°N)',
      'Mid-Lat South (30S-60S)': '南半球中纬度 (30°S-60°S)',
      'Polar North (60N-90N)': '北半球高纬度 (60°N-90°N)',
      'Polar South (60S-90S)': '南半球高纬度 (60°S-90°S)'
    }
  } : {
    title: 'Solar-Photochemical Sensitivity',
    desc: 'Analyze how solar flux drives daytime ozone production efficiency.',
    loading: 'Loading chemical data...',
    noData: 'No Data or Solar_Flux_DN missing',
    solarAxis: 'Solar Flux (W/m²)',
    ozoneAxis: 'Mean Ozone (m-atm cm)',
    bands: {
      'Equatorial (30S-30N)': 'Equatorial (30°S-30°N)',
      'Mid-Lat North (30N-60N)': 'Northern Mid-Lat (30°N-60°N)',
      'Mid-Lat South (30S-60S)': 'Southern Mid-Lat (30°S-60°S)',
      'Polar North (60N-90N)': 'Northern High-Lat (60°N-90°N)',
      'Polar South (60S-90S)': 'Southern High-Lat (60°S-90°S)'
    }
  };

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeBand, setActiveBand] = useState(BANDS[0]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchSolarPhotochemical(marsYear, activeBand)
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [marsYear, activeBand]);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ color: C.ice, margin: '0 0 4px 0', fontSize: 16 }}>{copy.title}</h3>
          <p style={{ color: C.ice60, fontSize: 12, margin: 0 }}>{copy.desc}</p>
        </div>
        <select
          value={activeBand}
          onChange={(e) => setActiveBand(e.target.value)}
          style={{
            background: 'rgba(0,0,0,0.5)',
            border: `1px solid ${C.border}`,
            color: C.ice,
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontFamily: "'Exo 2', sans-serif",
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          {BANDS.map(b => <option key={b} value={b}>{copy.bands[b]}</option>)}
        </select>
      </div>

      <div style={{ height: '360px', position: 'relative' }}>
        {loading && (
           <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', zIndex: 10 }}>
              <span style={{ color: C.ice }}>{copy.loading}</span>
           </div>
        )}
        
        {(!data || !data.ozone) && !loading ? (
             <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: C.ice }}>{copy.noData}</div>
        ) : (
          <Plot
            data={[
              {
                x: data?.solar || [],
                y: data?.ozone || [],
                type: 'scatter',
                mode: 'markers',
                marker: {
                  color: data?.ls || [],
                  colorscale: 'Viridis',
                  size: 6,
                  opacity: 0.7,
                  showscale: true,
                  colorbar: {
                    title: 'Ls (°)',
                    titleside: 'right',
                    titlefont: { color: C.ice30, size: 10 },
                    tickfont: { color: C.ice60, size: 10 },
                    outlinewidth: 0,
                    xpad: 10
                  }
                },
                text: data?.ls ? data.ls.map(v => `Ls: ${v.toFixed(1)}°`) : [],
                hovertemplate: 'Flux: %{x:.1f}<br>O3: %{y:.4f}<br>%{text}<extra></extra>'
              }
            ]}
            layout={{
              autosize: true,
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              margin: { l: 50, r: 20, t: 20, b: 40 },
              xaxis: {
                title: copy.solarAxis,
                gridcolor: 'rgba(255,255,255,0.06)',
                tickfont: { color: C.ice60, size: 10 },
                titlefont: { color: C.ice30, size: 11 }
              },
              yaxis: {
                title: copy.ozoneAxis,
                gridcolor: 'rgba(255,255,255,0.06)',
                tickfont: { color: C.ice60, size: 10 },
                titlefont: { color: C.ice30, size: 11 }
              }
            }}
            config={{ displayModeBar: false, responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: '100%' }}
          />
        )}
      </div>
    </div>
  );
}
