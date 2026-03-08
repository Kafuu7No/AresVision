import React, { useState, useEffect, useRef } from 'react';
import Globe from 'react-globe.gl';
import { scaleSequential } from 'd3-scale';
import { interpolateRdYlBu } from 'd3-scale-chromatic';
import C from '../constants/colors';
import { DataOverviewProvider, useDataOverview } from '../contexts/DataOverviewContext';

// API调用函数
const fetchGlobePoints = async (marsYear, sampleRate = 0.1) => {
  try {
    const response = await fetch(`/api/explore/globe-points?mars_year=${marsYear}&sample_rate=${sampleRate}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    console.error('API调用失败:', error);
    return null;
  }
};

// 数据选项配置
const DATA_OPTIONS = [
  { 
    id: 'seasonal', 
    title: '季节分析', 
    icon: '📈', 
    description: '臭氧浓度季节性变化趋势',
    color: C.ice
  },
  { 
    id: 'correlation', 
    title: '关联矩阵', 
    icon: '🔗', 
    description: '环境变量相关性分析',
    color: C.mars
  },
  { 
    id: 'realtime', 
    title: '实时监控', 
    icon: '⚡', 
    description: '动态数据流监测',
    color: C.ice
  },
  { 
    id: 'environment', 
    title: '环境参数', 
    icon: '🌡️', 
    description: '温度、压力、风速等参数',
    color: C.mars
  },
  { 
    id: 'prediction', 
    title: '预测引擎', 
    icon: '🔮', 
    description: 'PredRNNv2模型预测结果',
    color: C.ice
  },
  { 
    id: 'distribution', 
    title: '数据分布', 
    icon: '📊', 
    description: '臭氧浓度分布统计',
    color: C.mars
  }
];

// 左侧菜单组件
const SidebarMenu = ({ selectedItem, onItemSelect }) => {
  return (
    <div style={{
      position: 'fixed',
      left: 0,
      top: 0,
      width: '280px',
      height: '100vh',
      background: 'linear-gradient(180deg, rgba(12, 24, 48, 0.95) 0%, rgba(24, 48, 96, 0.90) 100%)',
      backdropFilter: 'blur(20px)',
      borderRight: `2px solid rgba(0, 240, 255, 0.3)`,
      zIndex: 1000,
      padding: '20px 0',
      overflowY: 'auto'
    }}>
      {/* 标题区 */}
      <div style={{
        padding: '0 20px 30px 20px',
        borderBottom: '1px solid rgba(0, 240, 255, 0.2)'
      }}>
        <h2 style={{
          color: C.ice,
          fontFamily: 'Orbitron',
          fontSize: '18px',
          fontWeight: 'bold',
          margin: '0 0 8px 0',
          textShadow: `0 0 10px ${C.ice}`,
          textAlign: 'center'
        }}>
          数据监控中心
        </h2>
        <div style={{
          color: 'rgba(0, 240, 255, 0.6)',
          fontSize: '12px',
          textAlign: 'center',
          fontFamily: 'Exo 2'
        }}>
          Mars Ozone Analysis
        </div>
      </div>

      {/* 菜单项列表 */}
      <div style={{ padding: '20px 10px' }}>
        {DATA_OPTIONS.map((option, index) => {
          const isSelected = selectedItem?.id === option.id;
          
          return (
            <div
              key={option.id}
              onClick={() => onItemSelect(option)}
              style={{
                margin: '8px 0',
                padding: '16px',
                borderRadius: '12px',
                background: isSelected 
                  ? `linear-gradient(135deg, rgba(0, 240, 255, 0.15) 0%, rgba(24, 48, 96, 0.2) 100%)`
                  : 'rgba(255, 255, 255, 0.03)',
                border: isSelected 
                  ? '2px solid rgba(0, 240, 255, 0.6)' 
                  : '1px solid rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                transform: isSelected ? 'translateX(8px)' : 'translateX(0)',
                boxShadow: isSelected 
                  ? '0 8px 24px rgba(0, 240, 255, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
                  : 'none'
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.target.style.transform = 'translateX(4px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.target.style.transform = 'translateX(0)';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  fontSize: '24px',
                  marginRight: '12px',
                  filter: isSelected ? `drop-shadow(0 0 8px ${option.color})` : 'none'
                }}>
                  {option.icon}
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{
                    color: isSelected ? option.color : C.ice,
                    fontSize: '14px',
                    fontWeight: 'bold',
                    fontFamily: 'Orbitron',
                    marginBottom: '4px',
                    textShadow: isSelected ? `0 0 8px ${option.color}` : 'none'
                  }}>
                    {option.title}
                  </div>
                  <div style={{
                    color: 'rgba(0, 240, 255, 0.6)',
                    fontSize: '11px',
                    fontFamily: 'Exo 2',
                    lineHeight: 1.3
                  }}>
                    {option.description}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 详细图表组件
const DetailPanel = ({ selectedItem }) => {
  const renderChart = () => {
    if (!selectedItem) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'rgba(0, 240, 255, 0.6)',
          fontFamily: 'Exo 2'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>🛰️</div>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>请选择数据视图</div>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>从左侧菜单选择要查看的数据分析</div>
        </div>
      );
    }

    // 根据选中项渲染不同的图表
    switch (selectedItem.id) {
      case 'seasonal':
        return <SeasonalChart />;
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
        return <div>未知图表类型</div>;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      left: '280px',
      top: 0,
      right: 0,
      height: '100vh',
      background: 'rgba(12, 24, 48, 0.15)',
      backdropFilter: 'blur(10px)',
      zIndex: 500,
      padding: '20px'
    }}>
      {selectedItem && (
        <div style={{
          marginBottom: '20px',
          padding: '16px 20px',
          background: 'rgba(12, 24, 48, 0.8)',
          borderRadius: '12px',
          border: `1px solid rgba(${selectedItem.color === C.ice ? '0,240,255' : '255,100,50'}, 0.3)`,
          backdropFilter: 'blur(15px)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ 
              fontSize: '28px', 
              marginRight: '12px',
              filter: `drop-shadow(0 0 8px ${selectedItem.color})`
            }}>
              {selectedItem.icon}
            </span>
            <div>
              <h3 style={{
                color: selectedItem.color,
                fontFamily: 'Orbitron',
                fontSize: '20px',
                fontWeight: 'bold',
                margin: 0,
                textShadow: `0 0 10px ${selectedItem.color}`
              }}>
                {selectedItem.title}
              </h3>
            </div>
          </div>
          <p style={{
            color: 'rgba(0, 240, 255, 0.8)',
            fontFamily: 'Exo 2',
            fontSize: '14px',
            margin: '0',
            lineHeight: 1.4
          }}>
            {selectedItem.description}
          </p>
        </div>
      )}
      
      <div style={{
        height: selectedItem ? 'calc(100% - 120px)' : '100%',
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '20px',
        overflow: 'hidden'
      }}>
        {renderChart()}
      </div>
    </div>
  );
};

// 季节分析图表
const SeasonalChart = () => {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width="100%" height="100%" viewBox="0 0 800 400" style={{ background: 'rgba(0,0,0,0.1)' }}>
        <defs>
          <linearGradient id="seasonalGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={C.mars} />
            <stop offset="100%" stopColor="rgba(255,100,50,0.1)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* 网格线 */}
        {Array.from({length: 9}, (_, i) => (
          <line key={`h${i}`} x1="60" y1={60 + i * 35} x2="740" y2={60 + i * 35} 
                stroke="rgba(0,240,255,0.1)" strokeWidth="1" />
        ))}
        {Array.from({length: 13}, (_, i) => (
          <line key={`v${i}`} x1={60 + i * 55} y1="60" x2={60 + i * 55} y2="340" 
                stroke="rgba(0,240,255,0.1)" strokeWidth="1" />
        ))}
        
        {/* 季节曲线 */}
        <path
          d="M60,280 Q150,180 240,200 Q330,150 420,170 Q510,140 600,160 Q690,130 740,150"
          stroke={C.ice}
          strokeWidth="4"
          fill="none"
          filter="url(#glow)"
        />
        <path
          d="M60,280 Q150,180 240,200 Q330,150 420,170 Q510,140 600,160 Q690,130 740,150 L740,340 L60,340 Z"
          fill="url(#seasonalGradient)"
          opacity="0.4"
        />
        
        {/* 数据点 */}
        {[
          {x:60,y:280}, {x:150,y:180}, {x:240,y:200}, {x:330,y:150}, 
          {x:420,y:170}, {x:510,y:140}, {x:600,y:160}, {x:690,y:130}, {x:740,y:150}
        ].map((point, i) => (
          <circle key={i} cx={point.x} cy={point.y} r="6" fill={C.ice} filter="url(#glow)" />
        ))}
        
        {/* 坐标轴标签 */}
        <text x="400" y="380" textAnchor="middle" fill={C.ice} fontSize="14" fontFamily="Exo 2">
          太阳经度 (Ls)
        </text>
        <text x="20" y="200" textAnchor="middle" fill={C.ice} fontSize="14" fontFamily="Exo 2" 
              transform="rotate(-90 20 200)">
          臭氧柱浓度 (DU)
        </text>
      </svg>
    </div>
  );
};

// 关联矩阵
const CorrelationMatrix = () => {
  const variables = ['O₃', 'Temp', 'Press', 'Dust', 'H₂O', 'Wind'];
  const matrixSize = 300;
  const cellSize = matrixSize / variables.length;
  
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: matrixSize, height: matrixSize }}>
        <svg width={matrixSize} height={matrixSize}>
          {variables.map((rowVar, i) => 
            variables.map((colVar, j) => {
              const correlation = i === j ? 1 : (Math.random() * 2 - 1);
              const intensity = Math.abs(correlation);
              const color = correlation > 0 ? 
                `rgba(255,100,50,${intensity})` : 
                `rgba(0,240,255,${intensity})`;
              
              return (
                <g key={`${i}-${j}`}>
                  <rect
                    x={j * cellSize}
                    y={i * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill={color}
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="1"
                  />
                  <text
                    x={j * cellSize + cellSize/2}
                    y={i * cellSize + cellSize/2 + 5}
                    textAnchor="middle"
                    fill="white"
                    fontSize="12"
                    fontFamily="Exo 2"
                    textShadow="0 0 2px black"
                  >
                    {correlation.toFixed(2)}
                  </text>
                </g>
              );
            })
          )}
          
          {/* 变量标签 */}
          {variables.map((variable, i) => (
            <g key={`label-${i}`}>
              <text
                x={i * cellSize + cellSize/2}
                y={matrixSize + 20}
                textAnchor="middle"
                fill={C.ice}
                fontSize="14"
                fontFamily="Orbitron"
                fontWeight="bold"
              >
                {variable}
              </text>
              <text
                x={-10}
                y={i * cellSize + cellSize/2 + 5}
                textAnchor="end"
                fill={C.ice}
                fontSize="14"
                fontFamily="Orbitron"
                fontWeight="bold"
              >
                {variable}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};

// 实时监控
const RealtimeMonitor = () => {
  const [dataPoints, setDataPoints] = useState([]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDataPoints(prev => {
        const newPoint = {
          x: prev.length * 15 + 60,
          y: 200 + Math.sin(prev.length * 0.2) * 80 + Math.random() * 30
        };
        return [...prev.slice(-40), newPoint]; // 保持最后40个点
      });
    }, 300);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <svg width="100%" height="100%" viewBox="0 0 800 400" style={{ background: 'rgba(0,0,0,0.1)' }}>
        <defs>
          <pattern id="realtimeGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,240,255,0.1)" strokeWidth="1"/>
          </pattern>
          <filter id="realtimeGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <rect width="100%" height="100%" fill="url(#realtimeGrid)" />
        
        {/* 实时曲线 */}
        {dataPoints.length > 1 && (
          <polyline
            points={dataPoints.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="rgb(0,240,255)"
            strokeWidth="3"
            filter="url(#realtimeGlow)"
          />
        )}
        
        {/* 数据点 */}
        {dataPoints.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r={i === dataPoints.length - 1 ? "5" : "2"}
            fill={i === dataPoints.length - 1 ? C.mars : C.ice}
            opacity={0.4 + (i / dataPoints.length) * 0.6}
            filter="url(#realtimeGlow)"
          />
        ))}
        
        {/* 实时数值显示 */}
        {dataPoints.length > 0 && (
          <g>
            <rect
              x="650"
              y="60"
              width="120"
              height="60"
              fill="rgba(12, 24, 48, 0.8)"
              stroke={C.ice}
              strokeWidth="1"
              rx="8"
            />
            <text
              x="710"
              y="80"
              textAnchor="middle"
              fill={C.ice}
              fontSize="12"
              fontFamily="Orbitron"
            >
              当前数值
            </text>
            <text
              x="710"
              y="105"
              textAnchor="middle"
              fill={C.mars}
              fontSize="16"
              fontFamily="Orbitron"
              fontWeight="bold"
            >
              {((400 - dataPoints[dataPoints.length - 1]?.y || 200) / 2).toFixed(2)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

// 环境仪表盘
const EnvironmentDashboard = () => {
  const gauges = [
    { name: '温度', value: -63, unit: '°C', max: 27, min: -143, color: C.mars },
    { name: '压力', value: 0.6, unit: 'kPa', max: 1.2, min: 0, color: C.ice },
    { name: '尘埃', value: 0.3, unit: 'τ', max: 1, min: 0, color: C.mars },
    { name: '风速', value: 5.8, unit: 'm/s', max: 15, min: 0, color: C.ice }
  ];
  
  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      display: 'grid', 
      gridTemplateColumns: '1fr 1fr', 
      gap: '30px', 
      padding: '20px' 
    }}>
      {gauges.map((gauge, i) => {
        const percent = ((gauge.value - gauge.min) / (gauge.max - gauge.min)) * 100;
        const angle = (percent / 100) * 180;
        
        return (
          <div key={i} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'rgba(12, 24, 48, 0.6)',
            borderRadius: '16px',
            padding: '20px',
            border: `2px solid rgba(${gauge.color === C.ice ? '0,240,255' : '255,100,50'}, 0.4)`,
            backdropFilter: 'blur(10px)'
          }}>
            <h4 style={{
              color: gauge.color,
              fontFamily: 'Orbitron',
              fontSize: '16px',
              fontWeight: 'bold',
              margin: '0 0 20px 0',
              textShadow: `0 0 8px ${gauge.color}`
            }}>
              {gauge.name}
            </h4>
            
            {/* 仪表盘 */}
            <svg width="150" height="100" viewBox="0 0 200 120">
              <defs>
                <linearGradient id={`gauge-grad-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={gauge.color} />
                  <stop offset="50%" stopColor={gauge.color === C.ice ? C.mars : C.ice} />
                  <stop offset="100%" stopColor="red" />
                </linearGradient>
              </defs>
              
              {/* 背景弧 */}
              <path
                d="M40,100 A60,60 0 0,1 160,100"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="8"
                fill="none"
              />
              
              {/* 进度弧 */}
              <path
                d={`M40,100 A60,60 0 ${angle > 90 ? 1 : 0},1 ${40 + 120 * Math.cos((180 - angle) * Math.PI / 180)},${100 - 60 * Math.sin((180 - angle) * Math.PI / 180)}`}
                stroke={`url(#gauge-grad-${i})`}
                strokeWidth="8"
                fill="none"
                filter="drop-shadow(0 0 5px currentColor)"
              />
              
              {/* 中心数值 */}
              <text
                x="100"
                y="110"
                textAnchor="middle"
                fill={gauge.color}
                fontSize="18"
                fontFamily="Orbitron"
                fontWeight="bold"
              >
                {gauge.value}
              </text>
              <text
                x="100"
                y="125"
                textAnchor="middle"
                fill="rgba(255,255,255,0.6)"
                fontSize="12"
                fontFamily="Exo 2"
              >
                {gauge.unit}
              </text>
            </svg>
          </div>
        );
      })}
    </div>
  );
};

