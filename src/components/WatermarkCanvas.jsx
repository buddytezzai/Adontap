import { useEffect, useRef } from "react";
export default function WatermarkCanvas({
  className = "",
  text = "AdMaya.ai",
  active = true,
}) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active) return;
    const canvas = ref.current;
    if (!canvas) return;
    const paint = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(160, rect.width || 220),
        h = Math.max(220, rect.height || 340);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate((-26 * Math.PI) / 180);
      ctx.font = '600 13px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = "rgba(242,237,225,.5)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const span = Math.max(w, h) * 1.6;
      for (let y = -span; y < span; y += 70)
        for (let x = -span; x < span; x += 130) ctx.fillText(text, x, y);
      ctx.restore();
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [text, active]);
  return (
    <canvas ref={ref} className={className} aria-label="AdMaya.ai watermark" />
  );
}
