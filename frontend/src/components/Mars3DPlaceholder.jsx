import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

const MARS_TEXTURE_URLS = [
  '/mars_texture.jpg',
];

// CSS fallback：多层渐变模拟火星表面
const CSS_GRADIENT = `
  radial-gradient(ellipse 42% 14% at 50% 2%,  rgba(248,240,225,0.78) 0%, rgba(248,240,225,0.3) 35%, transparent 70%),
  radial-gradient(ellipse 36% 12% at 50% 98%, rgba(242,234,218,0.65) 0%, rgba(242,234,218,0.22) 38%, transparent 72%),
  radial-gradient(ellipse 24% 30% at 63% 40%, rgba(45,16,4,0.68)     0%, rgba(45,16,4,0.28)     50%, transparent 78%),
  radial-gradient(ellipse 32% 22% at 38% 34%, rgba(222,108,68,0.42)  0%, transparent 58%),
  radial-gradient(ellipse 24% 20% at 74% 70%, rgba(60,20,6,0.52)     0%, transparent 58%),
  radial-gradient(ellipse 28% 38% at 20% 50%, rgba(208,92,52,0.38)   0%, transparent 55%),
  radial-gradient(ellipse 40% 9%  at 52% 52%, rgba(75,26,10,0.42)    0%, transparent 62%),
  radial-gradient(ellipse 20% 15% at 78% 28%, rgba(180,75,40,0.32)   0%, transparent 55%),
  radial-gradient(circle  at 33% 30%, #ec9268 0%, #d06840 22%, #c75b39 42%, #9a4228 62%, #6a2a18 82%, #360f04 100%)
`;

export default function Mars3DPlaceholder({ size = 320 }) {
  const mountRef = useRef(null);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer, scene, camera, mesh, atmosMesh, animId;
    const disposables = [];

    try {
      // Scene
      scene = new THREE.Scene();

      // Camera
      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.z = 2.8;

      // Renderer
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(size, size);
      renderer.domElement.style.borderRadius = '50%';
      container.appendChild(renderer.domElement);

      // Geometry
      const geometry = new THREE.SphereGeometry(1, 64, 64);
      disposables.push(geometry);

      // Material (start with fallback color, texture replaces it on load)
      const material = new THREE.MeshStandardMaterial({
        color: 0xc75b39,
        roughness: 0.95,
        metalness: 0,
      });
      disposables.push(material);

      // Load texture with fallback chain
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      function tryLoadTexture(index) {
        if (index >= MARS_TEXTURE_URLS.length) return; // all failed, keep fallback color
        loader.load(
          MARS_TEXTURE_URLS[index],
          (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            material.map = texture;
            material.color.set(0xffffff);
            material.needsUpdate = true;
            disposables.push(texture);
          },
          undefined,
          () => tryLoadTexture(index + 1),
        );
      }
      tryLoadTexture(0);

      // Mesh
      mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = 0.15; // 轴倾斜
      scene.add(mesh);

      // Atmosphere shell
      const atmosGeometry = new THREE.SphereGeometry(1.015, 64, 64);
      const atmosMaterial = new THREE.MeshBasicMaterial({
        color: 0xc75b39,
        transparent: true,
        opacity: 0.04,
        side: THREE.BackSide,
      });
      disposables.push(atmosGeometry, atmosMaterial);
      atmosMesh = new THREE.Mesh(atmosGeometry, atmosMaterial);
      scene.add(atmosMesh);

      // Lights
      const dirLight = new THREE.DirectionalLight(0xfff5e6, 0.9);
      dirLight.position.set(5, 3, 5);
      scene.add(dirLight);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);

      // 背面补光：消除纯黑，模拟环境反射
      const backFill = new THREE.PointLight(0xaaccff, 0.3);
      backFill.position.set(-4, -2, -3);
      scene.add(backFill);

      // Animation loop
      function animate() {
        animId = requestAnimationFrame(animate);
        mesh.rotation.y += 0.001;
        renderer.render(scene, camera);
      }
      animate();
    } catch {
      setWebglFailed(true);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      disposables.forEach((d) => d.dispose());
      if (renderer) {
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      }
    };
  }, [size]);

  // WebGL 失败时显示 CSS fallback
  if (webglFailed) {
    return (
      <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: size, height: size,
          borderRadius: '50%',
          background: CSS_GRADIENT,
          boxShadow: `
            0 0 80px rgba(199,91,57,0.3),
            0 0 150px rgba(199,91,57,0.14)
          `,
        }} />
      </div>
    );
  }

  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      {/* Three.js canvas 挂载点 */}
      <div ref={mountRef} style={{
        width: size, height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        boxShadow: `
          0 0 80px rgba(199,91,57,0.3),
          0 0 150px rgba(199,91,57,0.14),
          0 0 260px rgba(199,91,57,0.06)
        `,
      }} />

      {/* 大气光晕圆环（CSS，不依赖 WebGL） */}
      <div style={{
        position: 'absolute',
        inset: -10,
        borderRadius: '50%',
        border: '1px solid rgba(232,132,90,0.12)',
        boxShadow: '0 0 40px rgba(199,91,57,0.1)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        inset: -20,
        borderRadius: '50%',
        border: '0.5px solid rgba(232,132,90,0.06)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}
