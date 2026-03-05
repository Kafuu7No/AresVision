import C from '../constants/colors';
import Mars3DPlaceholder from './Mars3DPlaceholder';

/**
 * 图表占位符组件 — 后续替换为真实 Plotly / Three.js 图表
 * 
 * Props:
 *   title — 图表标题
 *   type  — 'heatmap' | 'line' | 'globe' | 'bar' | 'correlation'
 *   h     — 高度 (px)
 */

const GRADIENTS = {
  heatmap: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 20%, #4a2068 40%, #c75b39 70%, #e8845a 90%)',
  line: 'linear-gradient(180deg, rgba(74,158,255,0.05) 0%, rgba(74,158,255,0.15) 100%)',
  globe: 'radial-gradient(circle at 40% 40%, #1a2040 0%, #0a0a1a 70%)',
  bar: 'linear-gradient(180deg, rgba(199,91,57,0.05) 0%, rgba(199,91,57,0.15) 100%)',
  correlation: 'linear-gradient(135deg, #0a1628 0%, #1a2848 50%, #2a1828 100%)',
};

function FakeLine() {
  return (
    <svg viewBox="0 0 400 150" style={{ width: '100%', height: '70%', padding: 20 }}>
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(74,158,255,0.3)" />
          <stop offset="100%" stopColor="rgba(74,158,255,0)" />
        </linearGradient>
        <linearGradient id="lg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(199,91,57,0.3)" />
          <stop offset="100%" stopColor="rgba(199,91,57,0)" />
        </linearGradient>
      </defs>
      <path d="M20,120 Q60,100 100,90 T180,60 T260,80 T340,40 T380,50" fill="none" stroke={C.blue} strokeWidth="2" opacity="0.8" />
      <path d="M20,120 Q60,100 100,90 T180,60 T260,80 T340,40 T380,50 L380,150 L20,150Z" fill="url(#lg1)" />
      <path d="M20,110 Q60,85 100,105 T180,70 T260,95 T340,55 T380,65" fill="none" stroke={C.mars} strokeWidth="2" opacity="0.8" />
      <path d="M20,110 Q60,85 100,105 T180,70 T260,95 T340,55 T380,65 L380,150 L20,150Z" fill="url(#lg2)" />
      {[30, 60, 90, 120].map((y) => (
        <line key={y} x1="20" y1={y} x2="380" y2={y} stroke="rgba(232,237,243,0.06)" strokeWidth="0.5" />
      ))}
    </svg>
  );
}

function FakeHeatmap() {
  return (
    <div style={{ padding: 16, height: '75%', display: 'grid', gridTemplateColumns: 'repeat(18,1fr)', gridTemplateRows: 'repeat(9,1fr)', gap: 1 }}>
      {Array.from({ length: 162 }).map((_, i) => {
        const hue = (i * 2.2 + Math.sin(i * 0.3) * 30) % 60;
        const sat = 60 + Math.sin(i * 0.15) * 30;
        const light = 15 + Math.sin(i * 0.1) * 20 + Math.cos(i * 0.05) * 10;
        return <div key={i} style={{ background: `hsl(${hue}, ${sat}%, ${light}%)`, borderRadius: 2, opacity: 0.85 }} />;
      })}
    </div>
  );
}

function FakeBar() {
  const heights = [65, 45, 80, 55, 70, 40, 85, 60, 75, 50, 90, 42, 68, 52, 78];
  return (
    <div style={{ padding: '20px 16px', height: '75%', display: 'flex', alignItems: 'flex-end', gap: 6, justifyContent: 'center' }}>
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            width: '5%',
            height: `${h}%`,
            background: `linear-gradient(180deg, ${i % 2 === 0 ? C.blue : C.mars} 0%, transparent 100%)`,
            borderRadius: '4px 4px 0 0',
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
}

function FakeCorrelation() {
  const vars = ['O₃', 'U', 'V', 'P', 'T', 'DOD', 'SF'];
  return (
    <div style={{ padding: 16, height: '80%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `30px repeat(7,1fr)`, gridTemplateRows: `24px repeat(7,1fr)`, gap: 2, width: '85%', maxWidth: 320, aspectRatio: '1' }}>
        <div />
        {vars.map((v, i) => (
          <div key={i} style={{ fontSize: 9, color: C.ice60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{v}</div>
        ))}
        {vars.map((v, ri) => [
          <div key={`l${ri}`} style={{ fontSize: 9, color: C.ice60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{v}</div>,
          ...vars.map((_, ci) => {
            const val = ri === ci ? 1 : Math.sin(ri * ci * 0.5) * 0.7 + (ri * 3 + ci * 7) % 10 / 30 - 0.15;
            const r = val > 0 ? Math.round(val * 180) : 0;
            const b = val < 0 ? Math.round(-val * 200) : 0;
            return (
              <div
                key={`${ri}-${ci}`}
                style={{
                  background: ri === ci ? C.mars : `rgba(${r + 40},${40 + Math.abs(val) * 20},${b + 60},${0.3 + Math.abs(val) * 0.5})`,
                  borderRadius: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, color: 'rgba(255,255,255,0.5)',
                }}
              >
                {val.toFixed(1)}
              </div>
            );
          }),
        ]).flat()}
      </div>
    </div>
  );
}

function FakeGlobe({ h }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80%', position: 'relative' }}>
      <Mars3DPlaceholder size={Math.min(h * 0.6, 200)} />
      <div
        style={{
          position: 'absolute',
          width: '70%',
          height: '70%',
          borderRadius: '50%',
          border: '1px dashed rgba(74,158,255,0.2)',
          animation: 'spin-slow 20s linear infinite reverse',
        }}
      />
    </div>
  );
}

const RENDERERS = {
  line: FakeLine,
  heatmap: FakeHeatmap,
  bar: FakeBar,
  correlation: FakeCorrelation,
};

export default function ChartPlaceholder({ title, type = 'heatmap', h = 300 }) {
  const Renderer = RENDERERS[type];

  return (
    <div
      style={{
        height: h,
        display: 'flex',
        flexDirection: 'column',
        background: GRADIENTS[type] || GRADIENTS.heatmap,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {title && (
        <div
          style={{
            padding: '12px 16px',
            fontSize: 13,
            fontWeight: 600,
            color: C.ice60,
            fontFamily: "'Exo 2', sans-serif",
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.mars }} />
          {title}
        </div>
      )}
      {Renderer ? <Renderer /> : <FakeGlobe h={h} />}
    </div>
  );
}
