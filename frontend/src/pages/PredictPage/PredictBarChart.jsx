import React from 'react';
import Plot from 'react-plotly.js';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import GlowCard from '../../components/GlowCard';
import { fmtNum } from '../../utils/fmt';
import { METRIC_META } from './PredictComponents';
import { useSettings } from '../../contexts/SettingsContext';

const SHORTHAND_MAP = {
  Temperature: 'T',
  Dust_Optical_Depth: 'D',
  Surface_Pressure: 'P',
  Solar_Flux_DN: 'S',
  U_Wind: 'U',
  V_Wind: 'V',
};

const GOOD_METRICS = new Set(['r2', 'ssim']);

const getShorthands = (vars) => {
  if (!vars || vars.length === 0) return 'baseline';
  return vars.map((v) => SHORTHAND_MAP[v] || v[0]).sort().join('');
};

const buildPolarRadii = (values) => {
  if (values.length === 0) return [];
  if (values.length === 1) return [88];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(Math.abs(max), 1);

  return values.map((value) => 34 + ((value - min) / span) * 58);
};

const buildSpectrumColors = (count, activeMetric) => {
  const positiveMetric = GOOD_METRICS.has(activeMetric);

  return Array.from({ length: count }, (_, index) => {
    const ratio = count <= 1 ? 0 : index / (count - 1);

    if (positiveMetric) {
      const red = Math.round(94 + (121 - 94) * ratio);
      const green = Math.round(232 - (29 * ratio));
      const blue = Math.round(191 + (64 * ratio));
      return `rgba(${red}, ${green}, ${blue}, ${0.96 - ratio * 0.26})`;
    }

    const red = Math.round(255 - (18 * ratio));
    const green = Math.round(143 + (44 * ratio));
    const blue = Math.round(104 + (50 * ratio));
    return `rgba(${red}, ${green}, ${blue}, ${0.96 - ratio * 0.28})`;
  });
};

const withAlpha = (color, alpha) => {
  if (!color) return `rgba(255, 255, 255, ${alpha})`;

  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) hex = hex.split('').map((char) => char + char).join('');
    const int = Number.parseInt(hex, 16);
    const red = (int >> 16) & 255;
    const green = (int >> 8) & 255;
    const blue = int & 255;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  const rgb = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgb) {
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  }

  return color;
};

