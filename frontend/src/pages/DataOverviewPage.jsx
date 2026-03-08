import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import Globe from 'react-globe.gl';
import C from '../constants/colors';
import { DataOverviewProvider } from '../contexts/DataOverviewContext';
import { fetchGlobeData } from '../services/api';

// Turbo 色阶（与数据探索页统一）
const TURBO_STOPS = [
  [48, 18, 59], [50, 92, 168], [39, 154, 193], [31, 199, 147],
  [94, 227, 80], [191, 240, 35], [249, 211, 31], [252, 155, 28],
  [239, 88, 20], [191, 34, 12], [122, 4, 3],
];
function turboColorRGB(t) {
  t = Math.max(0, Math.min(1, t));
  const idx = t * (TURBO_STOPS.length - 1);
  const i = Math.min(Math.floor(idx), TURBO_STOPS.length - 2);
  const f = idx - i;
  const c0 = TURBO_STOPS[i], c1 = TURBO_STOPS[i + 1];
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * f),
    Math.round(c0[1] + (c1[1] - c0[1]) * f),
    Math.round(c0[2] + (c1[2] - c0[2]) * f),
  ];
}
function turboColor(t) {
  const [r, g, b] = turboColorRGB(t);
  return `rgb(${r},${g},${b})`;
}
function turboColorA(t, a = 1) {
  const [r, g, b] = turboColorRGB(t);
  return `rgba(${r},${g},${b},${a})`;
}

