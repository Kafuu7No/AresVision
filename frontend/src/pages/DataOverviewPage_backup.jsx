import React, { useState, useEffect, useRef, useCallback } from 'react';
import Globe from 'react-globe.gl';
import { scaleSequential } from 'd3-scale';
import { interpolateViridis, interpolateRdYlBu } from 'd3-scale-chromatic';
import C from '../constants/colors';
import { DataOverviewProvider, useDataOverview } from '../contexts/DataOverviewContext';

// 简单的 API 调用函数
const fetchGlobePoints = async (marsYear, sampleRate = 0.1) => {
  const response = await fetch(`/api/explore/globe-points?mars_year=${marsYear}&sample_rate=${sampleRate}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};

// 模拟图表组件
const MiniChart = ({ type, data, isExpanded, scale = 1 }) => {
  const getChartContent = () => {
    const dynamicStrokeWidth = Math.max(1, scale * 1.5);
    const dynamicRadius = Math.max(1, scale * 2);
    const dynamicFontSize = isExpanded ? '16px' : `${8 + scale * 6}px`;
    
    switch (type) {
      case 'seasonal':
        return (
          <svg 
            width="100%" 
            height={isExpanded ? "400" : `${Math.max(40, 60 * scale)}`} 
            viewBox="0 0 200 60"
            style={{ background: 'rgba(0, 0, 0, 0.2)' }}
          >
            <defs>
              <linearGradient id="seasonalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={C.mars} />
                <stop offset="100%" stopColor={C.deepSpace} />
              </linearGradient>
              <filter id="glow">
                <glow stdDeviation="2" result="coloredBlur"/>
                <merge>
                  <mergeNode in="coloredBlur"/>
                  <mergeNode in="SourceGraphic"/>
                </merge>
              </filter>
            </defs>
            {/* 模拟季节曲线 */}
            <path
              d="M10,45 Q60,20 100,30 T190,40"
              stroke={C.ice}
              strokeWidth={dynamicStrokeWidth}
              fill="none"
              filter="url(#glow)"
            />
            <path
              d="M10,45 Q60,20 100,30 T190,40 V60 H10 Z"
              fill="url(#seasonalGrad)"
              opacity={0.3 * scale}
            />
            {/* 数据点 */}
            {[10,60,100,190].map((x, i) => (
              <circle
                key={i}
                cx={x}
                cy={[45,20,30,40][i]}
                r={dynamicRadius}
                fill={C.ice}
                opacity={0.8}
              />
            ))}
          </svg>
        );
      
      case 'correlation':
        return (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: `${Math.max(1, scale * 2)}px`,
            width: '100%',
            height: isExpanded ? '400px' : `${Math.max(40, 60 * scale)}px`,
          }}>
            {Array.from({ length: 16 }, (_, i) => (
              <div
                key={i}
                style={{
                  background: `rgba(${Math.random() > 0.5 ? '255,100,50' : '0,240,255'}, ${0.4 + Math.random() * 0.5})`,
                  borderRadius: `${scale}px`,
                  border: `${Math.max(0.5, scale * 0.5)}px solid rgba(255,255,255,0.2)`,
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>
        );
      
      case 'timeseries':
        return (
          <svg 
            width="100%" 
            height={isExpanded ? "400" : `${Math.max(40, 60 * scale)}`} 
            viewBox="0 0 200 60"
            style={{ background: 'rgba(0, 0, 0, 0.1)' }}
          >
            <defs>
              <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={C.ice} />
                <stop offset="50%" stopColor={C.mars} />
                <stop offset="100%" stopColor={C.ice} />
              </linearGradient>
            </defs>
            {/* 背景网格 */}
            <defs>
              <pattern id="grid" width="20" height="10" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 10" fill="none" stroke="rgba(0,240,255,0.1)" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {/* 时间序列折线 */}
            <polyline
              points="10,40 30,25 50,35 70,20 90,30 110,15 130,25 150,35 170,20 190,30"
              fill="none"
              stroke="url(#lineGrad)"
              strokeWidth={dynamicStrokeWidth}
            />
            {/* 数据点 */}
            {[10,30,50,70,90,110,130,150,170,190].map((x, i) => (
              <circle
                key={i}
                cx={x}
                cy={[40,25,35,20,30,15,25,35,20,30][i]}
                r={dynamicRadius}
                fill={C.mars}
                opacity={0.8}
              />
            ))}
          </svg>
        );
      
      default:
        return (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: C.ice,
            opacity: 0.8 * scale,
          }}>
            <div style={{ 
              fontSize: isExpanded ? '40px' : `${Math.max(16, 20 * scale)}px`,
              marginBottom: isExpanded ? '12px' : `${scale * 8}px`,
              filter: `drop-shadow(0 0 ${scale * 5}px ${C.ice})`
            }}>
              {type === 'forecast' ? '🔮' : 
               type === 'environment' ? '🌡️' : 
               type === 'histogram' ? '📊' : '📈'}
            </div>
            {isExpanded || scale > 0.6 ? (
              <div style={{ 
                fontSize: dynamicFontSize,
                textAlign: 'center',
                opacity: scale * 0.8 
              }}>
                {isExpanded ? `${type.charAt(0).toUpperCase() + type.slice(1)} 数据可视化` : '监控中...'}
              </div>
            ) : null}
          </div>
        );
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {getChartContent()}
    </div>
  );
};

// 指挥中心数据窗口组件
const DataWindow = ({ 
  title, 
  type, 
  position, 
  size,
  scale, 
  opacity, 
  zIndex, 
  transform,
  isExpanded, 
  onClick,
  children 
}) => {
  const windowStyle = {
    position: 'absolute',
    left: isExpanded ? '50%' : `${position.x}px`,
    top: isExpanded ? '50%' : `${position.y}px`,
    width: isExpanded ? '85vw' : `${size.width}px`,
    height: isExpanded ? '85vh' : `${size.height}px`,
    background: isExpanded 
      ? `linear-gradient(135deg, rgba(12, 24, 48, 0.95) 0%, rgba(24, 48, 96, 0.90) 100%)`
      : `linear-gradient(135deg, rgba(12, 24, 48, ${Math.max(0.8, opacity)}) 0%, rgba(24, 48, 96, ${Math.max(0.7, opacity * 0.9)}) 100%)`,
    border: `1px solid rgba(0, 240, 255, ${Math.max(0.6, opacity)})`,
    borderRadius: isExpanded ? '16px' : `${transform?.borderRadius || 12}px`,
    backdropFilter: `blur(${transform?.blurIntensity || 10}px)`,
    opacity: Math.max(0.8, opacity), // 确保最小可见度
    zIndex: isExpanded ? 100 : Math.max(50, zIndex), // 确保在球体之上
    transform: isExpanded 
      ? 'translate(-50%, -50%)' 
      : `translate(-50%, -50%) rotate(${transform?.rotation || 0}deg)`,
    transformOrigin: 'center',
    transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
    cursor: isExpanded ? 'default' : 'pointer',
    padding: isExpanded ? '24px' : `${Math.max(8, scale * 8)}px`,
    boxShadow: `
      0 ${4 + scale * 12}px ${16 + scale * 24}px rgba(0, 240, 255, ${Math.max(0.2, opacity * 0.3)}),
      inset 0 1px 0 rgba(255, 255, 255, ${Math.max(0.1, opacity * 0.2)}),
      0 0 ${scale * 20}px rgba(0, 240, 255, ${Math.max(0.1, opacity * 0.2)})
    `,
    pointerEvents: 'auto',
    overflow: 'hidden',
    // 确保窗口可见的基础样式
    minWidth: '150px',
    minHeight: '100px'
  };

  return (
    <div 
      style={windowStyle} 
      className={!isExpanded ? "data-window" : "data-window-expanded"}
      onClick={!isExpanded ? onClick : undefined}
    >
      {/* 动态粒子背景效果 */}
      {!isExpanded && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(circle at 50% 50%, 
            rgba(0, 240, 255, ${Math.max(0.03, opacity * 0.08)}) 0%, 
            transparent 60%)`,
          opacity: Math.max(0.3, scale),
          pointerEvents: 'none'
        }} />
      )}

      <div style={{
        color: C.ice,
        fontSize: isExpanded ? '24px' : `${Math.max(12, 10 + scale * 6)}px`,
        fontFamily: 'Orbitron',
        fontWeight: 'bold',
        marginBottom: isExpanded ? '16px' : `${Math.max(4, 4 + scale * 8)}px`,
        textAlign: 'center',
        textShadow: `0 0 ${Math.max(5, scale * 10)}px ${C.ice}`,
        letterSpacing: `${Math.max(0.5, scale * 0.5)}px`,
        textTransform: 'uppercase',
        position: 'relative',
        zIndex: 2
      }}>
        {title}
      </div>

      {isExpanded && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: `1px solid ${C.ice}`,
            color: C.ice,
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
            transition: 'all 0.3s ease',
          }}
        >
          ×
        </button>
      )}

      <div style={{
        height: isExpanded ? 'calc(100% - 80px)' : `${Math.max(60, size.height - (isExpanded ? 80 : 40 + scale * 20))}px`,
        overflow: 'hidden',
        background: `rgba(0, 0, 0, ${Math.max(0.3, 0.2 + opacity * 0.3)})`,
        borderRadius: `${Math.max(4, 4 + scale * 4)}px`,
        border: `1px solid rgba(0, 240, 255, ${Math.max(0.2, opacity * 0.4)})`,
        padding: `${Math.max(4, 4 + scale * 4)}px`,
        position: 'relative',
        zIndex: 1,
      }}>
        <MiniChart 
          type={type} 
          isExpanded={isExpanded}
          scale={scale}
        />
      </div>
    </div>
  );
};

