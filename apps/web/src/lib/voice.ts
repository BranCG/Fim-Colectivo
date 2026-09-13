// ─── MÓDULO DE VOZ Y ACCESIBILIDAD MANOS LIBRES (LEY NO CHAT 21.377) ─────────
// Proporciona Text-to-Speech (TTS), reconocimiento de voz (STT) y chimes de audio
// para evitar que el conductor desvíe la vista o manipule el teléfono mientras conduce.

import { Capacitor } from '@capacitor/core';

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
let esParadaIntencional = false;
let ultimoTextoHablado = '';
let tiempoUltimoHabla = 0;

function getBaseApiUrl(): string {
  if (typeof window === 'undefined') return 'https://colectivo.fimchile.cl';
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  const host = window.location.hostname;
  const isNativeApp =
    Capacitor.isNativePlatform() ||
    window.location.protocol === 'capacitor:' ||
    (host === 'localhost' && window.location.port !== '3000' && window.location.port !== '3001');
  if (isNativeApp) {
    return 'https://colectivo.fimchile.cl';
  }
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
  esParadaIntencional = true;
  if (audioActual) {
    try {
      audioActual.onended = null;
      audioActual.onerror = null;
      audioActual.pause();
      audioActual.currentTime = 0;
      audioActual.removeAttribute('src');
      audioActual.load();
    } catch {}
    audioActual = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
  GestorReconocimientoVoz.obtener().reanudarTrasHabla(60);
}

/**
 * Lee texto en voz alta utilizando el motor de audio streaming neuronal en español (Google Neural TTS)
 * con fallback a síntesis nativa del dispositivo si falla la red.
 * Durante la reproducción silencia el micrófono para evitar ducking, distorsión y autocancelación.
 */
export function hablarTexto(texto: string, alFinalizar?: () => void) {
  if (typeof window === 'undefined') {
    if (alFinalizar) alFinalizar();
    return;
  }

  const textoLimpio = texto.trim();
  if (!textoLimpio) {
    if (alFinalizar) alFinalizar();
    return;
  }

  // Prevenir duplicados inmediatos en ráfaga (<800ms)
  const ahora = Date.now();
  if (textoLimpio === ultimoTextoHablado && ahora - tiempoUltimoHabla < 800) {
    if (alFinalizar) alFinalizar();
    return;
  }
  ultimoTextoHablado = textoLimpio;
  tiempoUltimoHabla = ahora;

  detenerVoz();
  esParadaIntencional = false;

  // Si la locución contiene instrucciones de abordaje ("a bordo", "suba"),
  // bloquear el comando "A bordo" preventivamente por 10s para evitar eco del parlante
  if (/bordo|suba|auto/i.test(textoLimpio)) {
    GestorReconocimientoVoz.obtener().bloquearAbordoTemporal(10000);
  }

  // Pausar reconocimiento mientras se emite voz para evitar que el hardware
  // de Android duckee el volumen o que el micrófono capture el parlante
  GestorReconocimientoVoz.obtener().pausarPorHabla();

  let finalizado = false;
  const invocarFinal = () => {
    if (!finalizado) {
      finalizado = true;
      // Reanudar la escucha tras un pequeño búfer de 150ms para que se limpie el eco acústico
      GestorReconocimientoVoz.obtener().reanudarTrasHabla(150);
      if (alFinalizar) alFinalizar();
    }
  };

  // 1. Prioridad: Stream de audio neural humano en español (/api/colectivos/tts o Google TTS directo)
  try {
    const textoCodificado = encodeURIComponent(textoLimpio.slice(0, 250));
    const urlProxy = `${getBaseApiUrl()}/api/colectivos/tts?texto=${textoCodificado}&lang=es`;
    const urlGoogle = `https://translate.google.com/translate_tts?ie=UTF-8&q=${textoCodificado}&tl=es&client=tw-ob`;

    const audio = new Audio();
    audioActual = audio;

    // Temporizador de seguridad generoso solo para emergencias si la red queda colgada.
    // Un audio de TTS en español puede durar 8 a 12 segundos; nunca debe cortar antes de tiempo.
    const duracionEstimadaMs = Math.max(15000, textoLimpio.length * 250);
    const timerSeguridad = setTimeout(() => {
      invocarFinal();
    }, duracionEstimadaMs);

    audio.onended = () => {
      clearTimeout(timerSeguridad);
      audioActual = null;
      invocarFinal();
    };

    audio.onerror = () => {
      clearTimeout(timerSeguridad);
      if (esParadaIntencional) return;
      console.warn('[TTS Neural] Error en endpoint proxy, probando Google directo o síntesis...');
      audioActual = null;
      probarGoogleDirecto(urlGoogle, textoLimpio, invocarFinal);
    };

    audio.src = urlProxy;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (esParadaIntencional || err?.name === 'AbortError') {
          return;
        }
        console.warn('[TTS Neural] Error al reproducir audio proxy, intentando Google directo:', err);
        probarGoogleDirecto(urlGoogle, textoLimpio, invocarFinal);
      });
    }
  } catch (e) {
    if (!esParadaIntencional) {
      console.warn('[TTS Neural] Error al inicializar audio neural, pasando a síntesis nativa:', e);
      ejecutarLecturaSintesis(textoLimpio, invocarFinal);
    } else {
      invocarFinal();
    }
  }
}