// 数据选项配置
const DATA_OPTIONS = [
  {
    id: 'globe3d',
    title: '三维球体',
    icon: '🌍',
    description: '交互式3D火星球体数据展示',
    color: '#ff6b35',
    is3D: true
  },
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
      top: '70px',
      width: '280px',
      height: 'calc(100vh - 70px)',
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

// 3D球体时间控制面板
const Globe3DControls = ({ ozoneData, lsValue, marsYear, playing, loadingGlobe, onLsChange, onMarsYearChange, onTogglePlay }) => {
  const seasonName =
    lsValue < 90 ? '北半球春 / 南半球秋' :
      lsValue < 180 ? '北半球夏 / 南半球冬' :
        lsValue < 270 ? '北半球秋 / 南半球春' : '北半球冬 / 南半球夏';

  return (
    <div style={{
      position: 'fixed',
      top: '90px',
      right: '20px',
      width: '300px',
      maxHeight: 'calc(100vh - 110px)',
      overflowY: 'auto',
      zIndex: 1500,
      background: 'rgba(12, 24, 48, 0.92)',
      backdropFilter: 'blur(20px)',
      borderRadius: '16px',
      border: '2px solid rgba(255, 107, 53, 0.6)',
      padding: '20px',
      boxShadow: '0 8px 32px rgba(255, 107, 53, 0.3)'
    }}>

      {/* 标题 */}
      <div style={{
        color: '#ff6b35',
        fontFamily: 'Orbitron',
        fontSize: '14px',
        fontWeight: 'bold',
        textShadow: '0 0 10px #ff6b35',
        textAlign: 'center',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid rgba(255,107,53,0.3)'
      }}>
        🌍 三维臭氧数据控制
      </div>

      {/* Mars Year 选择 */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ color: 'rgba(0,240,255,0.7)', fontSize: '10px', fontFamily: 'Orbitron', letterSpacing: 1, marginBottom: '6px' }}>
          MARS YEAR
        </div>
        <select
          value={marsYear}
          onChange={e => onMarsYearChange(Number(e.target.value))}
          style={{
            width: '100%',
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,107,53,0.4)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#ff6b35',
            fontSize: '13px',
            fontFamily: 'Orbitron',
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          <option value={27}>MY 27</option>
          <option value={28}>MY 28</option>
        </select>
      </div>

      {/* Ls 滑块 */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ color: 'rgba(0,240,255,0.7)', fontSize: '10px', fontFamily: 'Orbitron', letterSpacing: 1 }}>SOLAR LONGITUDE Ls</span>
          <span style={{ color: '#ff6b35', fontSize: '14px', fontWeight: 'bold', fontFamily: 'Orbitron' }}>{lsValue}°</span>
        </div>
        <input
          type="range" min={0} max={360} step={5} value={lsValue}
          onChange={e => onLsChange(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#ff6b35', cursor: 'pointer', margin: '4px 0' }}
        />
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: '4px' }}>
          {seasonName}
        </div>
      </div>

      {/* 播放控制 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={onTogglePlay}
          style={{
            flex: 1,
            background: playing ? 'rgba(255,107,53,0.2)' : 'rgba(0,240,255,0.1)',
            border: `1px solid ${playing ? '#ff6b35' : 'rgba(0,240,255,0.5)'}`,
            borderRadius: '8px',
            padding: '10px',
            color: playing ? '#ff6b35' : 'rgba(0,240,255,0.9)',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontFamily: 'Orbitron',
            letterSpacing: 1,
            transition: 'all 0.3s ease'
          }}
        >
          {playing ? '⏸ PAUSE' : '▶ PLAY'}
        </button>
        <button
          onClick={() => { onLsChange(0); }}
          title="重置到 Ls=0°"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '10px 14px',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          ↩
        </button>
      </div>

      {/* 加载指示 */}
      {loadingGlobe && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          marginBottom: '12px', padding: '8px 10px',
          background: 'rgba(255,107,53,0.08)',
          border: '1px solid rgba(255,107,53,0.25)',
          borderRadius: '8px'
        }}>
          <div style={{
            width: '12px', height: '12px', flexShrink: 0,
            border: '2px solid rgba(255,107,53,0.2)',
            borderTop: '2px solid #ff6b35',
            borderRadius: '50%',
            animation: 'spin-slow 1s linear infinite'
          }} />
          <span style={{ color: '#ff6b35', fontSize: '10px', fontFamily: 'Orbitron' }}>加载数据中...</span>
        </div>
      )}

      {/* 臭氧浓度色阶图例 */}
      <div style={{
        marginBottom: '14px', padding: '10px 12px',
        background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
        border: '1px solid rgba(255,107,53,0.2)'
      }}>
        <div style={{ color: 'rgba(0,240,255,0.7)', fontSize: '10px', fontFamily: 'Orbitron', letterSpacing: 1, marginBottom: '8px' }}>
          O₃ CONCENTRATION (μm-atm)
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '10px', height: '80px' }}>
          <div style={{
            width: '16px', flexShrink: 0, borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.15)',
            background: `linear-gradient(180deg,
              rgb(122,4,3) 0%, rgb(191,34,12) 10%, rgb(239,88,20) 20%,
              rgb(252,155,28) 30%, rgb(249,211,31) 40%, rgb(191,240,35) 50%,
              rgb(94,227,80) 60%, rgb(31,199,147) 70%, rgb(39,154,193) 80%,
              rgb(50,92,168) 90%, rgb(48,18,59) 100%)`
          }} />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>
            <span>{(ozoneData.maxVal || 0).toFixed(4)}</span>
            <span>{(((ozoneData.maxVal || 0) + (ozoneData.minVal || 0)) / 2).toFixed(4)}</span>
            <span>{(ozoneData.minVal || 0).toFixed(4)}</span>
          </div>
        </div>
      </div>

      {/* 数据统计 */}
      <div style={{
        marginBottom: '14px', padding: '10px 12px',
        background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
        border: '1px solid rgba(255,107,53,0.2)'
      }}>
        <div style={{ color: 'rgba(0,240,255,0.7)', fontSize: '10px', fontFamily: 'Orbitron', letterSpacing: 1, marginBottom: '8px' }}>DATA STATISTICS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={{ textAlign: 'center', padding: '6px', background: 'rgba(255,107,53,0.08)', borderRadius: '6px' }}>
            <div style={{ color: '#ff6b35', fontSize: '16px', fontWeight: 'bold', fontFamily: 'Orbitron' }}>
              {ozoneData.points?.length || 0}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', marginTop: '2px' }}>数据点</div>
          </div>
          <div style={{ textAlign: 'center', padding: '6px', background: 'rgba(0,240,255,0.05)', borderRadius: '6px' }}>
            <div style={{ color: 'rgba(0,240,255,0.9)', fontSize: '13px', fontWeight: 'bold', fontFamily: 'Orbitron' }}>
              {(ozoneData.maxVal || 0).toFixed(3)}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', marginTop: '2px' }}>最大值</div>
          </div>
        </div>
      </div>

      {/* 交互提示 */}
      <div style={{
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontFamily: 'Exo 2', lineHeight: 1.8 }}>
          • 拖拽：旋转火星球体<br />
          • 滚轮：缩放视图<br />
          • 点击数据点：查看详情<br />
          • ▶ PLAY：播放时序动画
        </div>
      </div>
    </div>
  );
};

