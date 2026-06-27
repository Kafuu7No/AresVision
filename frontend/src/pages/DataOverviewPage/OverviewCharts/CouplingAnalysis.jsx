import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import C from '../../../constants/colors';
import { useSettings } from '../../../contexts/SettingsContext';
import { fetchOverviewCouplingData } from '../../../services/api';
import useAiInsightRegistration from './useAiInsightRegistration';
import { correlation, roundValue, sampleSeries, summarizeSeries } from './aiInsight';

export default function CouplingAnalysis({ marsYear, dataSourceMode = 'default' }) {
  const { settings } = useSettings();

  const isLight = settings?.theme === 'light';
  const plotText = isLight ? 'rgba(23,33,47,0.88)' : 'rgba(236,244,255,0.94)';
  const plotGrid = isLight ? 'rgba(23,33,47,0.12)' : 'rgba(160,196,240,0.16)';

  const isZh = settings.language === 'zh';
  const chartHeight = 360;
  
  const copy = isZh ? {
    title: '沙尘-臭氧耦合分析',
    desc: '观察全球沙尘光学厚度剧增对平均臭氧柱含量的“冲刷”效应。',
    loading: '加载中...',
    noData: '暂无数据',
    ozoneAxis: '全球平均臭氧 (m-atm cm)',
    dustAxis: '全球平均沙尘厚度 (DOD)',
    lsAxis: '太阳黄经 Ls',
    ozoneSeries: '臭氧',
    dustSeries: '沙尘',
  } : {
    title: 'Dust-Ozone Coupling Analysis',
    desc: 'Observe the "washout" effect of global DOD surges on mean ozone column.',
    loading: 'Loading...',
    noData: 'No data',
    ozoneAxis: 'Global Mean O3 (m-atm cm)',
    dustAxis: 'Global Mean DOD',
    lsAxis: 'Solar Longitude Ls',
    ozoneSeries: 'Ozone',
    dustSeries: 'Dust',
  };

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchOverviewCouplingData(marsYear, 'o3col', 'Dust_Optical_Depth', { dataSource: dataSourceMode })
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
  }, [marsYear, dataSourceMode]);

  const diagnostics = useMemo(() => {
    if (!data?.var1?.length || !data?.var2?.length) return null;
    return {
      corr: correlation(data.var1, data.var2),
      ozoneStats: summarizeSeries(data.var1),
      dustStats: summarizeSeries(data.var2),
      ozoneSamples: sampleSeries(data.var1, data.ls || [], 10),
      dustSamples: sampleSeries(data.var2, data.ls || [], 10),
    };
  }, [data]);

  const aiInsightProvider = useCallback(() => ({
    card: 'coupling',
    marsYear,
    status: loading ? 'loading' : (data?.ls?.length ? 'ready' : 'empty'),
    lsCount: data?.ls?.length || 0,
    correlation: diagnostics?.corr ?? null,
    ozone: diagnostics
      ? {
        stats: diagnostics.ozoneStats,
        samples: diagnostics.ozoneSamples,
      }
      : null,
    dust: diagnostics
      ? {
        stats: diagnostics.dustStats,
        samples: diagnostics.dustSamples,
      }
      : null,
    lsRange: {
      min: roundValue(data?.ls?.[0]),
      max: roundValue(data?.ls?.[data?.ls?.length - 1]),
    },
  }), [data, diagnostics, loading, marsYear]);

  useAiInsightRegistration('coupling', aiInsightProvider);

  if (loading) {
    return <div style={{ color: C.ice, padding: 20 }}>{copy.loading}</div>;
  }

  if (!data || !data.ls) {
    return <div style={{ color: C.ice, padding: 20 }}>{copy.noData}</div>;
  }

  return (
    <div style={{ width: '100%', display: 'grid', gridTemplateRows: 'auto auto', gap: 12 }}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ color: C.ice, margin: '0 0 4px 0', fontSize: 'calc(16px * var(--font-scale, 1))' }}>{copy.title}</h3>
        <p style={{ color: C.ice60, fontSize: 'calc(12px * var(--font-scale, 1))', margin: 0 }}>{copy.desc}</p>
      </div>
      <div style={{ minHeight: chartHeight, height: chartHeight }}>
        <Plot
          data={[
            {
              x: data.ls,
              y: data.var1,
              type: 'scatter',
              mode: 'lines',
              name: copy.ozoneSeries,
              line: { color: C.blue, width: 3 },
              yaxis: 'y1'
            },
            {
              x: data.ls,
              y: data.var2,
              type: 'scatter',
              mode: 'lines',
              name: copy.dustSeries,
              line: { color: C.mars, width: 3, dash: 'dot' },
              yaxis: 'y2'
            }
          ]}
          layout={{
            autosize: true,
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            margin: { l: 50, r: 74, t: 30, b: 40 },
            xaxis: {
              title: copy.lsAxis,
              gridcolor: plotGrid,
              tickfont: { color: plotText, size: 10  },
              titlefont: { color: plotText, size: 11  },
              automargin: true,
            },
            yaxis: {
              gridcolor: plotGrid,
              tickfont: { color: plotText, size: 10  },
              automargin: true,
              title: {
                text: copy.ozoneAxis,
                standoff: 10,
                font: { color: C.blue, size: 11 },
              },
            },
            yaxis2: {
              side: 'right',
              overlaying: 'y',
              gridcolor: 'transparent',
              tickfont: { color: plotText, size: 10  },
              automargin: true,
              title: {
                text: copy.dustAxis,
                standoff: 14,
                font: { color: C.mars, size: 11 },
              },
            },
            legend: {
              orientation: 'h',
              y: 1.1,
              font: { color: plotText, size: 11  },
            }
          }}
          config={{ displayModeBar: false, responsive: true }}
          useResizeHandler
          style={{ width: '100%', height: chartHeight }}
        />
      </div>
    </div>
  );
}
