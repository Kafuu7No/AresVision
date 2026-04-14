import React, { forwardRef, useMemo } from 'react';
import SphericalFieldCanvas from '../../components/SphericalFieldCanvas';

const Mars3DBackground = forwardRef(({ ozoneData, is3DMode, autoRotate, leftPanelWidth, rightPanelWidth, onGlobeClick }, ref) => {
  const fieldData = useMemo(() => {
    if (!ozoneData?.points?.length) return null;
    const latSet = new Set();
    const lngSet = new Set();
    
    ozoneData.points.forEach(p => {
      latSet.add(Math.round(p.lat * 10) / 10);
      lngSet.add((Math.round(p.lng * 10) / 10 + 360) % 360);
    });
    
    const lats = [...latSet].sort((a, b) => b - a);
    const lngs = [...lngSet].sort((a, b) => a - b);

    const latIdxMap = new Map();
    lats.forEach((lat, idx) => latIdxMap.set(lat, idx));
    
    const lngIdxMap = new Map();
    lngs.forEach((lng, idx) => lngIdxMap.set(lng, idx));

    const nLat = lats.length;
    const nLon = lngs.length;
    const field = Array(nLat).fill(0).map(() => Array(nLon).fill(NaN));

    ozoneData.points.forEach(p => {
      const lat = Math.round(p.lat * 10) / 10;
      const lng = ((Math.round(p.lng * 10) / 10) + 360) % 360;
      const i = latIdxMap.get(lat);
      const j = lngIdxMap.get(lng);
      if (i !== undefined && j !== undefined) {
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
      position: 'absolute', // Modified to absolute to fit HUD container
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
        zoom={3.75} // reduce initial globe size by ~1/3 (visual size becomes ~2/3)
        offsetX={(rightPanelWidth - leftPanelWidth) / 2} // shift object to center it in remaining viewport space
        onGlobeClick={onGlobeClick}
      />
    </div>
  );
});

export default Mars3DBackground;