function probarGoogleDirecto(urlGoogle: string, textoOriginal: string, onFin: () => void) {
  if (esParadaIntencional) {
    onFin();
    return;
  }
  try {
    const audioSecundario = new Audio();
    audioActual = audioSecundario;

    const timer = setTimeout(() => {
      onFin();
    }, Math.max(15000, textoOriginal.length * 250));

    audioSecundario.onended = () => {
      clearTimeout(timer);
      audioActual = null;
      onFin();
    };

    audioSecundario.onerror = () => {
      clearTimeout(timer);
      if (esParadaIntencional) return;
      audioActual = null;
      ejecutarLecturaSintesis(textoOriginal, onFin);
    };

    audioSecundario.src = urlGoogle;
    audioSecundario.play().catch((err) => {
      if (esParadaIntencional || err?.name === 'AbortError') {
        return;
      }
      clearTimeout(timer);
      audioActual = null;
      ejecutarLecturaSintesis(textoOriginal, onFin);
    });
  } catch {
    if (!esParadaIntencional) {
      ejecutarLecturaSintesis(textoOriginal, onFin);
    } else {
      onFin();
    }
  }
}

function ejecutarLecturaSintesis(texto: string, alFinalizar?: () => void) {
  if (esParadaIntencional || typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (alFinalizar) alFinalizar();
    return;
  }

  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();

    const locucion = new SpeechSynthesisUtterance(texto);
    locucion.lang = 'es-CL';
    locucion.rate = 1.05;
    locucion.pitch = 1.0;
    locucion.volume = 1.0;

    const vozEspanol = buscarVozEspanol();
    if (vozEspanol) {
      locucion.voice = vozEspanol;
    }

    let completado = false;
    const invocarFinal = () => {
      if (!completado) {
        completado = true;
        GestorReconocimientoVoz.obtener().reanudarTrasHabla(250);
        if (alFinalizar) alFinalizar();
      }
    };

    locucion.onend = invocarFinal;
    locucion.onerror = (err) => {
      console.warn('[TTS Nativo] SpeechSynthesis error:', err);
      invocarFinal();
    };

    setTimeout(invocarFinal, 7000);
    window.speechSynthesis.speak(locucion);
  } catch (err) {
    console.warn('[TTS Nativo] Error al ejecutar speak:', err);
    if (alFinalizar) alFinalizar();
  }
}

export interface OpcionesEscucha {
  id?: string;
  onSi?: () => void;
  onNo?: () => void;
  onAbordo?: () => void;
  onEscuchando?: (estado: boolean) => void;
  onTextoDetectado?: (texto: string) => void;
  onError?: (error: string) => void;
}

