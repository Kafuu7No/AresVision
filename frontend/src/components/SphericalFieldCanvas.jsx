import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { getRgb, rdbuRgb } from '../utils/colormaps';
import { useSettings } from '../contexts/SettingsContext';

// --- 全局缓存贴图 ---
let cachedMarsTexture = null;
let cachedCircleTexture = null;

// ─── 辅助函数：二维数组双线性插值 ───
function bilinearInterpolate(field, liFloat, ljFloat) {
  const nLat = field.length;
  const nLon = field[0].length;

  // 经度水平方向由于是球面，前后相接
  let j0 = Math.floor(ljFloat);
  let j1 = j0 + 1;
  const dj = ljFloat - j0;
  // 经度循环
  j0 = ((j0 % nLon) + nLon) % nLon;
  j1 = ((j1 % nLon) + nLon) % nLon;

  // 纬度方向不循环，做截断
  let i0 = Math.floor(liFloat);
  let i1 = i0 + 1;
  const di = liFloat - i0;
  i0 = Math.max(0, Math.min(nLat - 1, i0));
  i1 = Math.max(0, Math.min(nLat - 1, i1));

  const val00 = field[i0][j0];
  const val01 = field[i0][j1];
  const val10 = field[i1][j0];
  const val11 = field[i1][j1];

  // 这里假设无效数据用 NaN 表示
  if (isNaN(val00) || isNaN(val01) || isNaN(val10) || isNaN(val11)) return NaN;

  const row0 = val00 * (1 - dj) + val01 * dj;
  const row1 = val10 * (1 - dj) + val11 * dj;
  return row0 * (1 - di) + row1 * di;
}

