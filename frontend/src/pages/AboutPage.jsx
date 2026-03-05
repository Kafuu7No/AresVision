import C from '../constants/colors';
import SectionTitle from '../components/SectionTitle';
import GlowCard from '../components/GlowCard';

const TECH_STACKS = [
  { cat: '前端', color: C.blue, items: ['React 19', 'Vite', 'Three.js / react-globe.gl', 'Plotly.js', 'Tailwind CSS', 'Framer Motion'] },
  { cat: '后端', color: '#4acfac', items: ['FastAPI', 'xarray', 'NumPy / SciPy', 'uvicorn'] },
  { cat: '模型', color: C.mars, items: ['PredRNNv2', 'PyTorch', '时空 LSTM', '多通道输入'] },
  { cat: '数据', color: '#9c7bea', items: ['OpenMARS (o3col)', 'MCD 6.1', 'NetCDF (.nc)', '36×72 经纬网格'] },
];

const TEAM = [
  { emoji: '👨‍💻', role: '全栈开发' },
  { emoji: '👩‍🔬', role: '数据科学' },
  { emoji: '👨‍🎨', role: 'UI/UX' },
  { emoji: '👩‍💻', role: '模型训练' },
];

export default function AboutPage() {
  return (
    <div className="page-enter" style={{ padding: '100px 40px 60px', maxWidth: 1000, margin: '0 auto' }}>
      <SectionTitle title="关于项目" subtitle="ABOUT ARESVISION" align="center" />

      <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 48px', fontSize: 15, color: C.ice60, lineHeight: 1.8 }}>
        智绘赤星 (AresVision) 是一个面向火星大气科学研究的臭氧预测与可视化平台，
        基于 OpenMARS 再分析数据和 MCD 6.1 气候模拟数据，运用 PredRNNv2 时空深度学习模型
        实现火星全球臭氧柱浓度的多步预测。
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
                {stack.cat}
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
            OPENMARS 再分析数据
          </div>
          <div style={{ fontSize: 13, color: C.ice60, lineHeight: 1.8 }}>
            变量：o3col（臭氧柱浓度, μm-atm）<br />
            维度：Ls × lat(36) × lon(72) × lev(35)<br />
            覆盖：MY27 完整年 (Ls 2°–360°)<br />
            分辨率：5° 经纬网格
          </div>
        </GlowCard>
        <GlowCard style={{ padding: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
            MCD 6.1 气候模拟数据
          </div>
          <div style={{ fontSize: 13, color: C.ice60, lineHeight: 1.8 }}>
            变量：U/V Wind, Pressure, Temperature, DOD, Solar Flux<br />
            维度：sol(669) × hour(8) × lat(36) × lon(72)<br />
            覆盖：MY27 完整 (5352 时间步)<br />
            时间对齐：Ls 插值到 OpenMARS 格点
          </div>
        </GlowCard>
      </div>

      {/* Team */}
      <GlowCard style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 24 }}>
          TEAM
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 40 }}>
          {TEAM.map((member, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${C.mars}40, ${C.blue}40)`,
                  border: `2px solid ${C.border}`,
                  margin: '0 auto 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                }}
              >
                {member.emoji}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ice }}>成员 {i + 1}</div>
              <div style={{ fontSize: 11, color: C.ice30 }}>{member.role}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 32, fontSize: 12, color: C.ice30 }}>
          上海大学生计算机能力大赛 · 大数据赛道
        </div>
      </GlowCard>
    </div>
  );
}
