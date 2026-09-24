import { AudioEngine } from './core/AudioEngine';
import { ClockRenderer } from './render/ClockRenderer';
import { ChartEditor } from './editor/ChartEditor';
import { JudgeEngine } from './core/JudgeEngine';
import { ChartData, DifficultyType } from './types';
import { DIFFICULTY_COLORS, clampLevel, formatDifficultyLevel } from './core/Chart';

class StandaloneEditorApp {
  private canvas: HTMLCanvasElement;
  private audio: AudioEngine;
  private renderer: ClockRenderer;
  private judge: JudgeEngine;
  private editor: ChartEditor;

  private isTestPlay = false;

  // DOM Elements
  private fileInput: HTMLInputElement;
  private btnOpenFile: HTMLButtonElement;
  private btnSaveFile: HTMLButtonElement;
  private btnNewChart: HTMLButtonElement;
  private btnTestPlay: HTMLButtonElement;
  private btnBackToGame: HTMLButtonElement;

  private metaTitle: HTMLInputElement;
  private metaArtist: HTMLInputElement;
  private metaBpm: HTMLInputElement;
  private metaDiff: HTMLSelectElement;
  private metaLevel: HTMLInputElement;

  private edStats: HTMLElement;
  private lblCurrentTime: HTMLElement;
  private lblTotalTime: HTMLElement;
  private sliderTimeline: HTMLInputElement;

  private btnPlayPause: HTMLButtonElement;
  private btnRecord: HTMLButtonElement;
  private btnClearNotes: HTMLButtonElement;

  private btnCycle0: HTMLButtonElement | null = null;
  private btnCycle1: HTMLButtonElement | null = null;
  private chkEnableCycle1: HTMLInputElement | null = null;
  private inpCycle1Start: HTMLInputElement | null = null;
  private btnSetCycle1Start: HTMLButtonElement | null = null;
  private inpCycle1End: HTMLInputElement | null = null;
  private btnSetCycle1End: HTMLButtonElement | null = null;

  constructor() {
    this.canvas = document.getElementById('editorCanvas') as HTMLCanvasElement;
    if (!this.canvas) throw new Error('Canvas not found');

    this.audio = new AudioEngine();
    this.renderer = new ClockRenderer(this.canvas);
    this.judge = new JudgeEngine();

    // Default Initial Chart
    const defaultChart: ChartData = {
      id: 'custom-chart-' + Date.now(),
      title: 'My Rhythm Chart',
      artist: 'Composer',
      bpm: 120,
      difficulty: 'NORMAL',
      level: 5.0,
      color: '#f39c12',
      offset: 2.0,
      rotationPeriod: 2.0,
      notes: []
    };

    this.editor = new ChartEditor(defaultChart, this.audio, this.renderer);

    // Bind Elements
    this.fileInput = document.getElementById('fileInput') as HTMLInputElement;
    this.btnOpenFile = document.getElementById('btnOpenFile') as HTMLButtonElement;
    this.btnSaveFile = document.getElementById('btnSaveFile') as HTMLButtonElement;
    this.btnNewChart = document.getElementById('btnNewChart') as HTMLButtonElement;
    this.btnTestPlay = document.getElementById('btnTestPlay') as HTMLButtonElement;
    this.btnBackToGame = document.getElementById('btnBackToGame') as HTMLButtonElement;

    this.metaTitle = document.getElementById('metaTitle') as HTMLInputElement;
    this.metaArtist = document.getElementById('metaArtist') as HTMLInputElement;
    this.metaBpm = document.getElementById('metaBpm') as HTMLInputElement;
    this.metaDiff = document.getElementById('metaDiff') as HTMLSelectElement;
    this.metaLevel = document.getElementById('metaLevel') as HTMLInputElement;

    this.edStats = document.getElementById('edStats') as HTMLElement;
    this.lblCurrentTime = document.getElementById('lblCurrentTime') as HTMLElement;
    this.lblTotalTime = document.getElementById('lblTotalTime') as HTMLElement;
    this.sliderTimeline = document.getElementById('sliderTimeline') as HTMLInputElement;

    this.btnPlayPause = document.getElementById('btnPlayPause') as HTMLButtonElement;
    this.btnRecord = document.getElementById('btnRecord') as HTMLButtonElement;
    this.btnClearNotes = document.getElementById('btnClearNotes') as HTMLButtonElement;

    this.btnCycle0 = document.getElementById('btnCycle0') as HTMLButtonElement | null;
    this.btnCycle1 = document.getElementById('btnCycle1') as HTMLButtonElement | null;
    this.chkEnableCycle1 = document.getElementById('chkEnableCycle1') as HTMLInputElement | null;
    this.inpCycle1Start = document.getElementById('inpCycle1Start') as HTMLInputElement | null;
    this.btnSetCycle1Start = document.getElementById('btnSetCycle1Start') as HTMLButtonElement | null;
    this.inpCycle1End = document.getElementById('inpCycle1End') as HTMLInputElement | null;
    this.btnSetCycle1End = document.getElementById('btnSetCycle1End') as HTMLButtonElement | null;

    this.syncInputsFromChart();
    this.setupEvents();
    this.startLoop();
  }

