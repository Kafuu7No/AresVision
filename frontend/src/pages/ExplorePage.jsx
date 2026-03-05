import { useState, useEffect, useRef, useCallback } from 'react';
import C from '../constants/colors';
import SectionTitle from '../components/SectionTitle';
import GlowCard from '../components/GlowCard';
import {
  fetchGlobeData,
  fetchSeasonalHeatmap,
  fetchSeasonalBands,
  fetchCorrelation,
} from '../services/api';

// ─── 颜色映射工具 ───

function viridisColor(t) {
  // 简化版 Viridis 色阶 (t: 0~1)
  t = Math.max(0, Math.min(1, t));
  const r = Math.round(68 + t * (253 - 68));
  const g = Math.round(1 + t * (231 - 1));
  const b = Math.round(84 + t * (37 - 84));
  return `rgb(${r},${g},${b})`;
}

function rdbuColor(t) {
  // 发散色阶 -1~1 → 蓝→白→红
  t = Math.max(-1, Math.min(1, t));
  if (t < 0) {
    const s = 1 + t;
    return `rgb(${Math.round(s * 255)},${Math.round(s * 255)},255)`;
  }
  return `rgb(255,${Math.round((1 - t) * 255)},${Math.round((1 - t) * 255)})`;
}

// ─── 加载状态组件 ───

function LoadingBox({ h = 200, label = '加载中...' }) {
  return (
    <div style={{
      height: h, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.02)', borderRadius: 12,
    }}>
      <div style={{
        width: 28, height: 28, border: `3px solid ${C.border}`,
        borderTop: `3px solid ${C.mars}`, borderRadius: '50%',
        animation: 'spin-slow 1s linear infinite',
      }}/>
      <div style={{ marginTop: 12, fontSize: 12, color: C.ice30 }}>{label}</div>
    </div>
  );
}

// ─── SVG 热力图渲染器 ───

