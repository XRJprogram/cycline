import { AudioEngine } from './core/AudioEngine';
import { loadChartsFromFolder, getChartDataForDifficulty, DIFFICULTY_COLORS, formatDifficultyLevel } from './core/Chart';
import { JudgeEngine } from './core/JudgeEngine';
import { ClockRenderer } from './render/ClockRenderer';
import { SceneType, SongInfo, DifficultyType, ChartData, RankGrade, BadgeGrade, ResultSummary } from './types';

export interface SongRecord {
  score: number;
  accuracy: number;
  rank: RankGrade;
  badge: BadgeGrade;
  maxCombo: number;
  timestamp: number;
}

export function getRecordKey(songId: string, diff: DifficultyType): string {
  return `cycline_record_${songId}_${diff}`;
}

export function getSongRecord(songId: string, diff: DifficultyType): SongRecord | null {
  try {
    const val = localStorage.getItem(getRecordKey(songId, diff));
    if (val) return JSON.parse(val);
  } catch (_) {}
  return null;
}

export function saveSongRecord(songId: string, diff: DifficultyType, summary: ResultSummary): boolean {
  try {
    const current = getSongRecord(songId, diff);
    if (!current || summary.score > current.score) {
      const rec: SongRecord = {
        score: summary.score,
        accuracy: summary.accuracy,
        rank: summary.rank,
        badge: summary.badge,
        maxCombo: summary.maxCombo,
        timestamp: Date.now()
      };
      localStorage.setItem(getRecordKey(songId, diff), JSON.stringify(rec));
      return true;
    }
  } catch (_) {}
  return false;
}

class GameManager {
  public audio: AudioEngine;
  public judge: JudgeEngine;
  public renderer: ClockRenderer;

  public currentScene: SceneType = 'TITLE';
  public songs: SongInfo[] = [];
  public currentSongIndex = 0;
  public selectedDifficulty: DifficultyType = 'NORMAL';

  // Arc Wheel State
  private wheelAngle: number = 0;
  private targetWheelAngle: number = 0;
  private readonly stepAngle: number = 0.32; // ~18.3 degrees spacing along circular arc
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartAngle: number = 0;
  private dragLastX: number = 0;
  private dragLastTime: number = 0;
  private dragVelocity: number = 0;
  private songNodes: HTMLElement[] = [];

  // Input states
  private pressedKeys: Set<string> = new Set<string>();
  private isPointerDown: boolean = false;

  // DOM Elements
  private sceneViews: Record<SceneType, HTMLElement>;
  private canvas: HTMLCanvasElement;

  // Title
  private sceneTitle: HTMLElement;

  // Select
  private arcWheelContainer: HTMLElement;
  private arcWheelTracks: HTMLElement;
  private selectTrackCounter: HTMLElement | null = null;

  private trackLevelBadge: HTMLElement | null = null;
  private trackSongTitle: HTMLElement | null = null;
  private trackArtist: HTMLElement | null = null;
  private trackBpm: HTMLElement | null = null;
  private trackNotesCount: HTMLElement | null = null;

  private diffButtons: Partial<Record<DifficultyType, HTMLButtonElement>> = {};
  private diffLvlLabels: Partial<Record<DifficultyType, HTMLElement>> = {};

  private btnStartSelect: HTMLButtonElement | null = null;
  private btnBackToTitle: HTMLButtonElement;

  // Gameplay
  private gameplayTitle: HTMLElement;
  private gameplayMeta: HTMLElement;
  private scoreVal: HTMLElement;
  private accVal: HTMLElement;
  private hudTrackBadge: HTMLElement;
  private btnGameplayPause: HTMLButtonElement;
  private btnGameplayAuto: HTMLButtonElement;
  private btnGameplayExit: HTMLButtonElement;
  private btnGameplayRestart: HTMLButtonElement;

  // Gameplay Intro Animation Buffer (cycles render from hidden to visible)
  private isGameplayIntroActive = false;
  private gameplayIntroStartTime = 0;
  private gameplayIntroDuration = 1150;
  private introTimeoutIds: number[] = [];

  // Finish Animation State
  private isFinishing: boolean = false;
  private finishStartTime: number = 0;
  private readonly finishDuration: number = 1800; // 1.8s celebratory clear animation

  // Result
  private resRank: HTMLElement;
  private resBadge: HTMLElement;
  private resSongTitle: HTMLElement;
  private resScore: HTMLElement;
  private resAcc: HTMLElement;
  private resMaxCombo: HTMLElement;
  private resPerfect: HTMLElement;
  private resGreat: HTMLElement;
  private resGood: HTMLElement;
  private resMiss: HTMLElement;
  private btnResultContinue: HTMLButtonElement;

  private selectEnterTime: number = performance.now();

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    if (!this.canvas) throw new Error('Game canvas not found');

    this.audio = new AudioEngine();
    this.judge = new JudgeEngine();
    this.renderer = new ClockRenderer(this.canvas);
    this.songs = loadChartsFromFolder();

    this.loadSavedCustomCharts();

    // Bind Views
    this.sceneViews = {
      TITLE: document.getElementById('sceneTitle') as HTMLElement,
      SELECT: document.getElementById('sceneSelect') as HTMLElement,
      GAMEPLAY: document.getElementById('sceneGameplay') as HTMLElement,
      RESULT: document.getElementById('sceneResult') as HTMLElement,
    };

