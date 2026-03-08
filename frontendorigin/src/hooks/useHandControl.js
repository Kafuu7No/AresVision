// d:\A-development-project\MarsGemini\frontend\src\hooks\useHandControl.js

import { useState, useEffect, useRef } from 'react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

export const useHandControl = (globeEl) => {
    const webcamRef = useRef(null);
    const [gestureStatus, setGestureStatus] = useState("等待手势...");
    
    // 内部状态 Refs
    const prevHandPos = useRef({ x: null, y: null });
    const handsRef = useRef(null);
    const cameraRef = useRef(null);

    // 1. 初始化 MediaPipe Hands
    useEffect(() => {
        const hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            },
        });

        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        hands.onResults(onResults);
        handsRef.current = hands;

        return () => {
            hands.close();
        };
    }, []);

    // 2. 初始化摄像头
    useEffect(() => {
        const startCamera = () => {
            if (webcamRef.current && webcamRef.current.video && handsRef.current) {
                const camera = new Camera(webcamRef.current.video, {
                    onFrame: async () => {
                        if (webcamRef.current && webcamRef.current.video) {
                            await handsRef.current.send({ image: webcamRef.current.video });
                        }
                    },
                    width: 320,
                    height: 240,
                });
                camera.start();
                cameraRef.current = camera;
            } else {
                setTimeout(startCamera, 100);
            }
        };

        startCamera();

        return () => {
            if (cameraRef.current) {
                cameraRef.current.stop();
                cameraRef.current = null;
            }
        };
    }, []);

    // 3. 手势处理核心逻辑
    const onResults = (results) => {
        if (!globeEl.current) return;

        // 状态 A: 检测到手
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            const indexFinger = landmarks[8]; // 食指
            const thumb = landmarks[4];       // 拇指

            // 计算捏合距离
            const pinchDistance = Math.sqrt(
                Math.pow(indexFinger.x - thumb.x, 2) + 
                Math.pow(indexFinger.y - thumb.y, 2)
            );

            const isPinching = pinchDistance < 0.05;
            const currentPov = globeEl.current.pointOfView();
            let newLng = currentPov.lng;
            let newLat = currentPov.lat;
            let newAlt = currentPov.altitude;

            if (isPinching) {
                // === 缩放模式 ===
                if (prevHandPos.current.y !== null) {
                    const deltaY = indexFinger.y - prevHandPos.current.y;
                    const zoomSpeed = 3.0; 
                    newAlt = Math.max(0.5, Math.min(4.0, currentPov.altitude + (deltaY * zoomSpeed)));
                    
                    globeEl.current.pointOfView({ altitude: newAlt }, 0);
                    setGestureStatus("🔍 缩放模式 | ↕️ 上下移动手");
                }
            } else {
                // === 旋转模式 ===
                if (prevHandPos.current.x !== null && prevHandPos.current.y !== null) {
                    const deltaX = indexFinger.x - prevHandPos.current.x;
                    const deltaY = indexFinger.y - prevHandPos.current.y;
                    const sensitivity = 100;

                    if (Math.abs(deltaX) > 0.002 || Math.abs(deltaY) > 0.002) {
                        globeEl.current.controls().autoRotate = false;
                        newLng = currentPov.lng + (deltaX * sensitivity);
                        newLat = Math.max(-90, Math.min(90, currentPov.lat + (deltaY * sensitivity)));

                        globeEl.current.pointOfView({ lng: newLng, lat: newLat }, 0);
                        setGestureStatus("🌍 旋转模式 | 🖐️ 随意拖拽");
                    } else {
                        setGestureStatus("✋ 待机中...");
                    }
                }
            }
            prevHandPos.current = { x: indexFinger.x, y: indexFinger.y };
        } else {
            // 状态 B: 没手 -> 重置
            prevHandPos.current = { x: null, y: null };
            if (globeEl.current.controls().autoRotate === false) {
                globeEl.current.controls().autoRotate = true;
                setGestureStatus("等待手势...");
            }
        }
    };

    return { webcamRef, gestureStatus };
};
