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

const getShorthands = (vars) => {
  if (!vars || vars.length === 0) return 'baseline';
  return vars.map((v) => SHORTHAND_MAP[v] || v[0]).sort().join('');
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
              background: active ? 'rgba(74,158,255,0.12)' : 'transparent',
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
          width: 48,
          height: 48,
          margin: '0 auto 14px',
          borderRadius: 14,
          background: 'rgba(156,123,234,0.12)',
          border: '1px solid rgba(156,123,234,0.22)',
          color: C.purple,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'calc(18px * var(--font-scale, 1))',
          fontWeight: 800,
          fontFamily: 'var(--font-display)',
        }}
      >
        {selectedCompareIds.length}
      </div>
      <div style={{ fontSize: 'calc(15px * var(--font-scale, 1))', fontWeight: 700, color: C.ice, fontFamily: 'var(--font-display)' }}>
        {selectedCompareIds.length === 0 ? t('predict.selectModelsToCompare') : t('predict.readyToGenerate')}
      </div>
      <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice50, lineHeight: 1.65, marginTop: 8 }}>
        {t('predict.barChart.emptyDesc')}
      </div>
      <button
        onClick={handleFetchPerformance}
        disabled={disabled}
        style={{
          marginTop: 18,
          padding: '11px 18px',
          background: disabled ? 'rgba(156,123,234,0.15)' : 'rgba(156,123,234,0.12)',
          border: `1px solid ${disabled ? 'rgba(156,123,234,0.18)' : 'rgba(156,123,234,0.35)'}`,
          borderRadius: 12,
          color: disabled ? C.ice40 : C.purple,
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
      ? '用更直观的模型排名视图比较当前勾选组合，便于快速判断谁更稳、谁更强。'
      : 'Compare the selected model combinations in a direct ranking view to quickly see which setup performs best.',
    emptyDesc: isZh
      ? '先在左侧勾选要比较的模型组合，再生成结果。这里会按当前指标自动排序。'
      : 'Select the model combinations from the sidebar first, then generate a ranked comparison for the current metric.',
    average: isZh ? '平均水平' : 'Average',
    spread: isZh ? '组间差距' : 'Spread',
    spreadHint: isZh ? '最佳与最弱组合之间的差值' : 'Difference between best and weakest configuration',
    refresh: isZh ? '刷新对比' : 'Refresh comparison',
    marginal: isZh ? '查看组合边际分析' : 'View marginal contribution',
  };

  if (!performanceData || !performanceData.results || selectedCompareIds.length === 0) {
    return (
      <GlowCard style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
              <div style={{ fontSize: 'calc(15px * var(--font-scale, 1))', fontWeight: 700, color: C.ice, fontFamily: 'var(--font-display)' }}>
              {t('predict.barChartTitle')}
            </div>
            <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice50, marginTop: 6, lineHeight: 1.6 }}>
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

  const barData = [];
  selectedCompareIds.forEach((id) => {
    const config = compareConfigs.find((item) => item.id === id);
    let perfData = performanceData.results?.[id];

    if (!perfData && config) {
      perfData = performanceData.results?.[getShorthands(config.vars)];
    }
    if (!perfData) return;

    const metricKey = `global_${activeMetric}`;
    const value = perfData[metricKey] || 0;
    barData.push({
      id,
      label: config?.label || id,
      value,
      order: activeMetric === 'r2' || activeMetric === 'ssim' ? value : -value,
    });
  });

  const sortedData = [...barData].sort((a, b) => b.order - a.order);
  const metricMeta = METRIC_META.find((metric) => metric.key === activeMetric);
  const best = sortedData[0];
  const worst = sortedData[sortedData.length - 1];
  const average = sortedData.length > 0
    ? sortedData.reduce((sum, item) => sum + item.value, 0) / sortedData.length
    : 0;

  const colors = sortedData.map((_, index) => {
    const ratio = index / Math.max(1, sortedData.length - 1);
    const alpha = 0.92 - ratio * 0.34;
    return activeMetric === 'r2' || activeMetric === 'ssim'
      ? `rgba(74, 207, 172, ${alpha})`
      : `rgba(199, 91, 57, ${alpha})`;
  });

  const metricAccent = activeMetric === 'r2' || activeMetric === 'ssim' ? C.green : C.mars;
  const spread = best && worst ? Math.abs(best.value - worst.value) : 0;

  return (
    <GlowCard style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 520 }}>
            <div style={{ fontSize: 'calc(15px * var(--font-scale, 1))', fontWeight: 700, color: C.ice, fontFamily: 'var(--font-display)' }}>
              {t('predict.barChartTitle')}
            </div>
            <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice50, marginTop: 6, lineHeight: 1.6 }}>
              {copy.summary}
            </div>
          </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowShapley({ visible: true, mode: 'marginal' })}
            style={{
              padding: '9px 14px',
              borderRadius: 12,
              border: `1px solid ${showShapley.visible && showShapley.mode === 'marginal' ? 'rgba(74,207,172,0.35)' : C.border}`,
              background: showShapley.visible && showShapley.mode === 'marginal' ? 'rgba(74,207,172,0.12)' : C.bgMuted,
              color: showShapley.visible && showShapley.mode === 'marginal' ? C.green : C.ice60,
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
              color: perfLoading ? C.ice40 : C.ice60,
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          {
            label: t('predict.barChart.topModel'),
            value: best?.label || '--',
            hint: best ? `${metricMeta?.name || activeMetric}: ${fmtNum(best.value, precision)}` : '--',
            accent: metricAccent,
          },
          {
            label: copy.average,
            value: fmtNum(average, precision),
            hint: metricMeta?.name || activeMetric,
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
              borderRadius: 14,
              background: C.bgMuted,
              border: `1px solid ${C.border}`,
            }}
          >
            <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice40, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {item.label}
            </div>
            <div style={{ marginTop: 10, fontSize: 'calc(19px * var(--font-scale, 1))', fontWeight: 800, color: item.accent, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              {item.value}
            </div>
            <div style={{ marginTop: 6, fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice50 }}>
              {item.hint}
            </div>
          </div>
        ))}
      </div>

      {sortedData.length === 0 ? (
        <div
          style={{
            fontSize: 'calc(12px * var(--font-scale, 1))',
            color: C.ice50,
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
            background: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.02)',
            borderRadius: 18,
            border: `1px solid ${C.border}`,
            padding: 12,
          }}
        >
          <Plot
            data={[
              {
                type: 'bar',
                orientation: 'h',
                y: sortedData.map((item) => item.label),
                x: sortedData.map((item) => item.value),
                marker: {
                  color: colors,
                  line: {
                    color: colors.map((color) => color.replace(/[\d.]+\)$/, '1)')),
                    width: 1,
                  },
                },
                hovertemplate: `<b>%{y}</b><br>${metricMeta?.name || activeMetric}: %{x:.4f}<extra></extra>`,
              },
            ]}
            layout={{
              autosize: true,
              height: Math.max(360, sortedData.length * 42 + 100),
              margin: { l: 140, r: 24, t: 10, b: 42 },
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)',
              font: { color: plotTextColor, family: 'var(--font-body)' },
              xaxis: {
                title: {
                  text: metricMeta?.name || activeMetric.toUpperCase(),
                  font: { size: 11, color: plotTextColor },
                },
                tickfont: { size: 10, color: plotText60 },
                gridcolor: plotGridColor,
                zeroline: false,
              },
              yaxis: {
                tickfont: { size: 11, color: plotTextColor },
                automargin: true,
                gridcolor: 'rgba(0,0,0,0)',
              },
              showlegend: false,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      )}
    </GlowCard>
  );
}
