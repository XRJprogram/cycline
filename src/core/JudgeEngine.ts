import { ChartData, Note, JudgeGrade, JudgeResult, GameStats, ResultSummary, RankGrade, BadgeGrade } from '../types';

export interface JudgeConfig {
  perfectWindowMs: number;
  greatWindowMs: number;
  goodWindowMs: number;
}

export class JudgeEngine {
  private notes: Note[] = [];
  public totalNotes = 0;
  private config: JudgeConfig = {
    perfectWindowMs: 40,
    greatWindowMs: 80,
    goodWindowMs: 120,
  };

  public isFC = true;
  public isAP = true;

  public stats: GameStats = {
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfectCount: 0,
    greatCount: 0,
    goodCount: 0,
    missCount: 0,
    totalNotes: 0
  };

  public isAutoPlay = false;
  public onJudgeCallback: ((result: JudgeResult) => void) | null = null;

  public loadChart(chart: ChartData): void {
    this.notes = chart.notes.map(n => ({
      ...n,
      judged: false,
      holding: false,
      holdCompleted: false,
      holdProgress: 0
    }));
    this.totalNotes = this.notes.length;
    this.lastSongTime = -1;
    this.resetStats();
  }

  public resetStats(): void {
    this.lastSongTime = -1;
    this.isFC = true;
    this.isAP = true;
    this.stats = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfectCount: 0,
      greatCount: 0,
      goodCount: 0,
      missCount: 0,
      totalNotes: this.totalNotes
    };
    for (const note of this.notes) {
      note.judged = false;
      note.grade = undefined;
      note.deltaMs = undefined;
      note.holding = false;
      note.holdCompleted = false;
      note.holdProgress = 0;
      note.lastTickTime = undefined;
      note.touchHit = false;
      note.pendingJudgeResult = undefined;
    }
  }

  public isInputActive = false;
  public activePointerPos?: { x: number; y: number };
  public getNoteCanvasPos?: (note: Note, songTime: number) => { x: number; y: number };
  public getNoteTargetPos?: (note: Note) => { x: number; y: number };
  private lastSongTime = -1;

  public update(songTime: number): void {
    const goodWindowSec = this.config.goodWindowMs / 1000;

    // Detect large frame / background time jumps (e.g. returning to tab after switching pages)
    const isBigJump = this.lastSongTime >= 0 && (songTime - this.lastSongTime > 0.35);
    this.lastSongTime = songTime;

    if (isBigJump) {
      // Quietly sweep past notes that expired during the gap without blasting overlapping audio or visual effects
      for (let i = 0; i < this.notes.length; i++) {
        const note = this.notes[i];
        if (note.judged) continue;
        const holdDur = note.type === 'hold' ? (note.duration || 1.0) : 0;
        if (songTime - (note.time + holdDur) > goodWindowSec) {
          note.judged = true;
          note.grade = 'MISS';
          this.stats.missCount++;
          this.stats.combo = 0;
        }
      }
      this.updateScore();
      return;
    }

    for (let i = 0; i < this.notes.length; i++) {
      const note = this.notes[i];

      // AutoPlay Logic
      if (this.isAutoPlay) {
        if (!note.judged) {
          if (note.type === 'hold') {
            const holdDur = note.duration || 1.0;
            if (!note.holding && songTime >= note.time) {
              note.holding = true;
              note.lastTickTime = note.time;
              this.judgeHoldStart(note, 'PERFECT', 0);
            }
            if (note.holding) {
              if (songTime - (note.lastTickTime || note.time) >= 0.12) {
                note.lastTickTime = songTime;
                this.judgeHoldTick(note);
              }
              if (songTime >= note.time + holdDur) {
                note.holding = false;
                note.holdCompleted = true;
                note.judged = true;
                this.judgeHoldComplete(note);
              }
            }
          } else {
            // Tap / Touch
            if (songTime >= note.time) {
              this.judgeNote(note, 'PERFECT', 0);
            }
          }
        }
        continue;
      }

      // Human Player - Touch Notes:
      // Hit judgment window is [-120ms, 120ms].
      // If a hit is judged before the note reaches its target position (songTime < note.time):
      // the note disappears immediately and triggers effects at the 0ms position (the note's actual target location).
      // Hits after the target position (songTime >= note.time) are judged normally.
      if (note.type === 'touch') {
        const deltaMs = (songTime - note.time) * 1000;

        // 1. Hit check within [-120ms, 120ms]
        if (!note.judged && !note.touchHit && deltaMs >= -120 && deltaMs <= 120) {
          let isHit = false;
          if (this.isInputActive) {
            if (this.activePointerPos) {
              let distCurrent = Infinity;
              let distTarget = Infinity;
              if (this.getNoteCanvasPos) {
                const pos = this.getNoteCanvasPos(note, songTime);
                distCurrent = Math.hypot(this.activePointerPos.x - pos.x, this.activePointerPos.y - pos.y);
              }
              if (this.getNoteTargetPos) {
                const tpos = this.getNoteTargetPos(note);
                distTarget = Math.hypot(this.activePointerPos.x - tpos.x, this.activePointerPos.y - tpos.y);
              } else if (this.getNoteCanvasPos) {
                const tpos = this.getNoteCanvasPos(note, note.time);
                distTarget = Math.hypot(this.activePointerPos.x - tpos.x, this.activePointerPos.y - tpos.y);
              }
              if (distCurrent <= 65 || distTarget <= 65) isHit = true;
            } else {
              // Keyboard holding key or pressing key
              isHit = true;
            }
          }

          if (isHit) {
            note.touchHit = true;
            note.judged = true;
            note.grade = 'PERFECT';
            this.stats.perfectCount++;
            this.stats.combo++;
            if (this.stats.combo > this.stats.maxCombo) {
              this.stats.maxCombo = this.stats.combo;
            }
            this.updateScore();

            let hitX: number | undefined;
            let hitY: number | undefined;
            if (songTime < note.time) {
              // Hit judged before target position: trigger effects at 0ms position (the note's actual location)
              if (this.getNoteTargetPos) {
                const tp = this.getNoteTargetPos(note);
                hitX = tp.x;
                hitY = tp.y;
              } else if (this.getNoteCanvasPos) {
                const tp = this.getNoteCanvasPos(note, note.time);
                hitX = tp.x;
                hitY = tp.y;
              }
            } else {
              // Hits after the target position judged normally
              if (this.activePointerPos) {
                hitX = this.activePointerPos.x;
                hitY = this.activePointerPos.y;
              } else if (this.getNoteCanvasPos) {
                const cp = this.getNoteCanvasPos(note, songTime);
                hitX = cp.x;
                hitY = cp.y;
              }
            }

            const res: JudgeResult = {
              note,
              grade: 'PERFECT',
              deltaMs,
              scoreAdded: 500,
              combo: this.stats.combo,
              hitX,
              hitY
            };

            // If hit early (songTime < note.time):
            // The note renders until reaching actual target position, and audio & visual judgement effects
            // also trigger when reaching target position (0ms moment).
            if (songTime >= note.time) {
              if (this.onJudgeCallback) this.onJudgeCallback(res);
            } else {
              note.pendingJudgeResult = res;
            }
            continue;
          }
        }

        // 2. Delayed visual & audio effect trigger: fires when note reaches actual target position (songTime >= note.time)
        if (note.touchHit && note.pendingJudgeResult && songTime >= note.time) {
          if (this.onJudgeCallback) {
            this.onJudgeCallback(note.pendingJudgeResult);
          }
          note.pendingJudgeResult = undefined;
          continue;
        }

        // 3. Timeout Miss after +120ms
        if (!note.judged && !note.touchHit && deltaMs > 120) {
          this.judgeNote(note, 'MISS', deltaMs);
          continue;
        }
      }

      // Human Player - Hold Notes: Automatic lock-on if player is holding input when needle enters hold note
      if (!note.judged && note.type === 'hold' && !note.holding && this.isInputActive) {
        const holdDur = note.duration || 1.0;
        if (songTime >= note.time - 0.08 && songTime < note.time + holdDur) {
          note.holding = true;
          note.lastTickTime = songTime;
          this.judgeHoldStart(note, 'PERFECT', (songTime - note.time) * 1000);
          continue;
        }
      }

      // Human Player: Active Holding Logic
      if (note.type === 'hold' && note.holding && !note.holdCompleted) {
        const holdDur = note.duration || 1.0;
        const endTime = note.time + holdDur;

        // If player released input while holding
        if (!this.isInputActive) {
          const remainSec = endTime - songTime;
          note.holding = false;

          // Release grace window (last 0.2s count as complete)
          if (remainSec <= 0.2) {
            note.holdCompleted = true;
            note.judged = true;
            this.judgeHoldComplete(note);
          } else {
            note.judged = true;
            note.grade = 'MISS';
            this.isAP = false;
            this.isFC = false;
            this.stats.missCount++;
            this.stats.combo = 0;
            this.updateScore();

            const result: JudgeResult = {
              note,
              grade: 'MISS',
              deltaMs: remainSec * 1000,
              scoreAdded: 0,
              combo: 0
            };
            if (this.onJudgeCallback) this.onJudgeCallback(result);
          }
          continue;
        }

        // Still holding: update progress & tick
        const progress = Math.min(1, Math.max(0, (songTime - note.time) / holdDur));
        note.holdProgress = progress;

        // Periodic Tick every 0.12s
        if (songTime - (note.lastTickTime || note.time) >= 0.12) {
          note.lastTickTime = songTime;
          this.judgeHoldTick(note);
        }

        // Completion while holding
        if (songTime >= endTime) {
          note.holding = false;
          note.holdCompleted = true;
          note.judged = true;
          this.judgeHoldComplete(note);
        }
        continue;
      }

      // Miss timeout for unjudged notes
      if (!note.judged && !note.holding && note.type !== 'touch') {
        const holdDur = note.type === 'hold' ? (note.duration || 1.0) : 0;
        if (songTime - (note.time + holdDur) > goodWindowSec) {
          this.judgeNote(note, 'MISS', (songTime - note.time) * 1000);
        }
      }
    }
  }

  /**
   * Called when player presses down (key or pointer)
   */
  public handleInputDown(
    songTime: number,
    hitPos?: { x: number; y: number }
  ): JudgeResult | null {
    this.isInputActive = true;
    if (hitPos) this.activePointerPos = hitPos;
    if (this.isAutoPlay) return null;

    const goodWindowSec = this.config.goodWindowMs / 1000;

    // 1. Touch-specific targeting (pointer tap or key tap)
    for (let i = 0; i < this.notes.length; i++) {
      const note = this.notes[i];
      if (note.judged || note.touchHit || note.type !== 'touch') continue;

      const deltaMs = (songTime - note.time) * 1000;
      if (deltaMs >= -120 && deltaMs <= 120) {
        let isHit = false;
        if (hitPos) {
          let distCurrent = Infinity;
          let distTarget = Infinity;
          if (this.getNoteCanvasPos) {
            const pos = this.getNoteCanvasPos(note, songTime);
            distCurrent = Math.hypot(hitPos.x - pos.x, hitPos.y - pos.y);
          }
          if (this.getNoteTargetPos) {
            const tpos = this.getNoteTargetPos(note);
            distTarget = Math.hypot(hitPos.x - tpos.x, hitPos.y - tpos.y);
          } else if (this.getNoteCanvasPos) {
            const tpos = this.getNoteCanvasPos(note, note.time);
            distTarget = Math.hypot(hitPos.x - tpos.x, hitPos.y - tpos.y);
          }
          if (distCurrent <= 65 || distTarget <= 65) isHit = true;
        } else {
          isHit = true; // Key down
        }

        if (isHit) {
          note.touchHit = true;
          note.judged = true;
          note.grade = 'PERFECT';
          this.stats.perfectCount++;
          this.stats.combo++;
          if (this.stats.combo > this.stats.maxCombo) {
            this.stats.maxCombo = this.stats.combo;
          }
          this.updateScore();

          let hitX: number | undefined;
          let hitY: number | undefined;
          if (songTime < note.time) {
            // Hit judged before target position: trigger effects at 0ms position (the note's actual location)
            if (this.getNoteTargetPos) {
              const tp = this.getNoteTargetPos(note);
              hitX = tp.x;
              hitY = tp.y;
            } else if (this.getNoteCanvasPos) {
              const tp = this.getNoteCanvasPos(note, note.time);
              hitX = tp.x;
              hitY = tp.y;
            }
          } else {
            // Hits after the target position judged normally
            if (hitPos) {
              hitX = hitPos.x;
              hitY = hitPos.y;
            } else if (this.getNoteCanvasPos) {
              const cp = this.getNoteCanvasPos(note, songTime);
              hitX = cp.x;
              hitY = cp.y;
            }
          }

          const res: JudgeResult = {
            note,
            grade: 'PERFECT',
            deltaMs,
            scoreAdded: 500,
            combo: this.stats.combo,
            hitX,
            hitY
          };

          if (songTime >= note.time) {
            if (this.onJudgeCallback) this.onJudgeCallback(res);
          } else {
            note.pendingJudgeResult = res;
          }
          return res;
        }
      }
    }

    // 2. Needle-sweep targeting (keyboard or standard pointer) for TAP and HOLD notes
    let targetNote: Note | null = null;
    let minDelta = Infinity;

    for (let i = 0; i < this.notes.length; i++) {
      const note = this.notes[i];
      if (note.judged || (note.type === 'hold' && note.holding) || note.type === 'touch') continue;

      const delta = songTime - note.time;
      const absDelta = Math.abs(delta);

      if (absDelta <= goodWindowSec) {
        if (absDelta < minDelta) {
          minDelta = absDelta;
          targetNote = note;
        }
      } else if (note.time - songTime > goodWindowSec) {
        break;
      }
    }

    if (!targetNote) return null;
    return this.evaluateNoteHit(targetNote, songTime);
  }

  private evaluateNoteHit(note: Note, songTime: number): JudgeResult {
    const deltaMs = (songTime - note.time) * 1000;
    const absMs = Math.abs(deltaMs);

    if (note.type === 'touch') {
      return this.judgeNote(note, 'PERFECT', deltaMs);
    }

    let grade: JudgeGrade = 'MISS';
    if (absMs <= this.config.perfectWindowMs) {
      grade = 'PERFECT';
    } else if (absMs <= this.config.greatWindowMs) {
      grade = 'GREAT';
    } else if (absMs <= this.config.goodWindowMs) {
      grade = 'GOOD';
    }

    if (note.type === 'hold') {
      if (grade === 'MISS') {
        return this.judgeNote(note, 'MISS', deltaMs);
      }
      note.holding = true;
      note.lastTickTime = songTime;
      return this.judgeHoldStart(note, grade, deltaMs);
    }

    return this.judgeNote(note, grade, deltaMs);
  }

  /**
   * Called when player releases (key up or pointer up)
   */
  public handleInputUp(songTime: number): JudgeResult | null {
    this.isInputActive = false;
    this.activePointerPos = undefined;
    if (this.isAutoPlay) return null;

    let releasedResult: JudgeResult | null = null;

    for (let i = 0; i < this.notes.length; i++) {
      const note = this.notes[i];
      if (note.type === 'hold' && note.holding && !note.holdCompleted) {
        const holdDur = note.duration || 1.0;
        const endTime = note.time + holdDur;
        const remainSec = endTime - songTime;

        note.holding = false;

        // Release grace window: if remaining duration <= 0.2s, count as completed!
        if (remainSec <= 0.2) {
          note.holdCompleted = true;
          note.judged = true;
          releasedResult = this.judgeHoldComplete(note);
        } else {
          // Dropped too early
          note.judged = true;
          note.grade = 'MISS';
          this.isAP = false;
          this.isFC = false;
          this.stats.missCount++;
          this.stats.combo = 0;
          this.updateScore();

          const result: JudgeResult = {
            note,
            grade: 'MISS',
            deltaMs: remainSec * 1000,
            scoreAdded: 0,
            combo: 0
          };
          if (this.onJudgeCallback) this.onJudgeCallback(result);
          releasedResult = result;
        }
      }
    }

    return releasedResult;
  }

  private judgeHoldStart(note: Note, grade: JudgeGrade, deltaMs: number): JudgeResult {
    note.grade = grade;
    note.deltaMs = deltaMs;

    if (grade !== 'PERFECT') {
      this.isAP = false;
    }
    if (grade === 'MISS') {
      this.isFC = false;
    }

    this.stats.combo++;
    if (this.stats.combo > this.stats.maxCombo) {
      this.stats.maxCombo = this.stats.combo;
    }

    if (grade === 'PERFECT') this.stats.perfectCount++;
    else if (grade === 'GREAT') this.stats.greatCount++;
    else this.stats.goodCount++;

    let hitX: number | undefined;
    let hitY: number | undefined;
    if (this.getNoteCanvasPos) {
      const p = this.getNoteCanvasPos(note, note.time);
      hitX = p.x;
      hitY = p.y;
    }

    const result: JudgeResult = {
      note,
      grade,
      deltaMs,
      scoreAdded: 500,
      combo: this.stats.combo,
      hitX,
      hitY
    };

    if (this.onJudgeCallback) this.onJudgeCallback(result);
    return result;
  }

  private judgeHoldTick(note: Note): void {
    this.stats.combo++;
    if (this.stats.combo > this.stats.maxCombo) {
      this.stats.maxCombo = this.stats.combo;
    }
    this.updateScore();

    if (this.onJudgeCallback) {
      this.onJudgeCallback({
        note,
        grade: 'PERFECT',
        deltaMs: 0,
        scoreAdded: 200,
        combo: this.stats.combo,
        isHoldTick: true
      });
    }
  }

  private judgeHoldComplete(note: Note): JudgeResult {
    this.stats.combo++;
    if (this.stats.combo > this.stats.maxCombo) {
      this.stats.maxCombo = this.stats.combo;
    }
    this.updateScore();

    const result: JudgeResult = {
      note,
      grade: 'PERFECT',
      deltaMs: 0,
      scoreAdded: 800,
      combo: this.stats.combo,
      isHoldComplete: true
    };

    if (this.onJudgeCallback) this.onJudgeCallback(result);
    return result;
  }

  private judgeNote(note: Note, grade: JudgeGrade, deltaMs: number): JudgeResult {
    note.judged = true;
    note.grade = grade;
    note.deltaMs = deltaMs;

    if (grade !== 'PERFECT') {
      this.isAP = false;
    }
    if (grade === 'MISS') {
      this.isFC = false;
    }

    let scoreWeight = 0;

    switch (grade) {
      case 'PERFECT':
        this.stats.perfectCount++;
        this.stats.combo++;
        scoreWeight = 1.0;
        break;
      case 'GREAT':
        this.stats.greatCount++;
        this.stats.combo++;
        scoreWeight = 0.7;
        break;
      case 'GOOD':
        this.stats.goodCount++;
        this.stats.combo++;
        scoreWeight = 0.4;
        break;
      case 'MISS':
        this.stats.missCount++;
        this.stats.combo = 0;
        scoreWeight = 0.0;
        break;
    }

    if (this.stats.combo > this.stats.maxCombo) {
      this.stats.maxCombo = this.stats.combo;
    }

    this.updateScore();

    let hitX: number | undefined;
    let hitY: number | undefined;
    if (this.activePointerPos && note.type === 'touch') {
      hitX = this.activePointerPos.x;
      hitY = this.activePointerPos.y;
    } else if (this.getNoteCanvasPos) {
      const p = this.getNoteCanvasPos(note, note.time);
      hitX = p.x;
      hitY = p.y;
    }

    const noteBaseScore = this.totalNotes > 0 ? (900000 / this.totalNotes) * scoreWeight : 0;
    const result: JudgeResult = {
      note,
      grade,
      deltaMs,
      scoreAdded: Math.round(noteBaseScore),
      combo: this.stats.combo,
      hitX,
      hitY
    };

    if (this.onJudgeCallback) {
      this.onJudgeCallback(result);
    }

    return result;
  }

  private updateScore(): void {
    if (this.totalNotes === 0) return;
    const comboScore = 100000 * (this.stats.maxCombo / this.totalNotes);
    const totalAccuracyScore = 900000 * (
      (this.stats.perfectCount * 1.0 + this.stats.greatCount * 0.7 + this.stats.goodCount * 0.4) / this.totalNotes
    );
    this.stats.score = Math.min(1000000, Math.round(totalAccuracyScore + comboScore));
  }

  public getAccuracy(): number {
    const total = this.stats.perfectCount + this.stats.greatCount + this.stats.goodCount + this.stats.missCount;
    if (total === 0) return 100;
    const points = this.stats.perfectCount * 100 + this.stats.greatCount * 70 + this.stats.goodCount * 40;
    return points / total;
  }

  public getNotes(): Note[] {
    return this.notes;
  }

  public isChartFinished(songTime: number): boolean {
    if (this.notes.length === 0) return false;
    const lastNote = this.notes[this.notes.length - 1];
    const lastNoteEnd = lastNote.time + (lastNote.duration || 0);
    return songTime > lastNoteEnd + 2.0;
  }

  public getResultSummary(songTitle: string, difficulty: string): ResultSummary {
    let rank: RankGrade = 'C';
    // User requirements:
    // >990000判定为SS, ap也就是满分判定为彩色的SSS
    // S: >= 950000, A: >= 900000, B: >= 800000, C: < 800000
    if (this.stats.score >= 1000000) {
      rank = 'SSS';
    } else if (this.stats.score > 990000) {
      rank = 'SS';
    } else if (this.stats.score >= 950000) {
      rank = 'S';
    } else if (this.stats.score >= 900000) {
      rank = 'A';
    } else if (this.stats.score >= 800000) {
      rank = 'B';
    } else {
      rank = 'C';
    }

    // FC和AP为附带评价，不影响主要评价体系
    // fc在出现miss断，ap在出现非perfect判定断
    let badge: BadgeGrade = 'CLEAR';
    if (this.isAP && this.stats.missCount === 0 && this.stats.greatCount === 0 && this.stats.goodCount === 0) {
      badge = 'AP';
    } else if (this.isFC && this.stats.missCount === 0) {
      badge = 'FC';
    }

    return {
      songTitle,
      difficulty,
      rank,
      badge,
      score: this.stats.score,
      accuracy: this.getAccuracy(),
      maxCombo: this.stats.maxCombo,
      perfectCount: this.stats.perfectCount,
      greatCount: this.stats.greatCount,
      goodCount: this.stats.goodCount,
      missCount: this.stats.missCount,
      totalNotes: this.totalNotes
    };
  }
}
