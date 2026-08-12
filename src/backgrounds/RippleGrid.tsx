import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

interface RippleGridProps {
  gridColor?: string;
  rippleIntensity?: number;
  gridSize?: number;
  gridThickness?: number;
  fadeDistance?: number;
  vignetteStrength?: number;
  glowIntensity?: number;
  opacity?: number;
  gridRotation?: number;
  mouseInteraction?: boolean;
  mouseInteractionRadius?: number;
}

const vertex = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragment = `
precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform vec3 gridColor;
uniform float rippleIntensity;
uniform float gridSize;
uniform float gridThickness;
uniform float fadeDistance;
uniform float vignetteStrength;
uniform float glowIntensity;
uniform float opacity;
uniform float gridRotation;
uniform bool mouseInteraction;
uniform vec2 mousePosition;
uniform float mouseInfluence;
uniform float mouseInteractionRadius;
varying vec2 vUv;

mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= iResolution.x / max(iResolution.y, 1.0);
  uv = rotate2d(gridRotation * 0.0174532925) * uv;
  float dist = length(uv);
  float wave = sin(3.141592 * (iTime - dist));
  vec2 rippleUv = uv + uv * wave * rippleIntensity;

  if (mouseInteraction && mouseInfluence > 0.0) {
    vec2 mouseUv = mousePosition * 2.0 - 1.0;
    mouseUv.x *= iResolution.x / max(iResolution.y, 1.0);
    float mouseDist = length(uv - mouseUv);
    float influence = mouseInfluence * exp(-mouseDist * mouseDist / max(mouseInteractionRadius * mouseInteractionRadius, 0.01));
    vec2 direction = mouseDist > 0.0001 ? normalize(uv - mouseUv) : vec2(0.0);
    rippleUv += direction * sin(3.141592 * (iTime * 2.0 - mouseDist * 3.0)) * influence * rippleIntensity * 0.3;
  }

  vec2 lines = abs(sin(gridSize * 0.5 * 3.141592 * rippleUv - 1.570796));
  vec2 smoothLines = smoothstep(vec2(0.0), vec2(0.5), lines);
  vec3 light = vec3(0.0);
  light += exp(-gridThickness * smoothLines.x);
  light += exp(-gridThickness * smoothLines.y);
  light += glowIntensity * exp(-gridThickness * 0.5 * smoothLines.x);
  light += glowIntensity * exp(-gridThickness * 0.5 * smoothLines.y);
  float radialFade = exp(-2.0 * clamp(pow(dist, fadeDistance), 0.0, 1.0));
  float vignette = clamp(1.0 - pow(length(vUv - 0.5) * 2.0, vignetteStrength), 0.0, 1.0);
  float finalFade = radialFade * vignette;
  float alpha = length(light) * finalFade * opacity;
  gl_FragColor = vec4(light * gridColor * finalFade * opacity, alpha);
}`;

function colorToRgb(hex: string): [number, number, number] {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return match
    ? [parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255]
    : [1, 1, 1];
}

export default function RippleGrid({
  gridColor = "#34d399",
  rippleIntensity = 0.045,
  gridSize = 12,
  gridThickness = 16,
  fadeDistance = 1.7,
  vignetteStrength = 2.4,
  glowIntensity = 0.12,
  opacity = 0.55,
  gridRotation = 8,
  mouseInteraction = true,
  mouseInteractionRadius = 0.8,
}: RippleGridProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 2), alpha: true });
    const gl = renderer.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    Object.assign(gl.canvas.style, { width: "100%", height: "100%", display: "block" });
    container.appendChild(gl.canvas);

    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: [1, 1] },
      gridColor: { value: colorToRgb(gridColor) },
      rippleIntensity: { value: rippleIntensity },
      gridSize: { value: gridSize },
      gridThickness: { value: gridThickness },
      fadeDistance: { value: fadeDistance },
      vignetteStrength: { value: vignetteStrength },
      glowIntensity: { value: glowIntensity },
      opacity: { value: opacity },
      gridRotation: { value: gridRotation },
      mouseInteraction: { value: mouseInteraction },
      mousePosition: { value: [0.5, 0.5] },
      mouseInfluence: { value: 0 },
      mouseInteractionRadius: { value: mouseInteractionRadius },
    };
    const program = new Program(gl, { vertex, fragment, uniforms });
    const geometry = new Triangle(gl);
    const mesh = new Mesh(gl, { geometry, program });
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, influence: 0, targetInfluence: 0 };
    let raf: number | null = null;
    let visible = true;
    let pageVisible = !document.hidden;
    let startedAt = performance.now();

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height);
      uniforms.iResolution.value = [width, height];
    };
    const frame = (time: number) => {
      uniforms.iTime.value = (time - startedAt) * 0.001;
      pointer.x += (pointer.tx - pointer.x) * 0.08;
      pointer.y += (pointer.ty - pointer.y) * 0.08;
      pointer.influence += (pointer.targetInfluence - pointer.influence) * 0.06;
      uniforms.mousePosition.value = [pointer.x, pointer.y];
      uniforms.mouseInfluence.value = pointer.influence;
      renderer.render({ scene: mesh });
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (raf !== null || !visible || !pageVisible) return;
      startedAt = performance.now() - uniforms.iTime.value * 1000;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
    };
    const onPointerMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
      const y = 1 - (event.clientY - rect.top) / Math.max(rect.height, 1);
      const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
      pointer.tx = x;
      pointer.ty = y;
      pointer.targetInfluence = mouseInteraction && inside ? 1 : 0;
    };
    const onVisibility = () => {
      pageVisible = !document.hidden;
      pageVisible ? start() : stop();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      visible ? start() : stop();
    });
    intersectionObserver.observe(container);
    window.addEventListener("mousemove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    resize();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("mousemove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      geometry.remove();
      program.remove();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      if (gl.canvas.parentNode === container) container.removeChild(gl.canvas);
    };
  }, [fadeDistance, glowIntensity, gridColor, gridRotation, gridSize, gridThickness, mouseInteraction, mouseInteractionRadius, opacity, rippleIntensity, vignetteStrength]);

  return <div ref={containerRef} aria-hidden className="relative h-full w-full overflow-hidden" />;
}
