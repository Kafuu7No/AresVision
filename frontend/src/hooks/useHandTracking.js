import { useState, useEffect, useRef, useCallback } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function useHandTracking(enabled = false) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const handLandmarkerRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const requestRef = useRef(null);

  // 回调 refs，避免闭包陷阱
  const onGestureCb = useRef(null);
  const onLandmarksCb = useRef(null);

  // 状态变量，用于计算相对增量
  const lastState = useRef({
    x: null,
    y: null,
    dist: null,
    activeHands: 0,
    timestamp: 0,
  });

  // 暴露设置回调的方法
  const setOnGesture = useCallback((cb) => {
    onGestureCb.current = cb;
  }, []);

  const setOnLandmarks = useCallback((cb) => {
    onLandmarksCb.current = cb;
  }, []);

  // 1. 初始化 MediaPipe HandLandmarker
  useEffect(() => {
    let active = true;
    const initTask = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2, // 最多识别两只手
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        if (active) {
          handLandmarkerRef.current = handLandmarker;
          setIsReady(true);
        }
      } catch (err) {
        if (active) {
          console.error("Failed to initialize hand landmarker:", err);
          setError("手势识别引擎初始化失败: " + err.message);
        }
      }
    };
    initTask();
    
    return () => {
      active = false;
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
      }
    };
  }, []);

  // 2. 视频流捕捉与处理
  useEffect(() => {
    if (!enabled || !isReady || error) return;

    let isVideoPlaying = false;
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    videoRef.current = video;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" }
        });
        video.srcObject = stream;
        streamRef.current = stream;

        video.addEventListener('loadeddata', () => {
          isVideoPlaying = true;
          predictWebcam();
        });
      } catch (err) {
        console.error("Camera error:", err);
        setError("无法访问摄像头: " + err.message);
      }
    };

    let lastVideoTime = -1;
    const predictWebcam = async () => {
      if (!handLandmarkerRef.current || !isVideoPlaying) return;

      const currentTimeInMs = performance.now();
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        // 检测手势
        const results = handLandmarkerRef.current.detectForVideo(video, currentTimeInMs);
        
        // 传递渲染用原始关键点坐标
        if (onLandmarksCb.current) {
          onLandmarksCb.current(results.landmarks);
        }

        processGestures(results);
      }
      
      requestRef.current = requestAnimationFrame(predictWebcam);
    };

    const processGestures = (results) => {
      const state = lastState.current;
      const hands = results.landmarks;

      if (!hands || hands.length === 0) {
         // 无手：重置历史状态
         state.x = null;
         state.y = null;
         state.dist = null;
         state.activeHands = 0;
         return;
      }

      if (hands.length === 1) {
         // 单手模式：平移旋转
         // 计算手掌中心点算作整体位移参考点（这里取手腕(0) 到 中指指根(9) 的中点近似）
         const hand = hands[0];
         const cx = (hand[0].x + hand[9].x) / 2;
         const cy = (hand[0].y + hand[9].y) / 2;

         if (state.activeHands === 1 && state.x !== null) {
            // 计算相对移动增量 (注意摄像头 X 是镜像的，为了自然操作感可能需要翻转)
            const dx = -(cx - state.x); 
            const dy = (cy - state.y);

            // 过滤抖动
            if (Math.abs(dx) > 0.005 || Math.abs(dy) > 0.005) {
                if (onGestureCb.current) {
                   onGestureCb.current({ type: 'rotate', dx, dy });
                }
            }
         }
         state.x = cx;
         state.y = cy;
         state.dist = null;
         state.activeHands = 1;

      } else if (hands.length === 2) {
         // 双手模式：计算两手距离缩放
         const hand1 = hands[0];
         const hand2 = hands[1];
         
         const h1cx = (hand1[0].x + hand1[9].x) / 2;
         const h1cy = (hand1[0].y + hand1[9].y) / 2;
         
         const h2cx = (hand2[0].x + hand2[9].x) / 2;
         const h2cy = (hand2[0].y + hand2[9].y) / 2;

         const currentDist = Math.hypot(h1cx - h2cx, h1cy - h2cy);

         if (state.activeHands === 2 && state.dist !== null) {
            const dDist = currentDist - state.dist;
            
            // 过滤抖动
            if (Math.abs(dDist) > 0.01) {
                if (onGestureCb.current) {
                   onGestureCb.current({ type: 'zoom', dDist });
                }
            }
         }
         state.x = null;
         state.y = null;
         state.dist = currentDist;
         state.activeHands = 2;
      }
    };

    startCamera();

    return () => {
      // 停止视频分析循环
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      
      isVideoPlaying = false;
      
      // 停止摄像头流
      if (streamRef.current) {
         streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
         videoRef.current.srcObject = null;
      }
      
      // 重置历史状态
      lastState.current = { x: null, y: null, dist: null, activeHands: 0 };
    };
  }, [enabled, isReady, error]);

  return {
    isReady,
    error,
    videoRef, // 如果想要外部看到摄像头画面，可以使用这个 ref，但通常我们会额外绘制关键点，所以对外导出一个绘制组件更合适
    setOnGesture,
    setOnLandmarks
  };
}