class GestorReconocimientoVoz {
  private static instancia: GestorReconocimientoVoz | null = null;
  private reconocimiento: any = null;
  private escuchandoDeseado = false;
  private estaCorriendo = false;
  private silenciadoPorHabla = false;
  private timerReanudarHabla: NodeJS.Timeout | null = null;
  private suscriptores: Map<string, OpcionesEscucha> = new Map();
  private ultimoDisparoComando = 0;
  private timerReintento: NodeJS.Timeout | null = null;
  private bloqueoAbordoHasta = 0;

  static obtener(): GestorReconocimientoVoz {
    if (!GestorReconocimientoVoz.instancia) {
      GestorReconocimientoVoz.instancia = new GestorReconocimientoVoz();
    }
    return GestorReconocimientoVoz.instancia;
  }

  bloquearAbordoTemporal(duracionMs = 4000) {
    this.bloqueoAbordoHasta = Date.now() + duracionMs;
  }

  private constructor() {
    // Inicialización bajo demanda
  }

  pausarPorHabla() {
    this.silenciadoPorHabla = true;
    if (this.timerReanudarHabla) {
      clearTimeout(this.timerReanudarHabla);
      this.timerReanudarHabla = null;
    }
    if (this.timerReintento) {
      clearTimeout(this.timerReintento);
      this.timerReintento = null;
    }

    // Detener y abortar el micrófono durante la locución del parlante
    // para evitar que el reconocedor capture la voz neuronal y se enganche a esa transcripción
    if (this.reconocimiento) {
      try {
        this.reconocimiento.onstart = null;
        this.reconocimiento.onresult = null;
        this.reconocimiento.onerror = null;
        this.reconocimiento.onend = null;
        this.reconocimiento.abort();
      } catch {}
      this.reconocimiento = null;
      this.estaCorriendo = false;
      this.notificarEstadoEscucha(false);
    }
  }

