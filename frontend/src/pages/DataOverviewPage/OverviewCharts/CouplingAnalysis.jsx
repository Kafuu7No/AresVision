import React, { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import C from '../../../constants/colors';
import { useT } from '../../../i18n';
import { useSettings } from '../../../contexts/SettingsContext';
import { fetchCouplingData } from '../../../services/api';

export default function CouplingAnalysis({ marsYear }) {
  const t = useT();
  const { settings } = useSettings();
  const isZh = settings.language === 'zh';
  
  const copy = isZh ? {
    title: '沙尘-臭氧耦合分析',
    desc: '观察全球沙尘光学厚度剧增对平均臭氧柱含量的“冲刷”效应。',
    loading: '加载中...',
    noData: '暂无数据',
    ozoneAxis: '全球平均臭氧 (m-atm cm)',
    dustAxis: '全球平均沙尘厚度 (DOD)',
    lsAxis: '太阳黄经 Ls'
  } : {
    title: 'Dust-Ozone Coupling Analysis',
    desc: 'Observe the "washout" effect of global DOD surges on mean ozone column.',
    loading: 'Loading...',
    noData: 'No Data',
    ozoneAxis: 'Global Mean O3 (m-atm cm)',
    dustAxis: 'Global Mean DOD',
    lsAxis: 'Solar Longitude Ls'
  };

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchCouplingData(marsYear, 'o3col', 'Dust_Optical_Depth')
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
      <div style={{ flex: 1, minHeight: 300 }}>
        <Plot
          data={[
            {
              x: data.ls,
              y: data.var1,
              type: 'scatter',
              mode: 'lines',
              name: 'Ozone',
              line: { color: C.blue, width: 3 },
              yaxis: 'y1'
            },
            {
              x: data.ls,
              y: data.var2,
              type: 'scatter',
              mode: 'lines',
              name: 'Dust',
              line: { color: C.mars, width: 3, dash: 'dot' },
              yaxis: 'y2'
            }
          ]}
          layout={{
            autosize: true,
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            margin: { l: 50, r: 50, t: 30, b: 40 },
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
              titlefont: { color: C.blue, size: 11 }
            },
            yaxis2: {
              title: copy.dustAxis,
              side: 'right',
              overlaying: 'y',
              gridcolor: 'transparent',
              tickfont: { color: C.ice60, size: 10 },
              titlefont: { color: C.mars, size: 11 }
            },
            legend: {
              orientation: 'h',
              y: 1.1,
              font: { color: C.ice60, size: 11 },
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