  public syncCycleButtons(): void {
    if (this.btnCycle0 && this.btnCycle1) {
      if (this.editor.currentCycle === 1) {
        this.btnCycle1.classList.add('selected');
        this.btnCycle0.classList.remove('selected');
      } else {
        this.btnCycle0.classList.add('selected');
        this.btnCycle1.classList.remove('selected');
      }
    }
  }

  private syncInputsFromChart(): void {
    const c = this.editor.chart;
    this.metaTitle.value = c.title || '';
    this.metaArtist.value = c.artist || '';
    this.metaBpm.value = (c.bpm || 120).toString();
    this.metaDiff.value = (c.difficulty as string) || 'NORMAL';
    this.metaLevel.value = formatDifficultyLevel(c.level || 5);

    const hasCycle1 = (c.cycles && c.cycles > 1) || (c.cycleEvents && c.cycleEvents.length > 0) || c.notes.some(n => n.cycle === 1);
    if (this.chkEnableCycle1) {
      this.chkEnableCycle1.checked = !!hasCycle1;
    }
    const ev1 = c.cycleEvents?.find(e => e.cycle === 1);
    if (this.inpCycle1Start) {
      this.inpCycle1Start.value = ev1 ? ev1.startTime.toString() : '0.0';
    }
    if (this.inpCycle1End) {
      this.inpCycle1End.value = ev1 ? ev1.endTime.toString() : '60.0';
    }
    this.syncCycleButtons();
  }

  private applyInputsToChart(): void {
    const bpm = Math.max(30, Math.min(300, parseInt(this.metaBpm.value, 10) || 120));
    this.editor.chart.title = this.metaTitle.value.trim() || 'Untitled';
    this.editor.chart.artist = this.metaArtist.value.trim() || 'Unknown';
    this.editor.chart.bpm = bpm;
    const diff = (this.metaDiff.value as DifficultyType) || 'NORMAL';
    this.editor.chart.difficulty = diff;
    this.editor.chart.level = clampLevel(this.metaLevel.value);
    this.editor.chart.color = DIFFICULTY_COLORS[diff] || '#f39c12';
    this.editor.chart.rotationPeriod = (60 / bpm) * 4;

    if (this.chkEnableCycle1 && this.chkEnableCycle1.checked) {
      this.editor.chart.cycles = 2;
      const s = parseFloat(this.inpCycle1Start?.value || '0') || 0;
      const e = parseFloat(this.inpCycle1End?.value || '60') || 60;
      this.editor.chart.cycleEvents = [
        { cycle: 1, startTime: s, endTime: e, targetRadiusOffset: 48 }
      ];
    } else {
      this.editor.chart.cycles = 1;
      this.editor.chart.cycleEvents = [];
    }
  }

