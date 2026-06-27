import { useCallback, useMemo } from 'react';
import Plot from 'react-plotly.js';
import C from '../../../constants/colors';
import { useSettings } from '../../../contexts/SettingsContext';
import { useT } from '../../../i18n';
import { convertOzone, ozoneLabel } from '../../../utils/units';
import { fmtNum } from '../../../utils/fmt';
import useAiInsightRegistration from './useAiInsightRegistration';
import { roundValue, sampleSeries } from './aiInsight';
import { buildDistributionStats } from '../distributionStats';

export default function DataDistribution({ marsYear, lsValue, sliceData }) {
  const t = useT();
  const { settings } = useSettings();

  const isLight = settings?.theme === 'light';
  const plotText = isLight ? 'rgba(23,33,47,0.88)' : 'rgba(236,244,255,0.94)';
  const plotGrid = isLight ? 'rgba(23,33,47,0.12)' : 'rgba(160,196,240,0.16)';

  const ozoneUnit = settings.units.ozone;
  const precision = settings.precision;
  const isZh = settings.language !== 'en';
  const copy = isZh ? {
    myLs: '火星年 / Ls',
    marsYear: '火星年',
    solarLongitude: '太阳黄经',
    globalMean: '全球均值',
    p10: 'P10',
    p10Desc: '低值尾部',
    p90: 'P90',
    p90Desc: '高值尾部',
    histogram: '当前臭氧直方图',
    latProfile: '纬向均值剖面',
    ozoneAxis: '臭氧',
    count: '频数',
    latitude: '纬度 (°)',
    note: '当前分布图展示的是所选 MY/Ls 切片的全球臭氧统计。直方图用于看整体离散程度，纬向剖面用于看高值更偏向极区还是赤道。',
    hoverCount: '频数',
    hoverLat: '纬度',
    degree: '°',
  } : {
    myLs: 'MY / LS',
    marsYear: 'MY',
    solarLongitude: 'Ls',
    globalMean: 'GLOBAL MEAN',
    p10: 'P10',
    p10Desc: 'lower tail',
    p90: 'P90',
    p90Desc: 'upper tail',
    histogram: 'Current Ozone Histogram',
    latProfile: 'Latitudinal Mean Profile',
    ozoneAxis: 'Ozone',
    count: 'Count',
    latitude: 'Latitude (deg)',
    note: 'This panel summarizes the global ozone slice at the selected MY/Ls. The histogram shows overall spread, while the latitudinal profile highlights whether high values cluster toward the poles or the equator.',
    hoverCount: 'count',
    hoverLat: 'Lat',
    degree: 'deg',
  };

  const derived = useMemo(() => buildDistributionStats(sliceData), [sliceData]);

  const aiInsightProvider = useCallback(() => ({
    card: 'distribution',
    marsYear,
    ls: roundValue(lsValue, 2),
    status: derived ? 'ready' : 'empty',
    distribution: derived
      ? {
        pointCount: derived.values.length,
        mean: roundValue(derived.mean),
        p10: roundValue(derived.p10),
        p90: roundValue(derived.p90),
      }
      : null,
    histogramSample: sampleSeries(derived?.values || [], null, 10),
    latitudinalSample: sampleSeries(
      derived?.latProfile?.map((item) => item.mean) || [],
      derived?.latProfile?.map((item) => item.lat) || [],
      10,
    ),
  }), [derived, lsValue, marsYear]);

  useAiInsightRegistration('distribution', aiInsightProvider);

  if (!derived) {
    return <div style={{ color: C.mars, padding: 20 }}>{t('overview.charts.noData')}</div>;
  }

  const meanConverted = convertOzone(derived.mean, ozoneUnit);
  const p10Converted = convertOzone(derived.p10, ozoneUnit);
  const p90Converted = convertOzone(derived.p90, ozoneUnit);
  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: 16, overflowX: 'hidden', overflowY: 'auto', scrollbarGutter: 'stable', paddingRight: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(74,158,255,0.08)', border: '1px solid rgba(74,158,255,0.18)' }}>
          <div style={{ color: C.ice30, fontSize: 'calc(10px * var(--font-scale, 1))', letterSpacing: 1 }}>{copy.myLs}</div>
          <div style={{ marginTop: 6, color: C.blue, fontSize: 'calc(16px * var(--font-scale, 1))', fontWeight: 800, fontFamily: 'var(--font-display)' }}>{copy.marsYear}{marsYear}</div>
          <div style={{ color: C.ice30, fontSize: 'calc(11px * var(--font-scale, 1))' }}>{copy.solarLongitude} {fmtNum(lsValue, 0)} {copy.degree}</div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(199,91,57,0.08)', border: '1px solid rgba(199,91,57,0.18)' }}>
          <div style={{ color: C.ice30, fontSize: 'calc(10px * var(--font-scale, 1))', letterSpacing: 1 }}>{copy.globalMean}</div>
          <div style={{ marginTop: 6, color: C.mars, fontSize: 'calc(16px * var(--font-scale, 1))', fontWeight: 800, fontFamily: 'var(--font-display)' }}>{fmtNum(meanConverted, precision)}</div>
          <div style={{ color: C.ice30, fontSize: 'calc(11px * var(--font-scale, 1))' }}>{ozoneLabel(ozoneUnit)}</div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
          <div style={{ color: C.ice30, fontSize: 'calc(10px * var(--font-scale, 1))', letterSpacing: 1 }}>{copy.p10}</div>
          <div style={{ marginTop: 6, color: C.ice, fontSize: 'calc(16px * var(--font-scale, 1))', fontWeight: 800 }}>{fmtNum(p10Converted, precision)}</div>
          <div style={{ color: C.ice30, fontSize: 'calc(11px * var(--font-scale, 1))' }}>{copy.p10Desc}</div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
          <div style={{ color: C.ice30, fontSize: 'calc(10px * var(--font-scale, 1))', letterSpacing: 1 }}>{copy.p90}</div>
          <div style={{ marginTop: 6, color: C.ice, fontSize: 'calc(16px * var(--font-scale, 1))', fontWeight: 800 }}>{fmtNum(p90Converted, precision)}</div>
          <div style={{ color: C.ice30, fontSize: 'calc(11px * var(--font-scale, 1))' }}>{copy.p90Desc}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18, minHeight: 0 }}>
        <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, minHeight: 320, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)' }}>
          <div style={{ color: C.ice, fontSize: 'calc(14px * var(--font-scale, 1))', fontWeight: 800, marginBottom: 8, fontFamily: 'var(--font-display)' }}>{copy.histogram}</div>
          <div style={{ minHeight: 0 }}>
            <Plot
              data={[{
                x: derived.values.map((value) => convertOzone(value, ozoneUnit)),
                type: 'histogram',
                nbinsx: 28,
                marker: {
                  color: 'rgba(199,91,57,0.72)',
                  line: { color: 'rgba(255,255,255,0.18)', width: 1 },
                },
                hovertemplate: `%{x:.3f} ${ozoneLabel(ozoneUnit)}<br>${copy.hoverCount} %{y}<extra></extra>`,
              }]}
              layout={{
                autosize: true,
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                margin: { l: 52, r: 18, t: 16, b: 48 },
                xaxis: {
                  title: `${copy.ozoneAxis} (${ozoneLabel(ozoneUnit)})`,
                  gridcolor: plotGrid,
                  tickfont: { color: plotText, size: 10  },
                  titlefont: { color: plotText, size: 11  },
                  automargin: true,
                },
                yaxis: {
                  title: copy.count,
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

        <div style={{ display: 'grid', gridTemplateRows: 'minmax(320px, 1fr) auto', gap: 18, minHeight: 0 }}>
          <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, minHeight: 320, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)' }}>
            <div style={{ color: C.ice, fontSize: 'calc(14px * var(--font-scale, 1))', fontWeight: 800, marginBottom: 8, fontFamily: 'var(--font-display)' }}>{copy.latProfile}</div>
            <div style={{ minHeight: 0 }}>
              <Plot
                data={[{
                  x: derived.latProfile.map((item) => convertOzone(item.mean, ozoneUnit)),
                  y: derived.latProfile.map((item) => item.lat),
                  type: 'scatter',
                  mode: 'lines',
                  line: { color: C.blue, width: 3, shape: 'spline' },
                  fill: 'tozerox',
                  fillcolor: 'rgba(74,158,255,0.14)',
                  hovertemplate: `${copy.hoverLat} %{y:.1f}${isZh ? '°' : ' deg'}<br>%{x:.3f} ${ozoneLabel(ozoneUnit)}<extra></extra>`,
                }]}
                layout={{
                  autosize: true,
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  margin: { l: 62, r: 18, t: 16, b: 52 },
                  xaxis: {
                    title: `${copy.ozoneAxis} (${ozoneLabel(ozoneUnit)})`,
                    gridcolor: plotGrid,
                    tickfont: { color: plotText, size: 10  },
                    titlefont: { color: plotText, size: 11  },
                    automargin: true,
                  },
                  yaxis: {
                    title: copy.latitude,
                    range: [-90, 90],
                    tickvals: [-90, -60, -30, 0, 30, 60, 90],
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

          <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, lineHeight: 1.7, fontSize: 'calc(12px * var(--font-scale, 1))', color: C.ice60 }}>
            {copy.note}
          </div>
        </div>
      </div>
    </div>
  );
}
