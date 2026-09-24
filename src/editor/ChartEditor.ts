import { ChartData, NoteType } from '../types';
import { AudioEngine } from '../core/AudioEngine';
import { ClockRenderer } from '../render/ClockRenderer';

export class ChartEditor {
  public chart: ChartData;
  public audio: AudioEngine;
  public renderer: ClockRenderer;

  public currentTime = 0;
  public snapDiv = 4; // 4 = 1/4 beat, 8 = 1/8 beat, 16 = 1/16 beat
  public currentNoteType: NoteType = 'tap';
  public currentHoldDurationBeats = 1.0;
  public currentCycle = 0; // 0 = primary/inner track, 1 = outer track
  public isRecording = false;
  public hoverAngle: number | null = null;
  public songDuration = 60.0; // 60 seconds

  private nextNoteId = 1;
  private onUpdateCallback: (() => void) | null = null;

  constructor(chart: ChartData, audio: AudioEngine, renderer: ClockRenderer) {
    this.chart = chart;
    this.audio = audio;
    this.renderer = renderer;
    this.nextNoteId = chart.notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
  }

  public setChart(chart: ChartData): void {
    this.chart = chart;
    this.nextNoteId = chart.notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
    this.currentTime = 0;
    this.audio.seek(0);
    this.notifyUpdate();
  }

  public onUpdate(callback: () => void): void {
    this.onUpdateCallback = callback;
  }

  private notifyUpdate(): void {
    if (this.onUpdateCallback) this.onUpdateCallback();
  }

  public togglePlay(): void {
    if (this.audio.getIsPlaying()) {
      this.audio.pause();
      this.isRecording = false;
    } else {
      const totalBeats = Math.ceil(this.songDuration * (this.chart.bpm / 60));
      this.audio.play(this.chart.bpm, totalBeats, this.currentTime, this.chart.audioUrl, this.chart.offset || 0);
    }
    this.notifyUpdate();
  }

  public stop(): void {
    if (this.audio.getIsPlaying()) {
      this.audio.pause();
    }
    this.isRecording = false;
    this.hoverAngle = null;
    this.notifyUpdate();
  }

  public toggleRecord(): void {
    if (!this.audio.getIsPlaying()) {
      this.isRecording = true;
      this.togglePlay();
    } else {
      this.isRecording = !this.isRecording;
    }
    this.notifyUpdate();
  }

  public seek(time: number): void {
    this.currentTime = Math.max(0, Math.min(this.songDuration, time));
    this.audio.seek(this.currentTime);
    this.notifyUpdate();
  }

  public stepBeat(direction: number): void {
    const beatSec = 60 / this.chart.bpm;
    const stepSize = beatSec / (this.snapDiv / 4);
    this.seek(this.currentTime + direction * stepSize);
  }

  // Snaps angle to nearest subdivision
  public snapAngle(rawAngle: number): number {
    const totalTicks = this.snapDiv === 4 ? 4 : this.snapDiv === 8 ? 8 : 16;
    const degPerTick = 360 / totalTicks;
    return Math.round(rawAngle / degPerTick) * degPerTick % 360;
  }

  // Add a note at a specific angle and the current time
  public placeNoteAtAngle(rawAngle: number): void {
    const angle = this.snapAngle(rawAngle);

    // Calculate snapped time based on angle within the current measure
    const beatSec = 60 / this.chart.bpm;
    const measureDuration = beatSec * 4;
    const currentMeasure = Math.floor(this.currentTime / measureDuration);
    const measureStartTime = currentMeasure * measureDuration;

    // Angle 0° = 12 o'clock = 0 beats into measure; 90° = 1 beat, etc.
    const beatFraction = (angle / 360) * 4;
    const noteTime = measureStartTime + beatFraction * beatSec;

    // Check if a note already exists at this exact time
    const existingIndex = this.chart.notes.findIndex(n => Math.abs(n.time - noteTime) < 0.02);
    if (existingIndex !== -1) {
      // Delete existing note (toggle behavior)
      this.chart.notes.splice(existingIndex, 1);
    } else {
      // Add new note with current note type
      const duration = this.currentNoteType === 'hold'
        ? Math.round(this.currentHoldDurationBeats * beatSec * 1000) / 1000
        : undefined;

      this.chart.notes.push({
        id: this.nextNoteId++,
        time: Math.round(noteTime * 1000) / 1000,
        angle,
        type: this.currentNoteType,
        duration,
        cycle: this.currentCycle || undefined,
        judged: false
      });
      this.chart.notes.sort((a, b) => a.time - b.time);
      this.audio.playHitsound(true, this.currentNoteType);
    }

    this.notifyUpdate();
  }

  // Used during live recording when Space is pressed
  public recordHitAtCurrentTime(): void {
    const beatSec = 60 / this.chart.bpm;
    const stepSize = beatSec / (this.snapDiv / 4);

    // Quantize time to nearest grid division
    const snappedTime = Math.round(this.currentTime / stepSize) * stepSize;
    const measureDuration = beatSec * 4;
    const timeInMeasure = snappedTime % measureDuration;
    const angle = Math.round(((timeInMeasure / measureDuration) * 360) * 10) / 10;

    // Avoid duplicate note
    const exists = this.chart.notes.some(n => Math.abs(n.time - snappedTime) < 0.03);
    if (!exists) {
      const duration = this.currentNoteType === 'hold'
        ? Math.round(this.currentHoldDurationBeats * beatSec * 1000) / 1000
        : undefined;

      this.chart.notes.push({
        id: this.nextNoteId++,
        time: Math.round(snappedTime * 1000) / 1000,
        angle,
        type: this.currentNoteType,
        duration,
        cycle: this.currentCycle || undefined,
        judged: false
      });
      this.chart.notes.sort((a, b) => a.time - b.time);
      this.audio.playHitsound(true, this.currentNoteType);
      this.notifyUpdate();
    }
  }

  public deleteNote(id: number): void {
    this.chart.notes = this.chart.notes.filter(n => n.id !== id);
    this.notifyUpdate();
  }

  public clearAllNotes(): void {
    this.chart.notes = [];
    this.notifyUpdate();
  }

  public update(): void {
    if (this.audio.getIsPlaying()) {
      this.currentTime = this.audio.getSongTime();
      if (this.currentTime >= this.songDuration) {
        this.audio.pause();
        this.isRecording = false;
        this.notifyUpdate();
      }
    }
  }

  public render(): void {
    this.renderer.renderEditor(
      this.currentTime,
      this.chart.rotationPeriod,
      this.chart.notes,
      this.chart.bpm,
      this.snapDiv,
      this.hoverAngle,
      this.chart.cycles || 1,
      this.chart.cycleEvents || [],
      this.currentCycle || 0
    );
  }
}
