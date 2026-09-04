"use client";

/**
 * WeaveVeil — 히어로 배경 맨 뒤에 은은하게 깔리는 입자 베일.
 * Weave 마크 모양으로 흰 입자가 모였다가 아주 천천히 흔들린다.
 * 캔버스 한 장, 외부 라이브러리 없음. prefers-reduced-motion이면 정지 상태로 그린다.
 */

import { useEffect, useRef } from "react";

const LIGHT_D = "M318.08 166.02C304.34 163.60 290.72 157.46 278.16 148.04C271.13 142.77 257.07 129.02 249.37 119.90C245.99 115.90 242.96 112.62 242.65 112.62C242.33 112.62 242.07 112.29 242.07 111.88C242.07 111.27 234.32 101.42 222.84 87.44C210.61 72.53 201.90 63.81 194.31 58.83C187.43 54.32 183.35 52.93 176.03 52.58C170.67 52.33 169.25 52.50 165.26 53.88C152.80 58.22 139.04 72.37 126.29 93.97C124.47 97.06 122.98 100.08 122.98 100.69C122.98 101.89 118.12 94.71 114.41 88.03C110.39 80.80 109.11 75.81 109.09 67.31C109.07 63.22 108.88 59.72 108.65 59.55C107.94 58.99 118.98 44.74 124.82 38.67C132.10 31.12 139.02 25.96 147.16 22.01C155.66 17.89 162.27 16.17 171.28 15.72C186.41 14.97 199.71 18.78 213.26 27.75C218.40 31.15 231.87 43.95 237.30 50.58C239.29 53.02 241.25 55.02 241.66 55.03C242.06 55.04 242.83 55.89 243.37 56.93C244.96 60.02 260.29 78.32 261.29 78.32C261.80 78.32 262.03 78.60 261.82 78.96C261.60 79.31 264.42 83.31 268.08 87.86C292.22 117.81 303.64 127.09 322.01 131.63C338.45 135.70 357.69 131.49 374.62 120.13C380.26 116.34 389.29 109.00 392.52 105.58C393.56 104.47 394.62 103.56 394.86 103.56C395.97 103.56 397.09 110.24 397.09 116.83C397.09 122.47 396.77 124.96 395.58 128.80C390.13 146.31 372.16 160.40 348.87 165.42C342.09 166.88 324.84 167.22 318.08 166.02Z M73.79 161.85C68.60 160.27 62.99 155.59 60.50 150.77C59.90 149.61 55.10 137.85 49.85 124.65C44.59 111.45 31.92 79.82 21.69 54.37C11.46 28.92 2.94 7.73 2.77 7.28C2.30 6.09 9.99 6.23 15.73 7.51C20.84 8.65 29.45 12.46 33.01 15.15C39.41 19.99 45.70 27.43 49.17 34.25C50.43 36.74 62.56 65.78 75.26 96.76C77.45 102.10 79.47 106.57 79.75 106.69C80.03 106.81 80.26 107.26 80.26 107.69C80.26 108.12 83.29 116.04 87.00 125.27C95.67 146.85 95.70 146.93 96.41 146.93C97.60 146.93 92.48 155.06 89.64 157.70C85.29 161.74 78.90 163.42 73.79 161.85Z M292.16 106.54C287.04 101.42 282.85 96.80 282.85 96.27C282.85 94.72 292.47 85.98 297.93 82.58C305.12 78.10 312.36 75.15 328.88 69.98C336.85 67.48 345.99 64.38 349.19 63.09C356.58 60.11 363.78 56.34 364.21 55.23C364.39 54.75 365.05 54.37 365.68 54.37C369.06 54.37 385.97 40.49 386.84 37.00L387.26 35.35L387.84 36.93C388.17 37.80 388.60 40.85 388.80 43.71C389.71 56.47 383.96 70.27 374.02 79.26C365.76 86.73 356.70 90.88 333.01 98.04C321.58 101.50 313.06 105.90 307.20 111.38C304.56 113.84 302.19 115.86 301.94 115.86C301.68 115.86 297.28 111.67 292.16 106.54Z";
const NAVY_D = "M161.17 167.00C156.20 166.20 147.33 163.32 142.72 161.00C132.18 155.70 119.62 145.16 111.00 134.39C108.87 131.72 106.93 129.52 106.70 129.49C106.29 129.45 100.59 139.29 97.71 144.98L96.24 147.90L94.99 144.98C91.44 136.71 80.26 108.36 80.26 107.61C80.26 106.03 95.59 79.39 103.73 66.83C106.56 62.47 108.91 58.90 108.97 58.90C109.02 58.90 109.06 62.47 109.07 66.83C109.08 78.86 110.78 83.17 122.68 101.30C134.83 119.81 147.66 131.34 160.16 134.97C165.16 136.42 173.01 136.00 178.19 134.01C190.06 129.45 203.43 116.00 218.12 93.85C220.36 90.47 222.30 87.58 222.43 87.43C222.56 87.27 223.03 87.61 223.47 88.17C223.91 88.72 228.41 94.28 233.47 100.51L242.66 111.83L237.75 119.18C226.90 135.42 216.56 147.25 206.80 154.59C200.96 158.97 190.73 164.01 184.14 165.74C178.31 167.27 166.84 167.90 161.17 167.00Z M254.05 70.49C250.18 65.72 245.90 60.54 244.54 58.98L242.08 56.14L245.09 51.86C262.76 26.74 281.33 12.79 305.18 6.72C313.11 4.69 328.27 3.92 336.48 5.13C353.17 7.57 367.87 14.97 379.61 26.86C382.82 30.10 385.95 33.67 386.58 34.79L387.73 36.82L383.75 41.08C379.45 45.67 373.01 50.76 368.17 53.40L365.14 55.05L362.76 51.47C357.42 43.42 347.12 36.33 336.76 33.57C329.67 31.68 319.42 31.67 311.79 33.54C294.64 37.75 280.22 49.61 266.77 70.55C264.60 73.93 262.43 77.25 261.96 77.93C261.16 79.06 260.55 78.49 254.05 70.49Z";

