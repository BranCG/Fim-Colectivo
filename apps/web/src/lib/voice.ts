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

function precargarVoces() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  vocesPrecargadas = window.speechSynthesis.getVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      vocesPrecargadas = window.speechSynthesis.getVoices();
    };
  }
}

if (typeof window !== 'undefined') {
  precargarVoces();
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
 * Desbloquea de forma explícita el AudioContext y SpeechSynthesis tras un toque o click del usuario
 */
export function desbloquearAudioYVoz(mensajeTest = 'Audio y voz activados', alCompletar?: () => void) {
  try {
    const ctx = obtenerAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    reproducirSonido('exito');

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
      precargarVoces();

      const locucionTest = new SpeechSynthesisUtterance(mensajeTest);
      locucionTest.lang = 'es-CL';
      locucionTest.rate = 1.0;
      locucionTest.pitch = 1.0;
      locucionTest.volume = 1.0;

      const voz = buscarVozEspanol();
      if (voz) locucionTest.voice = voz;

      locucionTest.onend = () => {
        if (alCompletar) alCompletar();
      };
      locucionTest.onerror = () => {
        if (alCompletar) alCompletar();
      };

      window.speechSynthesis.speak(locucionTest);
    } else {
      if (alCompletar) alCompletar();
    }
  } catch (e) {
    console.warn('Error al desbloquear audio y voz:', e);
    if (alCompletar) alCompletar();
  }
}

/**
 * Lee texto en voz alta en español utilizando la API nativa SpeechSynthesis de forma robusta
 */
export function hablarTexto(texto: string, alFinalizar?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (alFinalizar) alFinalizar();
    return;
  }

  try {
    window.speechSynthesis.resume();

    // En Chromium, llamar a speak() sincrónicamente tras cancel() anula la locución nueva.
    // Si está hablando, cancelamos y damos 40ms para que la cola se desaloje limpiamente.
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
      setTimeout(() => {
        ejecutarLectura(texto, alFinalizar);
      }, 40);
    } else {
      ejecutarLectura(texto, alFinalizar);
    }
  } catch (err) {
    console.warn('Error al preparar hablarTexto:', err);
    if (alFinalizar) alFinalizar();
  }
}

function ejecutarLectura(texto: string, alFinalizar?: () => void) {
  try {
    window.speechSynthesis.resume();

    const locucion = new SpeechSynthesisUtterance(texto);
    locucion.lang = 'es-CL';
    locucion.rate = 1.02; // Ritmo ágil y comprensible
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

    // Timeout de seguridad en caso de que el navegador no dispare onend
    setTimeout(invocarFinal, 12000);

    window.speechSynthesis.speak(locucion);
  } catch (err) {
    console.warn('Error al ejecutar speak:', err);
    if (alFinalizar) alFinalizar();
  }
}

/**
 * Detiene inmediatamente cualquier lectura de voz en curso
 */
export function detenerVoz() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

interface OpcionesEscucha {
  onSi: () => void;
  onNo: () => void;
  onEscuchando?: (estado: boolean) => void;
  onError?: (error: string) => void;
}

/**
 * Inicia la escucha por micrófono de comandos rápidos "SÍ" o "NO" manos libres
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

        // Patrones afirmativos
        if (
          normalizado.includes('si') ||
          normalizado.includes('dale') ||
          normalizado.includes('tomar') ||
          normalizado.includes('bueno') ||
          normalizado.includes('aceptar') ||
          normalizado.includes('ok') ||
          normalizado.includes('vamos') ||
          normalizado.includes('sube')
        ) {
          finalizado = true;
          detener();
          opciones.onSi();
          return;
        }

        // Patrones negativos
        if (
          normalizado.includes('no') ||
          normalizado.includes('pasar') ||
          normalizado.includes('paso') ||
          normalizado.includes('rechazar') ||
          normalizado.includes('deja') ||
          normalizado.includes('no puedo')
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
      console.warn('[Voz Chofer] Reconocimiento error:', err.error);
      if (opciones.onError) opciones.onError(err.error);
    };

    reconocimiento.onend = () => {
      if (opciones.onEscuchando) opciones.onEscuchando(false);
      // Reiniciar si aún no se ha recibido respuesta y no se ha detenido manualmente
      if (!finalizado) {
        try {
          reconocimiento.start();
        } catch {
          // Ignorar error al reiniciar
        }
      }
    };

    reconocimiento.start();
  } catch (err) {
    console.warn('Error al iniciar SpeechRecognition:', err);
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
