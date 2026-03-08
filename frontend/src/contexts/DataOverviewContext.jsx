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
  const [marsYear, setMarsYear] = useState(27);
  const [solarLongitude, setSolarLongitude] = useState(0);
  const [selectedLatitude, setSelectedLatitude] = useState(0);
  const [selectedLongitude, setSelectedLongitude] = useState(0);
  const [timeRange, setTimeRange] = useState({ start: 0, end: 360 });
  const [selectedVariables, setSelectedVariables] = useState([
    'o3col', 'temperature', 'pressure'
  ]);

  const contextValue = {
    // 基础参数
    marsYear,
    setMarsYear,
    solarLongitude,
    setSolarLongitude,
    selectedLatitude,
    setSelectedLatitude,
    selectedLongitude,
    setSelectedLongitude,
    timeRange,
    setTimeRange,
    selectedVariables,
    setSelectedVariables,
    
    // 辅助方法
    getSeasonName: (ls) => {
      if (ls >= 0 && ls < 90) return 'Northern Spring';
      if (ls >= 90 && ls < 180) return 'Northern Summer';
      if (ls >= 180 && ls < 270) return 'Northern Fall';
      return 'Northern Winter';
    },
    
    resetSelection: () => {
      setSelectedLatitude(0);
      setSelectedLongitude(0);
      setTimeRange({ start: 0, end: 360 });
    },
  };

  return (
    <DataOverviewContext.Provider value={contextValue}>
      {children}
    </DataOverviewContext.Provider>
  );
};

export default DataOverviewProvider;