    // Bind Title
    this.sceneTitle = document.getElementById('sceneTitle') as HTMLElement;

    // Bind Arc Wheel Select Controls
    this.arcWheelContainer = document.getElementById('arcWheelContainer') as HTMLElement;
    this.arcWheelTracks = document.getElementById('arcWheelTracks') as HTMLElement;
    this.selectTrackCounter = document.getElementById('selectTrackCounter') as HTMLElement | null;

    this.trackLevelBadge = document.getElementById('trackLevelBadge') as HTMLElement | null;
    this.trackSongTitle = document.getElementById('trackSongTitle') as HTMLElement | null;
    this.trackArtist = document.getElementById('trackArtist') as HTMLElement | null;
    this.trackBpm = document.getElementById('trackBpm') as HTMLElement | null;
    this.trackNotesCount = document.getElementById('trackNotesCount') as HTMLElement | null;

    this.diffButtons = {
      EASY: (document.querySelector('.diff-btn[data-diff="EASY"]') as HTMLButtonElement | null) ?? undefined,
      NORMAL: (document.querySelector('.diff-btn[data-diff="NORMAL"]') as HTMLButtonElement | null) ?? undefined,
      HARD: (document.querySelector('.diff-btn[data-diff="HARD"]') as HTMLButtonElement | null) ?? undefined,
      EX: (document.getElementById('btnDiffEx') as HTMLButtonElement | null) ?? undefined,
    };

    this.diffLvlLabels = {
      EASY: (document.getElementById('lblLvlEasy') as HTMLElement | null) ?? undefined,
      NORMAL: (document.getElementById('lblLvlNormal') as HTMLElement | null) ?? undefined,
      HARD: (document.getElementById('lblLvlHard') as HTMLElement | null) ?? undefined,
      EX: (document.getElementById('lblLvlEx') as HTMLElement | null) ?? undefined,
    };

    this.btnStartSelect = document.getElementById('btnStartSelect') as HTMLButtonElement | null;
    this.btnBackToTitle = document.getElementById('btnBackToTitle') as HTMLButtonElement;

    // Connect note actual canvas position evaluation to JudgeEngine
    this.judge.getNoteCanvasPos = (note, songTime) => {
      const song = this.songs[this.currentSongIndex];
      if (!song) return { x: 0, y: 0 };
      const chart = getChartDataForDifficulty(song, this.selectedDifficulty);
      const rotationPeriod = chart.rotationPeriod || 2.0;
      const progress = (((songTime % rotationPeriod) + rotationPeriod) % rotationPeriod) / rotationPeriod;
      const needleAngleRad = (progress * 360 - 90) * (Math.PI / 180);
      const currentDensity = this.evaluateCurrentDensity(chart, songTime);
      const currentCycles = chart.cycles || 1;
      return this.renderer.getNoteCanvasPosition(
        note,
        songTime,
        rotationPeriod,
        needleAngleRad,
        currentDensity,
        currentCycles,
        chart.cycleEvents || []
      );
    };

    this.judge.getNoteTargetPos = (note) => {
      const song = this.songs[this.currentSongIndex];
      if (!song) return { x: 0, y: 0 };
      const chart = getChartDataForDifficulty(song, this.selectedDifficulty);
      const currentCycles = chart.cycles || 1;
      return this.renderer.getNoteTargetCanvasPosition(
        note,
        currentCycles,
        chart.cycleEvents || []
      );
    };

    // Bind Gameplay Controls
    this.gameplayTitle = document.getElementById('gameplayTitle') as HTMLElement;
    this.gameplayMeta = document.getElementById('gameplayMeta') as HTMLElement;
    this.scoreVal = document.getElementById('scoreVal') as HTMLElement;
    this.accVal = document.getElementById('accVal') as HTMLElement;
    this.hudTrackBadge = document.getElementById('hudTrackBadge') as HTMLElement;
    this.btnGameplayPause = document.getElementById('btnGameplayPause') as HTMLButtonElement;
    this.btnGameplayAuto = document.getElementById('btnGameplayAuto') as HTMLButtonElement;
    this.btnGameplayExit = document.getElementById('btnGameplayExit') as HTMLButtonElement;
    this.btnGameplayRestart = document.getElementById('btnGameplayRestart') as HTMLButtonElement;


    // Bind Result Controls
    this.resRank = document.getElementById('resRank') as HTMLElement;
    this.resBadge = document.getElementById('resBadge') as HTMLElement;
    this.resSongTitle = document.getElementById('resSongTitle') as HTMLElement;
    this.resScore = document.getElementById('resScore') as HTMLElement;
    this.resAcc = document.getElementById('resAcc') as HTMLElement;
    this.resMaxCombo = document.getElementById('resMaxCombo') as HTMLElement;
    this.resPerfect = document.getElementById('resPerfect') as HTMLElement;
    this.resGreat = document.getElementById('resGreat') as HTMLElement;
    this.resGood = document.getElementById('resGood') as HTMLElement;
    this.resMiss = document.getElementById('resMiss') as HTMLElement;
    this.btnResultContinue = document.getElementById('btnResultContinue') as HTMLButtonElement;

    (window as unknown as { game: GameManager }).game = this;

    this.initSongSelectUI();
    this.setupEvents();
    this.startMainLoop();

