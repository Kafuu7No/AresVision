import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';

// ─── 色阶函数（与 PredictPage 保持一致） ───
function infernoRgb(t) {
  t = Math.max(0, Math.min(1, t));
  const stops = [
    [0, 0, 4], [40, 11, 84], [101, 21, 110], [159, 42, 99],
    [212, 72, 66], [245, 125, 21], [250, 193, 39], [252, 255, 164],
  ];
  const idx = t * (stops.length - 1);
  const i = Math.min(Math.floor(idx), stops.length - 2);
  const f = idx - i;
  const c0 = stops[i], c1 = stops[i + 1];
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * f),
    Math.round(c0[1] + (c1[1] - c0[1]) * f),
    Math.round(c0[2] + (c1[2] - c0[2]) * f),
  ];
}

function rdbuRgb(t) {
  // t: 0~1，其中 0.5=零值，0=深蓝，1=深红
  t = Math.max(0, Math.min(1, t));
  const stops = [
    [5, 48, 97], [33, 102, 172], [67, 147, 195], [146, 197, 222],
    [209, 229, 240], [247, 247, 247], [253, 219, 199], [239, 169, 128],
    [214, 96, 77], [178, 24, 43], [103, 0, 31],
  ];
  const idx = t * (stops.length - 1);
  const i = Math.min(Math.floor(idx), stops.length - 2);
  const f = idx - i;
  const c0 = stops[i], c1 = stops[i + 1];
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * f),
    Math.round(c1[0] + (c1[0] - c0[0]) * f),
    Math.round(c0[1] + (c1[1] - c0[1]) * f),
    Math.round(c0[2] + (c1[2] - c0[2]) * f),
  ];
}

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

export default function SphericalFieldCanvas({ fieldData, colorMode = 'inferno', h = 240, forceFullscreen = false }) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sphereMeshRef = useRef(null);
  const controlsRef = useRef(null);

  // 初始化 Three.js 场景
  useEffect(() => {
    if (!containerRef.current || !fieldData?.field) return;

    // 清理可能存在的旧 Canvas
    containerRef.current.innerHTML = '';

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();

    // 我们还原透明背景，不再使用纯黑色和雾效
    // scene.background = new THREE.Color(0x050508);
    // scene.fog = new THREE.FogExp2(0x050508, 0.08);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.5, 4.5);

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

    // 光照对于 Points 材质 (Basic/PointsMaterial) 不生效，但可以给未来的添加物保留一点
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

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

        const rgbColor = colorMode === 'rdbu' ? rdbuRgb(t) : infernoRgb(t);
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

          const interColor = colorMode === 'rdbu' ? rdbuRgb(interpT) : infernoRgb(interpT);
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

    // 使用圆形纹理给点添加一点软边，看起来像小光球
    const createCircleTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
      return new THREE.CanvasTexture(canvas);
    };

    const material = new THREE.PointsMaterial({
      size: 0.01, // 密度翻倍后，再稍微将单颗粒子的渲染大小缩小，显得更加细腻细腻
      vertexColors: true,
      map: createCircleTexture(),
      transparent: true,
      opacity: 0.9,
      depthWrite: false, // 防止 z-fighting，并能更好看清内外
      blending: THREE.AdditiveBlending // 增加科幻感
    });

    const particles = new THREE.Points(geometry, material);
    // initial rotation
    particles.rotation.y = -Math.PI / 2;
    // 整个球体居中
    particles.position.set(0, 0, 0);
    scene.add(particles);
    sphereMeshRef.current = particles;

    // --- 背景星星特效 ---
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

    let reqId;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (sphereMeshRef.current) {
        sphereMeshRef.current.rotation.y += 0.001; // 球体自转动画
      }
      stars.rotation.y += 0.0003; // 星空背景微弱伴走
      if (rendererRef.current) rendererRef.current.render(scene, camera);
    };
    animate();

    // Resize Handler
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
      if (rendererRef.current) rendererRef.current.dispose();
      geometry.dispose();
      material.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      if (material.map) material.map.dispose();
    };

  }, [fieldData, colorMode, forceFullscreen]);

  if (forceFullscreen) {
    return (
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
    );
  }

  // 内嵌状态（如果以后还需要作为内嵌卡片的话）
  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: h,
        background: 'rgba(0,0,0,0.3)',
        borderRadius: 8,
        cursor: 'zoom-in',
        overflow: 'hidden'
      }}
    />
  );
}
