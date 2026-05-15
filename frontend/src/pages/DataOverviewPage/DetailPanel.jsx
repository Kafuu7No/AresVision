import React, { useEffect, useMemo, useLayoutEffect, useCallback, useRef, useState } from 'react';
import GlowCard from '../../components/GlowCard';
import C from '../../constants/colors';
import { useDataOverview } from '../../contexts/DataOverviewContext';
import { useSettings } from '../../contexts/SettingsContext';
import SeasonalChart from './OverviewCharts/SeasonalChart';
import CorrelationMatrix from './OverviewCharts/CorrelationMatrix';
import RealtimeMonitor from './OverviewCharts/RealtimeMonitor';
import EnvironmentDashboard from './OverviewCharts/EnvironmentDashboard';
import DataDistribution from './OverviewCharts/DataDistribution';
import CouplingAnalysis from './OverviewCharts/CouplingAnalysis';
import PolarDynamics from './OverviewCharts/PolarDynamics';
import SolarSensitivity from './OverviewCharts/SolarSensitivity';
import WaveExplorer from './OverviewCharts/WaveExplorer';
import SeasonalExtremesChart from './OverviewCharts/SeasonalExtremesChart';
import GlobalTrendLinesChart from './OverviewCharts/GlobalTrendLinesChart';
import WaveBandDiagnosticsChart from './OverviewCharts/WaveBandDiagnosticsChart';
import { MODE_DEFS } from './SidebarMenu';

const NAVBAR_HEIGHT = 70;

const MODE_CARD_KEYS = {
  temporal: ['realtime', 'seasonal', 'seasonalExtremes', 'globalTrend'],
  drivers: ['correlation', 'environment', 'solarsens'],
  dynamics: ['coupling', 'polar', 'wave', 'waveDiag'],
};

const CARD_TITLES = {
  realtime: { zh: '昼夜变化', en: 'Diurnal' },
  seasonal: { zh: '季节变化', en: 'Seasonal' },
  seasonalExtremes: { zh: '季节极值', en: 'Seasonal extremes' },
  globalTrend: { zh: '全球趋势', en: 'Global trends' },
  environment: { zh: '环境因子', en: 'Environment' },
  solarsens: { zh: '太阳敏感性', en: 'Solar sensitivity' },
  wave: { zh: '波动结构', en: 'Wave explorer' },
  waveDiag: { zh: '波动诊断', en: 'Wave diagnostics' },
  polar: { zh: '极区动力', en: 'Polar dynamics' },
  coupling: { zh: '尘埃耦合', en: 'Dust coupling' },
  distribution: { zh: '点位分布', en: 'Distribution' },
  correlation: { zh: '点位相关', en: 'Correlation' },
};