    // Check hash for direct navigation (#select or #gameplay or #result)
    const hash = window.location.hash;
    if (hash === '#select') {
      this.switchScene('SELECT');
    } else if (hash === '#gameplay') {
      this.switchScene('SELECT');
      const song = this.songs[this.currentSongIndex];
      if (song) this.startSongGameplay(song, this.selectedDifficulty);
    } else if (hash === '#result') {
      this.switchScene('SELECT');
      const song = this.songs[this.currentSongIndex];
      if (song) {
        this.startSongGameplay(song, this.selectedDifficulty);
        for (const note of this.judge.getNotes()) {
          note.judged = true;
          note.grade = 'PERFECT';
        }
        this.judge.stats.perfectCount = this.judge.totalNotes;
        this.judge.stats.maxCombo = this.judge.totalNotes;
        this.judge.stats.score = 1000000;
        this.judge.isAP = true;
        this.judge.isFC = true;
        this.showResultScene();
      }
    }
  }

  // Load custom charts persisted in localStorage
  private loadSavedCustomCharts(): void {
    try {
      const saved = localStorage.getItem('cycline_custom_charts_v2');
      if (saved) {
        const list = JSON.parse(saved);
        if (Array.isArray(list)) {
          list.forEach((rawSong: any) => {
            if (!this.songs.some(s => s.id === rawSong.id)) {
              this.songs.push(rawSong);
            }
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load cached custom songs:', e);
    }
  }

  public evaluateCurrentDensity(chart: ChartData, songTime: number): number {
    let currentDensity = 1.0;
    if (chart.densityEvents && chart.densityEvents.length > 0) {
      const evs = chart.densityEvents;
      if (songTime <= evs[0].time) {
        currentDensity = evs[0].density;
      } else {
        for (let i = 0; i < evs.length; i++) {
          const cur = evs[i];
          const next = evs[i + 1];
          if (!next || songTime < next.time) {
            const duration = cur.duration || 0;
            if (duration > 0 && songTime < cur.time + duration) {
              const prevDensity = i > 0 ? evs[i - 1].density : 1.0;
              const p = Math.max(0, Math.min(1, (songTime - cur.time) / duration));
              const ease = p * p * (3 - 2 * p);
              currentDensity = prevDensity + (cur.density - prevDensity) * ease;
            } else {
              currentDensity = cur.density;
            }
            break;
          }
        }
      }
    }
    return currentDensity;
  }

  public switchScene(scene: SceneType): void {
    const prevScene = this.currentScene;

    // Clear any pending gameplay intro buffer timeouts
    this.introTimeoutIds.forEach(id => clearTimeout(id));
    this.introTimeoutIds = [];
    this.isGameplayIntroActive = false;

    // 1. Scene Exit Lifecycle Cleanup
    this.isFinishing = false;
    this.finishStartTime = 0;
    if (prevScene === 'GAMEPLAY') {
      this.audio.stop();
      this.btnGameplayPause.innerText = '⏸ 暂停';
      this.btnGameplayPause.classList.remove('active');
    }

    this.currentScene = scene;

    // 2. Toggle active classes on scene views
    for (const key in this.sceneViews) {
      const el = this.sceneViews[key as SceneType];
      if (key === scene) {
        el.classList.add('active');
        el.classList.remove('fading-out');
      } else {
        el.classList.remove('active', 'fading-out');
      }
    }

    // 3. Scene Enter Lifecycle Initialization
    if (scene === 'SELECT') {
      this.selectEnterTime = performance.now();
      this.audio.stop();
      this.setFocusedSong(this.currentSongIndex, true);
    } else if (scene === 'TITLE') {
      this.audio.stop();
      const titleBox = this.sceneTitle.querySelector('.title-box') as HTMLElement | null;
      if (titleBox) titleBox.classList.remove('title-exit');
    } else if (scene === 'RESULT') {
      this.audio.stop();
    }
  }

  /* =========================================================================
     ARC WHEEL & TRACK SELECTION
     ========================================================================= */
  private initSongSelectUI(): void {
    this.arcWheelTracks.innerHTML = '';
    this.songNodes = [];

    this.songs.forEach((song, idx) => {
      const item = document.createElement('div');
      item.className = 'wheel-song-item';
      item.setAttribute('data-index', idx.toString());

      // Prepare on-card difficulty selector box
      const diffKeys: DifficultyType[] = ['EASY', 'NORMAL', 'HARD', 'EX'];
      let diffHtml = '<div class="card-diff-picker">';
      for (const d of diffKeys) {
        const chart = song.difficulties[d];
        if (chart) {
          const lvlStr = formatDifficultyLevel(chart.level);
          diffHtml += `
            <button class="card-diff-btn diff-${d.toLowerCase()}" data-diff="${d}">
              <span class="card-diff-name">${d}</span>
              <span class="card-diff-lvl">${lvlStr}</span>
            </button>
          `;
        }
      }
      diffHtml += '</div>';

      const coverSrc = (window as any).__CYCLINE_IMAGES__?.[song.id] || `images/${song.id}.jpg`;
      item.innerHTML = `
        <div class="item-disc-art" style="border-color: ${song.coverColor || '#1e3799'};">
          <img class="item-disc-cover" src="${coverSrc}" alt="${song.title}" onerror="this.style.opacity='0.25'" />
          <div class="item-disc-grooves"></div>
          <div class="item-disc-center">
            <div class="item-disc-spindle"></div>
          </div>
        </div>

        <div class="item-info">
          <div class="item-title">${song.title}</div>
          <div class="item-artist">${song.artist}</div>
        </div>

        <div class="card-record-row" data-song-id="${song.id}">
          <span class="rec-empty">-- NO RECORD --</span>
        </div>

        ${diffHtml}
      `;

      // On-card difficulty button clicks
      const cardDiffBtns = item.querySelectorAll<HTMLButtonElement>('.card-diff-btn');
      cardDiffBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const d = btn.getAttribute('data-diff') as DifficultyType;
          if (idx !== this.currentSongIndex) {
            this.setFocusedSong(idx);
          }
          this.selectDifficulty(d);
        });
      });

      // Tapping directly on the card
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.currentSongIndex === idx) {
          // Focused card tapped: start gameplay directly!
          this.startSongGameplay(song, this.selectedDifficulty);
        } else {
          // Non-focused card tapped: wheel over to focus it
          this.setFocusedSong(idx);
        }
      });

      this.arcWheelTracks.appendChild(item);
      this.songNodes.push(item);
    });

    this.updateSelectCardRecords();
    this.setFocusedSong(this.currentSongIndex, true);
  }

  private updateSelectCardRecords(): void {
    this.songs.forEach((song, idx) => {
      const node = this.songNodes[idx];
      if (!node) return;
      const recEl = node.querySelector('.card-record-row') as HTMLElement | null;
      if (!recEl) return;

      const record = getSongRecord(song.id, this.selectedDifficulty);
      if (record && record.score > 0) {
        recEl.className = 'card-record-row';
        const badgeHtml = record.badge === 'AP' ? '<span class="rec-badge badge-ap">AP</span>' :
                          record.badge === 'FC' ? '<span class="rec-badge badge-fc">FC</span>' : '';
        recEl.innerHTML = `
          <span class="rec-label">BEST</span>
          <span class="rec-rank rank-${record.rank.toLowerCase()}">${record.rank}</span>
          <span class="rec-score">${record.score.toLocaleString()}</span>
          ${badgeHtml}
        `;
      } else {
        recEl.className = 'card-record-row no-record';
        recEl.innerHTML = '<span class="rec-empty">-- NO RECORD --</span>';
      }
    });
  }

  public setFocusedSong(index: number, immediate: boolean = false): void {
    if (this.songs.length === 0) return;
    this.currentSongIndex = Math.max(0, Math.min(this.songs.length - 1, index));
    this.targetWheelAngle = -this.currentSongIndex * this.stepAngle;

    if (immediate) {
      this.wheelAngle = this.targetWheelAngle;
    }

    const currentSong = this.songs[this.currentSongIndex];
    if (currentSong) {
      // If current song lacks the selected difficulty (e.g. EX on song without EX), graceful fallback
      if (!currentSong.difficulties[this.selectedDifficulty]) {
        if (currentSong.difficulties.HARD) this.selectedDifficulty = 'HARD';
        else if (currentSong.difficulties.NORMAL) this.selectedDifficulty = 'NORMAL';
        else if (currentSong.difficulties.EASY) this.selectedDifficulty = 'EASY';
      }
    }

    this.updateDetailPanel();
    this.audio.playHitsound(true);
  }

  public selectDifficulty(diff: DifficultyType): void {
    const currentSong = this.songs[this.currentSongIndex];
    if (!currentSong || !currentSong.difficulties[diff]) return;

    this.selectedDifficulty = diff;
    this.updateDetailPanel();
    this.audio.playHitsound(true);
  }

  private updateDetailPanel(): void {
    const song = this.songs[this.currentSongIndex];
    if (!song) return;

    // Track Counter
    if (this.selectTrackCounter) {
      this.selectTrackCounter.innerText = `${(this.currentSongIndex + 1).toString().padStart(2, '0')} / ${this.songs.length.toString().padStart(2, '0')}`;
    }

    // Meta
    if (this.trackSongTitle) this.trackSongTitle.innerText = song.title;
    if (this.trackArtist) this.trackArtist.innerText = song.artist;
    if (this.trackBpm) this.trackBpm.innerText = `${song.bpm} BPM`;

    // Legacy bottom diff buttons (if present in DOM)
    for (const d of ['EASY', 'NORMAL', 'HARD', 'EX'] as DifficultyType[]) {
      const btn = this.diffButtons[d];
      const lbl = this.diffLvlLabels[d];
      const diffChart = song.difficulties[d];

      if (btn && lbl && diffChart) {
        btn.classList.remove('hidden');
        lbl.innerText = formatDifficultyLevel(diffChart.level);
        if (this.selectedDifficulty === d) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      } else if (btn) {
        btn.classList.add('hidden');
        btn.classList.remove('active');
      }
    }

    // Chart specifics for active difficulty
    const chartData = getChartDataForDifficulty(song, this.selectedDifficulty);
    if (this.trackLevelBadge) {
      this.trackLevelBadge.innerText = `${this.selectedDifficulty} LV. ${formatDifficultyLevel(chartData.level)}`;
      this.trackLevelBadge.style.background = chartData.color || DIFFICULTY_COLORS[this.selectedDifficulty];
    }
    if (this.trackNotesCount) {
      this.trackNotesCount.innerText = `${chartData.notes.length} NOTES`;
    }

    if (chartData.audioUrl) {
      this.audio.preload(chartData.audioUrl);
    }

    // Update active difficulty highlights on cards & focus styling
    this.songNodes.forEach((node, idx) => {
      const isFocused = idx === this.currentSongIndex;
      if (isFocused) {
        node.classList.add('focused');
        node.style.borderColor = chartData.color || '#00a8ff';
      } else {
        node.classList.remove('focused');
        node.style.borderColor = '#1e3799';
      }

      // Update on-card difficulty buttons active state
      const cardDiffBtns = node.querySelectorAll<HTMLButtonElement>('.card-diff-btn');
      cardDiffBtns.forEach(btn => {
        const d = btn.getAttribute('data-diff') as DifficultyType;
        if (d === this.selectedDifficulty && isFocused) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    });

    this.updateSelectCardRecords();
  }

  private updateArcWheelPositions(): void {
    const w = this.arcWheelContainer.clientWidth || window.innerWidth;
    const h = this.arcWheelContainer.clientHeight || 360;

    const arcCenterX = w / 2;
    const arcRadius = Math.min(w, h) * 0.95;
    const arcCenterY = h + Math.min(w, h) * 0.45;

    const cardW = 232;
    const cardH = 326;
    const apexAngle = -Math.PI / 2; // 12 o'clock

    for (let i = 0; i < this.songNodes.length; i++) {
      const node = this.songNodes[i];
      const itemAngle = apexAngle + (i * this.stepAngle) + this.wheelAngle;

      const cos = Math.cos(itemAngle);
      const sin = Math.sin(itemAngle);

      const x = arcCenterX + cos * arcRadius - cardW / 2;
      const y = arcCenterY + sin * arcRadius - cardH / 2;

      // Tangent rotation to follow the circle curve
      const rotDeg = (itemAngle - apexAngle) * (180 / Math.PI) * 0.6;

      // Angular distance from top focal point
      const angleDiff = Math.abs(itemAngle - apexAngle);

      const isCurrent = i === this.currentSongIndex;
      const scale = isCurrent ? 1.08 : Math.max(0.68, 1 - angleDiff * 0.35);
      const opacity = Math.max(0.1, 1 - angleDiff * 0.75);
      const zIndex = isCurrent ? 25 : Math.max(1, Math.round(20 - angleDiff * 10));

      node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${rotDeg.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
      node.style.opacity = opacity.toFixed(2);
      node.style.zIndex = zIndex.toString();
    }
  }

  public startSongGameplay(song: SongInfo, difficulty: DifficultyType): void {
    this.selectedDifficulty = difficulty;
    const sIdx = this.songs.findIndex(s => s.id === song.id);
    if (sIdx !== -1) this.currentSongIndex = sIdx;
    const chartData = getChartDataForDifficulty(song, difficulty);
    this.judge.loadChart(chartData);

    // Pre-arm and unlock Web Audio & HTMLAudioElement synchronously upon user interaction
    this.audio.init();
    if (chartData.audioUrl) {
      this.audio.preload(chartData.audioUrl);
    }

    this.gameplayTitle.innerText = `${song.title} [${difficulty}]`;
    this.gameplayMeta.innerText = `LV.${formatDifficultyLevel(chartData.level)} • ${chartData.notes.length} NOTES`;
    this.scoreVal.innerText = '0000000';
    this.accVal.innerText = '100.0% • 0.0s';
    if (this.hudTrackBadge) {
      this.hudTrackBadge.innerText = 'AP';
      this.hudTrackBadge.className = 'hud-badge badge-ap';
      this.hudTrackBadge.style.display = 'inline-block';
    }

    this.btnGameplayPause.innerText = '⏸ 暂停';
    this.btnGameplayPause.classList.remove('active');

    this.isFinishing = false;
    this.finishStartTime = 0;

    this.switchScene('GAMEPLAY');
    const lastNoteTime = chartData.notes[chartData.notes.length - 1]?.time || 30;
    const totalBeats = Math.ceil((lastNoteTime + 4) * (song.bpm / 60));

    // Entrance Animation Loading Buffer: 1.15s window for cycles to render from hidden to visible
    this.isGameplayIntroActive = true;
    this.gameplayIntroStartTime = performance.now();
    this.gameplayIntroDuration = 1150;

    const t = window.setTimeout(() => {
      if (this.currentScene === 'GAMEPLAY') {
        this.isGameplayIntroActive = false;
        this.audio.restart(song.bpm, totalBeats, chartData.audioUrl, chartData.offset || 0);
      }
    }, this.gameplayIntroDuration);

    this.introTimeoutIds.push(t);
  }

  private setupEvents(): void {
    // 1. TITLE SCENE: Title flies off-screen upwards; select cards rise gracefully from deep below
    let isTitleTransitioning = false;
    const titleEnter = () => {
      if (this.currentScene === 'TITLE' && !isTitleTransitioning) {
        isTitleTransitioning = true;
        this.audio.init();

        const titleBox = this.sceneTitle.querySelector('.title-box') as HTMLElement | null;
        if (titleBox) {
          titleBox.classList.add('title-exit');
        }

        // Extended staggered scene transition:
        // 1. Title begins majestic flight upwards out of view off-screen.
        // 2. At 450ms, title is sailing off-screen. Activate SELECT scene.
        //    Cards and wheel slider begin their extended upward glide from deep below off-screen.
        // 3. At 1350ms, title transition lock is released.
        setTimeout(() => {
          this.switchScene('SELECT');
        }, 450);

        setTimeout(() => {
          if (titleBox) {
            titleBox.classList.remove('title-exit');
          }
          isTitleTransitioning = false;
        }, 1350);
      }
    };
    this.sceneTitle.addEventListener('click', titleEnter);

    // 2. SONG SELECT - FLUID MULTI-TRACK DRAG, FLICK & SCROLL
    this.arcWheelContainer.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(delta) > 15) {
        // Multi-track scroll jump proportional to wheel strength
        const jump = Math.sign(delta) * Math.max(1, Math.min(3, Math.round(Math.abs(delta) / 80)));
        this.setFocusedSong(this.currentSongIndex + jump);
      }
    }, { passive: false });

    // Drag / Swipe gesture with momentum fling across multiple charts
    const handleDragStart = (clientX: number) => {
      this.isDragging = true;
      this.dragStartX = clientX;
      this.dragLastX = clientX;
      this.dragLastTime = performance.now();
      this.dragStartAngle = this.wheelAngle;
      this.dragVelocity = 0;
    };

    const handleDragMove = (clientX: number) => {
      if (!this.isDragging) return;
      const now = performance.now();
      const dt = now - this.dragLastTime;
      if (dt > 10) {
        this.dragVelocity = (clientX - this.dragLastX) / dt;
        this.dragLastX = clientX;
        this.dragLastTime = now;
      }
      const dx = clientX - this.dragStartX;
      const deltaAngle = (dx / 220) * this.stepAngle;
      this.wheelAngle = this.dragStartAngle + deltaAngle;
    };

    const handleDragEnd = () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      // Calculate momentum fling across multiple tracks based on dragVelocity
      const momentumTracks = (this.dragVelocity * 220) / 160;
      const currentOffset = -this.wheelAngle / this.stepAngle;
      const targetIndex = Math.max(0, Math.min(this.songs.length - 1, Math.round(currentOffset - momentumTracks)));
      this.setFocusedSong(targetIndex);
    };

    this.arcWheelContainer.addEventListener('mousedown', (e) => handleDragStart(e.clientX));
    window.addEventListener('mousemove', (e) => handleDragMove(e.clientX));
    window.addEventListener('mouseup', handleDragEnd);

    this.arcWheelContainer.addEventListener('touchstart', (e) => {
      handleDragStart(e.touches[0].clientX);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length > 0) {
        handleDragMove(e.touches[0].clientX);
      }
    }, { passive: true });
    window.addEventListener('touchend', handleDragEnd, { passive: true });

    // 3. DIFFICULTY BUTTONS (if legacy bottom panel exists)
    for (const d of ['EASY', 'NORMAL', 'HARD', 'EX'] as DifficultyType[]) {
      const btn = this.diffButtons[d];
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectDifficulty(d);
        });
      }
    }

    // 4. ACTION BUTTONS
    if (this.btnStartSelect) {
      this.btnStartSelect.addEventListener('click', () => {
        const song = this.songs[this.currentSongIndex];
        if (song) this.startSongGameplay(song, this.selectedDifficulty);
      });
    }

    this.btnBackToTitle.addEventListener('click', () => {
      this.switchScene('TITLE');
    });

    // 5. GAMEPLAY BUTTONS
    this.btnGameplayExit.addEventListener('click', () => {
      this.audio.stop();
      this.switchScene('SELECT');
    });

    this.btnGameplayRestart.addEventListener('click', () => {
      const song = this.songs[this.currentSongIndex];
      if (song) this.startSongGameplay(song, this.selectedDifficulty);
    });

    this.btnGameplayPause.addEventListener('click', () => {
      if (this.audio.getIsPlaying()) {
        this.audio.pause();
        this.btnGameplayPause.innerText = '▶ 继续';
        this.btnGameplayPause.classList.add('active');
      } else {
        const song = this.songs[this.currentSongIndex];
        const chart = getChartDataForDifficulty(song, this.selectedDifficulty);
        const lastNote = chart.notes[chart.notes.length - 1]?.time || 30;
        const totalBeats = Math.ceil((lastNote + 4) * (song.bpm / 60));
        this.audio.play(song.bpm, totalBeats, this.audio.getSongTime(), chart.audioUrl, chart.offset || 0);
        this.btnGameplayPause.innerText = '⏸ 暂停';
        this.btnGameplayPause.classList.remove('active');
      }
    });

    this.btnGameplayAuto.addEventListener('click', () => {
      this.judge.isAutoPlay = !this.judge.isAutoPlay;
      if (this.judge.isAutoPlay) {
        this.btnGameplayAuto.classList.add('active');
        this.btnGameplayAuto.innerText = '✦ AUTO: ON';
      } else {
        this.btnGameplayAuto.classList.remove('active');
        this.btnGameplayAuto.innerText = '✦ AUTO: OFF';
      }
    });

    // 6. RESULT BUTTON (Single Continue button returning to select scene)
    this.btnResultContinue.addEventListener('click', () => {
      this.switchScene('SELECT');
    });

    // 7. CANVAS HIT INTERACTION: Support holding pointer down and continuous touch dragging
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.currentScene === 'TITLE') {
        titleEnter();
        return;
      }

      if (this.currentScene === 'GAMEPLAY') {
        if (!this.audio.getIsPlaying()) {
          return;
        }
        this.isPointerDown = true;
        this.judge.isInputActive = true;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.judge.activePointerPos = { x, y };
        const songTime = this.audio.getSongTime();
        this.judge.handleInputDown(songTime, this.judge.activePointerPos);
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (this.currentScene === 'GAMEPLAY' && this.isPointerDown) {
        const rect = this.canvas.getBoundingClientRect();
        this.judge.activePointerPos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
      }
    });

    window.addEventListener('pointerup', () => {
      this.isPointerDown = false;
      if (this.pressedKeys.size === 0) {
        this.judge.isInputActive = false;
        this.judge.activePointerPos = undefined;
      }
      if (this.currentScene === 'GAMEPLAY') {
        const songTime = this.audio.getSongTime();
        this.judge.handleInputUp(songTime);
      }
    });

    // 8. KEYBOARD EVENTS: Multi-key holding support
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.ctrlKey || e.altKey || e.metaKey || e.key === 'F12') return;

      if (this.currentScene === 'TITLE') {
        titleEnter();
        return;
      }

      if (this.currentScene === 'SELECT') {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          this.setFocusedSong(this.currentSongIndex - 1);
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          this.setFocusedSong(this.currentSongIndex + 1);
        } else if (e.code === 'Digit1' || e.code === 'Numpad1') {
          this.selectDifficulty('EASY');
        } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
          this.selectDifficulty('NORMAL');
        } else if (e.code === 'Digit3' || e.code === 'Numpad3') {
          this.selectDifficulty('HARD');
        } else if (e.code === 'Digit4' || e.code === 'Numpad4') {
          this.selectDifficulty('EX');
        } else if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          const song = this.songs[this.currentSongIndex];
          if (song) this.startSongGameplay(song, this.selectedDifficulty);
        } else if (e.code === 'Escape') {
          this.switchScene('TITLE');
        }
        return;
      }

      if (this.currentScene === 'GAMEPLAY') {
        if (e.code === 'Escape') {
          this.btnGameplayPause.click();
          return;
        }
        if (e.code === 'KeyR') {
          this.btnGameplayRestart.click();
          return;
        }
        if (e.code === 'Space' || e.code.startsWith('Key')) {
          if (e.code === 'Space') e.preventDefault();
          this.pressedKeys.add(e.code);
          this.judge.isInputActive = true;
          if (!this.audio.getIsPlaying()) {
            return;
          }
          const songTime = this.audio.getSongTime();
          this.judge.handleInputDown(songTime);
        }
        return;
      }

      if (this.currentScene === 'RESULT') {
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
          e.preventDefault();
          this.btnResultContinue.click();
        }
        return;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.pressedKeys.delete(e.code);
      if (this.currentScene === 'GAMEPLAY') {
        if (this.pressedKeys.size === 0 && !this.isPointerDown) {
          this.judge.isInputActive = false;
          this.judge.activePointerPos = undefined;
          const songTime = this.audio.getSongTime();
          this.judge.handleInputUp(songTime);
        }
      }
    });

    // 9. VISIBILITY & BLUR HANDLING: Auto-pause when page/tab is switched or minimized
    const handleAutoPause = () => {
      if (this.currentScene === 'GAMEPLAY' && this.audio.getIsPlaying()) {
        this.audio.pause();
        this.btnGameplayPause.innerText = '▶ 继续';
        this.btnGameplayPause.classList.add('active');
      }
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        handleAutoPause();
      }
    });
    window.addEventListener('blur', handleAutoPause);

    // 10. JUDGEMENT CALLBACK
    this.judge.onJudgeCallback = (result) => {
      if (result.grade !== 'MISS') {
        if (result.isHoldTick) {
          this.audio.playHoldTick();
        } else if (result.isHoldComplete) {
          this.audio.playHoldComplete();
        } else {
          this.audio.playHitsound(result.grade === 'PERFECT', result.note.type);
        }
      }
      this.renderer.triggerHit(result);
      this.updateGameplayHud();
    };
  }

  private updateGameplayHud(): void {
    const s = this.judge.stats;
    this.scoreVal.innerText = s.score.toString().padStart(7, '0');
    const songTime = this.audio.getSongTime();
    this.accVal.innerText = `${this.judge.getAccuracy().toFixed(1)}% • ${songTime.toFixed(1)}s`;

    if (this.hudTrackBadge) {
      if (this.judge.isAP) {
        this.hudTrackBadge.innerText = 'AP';
        this.hudTrackBadge.className = 'hud-badge badge-ap';
      } else if (this.judge.isFC) {
        this.hudTrackBadge.innerText = 'FC';
        this.hudTrackBadge.className = 'hud-badge badge-fc';
      } else {
        this.hudTrackBadge.innerText = 'CLEAR';
        this.hudTrackBadge.className = 'hud-badge badge-clear';
      }
    }
  }

  public showResultScene(): void {
    const song = this.songs[this.currentSongIndex];
    const summary = this.judge.getResultSummary(song.title, this.selectedDifficulty);

    // Main Rank: SSS, SS, S, A, B, C
    this.resRank.innerText = summary.rank;
    this.resRank.className = `result-rank rank-${summary.rank.toLowerCase()}`;

    // Supplementary Badge: AP, FC, or none
    if (this.resBadge) {
      if (summary.badge === 'AP') {
        this.resBadge.style.display = 'inline-block';
        this.resBadge.innerText = '✦ ALL PERFECT ✦';
        this.resBadge.className = 'result-badge badge-ap';
      } else if (summary.badge === 'FC') {
        this.resBadge.style.display = 'inline-block';
        this.resBadge.innerText = '★ FULL COMBO ★';
        this.resBadge.className = 'result-badge badge-fc';
      } else {
        this.resBadge.style.display = 'none';
      }
    }

    this.resSongTitle.innerText = `${summary.songTitle} [${this.selectedDifficulty}]`;
    this.resScore.innerText = summary.score.toString().padStart(7, '0');
    this.resAcc.innerText = `${summary.accuracy.toFixed(1)}%`;
    this.resMaxCombo.innerText = summary.maxCombo.toString();
    this.resPerfect.innerText = summary.perfectCount.toString();
    this.resGreat.innerText = summary.greatCount.toString();
    this.resGood.innerText = summary.goodCount.toString();
    this.resMiss.innerText = summary.missCount.toString();

    // Save player record
    saveSongRecord(song.id, this.selectedDifficulty, summary);
    this.updateSelectCardRecords();

    this.audio.stop();
    this.switchScene('RESULT');
  }

  private startMainLoop(): void {
    let lastFrameTime = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = now - lastFrameTime;
      lastFrameTime = now;

      if (this.currentScene === 'GAMEPLAY') {
        if (dt > 350 && this.audio.getIsPlaying()) {
          // Detect tab suspend / large frame freeze and auto-pause
          this.audio.pause();
          this.btnGameplayPause.innerText = '▶ 继续';
          this.btnGameplayPause.classList.add('active');
        }

        // 1. Finish Animation Sequence
        if (this.isFinishing) {
          const elapsed = performance.now() - this.finishStartTime;
          const progress = Math.min(1.0, elapsed / this.finishDuration);
          this.renderer.renderFinishAnimation(
            performance.now() / 1000,
            progress,
            this.judge.stats.maxCombo,
            this.judge.stats.score
          );
          if (progress >= 1.0) {
            this.isFinishing = false;
            this.showResultScene();
          }
          requestAnimationFrame(loop);
          return;
        }

        const songTime = this.audio.getSongTime();
        if (this.audio.getIsPlaying()) {
          this.judge.update(songTime);
          this.updateGameplayHud();

          if (this.judge.isChartFinished(songTime)) {
            this.isFinishing = true;
            this.finishStartTime = performance.now();
            this.audio.playTrackClear();
            requestAnimationFrame(loop);
            return;
          }
        }

        const song = this.songs[this.currentSongIndex];
        if (song) {
          const chart = getChartDataForDifficulty(song, this.selectedDifficulty);
          let targetEffectIntensity = 0;
          if (chart.climaxRanges && chart.climaxRanges.length > 0) {
            for (const [start, end] of chart.climaxRanges) {
              if (songTime >= start && songTime <= end) {
                targetEffectIntensity = 1.0;
                break;
              }
            }
          }

          // Optional Density section effects: higher density in rest sections, smoothly lowers in climax to unfurl notes
          const currentDensity = this.evaluateCurrentDensity(chart, songTime);
          const currentCycles = chart.cycles || 1;

          let introProgress = 1.0;
          if (this.isGameplayIntroActive) {
            const elapsed = performance.now() - this.gameplayIntroStartTime;
            introProgress = Math.min(1.0, Math.max(0, elapsed / this.gameplayIntroDuration));
            if (introProgress >= 1.0) {
              this.isGameplayIntroActive = false;
            }
          }

          this.renderer.render(
            songTime,
            chart.rotationPeriod,
            this.judge.getNotes(),
            song.bpm,
            this.audio.getIsPlaying(),
            this.judge.stats.combo,
            true,
            targetEffectIntensity,
            currentDensity,
            currentCycles,
            chart.cycleEvents || [],
            introProgress
          );
        }
      } else if (this.currentScene === 'TITLE') {
        const time = performance.now() / 1000;
        this.renderer.renderTitle(time);
      } else if (this.currentScene === 'SELECT') {
        const time = performance.now() / 1000;

        // Smooth spring lerp for the Arc Wheel
        if (!this.isDragging) {
          this.wheelAngle += (this.targetWheelAngle - this.wheelAngle) * 0.14;
        }
        this.updateArcWheelPositions();

        // Calculate synchronized entrance offset from bottom edge matching extended CSS transitions
        const selectElapsed = (performance.now() - this.selectEnterTime) / 1000;
        const enterDuration = 1.35;
        let enterOffsetY = 0;
        if (selectElapsed < enterDuration) {
          const p = selectElapsed / enterDuration;
          const ease = 1 - Math.pow(1 - p, 4);
          const maxDist = Math.max(650, window.innerHeight * 0.5 + 350);
          enterOffsetY = (1 - ease) * maxDist;
        }

        const currentSong = this.songs[this.currentSongIndex];
        const accent = currentSong?.coverColor || DIFFICULTY_COLORS[this.selectedDifficulty];
        this.renderer.renderSelect(time, this.wheelAngle, accent, enterOffsetY);
      } else if (this.currentScene === 'RESULT') {
        const time = performance.now() / 1000;
        this.renderer.renderResult(time);
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

// Immediate Launch
function boot(): void {
  try {
    (window as any).gameApp = new GameManager();
  } catch (err) {
    console.error('Boot error:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
