import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import C from '../../../constants/colors';
import { useSettings } from '../../../contexts/SettingsContext';
import { fetchPolarDynamics } from '../../../services/api';
import useAiInsightRegistration from './useAiInsightRegistration';
import { roundValue, sampleSeries, summarizeSeries } from './aiInsight';

export default function PolarDynamics({ marsYear, dataSourceMode = 'default' }) {
  const { settings } = useSettings();

  const isLight = settings?.theme === 'light';
  const plotText = isLight ? '#444444' : 'rgba(255,255,255,0.85)';
  const plotGrid = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)';

  const isZh = settings.language === 'zh';
  
  const copy = isZh ? {
    title: '极地涡旋与动力输送',
    desc: '对比南北极极夜前后的臭氧急剧积聚趋势及其与温度的关系。',
    loading: '加载极地数据...',
    noData: '暂无数据',
    ozoneAxis: '极地平均 O3 (m-atm cm)',
    tempAxis: '极地平均空气温度 (K)',
    lsAxis: '太阳黄经 Ls (°)',
    northOzone: '北半球 O3 (>60N)',
    southOzone: '南半球 O3 (<60S)',
    northTemp: '北半球温度 (>60N)',
    southTemp: '南半球温度 (<60S)',
  } : {
    title: 'Polar Dynamics & Vortex Tracker',
    desc: 'Compare rapid polar ozone buildup before and after polar night.',
    loading: 'Loading polar data...',
    noData: 'No data',
    ozoneAxis: 'Polar Mean O3 (m-atm cm)',
    tempAxis: 'Polar Mean Air Temp (K)',
    lsAxis: 'Solar Longitude Ls (°)',
    northOzone: 'North O3 (>60N)',
    southOzone: 'South O3 (<60S)',
    northTemp: 'North Temp (>60N)',
    southTemp: 'South Temp (<60S)',
  };

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPolarDynamics(marsYear, { dataSource: dataSourceMode })
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
    if (!data?.ls?.length) return null;
    const northOzone = data?.north?.ozone || [];
    const southOzone = data?.south?.ozone || [];
    const northTemp = data?.north?.temp || [];
    const southTemp = data?.south?.temp || [];

    const findPeak = (series) => {
      if (!series.length) return { value: null, ls: null };
      let bestIndex = -1;
      let bestValue = Number.NEGATIVE_INFINITY;
      series.forEach((value, index) => {
        if (!Number.isFinite(value)) return;
        if (value > bestValue) {
          bestValue = value;
          bestIndex = index;
        }
      });
      if (bestIndex < 0) return { value: null, ls: null };
      return { value: roundValue(series[bestIndex]), ls: roundValue(data.ls[bestIndex]) };
    };

    return {
      northOzoneStats: summarizeSeries(northOzone),
      southOzoneStats: summarizeSeries(southOzone),
      northTempStats: summarizeSeries(northTemp),
      southTempStats: summarizeSeries(southTemp),
      northOzonePeak: findPeak(northOzone),
      southOzonePeak: findPeak(southOzone),
      northOzoneSamples: sampleSeries(northOzone, data.ls, 8),
      southOzoneSamples: sampleSeries(southOzone, data.ls, 8),
    };
  }, [data]);

  const aiInsightProvider = useCallback(() => ({
    card: 'polar',
    marsYear,
    status: loading ? 'loading' : (data?.ls?.length ? 'ready' : 'empty'),
    lsCount: data?.ls?.length || 0,
    north: diagnostics
      ? {
        ozoneStats: diagnostics.northOzoneStats,
        tempStats: diagnostics.northTempStats,
        ozonePeak: diagnostics.northOzonePeak,
        ozoneSamples: diagnostics.northOzoneSamples,
      }
      : null,
    south: diagnostics
      ? {
        ozoneStats: diagnostics.southOzoneStats,
        tempStats: diagnostics.southTempStats,
        ozonePeak: diagnostics.southOzonePeak,
        ozoneSamples: diagnostics.southOzoneSamples,
      }
      : null,
  }), [data, diagnostics, loading, marsYear]);

  useAiInsightRegistration('polar', aiInsightProvider);

  if (loading) {
    return <div style={{ color: C.ice, padding: 20 }}>{copy.loading}</div>;
  }

  if (!data || !data.ls) {
    return <div style={{ color: C.ice, padding: 20 }}>{copy.noData}</div>;
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h3 style={{ color: C.ice, margin: '0 0 4px 0', fontSize: 16 }}>{copy.title}</h3>
        <p style={{ color: C.ice60, fontSize: 12, margin: 0 }}>{copy.desc}</p>
      </div>

      <div style={{ height: '600px', display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr 1fr', gap: 10 }}>
        
        {/* Ozone vs Ls (North and South) */}
        <Plot
          data={[
            {
              x: data.ls,
              y: data.north.ozone,
              type: 'scatter',
              mode: 'lines',
              name: copy.northOzone,
              line: { color: C.blue, width: 2.5 }
            },
            {
              x: data.ls,
              y: data.south.ozone,
              type: 'scatter',
              mode: 'lines',
              name: copy.southOzone,
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
              gridcolor: plotGrid,
              tickfont: { color: plotText, size: 10  },
              titlefont: { color: plotText, size: 11  }
            },
            yaxis: {
              title: copy.ozoneAxis,
              gridcolor: plotGrid,
              tickfont: { color: plotText, size: 10  },
              titlefont: { color: plotText, size: 11  }
            },
            legend: {
              x: 0.05,
              y: 0.95,
              font: { color: plotText, size: 10  },
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
              name: copy.northTemp,
              line: { color: '#00d2ff', width: 1.5 }
            },
            {
              x: data.ls,
              y: data.south.temp,
              type: 'scatter',
              mode: 'lines',
              name: copy.southTemp,
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
              gridcolor: plotGrid,
              tickfont: { color: plotText, size: 10  },
              titlefont: { color: plotText, size: 11  }
            },
            yaxis: {
              title: copy.tempAxis,
              gridcolor: plotGrid,
              tickfont: { color: plotText, size: 10  },
              titlefont: { color: plotText, size: 11  }
            },
            legend: {
              x: 0.05,
              y: 0.95,
              font: { color: plotText, size: 10  },
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
