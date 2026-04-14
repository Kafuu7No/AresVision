import { useState, useEffect, useRef, useCallback } from 'react';
import C from '../constants/colors';
import { useT } from '../i18n';
import { DataOverviewProvider, useDataOverview } from '../contexts/DataOverviewContext';
import { fetchGlobeData } from '../services/api';
import useHandTracking from '../hooks/useHandTracking';

// Sub-components
import TopStatusBar from './DataOverviewPage/TopStatusBar';
import SidebarMenu from './DataOverviewPage/SidebarMenu';
import DetailPanel from './DataOverviewPage/DetailPanel';
import Mars3DBackground from './DataOverviewPage/Mars3DBackground';
import TimelineController from './DataOverviewPage/TimelineController';
import AICopilotWidget from './DataOverviewPage/AICopilotWidget'; 
import GlobeLegend from './DataOverviewPage/GlobeLegend';

const DataOverviewPageContent = () => {
  const t = useT();
  const { 
    marsYear, 
    globalTimeLs, setGlobalTimeLs, 
    isPlayingTimeline, setIsPlayingTimeline,
    setSelectedCoordinate,
    autoRotate,
    gestureEnabled,
    globeVariable,
    leftPanelWidth,
    rightPanelWidth
  } = useDataOverview();

  const [ozoneData, setOzoneData] = useState({ points: [], minVal: 0, maxVal: 1, variable: 'o3col' });
  const [loadingGlobe, setLoadingGlobe] = useState(false);

  const timerRef = useRef(null);
  const abortRef = useRef(null);
  const globeCanvasRef = useRef(null);
  const landmarksCanvasRef = useRef(null);

  const { videoRef, error: gestureError, setOnGesture, setOnLandmarks } = useHandTracking(gestureEnabled);

  // Keep gesture capture window compact to reduce scene occlusion.
  const GESTURE_WINDOW_WIDTH = 190;
  const GESTURE_WINDOW_HEIGHT = 142;

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

  const loadGlobe = useCallback(async (ls, year, variable) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoadingGlobe(true);
    try {
      const d = await fetchGlobeData(year, ls, variable, ctrl.signal);
      if (!ctrl.signal.aborted) {
        setOzoneData({
          points: d.points || [],
          minVal: d.minVal ?? 0,
          maxVal: d.maxVal ?? 1,
          variable: d.variable || variable || 'o3col',
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
    loadGlobe(globalTimeLs, marsYear, globeVariable);
  }, [globalTimeLs, marsYear, globeVariable, loadGlobe]);

  useEffect(() => {
    if (isPlayingTimeline) {
      timerRef.current = setInterval(() => {
        setGlobalTimeLs(v => {
          if (v >= 355) { setIsPlayingTimeline(false); return 0; }
          return v + 5;
        });
      }, 600);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlayingTimeline, setGlobalTimeLs, setIsPlayingTimeline]);

  return (
    <div className="space-scene" style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      
      {/* 绝对底层的 3D 背景 */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <Mars3DBackground
          ref={globeCanvasRef}
          ozoneData={ozoneData}
          is3DMode={true}
          autoRotate={autoRotate}
          leftPanelWidth={leftPanelWidth}
          rightPanelWidth={rightPanelWidth}
          onGlobeClick={(coord) => setSelectedCoordinate(coord)}
        />
      </div>

      {gestureEnabled && (
        <div style={{
          position: 'fixed',
          bottom: '116px',
          left: `${leftPanelWidth + 46}px`,
          width: `${GESTURE_WINDOW_WIDTH}px`,
          height: `${GESTURE_WINDOW_HEIGHT}px`,
          zIndex: 2000,
          borderRadius: '10px',
          overflow: 'hidden',
          border: `2px solid ${C.mars}`,
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
            width={GESTURE_WINDOW_WIDTH}
            height={GESTURE_WINDOW_HEIGHT}
            style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 2, transform: 'scaleX(-1)' }}
          />
          <div style={{
            position: 'absolute', top: '8px', left: '8px', background: 'rgba(0,0,0,0.6)',
            padding: '2px 7px', borderRadius: '4px', color: C.mars, fontSize: '9px',
            fontFamily: 'Orbitron', zIndex: 3, border: `1px solid ${C.mars}`
          }}>
            {t('overview.controls.cameraTracking')}
          </div>
        </div>
      )}

      {/* HUD UI 层 */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 100, pointerEvents: 'none' }}>
        
        <div style={{ pointerEvents: 'auto' }}>
          <TopStatusBar />
        </div>

        <div style={{ pointerEvents: 'auto' }}>
          <SidebarMenu />
        </div>

        <div style={{ pointerEvents: 'auto' }}>
          <DetailPanel ozoneData={ozoneData} />
        </div>

        <div style={{ pointerEvents: 'auto' }}>
          <TimelineController />
        </div>
        
        <div style={{ pointerEvents: 'auto' }}>
          <AICopilotWidget />
        </div>

        <div style={{ pointerEvents: 'auto' }}>
          <GlobeLegend ozoneData={ozoneData} />
        </div>
      </div>

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