  reanudarTrasHabla(retrasoMs = 120) {
    if (this.timerReanudarHabla) clearTimeout(this.timerReanudarHabla);
    this.timerReanudarHabla = setTimeout(() => {
      this.silenciadoPorHabla = false;
      // Limpiar cualquier texto residual para que el conductor comience con pantalla limpia
      this.notificarTextoDetectado('');
      if (this.escuchandoDeseado && this.suscriptores.size > 0) {
        this.iniciarCiclo();
      }
    }, retrasoMs);
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

  private notificarTextoDetectado(texto: string) {
    this.suscriptores.forEach((s) => {
      if (s.onTextoDetectado) s.onTextoDetectado(texto);
    });
  }

  private notificarError(msg: string) {
    this.suscriptores.forEach((s) => {
      if (s.onError) s.onError(msg);
    });
  }

  private iniciarCiclo() {
    if (this.silenciadoPorHabla || !this.escuchandoDeseado || this.suscriptores.size === 0) return;

    // Destruir instancia previa de forma limpia para que Android no bloquee el micrófono
    if (this.reconocimiento) {
      try {
        this.reconocimiento.onstart = null;
        this.reconocimiento.onresult = null;
        this.reconocimiento.onerror = null;
        this.reconocimiento.onend = null;
        this.reconocimiento.abort();
      } catch {}
      this.reconocimiento = null;
    }

    const windowAny = typeof window !== 'undefined' ? (window as any) : {};
    const SpeechRecognitionClass = windowAny.SpeechRecognition || windowAny.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      console.info('[Voz Chofer] SpeechRecognition no soportado en este navegador');
      return;
    }

    try {
      const rec = new SpeechRecognitionClass();
      rec.lang = 'es-CL';
      // continuous = true mantiene el micrófono abierto en Android sin destruirlo cada 1.5 segundos
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 5;

      rec.onstart = () => {
        this.estaCorriendo = true;
        this.notificarEstadoEscucha(true);
      };

      rec.onresult = (evento: any) => {
        // Si el parlante está reproduciendo voz neuronal, ignorar cualquier captura acústica
        if (this.silenciadoPorHabla) return;

        const ahora = Date.now();
        const resultados = evento.results;
        if (!resultados || resultados.length === 0) return;

        let textoDetectadoReciente = '';

        for (let i = evento.resultIndex; i < resultados.length; i++) {
          const item = resultados[i];
          const numAlternativas = item.length || 1;

          for (let altIdx = 0; altIdx < numAlternativas; altIdx++) {
            const rawTranscript = (item[altIdx]?.transcript || '').trim();
            if (!rawTranscript) continue;

            // Notificar de inmediato al suscriptor/UI para que el conductor vea en pantalla lo que dice en tiempo real
            this.notificarTextoDetectado(rawTranscript);

            if (!textoDetectadoReciente) {
              textoDetectadoReciente = rawTranscript;
            }

            // Normalizar quitando acentos y caracteres especiales
            const normalizado = rawTranscript
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();

            if (!normalizado) continue;

            console.log('[Voz Chofer] Escuchado:', normalizado, item.isFinal ? '(final)' : '(interim)');

            const palabras = normalizado.split(' ');

            // 3. Comando: NO (rechazar/pasar/cancelar)
            const esNo =
              normalizado === 'no' ||
              normalizado === 'nop' ||
              normalizado === 'nopo' ||
              normalizado === 'paso' ||
              normalizado === 'rechazo' ||
              normalizado === 'rechazar' ||
              normalizado === 'cancelar' ||
              normalizado === 'cancela' ||
              normalizado === 'dejalo' ||
              palabras.includes('no') ||
              palabras.includes('nop') ||
              palabras.includes('nopo') ||
              palabras.includes('paso') ||
              palabras.includes('rechazo') ||
              palabras.includes('rechazar') ||
              palabras.includes('cancelar') ||
              palabras.includes('cancela') ||
              /(^|\s)(no|nop|nopo|paso|rechazo|rechazar|dejalo|dejala|cancelar|cancela|negativo)($|\s)/i.test(
                normalizado
              );

            if (esNo && ahora - this.ultimoDisparoComando > 300) {
              this.ultimoDisparoComando = ahora;
              this.notificarTextoDetectado('¡NO DETECTADO!');
              detenerVoz();
              const ejecutado = this.despacharComando('onNo');
              if (ejecutado) return;
            }

            // 1. Comando: SÍ (confirmar/aceptar reserva o pago)
            // Asegurarse de que no contenga negación ni palabras ambiguas
            const contieneNegacion = esNo || palabras.includes('no') || /(^|\s)no($|\s)/i.test(normalizado);

            const esSi =
              !contieneNegacion &&
              (
                normalizado === 'si' ||
                normalizado === 'sí' ||
                normalizado === 'sip' ||
                normalizado === 'sipo' ||
                normalizado === 'dale' ||
                normalizado === 'bueno' ||
                normalizado === 'ok' ||
                normalizado === 'oka' ||
                normalizado === 'okay' ||
                normalizado === 'acepto' ||
                normalizado === 'aceptar' ||
                normalizado === 'confirmo' ||
                normalizado === 'confirmar' ||
                normalizado === 'claro' ||
                normalizado === 'afirmativo' ||
                palabras.includes('si') ||
                palabras.includes('sí') ||
                palabras.includes('sip') ||
                palabras.includes('sipo') ||
                palabras.includes('dale') ||
                palabras.includes('bueno') ||
                palabras.includes('ok') ||
                palabras.includes('oka') ||
                palabras.includes('okay') ||
                palabras.includes('acepto') ||
                palabras.includes('aceptar') ||
                palabras.includes('confirmo') ||
                palabras.includes('confirmar') ||
                /(^|\s)(s+[ií]+|s+[ií]+p+o*|dale|bueno|ok|oka|okay|acepto|aceptar|confirmo|confirmar|claro|afirmativo)($|\s)/i.test(
                  normalizado
                )
              );

            if (esSi && ahora - this.ultimoDisparoComando > 300) {
              this.ultimoDisparoComando = ahora;
              this.notificarTextoDetectado('¡SÍ DETECTADO!');
              detenerVoz();
              const ejecutado = this.despacharComando('onSi');
              if (ejecutado) return;
            }

            // 2. Comando: A BORDO (sube pasajero)
            const esAbordo =
              normalizado.includes('bordo') ||
              normalizado.includes('subio') ||
              normalizado.includes('sube') ||
              normalizado.includes('arriba') ||
              normalizado.includes('adentro') ||
              normalizado.includes('auto') ||
              palabras.includes('bordo') ||
              palabras.includes('subio') ||
              palabras.includes('sube') ||
              palabras.includes('arriba') ||
              palabras.includes('listo') ||
              /(^|\s)(a\s*bordo|bordo|subi[oó]|sube|subieron|subir|arriba|adentro|al\s*auto|aborde|listo)($|\s)/i.test(
                normalizado
              );

            if (esAbordo && ahora - this.ultimoDisparoComando > 300 && ahora > this.bloqueoAbordoHasta) {
              this.ultimoDisparoComando = ahora;
              this.notificarTextoDetectado('¡A BORDO DETECTADO!');
              detenerVoz();
              const ejecutado = this.despacharComando('onAbordo');
              if (ejecutado) return;
            }
          }
        }

        if (textoDetectadoReciente) {
          this.notificarTextoDetectado(textoDetectadoReciente);
        }
      };

      rec.onerror = (err: any) => {
        console.warn('[Voz Chofer] Evento onerror SpeechRecognition:', err?.error);
        if (err?.error === 'not-allowed' || err?.error === 'service-not-allowed') {
          this.escuchandoDeseado = false;
          this.notificarError('Permiso de micrófono denegado');
          return;
        }
        this.estaCorriendo = false;
      };

      rec.onend = () => {
        this.estaCorriendo = false;
        this.notificarEstadoEscucha(false);

        // Si está silenciado durante la locución del parlante, NO reiniciar aquí;
        // reanudarTrasHabla se encargará de abrir el ciclo limpio cuando finalice el audio
        if (this.silenciadoPorHabla) return;

        // Reinicio automático con instancia limpia para Android
        if (this.escuchandoDeseado && this.suscriptores.size > 0) {
          if (this.timerReintento) clearTimeout(this.timerReintento);
          this.timerReintento = setTimeout(() => {
            this.iniciarCiclo();
          }, 100);
        }
      };

      rec.start();
      this.reconocimiento = rec;
      this.estaCorriendo = true;
    } catch (e) {
      this.estaCorriendo = false;
      if (this.timerReintento) clearTimeout(this.timerReintento);
      this.timerReintento = setTimeout(() => {
        if (this.escuchandoDeseado && this.suscriptores.size > 0) {
          this.iniciarCiclo();
        }
      }, 200);
    }
  }