// 详细图表组件
const DetailPanel = ({ selectedItem }) => {
  const is3DMode = selectedItem?.is3D;

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

    // 3D模式下返回空，让背景3D球体显示
    if (is3DMode) {
      return null;
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
      left: is3DMode ? '100vw' : '280px', // 3D模式时向右滑出
      top: '70px',
      right: is3DMode ? '-100vw' : 0,
      height: 'calc(100vh - 70px)',
      background: 'rgba(12, 24, 48, 0.15)',
      backdropFilter: 'blur(10px)',
      zIndex: 500,
      padding: '20px',
      transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)', // 平滑滑出动画
      transform: is3DMode ? 'translateX(0)' : 'translateX(0)'
    }}>
      {selectedItem && !is3DMode && (
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
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 网格线 */}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`h${i}`} x1="60" y1={60 + i * 35} x2="740" y2={60 + i * 35}
            stroke="rgba(0,240,255,0.1)" strokeWidth="1" />
        ))}
        {Array.from({ length: 13 }, (_, i) => (
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
          { x: 60, y: 280 }, { x: 150, y: 180 }, { x: 240, y: 200 }, { x: 330, y: 150 },
          { x: 420, y: 170 }, { x: 510, y: 140 }, { x: 600, y: 160 }, { x: 690, y: 130 }, { x: 740, y: 150 }
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
                    x={j * cellSize + cellSize / 2}
                    y={i * cellSize + cellSize / 2 + 5}
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
                x={i * cellSize + cellSize / 2}
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
                y={i * cellSize + cellSize / 2 + 5}
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
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,240,255,0.1)" strokeWidth="1" />
          </pattern>
          <filter id="realtimeGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
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
  const histogramData = Array.from({ length: 20 }, (_, i) => ({
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

// 全屏3D火星背景 — 单网格顶点色球壳（一次 draw call，无卡顿）
const Mars3DBackground = ({ ozoneData, is3DMode }) => {
  const globeRef = useRef();
  const shellRef = useRef(null);
  const [globeReady, setGlobeReady] = useState(false);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!globeReady || !globeRef.current) return;
    const scene = globeRef.current.scene();
    if (!scene) return;
    const R = (globeRef.current.getGlobeRadius?.() ?? 100) * 1.006;

    // 清除旧球壳
    if (shellRef.current) {
      scene.remove(shellRef.current);
      shellRef.current.geometry.dispose();
      shellRef.current.material.dispose();
      shellRef.current = null;
    }
    if (!ozoneData.points?.length) return;

    const range = (ozoneData.maxVal - ozoneData.minVal) || 1;

    // 从数据点检测网格步长和偏移
    const sortedLats = [...new Set(ozoneData.points.map(p => Math.round(p.lat * 10) / 10))].sort((a, b) => a - b);
    const sortedLngs = [...new Set(ozoneData.points.map(p => Math.round(p.lng * 10) / 10))].sort((a, b) => a - b);
    const latStep = sortedLats.length > 1 ? sortedLats[1] - sortedLats[0] : 5;
    const lngStep = sortedLngs.length > 1 ? sortedLngs[1] - sortedLngs[0] : 5;
    const latMin = sortedLats[0];
    const lngMin = sortedLngs[0];
    const nLat = sortedLats.length;
    const nLng = sortedLngs.length;

    // 构建二维格点查找表（Float32Array 快速访问）
    const grid = new Float32Array(nLat * nLng).fill(0.5);
    for (const p of ozoneData.points) {
      const li = Math.round((p.lat - latMin) / latStep);
      const gi = Math.round((p.lng - lngMin) / lngStep);
      if (li >= 0 && li < nLat && gi >= 0 && gi < nLng) {
        grid[li * nLng + gi] = Math.max(0, Math.min(1, (p.val - ozoneData.minVal) / range));
      }
    }
    const getT = (lat, lng) => {
      let li = Math.round((lat - latMin) / latStep);
      let gi = Math.round((lng - lngMin) / lngStep);
      li = Math.max(0, Math.min(nLat - 1, li));
      gi = ((gi % nLng) + nLng) % nLng;
      return grid[li * nLng + gi];
    };

    // 创建球面网格（分段数与数据网格匹配，避免插值失真）
    const WS = Math.round(360 / lngStep);
    const HS = Math.round(180 / latStep);
    const geometry = new THREE.SphereGeometry(R, WS, HS);
    const pos = geometry.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const r2 = Math.sqrt(x * x + y * y + z * z) || 1;
      // 逆变换自 three-globe 的 polar2Cartesian:
      // x=R·sin(phi)·cos(theta), y=R·cos(phi), z=R·sin(phi)·sin(theta)
      // 其中 phi=(90-lat)·π/180, theta=(90+lng)·π/180
      const lat = 90 - Math.acos(Math.max(-1, Math.min(1, y / r2))) * 180 / Math.PI;
      const lngRaw = Math.atan2(z, x) * 180 / Math.PI - 90;
      const lng = ((lngRaw + 180) % 360 + 360) % 360 - 180;

      const t = getT(lat, lng);
      const [cr, cg, cb] = turboColorRGB(t);
      colors[i * 3] = cr / 255;
      colors[i * 3 + 1] = cg / 255;
      colors[i * 3 + 2] = cb / 255;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.68,        // 透明度：火星纹理依然可见
      side: THREE.FrontSide,
      depthWrite: false,    // 避免与球体纹理的深度冲突
    });

    const mesh = new THREE.Mesh(geometry, material);
    shellRef.current = mesh;
    scene.add(mesh);
  }, [ozoneData, globeReady]);

  // 卸载时清理
  useEffect(() => {
    return () => {
      if (shellRef.current) {
        shellRef.current.geometry?.dispose();
        shellRef.current.material?.dispose();
      }
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: is3DMode ? 100 : 1,
      opacity: is3DMode ? 1 : 0.85,
      transition: 'all 0.8s ease'
    }}>
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="/mars_texture.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        atmosphereColor="rgba(255, 100, 50, 0.8)"
        atmosphereAltitude={0.15}
        onGlobeReady={() => {
          globeRef.current?.pointOfView({ altitude: 2.5, lat: 0, lng: 0 }, 1000);
          setGlobeReady(true);
        }}
      />
    </div>
  );
};

