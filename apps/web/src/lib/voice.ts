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
 * Lee texto en voz alta utilizando audio streaming neural en español con fallback nativo
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

  // Intentar reproducir stream de audio neural en español (Google TTS / proxy API)
  try {
    const textoCodificado = encodeURIComponent(texto.trim().slice(0, 250));
    const urlProxy = `${getBaseApiUrl()}/api/colectivos/tts?texto=${textoCodificado}&lang=es`;
    const urlGoogle = `https://translate.google.com/translate_tts?ie=UTF-8&q=${textoCodificado}&tl=es&client=tw-ob`;

    const audio = new Audio();
    audioActual = audio;

    const timerSeguridad = setTimeout(() => {
      invocarFinal();
    }, 14000);

    audio.onended = () => {
      clearTimeout(timerSeguridad);
      audioActual = null;
      invocarFinal();
    };

    audio.onerror = () => {
      clearTimeout(timerSeguridad);
      console.warn('[TTS Audio] Falló stream primario, probando fallback secundario...');
      audioActual = null;
      ejecutarLecturaSintesis(texto, invocarFinal);
    };

    audio.src = urlProxy;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('[TTS Audio] Error en proxy, probando Google directo:', err);
        audio.src = urlGoogle;
        audio.play().catch(() => {
          clearTimeout(timerSeguridad);
          audioActual = null;
          ejecutarLecturaSintesis(texto, invocarFinal);
        });
      });
    }
  } catch (e) {
    console.warn('[TTS Audio] Error general al inicializar audio, pasando a síntesis nativa:', e);
    ejecutarLecturaSintesis(texto, invocarFinal);
  }
}

function ejecutarLecturaSintesis(texto: string, alFinalizar?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (alFinalizar) alFinalizar();
    return;
  }

  try {
    window.speechSynthesis.resume();

    const locucion = new SpeechSynthesisUtterance(texto);
    locucion.lang = 'es-CL';
    locucion.rate = 1.02;
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
        if (alFinalizar) alFinalizar();
      }
    };

    locucion.onend = invocarFinal;
    locucion.onerror = (err) => {
      console.warn('SpeechSynthesis error en ejecución:', err);
      invocarFinal();
    };

    setTimeout(invocarFinal, 12000);
    window.speechSynthesis.speak(locucion);
  } catch (err) {
    console.warn('Error al ejecutar speak:', err);
    if (alFinalizar) alFinalizar();
  }
}

interface OpcionesEscucha {
  onSi?: () => void;
  onNo?: () => void;
  onAbordo?: () => void;
  onEscuchando?: (estado: boolean) => void;
  onError?: (error: string) => void;
}

/**
 * Inicia la escucha por micrófono de comandos rápidos ("SÍ", "NO", "A BORDO") manos libres
 */
export function iniciarEscuchaVoz(opciones: OpcionesEscucha): { detener: () => void } {
  if (typeof window === 'undefined') {
    return { detener: () => {} };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const windowAny = window as any;
  const SpeechRecognition = windowAny.SpeechRecognition || windowAny.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.info('Reconocimiento de voz SpeechRecognition no disponible en este navegador');
    if (opciones.onError) opciones.onError('No soportado');
    return { detener: () => {} };
  }

  let finalizado = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let reconocimiento: any = null;

  try {
    reconocimiento = new SpeechRecognition();
    reconocimiento.lang = 'es-CL';
    reconocimiento.continuous = true;
    reconocimiento.interimResults = false;
    reconocimiento.maxAlternatives = 3;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reconocimiento.onstart = () => {
      if (opciones.onEscuchando) opciones.onEscuchando(true);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reconocimiento.onresult = (evento: any) => {
      if (finalizado) return;

      const resultados = evento.results;
      for (let i = evento.resultIndex; i < resultados.length; i++) {
        const transcripcion = resultados[i][0].transcript.trim().toLowerCase();
        console.log('[Voz Chofer] Detectado:', transcripcion);

        // Normalizar texto quitando tildes
        const normalizado = transcripcion
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');

        // Patrón: Pasajero a bordo / Abordo
        if (
          opciones.onAbordo &&
          (normalizado.includes('a bordo') ||
            normalizado.includes('abordo') ||
            normalizado.includes('subio') ||
            normalizado.includes('sube') ||
            normalizado.includes('pasajero a bordo') ||
            normalizado.includes('ya subio'))
        ) {
          finalizado = true;
          detener();
          opciones.onAbordo();
          return;
        }

        // Patrones afirmativos: "SÍ"
        if (
          opciones.onSi &&
          (normalizado.includes('si') ||
            normalizado.includes('dale') ||
            normalizado.includes('tomar') ||
            normalizado.includes('bueno') ||
            normalizado.includes('aceptar') ||
            normalizado.includes('ok') ||
            normalizado.includes('vamos') ||
            normalizado.includes('confirma') ||
            normalizado.includes('cobrar') ||
            normalizado.includes('pagar'))
        ) {
          finalizado = true;
          detener();
          opciones.onSi();
          return;
        }

        // Patrones negativos: "NO"
        if (
          opciones.onNo &&
          (normalizado.includes('no') ||
            normalizado.includes('pasar') ||
            normalizado.includes('paso') ||
            normalizado.includes('rechazar') ||
            normalizado.includes('deja') ||
            normalizado.includes('no puedo'))
        ) {
          finalizado = true;
          detener();
          opciones.onNo();
          return;
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reconocimiento.onerror = (err: any) => {
      console.warn('[Voz Chofer] Reconocimiento error:', err?.error);
      if (
        err?.error === 'not-allowed' ||
        err?.error === 'service-not-allowed' ||
        err?.error === 'audio-capture' ||
        err?.error === 'security'
      ) {
        finalizado = true;
      }
      if (opciones.onError) opciones.onError(err?.error || 'error');
    };

    let reintentos = 0;
    reconocimiento.onend = () => {
      if (opciones.onEscuchando) opciones.onEscuchando(false);
      if (!finalizado && reintentos < 3) {
        reintentos++;
        setTimeout(() => {
          if (!finalizado && reconocimiento) {
            try {
              reconocimiento.start();
            } catch (e) {
              console.warn('[Voz Chofer] No se pudo reanudar escucha:', e);
              finalizado = true;
            }
          }
        }, 600);
      }
    };

    try {
      reconocimiento.start();
    } catch (e) {
      console.warn('[Voz Chofer] Error al ejecutar reconocimiento.start():', e);
      finalizado = true;
      if (opciones.onEscuchando) opciones.onEscuchando(false);
    }
  } catch (err) {
    console.warn('Error al iniciar SpeechRecognition:', err);
    finalizado = true;
    if (opciones.onEscuchando) opciones.onEscuchando(false);
  }

  const detener = () => {
    finalizado = true;
    if (reconocimiento) {
      try {
        reconocimiento.stop();
      } catch {}
      reconocimiento = null;
    }
    if (opciones.onEscuchando) opciones.onEscuchando(false);
  };

  return { detener };
}
