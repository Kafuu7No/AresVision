import React, { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import * as THREE from 'three';
import SphericalFieldCanvas from '../components/SphericalFieldCanvas';
import GlowCard from '../components/GlowCard';
import C from '../constants/colors';
import { DataOverviewProvider } from '../contexts/DataOverviewContext';
import { fetchGlobeData, fetchSeasonalHeatmap } from '../services/api';
import useHandTracking from '../hooks/useHandTracking';
import Plot from 'react-plotly.js';

// 数据选项配置
const DATA_OPTIONS = [
  {
    id: 'globe3d', title: '三维球体 3D GLOBE', icon: '🌍',
    description: '交互式3D火星球体数据展示', color: C.mars, is3D: true
  },
  {
    id: 'seasonal',
    title: 'Ls-纬度臭氧热力图',
    subTitle: 'OZONE HEATMAP',
    description: '查看特定火星年内，臭氧浓度随太阳经度（LS）和纬度的时空分布热力折线图。',
    color: C.blue
  },
  {
    id: 'correlation', title: '关联矩阵 CORRELATION', icon: '🔗',
    description: '环境变量相关性分析', color: C.blue
  },
  {
    id: 'realtime', title: '实时监控 REALTIME', icon: '⚡',
    description: '动态数据流监测', color: C.mars
  },
  {
    id: 'environment', title: '环境参数 ENVIRONMENT', icon: '🌡️',
    description: '温度、压力、风速等参数', color: '#4acfac'
  },
  {
    id: 'prediction', title: '预测引擎 PREDICTION', icon: '🔮',
    description: 'PredRNNv2模型预测结果', color: C.ice
  },
  {
    id: 'distribution', title: '数据分布 DISTRIBUTION', icon: '📊',
    description: '臭氧浓度分布统计', color: C.blue
  }
];

// 左侧菜单组件
const SidebarMenu = ({ selectedItem, onItemSelect }) => {
  return (
    <div style={{
      position: 'fixed', left: 0, top: '70px',
      width: '280px', height: 'calc(100vh - 70px)',
      background: 'rgba(10, 10, 15, 0.85)',
      backdropFilter: 'blur(20px)',
      borderRight: `1px solid ${C.border}`,
      zIndex: 1000, padding: '24px 16px', overflowY: 'auto'
    }}>
      {/* 标题区 */}
      <div style={{ paddingBottom: '20px', marginBottom: '16px', borderBottom: `1px solid ${C.border}` }}>
        <h2 style={{
          color: C.ice, fontFamily: "'Orbitron', sans-serif",
          fontSize: '15px', fontWeight: 'bold', margin: '0 0 6px 0',
          letterSpacing: 2, textAlign: 'center'
        }}>
          DATA DASHBOARD
        </h2>
        <div style={{
          color: C.blue, fontSize: '10px', textAlign: 'center',
          fontFamily: "'Orbitron', sans-serif", letterSpacing: 1
        }}>
          Mars Ozone Analysis
        </div>
      </div>

      {/* 菜单项列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {DATA_OPTIONS.map((option) => {
          const isSelected = selectedItem?.id === option.id;

          return (
            <div
              key={option.id}
              onClick={() => onItemSelect(option)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 10,
                background: isSelected ? 'rgba(74,158,255,0.06)' : 'transparent',
                border: `1px solid ${isSelected ? 'rgba(74,158,255,0.2)' : 'transparent'}`,
                cursor: 'pointer', transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.03)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.target.style.background = 'transparent';
                }
              }}
            >
              <div style={{ fontSize: '20px', filter: isSelected ? `drop-shadow(0 0 6px ${option.color})` : 'none', pointerEvents: 'none' }}>
                {option.icon}
              </div>

              <div style={{ flex: 1, pointerEvents: 'none' }}>
                <div style={{
                  color: isSelected ? option.color : C.ice,
                  fontSize: '13px', fontWeight: 'bold',
                  fontFamily: "'Orbitron', sans-serif", marginBottom: '4px',
                }}>
                  {option.title}
                </div>
                <div style={{ color: C.ice30, fontSize: '11px', fontFamily: "'Exo 2', sans-serif" }}>
                  {option.description}
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
const Globe3DControls = ({ ozoneData, lsValue, marsYear, playing, loadingGlobe, autoRotate, gestureEnabled, onLsChange, onMarsYearChange, onTogglePlay, onToggleAutoRotate, onToggleGesture }) => {
  const seasonName =
    lsValue < 90 ? '北半球春 / 南半球秋' :
      lsValue < 180 ? '北半球夏 / 南半球冬' :
        lsValue < 270 ? '北半球秋 / 南半球春' : '北半球冬 / 南半球夏';

  return (
    <GlowCard style={{
      position: 'fixed', top: '90px', right: '20px',
      width: '300px', maxHeight: 'calc(100vh - 110px)',
      overflowY: 'auto', zIndex: 1500, padding: '24px',
    }}>

      {/* 标题 */}
      <div style={{
        fontSize: 11, fontWeight: 700, color: C.mars,
        fontFamily: "'Orbitron', sans-serif", letterSpacing: 2,
        marginBottom: 16, paddingBottom: '12px',
        borderBottom: `1px solid ${C.border}`
      }}>
        🌍 3D GLOBE CONTROL
      </div>

      {/* Mars Year 选择 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.ice30, marginBottom: 6 }}>火星年 Mars Year</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[27, 28].map((y) => (
            <button key={y} onClick={() => onMarsYearChange(y)} style={{
              flex: 1, padding: '8px 0',
              background: marsYear === y ? 'rgba(199,91,57,0.2)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${marsYear === y ? C.mars : C.border}`,
              borderRadius: 8, color: marsYear === y ? C.mars : C.ice60,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'Orbitron', sans-serif",
            }}>MY{y}</button>
          ))}
        </div>
      </div>

      {/* Ls 滑块 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: C.ice30 }}>起始 Ls</span>
          <span style={{ fontSize: 12, color: C.ice, fontFamily: "'Orbitron', sans-serif" }}>{lsValue}°</span>
        </div>
        <input
          type="range" min={0} max={360} step={5} value={lsValue}
          onChange={e => onLsChange(Number(e.target.value))}
          style={{ width: '100%', accentColor: C.mars, cursor: 'pointer', margin: '4px 0' }}
        />
        <div style={{ fontSize: '10px', color: C.ice30, textAlign: 'center', marginTop: '4px' }}>
          {seasonName}
        </div>
      </div>

      {/* 播放控制 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={onTogglePlay}
          style={{
            flex: 1, padding: '12px 0',
            background: playing ? 'rgba(199,91,57,0.2)' : `linear-gradient(135deg, ${C.mars}, #ff8e53)`,
            border: playing ? `1px solid ${C.mars}` : 'none',
            borderRadius: 8, color: playing ? C.mars : '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: "'Orbitron', sans-serif", letterSpacing: 2,
            transition: 'all 0.3s ease',
            boxShadow: playing ? 'none' : '0 4px 24px rgba(199,91,57,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {playing ? '⏸ PAUSE' : '▶ PLAY'}
        </button>
        <button
          onClick={() => { onLsChange(0); }}
          title="重置到 Ls=0°"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${C.border}`,
            borderRadius: '8px',
            padding: '10px 14px',
            color: C.ice60,
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          ↩
        </button>
      </div>

      {/* 自动旋转控制 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '10px', padding: '10px 12px',
        background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
        border: `1px solid ${C.border}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>🔄</span>
          <span style={{ color: C.ice, fontSize: '12px', fontFamily: 'Exo 2' }}>开启自动旋转</span>
        </div>
        <label style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px' }}>
          <input
            type="checkbox"
            checked={autoRotate}
            onChange={onToggleAutoRotate}
            style={{ opacity: 0, width: 0, height: 0 }}
          />
          <span style={{
            position: 'absolute', cursor: 'pointer',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: autoRotate ? 'rgba(74,158,255,0.3)' : 'rgba(255,255,255,0.1)',
            border: `1px solid ${autoRotate ? C.blue : C.border}`,
            transition: '.4s', borderRadius: '34px'
          }}>
            <span style={{
              position: 'absolute', content: '""',
              height: '14px', width: '14px',
              left: autoRotate ? '18px' : '2px', bottom: '2px',
              backgroundColor: autoRotate ? C.blue : 'rgba(255,255,255,0.5)',
              transition: '.4s', borderRadius: '50%'
            }} />
          </span>
        </label>
      </div>

      {/* 手势控制 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '16px', padding: '10px 12px',
        background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
        border: `1px solid ${C.border}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>✋</span>
          <span style={{ color: C.mars, fontSize: '12px', fontFamily: 'Exo 2', fontWeight: 'bold' }}>AI 手势控制</span>
        </div>
        <label style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px' }}>
          <input
            type="checkbox"
            checked={gestureEnabled}
            onChange={onToggleGesture}
            style={{ opacity: 0, width: 0, height: 0 }}
          />
          <span style={{
            position: 'absolute', cursor: 'pointer',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: gestureEnabled ? 'rgba(199,91,57,0.3)' : 'rgba(255,255,255,0.1)',
            border: `1px solid ${gestureEnabled ? C.mars : C.border}`,
            transition: '.4s', borderRadius: '34px'
          }}>
            <span style={{
              position: 'absolute', content: '""',
              height: '14px', width: '14px',
              left: gestureEnabled ? '18px' : '2px', bottom: '2px',
              backgroundColor: gestureEnabled ? C.mars : 'rgba(255,255,255,0.5)',
              transition: '.4s', borderRadius: '50%'
            }} />
          </span>
        </label>
      </div>

      {/* 加载指示 */}
      {loadingGlobe && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          marginBottom: '16px', padding: '10px 12px',
          background: 'rgba(199,91,57,0.08)',
          border: `1px solid rgba(199,91,57,0.25)`,
          borderRadius: '8px'
        }}>
          <div style={{
            width: '12px', height: '12px', flexShrink: 0,
            border: `2px solid rgba(199,91,57,0.2)`,
            borderTop: `2px solid ${C.mars}`,
            borderRadius: '50%',
            animation: 'spin-slow 1s linear infinite'
          }} />
          <span style={{ color: C.mars, fontSize: '11px', fontFamily: "'Orbitron', sans-serif" }}>加载数据中...</span>
        </div>
      )}

      {/* 臭氧浓度色阶图例 */}
      <div style={{
        marginBottom: '16px', padding: '16px',
        background: 'rgba(255,255,255,0.02)', borderRadius: '12px',
        border: `1px solid ${C.border}`
      }}>
        <div style={{ color: C.ice30, fontSize: '10px', fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, marginBottom: '10px' }}>
          O₃ CONCENTRATION (μm-atm)
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '12px', height: '100px' }}>
          <div style={{
            width: '14px', flexShrink: 0, borderRadius: '4px',
            border: `1px solid ${C.border}`,
            background: `linear-gradient(180deg,
              rgb(252,255,164) 0%, rgb(250,193,39) 14.2%, rgb(245,125,21) 28.5%,
              rgb(212,72,66) 42.8%, rgb(159,42,99) 57.1%, rgb(101,21,110) 71.4%,
              rgb(40,11,84) 85.7%, rgb(0,0,4) 100%)`
          }} />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '11px', color: C.ice60 }}>
            <span>{(ozoneData.maxVal || 0).toFixed(4)}</span>
            <span>{(((ozoneData.maxVal || 0) + (ozoneData.minVal || 0)) / 2).toFixed(4)}</span>
            <span>{(ozoneData.minVal || 0).toFixed(4)}</span>
          </div>
        </div>
      </div>

      {/* 数据统计 */}
      <div style={{
        marginBottom: '16px', padding: '16px',
        background: 'rgba(255,255,255,0.02)', borderRadius: '12px',
        border: `1px solid ${C.border}`
      }}>
        <div style={{ color: C.ice30, fontSize: '10px', fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, marginBottom: '10px' }}>DATA STATISTICS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ textAlign: 'center', padding: '10px 6px', background: 'rgba(199,91,57,0.08)', borderRadius: '8px' }}>
            <div style={{ color: C.mars, fontSize: '18px', fontWeight: 'bold', fontFamily: "'Orbitron', sans-serif" }}>
              {ozoneData.points?.length || 0}
            </div>
            <div style={{ color: C.ice30, fontSize: '10px', marginTop: '4px' }}>数据点</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px 6px', background: 'rgba(74,158,255,0.05)', borderRadius: '8px' }}>
            <div style={{ color: C.blue, fontSize: '16px', fontWeight: 'bold', fontFamily: "'Orbitron', sans-serif" }}>
              {(ozoneData.maxVal || 0).toFixed(3)}
            </div>
            <div style={{ color: C.ice30, fontSize: '10px', marginTop: '4px' }}>最大值</div>
          </div>
        </div>
      </div>

      {/* 交互提示 */}
      <div style={{
        padding: '12px 14px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '10px',
        border: `1px solid ${C.border}`
      }}>
        <div style={{ color: C.ice60, fontSize: '11px', fontFamily: 'Exo 2', lineHeight: 1.8 }}>
          • 拖拽：旋转火星球体<br />
          • 滚轮：缩放视图<br />
          • 点击数据点：查看详情<br />
          • ▶ PLAY：播放时序动画
        </div>
      </div>
    </GlowCard>
  );
};

