import { useState, useEffect, useRef, useCallback } from 'react';
import C from '../constants/colors';
import { useT } from '../i18n';
import { DataOverviewProvider } from '../contexts/DataOverviewContext';
import { fetchGlobeData } from '../services/api';
import useHandTracking from '../hooks/useHandTracking';

// Sub-components
import SidebarMenu, { DATA_OPTION_DEFS } from './DataOverviewPage/SidebarMenu';
import Globe3DControls from './DataOverviewPage/Globe3DControls';
import DetailPanel from './DataOverviewPage/DetailPanel';
import Mars3DBackground from './DataOverviewPage/Mars3DBackground';

const DataOverviewPageContent = () => {
  const t = useT();
  const [ozoneData, setOzoneData] = useState({ points: [], minVal: 0, maxVal: 1 });
  const [loadingGlobe, setLoadingGlobe] = useState(false);
  const [selectedItem, setSelectedItem] = useState(DATA_OPTION_DEFS[0]);
  const [marsYear, setMarsYear] = useState(27);
  const [lsValue, setLsValue] = useState(90);
  const [playing, setPlaying] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [gestureEnabled, setGestureEnabled] = useState(false);

  const timerRef = useRef(null);
  const abortRef = useRef(null);
  const globeCanvasRef = useRef(null);
  const landmarksCanvasRef = useRef(null);

  const is3DMode = selectedItem?.is3D;

  const { videoRef, error: gestureError, setOnGesture, setOnLandmarks } = useHandTracking(gestureEnabled && is3DMode);

  useEffect(() => {
    setOnGesture((gesture) => {
      if (!globeCanvasRef.current) return;
      if (gesture.type === 'rotate') {
        globeCanvasRef.current.applyGestureRotation(gesture.dx, gesture.dy);
      } else if (gesture.type === 'zoom') {
        globeCanvasRef.current.applyGestureZoom(gesture.dDist);
      }
    });
  }, [setOnGesture]);

  useEffect(() => {
    setOnLandmarks((landmarks) => {
      const canvas = landmarksCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!landmarks || landmarks.length === 0) return;

      ctx.fillStyle = C.mars;
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;

      for (const hand of landmarks) {
        for (const point of hand) {
          ctx.beginPath();
          ctx.arc(point.x * canvas.width, point.y * canvas.height, 3, 0, 2 * Math.PI);
          ctx.fill();
        }

        const drawLine = (p1, p2) => {
          ctx.beginPath();
          ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
          ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
          ctx.stroke();
        };

        if (hand[0] && hand[5]) drawLine(hand[0], hand[5]); 
        if (hand[0] && hand[9]) drawLine(hand[0], hand[9]); 
        if (hand[0] && hand[13]) drawLine(hand[0], hand[13]); 
        if (hand[0] && hand[17]) drawLine(hand[0], hand[17]); 
        if (hand[5] && hand[9]) drawLine(hand[5], hand[9]);
        if (hand[9] && hand[13]) drawLine(hand[9], hand[13]);
        if (hand[13] && hand[17]) drawLine(hand[13], hand[17]);
      }
    });
  }, [setOnLandmarks]);

  const loadGlobe = useCallback(async (ls, year) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoadingGlobe(true);
    try {
      const d = await fetchGlobeData(year, ls, ctrl.signal);
      if (!ctrl.signal.aborted) {
        setOzoneData({
          points: d.points || [],
          minVal: d.minVal ?? 0,
          maxVal: d.maxVal ?? 1,
        });
        setLoadingGlobe(false);
      }
    } catch (e) {
      if (!ctrl.signal.aborted) {
        console.error('Globe data error:', e);
        setLoadingGlobe(false);
      }
    }
  }, []);

  useEffect(() => {
    loadGlobe(lsValue, marsYear);
  }, [lsValue, marsYear, loadGlobe]);

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setLsValue(v => {
          if (v >= 355) { setPlaying(false); return 0; }
          return v + 5;
        });
      }, 600);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [playing]);

  return (
    <div className="space-scene panel-dark" style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <Mars3DBackground
        ref={globeCanvasRef}
        ozoneData={ozoneData}
        is3DMode={is3DMode}
        autoRotate={autoRotate}
      />

      {is3DMode && gestureEnabled && (
        <div style={{
          position: 'fixed', bottom: '20px', left: '310px', width: '240px', height: '180px',
          zIndex: 2000, borderRadius: '12px', overflow: 'hidden', border: `2px solid ${C.mars}`,
          boxShadow: `0 0 20px rgba(255,107,53,0.3)`, background: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.5 }}>
            <video
              ref={videoRef}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              playsInline
              muted
            />
          </div>
          <canvas
            ref={landmarksCanvasRef}
            width={240}
            height={180}
            style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 2, transform: 'scaleX(-1)' }}
          />
          <div style={{
            position: 'absolute', top: '8px', left: '8px', background: 'rgba(0,0,0,0.6)',
            padding: '2px 8px', borderRadius: '4px', color: C.mars, fontSize: '10px',
            fontFamily: 'Orbitron', zIndex: 3, border: `1px solid ${C.mars}`
          }}>
            {t('overview.controls.cameraTracking')}
          </div>
        </div>
      )}

      <SidebarMenu selectedItem={selectedItem} onItemSelect={setSelectedItem} />

      <DetailPanel
        selectedItem={selectedItem}
        marsYear={marsYear}
        lsValue={lsValue}
        ozoneData={ozoneData}
      />

      {is3DMode && (
        <Globe3DControls
          ozoneData={ozoneData}
          lsValue={lsValue}
          marsYear={marsYear}
          playing={playing}
          autoRotate={autoRotate}
          gestureEnabled={gestureEnabled}
          loadingGlobe={loadingGlobe}
          onLsChange={setLsValue}
          onMarsYearChange={setMarsYear}
          onTogglePlay={() => setPlaying(p => !p)}
          onToggleAutoRotate={() => setAutoRotate(r => !r)}
          onToggleGesture={() => setGestureEnabled(g => !g)}
        />
      )}
    </div>
  );
};

export default function DataOverviewPage() {
  return (
    <DataOverviewProvider>
      <DataOverviewPageContent />
    </DataOverviewProvider>
  );
}