const SphericalFieldCanvas = forwardRef(({ fieldData, colorMode = 'inferno', h = 240, forceFullscreen = false, autoRotate = true }, ref) => {
  const { settings } = useSettings();
  const isLight = settings.theme === 'light';
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sphereMeshRef = useRef(null);
  const particlesMeshRef = useRef(null); // 新增针对外层臭氧点云的引用维护
  const controlsRef = useRef(null);
  const autoRotateRef = useRef(autoRotate);
  const starMeshRef = useRef(null);

  // Expose imperative API for gesture control
  useImperativeHandle(ref, () => ({
    applyGestureRotation: (dx, dy) => {
      if (sphereMeshRef.current && cameraRef.current) {
        // 模型旋转：不要直接修改固定的 Euler 旋转（会产生万向节锁或方向反转）
        // 改为绕着相机空间内的世界轴（Up和Right）进行旋转
        // 放大倍率提高体验灵敏度
        
        // 算出相机在世界空间中的向上和向右向量
        const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(cameraRef.current.quaternion).normalize();
        const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraRef.current.quaternion).normalize();

        // 绕着视角的Y（Up）轴左右转，绕X（Right）轴上下转
        sphereMeshRef.current.rotateOnWorldAxis(cameraUp, dx * 3.0);
        sphereMeshRef.current.rotateOnWorldAxis(cameraRight, dy * 3.0);
      }
    },
    applyGestureZoom: (dDist) => {
      if (cameraRef.current) {
         // 向内捏合变小 (-dDist): 视距变大 (离远); 向外张开 (+dDist): 视距变小 (凑近)
         const step = -dDist * 8.0; 
         
         // 因为用户可能用鼠标（TrackballControls）转动过视角，相机的坐标不再是在纯正的 Z 轴上
         // 正确做法是直接缩放相机所在坐标向量的长度（维持到原点方向不变）
         const currentDist = cameraRef.current.position.length();
         const newDist = Math.max(1.2, Math.min(12.0, currentDist + step));
         cameraRef.current.position.setLength(newDist);
      }
    }
  }));

  // Update ref when prop changes so animation loop catches it
  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  const sceneRef = useRef(null);
  const cameraRef = useRef(null);

  // 1. 初始化 Three.js 场景、相机、渲染器和控制器（仅执行一次）
  useEffect(() => {
    if (!containerRef.current) return;

    // 清理可能存在的旧 Canvas
    containerRef.current.innerHTML = '';

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new TrackballControls(camera, renderer.domElement);
    controls.rotateSpeed = 3.0; // 适当降低些旋转的抽搐
    controls.zoomSpeed = 0.5; // 降低缩放灵敏度
    controls.panSpeed = 0.2; // 显著降低右键平移的灵敏度
    controls.noZoom = false;
    // 禁止右键平移，固定球体在这个中心位置
    controls.noPan = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.ZOOM,
    };
    controls.staticMoving = false; // true可以去掉阻尼
    controls.dynamicDampingFactor = 0.15; // 阻尼系数

    // 让球体固定在画面中央
    controls.target.set(0, 0, 0);

    controlsRef.current = controls;

    // 光照对于 Points 材质不生效，但可用于内部火星球体
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 3, 5);
    scene.add(dirLight);

    // --- 背景星星特效（恒定不变，在此初始化）---
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 500;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      // 随机散布在半宽 10 的立方体内，挖空中间半径 2 的核心（避免挡住主星）
      let r = 2.5 + Math.random() * 8.0;
      let theta = Math.random() * Math.PI * 2;
      let phi = Math.acos(2 * Math.random() - 1);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);

      starPositions[i * 3] = x;
      starPositions[i * 3 + 1] = y;
      starPositions[i * 3 + 2] = z;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.02,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
    starMeshRef.current = stars;

    let reqId;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (sphereMeshRef.current && autoRotateRef.current) {
        sphereMeshRef.current.rotateY(0.001); // 绕模型本身的极点（局部 Y 轴）自转，即使手势倾斜了球体也始终按纬度线旋转
      }
      stars.rotateY(0.0003); // 星空背景微弱伴走
      if (rendererRef.current) rendererRef.current.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h2 = containerRef.current.clientHeight;
      camera.aspect = w / h2;
      camera.updateProjectionMatrix();
      if (controlsRef.current) {
        controlsRef.current.handleResize();
      }
      rendererRef.current.setSize(w, h2);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(reqId);
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      starGeometry.dispose();
      starMaterial.dispose();
    };
  }, [forceFullscreen]); // 仅在尺寸模式切换时重新初始化控制台

  // 主题变化：更新场景背景色和星星可见性
  useEffect(() => {
    if (!sceneRef.current) return;
    if (isLight) {
      sceneRef.current.background = new THREE.Color(0xf5f6f8);
    } else {
      sceneRef.current.background = null;
    }
    if (starMeshRef.current) {
      starMeshRef.current.visible = !isLight;
    }
  }, [isLight]);

  // 2. 响应数据更新，重建臭氧场网格（保持火星本身及分组姿态不变）
  useEffect(() => {
    if (!fieldData?.field || !sceneRef.current) return;
    const scene = sceneRef.current;

    // 第一次时，创建球体组和内部火星
    if (!sphereMeshRef.current) {
      const globeGroup = new THREE.Group();
      globeGroup.rotation.y = -Math.PI / 2;
      scene.add(globeGroup);
      sphereMeshRef.current = globeGroup;

      const marsRadius = 0.86;
      const marsGeometry = new THREE.SphereGeometry(marsRadius, 64, 64);
      if (!cachedMarsTexture) {
        cachedMarsTexture = new THREE.TextureLoader().load('/mars_texture.jpg');
      }
      const marsMaterial = new THREE.MeshPhongMaterial({
        map: cachedMarsTexture,
        shininess: 5,
      });
      const marsMesh = new THREE.Mesh(marsGeometry, marsMaterial);
      globeGroup.add(marsMesh);
    }

    const globeGroup = sphereMeshRef.current;

    // 清理旧的粒子网格
    if (particlesMeshRef.current) {
      globeGroup.remove(particlesMeshRef.current);
      if (particlesMeshRef.current.geometry) particlesMeshRef.current.geometry.dispose();
      if (particlesMeshRef.current.material) particlesMeshRef.current.material.dispose();
      particlesMeshRef.current = null;
    }

    const { field, minVal, maxVal } = fieldData;
    const nLat = field.length;
    const nLon = field[0].length;

    let dMin = minVal, dMax = maxVal;
    let absMax = 0;
    if (colorMode === 'rdbu') {
      for (let li = 0; li < nLat; li++)
        for (let lj = 0; lj < nLon; lj++)
          absMax = Math.max(absMax, Math.abs(field[li][lj]));
      absMax = absMax || 1;
      dMin = -absMax;
      dMax = absMax;
    }
    const range = dMax - dMin || 1;

    // --- 构建粒子位置与颜色 ---
    const positions = [];
    const colors = [];

    // 为了让粒子球更致密，我们可以在原有的经纬度格点间做“插值散播”
    // 这里采用增加密度的抖动采样（每个真实数据格点散布一定数量的粒子）
    // 再次大幅度增加粒子的密度 (改为120)
    const particleDensity = 120;

    // 基础半径缩小至原来的四分之三 (1.2 * 0.75 = 0.9)
    const baseRadius = 0.9;

    for (let li = 0; li < nLat; li++) {
      for (let lj = 0; lj < nLon; lj++) {
        const val = field[li][lj];
        if (val == null || isNaN(val)) continue;
        const t = (val - dMin) / range;

        const rgbColor = colorMode === 'rdbu' ? rdbuRgb(t) : getRgb(settings.colormap, t);
        const rNorm = rgbColor[0] / 255;
        const gNorm = rgbColor[1] / 255;
        const bNorm = rgbColor[2] / 255;

        // 计算该格点处的高度偏移 (同样等比缩小四分之三 0.4*0.75=0.3, 0.3*0.75=0.225)
        const heightOffset = colorMode === 'rdbu' ? (t - 0.5) * 0.3 : t * 0.225;

        // 我们经纬度的实际对应关系
        // lat 取值 90(li=0) 到 -90(li=nLat-1) -> phi: 0 到 PI
        // lon 取值 0(lj=0) 到 360(lj=nLon-1) -> theta: 0 到 2PI
        const latCenter = 90 - (li / (nLat - 1)) * 180;
        const lonCenter = (lj / Math.max(1, nLon)) * 360;

        // 对此格点生成一批带微小随机偏移的粒子
        for (let p = 0; p < particleDensity; p++) {
          // 添加小随机抖动 (经度 360 度，纬度 180 度)
          const latJitter = latCenter + (Math.random() - 0.5) * (180 / nLat);
          const lonJitter = lonCenter + (Math.random() - 0.5) * (360 / nLon);

          // --- 为了平滑过渡，对该粒子的实际经纬度在原矩阵中做双线性插值采其热力值 ---
          // 反算出行列的浮点索引：
          // latJitter 从 90 -> -90 对应 liFloat 0 -> nLat - 1
          const liFloat = ((90 - latJitter) / 180) * (nLat - 1);
          // lonJitter 从 0 -> 360 对应 ljFloat 0 -> nLon
          const ljFloat = (lonJitter / 360) * nLon;

          const interpVal = bilinearInterpolate(field, liFloat, ljFloat);
          if (isNaN(interpVal)) continue;

          const interpT = (Math.max(dMin, Math.min(dMax, interpVal)) - dMin) / range;

          const interColor = colorMode === 'rdbu' ? rdbuRgb(interpT) : getRgb(settings.colormap, interpT);
          const iRNorm = interColor[0] / 255;
          const iGNorm = interColor[1] / 255;
          const iBNorm = interColor[2] / 255;

          const interOffset = colorMode === 'rdbu' ? (interpT - 0.5) * 0.3 : interpT * 0.225;

          const phi = (90 - latJitter) * (Math.PI / 180);
          const theta = lonJitter * (Math.PI / 180);

          // 给高度也加一点点细微原生地形抖动，模拟粗糙颗粒感，但整体过渡已经是平滑的了
          const r = baseRadius + interOffset + (Math.random() - 0.5) * 0.005;

          const x = r * Math.sin(phi) * Math.cos(theta);
          const y = r * Math.cos(phi);
          const z = r * Math.sin(phi) * Math.sin(theta);

          positions.push(x, y, z);

          // --- 在赤道附近 (纬度 -2 到 2 度左右) 增加淡红色高亮带标识 ---
          if (Math.abs(latJitter) < 1.5) {
            // 赤道颗粒覆盖为淡红色，提升混血亮度
            colors.push(1.0, 0.4, 0.4);
          } else {
            colors.push(iRNorm, iGNorm, iBNorm);
          }
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // 使用圆形纹理给点添加一点软边，采用全局缓存防止不断重建产生 GPU 显存泄漏
    if (!cachedCircleTexture) {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
      cachedCircleTexture = new THREE.CanvasTexture(canvas);
    }

    const material = new THREE.PointsMaterial({
      size: 0.01,
      vertexColors: true,
      map: cachedCircleTexture,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(geometry, material);

    // 将粒子加到地球组中
    globeGroup.add(particles);
    particlesMeshRef.current = particles;

    // 注意：只销毁数据相关的粒子即可，mars 的析构可以留给整个组件销毁时（见下方独立清理 Effect）
  }, [fieldData, colorMode, settings.colormap]);

  // 组件完全卸载时，清空 sphereMeshRef / 材质资源
  useEffect(() => {
    return () => {
      if (sphereMeshRef.current && sceneRef.current) {
        sceneRef.current.remove(sphereMeshRef.current);
        sphereMeshRef.current.children.forEach(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            child.material.dispose();
            if (child.material.map && child.material.map !== cachedMarsTexture) {
              child.material.map.dispose();
            }
          }
        });
        sphereMeshRef.current = null;
        particlesMeshRef.current = null;
      }
    };
  }, []);

  if (forceFullscreen) {
    return (
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
        }}
      />
    );
  }

  // 内嵌状态（如果以后还需要作为内嵌卡片的话）
  return (
    <div
      ref={containerRef}
      className="observation-window"
      style={{
        width: '100%',
        height: h,
        background: isLight ? '#f5f6f8' : 'rgba(0,0,0,0.3)',
        cursor: 'zoom-in',
        overflow: 'hidden',
      }}
    />
  );
});

export default SphericalFieldCanvas;
