import type { GameState } from "./model";

type ToneOptions = {
  frequency: number;
  duration: number;
  gain?: number;
  type?: OscillatorType;
  slideTo?: number;
  delay?: number;
};

export class AudioDirector {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private nextBeat = 0;
  private beat = 0;
  private lastMessageId = -1;
  private lastScene = "";
  private enabled = true;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.master) this.master.gain.value = enabled ? 0.24 : 0;
  }

  async start() {
    if (typeof window === "undefined") return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? 0.24 : 0;
      this.master.connect(this.context.destination);
      this.nextBeat = this.context.currentTime;
    }
    if (this.context.state === "suspended") await this.context.resume();
  }

  private tone({
    frequency,
    duration,
    gain = 0.12,
    type = "sine",
    slideTo,
    delay = 0,
  }: ToneOptions) {
    if (!this.context || !this.master || !this.enabled) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slideTo) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, slideTo),
        now + duration,
      );
    }
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  click() {
    void this.start().then(() => {
      this.tone({ frequency: 680, duration: 0.045, gain: 0.08, type: "square" });
      this.tone({ frequency: 1040, duration: 0.035, gain: 0.04, delay: 0.045 });
    });
  }

  private resetSting() {
    for (let i = 0; i < 7; i += 1) {
      this.tone({
        frequency: 980 - i * 105,
        slideTo: 240 - i * 12,
        duration: 0.16,
        delay: i * 0.045,
        gain: 0.055,
        type: "sawtooth",
      });
    }
  }

  private successSting() {
    [392, 523.25, 659.25, 783.99].forEach((frequency, index) => {
      this.tone({
        frequency,
        duration: 0.24,
        delay: index * 0.08,
        gain: 0.075,
        type: index % 2 ? "triangle" : "sine",
      });
    });
  }

  update(state: GameState) {
    if (!this.context || !this.enabled) return;
    const now = this.context.currentTime;
    if (now >= this.nextBeat && state.scene !== "victory") {
      const step = 60 / 112 / 4;
      const urgent = state.alarm > 58 || state.scene === "escape";
      const pitch = urgent ? 1240 : state.alarm > 24 ? 940 : 760;
      this.tone({
        frequency: pitch + (this.beat % 4 === 3 ? 120 : 0),
        duration: urgent ? 0.045 : 0.03,
        gain: urgent ? 0.035 : 0.018,
        type: "square",
      });
      if (this.beat % 4 === 0) {
        this.tone({
          frequency: state.scene === "escape" ? 92 : 74,
          slideTo: 48,
          duration: 0.17,
          gain: urgent ? 0.07 : 0.045,
          type: "sine",
        });
      }
      if (state.alarm > 75 && this.beat % 8 === 4) {
        this.tone({
          frequency: 220,
          slideTo: 440,
          duration: 0.11,
          gain: 0.05,
          type: "sawtooth",
        });
      }
      this.beat += 1;
      this.nextBeat = now + step;
    }

    const newestMessage = state.messages.at(-1);
    if (newestMessage && newestMessage.id !== this.lastMessageId) {
      this.lastMessageId = newestMessage.id;
      const pitch =
        newestMessage.tone === "alarm"
          ? 180
          : newestMessage.tone === "success"
            ? 780
            : newestMessage.tone === "role"
              ? 560
              : 420;
      this.tone({
        frequency: pitch,
        slideTo: newestMessage.tone === "alarm" ? 120 : pitch * 1.35,
        duration: 0.16,
        gain: 0.07,
        type: newestMessage.tone === "alarm" ? "sawtooth" : "triangle",
      });
    }

    if (state.scene !== this.lastScene) {
      if (state.scene === "loop_summary") this.resetSting();
      if (state.scene === "escape") {
        this.tone({ frequency: 110, slideTo: 920, duration: 0.65, gain: 0.09, type: "sawtooth" });
      }
      if (state.scene === "victory") this.successSting();
      this.lastScene = state.scene;
    }
  }

  destroy() {
    void this.context?.close();
    this.context = null;
    this.master = null;
  }
}
