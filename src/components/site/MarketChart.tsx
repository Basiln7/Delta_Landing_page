"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Candle = { o: number; h: number; l: number; c: number; v: number };
type Signal = { index: number; label: string; up: boolean };

const TIMEFRAMES = { "5m": 0.0016, "1H": 0.0034, "1D": 0.0072 } as const;
type Timeframe = keyof typeof TIMEFRAMES;

const COLORS = {
  up: "#22c55e",
  down: "#f04438",
  ema: "#d3fb52",
  grid: "rgba(250,251,254,0.06)",
  axis: "rgba(250,251,254,0.38)",
  volume: "rgba(250,251,254,0.08)",
  cross: "rgba(250,251,254,0.35)",
};

/** Deterministic PRNG so every visitor sees the same "sample" series. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeSeries(count: number, vol: number, seed: number, start = 24000): Candle[] {
  const r = rng(seed);
  const out: Candle[] = [];
  let price = start;
  let drift = 0;
  for (let i = 0; i < count; i++) {
    drift = drift * 0.92 + (r() - 0.47) * vol * 0.6;
    const o = price;
    const c = Math.max(1, o * (1 + drift + (r() - 0.5) * vol));
    const h = Math.max(o, c) * (1 + r() * vol * 0.7);
    const l = Math.min(o, c) * (1 - r() * vol * 0.7);
    out.push({ o, h, l, c, v: 0.3 + r() * 0.7 + Math.abs(c - o) / o / vol });
    price = c;
  }
  return out;
}

function ema(values: number[], period: number) {
  const k = 2 / (period + 1);
  const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1] * (1 - k)));
  return out;
}

/** Simple, explainable "AI" annotations: EMA crosses and 20-bar breakouts. */
function findSignals(candles: Candle[], line: number[]): Signal[] {
  const sigs: Signal[] = [];
  for (let i = 21; i < candles.length; i++) {
    const prevAbove = candles[i - 1].c > line[i - 1];
    const nowAbove = candles[i].c > line[i];
    const hi20 = Math.max(...candles.slice(i - 20, i).map((c) => c.h));
    if (candles[i].c > hi20) sigs.push({ index: i, label: "Breakout", up: true });
    else if (!prevAbove && nowAbove) sigs.push({ index: i, label: "Trend up", up: true });
    else if (prevAbove && !nowAbove) sigs.push({ index: i, label: "Below EMA", up: false });
  }
  // keep them readable: at most one every 8 bars
  return sigs.filter((s, i, arr) => i === 0 || s.index - arr[i - 1].index >= 8);
}

const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Streaming candlestick chart on canvas (sample data): candles, 20-EMA, volume, AI signal markers
 * and a hover crosshair with OHLC. Pauses off-screen; static for reduced-motion users.
 */
