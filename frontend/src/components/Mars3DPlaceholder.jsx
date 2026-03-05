/**
 * CSS-only 旋转火星球体占位符
 * 后续会替换为 react-globe.gl 或 Three.js 实现
 */
export default function Mars3DPlaceholder({ size = 320 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background:
          'radial-gradient(circle at 35% 35%, #e8845a 0%, #c75b39 30%, #8b3a25 60%, #4a1a0f 90%)',
        boxShadow: `
          inset -30px -20px 40px rgba(0,0,0,0.6),
          inset 10px 10px 30px rgba(232,132,90,0.3),
          0 0 80px rgba(199,91,57,0.3),
          0 0 160px rgba(199,91,57,0.1)
        `,
        animation: 'spin-slow 30s linear infinite',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Surface features */}
      <div
        style={{
          position: 'absolute',
          width: '30%',
          height: '15%',
          top: '35%',
          left: '20%',
          borderRadius: '50%',
          background: 'rgba(139,58,37,0.5)',
          filter: 'blur(8px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '20%',
          height: '25%',
          top: '50%',
          left: '55%',
          borderRadius: '50%',
          background: 'rgba(74,26,15,0.4)',
          filter: 'blur(10px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '12%',
          height: '12%',
          top: '25%',
          left: '60%',
          borderRadius: '50%',
          background: 'rgba(232,132,90,0.3)',
          filter: 'blur(6px)',
        }}
      />
      {/* Atmosphere glow ring */}
      <div
        style={{
          position: 'absolute',
          inset: -6,
          borderRadius: '50%',
          border: '1px solid rgba(232,132,90,0.15)',
          boxShadow: '0 0 40px rgba(199,91,57,0.08)',
        }}
      />
    </div>
  );
}
