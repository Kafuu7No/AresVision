import React, { createContext, useContext, useState } from 'react';

const DataOverviewContext = createContext();

export const useDataOverview = () => {
  const context = useContext(DataOverviewContext);
  if (!context) {
    throw new Error('useDataOverview must be used within a DataOverviewProvider');
  }
  return context;
};

export const DataOverviewProvider = ({ children }) => {
  const [activeAnalysisMode, setActiveAnalysisMode] = useState('temporal');
  const [selectedCoordinate, setSelectedCoordinate] = useState(null);
  const [marsYear, setMarsYear] = useState(27);
  const [globalTimeLs, setGlobalTimeLs] = useState(0); // 替换原来的 solarLongitude
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [timeRange, setTimeRange] = useState({ start: 0, end: 360 });
  const [selectedVariables, setSelectedVariables] = useState([
    'o3col', 'temperature', 'pressure'
  ]);
  const [leftPanelWidth, setLeftPanelWidth] = useState(280);
  const [rightPanelWidth, setRightPanelWidth] = useState(540);
  const [expandedCard, setExpandedCard] = useState('');

  const contextValue = {
    expandedCard,
    setExpandedCard,
    activeAnalysisMode,
    setActiveAnalysisMode,
    selectedCoordinate,
    setSelectedCoordinate,
    marsYear,
    setMarsYear,
    globalTimeLs,
    setGlobalTimeLs,
    isPlayingTimeline,
    setIsPlayingTimeline,
    autoRotate,
    setAutoRotate,
    gestureEnabled,
    setGestureEnabled,
    timeRange,
    setTimeRange,
    selectedVariables,
    setSelectedVariables,
    leftPanelWidth,
    setLeftPanelWidth,
    rightPanelWidth,
    setRightPanelWidth,
    
    getSeasonName: (ls) => {
      if (ls >= 0 && ls < 90) return 'Northern Spring';
      if (ls >= 90 && ls < 180) return 'Northern Summer';
      if (ls >= 180 && ls < 270) return 'Northern Fall';
      return 'Northern Winter';
    },
    
    resetSelection: () => {
      setSelectedCoordinate(null);
      setTimeRange({ start: 0, end: 360 });
    },
    
    resetView: () => {
      setSelectedCoordinate(null);
      setActiveAnalysisMode('global');
    },
  };

  return (
    <DataOverviewContext.Provider value={contextValue}>
      {children}
    </DataOverviewContext.Provider>
  );
};

export default DataOverviewProvider;