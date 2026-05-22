import C from '../../constants/colors';
import GlowCard from '../../components/GlowCard';

export const TECH_STACKS = [
  { catKey: 'frontend', color: C.blue,      items: ['React 19', 'Vite', 'Three.js / react-globe.gl', 'Plotly.js', 'Tailwind CSS', 'Framer Motion'] },
  { catKey: 'backend',  color: '#4acfac',   items: ['FastAPI', 'xarray', 'NumPy / SciPy', 'uvicorn'] },
  { catKey: 'model',    color: C.mars,      items: ['PredRNNv2', 'PyTorch', 'Spatiotemporal LSTM', 'Multi-channel Input'] },
  { catKey: 'data',     color: '#9c7bea',   items: ['OpenMARS (o3col)', 'MCD 6.1', 'NetCDF (.nc)', '36×72 Grid'] },
];

export function TechStackBlock({ t }) {
  return (
    <GlowCard style={{ padding: 32, marginBottom: 24 }}>
      <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 24, textAlign: 'center' }}>
        TECHNOLOGY STACK
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
        {TECH_STACKS.map((stack, i) => (
          <div key={i}>
            <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', fontWeight: 700, color: stack.color, marginBottom: 12, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>
              {t(`about.techCats.${stack.catKey}`)}
            </div>
            {stack.items.map((item, j) => (
              <div key={j} style={{ fontSize: 'calc(13px * var(--font-scale, 1))', color: C.ice60, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                {item}
              </div>
            ))}
          </div>
        ))}
      </div>
    </GlowCard>
  );
}

export function DataSourcesBlock({ t }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
      <GlowCard style={{ padding: 24 }}>
        <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
          {t('about.openmarsTitle')}
        </div>
        <div style={{ fontSize: 'calc(13px * var(--font-scale, 1))', color: C.ice60, lineHeight: 1.8, whiteSpace: 'pre-line' }}>
          {t('about.openmarsContent')}
        </div>
      </GlowCard>
      <GlowCard style={{ padding: 24 }}>
        <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
          {t('about.mcdTitle')}
        </div>
        <div style={{ fontSize: 'calc(13px * var(--font-scale, 1))', color: C.ice60, lineHeight: 1.8, whiteSpace: 'pre-line' }}>
          {t('about.mcdContent')}
        </div>
      </GlowCard>
    </div>
  );
}