// 预测引擎
const PredictionEngine = () => {
  const [progress, setProgress] = useState(0);
  const [predictions, setPredictions] = useState([]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => (prev + 1) % 100);
      
      if (predictions.length < 10) {
        setPredictions(prev => [...prev, {
          time: Date.now(),
          accuracy: 85 + Math.random() * 10,
          confidence: 75 + Math.random() * 20
        }]);
      }
    }, 200);
    
    return () => clearInterval(interval);
  }, [predictions.length]);
  
  return (
    <div style={{ width: '100%', height: '100%', padding: '20px' }}>
      {/* 引擎状态 */}
      <div style={{
        background: 'rgba(12, 24, 48, 0.8)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px',
        border: `1px solid rgba(0, 240, 255, 0.3)`
      }}>
        <h4 style={{
          color: C.ice,
          fontFamily: 'Orbitron',
          fontSize: '18px',
          textAlign: 'center',
          marginBottom: '20px'
        }}>
          PredRNNv2 时空预测引擎
        </h4>
        
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px'
          }}>
            <span style={{ color: C.ice, fontSize: '14px' }}>处理进度</span>
            <span style={{ color: C.mars, fontSize: '14px', fontWeight: 'bold' }}>{progress}%</span>
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${C.ice}, ${C.mars})`,
              borderRadius: '4px',
              transition: 'width 0.2s ease'
            }} />
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: C.mars, fontSize: '24px', fontWeight: 'bold' }}>7</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>输入通道</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: C.ice, fontSize: '24px', fontWeight: 'bold' }}>3</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>时间窗口</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: C.mars, fontSize: '24px', fontWeight: 'bold' }}>36×72</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>空间网格</div>
          </div>
        </div>
      </div>
      
      {/* 预测结果 */}
      <div style={{
        background: 'rgba(12, 24, 48, 0.6)',
        borderRadius: '12px',
        padding: '20px',
        height: 'calc(100% - 200px)',
        overflow: 'hidden'
      }}>
        <h5 style={{
          color: C.ice,
          fontFamily: 'Orbitron',
          fontSize: '16px',
          marginBottom: '16px'
        }}>
          实时预测结果
        </h5>
        
        <svg width="100%" height="200" viewBox="0 0 400 200">
          <defs>
            <linearGradient id="predGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={C.ice} />
              <stop offset="100%" stopColor="rgba(0,240,255,0.1)" />
            </linearGradient>
          </defs>
          
          {predictions.length > 1 && (
            <>
              <polyline
                points={predictions.map((p, i) => `${i * 40 + 20},${180 - p.accuracy * 1.5}`).join(' ')}
                fill="none"
                stroke={C.ice}
                strokeWidth="3"
                filter="drop-shadow(0 0 5px rgb(0,240,255))"
              />
              <path
                d={`M20,${180 - predictions[0].accuracy * 1.5} ${predictions.map((p, i) => 
                  `L${i * 40 + 20},${180 - p.accuracy * 1.5}`
                ).join(' ')} L${(predictions.length - 1) * 40 + 20},180 L20,180 Z`}
                fill="url(#predGrad)"
                opacity="0.3"
              />
            </>
          )}
        </svg>
      </div>
    </div>
  );
};

// 数据分布
const DataDistribution = () => {
  const histogramData = Array.from({length: 20}, (_, i) => ({
    bin: i * 0.05,
    count: Math.random() * 100 + 10
  }));
  
  return (
    <div style={{ width: '100%', height: '100%', padding: '20px' }}>
      <h4 style={{
        color: C.mars,
        fontFamily: 'Orbitron',
        fontSize: '18px',
        textAlign: 'center',
        marginBottom: '30px'
      }}>
        臭氧柱浓度分布统计
      </h4>
      
      <svg width="100%" height="300" viewBox="0 0 600 300">
        {histogramData.map((bar, i) => (
          <g key={i}>
            <rect
              x={50 + i * 25}
              y={250 - bar.count * 2}
              width="20"
              height={bar.count * 2}
              fill={`rgba(255,100,50,${0.4 + (bar.count / 110) * 0.6})`}
              stroke={C.mars}
              strokeWidth="1"
              rx="2"
            />
            {i % 4 === 0 && (
              <text
                x={60 + i * 25}
                y={270}
                textAnchor="middle"
                fill={C.ice}
                fontSize="10"
                fontFamily="Exo 2"
              >
                {bar.bin.toFixed(2)}
              </text>
            )}
          </g>
        ))}
        
        <text x="300" y="290" textAnchor="middle" fill={C.ice} fontSize="12" fontFamily="Exo 2">
          臭氧柱浓度 (DU)
        </text>
        <text x="20" y="150" textAnchor="middle" fill={C.ice} fontSize="12" fontFamily="Exo 2" 
              transform="rotate(-90 20 150)">
          频次
        </text>
      </svg>
    </div>
  );
};

// 全屏3D火星背景
const Mars3DBackground = ({ ozoneData }) => {
  const globeRef = useRef();
  
  useEffect(() => {
    if (globeRef.current) {
      // 设置初始视角
      globeRef.current.pointOfView({ altitude: 2.5, lat: 0, lng: 0 }, 1000);
    }
  }, []);
  
  const colorScale = scaleSequential(interpolateRdYlBu)
    .domain([ozoneData.minVal, ozoneData.maxVal]);
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 1,
      opacity: 0.8
    }}>
      <Globe
        ref={globeRef}
        width={window.innerWidth}
        height={window.innerHeight}
        globeImageUrl="/mars_texture.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        atmosphereColor="rgba(255, 100, 50, 0.8)"
        atmosphereAltitude={0.15}
        pointsData={ozoneData.points}
        pointLat="lat"
        pointLng="lng"
        pointColor={d => colorScale(d.val)}
        pointAltitude={0.008}
        pointRadius={0.4}
      />
    </div>
  );
};

// 主页面组件内容
const DataOverviewPageContent = () => {
  const [ozoneData, setOzoneData] = useState({ points: [], minVal: 0, maxVal: 1 });
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(DATA_OPTIONS[0]);
  const { marsYear } = useDataOverview();

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      const response = await fetchGlobePoints(marsYear, 0.1);
      
      if (response?.success) {
        setOzoneData({
          points: response.data.points || [],
          minVal: response.data.min_val || 0,
          maxVal: response.data.max_val || 1,
        });
      } else {
        // 生成模拟数据
        const mockPoints = Array.from({ length: 800 }, () => ({
          lat: (Math.random() - 0.5) * 180,
          lng: (Math.random() - 0.5) * 360,
          val: Math.random(),
        }));
        setOzoneData({
          points: mockPoints,
          minVal: 0,
          maxVal: 1,
        });
      }
      
      setLoading(false);
    };

    loadData();
  }, [marsYear]);

  if (loading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(circle at center, ${C.deepSpace} 0%, #000 100%)`,
        color: C.ice,
        fontSize: '18px',
        fontFamily: 'Orbitron'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '16px', fontSize: '32px' }}>🛰️</div>
          <div>正在加载火星数据...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      overflow: 'hidden',
      position: 'relative',
      background: '#000'
    }}>
      {/* 全屏3D火星背景 */}
      <Mars3DBackground ozoneData={ozoneData} />
      
      {/* 左侧菜单栏 */}
      <SidebarMenu 
        selectedItem={selectedItem}
        onItemSelect={setSelectedItem}
      />
      
      {/* 右侧详情面板 */}
      <DetailPanel selectedItem={selectedItem} />
    </div>
  );
};

// 带Context的完整页面组件
export default function DataOverviewPage() {
  return (
    <DataOverviewProvider>
      <DataOverviewPageContent />
    </DataOverviewProvider>
  );
}