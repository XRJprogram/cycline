export type HitInputCallback = () => void;

export class InputManager {
  private hitCallback: HitInputCallback | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private pointerdownHandler: ((e: PointerEvent) => void) | null = null;
  private isEnabled = true;

  constructor(targetElement: HTMLElement = document.body) {
    this.setupListeners(targetElement);
  }

  public onHit(callback: HitInputCallback): void {
    this.hitCallback = callback;
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  private setupListeners(target: HTMLElement): void {
    // Keyboard listener (Space, D, F, J, K, Enter, etc.)
    this.keydownHandler = (e: KeyboardEvent) => {
      if (!this.isEnabled) return;
      if (e.repeat) return; // Prevent auto-fire when holding key

      // Ignore standard browser shortcuts
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === 'F12' || e.key === 'Tab') return;

      // Prevent page scrolling on space
      if (e.code === 'Space') {
        e.preventDefault();
      }

      if (this.hitCallback) {
        this.hitCallback();
      }
    };

    // Pointer listener (Touch on phones, Mouse click on PC)
    this.pointerdownHandler = (e: PointerEvent) => {
      if (!this.isEnabled) return;
      // If clicking interactive UI buttons/sliders, don't trigger game hit
      const targetEl = e.target as HTMLElement;
      if (targetEl && (targetEl.tagName === 'BUTTON' || targetEl.tagName === 'INPUT' || targetEl.closest('.ui-controls'))) {
        return;
      }

      if (this.hitCallback) {
        this.hitCallback();
      }
    };

    window.addEventListener('keydown', this.keydownHandler);
    target.addEventListener('pointerdown', this.pointerdownHandler);
  }

  public destroy(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
    }
  }
}
