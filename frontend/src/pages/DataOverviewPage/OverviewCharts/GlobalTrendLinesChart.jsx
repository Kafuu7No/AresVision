import { useCallback, useEffect, useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import C from '../../../constants/colors';
import { useSettings } from '../../../contexts/SettingsContext';
import { loadResearchSuiteCached } from './ResearchDataClient';
import useAiInsightRegistration from './useAiInsightRegistration';
import { roundValue, sampleSeries, summarizeSeries } from './aiInsight';

const LABELS = {
  o3: { zh: '臭氧', en: 'O3' },
  temp: { zh: '温度', en: 'Temperature' },
  solar: { zh: '太阳辐射', en: 'Solar Flux' },
  wind: { zh: '风速', en: 'Wind Speed' },
};

const DISPLAY_SERIES_KEYS = ['o3', 'temp', 'solar', 'wind'];

export default function GlobalTrendLinesChart({ marsYear, dataSourceMode = 'default' }) {
  const { settings } = useSettings();
  const isLight = settings?.theme === 'light';
  const isZh = settings?.language !== 'en';
  const plotText = isLight ? 'rgba(23,33,47,0.88)' : 'rgba(236,244,255,0.94)';
  const plotGrid = isLight ? 'rgba(23,33,47,0.12)' : 'rgba(160,196,240,0.15)';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const copy = isZh
    ? {
      loading: '正在加载全局趋势线…',
      noData: '暂无数据',
      x: 'Ls',
      y: '标准化值',
      noteTitle: '视图说明：',
      noteBody: '该图对 O3、温度、太阳辐射、风速做全球平均后再标准化（Z-score），用于比较变量间同步变化趋势，不表示绝对数值大小。',
    }
    : {
      loading: 'Loading trend lines...',
      noData: 'No data',
      x: 'Ls',
      y: 'Z-score',
      noteTitle: 'View Note:',
      noteBody: 'This chart compares globally averaged O3, temperature, solar flux and wind after Z-score normalization. It emphasizes synchronized trends rather than absolute magnitudes.',
    };

  useEffect(() => {
    let active = true;
    setLoading(true);

    loadResearchSuiteCached(marsYear, { dataSource: dataSourceMode })
      .then((res) => {
        if (active) setData(res?.trend_lines || null);
      })
      .catch((err) => {
        console.error(err);
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [marsYear, dataSourceMode]);

  const traces = useMemo(() => {
    const ls = data?.ls || [];
    const series = data?.series || {};
    const palette = {
      o3: C.mars,
      temp: '#4acfac',
      solar: '#6aa9ff',
      wind: '#d2b48c',
    };

    return DISPLAY_SERIES_KEYS.filter((key) => Array.isArray(series[key])).map((key) => {
      const label = LABELS[key] ? (isZh ? LABELS[key].zh : LABELS[key].en) : key.toUpperCase();
      return {
        x: ls,
        y: series[key],
        type: 'scatter',
        mode: 'lines',
        name: label,
        line: { width: key === 'o3' ? 3 : 2, color: palette[key] || C.blue, shape: 'spline' },
        hovertemplate: `${label} %{y:.3f}<extra></extra>`,
      };
    });
  }, [data, isZh]);

  const aiInsightProvider = useCallback(() => {
    const lsAxis = data?.ls || [];
    const series = data?.series || {};
    const seriesSummary = DISPLAY_SERIES_KEYS
      .filter((key) => Array.isArray(series[key]))
      .map((key) => {
        const values = series[key];
        const first = values.find((value) => Number.isFinite(value));
        const reversed = [...values].reverse();
        const last = reversed.find((value) => Number.isFinite(value));
        return {
          variable: key,
          label: LABELS[key] ? (isZh ? LABELS[key].zh : LABELS[key].en) : key,
          stats: summarizeSeries(values),
          delta: Number.isFinite(first) && Number.isFinite(last) ? roundValue(last - first) : null,
          sample: sampleSeries(values, lsAxis, 8),
        };
      });
    return {
      card: 'globalTrend',
      marsYear,
      status: loading ? 'loading' : (seriesSummary.length ? 'ready' : 'empty'),
      lsCount: lsAxis.length,
      series: seriesSummary,
    };
  }, [data, isZh, loading, marsYear]);

  useAiInsightRegistration('globalTrend', aiInsightProvider);

  if (loading) return <div style={{ color: C.ice60, fontSize: 'calc(12px * var(--font-scale, 1))' }}>{copy.loading}</div>;
  if (!traces.length) return <div style={{ color: C.mars, fontSize: 'calc(12px * var(--font-scale, 1))' }}>{copy.noData}</div>;

  return (
    <div style={{ width: '100%', display: 'grid', gap: 10 }}>
      <div style={{ width: '100%', height: 340 }}>
        <Plot
          data={traces}
          layout={{
            autosize: true,
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            margin: { l: 56, r: 18, t: 8, b: 52 },
            xaxis: {
              title: copy.x,
              titlefont: { color: plotText, size: 11 },
              tickfont: { color: plotText, size: 10 },
              gridcolor: plotGrid,
              automargin: true,
            },
            yaxis: {
              title: copy.y,
              titlefont: { color: plotText, size: 11 },
              tickfont: { color: plotText, size: 10 },
              gridcolor: plotGrid,
              automargin: true,
            },
            legend: { orientation: 'h', y: 1.13, x: 0, font: { color: plotText, size: 10 } },
          }}
          config={{ displayModeBar: false, responsive: true }}
          useResizeHandler
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      <div
        style={{
          padding: '12px 14px',
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          background: 'rgba(255,255,255,0.03)',
          color: C.ice60,
          fontSize: 'calc(12px * var(--font-scale, 1))',
          lineHeight: 1.65,
        }}
      >
        <span style={{ color: C.ice, fontWeight: 700 }}>{copy.noteTitle}</span> {copy.noteBody}
      </div>
    </div>
  );
}
