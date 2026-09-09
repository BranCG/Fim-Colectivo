// ─── MÓDULO DE VOZ Y ACCESIBILIDAD MANOS LIBRES (LEY NO CHAT 21.377) ─────────
// Proporciona Text-to-Speech (TTS), reconocimiento de voz (STT) y chimes de audio
// para evitar que el conductor desvíe la vista o manipule el teléfono mientras conduce.

let contextoAudio: AudioContext | null = null;

function obtenerAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!contextoAudio) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      contextoAudio = new AudioCtx();
    }
  }
  if (contextoAudio && contextoAudio.state === 'suspended') {
    contextoAudio.resume().catch(() => {});
  }
  return contextoAudio;
}

/**
 * Reproduce tonos y chimes audibles de alta fidelidad sin requerir archivos mp3 externos
 */
export function reproducirSonido(tipo: 'alerta' | 'exito' | 'rechazo') {
  try {
    const ctx = obtenerAudioContext();
    if (!ctx) return;

    const ahora = ctx.currentTime;
    const oscilador = ctx.createOscillator();
    const ganancia = ctx.createGain();

    oscilador.connect(ganancia);
    ganancia.connect(ctx.destination);

    if (tipo === 'alerta') {
      // Doble tono agudo de aviso de pasajero en ruta
      oscilador.type = 'sine';
      oscilador.frequency.setValueAtTime(659.25, ahora); // Mi5
      oscilador.frequency.setValueAtTime(880.00, ahora + 0.1); // La5
      ganancia.gain.setValueAtTime(0.3, ahora);
      ganancia.gain.exponentialRampToValueAtTime(0.01, ahora + 0.35);
      oscilador.start(ahora);
      oscilador.stop(ahora + 0.35);
    } else if (tipo === 'exito') {
      // Acorde armónico de confirmación
      oscilador.type = 'triangle';
      oscilador.frequency.setValueAtTime(523.25, ahora); // Do5
      oscilador.frequency.setValueAtTime(659.25, ahora + 0.08); // Mi5
      oscilador.frequency.setValueAtTime(783.99, ahora + 0.16); // Sol5
      ganancia.gain.setValueAtTime(0.35, ahora);
      ganancia.gain.exponentialRampToValueAtTime(0.01, ahora + 0.45);
      oscilador.start(ahora);
      oscilador.stop(ahora + 0.45);
    } else {
      // Tono descendente suave de paso
      oscilador.type = 'sine';
      oscilador.frequency.setValueAtTime(349.23, ahora); // Fa4
      oscilador.frequency.setValueAtTime(261.63, ahora + 0.12); // Do4
      ganancia.gain.setValueAtTime(0.25, ahora);
      ganancia.gain.exponentialRampToValueAtTime(0.01, ahora + 0.3);
      oscilador.start(ahora);
      oscilador.stop(ahora + 0.3);
    }
  } catch (e) {
    console.warn('No se pudo reproducir sonido de alerta:', e);
  }
}

// Cache de voces disponibles
let vocesPrecargadas: SpeechSynthesisVoice[] = [];
let audioActual: HTMLAudioElement | null = null;

function getBaseApiUrl(): string {
  if (typeof window === 'undefined') return 'https://colectivo.fimchile.cl';
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return `http://${host}:3011`;
  return 'https://colectivo.fimchile.cl';
}

function precargarVoces() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  vocesPrecargadas = window.speechSynthesis.getVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      vocesPrecargadas = window.speechSynthesis.getVoices();
    };
  }
}

// Desbloqueo pasivo al primer toque en la pantalla para WebView y navegadores móviles
if (typeof window !== 'undefined') {
  precargarVoces();
  const desbloquearPasivo = () => {
    try {
      const ctx = obtenerAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.resume();
      }
      const dummyAudio = new Audio();
      dummyAudio.volume = 0.01;
      dummyAudio.play().catch(() => {});
    } catch {}
    window.removeEventListener('touchstart', desbloquearPasivo);
    window.removeEventListener('click', desbloquearPasivo);
  };
  window.addEventListener('touchstart', desbloquearPasivo, { passive: true, once: true });
  window.addEventListener('click', desbloquearPasivo, { passive: true, once: true });
}

