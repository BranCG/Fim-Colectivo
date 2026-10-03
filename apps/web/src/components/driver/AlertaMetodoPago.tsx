'use client';

import { useEffect, useRef, useState } from 'react';
import { hablarTexto, iniciarEscuchaVoz, detenerVoz, reproducirSonido } from '@/lib/voice';
import { IconoCheck, IconoMicrofono } from '@/components/icons/Iconos';

export default function AlertaMetodoPago({ nombre, metodo, onAceptar }: {
  nombre: string;
  metodo: 'efectivo' | 'rutpay';
  onAceptar: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [escuchando, setEscuchando] = useState(false);
  const [texto, setTexto] = useState('');
  const locked = useRef(false);
  const aceptarRef = useRef(onAceptar);
  aceptarRef.current = onAceptar;
  const aceptar = async () => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try { await aceptarRef.current(); }
    catch { setError('No se pudo enviar la aceptación. Di Sí o vuelve a tocar el botón.'); }
    finally { locked.current = false; setBusy(false); }
  };

  useEffect(() => {
    const escucha = iniciarEscuchaVoz({
      id: 'aviso-metodo', onSi: () => void aceptar(), onEscuchando: setEscuchando,
      onTextoDetectado: setTexto, onError: () => setError('Micrófono no disponible. Puedes usar el botón.'),
    });
    reproducirSonido('alerta');
    hablarTexto(nombre + ' paga con ' + (metodo === 'rutpay' ? 'RutPay' : 'efectivo') + '. ¿Aceptas?');
    return () => { escucha.detener(); detenerVoz(); };
    // La instancia se identifica por reserva y método desde el componente padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div role="dialog" aria-label="Método indicado por el pasajero" style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,.92)', display: 'grid', placeItems: 'center', padding: 24 }}>
    <div style={{ width: '100%', maxWidth: 460, padding: 24, border: '2px solid #FACC15', borderRadius: 20, background: '#121212', textAlign: 'center' }}>
      <h2 style={{ color: '#FACC15' }}>{nombre} paga con {metodo === 'rutpay' ? 'RutPay' : 'efectivo'}</h2>
      <p style={{ color: '#FFF' }}>¿Aceptas?</p>
      <p style={{ color: '#A3A3A3' }}><IconoMicrofono size={18} /> {escuchando ? 'Di Sí para aceptar' : 'Preparando micrófono'}</p>
      {texto && <p style={{ color: '#FFF' }}>{texto}</p>}
      {error && <p role="alert" style={{ color: '#FACC15' }}>{error}</p>}
      <button disabled={busy} onClick={() => void aceptar()} style={{ width: '100%', padding: 24, border: 0, borderRadius: 14, background: '#FACC15', color: '#000', fontWeight: 900, fontSize: 22 }}>
        <IconoCheck size={24} /> {busy ? 'ACEPTANDO…' : 'SÍ, ACEPTAR'}
      </button>
    </div>
  </div>;
}
