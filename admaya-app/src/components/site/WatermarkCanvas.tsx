"use client";

import { useEffect, useRef } from "react";

/** Ported from paintWatermark() in vaani_prototype_6.html — same tiling, angle, font and alpha. */
function paintWatermark(canvas: HTMLCanvasElement | null, text: string) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(160, rect.width || canvas.clientWidth || 220);
  const h = Math.max(220, rect.height || canvas.clientHeight || 340);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((-26 * Math.PI) / 180);
  ctx.font = '600 13px "IBM Plex Sans", sans-serif';
  ctx.fillStyle = "rgba(242,237,225,0.5)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const stepX = 130,
    stepY = 70;
  const span = Math.max(w, h) * 1.6;
  for (let y = -span; y < span; y += stepY) {
    for (let x = -span; x < span; x += stepX) {
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();
}

export default function WatermarkCanvas({ className, id }: { className: string; id?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const paint = () => paintWatermark(ref.current, "AdMaya.ai");
    paint();
    const raf = requestAnimationFrame(paint);
    const settle = setTimeout(paint, 300); // fonts settling
    window.addEventListener("resize", paint);
    window.addEventListener("load", paint);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
      window.removeEventListener("resize", paint);
      window.removeEventListener("load", paint);
    };
  }, []);

  return <canvas ref={ref} id={id} className={className} />;
}
