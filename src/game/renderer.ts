import { Player, Platform, Spring, Checkpoint, Coin, Enemy, Particle, SceneryItem, FinishFlag, GameState, PowerUp, GameNotification, Boss, BossHazard, RunStats, NPC, PlayerUpgrades, BiomeType } from '../types';
import { ActiveBiomeBlend, getBiomeAtX, getDetailedBiomeAtX, DEFAULT_BIOME_BLEND } from './biome';

export const GAME_W = 960;
export const GAME_H = 540;

// Safe roundRect helper
function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rad = typeof r === 'number' ? r : r[0] || 0;
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

/**
 * Finds the closest ground or platform directly below the specified X coordinate and reference bottom Y.
 */
function getGroundUnder(x: number, width: number, bottomY: number, platforms: Platform[]): number | null {
  let closestY: number | null = null;
  const centerX = x + width / 2;

  for (const plat of platforms) {
    if (centerX >= plat.x - 6 && centerX <= plat.x + plat.width + 6) {
      if (plat.y >= bottomY - 6) {
        if (closestY === null || plat.y < closestY) {
          closestY = plat.y;
        }
      }
    }
  }
  return closestY;
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  camX: number,
  clouds: SceneryItem[],
  hills: SceneryItem[],
  trees: SceneryItem[],
  activeBiome?: ActiveBiomeBlend
) {
  const time = performance.now() * 0.001;
  const biome: ActiveBiomeBlend = activeBiome || DEFAULT_BIOME_BLEND;
  const curB = biome.current;
  const nxtB = biome.next;

  // Layer-specific transition factors for true physical travel progression:
  // Sky changes first, followed by distant scenery, then midground atmosphere/waves, then trees/ground
  const skyT = biome.skyFactor !== undefined ? biome.skyFactor : biome.factor;
  const distT = biome.distantFactor !== undefined ? biome.distantFactor : biome.factor;
  const midT = biome.midFactor !== undefined ? biome.midFactor : biome.factor;

  // Layer transition intensities
  const distantCoastal = curB === 'coastal' ? (1 - distT) : (nxtB === 'coastal' ? distT : 0);
  const distantCave = curB === 'cave' ? (1 - distT) : (nxtB === 'cave' ? distT : 0);
  const distantMountain = curB === 'mountain' ? (1 - distT) : (nxtB === 'mountain' ? distT : 0);
  const distantForest = curB === 'forest' ? (1 - distT) : (nxtB === 'forest' ? distT : 0);
  const distantTemple = curB === 'temple' ? (1 - distT) : (nxtB === 'temple' ? distT : 0);
  const distantVolcano = curB === 'volcano' ? (1 - distT) : (nxtB === 'volcano' ? distT : 0);

  const midCoastal = curB === 'coastal' ? (1 - midT) : (nxtB === 'coastal' ? midT : 0);
  const midCave = curB === 'cave' ? (1 - midT) : (nxtB === 'cave' ? midT : 0);
  const midMountain = curB === 'mountain' ? (1 - midT) : (nxtB === 'mountain' ? midT : 0);
  const midForest = curB === 'forest' ? (1 - midT) : (nxtB === 'forest' ? midT : 0);
  const midTemple = curB === 'temple' ? (1 - midT) : (nxtB === 'temple' ? midT : 0);
  const midVolcano = curB === 'volcano' ? (1 - midT) : (nxtB === 'volcano' ? midT : 0);

  // Helper color interpolator for smooth biome transitions
  const hexToRgb = (hex: string): [number, number, number] => {
    let clean = hex.replace('#', '');
    if (clean.length === 3) {
      clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    }
    const num = parseInt(clean, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };

  const lerpRgb = (c1: [number, number, number], c2: [number, number, number], t: number): string => {
    const clampedT = Math.max(0, Math.min(1, t));
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * clampedT);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * clampedT);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * clampedT);
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Color palettes per biome
  // Meadow: classic vibrant blue sky
  // Coastal: tropical turquoise/aquamarine horizon with bright sun
  // Cave: deep subterranean indigo/slate cavern ambient with mineral glow
  // Mountain: crisp alpine azure to pale icy mountain mist
  // Forest: deep dense emerald canopy to filtered sunlit understory haze
  // Temple: warm radiant golden sunlit sky over ancient ruins
  // Volcano: smoldering dark volcanic sky with crimson magma glow
  const skyPalettes: Record<BiomeType, { top: [number, number, number]; mid: [number, number, number]; low: [number, number, number]; bottom: [number, number, number] }> = {
    meadow: {
      top: [29, 128, 219],
      mid: [80, 171, 255],
      low: [155, 213, 255],
      bottom: [216, 239, 255]
    },
    coastal: {
      top: [14, 116, 184],
      mid: [56, 189, 248],
      low: [125, 225, 250],
      bottom: [224, 247, 255]
    },
    cave: {
      top: [11, 15, 26],
      mid: [19, 27, 46],
      low: [30, 41, 68],
      bottom: [45, 36, 68]
    },
    mountain: {
      top: [15, 64, 122],
      mid: [56, 132, 198],
      low: [156, 202, 235],
      bottom: [222, 238, 250]
    },
    forest: {
      top: [28, 125, 155],
      mid: [65, 175, 165],
      low: [145, 215, 175],
      bottom: [210, 242, 195]
    },
    temple: {
      top: [38, 98, 168],
      mid: [96, 162, 214],
      low: [224, 185, 126],
      bottom: [254, 235, 182]
    },
    volcano: {
      top: [25, 14, 20],
      mid: [62, 24, 26],
      low: [136, 42, 26],
      bottom: [218, 76, 26]
    }
  };

  const curSky = skyPalettes[curB] || skyPalettes.meadow;
  const nxtSky = skyPalettes[nxtB] || skyPalettes.meadow;

  // 1. Sky Gradient - Rich vibrant atmosphere smoothly blending between biomes using skyT
  const skyGrad = ctx.createLinearGradient(0, -100, 0, GAME_H + 150);
  skyGrad.addColorStop(0, lerpRgb(curSky.top, nxtSky.top, skyT));
  skyGrad.addColorStop(0.42, lerpRgb(curSky.mid, nxtSky.mid, skyT));
  skyGrad.addColorStop(0.78, lerpRgb(curSky.low, nxtSky.low, skyT));
  skyGrad.addColorStop(1, lerpRgb(curSky.bottom, nxtSky.bottom, skyT));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(-200, -150, GAME_W + 400, GAME_H + 350);

  // 2. Celestial Body (Sun for Meadow/Coastal/Temple, Volcanic Eclipse for Volcano, Cave Ceilings for Cave)
  if (midCave < 0.9 && midVolcano < 0.85) {
    // Normal Sun with soft coronas (Fades out smoothly when entering subterranean cave or thick volcanic smoke)
    ctx.save();
    ctx.globalAlpha = Math.max(0, (1 - midCave * 1.15) * (1 - midVolcano * 0.9));
    const sunX = 140 - camX * 0.02;
    const sunY = 85;

    // Ambient sun haze
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 15, sunX, sunY, 120);
    sunGlow.addColorStop(0, curB === 'coastal' ? 'rgba(255, 252, 220, 0.95)' : curB === 'temple' ? 'rgba(254, 240, 138, 0.95)' : 'rgba(255, 250, 215, 0.95)');
    sunGlow.addColorStop(0.25, curB === 'coastal' ? 'rgba(254, 240, 138, 0.6)' : curB === 'temple' ? 'rgba(251, 191, 36, 0.65)' : 'rgba(255, 235, 140, 0.55)');
    sunGlow.addColorStop(0.6, curB === 'temple' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 220, 110, 0.18)');
    sunGlow.addColorStop(1, 'rgba(255, 210, 100, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 120, 0, Math.PI * 2);
    ctx.fill();

    // Crisp sun core with bright rim
    const coreGrad = ctx.createRadialGradient(sunX - 4, sunY - 4, 2, sunX, sunY, 26);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.5, curB === 'coastal' ? '#fef9c3' : curB === 'temple' ? '#fef08a' : '#fff7b8');
    coreGrad.addColorStop(1, curB === 'coastal' ? '#facc15' : curB === 'temple' ? '#f59e0b' : '#ffde59');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // TEMPLE SPECIFIC WARM SUNBEAMS & GOD RAYS
  if (midTemple > 0.05 && midCave < 0.9) {
    ctx.save();
    ctx.globalAlpha = midTemple * (1 - midCave) * 0.35;
    const tSunX = 140 - camX * 0.02;
    // Radiant golden volumetric sun rays slanting down across the sky
    for (let r = 0; r < 5; r++) {
      const rx = tSunX - 120 + r * 85;
      const rayGrad = ctx.createLinearGradient(tSunX, 85, rx + 160, GAME_H);
      rayGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
      rayGrad.addColorStop(0.5, 'rgba(253, 224, 71, 0.18)');
      rayGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(tSunX, 85);
      ctx.lineTo(rx, GAME_H + 40);
      ctx.lineTo(rx + 50, GAME_H + 40);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // VOLCANO SPECIFIC SMOLDERING ASH SUN & CORONA
  if (midVolcano > 0.05 && midCave < 0.9) {
    ctx.save();
    ctx.globalAlpha = midVolcano * (1 - midCave);
    const volSunX = 200 - camX * 0.018;
    const volSunY = 85;

    // Glowing magma haze / fiery corona
    const volHaze = ctx.createRadialGradient(volSunX, volSunY, 15, volSunX, volSunY, 140);
    volHaze.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
    volHaze.addColorStop(0.35, 'rgba(249, 115, 22, 0.45)');
    volHaze.addColorStop(0.7, 'rgba(185, 28, 28, 0.18)');
    volHaze.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = volHaze;
    ctx.beginPath();
    ctx.arc(volSunX, volSunY, 140, 0, Math.PI * 2);
    ctx.fill();

    // Smoldering sun core (deep incandescent crimson and burning yellow rim)
    const volCore = ctx.createRadialGradient(volSunX - 3, volSunY - 3, 2, volSunX, volSunY, 26);
    volCore.addColorStop(0, '#fef08a');
    volCore.addColorStop(0.3, '#f97316');
    volCore.addColorStop(0.75, '#dc2626');
    volCore.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = volCore;
    ctx.beginPath();
    ctx.arc(volSunX, volSunY, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // CAVE SPECIFIC BACKGROUND ELEMENTS:
  if (midCave > 0.05) {
    ctx.save();
    ctx.globalAlpha = midCave;

    // Subterranean Upper Rock Ceiling & Stalactites descending naturally into view
    const ceilingOffsetY = (1 - midCave) * -70;
    const ceilingGrad = ctx.createLinearGradient(0, -60 + ceilingOffsetY, 0, 140 + ceilingOffsetY);
    ceilingGrad.addColorStop(0, '#090d16');
    ceilingGrad.addColorStop(0.6, '#141d2d');
    ceilingGrad.addColorStop(1, 'rgba(20, 29, 45, 0)');
    ctx.fillStyle = ceilingGrad;
    ctx.fillRect(-200, -80 + ceilingOffsetY, GAME_W + 400, 220);

    // Stalactite rock formations hanging from top
    ctx.fillStyle = '#101726';
    for (let cx = -100; cx < GAME_W + 200; cx += 45) {
      const worldX = cx + camX * 0.08;
      const stalactiteH = 40 + Math.sin(worldX * 0.015) * 25 + Math.cos(worldX * 0.035) * 15;
      ctx.beginPath();
      ctx.moveTo(cx, -40);
      ctx.lineTo(cx + 22, -40);
      ctx.lineTo(cx + 11, stalactiteH);
      ctx.closePath();
      ctx.fill();

      // Glowing crystal tip on some stalactites
      if (Math.abs(Math.sin(worldX * 0.04)) > 0.45) {
        const glowPulse = 0.6 + Math.sin(time * 3 + worldX * 0.05) * 0.35;
        const crystalColor = Math.sin(worldX * 0.01) > 0 ? '#38bdf8' : '#c084fc';
        ctx.fillStyle = crystalColor;
        ctx.shadowColor = crystalColor;
        ctx.shadowBlur = 10 * glowPulse;
        ctx.beginPath();
        ctx.moveTo(cx + 11, stalactiteH - 4);
        ctx.lineTo(cx + 15, stalactiteH + 7);
        ctx.lineTo(cx + 11, stalactiteH + 15);
        ctx.lineTo(cx + 7, stalactiteH + 7);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#101726';
      }
    }

    // Distant cave cavern rock arches & massive silhouettes
    const archGrad = ctx.createLinearGradient(0, 160, 0, GAME_H);
    archGrad.addColorStop(0, '#131b2e');
    archGrad.addColorStop(1, '#0b0f1a');
    ctx.fillStyle = archGrad;
    ctx.beginPath();
    ctx.moveTo(-160, GAME_H + 160);
    for (let x = -160; x <= GAME_W + 240; x += 70) {
      const worldX = x + camX * 0.06;
      const cy = 270 + Math.sin(worldX * 0.003) * 60 + Math.cos(worldX * 0.007) * 40;
      ctx.lineTo(x, cy);
    }
    ctx.lineTo(GAME_W + 240, GAME_H + 160);
    ctx.closePath();
    ctx.fill();

    // Large glowing amethyst & cyan crystal formations in background
    for (let x = -80; x <= GAME_W + 120; x += 160) {
      const worldX = x + camX * 0.12;
      const crystalX = x;
      const crystalY = 320 + Math.sin(worldX * 0.005) * 45;
      const crystalType = Math.abs(Math.sin(worldX)) > 0.5 ? '#a855f7' : '#06b6d4';
      const cGrad = ctx.createLinearGradient(crystalX - 10, crystalY, crystalX + 10, crystalY - 50);
      cGrad.addColorStop(0, crystalType);
      cGrad.addColorStop(1, '#ffffff');

      ctx.save();
      ctx.fillStyle = cGrad;
      ctx.shadowColor = crystalType;
      ctx.shadowBlur = 14 + Math.sin(time * 2 + worldX) * 5;
      ctx.beginPath();
      ctx.moveTo(crystalX, crystalY);
      ctx.lineTo(crystalX - 10, crystalY - 15);
      ctx.lineTo(crystalX, crystalY - 48);
      ctx.lineTo(crystalX + 10, crystalY - 15);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  // 3. Distant Mountains / Coastal Ocean Horizon / Cave Silhouettes
  if (distantCoastal > 0.02 && distantCave < 0.92) {
    // OCEAN & COASTAL SCENERY: Distant open sea, islands, and gentle animated sea waves!
    ctx.save();
    ctx.globalAlpha = distantCoastal * (1 - distantCave);

    // Distant Tropical Sea Horizon (starts at Y ~275)
    const seaY = 275;
    const seaGrad = ctx.createLinearGradient(0, seaY, 0, GAME_H + 100);
    seaGrad.addColorStop(0, '#0284c7');
    seaGrad.addColorStop(0.35, '#0369a1');
    seaGrad.addColorStop(0.7, '#075985');
    seaGrad.addColorStop(1, '#0c4a6e');
    ctx.fillStyle = seaGrad;
    ctx.fillRect(-160, seaY, GAME_W + 320, GAME_H + 100 - seaY);

    // Distant Tropical Rock Island formations on the ocean horizon
    ctx.fillStyle = '#0f766e';
    for (let x = -100; x <= GAME_W + 180; x += 190) {
      const worldX = x + camX * 0.03;
      const islandW = 110;
      const islandH = 34 + Math.sin(worldX * 0.004) * 16;
      ctx.beginPath();
      ctx.ellipse(x, seaY + 4, islandW * 0.5, islandH, 0, Math.PI, 0);
      ctx.fill();

      // Island palm tuft silhouette
      ctx.fillStyle = '#044e46';
      ctx.beginPath();
      ctx.arc(x + 12, seaY - islandH + 2, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f766e';
    }

    // Animated shimmering ocean wave layers (blend with midground factor)
    const waveAlpha = Math.min(1, midCoastal * 1.6);
    for (let w = 0; w < 4; w++) {
      const waveY = seaY + 12 + w * 28;
      const waveSpeed = 1.4 + w * 0.5;
      const wavePhase = time * waveSpeed;
      const waveAmp = 3.5 + w * 1.5;

      ctx.strokeStyle = w % 2 === 0 ? `rgba(255, 255, 255, ${0.45 * waveAlpha})` : `rgba(186, 230, 253, ${0.6 * waveAlpha})`;
      ctx.lineWidth = 2.2 + w * 0.5;
      ctx.beginPath();
      ctx.moveTo(-100, waveY);
      for (let x = -100; x <= GAME_W + 150; x += 35) {
        const wx = x + camX * (0.05 + w * 0.02);
        const y = waveY + Math.sin(wx * 0.025 + wavePhase) * waveAmp;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Distant fluffy seabirds gliding
    for (let b = 0; b < 3; b++) {
      const birdX = ((b * 320 + time * 35 - camX * 0.08) % (GAME_W + 200)) - 100;
      const birdY = 130 + Math.sin(time * 2 + b) * 18 + b * 25;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.75 * waveAlpha})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(birdX - 6, birdY, 7, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(birdX + 6, birdY, 7, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }

    ctx.restore();
  }

  // 3b. Distant High-Alpine Mountain Range (Dedicated Mountain Biome)
  if (distantMountain > 0.02 && distantCave < 0.92) {
    ctx.save();
    ctx.globalAlpha = distantMountain * (1 - distantCave);

    // 1. High-Altitude Atmospheric Alpine Haze & Sunlit Horizon Glow
    const alpineHaze = ctx.createLinearGradient(0, 80, 0, 340);
    alpineHaze.addColorStop(0, 'rgba(219, 234, 254, 0.28)');
    alpineHaze.addColorStop(0.55, 'rgba(191, 219, 254, 0.22)');
    alpineHaze.addColorStop(1, 'rgba(241, 245, 249, 0)');
    ctx.fillStyle = alpineHaze;
    ctx.fillRect(0, 50, GAME_W, 290);

    // 2. LAYER 1: Far High-Glacier Massifs & Majestic Snow Summits (Parallax: 0.022)
    const farGlacierGrad = ctx.createLinearGradient(0, 110, 0, GAME_H + 120);
    farGlacierGrad.addColorStop(0, '#7790b0');
    farGlacierGrad.addColorStop(0.35, '#a4bccc');
    farGlacierGrad.addColorStop(0.7, '#d3e2ee');
    farGlacierGrad.addColorStop(1, '#edf4f9');
    ctx.fillStyle = farGlacierGrad;

    ctx.beginPath();
    ctx.moveTo(-180, GAME_H + 160);
    const step1 = 28;
    for (let x = -180; x <= GAME_W + 220; x += step1) {
      const worldX = x + camX * 0.022;
      // Natural organic harmonic mountain profile: broad massifs, sharp peaks, and gentle passes
      const broadMassif = Math.sin(worldX * 0.0024) * 82;
      const primaryPeak = Math.cos(worldX * 0.0062 + 1.1) * 48;
      const cragRidge = Math.sin(worldX * 0.0135) * 22;
      const subSpur = Math.abs(Math.cos(worldX * 0.024)) * 14;
      const my = 145 + broadMassif + primaryPeak + cragRidge - subSpur;
      ctx.lineTo(x, my);
    }
    ctx.lineTo(GAME_W + 220, GAME_H + 160);
    ctx.closePath();
    ctx.fill();

    // Natural Organic Snow Caps & Couloirs on High Summits (Layer 1)
    for (let x = -160; x <= GAME_W + 200; x += 55) {
      const worldX = x + camX * 0.022;
      const broadMassif = Math.sin(worldX * 0.0024) * 82;
      const primaryPeak = Math.cos(worldX * 0.0062 + 1.1) * 48;
      const cragRidge = Math.sin(worldX * 0.0135) * 22;
      const my = 145 + broadMassif + primaryPeak + cragRidge;

      // Draw snow drapes on summits and high shoulders
      if (my < 185) {
        const snowW = 44 + Math.sin(worldX * 0.01) * 16;
        const snowH = (195 - my) * 0.72 + 12;

        // Shadowed cool snow couloir backing
        ctx.fillStyle = 'rgba(203, 213, 225, 0.75)';
        ctx.beginPath();
        ctx.moveTo(x, my);
        ctx.lineTo(x - snowW * 0.5, my + snowH * 0.85);
        ctx.lineTo(x - snowW * 0.25, my + snowH);
        ctx.lineTo(x, my + snowH * 0.65);
        ctx.lineTo(x + snowW * 0.25, my + snowH);
        ctx.lineTo(x + snowW * 0.5, my + snowH * 0.85);
        ctx.closePath();
        ctx.fill();

        // Sunlit crisp white snow face
        ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
        ctx.beginPath();
        ctx.moveTo(x, my);
        ctx.lineTo(x - snowW * 0.45, my + snowH * 0.7);
        ctx.lineTo(x - snowW * 0.18, my + snowH * 0.88);
        ctx.lineTo(x - snowW * 0.05, my + snowH * 0.45);
        ctx.lineTo(x + snowW * 0.2, my + snowH * 0.75);
        ctx.lineTo(x + snowW * 0.42, my + snowH * 0.65);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 3. LAYER 2: Drifting Alpine Sea-of-Clouds / Valley Inversion Layer (Parallax: 0.038)
    ctx.fillStyle = 'rgba(241, 245, 249, 0.42)';
    for (let m = 0; m < 4; m++) {
      const driftX = (m * 290 - camX * 0.038 + time * 6) % (GAME_W + 360) - 140;
      const driftY = 220 + (m % 2) * 26 + Math.sin(time * 0.6 + m) * 6;
      ctx.beginPath();
      ctx.ellipse(driftX, driftY, 150, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(driftX + 60, driftY - 6, 110, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. LAYER 3: Mid-Distance Rugged Granite & Slate Ridge with Faceted Crags (Parallax: 0.054)
    const midRidgeGrad = ctx.createLinearGradient(0, 170, 0, GAME_H + 150);
    midRidgeGrad.addColorStop(0, '#334155');
    midRidgeGrad.addColorStop(0.45, '#475569');
    midRidgeGrad.addColorStop(0.85, '#64748b');
    midRidgeGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = midRidgeGrad;

    ctx.beginPath();
    ctx.moveTo(-180, GAME_H + 160);
    const step2 = 32;
    for (let x = -180; x <= GAME_W + 220; x += step2) {
      const worldX = x + camX * 0.054;
      const ridgeBase = Math.sin(worldX * 0.0048 + 2.3) * 58;
      const ridgeJag = Math.cos(worldX * 0.0125 + 0.8) * 34;
      const arêteFissure = Math.sin(worldX * 0.028) * 16;
      const my = 205 + ridgeBase + ridgeJag + arêteFissure;
      ctx.lineTo(x, my);
    }
    ctx.lineTo(GAME_W + 220, GAME_H + 160);
    ctx.closePath();
    ctx.fill();

    // Sunlit Left-Facing Rock Ribs & Snow Pockets (Layer 3)
    for (let x = -150; x <= GAME_W + 180; x += 68) {
      const worldX = x + camX * 0.054;
      const ridgeBase = Math.sin(worldX * 0.0048 + 2.3) * 58;
      const ridgeJag = Math.cos(worldX * 0.0125 + 0.8) * 34;
      const my = 205 + ridgeBase + ridgeJag;

      // Illuminated rock facet on left ridge slope
      ctx.fillStyle = 'rgba(148, 163, 184, 0.38)';
      ctx.beginPath();
      ctx.moveTo(x, my);
      ctx.lineTo(x - 24, my + 38);
      ctx.lineTo(x - 10, my + 44);
      ctx.lineTo(x + 2, my + 18);
      ctx.closePath();
      ctx.fill();

      // Delicate snow pockets in ridge saddles
      if (Math.sin(worldX * 0.015) > 0.15) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
        ctx.beginPath();
        ctx.moveTo(x - 12, my + 14);
        ctx.quadraticCurveTo(x, my + 8, x + 14, my + 16);
        ctx.lineTo(x + 10, my + 24);
        ctx.quadraticCurveTo(x, my + 18, x - 10, my + 22);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 5. LAYER 4: Near-Distant Rugged Foothills & Alpine Pine Silhouette (Parallax: 0.088)
    const foothillGrad = ctx.createLinearGradient(0, 230, 0, GAME_H + 150);
    foothillGrad.addColorStop(0, '#1e293b');
    foothillGrad.addColorStop(0.65, '#334155');
    foothillGrad.addColorStop(1, '#475569');
    ctx.fillStyle = foothillGrad;

    ctx.beginPath();
    ctx.moveTo(-180, GAME_H + 160);
    const step3 = 36;
    for (let x = -180; x <= GAME_W + 220; x += step3) {
      const worldX = x + camX * 0.088;
      const footH = Math.sin(worldX * 0.0065 + 1.4) * 44 + Math.cos(worldX * 0.018) * 22;
      const my = 265 + footH;
      ctx.lineTo(x, my);
    }
    ctx.lineTo(GAME_W + 220, GAME_H + 160);
    ctx.closePath();
    ctx.fill();

    // Subtle alpine conifer serration texture along foothill horizon
    ctx.fillStyle = '#1e293b';
    for (let x = -140; x <= GAME_W + 180; x += 18) {
      const worldX = x + camX * 0.088;
      const footH = Math.sin(worldX * 0.0065 + 1.4) * 44 + Math.cos(worldX * 0.018) * 22;
      const my = 265 + footH;
      const treeH = 6 + Math.abs(Math.sin(worldX * 0.08)) * 8;
      ctx.beginPath();
      ctx.moveTo(x, my + 2);
      ctx.lineTo(x + 4, my - treeH);
      ctx.lineTo(x + 8, my + 2);
      ctx.closePath();
      ctx.fill();
    }

    // High Cirrus Alpine Mist Ribbons
    ctx.fillStyle = 'rgba(241, 245, 249, 0.28)';
    for (let m = 0; m < 2; m++) {
      const mistY = 175 + m * 55;
      ctx.beginPath();
      ctx.ellipse(GAME_W * 0.5 + Math.sin(time * 0.5 + m * 2) * 70, mistY, GAME_W * 0.6, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // 3c. Distant Layered Forest Silhouettes, Rolling Woodland Ridges & Soft Filtered Sunbeams
  if (distantForest > 0.02 && distantCave < 0.92) {
    ctx.save();
    ctx.globalAlpha = distantForest * (1 - distantCave);

    // Warm, gentle filtered sunlight glow in the upper forest atmosphere (soft cartoon ambient, no harsh geometric triangles)
    const sunGlow = ctx.createRadialGradient(GAME_W * 0.45, 60, 20, GAME_W * 0.45, 160, 360);
    sunGlow.addColorStop(0, 'rgba(254, 240, 138, 0.18)');
    sunGlow.addColorStop(0.5, 'rgba(220, 252, 231, 0.09)');
    sunGlow.addColorStop(1, 'rgba(220, 252, 231, 0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // Soft, gentle cartoon sunbeams filtering down
    const rayAlpha = Math.min(0.12, distantForest * 0.15);
    ctx.fillStyle = `rgba(254, 249, 195, ${rayAlpha})`;
    for (let r = 0; r < 4; r++) {
      const rx = 100 + r * 220 - ((camX * 0.02) % 240);
      ctx.beginPath();
      ctx.moveTo(rx, 30);
      ctx.lineTo(rx + 65, 30);
      ctx.lineTo(rx + 150, GAME_H * 0.75);
      ctx.lineTo(rx + 50, GAME_H * 0.75);
      ctx.closePath();
      ctx.fill();
    }

    // LAYER 1: Far Rolling Forest Ridge with dense tiny rounded cartoon canopy silhouette (Parallax 0.035)
    const farRidgeGrad = ctx.createLinearGradient(0, 190, 0, GAME_H + 120);
    farRidgeGrad.addColorStop(0, '#2d6a4f');
    farRidgeGrad.addColorStop(0.5, '#40916c');
    farRidgeGrad.addColorStop(1, '#74c69d');
    ctx.fillStyle = farRidgeGrad;

    ctx.beginPath();
    ctx.moveTo(-160, GAME_H + 160);
    for (let x = -160; x <= GAME_W + 240; x += 35) {
      const worldX = x + camX * 0.035;
      // Gentle rolling hill slope
      const hillBase = 240 + Math.sin(worldX * 0.003) * 35 + Math.cos(worldX * 0.008) * 18;
      // Scalloped cartoon tree-top bumps on the ridge
      const canopyBump = Math.sin(worldX * 0.07) * 7 + Math.sin(worldX * 0.13) * 4;
      ctx.lineTo(x, hillBase - Math.abs(canopyBump));
    }
    ctx.lineTo(GAME_W + 240, GAME_H + 160);
    ctx.closePath();
    ctx.fill();

    // LAYER 2: Mid-Distant Forest Canopy Hills with distinct cute tree crowns (Parallax 0.07)
    const midRidgeGrad = ctx.createLinearGradient(0, 240, 0, GAME_H + 120);
    midRidgeGrad.addColorStop(0, '#1b4332');
    midRidgeGrad.addColorStop(0.45, '#2d6a4f');
    midRidgeGrad.addColorStop(1, '#52b788');
    ctx.fillStyle = midRidgeGrad;

    ctx.beginPath();
    ctx.moveTo(-160, GAME_H + 160);
    for (let x = -160; x <= GAME_W + 240; x += 40) {
      const worldX = x + camX * 0.07;
      const hillBase = 275 + Math.sin(worldX * 0.004 + 1.2) * 42 + Math.cos(worldX * 0.01) * 20;
      const treeTop = Math.abs(Math.sin(worldX * 0.05)) * 12 + Math.sin(worldX * 0.11) * 6;
      ctx.lineTo(x, hillBase - treeTop);
    }
    ctx.lineTo(GAME_W + 240, GAME_H + 160);
    ctx.closePath();
    ctx.fill();

    // Tiny distant cartoon tree silhouettes dotted along the mid-distance ridge crests
    ctx.fillStyle = '#1b4332';
    for (let x = -120; x <= GAME_W + 200; x += 75) {
      const worldX = x + camX * 0.07;
      const seed = Math.sin(Math.floor(worldX / 75) * 53.1) * 43758.5453;
      const rand = seed - Math.floor(seed);
      if (rand > 0.3) {
        const hillBase = 275 + Math.sin(worldX * 0.004 + 1.2) * 42 + Math.cos(worldX * 0.01) * 20;
        const treeR = 9 + rand * 8;
        // Tiny rounded crown
        ctx.beginPath();
        ctx.arc(x, hillBase - treeR, treeR, 0, Math.PI * 2);
        ctx.arc(x - treeR * 0.5, hillBase - treeR * 0.7, treeR * 0.7, 0, Math.PI * 2);
        ctx.arc(x + treeR * 0.5, hillBase - treeR * 0.7, treeR * 0.7, 0, Math.PI * 2);
        ctx.fill();
        // Tiny stem trunk
        ctx.fillRect(x - 1.5, hillBase - treeR * 0.6, 3, treeR * 0.6);
      }
    }

    // Drifting gentle forest pollen / leaf spores (adds charming woodland atmosphere)
    for (let p = 0; p < 8; p++) {
      const px = ((p * 140 + time * 18 - camX * 0.05) % (GAME_W + 80)) - 40;
      const py = 120 + ((p * 45 + Math.sin(time * 1.5 + p) * 25) % (GAME_H * 0.55));
      ctx.fillStyle = p % 2 === 0 ? 'rgba(253, 230, 138, 0.45)' : 'rgba(167, 243, 208, 0.4)';
      ctx.beginPath();
      ctx.arc(px, py, 1.8 + (p % 3) * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // 3d. Distant Ancient Temple Ruins Silhouettes, Layered Ziggurats & Grand Colonnades
  if (distantTemple > 0.02 && distantCave < 0.92) {
    ctx.save();
    ctx.globalAlpha = distantTemple * (1 - distantCave);

    // Warm golden atmospheric horizon glow
    const templeHaze = ctx.createLinearGradient(0, 130, 0, GAME_H);
    templeHaze.addColorStop(0, 'rgba(254, 240, 138, 0.16)');
    templeHaze.addColorStop(0.5, 'rgba(251, 191, 36, 0.08)');
    templeHaze.addColorStop(1, 'rgba(217, 119, 6, 0)');
    ctx.fillStyle = templeHaze;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // LAYER 1: Far Mountain Foothills & Monumental Stepped Ziggurat Silhouettes (Parallax 0.032)
    const farTempleGrad = ctx.createLinearGradient(0, 180, 0, GAME_H + 120);
    farTempleGrad.addColorStop(0, 'rgba(180, 130, 85, 0.85)');
    farTempleGrad.addColorStop(0.5, 'rgba(210, 165, 115, 0.92)');
    farTempleGrad.addColorStop(1, 'rgba(240, 205, 160, 0.98)');
    ctx.fillStyle = farTempleGrad;

    ctx.beginPath();
    ctx.moveTo(-160, GAME_H + 160);
    for (let x = -160; x <= GAME_W + 240; x += 40) {
      const worldX = x + camX * 0.032;
      const baseRidge = 250 + Math.sin(worldX * 0.003) * 30 + Math.cos(worldX * 0.007) * 18;
      ctx.lineTo(x, baseRidge);
    }
    ctx.lineTo(GAME_W + 240, GAME_H + 160);
    ctx.closePath();
    ctx.fill();

    // Colossal Stepped Ziggurat Temple silhouettes along the far ridge
    for (let zx = -100; zx <= GAME_W + 200; zx += 320) {
      const worldX = zx + camX * 0.032;
      const zY = 230 + Math.sin(worldX * 0.003) * 20;
      // 3 Tiered Stepped Sanctuary
      ctx.fillRect(zx - 50, zY - 14, 100, 16);
      ctx.fillRect(zx - 36, zY - 26, 72, 14);
      ctx.fillRect(zx - 22, zY - 36, 44, 12);
      // Top temple shrine / portal
      ctx.fillRect(zx - 12, zY - 46, 24, 12);
      ctx.beginPath();
      ctx.moveTo(zx - 15, zY - 46);
      ctx.lineTo(zx, zY - 54);
      ctx.lineTo(zx + 15, zY - 46);
      ctx.closePath();
      ctx.fill();
    }

    // LAYER 2: Mid-Distant Weathered Colonnades, Arches & Broken Architraves (Parallax 0.065)
    const midTempleGrad = ctx.createLinearGradient(0, 220, 0, GAME_H + 120);
    midTempleGrad.addColorStop(0, '#a8784e');
    midTempleGrad.addColorStop(0.45, '#c29368');
    midTempleGrad.addColorStop(1, '#dbb58f');
    ctx.fillStyle = midTempleGrad;

    ctx.beginPath();
    ctx.moveTo(-160, GAME_H + 160);
    for (let x = -160; x <= GAME_W + 240; x += 35) {
      const worldX = x + camX * 0.065;
      const hillBase = 280 + Math.sin(worldX * 0.004 + 0.8) * 36;
      ctx.lineTo(x, hillBase);
    }
    ctx.lineTo(GAME_W + 240, GAME_H + 160);
    ctx.closePath();
    ctx.fill();

    // Distant Grand Ruins: standing columns, shattered pillars, and ruined stone archways
    for (let rx = -120; rx <= GAME_W + 200; rx += 140) {
      const worldX = rx + camX * 0.065;
      const slot = Math.floor(worldX / 140);
      const seed = Math.sin(slot * 43.7 + 19.3) * 43758.5453;
      const rand = seed - Math.floor(seed);
      const rY = 280 + Math.sin(worldX * 0.004 + 0.8) * 36;

      if (rand < 0.4) {
        // Colonnade of 3 fluted pillars with broken architrave
        ctx.fillRect(rx - 28, rY - 44, 9, 44);
        ctx.fillRect(rx - 4, rY - 44, 9, 44);
        ctx.fillRect(rx + 20, rY - 32, 9, 32); // Broken pillar
        // Lintel architrave slab on top of the first two
        ctx.fillRect(rx - 32, rY - 50, 44, 8);
      } else if (rand < 0.75) {
        // Ruined Monumental Archway
        ctx.fillRect(rx - 22, rY - 52, 10, 52);
        ctx.fillRect(rx + 12, rY - 52, 10, 52);
        // Arch lintel & pediment
        ctx.fillRect(rx - 25, rY - 60, 50, 9);
        ctx.beginPath();
        ctx.moveTo(rx - 26, rY - 60);
        ctx.lineTo(rx, rY - 70);
        ctx.lineTo(rx + 26, rY - 60);
        ctx.closePath();
        ctx.fill();
      } else {
        // Solitary tall obelisk / monumental pillar with stepped base
        ctx.fillRect(rx - 14, rY - 6, 28, 6);
        ctx.fillRect(rx - 10, rY - 12, 20, 6);
        ctx.fillRect(rx - 5, rY - 52, 10, 42);
        ctx.beginPath();
        ctx.moveTo(rx - 6, rY - 52);
        ctx.lineTo(rx, rY - 62);
        ctx.lineTo(rx + 6, rY - 52);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Drifting warm golden dust motes in the temple sunlight
    for (let m = 0; m < 9; m++) {
      const mx = ((m * 125 + time * 14 - camX * 0.04) % (GAME_W + 80)) - 40;
      const my = 100 + ((m * 38 + Math.sin(time * 1.8 + m) * 20) % (GAME_H * 0.6));
      ctx.fillStyle = 'rgba(253, 224, 71, 0.45)';
      ctx.beginPath();
      ctx.arc(mx, my, 1.6 + (m % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // 3e. Distant Volcanic Area Peaks, Smoking Calderas & Magma Fissures
  if (distantVolcano > 0.02 && distantCave < 0.92) {
    ctx.save();
    ctx.globalAlpha = distantVolcano * (1 - distantCave);

    // Deep volcanic smolder haze on horizon
    const volAtmosphere = ctx.createLinearGradient(0, 120, 0, GAME_H);
    volAtmosphere.addColorStop(0, 'rgba(220, 38, 38, 0.15)');
    volAtmosphere.addColorStop(0.4, 'rgba(249, 115, 22, 0.12)');
    volAtmosphere.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
    ctx.fillStyle = volAtmosphere;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // LAYER 1: Far Towering Volcanic Cones & Smoking Calderas (Parallax 0.028)
    const farVolGrad = ctx.createLinearGradient(0, 160, 0, GAME_H + 120);
    farVolGrad.addColorStop(0, '#3b1218');
    farVolGrad.addColorStop(0.4, '#241016');
    farVolGrad.addColorStop(1, '#180c10');
    ctx.fillStyle = farVolGrad;

    ctx.beginPath();
    ctx.moveTo(-160, GAME_H + 160);
    for (let x = -160; x <= GAME_W + 240; x += 30) {
      const worldX = x + camX * 0.028;
      // Jagged volcanic peaks with caldera scoops
      const volcanoBase = 240 + Math.sin(worldX * 0.003) * 45 + Math.sin(worldX * 0.012) * 22;
      ctx.lineTo(x, volcanoBase);
    }
    ctx.lineTo(GAME_W + 240, GAME_H + 160);
    ctx.closePath();
    ctx.fill();

    // Billowing smoke plumes rising from distant caldera vents
    for (let vx = -60; vx <= GAME_W + 180; vx += 280) {
      const worldX = vx + camX * 0.028;
      const ventY = 205 + Math.sin(worldX * 0.003) * 35;
      
      // Magma caldera rim glow
      const rimGlow = ctx.createRadialGradient(vx, ventY, 2, vx, ventY, 22);
      rimGlow.addColorStop(0, 'rgba(254, 240, 138, 0.7)');
      rimGlow.addColorStop(0.4, 'rgba(249, 115, 22, 0.5)');
      rimGlow.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = rimGlow;
      ctx.beginPath();
      ctx.arc(vx, ventY, 22, 0, Math.PI * 2);
      ctx.fill();

      // Billowing smoke puffs rising into the sky
      for (let s = 0; s < 5; s++) {
        const puffTime = (time * 0.8 + s * 0.7) % 3.5;
        const puffFrac = puffTime / 3.5;
        const puffY = ventY - puffFrac * 110;
        const puffX = vx + Math.sin(puffTime * 1.5 + s) * 14 + puffFrac * 22;
        const puffR = 10 + puffFrac * 24;
        const puffAlpha = (1 - puffFrac) * 0.35;
        ctx.fillStyle = `rgba(45, 30, 35, ${puffAlpha})`;
        ctx.beginPath();
        ctx.arc(puffX, puffY, puffR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // LAYER 2: Mid-Distant Basalt Ridges & Glowing Magma Rivers (Parallax 0.055)
    const midVolGrad = ctx.createLinearGradient(0, 210, 0, GAME_H + 120);
    midVolGrad.addColorStop(0, '#261317');
    midVolGrad.addColorStop(0.5, '#1b0e12');
    midVolGrad.addColorStop(1, '#0f0709');
    ctx.fillStyle = midVolGrad;

    ctx.beginPath();
    ctx.moveTo(-160, GAME_H + 160);
    for (let x = -160; x <= GAME_W + 240; x += 35) {
      const worldX = x + camX * 0.055;
      const ridgeY = 270 + Math.sin(worldX * 0.005 + 1.4) * 40 + Math.cos(worldX * 0.015) * 15;
      ctx.lineTo(x, ridgeY);
    }
    ctx.lineTo(GAME_W + 240, GAME_H + 160);
    ctx.closePath();
    ctx.fill();

    // Incandescent glowing magma veins streaming down the ridges
    for (let x = -100; x <= GAME_W + 160; x += 90) {
      const worldX = x + camX * 0.055;
      const ridgeY = 270 + Math.sin(worldX * 0.005 + 1.4) * 40 + Math.cos(worldX * 0.015) * 15;
      const pulse = 0.7 + Math.sin(time * 3 + worldX * 0.04) * 0.3;

      ctx.strokeStyle = `rgba(249, 115, 22, ${0.75 * pulse})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x - 8, ridgeY + 5);
      ctx.quadraticCurveTo(x + 4, ridgeY + 22, x - 2, ridgeY + 45);
      ctx.stroke();

      // Hot core of magma stream
      ctx.strokeStyle = `rgba(254, 240, 138, ${0.85 * pulse})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - 8, ridgeY + 5);
      ctx.quadraticCurveTo(x + 4, ridgeY + 22, x - 2, ridgeY + 45);
      ctx.stroke();
    }

    // Floating fiery ember motes rising through the volcanic air
    for (let em = 0; em < 12; em++) {
      const ex = ((em * 95 + time * 26 - camX * 0.06) % (GAME_W + 80)) - 40;
      const ey = GAME_H - ((em * 42 + time * 32) % (GAME_H * 0.75));
      const epulse = 0.5 + Math.sin(time * 6 + em) * 0.5;
      ctx.fillStyle = em % 3 === 0 ? `rgba(254, 240, 138, ${epulse})` : `rgba(249, 115, 22, ${epulse})`;
      ctx.beginPath();
      ctx.arc(ex, ey, 1.4 + (em % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // 3f. Distant Meadow Mountains (Default when not Coastal, Cave, Mountain, Forest, Temple, or Volcano)
  const meadowIntensity = Math.max(0, 1 - distantCoastal - distantCave - distantMountain - distantForest - distantTemple - distantVolcano);
  if (meadowIntensity > 0.02) {
    ctx.save();
    ctx.globalAlpha = meadowIntensity;

    // Far Mountains (hazy lavender-blue)
    const farMtnGrad = ctx.createLinearGradient(0, 200, 0, GAME_H + 150);
    farMtnGrad.addColorStop(0, 'rgba(145, 175, 215, 0.7)');
    farMtnGrad.addColorStop(1, 'rgba(195, 220, 245, 0.9)');
    ctx.fillStyle = farMtnGrad;
    ctx.beginPath();
    ctx.moveTo(-160, GAME_H + 160);
    for (let x = -160; x <= GAME_W + 240; x += 60) {
      const worldX = x + camX * 0.04;
      const my = 260 + Math.sin(worldX * 0.002) * 75 + Math.cos(worldX * 0.005) * 45;
      ctx.lineTo(x, my);
    }
    ctx.lineTo(GAME_W + 240, GAME_H + 160);
    ctx.closePath();
    ctx.fill();

    // Near Mountains (richer slate blue with ridge highlights)
    const nearMtnGrad = ctx.createLinearGradient(0, 240, 0, GAME_H + 150);
    nearMtnGrad.addColorStop(0, '#7599c2');
    nearMtnGrad.addColorStop(0.7, '#92b4d8');
    nearMtnGrad.addColorStop(1, '#b7d4ee');
    ctx.fillStyle = nearMtnGrad;
    ctx.beginPath();
    ctx.moveTo(-160, GAME_H + 160);
    for (let x = -160; x <= GAME_W + 240; x += 80) {
      const worldX = x + camX * 0.08;
      const my = 290 + Math.sin(worldX * 0.0035 + 1.2) * 55 + Math.cos(worldX * 0.008) * 35;
      ctx.lineTo(x, my);
    }
    ctx.lineTo(GAME_W + 240, GAME_H + 160);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 4. Clouds (Outdoor Biomes only, fades out entering cave)
  if (midCave < 0.88) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - midCave * 1.15);
    clouds.forEach(c => {
      const drawX = c.x - camX * 0.18;
      if (drawX > -180 && drawX < GAME_W + 180) {
        const cw = c.width || 90;
        const ch = c.height || 36;
        const cy = c.y;

        // Cloud underside soft shadow
        ctx.fillStyle = curB === 'coastal' ? 'rgba(175, 220, 245, 0.75)' : 'rgba(185, 210, 238, 0.75)';
        ctx.beginPath();
        ctx.ellipse(drawX, cy + 5, cw * 0.48, ch * 0.42, 0, 0, Math.PI * 2);
        ctx.ellipse(drawX - cw * 0.24, cy + 8, cw * 0.32, ch * 0.4, 0, 0, Math.PI * 2);
        ctx.ellipse(drawX + cw * 0.24, cy + 8, cw * 0.32, ch * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cloud sunlit body
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.ellipse(drawX, cy, cw * 0.45, ch * 0.45, 0, 0, Math.PI * 2);
        ctx.ellipse(drawX - cw * 0.24, cy + 2, cw * 0.3, ch * 0.42, 0, 0, Math.PI * 2);
        ctx.ellipse(drawX + cw * 0.24, cy + 2, cw * 0.3, ch * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();

        // Top sun highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.ellipse(drawX - 4, cy - ch * 0.2, cw * 0.28, ch * 0.22, -0.1, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
  }

  // 5. Rolling Hills, Dunes, Mountain Talus, or Forest Mounds
  if (midCave < 0.92) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - midCave);
    hills.forEach(h => {
      const drawX = h.x - camX * 0.4;
      const hr = h.radius || 180;
      if (drawX > -hr - 50 && drawX < GAME_W + hr + 50) {
        // Continuous color blending between lush green meadow hill, coastal turquoise dune, mountain slate, and deep forest
        const hillGrad = ctx.createRadialGradient(
          drawX - hr * 0.35,
          h.y - hr * 0.55,
          hr * 0.1,
          drawX,
          h.y,
          hr
        );

        let cTop = lerpRgb([117, 203, 88], [56, 189, 248], midCoastal);
        let cMid = lerpRgb([89, 182, 70], [14, 165, 233], midCoastal);
        let cBot = lerpRgb([60, 142, 50], [2, 132, 199], midCoastal);

        if (midMountain > 0.02) {
          cTop = lerpRgb(hexToRgb('#75cb58'), [148, 163, 184], midMountain);
          cMid = lerpRgb(hexToRgb('#59b646'), [100, 116, 139], midMountain);
          cBot = lerpRgb(hexToRgb('#3c8e32'), [51, 65, 85], midMountain);
        } else if (midForest > 0.02) {
          cTop = lerpRgb(hexToRgb('#75cb58'), [22, 101, 52], midForest);
          cMid = lerpRgb(hexToRgb('#59b646'), [20, 83, 45], midForest);
          cBot = lerpRgb(hexToRgb('#3c8e32'), [6, 78, 59], midForest);
        } else if (midTemple > 0.02) {
          cTop = lerpRgb(hexToRgb('#75cb58'), [217, 180, 130], midTemple);
          cMid = lerpRgb(hexToRgb('#59b646'), [180, 142, 95], midTemple);
          cBot = lerpRgb(hexToRgb('#3c8e32'), [140, 105, 65], midTemple);
        } else if (midVolcano > 0.02) {
          cTop = lerpRgb(hexToRgb('#75cb58'), [55, 30, 32], midVolcano);
          cMid = lerpRgb(hexToRgb('#59b646'), [38, 20, 22], midVolcano);
          cBot = lerpRgb(hexToRgb('#3c8e32'), [22, 10, 12], midVolcano);
        }

        hillGrad.addColorStop(0, cTop);
        hillGrad.addColorStop(0.55, cMid);
        hillGrad.addColorStop(1, cBot);

        ctx.fillStyle = hillGrad;
        ctx.beginPath();
        ctx.arc(drawX, h.y, hr, Math.PI, 0, false);
        ctx.fill();

        // Sunlit rim highlight on top-left curve
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(drawX, h.y, hr - 2, Math.PI * 1.08, Math.PI * 1.55);
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  // 5b. Midground Mountain Rocky Cliffs, Spired Horns & Scree Talus
  if (midMountain > 0.05) {
    ctx.save();
    ctx.globalAlpha = midMountain;

    const spacing = 145;
    const startX = -130;
    const endX = GAME_W + 180;

    for (let screenX = startX; screenX <= endX; screenX += spacing) {
      const worldX = screenX + camX * 0.28;
      const slotIndex = Math.floor(worldX / spacing);

      // Deterministic PRNG per slot so mountain crags remain 100% stable without flickering
      const seed = Math.sin(slotIndex * 157.3 + 419.1) * 43758.5453;
      const rand1 = seed - Math.floor(seed);
      const rand2 = ((seed * 1.618) % 1 + 1) % 1;
      const rand3 = ((seed * 2.718) % 1 + 1) % 1;

      // Natural horizontal jitter so crags don't form a rigid repetitive grid
      const drawX = screenX + (rand1 - 0.5) * 35;
      const baseY = GAME_H + 30;
      const cragH = 135 + rand2 * 75;
      const topY = GAME_H - cragH + 15;
      const cragW = 60 + rand3 * 38;

      const archetype = Math.floor(rand1 * 4); // 0: Granite Spire, 1: Weathered Tor, 2: Twin Saddle Peak, 3: Tilted Basalt Escarpment

      // Ground Scree & Ambient Occlusion Shadow at Base
      ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
      ctx.beginPath();
      ctx.ellipse(drawX, GAME_H - 12, cragW * 0.95, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      if (archetype === 0) {
        // --- ARCHETYPE 0: TOWERING GRANITE HORN / SPIRE ---
        // Shaded eastern rock face (dark cool slate)
        const darkFaceGrad = ctx.createLinearGradient(drawX, topY, drawX + cragW * 0.55, baseY);
        darkFaceGrad.addColorStop(0, '#334155');
        darkFaceGrad.addColorStop(0.5, '#1e293b');
        darkFaceGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = darkFaceGrad;
        ctx.beginPath();
        ctx.moveTo(drawX + 4, topY);
        ctx.lineTo(drawX + cragW * 0.5, baseY);
        ctx.lineTo(drawX, baseY);
        ctx.closePath();
        ctx.fill();

        // Sunlit western rock face (cool mid-slate)
        const litFaceGrad = ctx.createLinearGradient(drawX - cragW * 0.5, topY, drawX + 4, baseY);
        litFaceGrad.addColorStop(0, '#64748b');
        litFaceGrad.addColorStop(0.55, '#475569');
        litFaceGrad.addColorStop(1, '#334155');
        ctx.fillStyle = litFaceGrad;
        ctx.beginPath();
        ctx.moveTo(drawX - cragW * 0.48, baseY);
        ctx.lineTo(drawX - cragW * 0.35, topY + cragH * 0.42);
        ctx.lineTo(drawX + 4, topY);
        ctx.lineTo(drawX, baseY);
        ctx.closePath();
        ctx.fill();

        // Central vertical arête ridge line
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(drawX + 4, topY);
        ctx.lineTo(drawX - 2, topY + cragH * 0.45);
        ctx.lineTo(drawX + 2, baseY);
        ctx.stroke();

        // Organic Snow Cap & Shelf on summit and mid-terrace
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.beginPath();
        ctx.moveTo(drawX + 4, topY);
        ctx.lineTo(drawX - 16, topY + 22);
        ctx.quadraticCurveTo(drawX - 6, topY + 16, drawX + 2, topY + 20);
        ctx.lineTo(drawX + 18, topY + 26);
        ctx.quadraticCurveTo(drawX + 10, topY + 12, drawX + 4, topY);
        ctx.closePath();
        ctx.fill();

        // Mid-height rock terrace snow
        ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
        ctx.beginPath();
        ctx.moveTo(drawX - cragW * 0.35, topY + cragH * 0.42);
        ctx.lineTo(drawX - cragW * 0.1, topY + cragH * 0.42 + 10);
        ctx.lineTo(drawX - cragW * 0.12, topY + cragH * 0.42 + 16);
        ctx.lineTo(drawX - cragW * 0.38, topY + cragH * 0.42 + 7);
        ctx.closePath();
        ctx.fill();

        // Miniature alpine dwarf conifer clinging to rock shelf
        ctx.fillStyle = '#064e3b';
        const px = drawX - cragW * 0.28;
        const py = topY + cragH * 0.41;
        ctx.beginPath();
        ctx.moveTo(px, py - 14);
        ctx.lineTo(px - 7, py);
        ctx.lineTo(px + 7, py);
        ctx.closePath();
        ctx.fill();

      } else if (archetype === 1) {
        // --- ARCHETYPE 1: WEATHERED GRANITE TOR / BLOCKY BUTTRESS ---
        const torGrad = ctx.createLinearGradient(drawX - cragW * 0.5, topY, drawX + cragW * 0.5, baseY);
        torGrad.addColorStop(0, '#64748b');
        torGrad.addColorStop(0.4, '#475569');
        torGrad.addColorStop(0.8, '#334155');
        torGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = torGrad;

        // Blocky rounded rock shoulder contours
        ctx.beginPath();
        ctx.moveTo(drawX - cragW * 0.5, baseY);
        ctx.lineTo(drawX - cragW * 0.45, topY + 36);
        ctx.quadraticCurveTo(drawX - cragW * 0.3, topY + 4, drawX - 10, topY + 8);
        ctx.quadraticCurveTo(drawX + 16, topY, drawX + cragW * 0.35, topY + 16);
        ctx.quadraticCurveTo(drawX + cragW * 0.5, topY + 38, drawX + cragW * 0.48, baseY);
        ctx.closePath();
        ctx.fill();

        // Horizontal sedimentary / tectonic joint fissures
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(drawX - cragW * 0.4, topY + 42);
        ctx.quadraticCurveTo(drawX, topY + 46, drawX + cragW * 0.42, topY + 40);
        ctx.moveTo(drawX - cragW * 0.35, topY + 82);
        ctx.quadraticCurveTo(drawX, topY + 86, drawX + cragW * 0.38, topY + 80);
        ctx.stroke();

        // Quartz mineral vein streak
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.65)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(drawX - cragW * 0.15, topY + 12);
        ctx.lineTo(drawX + cragW * 0.05, topY + 55);
        ctx.lineTo(drawX - cragW * 0.05, topY + 95);
        ctx.stroke();

        // Natural summit snow blanket nestled in top bowl
        ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
        ctx.beginPath();
        ctx.moveTo(drawX - cragW * 0.32, topY + 16);
        ctx.quadraticCurveTo(drawX, topY + 2, drawX + cragW * 0.3, topY + 18);
        ctx.quadraticCurveTo(drawX + cragW * 0.15, topY + 28, drawX, topY + 22);
        ctx.quadraticCurveTo(drawX - cragW * 0.18, topY + 26, drawX - cragW * 0.32, topY + 16);
        ctx.closePath();
        ctx.fill();

        // Basal scree boulders with alpine lichen
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(drawX - cragW * 0.42, GAME_H - 18, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#65a30d'; // hardy alpine lichen
        ctx.beginPath();
        ctx.arc(drawX - cragW * 0.45, GAME_H - 22, 6, 0, Math.PI * 2);
        ctx.fill();

      } else if (archetype === 2) {
        // --- ARCHETYPE 2: CRAGGY TWIN PEAK WITH SNOWY SADDLE PASS ---
        const peakLeftX = drawX - cragW * 0.24;
        const peakRightX = drawX + cragW * 0.22;
        const saddleY = topY + cragH * 0.32;

        const twinGrad = ctx.createLinearGradient(drawX - cragW * 0.5, topY, drawX + cragW * 0.5, baseY);
        twinGrad.addColorStop(0, '#475569');
        twinGrad.addColorStop(0.5, '#334155');
        twinGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = twinGrad;

        ctx.beginPath();
        ctx.moveTo(drawX - cragW * 0.5, baseY);
        ctx.lineTo(peakLeftX - 16, topY + 24);
        ctx.lineTo(peakLeftX, topY);
        ctx.lineTo(drawX, saddleY);
        ctx.lineTo(peakRightX, topY + 14);
        ctx.lineTo(peakRightX + 18, topY + 38);
        ctx.lineTo(drawX + cragW * 0.5, baseY);
        ctx.closePath();
        ctx.fill();

        // Shaded right face of each peak
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.beginPath();
        ctx.moveTo(peakLeftX, topY);
        ctx.lineTo(drawX, saddleY);
        ctx.lineTo(peakLeftX, baseY);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(peakRightX, topY + 14);
        ctx.lineTo(drawX + cragW * 0.5, baseY);
        ctx.lineTo(peakRightX, baseY);
        ctx.closePath();
        ctx.fill();

        // Snow draping over the peaks and accumulated in the saddle pass
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        // Left peak cap
        ctx.beginPath();
        ctx.moveTo(peakLeftX, topY);
        ctx.lineTo(peakLeftX - 14, topY + 18);
        ctx.lineTo(peakLeftX + 10, topY + 14);
        ctx.closePath();
        ctx.fill();
        // Saddle snow pocket
        ctx.fillStyle = 'rgba(241, 245, 249, 0.88)';
        ctx.beginPath();
        ctx.moveTo(drawX - 14, saddleY - 4);
        ctx.quadraticCurveTo(drawX, saddleY + 12, drawX + 16, saddleY);
        ctx.quadraticCurveTo(drawX, saddleY + 6, drawX - 14, saddleY - 4);
        ctx.closePath();
        ctx.fill();

        // Scree gravel fan at foot
        ctx.fillStyle = '#64748b';
        for (let g = 0; g < 4; g++) {
          const gx = drawX - 18 + g * 12;
          const gy = GAME_H - 14 + (g % 2) * 5;
          ctx.beginPath();
          ctx.ellipse(gx, gy, 5, 3, 0.2, 0, Math.PI * 2);
          ctx.fill();
        }

      } else {
        // --- ARCHETYPE 3: TILTED BASALT ESCARPMENT ---
        const escarpGrad = ctx.createLinearGradient(drawX - cragW * 0.4, topY, drawX + cragW * 0.5, baseY);
        escarpGrad.addColorStop(0, '#64748b');
        escarpGrad.addColorStop(0.35, '#475569');
        escarpGrad.addColorStop(0.8, '#334155');
        escarpGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = escarpGrad;

        ctx.beginPath();
        ctx.moveTo(drawX - cragW * 0.45, baseY);
        ctx.lineTo(drawX - cragW * 0.35, topY + 34);
        ctx.lineTo(drawX - cragW * 0.12, topY);
        ctx.lineTo(drawX + cragW * 0.14, topY + 22);
        ctx.lineTo(drawX + cragW * 0.38, topY + 52);
        ctx.lineTo(drawX + cragW * 0.48, baseY);
        ctx.closePath();
        ctx.fill();

        // Stepped diagonal rock fracture planes
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.moveTo(drawX - cragW * 0.12, topY);
        ctx.lineTo(drawX + cragW * 0.14, topY + 22);
        ctx.lineTo(drawX + cragW * 0.12, topY + 28);
        ctx.lineTo(drawX - cragW * 0.14, topY + 6);
        ctx.closePath();
        ctx.fill();

        // Diagonal snow dusting on stepped ledges
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.moveTo(drawX - cragW * 0.12, topY);
        ctx.lineTo(drawX - cragW * 0.22, topY + 12);
        ctx.lineTo(drawX + cragW * 0.08, topY + 24);
        ctx.lineTo(drawX + cragW * 0.14, topY + 22);
        ctx.closePath();
        ctx.fill();

        // Wind-dwarfed pine shrub (krummholz) at base
        ctx.fillStyle = '#064e3b';
        ctx.beginPath();
        ctx.ellipse(drawX + cragW * 0.26, GAME_H - 16, 15, 9, -0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.beginPath();
        ctx.ellipse(drawX + cragW * 0.24, GAME_H - 22, 10, 4, -0.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // 5c. Midground Layered Cartoon Forest Trees, Branching Groves & Lush Shrubbery
  if (midForest > 0.05) {
    ctx.save();
    ctx.globalAlpha = midForest;

    // Midground parallax speed: 0.28
    const spacing = 120;
    const startX = -120;
    const endX = GAME_W + 160;

    for (let screenX = startX; screenX <= endX; screenX += spacing) {
      const worldX = screenX + camX * 0.28;
      const slotIndex = Math.floor(worldX / spacing);
      
      // Deterministic PRNG per slot so trees don't flicker or shift
      const seed = Math.sin(slotIndex * 127.1 + 311.7) * 43758.5453;
      const rand1 = seed - Math.floor(seed);
      const rand2 = ((seed * 1.618) % 1 + 1) % 1;
      const rand3 = ((seed * 2.718) % 1 + 1) % 1;

      // Natural irregular horizontal jitter so trees don't look like a rigid grid
      const drawX = screenX + (rand1 - 0.5) * 40;
      // Midground ground horizon line
      const baseY = GAME_H - 85 + Math.sin(worldX * 0.005) * 16;
      const sway = Math.sin(time * 2.2 + worldX * 0.03) * 2.5;

      const treeType = Math.floor(rand2 * 4); // 0: Cartoon Oak, 1: Slender Birch, 2: Spreading Elm, 3: Flowering Bush

      if (treeType === 3) {
        // --- TYPE 3: LUSH MIDGROUND FOREST BUSH & BERRY CLUSTER ---
        const bushW = 34 + rand3 * 18;
        const bushH = 24 + rand3 * 12;

        // Ground shadow
        ctx.fillStyle = 'rgba(10, 35, 18, 0.24)';
        ctx.beginPath();
        ctx.ellipse(drawX, baseY + 2, bushW * 0.9, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Layered rounded foliage domes
        const drawBushLobe = (bx: number, by: number, br: number, colorTop: string, colorBot: string) => {
          const bGrad = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, br * 0.1, bx, by, br);
          bGrad.addColorStop(0, colorTop);
          bGrad.addColorStop(1, colorBot);
          ctx.fillStyle = bGrad;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();
        };

        drawBushLobe(drawX - bushW * 0.35, baseY - bushH * 0.4, bushH * 0.45, '#4ade80', '#15803d');
        drawBushLobe(drawX + bushW * 0.35, baseY - bushH * 0.4, bushH * 0.45, '#4ade80', '#15803d');
        drawBushLobe(drawX, baseY - bushH * 0.65, bushH * 0.55, '#86efac', '#16a34a');

        // Tiny berry dots
        ctx.fillStyle = rand1 > 0.5 ? '#f43f5e' : '#facc15';
        for (let b = 0; b < 3; b++) {
          const berryX = drawX - bushW * 0.25 + b * (bushW * 0.25);
          const berryY = baseY - bushH * (0.4 + (b % 2) * 0.2);
          ctx.beginPath();
          ctx.arc(berryX, berryY, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // --- TREES: MODERATE HEIGHT (NEVER COVERING SCREEN, TOP CLEAR) ---
        const treeH = 95 + rand3 * 45; // 95px to 140px tall; crowns stop well below screen top
        const trunkW = 10 + rand1 * 5;
        const splitY = baseY - treeH * (0.4 + rand2 * 0.15);

        // 1. Natural Ground Shadow
        ctx.fillStyle = 'rgba(10, 35, 18, 0.26)';
        ctx.beginPath();
        ctx.ellipse(drawX + 4, baseY + 2, trunkW * 2.2 + 14, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Visible Stylized Trunk & Multiple Branches
        if (treeType === 1) {
          // Slender Birch / Aspen Trunk
          const birchGrad = ctx.createLinearGradient(drawX - trunkW * 0.5, 0, drawX + trunkW * 0.5, 0);
          birchGrad.addColorStop(0, '#e2e8f0');
          birchGrad.addColorStop(0.5, '#f8fafc');
          birchGrad.addColorStop(1, '#cbd5e1');
          ctx.fillStyle = birchGrad;

          ctx.beginPath();
          ctx.moveTo(drawX - trunkW * 0.6, baseY);
          ctx.lineTo(drawX - trunkW * 0.35, splitY);
          ctx.lineTo(drawX + trunkW * 0.35, splitY);
          ctx.lineTo(drawX + trunkW * 0.6, baseY);
          ctx.closePath();
          ctx.fill();

          // Birch horizontal bark marks
          ctx.fillStyle = '#475569';
          ctx.fillRect(drawX - trunkW * 0.3, baseY - treeH * 0.15, trunkW * 0.6, 2);
          ctx.fillRect(drawX - trunkW * 0.25, baseY - treeH * 0.3, trunkW * 0.5, 1.8);

          // Slender branches
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(drawX, splitY);
          ctx.quadraticCurveTo(drawX - 10, splitY - 14, drawX - 18, splitY - 26);
          ctx.moveTo(drawX, splitY);
          ctx.quadraticCurveTo(drawX + 8, splitY - 12, drawX + 16, splitY - 24);
          ctx.stroke();
        } else {
          // Warm Brown Woodland Bark Trunk
          const barkGrad = ctx.createLinearGradient(drawX - trunkW * 0.5, 0, drawX + trunkW * 0.5, 0);
          barkGrad.addColorStop(0, '#542b10');
          barkGrad.addColorStop(0.4, '#7c401e');
          barkGrad.addColorStop(1, '#3d1a08');
          ctx.fillStyle = barkGrad;

          ctx.beginPath();
          ctx.moveTo(drawX - trunkW * 0.65, baseY);
          ctx.lineTo(drawX - trunkW * 0.35, splitY);
          ctx.lineTo(drawX + trunkW * 0.35, splitY);
          ctx.lineTo(drawX + trunkW * 0.65, baseY);
          ctx.closePath();
          ctx.fill();

          // Natural Bark grain highlight line
          ctx.strokeStyle = '#9c5b2b';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(drawX - 1, baseY - 4);
          ctx.lineTo(drawX - 1, splitY + 4);
          ctx.stroke();

          // Multiple Organic Branches
          ctx.strokeStyle = '#542b10';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.moveTo(drawX - trunkW * 0.2, splitY + 4);
          ctx.quadraticCurveTo(drawX - 12, splitY - 12, drawX - 22, splitY - 24);
          ctx.moveTo(drawX + trunkW * 0.2, splitY + 4);
          ctx.quadraticCurveTo(drawX + 12, splitY - 10, drawX + 22, splitY - 22);
          ctx.moveTo(drawX, splitY);
          ctx.lineTo(drawX, splitY - 18);
          ctx.stroke();
        }

        // 3. Rounded Layered Leafy Canopies
        const crownCenterY = baseY - treeH;
        const crownR = 20 + rand3 * 10;

        const drawCanopyPuff = (cx: number, cy: number, cr: number, isTop: boolean) => {
          const cGrad = ctx.createRadialGradient(cx - cr * 0.35, cy - cr * 0.35, cr * 0.1, cx, cy, cr);
          if (treeType === 1) {
            cGrad.addColorStop(0, '#86efac');
            cGrad.addColorStop(0.5, '#22c55e');
            cGrad.addColorStop(1, '#15803d');
          } else {
            cGrad.addColorStop(0, isTop ? '#4ade80' : '#22c55e');
            cGrad.addColorStop(0.55, '#16a34a');
            cGrad.addColorStop(1, '#14532d');
          }
          ctx.fillStyle = cGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, cr, 0, Math.PI * 2);
          ctx.fill();

          // Soft crescent sunlit highlight
          ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
          ctx.beginPath();
          ctx.arc(cx - cr * 0.28, cy - cr * 0.3, cr * 0.38, 0, Math.PI * 2);
          ctx.fill();
        };

        // Left, Right, Center, and Top canopy puffs with subtle sway
        const crW = crownR * 0.85;
        drawCanopyPuff(drawX - crW + sway * 0.7, crownCenterY + crownR * 0.35, crownR * 0.78, false);
        drawCanopyPuff(drawX + crW + sway * 0.9, crownCenterY + crownR * 0.35, crownR * 0.78, false);
        drawCanopyPuff(drawX + sway * 0.5, crownCenterY + crownR * 0.15, crownR * 0.88, false);
        drawCanopyPuff(drawX + sway * 0.6, crownCenterY - crownR * 0.25, crownR * 0.95, true);

        // Small base details: grass tuft and tiny flower
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(drawX - trunkW * 0.7 - 2, baseY - 6, 2, 6);
        ctx.fillRect(drawX + trunkW * 0.7 + 1, baseY - 5, 2, 5);
        if (rand1 > 0.4) {
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(drawX - trunkW * 0.7 - 2, baseY - 7, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  // 5b. Midground Cave Cavern Rock Walls & Darker Cave Environment
  if (midCave > 0.05) {
    ctx.save();
    ctx.globalAlpha = midCave;

    // Subterranean craggy rock wall pillars in the midground
    for (let x = -80; x <= GAME_W + 160; x += 180) {
      const worldX = x + camX * 0.25;
      const pilW = 42 + Math.abs(Math.sin(worldX * 0.02)) * 26;
      const pilGrad = ctx.createLinearGradient(x - pilW / 2, 0, x + pilW / 2, 0);
      pilGrad.addColorStop(0, '#0f172a');
      pilGrad.addColorStop(0.3, '#1e293b');
      pilGrad.addColorStop(0.7, '#334155');
      pilGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = pilGrad;

      // Natural craggy pillar from ceiling to ground
      ctx.beginPath();
      ctx.moveTo(x - pilW * 0.4, 0);
      ctx.lineTo(x + pilW * 0.4, 0);
      ctx.lineTo(x + pilW * 0.5, GAME_H * 0.5);
      ctx.lineTo(x + pilW * 0.35, GAME_H + 50);
      ctx.lineTo(x - pilW * 0.45, GAME_H + 50);
      ctx.lineTo(x - pilW * 0.3, GAME_H * 0.5);
      ctx.closePath();
      ctx.fill();

      // Glowing crystal vein running down the rock wall
      const crystalCyan = Math.sin(worldX * 0.05) > 0;
      const cColor = crystalCyan ? 'rgba(56, 189, 248, 0.7)' : 'rgba(192, 132, 252, 0.7)';
      ctx.strokeStyle = cColor;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x, 40);
      ctx.lineTo(x + 5, GAME_H * 0.4);
      ctx.lineTo(x - 4, GAME_H * 0.7);
      ctx.stroke();
    }

    // Cave Ambient Darkness Atmosphere: creates a deep, enclosed underground cavern feel
    const caveVignette = ctx.createRadialGradient(
      GAME_W * 0.5,
      GAME_H * 0.45,
      GAME_W * 0.25,
      GAME_W * 0.5,
      GAME_H * 0.45,
      GAME_W * 0.85
    );
    caveVignette.addColorStop(0, 'rgba(11, 15, 26, 0.0)');
    caveVignette.addColorStop(0.7, `rgba(8, 12, 22, ${0.45 * midCave})`);
    caveVignette.addColorStop(1, `rgba(4, 7, 15, ${0.75 * midCave})`);
    ctx.fillStyle = caveVignette;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    ctx.restore();
  }

  // 5d. Midground Ancient Temple Ruins: Weathered Stone Pillars, Overgrown Arches & Broken Portals
  if (midTemple > 0.05) {
    ctx.save();
    ctx.globalAlpha = midTemple;

    // Midground parallax speed: 0.28
    const spacing = 135;
    const startX = -120;
    const endX = GAME_W + 160;

    for (let screenX = startX; screenX <= endX; screenX += spacing) {
      const worldX = screenX + camX * 0.28;
      const slotIndex = Math.floor(worldX / spacing);

      const seed = Math.sin(slotIndex * 157.3 + 281.9) * 43758.5453;
      const rand1 = seed - Math.floor(seed);
      const rand2 = ((seed * 1.618) % 1 + 1) % 1;
      const rand3 = ((seed * 2.718) % 1 + 1) % 1;

      const drawX = screenX + (rand1 - 0.5) * 35;
      const baseY = GAME_H - 85 + Math.sin(worldX * 0.005) * 16;
      const ruinType = Math.floor(rand2 * 4); // 0: Pillar, 1: Arch, 2: Broken Column & Drums, 3: Altar/Pediment

      // Ground shadow beneath stone ruin
      ctx.fillStyle = 'rgba(70, 45, 20, 0.22)';
      ctx.beginPath();
      ctx.ellipse(drawX, baseY + 2, 28, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      if (ruinType === 0) {
        // --- TYPE 0: STANDING FLUTED TEMPLE PILLAR WITH CAPITAL & IVY ---
        const pilH = 55 + rand3 * 22;
        const pilW = 16;

        // Base plinth
        ctx.fillStyle = '#bfa07d';
        ctx.fillRect(drawX - pilW * 0.7, baseY - 8, pilW * 1.4, 8);
        ctx.fillStyle = '#dbbda0';
        ctx.fillRect(drawX - pilW * 0.7, baseY - 8, pilW * 0.4, 8); // Sunlit left

        // Pillar shaft (fluted vertical gradient)
        const shaftGrad = ctx.createLinearGradient(drawX - pilW * 0.5, 0, drawX + pilW * 0.5, 0);
        shaftGrad.addColorStop(0, '#ebd1b5');
        shaftGrad.addColorStop(0.35, '#d4b18f');
        shaftGrad.addColorStop(0.8, '#a67d58');
        shaftGrad.addColorStop(1, '#8c6239');
        ctx.fillStyle = shaftGrad;
        ctx.fillRect(drawX - pilW * 0.5, baseY - pilH, pilW, pilH - 8);

        // Fluting lines
        ctx.strokeStyle = 'rgba(120, 80, 45, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(drawX - pilW * 0.2, baseY - pilH + 2);
        ctx.lineTo(drawX - pilW * 0.2, baseY - 8);
        ctx.moveTo(drawX + pilW * 0.15, baseY - pilH + 2);
        ctx.lineTo(drawX + pilW * 0.15, baseY - 8);
        ctx.stroke();

        // Capital
        ctx.fillStyle = '#ebd1b5';
        ctx.fillRect(drawX - pilW * 0.75, baseY - pilH - 6, pilW * 1.5, 7);
        ctx.fillStyle = '#8c6239';
        ctx.fillRect(drawX + pilW * 0.35, baseY - pilH - 6, pilW * 0.4, 7);

        // Creeping green ivy on column
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(drawX - pilW * 0.5, baseY - 12);
        ctx.quadraticCurveTo(drawX, baseY - pilH * 0.4, drawX + pilW * 0.4, baseY - pilH * 0.65);
        ctx.stroke();

        ctx.fillStyle = '#15803d';
        for (let l = 0; l < 4; l++) {
          const lx = drawX - 4 + l * 2;
          const ly = baseY - 16 - l * (pilH * 0.16);
          ctx.beginPath();
          ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (ruinType === 1) {
        // --- TYPE 1: WEATHERED STONE ARCHWAY ---
        const archW = 42 + rand3 * 10;
        const archH = 52 + rand3 * 14;
        const pierW = 11;

        // Left pier
        const pierGrad = ctx.createLinearGradient(drawX - archW * 0.5, 0, drawX + archW * 0.5, 0);
        pierGrad.addColorStop(0, '#ebd1b5');
        pierGrad.addColorStop(0.5, '#cba580');
        pierGrad.addColorStop(1, '#8c6239');
        ctx.fillStyle = pierGrad;
        ctx.fillRect(drawX - archW * 0.5, baseY - archH, pierW, archH);
        // Right pier
        ctx.fillRect(drawX + archW * 0.5 - pierW, baseY - archH, pierW, archH);

        // Arch span lintel
        ctx.fillStyle = '#d4b18f';
        ctx.fillRect(drawX - archW * 0.55, baseY - archH - 8, archW * 1.1, 9);
        // Keystone
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(drawX - 4, baseY - archH - 11, 8, 12);

        // Hanging moss threads from lintel
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(drawX - 10, baseY - archH + 1);
        ctx.lineTo(drawX - 10, baseY - archH + 12);
        ctx.moveTo(drawX + 8, baseY - archH + 1);
        ctx.lineTo(drawX + 8, baseY - archH + 16);
        ctx.stroke();
      } else if (ruinType === 2) {
        // --- TYPE 2: BROKEN PILLAR STUMP & TUMBLING MASONRY BLOCKS ---
        const stumpH = 26 + rand3 * 14;
        const colW = 16;

        // Broken stump
        ctx.fillStyle = '#cba580';
        ctx.beginPath();
        ctx.moveTo(drawX - colW * 0.5, baseY);
        ctx.lineTo(drawX - colW * 0.5, baseY - stumpH);
        ctx.lineTo(drawX - colW * 0.1, baseY - stumpH - 4);
        ctx.lineTo(drawX + colW * 0.5, baseY - stumpH + 5);
        ctx.lineTo(drawX + colW * 0.5, baseY);
        ctx.closePath();
        ctx.fill();

        // Sunlit edge
        ctx.fillStyle = '#ebd1b5';
        ctx.fillRect(drawX - colW * 0.5, baseY - stumpH, 4, stumpH);

        // Fallen cylindrical column drum beside stump
        ctx.fillStyle = '#b8926e';
        ctx.fillRect(drawX + 10, baseY - 12, 18, 12);
        ctx.fillStyle = '#dcb997';
        ctx.fillRect(drawX + 10, baseY - 12, 6, 12);

        // Cute yellow wildflowers growing by stone
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(drawX - 12, baseY - 5, 2.5, 0, Math.PI * 2);
        ctx.arc(drawX + 26, baseY - 4, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // --- TYPE 3: WEATHERED CARVED ALTAR / STELE PEDIMENT ---
        const altarW = 34 + rand3 * 12;
        const altarH = 32 + rand3 * 10;

        // Tiered steps
        ctx.fillStyle = '#a8815d';
        ctx.fillRect(drawX - altarW * 0.6, baseY - 6, altarW * 1.2, 6);
        ctx.fillStyle = '#be9772';
        ctx.fillRect(drawX - altarW * 0.45, baseY - 14, altarW * 0.9, 8);
        ctx.fillStyle = '#d4b18f';
        ctx.fillRect(drawX - altarW * 0.35, baseY - altarH, altarW * 0.7, altarH - 14);

        // Inscribed glyph line
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(drawX - 6, baseY - altarH * 0.6);
        ctx.lineTo(drawX + 6, baseY - altarH * 0.6);
        ctx.moveTo(drawX, baseY - altarH * 0.75);
        ctx.lineTo(drawX, baseY - altarH * 0.45);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // 5e. Midground Volcanic Area: Dark Basalt Spalls, Cascading Lava Falls & Molten Pools
  if (midVolcano > 0.05) {
    ctx.save();
    ctx.globalAlpha = midVolcano;

    // Midground parallax speed: 0.28
    const spacing = 135;
    const startX = -120;
    const endX = GAME_W + 160;

    for (let screenX = startX; screenX <= endX; screenX += spacing) {
      const worldX = screenX + camX * 0.28;
      const slotIndex = Math.floor(worldX / spacing);

      const seed = Math.sin(slotIndex * 183.7 + 193.1) * 43758.5453;
      const rand1 = seed - Math.floor(seed);
      const rand2 = ((seed * 1.618) % 1 + 1) % 1;
      const rand3 = ((seed * 2.718) % 1 + 1) % 1;

      const drawX = screenX + (rand1 - 0.5) * 35;
      const baseY = GAME_H - 85 + Math.sin(worldX * 0.005) * 16;
      const cragType = Math.floor(rand2 * 4); // 0: Basalt Spire, 1: Lava Waterfall, 2: Fumarole, 3: Obsidian Outcrop

      // Fiery magma glow on ground beneath
      const lavaGlow = ctx.createRadialGradient(drawX, baseY, 2, drawX, baseY, 26);
      lavaGlow.addColorStop(0, 'rgba(249, 115, 22, 0.45)');
      lavaGlow.addColorStop(0.6, 'rgba(220, 38, 38, 0.2)');
      lavaGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = lavaGlow;
      ctx.beginPath();
      ctx.ellipse(drawX, baseY + 2, 28, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      if (cragType === 0) {
        // --- TYPE 0: TOWERING BASALT CRAG SPIRE WITH MAGMA VEIN ---
        const spireH = 55 + rand3 * 25;
        const spireW = 20 + rand3 * 8;

        // Dark basalt rock body
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.moveTo(drawX - spireW * 0.5, baseY);
        ctx.lineTo(drawX - spireW * 0.2, baseY - spireH);
        ctx.lineTo(drawX + spireW * 0.1, baseY - spireH - 6);
        ctx.lineTo(drawX + spireW * 0.45, baseY);
        ctx.closePath();
        ctx.fill();

        // Chiseled rock facet highlight
        ctx.fillStyle = '#292524';
        ctx.beginPath();
        ctx.moveTo(drawX - spireW * 0.5, baseY);
        ctx.lineTo(drawX - spireW * 0.2, baseY - spireH);
        ctx.lineTo(drawX, baseY);
        ctx.closePath();
        ctx.fill();

        // Glowing magma fissure
        const pulse = 0.7 + Math.sin(time * 3 + worldX * 0.05) * 0.3;
        ctx.strokeStyle = `rgba(249, 115, 22, ${pulse})`;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(drawX - 2, baseY - spireH + 8);
        ctx.lineTo(drawX + 3, baseY - spireH * 0.5);
        ctx.lineTo(drawX - 1, baseY - 6);
        ctx.stroke();

        ctx.strokeStyle = `rgba(254, 240, 138, ${pulse})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (cragType === 1) {
        // --- TYPE 1: CASCADING LAVA WATERFALL & POOL ---
        const rockH = 45 + rand3 * 18;
        const rockW = 32 + rand3 * 10;

        // Rock shelf
        ctx.fillStyle = '#262626';
        ctx.fillRect(drawX - rockW * 0.5, baseY - rockH, rockW, rockH);
        ctx.fillStyle = '#171717';
        ctx.fillRect(drawX, baseY - rockH, rockW * 0.5, rockH);

        // Cascading lava flow pouring down
        const lavaAnim = (time * 15) % 12;
        const lavaGrad = ctx.createLinearGradient(0, baseY - rockH, 0, baseY);
        lavaGrad.addColorStop(0, '#fef08a');
        lavaGrad.addColorStop(0.3, '#f97316');
        lavaGrad.addColorStop(0.85, '#ef4444');
        lavaGrad.addColorStop(1, '#f97316');
        ctx.fillStyle = lavaGrad;
        ctx.fillRect(drawX - 5, baseY - rockH + 4, 10, rockH - 4);

        // Glowing hot pool at base
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.ellipse(drawX, baseY - 2, 14, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.ellipse(drawX, baseY - 2, 7, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (cragType === 2) {
        // --- TYPE 2: STEAMING VOLCANIC FUMAROLE VENT ---
        const ventW = 28 + rand3 * 8;
        const ventH = 26 + rand3 * 12;

        ctx.fillStyle = '#27272a';
        ctx.beginPath();
        ctx.moveTo(drawX - ventW * 0.5, baseY);
        ctx.lineTo(drawX - ventW * 0.25, baseY - ventH);
        ctx.lineTo(drawX + ventW * 0.25, baseY - ventH);
        ctx.lineTo(drawX + ventW * 0.5, baseY);
        ctx.closePath();
        ctx.fill();

        // Vent crater mouth (hot magma glow)
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.ellipse(drawX, baseY - ventH, ventW * 0.25, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.ellipse(drawX, baseY - ventH, ventW * 0.12, 1.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Sulfur crystals on rim
        ctx.fillStyle = '#eab308';
        ctx.fillRect(drawX - ventW * 0.3, baseY - ventH + 2, 3, 3);
        ctx.fillRect(drawX + ventW * 0.2, baseY - ventH + 1, 3, 3);

        // Hot vapor puff rising
        const puffFrac = ((time * 0.9 + rand1) % 2.5) / 2.5;
        const puffY = (baseY - ventH) - puffFrac * 45;
        const puffR = 4 + puffFrac * 12;
        ctx.fillStyle = `rgba(161, 161, 170, ${(1 - puffFrac) * 0.4})`;
        ctx.beginPath();
        ctx.arc(drawX + Math.sin(time * 2) * 5, puffY, puffR, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // --- TYPE 3: CHISELED OBSIDIAN BOULDER OUTLET ---
        const boulderW = 34 + rand3 * 12;
        const boulderH = 24 + rand3 * 10;

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(drawX - boulderW * 0.45, baseY);
        ctx.lineTo(drawX - boulderW * 0.3, baseY - boulderH);
        ctx.lineTo(drawX + boulderW * 0.1, baseY - boulderH * 1.15);
        ctx.lineTo(drawX + boulderW * 0.45, baseY - boulderH * 0.4);
        ctx.lineTo(drawX + boulderW * 0.5, baseY);
        ctx.closePath();
        ctx.fill();

        // Sharp glossy obsidian facet
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(drawX - boulderW * 0.3, baseY - boulderH);
        ctx.lineTo(drawX + boulderW * 0.1, baseY - boulderH * 1.15);
        ctx.lineTo(drawX, baseY);
        ctx.closePath();
        ctx.fill();

        // Red hot seam under rock
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(drawX - boulderW * 0.3, baseY);
        ctx.lineTo(drawX + boulderW * 0.2, baseY);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
  // Uses granular world position getDetailedBiomeAtX(t.x) for seamless travel transitions
  ctx.save();
  trees.forEach(t => {
    const drawX = t.x - camX * 0.65;
    if (drawX > -100 && drawX < GAME_W + 100) {
      const th = t.height || 75;
      const sway = Math.sin(time * 2.2 + t.x * 0.02) * 2.5;
      const detailed = getDetailedBiomeAtX(t.x);
      const inTrans = detailed.inTransition;
      const f = detailed.factor;
      const cur = detailed.current;
      const nxt = detailed.next;
      const itemType = t.type ?? 0;

      if (inTrans && cur === 'meadow' && nxt === 'coastal') {
        // -----------------------------------------------------------------
        // MEADOW -> COASTAL INTERMEDIATE ELEMENTS
        // -----------------------------------------------------------------
        if (f < 0.28) {
          // STAGE 1: Windswept Coastal Pine & Coastal Driftwood Post
          if (itemType % 2 === 0) {
            // Windswept Coastal Pine: bent trunk, layered evergreen needle pads
            ctx.fillStyle = 'rgba(20, 45, 25, 0.22)';
            ctx.beginPath();
            ctx.ellipse(drawX + 10, t.y + 4, 26, 7, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(drawX, t.y);
            ctx.quadraticCurveTo(drawX + 8, t.y - th * 0.45, drawX + 18 + sway * 0.5, t.y - th * 0.85);
            ctx.stroke();

            // Dark pine needle pads
            const px = drawX + 18 + sway * 0.5;
            const py = t.y - th * 0.85;
            const pineColors = ['#14532d', '#166534', '#15803d'];
            for (let i = 0; i < 3; i++) {
              ctx.fillStyle = pineColors[i];
              ctx.beginPath();
              ctx.ellipse(px + (i - 1) * 8, py + i * 10, 16 - i * 2, 7, 0.1, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            // Coastal Driftwood Post with wild sea-grass tufts
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.beginPath();
            ctx.ellipse(drawX + 4, t.y + 3, 16, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            // Weathered grey timber post
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(drawX - 5, t.y - th * 0.5, 10, th * 0.5);
            ctx.fillStyle = '#64748b';
            ctx.fillRect(drawX - 5, t.y - th * 0.5, 3, th * 0.5);

            // Beach grass tufts
            ctx.strokeStyle = '#84cc16';
            ctx.lineWidth = 2.5;
            for (let g = -3; g <= 3; g++) {
              ctx.beginPath();
              ctx.moveTo(drawX + g * 3, t.y);
              ctx.quadraticCurveTo(drawX + g * 5 + sway, t.y - 18, drawX + g * 7 + sway * 1.5, t.y - 28);
              ctx.stroke();
            }
          }
        } else if (f < 0.58) {
          // STAGE 2: Coastal Sea Boulder & Young Coastal Palm Shoot
          if (itemType % 2 === 0) {
            // Coastal Sea Boulder: rounded granite rock with green sea moss
            ctx.fillStyle = 'rgba(12, 74, 110, 0.28)';
            ctx.beginPath();
            ctx.ellipse(drawX + 6, t.y + 4, 30, 9, 0, 0, Math.PI * 2);
            ctx.fill();

            const rockGrad = ctx.createLinearGradient(drawX - 25, t.y - 45, drawX + 25, t.y);
            rockGrad.addColorStop(0, '#94a3b8');
            rockGrad.addColorStop(0.5, '#64748b');
            rockGrad.addColorStop(1, '#334155');
            ctx.fillStyle = rockGrad;
            ctx.beginPath();
            ctx.ellipse(drawX, t.y - 18, 28, 24, -0.1, Math.PI, 0);
            ctx.fill();

            // Sea moss on rock base
            ctx.fillStyle = '#4d7c0f';
            ctx.beginPath();
            ctx.ellipse(drawX - 6, t.y - 4, 16, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            // Rock sunlit crest
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(drawX - 4, t.y - 18, 24, Math.PI * 1.15, Math.PI * 1.45);
            ctx.stroke();
          } else {
            // Young Coastal Palm Shoot
            ctx.fillStyle = 'rgba(12, 74, 110, 0.22)';
            ctx.beginPath();
            ctx.ellipse(drawX + 6, t.y + 3, 20, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#a16207';
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(drawX, t.y);
            ctx.quadraticCurveTo(drawX + 8, t.y - th * 0.35, drawX + 12 + sway * 0.4, t.y - th * 0.65);
            ctx.stroke();

            // Fresh green young fronds
            const ypx = drawX + 12 + sway * 0.4;
            const ypy = t.y - th * 0.65;
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 3;
            for (let a = 0; a < 4; a++) {
              const ang = (a / 4) * Math.PI * 1.5 - 0.4;
              ctx.beginPath();
              ctx.moveTo(ypx, ypy);
              ctx.quadraticCurveTo(ypx + Math.cos(ang) * 12, ypy - 10, ypx + Math.cos(ang) * 22, ypy + Math.sin(ang) * 12);
              ctx.stroke();
            }
          }
        } else if (f < 0.85) {
          // STAGE 3: Large Sea Rock Spire & Slender Leaning Shore Palm
          if (itemType % 2 === 0) {
            // Large Sea Rock Spire with barnacles & sea spray
            ctx.fillStyle = 'rgba(8, 47, 73, 0.3)';
            ctx.beginPath();
            ctx.ellipse(drawX + 8, t.y + 4, 34, 10, 0, 0, Math.PI * 2);
            ctx.fill();

            const spireGrad = ctx.createLinearGradient(drawX - 18, 0, drawX + 18, 0);
            spireGrad.addColorStop(0, '#475569');
            spireGrad.addColorStop(0.5, '#64748b');
            spireGrad.addColorStop(1, '#334155');
            ctx.fillStyle = spireGrad;
            ctx.beginPath();
            ctx.moveTo(drawX - 22, t.y);
            ctx.lineTo(drawX - 10, t.y - th * 0.7);
            ctx.lineTo(drawX + 4, t.y - th * 0.95);
            ctx.lineTo(drawX + 16, t.y - th * 0.5);
            ctx.lineTo(drawX + 24, t.y);
            ctx.closePath();
            ctx.fill();

            // Barnacle clusters
            ctx.fillStyle = '#f1f5f9';
            ctx.beginPath();
            ctx.arc(drawX - 6, t.y - 14, 2.5, 0, Math.PI * 2);
            ctx.arc(drawX + 2, t.y - 22, 3, 0, Math.PI * 2);
            ctx.arc(drawX + 8, t.y - 12, 2.5, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Slender Leaning Shore Palm
            ctx.fillStyle = 'rgba(12, 74, 110, 0.25)';
            ctx.beginPath();
            ctx.ellipse(drawX + 8, t.y + 4, 26, 7, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#92400e';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(drawX, t.y);
            ctx.quadraticCurveTo(drawX + 12, t.y - th * 0.5, drawX + 22 + sway * 0.6, t.y - th * 0.85);
            ctx.stroke();

            const crownX = drawX + 22 + sway * 0.6;
            const crownY = t.y - th * 0.85;
            const frondColors = ['#22c55e', '#16a34a', '#15803d'];
            for (let a = 0; a < 6; a++) {
              const angle = (a / 6) * Math.PI * 2 + sway * 0.05;
              ctx.strokeStyle = frondColors[a % 3];
              ctx.lineWidth = 3.5;
              ctx.beginPath();
              ctx.moveTo(crownX, crownY);
              const fx = crownX + Math.cos(angle) * 26;
              const fy = crownY + Math.sin(angle) * 16 + 6;
              ctx.quadraticCurveTo(crownX + Math.cos(angle) * 16, crownY - 6, fx, fy);
              ctx.stroke();
            }
          }
        } else {
          // STAGE 4: Full Tropical Coconut Palm
          ctx.fillStyle = 'rgba(12, 74, 110, 0.25)';
          ctx.beginPath();
          ctx.ellipse(drawX + 8, t.y + 4, 26, 7, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#92400e';
          ctx.lineWidth = 6.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(drawX, t.y);
          ctx.quadraticCurveTo(drawX + 10, t.y - th * 0.5, drawX + 18 + sway * 0.6, t.y - th * 0.88);
          ctx.stroke();

          const crownX = drawX + 18 + sway * 0.6;
          const crownY = t.y - th * 0.88;

          // Coconuts at crown
          ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.arc(crownX - 3, crownY + 3, 4, 0, Math.PI * 2);
          ctx.arc(crownX + 4, crownY + 4, 4, 0, Math.PI * 2);
          ctx.fill();

          const frondColors = ['#22c55e', '#16a34a', '#15803d'];
          for (let a = 0; a < 7; a++) {
            const angle = (a / 7) * Math.PI * 2 + sway * 0.05;
            ctx.strokeStyle = frondColors[a % 3];
            ctx.lineWidth = 3.8;
            ctx.beginPath();
            ctx.moveTo(crownX, crownY);
            const fx = crownX + Math.cos(angle) * 28;
            const fy = crownY + Math.sin(angle) * 18 + 6;
            ctx.quadraticCurveTo(crownX + Math.cos(angle) * 18, crownY - 7, fx, fy);
            ctx.stroke();
          }
        }
      } else if (inTrans && cur === 'coastal' && nxt === 'cave') {
        // -----------------------------------------------------------------
        // COASTAL -> CAVE INTERMEDIATE ELEMENTS
        // -----------------------------------------------------------------
        if (f < 0.28) {
          // STAGE 1: Craggy Sea-Cliff Boulder breaking the shoreline
          ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
          ctx.beginPath();
          ctx.ellipse(drawX + 6, t.y + 4, 30, 9, 0, 0, Math.PI * 2);
          ctx.fill();

          const rockGrad = ctx.createLinearGradient(drawX - 20, 0, drawX + 20, 0);
          rockGrad.addColorStop(0, '#475569');
          rockGrad.addColorStop(0.5, '#334155');
          rockGrad.addColorStop(1, '#1e293b');
          ctx.fillStyle = rockGrad;
          ctx.beginPath();
          ctx.moveTo(drawX - 24, t.y);
          ctx.lineTo(drawX - 12, t.y - th * 0.5);
          ctx.lineTo(drawX + 6, t.y - th * 0.65);
          ctx.lineTo(drawX + 22, t.y);
          ctx.closePath();
          ctx.fill();
        } else if (f < 0.58) {
          // STAGE 2: Towering Basalt Column Monolith & Cavern Foothill Spire
          ctx.fillStyle = 'rgba(10, 15, 25, 0.4)';
          ctx.beginPath();
          ctx.ellipse(drawX + 6, t.y + 3, 26, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          const colGrad = ctx.createLinearGradient(drawX - 16, 0, drawX + 16, 0);
          colGrad.addColorStop(0, '#334155');
          colGrad.addColorStop(0.4, '#1e293b');
          colGrad.addColorStop(1, '#0f172a');
          ctx.fillStyle = colGrad;

          // Hexagonal basalt column
          ctx.fillRect(drawX - 14, t.y - th * 0.8, 28, th * 0.8);

          // Chisel groove lines
          ctx.fillStyle = '#475569';
          ctx.fillRect(drawX - 4, t.y - th * 0.8, 2.5, th * 0.8);
          ctx.fillRect(drawX + 6, t.y - th * 0.8, 2, th * 0.8);
        } else if (f < 0.85) {
          // STAGE 3: Cavern Entrance Rock Pillar with glowing crystal veins
          ctx.fillStyle = 'rgba(10, 15, 25, 0.45)';
          ctx.beginPath();
          ctx.ellipse(drawX + 4, t.y + 4, 28, 9, 0, 0, Math.PI * 2);
          ctx.fill();

          const pilGrad = ctx.createLinearGradient(drawX - 18, 0, drawX + 18, 0);
          pilGrad.addColorStop(0, '#1e293b');
          pilGrad.addColorStop(0.5, '#0f172a');
          pilGrad.addColorStop(1, '#020617');
          ctx.fillStyle = pilGrad;
          ctx.beginPath();
          ctx.moveTo(drawX - 18, t.y);
          ctx.lineTo(drawX - 10, t.y - th * 0.88);
          ctx.lineTo(drawX + 12, t.y - th * 0.88);
          ctx.lineTo(drawX + 20, t.y);
          ctx.closePath();
          ctx.fill();

          // Embedded glowing cyan crystal vein
          const veinGlow = 0.6 + Math.sin(time * 3 + t.x * 0.05) * 0.35;
          ctx.strokeStyle = `rgba(56, 189, 248, ${veinGlow})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(drawX - 4, t.y - 12);
          ctx.lineTo(drawX + 2, t.y - th * 0.4);
          ctx.lineTo(drawX - 1, t.y - th * 0.7);
          ctx.stroke();
        } else {
          // STAGE 4: Luminous Crystal Stalagmite Formation
          ctx.fillStyle = 'rgba(10, 15, 25, 0.4)';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y + 2, 22, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          const rockGrad = ctx.createLinearGradient(drawX - 12, 0, drawX + 12, 0);
          rockGrad.addColorStop(0, '#334155');
          rockGrad.addColorStop(0.5, '#1e293b');
          rockGrad.addColorStop(1, '#0f172a');
          ctx.fillStyle = rockGrad;

          ctx.beginPath();
          ctx.moveTo(drawX - 14, t.y);
          ctx.lineTo(drawX - 6, t.y - th * 0.6);
          ctx.lineTo(drawX, t.y - th * 0.88);
          ctx.lineTo(drawX + 7, t.y - th * 0.55);
          ctx.lineTo(drawX + 14, t.y);
          ctx.closePath();
          ctx.fill();

          const crystalColor = Math.sin(t.x * 0.01) > 0 ? '#38bdf8' : '#c084fc';
          ctx.fillStyle = crystalColor;
          ctx.shadowColor = crystalColor;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(drawX, t.y - th * 0.4);
          ctx.lineTo(drawX + 4, t.y - th * 0.4 - 9);
          ctx.lineTo(drawX + 7, t.y - th * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      } else if (inTrans && cur === 'cave' && nxt === 'meadow') {
        // -----------------------------------------------------------------
        // CAVE -> MEADOW INTERMEDIATE ELEMENTS
        // -----------------------------------------------------------------
        if (f < 0.35) {
          // Cavern rock with daylight cracks
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(drawX - 12, t.y - th * 0.75, 24, th * 0.75);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(drawX - 2, t.y - 8);
          ctx.lineTo(drawX + 3, t.y - th * 0.5);
          ctx.stroke();
        } else if (f < 0.65) {
          // Cavern exit pillar with climbing moss and ivy
          ctx.fillStyle = '#334155';
          ctx.fillRect(drawX - 12, t.y - th * 0.7, 24, th * 0.7);
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.ellipse(drawX - 4, t.y - th * 0.35, 10, 5, 0.2, 0, Math.PI * 2);
          ctx.ellipse(drawX + 4, t.y - th * 0.55, 9, 4, -0.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Foothills Wildflower Bush & Birch Sapling
          ctx.fillStyle = 'rgba(20, 45, 25, 0.24)';
          ctx.beginPath();
          ctx.ellipse(drawX + 4, t.y + 3, 22, 7, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(drawX, t.y - th * 0.4, 18, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#f43f5e';
          ctx.beginPath();
          ctx.arc(drawX - 5, t.y - th * 0.45, 3, 0, Math.PI * 2);
          ctx.arc(drawX + 6, t.y - th * 0.38, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (detailed.primary === 'coastal') {
        // PURE COASTAL PALM TREE
        ctx.fillStyle = 'rgba(12, 74, 110, 0.25)';
        ctx.beginPath();
        ctx.ellipse(drawX + 8, t.y + 4, 26, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(drawX, t.y);
        ctx.quadraticCurveTo(drawX + 10, t.y - th * 0.5, drawX + 16 + sway * 0.6, t.y - th * 0.85);
        ctx.stroke();

        const crownX = drawX + 16 + sway * 0.6;
        const crownY = t.y - th * 0.85;

        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.arc(crownX - 3, crownY + 2, 3.5, 0, Math.PI * 2);
        ctx.arc(crownX + 3, crownY + 3, 3.5, 0, Math.PI * 2);
        ctx.fill();

        const frondColors = ['#22c55e', '#16a34a', '#15803d'];
        for (let a = 0; a < 6; a++) {
          const angle = (a / 6) * Math.PI * 2 + sway * 0.05;
          ctx.strokeStyle = frondColors[a % 3];
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(crownX, crownY);
          const fx = crownX + Math.cos(angle) * 26;
          const fy = crownY + Math.sin(angle) * 16 + 6;
          ctx.quadraticCurveTo(crownX + Math.cos(angle) * 16, crownY - 6, fx, fy);
          ctx.stroke();
        }
      } else if (detailed.primary === 'cave') {
        // PURE CAVE STALAGMITE FORMATION
        ctx.fillStyle = 'rgba(10, 15, 25, 0.4)';
        ctx.beginPath();
        ctx.ellipse(drawX, t.y + 2, 22, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        const rockGrad = ctx.createLinearGradient(drawX - 12, 0, drawX + 12, 0);
        rockGrad.addColorStop(0, '#334155');
        rockGrad.addColorStop(0.5, '#1e293b');
        rockGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = rockGrad;

        ctx.beginPath();
        ctx.moveTo(drawX - 14, t.y);
        ctx.lineTo(drawX - 6, t.y - th * 0.6);
        ctx.lineTo(drawX, t.y - th * 0.85);
        ctx.lineTo(drawX + 7, t.y - th * 0.55);
        ctx.lineTo(drawX + 14, t.y);
        ctx.closePath();
        ctx.fill();

        const crystalColor = Math.sin(t.x * 0.01) > 0 ? '#38bdf8' : '#c084fc';
        ctx.fillStyle = crystalColor;
        ctx.shadowColor = crystalColor;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(drawX, t.y - th * 0.4);
        ctx.lineTo(drawX + 4, t.y - th * 0.4 - 8);
        ctx.lineTo(drawX + 7, t.y - th * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (detailed.primary === 'mountain') {
        // PURE MOUNTAIN POLISHED PROCEDURAL SCENERY
        // 6 Varied Hand-Crafted Cartoon Archetypes:
        // 0: Noble Alpine Snow Pine (textured bark, 4 tiered boughs, scalloped snow blankets, pinecones)
        // 1: Layered Granite Crag Formation (faceted 3D rock mass, quartz vein, snow saddle, alpine lichen)
        // 2: Alpine Hikers' Stone Cairn & Trail Marker (balanced multi-colored stones, summit snow, marker post)
        // 3: Alpine Scree Mound & Sky-Blue Forget-Me-Nots (granite pebbles, cushion moss, alpine blossoms)
        // 4: Wind-Swept Dwarf Mountain Krummholz (twisted wood, dark needles, frost, red mountain berries)
        // 5: Glacial Erratic Boulder with Snow Drift & Icicles (layered strata, banked snow, crystal icicles)
        const itemType = Math.abs(Math.floor(t.x * 0.17 + (t.type || 0))) % 6;

        if (itemType === 0) {
          // --- TYPE 0: NOBLE ALPINE SNOW PINE (FIR CONIFER) ---
          // Soft ground contact shadow
          ctx.fillStyle = 'rgba(15, 23, 42, 0.38)';
          ctx.beginPath();
          ctx.ellipse(drawX + 4, t.y + 3, 26, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          // Weathered tapered pine trunk with bark texture
          const trunkGrad = ctx.createLinearGradient(drawX - 5, 0, drawX + 5, 0);
          trunkGrad.addColorStop(0, '#475569');
          trunkGrad.addColorStop(0.5, '#334155');
          trunkGrad.addColorStop(1, '#1e293b');
          ctx.fillStyle = trunkGrad;
          ctx.beginPath();
          ctx.moveTo(drawX - 5, t.y);
          ctx.lineTo(drawX - 3, t.y - th * 0.45);
          ctx.lineTo(drawX + 3, t.y - th * 0.45);
          ctx.lineTo(drawX + 5, t.y);
          ctx.closePath();
          ctx.fill();

          // 4 descending tiers of deep emerald needle foliage with natural scalloped snow boughs
          const tiers = [
            { y: t.y - th * 0.95, w: 24, h: 26 },
            { y: t.y - th * 0.75, w: 34, h: 28 },
            { y: t.y - th * 0.55, w: 44, h: 32 },
            { y: t.y - th * 0.35, w: 54, h: 34 }
          ];

          tiers.forEach((tier, idx) => {
            const swayOffset = sway * (0.3 + idx * 0.2);
            // Deep evergreen needle foliage
            const needleGrad = ctx.createLinearGradient(drawX - tier.w * 0.5, tier.y, drawX + tier.w * 0.5, tier.y + tier.h);
            needleGrad.addColorStop(0, '#065f46');
            needleGrad.addColorStop(0.5, '#064e3b');
            needleGrad.addColorStop(1, '#022c22');
            ctx.fillStyle = needleGrad;

            ctx.beginPath();
            ctx.moveTo(drawX + swayOffset, tier.y);
            ctx.lineTo(drawX - tier.w * 0.5, tier.y + tier.h);
            ctx.lineTo(drawX - tier.w * 0.25, tier.y + tier.h - 4);
            ctx.lineTo(drawX, tier.y + tier.h - 2);
            ctx.lineTo(drawX + tier.w * 0.25, tier.y + tier.h - 4);
            ctx.lineTo(drawX + tier.w * 0.5, tier.y + tier.h);
            ctx.closePath();
            ctx.fill();

            // Organic Scalloped Snow Blanket resting on bough
            // Soft shadow under snow
            ctx.fillStyle = 'rgba(203, 213, 225, 0.85)';
            ctx.beginPath();
            ctx.moveTo(drawX + swayOffset, tier.y);
            ctx.lineTo(drawX - tier.w * 0.38, tier.y + tier.h * 0.55);
            ctx.quadraticCurveTo(drawX - tier.w * 0.15, tier.y + tier.h * 0.65, drawX, tier.y + tier.h * 0.45);
            ctx.quadraticCurveTo(drawX + tier.w * 0.15, tier.y + tier.h * 0.65, drawX + tier.w * 0.38, tier.y + tier.h * 0.55);
            ctx.closePath();
            ctx.fill();

            // Sunlit snow face
            ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
            ctx.beginPath();
            ctx.moveTo(drawX + swayOffset, tier.y);
            ctx.lineTo(drawX - tier.w * 0.34, tier.y + tier.h * 0.48);
            ctx.quadraticCurveTo(drawX - tier.w * 0.12, tier.y + tier.h * 0.58, drawX, tier.y + tier.h * 0.38);
            ctx.quadraticCurveTo(drawX + tier.w * 0.12, tier.y + tier.h * 0.58, drawX + tier.w * 0.34, tier.y + tier.h * 0.48);
            ctx.closePath();
            ctx.fill();

            // Tiny hanging pinecone on lower tiers
            if (idx >= 2) {
              ctx.fillStyle = '#78350f';
              ctx.beginPath();
              ctx.ellipse(drawX + tier.w * 0.3, tier.y + tier.h - 2, 3, 5, 0.2, 0, Math.PI * 2);
              ctx.fill();
            }
          });

        } else if (itemType === 1) {
          // --- TYPE 1: LAYERED GRANITE CRAG FORMATION & QUARTZ VEIN ---
          ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
          ctx.beginPath();
          ctx.ellipse(drawX + 4, t.y + 3, 30, 9, 0, 0, Math.PI * 2);
          ctx.fill();

          // Main faceted granite crag body
          const rockGrad = ctx.createLinearGradient(drawX - 26, t.y - th * 0.75, drawX + 26, t.y);
          rockGrad.addColorStop(0, '#94a3b8');
          rockGrad.addColorStop(0.35, '#64748b');
          rockGrad.addColorStop(0.75, '#475569');
          rockGrad.addColorStop(1, '#1e293b');
          ctx.fillStyle = rockGrad;

          ctx.beginPath();
          ctx.moveTo(drawX - 26, t.y);
          ctx.lineTo(drawX - 20, t.y - th * 0.45);
          ctx.lineTo(drawX - 6, t.y - th * 0.72);
          ctx.lineTo(drawX + 8, t.y - th * 0.62);
          ctx.lineTo(drawX + 22, t.y - th * 0.35);
          ctx.lineTo(drawX + 26, t.y);
          ctx.closePath();
          ctx.fill();

          // Shaded eastern rock facet
          ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
          ctx.beginPath();
          ctx.moveTo(drawX - 6, t.y - th * 0.72);
          ctx.lineTo(drawX + 8, t.y - th * 0.62);
          ctx.lineTo(drawX + 22, t.y - th * 0.35);
          ctx.lineTo(drawX + 26, t.y);
          ctx.lineTo(drawX + 4, t.y);
          ctx.closePath();
          ctx.fill();

          // White quartz crystal fissure vein
          ctx.strokeStyle = '#f1f5f9';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(drawX - 10, t.y - th * 0.65);
          ctx.lineTo(drawX - 2, t.y - th * 0.4);
          ctx.lineTo(drawX + 10, t.y - th * 0.15);
          ctx.stroke();

          // Organic summit snow blanket
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.beginPath();
          ctx.moveTo(drawX - 6, t.y - th * 0.72);
          ctx.lineTo(drawX - 16, t.y - th * 0.52);
          ctx.quadraticCurveTo(drawX - 4, t.y - th * 0.58, drawX + 6, t.y - th * 0.54);
          ctx.lineTo(drawX + 8, t.y - th * 0.62);
          ctx.closePath();
          ctx.fill();

          // Hardy alpine lichen patch
          ctx.fillStyle = '#65a30d';
          ctx.beginPath();
          ctx.arc(drawX - 14, t.y - 10, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#84cc16';
          ctx.beginPath();
          ctx.arc(drawX - 15, t.y - 11, 2.5, 0, Math.PI * 2);
          ctx.fill();

        } else if (itemType === 2) {
          // --- TYPE 2: ALPINE HIKERS' STONE CAIRN & TRAIL MARKER ---
          ctx.fillStyle = 'rgba(15, 23, 42, 0.36)';
          ctx.beginPath();
          ctx.ellipse(drawX - 4, t.y + 2, 24, 7, 0, 0, Math.PI * 2);
          ctx.fill();

          // Balanced multi-colored tumbled stones
          const stones = [
            { y: t.y - 7, w: 26, h: 12, col: '#475569', lit: '#64748b' },
            { y: t.y - 18, w: 21, h: 10, col: '#78716c', lit: '#a8a29e' },
            { y: t.y - 28, w: 16, h: 9, col: '#334155', lit: '#475569' },
            { y: t.y - 37, w: 12, h: 8, col: '#64748b', lit: '#94a3b8' },
            { y: t.y - 45, w: 8, h: 6, col: '#94a3b8', lit: '#cbd5e1' }
          ];

          stones.forEach(s => {
            // Shadowed stone base
            ctx.fillStyle = s.col;
            ctx.beginPath();
            ctx.ellipse(drawX - 6, s.y, s.w * 0.5, s.h * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Sunlit rim highlight
            ctx.fillStyle = s.lit;
            ctx.beginPath();
            ctx.ellipse(drawX - 8, s.y - s.h * 0.15, s.w * 0.35, s.h * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();
          });

          // Summit snow cap on topmost pebble
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.beginPath();
          ctx.ellipse(drawX - 6, t.y - 47, 4.5, 2.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Wooden trail marker stake beside the cairn
          const postX = drawX + 12;
          ctx.fillStyle = '#451a03';
          ctx.fillRect(postX - 2, t.y - 38, 4, 38);
          // Red-and-white painted trail blaze badge
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(postX - 3.5, t.y - 35, 7, 12);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(postX - 3.5, t.y - 31, 7, 4);

          // Alpine moss cushion at cairn base
          ctx.fillStyle = '#15803d';
          ctx.beginPath();
          ctx.arc(drawX - 16, t.y - 2, 6, 0, Math.PI * 2);
          ctx.arc(drawX + 4, t.y - 2, 5, 0, Math.PI * 2);
          ctx.fill();

        } else if (itemType === 3) {
          // --- TYPE 3: ALPINE SCREE MOUND & SKY-BLUE FORGET-ME-NOTS ---
          ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y + 2, 28, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          // Cluster of 3 rounded mountain granite stones
          const rockGrad = ctx.createLinearGradient(drawX - 16, t.y - 20, drawX + 16, t.y);
          rockGrad.addColorStop(0, '#64748b');
          rockGrad.addColorStop(1, '#334155');
          ctx.fillStyle = rockGrad;

          ctx.beginPath();
          ctx.arc(drawX - 8, t.y - 10, 11, 0, Math.PI * 2);
          ctx.arc(drawX + 8, t.y - 8, 9, 0, Math.PI * 2);
          ctx.arc(drawX, t.y - 14, 8, 0, Math.PI * 2);
          ctx.fill();

          // Snow nestled between stones
          ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
          ctx.beginPath();
          ctx.moveTo(drawX - 4, t.y - 18);
          ctx.quadraticCurveTo(drawX, t.y - 12, drawX + 4, t.y - 16);
          ctx.quadraticCurveTo(drawX + 2, t.y - 8, drawX - 2, t.y - 10);
          ctx.closePath();
          ctx.fill();

          // Alpine cushion moss
          ctx.fillStyle = '#16a34a';
          ctx.beginPath();
          ctx.ellipse(drawX - 14, t.y - 3, 10, 5, 0, 0, Math.PI * 2);
          ctx.ellipse(drawX + 14, t.y - 3, 9, 5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Tiny sky-blue alpine forget-me-nots (Eritrichium nanum / King of the Alps)
          const flowers = [
            { x: drawX - 16, y: t.y - 5 },
            { x: drawX - 10, y: t.y - 7 },
            { x: drawX + 12, y: t.y - 5 },
            { x: drawX + 17, y: t.y - 7 }
          ];
          flowers.forEach(f => {
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(f.x, f.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.arc(f.x, f.y, 1.2, 0, Math.PI * 2);
            ctx.fill();
          });

        } else if (itemType === 4) {
          // --- TYPE 4: WIND-SWEPT MOUNTAIN KRUMMHOLZ / DWARF JUNIPER ---
          ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
          ctx.beginPath();
          ctx.ellipse(drawX + 2, t.y + 2, 26, 7, 0, 0, Math.PI * 2);
          ctx.fill();

          // Gnarled twisted wooden branch
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(drawX - 16, t.y);
          ctx.quadraticCurveTo(drawX - 4, t.y - 12, drawX + 6, t.y - 8);
          ctx.quadraticCurveTo(drawX + 14, t.y - 6, drawX + 20, t.y - 2);
          ctx.stroke();

          // Resilient evergreen needle clumps
          const clumps = [
            { x: drawX - 10, y: t.y - 14, r: 9 },
            { x: drawX, y: t.y - 16, r: 11 },
            { x: drawX + 12, y: t.y - 12, r: 10 },
            { x: drawX + 22, y: t.y - 6, r: 8 }
          ];
          clumps.forEach(c => {
            const cGrad = ctx.createRadialGradient(c.x - 2, c.y - 2, 1, c.x, c.y, c.r);
            cGrad.addColorStop(0, '#059669');
            cGrad.addColorStop(0.7, '#064e3b');
            cGrad.addColorStop(1, '#022c22');
            ctx.fillStyle = cGrad;
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
            ctx.fill();

            // Snow dusting on top of needle clump
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(c.x, c.y - c.r * 0.45, c.r * 0.65, Math.PI, 0, false);
            ctx.fill();

            // Red alpine berry dot
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(c.x + 3, c.y + 3, 2, 0, Math.PI * 2);
            ctx.fill();
          });

        } else {
          // --- TYPE 5: GLACIAL ERRATIC BOULDER WITH SNOW DRIFT & ICICLES ---
          ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
          ctx.beginPath();
          ctx.ellipse(drawX + 4, t.y + 3, 32, 10, 0, 0, Math.PI * 2);
          ctx.fill();

          // Substantial rounded-blocky granite boulder
          const bGrad = ctx.createLinearGradient(drawX - 24, t.y - 28, drawX + 24, t.y);
          bGrad.addColorStop(0, '#94a3b8');
          bGrad.addColorStop(0.4, '#64748b');
          bGrad.addColorStop(0.8, '#475569');
          bGrad.addColorStop(1, '#1e293b');
          ctx.fillStyle = bGrad;

          ctx.beginPath();
          ctx.moveTo(drawX - 24, t.y);
          ctx.lineTo(drawX - 22, t.y - 18);
          ctx.quadraticCurveTo(drawX - 12, t.y - 30, drawX + 6, t.y - 28);
          ctx.quadraticCurveTo(drawX + 22, t.y - 26, drawX + 26, t.y - 12);
          ctx.lineTo(drawX + 26, t.y);
          ctx.closePath();
          ctx.fill();

          // Horizontal geological bedding fissures
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.6)';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(drawX - 18, t.y - 14);
          ctx.quadraticCurveTo(drawX, t.y - 12, drawX + 20, t.y - 15);
          ctx.stroke();

          // Smooth banked snow drift on windward left side
          ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
          ctx.beginPath();
          ctx.moveTo(drawX - 28, t.y);
          ctx.quadraticCurveTo(drawX - 20, t.y - 14, drawX - 6, t.y - 28);
          ctx.lineTo(drawX + 8, t.y - 27);
          ctx.quadraticCurveTo(drawX, t.y - 16, drawX - 10, t.y);
          ctx.closePath();
          ctx.fill();

          // Delicate crystalline miniature icicles hanging from rock overhang
          ctx.fillStyle = '#e0f2fe';
          const icicles = [
            { x: drawX + 8, len: 9 },
            { x: drawX + 14, len: 12 },
            { x: drawX + 20, len: 7 }
          ];
          icicles.forEach(ic => {
            ctx.beginPath();
            ctx.moveTo(ic.x - 2, t.y - 12);
            ctx.lineTo(ic.x, t.y - 12 + ic.len);
            ctx.lineTo(ic.x + 2, t.y - 12);
            ctx.closePath();
            ctx.fill();
          });
        }
      } else if (detailed.primary === 'forest') {
        // PURE FOREST POLISHED CARTOON SCENERY
        // 6 Varied Archetypes:
        // 0: Branched Cartoon Forest Oak (visible trunk, 2 branches, 4 rounded leaf clouds)
        // 1: Multi-Stem Cartoon Woodland Birch (ivory bark, slender branches, lime puffs, fallen leaves)
        // 2: Lush Multi-Lobed Forest Bush & Wildflowers (rounded domes, berry dots, arching fern)
        // 3: Broad Canopy Fruit/Berry Tree (trunk hollow, 3 spreading branches, dome canopy, fruit dots)
        // 4: Mossy Hollow Woodland Log (wood rings, velvet moss, spotted red mushrooms, clover)
        // 5: Forest Fern Grove & Wildflower Sapling (arching fern fronds, young sapling, blossoms, mossy pebble)
        const variant = Math.abs(Math.floor(t.x * 0.19 + (t.type || 0))) % 6;

        if (variant === 0) {
          // --- 0: BRANCHED CARTOON FOREST OAK ---
          // Ground shadow
          ctx.fillStyle = 'rgba(10, 35, 18, 0.28)';
          ctx.beginPath();
          ctx.ellipse(drawX + 4, t.y + 3, 30, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          // Visible tapered trunk
          const trunkW = 11;
          const splitY = t.y - th * 0.44;
          const trunkGrad = ctx.createLinearGradient(drawX - trunkW * 0.5, 0, drawX + trunkW * 0.5, 0);
          trunkGrad.addColorStop(0, '#542b10');
          trunkGrad.addColorStop(0.4, '#7c401e');
          trunkGrad.addColorStop(1, '#3d1a08');
          ctx.fillStyle = trunkGrad;

          ctx.beginPath();
          ctx.moveTo(drawX - trunkW * 0.65, t.y);
          ctx.lineTo(drawX - trunkW * 0.35, splitY);
          ctx.lineTo(drawX + trunkW * 0.35, splitY);
          ctx.lineTo(drawX + trunkW * 0.65, t.y);
          ctx.closePath();
          ctx.fill();

          // Bark grain highlight
          ctx.strokeStyle = '#9c5b2b';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(drawX - 1, t.y - 2);
          ctx.lineTo(drawX - 1, splitY + 3);
          ctx.stroke();

          // Multiple branches
          ctx.strokeStyle = '#542b10';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.moveTo(drawX - 2, splitY + 2);
          ctx.quadraticCurveTo(drawX - 10, splitY - 10, drawX - 18, splitY - 18);
          ctx.moveTo(drawX + 2, splitY + 2);
          ctx.quadraticCurveTo(drawX + 10, splitY - 8, drawX + 18, splitY - 16);
          ctx.stroke();

          // Rounded Layered Leafy Canopies (4 overlapping puffs)
          const crownY = t.y - th * 0.72;
          const drawPuff = (cx: number, cy: number, cr: number, isTop: boolean) => {
            const pGrad = ctx.createRadialGradient(cx - cr * 0.35, cy - cr * 0.35, cr * 0.1, cx, cy, cr);
            pGrad.addColorStop(0, isTop ? '#4ade80' : '#22c55e');
            pGrad.addColorStop(0.55, '#16a34a');
            pGrad.addColorStop(1, '#14532d');
            ctx.fillStyle = pGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, Math.PI * 2);
            ctx.fill();

            // Crescent cartoon highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
            ctx.beginPath();
            ctx.arc(cx - cr * 0.28, cy - cr * 0.3, cr * 0.38, 0, Math.PI * 2);
            ctx.fill();
          };

          drawPuff(drawX - 16 + sway * 0.7, crownY + 8, 19, false);
          drawPuff(drawX + 16 + sway * 0.9, crownY + 8, 19, false);
          drawPuff(drawX + sway * 0.5, crownY + 4, 21, false);
          drawPuff(drawX + sway * 0.6, crownY - 12, 23, true);

          // Grass blades & tiny flower at base
          ctx.fillStyle = '#16a34a';
          ctx.fillRect(drawX - 9, t.y - 6, 2, 6);
          ctx.fillRect(drawX + 7, t.y - 5, 2, 5);
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(drawX - 9, t.y - 7, 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (variant === 1) {
          // --- 1: MULTI-STEM CARTOON WOODLAND BIRCH / ASPEN ---
          // Ground shadow
          ctx.fillStyle = 'rgba(10, 35, 18, 0.26)';
          ctx.beginPath();
          ctx.ellipse(drawX + 3, t.y + 3, 26, 7, 0, 0, Math.PI * 2);
          ctx.fill();

          // Main Birch Trunk
          const birchW = 8;
          const bSplitY = t.y - th * 0.48;
          const birchGrad = ctx.createLinearGradient(drawX - birchW * 0.5, 0, drawX + birchW * 0.5, 0);
          birchGrad.addColorStop(0, '#e2e8f0');
          birchGrad.addColorStop(0.5, '#f8fafc');
          birchGrad.addColorStop(1, '#cbd5e1');
          ctx.fillStyle = birchGrad;

          ctx.beginPath();
          ctx.moveTo(drawX - birchW * 0.6, t.y);
          ctx.lineTo(drawX - birchW * 0.35, bSplitY);
          ctx.lineTo(drawX + birchW * 0.35, bSplitY);
          ctx.lineTo(drawX + birchW * 0.6, t.y);
          ctx.closePath();
          ctx.fill();

          // Secondary slender trunk shoot
          ctx.beginPath();
          ctx.moveTo(drawX + 4, t.y);
          ctx.quadraticCurveTo(drawX + 11, t.y - th * 0.25, drawX + 14, t.y - th * 0.42);
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = '#f8fafc';
          ctx.stroke();

          // Birch horizontal bark marks
          ctx.fillStyle = '#475569';
          ctx.fillRect(drawX - 3, t.y - th * 0.16, 5, 1.8);
          ctx.fillRect(drawX - 2.5, t.y - th * 0.32, 5, 1.8);
          ctx.fillRect(drawX + 6, t.y - th * 0.2, 3, 1.5);

          // Slender branches
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(drawX, bSplitY);
          ctx.quadraticCurveTo(drawX - 8, bSplitY - 10, drawX - 16, bSplitY - 20);
          ctx.moveTo(drawX, bSplitY);
          ctx.quadraticCurveTo(drawX + 6, bSplitY - 8, drawX + 14, bSplitY - 18);
          ctx.stroke();

          // Fresh lime-green layered rounded canopy puffs
          const bCrownY = t.y - th * 0.74;
          const drawBirchPuff = (cx: number, cy: number, cr: number) => {
            const bgGrad = ctx.createRadialGradient(cx - cr * 0.35, cy - cr * 0.35, cr * 0.1, cx, cy, cr);
            bgGrad.addColorStop(0, '#86efac');
            bgGrad.addColorStop(0.5, '#22c55e');
            bgGrad.addColorStop(1, '#15803d');
            ctx.fillStyle = bgGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
            ctx.beginPath();
            ctx.arc(cx - cr * 0.28, cy - cr * 0.3, cr * 0.38, 0, Math.PI * 2);
            ctx.fill();
          };

          drawBirchPuff(drawX - 13 + sway * 0.7, bCrownY + 6, 17);
          drawBirchPuff(drawX + 13 + sway * 0.9, bCrownY + 4, 16);
          drawBirchPuff(drawX + sway * 0.5, bCrownY - 10, 20);

          // Fallen autumn leaves on ground near base
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.ellipse(drawX - 12, t.y + 1, 4, 2, 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.ellipse(drawX + 14, t.y + 2, 3.5, 1.8, -0.4, 0, Math.PI * 2);
          ctx.fill();
        } else if (variant === 2) {
          // --- 2: LUSH MULTI-LOBED FOREST BUSH & WILDFLOWERS ---
          // Ground shadow
          ctx.fillStyle = 'rgba(10, 35, 18, 0.25)';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y + 2, 28, 7, 0, 0, Math.PI * 2);
          ctx.fill();

          // Arching fern frond behind bush
          ctx.strokeStyle = '#15803d';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(drawX - 12, t.y);
          ctx.quadraticCurveTo(drawX - 26, t.y - 18, drawX - 34, t.y - 10);
          ctx.stroke();

          // Rounded multi-lobed bush
          const drawBushLobe = (bx: number, by: number, br: number, colTop: string, colBot: string) => {
            const bGrad = ctx.createRadialGradient(bx - br * 0.35, by - br * 0.35, br * 0.1, bx, by, br);
            bGrad.addColorStop(0, colTop);
            bGrad.addColorStop(1, colBot);
            ctx.fillStyle = bGrad;
            ctx.beginPath();
            ctx.arc(bx, by, br, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
            ctx.beginPath();
            ctx.arc(bx - br * 0.28, by - br * 0.3, br * 0.38, 0, Math.PI * 2);
            ctx.fill();
          };

          drawBushLobe(drawX - 16, t.y - 12, 14, '#4ade80', '#15803d');
          drawBushLobe(drawX + 16, t.y - 12, 14, '#4ade80', '#15803d');
          drawBushLobe(drawX - 8, t.y - 20, 16, '#86efac', '#16a34a');
          drawBushLobe(drawX + 8, t.y - 21, 16, '#86efac', '#16a34a');

          // Berry and flower accents
          const berryCols = ['#f43f5e', '#fbbf24', '#38bdf8', '#f43f5e'];
          for (let b = 0; b < 4; b++) {
            const bx = drawX - 18 + b * 11;
            const by = t.y - 15 - (b % 2) * 8;
            ctx.fillStyle = berryCols[b];
            ctx.beginPath();
            ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(bx - 0.7, by - 0.7, 0.8, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (variant === 3) {
          // --- 3: BROAD CANOPY CARTOON TREE WITH HOLLOW & FOREST APPLES ---
          // Ground shadow
          ctx.fillStyle = 'rgba(10, 35, 18, 0.28)';
          ctx.beginPath();
          ctx.ellipse(drawX + 2, t.y + 3, 32, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          // Sturdy trunk
          const trunkW = 13;
          const sY = t.y - th * 0.42;
          const trGrad = ctx.createLinearGradient(drawX - trunkW * 0.5, 0, drawX + trunkW * 0.5, 0);
          trGrad.addColorStop(0, '#542b10');
          trGrad.addColorStop(0.4, '#7c401e');
          trGrad.addColorStop(1, '#3d1a08');
          ctx.fillStyle = trGrad;

          ctx.beginPath();
          ctx.moveTo(drawX - trunkW * 0.65, t.y);
          ctx.lineTo(drawX - trunkW * 0.35, sY);
          ctx.lineTo(drawX + trunkW * 0.35, sY);
          ctx.lineTo(drawX + trunkW * 0.65, t.y);
          ctx.closePath();
          ctx.fill();

          // Cute little dark tree hollow
          ctx.fillStyle = '#27170f';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y - th * 0.22, 3, 4.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // 3 Spreading branches
          ctx.strokeStyle = '#542b10';
          ctx.lineWidth = 3.4;
          ctx.beginPath();
          ctx.moveTo(drawX - 3, sY);
          ctx.quadraticCurveTo(drawX - 12, sY - 12, drawX - 22, sY - 20);
          ctx.moveTo(drawX + 3, sY);
          ctx.quadraticCurveTo(drawX + 12, sY - 10, drawX + 22, sY - 18);
          ctx.moveTo(drawX, sY);
          ctx.lineTo(drawX, sY - 16);
          ctx.stroke();

          // Broad Layered Rounded Canopy (5 leaf clusters)
          const crY = t.y - th * 0.7;
          const drawCloud = (cx: number, cy: number, cr: number) => {
            const cGrad = ctx.createRadialGradient(cx - cr * 0.35, cy - cr * 0.35, cr * 0.1, cx, cy, cr);
            cGrad.addColorStop(0, '#4ade80');
            cGrad.addColorStop(0.55, '#16a34a');
            cGrad.addColorStop(1, '#14532d');
            ctx.fillStyle = cGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
            ctx.beginPath();
            ctx.arc(cx - cr * 0.28, cy - cr * 0.3, cr * 0.38, 0, Math.PI * 2);
            ctx.fill();
          };

          drawCloud(drawX - 20 + sway * 0.7, crY + 8, 18);
          drawCloud(drawX + 20 + sway * 0.9, crY + 8, 18);
          drawCloud(drawX - 10 + sway * 0.6, crY - 6, 21);
          drawCloud(drawX + 10 + sway * 0.7, crY - 6, 21);
          drawCloud(drawX + sway * 0.5, crY - 14, 22);

          // Red woodland apples/berries in the tree
          const applePositions = [
            { x: drawX - 14, y: crY + 2 },
            { x: drawX + 16, y: crY + 4 },
            { x: drawX + 2, y: crY - 6 },
            { x: drawX - 6, y: crY + 8 }
          ];
          applePositions.forEach(ap => {
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(ap.x + sway * 0.6, ap.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(ap.x + sway * 0.6 - 0.8, ap.y - 0.8, 1, 0, Math.PI * 2);
            ctx.fill();
          });
        } else if (variant === 4) {
          // --- 4: MOSSY HOLLOW WOODLAND LOG & SPOTTED MUSHROOMS ---
          // Ground shadow
          ctx.fillStyle = 'rgba(10, 35, 18, 0.28)';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y + 3, 28, 7, 0, 0, Math.PI * 2);
          ctx.fill();

          // Fallen bark log
          const logGrad = ctx.createLinearGradient(0, t.y - 14, 0, t.y);
          logGrad.addColorStop(0, '#572b0d');
          logGrad.addColorStop(0.6, '#3e1f0a');
          logGrad.addColorStop(1, '#27170f');
          ctx.fillStyle = logGrad;
          drawRoundRect(ctx, drawX - 24, t.y - 13, 48, 14, 6);
          ctx.fill();

          // Hollow inner cut on log end
          ctx.fillStyle = '#1c0f07';
          ctx.beginPath();
          ctx.ellipse(drawX - 22, t.y - 6, 3, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          // Velvet moss top layer
          const mossGrad = ctx.createLinearGradient(0, t.y - 14, 0, t.y - 9);
          mossGrad.addColorStop(0, '#4ade80');
          mossGrad.addColorStop(1, '#16a34a');
          ctx.fillStyle = mossGrad;
          ctx.beginPath();
          ctx.ellipse(drawX + 2, t.y - 12, 19, 4, 0, 0, Math.PI * 2);
          ctx.fill();

          // 3 Cute Cartoon Spotted Mushrooms
          const mushCols = ['#ef4444', '#f97316', '#ef4444'];
          for (let m = 0; m < 3; m++) {
            const mx = drawX - 8 + m * 9;
            const my = t.y - 13;
            // White Stem
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(mx - 1.2, my - 8, 2.4, 8);
            // Red Cap
            ctx.fillStyle = mushCols[m];
            ctx.beginPath();
            ctx.arc(mx, my - 8, 5, Math.PI, 0, false);
            ctx.fill();
            // Cap white dots
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(mx - 1.5, my - 10, 1.2, 0, Math.PI * 2);
            ctx.arc(mx + 1.8, my - 9, 1, 0, Math.PI * 2);
            ctx.fill();
          }

          // Small patch of woodland clover alongside
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(drawX + 21, t.y - 4, 2.5, 0, Math.PI * 2);
          ctx.arc(drawX + 24, t.y - 6, 2.5, 0, Math.PI * 2);
          ctx.arc(drawX + 26, t.y - 4, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // --- 5: FOREST FERN GROVE & WILDFLOWER SAPLING ---
          // Ground shadow
          ctx.fillStyle = 'rgba(10, 35, 18, 0.25)';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y + 2, 24, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          // Arching fern fronds
          const fernColors = ['#15803d', '#16a34a', '#22c55e', '#4ade80'];
          for (let f = 0; f < 5; f++) {
            const angle = (f / 5) * Math.PI + Math.PI;
            const frondLen = 20 + (f % 2) * 5;
            const fx = drawX + Math.cos(angle) * frondLen + sway * 0.4;
            const fy = t.y + Math.sin(angle) * (frondLen * 0.7);

            ctx.strokeStyle = fernColors[f % fernColors.length];
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.moveTo(drawX, t.y);
            ctx.quadraticCurveTo(drawX + Math.cos(angle) * 10, t.y - 15, fx, fy);
            ctx.stroke();

            // Leaflet side ticks
            ctx.fillStyle = fernColors[(f + 1) % fernColors.length];
            ctx.beginPath();
            ctx.arc(fx, fy, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }

          // Slender young sapling in center
          ctx.strokeStyle = '#7c401e';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(drawX + 4, t.y);
          ctx.quadraticCurveTo(drawX + 6, t.y - 18, drawX + 7, t.y - 32);
          ctx.stroke();

          // Sapling small leaf puffs
          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.arc(drawX + 5, t.y - 34, 7, 0, Math.PI * 2);
          ctx.arc(drawX + 11, t.y - 32, 6, 0, Math.PI * 2);
          ctx.fill();

          // Wildflower blossoms
          ctx.fillStyle = '#ec4899';
          ctx.beginPath();
          ctx.arc(drawX - 12, t.y - 5, 2.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(drawX - 12, t.y - 5, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (detailed.primary === 'temple') {
        // =================================================================
        // ANCIENT TEMPLE RUINS PROCEDURAL SCENERY
        // =================================================================
        const variant = itemType % 6;
        if (variant === 0) {
          // --- 0: ANCIENT FLUTED PILLAR WITH CARVED CAPITAL & CREEPING IVY ---
          // Soft ground shadow
          ctx.fillStyle = 'rgba(70, 45, 20, 0.28)';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y + 4, 30, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          const pilW = 20;
          const pilH = th * 0.95;

          // Two-tiered carved pedestal base
          ctx.fillStyle = '#a67d58';
          ctx.fillRect(drawX - pilW * 0.85, t.y - 7, pilW * 1.7, 7);
          ctx.fillStyle = '#cda277';
          ctx.fillRect(drawX - pilW * 0.85, t.y - 7, pilW * 0.5, 7); // Sunlit left
          ctx.fillStyle = '#bfa07d';
          ctx.fillRect(drawX - pilW * 0.7, t.y - 14, pilW * 1.4, 7);
          ctx.fillStyle = '#ebd1b5';
          ctx.fillRect(drawX - pilW * 0.7, t.y - 14, pilW * 0.45, 7);

          // Shaft body with fluting gradient
          const shaftGrad = ctx.createLinearGradient(drawX - pilW * 0.5, 0, drawX + pilW * 0.5, 0);
          shaftGrad.addColorStop(0, '#f5e4cf');
          shaftGrad.addColorStop(0.35, '#dcba97');
          shaftGrad.addColorStop(0.75, '#b08760');
          shaftGrad.addColorStop(1, '#8c6239');
          ctx.fillStyle = shaftGrad;
          ctx.fillRect(drawX - pilW * 0.5, t.y - pilH, pilW, pilH - 14);

          // Vertical fluting lines
          ctx.strokeStyle = 'rgba(100, 65, 35, 0.4)';
          ctx.lineWidth = 1.6;
          for (let f = -1; f <= 1; f++) {
            ctx.beginPath();
            ctx.moveTo(drawX + f * 5, t.y - pilH + 3);
            ctx.lineTo(drawX + f * 5, t.y - 14);
            ctx.stroke();
          }

          // Carved Ionic style scrolled capital
          ctx.fillStyle = '#ebd1b5';
          ctx.fillRect(drawX - pilW * 0.9, t.y - pilH - 8, pilW * 1.8, 9);
          ctx.fillStyle = '#d4b18f';
          ctx.beginPath();
          ctx.arc(drawX - pilW * 0.75, t.y - pilH - 4, 4.5, 0, Math.PI * 2);
          ctx.arc(drawX + pilW * 0.75, t.y - pilH - 4, 4.5, 0, Math.PI * 2);
          ctx.fill();

          // Creeping ivy vine spiraling around column
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(drawX - pilW * 0.5, t.y - 16);
          ctx.quadraticCurveTo(drawX + pilW * 0.4, t.y - pilH * 0.35, drawX - pilW * 0.4, t.y - pilH * 0.65);
          ctx.quadraticCurveTo(drawX + pilW * 0.5, t.y - pilH * 0.85, drawX, t.y - pilH);
          ctx.stroke();

          // Lush ivy leaf clusters
          ctx.fillStyle = '#15803d';
          for (let l = 0; l < 6; l++) {
            const lx = drawX - pilW * 0.35 + Math.sin(l * 1.5) * 8;
            const ly = t.y - 20 - l * (pilH * 0.14);
            ctx.beginPath();
            ctx.arc(lx, ly, 3.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#4ade80';
            ctx.beginPath();
            ctx.arc(lx - 0.8, ly - 0.8, 1.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#15803d';
          }
        } else if (variant === 1) {
          // --- 1: OVERGROWN ANCIENT TEMPLE STONE ARCHWAY ---
          ctx.fillStyle = 'rgba(70, 45, 20, 0.28)';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y + 4, 38, 9, 0, 0, Math.PI * 2);
          ctx.fill();

          const archW = 54;
          const archH = th * 0.9;
          const pierW = 13;

          // Left pier
          const pierGrad = ctx.createLinearGradient(drawX - archW * 0.5, 0, drawX + archW * 0.5, 0);
          pierGrad.addColorStop(0, '#f5e4cf');
          pierGrad.addColorStop(0.4, '#d4b18f');
          pierGrad.addColorStop(1, '#8c6239');
          ctx.fillStyle = pierGrad;
          ctx.fillRect(drawX - archW * 0.5, t.y - archH, pierW, archH);
          // Right pier
          ctx.fillRect(drawX + archW * 0.5 - pierW, t.y - archH, pierW, archH);

          // Horizontal stone block mortar cuts on piers
          ctx.fillStyle = 'rgba(100, 65, 35, 0.4)';
          for (let py = t.y - 18; py > t.y - archH; py -= 16) {
            ctx.fillRect(drawX - archW * 0.5, py, pierW, 1.6);
            ctx.fillRect(drawX + archW * 0.5 - pierW, py, pierW, 1.6);
          }

          // Arched lintel block
          ctx.fillStyle = '#ebd1b5';
          ctx.fillRect(drawX - archW * 0.55, t.y - archH - 12, archW * 1.1, 13);
          ctx.fillStyle = '#a67d58';
          ctx.fillRect(drawX + archW * 0.35, t.y - archH - 12, archW * 0.2, 13);

          // Golden keystone
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.moveTo(drawX - 5, t.y - archH - 15);
          ctx.lineTo(drawX + 5, t.y - archH - 15);
          ctx.lineTo(drawX + 3.5, t.y - archH);
          ctx.lineTo(drawX - 3.5, t.y - archH);
          ctx.closePath();
          ctx.fill();

          // Hanging moss curtains swaying under arch
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(drawX - 12, t.y - archH);
          ctx.lineTo(drawX - 12 + sway * 0.5, t.y - archH + 16);
          ctx.moveTo(drawX + 10, t.y - archH);
          ctx.lineTo(drawX + 10 + sway * 0.6, t.y - archH + 22);
          ctx.moveTo(drawX, t.y - archH);
          ctx.lineTo(drawX + sway * 0.4, t.y - archH + 12);
          ctx.stroke();
        } else if (variant === 2) {
          // --- 2: INSCRIBED RUNIC MONOLITH / ANCIENT STELE ---
          ctx.fillStyle = 'rgba(70, 45, 20, 0.26)';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y + 4, 26, 7, 0, 0, Math.PI * 2);
          ctx.fill();

          const steleW = 22;
          const steleH = th * 0.8;

          // Stepped stone plinth
          ctx.fillStyle = '#9e734c';
          ctx.fillRect(drawX - steleW * 0.8, t.y - 7, steleW * 1.6, 7);
          ctx.fillStyle = '#c49a71';
          ctx.fillRect(drawX - steleW * 0.6, t.y - 13, steleW * 1.2, 6);

          // Tapered stele stone body
          ctx.fillStyle = '#ebd1b5';
          ctx.beginPath();
          ctx.moveTo(drawX - steleW * 0.45, t.y - 13);
          ctx.lineTo(drawX - steleW * 0.35, t.y - steleH);
          ctx.lineTo(drawX, t.y - steleH - 10);
          ctx.lineTo(drawX + steleW * 0.35, t.y - steleH);
          ctx.lineTo(drawX + steleW * 0.45, t.y - 13);
          ctx.closePath();
          ctx.fill();

          // Shadowed side of stele
          ctx.fillStyle = '#a67d58';
          ctx.beginPath();
          ctx.moveTo(drawX, t.y - steleH - 10);
          ctx.lineTo(drawX + steleW * 0.35, t.y - steleH);
          ctx.lineTo(drawX + steleW * 0.45, t.y - 13);
          ctx.lineTo(drawX, t.y - 13);
          ctx.closePath();
          ctx.fill();

          // Mystical glowing inscribed runic glyphs
          const glyphPulse = 0.65 + Math.sin(time * 3 + t.x * 0.05) * 0.35;
          ctx.strokeStyle = `rgba(251, 191, 36, ${glyphPulse})`;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          // Rune 1
          ctx.moveTo(drawX - 3, t.y - steleH * 0.7);
          ctx.lineTo(drawX + 3, t.y - steleH * 0.7);
          ctx.moveTo(drawX, t.y - steleH * 0.8);
          ctx.lineTo(drawX, t.y - steleH * 0.6);
          // Rune 2 (diamond)
          ctx.moveTo(drawX, t.y - steleH * 0.52);
          ctx.lineTo(drawX + 3, t.y - steleH * 0.44);
          ctx.lineTo(drawX, t.y - steleH * 0.36);
          ctx.lineTo(drawX - 3, t.y - steleH * 0.44);
          ctx.closePath();
          ctx.stroke();

          // Soft ambient runic aura
          const runeGlow = ctx.createRadialGradient(drawX, t.y - steleH * 0.5, 2, drawX, t.y - steleH * 0.5, 24);
          runeGlow.addColorStop(0, `rgba(254, 240, 138, ${0.4 * glyphPulse})`);
          runeGlow.addColorStop(1, 'rgba(251, 191, 36, 0)');
          ctx.fillStyle = runeGlow;
          ctx.beginPath();
          ctx.arc(drawX, t.y - steleH * 0.5, 24, 0, Math.PI * 2);
          ctx.fill();
        } else if (variant === 3) {
          // --- 3: BROKEN PEDIMENT & TUMBLING COLUMN DRUMS ---
          ctx.fillStyle = 'rgba(70, 45, 20, 0.28)';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y + 4, 36, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          // Tumbled cylindrical column drum (horizontal)
          ctx.fillStyle = '#ebd1b5';
          ctx.fillRect(drawX - 24, t.y - 18, 22, 18);
          ctx.fillStyle = '#a67d58';
          ctx.fillRect(drawX - 10, t.y - 18, 8, 18);
          ctx.fillStyle = '#d4b18f';
          ctx.beginPath();
          ctx.ellipse(drawX - 24, t.y - 9, 4, 9, 0, 0, Math.PI * 2);
          ctx.fill();

          // Leaning broken pediment block
          ctx.fillStyle = '#f5e4cf';
          ctx.beginPath();
          ctx.moveTo(drawX + 2, t.y);
          ctx.lineTo(drawX + 6, t.y - 38);
          ctx.lineTo(drawX + 28, t.y - 12);
          ctx.lineTo(drawX + 26, t.y);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#a67d58';
          ctx.beginPath();
          ctx.moveTo(drawX + 6, t.y - 38);
          ctx.lineTo(drawX + 28, t.y - 12);
          ctx.lineTo(drawX + 26, t.y);
          ctx.lineTo(drawX + 16, t.y);
          ctx.closePath();
          ctx.fill();

          // Wild ferns and golden buttercups sprouting around the ruin
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(drawX - 8, t.y - 4, 4, 0, Math.PI * 2);
          ctx.arc(drawX + 32, t.y - 4, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(drawX - 8, t.y - 7, 2.5, 0, Math.PI * 2);
          ctx.arc(drawX + 32, t.y - 7, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (variant === 4) {
          // --- 4: CEREMONIAL STONE BRAZIER WITH GOLDEN FLAME ---
          ctx.fillStyle = 'rgba(70, 45, 20, 0.28)';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y + 4, 24, 7, 0, 0, Math.PI * 2);
          ctx.fill();

          const urnW = 28;
          const urnH = th * 0.72;

          // Stepped stone pedestal
          ctx.fillStyle = '#a67d58';
          ctx.fillRect(drawX - urnW * 0.6, t.y - 6, urnW * 1.2, 6);
          ctx.fillStyle = '#cba580';
          ctx.fillRect(drawX - urnW * 0.35, t.y - urnH * 0.65, urnW * 0.7, urnH * 0.65 - 6);
          ctx.fillStyle = '#f5e4cf';
          ctx.fillRect(drawX - urnW * 0.35, t.y - urnH * 0.65, urnW * 0.25, urnH * 0.65 - 6); // Highlight

          // Stone brazier bowl
          ctx.fillStyle = '#d4b18f';
          ctx.beginPath();
          ctx.moveTo(drawX - urnW * 0.5, t.y - urnH);
          ctx.lineTo(drawX + urnW * 0.5, t.y - urnH);
          ctx.lineTo(drawX + urnW * 0.3, t.y - urnH * 0.65);
          ctx.lineTo(drawX - urnW * 0.3, t.y - urnH * 0.65);
          ctx.closePath();
          ctx.fill();

          // Ambient warm brazier glow
          const flameGlow = ctx.createRadialGradient(drawX, t.y - urnH - 10, 2, drawX, t.y - urnH - 10, 36);
          flameGlow.addColorStop(0, 'rgba(254, 240, 138, 0.6)');
          flameGlow.addColorStop(0.4, 'rgba(245, 158, 11, 0.3)');
          flameGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
          ctx.fillStyle = flameGlow;
          ctx.beginPath();
          ctx.arc(drawX, t.y - urnH - 10, 36, 0, Math.PI * 2);
          ctx.fill();

          // Animated golden eternal flame
          const flameFlicker = Math.sin(time * 8 + t.x) * 3;
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.moveTo(drawX - 9, t.y - urnH);
          ctx.quadraticCurveTo(drawX - 5 + flameFlicker, t.y - urnH - 18, drawX + flameFlicker * 0.5, t.y - urnH - 24);
          ctx.quadraticCurveTo(drawX + 5 + flameFlicker, t.y - urnH - 18, drawX + 9, t.y - urnH);
          ctx.closePath();
          ctx.fill();

          // Core hot flame
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.moveTo(drawX - 4, t.y - urnH);
          ctx.quadraticCurveTo(drawX, t.y - urnH - 12, drawX, t.y - urnH - 16);
          ctx.quadraticCurveTo(drawX, t.y - urnH - 12, drawX + 4, t.y - urnH);
          ctx.closePath();
          ctx.fill();
        } else {
          // --- 5: RUINED TEMPLE WALL FRAGMENT WITH CARVED FRIEZE ---
          ctx.fillStyle = 'rgba(70, 45, 20, 0.28)';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y + 4, 34, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          const wallW = 44;
          const wallH = th * 0.65;

          // Main stone wall block
          const wallGrad = ctx.createLinearGradient(drawX - wallW * 0.5, 0, drawX + wallW * 0.5, 0);
          wallGrad.addColorStop(0, '#f5e4cf');
          wallGrad.addColorStop(0.4, '#d4b18f');
          wallGrad.addColorStop(1, '#8c6239');
          ctx.fillStyle = wallGrad;
          ctx.beginPath();
          ctx.moveTo(drawX - wallW * 0.5, t.y);
          ctx.lineTo(drawX - wallW * 0.5, t.y - wallH);
          ctx.lineTo(drawX - wallW * 0.2, t.y - wallH - 6);
          ctx.lineTo(drawX + wallW * 0.1, t.y - wallH + 4);
          ctx.lineTo(drawX + wallW * 0.5, t.y - wallH * 0.6);
          ctx.lineTo(drawX + wallW * 0.5, t.y);
          ctx.closePath();
          ctx.fill();

          // Carved geometric relief frieze line
          ctx.strokeStyle = 'rgba(100, 65, 35, 0.5)';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(drawX - wallW * 0.45, t.y - wallH * 0.5);
          ctx.lineTo(drawX + wallW * 0.4, t.y - wallH * 0.5);
          ctx.stroke();

          // Creeping ivy on wall
          ctx.strokeStyle = '#15803d';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(drawX - wallW * 0.4, t.y);
          ctx.quadraticCurveTo(drawX - wallW * 0.2, t.y - wallH * 0.4, drawX, t.y - wallH * 0.8);
          ctx.stroke();

          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.arc(drawX - 10, t.y - 14, 3, 0, Math.PI * 2);
          ctx.arc(drawX - 4, t.y - 24, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (detailed.primary === 'volcano') {
        // =================================================================
        // VOLCANIC AREA PROCEDURAL SCENERY
        // =================================================================
        const variant = itemType % 6;
        if (variant === 0) {
          // --- 0: TOWERING BASALT SPIRE WITH GLOWING MAGMA CORE ---
          ctx.fillStyle = 'rgba(20, 10, 12, 0.35)';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y + 4, 28, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          const spW = 26;
          const spH = th * 0.95;

          // Main dark basalt body
          ctx.fillStyle = '#1c1917';
          ctx.beginPath();
          ctx.moveTo(drawX - spW * 0.5, t.y);
          ctx.lineTo(drawX - spW * 0.2, t.y - spH);
          ctx.lineTo(drawX + spW * 0.05, t.y - spH - 8);
          ctx.lineTo(drawX + spW * 0.4, t.y - spH * 0.45);
          ctx.lineTo(drawX + spW * 0.45, t.y);
          ctx.closePath();
          ctx.fill();

          // Chiseled rock facet highlight
          ctx.fillStyle = '#292524';
          ctx.beginPath();
          ctx.moveTo(drawX - spW * 0.5, t.y);
          ctx.lineTo(drawX - spW * 0.2, t.y - spH);
          ctx.lineTo(drawX, t.y);
          ctx.closePath();
          ctx.fill();

          // Pulsing glowing molten magma crack
          const pulse = 0.75 + Math.sin(time * 3 + t.x * 0.04) * 0.25;
          ctx.strokeStyle = `rgba(249, 115, 22, ${pulse})`;
          ctx.lineWidth = 2.8;
          ctx.beginPath();
          ctx.moveTo(drawX - 2, t.y - spH + 10);
          ctx.lineTo(drawX + 3, t.y - spH * 0.6);
          ctx.lineTo(drawX - 1, t.y - spH * 0.3);
          ctx.lineTo(drawX + 4, t.y - 6);
          ctx.stroke();

          ctx.strokeStyle = `rgba(254, 240, 138, ${pulse})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Ambient magma glow
          const spireGlow = ctx.createRadialGradient(drawX, t.y - spH * 0.5, 2, drawX, t.y - spH * 0.5, 32);
          spireGlow.addColorStop(0, `rgba(239, 68, 68, ${0.4 * pulse})`);
          spireGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = spireGlow;
          ctx.beginPath();
          ctx.arc(drawX, t.y - spH * 0.5, 32, 0, Math.PI * 2);
          ctx.fill();
        } else if (variant === 1) {
          // --- 1: SMOLDERING VOLCANIC VENT / FUMAROLE WITH STEAM PUFFS ---
          ctx.fillStyle = 'rgba(20, 10, 12, 0.35)';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y + 4, 32, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          const vW = 34;
          const vH = th * 0.65;

          // Cone vent rock body
          ctx.fillStyle = '#262626';
          ctx.beginPath();
          ctx.moveTo(drawX - vW * 0.5, t.y);
          ctx.lineTo(drawX - vW * 0.28, t.y - vH);
          ctx.lineTo(drawX + vW * 0.28, t.y - vH);
          ctx.lineTo(drawX + vW * 0.5, t.y);
          ctx.closePath();
          ctx.fill();

          // Crater opening
          ctx.fillStyle = '#171717';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y - vH, vW * 0.28, 5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Incandescent magma mouth
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y - vH, vW * 0.2, 3.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y - vH, vW * 0.1, 1.8, 0, 0, Math.PI * 2);
          ctx.fill();

          // Sulfur crystals on rim
          ctx.fillStyle = '#eab308';
          ctx.fillRect(drawX - vW * 0.25, t.y - vH + 2, 3.5, 3);
          ctx.fillRect(drawX + vW * 0.18, t.y - vH + 1, 3.5, 3);

          // Animated smoke puffs rising from vent
          for (let s = 0; s < 3; s++) {
            const pTime = (time * 1.2 + s * 0.8 + t.x * 0.01) % 2.4;
            const pFrac = pTime / 2.4;
            const pY = (t.y - vH) - pFrac * 60;
            const pX = drawX + Math.sin(pTime * 2 + s) * 7 + pFrac * 10;
            const pR = 5 + pFrac * 14;
            ctx.fillStyle = `rgba(113, 113, 122, ${(1 - pFrac) * 0.4})`;
            ctx.beginPath();
            ctx.arc(pX, pY, pR, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (variant === 2) {
          // --- 2: CHISELED OBSIDIAN CRAG WITH SULFUR FLECK DEPOSITS ---
          ctx.fillStyle = 'rgba(20, 10, 12, 0.35)';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y + 4, 30, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          const oW = 36;
          const oH = th * 0.75;

          // Main glossy obsidian rock
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.moveTo(drawX - oW * 0.48, t.y);
          ctx.lineTo(drawX - oW * 0.35, t.y - oH * 0.8);
          ctx.lineTo(drawX - oW * 0.05, t.y - oH);
          ctx.lineTo(drawX + oW * 0.3, t.y - oH * 0.85);
          ctx.lineTo(drawX + oW * 0.48, t.y);
          ctx.closePath();
          ctx.fill();

          // Reflective specular facets
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.moveTo(drawX - oW * 0.35, t.y - oH * 0.8);
          ctx.lineTo(drawX - oW * 0.05, t.y - oH);
          ctx.lineTo(drawX + oW * 0.05, t.y - oH * 0.3);
          ctx.lineTo(drawX - oW * 0.15, t.y);
          ctx.closePath();
          ctx.fill();

          // Sharp highlight edge
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(drawX - oW * 0.05, t.y - oH);
          ctx.lineTo(drawX + oW * 0.05, t.y - oH * 0.3);
          ctx.stroke();

          // Bright sulfur crystal crusts
          ctx.fillStyle = '#facc15';
          ctx.fillRect(drawX - oW * 0.28, t.y - 12, 5, 4);
          ctx.fillRect(drawX + oW * 0.18, t.y - 16, 6, 4);
        } else if (variant === 3) {
          // --- 3: HARDENED PILLOW LAVA MOUND WITH GLOWING CREVICES ---
          ctx.fillStyle = 'rgba(20, 10, 12, 0.35)';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y + 4, 34, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          const mndW = 42;
          const mndH = th * 0.6;

          // Cooled basalt crust mound
          ctx.fillStyle = '#262626';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y - mndH * 0.4, mndW * 0.48, mndH * 0.5, 0, Math.PI, 0, false);
          ctx.closePath();
          ctx.fill();

          // Glowing incandescent lava cracks
          const glowT = 0.7 + Math.sin(time * 4 + t.x * 0.03) * 0.3;
          ctx.strokeStyle = `rgba(239, 68, 68, ${glowT})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(drawX, t.y - mndH * 0.4, mndW * 0.35, Math.PI * 1.15, Math.PI * 1.45);
          ctx.arc(drawX + 8, t.y - mndH * 0.3, mndW * 0.25, Math.PI * 1.5, Math.PI * 1.85);
          ctx.stroke();

          ctx.strokeStyle = `rgba(254, 240, 138, ${glowT})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else if (variant === 4) {
          // --- 4: CHARRED BASALT HEXAGONAL COLUMN & FLOATING EMBERS ---
          ctx.fillStyle = 'rgba(20, 10, 12, 0.35)';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y + 4, 26, 7, 0, 0, Math.PI * 2);
          ctx.fill();

          const colW = 20;
          const colH = th * 0.85;

          // Column body
          ctx.fillStyle = '#171717';
          ctx.fillRect(drawX - colW * 0.5, t.y - colH, colW, colH);
          ctx.fillStyle = '#262626';
          ctx.fillRect(drawX - colW * 0.5, t.y - colH, colW * 0.45, colH);

          // Hexagonal top cap
          ctx.fillStyle = '#404040';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y - colH, colW * 0.5, 5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Floating fiery embers rising around column
          for (let em = 0; em < 4; em++) {
            const eFrac = ((time * 1.5 + em * 0.6 + t.x * 0.02) % 2.5) / 2.5;
            const eY = t.y - eFrac * (colH + 25);
            const eX = drawX - 12 + em * 8 + Math.sin(time * 3 + em) * 5;
            ctx.fillStyle = em % 2 === 0 ? '#fef08a' : '#f97316';
            ctx.beginPath();
            ctx.arc(eX, eY, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // --- 5: VOLCANIC GEODE BOULDER WITH FIERY MOLTEN CRYSTALS ---
          ctx.fillStyle = 'rgba(20, 10, 12, 0.35)';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y + 4, 30, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          const gW = 36;
          const gH = th * 0.65;

          // Dark outer crust
          ctx.fillStyle = '#1c1917';
          ctx.beginPath();
          ctx.ellipse(drawX, t.y - gH * 0.45, gW * 0.45, gH * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();

          // Hollow glowing inner cavity
          ctx.fillStyle = '#7f1d1d';
          ctx.beginPath();
          ctx.ellipse(drawX + 2, t.y - gH * 0.45, gW * 0.28, gH * 0.28, 0, 0, Math.PI * 2);
          ctx.fill();

          // Glowing magma crystal core
          const coreGlow = 0.7 + Math.sin(time * 3.5 + t.x * 0.05) * 0.3;
          ctx.fillStyle = `rgba(249, 115, 22, ${coreGlow})`;
          ctx.beginPath();
          ctx.ellipse(drawX + 2, t.y - gH * 0.45, gW * 0.18, gH * 0.18, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(drawX + 2, t.y - gH * 0.45, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // PURE MEADOW OAK TREE
        ctx.fillStyle = 'rgba(20, 45, 25, 0.24)';
        ctx.beginPath();
        ctx.ellipse(drawX + 8, t.y + 4, 28, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        const trunkGrad = ctx.createLinearGradient(drawX - 6, 0, drawX + 6, 0);
        trunkGrad.addColorStop(0, '#a56934');
        trunkGrad.addColorStop(0.35, '#8c5225');
        trunkGrad.addColorStop(1, '#5d3211');
        ctx.fillStyle = trunkGrad;

        ctx.beginPath();
        ctx.moveTo(drawX - 5, t.y);
        ctx.lineTo(drawX - 4, t.y - th * 0.55);
        ctx.lineTo(drawX + 4, t.y - th * 0.55);
        ctx.lineTo(drawX + 6, t.y);
        ctx.closePath();
        ctx.fill();

        const crownY = t.y - th * 0.65;
        const drawCrownSphere = (cx: number, cy: number, r: number) => {
          const leafGrad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.15, cx, cy, r);
          leafGrad.addColorStop(0, '#66cb50');
          leafGrad.addColorStop(0.5, '#3b9b2c');
          leafGrad.addColorStop(0.9, '#246b19');
          leafGrad.addColorStop(1, '#174a0e');
          ctx.fillStyle = leafGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
          ctx.beginPath();
          ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.38, 0, Math.PI * 2);
          ctx.fill();
        };

        drawCrownSphere(drawX - 14 + sway * 0.8, crownY + 8, 18);
        drawCrownSphere(drawX + 14 + sway * 1.1, crownY + 8, 18);
        drawCrownSphere(drawX + sway, crownY - 6, 24);
      }
    }
  });
  ctx.restore();
}

export function drawPlatforms(
  ctx: CanvasRenderingContext2D,
  camX: number,
  platforms: Platform[],
  springs: Spring[]
) {
  const time = Date.now() * 0.001;
  platforms.forEach(p => {
    const drawX = p.x - camX;
    if (drawX + p.width < -60 || drawX > GAME_W + 60) return;

    const biome = p.biome || 'meadow';

    if (p.type === 'ground') {
      if (biome === 'coastal') {
        // --- COASTAL SHORELINE / SANDSTONE CLIFF GROUND ---
        // 1. Warm Sandstone / Coral Rock Strata Body
        const rockGrad = ctx.createLinearGradient(0, p.y + 14, 0, p.y + p.height);
        rockGrad.addColorStop(0, '#785738');
        rockGrad.addColorStop(0.2, '#9a7b56');
        rockGrad.addColorStop(0.65, '#6b4f35');
        rockGrad.addColorStop(1, '#453222');
        ctx.fillStyle = rockGrad;
        ctx.fillRect(drawX, p.y, p.width, p.height);

        // Marine sediment strata lines
        ctx.fillStyle = 'rgba(45, 30, 15, 0.4)';
        ctx.fillRect(drawX, p.y + 44, p.width, 3);
        ctx.fillRect(drawX, p.y + 82, p.width, 2.5);

        // Embedded coastal sea pebbles / seashells
        for (let sx = drawX + 20; sx < drawX + p.width - 20; sx += 54) {
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.ellipse(sx, p.y + 36, 4, 2.5, 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.arc(sx - 1, p.y + 35, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // 2. Coastal Shoreline Top Trim (Golden Dune Sand with Seafoam edge)
        ctx.fillStyle = '#b45309';
        ctx.fillRect(drawX, p.y + 14, p.width, 5);

        const sandGrad = ctx.createLinearGradient(0, p.y, 0, p.y + 18);
        sandGrad.addColorStop(0, '#fef08a');
        sandGrad.addColorStop(0.4, '#fde047');
        sandGrad.addColorStop(1, '#d97706');
        ctx.fillStyle = sandGrad;
        ctx.fillRect(drawX, p.y, p.width, 16);

        // Stylized coastal dune ripples / fringe
        ctx.fillStyle = '#ca8a04';
        ctx.beginPath();
        for (let gx = drawX; gx < drawX + p.width; gx += 18) {
          ctx.lineTo(gx, p.y + 16);
          ctx.lineTo(gx + 9, p.y + 23);
        }
        ctx.lineTo(drawX + p.width, p.y + 16);
        ctx.closePath();
        ctx.fill();

        // Sunlit golden sand highlight
        ctx.fillStyle = '#fefce8';
        ctx.fillRect(drawX, p.y, p.width, 3);
      } else if (biome === 'cave') {
        // --- CAVE SUBTERRANEAN BASALT / CRYSTAL GROUND ---
        // 1. Dark Basalt / Volcanic Rock Strata Body
        const rockGrad = ctx.createLinearGradient(0, p.y + 14, 0, p.y + p.height);
        rockGrad.addColorStop(0, '#1e293b');
        rockGrad.addColorStop(0.2, '#334155');
        rockGrad.addColorStop(0.65, '#1e293b');
        rockGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = rockGrad;
        ctx.fillRect(drawX, p.y, p.width, p.height);

        // Subterranean dark strata fissure lines
        ctx.fillStyle = 'rgba(2, 6, 23, 0.6)';
        ctx.fillRect(drawX, p.y + 44, p.width, 3.5);
        ctx.fillRect(drawX, p.y + 86, p.width, 2.5);

        // Embedded glowing mineral nodes in deep rock
        for (let sx = drawX + 24; sx < drawX + p.width - 24; sx += 60) {
          const crystalCyan = Math.sin(sx * 0.05) > 0;
          const cColor = crystalCyan ? '#38bdf8' : '#c084fc';
          ctx.fillStyle = cColor;
          ctx.shadowColor = cColor;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(sx, p.y + 36);
          ctx.lineTo(sx + 3.5, p.y + 41);
          ctx.lineTo(sx, p.y + 46);
          ctx.lineTo(sx - 3.5, p.y + 41);
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // 2. Luminous Mineral Rock Crust Top Layer
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(drawX, p.y + 14, p.width, 5);

        const crustGrad = ctx.createLinearGradient(0, p.y, 0, p.y + 18);
        crustGrad.addColorStop(0, '#64748b');
        crustGrad.addColorStop(0.4, '#475569');
        crustGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = crustGrad;
        ctx.fillRect(drawX, p.y, p.width, 16);

        // Pointed slate rock fringes pointing down into basalt
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        for (let gx = drawX; gx < drawX + p.width; gx += 16) {
          ctx.lineTo(gx, p.y + 16);
          ctx.lineTo(gx + 8, p.y + 24);
        }
        ctx.lineTo(drawX + p.width, p.y + 16);
        ctx.closePath();
        ctx.fill();

        // Luminous crystal rim highlight
        ctx.fillStyle = '#93c5fd';
        ctx.fillRect(drawX, p.y, p.width, 3);
      } else if (biome === 'mountain') {
        // --- MOUNTAIN HIGH-ALTITUDE GRANITE CRAG & NATURAL SNOW GROUND ---
        // 1. Deep Granite / Slate Rock Strata Body
        const rockGrad = ctx.createLinearGradient(0, p.y + 14, 0, p.y + p.height);
        rockGrad.addColorStop(0, '#334155');
        rockGrad.addColorStop(0.2, '#243242');
        rockGrad.addColorStop(0.65, '#16202c');
        rockGrad.addColorStop(1, '#0b1118');
        ctx.fillStyle = rockGrad;
        ctx.fillRect(drawX, p.y, p.width, p.height);

        // Horizontal sedimentary rock bedding fissures & tectonic fractures
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.fillRect(drawX, p.y + 38, p.width, 2.5);
        ctx.fillRect(drawX, p.y + 76, p.width, 3);
        ctx.fillRect(drawX, p.y + 120, p.width, 2.5);

        // Subtle diagonal rock cleavage lines
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let fx = drawX + 35; fx < drawX + p.width; fx += 80) {
          ctx.moveTo(fx, p.y + 38);
          ctx.lineTo(fx - 18, p.y + 76);
          ctx.moveTo(fx + 25, p.y + 76);
          ctx.lineTo(fx + 10, p.y + 120);
        }
        ctx.stroke();

        // Embedded quartz crystal and slate flecks
        for (let sx = drawX + 25; sx < drawX + p.width - 20; sx += 48) {
          ctx.fillStyle = (sx % 96 === 0) ? '#cbd5e1' : '#94a3b8';
          ctx.beginPath();
          ctx.moveTo(sx, p.y + 48);
          ctx.lineTo(sx + 3.5, p.y + 52);
          ctx.lineTo(sx, p.y + 56);
          ctx.lineTo(sx - 3.5, p.y + 52);
          ctx.closePath();
          ctx.fill();
        }

        // 2. Chiseled Slate Sub-Shelf with Irregular Natural Rock Teeth
        const subShelfGrad = ctx.createLinearGradient(0, p.y + 12, 0, p.y + 26);
        subShelfGrad.addColorStop(0, '#64748b');
        subShelfGrad.addColorStop(0.5, '#475569');
        subShelfGrad.addColorStop(1, '#334155');
        ctx.fillStyle = subShelfGrad;
        ctx.fillRect(drawX, p.y + 12, p.width, 10);

        // Natural, organic rock teeth and overhangs
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(drawX, p.y + 22);
        for (let gx = drawX; gx < drawX + p.width; gx += 16) {
          const toothLen = 5 + Math.abs(Math.sin(gx * 0.08)) * 8;
          ctx.lineTo(gx + 8, p.y + 22 + toothLen);
          ctx.lineTo(gx + 16, p.y + 22);
        }
        ctx.lineTo(drawX + p.width, p.y + 22);
        ctx.closePath();
        ctx.fill();

        // Hardy alpine lichen patches clinging under rock teeth
        ctx.fillStyle = '#65a30d';
        for (let lx = drawX + 40; lx < drawX + p.width - 30; lx += 110) {
          ctx.beginPath();
          ctx.ellipse(lx, p.y + 26, 7, 3.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // 3. Natural Alpine Snow & Frost Crust
        // Shaded cool snow under-drape
        const snowShadeGrad = ctx.createLinearGradient(0, p.y, 0, p.y + 15);
        snowShadeGrad.addColorStop(0, '#e2e8f0');
        snowShadeGrad.addColorStop(0.65, '#cbd5e1');
        snowShadeGrad.addColorStop(1, '#94a3b8');
        ctx.fillStyle = snowShadeGrad;
        ctx.fillRect(drawX, p.y, p.width, 14);

        // Organic scalloped snow drift drapes with natural varying overhangs
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(drawX, p.y);
        ctx.lineTo(drawX + p.width, p.y);
        ctx.lineTo(drawX + p.width, p.y + 8);
        for (let sx = drawX + p.width; sx >= drawX; sx -= 20) {
          const drip = 4 + Math.sin(sx * 0.05) * 3.5;
          ctx.quadraticCurveTo(sx - 10, p.y + 9 + drip, sx - 20, p.y + 8);
        }
        ctx.closePath();
        ctx.fill();

        // Exposed granite rock patches breaking through the snow
        for (let rx = drawX + 60; rx < drawX + p.width - 50; rx += 140) {
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.ellipse(rx, p.y + 5, 8, 3, 0.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.ellipse(rx - 1, p.y + 4.5, 5, 1.8, 0.1, 0, Math.PI * 2);
          ctx.fill();
        }

        // Crisp pure-white platform surface rim highlight (guarantees crystal-clear footing)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(drawX, p.y, p.width, 3);
        // Frost shimmer sparkles along the rim
        ctx.fillStyle = '#f8fafc';
        for (let sp = drawX + 15; sp < drawX + p.width; sp += 35) {
          ctx.fillRect(sp, p.y, 3, 1.5);
        }
      } else if (biome === 'forest') {
        // --- FOREST DEEP LOAM & MOSS-CARPET GROUND ---
        // 1. Rich Dark Humus / Ancient Loam Strata Body
        const loamGrad = ctx.createLinearGradient(0, p.y + 14, 0, p.y + p.height);
        loamGrad.addColorStop(0, '#3e1f0a');
        loamGrad.addColorStop(0.2, '#27170f');
        loamGrad.addColorStop(0.7, '#1b0e08');
        loamGrad.addColorStop(1, '#0f0804');
        ctx.fillStyle = loamGrad;
        ctx.fillRect(drawX, p.y, p.width, p.height);

        // Woody subterranean strata fissures and embedded root tendrils
        ctx.fillStyle = 'rgba(20, 10, 5, 0.6)';
        ctx.fillRect(drawX, p.y + 45, p.width, 3.5);
        ctx.fillRect(drawX, p.y + 88, p.width, 2.5);

        // Embedded ancient root tendrils weaving through soil
        ctx.strokeStyle = '#572b0d';
        ctx.lineWidth = 2.5;
        for (let sx = drawX + 30; sx < drawX + p.width - 30; sx += 70) {
          ctx.beginPath();
          ctx.moveTo(sx - 15, p.y + 36);
          ctx.quadraticCurveTo(sx, p.y + 44, sx + 18, p.y + 38);
          ctx.stroke();
        }

        // 2. Thick Velvet Moss Top Layer with Trailing Ivy Fringes
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(drawX, p.y + 14, p.width, 6);

        const mossGrad = ctx.createLinearGradient(0, p.y, 0, p.y + 18);
        mossGrad.addColorStop(0, '#22c55e');
        mossGrad.addColorStop(0.35, '#16a34a');
        mossGrad.addColorStop(1, '#15803d');
        ctx.fillStyle = mossGrad;
        ctx.fillRect(drawX, p.y, p.width, 16);

        // Soft scalloped moss blade fringes pointing down into loam
        ctx.fillStyle = '#166534';
        ctx.beginPath();
        for (let gx = drawX; gx < drawX + p.width; gx += 15) {
          ctx.lineTo(gx, p.y + 16);
          ctx.lineTo(gx + 7.5, p.y + 25);
        }
        ctx.lineTo(drawX + p.width, p.y + 16);
        ctx.closePath();
        ctx.fill();

        // Vibrant emerald moss top highlight
        ctx.fillStyle = '#86efac';
        ctx.fillRect(drawX, p.y, p.width, 3);

        // Small environmental ground surface details: fallen leaves & micro-mushrooms
        for (let lx = drawX + 35; lx < drawX + p.width - 25; lx += 85) {
          const leafVariant = Math.abs(Math.sin(lx * 0.17)) * 10;
          if (leafVariant > 5) {
            // Little fallen leaf
            ctx.fillStyle = leafVariant > 7.5 ? '#f59e0b' : '#f97316';
            ctx.beginPath();
            ctx.ellipse(lx, p.y + 2, 4, 2, 0.4, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Tiny woodland sprout / mushroom
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(lx, p.y - 3, 1.5, 4);
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(lx + 0.75, p.y - 3, 2.5, Math.PI, 0);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(lx + 0.5, p.y - 4, 1, 1);
          }
        }
      } else if (biome === 'temple') {
        // --- ANCIENT TEMPLE RUINS PAVED STONE BLOCKS & CRUMBLING ASHLAR GROUND ---
        // 1. Weathered Sandstone / Limestone Bedrock Strata
        const templeGroundGrad = ctx.createLinearGradient(0, p.y + 14, 0, p.y + p.height);
        templeGroundGrad.addColorStop(0, '#a67d58');
        templeGroundGrad.addColorStop(0.2, '#7c5332');
        templeGroundGrad.addColorStop(0.7, '#59381e');
        templeGroundGrad.addColorStop(1, '#38210f');
        ctx.fillStyle = templeGroundGrad;
        ctx.fillRect(drawX, p.y, p.width, p.height);

        // Ashlar masonry strata block lines (horizontal mortar joints)
        ctx.fillStyle = 'rgba(45, 25, 10, 0.5)';
        ctx.fillRect(drawX, p.y + 42, p.width, 3);
        ctx.fillRect(drawX, p.y + 85, p.width, 2.5);

        // Vertical block seams in strata
        ctx.fillStyle = 'rgba(35, 18, 8, 0.4)';
        for (let bx = drawX + 45; bx < drawX + p.width - 20; bx += 80) {
          ctx.fillRect(bx, p.y + 16, 2.5, 26);
          ctx.fillRect(bx + 40, p.y + 45, 2.5, 40);
        }

        // 2. Chiseled Flagstone Surface Slabs with Moss in Morter Cracks
        const flagGrad = ctx.createLinearGradient(0, p.y, 0, p.y + 16);
        flagGrad.addColorStop(0, '#ebd1b5');
        flagGrad.addColorStop(0.4, '#d4b18f');
        flagGrad.addColorStop(1, '#a67d58');
        ctx.fillStyle = flagGrad;
        ctx.fillRect(drawX, p.y, p.width, 16);

        // Individual flagstone tiles with gaps
        ctx.fillStyle = 'rgba(70, 40, 15, 0.45)';
        for (let tx = drawX + 30; tx < drawX + p.width - 15; tx += 65) {
          ctx.fillRect(tx, p.y, 3, 16);
          // Moss tufts growing in paving joints
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(tx + 1.5, p.y + 4, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(70, 40, 15, 0.45)';
        }

        // Crisp polished golden-limestone platform surface highlight (guarantees crystal-clear footing)
        ctx.fillStyle = '#fefce8';
        ctx.fillRect(drawX, p.y, p.width, 3);

        // Embedded ancient runic floor motifs
        for (let rx = drawX + 40; rx < drawX + p.width - 40; rx += 110) {
          ctx.strokeStyle = 'rgba(217, 119, 6, 0.6)';
          ctx.lineWidth = 1.4;
          ctx.strokeRect(rx, p.y + 4, 10, 8);
        }
      } else if (biome === 'volcano') {
        // --- VOLCANIC CRUST & INCANDESCENT BASALT GROUND ---
        // 1. Scorched Obsidian & Dark Basalt Strata Body
        const magmaGroundGrad = ctx.createLinearGradient(0, p.y + 14, 0, p.y + p.height);
        magmaGroundGrad.addColorStop(0, '#262626');
        magmaGroundGrad.addColorStop(0.18, '#171717');
        magmaGroundGrad.addColorStop(0.65, '#0a0a0a');
        magmaGroundGrad.addColorStop(1, '#050505');
        ctx.fillStyle = magmaGroundGrad;
        ctx.fillRect(drawX, p.y, p.width, p.height);

        // Subterranean glowing magma fissures in deep rock
        const deepMagmaGlow = ctx.createLinearGradient(0, p.y + 40, 0, p.y + 70);
        deepMagmaGlow.addColorStop(0, '#991b1b');
        deepMagmaGlow.addColorStop(0.5, '#ea580c');
        deepMagmaGlow.addColorStop(1, '#991b1b');
        ctx.fillStyle = deepMagmaGlow;
        ctx.fillRect(drawX, p.y + 48, p.width, 3.5);
        ctx.fillRect(drawX, p.y + 92, p.width, 2.5);

        // 2. Chiseled Basalt Plate Top Layer
        const basaltTopGrad = ctx.createLinearGradient(0, p.y, 0, p.y + 16);
        basaltTopGrad.addColorStop(0, '#404040');
        basaltTopGrad.addColorStop(0.4, '#262626');
        basaltTopGrad.addColorStop(1, '#171717');
        ctx.fillStyle = basaltTopGrad;
        ctx.fillRect(drawX, p.y, p.width, 16);

        // Glowing incandescent surface fissure cracks
        for (let fx = drawX + 25; fx < drawX + p.width - 20; fx += 75) {
          ctx.strokeStyle = '#ea580c';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(fx, p.y);
          ctx.lineTo(fx + 6, p.y + 8);
          ctx.lineTo(fx + 2, p.y + 16);
          ctx.stroke();

          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(fx, p.y);
          ctx.lineTo(fx + 6, p.y + 8);
          ctx.stroke();
        }

        // High-contrast glowing ember platform surface rim highlight (guarantees crystal-clear footing)
        const rimGrad = ctx.createLinearGradient(drawX, p.y, drawX + p.width, p.y);
        rimGrad.addColorStop(0, '#fb923c');
        rimGrad.addColorStop(0.5, '#fed7aa');
        rimGrad.addColorStop(1, '#fb923c');
        ctx.fillStyle = rimGrad;
        ctx.fillRect(drawX, p.y, p.width, 3);

        // Drifting ember sparkle dots on surface
        for (let ex = drawX + 18; ex < drawX + p.width - 15; ex += 40) {
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(ex, p.y, 2, 2);
        }
      } else {
        // --- MEADOW (DEFAULT) LUSH GROUND ---
        // 1. Deep Soil Body with Strata & Gradient
        const soilGrad = ctx.createLinearGradient(0, p.y + 14, 0, p.y + p.height);
        soilGrad.addColorStop(0, '#543621');
        soilGrad.addColorStop(0.18, '#6d4529');
        soilGrad.addColorStop(0.65, '#5c3920');
        soilGrad.addColorStop(1, '#3b2210');
        ctx.fillStyle = soilGrad;
        ctx.fillRect(drawX, p.y, p.width, p.height);

        // Soil strata lines and decorative embedded pebbles
        ctx.fillStyle = 'rgba(40, 22, 10, 0.35)';
        ctx.fillRect(drawX, p.y + 46, p.width, 3);
        ctx.fillRect(drawX, p.y + 88, p.width, 2.5);

        // Scattered little rounded stones with top highlight and drop shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        for (let sx = drawX + 18; sx < drawX + p.width - 18; sx += 48) {
          ctx.beginPath();
          ctx.ellipse(sx, p.y + 36, 5, 3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let sx = drawX + 18; sx < drawX + p.width - 18; sx += 48) {
          ctx.fillStyle = '#806148';
          ctx.beginPath();
          ctx.ellipse(sx, p.y + 34, 4.5, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#aa896d';
          ctx.beginPath();
          ctx.arc(sx - 1.5, p.y + 33, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // 2. Thick Lush Grass Top Layer with Blade Tufts
        ctx.fillStyle = '#225d18';
        ctx.fillRect(drawX, p.y + 14, p.width, 6);

        const grassGrad = ctx.createLinearGradient(0, p.y, 0, p.y + 18);
        grassGrad.addColorStop(0, '#62d242');
        grassGrad.addColorStop(0.4, '#48b82a');
        grassGrad.addColorStop(1, '#2c7b19');
        ctx.fillStyle = grassGrad;
        ctx.fillRect(drawX, p.y, p.width, 16);

        // Stylized grass blade fringes pointing down into the soil
        ctx.fillStyle = '#399920';
        ctx.beginPath();
        for (let gx = drawX; gx < drawX + p.width; gx += 16) {
          ctx.lineTo(gx, p.y + 16);
          ctx.lineTo(gx + 8, p.y + 25);
        }
        ctx.lineTo(drawX + p.width, p.y + 16);
        ctx.closePath();
        ctx.fill();

        // Top sunlit grass edge highlight
        ctx.fillStyle = '#8af568';
        ctx.fillRect(drawX, p.y, p.width, 3);
      }

      // INTERMEDIATE TRANSITIONAL WORLD OBJECTS ON GROUND:
      const groundBlend = getDetailedBiomeAtX(p.x + p.width * 0.5);
      if (groundBlend.inTransition) {
        const gf = groundBlend.factor;
        if (groundBlend.current === 'meadow' && groundBlend.next === 'coastal') {
          // Meadow -> Coastal intermediate features:
          // Stage 1 & 2: Driftwood logs and coastal smooth sea pebbles
          if (gf >= 0.15 && gf < 0.85) {
            ctx.fillStyle = '#a8a29e';
            ctx.beginPath();
            ctx.ellipse(drawX + p.width * 0.25, p.y + 4, 18, 5, -0.05, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#78716c';
            ctx.fillRect(drawX + p.width * 0.25 - 16, p.y + 3, 32, 2.5);

            ctx.fillStyle = '#94a3b8';
            ctx.beginPath();
            ctx.ellipse(drawX + p.width * 0.7, p.y + 5, 8, 4, 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#cbd5e1';
            ctx.beginPath();
            ctx.arc(drawX + p.width * 0.7 - 2, p.y + 3.5, 2, 0, Math.PI * 2);
            ctx.fill();
          }

          // Stage 2 & 3: Tidal Pools & Water Channels with glistening animated ripples and seafoam
          if (gf >= 0.32 && gf <= 0.78 && p.width > 200) {
            const poolW = Math.min(180, p.width * 0.45);
            const poolX = drawX + p.width * 0.45;
            const poolY = p.y + 2;

            ctx.fillStyle = 'rgba(14, 165, 233, 0.65)';
            ctx.beginPath();
            ctx.ellipse(poolX, poolY + 4, poolW * 0.5, 7, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            for (let wx = poolX - poolW * 0.45; wx <= poolX + poolW * 0.45; wx += 14) {
              const wy = poolY + 2 + Math.sin(wx * 0.05 + time * 3) * 1.5;
              if (wx === poolX - poolW * 0.45) ctx.moveTo(wx, wy);
              else ctx.lineTo(wx, wy);
            }
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(poolX + Math.sin(time * 2) * (poolW * 0.25), poolY + 3, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (groundBlend.current === 'coastal' && groundBlend.next === 'cave') {
          // Coastal -> Cave intermediate features:
          // Craggy basalt rock outcroppings and glowing raw crystal veins breaking through
          if (gf >= 0.25) {
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.moveTo(drawX + p.width * 0.3, p.y + 12);
            ctx.lineTo(drawX + p.width * 0.3 + 15, p.y - 8);
            ctx.lineTo(drawX + p.width * 0.3 + 32, p.y + 12);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#334155';
            ctx.beginPath();
            ctx.moveTo(drawX + p.width * 0.3 + 4, p.y + 10);
            ctx.lineTo(drawX + p.width * 0.3 + 15, p.y - 6);
            ctx.lineTo(drawX + p.width * 0.3 + 24, p.y + 10);
            ctx.closePath();
            ctx.fill();

            const veinGlow = 0.5 + Math.sin(time * 3 + p.x) * 0.3;
            ctx.strokeStyle = `rgba(56, 189, 248, ${veinGlow})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(drawX + p.width * 0.3 + 10, p.y + 8);
            ctx.lineTo(drawX + p.width * 0.3 + 15, p.y - 2);
            ctx.lineTo(drawX + p.width * 0.3 + 22, p.y + 6);
            ctx.stroke();
          }
        } else if (groundBlend.current === 'cave' && groundBlend.next === 'meadow') {
          // Cave -> Meadow intermediate features:
          // Fresh green moss and climbing ivy patches with tiny wildflower buds over dark basalt
          if (gf >= 0.25) {
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.ellipse(drawX + p.width * 0.35, p.y + 2, 22, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#f43f5e';
            ctx.beginPath();
            ctx.arc(drawX + p.width * 0.35 - 6, p.y - 1, 2, 0, Math.PI * 2);
            ctx.arc(drawX + p.width * 0.35 + 8, p.y, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    } else {
      // FLOATING PLATFORM
      ctx.save();

      // 1. Soft Ambient Occlusion / Shadow cast beneath the floating platform
      const dropShadowGrad = ctx.createLinearGradient(0, p.y + p.height, 0, p.y + p.height + 16);
      dropShadowGrad.addColorStop(0, 'rgba(15, 23, 42, 0.28)');
      dropShadowGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = dropShadowGrad;
      ctx.fillRect(drawX + 4, p.y + p.height, p.width - 8, 16);

      if (biome === 'coastal') {
        // --- COASTAL DRIFTWOOD / SHORE ISLAND PLATFORM ---
        const driftGrad = ctx.createLinearGradient(0, p.y, 0, p.y + p.height);
        driftGrad.addColorStop(0, '#d6d3d1');
        driftGrad.addColorStop(0.5, '#a8a29e');
        driftGrad.addColorStop(1, '#78716c');
        ctx.fillStyle = driftGrad;
        drawRoundRect(ctx, drawX, p.y, p.width, p.height, 7);
        ctx.fill();

        // Weathered grain relief lines
        ctx.strokeStyle = 'rgba(68, 64, 60, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(drawX + p.width * 0.33, p.y + 6);
        ctx.lineTo(drawX + p.width * 0.33, p.y + p.height - 2);
        ctx.moveTo(drawX + p.width * 0.66, p.y + 6);
        ctx.lineTo(drawX + p.width * 0.66, p.y + p.height - 2);
        ctx.stroke();

        // Golden beach sand top trim
        const topSandGrad = ctx.createLinearGradient(0, p.y, 0, p.y + 8);
        topSandGrad.addColorStop(0, '#fef08a');
        topSandGrad.addColorStop(1, '#eab308');
        ctx.fillStyle = topSandGrad;
        drawRoundRect(ctx, drawX, p.y, p.width, 8, [7, 7, 0, 0]);
        ctx.fill();

        // Bright sand lip highlight
        ctx.fillStyle = '#fefce8';
        ctx.fillRect(drawX + 2, p.y, p.width - 4, 2);

        // Underside moisture shade
        ctx.fillStyle = 'rgba(28, 25, 23, 0.4)';
        ctx.fillRect(drawX + 2, p.y + p.height - 2.5, p.width - 4, 2.5);
      } else if (biome === 'cave') {
        // --- CAVE SUSPENDED BASALT SLAB WITH CRYSTALS ---
        const stoneGrad = ctx.createLinearGradient(0, p.y, 0, p.y + p.height);
        stoneGrad.addColorStop(0, '#475569');
        stoneGrad.addColorStop(0.5, '#334155');
        stoneGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = stoneGrad;
        drawRoundRect(ctx, drawX, p.y, p.width, p.height, 7);
        ctx.fill();

        // Chiseled rock fissures
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(drawX + p.width * 0.33, p.y + 6);
        ctx.lineTo(drawX + p.width * 0.33, p.y + p.height - 2);
        ctx.moveTo(drawX + p.width * 0.66, p.y + 6);
        ctx.lineTo(drawX + p.width * 0.66, p.y + p.height - 2);
        ctx.stroke();

        // Glowing mineral crystal top trim
        const topCrystalGrad = ctx.createLinearGradient(0, p.y, 0, p.y + 8);
        topCrystalGrad.addColorStop(0, '#7dd3fc');
        topCrystalGrad.addColorStop(1, '#0284c7');
        ctx.fillStyle = topCrystalGrad;
        drawRoundRect(ctx, drawX, p.y, p.width, 8, [7, 7, 0, 0]);
        ctx.fill();

        // Glowing neon crystal lip highlight
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(drawX + 2, p.y, p.width - 4, 2);

        // Underside dark cave shadow
        ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
        ctx.fillRect(drawX + 2, p.y + p.height - 2.5, p.width - 4, 2.5);
      } else if (biome === 'mountain') {
        // --- MOUNTAIN ELEVATED ROCK LEDGE / FACETED GRANITE SLAB ---
        // Soft drop-shadow beneath floating crag
        ctx.fillStyle = 'rgba(15, 23, 42, 0.32)';
        ctx.beginPath();
        ctx.ellipse(drawX + p.width * 0.5, p.y + p.height + 6, p.width * 0.48, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // 1. Faceted Granite Rock Slab Body
        const slateGrad = ctx.createLinearGradient(0, p.y, 0, p.y + p.height);
        slateGrad.addColorStop(0, '#64748b');
        slateGrad.addColorStop(0.35, '#475569');
        slateGrad.addColorStop(0.75, '#334155');
        slateGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = slateGrad;
        drawRoundRect(ctx, drawX, p.y, p.width, p.height, 6);
        ctx.fill();

        // Chiseled rock fracture fissures dividing the slab into geological blocks
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        if (p.width > 60) {
          ctx.moveTo(drawX + p.width * 0.36, p.y + 6);
          ctx.lineTo(drawX + p.width * 0.33, p.y + p.height * 0.6);
          ctx.lineTo(drawX + p.width * 0.38, p.y + p.height - 2);
        }
        if (p.width > 110) {
          ctx.moveTo(drawX + p.width * 0.7, p.y + 6);
          ctx.lineTo(drawX + p.width * 0.73, p.y + p.height * 0.55);
          ctx.lineTo(drawX + p.width * 0.68, p.y + p.height - 2);
        }
        ctx.stroke();

        // Quartz mineral vein along fracture
        if (p.width > 60) {
          ctx.strokeStyle = 'rgba(241, 245, 249, 0.6)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(drawX + p.width * 0.34, p.y + 7);
          ctx.lineTo(drawX + p.width * 0.31, p.y + p.height * 0.6);
          ctx.stroke();
        }

        // 2. Natural Underside Rock Teeth & Crystalline Icicles
        // Rock crag teeth
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(drawX + p.width * 0.15, p.y + p.height);
        ctx.lineTo(drawX + p.width * 0.22, p.y + p.height + 6);
        ctx.lineTo(drawX + p.width * 0.28, p.y + p.height);
        if (p.width > 80) {
          ctx.moveTo(drawX + p.width * 0.62, p.y + p.height);
          ctx.lineTo(drawX + p.width * 0.68, p.y + p.height + 7);
          ctx.lineTo(drawX + p.width * 0.74, p.y + p.height);
        }
        ctx.fill();

        // Translucent blue crystal icicles hanging from underside
        ctx.fillStyle = '#bae6fd';
        const icicleStep = Math.max(35, Math.floor(p.width / 4));
        for (let ix = drawX + 18; ix < drawX + p.width - 15; ix += icicleStep) {
          const icLen = 5 + Math.abs(Math.sin(ix * 0.15)) * 6;
          ctx.beginPath();
          ctx.moveTo(ix - 2, p.y + p.height);
          ctx.lineTo(ix, p.y + p.height + icLen);
          ctx.lineTo(ix + 2, p.y + p.height);
          ctx.closePath();
          ctx.fill();
        }

        // Underside shadow line
        ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
        ctx.fillRect(drawX + 2, p.y + p.height - 2.5, p.width - 4, 2.5);

        // 3. Organic Snow Pillow Blanket & Crisp Top Highlight
        // Snow shadow shelf
        const snowCapGrad = ctx.createLinearGradient(0, p.y, 0, p.y + 8);
        snowCapGrad.addColorStop(0, '#f8fafc');
        snowCapGrad.addColorStop(0.65, '#e2e8f0');
        snowCapGrad.addColorStop(1, '#cbd5e1');
        ctx.fillStyle = snowCapGrad;
        drawRoundRect(ctx, drawX, p.y, p.width, 8, [6, 6, 2, 2]);
        ctx.fill();

        // Scalloped organic snow drips along the platform lip
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(drawX, p.y);
        ctx.lineTo(drawX + p.width, p.y);
        ctx.lineTo(drawX + p.width, p.y + 4);
        for (let sx = drawX + p.width; sx >= drawX; sx -= 16) {
          const drip = 2 + Math.sin(sx * 0.1) * 2;
          ctx.quadraticCurveTo(sx - 8, p.y + 5 + drip, sx - 16, p.y + 4);
        }
        ctx.closePath();
        ctx.fill();

        // Pure white top surface rim highlight (guarantees crystal-clear footing)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(drawX + 2, p.y, p.width - 4, 2.5);

        // Frost sparkle glints
        ctx.fillStyle = '#f8fafc';
        for (let sx = drawX + 12; sx < drawX + p.width - 10; sx += 32) {
          ctx.fillRect(sx, p.y, 2.5, 1.5);
        }
      } else if (biome === 'forest') {
        // --- FOREST ANCIENT HOLLOW LOG / MOSS-CARPETED WOOD ---
        const barkGrad = ctx.createLinearGradient(0, p.y, 0, p.y + p.height);
        barkGrad.addColorStop(0, '#572b0d');
        barkGrad.addColorStop(0.5, '#3e1f0a');
        barkGrad.addColorStop(1, '#27170f');
        ctx.fillStyle = barkGrad;
        drawRoundRect(ctx, drawX, p.y, p.width, p.height, 6);
        ctx.fill();

        // Bark grain fissures
        ctx.strokeStyle = 'rgba(20, 10, 5, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(drawX + p.width * 0.35, p.y + 5);
        ctx.lineTo(drawX + p.width * 0.35, p.y + p.height - 2);
        ctx.moveTo(drawX + p.width * 0.7, p.y + 5);
        ctx.lineTo(drawX + p.width * 0.7, p.y + p.height - 2);
        ctx.stroke();

        // Hanging jungle vines under platform
        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(drawX + p.width * 0.25, p.y + p.height);
        ctx.quadraticCurveTo(drawX + p.width * 0.25 + 4, p.y + p.height + 8, drawX + p.width * 0.25 - 2, p.y + p.height + 14);
        ctx.moveTo(drawX + p.width * 0.75, p.y + p.height);
        ctx.quadraticCurveTo(drawX + p.width * 0.75 - 4, p.y + p.height + 8, drawX + p.width * 0.75 + 2, p.y + p.height + 12);
        ctx.stroke();

        // Lush Emerald Moss Top Trim
        const topMossGrad = ctx.createLinearGradient(0, p.y, 0, p.y + 7);
        topMossGrad.addColorStop(0, '#4ade80');
        topMossGrad.addColorStop(1, '#16a34a');
        ctx.fillStyle = topMossGrad;
        drawRoundRect(ctx, drawX, p.y, p.width, 7, [6, 6, 0, 0]);
        ctx.fill();

        // Sunlight lip highlight
        ctx.fillStyle = '#86efac';
        ctx.fillRect(drawX + 2, p.y, p.width - 4, 2);

        // Underside deep jungle shade
        ctx.fillStyle = 'rgba(10, 5, 2, 0.45)';
        ctx.fillRect(drawX + 2, p.y + p.height - 2.5, p.width - 4, 2.5);
      } else if (biome === 'temple') {
        // --- ANCIENT TEMPLE CARVED LIMESTONE SLAB PLATFORM ---
        const stoneGrad = ctx.createLinearGradient(0, p.y, 0, p.y + p.height);
        stoneGrad.addColorStop(0, '#d4b18f');
        stoneGrad.addColorStop(0.5, '#a67d58');
        stoneGrad.addColorStop(1, '#7c5332');
        ctx.fillStyle = stoneGrad;
        drawRoundRect(ctx, drawX, p.y, p.width, p.height, 6);
        ctx.fill();

        // Architectural block relief seams
        ctx.strokeStyle = 'rgba(70, 40, 15, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(drawX + p.width * 0.33, p.y + 5);
        ctx.lineTo(drawX + p.width * 0.33, p.y + p.height - 2);
        ctx.moveTo(drawX + p.width * 0.66, p.y + 5);
        ctx.lineTo(drawX + p.width * 0.66, p.y + p.height - 2);
        ctx.stroke();

        // Hanging ancient ivy vines beneath platform
        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(drawX + p.width * 0.22, p.y + p.height);
        ctx.quadraticCurveTo(drawX + p.width * 0.22 - 3, p.y + p.height + 7, drawX + p.width * 0.22 + 2, p.y + p.height + 13);
        ctx.moveTo(drawX + p.width * 0.78, p.y + p.height);
        ctx.quadraticCurveTo(drawX + p.width * 0.78 + 3, p.y + p.height + 7, drawX + p.width * 0.78 - 2, p.y + p.height + 11);
        ctx.stroke();

        // Polished Sunlit Limestone Top Trim
        const topTrimGrad = ctx.createLinearGradient(0, p.y, 0, p.y + 7);
        topTrimGrad.addColorStop(0, '#f5e4cf');
        topTrimGrad.addColorStop(1, '#cda277');
        ctx.fillStyle = topTrimGrad;
        drawRoundRect(ctx, drawX, p.y, p.width, 7, [6, 6, 0, 0]);
        ctx.fill();

        // Crisp golden sunlit rim highlight (guarantees crystal-clear footing)
        ctx.fillStyle = '#fefce8';
        ctx.fillRect(drawX + 2, p.y, p.width - 4, 2);

        // Underside shadow line
        ctx.fillStyle = 'rgba(40, 20, 10, 0.4)';
        ctx.fillRect(drawX + 2, p.y + p.height - 2.5, p.width - 4, 2.5);
      } else if (biome === 'volcano') {
        // --- VOLCANIC SUSPENDED BASALT CRAG WITH MAGMA CRACKS ---
        const basaltGrad = ctx.createLinearGradient(0, p.y, 0, p.y + p.height);
        basaltGrad.addColorStop(0, '#383838');
        basaltGrad.addColorStop(0.5, '#262626');
        basaltGrad.addColorStop(1, '#171717');
        ctx.fillStyle = basaltGrad;
        drawRoundRect(ctx, drawX, p.y, p.width, p.height, 6);
        ctx.fill();

        // Glowing incandescent fissures on platform side
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(drawX + p.width * 0.35, p.y + 4);
        ctx.lineTo(drawX + p.width * 0.35 + 4, p.y + p.height * 0.6);
        ctx.lineTo(drawX + p.width * 0.35 - 2, p.y + p.height - 2);
        if (p.width > 70) {
          ctx.moveTo(drawX + p.width * 0.7, p.y + 4);
          ctx.lineTo(drawX + p.width * 0.7 - 4, p.y + p.height * 0.55);
          ctx.lineTo(drawX + p.width * 0.7 + 2, p.y + p.height - 2);
        }
        ctx.stroke();

        // Fiery glowing molten magma drops dangling below platform
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(drawX + p.width * 0.28, p.y + p.height + 4, 2.5, 0, Math.PI * 2);
        ctx.arc(drawX + p.width * 0.72, p.y + p.height + 5, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(drawX + p.width * 0.28, p.y + p.height + 4, 1.2, 0, Math.PI * 2);
        ctx.arc(drawX + p.width * 0.72, p.y + p.height + 5, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Glowing Embers Top Trim
        const topBasaltGrad = ctx.createLinearGradient(0, p.y, 0, p.y + 7);
        topBasaltGrad.addColorStop(0, '#f97316');
        topBasaltGrad.addColorStop(0.5, '#c2410c');
        topBasaltGrad.addColorStop(1, '#431407');
        ctx.fillStyle = topBasaltGrad;
        drawRoundRect(ctx, drawX, p.y, p.width, 7, [6, 6, 0, 0]);
        ctx.fill();

        // Radiant white-hot magma rim highlight (guarantees crystal-clear footing)
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(drawX + 2, p.y, p.width - 4, 2);

        // Underside soot shade
        ctx.fillStyle = 'rgba(10, 5, 5, 0.6)';
        ctx.fillRect(drawX + 2, p.y + p.height - 2.5, p.width - 4, 2.5);
      } else {
        // --- MEADOW WOODEN PLANK WITH LUSH GRASS TRIM ---
        const woodGrad = ctx.createLinearGradient(0, p.y, 0, p.y + p.height);
        woodGrad.addColorStop(0, '#e59d58');
        woodGrad.addColorStop(0.5, '#c87d36');
        woodGrad.addColorStop(1, '#8e4b16');
        ctx.fillStyle = woodGrad;
        drawRoundRect(ctx, drawX, p.y, p.width, p.height, 7);
        ctx.fill();

        // Inner plank relief lines
        ctx.strokeStyle = 'rgba(80, 35, 8, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(drawX + p.width * 0.33, p.y + 6);
        ctx.lineTo(drawX + p.width * 0.33, p.y + p.height - 2);
        ctx.moveTo(drawX + p.width * 0.66, p.y + 6);
        ctx.lineTo(drawX + p.width * 0.66, p.y + p.height - 2);
        ctx.stroke();

        // Metallic corner rivets with highlights
        const drawRivet = (rx: number, ry: number) => {
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.arc(rx - 0.8, ry - 0.8, 1, 0, Math.PI * 2);
          ctx.fill();
        };
        drawRivet(drawX + 6, p.y + p.height - 6);
        drawRivet(drawX + p.width - 6, p.y + p.height - 6);

        // Lush Top Grass Trim
        const topGrassGrad = ctx.createLinearGradient(0, p.y, 0, p.y + 8);
        topGrassGrad.addColorStop(0, '#66da46');
        topGrassGrad.addColorStop(1, '#3a9f20');
        ctx.fillStyle = topGrassGrad;
        drawRoundRect(ctx, drawX, p.y, p.width, 8, [7, 7, 0, 0]);
        ctx.fill();

        // Sunlit lip highlight
        ctx.fillStyle = '#94f975';
        ctx.fillRect(drawX + 2, p.y, p.width - 4, 2);

        // Underside bottom edge shade
        ctx.fillStyle = 'rgba(30, 15, 5, 0.4)';
        ctx.fillRect(drawX + 2, p.y + p.height - 2.5, p.width - 4, 2.5);
      }

      ctx.restore();
    }
  });

  // START BOUNDARY MARKER (natural trail origin post at left boundary)
  const markerX = 16 - camX;
  if (markerX > -60 && markerX < GAME_W + 60) {
    const groundY = 470;
    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.ellipse(markerX, groundY + 1, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stone base
    ctx.fillStyle = '#64748b';
    drawRoundRect(ctx, markerX - 9, groundY - 7, 18, 8, 3);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(markerX - 7, groundY - 7, 14, 2);

    // Carved wooden boundary post
    const postGrad = ctx.createLinearGradient(markerX - 4, 0, markerX + 4, 0);
    postGrad.addColorStop(0, '#92400e');
    postGrad.addColorStop(0.5, '#b45309');
    postGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = postGrad;
    ctx.fillRect(markerX - 4, groundY - 50, 8, 44);

    // Wooden sign plaque
    const signW = 34;
    const signH = 18;
    const signX = markerX - signW / 2;
    const signY = groundY - 48;

    const signGrad = ctx.createLinearGradient(0, signY, 0, signY + signH);
    signGrad.addColorStop(0, '#fef08a');
    signGrad.addColorStop(0.2, '#fde047');
    signGrad.addColorStop(1, '#eab308');
    ctx.fillStyle = signGrad;
    drawRoundRect(ctx, signX, signY, signW, signH, 3);
    ctx.fill();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#854d0e';
    ctx.stroke();

    // Sign text
    ctx.fillStyle = '#713f12';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('START', markerX, signY + signH / 2);

    // Trail flag ribbon on top
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(markerX + 3, groundY - 50);
    ctx.lineTo(markerX + 15, groundY - 45);
    ctx.lineTo(markerX + 3, groundY - 40);
    ctx.closePath();
    ctx.fill();
  }

  // SPRINGS
  springs.forEach(s => {
    const drawX = s.x - camX;
    if (drawX < -40 || drawX > GAME_W + 40) return;

    // Soft ground shadow under spring base
    ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.beginPath();
    ctx.ellipse(drawX + s.width / 2, s.y + s.height, s.width * 0.55, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Heavy Metal Base Plate
    ctx.fillStyle = '#334155';
    drawRoundRect(ctx, drawX - 2, s.y + s.height - 5, s.width + 4, 5, 2);
    ctx.fill();

    // 3D Coiled Metallic Spring with Gradient
    ctx.strokeStyle = '#e67e22';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(drawX + 6, s.y + s.height - 5);
    ctx.lineTo(drawX + s.width - 6, s.y + s.height - 9);
    ctx.lineTo(drawX + 6, s.y + s.height - 13);
    ctx.lineTo(drawX + s.width - 6, s.y + 5);
    ctx.stroke();

    // Inner highlight coil
    ctx.strokeStyle = '#f9ca24';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Top Launch Cap (bright yellow with red rubber bumper)
    const capGrad = ctx.createLinearGradient(0, s.y, 0, s.y + 7);
    capGrad.addColorStop(0, '#f9ca24');
    capGrad.addColorStop(1, '#d48806');
    ctx.fillStyle = capGrad;
    drawRoundRect(ctx, drawX + 1, s.y, s.width - 2, 7, 3);
    ctx.fill();

    // Top highlight strip
    ctx.fillStyle = '#fff4a3';
    ctx.fillRect(drawX + 4, s.y + 1, s.width - 8, 2);
  });
}

export function drawCheckpoints(ctx: CanvasRenderingContext2D, camX: number, checkpoints: Checkpoint[]) {
  const time = performance.now() * 0.003;

  checkpoints.forEach(cp => {
    const drawX = cp.x - camX;
    if (drawX < -60 || drawX > GAME_W + 60) return;

    // 1. Broad soft ground shadow anchoring the base to terrain
    ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.beginPath();
    ctx.ellipse(drawX, cp.y + 1, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Heavy steel & stone pedestal baseplate directly on the ground line (cp.y)
    ctx.fillStyle = '#334155';
    drawRoundRect(ctx, drawX - 14, cp.y - 4, 28, 5, 2);
    ctx.fill();

    // Mid pedestal block
    ctx.fillStyle = '#475569';
    drawRoundRect(ctx, drawX - 10, cp.y - 12, 20, 9, 2);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(drawX - 8, cp.y - 12, 16, 2);

    // Collar ring that locks the pole into the pedestal
    ctx.fillStyle = '#64748b';
    drawRoundRect(ctx, drawX - 5, cp.y - 16, 10, 5, 1);
    ctx.fill();

    // 3. Continuous solid flagpole anchored right through collar into baseplate and ground line
    const poleGrad = ctx.createLinearGradient(drawX - 3, 0, drawX + 3, 0);
    poleGrad.addColorStop(0, '#64748b');
    poleGrad.addColorStop(0.4, '#cbd5e1');
    poleGrad.addColorStop(1, '#334155');
    ctx.fillStyle = poleGrad;
    ctx.fillRect(drawX - 2.5, cp.y - 74, 5, 72);

    // 4. Spherical finial topper
    const ballGrad = ctx.createRadialGradient(drawX - 2, cp.y - 76, 1, drawX, cp.y - 74, 7);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.5, cp.reached ? '#00e5ff' : '#f1c40f');
    ballGrad.addColorStop(1, cp.reached ? '#0084a8' : '#b78103');
    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(drawX, cp.y - 74, 7, 0, Math.PI * 2);
    ctx.fill();

    // 5. Waving Pennant Flag with cloth wave ripples
    const wave = Math.sin(time * 3 + cp.id) * 3;
    ctx.save();
    if (cp.reached) {
      // Activated Checkpoint: Glowing Azure Pennant
      const flagGrad = ctx.createLinearGradient(drawX, cp.y - 68, drawX + 34, cp.y - 52);
      flagGrad.addColorStop(0, '#00e5ff');
      flagGrad.addColorStop(1, '#0077b6');
      ctx.fillStyle = flagGrad;

      ctx.beginPath();
      ctx.moveTo(drawX + 2.5, cp.y - 68);
      ctx.quadraticCurveTo(drawX + 18, cp.y - 56 + wave, drawX + 36, cp.y - 52 + wave * 1.5);
      ctx.lineTo(drawX + 2.5, cp.y - 36);
      ctx.closePath();
      ctx.fill();

      // Checkmark icon
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(drawX + 10, cp.y - 52);
      ctx.lineTo(drawX + 15, cp.y - 47);
      ctx.lineTo(drawX + 24, cp.y - 57);
      ctx.stroke();

      // Soft ambient aura pulse
      const pulse = Math.sin(time * 4) * 4;
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(drawX, cp.y - 40, 26 + pulse, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Inactive Checkpoint: Crimson Pennant
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.moveTo(drawX + 2.5, cp.y - 68);
      ctx.quadraticCurveTo(drawX + 16, cp.y - 56 + wave, drawX + 32, cp.y - 52 + wave * 1.5);
      ctx.lineTo(drawX + 2.5, cp.y - 38);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  });
}

export function drawFinishFlag(ctx: CanvasRenderingContext2D, camX: number, finishFlag: FinishFlag) {
  const drawX = finishFlag.x - camX;
  if (drawX < -120 || drawX > GAME_W + 120) return;
  const time = performance.now() * 0.004;

  const groundY = finishFlag.y + finishFlag.height;

  // 1. Base drop shadow anchoring baseplate to ground
  ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
  ctx.beginPath();
  ctx.ellipse(drawX, groundY, 36, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Heavy dual-tiered stone pedestal baseplate directly on the ground line
  ctx.fillStyle = '#334155';
  drawRoundRect(ctx, drawX - 24, groundY - 8, 48, 8, 2);
  ctx.fill();

  // Mid pedestal block
  ctx.fillStyle = '#475569';
  drawRoundRect(ctx, drawX - 16, groundY - 16, 32, 9, 2);
  ctx.fill();
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(drawX - 14, groundY - 16, 28, 1.5);

  // Pedestal brass collar locking pole to base
  ctx.fillStyle = '#b8860b';
  drawRoundRect(ctx, drawX - 7, groundY - 21, 14, 6, 2);
  ctx.fill();

  // 3. Metallic Golden Flagpole continuous down into the collar (grounded firmly)
  const poleGrad = ctx.createLinearGradient(drawX - 4, 0, drawX + 4, 0);
  poleGrad.addColorStop(0, '#c69214');
  poleGrad.addColorStop(0.4, '#ffd700');
  poleGrad.addColorStop(1, '#8c6004');
  ctx.fillStyle = poleGrad;
  ctx.fillRect(drawX - 3.5, finishFlag.y - 8, 7, finishFlag.height - 10);

  // 4. Ornate Golden Star Topper
  const ballGrad = ctx.createRadialGradient(drawX - 2, finishFlag.y - 10, 2, drawX, finishFlag.y - 8, 12);
  ballGrad.addColorStop(0, '#ffffff');
  ballGrad.addColorStop(0.5, '#ffd700');
  ballGrad.addColorStop(1, '#b8860b');
  ctx.fillStyle = ballGrad;
  ctx.beginPath();
  ctx.arc(drawX, finishFlag.y - 8, 11, 0, Math.PI * 2);
  ctx.fill();

  // 5. Waving Victory Banner with Cloth Folds
  const flagW = 54;
  const flagH = 38;
  const wave = Math.sin(time * 3) * 4;

  ctx.save();
  const bannerGrad = ctx.createLinearGradient(drawX, finishFlag.y, drawX + flagW, finishFlag.y + flagH);
  if (finishFlag.reached) {
    bannerGrad.addColorStop(0, '#10b981');
    bannerGrad.addColorStop(0.5, '#34d399');
    bannerGrad.addColorStop(1, '#059669');
  } else {
    bannerGrad.addColorStop(0, '#0284c7');
    bannerGrad.addColorStop(0.5, '#38bdf8');
    bannerGrad.addColorStop(1, '#0369a1');
  }
  ctx.fillStyle = bannerGrad;

  ctx.beginPath();
  ctx.moveTo(drawX + 3.5, finishFlag.y - 2);
  ctx.quadraticCurveTo(drawX + flagW * 0.5, finishFlag.y + 8 + wave, drawX + flagW, finishFlag.y + 12 + wave * 1.5);
  ctx.lineTo(drawX + flagW - 6, finishFlag.y + 12 + flagH * 0.5 + wave * 1.5);
  ctx.lineTo(drawX + flagW, finishFlag.y - 2 + flagH + wave);
  ctx.quadraticCurveTo(drawX + flagW * 0.5, finishFlag.y - 2 + flagH * 0.8 + wave, drawX + 3.5, finishFlag.y - 2 + flagH);
  ctx.closePath();
  ctx.fill();

  // Golden Emblem Star on Flag
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 4;
  ctx.fillText('★', drawX + flagW * 0.48, finishFlag.y + 16 + wave);
  ctx.restore();
}

export function drawCoins(ctx: CanvasRenderingContext2D, camX: number, coins: Coin[]) {
  const time = performance.now() * 0.005;

  coins.forEach(c => {
    if (c.collected) return;
    const drawX = c.x - camX;
    // Generous viewport culling bounds accounting for camera zoom (0.83 - 0.86) and screen shake.
    // Under zoomed perspective, the visible world extends from approx -140px to GAME_W + 140px.
    // Margin of 200px guarantees coins never lag behind, pop in late, or vanish early during high-speed movement.
    if (drawX < -200 || drawX > GAME_W + 200) return;

    const scaleX = Math.cos(time + c.animOffset);
    const floatY = c.y + Math.sin(time * 0.8 + c.animOffset) * 4;

    ctx.save();
    ctx.translate(drawX, floatY);

    // Subtle warm golden ambient glow behind coin
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
    glow.addColorStop(0, 'rgba(255, 230, 80, 0.45)');
    glow.addColorStop(0.6, 'rgba(255, 200, 40, 0.15)');
    glow.addColorStop(1, 'rgba(255, 180, 20, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    // 3D rotating coin ellipse
    ctx.scale(Math.abs(scaleX) * 0.88 + 0.12, 1);

    // Coin Outer Rim with Metallic Gradient
    const rimGrad = ctx.createLinearGradient(-11, -11, 11, 11);
    rimGrad.addColorStop(0, '#fff385');
    rimGrad.addColorStop(0.35, '#ffd214');
    rimGrad.addColorStop(0.7, '#d49600');
    rimGrad.addColorStop(1, '#8c5900');
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();

    // Coin Inner Bevel
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffeaa7';
    ctx.stroke();

    // Inner Core
    ctx.fillStyle = '#ffc000';
    ctx.beginPath();
    ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();

    // Star / Glint Center
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-1.5, -1.5, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });
}

export function drawPowerUps(
  ctx: CanvasRenderingContext2D,
  camX: number,
  powerups: PowerUp[],
  platforms?: Platform[]
) {
  const time = performance.now() * 0.004;

  powerups.forEach(p => {
    if (p.collected) return;
    const drawX = p.x - camX;
    if (drawX < -50 || drawX > GAME_W + 50) return;

    const centerX = drawX + p.width / 2;
    const floatY = p.y + Math.sin(time * 3 + p.animOffset) * 5;
    const centerY = floatY + p.height / 2;

    // Soft drop shadow under power-up
    if (platforms) {
      const groundY = getGroundUnder(p.x, p.width, p.y + p.height, platforms);
      if (groundY !== null) {
        const heightAbove = Math.max(0, groundY - (floatY + p.height));
        if (heightAbove < 220) {
          const scale = Math.max(0.2, 1 - heightAbove / 220);
          const alpha = Math.max(0.05, 0.35 * (1 - heightAbove / 220));
          ctx.save();
          ctx.fillStyle = `rgba(15, 23, 42, ${alpha})`;
          ctx.beginPath();
          ctx.ellipse(centerX, groundY, 15 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    ctx.save();
    ctx.translate(centerX, centerY);

    // 1. SPEED BOOST (Electric Yellow Diamond & Lightning)
    if (p.type === 'speed') {
      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 24);
      glow.addColorStop(0, 'rgba(253, 224, 71, 0.65)');
      glow.addColorStop(0.5, 'rgba(234, 179, 8, 0.25)');
      glow.addColorStop(1, 'rgba(202, 138, 4, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(Math.sin(time * 2 + p.animOffset) * 0.08);
      ctx.fillStyle = '#ca8a04';
      ctx.beginPath();
      ctx.moveTo(0, -17);
      ctx.lineTo(16, 0);
      ctx.lineTo(0, 17);
      ctx.lineTo(-16, 0);
      ctx.closePath();
      ctx.fill();

      const innerGrad = ctx.createLinearGradient(-12, -12, 12, 12);
      innerGrad.addColorStop(0, '#fef08a');
      innerGrad.addColorStop(0.4, '#eab308');
      innerGrad.addColorStop(1, '#a16207');
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(13, 0);
      ctx.lineTo(0, 14);
      ctx.lineTo(-13, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(1, -9);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-1, 0);
      ctx.lineTo(-3, 9);
      ctx.lineTo(6, -1);
      ctx.lineTo(1, -1);
      ctx.closePath();
      ctx.fill();

      const spAngle = time * 4 + p.animOffset;
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(Math.cos(spAngle) * 18, Math.sin(spAngle) * 18, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. SHIELD (Azure Energy Sphere & Crest)
    else if (p.type === 'shield') {
      const pulse = Math.sin(time * 4 + p.animOffset) * 2;
      const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 25 + pulse);
      glow.addColorStop(0, 'rgba(56, 189, 248, 0.65)');
      glow.addColorStop(0.5, 'rgba(14, 165, 233, 0.25)');
      glow.addColorStop(1, 'rgba(2, 132, 199, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 25 + pulse, 0, Math.PI * 2);
      ctx.fill();

      const orbGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, 15);
      orbGrad.addColorStop(0, 'rgba(224, 242, 254, 0.95)');
      orbGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.7)');
      orbGrad.addColorStop(1, 'rgba(3, 105, 161, 0.85)');
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.save();
      ctx.rotate(time * 2 + p.animOffset);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, 19, 7.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(19, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-5, -6);
      ctx.lineTo(5, -6);
      ctx.lineTo(5, 1);
      ctx.quadraticCurveTo(5, 6, 0, 8);
      ctx.quadraticCurveTo(-5, 6, -5, 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(-3, -4);
      ctx.lineTo(3, -4);
      ctx.lineTo(3, 1);
      ctx.quadraticCurveTo(3, 4, 0, 6);
      ctx.quadraticCurveTo(-3, 4, -3, 1);
      ctx.closePath();
      ctx.fill();
    }

    // 3. EXTRA LIFE (Crimson Heart)
    else if (p.type === 'life') {
      const beat = Math.sin(time * 6 + p.animOffset) * 0.12;
      ctx.scale(1 + beat, 1 + beat);

      const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 26);
      glow.addColorStop(0, 'rgba(244, 63, 94, 0.7)');
      glow.addColorStop(0.6, 'rgba(225, 29, 72, 0.28)');
      glow.addColorStop(1, 'rgba(159, 18, 57, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();

      const heartGrad = ctx.createLinearGradient(-10, -12, 10, 14);
      heartGrad.addColorStop(0, '#fda4af');
      heartGrad.addColorStop(0.3, '#f43f5e');
      heartGrad.addColorStop(1, '#9f1239');
      ctx.fillStyle = heartGrad;

      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.bezierCurveTo(-3, -12, -14, -12, -14, -2);
      ctx.bezierCurveTo(-14, 6, -4, 11, 0, 16);
      ctx.bezierCurveTo(4, 11, 14, 6, 14, -2);
      ctx.bezierCurveTo(14, -12, 3, -12, 0, -2);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.ellipse(-6, -5, 3.5, 2, -0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. COIN MAGNET (Horseshoe Magnet)
    else if (p.type === 'magnet') {
      const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 25);
      glow.addColorStop(0, 'rgba(192, 132, 252, 0.65)');
      glow.addColorStop(0.5, 'rgba(168, 85, 247, 0.25)');
      glow.addColorStop(1, 'rgba(126, 34, 206, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(Math.sin(time * 2.5 + p.animOffset) * 0.12);

      ctx.lineWidth = 6;
      ctx.strokeStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(0, -2, 11, 0, Math.PI, false);
      ctx.stroke();

      ctx.strokeStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(-11, -2);
      ctx.lineTo(-11, 7);
      ctx.stroke();

      ctx.strokeStyle = '#3b82f6';
      ctx.beginPath();
      ctx.moveTo(11, -2);
      ctx.lineTo(11, 7);
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-14, 7, 6, 3.5);
      ctx.fillRect(8, 7, 6, 3.5);

      const sparkOffset = Math.sin(time * 12) * 3;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-8, 8.5);
      ctx.lineTo(0, 6 + sparkOffset);
      ctx.lineTo(8, 8.5);
      ctx.stroke();
    }

    // 5. SUPER JUMP (Blazing Flame Energy Star)
    else if (p.type === 'jump') {
      const flamePulse = Math.sin(time * 6 + p.animOffset) * 3;
      const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, 25 + flamePulse);
      glow.addColorStop(0, 'rgba(251, 146, 60, 0.7)');
      glow.addColorStop(0.5, 'rgba(234, 88, 12, 0.3)');
      glow.addColorStop(1, 'rgba(154, 52, 18, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 25 + flamePulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(time * 1.5 + p.animOffset);
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const rot = (i * Math.PI) / 4;
        const r1 = 15;
        const r2 = 7;
        ctx.lineTo(Math.cos(rot) * r1, Math.sin(rot) * r1);
        ctx.lineTo(Math.cos(rot + Math.PI / 8) * r2, Math.sin(rot + Math.PI / 8) * r2);
      }
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const rot = (i * Math.PI) / 4;
        const r1 = 9;
        const r2 = 4;
        ctx.lineTo(Math.cos(rot) * r1, Math.sin(rot) * r1);
        ctx.lineTo(Math.cos(rot + Math.PI / 8) * r2, Math.sin(rot + Math.PI / 8) * r2);
      }
      ctx.closePath();
      ctx.fill();

      const fY = (time * 25) % 18;
      ctx.fillStyle = '#ff7700';
      ctx.beginPath();
      ctx.arc(Math.sin(fY) * 6, -10 - fY * 0.5, 2.5 * (1 - fY / 18), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  });
}

export function drawEnemies(
  ctx: CanvasRenderingContext2D,
  camX: number,
  enemies: Enemy[],
  platforms?: Platform[]
) {
  enemies.forEach(e => {
    const drawX = e.x - camX;
    if (drawX < -60 || drawX > GAME_W + 60) return;

    const centerX = drawX + e.width / 2;
    const bottomY = e.y + e.height;

    // 1. SOFT GROUND SHADOW
    if (e.alive) {
      ctx.save();
      if (e.type === 'bumble') {
        // Flying bumble drone shadow stays on the ground underneath
        let groundY = bottomY + 25;
        if (platforms) {
          const found = getGroundUnder(e.x, e.width, bottomY, platforms);
          if (found !== null) groundY = found;
        }
        const dist = Math.max(0, groundY - bottomY);
        const shadowScale = Math.max(0.3, 1 - dist / 180);
        ctx.fillStyle = `rgba(15, 23, 42, ${0.25 * shadowScale})`;
        ctx.beginPath();
        ctx.ellipse(centerX, groundY, 14 * shadowScale, 4.5 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Ground patrolling enemies have direct contact soft shadow
        ctx.fillStyle = 'rgba(15, 23, 42, 0.32)';
        ctx.beginPath();
        ctx.ellipse(centerX, bottomY - 1, e.width * 0.44, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 2. ENEMY SPRITE RENDERING
    ctx.save();
    ctx.translate(centerX, e.y + e.height / 2);

    if (!e.alive) {
      // Squished state
      ctx.scale(1.4, 0.25);
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (e.vx < 0) ctx.scale(-1, 1);

    if (e.type === 'sprout') {
      // SPROUT BOT - Cute round seedling bot with volumetric shading & animated feet
      const footWiggle = Math.sin(e.animFrame * 2.5) * 4;

      // Feet (rounded shoes with shading)
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.ellipse(-7, 10 + footWiggle, 5.5, 4, 0, 0, Math.PI * 2);
      ctx.ellipse(7, 10 - footWiggle, 5.5, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Main Spherical Body with Sunlit Sphere Highlight (top-left)
      const bodyGrad = ctx.createRadialGradient(-5, -5, 2, 0, 0, 15);
      bodyGrad.addColorStop(0, '#58d68d');
      bodyGrad.addColorStop(0.65, '#27ae60');
      bodyGrad.addColorStop(1, '#196f3d');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();

      // Sunlit specular rim
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(-5, -5, 5, 0, Math.PI * 2);
      ctx.fill();

      // Sprouting Leaf Antenna on Head
      const leafSway = Math.sin(e.animFrame * 1.8) * 0.15;
      ctx.save();
      ctx.translate(0, -13);
      ctx.rotate(leafSway);
      const leafGrad = ctx.createLinearGradient(-3, -12, 3, 0);
      leafGrad.addColorStop(0, '#2ecc71');
      leafGrad.addColorStop(1, '#1e8449');
      ctx.fillStyle = leafGrad;
      ctx.beginPath();
      ctx.ellipse(0, -6, 3.5, 8, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Cartoon Eye with Specular Glint
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(6, -2, 5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(8, -2, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(7.2, -3.5, 1.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'bumble') {
      // BUMBLE DRONE - Hovering robotic bee with translucent motion-blurred wings
      const wingFlap = Math.sin(e.animFrame * 7) * 7;

      // Translucent Wings with specular rim
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.ellipse(-3, -13 + wingFlap, 11, 4.5, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // 3D Bee Body
      const beeGrad = ctx.createRadialGradient(-3, -4, 2, 0, 0, 15);
      beeGrad.addColorStop(0, '#fff176');
      beeGrad.addColorStop(0.6, '#fbc02d');
      beeGrad.addColorStop(1, '#f57f17');
      ctx.fillStyle = beeGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      // Metallic Cybernetic Stripes
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-2, -10, 4, 20);
      ctx.fillRect(4, -9, 3, 18);

      // Stinger
      ctx.fillStyle = '#d32f2f';
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(-8, -4);
      ctx.lineTo(-8, 4);
      ctx.closePath();
      ctx.fill();

      // Glowing Cyan Visor Eye
      const eyeGlow = ctx.createRadialGradient(8, -2, 1, 8, -2, 5);
      eyeGlow.addColorStop(0, '#ffffff');
      eyeGlow.addColorStop(0.5, '#00e5ff');
      eyeGlow.addColorStop(1, '#0097a7');
      ctx.fillStyle = eyeGlow;
      ctx.beginPath();
      ctx.arc(8, -2, 4.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'crawler') {
      // ROLLER CRAWLER - Armored purple beetle crawler with metallic specular plates
      const shellGrad = ctx.createRadialGradient(-4, -6, 2, 0, 0, 16);
      shellGrad.addColorStop(0, '#c084fc');
      shellGrad.addColorStop(0.6, '#9333ea');
      shellGrad.addColorStop(1, '#581c87');
      ctx.fillStyle = shellGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 14, Math.PI, 0, false);
      ctx.lineTo(14, 10);
      ctx.lineTo(-14, 10);
      ctx.closePath();
      ctx.fill();

      // Segmented Plate Ribs
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 9, Math.PI, 0, false);
      ctx.stroke();

      // Animated multi-legged crawler feet
      const legWiggle = Math.sin(e.animFrame * 4) * 3;
      ctx.fillStyle = '#1e293b';
      drawRoundRect(ctx, -11 + legWiggle, 8, 7, 5, 2);
      ctx.fill();
      drawRoundRect(ctx, 4 - legWiggle, 8, 7, 5, 2);
      ctx.fill();

      // Menacing Red Visor Slot
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 6;
      ctx.fillRect(6, -2, 6, 3.5);
      ctx.shadowBlur = 0;
    } else if (e.type === 'chonker') {
      // CHONKER - Heavy boulder rhino bot with stone horns & grumpy brow
      const stompDust = Math.sin(e.animFrame * 3) * 2;

      // Heavy Stomping Feet
      ctx.fillStyle = '#334155';
      drawRoundRect(ctx, -14, 10 + stompDust, 11, 7, 2);
      ctx.fill();
      drawRoundRect(ctx, 3, 10 - stompDust, 11, 7, 2);
      ctx.fill();

      // Boulder Body with Crags
      const rockGrad = ctx.createRadialGradient(-4, -4, 3, 0, 0, 20);
      rockGrad.addColorStop(0, '#94a3b8');
      rockGrad.addColorStop(0.65, '#475569');
      rockGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = rockGrad;
      ctx.beginPath();
      ctx.arc(0, 2, 17, 0, Math.PI * 2);
      ctx.fill();

      // Rocky Horn / Ridge on Front
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(12, -4);
      ctx.lineTo(20, -1);
      ctx.lineTo(13, 5);
      ctx.closePath();
      ctx.fill();

      // Grumpy Furrowed Brow & Glowing Amber Eye
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(6, -3, 8, 5);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(8, -2, 4, 3);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(4, -5);
      ctx.lineTo(15, -2);
      ctx.stroke();
    } else if (e.type === 'hopper') {
      // HOPPER - Coiled spring frog bot that squashes and leaps
      const squash = e.jumpCooldown && e.jumpCooldown < 15 ? 0.7 : 1.0;
      ctx.scale(1 / squash, squash);

      // Coiled Metallic Spring Leg
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 5);
      ctx.lineTo(-6, 8);
      ctx.lineTo(6, 11);
      ctx.lineTo(-4, 14);
      ctx.stroke();

      // Cute Round Cyan Body
      const hopGrad = ctx.createRadialGradient(-3, -4, 2, 0, -2, 14);
      hopGrad.addColorStop(0, '#67e8f9');
      hopGrad.addColorStop(0.7, '#06b6d4');
      hopGrad.addColorStop(1, '#0891b2');
      ctx.fillStyle = hopGrad;
      ctx.beginPath();
      ctx.arc(0, -3, 12, 0, Math.PI * 2);
      ctx.fill();

      // Big Curious Googly Eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(5, -7, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(6.5, -7, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(6, -8, 1, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'starstrider') {
      // STARSTRIDER - Celestial runner sprite with floating star crown & shimmering energy
      const hover = Math.sin(e.animFrame * 3) * 3;

      // Flowing Energy Robe/Trail
      const auraGrad = ctx.createLinearGradient(0, -15, 0, 18);
      auraGrad.addColorStop(0, '#f43f5e');
      auraGrad.addColorStop(0.5, '#ec4899');
      auraGrad.addColorStop(1, '#a855f7');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.moveTo(0, -8 + hover);
      ctx.quadraticCurveTo(12, 4 + hover, 8, 16 + hover);
      ctx.lineTo(-8, 16 + hover);
      ctx.quadraticCurveTo(-12, 4 + hover, 0, -8 + hover);
      ctx.closePath();
      ctx.fill();

      // Floating Crystal Star Crown
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, -18 + hover, 4, 0, Math.PI * 2);
      ctx.fill();

      // Glowing Anime Eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(4, -4 + hover, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#9333ea';
      ctx.beginPath();
      ctx.arc(5, -4 + hover, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  });
}

export function drawNPCs(
  ctx: CanvasRenderingContext2D,
  camX: number,
  npcs: NPC[],
  player: Player,
  platforms?: Platform[]
) {
  const time = performance.now() * 0.003;

  npcs.forEach(npc => {
    const drawX = npc.x - camX;
    if (drawX < -80 || drawX > GAME_W + 80) return;

    const centerX = drawX + npc.width / 2;
    const bottomY = npc.y + npc.height;
    const distToPlayer = Math.hypot(
      (player.x + player.width / 2) - (npc.x + npc.width / 2),
      (player.y + player.height / 2) - (npc.y + npc.height / 2)
    );
    const isNear = distToPlayer < 190;

    // Soft ground shadow
    ctx.save();
    let groundY = bottomY;
    if (platforms) {
      const found = getGroundUnder(npc.x, npc.width, bottomY, platforms);
      if (found !== null) groundY = found;
    }
    ctx.fillStyle = 'rgba(15, 23, 42, 0.32)';
    ctx.beginPath();
    ctx.ellipse(centerX, groundY - 1, 14, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(centerX, bottomY);

    if (npc.type === 'mira') {
      // MIRA - Friendly anime companion
      const wave = isNear ? Math.sin(time * 8) * 0.4 : 0;
      const bob = Math.sin(time * 3 + npc.animTimer) * 2;

      // Shoes
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.ellipse(-5, 0, 4.5, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(5, 0, 4.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body / Tunic (Lilac & Teal)
      ctx.fillStyle = '#a855f7';
      drawRoundRect(ctx, -7, -24 + bob, 14, 16, 4);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      drawRoundRect(ctx, -5, -20 + bob, 10, 8, 2);
      ctx.fill();

      // Hair
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(0, -28 + bob, 9, 0, Math.PI * 2);
      ctx.fill();

      // Face
      ctx.fillStyle = '#fec9a1';
      ctx.beginPath();
      ctx.arc(0, -27 + bob, 7, 0, Math.PI * 2);
      ctx.fill();

      // Hair bangs & Teal Ribbon
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(0, -32 + bob, 8, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(-4, -34 + bob, 8, 3);

      // Cute Eyes
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(2, -27 + bob, 1.8, 0, Math.PI * 2);
      ctx.arc(-2, -27 + bob, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(2.5, -27.5 + bob, 0.7, 0, Math.PI * 2);
      ctx.arc(-1.5, -27.5 + bob, 0.7, 0, Math.PI * 2);
      ctx.fill();

      // Cheerful Smile
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, -24 + bob, 2.2, 0.2, Math.PI * 0.8);
      ctx.stroke();

      // Waving Arm
      ctx.save();
      ctx.translate(6, -20 + bob);
      ctx.rotate(isNear ? -0.8 + wave : -0.2);
      ctx.fillStyle = '#a855f7';
      drawRoundRect(ctx, -2, -10, 4, 10, 2);
      ctx.fill();
      ctx.fillStyle = '#fec9a1';
      ctx.beginPath();
      ctx.arc(0, -11, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

    } else if (npc.type === 'bolt') {
      // BOLT - Small hovering helper bot
      const hover = Math.sin(time * 5 + npc.animTimer) * 5;

      // Hover glow
      const glow = ctx.createRadialGradient(0, -16 + hover, 2, 0, -16 + hover, 18);
      glow.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
      glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, -16 + hover, 18, 0, Math.PI * 2);
      ctx.fill();

      // Chrome/Cyan Bot Chassis
      const botGrad = ctx.createLinearGradient(-10, -26 + hover, 10, -6 + hover);
      botGrad.addColorStop(0, '#e2e8f0');
      botGrad.addColorStop(0.5, '#38bdf8');
      botGrad.addColorStop(1, '#0284c7');
      ctx.fillStyle = botGrad;
      drawRoundRect(ctx, -10, -26 + hover, 20, 18, 6);
      ctx.fill();

      // Bezel edge
      ctx.strokeStyle = '#0369a1';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Antenna with blinking beacon
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -26 + hover);
      ctx.lineTo(0, -33 + hover);
      ctx.stroke();
      const beaconFlash = Math.sin(time * 10) > 0;
      ctx.fillStyle = beaconFlash ? '#facc15' : '#eab308';
      ctx.beginPath();
      ctx.arc(0, -34 + hover, 2.8, 0, Math.PI * 2);
      ctx.fill();

      // Visor Screen
      ctx.fillStyle = '#0f172a';
      drawRoundRect(ctx, -7, -22 + hover, 14, 9, 3);
      ctx.fill();

      // Animated Glowing Cyan Eyes (^ _ ^)
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('^ _ ^', 0, -18 + hover);

      // Pointer Arm
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(8, -14 + hover);
      ctx.lineTo(16, -20 + hover);
      ctx.stroke();

    } else if (npc.type === 'nova') {
      // NOVA - Mysterious star runner
      const celestialFloat = Math.sin(time * 3 + npc.animTimer) * 4;

      // Cosmic Star Aura
      const aura = ctx.createRadialGradient(0, -20 + celestialFloat, 4, 0, -20 + celestialFloat, 24);
      aura.addColorStop(0, 'rgba(192, 132, 252, 0.45)');
      aura.addColorStop(0.6, 'rgba(236, 72, 153, 0.2)');
      aura.addColorStop(1, 'rgba(147, 51, 234, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, -20 + celestialFloat, 24, 0, Math.PI * 2);
      ctx.fill();

      // Flowing Celestial Robe
      const robeGrad = ctx.createLinearGradient(0, -32 + celestialFloat, 0, -2 + celestialFloat);
      robeGrad.addColorStop(0, '#4338ca');
      robeGrad.addColorStop(0.5, '#6366f1');
      robeGrad.addColorStop(1, '#a855f7');
      ctx.fillStyle = robeGrad;
      ctx.beginPath();
      ctx.moveTo(0, -30 + celestialFloat);
      ctx.lineTo(-10, -2 + celestialFloat);
      ctx.quadraticCurveTo(0, -6 + celestialFloat, 10, -2 + celestialFloat);
      ctx.closePath();
      ctx.fill();

      // Hooded Starlight Face
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.arc(0, -28 + celestialFloat, 8, 0, Math.PI * 2);
      ctx.fill();

      // Golden Star Crest Circlet
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(0, -34 + celestialFloat, 3, 0, Math.PI * 2);
      ctx.fill();

      // Twin Glowing Star Eyes
      ctx.fillStyle = '#67e8f9';
      ctx.shadowColor = '#67e8f9';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(-3, -28 + celestialFloat, 1.8, 0, Math.PI * 2);
      ctx.arc(3, -28 + celestialFloat, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    // Floating speech bubble when Jiro is nearby
    if (isNear) {
      ctx.save();
      const bubbleY = bottomY - npc.height - 24 + Math.sin(time * 4 + npc.animTimer) * 3;
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const text = npc.dialogue;
      const textWidth = ctx.measureText(text).width;
      const bubbleW = textWidth + 24;
      const bubbleH = 28;
      const bubbleX = centerX - bubbleW / 2;

      // Bubble shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      drawRoundRect(ctx, bubbleX, bubbleY + 2, bubbleW, bubbleH, 8);
      ctx.fill();

      // Bubble background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      drawRoundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 8);
      ctx.fill();

      // Accent rim
      const rimColor = npc.type === 'mira' ? '#ec4899' : npc.type === 'bolt' ? '#38bdf8' : '#c084fc';
      ctx.strokeStyle = rimColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Pointer triangle
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.beginPath();
      ctx.moveTo(centerX - 6, bubbleY + bubbleH);
      ctx.lineTo(centerX + 6, bubbleY + bubbleH);
      ctx.lineTo(centerX, bubbleY + bubbleH + 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rimColor;
      ctx.beginPath();
      ctx.moveTo(centerX - 6, bubbleY + bubbleH);
      ctx.lineTo(centerX, bubbleY + bubbleH + 6);
      ctx.lineTo(centerX + 6, bubbleY + bubbleH);
      ctx.stroke();

      // Dialogue text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, centerX, bubbleY + bubbleH / 2);

      // Name Tag
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.fillStyle = rimColor;
      ctx.fillText(npc.name.toUpperCase(), centerX, bubbleY - 6);

      ctx.restore();
    }
  });
}

/**
 * BOSS RENDERING - "GorgonX"
 * Massive, cohesive, fully articulated apex cyber-beast:
 * - Seamless anatomical joints: ball-and-socket hips and shoulders, articulated knees and elbows, integrated ankles and wrists
 * - Unbroken neck-to-torso cervical junction that flexes naturally without floating or shearing
 * - Dorsal spines anchored directly onto the vertebral back ridge with molded base sockets
 * - Heavy segmented obsidian chitin plates with contact shadows and rim highlights
 * - Articulated digitigrade legs with steel talons and grounded contact shadows
 * - Menacing snarling head with glowing amber predator eye, ivory fangs, internal throat fire, and swept-back horns
 * - Armored cranial bracket securing the pulsing weak-spot power crystal
 */
export function drawBoss(ctx: CanvasRenderingContext2D, camX: number, boss: Boss, camY: number = -30) {
  if (!boss.active || boss.state === 'escaped' || boss.state === 'defeated') return;

  const rawDrawX = boss.x - camX;
  if (rawDrawX < -300 || rawDrawX > GAME_W + 300) return;

  const time = performance.now() * 0.005;

  // Proportional scale to ensure GorgonX fits completely within camera framing
  // without any clipping from head to feet while preserving all body parts, joints, and silhouettes
  const bossScale = 0.88;

  // Safe horizontal viewport boundaries:
  // With bossScale 0.88, GorgonX's body extends approx 36px left (horns/heels) and 34px right (claws/snout) from center.
  // Clamping ensures the entire body remains 100% visible on canvas without edge clipping.
  const minCenterX = 48;
  const maxCenterX = GAME_W - 55;
  const rawCenterX = rawDrawX + (boss.width * bossScale) / 2;
  const centerX = Math.max(minCenterX, Math.min(maxCenterX, rawCenterX));

  // Safe vertical viewport boundaries:
  // GorgonX's crown crystal/horns extend ~42px above center, feet extend ~44px below center.
  // Clamping prevents head from going behind the top HUD (y < 62) or feet from clipping canvas bottom (y > 530).
  const rawCenterY = boss.y + (boss.height * bossScale) / 2;
  const minCenterY = camY + 104; // Leaves clear headroom below top HUD pills (y: 16..54)
  const maxCenterY = camY + 486; // Keeps feet visibly above canvas bottom (540)
  const effectiveCenterY = Math.max(minCenterY, Math.min(maxCenterY, rawCenterY));

  // Stride & locomotion cycle
  const walkCycle = time * 7.5;
  const strideSin = Math.sin(walkCycle);
  const strideCos = Math.cos(walkCycle);
  const bodyBob = Math.abs(strideSin) * 3.0;

  // Joint swing angles (counter-balanced for powerful quadrupedal/bipedal gait)
  const backLegSwing = strideSin * 0.38;
  const frontLegSwing = -strideSin * 0.38;
  const backArmSwing = frontLegSwing * 0.42;
  const frontArmSwing = backLegSwing * 0.42;

  // --- 1. AMBIENT & DYNAMIC FOOT GROUND CONTACT SHADOWS ---
  const bottomY = effectiveCenterY + 40 * bossScale + bodyBob;
  ctx.save();
  // Broad ambient creature shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.beginPath();
  ctx.ellipse(centerX, bottomY, 48 * bossScale, 11 * bossScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dynamic foot stomping shadows
  const leftFootOffset = backLegSwing * 24 * bossScale;
  const rightFootOffset = frontLegSwing * 24 * bossScale;
  const leftContact = Math.max(0.4, 1 - Math.abs(strideSin) * 0.5);
  const rightContact = Math.max(0.4, 1 - Math.abs(-strideSin) * 0.5);

  ctx.fillStyle = 'rgba(2, 6, 23, 0.7)';
  ctx.beginPath();
  ctx.ellipse(centerX - 14 * bossScale + leftFootOffset, bottomY, 16 * bossScale * leftContact, 5.5 * bossScale * leftContact, 0, 0, Math.PI * 2);
  ctx.ellipse(centerX + 14 * bossScale + rightFootOffset, bottomY, 16 * bossScale * rightContact, 5.5 * bossScale * rightContact, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- 2. MAIN CREATURE TRANSFORMATION HIERARCHY ---
  ctx.save();
  ctx.translate(centerX, effectiveCenterY - bodyBob);
  ctx.scale(bossScale, bossScale);

  // Facing direction (GorgonX runs to the right pursuing Jiro)
  if (boss.vx < 0) ctx.scale(-1, 1);

  // Hit flash if damaged recently
  if (boss.hitCooldown > 0 && Math.floor(boss.hitCooldown * 20) % 2 === 0) {
    ctx.filter = 'brightness(2.2) saturate(0.2)';
  }

  // --- LAYER 1: BACK ARM (Far Side, Articulated 3-Joint Hierarchy) ---
  ctx.save();
  // Shoulder joint socket (anchored to upper-left thoracic region)
  const backShoulderX = -10;
  const backShoulderY = -12;
  ctx.translate(backShoulderX, backShoulderY);
  ctx.rotate(backArmSwing - 0.25);

  // Deep socket shadow behind arm
  ctx.fillStyle = 'rgba(2, 6, 23, 0.6)';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();

  // Upper arm (humerus)
  ctx.fillStyle = '#162032';
  drawRoundRect(ctx, -6, -2, 12, 20, 5);
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Elbow joint capsule
  ctx.translate(0, 18);
  const backElbowFlex = 0.35 + Math.max(0, -backArmSwing) * 0.4;
  ctx.rotate(backElbowFlex);

  // Elbow condyle & contact shadow
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();

  // Forearm & armored bracer
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, -5, 0, 10, 18, 4);
  ctx.fill();

  // Wrist joint & clawed hand
  ctx.translate(0, 17);
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(0, 1, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Claws (3 sharp articulated talons)
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(-5, 2);
  ctx.lineTo(-8, 12);
  ctx.lineTo(-2, 5);
  ctx.lineTo(0, 14);
  ctx.lineTo(2, 5);
  ctx.lineTo(7, 12);
  ctx.lineTo(4, 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore(); // End back arm

  // --- LAYER 2: BACK LEG (Far Side, Articulated Digitigrade Hierarchy) ---
  ctx.save();
  // Hip socket (anchored firmly into pelvic cradle)
  const backHipX = -12;
  const backHipY = 10;
  ctx.translate(backHipX, backHipY);
  ctx.rotate(backLegSwing);

  // Deep pelvic socket shadow
  ctx.fillStyle = 'rgba(2, 6, 23, 0.65)';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();

  // Upper thigh (femur)
  ctx.fillStyle = '#162032';
  drawRoundRect(ctx, -8, -3, 16, 22, 6);
  ctx.fill();

  // Knee joint & cap
  ctx.translate(0, 20);
  const backKneeAngle = 0.38 - backLegSwing * 0.45;
  ctx.rotate(backKneeAngle);

  // Knee condyle hinge
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  // Armored knee-guard plate
  ctx.fillStyle = '#b91c1c';
  drawRoundRect(ctx, 1, -5, 7, 10, 2.5);
  ctx.fill();

  // Lower leg / shank (crus)
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, -5, 0, 11, 20, 4);
  ctx.fill();

  // Ankle joint & heel spur
  ctx.translate(0, 19);
  const backAnkleAngle = -backKneeAngle * 0.85 - 0.1;
  ctx.rotate(backAnkleAngle);

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();

  // Taloned foot
  ctx.fillStyle = '#0b1120';
  ctx.beginPath();
  ctx.moveTo(-8, -2);
  ctx.lineTo(14, -2);
  ctx.lineTo(18, 7);
  ctx.lineTo(-9, 7);
  ctx.closePath();
  ctx.fill();

  // Ground talons
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(21, 6);
  ctx.lineTo(13, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore(); // End back leg

  // --- LAYER 3: DORSAL SPINES (Firmly Anchored to Computed Spine Arc) ---
  // The spine arc is defined continuously along the creature's arched back:
  const spineGlowPulse = Math.sin(time * 6) * 0.25 + 0.75;
  const spineAnchors = [
    { x: -8, y: -22, angle: -0.45, len: 20 },  // Cervical/Upper Thoracic
    { x: -16, y: -16, angle: -0.85, len: 22 }, // Mid Thoracic Apex
    { x: -22, y: -6, angle: -1.25, len: 19 },  // Lower Thoracic
    { x: -24, y: 6, angle: -1.65, len: 15 }    // Lumbar
  ];

  for (let s = 0; s < spineAnchors.length; s++) {
    const sp = spineAnchors[s];
    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.rotate(sp.angle);

    // Sculpted vertebrae base bracket (welded directly onto back carapace)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(-6, 2);
    ctx.lineTo(-4, -6);
    ctx.lineTo(4, -6);
    ctx.lineTo(6, 2);
    ctx.closePath();
    ctx.fill();

    // Rivet detail on base plate
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(-3, -2, 1.2, 0, Math.PI * 2);
    ctx.arc(3, -2, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Main jagged obsidian dorsal spine blade
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(-4, -5);
    ctx.lineTo(0, -sp.len);
    ctx.lineTo(4, -5);
    ctx.closePath();
    ctx.fill();

    // Channeled magma energy core along spine ridge
    ctx.fillStyle = `rgba(249, 115, 22, ${spineGlowPulse})`;
    ctx.beginPath();
    ctx.moveTo(-1.8, -5);
    ctx.lineTo(0, -sp.len + 3);
    ctx.lineTo(1.8, -5);
    ctx.closePath();
    ctx.fill();

    // Hot inner filament
    ctx.fillStyle = `rgba(254, 240, 138, ${spineGlowPulse * 0.8})`;
    ctx.beginPath();
    ctx.moveTo(-0.8, -4);
    ctx.lineTo(0, -sp.len + 5);
    ctx.lineTo(0.8, -4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // --- LAYER 4: MAIN TORSO & PELVIS (Segmented, Seamless Muscular Chitin) ---
  // Main back thoracic carapace
  const torsoGrad = ctx.createLinearGradient(-26, -26, 24, 26);
  torsoGrad.addColorStop(0, '#334155');
  torsoGrad.addColorStop(0.45, '#1e293b');
  torsoGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = torsoGrad;

  // Solid anatomical torso contour
  ctx.beginPath();
  ctx.moveTo(-4, -24);   // Neck/clavicle junction
  ctx.lineTo(16, -20);   // Upper chest front
  ctx.lineTo(18, -4);    // Lower ribcage front
  ctx.lineTo(12, 16);    // Lower abdomen / groin
  ctx.lineTo(-14, 18);   // Pelvic base
  ctx.lineTo(-24, 8);    // Lumbar spine arch
  ctx.lineTo(-22, -10);  // Mid-dorsal arch
  ctx.lineTo(-10, -22);  // Upper-dorsal arch
  ctx.closePath();
  ctx.fill();

  // Dark contact edge crease for muscle/armor definition
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Articulated sternum & pectoral armor plates
  ctx.fillStyle = '#475569';
  drawRoundRect(ctx, -6, -18, 22, 14, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Segmented abdominal armor plates (3 interlocking flex tiers)
  const absY = [-2, 5, 11];
  const absW = [18, 16, 13];
  for (let i = 0; i < 3; i++) {
    // Contact shadow above each plate tier
    ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
    ctx.fillRect(-4, absY[i] - 1, absW[i], 2);

    ctx.fillStyle = i === 1 ? '#334155' : '#1e293b';
    drawRoundRect(ctx, -4, absY[i], absW[i], 6, 2.5);
    ctx.fill();
  }

  // Glowing crimson hazard trim conduits on chest
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, -14);
  ctx.lineTo(12, -14);
  ctx.moveTo(-2, -8);
  ctx.lineTo(10, -8);
  ctx.stroke();

  // Internal thermal vent glow (pulsing engine core)
  const coreGlow = Math.sin(time * 5) * 0.2 + 0.8;
  ctx.fillStyle = `rgba(249, 115, 22, ${coreGlow * 0.85})`;
  ctx.beginPath();
  ctx.arc(3, -11, 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Heavy armored utility / pelvic belt with brass warning rivets
  ctx.fillStyle = '#d97706';
  drawRoundRect(ctx, -18, 13, 34, 6, 3);
  ctx.fill();
  ctx.fillStyle = '#fde047';
  ctx.fillRect(-11, 14, 4, 4);
  ctx.fillRect(3, 14, 4, 4);
  // Pelvic armor shadow
  ctx.fillStyle = 'rgba(2, 6, 23, 0.5)';
  ctx.fillRect(-17, 18, 32, 2.5);

  // --- LAYER 5: SEAMLESS ARTICULATED NECK & HEAD ---
  // The neck is anchored securely into the thoracic chest and upper dorsal spine,
  // then bends naturally toward the cranium so there is ZERO floating gap!
  const headNod = Math.sin(walkCycle + 0.5) * 0.05; // Gentle predator nodding
  const neckRootX = 4;
  const neckRootY = -18;

  // Solid cervical neck collar (drawn from torso up into skull base)
  ctx.save();
  ctx.translate(neckRootX, neckRootY);
  ctx.rotate(headNod);

  // Cervical neck armor plates (muscular overlapping bands)
  const neckGrad = ctx.createLinearGradient(-12, -6, 14, 8);
  neckGrad.addColorStop(0, '#1e293b');
  neckGrad.addColorStop(0.5, '#334155');
  neckGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = neckGrad;
  ctx.beginPath();
  ctx.moveTo(-10, 4);   // Anchor to back thoracic arch
  ctx.lineTo(8, 4);     // Anchor to clavicle front
  ctx.lineTo(14, -8);   // Jaw throat junction
  ctx.lineTo(-4, -12);  // Occipital skull junction
  ctx.closePath();
  ctx.fill();

  // Throat tendon / cyber conduit
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(6, 3);
  ctx.lineTo(11, -6);
  ctx.stroke();

  // Neck contact shadow crease under cranium
  ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
  ctx.beginPath();
  ctx.ellipse(3, -9, 8, 3, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // --- CRANIAL HEAD SHELL (Centered at skull pivot [2, -10]) ---
  ctx.translate(2, -10);

  // Main Cranial Shell (Jagged dragon/gargoyle obsidian predator silhouette)
  const headGrad = ctx.createLinearGradient(-14, -20, 26, 12);
  headGrad.addColorStop(0, '#475569');
  headGrad.addColorStop(0.55, '#1e293b');
  headGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.moveTo(-14, -14); // Occipital crest
  ctx.lineTo(8, -18);   // Cranial brow apex
  ctx.lineTo(26, -5);   // Snout / nasal bridge
  ctx.lineTo(24, 7);    // Upper jaw tip
  ctx.lineTo(8, 12);    // Jawline throat transition
  ctx.lineTo(-12, 6);   // Mandible hinge
  ctx.closePath();
  ctx.fill();

  // Contact bevel outline on skull
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Swept-Back Obsidian Crown Horns (Anchored firmly into cranial sockets)
  // Horn base socket plates
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(-4, -12, 6, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Upper Primary Horn
  ctx.fillStyle = '#0b1120';
  ctx.beginPath();
  ctx.moveTo(-2, -14);
  ctx.quadraticCurveTo(-16, -34, -34, -28);
  ctx.quadraticCurveTo(-18, -20, -8, -11);
  ctx.closePath();
  ctx.fill();

  // Golden runic binding ferrule on horn root
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(-12, -22);
  ctx.lineTo(-16, -17);
  ctx.stroke();

  // Lower Secondary Horn
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(-8, -7);
  ctx.quadraticCurveTo(-24, -17, -29, -11);
  ctx.quadraticCurveTo(-18, -7, -7, -2);
  ctx.closePath();
  ctx.fill();

  // Fiery Snarl Jaw with Internal Magma Glow & Ivory Fangs
  // Open throat cavity
  ctx.fillStyle = '#450a0a';
  drawRoundRect(ctx, 6, 2, 17, 9, 3);
  ctx.fill();

  // Internal plasma glow inside throat
  const throatGrad = ctx.createRadialGradient(10, 6, 1, 10, 6, 7);
  throatGrad.addColorStop(0, '#ffedd5');
  throatGrad.addColorStop(0.5, '#f97316');
  throatGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
  ctx.fillStyle = throatGrad;
  ctx.beginPath();
  ctx.arc(10, 6, 6.5, 0, Math.PI * 2);
  ctx.fill();

  // Interlocking Ivory Fangs
  ctx.fillStyle = '#f8fafc';
  // Upper fangs
  ctx.beginPath();
  ctx.moveTo(8, 2);
  ctx.lineTo(11, 7);
  ctx.lineTo(14, 2);
  ctx.moveTo(16, 2);
  ctx.lineTo(19, 8);
  ctx.lineTo(22, 2);
  ctx.fill();
  // Lower fangs
  ctx.beginPath();
  ctx.moveTo(10, 11);
  ctx.lineTo(13, 6);
  ctx.lineTo(16, 11);
  ctx.moveTo(18, 11);
  ctx.lineTo(21, 7);
  ctx.lineTo(24, 11);
  ctx.fill();

  // Heavy Brow Ridge & Contact Shadow over Eye
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(2, -10);
  ctx.lineTo(21, -4);
  ctx.lineTo(19, 0);
  ctx.lineTo(1, -6);
  ctx.closePath();
  ctx.fill();

  // Glowing Amber Predator Eye with Slit Pupil
  ctx.save();
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 9;
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.ellipse(11, -3, 6.5, 4, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Slit pupil
  ctx.fillStyle = '#450a0a';
  ctx.beginPath();
  ctx.ellipse(12, -3, 1.8, 3.8, 0.15, 0, Math.PI * 2);
  ctx.fill();

  // Specular gleam
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(10, -5, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Cranial Energy Core Weak-Spot (Stomp Target Mounted on Bolted Bracket)
  const crystalPulse = Math.sin(time * 9) * 2.5;

  // Heavy mechanical cranial mounting brackets
  ctx.fillStyle = '#d97706';
  drawRoundRect(ctx, -3, -22, 16, 5, 2);
  ctx.fill();
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(-1, -21, 3, 3);
  ctx.fillRect(8, -21, 3, 3);

  // Pulsing crystal energy aura
  const gemGrad = ctx.createRadialGradient(5, -28, 2, 5, -28, 12 + crystalPulse);
  gemGrad.addColorStop(0, '#fef08a');
  gemGrad.addColorStop(0.4, '#f97316');
  gemGrad.addColorStop(0.8, '#ef4444');
  gemGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
  ctx.fillStyle = gemGrad;
  ctx.beginPath();
  ctx.arc(5, -28, 12 + crystalPulse, 0, Math.PI * 2);
  ctx.fill();

  // Crystalline diamond core
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.moveTo(5, -36);
  ctx.lineTo(12, -28);
  ctx.lineTo(5, -20);
  ctx.lineTo(-2, -28);
  ctx.closePath();
  ctx.fill();

  // Crystal facet highlight
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(5, -34);
  ctx.lineTo(9, -28);
  ctx.lineTo(5, -25);
  ctx.lineTo(2, -28);
  ctx.closePath();
  ctx.fill();

  ctx.restore(); // End neck & head

  // --- LAYER 6: FRONT LEG (Near Side, Articulated Digitigrade Hierarchy) ---
  ctx.save();
  // Front Hip socket (anchored firmly into pelvic cradle)
  const frontHipX = 6;
  const frontHipY = 10;
  ctx.translate(frontHipX, frontHipY);
  ctx.rotate(frontLegSwing);

  // Heavy hip joint casing with rim highlight
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Upper thigh plate (muscular, highlighted)
  const thighGrad = ctx.createLinearGradient(-10, 0, 12, 22);
  thighGrad.addColorStop(0, '#475569');
  thighGrad.addColorStop(0.6, '#334155');
  thighGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = thighGrad;
  drawRoundRect(ctx, -9, -3, 18, 23, 7);
  ctx.fill();

  // Crimson armor accent stripe on thigh
  ctx.fillStyle = '#ef4444';
  drawRoundRect(ctx, 3, 2, 4, 14, 2);
  ctx.fill();

  // Knee joint & articulated armor guard
  ctx.translate(0, 21);
  const frontKneeAngle = 0.38 - frontLegSwing * 0.45;
  ctx.rotate(frontKneeAngle);

  // Circular knee condyle hinge
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  // Heavy chevron knee-guard plate
  ctx.fillStyle = '#dc2626';
  drawRoundRect(ctx, 2, -6, 9, 11, 3);
  ctx.fill();
  ctx.fillStyle = '#fca5a5';
  ctx.fillRect(4, -4, 2, 7);

  // Lower leg / digitigrade shank (crus)
  ctx.fillStyle = '#334155';
  drawRoundRect(ctx, -6, 0, 12, 21, 5);
  ctx.fill();

  // Ankle joint & heel spur
  ctx.translate(0, 20);
  const frontAnkleAngle = -frontKneeAngle * 0.85 - 0.1;
  ctx.rotate(frontAnkleAngle);

  // Ankle hinge socket
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();

  // Heavy taloned boot
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(-9, -2);
  ctx.lineTo(16, -2);
  ctx.lineTo(21, 8);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.fill();

  // Polished steel talons
  ctx.fillStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(25, 7);
  ctx.lineTo(15, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore(); // End front leg

  // --- LAYER 7: FRONT ARM (Near Side, Articulated 3-Joint Hierarchy) ---
  ctx.save();
  // Shoulder joint socket (anchored to clavicle / upper chest)
  const frontShoulderX = 8;
  const frontShoulderY = -10;
  ctx.translate(frontShoulderX, frontShoulderY);
  ctx.rotate(frontArmSwing + 0.2);

  // Spiked pauldron / shoulder plate overlapping chest
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, -11, -9, 22, 17, 6);
  ctx.fill();
  // Red warning chevron on shoulder
  ctx.fillStyle = '#ef4444';
  drawRoundRect(ctx, -9, -7, 18, 5, 2.5);
  ctx.fill();

  // Contact shadow under pauldron
  ctx.fillStyle = 'rgba(2, 6, 23, 0.5)';
  ctx.fillRect(-7, 6, 14, 3);

  // Upper arm (bicep)
  ctx.fillStyle = '#334155';
  drawRoundRect(ctx, -7, 6, 14, 18, 5);
  ctx.fill();

  // Elbow joint capsule & crease
  ctx.translate(0, 22);
  const frontElbowFlex = 0.35 + Math.max(0, -frontArmSwing) * 0.4;
  ctx.rotate(frontElbowFlex);

  // Circular elbow condyle
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();

  // Armored bracer / forearm
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, -6, 0, 13, 20, 5);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-2, 3, 4, 12);

  // Wrist joint & clawed hand
  ctx.translate(0, 19);
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(0, 2, 5.5, 0, Math.PI * 2);
  ctx.fill();

  // Heavy steel claws slashing forward
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(-10, 14);
  ctx.lineTo(-2, 5);
  ctx.lineTo(2, 16);
  ctx.lineTo(6, 5);
  ctx.lineTo(12, 14);
  ctx.lineTo(8, 2);
  ctx.closePath();
  ctx.fill();

  ctx.restore(); // End front arm

  ctx.restore(); // End main creature transform

  // --- 3. NAME "GorgonX" & HEALTH OVERLAY ABOVE SPRITE ---
  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 6;

  // Villain Name Banner (tightly framed above head crystal, never overlapping HUD)
  const tagY = effectiveCenterY - bodyBob - 44 * bossScale;
  ctx.font = '900 13px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#f87171';
  ctx.fillText('GorgonX', centerX, tagY - 14);

  // Health Crystals (3 Hearts/Crystals)
  const barW = 60;
  const startHpx = centerX - barW / 2;
  for (let i = 0; i < boss.maxHealth; i++) {
    const hx = startHpx + i * 22;
    ctx.font = '14px sans-serif';
    ctx.fillText(i < boss.health ? '💎' : '⚪', hx + 8, tagY);
  }
  ctx.restore();
}

/**
 * RENDERS PROCEDURAL BOSS ENCOUNTER HAZARDS:
 * 1. ground_spikes: Pop-up warning hazard beds on platforms
 * 2. falling_debris: Seismic meteor/rubble falling with ground targeting reticle
 * 3. moving_barrier: Oscillating laser hazard blocks
 * 4. danger_zone: Sizzling plasma energy fields
 */
export function drawBossHazards(ctx: CanvasRenderingContext2D, camX: number, hazards: BossHazard[]) {
  if (!hazards || hazards.length === 0) return;

  const time = performance.now() * 0.005;

  hazards.forEach(h => {
    const drawX = h.x - camX;
    if (drawX < -150 || drawX > GAME_W + 150) return;

    if (h.type === 'ground_spikes') {
      if (h.state === 'telegraph') {
        // Warning flashing chevrons on ground surface
        const pulse = Math.sin(time * 16) > 0;
        ctx.save();
        ctx.fillStyle = pulse ? 'rgba(239, 68, 68, 0.7)' : 'rgba(245, 158, 11, 0.4)';
        drawRoundRect(ctx, drawX, h.y - 6, h.width, 6, 2);
        ctx.fill();

        // Pulsing warning icon
        ctx.textAlign = 'center';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillStyle = pulse ? '#ffffff' : '#facc15';
        ctx.fillText('⚠️ SPIKES', drawX + h.width / 2, h.y - 12);
        ctx.restore();
      } else if (h.state === 'active') {
        // Razor-sharp metallic/crystal spikes jutting from ground
        ctx.save();
        const spikeCount = Math.max(3, Math.floor(h.width / 18));
        const spikeW = h.width / spikeCount;

        // Base frame
        ctx.fillStyle = '#0f172a';
        drawRoundRect(ctx, drawX, h.y - 4, h.width, 6, 2);
        ctx.fill();

        for (let i = 0; i < spikeCount; i++) {
          const sx = drawX + i * spikeW;
          const tipX = sx + spikeW / 2;
          const tipY = h.y - h.height;

          // Spike body
          const spikeGrad = ctx.createLinearGradient(sx, h.y, tipX, tipY);
          spikeGrad.addColorStop(0, '#334155');
          spikeGrad.addColorStop(0.6, '#94a3b8');
          spikeGrad.addColorStop(1, '#ef4444');
          ctx.fillStyle = spikeGrad;

          ctx.beginPath();
          ctx.moveTo(sx + 2, h.y);
          ctx.lineTo(tipX, tipY);
          ctx.lineTo(sx + spikeW - 2, h.y);
          ctx.closePath();
          ctx.fill();

          // Gleaming blade edge
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(sx + spikeW / 2, h.y);
          ctx.stroke();
        }
        ctx.restore();
      }
    } else if (h.type === 'falling_debris') {
      const targetGroundY = h.targetY || (h.y + 200);

      // Always draw ground landing reticle / shadow
      ctx.save();
      const shadowScale = Math.min(1, Math.max(0.2, (h.y - 50) / (targetGroundY - 50)));
      ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
      ctx.beginPath();
      ctx.ellipse(drawX + h.width / 2, targetGroundY, h.width * 0.6 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Warning target ring
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(drawX + h.width / 2, targetGroundY, 18 * shadowScale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Draw falling boulder if above ground
      if (h.y < targetGroundY) {
        ctx.save();
        ctx.translate(drawX + h.width / 2, h.y + h.height / 2);
        ctx.rotate(time * 6);

        // Volcanic rock body
        const rockGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, h.width / 2);
        rockGrad.addColorStop(0, '#f97316');
        rockGrad.addColorStop(0.4, '#7c2d12');
        rockGrad.addColorStop(1, '#1c1917');
        ctx.fillStyle = rockGrad;
        ctx.beginPath();
        ctx.arc(0, 0, h.width / 2, 0, Math.PI * 2);
        ctx.fill();

        // Hot fiery cracks
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-h.width * 0.3, 0);
        ctx.lineTo(0, -h.width * 0.2);
        ctx.lineTo(h.width * 0.3, h.width * 0.1);
        ctx.stroke();
        ctx.restore();
      }
    } else if (h.type === 'moving_barrier') {
      // Hovering laser forcefield / hazard block
      ctx.save();
      const pulse = Math.sin(time * 12) * 0.2 + 0.8;
      // Background block
      ctx.fillStyle = '#0f172a';
      drawRoundRect(ctx, drawX, h.y, h.width, h.height, 6);
      ctx.fill();

      // Hazard stripes
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2.5;
      drawRoundRect(ctx, drawX, h.y, h.width, h.height, 6);
      ctx.stroke();

      // Plasma forcefield glow inside
      ctx.fillStyle = `rgba(239, 68, 68, ${pulse * 0.6})`;
      drawRoundRect(ctx, drawX + 3, h.y + 3, h.width - 6, h.height - 6, 4);
      ctx.fill();

      // Electric spark line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(drawX + 4, h.y + h.height / 2);
      ctx.lineTo(drawX + h.width / 2, h.y + h.height / 2 + Math.sin(time * 20) * 4);
      ctx.lineTo(drawX + h.width - 4, h.y + h.height / 2);
      ctx.stroke();
      ctx.restore();
    } else if (h.type === 'danger_zone') {
      ctx.save();
      if (h.state === 'telegraph') {
        const pulse = Math.sin(time * 14) > 0;
        ctx.fillStyle = pulse ? 'rgba(234, 179, 8, 0.4)' : 'rgba(239, 68, 68, 0.25)';
        drawRoundRect(ctx, drawX, h.y - 8, h.width, 10, 4);
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillStyle = '#facc15';
        ctx.fillText('⚡ CHARGING ⚡', drawX + h.width / 2, h.y - 14);
      } else if (h.state === 'active') {
        // Erupting energy geyser
        const zoneGrad = ctx.createLinearGradient(0, h.y, 0, h.y - h.height);
        zoneGrad.addColorStop(0, '#f97316');
        zoneGrad.addColorStop(0.5, 'rgba(239, 68, 68, 0.7)');
        zoneGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = zoneGrad;
        drawRoundRect(ctx, drawX, h.y - h.height, h.width, h.height, 6);
        ctx.fill();
      }
      ctx.restore();
    }
  });
}

/**
 * REDESIGNED JIRO:
 * Compact humanoid platformer hero with:
 * - Distinct slightly-oval head
 * - Small, visible athletic adventurer torso / zipped jacket with collar
 * - Two distinct arms (swinging when running, hero poses when jumping)
 * - Two distinct legs & running sneakers (animated stride cycle)
 * - Flowing adventurer headband ribbons
 * - Rich lighting: sunlit top-left highlights, ambient right-side & underside shading
 * - Soft physical ground shadow underneath Jiro on the platform below
 */
export function drawJiro(
  ctx: CanvasRenderingContext2D,
  camX: number,
  player: Player,
  platforms?: Platform[]
) {
  // Invulnerability flicker
  if (player.invulnerableTimer > 0 && Math.floor(player.invulnerableTimer / 4) % 2 === 0) {
    return;
  }

  const centerX = player.x - camX + player.width / 2;
  const bottomY = player.y + player.height;

  // 1. SOFT PHYSICAL GROUND SHADOW ON PLATFORM UNDERNEATH
  if (platforms) {
    const groundY = getGroundUnder(player.x, player.width, bottomY, platforms);
    if (groundY !== null) {
      const heightAbove = Math.max(0, groundY - bottomY);
      if (heightAbove < 260) {
        // Shadow shrinks and softens as Jiro jumps higher
        const scale = Math.max(0.25, 1 - heightAbove / 280);
        const alpha = Math.max(0.04, 0.3 * (1 - heightAbove / 260));
        // Slight shadow offset to the right due to top-left sun
        const shadowOffsetX = heightAbove * 0.08;

        ctx.save();
        ctx.fillStyle = `rgba(15, 23, 42, ${alpha})`;
        ctx.beginPath();
        ctx.ellipse(centerX + shadowOffsetX, groundY, 16 * scale, 5 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // 2. CHARACTER RENDERING
  ctx.save();
  ctx.translate(centerX, player.y + player.height / 2);

  if (!player.facingRight) {
    ctx.scale(-1, 1);
  }

  const speedRatio = Math.min(1, Math.abs(player.vx) / player.maxSpeed);
  player.runFrame += Math.abs(player.vx) * 0.16;

  // Subtle character tilt: lean forward while running, dynamic tilt while airborne
  if (player.isGrounded && Math.abs(player.vx) > 1) {
    ctx.rotate(0.08 + speedRatio * 0.06);
  } else if (!player.isGrounded) {
    ctx.rotate(player.vy * 0.025);
  }

  // Torso vertical bobbing
  const bobY = player.isGrounded ? Math.sin(player.runFrame * 2) * (1.8 * speedRatio) : 0;
  const time = performance.now() * 0.005;

  // ----------------------------------------------------
  // A. BACK ARM (FAR ARM) - Drawn behind torso
  // ----------------------------------------------------
  ctx.save();
  let backArmAngle = 0;
  if (!player.isGrounded) {
    // Airborne: back arm stretched back for balance/thrust
    backArmAngle = player.vy < 0 ? -0.8 : -0.3;
  } else if (Math.abs(player.vx) > 0.5) {
    // Running: swings in opposition to front leg
    backArmAngle = -Math.sin(player.runFrame) * (0.8 + speedRatio * 0.3);
  } else {
    // Idle breath
    backArmAngle = Math.sin(time) * 0.08;
  }

  ctx.translate(-2, 1 + bobY);
  ctx.rotate(backArmAngle);

  // Far arm sleeve (darker orange for depth)
  ctx.fillStyle = '#cc5200';
  drawRoundRect(ctx, -3, 0, 6, 12, 3);
  ctx.fill();

  // Far hand / glove
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.arc(0, 13, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ----------------------------------------------------
  // B. BACK LEG (FAR LEG) - Drawn behind torso
  // ----------------------------------------------------
  ctx.save();
  let backLegAngle = 0;
  let backFootY = 16;
  let backFootX = -6;

  if (!player.isGrounded) {
    // Airborne jump pose: trailing leg bent back
    backLegAngle = -0.5;
    backFootX = -10;
    backFootY = 14;
  } else if (Math.abs(player.vx) > 0.5) {
    // Running stride (opposite phase)
    backLegAngle = -Math.sin(player.runFrame) * (0.75 + speedRatio * 0.35);
    backFootX = -Math.sin(player.runFrame) * (11 * speedRatio);
    backFootY = 16 - Math.abs(Math.cos(player.runFrame)) * 6;
  }

  // Far thigh / athletic pants (darker navy)
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, backFootX - 3, 6 + bobY, 6, 9, 2);
  ctx.fill();

  // Far Sneaker (deep crimson with white sole)
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.ellipse(backFootX, backFootY + bobY, 6.5, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // White sole
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(backFootX - 5, backFootY + bobY + 1.8, 10, 2.5);
  ctx.restore();

  // ----------------------------------------------------
  // C. TORSO / SPORTY ADVENTURER JACKET
  // ----------------------------------------------------
  ctx.save();
  ctx.translate(0, bobY);

  // Jacket main body with 3D cylindrical lighting (sunlit left, shaded right)
  const jacketGrad = ctx.createLinearGradient(-8, 0, 8, 0);
  jacketGrad.addColorStop(0, '#ff9e3b');
  jacketGrad.addColorStop(0.35, '#ff7700');
  jacketGrad.addColorStop(1, '#c44800');
  ctx.fillStyle = jacketGrad;

  // Tapered athletic vest
  ctx.beginPath();
  ctx.moveTo(-6, -4);
  ctx.lineTo(6, -4);
  ctx.lineTo(5.5, 8);
  ctx.lineTo(-5.5, 8);
  ctx.closePath();
  ctx.fill();

  // Cream/Gold Inner Undershirt & Zip Lapel
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.moveTo(-2, -4);
  ctx.lineTo(2, -4);
  ctx.lineTo(1, 4);
  ctx.lineTo(-1, 4);
  ctx.closePath();
  ctx.fill();

  // Golden Zipper Pull
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(-1, 3, 2, 3);

  // Sporty Utility Belt
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-6, 7.5, 12, 2.5);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-1.5, 7, 3, 3.5);

  ctx.restore();

  // ----------------------------------------------------
  // D. FRONT LEG (NEAR LEG) - In front of torso
  // ----------------------------------------------------
  ctx.save();
  let frontLegAngle = 0;
  let frontFootY = 16;
  let frontFootX = 6;

  if (!player.isGrounded) {
    // Airborne jump pose: front knee tucked forward in heroic leap!
    frontLegAngle = 0.6;
    frontFootX = 7;
    frontFootY = 11;
  } else if (Math.abs(player.vx) > 0.5) {
    // Running stride (front phase)
    frontLegAngle = Math.sin(player.runFrame) * (0.75 + speedRatio * 0.35);
    frontFootX = Math.sin(player.runFrame) * (11 * speedRatio);
    frontFootY = 16 - Math.abs(Math.sin(player.runFrame)) * 6;
  }

  // Front athletic shorts/pants (bright navy)
  ctx.fillStyle = '#334155';
  drawRoundRect(ctx, frontFootX - 3.5, 6 + bobY, 7, 9, 2);
  ctx.fill();

  // Front Sneaker (vibrant racing red with white sole and black grip)
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.ellipse(frontFootX, frontFootY + bobY, 7.5, 4.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sneaker toe highlight
  ctx.fillStyle = '#fca5a5';
  ctx.beginPath();
  ctx.arc(frontFootX + 3, frontFootY + bobY - 1, 2, 0, Math.PI * 2);
  ctx.fill();

  // White rubber sole
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(frontFootX - 6, frontFootY + bobY + 1.8, 12, 2.8);
  ctx.restore();

  // ----------------------------------------------------
  // E. HEAD & FACE - Distinct slightly-oval head
  // ----------------------------------------------------
  ctx.save();
  const headY = -12 + bobY;
  ctx.translate(0, headY);

  // 1. Dynamic Headband Ribbons (flowing backwards from behind the head)
  const ribbonWave = Math.sin(time * 8) * (3 + speedRatio * 4);
  const ribbonLen = 18 + speedRatio * 18;

  // Ribbon trail gradient
  const ribGrad = ctx.createLinearGradient(-10, 0, -10 - ribbonLen, 0);
  ribGrad.addColorStop(0, '#00d2ff');
  ribGrad.addColorStop(1, '#0077b6');
  ctx.fillStyle = ribGrad;

  // Upper ribbon
  ctx.beginPath();
  ctx.moveTo(-8, -4);
  ctx.quadraticCurveTo(-14 - speedRatio * 10, -8 + ribbonWave, -8 - ribbonLen, -6 + ribbonWave * 1.3);
  ctx.lineTo(-6 - ribbonLen, -2 + ribbonWave * 1.3);
  ctx.quadraticCurveTo(-12 - speedRatio * 8, -3 + ribbonWave, -8, 0);
  ctx.closePath();
  ctx.fill();

  // Lower ribbon
  ctx.beginPath();
  ctx.moveTo(-8, -1);
  ctx.quadraticCurveTo(-14 - speedRatio * 8, 2 - ribbonWave * 0.8, -6 - ribbonLen * 0.85, 4 - ribbonWave);
  ctx.lineTo(-4 - ribbonLen * 0.85, 7 - ribbonWave);
  ctx.quadraticCurveTo(-10 - speedRatio * 6, 4 - ribbonWave * 0.8, -8, 2);
  ctx.closePath();
  ctx.fill();

  // 2. Oval Head with Soft Sunlit Skin Shading
  const skinGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, 12);
  skinGrad.addColorStop(0, '#ffdfc4');
  skinGrad.addColorStop(0.55, '#fec9a1');
  skinGrad.addColorStop(1, '#e29a6b');
  ctx.fillStyle = skinGrad;

  ctx.beginPath();
  // Slightly oval head: width 22, height 20
  ctx.ellipse(0, 0, 11, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3. Swept Adventurer Hair tufts on top/back
  ctx.fillStyle = '#804000';
  ctx.beginPath();
  ctx.moveTo(-8, -5);
  ctx.quadraticCurveTo(-12, -12, -4, -13);
  ctx.quadraticCurveTo(0, -15, 6, -11);
  ctx.quadraticCurveTo(2, -9, 0, -7);
  ctx.closePath();
  ctx.fill();

  // 4. Vibrant Cyan Headband with Gold Star Crest
  const headBandGrad = ctx.createLinearGradient(-11, 0, 11, 0);
  headBandGrad.addColorStop(0, '#0096c7');
  headBandGrad.addColorStop(0.5, '#00b4d8');
  headBandGrad.addColorStop(1, '#48cae4');
  ctx.fillStyle = headBandGrad;
  drawRoundRect(ctx, -11, -7, 22, 6.5, 3);
  ctx.fill();

  // Headband top sunlit highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fillRect(-9, -7, 18, 1.5);

  // Golden Hero Crest / Badge
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(3, -4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(2.2, -4.8, 1, 0, Math.PI * 2);
  ctx.fill();

  // 5. Expressive Anime Cartoon Eye
  // White sclera
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(4.5, 1, 5, 6, 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Glossy iris & pupil
  const eyeGrad = ctx.createLinearGradient(3, -2, 7, 5);
  eyeGrad.addColorStop(0, '#0284c7');
  eyeGrad.addColorStop(0.5, '#0369a1');
  eyeGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = eyeGrad;
  ctx.beginPath();
  ctx.ellipse(5.5, 1, 3.2, 4.5, 0.05, 0, Math.PI * 2);
  ctx.fill();

  // Dual specular glints
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(4.8, -1, 1.6, 0, Math.PI * 2);
  ctx.arc(6.8, 2.5, 1, 0, Math.PI * 2);
  ctx.fill();

  // Determined eyebrow
  ctx.strokeStyle = '#5a2500';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(1.5, -4.5);
  ctx.lineTo(8, -3.8);
  ctx.stroke();

  // 6. Confident Hero Smile
  ctx.strokeStyle = '#7c2d12';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(3.5, 5, 3.2, 0.2, Math.PI * 0.8);
  ctx.stroke();

  // Cute cheek blush
  ctx.fillStyle = 'rgba(248, 113, 113, 0.42)';
  ctx.beginPath();
  ctx.ellipse(1, 4.5, 3.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // ----------------------------------------------------
  // F. FRONT ARM (NEAR ARM) - In front of torso
  // ----------------------------------------------------
  ctx.save();
  let frontArmAngle = 0;
  if (!player.isGrounded) {
    // Airborne: front arm raised forward & up in heroic leap!
    frontArmAngle = player.vy < 0 ? 1.0 : 0.4;
  } else if (Math.abs(player.vx) > 0.5) {
    // Running: swings forward
    frontArmAngle = Math.sin(player.runFrame) * (0.8 + speedRatio * 0.3);
  } else {
    // Idle breath
    frontArmAngle = -Math.sin(time) * 0.08;
  }

  ctx.translate(1, 1 + bobY);
  ctx.rotate(frontArmAngle);

  // Near sleeve (bright orange with sunlit highlight)
  const armGrad = ctx.createLinearGradient(-3, 0, 3, 0);
  armGrad.addColorStop(0, '#ff9e3b');
  armGrad.addColorStop(1, '#ff6a00');
  ctx.fillStyle = armGrad;
  drawRoundRect(ctx, -3, 0, 6, 12, 3);
  ctx.fill();

  // White cuff
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-3, 10, 6, 2);

  // Near hand / clenched glove
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 13.5, 3.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.15)';
  ctx.beginPath();
  ctx.arc(0.5, 14.5, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  ctx.restore();

  // Active Power-Up Visual Auras on Jiro
  const charCenterY = player.y + player.height / 2;

  // 1. Shield Energy Forcefield Bubble
  if (player.shield) {
    const sTime = performance.now() * 0.004;
    const pulse = Math.sin(sTime * 4) * 2;
    const sRadius = 26 + pulse;

    ctx.save();
    ctx.translate(centerX, charCenterY);

    const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, sRadius + 8);
    glow.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
    glow.addColorStop(0.7, 'rgba(14, 165, 233, 0.35)');
    glow.addColorStop(1, 'rgba(2, 132, 199, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, sRadius + 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.beginPath();
    ctx.arc(0, 0, sRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.save();
    ctx.rotate(sTime * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, sRadius + 4, (sRadius + 4) * 0.36, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sRadius + 4, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // 2. Coin Magnet Flux Aura
  if (player.coinMagnetTimer > 0) {
    const mTime = performance.now() * 0.005;
    ctx.save();
    ctx.translate(centerX, charCenterY);
    const mPulse = Math.sin(mTime * 5) * 3;
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, 30 + mPulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

export function renderParticles(ctx: CanvasRenderingContext2D, camX: number, particles: Particle[]) {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - camX, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

export function drawHUD(
  ctx: CanvasRenderingContext2D,
  player: Player,
  notifications?: GameNotification[],
  boss?: Boss,
  activeBiome?: ActiveBiomeBlend
) {
  ctx.save();
  const padding = 16;
  const topY = 16;

  const drawPill = (x: number, y: number, w: number, h: number, icon: string, label: string, val: string) => {
    // Soft ambient shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    drawRoundRect(ctx, x, y + 2, w, h, h / 2);
    ctx.fill();

    // Dark glass pill with subtle vertical gradient
    const pillGrad = ctx.createLinearGradient(x, y, x, y + h);
    pillGrad.addColorStop(0, 'rgba(30, 41, 59, 0.92)');
    pillGrad.addColorStop(1, 'rgba(15, 23, 42, 0.96)');
    ctx.fillStyle = pillGrad;
    drawRoundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();

    // Subtle glass highlight on upper rim
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    drawRoundRect(ctx, x + 1, y + 1, w - 2, h / 2, [h / 2, h / 2, 0, 0]);
    ctx.fill();

    // Top highlight rim
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.2;
    drawRoundRect(ctx, x, y, w, h, h / 2);
    ctx.stroke();

    ctx.font = '16px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, x + 8, y + h / 2);

    ctx.font = 'bold 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(label, x + 30, y + h / 2 - 5);

    ctx.font = 'bold 13.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(val, x + 30, y + h / 2 + 7);
  };

  // 1. SCORE
  drawPill(padding, topY, 115, 38, '🏆', 'SCORE', player.score.toLocaleString());

  // 2. DISTANCE
  drawPill(padding + 122, topY, 115, 38, '🏃', 'DISTANCE', `${Math.floor(player.distance)}m`);

  // 3. COINS
  drawPill(padding + 244, topY, 95, 38, '🪙', 'COINS', `${player.coins}`);

  // 4. LIVES (5 hearts)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  drawRoundRect(ctx, padding + 346, topY + 2, 130, 38, 19);
  ctx.fill();

  const livesGrad = ctx.createLinearGradient(padding + 346, topY, padding + 346, topY + 38);
  livesGrad.addColorStop(0, 'rgba(30, 41, 59, 0.92)');
  livesGrad.addColorStop(1, 'rgba(15, 23, 42, 0.96)');
  ctx.fillStyle = livesGrad;
  drawRoundRect(ctx, padding + 346, topY, 130, 38, 19);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1.2;
  drawRoundRect(ctx, padding + 346, topY, 130, 38, 19);
  ctx.stroke();

  ctx.font = '14px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let hearts = '';
  for (let i = 0; i < 5; i++) {
    hearts += i < player.lives ? '❤️' : '🖤';
  }
  ctx.fillText(hearts, padding + 355, topY + 19);

  // 5. CURRENT LOCATION / BIOME PILL
  const bKey = activeBiome?.primary || 'meadow';
  const biomeMeta: Record<BiomeType, { icon: string; name: string; color: string }> = {
    meadow: { icon: '🌿', name: 'Meadow', color: '#4ade80' },
    coastal: { icon: '🌊', name: 'Ocean', color: '#38bdf8' },
    cave: { icon: '💎', name: 'Cave', color: '#c084fc' },
    mountain: { icon: '⛰️', name: 'Mountain', color: '#e2e8f0' },
    forest: { icon: '🌲', name: 'Forest', color: '#22c55e' },
    temple: { icon: '🏛️', name: 'Temple', color: '#f59e0b' },
    volcano: { icon: '🌋', name: 'Volcano', color: '#ef4444' }
  };
  const bInfo = biomeMeta[bKey] || biomeMeta.meadow;
  drawPill(GAME_W - padding - 245, topY, 122, 38, bInfo.icon, 'LOCATION', bInfo.name);

  // 6. TIME
  const mins = Math.floor(player.timeElapsed / 60);
  const secs = Math.floor(player.timeElapsed % 60);
  const ms = Math.floor((player.timeElapsed % 1) * 10);
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  drawPill(GAME_W - padding - 115, topY, 115, 38, '⏱️', 'TIME', timeStr);

  // --- BOSS ENCOUNTER NOTIFIER & ESCAPE HUD ---
  if (boss && boss.active) {
    const time = performance.now() * 0.005;

    if (boss.state === 'warning') {
      // Boss Approaching Banner
      const flash = Math.sin(time * 8) > 0;
      const bW = 380;
      const bH = 40;
      const bX = GAME_W / 2 - bW / 2;
      const bY = 62;

      ctx.fillStyle = flash ? 'rgba(239, 68, 68, 0.92)' : 'rgba(15, 23, 42, 0.92)';
      drawRoundRect(ctx, bX, bY, bW, bH, 10);
      ctx.fill();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = flash ? '#ffffff' : '#fde047';
      ctx.fillText('⚠️ WARNING: GORGONX APPROACHING! ⚠️', GAME_W / 2, bY + bH / 2);
    } else if (boss.state === 'chasing') {
      // Boss Chasing Escape Bar
      const bW = 420;
      const bH = 48;
      const bX = GAME_W / 2 - bW / 2;
      const bY = 62;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      drawRoundRect(ctx, bX, bY, bW, bH, 12);
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Boss name & HP
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f87171';
      ctx.fillText(`BOSS: ${boss.name}`, bX + 14, bY + 16);

      // HP crystals
      let hpStr = '';
      for (let i = 0; i < boss.maxHealth; i++) {
        hpStr += i < boss.health ? '💎' : '⚪';
      }
      ctx.font = '14px sans-serif';
      ctx.fillText(hpStr, bX + 160, bY + 16);

      // Escape progress
      const escapeRatio = Math.min(1, Math.max(0, boss.chaseDistance / boss.escapeGoal));
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`ESCAPE: ${Math.floor(boss.chaseDistance)}m / ${boss.escapeGoal}m`, bX + bW - 14, bY + 16);

      // Progress bar track
      const barW = bW - 28;
      const barH = 8;
      const barX = bX + 14;
      const barY = bY + 30;

      ctx.fillStyle = '#1e293b';
      drawRoundRect(ctx, barX, barY, barW, barH, 4);
      ctx.fill();

      // Progress bar fill
      if (escapeRatio > 0) {
        const barGrad = ctx.createLinearGradient(barX, 0, barX + barW * escapeRatio, 0);
        barGrad.addColorStop(0, '#22c55e');
        barGrad.addColorStop(1, '#38bdf8');
        ctx.fillStyle = barGrad;
        drawRoundRect(ctx, barX, barY, Math.max(8, barW * escapeRatio), barH, 4);
        ctx.fill();
      }
    }
  }

  // --- POWER STATUS INDICATORS ---
  const activePowers: Array<{ name: string; icon: string; color: string; bg: string; border: string; ratio: number; timeText: string }> = [];
  if (player.speedBoostTimer > 0) {
    activePowers.push({
      name: 'SPEED BOOST',
      icon: '⚡',
      color: '#facc15',
      bg: 'rgba(234, 179, 8, 0.25)',
      border: '#eab308',
      ratio: Math.min(1, player.speedBoostTimer / 7.0),
      timeText: `${player.speedBoostTimer.toFixed(1)}s`
    });
  }
  if (player.shield) {
    activePowers.push({
      name: 'SHIELD',
      icon: '🛡️',
      color: '#38bdf8',
      bg: 'rgba(14, 165, 233, 0.25)',
      border: '#0ea5e9',
      ratio: 1.0,
      timeText: '1-HIT'
    });
  }
  if (player.coinMagnetTimer > 0) {
    activePowers.push({
      name: 'MAGNET',
      icon: '🧲',
      color: '#c084fc',
      bg: 'rgba(168, 85, 247, 0.25)',
      border: '#a855f7',
      ratio: Math.min(1, player.coinMagnetTimer / 8.0),
      timeText: `${player.coinMagnetTimer.toFixed(1)}s`
    });
  }
  if (player.superJumpTimer > 0) {
    activePowers.push({
      name: 'SUPER JUMP',
      icon: '🔥',
      color: '#fb923c',
      bg: 'rgba(249, 115, 22, 0.25)',
      border: '#f97316',
      ratio: Math.min(1, player.superJumpTimer / 7.0),
      timeText: `${player.superJumpTimer.toFixed(1)}s`
    });
  }

  if (activePowers.length > 0) {
    const startY = (boss && boss.active) ? 118 : 62;
    let curX = padding;
    activePowers.forEach(pow => {
      const pillW = 142;
      const pillH = 28;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      drawRoundRect(ctx, curX, startY, pillW, pillH, 8);
      ctx.fill();
      ctx.strokeStyle = pow.border;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (pow.ratio > 0 && pow.ratio < 1) {
        ctx.fillStyle = pow.bg;
        drawRoundRect(ctx, curX + 2, startY + 2, (pillW - 4) * pow.ratio, pillH - 4, 6);
        ctx.fill();
      }

      ctx.font = '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(pow.icon, curX + 7, startY + pillH / 2);

      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillStyle = pow.color;
      ctx.fillText(pow.name, curX + 26, startY + pillH / 2 - 4);

      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText(pow.timeText, curX + pillW - 7, startY + pillH / 2);

      curX += pillW + 8;
    });
  }

  // --- FLOATING NOTIFICATION BANNERS ---
  if (notifications && notifications.length > 0) {
    notifications.forEach(notif => {
      const alpha = Math.min(1, notif.timer / 0.3);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';

      const badgeW = 280;
      const badgeH = notif.subtext ? 50 : 38;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      drawRoundRect(ctx, GAME_W / 2 - badgeW / 2, notif.y - badgeH / 2, badgeW, badgeH, 12);
      ctx.fill();
      ctx.strokeStyle = notif.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.shadowColor = notif.color;
      ctx.shadowBlur = 10;
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillStyle = notif.color;
      ctx.fillText(notif.text, GAME_W / 2, notif.subtext ? notif.y - 6 : notif.y + 1);

      if (notif.subtext) {
        ctx.shadowBlur = 0;
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(notif.subtext, GAME_W / 2, notif.y + 14);
      }

      ctx.restore();
    });
  }

  ctx.restore();
}

function drawButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  bgColor: string
) {
  ctx.save();
  // Soft ambient button drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  drawRoundRect(ctx, x, y + 4, w, h, 10);
  ctx.fill();

  // Button background with subtle vertical gradient
  const btnGrad = ctx.createLinearGradient(x, y, x, y + h);
  btnGrad.addColorStop(0, bgColor);
  btnGrad.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
  ctx.fillStyle = bgColor;
  drawRoundRect(ctx, x, y, w, h, 10);
  ctx.fill();

  ctx.fillStyle = btnGrad;
  drawRoundRect(ctx, x, y, w, h, 10);
  ctx.fill();

  // Subtle glass highlight on upper half
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  drawRoundRect(ctx, x + 1, y + 1, w - 2, Math.floor(h * 0.48), [9, 9, 0, 0]);
  ctx.fill();

  // Crisp fine border rim
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 1.2;
  drawRoundRect(ctx, x, y, w, h, 10);
  ctx.stroke();

  // Button text with subtle text shadow
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x + w / 2, y + h / 2);
  ctx.restore();
}

export function drawStartScreen(ctx: CanvasRenderingContext2D, runStats?: RunStats, coinBalance: number = 0) {
  ctx.fillStyle = 'rgba(10, 16, 30, 0.84)';
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  ctx.save();
  ctx.textAlign = 'center';

  const titleBob = Math.sin(performance.now() * 0.003) * 5;
  ctx.font = '900 46px system-ui, -apple-system, sans-serif';

  ctx.fillStyle = '#0f172a';
  ctx.fillText('JIRO: SPEED ADVENTURE', GAME_W / 2, 112 + titleBob);

  ctx.fillStyle = '#ff9f1c';
  ctx.fillText('JIRO: SPEED ADVENTURE', GAME_W / 2, 108 + titleBob);

  ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('FAST-PACED ENDLESS PLATFORMER • PROCEDURAL EXPANSION', GAME_W / 2, 142);

  // Mascot Jiro Preview on Title Screen - polished heroic vector mascot
  const mx = GAME_W / 2;
  const my = 205 + titleBob * 0.5;
  const time = performance.now() * 0.005;
  ctx.save();
  ctx.translate(mx, my);
  ctx.scale(1.7, 1.7);

  // Soft shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 20, 15, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dynamic Headband Ribbons trailing behind
  const ribWave = Math.sin(time * 5) * 3;
  const ribGrad = ctx.createLinearGradient(-8, 0, -28, 0);
  ribGrad.addColorStop(0, '#00d2ff');
  ribGrad.addColorStop(1, '#0077b6');
  ctx.fillStyle = ribGrad;
  ctx.beginPath();
  ctx.moveTo(-7, -13);
  ctx.quadraticCurveTo(-15, -16 + ribWave, -26, -14 + ribWave * 1.2);
  ctx.lineTo(-24, -10 + ribWave * 1.2);
  ctx.quadraticCurveTo(-14, -12 + ribWave, -7, -9);
  ctx.closePath();
  ctx.fill();

  // Far Arm
  ctx.fillStyle = '#cc5200';
  drawRoundRect(ctx, -10, 0, 5, 11, 2.5);
  ctx.fill();
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.arc(-7.5, 12, 3, 0, Math.PI * 2);
  ctx.fill();

  // Far Leg & Shoe
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, -7, 7, 5, 8, 2);
  ctx.fill();
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.ellipse(-4.5, 16, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-8.5, 17.5, 9, 2.2);

  // Torso / Sporty Vest with Gradient
  const vestGrad = ctx.createLinearGradient(-6, 0, 6, 0);
  vestGrad.addColorStop(0, '#ff9e3b');
  vestGrad.addColorStop(0.4, '#ff7700');
  vestGrad.addColorStop(1, '#c44800');
  ctx.fillStyle = vestGrad;
  ctx.beginPath();
  ctx.moveTo(-5.5, -3);
  ctx.lineTo(5.5, -3);
  ctx.lineTo(5, 8);
  ctx.lineTo(-5, 8);
  ctx.closePath();
  ctx.fill();

  // Vest zipper lapel & gold pull
  ctx.fillStyle = '#fff3c4';
  ctx.fillRect(-1.5, -3, 3, 7);
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(-1, 4, 2, 3);

  // Utility Belt
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-5.5, 7, 11, 2.5);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-1.5, 6.5, 3, 3);

  // Near Leg & Shoe
  ctx.fillStyle = '#334155';
  drawRoundRect(ctx, 2, 7, 5.5, 8, 2);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.ellipse(4.5, 16, 6.5, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fca5a5';
  ctx.beginPath();
  ctx.arc(6.5, 15, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 17.5, 10, 2.2);

  // Head with Soft Radial Gradient Shading
  const skinGrad = ctx.createRadialGradient(-2, -12, 2, 0, -9, 11);
  skinGrad.addColorStop(0, '#ffdfc4');
  skinGrad.addColorStop(0.6, '#fec9a1');
  skinGrad.addColorStop(1, '#e29a6b');
  ctx.fillStyle = skinGrad;
  ctx.beginPath();
  ctx.ellipse(0, -9, 10, 9.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Swept Hair Tufts
  ctx.fillStyle = '#804000';
  ctx.beginPath();
  ctx.moveTo(-7, -14);
  ctx.quadraticCurveTo(-11, -20, -3, -20);
  ctx.quadraticCurveTo(1, -22, 6, -18);
  ctx.quadraticCurveTo(2, -16, 0, -14);
  ctx.closePath();
  ctx.fill();

  // Vibrant Cyan Headband with Gold Crest
  const hbGrad = ctx.createLinearGradient(-10, 0, 10, 0);
  hbGrad.addColorStop(0, '#0096c7');
  hbGrad.addColorStop(0.5, '#00b4d8');
  hbGrad.addColorStop(1, '#48cae4');
  ctx.fillStyle = hbGrad;
  drawRoundRect(ctx, -10, -15, 20, 6, 2.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillRect(-8, -15, 16, 1.5);
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(3, -12, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(2.2, -12.8, 0.9, 0, Math.PI * 2);
  ctx.fill();

  // Expressive Anime Eye
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(4, -7.5, 4.5, 5.5, 0.06, 0, Math.PI * 2);
  ctx.fill();

  const eyeGrad = ctx.createLinearGradient(2, -10, 6, -4);
  eyeGrad.addColorStop(0, '#0284c7');
  eyeGrad.addColorStop(0.6, '#0369a1');
  eyeGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = eyeGrad;
  ctx.beginPath();
  ctx.ellipse(5, -7.5, 3, 4.2, 0.05, 0, Math.PI * 2);
  ctx.fill();

  // Eye Specular Glints
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(4.2, -9.2, 1.4, 0, Math.PI * 2);
  ctx.arc(6, -6, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Eyebrow
  ctx.strokeStyle = '#5a2500';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(1.5, -12.5);
  ctx.lineTo(7.5, -12);
  ctx.stroke();

  // Cheek Blush & Smile
  ctx.fillStyle = 'rgba(248, 113, 113, 0.4)';
  ctx.beginPath();
  ctx.ellipse(1, -4.5, 3, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#7c2d12';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(3, -3.5, 2.8, 0.2, Math.PI * 0.8);
  ctx.stroke();

  // Near Arm & Glove
  const nearArmGrad = ctx.createLinearGradient(-3, 0, 3, 0);
  nearArmGrad.addColorStop(0, '#ff9e3b');
  nearArmGrad.addColorStop(1, '#ff6a00');
  ctx.fillStyle = nearArmGrad;
  drawRoundRect(ctx, 4, 0, 5, 11, 2.5);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(4, 9, 5, 1.8);
  ctx.beginPath();
  ctx.arc(6.5, 12, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Best Records & Coin Balance Pill
  const sW = 540;
  const sH = 34;
  const sX = GAME_W / 2 - sW / 2;
  const sY = 254;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  drawRoundRect(ctx, sX, sY, sW, sH, 10);
  ctx.fill();
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const bestDist = runStats ? runStats.bestDistance : 0;
  const bestScore = runStats ? runStats.bestScore : 0;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = '#fde047';
  ctx.fillText(
    `★ BEST: ${bestDist.toLocaleString()}m   •   HIGH SCORE: ${bestScore.toLocaleString()}   •   🪙 BANK: ${coinBalance.toLocaleString()}`,
    GAME_W / 2,
    sY + sH / 2 + 1
  );

  // 4 Navigation Buttons
  drawButton(ctx, GAME_W / 2 - 130, 304, 260, 46, '▶ START RUN', '#22c55e');
  drawButton(ctx, GAME_W / 2 - 130, 356, 260, 42, '🛒 UPGRADE SHOP', '#f59e0b');
  drawButton(ctx, GAME_W / 2 - 130, 404, 260, 42, '📖 HOW TO PLAY', '#3b82f6');
  drawButton(ctx, GAME_W / 2 - 130, 452, 260, 40, '⚙️ SETTINGS', '#6366f1');

  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Press [Space] to quick-start • Arrow Keys or Touch/Swipe to run and jump', GAME_W / 2, 516);
  ctx.restore();
}

export function drawShopScreen(
  ctx: CanvasRenderingContext2D,
  coinBalance: number,
  upgrades: PlayerUpgrades,
  message?: string
) {
  ctx.fillStyle = 'rgba(10, 16, 30, 0.94)';
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  ctx.save();
  ctx.textAlign = 'center';

  // Header
  ctx.font = '900 36px system-ui, sans-serif';
  ctx.fillStyle = '#facc15';
  ctx.fillText('UPGRADE SHOP', GAME_W / 2, 54);

  ctx.font = '500 13px system-ui, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('Spend run coins to permanently boost Jiro\'s capabilities', GAME_W / 2, 76);

  // Coin Balance Banner
  const bW = 240;
  const bH = 34;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  drawRoundRect(ctx, GAME_W / 2 - bW / 2, 88, bW, bH, 10);
  ctx.fill();
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = '#fde047';
  ctx.fillText(`🪙 COINS: ${coinBalance.toLocaleString()}`, GAME_W / 2, 105);

  const costs: Record<keyof PlayerUpgrades, number[]> = {
    speed: [100, 250, 500, 800],
    jump: [100, 250, 500, 800],
    magnet: [150, 300, 600, 900],
    shield: [200, 400, 750, 1000]
  };

  const items: Array<{
    key: keyof PlayerUpgrades;
    icon: string;
    title: string;
    desc: string;
    color: string;
  }> = [
    {
      key: 'speed',
      icon: '⚡',
      title: 'SPEED ACCELERATOR',
      desc: '+5% Max run velocity per tier. Smoother sprint response.',
      color: '#facc15'
    },
    {
      key: 'jump',
      icon: '🔥',
      title: 'SUPER SPRING JUMP',
      desc: '+3.5% Jump force per tier. Reach higher floating platforms.',
      color: '#fb923c'
    },
    {
      key: 'magnet',
      icon: '🧲',
      title: 'COIN MAGNET RADIUS',
      desc: '+35px pull distance & +1.0s power-up duration per tier.',
      color: '#c084fc'
    },
    {
      key: 'shield',
      icon: '🛡️',
      title: 'SHIELD GENERATOR',
      desc: 'Tier 1+ spawns a free Shield each run & extends break immunity.',
      color: '#38bdf8'
    }
  ];

  items.forEach((it, idx) => {
    const cardY = 136 + idx * 76;
    const cardW = 760;
    const cardH = 68;
    const cardX = GAME_W / 2 - cardW / 2;

    const level = upgrades[it.key];
    const isMax = level >= 4;
    const cost = isMax ? 0 : costs[it.key][level];
    const canAfford = !isMax && coinBalance >= cost;

    // Card background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = it.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Icon box
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    drawRoundRect(ctx, cardX + 12, cardY + 10, 48, 48, 10);
    ctx.fill();
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(it.icon, cardX + 36, cardY + 34);

    // Title and Description
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = it.color;
    ctx.fillText(it.title, cardX + 70, cardY + 24);

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(it.desc, cardX + 70, cardY + 46);

    // Level Pips
    const pipsX = cardX + 460;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`LVL ${level}/4`, pipsX, cardY + 24);

    for (let p = 0; p < 4; p++) {
      ctx.fillStyle = p < level ? it.color : '#334155';
      drawRoundRect(ctx, pipsX + p * 20, cardY + 34, 16, 12, 3);
      ctx.fill();
    }

    // Upgrade Button
    const btnW = 140;
    const btnH = 42;
    const btnX = cardX + cardW - btnW - 14;
    const btnY = cardY + 13;

    if (isMax) {
      ctx.fillStyle = '#334155';
      drawRoundRect(ctx, btnX, btnY, btnW, btnH, 8);
      ctx.fill();
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('★ MAXED', btnX + btnW / 2, btnY + btnH / 2);
    } else {
      const btnColor = canAfford ? '#22c55e' : '#475569';
      drawButton(ctx, btnX, btnY, btnW, btnH, `🪙 ${cost}`, btnColor);
    }
  });

  if (message) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(message, GAME_W / 2, 452);
  }

  // Back Button
  drawButton(ctx, GAME_W / 2 - 110, 474, 220, 44, '← MAIN MENU', '#64748b');
  ctx.restore();
}

export function drawHowToPlayScreen(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(10, 16, 30, 0.92)';
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  ctx.save();
  ctx.textAlign = 'center';

  ctx.font = '900 34px system-ui, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('HOW TO PLAY & POWER-UPS', GAME_W / 2, 50);

  // Left Column: Controls
  const cW = 410;
  const leftX = 54;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  drawRoundRect(ctx, leftX, 74, cW, 375, 12);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('GAME CONTROLS', leftX + cW / 2, 102);

  const controls = [
    { key: 'A / D  or  ◀ / ▶', desc: 'Move Left / Right' },
    { key: 'SPACE / W / ▲', desc: 'Jump (Hold for higher air)' },
    { key: 'TOUCH BUTTONS', desc: 'On-Screen ◀ ▶ and ▲ Jump' },
    { key: 'SWIPE GESTURES', desc: 'Swipe Left/Right run, Up jump' },
    { key: 'P KEY', desc: 'Pause / Resume Run' },
    { key: 'R KEY', desc: 'Quick Restart on Game Over' }
  ];

  controls.forEach((c, idx) => {
    const rowY = 126 + idx * 48;
    ctx.fillStyle = '#1e293b';
    drawRoundRect(ctx, leftX + 16, rowY, 150, 36, 8);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.stroke();

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.fillText(c.key, leftX + 91, rowY + 22);

    ctx.font = '500 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(c.desc, leftX + 178, rowY + 22);
  });

  // Right Column: Power-Up Guide
  const rightX = GAME_W - 54 - cW;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  drawRoundRect(ctx, rightX, 74, cW, 375, 12);
  ctx.fill();
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#facc15';
  ctx.fillText('POWER-UP GUIDE', rightX + cW / 2, 102);

  const powerups = [
    { icon: '⚡', name: 'SPEED BOOST (7s)', desc: '+60% sprint velocity & acceleration rush.', color: '#facc15' },
    { icon: '🛡️', name: 'SHIELD (1-Hit)', desc: 'Blocks 1 enemy hit with zero lives lost.', color: '#38bdf8' },
    { icon: '❤️', name: 'EXTRA LIFE', desc: '+1 Life (max 5) or +500 Score if already full.', color: '#ef4444' },
    { icon: '🧲', name: 'COIN MAGNET (8s)', desc: 'Pulls every nearby coin straight to Jiro.', color: '#c084fc' },
    { icon: '🔥', name: 'SUPER JUMP (7s)', desc: 'Launches Jiro high to reach sky coin routes.', color: '#fb923c' }
  ];

  powerups.forEach((p, idx) => {
    const rowY = 124 + idx * 60;
    ctx.fillStyle = '#1e293b';
    drawRoundRect(ctx, rightX + 14, rowY, 44, 44, 10);
    ctx.fill();
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.icon, rightX + 36, rowY + 29);

    ctx.textAlign = 'left';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = p.color;
    ctx.fillText(p.name, rightX + 68, rowY + 18);

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(p.desc, rightX + 68, rowY + 36);
  });

  // Back Button
  drawButton(ctx, GAME_W / 2 - 110, 468, 220, 44, '← MAIN MENU', '#64748b');
  ctx.restore();
}

export const drawControlsScreen = drawHowToPlayScreen;

export function drawSettingsScreen(
  ctx: CanvasRenderingContext2D,
  soundEnabled: boolean,
  runStats?: RunStats,
  resetConfirm: boolean = false
) {
  ctx.fillStyle = 'rgba(10, 16, 30, 0.92)';
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  ctx.save();
  ctx.textAlign = 'center';

  ctx.font = '900 36px system-ui, sans-serif';
  ctx.fillStyle = '#6366f1';
  ctx.fillText('SETTINGS', GAME_W / 2, 65);

  ctx.font = '500 14px system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Configure audio, screen display, and game data', GAME_W / 2, 95);

  // Settings Cards
  const cW = 520;
  const startY = 130;

  // 1. Audio
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  drawRoundRect(ctx, GAME_W / 2 - cW / 2, startY, cW, 76, 12);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Sound Effects & Audio', GAME_W / 2 - cW / 2 + 24, startY + 32);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Toggle synthesized sound and fanfare', GAME_W / 2 - cW / 2 + 24, startY + 52);

  drawButton(
    ctx,
    GAME_W / 2 + cW / 2 - 170,
    startY + 16,
    146,
    44,
    soundEnabled ? '🔊 ON' : '🔇 MUTED',
    soundEnabled ? '#22c55e' : '#64748b'
  );

  // 2. Fullscreen
  const fsY = startY + 92;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  drawRoundRect(ctx, GAME_W / 2 - cW / 2, fsY, cW, 76, 12);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Display Fullscreen', GAME_W / 2 - cW / 2 + 24, fsY + 32);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Toggle immersive fullscreen on mobile or desktop', GAME_W / 2 - cW / 2 + 24, fsY + 52);

  drawButton(ctx, GAME_W / 2 + cW / 2 - 170, fsY + 16, 146, 44, '⛶ FULLSCREEN', '#f59e0b');

  // 3. Reset Best Records
  const rstY = fsY + 92;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  drawRoundRect(ctx, GAME_W / 2 - cW / 2, rstY, cW, 76, 12);
  ctx.fill();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Reset Best Records', GAME_W / 2 - cW / 2 + 24, rstY + 32);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Clears high score and distance milestones', GAME_W / 2 - cW / 2 + 24, rstY + 52);

  drawButton(
    ctx,
    GAME_W / 2 + cW / 2 - 170,
    rstY + 16,
    146,
    44,
    resetConfirm ? '⚠️ CONFIRM?' : 'RESET DATA',
    resetConfirm ? '#dc2626' : '#ef4444'
  );

  // Back Button
  drawButton(ctx, GAME_W / 2 - 110, 465, 220, 44, '← MAIN MENU', '#64748b');
  ctx.restore();
}

export function drawPauseScreen(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(10, 16, 30, 0.78)';
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  ctx.save();
  ctx.textAlign = 'center';

  ctx.font = '900 44px system-ui, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText('PAUSED', GAME_W / 2, 140);

  drawButton(ctx, GAME_W / 2 - 120, 185, 240, 48, '▶ RESUME', '#22c55e');
  drawButton(ctx, GAME_W / 2 - 120, 245, 240, 44, '📖 HOW TO PLAY', '#3b82f6');
  drawButton(ctx, GAME_W / 2 - 120, 301, 240, 44, '🔄 RESTART', '#f59e0b');
  drawButton(ctx, GAME_W / 2 - 120, 357, 240, 44, '🏠 MAIN MENU', '#64748b');

  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Press [P] to quick resume or [R] to restart', GAME_W / 2, 435);
  ctx.restore();
}

export function drawGameOverScreen(
  ctx: CanvasRenderingContext2D,
  player: Player,
  runStats?: RunStats,
  coinBalance: number = 0
) {
  ctx.fillStyle = 'rgba(15, 5, 10, 0.88)';
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  ctx.save();
  ctx.textAlign = 'center';

  ctx.font = '900 50px system-ui, sans-serif';
  ctx.fillStyle = '#ef4444';
  ctx.fillText('RUN FINISHED', GAME_W / 2, 125);

  const isNewBest = runStats && Math.floor(player.distance) >= runStats.bestDistance && player.distance > 50;

  if (isNewBest) {
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = '#fde047';
    ctx.fillText('★ NEW DISTANCE RECORD! ★', GAME_W / 2, 156);
  }

  // Stats Card
  const cW = 500;
  const cH = 90;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  drawRoundRect(ctx, GAME_W / 2 - cW / 2, 172, cW, cH, 12);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`Distance: ${Math.floor(player.distance).toLocaleString()}m`, GAME_W / 2 - 120, 210);

  ctx.fillStyle = '#fde047';
  ctx.fillText(`Score: ${player.score.toLocaleString()}`, GAME_W / 2 + 120, 210);

  ctx.font = '500 14px system-ui, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(
    `Run Coins: +${player.coins}   •   Total Bank: ${coinBalance.toLocaleString()} 🪙   •   Time: ${Math.floor(player.timeElapsed)}s`,
    GAME_W / 2,
    242
  );

  // 3 Action Buttons
  drawButton(ctx, GAME_W / 2 - 130, 282, 260, 48, '🔄 TRY AGAIN (R)', '#22c55e');
  drawButton(ctx, GAME_W / 2 - 130, 340, 260, 44, '🛒 UPGRADE SHOP', '#f59e0b');
  drawButton(ctx, GAME_W / 2 - 130, 396, 260, 44, '🏠 MAIN MENU', '#64748b');
  ctx.restore();
}

export function drawVictoryScreen(ctx: CanvasRenderingContext2D, player: Player, coinBalance: number = 0) {
  ctx.fillStyle = 'rgba(5, 20, 30, 0.9)';
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  ctx.save();
  ctx.textAlign = 'center';

  const pulse = Math.sin(performance.now() * 0.005) * 4;
  ctx.font = '900 50px system-ui, sans-serif';
  ctx.fillStyle = '#facc15';
  ctx.fillText('STAGE CLEARED!', GAME_W / 2, 120 + pulse);

  ctx.font = '700 18px system-ui, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('Congratulations! Jiro conquered the course!', GAME_W / 2, 160);

  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, GAME_W / 2 - 220, 185, 440, 140, 12);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.stroke();

  const mins = Math.floor(player.timeElapsed / 60);
  const secs = Math.floor(player.timeElapsed % 60);
  const timeStr = `${mins}m ${secs}s`;

  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`Clear Time: ${timeStr}`, GAME_W / 2, 220);
  ctx.fillText(`Coins Collected: +${player.coins} (+${player.coins * 100} pts)`, GAME_W / 2, 252);

  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = '#22c55e';
  ctx.fillText(`TOTAL SCORE: ${player.score.toLocaleString()}`, GAME_W / 2, 296);

  drawButton(ctx, GAME_W / 2 - 130, 345, 260, 48, '★ PLAY AGAIN (R)', '#22c55e');
  drawButton(ctx, GAME_W / 2 - 130, 403, 260, 44, '🛒 UPGRADE SHOP', '#f59e0b');
  drawButton(ctx, GAME_W / 2 - 130, 457, 260, 42, '🏠 MAIN MENU', '#64748b');
  ctx.restore();
}
