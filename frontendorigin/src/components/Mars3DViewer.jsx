// d:\A-development-project\MarsGemini\frontend\src\components\Mars3DViewer.jsx

import React, { useState, useEffect, useRef } from 'react';
import Globe from 'react-globe.gl';
import Webcam from 'react-webcam';
import { scaleSequential } from 'd3-scale';
import { interpolateViridis } from 'd3-scale-chromatic';
import { useHandControl } from '../hooks/useHandControl';
import { fetchMapData } from '../services/api';
import { useDataContext } from '../contexts/DataContext';

const Mars3DViewer = () => {
    const [mapData, setMapData] = useState({ points: [], minVal: 0, maxVal: 1 });
    const [loading, setLoading] = useState(true);

    // 从全局上下文获取用户选择的参数
    const { marsYear, solarLongitude } = useDataContext();

    // 地球实例 Ref
    const globeEl = useRef();

    // 使用自定义 Hook 接管手势控制
    const { webcamRef, gestureStatus } = useHandControl(globeEl);

    // 当参数变化时重新加载数据
    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const data = await fetchMapData(marsYear, solarLongitude);
                setMapData(data);
            } catch (error) {
                console.error("数据加载失败", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [marsYear, solarLongitude]); // 依赖项：当这些值变化时重新请求

    const colorScale = scaleSequential(interpolateViridis)
        .domain([mapData.minVal, mapData.maxVal]);

    return (
        <>
            {/* 状态提示与摄像头叠加层 */}
            <div style={{ position: 'absolute', bottom: 120, left: 20, zIndex: 100, display: 'flex', alignItems: 'flex-end', gap: '20px' }}>
                <div style={{
                    background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(5px)',
                    border: '1px solid rgba(0, 240, 255, 0.3)', borderRadius: '8px',
                    padding: '10px 15px', color: 'white', minWidth: '200px'
                }}>
                    <h4 style={{ margin: '0 0 5px 0', color: '#00F0FF' }}>🤖 MediaPipe 手势追踪</h4>
                    <p style={{ margin: '0 0 5px 0', fontSize: '14px' }}>当前状态: {gestureStatus}</p>
                    {loading ? (
                        <p style={{ margin: 0, fontSize: '12px', color: '#E55934' }}>⏳ 渲染 MY{marsYear} 数据中...</p>
                    ) : (
                        <p style={{ margin: 0, fontSize: '12px', color: '#4CAF50' }}>✅ {mapData.points.length} 粒子加载完毕</p>
                    )}
                </div>

                <div style={{ border: '2px solid rgba(0, 240, 255, 0.5)', borderRadius: '8px', overflow: 'hidden', height: 120, boxShadow: '0 0 10px rgba(0, 240, 255, 0.2)' }}>
                    <Webcam
                        ref={webcamRef}
                        style={{ width: 160, height: 120, transform: "scaleX(-1)", display: 'block' }}
                    />
                </div>
            </div>

            {/* 3D 地球 */}
            <Globe
                ref={globeEl}
                globeImageUrl="/mars_texture.jpg"
                backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
                atmosphereColor="rgba(0, 200, 255, 0.6)"
                atmosphereAltitude={0.15}
                pointsData={mapData.points}
                pointLat="lat"
                pointLng="lng"
                pointColor={d => colorScale(d.val)}
                pointAltitude={0.015}
                pointRadius={1.0}
            />
        </>
    );
};

export default Mars3DViewer;