// 详细图表组件
const DetailPanel = ({ selectedItem, marsYear }) => {
  const is3DMode = selectedItem?.is3D;

  const renderChart = () => {
    if (!selectedItem) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          height: '100%', color: C.ice60,
          fontFamily: "'Exo 2', sans-serif"
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3, filter: 'grayscale(100%)' }}>🛰️</div>
          <div style={{ fontSize: '16px', marginBottom: '8px', fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>HELLO MARS</div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>SELECT AN OPTION FROM SIDEBAR</div>
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
        return <SeasonalChart marsYear={marsYear} />;
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
      left: is3DMode ? '100vw' : '280px',
      top: '70px',
      right: is3DMode ? '-100vw' : 0,
      height: 'calc(100vh - 70px)',
      background: 'rgba(10, 10, 15, 0.3)',
      backdropFilter: 'blur(10px)',
      zIndex: 500,
      padding: '24px',
      transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
      transform: is3DMode ? 'translateX(0)' : 'translateX(0)'
    }}>
      {selectedItem && !is3DMode && (
        <GlowCard style={{
          marginBottom: '20px',
          padding: '16px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '28px', marginRight: '16px', filter: `drop-shadow(0 0 8px ${selectedItem.color})` }}>
              {selectedItem.icon}
            </span>
            <div>
              <h3 style={{
                color: selectedItem.color,
                fontFamily: "'Orbitron', sans-serif",
                fontSize: '20px',
                fontWeight: 'bold',
                margin: 0,
                textShadow: `0 0 10px ${selectedItem.color}`
              }}>
                {selectedItem.title}
              </h3>
            </div>
          </div>
          <p style={{ color: C.ice60, fontFamily: "'Exo 2', sans-serif", fontSize: '13px', margin: '0', lineHeight: 1.5 }}>
            {selectedItem.description}
          </p>
        </GlowCard>
      )}

      <GlowCard style={{
        height: selectedItem ? 'calc(100% - 130px)' : '100%',
        padding: '24px',
        overflow: 'hidden'
      }}>
        {renderChart()}
      </GlowCard>
    </div>
  );
};

