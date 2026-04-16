import React, { createContext, useContext, useCallback, useRef, useState } from 'react';

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
  const [showConcentration3D, setShowConcentration3D] = useState(true);
  const [showGeoAnnotations, setShowGeoAnnotations] = useState(true);
  const [showMarsTexture, setShowMarsTexture] = useState(true);
  const [globeVariable, setGlobeVariable] = useState('o3col');
  const [timeRange, setTimeRange] = useState({ start: 0, end: 360 });
  const [selectedVariables, setSelectedVariables] = useState([
    'o3col', 'temperature', 'pressure'
  ]);
  const [leftPanelWidth, setLeftPanelWidth] = useState(280);
  const [rightPanelWidth, setRightPanelWidth] = useState(540);
  const [expandedCard, setExpandedCard] = useState('');
  const aiInsightProvidersRef = useRef(new Map());

  const registerAiInsightProvider = useCallback((cardKey, provider) => {
    if (!cardKey || typeof provider !== 'function') return;
    aiInsightProvidersRef.current.set(cardKey, provider);
  }, []);

  const unregisterAiInsightProvider = useCallback((cardKey, provider) => {
    if (!cardKey) return;
    const current = aiInsightProvidersRef.current.get(cardKey);
    if (!provider || current === provider) {
      aiInsightProvidersRef.current.delete(cardKey);
    }
  }, []);

  const getAiInsight = useCallback((cardKey) => {
    if (!cardKey) return null;
    const provider = aiInsightProvidersRef.current.get(cardKey);
    if (typeof provider !== 'function') return null;
    try {
      return provider() ?? null;
    } catch (error) {
      console.warn('Failed to collect AI insight snapshot:', cardKey, error);
      return null;
    }
  }, []);

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
    showConcentration3D,
    setShowConcentration3D,
    showGeoAnnotations,
    setShowGeoAnnotations,
    showMarsTexture,
    setShowMarsTexture,
    globeVariable,
    setGlobeVariable,
    timeRange,
    setTimeRange,
    selectedVariables,
    setSelectedVariables,
    leftPanelWidth,
    setLeftPanelWidth,
    rightPanelWidth,
    setRightPanelWidth,
    registerAiInsightProvider,
    unregisterAiInsightProvider,
    getAiInsight,
    
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
