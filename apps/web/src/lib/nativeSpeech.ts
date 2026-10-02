import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

interface SpeechEvent {
  sessionId: string;
  type: 'start' | 'result' | 'error' | 'end';
  matches?: string[];
  isFinal?: boolean;
  error?: string;
}
const native = registerPlugin<{
  start(options: { sessionId: string }): Promise<void>;
  stop(options: { sessionId: string }): Promise<void>;
  addListener(event: 'speech', callback: (event: SpeechEvent) => void): Promise<PluginListenerHandle>;
}>('VoiceRecognition');

// Adapta el servicio Android a los eventos que ya consume el gestor de comandos.
export class NativeSpeechRecognition {
  lang = 'es-CL';
  continuous = false;
  interimResults = true;
  maxAlternatives = 5;
  onstart: (() => void) | null = null;
  onresult: ((event: { resultIndex: number; results: unknown[] }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  private listener?: PluginListenerHandle;
  private cancelled = false;
  private id = 'speech-' + Date.now() + '-' + Math.random().toString(36).slice(2);

  start() {
    void this.listen();
  }
  private async listen() {
    try {
      this.listener = await native.addListener('speech', event => {
        if (this.cancelled || event.sessionId !== this.id) return;
        if (event.type === 'start') this.onstart?.();
        if (event.type === 'result') {
          const result = Object.assign((event.matches || []).map(transcript => ({ transcript })), { isFinal: event.isFinal });
          this.onresult?.({ resultIndex: 0, results: [result] });
        }
        if (event.type === 'error') this.onerror?.({ error: event.error || 'audio-capture' });
        if (event.type === 'end') { this.cleanup(); this.onend?.(); }
      });
      if (this.cancelled) { this.cleanup(); return; }
      await native.start({ sessionId: this.id });
    } catch (error) {
      if (this.cancelled) return;
      this.cleanup();
      this.onerror?.({ error: error instanceof Error ? error.message : 'audio-capture' });
      this.onend?.();
    }
  }
  private cleanup() { void this.listener?.remove(); this.listener = undefined; }
  abort() {
    this.cancelled = true;
    this.cleanup();
    void native.stop({ sessionId: this.id }).catch(() => {});
  }
  stop() { this.abort(); }
}
