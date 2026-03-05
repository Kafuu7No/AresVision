import { useState, useEffect } from 'react';
import C from '../constants/colors';
import Mars3DPlaceholder from '../components/Mars3DPlaceholder';
import GlowCard from '../components/GlowCard';

export default function HomePage({ onNavigate }) {
  const [showTitle, setShowTitle] = useState(false);
  const [showSub, setShowSub] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  const [marsReady, setMarsReady] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setMarsReady(true), 300);
    const t2 = setTimeout(() => setShowTitle(true), 1000);
    const t3 = setTimeout(() => setShowSub(true), 1800);
    const t4 = setTimeout(() => setShowButtons(true), 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  const features = [
    { icon: '🌍', title: '3D 可视化', desc: 'WebGL 火星球体实时渲染' },
    { icon: '🤖', title: 'AI 预测', desc: 'PredRNNv2 时空序列模型' },
    { icon: '📊', title: '科学图表', desc: 'Ls-纬度热力图 & 多维分析' },
    { icon: '💬', title: '智能解读', desc: '大模型驱动的自然语言问答' },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        padding: '80px 40px 40px',
      }}
    >
      {/* Orbit rings decoration */}
      <svg style={{ position: 'absolute', width: 700, height: 700, opacity: 0.06 }} viewBox="0 0 700 700">
        <circle cx="350" cy="350" r="200" fill="none" stroke={C.blue} strokeWidth="0.5" strokeDasharray="4 8" />
        <circle cx="350" cy="350" r="280" fill="none" stroke={C.mars} strokeWidth="0.5" strokeDasharray="6 10" />
        <circle cx="350" cy="350" r="340" fill="none" stroke={C.ice} strokeWidth="0.3" strokeDasharray="3 12" />
      </svg>

      {/* Mars 3D sphere with approach animation */}
      <div
        style={{
          animation: marsReady ? 'marsApproach 1.5s cubic-bezier(0.22,1,0.36,1) forwards' : 'none',
          opacity: marsReady ? undefined : 0,
          marginBottom: 48,
        }}
      >
        <Mars3DPlaceholder size={280} />
      </div>

      {/* Pulse ring behind Mars */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(50% - 100px)',
          width: 300,
          height: 300,
          borderRadius: '50%',
          border: '2px solid rgba(199,91,57,0.2)',
          animation: 'pulse-ring 3s ease-out infinite',
        }}
      />

      {/* Title + subtitle + CTA */}
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <h1
          style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 56,
            fontWeight: 900,
            letterSpacing: 8,
            color: C.ice,
            opacity: showTitle ? 1 : 0,
            transform: showTitle ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 1s cubic-bezier(0.22,1,0.36,1)',
            margin: 0,
            textShadow: '0 0 60px rgba(199,91,57,0.3)',
          }}
        >
          ARESVISION
        </h1>

        <div
          style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 18,
            fontWeight: 500,
            letterSpacing: 12,
            color: C.mars,
            marginTop: 8,
            opacity: showTitle ? 1 : 0,
            transform: showTitle ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 1s cubic-bezier(0.22,1,0.36,1) 0.2s',
          }}
        >
          智 绘 赤 星
        </div>

        <p
          style={{
            marginTop: 32,
            fontSize: 16,
            color: C.ice60,
            lineHeight: 1.8,
            maxWidth: 580,
            opacity: showSub ? 1 : 0,
            transform: showSub ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.8s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          基于 PredRNNv2 深度学习框架的火星臭氧柱浓度预测与可视化系统
          <br />
          <span style={{ color: C.ice30, fontSize: 13 }}>
            Mars Ozone Column Prediction &amp; Visualization — Powered by OpenMARS &amp; MCD 6.1
          </span>
        </p>

        {/* CTA Buttons */}
        <div
          style={{
            marginTop: 40,
            display: 'flex',
            gap: 16,
            justifyContent: 'center',
            opacity: showButtons ? 1 : 0,
            transform: showButtons ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.8s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          <button
            onClick={() => onNavigate('explore')}
            style={{
              background: `linear-gradient(135deg, ${C.mars}, ${C.marsLight})`,
              border: 'none',
              borderRadius: 12,
              padding: '14px 36px',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "'Orbitron', sans-serif",
              letterSpacing: 2,
              cursor: 'pointer',
              boxShadow: '0 4px 24px rgba(199,91,57,0.4)',
            }}
          >
            开始探索
          </button>
          <button
            onClick={() => onNavigate('predict')}
            style={{
              background: 'transparent',
              border: `1px solid ${C.ice30}`,
              borderRadius: 12,
              padding: '14px 36px',
              color: C.ice,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "'Exo 2', sans-serif",
              letterSpacing: 1,
              cursor: 'pointer',
            }}
          >
            预测分析 →
          </button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          opacity: showButtons ? 0.4 : 0,
          transition: 'opacity 1s',
          animation: 'float 3s ease-in-out infinite',
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: 3, color: C.ice60, fontFamily: "'Orbitron', sans-serif" }}>SCROLL</div>
        <div style={{ width: 1, height: 30, background: `linear-gradient(180deg, ${C.ice30}, transparent)` }} />
      </div>

      {/* Feature cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginTop: 80,
          width: '100%',
          maxWidth: 1000,
          opacity: showButtons ? 1 : 0,
          transition: 'opacity 1s 0.5s',
        }}
      >
        {features.map((f, i) => (
          <GlowCard key={i} style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.ice, marginBottom: 6, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>
              {f.title}
            </div>
            <div style={{ fontSize: 12, color: C.ice60, lineHeight: 1.6 }}>{f.desc}</div>
          </GlowCard>
        ))}
      </div>
    </div>
  );
}
