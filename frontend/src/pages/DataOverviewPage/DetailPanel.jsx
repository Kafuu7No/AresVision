import React, { useEffect } from 'react';
import GlowCard from '../../components/GlowCard';
import C from '../../constants/colors';

import SeasonalChart from './OverviewCharts/SeasonalChart';
import CorrelationMatrix from './OverviewCharts/CorrelationMatrix';
import RealtimeMonitor from './OverviewCharts/RealtimeMonitor';
import EnvironmentDashboard from './OverviewCharts/EnvironmentDashboard';
import PredictionEngine from './OverviewCharts/PredictionEngine';
import DataDistribution from './OverviewCharts/DataDistribution';
import CouplingAnalysis from './OverviewCharts/CouplingAnalysis';
import WaveExplorer from './OverviewCharts/WaveExplorer';
import SolarSensitivity from './OverviewCharts/SolarSensitivity';
import PolarDynamics from './OverviewCharts/PolarDynamics';
import { useT } from '../../i18n';

const PANEL_COPY = {
  globe3d: {
    title: '三维臭氧球 3D GLOBE',
    description: '查看当前 Ls 切片下的全球臭氧球面分布。',
  },
  seasonal: {
    title: '季节臭氧场 SEASONAL OZONE FIELD',
    description: '展示臭氧在纬度与季节上的整体结构，以及季节输运特征。',
  },
  correlation: {
    title: '关系研究 RELATION LAB',
    description: '从散点回归、共演化和时滞相关三个角度研究臭氧与环境变量的关系。',
  },
  realtime: {
    title: '昼夜变化 DIURNAL PROFILE',
    description: '按纬带查看当前火星季节下的臭氧昼夜振幅与峰值时刻。',
  },
  environment: {
    title: '环境驱动 ENVIRONMENT DRIVERS',
    description: '总览温度、沙尘、太阳辐射和风场的季节变化，以及不同纬带的主导驱动差异。',
  },
  prediction: {
    title: '模型能力 MODEL SKILL TRACKER',
    description: '比较 O3 基线模型与完整驱动模型在测试集上的整体表现。',
  },
  distribution: {
    title: '空间分布 SPATIAL DISTRIBUTION',
    description: '统计当前臭氧切片的数值分布、分位区间和纬向均值剖面。',
  },
  coupling: {
    title: '沙尘冲刷 DUST WASHOUT',
    description: '探索沙尘暴爆发对全球平均臭氧含量的直接影响。',
  },
  wave: {
    title: '行星波探测 WAVE EXPLORER',
    description: '分析火星主导地形产生的大气驻波与纬向距平。',
  },
  solar: {
    title: '光化学驱动 SOLAR SENSITIVITY',
    description: '研究紫外辐射强度与臭氧生成率的非线性关系。',
  },
  polar: {
    title: '极地冬春演化 POLAR DYNAMICS',
    description: '对比南北极在极夜前后的臭氧急剧积聚趋势。',
  },
};

export default function DetailPanel({ selectedItem, marsYear, lsValue, ozoneData }) {
  const t = useT();
  const is3DMode = selectedItem?.is3D;

  useEffect(() => {
    if (!selectedItem || is3DMode) return undefined;

    const dispatchResize = () => window.dispatchEvent(new Event('resize'));
    const t1 = setTimeout(dispatchResize, 80);
    const t2 = setTimeout(dispatchResize, 220);
    const t3 = setTimeout(dispatchResize, 500);
    const t4 = setTimeout(dispatchResize, 860);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [selectedItem, is3DMode]);

  const renderChart = () => {
    if (!selectedItem) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: C.ice60,
            fontFamily: "'Exo 2', sans-serif",
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>◎</div>
          <div style={{ fontSize: '16px', marginBottom: '8px', fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>
            HELLO MARS
          </div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>SELECT AN OPTION FROM SIDEBAR</div>
        </div>
      );
    }

    if (is3DMode) return null;

    switch (selectedItem.id) {
      case 'seasonal':
        return <SeasonalChart marsYear={marsYear} />;
      case 'correlation':
        return <CorrelationMatrix marsYear={marsYear} />;
      case 'realtime':
        return <RealtimeMonitor marsYear={marsYear} lsValue={lsValue} />;
      case 'environment':
        return <EnvironmentDashboard marsYear={marsYear} />;
      case 'prediction':
        return <PredictionEngine />;
      case 'distribution':
        return <DataDistribution marsYear={marsYear} lsValue={lsValue} ozoneData={ozoneData} />;
      case 'coupling':
        return <CouplingAnalysis marsYear={marsYear} />;
      case 'wave':
        return <WaveExplorer marsYear={marsYear} />;
      case 'solar':
        return <SolarSensitivity marsYear={marsYear} />;
      case 'polar':
        return <PolarDynamics marsYear={marsYear} />;
      default:
        return <div>Unknown chart type</div>;
    }
  };

  const panelMeta = selectedItem ? {
    title: t(`overview.panel.${selectedItem.id}.title`) || PANEL_COPY[selectedItem.id]?.title,
    description: t(`overview.panel.${selectedItem.id}.description`) || PANEL_COPY[selectedItem.id]?.description,
  } : null;

  return (
    <div
      style={{
        position: 'fixed',
        left: is3DMode ? '100vw' : '280px',
        top: '70px',
        right: is3DMode ? '-100vw' : 0,
        height: 'calc(100vh - 70px)',
        background: 'transparent',
        zIndex: 500,
        padding: '24px',
        transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: 'translateX(0)',
        display: 'grid',
        gridTemplateRows: selectedItem && !is3DMode ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)',
        gap: '20px',
        minHeight: 0,
      }}
    >
      {selectedItem && !is3DMode && (
        <GlowCard style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '28px', marginRight: '16px', filter: `drop-shadow(0 0 8px ${selectedItem.color})` }}>
              {selectedItem.icon}
            </span>
            <div>
              <h3
                style={{
                  color: selectedItem.color,
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: '20px',
                  fontWeight: 'bold',
                  margin: 0,
                  textShadow: `0 0 10px ${selectedItem.color}`,
                }}
              >
                {panelMeta?.title ?? selectedItem.id}
              </h3>
            </div>
          </div>
          <p style={{ color: C.ice60, fontFamily: "'Exo 2', sans-serif", fontSize: '13px', margin: 0, lineHeight: 1.6 }}>
            {panelMeta?.description ?? ''}
          </p>
        </GlowCard>
      )}

      <GlowCard
        style={{
          height: '100%',
          padding: '24px',
          overflowX: 'hidden',
          overflowY: 'auto',
          scrollbarGutter: 'stable',
          minHeight: 0,
        }}
      >
        {renderChart()}
      </GlowCard>
    </div>
  );
}
