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
          fontSize: 'calc(12px * var(--font-scale, 1))',
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: C.mars,
          textTransform: 'uppercase',
          fontFamily: 'var(--font-body)',
          marginBottom: 8,
        }}
      >
        {subtitle}
      </div>
      <h2
        style={{
          fontSize: 'calc(32px * var(--font-scale, 1))',
          fontWeight: 800,
          fontFamily: 'var(--font-display)',
          color: C.ice,
          margin: 0,
          lineHeight: 1.2,
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h2>
    </div>
  );
}
