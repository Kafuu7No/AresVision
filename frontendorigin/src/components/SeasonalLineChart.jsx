import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { fetchSeasonalBands } from '../services/api';
import { useDataContext } from '../contexts/DataContext';

const SeasonalLineChart = () => {
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);

    // 从全局上下文获取用户选择
    const { marsYear } = useDataContext();

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const data = await fetchSeasonalBands(marsYear);
                setChartData(data);
            } catch (err) {
                console.error("加载失败", err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [marsYear]); // 当火星年变化时重新加载

    if (loading) return <div style={{ color: 'white' }}>⏳ 正在计算 MY{marsYear} 纬度带数据...</div>;
    if (!chartData) return <div style={{ color: 'white' }}>无数据</div>;

    const traces = chartData.bands.map(band => ({
        x: chartData.ls,
        y: band.values,
        type: 'scatter',
        mode: 'lines',
        name: band.name,
        line: { width: 2 }
    }));

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <Plot
                data={traces}
                layout={{
                    width: 800,
                    height: 400,
                    title: {
                        text: `MY${marsYear} - Seasonal Ozone Trend by Latitude Band`,
                        font: { color: 'white' }
                    },
                    xaxis: {
                        title: 'Solar Longitude (Ls°)',
                        color: 'white',
                        zeroline: false,
                        range: [0, 360]
                    },
                    yaxis: {
                        title: 'Ozone Column (µm-atm)',
                        color: 'white'
                    },
                    legend: {
                        font: { color: 'white' },
                        orientation: 'h',
                        y: -0.2
                    },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    font: { color: 'white' }
                }}
                config={{ displayModeBar: true, responsive: true }}
            />
            <p style={{ color: '#ccc', fontSize: '12px', textAlign: 'center', marginTop: '10px' }}>
                * 展示不同纬度带（极地、中纬、赤道）随季节变化的臭氧含量趋势。
            </p>
        </div>
    );
};

export default SeasonalLineChart;