function buscarVozEspanol(): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined;
  const voces = vocesPrecargadas.length > 0 ? vocesPrecargadas : window.speechSynthesis.getVoices();
  return (
    voces.find((v) => v.lang === 'es-CL') ||
    voces.find((v) => v.lang === 'es-419') ||
    voces.find((v) => v.lang === 'es-US') ||
    voces.find((v) => v.lang === 'es-MX') ||
    voces.find((v) => v.lang === 'es-ES') ||
    voces.find((v) => v.lang.startsWith('es'))
  );
}

/**
 * Desbloquea de forma explícita el AudioContext y sintetizador tras un toque o click del usuario
 */
export function desbloquearAudioYVoz(
  mensajeTest = 'Audio y voz activados para el servicio de colectivos',
  alCompletar?: () => void
) {
  try {
    const ctx = obtenerAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    reproducirSonido('exito');

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
      precargarVoces();
    }

    hablarTexto(mensajeTest, alCompletar);
  } catch (e) {
    console.warn('Error al desbloquear audio y voz:', e);
    if (alCompletar) alCompletar();
  }
}

/**
 * Detiene inmediatamente cualquier locución en curso (audio streaming o síntesis nativa)
 */
export function detenerVoz() {
  if (audioActual) {
    try {
      audioActual.pause();
      audioActual.currentTime = 0;
    } catch {}
    audioActual = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

/**
 * Lee texto en voz alta utilizando el motor nativo de síntesis de voz (SpeechSynthesis)
 * de alta fluidez y sin retrasos de red, con fallback a audio streaming.
 */
export function hablarTexto(texto: string, alFinalizar?: () => void) {
  if (typeof window === 'undefined') {
    if (alFinalizar) alFinalizar();
    return;
  }

  detenerVoz();

  let finalizado = false;
  const invocarFinal = () => {
    if (!finalizado) {
      finalizado = true;
      if (alFinalizar) alFinalizar();
    }
  };

  // 1. Prioridad: Síntesis nativa del dispositivo (0ms de latencia, audio fluido sin cortes)
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const locucion = new SpeechSynthesisUtterance(texto);
      locucion.lang = 'es-CL';
      locucion.rate = 1.08;
      locucion.pitch = 1.0;
      locucion.volume = 1.0;

      const vozEspanol = buscarVozEspanol();
      if (vozEspanol) {
        locucion.voice = vozEspanol;
      }

      const timerSeguridad = setTimeout(invocarFinal, 7000);

      locucion.onend = () => {
        clearTimeout(timerSeguridad);
        invocarFinal();
      };

      locucion.onerror = (err) => {
        clearTimeout(timerSeguridad);
        console.warn('[TTS] SpeechSynthesis error:', err);
        invocarFinal();
      };

      window.speechSynthesis.speak(locucion);
      return;
    } catch (e) {
      console.warn('[TTS] Error en SpeechSynthesis nativo, probando fallback:', e);
    }
  }

  // 2. Fallback: Stream de audio si el navegador no cuenta con speechSynthesis
  try {
    const textoCodificado = encodeURIComponent(texto.trim().slice(0, 250));
    const urlProxy = `${getBaseApiUrl()}/api/colectivos/tts?texto=${textoCodificado}&lang=es`;

    const audio = new Audio();
    audioActual = audio;

    const timerSeguridad = setTimeout(invocarFinal, 7000);

    audio.onended = () => {
      clearTimeout(timerSeguridad);
      audioActual = null;
      invocarFinal();
    };

    audio.onerror = () => {
      clearTimeout(timerSeguridad);
      audioActual = null;
      invocarFinal();
    };

    audio.src = urlProxy;
    audio.play().catch(() => {
      clearTimeout(timerSeguridad);
      audioActual = null;
      invocarFinal();
    });
  } catch (e) {
    console.warn('[TTS Audio] Error en audio fallback:', e);
    invocarFinal();
  }
}

