import React from 'react';
import GlowCard from '../../components/GlowCard';
import C from '../../constants/colors';
import { useT } from '../../i18n';

// Import charts
import SeasonalChart from './OverviewCharts/SeasonalChart';
import CorrelationMatrix from './OverviewCharts/CorrelationMatrix';
import RealtimeMonitor from './OverviewCharts/RealtimeMonitor';
import EnvironmentDashboard from './OverviewCharts/EnvironmentDashboard';
import PredictionEngine from './OverviewCharts/PredictionEngine';
import DataDistribution from './OverviewCharts/DataDistribution';

export default function DetailPanel({ selectedItem, marsYear }) {
  const t = useT();
  const is3DMode = selectedItem?.is3D;

  const renderChart = () => {
    if (!selectedItem) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          height: '100%', color: C.ice60,
          fontFamily: "'Exo 2', sans-serif"
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3, filter: 'grayscale(100%)' }}>🛰️</div>
          <div style={{ fontSize: '16px', marginBottom: '8px', fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>HELLO MARS</div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>SELECT AN OPTION FROM SIDEBAR</div>
        </div>
      );
    }

    if (is3DMode) {
      return null;
    }

    switch (selectedItem.id) {
      case 'seasonal':
        return <SeasonalChart marsYear={marsYear} />;
      case 'correlation':
        return <CorrelationMatrix />;
      case 'realtime':
        return <RealtimeMonitor />;
      case 'environment':
        return <EnvironmentDashboard />;
      case 'prediction':
        return <PredictionEngine />;
      case 'distribution':
        return <DataDistribution />;
      default:
        return <div>{t('overview.charts.unknownType')}</div>;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      left: is3DMode ? '100vw' : '280px',
      top: '70px',
      right: is3DMode ? '-100vw' : 0,
      height: 'calc(100vh - 70px)',
      background: 'rgba(10, 10, 15, 0.3)',
      backdropFilter: 'blur(10px)',
      zIndex: 500,
      padding: '24px',
      transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
      transform: 'translateX(0)'
    }}>
      {selectedItem && !is3DMode && (
        <GlowCard style={{
          marginBottom: '20px',
          padding: '16px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '28px', marginRight: '16px', filter: `drop-shadow(0 0 8px ${selectedItem.color})` }}>
              {selectedItem.icon}
            </span>
            <div>
              <h3 style={{
                color: selectedItem.color,
                fontFamily: "'Orbitron', sans-serif",
                fontSize: '20px',
                fontWeight: 'bold',
                margin: 0,
                textShadow: `0 0 10px ${selectedItem.color}`
              }}>
                {selectedItem.title}
              </h3>
            </div>
          </div>
          <p style={{ color: C.ice60, fontFamily: "'Exo 2', sans-serif", fontSize: '13px', margin: '0', lineHeight: 1.5 }}>
            {selectedItem.description || t(`overview.menuItems.${selectedItem.id}_desc`)}
          </p>
        </GlowCard>
      )}

      <GlowCard style={{
        height: selectedItem ? 'calc(100% - 130px)' : '100%',
        padding: '24px',
        overflow: 'hidden'
      }}>
        {renderChart()}
      </GlowCard>
    </div>
  );
}
