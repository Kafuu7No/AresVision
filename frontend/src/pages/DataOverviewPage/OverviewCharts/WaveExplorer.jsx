import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import C from '../../../constants/colors';
import { useSettings } from '../../../contexts/SettingsContext';
import { fetchZonalAnomaly } from '../../../services/api';
import useAiInsightRegistration from './useAiInsightRegistration';
import { roundValue, sampleSeries } from './aiInsight';

export default function WaveExplorer({ marsYear, dataSourceMode = 'default' }) {
  const { settings } = useSettings();

  const isLight = settings?.theme === 'light';
  const plotText = isLight ? '#444444' : 'rgba(255,255,255,0.85)';
  const plotGrid = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)';

  const isZh = settings.language === 'zh';
  
  const copy = isZh ? {
    title: '行星波与纬向距平',
    desc: '展示受塔尔西斯等地形影响产生的臭氧驻波结构。',
    loading: '加载距平数据...',
    noData: '暂无数据',
    lonAxis: '经度 (°E)',
    latAxis: '纬度 (°N)',
    colorbarTitle: '距平 (m-atm cm)',
  } : {
    title: 'Planetary Wave Explorer',
    desc: 'Reveal stationary wave patterns induced by Martian topography.',
    loading: 'Loading zonal anomaly map...',
    noData: 'No data',
    lonAxis: 'Longitude (°E)',
    latAxis: 'Latitude (°N)',
    colorbarTitle: 'Anomaly (m-atm cm)',
  };

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchZonalAnomaly(marsYear, 'o3col', { dataSource: dataSourceMode })
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
    if (!data?.x?.length || !data?.y?.length || !data?.z?.length) return null;
    const rowIndex = Math.floor(data.y.length / 2);
    const equatorSeries = Array.isArray(data.z[rowIndex]) ? data.z[rowIndex] : [];
    return {
      valueRange: {
        min: roundValue(data.min),
        max: roundValue(data.max),
        maxAbs: roundValue(Math.max(Math.abs(data.min || 0), Math.abs(data.max || 0))),
      },
      equatorSamples: sampleSeries(equatorSeries, data.x, 12),
    };
  }, [data]);

  const aiInsightProvider = useCallback(() => ({
    card: 'wave',
    marsYear,
    variable: 'o3col',
    status: loading ? 'loading' : (data?.z?.length ? 'ready' : 'empty'),
    dimensions: {
      lonCount: data?.x?.length || 0,
      latCount: data?.y?.length || 0,
    },
    valueRange: diagnostics?.valueRange || null,
    equatorialAnomalySamples: diagnostics?.equatorSamples || [],
  }), [data, diagnostics, loading, marsYear]);

  useAiInsightRegistration('wave', aiInsightProvider);

  if (loading) {
    return <div style={{ color: C.ice, padding: 20 }}>{copy.loading}</div>;
  }

  if (!data || !data.x) {
    return <div style={{ color: C.ice, padding: 20 }}>{copy.noData}</div>;
  }

  // Calculate dynamic colorscale limits to be symmetrical around 0
  const maxAbs = Math.max(Math.abs(data.min || 0), Math.abs(data.max || 0));

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h3 style={{ color: C.ice, margin: '0 0 4px 0', fontSize: 'calc(16px * var(--font-scale, 1))' }}>{copy.title}</h3>
        <p style={{ color: C.ice60, fontSize: 'calc(12px * var(--font-scale, 1))', margin: 0 }}>{copy.desc}</p>
      </div>
      <div style={{ height: '360px' }}>
        <Plot
          data={[
            {
              z: data.z,
              x: data.x,
              y: data.y,
              type: 'heatmap',
              colorscale: 'RdBu',
              zmin: -maxAbs,
              zmax: maxAbs,
              colorbar: {
                title: copy.colorbarTitle,
                titleside: 'right',
                titlefont: { color: plotText, size: 10  },
                tickfont: { color: plotText, size: 10  },
                outlinewidth: 0,
                xpad: 10
              }
            }
          ]}
          layout={{
            autosize: true,
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            margin: { l: 50, r: 20, t: 30, b: 40 },
            xaxis: {
              title: copy.lonAxis,
              gridcolor: plotGrid,
              tickfont: { color: plotText, size: 10  },
              titlefont: { color: plotText, size: 11  }
            },
            yaxis: {
              title: copy.latAxis,
              gridcolor: plotGrid,
              tickfont: { color: plotText, size: 10  },
              titlefont: { color: plotText, size: 11  }
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
