import React from 'react';
import { createPortal } from 'react-dom';
import SphericalFieldCanvas from '../../components/SphericalFieldCanvas';
import GlowCard from '../../components/GlowCard';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { fmtNum } from '../../utils/fmt';
import { convertOzone, ozoneDeltaLabel, ozoneLabel } from '../../utils/units';

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

  const content = (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-1 md:p-2"
      onDoubleClick={() => setFullscreen3D(null)}
    >
      <GlowCard
        className="w-full max-w-[1700px] h-[98vh] bg-[#0A0A0F]/90 border border-[#1E1E26] shadow-2xl cursor-default flex flex-col overflow-hidden"
        style={{ animation: 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)', borderRadius: '24px' }}
        onDoubleClick={e => e.stopPropagation()}
      >
        {/* Header - Aligned with SHAP Mode (Enlarged) */}
        <div className="flex-none flex justify-between items-center px-8 py-5 border-b border-white/5 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-2.5 h-8 bg-[#00F0FF] shadow-[0_0_15px_#00F0FF]"></div>
            <h1 className="text-2xl font-black text-[#00F0FF] tracking-tighter font-orbitron uppercase">
              3D GLOBE VIEW
              <span className="text-white/20 ml-3 font-normal text-base lowercase font-sans">
                | {titleText} Ls {stepLs?.toFixed(1)}°
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setFullscreen3D(null)}
              className="w-12 h-12 rounded-full bg-red-500/5 border border-red-500/20 flex items-center justify-center hover:bg-red-500/20 hover:border-red-500/50 transition-all text-red-500"
            >
              <span className="text-xl">✕</span>
            </button>
          </div>
        </div>

        {/* Modal Main Content Container */}
        <div className="flex-1 flex flex-row overflow-hidden">
          {/* Left Data Column (Enlarged) */}
          <div
            className="w-[340px] border-r border-white/5 flex flex-col p-8 gap-10 overflow-y-auto"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            {/* Statistics */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1.5 h-4 bg-[#00F0FF]"></div>
                <h3 className="text-[12px] font-black tracking-widest text-[#00F0FF] uppercase">GLOBE STATISTICS</h3>
              </div>
              <div className="space-y-4 font-orbitron">
                <div className="flex justify-between text-sm">
                  <span className="text-white/40 uppercase tracking-tighter">MAX VALUE</span>
                  <span className="text-[#ff6b35] font-bold text-lg">{maxValStr}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40 uppercase tracking-tighter">MIN VALUE</span>
                  <span className="text-[#4acfac] font-bold text-lg">{minValStr}</span>
                </div>
                <div className="pt-3 border-t border-white/5 flex justify-between text-xs">
                  <span className="text-white/20 uppercase tracking-tighter">DATA RANGE</span>
                  <span className="text-white/80 font-bold">{rangeStr}</span>
                </div>
              </div>
            </div>

            {/* Scale Legend */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1.5 h-4 bg-[#9c7bea]"></div>
                <h3 className="text-[12px] font-black tracking-widest text-[#9c7bea] uppercase">DATA SCALE ({colorTitle})</h3>
              </div>
              <div className="flex items-center gap-4 mt-6">
                <span className="text-xs text-white/40 font-mono w-14 text-right">{botLabel}</span>
                <div
                  className="flex-1 h-4 rounded-full border border-white/10 relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
                  style={{
                    background: fullscreen3D.colorMode === 'rdbu'
                      ? 'linear-gradient(to right, rgb(5,48,97), rgb(247,247,247), rgb(103,0,31))'
                      : 'linear-gradient(to right, rgb(0,0,4), rgb(212,72,66), rgb(252,255,164))',
                  }}
                >
                  {fullscreen3D.colorMode === 'rdbu' && (
                    <div className="absolute top-[-18px] left-1/2 -translate-x-1/2 text-[10px] text-white/30 font-mono">0</div>
                  )}
                </div>
                <span className="text-xs text-white/40 font-mono w-14">{topLabel}</span>
              </div>
            </div>

            <div className="mt-auto pt-6 border-t border-white/5">
              <p className="text-[10px] font-mono text-white/20 uppercase leading-relaxed tracking-tighter">
                Drag to rotate globe. Scroll to zoom in/out. View global convergence and spatiotemporal distribution patterns across the Martian surface.
              </p>
            </div>
          </div>

          {/* Right 3D Visualizer Area */}
          <div className="flex-1 bg-black/40 relative">
            <SphericalFieldCanvas
              fieldData={fullscreen3D.fieldData}
              colorMode={fullscreen3D.colorMode}
              h="100%"
            />
          </div>
        </div>
      </GlowCard>

      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );

  return createPortal(content, document.body);
}
