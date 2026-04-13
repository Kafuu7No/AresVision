import { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import C from '../../../constants/colors';
import { useSettings } from '../../../contexts/SettingsContext';
import { loadResearchSuiteCached } from './ResearchDataClient';

export default function SeasonalExtremesChart({ marsYear }) {
  const { settings } = useSettings();
  const isLight = settings?.theme === 'light';
  const isZh = settings?.language !== 'en';
  const plotText = isLight ? '#444444' : 'rgba(255,255,255,0.85)';
  const plotGrid = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.14)';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const copy = isZh
    ? {
      loading: '正在加载季节极值图…',
      noData: '暂无数据',
      amp: '振幅',
      peak: '峰值 Ls',
    }
    : {
      loading: 'Loading seasonal extremes...',
      noData: 'No data',
      amp: 'Amplitude',
      peak: 'Peak Ls',
    };

  useEffect(() => {
    let active = true;
    setLoading(true);

    loadResearchSuiteCached(marsYear)
      .then((res) => {
        if (active) setData(res?.seasonal_extremes || null);
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
  }, [marsYear]);

  if (loading) return <div style={{ color: C.ice60, fontSize: 12 }}>{copy.loading}</div>;
  if (!data?.bands?.length) return <div style={{ color: C.mars, fontSize: 12 }}>{copy.noData}</div>;

  return (
    <div style={{ width: '100%', height: 340 }}>
      <Plot
        data={[
          {
            x: data.bands,
            y: data.amplitude,
            type: 'bar',
            name: copy.amp,
            marker: { color: 'rgba(199,91,57,0.75)' },
          },
          {
            x: data.bands,
            y: data.peak_ls,
            type: 'scatter',
            mode: 'lines+markers',
            name: copy.peak,
            yaxis: 'y2',
            line: { color: C.blue, width: 2.5, shape: 'spline' },
            marker: { size: 7, color: C.blue },
          },
        ]}
        layout={{
          autosize: true,
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          margin: { l: 56, r: 58, t: 8, b: 76 },
          barmode: 'group',
          xaxis: { tickfont: { color: plotText, size: 10 }, gridcolor: plotGrid, automargin: true },
          yaxis: {
            title: copy.amp,
            titlefont: { color: plotText, size: 11 },
            tickfont: { color: plotText, size: 10 },
            gridcolor: plotGrid,
            automargin: true,
          },
          yaxis2: {
            title: copy.peak,
            titlefont: { color: plotText, size: 11 },
            tickfont: { color: plotText, size: 10 },
            overlaying: 'y',
            side: 'right',
            showgrid: false,
          },
          legend: { orientation: 'h', y: 1.12, x: 0, font: { color: plotText, size: 10 } },
        }}
        config={{ displayModeBar: false, responsive: true }}
        useResizeHandler
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
