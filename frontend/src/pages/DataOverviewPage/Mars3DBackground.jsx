import React, { forwardRef, useMemo } from 'react';
import SphericalFieldCanvas from '../../components/SphericalFieldCanvas';

const Mars3DBackground = forwardRef(({ ozoneData, is3DMode, autoRotate }, ref) => {
  const fieldData = useMemo(() => {
    if (!ozoneData?.points?.length) return null;
    const lats = [...new Set(ozoneData.points.map(p => Math.round(p.lat * 10) / 10))].sort((a, b) => b - a);
    const lngs = [...new Set(ozoneData.points.map(p => {
      let l = Math.round(p.lng * 10) / 10;
      return (l + 360) % 360;
    }))].sort((a, b) => a - b);

    const nLat = lats.length;
    const nLon = lngs.length;
    const field = Array(nLat).fill(0).map(() => Array(nLon).fill(NaN));

    ozoneData.points.forEach(p => {
      const lat = Math.round(p.lat * 10) / 10;
      const lng = ((Math.round(p.lng * 10) / 10) + 360) % 360;
      const i = lats.indexOf(lat);
      const j = lngs.indexOf(lng);
      if (i >= 0 && j >= 0) {
        field[i][j] = p.val;
      }
    });

    return {
      field,
      minVal: ozoneData.minVal,
      maxVal: ozoneData.maxVal
    };
  }, [ozoneData]);

  if (!fieldData) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: is3DMode ? 10 : 1,
      opacity: is3DMode ? 1 : 0.6,
      transition: 'all 0.8s ease',
      pointerEvents: is3DMode ? 'auto' : 'none',
    }}>
      <SphericalFieldCanvas
        ref={ref}
        fieldData={fieldData}
        colorMode="inferno"
        h="100vh"
        forceFullscreen
        autoRotate={autoRotate}
        zoom={4.5}
      />
    </div>
  );
});

export default Mars3DBackground;