// 季节分析图表 (Ls-纬度 臭氧热力图)
const SeasonalChart = ({ marsYear }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchSeasonalHeatmap(marsYear).then(res => {
      if (active) {
        setData(res);
        setLoading(false);
      }
    }).catch(err => {
      console.error(err);
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [marsYear]);

  // 修复外层 CSS 动画 (0.8s) 期间 Plotly 获取容器尺寸不准导致右侧被切除的问题
  useEffect(() => {
    if (data && !loading) {
      const dispatchResize = () => window.dispatchEvent(new Event('resize'));
      // 在动画的初期、中期以及动画结束后（850ms）主动抛出 resize 事件矫正图表尺寸
      const t1 = setTimeout(dispatchResize, 100);
      const t2 = setTimeout(dispatchResize, 400);
      const t3 = setTimeout(dispatchResize, 850);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [data, loading]);

  if (loading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.ice, fontFamily: "'Orbitron', sans-serif", display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: '16px', height: '16px', border: `2px solid rgba(0,240,255,0.2)`,
            borderTop: `2px solid ${C.ice}`, borderRadius: '50%', animation: 'spin-slow 1s linear infinite'
          }} />
          LOADING HEATMAP...
        </div>
      </div>
    );
  }

  if (!data) return <div style={{ color: C.mars, padding: 20 }}>暂无数据 NO DATA</div>;

  return (
    <div className="seasonal-chart-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <style>{`
        /* 将工具栏移动到图表下边，并修复深色模式下的图标颜色和重叠问题 */
        .seasonal-chart-container .modebar {
          top: auto !important;
          bottom: 0px !important;
          right: 20px !important;
          left: auto !important;
          background: rgba(10, 10, 15, 0.8) !important;
          border: 1px solid rgba(0, 240, 255, 0.2);
          border-radius: 8px;
          padding: 2px 4px;
          display: flex !important;
        }
        .seasonal-chart-container .modebar-group {
          display: flex !important;
          margin-bottom: 0 !important;
        }
        .seasonal-chart-container .modebar-btn svg {
          fill: rgba(0, 240, 255, 0.6) !important;
        }
        .seasonal-chart-container .modebar-btn:hover svg,
        .seasonal-chart-container .modebar-btn.active svg {
          fill: #ff6b35 !important;
        }
      `}</style>
      <Plot
        data={[
          {
            z: data.z,
            x: data.x,
            y: data.y,
            type: 'heatmap',
            zsmooth: 'best',
            colorscale: 'Jet',
            zmin: data.min,
            zmax: data.max * 0.6, // 将颜色映射极值大幅度压低，凸显浓度区别
            hovertemplate: 'Ls: %{x:.1f}°<br>Lat: %{y:.1f}°<br>O₃: %{z:.2f} DU<extra></extra>',
            colorbar: {
              title: { text: 'O₃ (DU)', font: { color: C.ice, family: "'Orbitron', sans-serif", size: 10 }, side: 'top' },
              orientation: 'h',
              y: -0.25,
              yanchor: 'top',
              len: 0.8,
              thickness: 10,
              tickfont: { color: C.ice60, family: "'Exo 2', sans-serif" }
            }
          }
        ]}
        layout={{
          title: { text: `MY ${marsYear} 臭氧时空分布热力图 (Zonal Mean O₃)`, font: { color: C.ice, family: "'Orbitron', sans-serif", size: 14 } },
          xaxis: { title: 'Solar Longitude Ls (°)', color: C.ice60, gridcolor: C.border, titlefont: { family: "'Exo 2', sans-serif" }, showgrid: false },
          yaxis: { title: 'Latitude (°)', color: C.ice60, gridcolor: C.border, titlefont: { family: "'Exo 2', sans-serif" }, showgrid: false },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          margin: { t: 40, r: 20, l: 50, b: 120 },
          autosize: true
        }}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
        config={{ displayModeBar: true, scrollZoom: true, responsive: true, displaylogo: false }}
      />
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
        <svg width={matrixSize} height={matrixSize} style={{ overflow: 'visible' }}>
          {variables.map((rowVar, i) =>
            variables.map((colVar, j) => {
              const correlation = i === j ? 1 : (Math.random() * 2 - 1);
              const intensity = Math.abs(correlation);
              const color = correlation > 0 ?
                `rgba(199,91,57,${intensity})` :
                `rgba(74,158,255,${intensity})`;

              return (
                <g key={`${i}-${j}`}>
                  <rect
                    x={j * cellSize}
                    y={i * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill={color}
                    stroke={C.border}
                    strokeWidth="1"
                  />
                  <text
                    x={j * cellSize + cellSize / 2}
                    y={i * cellSize + cellSize / 2 + 4}
                    textAnchor="middle"
                    fill={C.ice}
                    fontSize="11"
                    fontFamily="'Exo 2', sans-serif"
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
                y={matrixSize + 24}
                textAnchor="middle"
                fill={C.ice60}
                fontSize="12"
                fontFamily="'Orbitron', sans-serif"
                fontWeight="bold"
              >
                {variable}
              </text>
              <text
                x={-12}
                y={i * cellSize + cellSize / 2 + 4}
                textAnchor="end"
                fill={C.ice60}
                fontSize="12"
                fontFamily="'Orbitron', sans-serif"
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
      <svg width="100%" height="100%" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="realtimeGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={C.border} strokeWidth="1" />
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
            stroke={C.blue}
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
              fill="rgba(10, 10, 15, 0.8)"
              stroke={C.border}
              strokeWidth="1"
              rx="8"
            />
            <text
              x="710"
              y="80"
              textAnchor="middle"
              fill={C.ice60}
              fontSize="12"
              fontFamily="'Exo 2', sans-serif"
            >
              当前数值
            </text>
            <text
              x="710"
              y="105"
              textAnchor="middle"
              fill={C.mars}
              fontSize="16"
              fontFamily="'Orbitron', sans-serif"
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
      width: '100%', height: '100%',
      display: 'grid', gridTemplateColumns: '1fr 1fr',
      gap: '24px', padding: '10px'
    }}>
      {gauges.map((gauge, i) => {
        const percent = ((gauge.value - gauge.min) / (gauge.max - gauge.min)) * 100;
        const angle = (percent / 100) * 180;

        return (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: 'rgba(255,255,255,0.02)', borderRadius: '16px',
            padding: '24px', border: `1px solid ${C.border}`
          }}>
            <h4 style={{
              color: gauge.color, fontFamily: "'Orbitron', sans-serif",
              fontSize: '14px', fontWeight: 'bold', margin: '0 0 20px 0',
              textShadow: `0 0 8px ${gauge.color}`, letterSpacing: 1
            }}>
              {gauge.name}
            </h4>

            {/* 仪表盘 */}
            <svg width="150" height="100" viewBox="0 0 200 120">
              <defs>
                <linearGradient id={`gauge-grad-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={gauge.color} />
                  <stop offset="50%" stopColor={gauge.color === C.ice ? '#4acfac' : C.blue} />
                  <stop offset="100%" stopColor={C.mars} />
                </linearGradient>
              </defs>

              <path
                d="M40,100 A60,60 0 0,1 160,100"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="10"
                fill="none"
              />

              <path
                d={`M40,100 A60,60 0 ${angle > 90 ? 1 : 0},1 ${40 + 120 * Math.cos((180 - angle) * Math.PI / 180)},${100 - 60 * Math.sin((180 - angle) * Math.PI / 180)}`}
                stroke={`url(#gauge-grad-${i})`}
                strokeWidth="10"
                fill="none"
                filter="drop-shadow(0 0 4px currentColor)"
              />

              <text x="100" y="105" textAnchor="middle" fill={C.ice} fontSize="20" fontFamily="'Orbitron', sans-serif" fontWeight="bold">
                {gauge.value}
              </text>
              <text x="100" y="125" textAnchor="middle" fill={C.ice60} fontSize="11" fontFamily="'Exo 2', sans-serif">
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
        background: 'rgba(255,255,255,0.02)', borderRadius: '12px',
        padding: '24px', marginBottom: '20px',
        border: `1px solid ${C.border}`
      }}>
        <h4 style={{
          color: C.ice, fontFamily: "'Orbitron', sans-serif", fontSize: '16px',
          textAlign: 'center', marginBottom: '20px', letterSpacing: 1
        }}>
          PredRNNv2 时空预测引擎
        </h4>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: C.ice60, fontSize: '13px' }}>处理进度</span>
            <span style={{ color: C.mars, fontSize: '13px', fontWeight: 'bold' }}>{progress}%</span>
          </div>
          <div style={{
            width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)',
            borderRadius: '3px', overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress}%`, height: '100%',
              background: `linear-gradient(90deg, ${C.blue}, ${C.mars})`,
              transition: 'width 0.2s ease'
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: C.mars, fontSize: '20px', fontWeight: 'bold', fontFamily: "'Orbitron', sans-serif" }}>7</div>
            <div style={{ color: C.ice60, fontSize: '11px', marginTop: 4 }}>输入通道</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: C.blue, fontSize: '20px', fontWeight: 'bold', fontFamily: "'Orbitron', sans-serif" }}>3</div>
            <div style={{ color: C.ice60, fontSize: '11px', marginTop: 4 }}>时间窗口</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: C.mars, fontSize: '20px', fontWeight: 'bold', fontFamily: "'Orbitron', sans-serif" }}>36×72</div>
            <div style={{ color: C.ice60, fontSize: '11px', marginTop: 4 }}>空间网格</div>
          </div>
        </div>
      </div>

      {/* 预测结果 */}
      <div style={{
        background: 'rgba(255,255,255,0.02)', borderRadius: '12px',
        padding: '24px', height: 'calc(100% - 220px)',
        overflow: 'hidden', border: `1px solid ${C.border}`
      }}>
        <h5 style={{
          color: C.ice, fontFamily: "'Orbitron', sans-serif", fontSize: '14px',
          marginBottom: '16px', letterSpacing: 1
        }}>
          实时预测结果
        </h5>

        <svg width="100%" height="200" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="predGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={C.blue} />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
            <filter id="predGlow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {predictions.length > 1 && (
            <>
              <polyline
                points={predictions.map((p, i) => `${i * 40 + 20},${180 - p.accuracy * 1.5}`).join(' ')}
                fill="none" stroke={C.blue} strokeWidth="3" filter="url(#predGlow)"
              />
              <path
                d={`M20,${180 - predictions[0].accuracy * 1.5} ${predictions.map((p, i) =>
                  `L${i * 40 + 20},${180 - p.accuracy * 1.5}`
                ).join(' ')} L${(predictions.length - 1) * 40 + 20},180 L20,180 Z`}
                fill="url(#predGrad)" opacity="0.3"
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
        color: C.ice, fontFamily: "'Orbitron', sans-serif", fontSize: '16px',
        textAlign: 'center', marginBottom: '30px', letterSpacing: 1
      }}>
        臭氧柱浓度分布统计
      </h4>

      <svg width="100%" height="300" viewBox="0 0 600 300" preserveAspectRatio="xMidYMid meet">
        {histogramData.map((bar, i) => (
          <g key={i}>
            <rect
              x={50 + i * 25}
              y={250 - bar.count * 2}
              width="18"
              height={bar.count * 2}
              fill={`rgba(199,91,57,${0.3 + (bar.count / 110) * 0.7})`}
              stroke={C.mars}
              strokeWidth="1"
              rx="4"
            />
            {i % 4 === 0 && (
              <text
                x={59 + i * 25}
                y={270}
                textAnchor="middle"
                fill={C.ice60}
                fontSize="11"
                fontFamily="'Exo 2', sans-serif"
              >
                {bar.bin.toFixed(2)}
              </text>
            )}
          </g>
        ))}

        <text x="300" y="295" textAnchor="middle" fill={C.ice60} fontSize="12" fontFamily="'Exo 2', sans-serif">
          OZONE COLUMN (DU)
        </text>
        <text x="20" y="150" textAnchor="middle" fill={C.ice60} fontSize="12" fontFamily="'Exo 2', sans-serif"
          transform="rotate(-90 20 150)">
          FREQUENCY
        </text>
      </svg>
    </div>
  );
};

// 全屏3D火星背景 — 替换为 PredictPage 的粒子球体
const Mars3DBackground = forwardRef(({ ozoneData, is3DMode, autoRotate }, ref) => {
  const fieldData = React.useMemo(() => {
    if (!ozoneData?.points?.length) return null;
    const lats = [...new Set(ozoneData.points.map(p => Math.round(p.lat * 10) / 10))].sort((a, b) => b - a);
    const lngs = [...new Set(ozoneData.points.map(p => {
      let l = Math.round(p.lng * 10) / 10;
      return (l + 360) % 360;
    }))].sort((a, b) => a - b);

    const nLat = lats.length;
    const nLon = lngs.length;
    const field = Array(nLat).fill(0).map(() => Array(nLon).fill(NaN));

    ozoneData.points.forEach(p => {
      const lat = Math.round(p.lat * 10) / 10;
      const lng = ((Math.round(p.lng * 10) / 10) + 360) % 360;
      const i = lats.indexOf(lat);
      const j = lngs.indexOf(lng);
      if (i >= 0 && j >= 0) {
        field[i][j] = p.val;
      }
    });

    return {
      field,
      minVal: ozoneData.minVal,
      maxVal: ozoneData.maxVal
    };
  }, [ozoneData]);

  if (!fieldData) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: is3DMode ? 10 : 1,
      opacity: is3DMode ? 1 : 0.6,
      transition: 'all 0.8s ease',
      pointerEvents: is3DMode ? 'auto' : 'none',
    }}>
      <SphericalFieldCanvas
        ref={ref}
        fieldData={fieldData}
        colorMode="inferno"
        h="100vh"
        forceFullscreen
        autoRotate={autoRotate}
      />
    </div>
  );
});

// 主页面组件内容
const DataOverviewPageContent = () => {
  const [ozoneData, setOzoneData] = useState({ points: [], minVal: 0, maxVal: 1 });
  const [loadingGlobe, setLoadingGlobe] = useState(false);
  const [selectedItem, setSelectedItem] = useState(DATA_OPTIONS[0]);
  const [marsYear, setMarsYear] = useState(27);
  const [lsValue, setLsValue] = useState(90);
  const [playing, setPlaying] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [gestureEnabled, setGestureEnabled] = useState(false);

  const timerRef = useRef(null);
  const abortRef = useRef(null);
  const globeCanvasRef = useRef(null);
  const landmarksCanvasRef = useRef(null);

  const is3DMode = selectedItem?.is3D;

  // 手势追踪 Hook：只有在开启手势并且位于 3D 视图时才启动摄像头追踪，防止切到其它页面时相机的 DOM 节点销毁但内部没有正确重置，导致切回来挂载新 DOM 出现黑屏
  const { videoRef, error: gestureError, setOnGesture, setOnLandmarks } = useHandTracking(gestureEnabled && is3DMode);

  // 绑定手势回调到3D画布
  useEffect(() => {
    setOnGesture((gesture) => {
      if (!globeCanvasRef.current) return;
      if (gesture.type === 'rotate') {
        globeCanvasRef.current.applyGestureRotation(gesture.dx, gesture.dy);
      } else if (gesture.type === 'zoom') {
        globeCanvasRef.current.applyGestureZoom(gesture.dDist);
      }
    });
  }, [setOnGesture]);

  // 绘制画中画的骨骼点
  useEffect(() => {
    setOnLandmarks((landmarks) => {
      const canvas = landmarksCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!landmarks || landmarks.length === 0) return;

      ctx.fillStyle = C.mars;
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;

      for (const hand of landmarks) {
        // 画每个关节点
        for (const point of hand) {
          ctx.beginPath();
          ctx.arc(point.x * canvas.width, point.y * canvas.height, 3, 0, 2 * Math.PI);
          ctx.fill();
        }

        // 简单连线：手腕到指根
        const drawLine = (p1, p2) => {
          ctx.beginPath();
          ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
          ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
          ctx.stroke();
        };

        // 画一些骨骼连线提升科技感
        if (hand[0] && hand[5]) drawLine(hand[0], hand[5]); // 食指指根
        if (hand[0] && hand[9]) drawLine(hand[0], hand[9]); // 中指指根
        if (hand[0] && hand[13]) drawLine(hand[0], hand[13]); // 无名指指根
        if (hand[0] && hand[17]) drawLine(hand[0], hand[17]); // 小拇指指根
        if (hand[5] && hand[9]) drawLine(hand[5], hand[9]);
        if (hand[9] && hand[13]) drawLine(hand[9], hand[13]);
        if (hand[13] && hand[17]) drawLine(hand[13], hand[17]);
      }
    });
  }, [setOnLandmarks]);

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

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      position: 'relative',
      background: '#000'
    }}>
      {/* 全屏3D火星背景 */}
      <Mars3DBackground
        ref={globeCanvasRef}
        ozoneData={ozoneData}
        is3DMode={is3DMode}
        autoRotate={autoRotate}
      />

      {/* 手势画中画预览悬浮层 */}
      {is3DMode && gestureEnabled && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '310px',
          width: '240px',
          height: '180px',
          zIndex: 2000,
          borderRadius: '12px',
          overflow: 'hidden',
          border: `2px solid ${C.mars}`,
          boxShadow: `0 0 20px rgba(255,107,53,0.3)`,
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* 显示源视频 */}
          <div style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.5 }}>
            <video
              ref={videoRef}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              playsInline
              muted
            />
          </div>
          {/* 画布叠加骨骼线 */}
          <canvas
            ref={landmarksCanvasRef}
            width={240}
            height={180}
            style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 2, transform: 'scaleX(-1)' }}
          />
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            background: 'rgba(0,0,0,0.6)',
            padding: '2px 8px',
            borderRadius: '4px',
            color: C.mars,
            fontSize: '10px',
            fontFamily: 'Orbitron',
            zIndex: 3,
            border: `1px solid ${C.mars}`
          }}>
            摄像头追踪中... 单手拖拽 / 双手缩放
          </div>
        </div>
      )}

      {/* 左侧菜单栏 */}
      <SidebarMenu
        selectedItem={selectedItem}
        onItemSelect={setSelectedItem}
      />

      {/* 右侧详情面板 */}
      <DetailPanel selectedItem={selectedItem} marsYear={marsYear} />

      {/* 3D模式控制面板（含时间控制）*/}
      {is3DMode && (
        <Globe3DControls
          ozoneData={ozoneData}
          lsValue={lsValue}
          marsYear={marsYear}
          playing={playing}
          autoRotate={autoRotate}
          gestureEnabled={gestureEnabled}
          loadingGlobe={loadingGlobe}
          onLsChange={setLsValue}
          onMarsYearChange={setMarsYear}
          onTogglePlay={() => setPlaying(p => !p)}
          onToggleAutoRotate={() => setAutoRotate(r => !r)}
          onToggleGesture={() => setGestureEnabled(g => !g)}
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