  private setupEvents(): void {
    // 1. FILE UPLOAD (Open)
    this.btnOpenFile.addEventListener('click', () => {
      this.fileInput.value = '';
      this.fileInput.click();
    });

    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0];
      if (file) this.loadFile(file);
    });

    // Drag & Drop
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files[0];
      if (file && file.name.endsWith('.json')) {
        this.loadFile(file);
      }
    });

    // 2. FILE DOWNLOAD (Save)
    this.btnSaveFile.addEventListener('click', () => {
      this.applyInputsToChart();
      const c = this.editor.chart;
      const diffKey = ((c.difficulty as string) || 'NORMAL').toUpperCase();

      const fullChart = {
        id: c.id || ('custom_' + Date.now()),
        title: c.title || 'Untitled',
        artist: c.artist || 'Unknown Artist',
        bpm: c.bpm,
        offset: c.offset || 2.0,
        rotationPeriod: c.rotationPeriod,
        coverColor: c.color,
        cycles: c.cycles || 1,
        cycleEvents: c.cycleEvents || [],
        difficulties: {
          [diffKey]: {
            level: c.level,
            notes: c.notes,
            color: c.color,
            rotationPeriod: c.rotationPeriod,
            cycles: c.cycles || 1,
            cycleEvents: c.cycleEvents || []
          }
        },
        // Root fallback compatibility
        difficulty: diffKey,
        level: c.level,
        color: c.color,
        notes: c.notes
      };

      const jsonStr = JSON.stringify(fullChart, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (c.title || 'chart').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      a.download = `${safeName}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // 3. NEW CHART
    this.btnNewChart.addEventListener('click', () => {
      if (this.editor.chart.notes.length > 0 && !confirm('确定要新建空白谱面吗？未保存的音符将被清空。')) {
        return;
      }
      this.editor.stop();
      const newChart: ChartData = {
        id: 'chart-' + Date.now(),
        title: 'New Chart',
        artist: 'Artist',
        bpm: 120,
        difficulty: 'NORMAL',
        level: 5,
        color: '#ffeaa7',
        offset: 2.0,
        rotationPeriod: 2.0,
        notes: []
      };
      this.editor.setChart(newChart);
      this.syncInputsFromChart();
    });

    // 4. TEST PLAY TOGGLE
    this.btnTestPlay.addEventListener('click', () => {
      this.applyInputsToChart();
      this.isTestPlay = !this.isTestPlay;
      if (this.isTestPlay) {
        this.btnTestPlay.classList.add('active');
        this.btnTestPlay.innerText = '⏹ 退出试玩';
        this.judge.loadChart(this.editor.chart);
        this.audio.seek(0);
        this.editor.currentTime = 0;
        this.editor.togglePlay();
      } else {
        this.btnTestPlay.classList.remove('active');
        this.btnTestPlay.innerText = '🎮 试玩当前谱面';
        this.editor.stop();
      }
    });

    // 5. OPEN GAME
    this.btnBackToGame.addEventListener('click', () => {
      window.open('game.html', '_blank') || (window.location.href = 'game.html');
    });

    // Metadata changes
    [this.metaTitle, this.metaArtist, this.metaBpm, this.metaDiff, this.metaLevel].forEach(el => {
      el.addEventListener('change', () => this.applyInputsToChart());
    });

    // 6. PLAY / PAUSE / RECORD
    this.btnPlayPause.addEventListener('click', () => {
      this.applyInputsToChart();
      this.editor.togglePlay();
      this.btnPlayPause.innerText = this.audio.getIsPlaying() ? '⏸ 暂停' : '▶ 播放预览';
    });

    this.btnRecord.addEventListener('click', () => {
      this.applyInputsToChart();
      this.editor.toggleRecord();
      if (this.editor.isRecording) {
        this.btnRecord.classList.add('active');
        this.btnRecord.innerText = '🔴 录制中 (按空格打点)';
        this.btnPlayPause.innerText = '⏸ 暂停';
      } else {
        this.btnRecord.classList.remove('active');
        this.btnRecord.innerText = '🔴 实时打点录谱';
        this.btnPlayPause.innerText = '▶ 播放预览';
      }
    });

    this.btnClearNotes.addEventListener('click', () => {
      if (confirm('确定清空当前谱面的所有音符吗？')) {
        this.editor.clearAllNotes();
      }
    });

    // Timeline Scrub
    this.sliderTimeline.addEventListener('input', () => {
      this.editor.seek(parseFloat(this.sliderTimeline.value));
    });

    // Note Type buttons (TAP, HOLD, TOUCH)
    const holdBeatsGroup = document.getElementById('holdBeatsGroup');
    const selHoldBeats = document.getElementById('selHoldBeats') as HTMLSelectElement;

    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('selected');
        const type = (target.getAttribute('data-type') || 'tap') as any;
        this.editor.currentNoteType = type;

        if (holdBeatsGroup) {
          holdBeatsGroup.style.display = type === 'hold' ? 'flex' : 'none';
        }
      });
    });

    if (selHoldBeats) {
      selHoldBeats.addEventListener('change', () => {
        this.editor.currentHoldDurationBeats = parseFloat(selHoldBeats.value) || 1.0;
      });
    }

    // Snap buttons
    document.querySelectorAll('.snap-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.snap-btn').forEach(b => b.classList.remove('selected'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('selected');
        this.editor.snapDiv = parseInt(target.getAttribute('data-snap') || '4', 10);
      });
    });

    // Cycle buttons (C0, C1)
    if (this.btnCycle0) {
      this.btnCycle0.addEventListener('click', () => {
        this.editor.currentCycle = 0;
        this.syncCycleButtons();
      });
    }
    if (this.btnCycle1) {
      this.btnCycle1.addEventListener('click', () => {
        this.editor.currentCycle = 1;
        this.syncCycleButtons();
      });
    }
    if (this.chkEnableCycle1) {
      this.chkEnableCycle1.addEventListener('change', () => this.applyInputsToChart());
    }
    if (this.inpCycle1Start) {
      this.inpCycle1Start.addEventListener('change', () => this.applyInputsToChart());
    }
    if (this.inpCycle1End) {
      this.inpCycle1End.addEventListener('change', () => this.applyInputsToChart());
    }
    if (this.btnSetCycle1Start) {
      this.btnSetCycle1Start.addEventListener('click', () => {
        if (this.inpCycle1Start) {
          this.inpCycle1Start.value = this.editor.currentTime.toFixed(2);
          this.applyInputsToChart();
        }
      });
    }
    if (this.btnSetCycle1End) {
      this.btnSetCycle1End.addEventListener('click', () => {
        if (this.inpCycle1End) {
          this.inpCycle1End.value = this.editor.currentTime.toFixed(2);
          this.applyInputsToChart();
        }
      });
    }

    // 7. CANVAS CLICK & HOVER
    this.canvas.addEventListener('pointerdown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (this.isTestPlay) {
        if (!this.audio.getIsPlaying()) {
          this.editor.togglePlay();
          return;
        }
        this.judge.handleInputDown(this.audio.getSongTime(), {
          x: mouseX,
          y: mouseY
        });
        return;
      }

      const cx = this.renderer.centerX;
      const cy = this.renderer.centerY;
      const dx = mouseX - cx;
      const dy = mouseY - cy;
      const dist = Math.hypot(dx, dy);

      const c0State = this.renderer.getCycleState(0, this.editor.currentTime, this.renderer.trackRadius, this.editor.chart.cycleEvents, this.editor.chart.cycles);
      const c1State = this.renderer.getCycleState(1, this.editor.currentTime, this.renderer.trackRadius, this.editor.chart.cycleEvents, this.editor.chart.cycles);

      const d0 = Math.abs(dist - c0State.radius);
      const d1 = (c1State.visible && c1State.opacity > 0.05) ? Math.abs(dist - c1State.radius) : 999;

      if (d0 < 36 || d1 < 36) {
        let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        if (deg < 0) deg += 360;
        if (d1 < d0 && d1 < 36) {
          this.editor.currentCycle = 1;
          this.syncCycleButtons();
        } else if (d0 < d1 && d0 < 36 && this.editor.chart.cycles && this.editor.chart.cycles > 1) {
          if (this.editor.currentCycle === 1 && d1 >= 36) {
            this.editor.currentCycle = 0;
            this.syncCycleButtons();
          }
        }
        this.editor.placeNoteAtAngle(deg);
      } else if (dist < 40) {
        this.btnPlayPause.click();
      }
    });

    window.addEventListener('pointerup', () => {
      if (this.isTestPlay) {
        this.judge.handleInputUp(this.audio.getSongTime());
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isTestPlay) {
        this.editor.hoverAngle = null;
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const dx = mouseX - this.renderer.centerX;
      const dy = mouseY - this.renderer.centerY;
      const dist = Math.hypot(dx, dy);

      const targetCycle = this.editor.currentCycle || 0;
      const cycleState = this.renderer.getCycleState(
        targetCycle,
        this.editor.currentTime,
        this.renderer.trackRadius,
        this.editor.chart.cycleEvents,
        this.editor.chart.cycles
      );

      if (Math.abs(dist - cycleState.radius) < 40) {
        let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        if (deg < 0) deg += 360;
        this.editor.hoverAngle = this.editor.snapAngle(deg);
      } else {
        this.editor.hoverAngle = null;
      }
    });

    // 8. KEYBOARD
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.repeat) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (this.isTestPlay) {
          if (!this.audio.getIsPlaying()) {
            this.editor.togglePlay();
            return;
          }
          this.judge.handleInputDown(this.audio.getSongTime());
          return;
        }

        if (this.editor.isRecording) {
          this.editor.recordHitAtCurrentTime();
        } else {
          this.editor.togglePlay();
          this.btnPlayPause.innerText = this.audio.getIsPlaying() ? '⏸ 暂停' : '▶ 播放预览';
        }
      } else if (e.code === 'ArrowLeft') {
        this.editor.stepBeat(-1);
      } else if (e.code === 'ArrowRight') {
        this.editor.stepBeat(1);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' && this.isTestPlay) {
        this.judge.handleInputUp(this.audio.getSongTime());
      }
    });

    // Judge callback for test play
    this.judge.onJudgeCallback = (res) => {
      if (res.grade !== 'MISS') {
        if (res.isHoldTick) {
          this.audio.playHoldTick();
        } else if (res.isHoldComplete) {
          this.audio.playHoldComplete();
        } else {
          this.audio.playHitsound(res.grade === 'PERFECT', res.note.type);
        }
      }
      this.renderer.triggerHit(res);
    };

    // Editor update
    this.editor.onUpdate(() => {
      this.updateUI();
    });
  }

  private loadFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const raw = JSON.parse(text);
        if (!raw.bpm) throw new Error('Missing BPM field in JSON');

        const id = raw.id || 'chart_' + Date.now();
        const title = raw.title || 'Untitled';
        const artist = raw.artist || 'Unknown';
        const bpm = Number(raw.bpm) || 120;
        const offset = Number(raw.offset || 2.0);
        const rotationPeriod = Number(raw.rotationPeriod || (60 / bpm) * 4);

        let diff: any = (raw.difficulty || 'NORMAL').toUpperCase();
        let level: string | number = 5;
        let notes: any[] = [];
        let dObj: any = null;

        if (raw.difficulties && typeof raw.difficulties === 'object') {
          const availableDiffs = Object.keys(raw.difficulties);
          if (!raw.difficulties[diff] && availableDiffs.length > 0) {
            diff = availableDiffs[0].toUpperCase();
          }
          dObj = raw.difficulties[diff];
          if (dObj) {
            level = clampLevel(Number(dObj.level || 5.0));
            notes = dObj.notes || [];
          }
        } else if (Array.isArray(raw.notes)) {
          level = clampLevel(Number(raw.level || 5.0));
          notes = raw.notes;
        }

        const loadedChart: ChartData = {
          id,
          title,
          artist,
          bpm,
          offset,
          rotationPeriod,
          difficulty: diff,
          level,
          color: (DIFFICULTY_COLORS as any)[diff] || '#f39c12',
          cycles: dObj?.cycles || raw.cycles || (notes.some((n: any) => n.cycle && n.cycle > 0) ? 2 : 1),
          cycleEvents: dObj?.cycleEvents || raw.cycleEvents || [],
          notes: notes.map((n: any, idx: number) => ({
            id: n.id || idx + 1,
            time: Number(n.time),
            angle: Number(n.angle),
            type: n.type || 'tap',
            duration: n.duration !== undefined ? Number(n.duration) : undefined,
            cycle: n.cycle !== undefined ? Number(n.cycle) : undefined,
            judged: false
          })).sort((a: any, b: any) => a.time - b.time)
        };

        this.editor.setChart(loadedChart);
        this.syncInputsFromChart();
        this.updateUI();
        alert(`成功打开谱面文件：《${loadedChart.title}》 [${diff}]！`);
      } catch (err: any) {
        alert('读取谱面文件失败: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  private updateUI(): void {
    const noteCount = this.editor.chart.notes.length;
    const cur = this.editor.currentTime;
    const total = this.editor.songDuration;

    this.edStats.innerText = `NOTES: ${noteCount} • ${cur.toFixed(2)}s / ${total.toFixed(2)}s`;
    this.lblCurrentTime.innerText = `${cur.toFixed(2)}s`;
    this.lblTotalTime.innerText = `${total.toFixed(2)}s`;
    this.sliderTimeline.value = cur.toString();
  }

  private startLoop(): void {
    const loop = () => {
      if (this.isTestPlay) {
        const songTime = this.audio.getSongTime();
        if (this.audio.getIsPlaying()) {
          this.judge.update(songTime);
        }
        this.renderer.render(
          songTime,
          this.editor.chart.rotationPeriod,
          this.judge.getNotes(),
          this.editor.chart.bpm,
          this.audio.getIsPlaying(),
          this.judge.stats.combo,
          true,
          0,
          1.0,
          this.editor.chart.cycles || 1,
          this.editor.chart.cycleEvents || []
        );
      } else {
        this.editor.update();
        this.editor.render();
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

// Boot Editor
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new StandaloneEditorApp());
} else {
  new StandaloneEditorApp();
}