function MetricTabs({ activeMetric, setActiveMetric }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: 4,
        borderRadius: 14,
        background: C.bgMuted,
        border: `1px solid ${C.border}`,
        flexWrap: 'wrap',
      }}
    >
      {METRIC_META.map((metric) => {
        const active = metric.key === activeMetric;
        return (
          <button
            key={metric.key}
            onClick={() => setActiveMetric(metric.key)}
            style={{
              padding: '7px 12px',
              borderRadius: 10,
              border: 'none',
              background: active ? 'rgba(121,187,255,0.16)' : 'transparent',
              color: active ? C.blue : C.ice60,
              fontSize: 'calc(11px * var(--font-scale, 1))',
              fontWeight: active ? 700 : 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {metric.name}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({ selectedCompareIds, perfLoading, handleFetchPerformance, t }) {
  const disabled = selectedCompareIds.length === 0 || perfLoading;

  return (
    <div
      style={{
        padding: '36px 24px',
        borderRadius: 18,
        background: C.bgMuted,
        border: `1px dashed ${C.borderStrong}`,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 50,
          height: 50,
          margin: '0 auto 14px',
          borderRadius: 16,
          background: 'radial-gradient(circle at 30% 30%, rgba(179,155,255,0.28), rgba(121,187,255,0.08))',
          border: `1px solid ${withAlpha(C.purple, 0.4)}`,
          color: C.ice,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'calc(18px * var(--font-scale, 1))',
          fontWeight: 800,
          fontFamily: 'var(--font-display)',
          boxShadow: '0 0 36px rgba(121,187,255,0.12)',
        }}
      >
        {selectedCompareIds.length}
      </div>
      <div
        style={{
          fontSize: 'calc(15px * var(--font-scale, 1))',
          fontWeight: 700,
          color: C.ice,
          fontFamily: 'var(--font-display)',
        }}
      >
        {selectedCompareIds.length === 0 ? t('predict.selectModelsToCompare') : t('predict.readyToGenerate')}
      </div>
      <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice60, lineHeight: 1.65, marginTop: 8 }}>
        {t('predict.barChart.emptyDesc')}
      </div>
      <button
        onClick={handleFetchPerformance}
        disabled={disabled}
        style={{
          marginTop: 18,
          padding: '11px 18px',
          background: disabled ? 'rgba(179,155,255,0.12)' : 'rgba(121,187,255,0.12)',
          border: `1px solid ${disabled ? 'rgba(179,155,255,0.16)' : 'rgba(121,187,255,0.28)'}`,
          borderRadius: 12,
          color: disabled ? C.ice40 : C.blue,
          fontSize: 'calc(12px * var(--font-scale, 1))',
          fontWeight: 700,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        {perfLoading ? t('predict.generatingChartData') : t('predict.generateChartAction')}
      </button>
    </div>
  );
}

export default function PredictBarChart({
  isLight,
  performanceData,
  compareConfigs,
  selectedCompareIds,
  activeMetric = 'r2',
  setActiveMetric,
  plotTextColor,
  plotText60,
  plotGridColor,
  precision,
  handleFetchPerformance,
  perfLoading = false,
  showShapley,
  setShowShapley,
}) {
  const t = useT();
  const { settings } = useSettings();
  const isZh = settings?.language !== 'en';

  const copy = {
    summary: isZh
      ? '把已勾选的模型组合投射到极坐标频谱中，外圈越接近表示当前指标越优，便于快速识别最强组合。'
      : 'Project the selected model combinations into a polar spectrum so the strongest setup stands out at a glance.',
    emptyDesc: isZh
      ? '先在左侧勾选要比较的模型组合，再生成当前指标的极坐标频谱。'
      : 'Select model combinations first, then generate a polar spectrum for the current metric.',
    average: isZh ? '平均水平' : 'Average',
    spread: isZh ? '组间差距' : 'Spread',
    spreadHint: isZh ? '最佳与末位组合之间的指标差值' : 'Metric gap between the top and bottom configuration',
    refresh: isZh ? '刷新频谱' : 'Refresh spectrum',
    marginal: isZh ? '查看组合边际分析' : 'View marginal contribution',
    system: isZh ? '极坐标频谱' : 'Polar spectrum',
    systemHint: isZh ? '外圈更优，角度代表模型类别' : 'Outer orbit means stronger performance for the active metric',
  };

  if (!performanceData || !performanceData.results || selectedCompareIds.length === 0) {
    return (
      <GlowCard style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 'calc(15px * var(--font-scale, 1))', fontWeight: 700, color: C.ice, fontFamily: 'var(--font-display)' }}>
              {t('predict.barChartTitle')}
            </div>
            <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice60, marginTop: 6, lineHeight: 1.6 }}>
              {copy.summary}
            </div>
          </div>
          <MetricTabs activeMetric={activeMetric} setActiveMetric={setActiveMetric} />
        </div>

        <EmptyState
          selectedCompareIds={selectedCompareIds}
          perfLoading={perfLoading}
          handleFetchPerformance={handleFetchPerformance}
          t={(key) => {
            if (key === 'predict.barChart.emptyDesc') return copy.emptyDesc;
            return t(key);
          }}
        />
      </GlowCard>
    );
  }

  const spectrumData = [];
  selectedCompareIds.forEach((id) => {
    const config = compareConfigs.find((item) => item.id === id);
    let perfData = performanceData.results?.[id];

    if (!perfData && config) {
      perfData = performanceData.results?.[getShorthands(config.vars)];
    }
    if (!perfData) return;

    const metricKey = `global_${activeMetric}`;
    const value = perfData[metricKey] || 0;
    spectrumData.push({
      id,
      label: config?.label || id,
      value,
      order: GOOD_METRICS.has(activeMetric) ? value : -value,
    });
  });

  const sortedData = [...spectrumData].sort((a, b) => b.order - a.order);
  const metricMeta = METRIC_META.find((metric) => metric.key === activeMetric);
  const metricName = metricMeta?.name || activeMetric.toUpperCase();
  const best = sortedData[0];
  const worst = sortedData[sortedData.length - 1];
  const average = sortedData.length > 0
    ? sortedData.reduce((sum, item) => sum + item.value, 0) / sortedData.length
    : 0;
  const spread = best && worst ? Math.abs(best.value - worst.value) : 0;
  const metricAccent = GOOD_METRICS.has(activeMetric) ? C.green : C.mars;

  const angles = sortedData.map((_, index) => {
    const step = 360 / Math.max(sortedData.length, 1);
    return index * step;
  });
  const barWidth = Math.max(16, Math.min(48, (360 / Math.max(sortedData.length, 1)) * 0.64));
  const radii = buildPolarRadii(sortedData.map((item) => item.value));
  const averageRadius = radii.length > 0
    ? radii.reduce((sum, value) => sum + value, 0) / radii.length
    : 0;
  const spectrumColors = buildSpectrumColors(sortedData.length, activeMetric);

  return (
    <GlowCard style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 560 }}>
          <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.blue, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            {t('predict.barChart.analytics')}
          </div>
          <div style={{ marginTop: 8, fontSize: 'calc(15px * var(--font-scale, 1))', fontWeight: 700, color: C.ice, fontFamily: 'var(--font-display)' }}>
            {t('predict.barChartTitle')}
          </div>
          <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice60, marginTop: 6, lineHeight: 1.6 }}>
            {copy.summary}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowShapley({ visible: true, mode: 'marginal' })}
            style={{
              padding: '9px 14px',
              borderRadius: 12,
              border: `1px solid ${showShapley.visible && showShapley.mode === 'marginal' ? 'rgba(99,232,191,0.35)' : C.border}`,
              background: showShapley.visible && showShapley.mode === 'marginal' ? 'rgba(99,232,191,0.1)' : C.bgMuted,
              color: showShapley.visible && showShapley.mode === 'marginal' ? C.green : C.ice70,
              fontSize: 'calc(11px * var(--font-scale, 1))',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {copy.marginal}
          </button>

          <MetricTabs activeMetric={activeMetric} setActiveMetric={setActiveMetric} />

          <button
            onClick={handleFetchPerformance}
            disabled={perfLoading}
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: `1px solid ${C.borderStrong}`,
              background: C.bgMuted,
              color: perfLoading ? C.ice40 : C.ice70,
              fontSize: 'calc(11px * var(--font-scale, 1))',
              fontWeight: 700,
              cursor: perfLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {perfLoading ? t('predict.generatingChartData') : copy.refresh}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          {
            label: t('predict.barChart.topModel'),
            value: best?.label || '--',
            hint: best ? `${metricName}: ${fmtNum(best.value, precision)}` : '--',
            accent: metricAccent,
          },
          {
            label: copy.average,
            value: fmtNum(average, precision),
            hint: metricName,
            accent: C.blue,
          },
          {
            label: copy.spread,
            value: fmtNum(spread, precision),
            hint: copy.spreadHint,
            accent: C.purple,
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              padding: '14px 16px',
              borderRadius: 16,
              background: C.bgMuted,
              border: `1px solid ${C.border}`,
              boxShadow: isLight ? '0 10px 24px rgba(15,23,42,0.06)' : 'inset 0 1px 0 rgba(255,255,255,0.03)',
            }}
          >
            <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice40, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {item.label}
            </div>
            <div style={{ marginTop: 10, fontSize: 'calc(19px * var(--font-scale, 1))', fontWeight: 800, color: item.accent, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              {item.value}
            </div>
            <div style={{ marginTop: 6, fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice60 }}>
              {item.hint}
            </div>
          </div>
        ))}
      </div>

      {sortedData.length === 0 ? (
        <div
          style={{
            fontSize: 'calc(12px * var(--font-scale, 1))',
            color: C.ice60,
            textAlign: 'center',
            padding: '48px 20px',
            border: `1px dashed ${C.borderStrong}`,
            borderRadius: 18,
            background: C.bgMuted,
          }}
        >
          {t('predict.noDataAvailable')}
        </div>
      ) : (
        <div
          style={{
            position: 'relative',
            background: isLight
              ? 'radial-gradient(circle at 50% 50%, rgba(121,187,255,0.08), rgba(255,255,255,0.7))'
              : 'radial-gradient(circle at 50% 48%, rgba(121,187,255,0.14), rgba(8,14,25,0.98) 58%, rgba(5,8,15,1) 100%)',
            borderRadius: 24,
            border: `1px solid ${C.border}`,
            padding: 18,
            overflow: 'hidden',
            boxShadow: isLight
              ? '0 18px 42px rgba(15,23,42,0.08)'
              : 'inset 0 1px 0 rgba(255,255,255,0.04), 0 24px 56px rgba(0,0,0,0.35)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at center, rgba(179,155,255,0.08), transparent 56%)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: C.blue, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                  {copy.system}
                </div>
                <div style={{ marginTop: 6, fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice70, lineHeight: 1.5 }}>
                  {copy.systemHint}
                </div>
              </div>
              <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice80, fontWeight: 700 }}>
                {metricName}
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 2,
                  pointerEvents: 'none',
                  textAlign: 'center',
                  width: 220,
                  maxWidth: '58%',
                }}
              >
                <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice50, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  {t('predict.barChart.topModel')}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 'calc(20px * var(--font-scale, 1))',
                    color: C.ice,
                    fontWeight: 800,
                    fontFamily: 'var(--font-display)',
                    lineHeight: 1.2,
                    textShadow: isLight ? 'none' : '0 0 24px rgba(121,187,255,0.18)',
                  }}
                >
                  {best?.label || '--'}
                </div>
                <div style={{ marginTop: 6, fontSize: 'calc(15px * var(--font-scale, 1))', color: metricAccent, fontWeight: 800, fontFamily: 'var(--font-display)' }}>
                  {best ? fmtNum(best.value, precision) : '--'}
                </div>
              </div>

              <Plot
                data={[
                  {
                    type: 'scatterpolar',
                    mode: 'lines',
                    r: [...angles.map(() => averageRadius), averageRadius],
                    theta: [...angles, angles[0]],
                    line: {
                      color: withAlpha(C.blue, 0.38),
                      width: 1.4,
                      dash: 'dot',
                    },
                    hoverinfo: 'skip',
                    showlegend: false,
                  },
                  {
                    type: 'barpolar',
                    r: radii,
                    theta: angles,
                    width: Array.from({ length: sortedData.length }, () => barWidth),
                    marker: {
                      color: spectrumColors,
                      line: {
                        color: spectrumColors.map((color) => withAlpha(color, 1)),
                        width: 1.4,
                      },
                    },
                    customdata: sortedData.map((item) => [item.label, fmtNum(item.value, precision)]),
                    hovertemplate: `<b>%{customdata[0]}</b><br>${metricName}: <b>%{customdata[1]}</b><extra></extra>`,
                    opacity: 0.96,
                    showlegend: false,
                  },
                ]}
                layout={{
                  autosize: true,
                  height: 540,
                  margin: { l: 26, r: 26, t: 18, b: 18 },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  font: { color: plotTextColor, family: 'var(--font-body)' },
                  polar: {
                    bgcolor: 'rgba(0,0,0,0)',
                    angularaxis: {
                      tickmode: 'array',
                      tickvals: angles,
                      ticktext: sortedData.map((item) => item.label),
                      tickfont: {
                        size: sortedData.length > 8 ? 9 : 10,
                        color: plotTextColor,
                        family: 'var(--font-display)',
                      },
                      gridcolor: plotGridColor,
                      linecolor: withAlpha(plotText60, 0.24),
                      rotation: 90,
                      direction: 'clockwise',
                    },
                    radialaxis: {
                      range: [0, 100],
                      showticklabels: false,
                      ticks: '',
                      gridcolor: plotGridColor,
                      linecolor: withAlpha(plotText60, 0.2),
                    },
                  },
                  showlegend: false,
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice50, lineHeight: 1.5 }}>
                {t('predict.barChart.coord')}
              </div>
              <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice50, lineHeight: 1.5, textAlign: 'right' }}>
                {t('predict.barChart.reliability')}
              </div>
            </div>
          </div>
        </div>
      )}
    </GlowCard>
  );
}
