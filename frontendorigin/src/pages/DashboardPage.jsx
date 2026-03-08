import React from 'react';
import SeasonalChart from '../components/SeasonalChart';
import SeasonalLineChart from '../components/SeasonalLineChart';

const DashboardPage = ({ viewMode }) => {
    return (
        <div style={{ 
            width: '100%', height: '100%', 
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            background: 'linear-gradient(to bottom, #000000, #1a1a1a)' 
        }}>
           {viewMode === 'chart' && <SeasonalChart />}
           {viewMode === 'line-chart' && <SeasonalLineChart />}
        </div>
    );
};

export default DashboardPage;