// 主页面组件内容
const DataOverviewPageContent = () => {
  const [ozoneData, setOzoneData] = useState({ points: [], minVal: 0, maxVal: 1 });
  const [loadingGlobe, setLoadingGlobe] = useState(false);
  const [selectedItem, setSelectedItem] = useState(DATA_OPTIONS[0]);
  const [marsYear, setMarsYear] = useState(27);
  const [lsValue, setLsValue] = useState(90);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef(null);
  const abortRef = useRef(null);

  // 加载地球数据（AbortController 防竞争）
  const loadGlobe = useCallback(async (ls, year) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoadingGlobe(true);
    try {
      const d = await fetchGlobeData(year, ls, ctrl.signal);
      if (!ctrl.signal.aborted) {
        setOzoneData({
          points: d.points || [],
          minVal: d.minVal ?? 0,
          maxVal: d.maxVal ?? 1,
        });
        setLoadingGlobe(false);
      }
    } catch (e) {
      if (!ctrl.signal.aborted) {
        console.error('Globe data error:', e);
        setLoadingGlobe(false);
      }
    }
  }, []);

  // Ls 或 marsYear 变化时重新加载
  useEffect(() => {
    loadGlobe(lsValue, marsYear);
  }, [lsValue, marsYear, loadGlobe]);

  // 播放动画（每 600ms 步进 5°）
  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setLsValue(v => {
          if (v >= 355) { setPlaying(false); return 0; }
          return v + 5;
        });
      }, 600);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [playing]);

  const is3DMode = selectedItem?.is3D;

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      position: 'relative',
      background: '#000'
    }}>
      {/* 全屏3D火星背景 */}
      <Mars3DBackground ozoneData={ozoneData} is3DMode={is3DMode} />

      {/* 左侧菜单栏 */}
      <SidebarMenu
        selectedItem={selectedItem}
        onItemSelect={setSelectedItem}
      />

      {/* 右侧详情面板 */}
      <DetailPanel selectedItem={selectedItem} />

      {/* 3D模式控制面板（含时间控制）*/}
      {is3DMode && (
        <Globe3DControls
          ozoneData={ozoneData}
          lsValue={lsValue}
          marsYear={marsYear}
          playing={playing}
          loadingGlobe={loadingGlobe}
          onLsChange={setLsValue}
          onMarsYearChange={setMarsYear}
          onTogglePlay={() => setPlaying(p => !p)}
        />
      )}
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