const VB_W = 400;
const VB_H = 168.93;

/* 시드 고정 난수 — 매번 같은 배치가 나오도록 */
function makeRnd(seed) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export default function WeaveVeil({ opacity = 1 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let particles = [];
    let raf = 0;
    let w = 0;
    let h = 0;

    /* 마크를 오프스크린에 그린 뒤 픽셀을 훑어 입자 좌표를 뽑는다 */
    function sampleMark(markW) {
      const markH = Math.round((markW * VB_H) / VB_W);
      const off = document.createElement("canvas");
      off.width = markW;
      off.height = markH;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return [];
      octx.setTransform(markW / VB_W, 0, 0, markW / VB_W, 0, 0);
      octx.fillStyle = "#fff";
      octx.fill(new Path2D(LIGHT_D), "evenodd");
      octx.fill(new Path2D(NAVY_D), "evenodd");
      octx.setTransform(1, 0, 0, 1, 0, 0);

      const data = octx.getImageData(0, 0, markW, markH).data;
      const step = Math.max(2, Math.round(markW / 300));
      const pts = [];
      for (let y = 0; y < markH; y += step) {
        for (let x = 0; x < markW; x += step) {
          if (data[(y * markW + x) * 4 + 3] > 140) pts.push([x, y]);
        }
      }
      return { pts, markW, markH };
    }

    function build() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      /* 마크는 히어로 폭보다 크게 잡아 화면 밖으로 살짝 넘치게 둔다 */
      const targetW = Math.max(w * 1.16, 720);
      const sampled = sampleMark(Math.max(160, Math.round(targetW)));
      if (!sampled || !sampled.pts.length) return;

      const scale = targetW / sampled.markW;
      const ox = (w - sampled.markW * scale) / 2;
      const oy = h * 0.40 - (sampled.markH * scale) / 2;

      const rnd = makeRnd(20260904);
      const MAX = w < 640 ? 1000 : 2200;
      const pts = sampled.pts;
      const stride = Math.max(1, Math.floor(pts.length / MAX));

      particles = [];
      for (let i = 0; i < pts.length; i += stride) {
        const tx = ox + pts[i][0] * scale;
        const ty = oy + pts[i][1] * scale;
        particles.push({
          tx,
          ty,
          ph: rnd() * Math.PI * 2,
          ph2: rnd() * Math.PI * 2,
          sp: 0.16 + rnd() * 0.30,
          amp: 4 + rnd() * 16,
          r: 0.9 + rnd() * 2.4,
          a: 0.45 + rnd() * 0.55,
        });
      }
    }

    function draw(now) {
      ctx.clearRect(0, 0, w, h);
      const t = now / 1000;
      ctx.globalCompositeOperation = "source-over";
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const dx = Math.sin(t * p.sp + p.ph) * p.amp;
        const dy = Math.cos(t * p.sp * 0.78 + p.ph2) * p.amp * 0.7;
        ctx.globalAlpha = p.a * (0.62 + 0.38 * Math.sin(t * 0.5 + p.ph));
        ctx.beginPath();
        ctx.arc(p.tx + dx, p.ty + dy, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function loop(now) {
      draw(now);
      raf = requestAnimationFrame(loop);
    }

    function start() {
      build();
      /* 색은 CSS의 color 값을 그대로 쓴다 — 라이트/다크에서 다른 색을 줄 수 있게 */
      ctx.fillStyle = getComputedStyle(canvas).color || "#ffffff";
      if (reduce) {
        draw(0);
      } else {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      }
    }

    start();

    let tid = 0;
    const onResize = () => {
      clearTimeout(tid);
      tid = setTimeout(start, 180);
    };
    window.addEventListener("resize", onResize);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => start();
    if (mq.addEventListener) mq.addEventListener("change", onScheme);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(tid);
      window.removeEventListener("resize", onResize);
      if (mq.removeEventListener) mq.removeEventListener("change", onScheme);
    };
  }, []);

  return <canvas ref={ref} className="weave-veil" style={{ opacity }} aria-hidden="true" />;
}
