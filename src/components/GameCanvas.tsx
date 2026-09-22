import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine';
import { GAME_W, GAME_H } from '../game/renderer';
import { sound } from '../game/audio';

interface GameCanvasProps {
  isMuted: boolean;
  onToggleSound: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ isMuted }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);
  const [aspectDimensions, setAspectDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const padding = window.innerWidth < 640 ? 12 : 24;
      const availableW = Math.max(100, container.clientWidth - padding);
      const availableH = Math.max(100, container.clientHeight - padding);

      const aspect = 16 / 9;
      let w = availableW;
      let h = availableW / aspect;

      if (h > availableH) {
        h = availableH;
        w = availableH * aspect;
      }

      // Max cap at 1280 x 720
      w = Math.min(w, 1280);
      h = Math.min(h, 720);

      setAspectDimensions({
        width: Math.floor(w),
        height: Math.floor(h),
      });
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    sound.enabled = !isMuted;
  }, [isMuted]);

  useEffect(() => {
    // Detect touch device
    if (typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
      setIsTouchDevice(true);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine(canvas);
    engineRef.current = engine;
    engine.start();

    // Keyboard handling
    const handleKeyDown = (e: KeyboardEvent) => {
      sound.init();
      const code = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        e.preventDefault();
      }

      if (code === 'KeyA' || code === 'ArrowLeft') engine.keys.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') engine.keys.right = true;
      if (code === 'Space' || code === 'KeyW' || code === 'ArrowUp') {
        if (!engine.keys.jump) {
          engine.keys.jumpBuffered = true;
        }
        engine.keys.jump = true;
      }

      if (code === 'KeyP') {
        if (engine.state === 'playing') {
          engine.state = 'paused';
        } else if (engine.state === 'paused') {
          engine.state = 'playing';
        }
      }

      if (code === 'KeyR') {
        if (engine.state === 'gameover' || engine.state === 'victory') {
          engine.resetGame();
          engine.state = 'playing';
        }
      }

      if (code === 'Escape') {
        if (engine.state === 'shop' || engine.state === 'controls' || engine.state === 'settings') {
          engine.state = 'start';
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyA' || code === 'ArrowLeft') engine.keys.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') engine.keys.right = false;
      if (code === 'Space' || code === 'KeyW' || code === 'ArrowUp') {
        engine.keys.jump = false;
        if (engine.player && engine.player.vy < -3) {
          engine.player.vy *= 0.5;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      engine.stop();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const lastTouchTimeRef = useRef(0);

  const handleCanvasAction = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = GAME_W / rect.width;
    const scaleY = GAME_H / rect.height;
    const mx = (clientX - rect.left) * scaleX;
    const my = (clientY - rect.top) * scaleY;

    engine.handleCanvasClick(mx, my);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    if (Date.now() - lastTouchTimeRef.current < 450) return;
    handleCanvasAction(e.clientX, e.clientY);
  };

  const handleCanvasTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    if (!engine || engine.state === 'playing') return;

    if (e.changedTouches.length > 0) {
      e.stopPropagation();
      lastTouchTimeRef.current = Date.now();
      const touch = e.changedTouches[0];
      handleCanvasAction(touch.clientX, touch.clientY);
    }
  };

  // Touch control callbacks
  const handleTouchLeftStart = (e: React.TouchEvent) => {
    e.preventDefault();
    sound.init();
    if (engineRef.current) engineRef.current.keys.left = true;
  };
  const handleTouchLeftEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (engineRef.current) engineRef.current.keys.left = false;
  };

  const handleTouchRightStart = (e: React.TouchEvent) => {
    e.preventDefault();
    sound.init();
    if (engineRef.current) engineRef.current.keys.right = true;
  };
  const handleTouchRightEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (engineRef.current) engineRef.current.keys.right = false;
  };

  const handleTouchJumpStart = (e: React.TouchEvent) => {
    e.preventDefault();
    sound.init();
    if (engineRef.current) {
      engineRef.current.keys.jump = true;
      engineRef.current.keys.jumpBuffered = true;
    }
  };
  const handleTouchJumpEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (engineRef.current) {
      engineRef.current.keys.jump = false;
      if (engineRef.current.player && engineRef.current.player.vy < -3) {
        engineRef.current.player.vy *= 0.5;
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full h-full flex items-center justify-center p-2 sm:p-4 bg-slate-950 overflow-hidden"
    >
      <div
        className="relative bg-sky-400 rounded-xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center select-none"
        style={
          aspectDimensions
            ? { width: `${aspectDimensions.width}px`, height: `${aspectDimensions.height}px` }
            : { width: '100%', maxWidth: '1280px', maxHeight: '720px', aspectRatio: '16/9' }
        }
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onTouchEnd={handleCanvasTouchEnd}
          className="w-full h-full block cursor-pointer select-none"
        />

        {/* On-screen controls for touchscreen devices */}
        {isTouchDevice && (
          <div className="absolute bottom-4 left-0 right-0 px-6 flex justify-between pointer-events-none select-none z-20">
            <div className="flex gap-4 pointer-events-auto">
              <button
                onTouchStart={handleTouchLeftStart}
                onTouchEnd={handleTouchLeftEnd}
                className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-md border-2 border-white/60 text-white font-bold text-2xl flex items-center justify-center active:scale-90 active:bg-white/60 transition"
              >
                ◀
              </button>
              <button
                onTouchStart={handleTouchRightStart}
                onTouchEnd={handleTouchRightEnd}
                className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-md border-2 border-white/60 text-white font-bold text-2xl flex items-center justify-center active:scale-90 active:bg-white/60 transition"
              >
                ▶
              </button>
            </div>
            <div className="pointer-events-auto">
              <button
                onTouchStart={handleTouchJumpStart}
                onTouchEnd={handleTouchJumpEnd}
                className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-md border-2 border-white/60 text-white font-bold text-2xl flex items-center justify-center active:scale-90 active:bg-white/60 transition"
              >
                ▲
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
