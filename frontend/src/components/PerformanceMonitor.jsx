import { useEffect, useRef } from 'react';
import Stats from 'stats.js';

/**
 * 实时性能监控面板
 * 显示三个面板：FPS (0)、渲染耗时 MS (1)、内存 MB (2, Chrome only)
 *
 * Props:
 *   visible: boolean — 是否显示
 */
export default function PerformanceMonitor({ visible }) {
  const containerRef = useRef(null);
  const cleanupRef = useRef(null);

  useEffect(() => {
    if (!visible) return;

    const container = containerRef.current;
    if (!container) return;

    const statsList = [0, 1, 2].map(panelId => {
      const stats = new Stats();
      stats.showPanel(panelId);
      stats.dom.style.position = 'relative';
      stats.dom.style.display = 'inline-block';
      stats.dom.style.transform = 'scale(0.85)';
      stats.dom.style.transformOrigin = 'top left';
      stats.dom.style.marginRight = '2px';
      container.appendChild(stats.dom);
      return stats;
    });

    let rafId;
    function animate() {
      statsList.forEach(s => { s.begin(); s.end(); });
      rafId = requestAnimationFrame(animate);
    }
    rafId = requestAnimationFrame(animate);

    cleanupRef.current = () => {
      cancelAnimationFrame(rafId);
      statsList.forEach(s => {
        if (s.dom?.parentNode) s.dom.parentNode.removeChild(s.dom);
      });
    };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: 76,
        bottom: 24,
        zIndex: 1490,
        display: 'flex',
        gap: 2,
        opacity: 0.9,
        borderRadius: 4,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    />
  );
}