// 全屏3D火星场景组件
const Mars3DBackground = ({ 
  ozoneData, 
  globeScale, 
  onGlobeInteraction, 
  containerRef 
}) => {
  const globeRef = useRef();

  useEffect(() => {
    if (globeRef.current) {
      // 根据缩放调整相机距离
      globeRef.current.pointOfView({ 
        altitude: 2.5 / globeScale,
        lat: 0, 
        lng: 0 
      }, 1000);
    }
  }, [globeScale]);

  const colorScale = scaleSequential(interpolateRdYlBu)
    .domain([ozoneData.minVal || 0, ozoneData.maxVal || 1]);

  // 计算全屏尺寸
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  return (
    <div style={{
      position: 'fixed', // 固定定位占据整个视口
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 1, // 背景层，z-index较低
      pointerEvents: 'all',
    }}>
      <Globe
        ref={globeRef}
        width={screenWidth}
        height={screenHeight}
        globeImageUrl="/mars_texture.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        atmosphereColor="rgba(255, 100, 50, 0.8)"
        atmosphereAltitude={0.12}
        pointsData={ozoneData.points || []}
        pointLat="lat"
        pointLng="lng"
        pointColor={d => colorScale(d.val)}
        pointAltitude={0.01}
        pointRadius={0.8}
        onGlobeReady={() => {
          console.log('全屏火星场景已就绪');
        }}
      />
    </div>
  );
};

