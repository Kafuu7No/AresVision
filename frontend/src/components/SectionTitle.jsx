import C from '../constants/colors';

/**
 * 页面区块标题组件
 * Props: title (中文), subtitle (英文/标签), align
 */
export default function SectionTitle({ title, subtitle, align = 'left' }) {
  return (
    <div style={{ textAlign: align, marginBottom: 32 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 4,
          color: C.mars,
          textTransform: 'uppercase',
          fontFamily: "'Orbitron', sans-serif",
          marginBottom: 8,
        }}
      >
        {subtitle}
      </div>
      <h2
        style={{
          fontSize: 32,
          fontWeight: 700,
          fontFamily: "'Orbitron', sans-serif",
          color: C.ice,
          margin: 0,
          lineHeight: 1.3,
        }}
      >
        {title}
      </h2>
    </div>
  );
}
