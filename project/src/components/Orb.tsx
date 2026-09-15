import { useEffect, useRef } from 'react';

interface OrbProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
  size?: number;
}

export function Orb({ state, size = 320 }: OrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let animationId: number;
    const cx = size / 2;
    const cy = size / 2;
    const baseRadius = size * 0.28;

    const colors: Record<string, [string, string]> = {
      idle: ['#0ea5e9', '#06b6d4'],
      listening: ['#06b6d4', '#22d3ee'],
      thinking: ['#f59e0b', '#fbbf24'],
      speaking: ['#10b981', '#34d399'],
    };

    class Particle {
      angle: number;
      dist: number;
      speed: number;
      size: number;
      offset: number;

      constructor() {
        this.angle = Math.random() * Math.PI * 2;
        this.dist = baseRadius + (Math.random() - 0.5) * baseRadius * 0.5;
        this.speed = 0.001 + Math.random() * 0.003;
        this.size = 1 + Math.random() * 2.5;
        this.offset = Math.random() * Math.PI * 2;
      }

      update(t: number, intensity: number) {
        this.angle += this.speed * (1 + intensity * 2);
        const pulse = Math.sin(t * 0.002 + this.offset) * baseRadius * 0.15 * intensity;
        this.dist = baseRadius + pulse + (Math.sin(this.angle * 3) * baseRadius * 0.1);
      }

      draw(c: CanvasRenderingContext2D, color: string) {
        const x = cx + Math.cos(this.angle) * this.dist;
        const y = cy + Math.sin(this.angle) * this.dist;
        c.beginPath();
        c.arc(x, y, this.size, 0, Math.PI * 2);
        c.fillStyle = color;
        c.fill();
      }
    }

    const particles: Particle[] = [];
    for (let i = 0; i < 80; i++) particles.push(new Particle());

    function animate(t: number, c: CanvasRenderingContext2D) {
      c.clearRect(0, 0, size, size);
      const s = stateRef.current;
      const [c1, c2] = colors[s] || colors.idle;
      const intensity = s === 'idle' ? 0.3 : s === 'listening' ? 0.8 : s === 'thinking' ? 0.6 : 0.7;

      const glowRadius = baseRadius * (1.5 + Math.sin(t * 0.001) * 0.1);
      const glowGrad = c.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
      glowGrad.addColorStop(0, `${c1}40`);
      glowGrad.addColorStop(0.5, `${c1}15`);
      glowGrad.addColorStop(1, `${c1}00`);
      c.fillStyle = glowGrad;
      c.fillRect(0, 0, size, size);

      const coreRadius = baseRadius * (0.9 + Math.sin(t * 0.002) * 0.05 * intensity);
      const coreGrad = c.createRadialGradient(cx - coreRadius * 0.3, cy - coreRadius * 0.3, 0, cx, cy, coreRadius);
      coreGrad.addColorStop(0, `${c2}cc`);
      coreGrad.addColorStop(0.4, `${c1}88`);
      coreGrad.addColorStop(1, `${c1}22`);
      c.fillStyle = coreGrad;
      c.beginPath();
      c.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      c.fill();

      c.strokeStyle = `${c2}66`;
      c.lineWidth = 1.5;
      const ringR = baseRadius * (1.15 + Math.sin(t * 0.0015) * 0.03);
      c.beginPath();
      c.arc(cx, cy, ringR, 0, Math.PI * 2);
      c.stroke();

      c.strokeStyle = `${c1}33`;
      c.lineWidth = 1;
      const ringR2 = baseRadius * 1.3;
      c.beginPath();
      c.arc(cx, cy, ringR2, t * 0.0003, t * 0.0003 + Math.PI * 1.5);
      c.stroke();

      particles.forEach((p) => {
        p.update(t, intensity);
        p.draw(c, `${c2}aa`);
      });

      animationId = requestAnimationFrame((nt) => animate(nt, c));
    }

    animate(0, ctx);
    return () => cancelAnimationFrame(animationId);
  }, [size]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="block"
      />
      <div className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08), transparent 60%)`,
        }}
      />
    </div>
  );
}