function HeatmapChart({ data, h = 250, colorFn = viridisColor }) {
  if (!data || !data.z || data.z.length === 0) return <LoadingBox h={h} />;

  const { x, y, z, min: dMin, max: dMax } = data;
  const nY = z.length;
  const nX = z[0].length;
  const range = dMax - dMin || 1;

  const cellW = 100 / nX;
  const cellH = 100 / nY;

  return (
    <div style={{ height: h, position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
      <svg viewBox={`0 0 100 100`} preserveAspectRatio="none"
           style={{ width: '100%', height: '100%', display: 'block' }}>
        {z.map((row, yi) =>
          row.map((val, xi) => {
            if (val === null || isNaN(val)) return null;
            const t = (val - dMin) / range;
            return (
              <rect key={`${yi}-${xi}`}
                x={xi * cellW} y={yi * cellH}
                width={cellW + 0.1} height={cellH + 0.1}
                fill={colorFn(t)} />
            );
          })
        )}
      </svg>
      {/* 轴标签 */}
      <div style={{
        position: 'absolute', bottom: 2, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between',
        padding: '0 4px', fontSize: 9, color: C.ice30,
      }}>
        <span>Ls {x?.[0]?.toFixed(0) ?? 0}°</span>
        <span>Ls {x?.[Math.floor(x.length / 2)]?.toFixed(0) ?? 180}°</span>
        <span>Ls {x?.[x.length - 1]?.toFixed(0) ?? 360}°</span>
      </div>
      <div style={{
        position: 'absolute', top: 2, right: 4, fontSize: 9, color: C.ice30,
      }}>
        max: {dMax?.toFixed(4)}
      </div>
    </div>
  );
}

// ─── SVG 折线图渲染器 ───

function LineChart({ data, h = 250 }) {
  if (!data || !data.bands || data.bands.length === 0) return <LoadingBox h={h} />;

  const { ls, bands } = data;
  const colors = [C.mars, C.marsLight, C.ice60, C.blue, '#7c5cbf'];

  // 计算全局 Y 范围
  let yMin = Infinity, yMax = -Infinity;
  bands.forEach(b => {
    b.values.forEach(v => {
      if (!isNaN(v)) {
        yMin = Math.min(yMin, v);
        yMax = Math.max(yMax, v);
      }
    });
  });
  const yRange = yMax - yMin || 1;
  const pad = yRange * 0.1;
  yMin -= pad;
  yMax += pad;

  const W = 400, H = 150;
  const toX = (i) => (i / (ls.length - 1)) * W;
  const toY = (v) => H - ((v - yMin) / (yMax - yMin)) * H;

  return (
    <div style={{ height: h, position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
           style={{ width: '100%', height: '100%' }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1="0" y1={H * f} x2={W} y2={H * f}
                stroke="rgba(232,237,243,0.06)" strokeWidth="0.5" />
        ))}
        {/* Data lines */}
        {bands.map((band, bi) => {
          const pts = band.values
            .map((v, i) => isNaN(v) ? null : `${toX(i)},${toY(v)}`)
            .filter(Boolean)
            .join(' ');
          return (
            <polyline key={bi} points={pts}
              fill="none" stroke={colors[bi % colors.length]}
              strokeWidth="1.5" opacity="0.85" />
          );
        })}
      </svg>
      {/* Legend */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6,
      }}>
        {bands.map((b, i) => (
          <span key={i} style={{ fontSize: 10, color: C.ice30, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 3, borderRadius: 2, background: colors[i % colors.length] }}/>
            {b.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── 3D 地球点云（SVG 等距投影） ───

function GlobePlot({ data, h = 450 }) {
  if (!data || !data.points || data.points.length === 0) return <LoadingBox h={h} label="加载地球数据..." />;

  const { points, minVal, maxVal } = data;
  const range = maxVal - minVal || 1;

  // Equirectangular → 简单映射
  const W = 600, H = 300;
  const toX = (lng) => ((lng + 180) / 360) * W;
  const toY = (lat) => ((90 - lat) / 180) * H;

  return (
    <div style={{ height: h, position: 'relative', borderRadius: 8, overflow: 'hidden',
                  background: 'radial-gradient(ellipse at center, #0a1525 0%, #050a12 100%)' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
           style={{ width: '100%', height: '100%' }}>
        {/* Grid */}
        {[-60,-30,0,30,60].map(lat => (
          <line key={`lat${lat}`} x1="0" y1={toY(lat)} x2={W} y2={toY(lat)}
                stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
        ))}
        {[0,60,120,180,240,300].map(lng => (
          <line key={`lng${lng}`} x1={toX(lng-180)} y1="0" x2={toX(lng-180)} y2={H}
                stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
        ))}
        {/* Data points */}
        {points.map((p, i) => {
          const t = (p.val - minVal) / range;
          return (
            <circle key={i} cx={toX(p.lng)} cy={toY(p.lat)}
              r="3" fill={viridisColor(t)} opacity="0.8" />
          );
        })}
      </svg>
      {/* Color bar */}
      <div style={{
        position: 'absolute', right: 12, top: 12, bottom: 12, width: 14,
        background: 'linear-gradient(180deg, rgb(253,231,37) 0%, rgb(68,1,84) 100%)',
        borderRadius: 4, border: `1px solid ${C.border}`,
      }}>
        <div style={{ position: 'absolute', top: -16, fontSize: 9, color: C.ice30, whiteSpace: 'nowrap' }}>
          {maxVal?.toFixed(3)}
        </div>
        <div style={{ position: 'absolute', bottom: -16, fontSize: 9, color: C.ice30, whiteSpace: 'nowrap' }}>
          {minVal?.toFixed(3)}
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 4, left: 8, fontSize: 10, color: C.ice30 }}>
        Ls = {data.ls?.toFixed(1)}° · {points.length} points
      </div>
    </div>
  );
}

// ─── 相关矩阵 ───

function CorrelationChart({ data, h = 320 }) {
  if (!data || !data.matrix) return <LoadingBox h={h} />;

  const { matrix, variable_names } = data;
  const n = matrix.length;

  return (
    <div style={{ height: h, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `40px repeat(${n}, 1fr)`,
        gridTemplateRows: `28px repeat(${n}, 1fr)`,
        gap: 2, width: '90%', maxWidth: 420, aspectRatio: '1',
      }}>
        <div/>
        {variable_names.map((v, i) => (
          <div key={`h${i}`} style={{ fontSize: 9, color: C.ice60, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            {v.replace('_', '\n')}
          </div>
        ))}
        {matrix.map((row, ri) => [
          <div key={`l${ri}`} style={{ fontSize: 9, color: C.ice60, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            {variable_names[ri]?.replace('_', '\n')}
          </div>,
          ...row.map((val, ci) => (
            <div key={`${ri}-${ci}`} style={{
              background: rdbuColor(val),
              borderRadius: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, color: Math.abs(val) > 0.5 ? '#fff' : '#333',
              fontWeight: Math.abs(val) > 0.7 ? 700 : 400,
            }}>
              {val?.toFixed(2)}
            </div>
          )),
        ]).flat()}
      </div>
    </div>
  );
}


// ─── 纬度带定义 ───

const LATITUDE_BANDS_DISPLAY = [
  { label: '极地北 60-90°N', color: C.mars },
  { label: '中纬北 30-60°N', color: C.marsLight },
  { label: '赤道 30°S-30°N', color: C.ice60 },
  { label: '中纬南 30-60°S', color: C.blue },
  { label: '极地南 60-90°S', color: '#7c5cbf' },
];


// ═══════════════════════════════════════════
//  主页面组件
// ═══════════════════════════════════════════

export default function ExplorePage() {
  const [lsValue, setLsValue] = useState(90);
  const [marsYear, setMarsYear] = useState(27);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef(null);

  // 数据状态
  const [globeData, setGlobeData] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [bandsData, setBandsData] = useState(null);
  const [corrData, setCorrData] = useState(null);
  const [loading, setLoading] = useState({});

  // ─── 加载地球数据（随 Ls 变化） ───
  const loadGlobe = useCallback(async (ls) => {
    setLoading(prev => ({ ...prev, globe: true }));
    try {
      const data = await fetchGlobeData(marsYear, ls);
      setGlobeData(data);
    } catch (e) {
      console.error('Globe data error:', e);
    }
    setLoading(prev => ({ ...prev, globe: false }));
  }, [marsYear]);

  // ─── 加载静态数据（随火星年变化） ───
  const loadStaticData = useCallback(async () => {
    setLoading(prev => ({ ...prev, heatmap: true, bands: true, corr: true }));

    try {
      const [hm, bd, cr] = await Promise.all([
        fetchSeasonalHeatmap(marsYear),
        fetchSeasonalBands(marsYear),
        fetchCorrelation(marsYear),
      ]);
      setHeatmapData(hm);
      setBandsData(bd);
      setCorrData(cr);
    } catch (e) {
      console.error('Static data error:', e);
    }

    setLoading(prev => ({ ...prev, heatmap: false, bands: false, corr: false }));
  }, [marsYear]);

  // ─── 初始加载 ───
  useEffect(() => {
    loadGlobe(lsValue);
    loadStaticData();
  }, [marsYear]);

  // ─── Ls 变化时只刷新地球 ───
  useEffect(() => {
    loadGlobe(lsValue);
  }, [lsValue]);

  // ─── 播放动画 ───
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

  const seasonName =
    lsValue < 90 ? '北半球春 / 南半球秋' :
    lsValue < 180 ? '北半球夏 / 南半球冬' :
    lsValue < 270 ? '北半球秋 / 南半球春' : '北半球冬 / 南半球夏';

  return (
    <div className="page-enter" style={{ padding: '100px 40px 60px', maxWidth: 1400, margin: '0 auto' }}>
      <SectionTitle title="数据探索" subtitle="DATA EXPLORATION" />

      {/* ─── 控制栏 ─── */}
      <GlowCard style={{ padding: '16px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: C.ice60, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>MARS YEAR</span>
          <select
            value={marsYear}
            onChange={e => setMarsYear(Number(e.target.value))}
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', color: C.ice, fontSize: 13 }}
          >
            <option value={27}>MY 27</option>
            <option value={28}>MY 28</option>
          </select>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: C.ice60, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, whiteSpace: 'nowrap' }}>Ls</span>
          <input type="range" min={0} max={360} step={5} value={lsValue}
            onChange={e => setLsValue(Number(e.target.value))}
            style={{ flex: 1, accentColor: C.mars }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", minWidth: 50, textAlign: 'right' }}>
            {lsValue}°
          </span>
        </div>

        <button onClick={() => setPlaying(!playing)} style={{
          background: playing ? 'rgba(199,91,57,0.2)' : 'rgba(74,158,255,0.15)',
          border: `1px solid ${playing ? C.mars : C.blue}`,
          borderRadius: 8, padding: '8px 20px',
          color: playing ? C.mars : C.blue,
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
          fontFamily: "'Orbitron', sans-serif", letterSpacing: 1,
        }}>
          {playing ? '⏸ PAUSE' : '▶ PLAY'}
        </button>

        <div style={{ fontSize: 12, color: C.ice30 }}>{seasonName}</div>
      </GlowCard>

      {/* ─── 主图表区 ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* 地球（等距投影） */}
        <GlowCard breathe style={{ padding: 20, gridRow: 'span 2' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 12 }}>
            OZONE MAP · 全球臭氧分布
          </div>
          <GlobePlot data={globeData} h={450} />
        </GlowCard>

        {/* 热力图 */}
        <GlowCard breathe style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 12 }}>
            SEASONAL HEATMAP · Ls-纬度臭氧热力图
          </div>
          <HeatmapChart data={heatmapData} h={200} />
          <div style={{ marginTop: 8, fontSize: 10, color: C.ice30 }}>
            X: Solar Longitude (Ls 0°–360°) · Y: Latitude (-90°–90°) · Color: O₃ Column
          </div>
        </GlowCard>

        {/* 折线图 */}
        <GlowCard breathe style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 12 }}>
            LATITUDE BANDS · 纬度带季节变化
          </div>
          <LineChart data={bandsData} h={200} />
        </GlowCard>
      </div>

      {/* ─── 相关矩阵 ─── */}
      <div style={{ marginTop: 32 }}>
        <GlowCard breathe style={{ padding: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
            CORRELATION MATRIX · 变量相关性矩阵
          </div>
          <CorrelationChart data={corrData} h={350} />
        </GlowCard>
      </div>
    </div>
  );
}
