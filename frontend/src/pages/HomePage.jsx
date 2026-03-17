import { useState, useEffect } from 'react';
import C from '../constants/colors';
import { useT } from '../i18n';
import { useSettings } from '../contexts/SettingsContext';
import Mars3DPlaceholder from '../components/Mars3DPlaceholder';
import GlowCard from '../components/GlowCard';

// ─── 图标组件（无文案，保持不变）───

function IconGlobe({ color = C.mars, size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <circle cx="16" cy="16" r="12" />
      <ellipse cx="16" cy="16" rx="5.5" ry="12" />
      <line x1="4.5" y1="16" x2="27.5" y2="16" />
      <path d="M6 10 Q16 12 26 10" />
      <path d="M6 22 Q16 20 26 22" />
    </svg>
  );
}

function IconCpu({ color = C.blue, size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <rect x="9" y="9" width="14" height="14" rx="2" />
      <rect x="12.5" y="12.5" width="7" height="7" rx="1" />
      <line x1="12" y1="9" x2="12" y2="5.5" /><line x1="16" y1="9" x2="16" y2="5.5" /><line x1="20" y1="9" x2="20" y2="5.5" />
      <line x1="12" y1="23" x2="12" y2="26.5" /><line x1="16" y1="23" x2="16" y2="26.5" /><line x1="20" y1="23" x2="20" y2="26.5" />
      <line x1="9" y1="12" x2="5.5" y2="12" /><line x1="9" y1="16" x2="5.5" y2="16" /><line x1="9" y1="20" x2="5.5" y2="20" />
      <line x1="23" y1="12" x2="26.5" y2="12" /><line x1="23" y1="16" x2="26.5" y2="16" /><line x1="23" y1="20" x2="26.5" y2="20" />
    </svg>
  );
}

function IconChart({ color = C.mars, size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="27" x2="27" y2="27" />
      <line x1="5" y1="5" x2="5" y2="27" />
      <polyline points="5,22 10,15 15,18 20,10 27,6" />
      <circle cx="10" cy="15" r="1.5" fill={color} />
      <circle cx="15" cy="18" r="1.5" fill={color} />
      <circle cx="20" cy="10" r="1.5" fill={color} />
      <circle cx="27" cy="6"  r="1.5" fill={color} />
    </svg>
  );
}

function IconMessage({ color = C.blue, size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6 Q4 4 6 4 L26 4 Q28 4 28 6 L28 20 Q28 22 26 22 L12 22 L6 28 L6 22 Q4 22 4 20 Z" />
      <line x1="9" y1="11" x2="23" y2="11" />
      <line x1="9" y1="16" x2="18" y2="16" />
    </svg>
  );
}

