import React, { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import C from '../../../constants/colors';
import { useT } from '../../../i18n';
import { useSettings } from '../../../contexts/SettingsContext';
import { fetchPolarDynamics } from '../../../services/api';

export default function PolarDynamics({ marsYear }) {
  const t = useT();
  const { settings } = useSettings();
  const isZh = settings.language === 'zh';
  
  const copy = isZh ? {
    title: '极地涡旋与动力输送 (Polar Dynamics)',
    desc: '对比南北极极夜前后的臭氧急剧积聚趋势及其与温度的关系。',
    loading: '加载极地数据...',
    noData: '无数据',
    ozoneAxis: '极地平均 O3 (m-atm cm)',
    tempAxis: '极地平均空气温度 (K)',
    lsAxis: '太阳黄经 Ls (°)'
  } : {
    title: 'Polar Dynamics & Vortex Tracker',
    desc: 'Compare rapid polar ozone buildup before and after polar night.',
    loading: 'Loading polar data...',
    noData: 'No Data',
    ozoneAxis: 'Polar Mean O3 (m-atm cm)',
    tempAxis: 'Polar Mean Air Temp (K)',
    lsAxis: 'Solar Longitude Ls (°)'
  };

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPolarDynamics(marsYear)
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
  }, [marsYear]);

  if (loading) {
    return <div style={{ color: C.ice, padding: 20 }}>{copy.loading}</div>;
  }

  if (!data || !data.ls) {
    return <div style={{ color: C.ice, padding: 20 }}>{copy.noData}</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ color: C.ice, margin: '0 0 4px 0', fontSize: 16 }}>{copy.title}</h3>
        <p style={{ color: C.ice60, fontSize: 12, margin: 0 }}>{copy.desc}</p>
      </div>

      <div style={{ flex: 1, minHeight: 300, display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr 1fr', gap: 10 }}>
        
        {/* Ozone vs Ls (North and South) */}
        <Plot
          data={[
            {
              x: data.ls,
              y: data.north.ozone,
              type: 'scatter',
              mode: 'lines',
              name: 'North O3 (>60N)',
              line: { color: C.blue, width: 2.5 }
            },
            {
              x: data.ls,
              y: data.south.ozone,
              type: 'scatter',
              mode: 'lines',
              name: 'South O3 (<60S)',
              line: { color: C.mars, width: 2.5, dash: 'dot' }
            }
          ]}
          layout={{
            autosize: true,
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            margin: { l: 50, r: 20, t: 10, b: 30 },
            xaxis: {
              title: copy.lsAxis,
              gridcolor: 'rgba(255,255,255,0.06)',
              tickfont: { color: C.ice60, size: 10 },
              titlefont: { color: C.ice30, size: 11 }
            },
            yaxis: {
              title: copy.ozoneAxis,
              gridcolor: 'rgba(255,255,255,0.06)',
              tickfont: { color: C.ice60, size: 10 },
              titlefont: { color: C.ice30, size: 11 }
            },
            legend: {
              x: 0.05,
              y: 0.95,
              font: { color: C.ice60, size: 10 },
              bgcolor: 'rgba(0,0,0,0.5)'
            }
          }}
          config={{ displayModeBar: false, responsive: true }}
          useResizeHandler
          style={{ width: '100%', height: '100%' }}
        />

        {/* Temperature vs Ls (North and South) */}
        <Plot
          data={[
            {
              x: data.ls,
              y: data.north.temp,
              type: 'scatter',
              mode: 'lines',
              name: 'North Temp (>60N)',
              line: { color: '#00d2ff', width: 1.5 }
            },
            {
              x: data.ls,
              y: data.south.temp,
              type: 'scatter',
              mode: 'lines',
              name: 'South Temp (<60S)',
              line: { color: '#ff7b00', width: 1.5, dash: 'dot' }
            }
          ]}
          layout={{
            autosize: true,
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            margin: { l: 50, r: 20, t: 10, b: 30 },
            xaxis: {
              title: copy.lsAxis,
              gridcolor: 'rgba(255,255,255,0.06)',
              tickfont: { color: C.ice60, size: 10 },
              titlefont: { color: C.ice30, size: 11 }
            },
            yaxis: {
              title: copy.tempAxis,
              gridcolor: 'rgba(255,255,255,0.06)',
              tickfont: { color: C.ice60, size: 10 },
              titlefont: { color: C.ice30, size: 11 }
            },
            legend: {
              x: 0.05,
              y: 0.95,
              font: { color: C.ice60, size: 10 },
              bgcolor: 'rgba(0,0,0,0.5)'
            }
          }}
          config={{ displayModeBar: false, responsive: true }}
          useResizeHandler
          style={{ width: '100%', height: '100%' }}
        />

      </div>
    </div>
  );
}