  suscribir(opciones: OpcionesEscucha): { detener: () => void } {
    const id = opciones.id || Math.random().toString(36).slice(2);
    this.suscriptores.set(id, opciones);
    this.escuchandoDeseado = true;
    this.ultimoDisparoComando = 0;

    if (!this.silenciadoPorHabla && !this.estaCorriendo) {
      this.iniciarCiclo();
    } else if (this.estaCorriendo) {
      if (opciones.onEscuchando) opciones.onEscuchando(true);
    }

    return {
      detener: () => {
        this.suscriptores.delete(id);
        if (this.suscriptores.size === 0) {
          this.escuchandoDeseado = false;
          if (this.timerReintento) clearTimeout(this.timerReintento);
          try {
            if (this.reconocimiento) {
              this.reconocimiento.onend = null;
              this.reconocimiento.stop();
            }
          } catch {}
          this.reconocimiento = null;
          this.estaCorriendo = false;
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

/**
 * Bloquea temporalmente el comando de voz "A bordo" durante locuciones del sistema
 * para evitar que el altavoz active su propio comando por eco acústico.
 */
export function bloquearAbordoTemporal(ms = 4000) {
  if (typeof window === 'undefined') return;
  GestorReconocimientoVoz.obtener().bloquearAbordoTemporal(ms);
}