export default function DetailPanel({ ozoneData, dataSourceMode = 'default' }) {
  const { settings } = useSettings();
  const isLight = settings?.theme === 'light';
  const isZh = settings?.language !== 'en';
  const {
    activeAnalysisMode,
    selectedCoordinate,
    resetView,
    marsYear,
    globalTimeLs,
    rightPanelWidth,
    setRightPanelWidth,
    expandedCard,
    setExpandedCard,
  } = useDataOverview();

  const panelBg = isLight ? 'rgba(255,255,255,0.82)' : 'rgba(10,12,18,0.54)';
  const borderSoft = isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.08)';
  const subtleBg = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';
  const subtleBorder = isLight ? 'rgba(15,23,42,0.14)' : 'rgba(255,255,255,0.16)';

  const [isVisible, setIsVisible] = useState(false);
  const [renderedCards, setRenderedCards] = useState(() => new Set());
  const dragFrameRef = useRef(0);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightPanelWidth;

    const onMouseMove = (moveEvent) => {
      const nextWidth = startWidth - (moveEvent.clientX - startX);
      const clamped = Math.max(400, Math.min(nextWidth, 900));
      setRightPanelWidth(clamped);

      if (!dragFrameRef.current) {
        dragFrameRef.current = window.requestAnimationFrame(() => {
          window.dispatchEvent(new Event('resize'));
          dragFrameRef.current = 0;
        });
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      window.dispatchEvent(new Event('resize'));
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [rightPanelWidth, setRightPanelWidth]);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => () => {
    if (dragFrameRef.current) {
      window.cancelAnimationFrame(dragFrameRef.current);
    }
  }, []);

  useLayoutEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [rightPanelWidth]);

  const getActiveCards = useCallback(() => {
    if (selectedCoordinate) return ['distribution'];
    return MODE_CARD_KEYS[activeAnalysisMode] || [];
  }, [activeAnalysisMode, selectedCoordinate]);

  const activeCards = useMemo(() => getActiveCards(), [getActiveCards]);

  useEffect(() => {
    setExpandedCard((prev) => (activeCards.includes(prev) ? prev : (activeCards[0] || '')));
  }, [activeCards, setExpandedCard]);

  useEffect(() => {
    setRenderedCards((prev) => {
      const next = new Set();
      activeCards.forEach((key) => {
        if (prev.has(key)) next.add(key);
      });
      if (activeCards[0]) next.add(activeCards[0]);
      if (expandedCard && activeCards.includes(expandedCard)) next.add(expandedCard);
      if (next.size === prev.size && Array.from(next).every((key) => prev.has(key))) {
        return prev;
      }
      return next;
    });
  }, [activeCards, expandedCard]);

  useEffect(() => {
    const dispatchResize = () => window.dispatchEvent(new Event('resize'));
    const t1 = setTimeout(dispatchResize, 100);
    const t2 = setTimeout(dispatchResize, 350);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [expandedCard, activeAnalysisMode, selectedCoordinate]);

  const realtimeComponent = useMemo(() => <RealtimeMonitor marsYear={marsYear} lsValue={globalTimeLs} dataSourceMode={dataSourceMode} />, [marsYear, globalTimeLs, dataSourceMode]);
  const seasonalComponent = useMemo(() => <SeasonalChart marsYear={marsYear} dataSourceMode={dataSourceMode} />, [marsYear, dataSourceMode]);
  const seasonalExtremesComponent = useMemo(() => <SeasonalExtremesChart marsYear={marsYear} dataSourceMode={dataSourceMode} />, [marsYear, dataSourceMode]);
  const globalTrendComponent = useMemo(() => <GlobalTrendLinesChart marsYear={marsYear} dataSourceMode={dataSourceMode} />, [marsYear, dataSourceMode]);
  const environmentComponent = useMemo(() => <EnvironmentDashboard marsYear={marsYear} dataSourceMode={dataSourceMode} />, [marsYear, dataSourceMode]);
  const solarsensComponent = useMemo(() => <SolarSensitivity marsYear={marsYear} dataSourceMode={dataSourceMode} />, [marsYear, dataSourceMode]);
  const waveComponent = useMemo(() => <WaveExplorer marsYear={marsYear} dataSourceMode={dataSourceMode} />, [marsYear, dataSourceMode]);
  const waveDiagComponent = useMemo(() => <WaveBandDiagnosticsChart marsYear={marsYear} dataSourceMode={dataSourceMode} />, [marsYear, dataSourceMode]);
  const polarComponent = useMemo(() => <PolarDynamics marsYear={marsYear} dataSourceMode={dataSourceMode} />, [marsYear, dataSourceMode]);
  const couplingComponent = useMemo(() => <CouplingAnalysis marsYear={marsYear} dataSourceMode={dataSourceMode} />, [marsYear, dataSourceMode]);
  const distributionComponent = useMemo(
    () => (
      <DataDistribution
        marsYear={marsYear}
        lsValue={globalTimeLs}
        ozoneData={ozoneData}
        coordinate={selectedCoordinate}
      />
    ),
    [marsYear, globalTimeLs, ozoneData, selectedCoordinate],
  );
  const correlationComponent = useMemo(
    () => <CorrelationMatrix marsYear={marsYear} coordinate={selectedCoordinate} dataSourceMode={dataSourceMode} />,
    [marsYear, selectedCoordinate, dataSourceMode],
  );

  const cardsMap = {
    realtime: { title: isZh ? CARD_TITLES.realtime.zh : CARD_TITLES.realtime.en, component: realtimeComponent, color: C.mars },
    seasonal: { title: isZh ? CARD_TITLES.seasonal.zh : CARD_TITLES.seasonal.en, component: seasonalComponent, color: C.blue },
    seasonalExtremes: { title: isZh ? CARD_TITLES.seasonalExtremes.zh : CARD_TITLES.seasonalExtremes.en, component: seasonalExtremesComponent, color: '#f09c4a' },
    globalTrend: { title: isZh ? CARD_TITLES.globalTrend.zh : CARD_TITLES.globalTrend.en, component: globalTrendComponent, color: C.green },
    environment: { title: isZh ? CARD_TITLES.environment.zh : CARD_TITLES.environment.en, component: environmentComponent, color: C.green },
    solarsens: { title: isZh ? CARD_TITLES.solarsens.zh : CARD_TITLES.solarsens.en, component: solarsensComponent, color: '#d9a441' },
    wave: { title: isZh ? CARD_TITLES.wave.zh : CARD_TITLES.wave.en, component: waveComponent, color: '#d2b48c' },
    waveDiag: { title: isZh ? CARD_TITLES.waveDiag.zh : CARD_TITLES.waveDiag.en, component: waveDiagComponent, color: '#6aa9ff' },
    polar: { title: isZh ? CARD_TITLES.polar.zh : CARD_TITLES.polar.en, component: polarComponent, color: '#cbeef3' },
    coupling: { title: isZh ? CARD_TITLES.coupling.zh : CARD_TITLES.coupling.en, component: couplingComponent, color: '#ffb347' },
    distribution: { title: isZh ? CARD_TITLES.distribution.zh : CARD_TITLES.distribution.en, component: distributionComponent, color: C.mars },
    correlation: { title: isZh ? CARD_TITLES.correlation.zh : CARD_TITLES.correlation.en, component: correlationComponent, color: C.blue },
  };

  const currentModeInfo = selectedCoordinate
    ? {
      icon: 'P',
      title: isZh ? '点位聚焦' : 'Point focus',
      color: C.mars,
      desc: isZh
        ? `聚焦 LAT ${selectedCoordinate.lat.toFixed(1)}°、LNG ${selectedCoordinate.lng.toFixed(1)}° 的局地时空特征。`
        : `Focus on local spatiotemporal features at LAT ${selectedCoordinate.lat.toFixed(1)}°, LNG ${selectedCoordinate.lng.toFixed(1)}°.`,
    }
    : (() => {
      const mode = MODE_DEFS.find((item) => item.id === activeAnalysisMode) || MODE_DEFS[0];
      return {
        icon: mode.icon,
        title: isZh ? mode.title.zh : mode.title.en,
        desc: isZh ? mode.desc.zh : mode.desc.en,
        color: mode.color,
      };
    })();

  return (
    <div
      style={{
        position: 'fixed',
        top: `${NAVBAR_HEIGHT}px`,
        right: isVisible ? '0' : `-${rightPanelWidth + 20}px`,
        width: rightPanelWidth,
        height: `calc(100vh - ${NAVBAR_HEIGHT}px)`,
        background: panelBg,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderLeft: `1px solid ${borderSoft}`,
        zIndex: 1000,
        padding: '24px',
        transition: 'right 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <GlowCard style={{ padding: '18px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span
              style={{
                width: 30,
                height: 30,
                marginRight: 14,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                background: `${currentModeInfo.color}18`,
                color: currentModeInfo.color,
                fontSize: 'calc(13px * var(--font-scale, 1))',
                fontWeight: 800,
                fontFamily: 'var(--font-display)',
                flexShrink: 0,
              }}
            >
              {currentModeInfo.icon}
            </span>
            <div>
              <h3
                style={{
                  color: currentModeInfo.color,
                  fontFamily: 'var(--font-display)',
                  fontSize: 'calc(16px * var(--font-scale, 1))',
                  fontWeight: 800,
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}
              >
                {currentModeInfo.title}
              </h3>
            </div>
          </div>

          {selectedCoordinate && (
            <button
              onClick={resetView}
              style={{
                background: subtleBg,
                border: `1px solid ${subtleBorder}`,
                color: C.ice,
                padding: '6px 12px',
                borderRadius: 999,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: 'calc(11px * var(--font-scale, 1))',
                fontWeight: 600,
                transition: '0.2s',
              }}
              onMouseEnter={(event) => { event.currentTarget.style.background = isLight ? 'rgba(15,23,42,0.14)' : 'rgba(255,255,255,0.18)'; }}
              onMouseLeave={(event) => { event.currentTarget.style.background = subtleBg; }}
            >
              {isZh ? '返回全局' : 'Back to globe'}
            </button>
          )}
        </div>

        <p style={{ color: C.ice60, fontFamily: 'var(--font-body)', fontSize: 'calc(12px * var(--font-scale, 1))', margin: 0, lineHeight: 1.65 }}>
          {currentModeInfo.desc}
        </p>
      </GlowCard>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          overflowX: 'hidden',
          overflowY: 'auto',
          scrollbarGutter: 'stable',
          paddingRight: 4,
        }}
      >
        {activeCards.map((key) => {
          const cardDef = cardsMap[key];
          if (!cardDef) return null;
          const isExpanded = expandedCard === key;
          const shouldRender = renderedCards.has(key);

          return (
            <GlowCard
              key={key}
              style={{
                padding: 0,
                overflow: 'hidden',
                flexShrink: 0,
                transition: 'all 0.5s ease',
              }}
            >
              <div
                onClick={() => setExpandedCard(isExpanded ? '' : key)}
                style={{
                  padding: '14px 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: isExpanded ? `linear-gradient(90deg, ${cardDef.color}15, transparent)` : 'transparent',
                  borderBottom: isExpanded ? `1px solid ${C.border}` : 'none',
                }}
              >
                <span
                  style={{
                    color: isExpanded ? cardDef.color : C.ice60,
                    fontFamily: 'var(--font-display)',
                    fontSize: 'calc(13px * var(--font-scale, 1))',
                    fontWeight: isExpanded ? 700 : 600,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {cardDef.title}
                </span>

                <span
                  style={{
                    color: isExpanded ? cardDef.color : C.ice30,
                    fontSize: 'calc(16px * var(--font-scale, 1))',
                    transition: 'transform 0.3s',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                >
                  ▾
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateRows: isExpanded ? '1fr' : '0fr',
                  opacity: isExpanded ? 1 : 0,
                  transition: 'all 0.5s ease',
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ padding: 20, boxSizing: 'border-box' }}>
                    {shouldRender ? cardDef.component : (
                      <div style={{ color: C.ice40, fontSize: 'calc(11px * var(--font-scale, 1))', fontFamily: 'var(--font-body)' }}>
                        {isZh ? '展开后加载该分析模块。' : 'Expand to load this analysis module.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </GlowCard>
          );
        })}
      </div>

      <div
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          left: -3,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: 'col-resize',
          zIndex: 10,
          background: 'transparent',
        }}
      />
    </div>
  );
}
