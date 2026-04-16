import React, { useEffect, useMemo, useLayoutEffect, useCallback, useRef, useState } from 'react';
import GlowCard from '../../components/GlowCard';
import C from '../../constants/colors';
import { useDataOverview } from '../../contexts/DataOverviewContext';
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

const MODE_CARD_KEYS = {
  temporal: ['realtime', 'seasonal', 'seasonalExtremes', 'globalTrend'],
  drivers: ['correlation', 'environment', 'solarsens'],
  dynamics: ['coupling', 'polar', 'wave', 'waveDiag'],
};

export default function DetailPanel({ ozoneData }) {
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

  const [isVisible, setIsVisible] = useState(false);
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
    if (dragFrameRef.current) window.cancelAnimationFrame(dragFrameRef.current);
  }, []);

  useLayoutEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [rightPanelWidth]);

  const getActiveCards = useCallback(() => {
    if (selectedCoordinate) return ['distribution'];
    return (MODE_CARD_KEYS[activeAnalysisMode] || []).filter((key) => key !== 'prediction');
  }, [activeAnalysisMode, selectedCoordinate]);

  useEffect(() => {
    const cards = getActiveCards();
    setExpandedCard((prev) => (cards.includes(prev) ? prev : (cards[0] || '')));
  }, [getActiveCards, setExpandedCard]);

  useEffect(() => {
    const dispatchResize = () => window.dispatchEvent(new Event('resize'));
    const t1 = setTimeout(dispatchResize, 100);
    const t2 = setTimeout(dispatchResize, 350);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [expandedCard, activeAnalysisMode, selectedCoordinate]);

  const realtimeComponent = useMemo(() => <RealtimeMonitor marsYear={marsYear} lsValue={globalTimeLs} />, [marsYear, globalTimeLs]);
  const seasonalComponent = useMemo(() => <SeasonalChart marsYear={marsYear} />, [marsYear]);
  const seasonalExtremesComponent = useMemo(() => <SeasonalExtremesChart marsYear={marsYear} />, [marsYear]);
  const globalTrendComponent = useMemo(() => <GlobalTrendLinesChart marsYear={marsYear} />, [marsYear]);
  const environmentComponent = useMemo(() => <EnvironmentDashboard marsYear={marsYear} />, [marsYear]);
  const solarsensComponent = useMemo(() => <SolarSensitivity marsYear={marsYear} />, [marsYear]);
  const waveComponent = useMemo(() => <WaveExplorer marsYear={marsYear} />, [marsYear]);
  const waveDiagComponent = useMemo(() => <WaveBandDiagnosticsChart marsYear={marsYear} />, [marsYear]);
  const polarComponent = useMemo(() => <PolarDynamics marsYear={marsYear} />, [marsYear]);
  const couplingComponent = useMemo(() => <CouplingAnalysis marsYear={marsYear} />, [marsYear]);
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
    () => <CorrelationMatrix marsYear={marsYear} coordinate={selectedCoordinate} />,
    [marsYear, selectedCoordinate],
  );

  const cardsMap = {
    realtime: { title: '昼夜变化 Diurnal', component: realtimeComponent, color: C.mars },
    seasonal: { title: '季节交替 Seasonal', component: seasonalComponent, color: C.blue },
    seasonalExtremes: { title: '季节极值 Seasonal Extremes', component: seasonalExtremesComponent, color: '#f09c4a' },
    globalTrend: { title: '全局趋势 Global Trends', component: globalTrendComponent, color: '#4acfac' },
    environment: { title: '多因子环境 Environment', component: environmentComponent, color: '#4acfac' },
    solarsens: { title: '光化学辐射 Solar', component: solarsensComponent, color: '#ffd700' },
    wave: { title: '地形驻波 Wave', component: waveComponent, color: '#d2b48c' },
    waveDiag: { title: '波动诊断 Wave Diagnostics', component: waveDiagComponent, color: '#6aa9ff' },
    polar: { title: '极点聚集 Polar', component: polarComponent, color: '#cbeef3' },
    coupling: { title: '沙尘冲刷 Coupling', component: couplingComponent, color: '#ffb347' },
    distribution: { title: '点位分布 Distribution', component: distributionComponent, color: C.mars },
    correlation: { title: '点位相关性 Correlation', component: correlationComponent, color: C.blue },
  };

  const activeCards = getActiveCards();
  const currentModeInfo = selectedCoordinate
    ? {
      icon: '📍',
      title: '微观点位分析 POINT FOCUS',
      color: C.mars,
      desc: `深入探索 LAT ${selectedCoordinate.lat.toFixed(1)}°, LNG ${selectedCoordinate.lng.toFixed(1)}° 的局地时空特征`,
    }
    : MODE_DEFS.find((mode) => mode.id === activeAnalysisMode) || MODE_DEFS[0];

  return (
    <div
      style={{
        position: 'fixed',
        top: '40px',
        right: isVisible ? '0' : `-${rightPanelWidth + 20}px`,
        width: rightPanelWidth,
        height: 'calc(100vh - 40px)',
        background: 'rgba(10, 12, 18, 0.4)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        zIndex: 1000,
        padding: '24px',
        transition: 'right 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <GlowCard style={{ padding: '16px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '24px', marginRight: '16px', filter: `drop-shadow(0 0 8px ${currentModeInfo.color})` }}>
              {currentModeInfo.icon}
            </span>
            <div>
              <h3
                style={{
                  color: currentModeInfo.color,
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: '14px',
                  fontWeight: 'bold',
                  margin: 0,
                  textShadow: `0 0 10px ${currentModeInfo.color}80`,
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
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: C.ice,
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontFamily: "'Exo 2', sans-serif",
                fontSize: '11px',
                transition: '0.2s',
              }}
              onMouseEnter={(event) => { event.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
              onMouseLeave={(event) => { event.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            >
              ↩ 返回
            </button>
          )}
        </div>
        <p style={{ color: C.ice60, fontFamily: "'Exo 2', sans-serif", fontSize: '11px', margin: 0, lineHeight: 1.6 }}>
          {currentModeInfo.desc}
        </p>
      </GlowCard>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          overflowX: 'hidden',
          overflowY: 'auto',
          scrollbarGutter: 'stable',
          paddingRight: '4px',
        }}
      >
        {activeCards.map((key) => {
          const cardDef = cardsMap[key];
          if (!cardDef) return null;
          const isExpanded = expandedCard === key;

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
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: '13px',
                    fontWeight: isExpanded ? 'bold' : 'normal',
                    letterSpacing: 1,
                  }}
                >
                  {cardDef.title}
                </span>
                <span
                  style={{
                    color: isExpanded ? cardDef.color : C.ice30,
                    fontSize: '16px',
                    transition: 'transform 0.3s',
                    transform: isExpanded ? 'rotate(45deg)' : 'rotate(0deg)',
                  }}
                >
                  +
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
                  <div style={{ padding: '20px', boxSizing: 'border-box' }}>
                    {cardDef.component}
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
          left: '-3px',
          top: 0,
          bottom: 0,
          width: '6px',
          cursor: 'col-resize',
          zIndex: 10,
          background: 'transparent',
        }}
      />
    </div>
  );
}