interface OpcionesEscucha {
  id?: string;
  onSi?: () => void;
  onNo?: () => void;
  onAbordo?: () => void;
  onEscuchando?: (estado: boolean) => void;
  onError?: (error: string) => void;
}

class GestorReconocimientoVoz {
  private static instancia: GestorReconocimientoVoz | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private reconocimiento: any = null;
  private escuchandoDeseado = false;
  private estaCorriendo = false;
  private suscriptores: Map<string, OpcionesEscucha> = new Map();
  private ultimoDisparoComando = 0;
  private timerReintento: NodeJS.Timeout | null = null;

  static obtener(): GestorReconocimientoVoz {
    if (!GestorReconocimientoVoz.instancia) {
      GestorReconocimientoVoz.instancia = new GestorReconocimientoVoz();
    }
    return GestorReconocimientoVoz.instancia;
  }

  private constructor() {
    if (typeof window === 'undefined') return;
    this.inicializarReconocimiento();
  }

  private inicializarReconocimiento() {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const windowAny = window as any;
    const SpeechRecognition = windowAny.SpeechRecognition || windowAny.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.info('[Voz Chofer] SpeechRecognition no soportado en este navegador');
      return;
    }

    try {
      this.reconocimiento = new SpeechRecognition();
      this.reconocimiento.lang = 'es-CL';
      this.reconocimiento.continuous = true;
      this.reconocimiento.interimResults = true;
      this.reconocimiento.maxAlternatives = 5;

      this.reconocimiento.onstart = () => {
        this.estaCorriendo = true;
        this.notificarEstadoEscucha(true);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.reconocimiento.onresult = (evento: any) => {
        const ahora = Date.now();
        const resultados = evento.results;

        // Antirrebote mínimo de 500ms entre comandos aceptados
        if (ahora - this.ultimoDisparoComando < 500) {
          return;
        }

        for (let i = evento.resultIndex; i < resultados.length; i++) {
          const item = resultados[i];
          const numAlternativas = item.length || 1;

          for (let altIdx = 0; altIdx < numAlternativas; altIdx++) {
            const rawTranscript = (item[altIdx]?.transcript || '').trim();
            if (!rawTranscript) continue;

            // Normalizar quitando tildes, signos y puntuaciones
            const normalizado = rawTranscript
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();

            if (!normalizado) continue;

            console.log('[Voz Chofer] Detectado (alt ' + altIdx + '):', normalizado, item.isFinal ? '(final)' : '(interim)');

            // 1. Comando: A BORDO (sube pasajero)
            const regexAbordo = /\b(a bordo|abordo|subio|sube|subieron|ya subio|arriba|pasajero a bordo|listo|aborde|adentro)\b/i;
            if (regexAbordo.test(normalizado)) {
              this.ultimoDisparoComando = ahora;
              detenerVoz();
              const ejecutado = this.despacharComando('onAbordo');
              if (ejecutado) return;
            }

            // 2. Comando: SÍ (confirmar/aceptar)
            // Alta sensibilidad fonética para dialecto chileno y ASR en cabina:
            // "si", "sii", "siii", "sip", "sipo", "si po", "se", "dale", "ya", "yapo", "ya po",
            // "bueno", "ok", "oka", "okay", "toma", "tomar", "tomalo", "tomala", "tomamos",
            // "claro", "confirmo", "confirmar", "afirmativo", "positivo", "acepto", "aceptar"
            const regexSi = /\b(s+i+|s+i+p+o*|se|dale|ya|yapo|ya po|bueno|ok|oka|okay|acepto|aceptar|toma|tomar|tomalo|tomala|tomamos|claro|confirmo|confirmar|afirmativo|positivo)\b/i;
            if (regexSi.test(normalizado)) {
              this.ultimoDisparoComando = ahora;
              detenerVoz();
              const ejecutado = this.despacharComando('onSi');
              if (ejecutado) return;
            }

            // 3. Comando: NO (rechazar/pasar)
            const regexNo = /\b(n+o+|nop|nopo|no po|paso|rechazo|rechazar|dejalo|dejala|no puedo|cancelar|negativo)\b/i;
            if (regexNo.test(normalizado)) {
              this.ultimoDisparoComando = ahora;
              detenerVoz();
              const ejecutado = this.despacharComando('onNo');
              if (ejecutado) return;
            }
          }
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.reconocimiento.onerror = (err: any) => {
        console.warn('[Voz Chofer] Evento onerror SpeechRecognition:', err?.error);
        if (err?.error === 'not-allowed' || err?.error === 'service-not-allowed') {
          this.escuchandoDeseado = false;
          this.notificarError('Permiso de micrófono denegado');
          return;
        }
        // no-speech, network, audio-capture son transitorios y se auto-recuperan
      };

      this.reconocimiento.onend = () => {
        this.estaCorriendo = false;
        this.notificarEstadoEscucha(false);

        // Si el conductor tiene oyentes activos (ruta o modal), reiniciar de inmediato en 50ms
        if (this.escuchandoDeseado && this.suscriptores.size > 0) {
          if (this.timerReintento) clearTimeout(this.timerReintento);
          this.timerReintento = setTimeout(() => {
            this.iniciarCiclo();
          }, 50);
        }
      };
    } catch (e) {
      console.warn('[Voz Chofer] No se pudo instanciar SpeechRecognition:', e);
    }
  }

  private despacharComando(tipo: 'onSi' | 'onNo' | 'onAbordo'): boolean {
    const lista = Array.from(this.suscriptores.values()).reverse();
    for (const suscriptor of lista) {
      if (tipo === 'onSi' && suscriptor.onSi) {
        detenerVoz();
        suscriptor.onSi();
        return true;
      }
      if (tipo === 'onNo' && suscriptor.onNo) {
        detenerVoz();
        suscriptor.onNo();
        return true;
      }
      if (tipo === 'onAbordo' && suscriptor.onAbordo) {
        detenerVoz();
        suscriptor.onAbordo();
        return true;
      }
    }
    return false;
  }

  private notificarEstadoEscucha(activo: boolean) {
    this.suscriptores.forEach((s) => {
      if (s.onEscuchando) s.onEscuchando(activo);
    });
  }

  private notificarError(msg: string) {
    this.suscriptores.forEach((s) => {
      if (s.onError) s.onError(msg);
    });
  }

  private iniciarCiclo() {
    if (!this.reconocimiento) {
      this.inicializarReconocimiento();
    }
    if (!this.reconocimiento || this.estaCorriendo) return;

    try {
      this.reconocimiento.start();
    } catch (e: any) {
      if (e?.name === 'InvalidStateError') {
        this.estaCorriendo = true;
      } else {
        console.warn('[Voz Chofer] Error al ejecutar start():', e);
      }
    }
  }

  suscribir(opciones: OpcionesEscucha): { detener: () => void } {
    const id = opciones.id || Math.random().toString(36).slice(2);
    this.suscriptores.set(id, opciones);
    this.escuchandoDeseado = true;
    this.ultimoDisparoComando = 0; // Permitir que la primera respuesta del chofer se procese de inmediato

    if (!this.estaCorriendo) {
      this.iniciarCiclo();
    } else {
      if (opciones.onEscuchando) opciones.onEscuchando(true);
    }

    return {
      detener: () => {
        this.suscriptores.delete(id);
        if (this.suscriptores.size === 0) {
          this.escuchandoDeseado = false;
          if (this.timerReintento) clearTimeout(this.timerReintento);
          try {
            if (this.reconocimiento && this.estaCorriendo) {
              this.reconocimiento.stop();
            }
          } catch {}
        }
      },
    };
  }
}

/**
 * Inicia o registra la escucha por micrófono de comandos rápidos ("SÍ", "NO", "A BORDO") manos libres
 */
export function iniciarEscuchaVoz(opciones: OpcionesEscucha): { detener: () => void } {
  if (typeof window === 'undefined') {
    return { detener: () => {} };
  }
  return GestorReconocimientoVoz.obtener().suscribir(opciones);
}
