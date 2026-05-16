import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Plot from 'react-plotly.js';
import C from '../../../constants/colors';
import { useT } from '../../../i18n';
import { useSettings } from '../../../contexts/SettingsContext';
import { fetchDiurnal } from '../../../services/api';
import { convertOzone, ozoneLabel } from '../../../utils/units';
import { fmtNum } from '../../../utils/fmt';
import useAiInsightRegistration from './useAiInsightRegistration';
import { roundValue, sampleSeries } from './aiInsight';

const LAT_BANDS = [
  'Polar North (60N-90N)',
  'Mid-Lat North (30N-60N)',
  'Equatorial (30S-30N)',
  'Mid-Lat South (30S-60S)',
  'Polar South (60S-90S)',
];

export default function RealtimeMonitor({ marsYear, lsValue, dataSourceMode = 'default' }) {
  const t = useT();
  const { settings } = useSettings();

  const isLight = settings?.theme === 'light';
  const plotText = isLight ? 'rgba(23,33,47,0.88)' : 'rgba(236,244,255,0.94)';
  const plotGrid = isLight ? 'rgba(23,33,47,0.12)' : 'rgba(160,196,240,0.16)';

  const isZh = settings.language !== 'en';
  const copy = isZh ? {
    loading: '正在加载昼夜变化...',
    mean: '均值',
    peak: '峰值',
    amplitude: '振幅',
    selection: '当前选择',
    at: '出现在',
    ampDesc: '最大值 - 最小值',
    localTime: '地方时（小时）',
    ozone: '臭氧',
    hoverHour: '地方时',
    marsYear: '火星年',
    solarLongitude: '太阳黄经',
    polarNorth: '北极区',
    midNorth: '北中纬',
    equatorial: '赤道区',
    midSouth: '南中纬',
    polarSouth: '南极区',
  } : {
    loading: 'LOADING DIURNAL PROFILE...',
    mean: 'MEAN',
    peak: 'PEAK',
    amplitude: 'AMPLITUDE',
    selection: 'SELECTION',
    at: 'at',
    ampDesc: 'max - min',
    localTime: 'Local time (hour)',
    ozone: 'Ozone',
    hoverHour: 'Local hour',
    marsYear: 'MY',
    solarLongitude: 'Ls',
    polarNorth: 'Polar North',
    midNorth: 'Mid-Lat North',
    equatorial: 'Equatorial',
    midSouth: 'Mid-Lat South',
    polarSouth: 'Polar South',
  };
  const shortLabels = {
    'Polar North (60N-90N)': copy.polarNorth,
    'Mid-Lat North (30N-60N)': copy.midNorth,
    'Equatorial (30S-30N)': copy.equatorial,
    'Mid-Lat South (30S-60S)': copy.midSouth,
    'Polar South (60S-90S)': copy.polarSouth,
  };
  const [latBand, setLatBand] = useState(LAT_BANDS[2]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasDataRef = useRef(false);

  useEffect(() => {
    let active = true;
    const hasRenderableData = hasDataRef.current;
    if (hasRenderableData) setRefreshing(true);
    else setLoading(true);

    fetchDiurnal(marsYear, lsValue, latBand, { dataSource: dataSourceMode })
      .then((res) => {
        if (active) {
          setData(res);
          hasDataRef.current = !!res?.ozone_values?.length;
          setLoading(false);
          setRefreshing(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => {
      active = false;
    };
  }, [marsYear, lsValue, latBand, dataSourceMode]);

  const stats = useMemo(() => {
    if (!data?.ozone_values?.length) return null;
    const values = data.ozone_values;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const peakHour = data.hours[values.indexOf(max)];
    return { max, min, mean, peakHour, amplitude: max - min };
  }, [data]);

  const aiInsightProvider = useCallback(() => ({
    card: 'realtime',
    marsYear,
    ls: roundValue(lsValue, 2),
    latBand,
    latBandLabel: shortLabels[latBand] || latBand,
    status: loading && !data?.ozone_values?.length ? 'loading' : (data?.ozone_values?.length ? 'ready' : 'empty'),
    metrics: stats
      ? {
        mean: roundValue(stats.mean),
        max: roundValue(stats.max),
        min: roundValue(stats.min),
        amplitude: roundValue(stats.amplitude),
        peakHour: roundValue(stats.peakHour, 2),
      }
      : null,
    samples: sampleSeries(data?.ozone_values || [], data?.hours || [], 12),
  }), [data, latBand, loading, lsValue, marsYear, shortLabels, stats]);

  useAiInsightRegistration('realtime', aiInsightProvider);

  if (loading && !data?.ozone_values?.length) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.ice, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 16,
            height: 16,
            border: `2px solid rgba(199,91,57,0.2)`,
            borderTop: `2px solid ${C.mars}`,
            borderRadius: '50%',
            animation: 'spin-slow 1s linear infinite',
          }} />
          {copy.loading}
        </div>
      </div>
    );
  }

  if (!data?.ozone_values?.length) {
    return <div style={{ color: C.mars, padding: 20 }}>{t('overview.charts.noData')}</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateRows: 'auto auto minmax(320px, 1fr)', gap: 16, overflowX: 'hidden', overflowY: 'auto', scrollbarGutter: 'stable', paddingRight: 4 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {LAT_BANDS.map((item) => {
          const active = item === latBand;
          return (
            <button
              key={item}
              onClick={() => setLatBand(item)}
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                border: `1px solid ${active ? C.mars : C.border}`,
                background: active ? 'rgba(199,91,57,0.12)' : 'rgba(255,255,255,0.03)',
                color: active ? C.mars : C.ice60,
                fontSize: 'calc(11px * var(--font-scale, 1))',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              {shortLabels[item]}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(199,91,57,0.08)', border: '1px solid rgba(199,91,57,0.18)' }}>
          <div style={{ color: C.ice30, fontSize: 'calc(10px * var(--font-scale, 1))', letterSpacing: 1 }}>{copy.mean}</div>
          <div style={{ marginTop: 6, color: C.mars, fontSize: 'calc(18px * var(--font-scale, 1))', fontWeight: 800, fontFamily: 'var(--font-display)' }}>
            {fmtNum(convertOzone(stats.mean, 'um-atm'), 3)}
          </div>
          <div style={{ color: C.ice30, fontSize: 'calc(11px * var(--font-scale, 1))' }}>{ozoneLabel('um-atm')}</div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(74,158,255,0.08)', border: '1px solid rgba(74,158,255,0.18)' }}>
          <div style={{ color: C.ice30, fontSize: 'calc(10px * var(--font-scale, 1))', letterSpacing: 1 }}>{copy.peak}</div>
          <div style={{ marginTop: 6, color: C.blue, fontSize: 'calc(18px * var(--font-scale, 1))', fontWeight: 800, fontFamily: 'var(--font-display)' }}>
            {fmtNum(stats.max, 3)}
          </div>
          <div style={{ color: C.ice30, fontSize: 'calc(11px * var(--font-scale, 1))' }}>{copy.at} {fmtNum(stats.peakHour, 1)}h</div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(74,207,172,0.08)', border: '1px solid rgba(74,207,172,0.18)' }}>
          <div style={{ color: C.ice30, fontSize: 'calc(10px * var(--font-scale, 1))', letterSpacing: 1 }}>{copy.amplitude}</div>
          <div style={{ marginTop: 6, color: '#4acfac', fontSize: 'calc(18px * var(--font-scale, 1))', fontWeight: 800, fontFamily: 'var(--font-display)' }}>
            {fmtNum(stats.amplitude, 3)}
          </div>
          <div style={{ color: C.ice30, fontSize: 'calc(11px * var(--font-scale, 1))' }}>{copy.ampDesc}</div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
          <div style={{ color: C.ice30, fontSize: 'calc(10px * var(--font-scale, 1))', letterSpacing: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span>{copy.selection}</span>
            {refreshing && (
              <span style={{ color: C.ice60, fontSize: 'calc(9px * var(--font-scale, 1))', letterSpacing: 0.6 }}>
                {isZh ? '更新中...' : 'Updating...'}
              </span>
            )}
          </div>
          <div style={{ marginTop: 6, color: C.ice, fontSize: 'calc(13px * var(--font-scale, 1))', fontWeight: 700 }}>{shortLabels[latBand]}</div>
          <div style={{ color: C.ice30, fontSize: 'calc(11px * var(--font-scale, 1))' }}>{copy.marsYear}{marsYear} · {copy.solarLongitude} {fmtNum(lsValue, 0)}°</div>
        </div>
      </div>

      <div style={{ minHeight: 320 }}>
        <Plot
          data={[{
            x: data.hours,
            y: data.ozone_values,
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: C.mars, width: 3, shape: 'spline' },
            marker: { size: 7, color: C.blue, line: { color: '#fff', width: 1 } },
            fill: 'tozeroy',
            fillcolor: 'rgba(199,91,57,0.12)',
            hovertemplate: `${copy.hoverHour} %{x:.1f}<br>${copy.ozone} %{y:.4f} μm-atm<extra></extra>`,
          }]}
          layout={{
            autosize: true,
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            margin: { l: 58, r: 24, t: 18, b: 48 },
            xaxis: {
              title: copy.localTime,
              gridcolor: plotGrid,
              tickfont: { color: plotText, size: 10  },
              titlefont: { color: plotText, size: 11  },
              automargin: true,
            },
            yaxis: {
              title: `${copy.ozone} (${ozoneLabel('um-atm')})`,
              gridcolor: plotGrid,
              tickfont: { color: plotText, size: 10  },
              titlefont: { color: plotText, size: 11  },
              automargin: true,
            },
            showlegend: false,
          }}
          config={{ displayModeBar: false, responsive: true }}
          useResizeHandler
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}
