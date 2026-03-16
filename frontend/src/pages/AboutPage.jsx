import C from '../constants/colors';
import { useT } from '../i18n';
import SectionTitle from '../components/SectionTitle';
import GlowCard from '../components/GlowCard';

const TECH_STACKS = [
  { catKey: 'frontend', color: C.blue,      items: ['React 19', 'Vite', 'Three.js / react-globe.gl', 'Plotly.js', 'Tailwind CSS', 'Framer Motion'] },
  { catKey: 'backend',  color: '#4acfac',   items: ['FastAPI', 'xarray', 'NumPy / SciPy', 'uvicorn'] },
  { catKey: 'model',    color: C.mars,      items: ['PredRNNv2', 'PyTorch', 'Spatiotemporal LSTM', 'Multi-channel Input'] },
  { catKey: 'data',     color: '#9c7bea',   items: ['OpenMARS (o3col)', 'MCD 6.1', 'NetCDF (.nc)', '36×72 Grid'] },
];

const TEAM = [
  { emoji: '👨‍💻', roleKey: 0 },
  { emoji: '👩‍🔬', roleKey: 1 },
  { emoji: '👨‍🎨', roleKey: 2 },
  { emoji: '👩‍💻', roleKey: 3 },
];

export default function AboutPage() {
  const t = useT();

  return (
    <div className="page-enter" style={{ padding: '100px 40px 60px', maxWidth: 1000, margin: '0 auto' }}>
      <SectionTitle title={t('about.title')} subtitle={t('about.subtitle')} align="center" />

      <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 48px', fontSize: 15, color: C.ice60, lineHeight: 1.8 }}>
        {t('about.description')}
      </div>

      {/* Tech Stack */}
      <GlowCard style={{ padding: 32, marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 24, textAlign: 'center' }}>
          TECHNOLOGY STACK
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {TECH_STACKS.map((stack, i) => (
            <div key={i}>
              <div style={{ fontSize: 12, fontWeight: 700, color: stack.color, marginBottom: 12, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>
                {t(`about.techCats.${stack.catKey}`)}
              </div>
              {stack.items.map((item, j) => (
                <div key={j} style={{ fontSize: 13, color: C.ice60, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>
      </GlowCard>

      {/* Data Sources */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <GlowCard style={{ padding: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
            {t('about.openmarsTitle')}
          </div>
          <div style={{ fontSize: 13, color: C.ice60, lineHeight: 1.8, whiteSpace: 'pre-line' }}>
            {t('about.openmarsContent')}
          </div>
        </GlowCard>
        <GlowCard style={{ padding: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
            {t('about.mcdTitle')}
          </div>
          <div style={{ fontSize: 13, color: C.ice60, lineHeight: 1.8, whiteSpace: 'pre-line' }}>
            {t('about.mcdContent')}
          </div>
        </GlowCard>
      </div>

      {/* Team */}
      <GlowCard style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 24 }}>
          TEAM
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 40 }}>
          {TEAM.map((member, i) => {
            const roles = t('about.teamRoles');
            return (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${C.mars}40, ${C.blue}40)`,
                  border: `2px solid ${C.border}`,
                  margin: '0 auto 12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                }}>
                  {member.emoji}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ice }}>
                  {t('about.member', { n: i + 1 })}
                </div>
                <div style={{ fontSize: 11, color: C.ice30 }}>
                  {Array.isArray(roles) ? roles[member.roleKey] : ''}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 32, fontSize: 12, color: C.ice30 }}>
          {t('about.competition')}
        </div>
      </GlowCard>
    </div>
  );
}
