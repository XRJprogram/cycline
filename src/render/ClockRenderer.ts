import { Note, JudgeGrade, JudgeResult, CycleEvent } from '../types';

export const FONT_SANS = '"Uiua386", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
export const FONT_NUMS = '"Uiua386", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, Consolas, monospace, sans-serif';

export const COLOR_SKY_BLUE = '#00a8ff';       // 天蓝色 (TAP & HOLD)
export const COLOR_SKY_BLUE_DARK = '#0984e3';  // 蔚蓝
export const COLOR_LIGHT_BLUE = '#7ed6df';     // 淡蓝色 (TOUCH)
export const COLOR_LIGHT_BLUE_CORE = '#e0f7fa';// 淡蓝中心符文
export const COLOR_BLUE_BORDER = '#1e3799';    // 优雅海军蓝边框
export const COLOR_NEEDLE = '#0984e3';         // 湛蓝指针
export const COLOR_BG = '#f4f8fc';             // 柔和冰白背景

interface FlatParticle {
  x: number;
  y: number;
  r: number;
  maxR: number;
  color: string;
  birth: number;
  life: number;
}

export class ClockRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;

  public trackRadius = 150;
  public centerX = 0;
  public centerY = 0;
  public approachTime = 3.0;
  public trackEffectIntensity = 0;
  public currentCycles = 1;
  public currentCycleEvents: CycleEvent[] = [];

  // Frame state tracking for synchronous hit detection & positioning
  public lastSongTime = 0;
  public lastRotationPeriod = 2.0;
  public lastNeedleAngleRad = -Math.PI / 2;
  public lastDensity = 1.0;

  private particles: FlatParticle[] = [];
  private lastFeedback: { grade: JudgeGrade; text: string; subText: string; time: number } | null = null;
  private needlePulse = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context failed');
    this.ctx = ctx;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  public resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);

    this.centerX = this.width / 2;
    this.centerY = this.height / 2 - (this.height > 650 ? 25 : 0);

    const minDim = Math.min(this.width, this.height);
    this.trackRadius = Math.max(110, Math.min(210, minDim * 0.32));
  }

  // TITLE SCENE RENDER: Subtle ambient rhythm waves (NO gameplay clock/track)
  public renderTitle(time: number): void {
    const ctx = this.ctx;
    const cx = this.centerX;
    const cy = this.centerY;

    ctx.save();
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle rhythmic ambient ripples in serene blue tones
    const rippleCount = 3;
    const blueTones = ['#74b9ff', '#0984e3', '#7ed6df'];
    for (let i = 0; i < rippleCount; i++) {
      const phase = ((time * 0.25 + i * (1 / rippleCount)) % 1);
      const r = 70 + phase * 220;
      const alpha = Math.sin(phase * Math.PI) * 0.18;

      ctx.strokeStyle = blueTones[i % blueTones.length];
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Gentle floating rhythmic accent dots
    const dots = 8;
    for (let i = 0; i < dots; i++) {
      const angle = (i / dots) * Math.PI * 2 + time * 0.08;
      const dist = 180 + Math.sin(time * 0.6 + i * 1.5) * 30;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;

      ctx.fillStyle = blueTones[i % blueTones.length];
      ctx.globalAlpha = 0.25 + Math.sin(time * 1.2 + i) * 0.15;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // SELECT SCENE RENDER: Elegant Rotating Arc Wheel Backdrop
  public renderSelect(
    time: number,
    wheelAngleRad: number = 0,
    accentColor: string = COLOR_SKY_BLUE,
    enterOffsetY: number = 0
  ): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, w, h);

    // Center of the large arc wheel (rising seamlessly with DOM cards on entrance)
    const arcCenterX = w / 2;
    const arcCenterY = h + Math.min(w, h) * 0.45 + enterOffsetY;
    const arcRadius = Math.min(w, h) * 0.95;

    ctx.save();
    if (enterOffsetY > 0) {
      const maxOffset = Math.max(650, h * 0.5 + 350);
      const enterAlpha = Math.max(0, Math.min(1, 1 - enterOffsetY / maxOffset));
      ctx.globalAlpha = enterAlpha;
    }
    ctx.translate(arcCenterX, arcCenterY);

    // Soft horizontal fade gradients so the slide rails fade out toward screen edges,
    // exactly matching the opacity decay of the distant song cards
    const mainRailGrad = ctx.createLinearGradient(-w * 0.42, 0, w * 0.42, 0);
    mainRailGrad.addColorStop(0, 'rgba(30, 55, 153, 0)');
    mainRailGrad.addColorStop(0.2, 'rgba(30, 55, 153, 0.15)');
    mainRailGrad.addColorStop(0.38, 'rgba(30, 55, 153, 0.55)');
    mainRailGrad.addColorStop(0.5, COLOR_BLUE_BORDER);
    mainRailGrad.addColorStop(0.62, 'rgba(30, 55, 153, 0.55)');
    mainRailGrad.addColorStop(0.8, 'rgba(30, 55, 153, 0.15)');
    mainRailGrad.addColorStop(1, 'rgba(30, 55, 153, 0)');

    const guideRailGrad = ctx.createLinearGradient(-w * 0.42, 0, w * 0.42, 0);
    guideRailGrad.addColorStop(0, 'rgba(30, 55, 153, 0)');
    guideRailGrad.addColorStop(0.25, 'rgba(30, 55, 153, 0.02)');
    guideRailGrad.addColorStop(0.5, 'rgba(30, 55, 153, 0.08)');
    guideRailGrad.addColorStop(0.75, 'rgba(30, 55, 153, 0.02)');
    guideRailGrad.addColorStop(1, 'rgba(30, 55, 153, 0)');

    // 1. Concentric orbital guidelines in gentle slate blue with edge fade
    const ringRadii = [arcRadius - 120, arcRadius - 50, arcRadius, arcRadius + 50, arcRadius + 120];
    for (let i = 0; i < ringRadii.length; i++) {
      const rr = ringRadii[i];
      if (rr <= 0) continue;
      ctx.strokeStyle = i === 2 ? mainRailGrad : guideRailGrad;
      ctx.lineWidth = i === 2 ? 3 : 1.5;
      if (i % 2 === 1) ctx.setLineDash([6, 8]);
      else ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(0, 0, rr, -Math.PI * 0.77, -Math.PI * 0.23);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 2. Rotating dial ticks along the main arc
    const totalTicks = 72;
    for (let i = 0; i < totalTicks; i++) {
      const baseAngle = (i / totalTicks) * Math.PI * 2 + wheelAngleRad;
      const normAngle = ((baseAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const diffFromTop = Math.abs(normAngle - (Math.PI * 1.5));
      if (diffFromTop > 0.84) continue;

      // Soft fade matching cards falloff
      const tickFade = Math.max(0, 1 - (diffFromTop / 0.84) * 1.15);
      const isMajor = i % 6 === 0;
      const inner = isMajor ? arcRadius - 20 : arcRadius - 10;
      const outer = isMajor ? arcRadius + 20 : arcRadius + 10;

      const cos = Math.cos(baseAngle);
      const sin = Math.sin(baseAngle);

      ctx.save();
      ctx.globalAlpha = (enterOffsetY > 0 ? Math.max(0, 1 - enterOffsetY / 180) : 1.0) * tickFade;
      ctx.strokeStyle = isMajor ? accentColor : 'rgba(30, 55, 153, 0.25)';
      ctx.lineWidth = isMajor ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(cos * inner, sin * inner);
      ctx.lineTo(cos * outer, sin * outer);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Focal pointer / apex selector bracket at 12 o'clock of the wheel
    const apexAngle = -Math.PI / 2;
    const apexX = Math.cos(apexAngle) * arcRadius;
    const apexY = Math.sin(apexAngle) * arcRadius;

    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(apexX, apexY, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = COLOR_BLUE_BORDER;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(apexX, apexY, 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    // 4. Subtle ambient floating dust particles in background
    for (let i = 0; i < 6; i++) {
      const px = (w * 0.15 + (i * 173 + time * 15) % (w * 0.7));
      const py = (h * 0.2 + (Math.sin(time * 0.5 + i) * 60));
      ctx.fillStyle = accentColor;
      ctx.globalAlpha = 0.15 + Math.sin(time + i) * 0.08;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // RESULT SCENE RENDER: Clean flat background
  public renderResult(_time: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  // GAMEPLAY FINISH ANIMATION: Celebratory track clear sequence
  public renderFinishAnimation(
    _time: number,
    progress: number,
    combo: number,
    score: number
  ): void {
    const ctx = this.ctx;
    const cx = this.centerX;
    const cy = this.centerY;
    const baseR = this.trackRadius;

    ctx.save();
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, this.width, this.height);

    // 1. Expanding luminous ripples
    for (let i = 0; i < 3; i++) {
      const p = Math.max(0, Math.min(1, progress * 1.3 - i * 0.2));
      if (p > 0) {
        const rippleR = baseR * (0.4 + p * 1.1);
        const alpha = (1 - p) * 0.45;
        ctx.strokeStyle = i === 0 ? '#00a8ff' : (i === 1 ? '#7ed6df' : '#1e3799');
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 3 - p * 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, rippleR, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 2. Base orbit ring with glowing pulse
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = COLOR_BLUE_BORDER;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Decelerating needle sweep
    const decel = 1 - Math.pow(1 - Math.min(1, progress * 1.2), 3);
    const needleAngle = this.lastNeedleAngleRad + decel * 1.2;
    const nx = cx + Math.cos(needleAngle) * (baseR - 10);
    const ny = cy + Math.sin(needleAngle) * (baseR - 10);

    ctx.save();
    ctx.strokeStyle = COLOR_NEEDLE;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    ctx.restore();

    // 4. Center hub
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = COLOR_BLUE_BORDER;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLOR_NEEDLE;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 5. Radiating celebratory sparkle bursts
    const sparkleCount = 20;
    const burstProgress = Math.min(1, progress * 1.4);
    for (let i = 0; i < sparkleCount; i++) {
      const angle = (i / sparkleCount) * Math.PI * 2 + 0.15;
      const speed = 0.8 + (i % 5) * 0.2;
      const dist = (baseR * 0.4 + burstProgress * baseR * 1.2 * speed);
      const px = cx + Math.cos(angle) * dist;
      const py = cy + Math.sin(angle) * dist;
      const alpha = Math.max(0, 1 - burstProgress) * 0.8;
      const size = 3 + (i % 3);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = i % 2 === 0 ? '#00a8ff' : '#f1c40f';
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6. TRACK CLEAR Title Typography (pops in with elastic bounce)
    if (progress > 0.06) {
      const enterP = Math.min(1, (progress - 0.06) / 0.32);
      const scale = 0.65 + 0.35 * Math.sin(enterP * Math.PI * 0.5) + (enterP < 1 ? Math.sin(enterP * Math.PI * 2) * 0.08 : 0);
      const textAlpha = Math.min(1, enterP * 2);

      ctx.save();
      ctx.globalAlpha = textAlpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Title offset slightly above center
      const titleY = cy - baseR * 0.38;

      ctx.font = `900 ${Math.round(42 * scale)}px ${FONT_SANS}`;
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#1e3799';
      ctx.strokeText('TRACK CLEAR', cx, titleY);
      ctx.fillStyle = '#00a8ff';
      ctx.fillText('TRACK CLEAR', cx, titleY);

      // Sub-line: Combo & Score
      if (progress > 0.22) {
        const subAlpha = Math.min(1, (progress - 0.22) / 0.2);
        ctx.globalAlpha = subAlpha;
        ctx.font = `800 16px ${FONT_NUMS}`;
        ctx.fillStyle = '#1e3799';
        ctx.fillText(`MAX COMBO ${combo}   •   ${score.toString().padStart(7, '0')}`, cx, titleY + 44);
      }

      ctx.restore();
    }

    // 7. Smooth fade to result scene near the end
    if (progress > 0.85) {
      const fadeAlpha = (progress - 0.85) / 0.15;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = Math.min(1, fadeAlpha);
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.restore();
  }


  /**
   * Evaluates the dynamic track radius at angle `angleRad`.
   * When intensity is 0 (default / normal parts): returns baseRadius exactly. Track is a pure rock-solid circle!
   * When intensity > 0 (climax / drops): smoothly morphs with a stable Fourier harmonic contour.
   * NO time-based high-frequency shaking or phase oscillations = completely still notes!
   */
  public getTrackRadiusAt(
    angleRad: number,
    _songTime: number = 0,
    baseRadius: number = this.trackRadius,
    intensity: number = this.trackEffectIntensity
  ): number {
    if (intensity <= 0.002) return baseRadius;

    // Stable 4-lobed Fourier harmonic contour with zero high-frequency jitter
    const harmonic =
      0.042 * Math.cos(4 * angleRad) +
      0.020 * Math.sin(2 * angleRad);

    return baseRadius * (1 + harmonic * intensity);
  }

  /**
   * Calculates the exact note visual angle Radian based on linear time displacement and optional density.
   * When density = 1.0 (default): strictly uniform, 1:1 rotation speed.
   * When density changes across sections: upcoming notes expand or compress smoothly with ZERO jitter.
   */
  public getNoteAngleRad(
    targetTime: number,
    songTime: number,
    needleAngleRad: number,
    rotationPeriod: number,
    density: number = 1.0
  ): number {
    const dt = targetTime - songTime;
    return needleAngleRad + (dt / rotationPeriod) * Math.PI * 2 * density;
  }

  /**
   * Returns dynamic positional and visual state for a cycle track.
   * Concentric circles share the center (cx, cy) and differ in size, never overlapping the main orbit.
   * When configured with CycleEvents, the extra cycle floats out smoothly from the main orbit
   * toward its target outer radius and later contracts back when disappearing.
   */
  public getCycleState(
    cycle: number = 0,
    songTime: number = this.lastSongTime,
    baseR: number = this.trackRadius,
    cycleEvents: CycleEvent[] = this.currentCycleEvents,
    totalCycles: number = this.currentCycles
  ): { visible: boolean; radius: number; opacity: number; floatProgress: number } {
    if (cycle === 0) {
      return { visible: true, radius: baseR, opacity: 1.0, floatProgress: 1.0 };
    }

    const defaultOffset = 48 * cycle;
    if (!cycleEvents || cycleEvents.length === 0) {
      if (cycle < totalCycles) {
        return { visible: true, radius: baseR + defaultOffset, opacity: 1.0, floatProgress: 1.0 };
      }
      return { visible: false, radius: baseR, opacity: 0, floatProgress: 0 };
    }

    const events = cycleEvents.filter(e => e.cycle === cycle);
    if (events.length === 0) {
      if (cycle < totalCycles) {
        return { visible: true, radius: baseR + defaultOffset, opacity: 1.0, floatProgress: 1.0 };
      }
      return { visible: false, radius: baseR, opacity: 0, floatProgress: 0 };
    }

    for (const ev of events) {
      const floatDuration = Math.min(1.2, Math.max(0.6, (ev.endTime - ev.startTime) * 0.15));
      const targetOffset = ev.targetRadiusOffset !== undefined ? ev.targetRadiusOffset : defaultOffset;

      if (songTime >= ev.startTime && songTime <= ev.endTime) {
        const timeFromStart = songTime - ev.startTime;
        const timeToEnd = ev.endTime - songTime;

        if (timeFromStart < floatDuration) {
          // 1. Floating out from main cycle toward target orbit
          const p = Math.max(0, Math.min(1, timeFromStart / floatDuration));
          const ease = 1 - Math.pow(1 - p, 3);
          return {
            visible: true,
            radius: baseR + ease * targetOffset,
            opacity: Math.max(0.1, ease),
            floatProgress: ease
          };
        } else if (timeToEnd < floatDuration) {
          // 2. Disappearing back toward main cycle
          const p = Math.max(0, Math.min(1, timeToEnd / floatDuration));
          const ease = 1 - Math.pow(1 - p, 3);
          return {
            visible: true,
            radius: baseR + ease * targetOffset,
            opacity: Math.max(0.05, ease),
            floatProgress: ease
          };
        } else {
          // 3. Fully deployed on outer orbit
          return {
            visible: true,
            radius: baseR + targetOffset,
            opacity: 1.0,
            floatProgress: 1.0
          };
        }
      }
    }

    return { visible: false, radius: baseR, opacity: 0, floatProgress: 0 };
  }

  /**
   * Returns base track radius for a specific cycle (0 = primary orbit, 1 = outer).
   */
  public getTrackRadiusForCycle(
    cycle: number = 0,
    baseR: number = this.trackRadius,
    totalCycles: number = this.currentCycles
  ): number {
    return this.getCycleState(cycle, this.lastSongTime, baseR, this.currentCycleEvents, totalCycles).radius;
  }

  /**
   * Calculates the exact screen coordinates of a note at the current songTime.
   * Takes into account rotation, dynamic density, Fourier contour, and concentric cycle track radius.
   */
  public getNoteCanvasPosition(
    note: Note,
    songTime: number,
    rotationPeriod: number,
    needleAngleRad: number,
    currentDensity: number = 1.0,
    currentCycles: number = this.currentCycles,
    cycleEvents: CycleEvent[] = this.currentCycleEvents
  ): { x: number; y: number; radius: number; angleRad: number } {
    const theta = this.getNoteAngleRad(note.time, songTime, needleAngleRad, rotationPeriod, currentDensity);
    let cycleState = this.getCycleState(note.cycle || 0, songTime, this.trackRadius, cycleEvents, currentCycles);
    if ((note.cycle || 0) > 0 && (!cycleState.visible || cycleState.opacity <= 0.01)) {
      cycleState = { visible: true, radius: this.trackRadius, opacity: 1.0, floatProgress: 0 };
    }
    const noteR = this.getTrackRadiusAt(theta, songTime, cycleState.radius);
    return {
      x: this.centerX + Math.cos(theta) * noteR,
      y: this.centerY + Math.sin(theta) * noteR,
      radius: noteR,
      angleRad: theta
    };
  }

  /**
   * Calculates the exact 0ms target position of a note on the orbit.
   */
  public getNoteTargetCanvasPosition(
    note: Note,
    currentCycles: number = this.currentCycles,
    cycleEvents: CycleEvent[] = this.currentCycleEvents
  ): { x: number; y: number; radius: number; angleRad: number } {
    const angleRad = (note.angle - 90) * (Math.PI / 180);
    let cycleState = this.getCycleState(note.cycle || 0, note.time, this.trackRadius, cycleEvents, currentCycles);
    if ((note.cycle || 0) > 0 && (!cycleState.visible || cycleState.opacity <= 0.01)) {
      cycleState = { visible: true, radius: this.trackRadius, opacity: 1.0, floatProgress: 0 };
    }
    const noteR = this.getTrackRadiusAt(angleRad, note.time, cycleState.radius);
    return {
      x: this.centerX + Math.cos(angleRad) * noteR,
      y: this.centerY + Math.sin(angleRad) * noteR,
      radius: noteR,
      angleRad
    };
  }

  // GAMEPLAY RENDER (Strictly for gameplay)
  public render(
    songTime: number,
    rotationPeriod: number,
    notes: Note[],
    _bpm: number,
    isPlaying: boolean,
    combo: number,
    showCenterHub: boolean = true,
    targetEffectIntensity: number = 0,
    currentDensity: number = 1.0,
    currentCycles: number = 1,
    currentCycleEvents: CycleEvent[] = [],
    introProgress: number = 1.0
  ): void {
    this.currentCycles = currentCycles;
    this.currentCycleEvents = currentCycleEvents;
    this.lastSongTime = songTime;
    this.lastRotationPeriod = rotationPeriod;
    this.lastDensity = currentDensity;

    // Smoothly lerp trackEffectIntensity
    this.trackEffectIntensity += (targetEffectIntensity - this.trackEffectIntensity) * 0.08;
    if (this.trackEffectIntensity < 0.002) this.trackEffectIntensity = 0;

    const ctx = this.ctx;
    const cx = this.centerX;
    const cy = this.centerY;
    const r = this.trackRadius;

    ctx.save();

    // 1. Clean Minimalist Background in soft ice tone
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. Flat Dynamic Fourier Track (renders from hidden to visible during intro)
    this.drawFlatTrack(ctx, cx, cy, r, songTime, introProgress);

    // 3. Calculate Needle Angle (traces track into existence during intro; follows songTime during gameplay)
    let currentAngleRad: number;
    if (introProgress < 1.0) {
      const ease = 1 - Math.pow(1 - introProgress, 3);
      currentAngleRad = -Math.PI / 2 + ease * Math.PI * 2;
    } else {
      const progress = (((songTime % rotationPeriod) + rotationPeriod) % rotationPeriod) / rotationPeriod;
      currentAngleRad = (progress * 360 - 90) * (Math.PI / 180);
    }
    this.lastNeedleAngleRad = currentAngleRad;

    // 4. Flat Notes (with Fourier track mapping, density, and intro fade)
    this.drawFlatNotes(ctx, cx, cy, r, songTime, rotationPeriod, currentAngleRad, notes, currentDensity, introProgress);

    // 5. Flat Needle (stretches to meet dynamic Fourier track edge)
    this.drawFlatNeedle(ctx, cx, cy, r, currentAngleRad, songTime, introProgress);

    // 6. Center Hub (Play Button when idle, Combo counter when playing)
    if (showCenterHub) {
      if (introProgress < 1.0) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, (introProgress - 0.25) / 0.75);
        this.drawFlatCenterHub(ctx, cx, cy, isPlaying, combo);
        ctx.restore();
      } else {
        this.drawFlatCenterHub(ctx, cx, cy, isPlaying, combo);
      }
    } else {
      // Clean tiny center pivot dot
      ctx.fillStyle = '#2d3436';
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7. Hit Feedback & Ripples
    this.drawHitFeedback(ctx);

    ctx.restore();
  }

  // CHART EDITOR RENDER
  public renderEditor(
    currentTime: number,
    rotationPeriod: number,
    notes: Note[],
    bpm: number,
    snapDiv: number, // 4 = 1/4 beat, 8 = 1/8 beat, 16 = 1/16 beat
    hoverAngle: number | null,
    currentCycles: number = 1,
    cycleEvents: CycleEvent[] = [],
    activeEditCycle: number = 0
  ): void {
    const ctx = this.ctx;
    const cx = this.centerX;
    const cy = this.centerY;
    const r = this.trackRadius;

    ctx.save();

    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, this.width, this.height);

    // Draw Editor Grid Subdivision Ticks on Dial
    this.drawEditorGrid(ctx, cx, cy, r, snapDiv);

    // Draw Track(s)
    if (currentCycles <= 1 && (!cycleEvents || cycleEvents.length === 0)) {
      ctx.strokeStyle = COLOR_BLUE_BORDER;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Main track
      ctx.strokeStyle = COLOR_BLUE_BORDER;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      const maxCycle = Math.max(currentCycles - 1, ...(cycleEvents || []).map(e => e.cycle));
      for (let c = 1; c <= maxCycle; c++) {
        const state = this.getCycleState(c, currentTime, r, cycleEvents, currentCycles);
        if (!state.visible || state.opacity <= 0.05) continue;

        ctx.save();
        ctx.globalAlpha = state.opacity;
        ctx.strokeStyle = COLOR_SKY_BLUE;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(cx, cy, state.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Draw All Notes in Current Measure (strictly 360 degrees / single measure)
    const measureDuration = rotationPeriod;
    const currentMeasureIndex = Math.floor(currentTime / measureDuration);
    const measureStartTime = currentMeasureIndex * measureDuration;
    const measureEndTime = measureStartTime + measureDuration;

    for (const note of notes) {
      if (note.time < measureStartTime || note.time >= measureEndTime) continue;
      const angleRad = (note.angle - 90) * (Math.PI / 180);
      const cycleState = this.getCycleState(note.cycle || 0, currentTime, r, cycleEvents, currentCycles);
      const noteR = cycleState.radius;
      const nx = cx + Math.cos(angleRad) * noteR;
      const ny = cy + Math.sin(angleRad) * noteR;

      ctx.save();
      ctx.globalAlpha = cycleState.opacity;

      if (note.type === 'hold') {
        const holdDur = note.duration || 1.0;
        const spanRad = (holdDur / rotationPeriod) * Math.PI * 2;
        const endRad = angleRad + spanRad;

        // Draw curved hold ribbon
        ctx.strokeStyle = COLOR_BLUE_BORDER;
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.arc(cx, cy, noteR, angleRad, endRad);
        ctx.stroke();

        ctx.strokeStyle = COLOR_SKY_BLUE;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(cx, cy, noteR, angleRad, endRad);
        ctx.stroke();

        // End cap
        const ex = cx + Math.cos(endRad) * noteR;
        const ey = cy + Math.sin(endRad) * noteR;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = COLOR_BLUE_BORDER;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ex, ey, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Head (Simplified: border and fill ONLY)
        ctx.fillStyle = COLOR_SKY_BLUE;
        ctx.strokeStyle = COLOR_BLUE_BORDER;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(nx, ny, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (note.type === 'touch') {
        // Small light-blue circle (border and fill ONLY)
        ctx.fillStyle = COLOR_LIGHT_BLUE;
        ctx.strokeStyle = COLOR_BLUE_BORDER;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(nx, ny, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Tap note (Simplified: border and fill ONLY)
        ctx.fillStyle = COLOR_SKY_BLUE;
        ctx.strokeStyle = COLOR_BLUE_BORDER;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(nx, ny, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }

    // Hover placement preview cursor
    if (hoverAngle !== null) {
      const hRad = (hoverAngle - 90) * (Math.PI / 180);
      const hoverCycleState = this.getCycleState(activeEditCycle, currentTime, r, cycleEvents, currentCycles);
      const hR = hoverCycleState.radius;
      const hx = cx + Math.cos(hRad) * hR;
      const hy = cy + Math.sin(hRad) * hR;

      ctx.strokeStyle = activeEditCycle === 1 ? '#00cec9' : COLOR_SKY_BLUE;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(hx, hy, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Current needle position
    const progress = (currentTime % rotationPeriod) / rotationPeriod;
    const currentAngleRad = (progress * 360 - 90) * (Math.PI / 180);
    this.drawFlatNeedle(ctx, cx, cy, r, currentAngleRad);

    // Center Display for Editor: Current Measure & Beat
    const beatSec = 60 / bpm;
    const currentBeatInMeasure = ((currentTime % rotationPeriod) / beatSec) + 1;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = COLOR_BLUE_BORDER;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLOR_BLUE_BORDER;
    ctx.font = `bold 15px ${FONT_SANS}`;
    ctx.fillText(`M ${currentMeasureIndex + 1}`, cx, cy - 8);

    ctx.font = `bold 12px ${FONT_NUMS}`;
    ctx.fillStyle = COLOR_NEEDLE;
    ctx.fillText(`B ${currentBeatInMeasure.toFixed(2)}`, cx, cy + 10);

    ctx.restore();
  }

  private drawEditorGrid(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    snapDiv: number
  ): void {
    // 4 beats per measure. Total ticks = 4 * (snapDiv / 4)
    // If snapDiv = 4 (1/4 beat): 4 ticks (0°, 90°, 180°, 270°)
    // If snapDiv = 8 (1/8 beat): 8 ticks
    // If snapDiv = 16 (1/16 beat): 16 ticks
    const totalTicks = snapDiv === 4 ? 4 : snapDiv === 8 ? 8 : 16;

    for (let i = 0; i < totalTicks; i++) {
      const angle = (i / totalTicks) * Math.PI * 2 - Math.PI / 2;
      const isQuarter = i % (totalTicks / 4) === 0;
      const inner = isQuarter ? r - 12 : r - 6;
      const outer = isQuarter ? r + 12 : r + 6;

      const x1 = cx + Math.cos(angle) * inner;
      const y1 = cy + Math.sin(angle) * inner;
      const x2 = cx + Math.cos(angle) * outer;
      const y2 = cy + Math.sin(angle) * outer;

      ctx.strokeStyle = isQuarter ? '#ff7675' : '#74b9ff';
      ctx.lineWidth = isQuarter ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  private drawFlatTrack(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    songTime: number,
    introProgress: number = 1.0
  ): void {
    const totalCycles = this.currentCycles;
    const isClimax = this.trackEffectIntensity > 0.002;

    // INTRO ANIMATION: Render cycles from hidden to visible
    if (introProgress < 1.0) {
      const ease = 1 - Math.pow(1 - introProgress, 3);
      const trackAlpha = Math.min(1, ease * 1.25);
      const currentR = r * (0.82 + 0.18 * ease);
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + ease * Math.PI * 2;

      ctx.save();
      ctx.globalAlpha = trackAlpha;

      // Subtle outer aura ring
      ctx.strokeStyle = 'rgba(30, 55, 153, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, currentR + 14, startAngle, endAngle);
      ctx.stroke();

      // Primary circular track
      ctx.strokeStyle = '#2d3436';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(cx, cy, currentR, startAngle, endAngle);
      ctx.stroke();

      // Active extra concentric cycles if present
      if (totalCycles > 1 || (this.currentCycleEvents && this.currentCycleEvents.length > 0)) {
        const maxCycle = Math.max(totalCycles - 1, ...(this.currentCycleEvents || []).map(e => e.cycle));
        for (let c = 1; c <= maxCycle; c++) {
          const state = this.getCycleState(c, songTime, r, this.currentCycleEvents, totalCycles);
          if (!state.visible || state.opacity <= 0.01) continue;
          const cycleR = state.radius * (0.82 + 0.18 * ease);

          ctx.strokeStyle = 'rgba(30, 55, 153, 0.08)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, cycleR + 10, startAngle, endAngle);
          ctx.stroke();

          ctx.strokeStyle = '#0984e3';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.arc(cx, cy, cycleR, startAngle, endAngle);
          ctx.stroke();
        }
      }

      ctx.restore();
      return;
    }

    // 1. Primary Orbit (Cycle 0: center cx, cy, radius r)
    if (!isClimax) {
      ctx.strokeStyle = 'rgba(30, 55, 153, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#2d3436';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const steps = 120;
      ctx.strokeStyle = 'rgba(30, 55, 153, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const curR = this.getTrackRadiusAt(angle, songTime, r + 14);
        const x = cx + Math.cos(angle) * curR;
        const y = cy + Math.sin(angle) * curR;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.strokeStyle = '#2d3436';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const curR = this.getTrackRadiusAt(angle, songTime, r);
        const x = cx + Math.cos(angle) * curR;
        const y = cy + Math.sin(angle) * curR;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    if (totalCycles <= 1 && (!this.currentCycleEvents || this.currentCycleEvents.length === 0)) {
      return;
    }

    // 2. Extra Concentric Cycles (Floating dynamically from main orbit without overlap)
    const maxCycle = Math.max(totalCycles - 1, ...(this.currentCycleEvents || []).map(e => e.cycle));
    for (let c = 1; c <= maxCycle; c++) {
      const state = this.getCycleState(c, songTime, r, this.currentCycleEvents, totalCycles);
      if (!state.visible || state.opacity <= 0.01) continue;

      ctx.save();
      ctx.globalAlpha = state.opacity;
      const trackColor = '#0984e3';

      if (!isClimax) {
        ctx.strokeStyle = 'rgba(30, 55, 153, 0.08)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, state.radius + 10, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = trackColor;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(cx, cy, state.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const steps = 120;
        ctx.strokeStyle = trackColor;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          const curR = this.getTrackRadiusAt(angle, songTime, state.radius);
          const x = cx + Math.cos(angle) * curR;
          const y = cy + Math.sin(angle) * curR;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawFlatNotes(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    songTime: number,
    rotationPeriod: number,
    needleAngleRad: number,
    notes: Note[],
    currentDensity: number = 1.0,
    introProgress: number = 1.0
  ): void {
    if (introProgress < 0.25) return;
    const introEase = 1 - Math.pow(1 - introProgress, 3);
    const noteIntroAlpha = Math.min(1, Math.max(0, (introEase - 0.25) / 0.75));

    const lookaheadRatio = 0.75;
    const maxLookaheadTime = (rotationPeriod * lookaheadRatio) / currentDensity;
    const maxVisibleTime = songTime + maxLookaheadTime;
    const fadeInDuration = Math.min(0.4, (rotationPeriod * 0.16) / currentDensity);

    // 1. Draw HOLD ribbons first so heads and other notes sit on top
    for (const note of notes) {
      if (note.type !== 'hold') continue;
      if (note.holdCompleted) continue;

      const holdDur = note.duration || 1.0;
      const endNoteTime = note.time + holdDur;
      if (songTime > endNoteTime + 0.15) continue;
      if (note.time > maxVisibleTime && !note.holding) continue;

      const cycle = note.cycle || 0;
      let cycleState = this.getCycleState(cycle, songTime, r, this.currentCycleEvents, this.currentCycles);
      if (cycle > 0 && (!cycleState.visible || cycleState.opacity <= 0.01)) {
        // Fallback: note mapped to unconfigured cycle event falls back to primary orbit
        cycleState = { visible: true, radius: r, opacity: 1.0, floatProgress: 0 };
      }

      const noteBaseR = cycleState.radius;

      this.drawHoldRibbon(
        ctx,
        cx,
        cy,
        noteBaseR,
        songTime,
        rotationPeriod,
        needleAngleRad,
        note,
        COLOR_SKY_BLUE,
        maxVisibleTime,
        maxLookaheadTime,
        fadeInDuration,
        currentDensity,
        noteIntroAlpha
      );
    }

    // 2. Draw TAP and TOUCH notes (and hold heads/tails)
    for (const note of notes) {
      if (note.holdCompleted) continue;

      const diff = note.time - songTime;
      const holdDur = note.type === 'hold' ? (note.duration || 1.0) : 0;
      const endNoteTime = note.time + holdDur;

      // 1. Normal tap notes disappear immediately once judged
      if (note.type === 'tap' && note.judged) continue;

      // 2. Touch notes continue to render until they reach their actual target position (songTime >= note.time)
      if (note.type === 'touch') {
        if (note.judged && songTime >= note.time) continue;
        if (!note.judged && diff < -0.15) continue;
      }

      // 3. Hold notes render until finished
      if (note.type === 'hold' && songTime > endNoteTime + 0.15) continue;

      if (diff > maxLookaheadTime) continue;
      if (note.type === 'tap' && diff < -0.15) continue;

      const timeSinceEntered = maxLookaheadTime - diff;
      const fadeAlpha = note.holding ? 1.0 : Math.min(1, Math.max(0, timeSinceEntered / fadeInDuration));

      const cycle = note.cycle || 0;
      let cycleState = this.getCycleState(cycle, songTime, r, this.currentCycleEvents, this.currentCycles);
      if (cycle > 0 && (!cycleState.visible || cycleState.opacity <= 0.01)) {
        // Fallback: note mapped to unconfigured cycle event falls back to primary orbit
        cycleState = { visible: true, radius: r, opacity: 1.0, floatProgress: 0 };
      }

      const noteBaseR = cycleState.radius;
      const finalAlpha = fadeAlpha * cycleState.opacity * noteIntroAlpha;

      ctx.save();
      ctx.globalAlpha = finalAlpha;

      if (note.type === 'touch') {
        this.drawTouchNote(ctx, cx, cy, noteBaseR, songTime, rotationPeriod, needleAngleRad, maxLookaheadTime, note, currentDensity);
      } else if (note.type === 'hold') {
        this.drawHoldEndpoints(
          ctx,
          cx,
          cy,
          noteBaseR,
          songTime,
          rotationPeriod,
          needleAngleRad,
          note,
          COLOR_SKY_BLUE,
          maxVisibleTime,
          maxLookaheadTime,
          currentDensity
        );
      } else {
        this.drawTapNote(ctx, cx, cy, noteBaseR, songTime, rotationPeriod, needleAngleRad, maxLookaheadTime, note, COLOR_SKY_BLUE, currentDensity);
      }

      ctx.restore();
    }
  }

  private drawHoldRibbon(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    songTime: number,
    rotationPeriod: number,
    needleAngleRad: number,
    note: Note,
    color: string,
    maxVisibleTime: number,
    maxLookaheadTime: number,
    fadeInDuration: number,
    currentDensity: number = 1.0,
    noteIntroAlpha: number = 1.0
  ): void {
    const holdDur = note.duration || 1.0;
    const endNoteTime = note.time + holdDur;

    // Check if player missed/dropped the hold note
    const isMissed = (songTime > note.time + 0.12 && !note.holding) || (note.judged && note.grade === 'MISS');

    // Active segment start time
    let activeStartTime = note.time;
    if (songTime >= note.time) {
      // While passing or holding, the consumed segment dissolves at the needle position
      activeStartTime = songTime;
    }

    // Active segment end time: strictly capped at maxVisibleTime (270 degrees ahead)
    const activeEndTime = Math.min(endNoteTime, maxVisibleTime);

    if (activeStartTime >= activeEndTime) return;

    // Sample along the ribbon path to accurately follow Fourier track deformation and density across multi-cycle holds
    const cycleSpan = (activeEndTime - activeStartTime) / rotationPeriod;
    const numSteps = Math.max(24, Math.min(128, Math.round(cycleSpan * 80)));
    const traceRibbonPath = () => {
      ctx.beginPath();
      for (let k = 0; k <= numSteps; k++) {
        const t = activeStartTime + (k / numSteps) * (activeEndTime - activeStartTime);
        const theta = this.getNoteAngleRad(t, songTime, needleAngleRad, rotationPeriod, currentDensity);
        const curR = this.getTrackRadiusAt(theta, songTime, r);
        const px = cx + Math.cos(theta) * curR;
        const py = cy + Math.sin(theta) * curR;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    };

    // Draw hold electric sparks at the contact point if actively holding
    if (note.holding && songTime >= note.time) {
      const contactTheta = this.getNoteAngleRad(activeStartTime, songTime, needleAngleRad, rotationPeriod, currentDensity);
      const contactR = this.getTrackRadiusAt(contactTheta, songTime, r);
      const sparkX = cx + Math.cos(contactTheta) * contactR;
      const sparkY = cy + Math.sin(contactTheta) * contactR;
      this.drawHoldSparks(ctx, sparkX, sparkY, COLOR_LIGHT_BLUE);
    }

    // Ribbon fade-in alpha: smooth entrance from the 270-degree horizon
    const diff = note.time - songTime;
    const timeSinceEntered = maxLookaheadTime - diff;
    let fadeAlpha = (note.holding ? 1.0 : Math.min(1, Math.max(0, timeSinceEntered / fadeInDuration))) * noteIntroAlpha;

    if (isMissed) {
      // Dimmed / ghosted miss appearance so missing doesn't abruptly flash away
      fadeAlpha *= 0.45;
    }

    ctx.save();
    ctx.globalAlpha = fadeAlpha;

    // Ribbon outline
    ctx.strokeStyle = isMissed ? 'rgba(47, 53, 66, 0.4)' : COLOR_BLUE_BORDER;
    ctx.lineWidth = 17;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    traceRibbonPath();
    ctx.stroke();

    // Ribbon core
    ctx.strokeStyle = isMissed ? 'rgba(164, 176, 190, 0.5)' : color;
    ctx.lineWidth = 11;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    traceRibbonPath();
    ctx.stroke();

    // Striped dashed highlight along ribbon center
    ctx.strokeStyle = isMissed ? 'rgba(255, 255, 255, 0.2)' : '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 6]);
    traceRibbonPath();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  private drawHoldEndpoints(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    songTime: number,
    rotationPeriod: number,
    needleAngleRad: number,
    note: Note,
    color: string,
    maxVisibleTime: number,
    maxLookaheadTime: number,
    currentDensity: number = 1.0
  ): void {
    const holdDur = note.duration || 1.0;
    const endNoteTime = note.time + holdDur;

    const diff = note.time - songTime;
    const progress = Math.max(0, Math.min(1, 1 - diff / maxLookaheadTime));
    const isMissed = (songTime > note.time + 0.12 && !note.holding) || (note.judged && note.grade === 'MISS');

    // 1. Head note (visible only before the needle has passed it)
    if (!note.holding && songTime <= note.time + 0.08) {
      const headTheta = this.getNoteAngleRad(note.time, songTime, needleAngleRad, rotationPeriod, currentDensity);
      const headR = this.getTrackRadiusAt(headTheta, songTime, r);
      const hx = cx + Math.cos(headTheta) * headR;
      const hy = cy + Math.sin(headTheta) * headR;

      if (progress < 1) {
        const shrinkR = 10 + (1 - progress) * 26;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hx, hy, shrinkR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Simplified Head Note: inner fill and border ONLY
      ctx.fillStyle = isMissed ? '#95a5a6' : color;
      ctx.beginPath();
      ctx.arc(hx, hy, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isMissed ? '#57606f' : COLOR_BLUE_BORDER;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(hx, hy, 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. Tail ribbon terminator cap: clean perpendicular notch boundary
    if (endNoteTime <= maxVisibleTime && songTime <= endNoteTime + 0.15) {
      const tailTheta = this.getNoteAngleRad(endNoteTime, songTime, needleAngleRad, rotationPeriod, currentDensity);
      const tailR = this.getTrackRadiusAt(tailTheta, songTime, r);
      const tx = cx + Math.cos(tailTheta) * tailR;
      const ty = cy + Math.sin(tailTheta) * tailR;

      const normX = Math.cos(tailTheta);
      const normY = Math.sin(tailTheta);
      const halfWidth = 8.5;

      ctx.strokeStyle = isMissed ? '#57606f' : COLOR_BLUE_BORDER;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx - normX * halfWidth, ty - normY * halfWidth);
      ctx.lineTo(tx + normX * halfWidth, ty + normY * halfWidth);
      ctx.stroke();
    }
  }

  private drawTouchNote(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    songTime: number,
    rotationPeriod: number,
    needleAngleRad: number,
    maxLookaheadTime: number,
    note: Note,
    currentDensity: number = 1.0
  ): void {
    const diff = note.time - songTime;
    const progress = Math.max(0, Math.min(1, 1 - diff / maxLookaheadTime));

    const theta = this.getNoteAngleRad(note.time, songTime, needleAngleRad, rotationPeriod, currentDensity);
    const noteR = this.getTrackRadiusAt(theta, songTime, r);
    const nx = cx + Math.cos(theta) * noteR;
    const ny = cy + Math.sin(theta) * noteR;

    ctx.save();
    ctx.translate(nx, ny);

    // 1. Approach: gentle contracting circular approach ring in light blue
    if (progress < 1) {
      const approachR = 7.5 + (1 - progress) * 20;
      ctx.strokeStyle = COLOR_LIGHT_BLUE;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, approachR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. Pulse when close
    const pulse = Math.sin(progress * Math.PI) * 1.2;
    const radius = 7.5 + pulse;

    // 3. Touch Note: small, light-blue circle (inner fill and border ONLY)
    ctx.fillStyle = COLOR_LIGHT_BLUE;
    ctx.strokeStyle = COLOR_BLUE_BORDER;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private drawTapNote(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    songTime: number,
    rotationPeriod: number,
    needleAngleRad: number,
    maxLookaheadTime: number,
    note: Note,
    color: string,
    currentDensity: number = 1.0
  ): void {
    const diff = note.time - songTime;
    const progress = Math.max(0, Math.min(1, 1 - diff / maxLookaheadTime));

    const theta = this.getNoteAngleRad(note.time, songTime, needleAngleRad, rotationPeriod, currentDensity);
    const trackR = this.getTrackRadiusAt(theta, songTime, r);
    const nx = cx + Math.cos(theta) * trackR;
    const ny = cy + Math.sin(theta) * trackR;

    if (progress < 1) {
      const shrinkR = 10 + (1 - progress) * 26;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(nx, ny, shrinkR, 0, Math.PI * 2);
      ctx.stroke();
    }

    const baseR = 11;
    const pulse = Math.sin(progress * Math.PI) * 2.5;
    const noteR = baseR + pulse;

    // Simplified Note Style: inner fill and border ONLY
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(nx, ny, noteR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = COLOR_BLUE_BORDER;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(nx, ny, noteR, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawHoldSparks(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    const now = performance.now();
    for (let i = 0; i < 4; i++) {
      const angle = (now * 0.01 + i * (Math.PI / 2)) % (Math.PI * 2);
      const dist = 6 + Math.sin(now * 0.02 + i) * 6;
      const px = x + Math.cos(angle) * dist;
      const py = y + Math.sin(angle) * dist;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFlatNeedle(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    angleRad: number,
    songTime: number = 0,
    introProgress: number = 1.0
  ): void {
    if (introProgress < 1.0) {
      const ease = 1 - Math.pow(1 - introProgress, 3);
      ctx.save();
      ctx.globalAlpha = Math.min(1, ease * 1.25);
    }

    let maxTrackR = r;
    const maxCycle = Math.max(this.currentCycles - 1, ...(this.currentCycleEvents || []).map(e => e.cycle));
    for (let c = 1; c <= maxCycle; c++) {
      const state = this.getCycleState(c, songTime, r, this.currentCycleEvents, this.currentCycles);
      if (state.visible && state.opacity > 0.05 && state.radius > maxTrackR) {
        maxTrackR = state.radius;
      }
    }

    const tipR = this.getTrackRadiusAt(angleRad, songTime, maxTrackR) + 8;
    const tipX = cx + Math.cos(angleRad) * tipR;
    const tipY = cy + Math.sin(angleRad) * tipR;

    ctx.strokeStyle = COLOR_NEEDLE;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // Main orbit needle dot (Cycle 0)
    const mainTrackR = this.getTrackRadiusAt(angleRad, songTime, r);
    const c0X = cx + Math.cos(angleRad) * mainTrackR;
    const c0Y = cy + Math.sin(angleRad) * mainTrackR;
    const c0R = 7 + this.needlePulse * 3;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = COLOR_NEEDLE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c0X, c0Y, c0R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Extra cycle needle dots (following floating cycle radius and opacity)
    for (let c = 1; c <= maxCycle; c++) {
      const state = this.getCycleState(c, songTime, r, this.currentCycleEvents, this.currentCycles);
      if (!state.visible || state.opacity <= 0.05) continue;

      const trackR = this.getTrackRadiusAt(angleRad, songTime, state.radius);
      const cursorX = cx + Math.cos(angleRad) * trackR;
      const cursorY = cy + Math.sin(angleRad) * trackR;
      const cursorR = 6 + this.needlePulse * 3;

      ctx.save();
      ctx.globalAlpha = state.opacity;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = COLOR_NEEDLE;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, cursorR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (this.needlePulse > 0) {
      this.needlePulse = Math.max(0, this.needlePulse - 0.08);
    }

    if (introProgress < 1.0) {
      ctx.restore();
    }
  }

  private drawFlatCenterHub(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    _isPlaying: boolean,
    combo: number
  ): void {
    const hubR = 30;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = COLOR_BLUE_BORDER;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
    ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLOR_BLUE_BORDER;
      ctx.font = `bold 22px ${FONT_NUMS}`;
      ctx.fillText(combo.toString(), cx, cy - 3);

      ctx.font = `bold 9px ${FONT_SANS}`;
      ctx.fillStyle = '#74b9ff';
      ctx.fillText('COMBO', cx, cy + 12);
  }

  public triggerHit(result: JudgeResult): void {
    let x: number;
    let y: number;

    if (result.hitX !== undefined && result.hitY !== undefined) {
      x = result.hitX;
      y = result.hitY;
    } else if (result.isHoldTick || result.isHoldComplete) {
      const cycle = result.note.cycle || 0;
      const cycleState = this.getCycleState(cycle, this.lastSongTime, this.trackRadius, this.currentCycleEvents, this.currentCycles);
      const hitR = this.getTrackRadiusAt(this.lastNeedleAngleRad, this.lastSongTime, cycleState.radius);
      x = this.centerX + Math.cos(this.lastNeedleAngleRad) * hitR;
      y = this.centerY + Math.sin(this.lastNeedleAngleRad) * hitR;
    } else {
      const pos = this.getNoteCanvasPosition(
        result.note,
        this.lastSongTime,
        this.lastRotationPeriod,
        this.lastNeedleAngleRad,
        this.lastDensity,
        this.currentCycles,
        this.currentCycleEvents
      );
      x = pos.x;
      y = pos.y;
    }

    const sign = result.deltaMs > 0 ? '+' : '';
    const subText = result.grade === 'MISS' ? '' : `${sign}${Math.round(result.deltaMs)}ms`;

    this.lastFeedback = {
      grade: result.grade,
      text: result.grade,
      subText,
      time: performance.now()
    };

    // If MISS, DO NOT spawn explosion particles (prevents screen flashing and stutter)
    if (result.grade === 'MISS') {
      return;
    }

    let color = COLOR_SKY_BLUE;
    if (result.grade === 'PERFECT') color = '#00cec9';
    if (result.grade === 'GREAT') color = '#0984e3';
    if (result.grade === 'GOOD') color = '#74b9ff';

    if (result.note.type === 'touch') {
      color = COLOR_LIGHT_BLUE;
    }

    // 1. Hold continuous tick
    if (result.isHoldTick) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 12,
        y: y + (Math.random() - 0.5) * 12,
        r: 3,
        maxR: 18,
        color: '#74b9ff',
        birth: performance.now(),
        life: 200
      });
      return;
    }

    // 2. Hold full completion celebration
    if (result.isHoldComplete) {
      this.particles.push({
        x,
        y,
        r: 12,
        maxR: 50,
        color: '#00cec9',
        birth: performance.now(),
        life: 450
      });
      this.needlePulse = 1.2;
      return;
    }

    // 3. Touch note radiant starburst
    if (result.note.type === 'touch') {
      for (let i = 0; i < 6; i++) {
        const pAngle = (i / 6) * Math.PI * 2;
        this.particles.push({
          x: x + Math.cos(pAngle) * 8,
          y: y + Math.sin(pAngle) * 8,
          r: 4,
          maxR: 32,
          color: COLOR_LIGHT_BLUE,
          birth: performance.now(),
          life: 320
        });
      }
    }

    this.particles.push({
      x,
      y,
      r: 10,
      maxR: 35,
      color,
      birth: performance.now(),
      life: 350
    });

    // Guard particle array to never exceed 30 particles
    if (this.particles.length > 30) {
      this.particles.splice(0, this.particles.length - 30);
    }

    this.needlePulse = 1.0;
  }

  private drawHitFeedback(ctx: CanvasRenderingContext2D): void {
    const now = performance.now();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const elapsed = now - p.birth;
      if (elapsed > p.life) {
        this.particles.splice(i, 1);
        continue;
      }

      const t = elapsed / p.life;
      const currentR = p.r + (p.maxR - p.r) * t;
      const alpha = 1 - t;

      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3 * alpha;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, currentR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (this.lastFeedback) {
      const elapsed = now - this.lastFeedback.time;
      if (elapsed < 500) {
        const t = elapsed / 500;
        const alpha = Math.max(0, 1 - t * t);
        const yOffset = -55 - t * 10;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let color = '#00cec9';
        if (this.lastFeedback.grade === 'GREAT') color = '#0984e3';
        if (this.lastFeedback.grade === 'GOOD') color = '#74b9ff';
        if (this.lastFeedback.grade === 'MISS') color = '#e74c3c';

        ctx.font = `900 22px ${FONT_SANS}`;
        ctx.fillStyle = color;
        ctx.fillText(this.lastFeedback.text, this.centerX, this.centerY + yOffset);

        if (this.lastFeedback.subText) {
          ctx.font = `bold 12px ${FONT_NUMS}`;
          ctx.fillStyle = '#636e72';
          ctx.fillText(this.lastFeedback.subText, this.centerX, this.centerY + yOffset + 20);
        }

        ctx.restore();
      }
    }
  }
}