// 主要页面组件（使用 Context）
const DataOverviewPageContent = () => {
  const [ozoneData, setOzoneData] = useState({ points: [], minVal: 0, maxVal: 1 });
  const [loading, setLoading] = useState(true);
  const [globeScale, setGlobeScale] = useState(1.0);
  const [expandedWindow, setExpandedWindow] = useState(null);
  const [animationTime, setAnimationTime] = useState(0); // 添加动画时间状态
  const containerRef = useRef();
  
  // 从上下文获取数据
  const { marsYear, setMarsYear } = useDataOverview();

  // 实时动画循环
  useEffect(() => {
    let animationFrame;
    const animate = (timestamp) => {
      setAnimationTime(timestamp * 0.001); // 转换为秒
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  // 动态数据窗口配置 - 移除固定位置，使用智能布局
  const dataWindows = [
    { 
      id: 'seasonal', 
      title: '季节分析', 
      type: 'seasonal',
      baseSize: { width: 280, height: 180 },
      priority: 1 // 优先级，影响缩放敏感度
    },
    { 
      id: 'correlation', 
      title: '关联矩阵', 
      type: 'correlation',
      baseSize: { width: 220, height: 220 }, // 方形窗口
      priority: 2
    },
    { 
      id: 'timeseries', 
      title: '时序监控', 
      type: 'timeseries',
      baseSize: { width: 300, height: 160 }, // 宽窄窗口
      priority: 1
    },
    { 
      id: 'distribution', 
      title: '数据分布', 
      type: 'histogram',
      baseSize: { width: 200, height: 200 },
      priority: 3
    },
    { 
      id: 'forecast', 
      title: '预测引擎', 
      type: 'forecast',
      baseSize: { width: 320, height: 140 },
      priority: 1
    },
    { 
      id: 'environment', 
      title: '环境参数', 
      type: 'environment',
      baseSize: { width: 260, height: 180 },
      priority: 2
    },
  ];

  // 加载数据
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 获取点云数据
        const response = await fetchGlobePoints(marsYear, 0.1);
        
        if (response.success) {
          setOzoneData({
            points: response.data.points || [],
            minVal: response.data.min_val || 0,
            maxVal: response.data.max_val || 1,
          });
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        // 使用模拟数据
        const mockPoints = [];
        for (let i = 0; i < 1000; i++) {
          mockPoints.push({
            lat: (Math.random() - 0.5) * 180,
            lng: (Math.random() - 0.5) * 360,
            val: Math.random(),
          });
        }
        setOzoneData({
          points: mockPoints,
          minVal: 0,
          maxVal: 1,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [marsYear]);

  // 处理滚轮缩放
  const handleWheel = useCallback((event) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    setGlobeScale(prev => Math.max(0.5, Math.min(3.0, prev + delta)));
  }, []);

  // 节流的动画更新
  const animationUpdateRef = useRef();
  const forceUpdate = useCallback(() => {
    if (animationUpdateRef.current) return; // 防止重复更新
    animationUpdateRef.current = setTimeout(() => {
      setAnimationTime(Date.now() * 0.001);
      animationUpdateRef.current = null;
    }, 16); // ~60fps
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  // 动态窗口布局系统 - 智能空间分割
  const getWindowProps = (windowConfig, windowIndex) => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const centerX = screenWidth / 2;
    const centerY = screenHeight / 2;
    
    // 简化的分布逻辑
    const angleStep = (2 * Math.PI) / dataWindows.length;
    const baseAngle = windowIndex * angleStep;
    // 确保animationTime有默认值
    const safeAnimationTime = animationTime || 0;
    const angleVariation = Math.sin(safeAnimationTime * 0.5 + windowIndex) * 0.1;
    const currentAngle = baseAngle + angleVariation;
    
    // 简化分布半径计算 
    const baseRadius = 250 + (globeScale - 1) * 100;
    const distributionRadius = Math.max(200, baseRadius);
    
    // 计算位置
    let posX = centerX + Math.cos(currentAngle) * distributionRadius;
    let posY = centerY + Math.sin(currentAngle) * distributionRadius;
    
    // 边界检查
    const margin = 120; // 增加边距，确保窗口不会超出屏幕
    posX = Math.max(margin, Math.min(screenWidth - margin, posX));
    posY = Math.max(margin, Math.min(screenHeight - margin, posY));
    
    // 简化缩放逻辑
    const priorityMultiplier = windowConfig.priority === 1 ? 1.2 : windowConfig.priority === 2 ? 1.0 : 0.8;
    const scaleBase = Math.max(0.5, Math.min(1.5, (2 - globeScale) * priorityMultiplier));
    const dynamicScale = scaleBase + Math.sin(safeAnimationTime * 0.3 + windowIndex) * 0.1;
    
    // 计算尺寸
    const finalWidth = windowConfig.baseSize.width * dynamicScale;
    const finalHeight = windowConfig.baseSize.height * dynamicScale;
    
    // 透明度
    const baseOpacity = Math.max(0.6, 1.2 - globeScale * 0.3);
    const dynamicOpacity = Math.max(0.4, Math.min(1.0, baseOpacity));
    
    // Z-index - 确保窗口在球体之上
    const zIndex = 50 + windowIndex;
    
    return {
      scale: dynamicScale,
      opacity: dynamicOpacity,
      zIndex: zIndex,
      position: { x: posX, y: posY },
      size: { width: finalWidth, height: finalHeight },
      transform: {
        rotation: angleVariation * 10,
        borderRadius: Math.max(8, 12 * dynamicScale),
        blurIntensity: Math.max(8, 10 * dynamicScale)
      }
    };
  };

  const handleWindowClick = (windowId) => {
    setExpandedWindow(expandedWindow === windowId ? null : windowId);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: `radial-gradient(ellipse at center, ${C.deepSpace} 0%, ${C.space} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: C.ice,
        fontSize: '18px',
        fontFamily: 'Orbitron',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px', animation: 'pulse 1.5s infinite' }}>
            🚀
          </div>
          正在初始化数据中心...
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        cursor: expandedWindow ? 'default' : 'grab',
      }}
    >
      {/* 全屏3D火星背景场景 */}
      <Mars3DBackground
        ozoneData={ozoneData}
        globeScale={globeScale}
        containerRef={containerRef}
      />

      {/* UI覆盖层 - 标题 */}
      <div style={{
        position: 'absolute',
        top: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: C.ice,
        fontSize: '24px',
        fontFamily: 'Orbitron',
        fontWeight: 'bold',
        textShadow: `0 0 20px ${C.ice}`,
        zIndex: 50, // UI元素层级
        textAlign: 'center',
        pointerEvents: 'none', // 避免阻挡后面的交互
      }}>
        MARS DATA OVERVIEW CENTER
        <div style={{
          fontSize: '14px',
          opacity: 0.8,
          marginTop: '8px',
          fontWeight: 'normal',
        }}>
          火星臭氧数据总览中心
        </div>
      </div>

      {/* UI覆盖层 - 缩放指示器 */}
      <div style={{
        position: 'absolute',
        top: '120px',
        right: '40px',
        color: C.ice,
        fontSize: '12px',
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '8px 12px',
        borderRadius: '6px',
        border: `1px solid ${C.ice}`,
        zIndex: 50,
        backdropFilter: 'blur(10px)',
        pointerEvents: 'auto',
      }}>
        缩放: {(globeScale * 100).toFixed(0)}%
      </div>

      {/* UI覆盖层 - 控制面板 */}
      <div style={{
        position: 'absolute',
        top: '120px',
        left: '40px',
        color: C.ice,
        fontSize: '12px',
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '16px',
        borderRadius: '8px',
        border: `1px solid ${C.ice}`,
        zIndex: 50,
        minWidth: '200px',
        backdropFilter: 'blur(10px)',
        pointerEvents: 'auto',
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: 'bold',
          marginBottom: '12px',
          color: C.ice,
          textShadow: `0 0 10px ${C.ice}`,
        }}>
          数据控制面板
        </div>
        
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', marginBottom: '4px' }}>
            火星年: MY{marsYear}
          </label>
          <select
            value={marsYear}
            onChange={(e) => setMarsYear(Number(e.target.value))}
            style={{
              background: 'rgba(0, 0, 0, 0.7)',
              border: `1px solid ${C.ice}`,
              color: C.ice,
              borderRadius: '4px',
              padding: '4px 8px',
              width: '100%',
            }}
          >
            <option value={27}>MY 27</option>
            <option value={28}>MY 28</option>
          </select>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <div style={{ marginBottom: '4px' }}>
            臭氧数据点: {ozoneData.points.length}
          </div>
          <div style={{ marginBottom: '4px' }}>
            范围: {ozoneData.minVal?.toFixed(3)} - {ozoneData.maxVal?.toFixed(3)}
          </div>
        </div>
        
        <div style={{ fontSize: '10px', opacity: 0.7 }}>
          滚轮缩放球体 · 拖拽旋转 · 点击窗口放大
        </div>
      </div>

      {/* 指挥中心连接线效果 */}
      <svg 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 2,
          opacity: Math.max(0.1, 0.4 - (globeScale - 1) * 0.2)
        }}
      >
        <defs>
          <linearGradient id="connectionGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#ff6432" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.6" />
          </linearGradient>
          <filter id="connectionGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* 从中心向各个窗口的连接线 */}
        {dataWindows.map((windowConfig, index) => {
          const props = getWindowProps(windowConfig, index);
          const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2; 
          const windowX = props.position.x;
          const windowY = props.position.y;
          
          // 动态的连接线样式
          const connectionOpacity = Math.max(0.1, props.opacity * 0.8 * (2 - globeScale) * 0.5);
          const connectionWidth = Math.max(0.5, props.scale * 2);
          
          return (
            <g key={`connection-${window.id}`}>
              {/* 主连接线 */}
              <line
                className="connection-line"
                x1={centerX}
                y1={centerY}
                x2={windowX}
                y2={windowY}
                stroke="url(#connectionGrad)"
                strokeWidth={connectionWidth}
                strokeDasharray={`${5 * props.scale},${3 * props.scale}`}
                filter="url(#connectionGlow)"
                opacity={connectionOpacity}
              >
                <animate
                  attributeName="stroke-dashoffset"
                  values="0;-20"
                  dur={`${3 + index * 0.5}s`}
                  repeatCount="indefinite"
                />
              </line>
              
              {/* 数据流粒子效果 */}
              {globeScale < 1.5 && (
                <circle
                  r="2"
                  fill={C.ice}
                  opacity={connectionOpacity * 1.5}
                >
                  <animateMotion
                    dur={`${4 + index}s`}
                    repeatCount="indefinite"
                    path={`M${centerX},${centerY} L${windowX},${windowY}`}
                  />
                </circle>
              )}
            </g>
          );
        })}
        
        {/* 中心脉冲圆环 */}
        <circle
          cx={window.innerWidth / 2}
          cy={window.innerHeight / 2}
          r={150 + globeScale * 50}
          fill="none"
          stroke="rgba(0, 240, 255, 0.2)"
          strokeWidth="1"
          strokeDasharray="5,5"
        >
          <animate
            attributeName="r"
            values={`${150 + globeScale * 50};${180 + globeScale * 50};${150 + globeScale * 50}`}
            dur="4s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="stroke-opacity"
            values="0.2;0.6;0.2"
            dur="4s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>

      {/* UI覆盖层 - 指挥中心数据窗口 */}
      {dataWindows.map((windowConfig, index) => {
        const props = getWindowProps(windowConfig, index);
        
        return (
          <DataWindow
            key={windowConfig.id}
            title={windowConfig.title}
            type={windowConfig.type}
            position={props.position}
            size={props.size}
            scale={props.scale}
            opacity={props.opacity}
            zIndex={props.zIndex}
            transform={props.transform}
            isExpanded={expandedWindow === windowConfig.id}
            onClick={() => handleWindowClick(windowConfig.id)}
          />
        );
      })}

      {/* UI覆盖层 - 遮罩层（当有窗口展开时） */}
      {expandedWindow && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            zIndex: 95, // 最高层遮罩
            backdropFilter: 'blur(5px)',
          }}
          onClick={() => setExpandedWindow(null)}
        />
      )}

      {/* UI覆盖层 - 指挥中心状态栏 */}
      <div style={{
        position: 'absolute',
        bottom: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '20px',
        alignItems: 'center',
        color: C.ice,
        fontSize: '12px',
        zIndex: 50,
        pointerEvents: 'none',
        opacity: Math.max(0.5, 1 - (globeScale - 1) * 0.3)
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(0, 0, 0, 0.6)',
          padding: '8px 16px',
          borderRadius: '20px',
          border: `1px solid rgba(0, 240, 255, 0.3)`,
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: C.mars,
            animation: 'pulse 1.5s infinite'
          }} />
          <span>MARS DATA LINK</span>
          <span style={{color: '#4CAF50'}}>● ACTIVE</span>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(0, 0, 0, 0.6)',
          padding: '8px 16px',
          borderRadius: '20px',
          border: `1px solid rgba(0, 240, 255, 0.3)`,
          backdropFilter: 'blur(10px)'
        }}>
          <span>MY{marsYear}</span>
          <span style={{color: C.ice}}>|</span>
          <span>{ozoneData.points.length} NODES</span>
          <span style={{color: C.ice}}>|</span>
          <span>SCALE {(globeScale * 100).toFixed(0)}%</span>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(30px, -30px) rotate(120deg); }
          66% { transform: translate(-20px, 20px) rotate(240deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
        }
        
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 5px rgba(0, 240, 255, 0.5); }
          50% { box-shadow: 0 0 20px rgba(0, 240, 255, 0.8), 0 0 30px rgba(0, 240, 255, 0.6); }
        }
        
        @keyframes dataFlow {
          0% { opacity: 0.3; transform: scale(0.8) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.1) rotate(180deg); }
          100% { opacity: 0.3; transform: scale(0.8) rotate(360deg); }
        }

        @keyframes windowPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.02); }
        }

        @keyframes particleFloat {
          0% { transform: translateY(0px) translateX(0px); opacity: 0.3; }
          50% { transform: translateY(-10px) translateX(5px); opacity: 0.8; }
          100% { transform: translateY(0px) translateX(0px); opacity: 0.3; }
        }

        /* 为窗口添加动态悬停效果 */
        .data-window {
          transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
          animation: windowPulse 8s ease-in-out infinite;
        }
        
        .data-window:hover {
          animation: none;
          transform: translate(-50%, -50%) scale(1.05) !important;
          box-shadow: 
            0 15px 60px rgba(0, 240, 255, 0.4),
            0 0 40px rgba(0, 240, 255, 0.3),
            inset 0 0 20px rgba(0, 240, 255, 0.1);
          filter: brightness(1.1);
          z-index: 999 !important;
        }
        
        /* 连接线动画增强 */
        .connection-line {
          animation: dataFlow 3s ease-in-out infinite;
          filter: drop-shadow(0 0 3px rgba(0, 240, 255, 0.6));
        }

        /* 响应式媒体查询 */
        @media (max-width: 1200px) {
          .data-window {
            transform: translate(-50%, -50%) scale(0.9) !important;
          }
        }

        @media (max-width: 768px) {
          .data-window {
            transform: translate(-50%, -50%) scale(0.7) !important;
          }
        }
      `}</style>
    </div>
  );
};

// 导出的主组件（包装了 Provider）
export default function DataOverviewPage() {
  return (
    <DataOverviewProvider>
      <DataOverviewPageContent />
    </DataOverviewProvider>
  );
}