function IconWrapper({ children, accent = C.mars }) {
  return (
    <div style={{
      width: 58, height: 58, borderRadius: 16,
      background: `rgba(${accent === C.mars ? '199,91,57' : '74,158,255'},0.08)`,
      border: `1px solid rgba(${accent === C.mars ? '199,91,57' : '74,158,255'},0.18)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 16px',
    }}>
      {children}
    </div>
  );
}

// ─── 主页面 ───

export default function HomePage({ onNavigate }) {
  const t = useT();
  const { settings } = useSettings();
  const isLight = settings.theme === 'light';

  const [showTitle, setShowTitle] = useState(false);
  const [showSub, setShowSub] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  const [marsReady, setMarsReady] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setMarsReady(true), 300);
    const t2 = setTimeout(() => setShowTitle(true), 1000);
    const t3 = setTimeout(() => setShowSub(true), 1800);
    const t4 = setTimeout(() => setShowButtons(true), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  const features = [
    {
      icon: <IconWrapper accent={C.mars}><IconGlobe color={C.mars} size={30} /></IconWrapper>,
      title: t('home.features.viz3d.title'),
      desc:  t('home.features.viz3d.desc'),
    },
    {
      icon: <IconWrapper accent={C.blue}><IconCpu color={C.blue} size={30} /></IconWrapper>,
      title: t('home.features.ai.title'),
      desc:  t('home.features.ai.desc'),
    },
    {
      icon: <IconWrapper accent={C.mars}><IconChart color={C.mars} size={30} /></IconWrapper>,
      title: t('home.features.chart.title'),
      desc:  t('home.features.chart.desc'),
    },
    {
      icon: <IconWrapper accent={C.blue}><IconMessage color={C.blue} size={30} /></IconWrapper>,
      title: t('home.features.insight.title'),
      desc:  t('home.features.insight.desc'),
    },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      position: 'relative',
      padding: '100px 40px 40px',
    }}>
      {/* 轨道装饰线 */}
      <svg style={{ position: 'absolute', width: 720, height: 720, opacity: 0.055 }} viewBox="0 0 720 720">
        <circle cx="360" cy="360" r="200" fill="none" stroke={C.blue} strokeWidth="0.5" strokeDasharray="4 9" />
        <circle cx="360" cy="360" r="290" fill="none" stroke={C.mars} strokeWidth="0.5" strokeDasharray="6 11" />
        <circle cx="360" cy="360" r="355" fill="none" stroke={C.ice} strokeWidth="0.3" strokeDasharray="3 14" />
      </svg>

      {/* 球体背后大气散射光晕（浅色主题下增强氛围） */}
      {isLight && (
        <div style={{
          position: 'absolute',
          top: 'calc(50% - 220px)',
          width: 560, height: 440,
          background: 'radial-gradient(ellipse at center, rgba(200,140,100,0.08) 0%, rgba(200,140,100,0) 60%)',
          pointerEvents: 'none',
        }} />
      )}

      {/* 火星球体 */}
      <div style={{
        animation: marsReady ? 'marsApproach 1.5s cubic-bezier(0.22,1,0.36,1) forwards' : 'none',
        opacity: marsReady ? undefined : 0,
        marginBottom: 48,
      }}>
        <Mars3DPlaceholder size={280} />
      </div>

      {/* 脉冲光环 */}
      <div style={{
        position: 'absolute', top: 'calc(50% - 100px)',
        width: 310, height: 310, borderRadius: '50%',
        border: isLight ? '1.5px solid rgba(199,91,57,0.12)' : '1.5px solid rgba(199,91,57,0.18)',
        boxShadow: isLight ? '0 0 40px rgba(180,140,120,0.15)' : 'none',
        animation: 'pulse-ring 3s ease-out infinite',
      }} />

      {/* 标题区 */}
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <h1 style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: 56, fontWeight: 900, letterSpacing: 8,
          color: isLight ? '#2a2a3a' : C.ice, margin: 0,
          textShadow: isLight
            ? '0 2px 16px rgba(199,91,57,0.12)'
            : '0 0 60px rgba(199,91,57,0.28)',
          opacity: showTitle ? 1 : 0,
          transform: showTitle ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 1s cubic-bezier(0.22,1,0.36,1)',
        }}>
          ARESVISION
        </h1>

        <div style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: 18, fontWeight: 500, letterSpacing: 12,
          color: C.mars, marginTop: 8,
          opacity: showTitle ? 1 : 0,
          transform: showTitle ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 1s cubic-bezier(0.22,1,0.36,1) 0.2s',
        }}>
          {t('home.subtitle')}
        </div>

        <p style={{
          marginTop: 32, fontSize: 16,
          color: isLight ? 'rgba(42,42,58,0.7)' : C.ice60,
          lineHeight: 1.8, maxWidth: 580,
          opacity: showSub ? 1 : 0,
          transform: showSub ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.8s cubic-bezier(0.22,1,0.36,1)',
        }}>
          {t('home.desc')}
          <br />
          <span style={{ color: isLight ? '#7a7a8a' : C.ice30, fontSize: 13 }}>
            {t('home.descEn')}
          </span>
        </p>

        {/* CTA 按钮 */}
        <div style={{
          marginTop: 40, display: 'flex', gap: 16, justifyContent: 'center',
          opacity: showButtons ? 1 : 0,
          transform: showButtons ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.8s cubic-bezier(0.22,1,0.36,1)',
        }}>
          <button onClick={() => onNavigate('explore')} style={{
            background: `linear-gradient(135deg, ${C.mars}, ${C.marsLight})`,
            border: 'none', borderRadius: 12,
            padding: '14px 36px', color: '#fff',
            fontSize: 13, fontWeight: 700,
            fontFamily: "'Orbitron', sans-serif", letterSpacing: 2,
            cursor: 'pointer',
            boxShadow: '0 4px 24px rgba(199,91,57,0.4)',
          }}>
            {t('home.exploreBtn')}
          </button>
          <button onClick={() => onNavigate('predict')} style={{
            background: 'transparent',
            border: `1px solid ${C.ice30}`,
            borderRadius: 12, padding: '14px 36px',
            color: C.ice, fontSize: 13, fontWeight: 600,
            fontFamily: "'Exo 2', sans-serif", letterSpacing: 1,
            cursor: 'pointer',
          }}>
            {t('home.predictBtn')}
          </button>
        </div>
      </div>

      {/* Scroll 指示器 */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        marginTop: 48,
        opacity: showButtons ? 0.4 : 0,
        transition: 'opacity 1s',
        animation: 'float 3s ease-in-out infinite',
      }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: C.ice60, fontFamily: "'Orbitron', sans-serif" }}>
          SCROLL
        </div>
        <div style={{ width: 1, height: 30, background: `linear-gradient(180deg, ${C.ice30}, transparent)` }} />
      </div>

      {/* 功能卡片 */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16, marginTop: 80, width: '100%', maxWidth: 1000,
        opacity: showButtons ? 1 : 0,
        transition: 'opacity 1s 0.5s',
      }}>
        {features.map((f, i) => (
          <GlowCard key={i} style={{ padding: '24px 20px', textAlign: 'center' }}>
            {f.icon}
            <div style={{
              fontSize: 14, fontWeight: 700, color: C.ice,
              marginBottom: 8, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1,
            }}>
              {f.title}
            </div>
            <div style={{ fontSize: 12, color: C.ice60, lineHeight: 1.6 }}>
              {f.desc}
            </div>
          </GlowCard>
        ))}
      </div>
    </div>
  );
}
