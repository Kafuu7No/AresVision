import React, { createContext, useState, useContext } from 'react';

/**
 * 全局数据控制上下文
 * 用于在整个应用中共享用户选择的火星年和季节参数
 */
const DataContext = createContext();

export const DataProvider = ({ children }) => {
    // 火星年 (Martian Year)
    const [marsYear, setMarsYear] = useState(27);
    
    // 季节 (Solar Longitude, Ls: 0-360度)
    const [solarLongitude, setSolarLongitude] = useState(10);
    
    // 自动刷新开关（未来可扩展）
    const [autoRefresh, setAutoRefresh] = useState(false);

    const value = {
        marsYear,
        setMarsYear,
        solarLongitude,
        setSolarLongitude,
        autoRefresh,
        setAutoRefresh
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};

// 自定义 Hook，方便组件使用
export const useDataContext = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useDataContext 必须在 DataProvider 内部使用');
    }
    return context;
};
