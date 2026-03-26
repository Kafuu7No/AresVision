import React from 'react';
import { createPortal } from 'react-dom';
import SphericalFieldCanvas from '../../components/SphericalFieldCanvas';
import GlowCard from '../../components/GlowCard';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { fmtNum } from '../../utils/fmt';
import { convertOzone, ozoneDeltaLabel, ozoneLabel } from '../../utils/units';
import Plot from 'react-plotly.js';
import { useSettings } from '../../contexts/SettingsContext';
import { PLOTLY_SCALE } from '../../utils/colormaps';

export default function PredictFullscreenHUD({
  fullscreen3D,
  setFullscreen3D,
  truthField,
  stepLs,
  step,
  precision,
  ozoneUnit,
}) {
  const t = useT();
  const { settings } = useSettings();
  const colormapName = settings.colormap;

  if (!fullscreen3D) return null;

  const titleText = fullscreen3D.colorMode === 'rdbu' ? t('predict.fullscreen3D.residual') :
    (fullscreen3D.fieldData === truthField ? t('predict.fullscreen3D.truth') : t('predict.fullscreen3D.prediction'));
  const minValStr = fmtNum(convertOzone(fullscreen3D.fieldData.minVal, ozoneUnit), precision);
  const maxValStr = fmtNum(convertOzone(fullscreen3D.fieldData.maxVal, ozoneUnit), precision);
  const rawMin = fullscreen3D.fieldData.minVal, rawMax = fullscreen3D.fieldData.maxVal;
  const rangeStr = fmtNum(convertOzone(rawMax - rawMin, ozoneUnit), precision);
  const colorTitle = fullscreen3D.colorMode === 'rdbu' ? ozoneDeltaLabel(ozoneUnit) : ozoneLabel(ozoneUnit);
  const absExtreme = convertOzone(Math.max(Math.abs(rawMin), Math.abs(rawMax)), ozoneUnit);
  const topLabel = fullscreen3D.colorMode === 'rdbu' ? `+${fmtNum(absExtreme, precision)}` : maxValStr;
  const midLabel = fullscreen3D.colorMode === 'rdbu' ? '0' : fmtNum(convertOzone((rawMin + rawMax) / 2, ozoneUnit), precision);
  const botLabel = fullscreen3D.colorMode === 'rdbu' ? `-${fmtNum(absExtreme, precision)}` : minValStr;

  // --- Data for Analytics Charts ---
  const field = fullscreen3D.fieldData.field;
  const nLat = field.length;
  const nLon = field[0].length;
  const latitudes = Array.from({ length: nLat }, (_, i) => 90 - (i / (nLat - 1)) * 180);
  const longitudes = Array.from({ length: nLon }, (_, i) => (i / Math.max(1, nLon)) * 360);
  const latProfile = field.map(row => {
    const sum = row.reduce((s, v) => s + v, 0);
    return convertOzone(sum / nLon, ozoneUnit);
  });
  const heatmapZ = field.map(row => row.map(v => convertOzone(v, ozoneUnit)));
  let absMax = 0;
  if (fullscreen3D.colorMode === 'rdbu') {
    field.forEach(row => row.forEach(v => absMax = Math.max(absMax, Math.abs(v))));
  }
  const absMaxOzone = convertOzone(absMax, ozoneUnit);
  const minOzone = convertOzone(fullscreen3D.fieldData.minVal, ozoneUnit);
  const maxOzone = convertOzone(fullscreen3D.fieldData.maxVal, ozoneUnit);

  const chartTheme = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { family: "'Exo 2', sans-serif", color: 'rgba(255,255,255,0.4)', size: 9 },
    margin: { t: 5, r: 10, l: 30, b: 20 },
  };

  const content = (
    <div
      className="fixed inset-0 z-[9999] bg-[#020205]/95 flex items-center justify-center p-1 md:p-4 overflow-hidden"
      onDoubleClick={() => setFullscreen3D(null)}
    >
      {/* Background Ambience Layer */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,240,255,0.05)_0%,transparent_70%)] pointer-events-none" />
      
      <GlowCard
        className="relative w-full max-w-[1800px] h-[96vh] bg-[#0A0A0F]/90 border border-white/5 shadow-[0_0_100px_rgba(0,0,0,0.8)] cursor-default flex flex-col overflow-hidden"
        style={{ animation: 'scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)', borderRadius: '32px' }}
        onDoubleClick={e => e.stopPropagation()}
      >
        {/* Scanline Global Effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 Mix-blend-overlay">
          <div className="w-full h-[2px] bg-white/20 absolute top-[-10px] animate-scanline" />
        </div>

        {/* Global Header */}
        <div className="flex-none flex justify-between items-center px-10 py-6 border-b border-white/5 relative bg-gradient-to-r from-black/40 to-transparent">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-4">
              <div className="w-2.5 h-10 bg-[#00F0FF] shadow-[0_0_25px_#00F0FF] rounded-full animate-pulse-glow"></div>
              <h1 className="text-3xl font-black text-white tracking-widest font-orbitron uppercase flex items-center">
                GLOBAL FIELD HUD
                <span className="ml-5 text-[10px] bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 px-3 py-1 rounded-full tracking-widest font-sans animate-flicker">
                   LS {stepLs?.toFixed(1)}° · {titleText}
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-2 pl-6 ml-1 mt-1">
              <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse"></span>
              <span className="text-[9px] font-mono text-[#00F0FF]/60 uppercase tracking-widest">
                SYSTEM STATUS: NOMINAL | ANALYZING MARTIAN SPATIOTEMPORAL DISTRIBUTION...
              </span>
            </div>
          </div>

          <button
            onClick={() => setFullscreen3D(null)}
            className="group relative w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/20 hover:border-red-500/40 transition-all duration-300"
          >
            <span className="text-2xl text-white group-hover:scale-110 transition-transform">✕</span>
            <div className="absolute inset-[-4px] border border-white/0 group-hover:border-white/10 rounded-[20px] transition-all" />
          </button>
        </div>

        {/* Modal Main Content Container */}
        <div className="flex-1 flex flex-row overflow-hidden relative">
          
          {/* LEFT SIDEBAR: Telemetry & Core Stats */}
          <div className="w-[400px] flex-shrink-0 relative border-r border-white/10 flex flex-col p-10 overflow-hidden backdrop-blur-2xl bg-[#0A0A0F]/60 animate-slide-in-left">
            {/* Sidebar scanline decoration */}
            <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-[#00F0FF]/30 to-transparent" />

            <div className="flex-1 flex flex-col gap-14 overflow-y-auto pr-2 scrollbar-none">
              
              {/* Statistics Section */}
              <div className="relative group">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-1.5 h-5 bg-[#00F0FF] shadow-[0_0_10px_#00F0FF]"></div>
                  <h3 className="text-sm font-black tracking-[0.2em] text-white/90 uppercase font-orbitron">TELEMETRY</h3>
                </div>
                
                <div className="grid grid-cols-1 gap-5">
                  {[
                    { label: 'MAX VALUE', value: maxValStr, color: '#FF6B35' },
                    { label: 'MIN VALUE', value: minValStr, color: '#4ACFAC' },
                    { label: 'DATA RANGE', value: rangeStr, color: '#FFFFFF', opacity: '0.4' },
                  ].map((stat, idx) => (
                    <div key={idx} className="relative p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 transition-all group/stat">
                      <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ backgroundColor: stat.color, opacity: stat.opacity || 1 }} />
                      <div className="text-[10px] text-white/40 tracking-widest font-orbitron mb-2 uppercase">{stat.label}</div>
                      <div className="text-2xl font-black font-orbitron tabular-nums" style={{ color: stat.color, opacity: stat.opacity || 1 }}>
                        {stat.value}
                        <span className="text-[10px] ml-2 opacity-40 font-normal">{ozoneLabel(ozoneUnit)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Scale (Visual Slider) */}
              <div className="p-8 rounded-3xl bg-gradient-to-br from-[#9c7bea]/10 to-transparent border border-[#9c7bea]/20 shadow-[inset_0_0_30px_rgba(156,123,234,0.05)]">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-1.5 h-5 bg-[#9c7bea] shadow-[0_0_10px_#9C7BEA]"></div>
                  <h3 className="text-xs font-black tracking-widest text-white/80 uppercase font-orbitron">DATA SCALE</h3>
                </div>
                <div className="flex flex-col gap-5">
                  <div
                    className="h-8 rounded-full border border-white/10 relative shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden"
                    style={{
                      background: fullscreen3D.colorMode === 'rdbu'
                        ? 'linear-gradient(to right, rgb(5,48,97), rgb(247,247,247), rgb(103,0,31))'
                        : 'linear-gradient(to right, rgb(0,0,4), rgb(212,72,66), rgb(252,255,164))',
                    }}
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,s0.1)_50%,transparent_100%)] animate-shimmer" />
                    {fullscreen3D.colorMode === 'rdbu' && (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-full bg-black/40 z-10" />
                    )}
                  </div>
                  <div className="flex justify-between items-center px-1 font-orbitron">
                    <div className="flex flex-col">
                      <span className="text-[8px] text-white/30 uppercase tracking-tighter mb-1">LOW</span>
                      <span className="text-[10px] text-white/70 tracking-tighter">{botLabel}</span>
                    </div>
                    <span className="text-[10px] text-[#9c7bea] font-bold tracking-widest">{colorTitle}</span>
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] text-white/30 uppercase tracking-tighter mb-1">HIGH</span>
                      <span className="text-[10px] text-white/70 tracking-tighter">{topLabel}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
            
            <div className="mt-8 opacity-20 font-mono text-[8px] uppercase tracking-tighter text-white">
              CORE_OS [v6.1.25] · STATUS: MONITORING
            </div>
          </div>

          {/* CENTRE: Expanded & Cinematic 3D Global Space */}
          <div className="flex-1 min-w-0 bg-[#020205] relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)] pointer-events-none z-10" />
            <SphericalFieldCanvas
              fieldData={fullscreen3D.fieldData}
              colorMode={fullscreen3D.colorMode}
              h="100%"
              zoom={3.3}
            />
            {/* HUD Vignette / Lens Depth Effect */}
            <div className="absolute inset-0 pointer-events-none z-20 shadow-[inset_0_0_200px_rgba(0,0,0,1)] opacity-80" />
          </div>

          {/* RIGHT SIDEBAR: Advanced Analytics */}
          <div className="w-[400px] flex-shrink-0 relative border-l border-white/10 flex flex-col p-10 overflow-hidden backdrop-blur-2xl bg-[#0A0A0F]/60 animate-slide-in-right">
            {/* Sidebar border glow */}
            <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-[#FF6B35]/30 to-transparent" />

            <div className="flex-1 flex flex-col gap-12 overflow-y-auto pr-2 scrollbar-none">
              {/* Planetary Scan Section */}
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-4 bg-[#00F0FF] shadow-[0_0_10px_#00F0FF]"></div>
                  <h3 className="text-xs font-black tracking-widest text-white/90 uppercase font-orbitron">PLANETARY SCAN [2D]</h3>
                </div>
                <div className="h-48 rounded-2xl bg-black/40 border border-white/10 overflow-hidden relative group/chart">
                  <Plot
                    data={[{
                      z: heatmapZ,
                      x: longitudes,
                      y: latitudes,
                      type: 'heatmap',
                      zsmooth: 'best',
                      colorscale: fullscreen3D.colorMode === 'rdbu' ? 'RdBu' : (PLOTLY_SCALE[colormapName] ?? 'Jet'),
                      zmin: fullscreen3D.colorMode === 'rdbu' ? -absMaxOzone : minOzone,
                      zmax: fullscreen3D.colorMode === 'rdbu' ? absMaxOzone : maxOzone,
                      showscale: false,
                      hovertemplate: 'Lat: %{y:.1f}°<br>Lon: %{x:.1f}°<br>Val: %{z:.2f}<extra></extra>',
                    }]}
                    layout={{
                      ...chartTheme,
                      autosize: true,
                      xaxis: { showgrid: false, zeroline: false, ticksuffix: '°', nticks: 4, zerolinecolor: 'rgba(255,255,255,0.05)' },
                      yaxis: { showgrid: false, zeroline: false, ticksuffix: '°', nticks: 4, zerolinecolor: 'rgba(255,255,255,0.05)' },
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                  />
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#00F0FF]/5 to-transparent opacity-40" />
                </div>
                <div className="mt-3 text-[8px] font-mono text-white/20 uppercase tracking-tighter text-right">
                   Grid Projection: Equirectangular · Resolution: 5.0°
                </div>
              </div>

              {/* Meridional Profile Section */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-4 bg-[#FF6B35] shadow-[0_0_10px_#FF6B35]"></div>
                  <h3 className="text-xs font-black tracking-widest text-white/90 uppercase font-orbitron">LATITUDINAL PROFILE</h3>
                </div>
                <div className="h-56 rounded-2xl bg-black/40 border border-white/10 overflow-hidden relative group/chart">
                  <Plot
                    data={[{
                      x: latProfile,
                      y: latitudes,
                      type: 'scatter',
                      mode: 'lines',
                      line: { color: '#00F0FF', width: 3, shape: 'spline' },
                      fill: 'tozerox',
                      fillcolor: 'rgba(0, 240, 255, 0.15)',
                      hovertemplate: 'Lat: %{y:.1f}°<br>Mean: %{x:.2f}<extra></extra>',
                    }]}
                    layout={{
                      ...chartTheme,
                      autosize: true,
                      xaxis: { gridcolor: 'rgba(255,255,255,0.03)', zeroline: false, nticks: 4, showline: false },
                      yaxis: { gridcolor: 'rgba(255,255,255,0.03)', zeroline: false, range: [-90, 90], tickvals: [-90, -45, 0, 45, 90], showline: false },
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                  />
                  <div className="absolute inset-0 pointer-events-none mix-blend-color-dodge opacity-20">
                     <div className="w-full h-full bg-[radial-gradient(ellipse_at_center,rgba(0,240,255,0.2)_0%,transparent_80%)]" />
                  </div>
                </div>
                <div className="mt-3 text-[8px] font-mono text-white/20 uppercase tracking-tighter text-right">
                   Sampling: Zonal Mean · Domain: [-90, 90]
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end opacity-20">
               <div className="w-8 h-8 border border-white flex items-center justify-center text-[10px] font-black font-orbitron">
                  A.V
               </div>
            </div>
          </div>
        </div>
      </GlowCard>

      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes scanline {
          0% { top: -10px; }
          100% { top: 100%; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes flicker {
          0% { opacity: 0.8; }
          50% { opacity: 1; }
          60% { opacity: 0.9; }
          100% { opacity: 1; }
        }
        @keyframes pulse-glow {
          0% { box-shadow: 0 0 10px #00F0FF; }
          50% { box-shadow: 0 0 30px #00F0FF; }
          100% { box-shadow: 0 0 10px #00F0FF; }
        }
        .animate-scanline {
          animation: scanline 4s linear infinite;
        }
        .animate-shimmer {
          animation: shimmer 2s linear infinite;
        }
        .animate-flicker {
          animation: flicker 0.2s infinite;
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .animate-slide-in-left {
          animation: slideInLeft 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );

  return createPortal(content, document.body);
}