export function MarketChart({ className, bare = false }: { className?: string; bare?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const priceRef = useRef<HTMLSpanElement>(null);
  const changeRef = useRef<HTMLSpanElement>(null);
  const [tf, setTf] = useState<Timeframe>("1H");

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const vol = TIMEFRAMES[tf];
    const VISIBLE = 64;
    const candles = makeSeries(VISIBLE, vol, tf === "5m" ? 11 : tf === "1H" ? 23 : 37);
    const open0 = candles[0].o;
    const live = rng(Date.now() % 100000);

    let w = 0;
    let h = 0;
    let hover: number | null = null;
    let raf = 0;
    let running = false;
    let lastTick = 0;
    let ticks = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const padR = 64;
      const padT = 16;
      const volH = h * 0.16;
      const chartH = h - volH - padT - 22;
      const cw = (w - padR) / VISIBLE;
      const line = ema(
        candles.map((c) => c.c),
        20,
      );
      const signals = findSignals(candles, line);
      const hi = Math.max(...candles.map((c) => c.h), ...line);
      const lo = Math.min(...candles.map((c) => c.l), ...line);
      const range = hi - lo || 1;
      const y = (p: number) => padT + ((hi - p) / range) * chartH;
      const maxV = Math.max(...candles.map((c) => c.v));

      ctx.clearRect(0, 0, w, h);

      // grid + price axis
      ctx.font = "500 10px ui-monospace, monospace";
      ctx.textAlign = "left";
      for (let g = 0; g <= 4; g++) {
        const p = lo + (range * g) / 4;
        const gy = y(p);
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w - padR, gy);
        ctx.stroke();
        ctx.fillStyle = COLORS.axis;
        ctx.fillText(fmt(p), w - padR + 8, gy + 3);
      }

      // volume
      candles.forEach((c, i) => {
        const vh = (c.v / maxV) * volH;
        ctx.fillStyle = COLORS.volume;
        ctx.fillRect(i * cw + cw * 0.18, h - 18 - vh, cw * 0.64, vh);
      });

      // candles
      candles.forEach((c, i) => {
        const x = i * cw + cw / 2;
        const up = c.c >= c.o;
        ctx.strokeStyle = up ? COLORS.up : COLORS.down;
        ctx.fillStyle = up ? COLORS.up : COLORS.down;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y(c.h));
        ctx.lineTo(x, y(c.l));
        ctx.stroke();
        const top = y(Math.max(c.o, c.c));
        const bh = Math.max(1.5, Math.abs(y(c.o) - y(c.c)));
        ctx.fillRect(x - cw * 0.32, top, cw * 0.64, bh);
      });

      // EMA
      ctx.strokeStyle = COLORS.ema;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      line.forEach((v, i) => (i ? ctx.lineTo(i * cw + cw / 2, y(v)) : ctx.moveTo(i * cw + cw / 2, y(v))));
      ctx.stroke();

      // AI signals
      signals.forEach((s) => {
        const c = candles[s.index];
        const x = s.index * cw + cw / 2;
        const yy = s.up ? y(c.l) + 12 : y(c.h) - 12;
        ctx.fillStyle = s.up ? COLORS.ema : COLORS.down;
        ctx.beginPath();
        if (s.up) {
          ctx.moveTo(x, yy - 6);
          ctx.lineTo(x - 5, yy + 2);
          ctx.lineTo(x + 5, yy + 2);
        } else {
          ctx.moveTo(x, yy + 6);
          ctx.lineTo(x - 5, yy - 2);
          ctx.lineTo(x + 5, yy - 2);
        }
        ctx.fill();
        const label = `AI · ${s.label}`;
        ctx.font = "600 9px ui-monospace, monospace";
        const tw = ctx.measureText(label).width + 10;
        const ly = s.up ? yy + 8 : yy - 22;
        const lx = Math.min(Math.max(x - tw / 2, 2), w - padR - tw - 2);
        ctx.fillStyle = "rgba(20,21,28,0.85)";
        ctx.fillRect(lx, ly, tw, 14);
        ctx.fillStyle = s.up ? COLORS.ema : COLORS.down;
        ctx.fillText(label, lx + 5, ly + 10);
      });

      // last price line
      const last = candles[candles.length - 1];
      const ly = y(last.c);
      const upNow = last.c >= last.o;
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = upNow ? COLORS.up : COLORS.down;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(w - padR, ly);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = upNow ? COLORS.up : COLORS.down;
      ctx.fillRect(w - padR + 2, ly - 9, padR - 4, 18);
      ctx.fillStyle = "#14151c";
      ctx.font = "700 10px ui-monospace, monospace";
      ctx.fillText(fmt(last.c), w - padR + 6, ly + 4);

      // crosshair
      if (hover !== null && hover >= 0 && hover < candles.length) {
        const c = candles[hover];
        const x = hover * cw + cw / 2;
        ctx.strokeStyle = COLORS.cross;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, h - 18);
        ctx.stroke();
        ctx.setLineDash([]);
        const text = `O ${fmt(c.o)}  H ${fmt(c.h)}  L ${fmt(c.l)}  C ${fmt(c.c)}`;
        ctx.font = "500 10px ui-monospace, monospace";
        const tw = ctx.measureText(text).width + 14;
        ctx.fillStyle = "rgba(20,21,28,0.92)";
        ctx.fillRect(8, 6, tw, 18);
        ctx.fillStyle = "rgba(250,251,254,0.85)";
        ctx.fillText(text, 15, 18);
      }

      // header readouts (DOM, no re-render)
      const chg = ((last.c - open0) / open0) * 100;
      if (priceRef.current) priceRef.current.textContent = fmt(last.c);
      if (changeRef.current) {
        changeRef.current.textContent = `${chg >= 0 ? "▲" : "▼"} ${Math.abs(chg).toFixed(2)}%`;
        changeRef.current.style.color = chg >= 0 ? COLORS.up : COLORS.down;
      }
    };

    // Live tick: wiggle the last candle; every ~6 ticks open a new one and scroll.
    const tick = () => {
      const last = candles[candles.length - 1];
      const move = (live() - 0.48) * vol * 0.5;
      last.c = Math.max(1, last.c * (1 + move));
      last.h = Math.max(last.h, last.c);
      last.l = Math.min(last.l, last.c);
      last.v += live() * 0.2;
      if (++ticks % 6 === 0) {
        candles.shift();
        candles.push({ o: last.c, h: last.c, l: last.c, c: last.c, v: 0.3 });
      }
    };

    const loop = (t: number) => {
      if (t - lastTick > 650) {
        tick();
        lastTick = t;
        draw();
      }
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || reduce) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    draw();

    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0.05 });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const cw = (r.width - 64) / VISIBLE;
      hover = Math.floor((e.clientX - r.left) / cw);
      draw();
    };
    const onLeave = () => {
      hover = null;
      draw();
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [tf]);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden text-white",
        bare ? "bg-transparent" : "rounded-[26px] border border-edge bg-night-2 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.75)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-5 py-4">
        <div>
          <p className="eyebrow flex items-center gap-2 text-mute">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brass-light opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brass-light" />
            </span>
            DLT-50 · fictional sample index
          </p>
          <p className="mt-1.5 flex items-baseline gap-3 font-mono tabular-nums">
            <span ref={priceRef} className="text-2xl font-semibold">
              —
            </span>
            <span ref={changeRef} className="text-sm" />
          </p>
        </div>
        <div role="tablist" aria-label="Timeframe" className="flex rounded-full bg-white/5 p-1">
          {(Object.keys(TIMEFRAMES) as Timeframe[]).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tf === k}
              onClick={() => setTf(k)}
              className={cn("rounded-full px-3 py-1 font-mono text-xs transition-colors", tf === k ? "bg-brass-light text-ink" : "text-mute hover:text-white")}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Animated sample candlestick chart with a 20-period moving average and AI signal markers. Sample data for learning, not live prices."
        className={cn("w-full cursor-crosshair", bare ? "h-[15rem] sm:h-[19rem]" : "h-[18rem] sm:h-[22rem]")}
      />
      <div className="flex items-center justify-between gap-3 border-t border-edge px-5 py-3 text-[0.7rem] text-mute">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-brass-light" /> 20 EMA</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rotate-45 bg-brass-light" /> AI signal</span>
        </span>
        <span>Sample data · for learning, not live prices</span>
      </div>
    </div>
  );
}
