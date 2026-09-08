'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { getSession } from '@/lib/api';
import { IconoRuta, IconoEfectivo, IconoTarjeta } from '@/components/icons/Iconos';

interface Trip {
  id: string;
  createdAt: string;
  originAddress: string;
  destAddress: string;
  estimatedPrice: number;
  status: string;
  paymentMethod: string;
  passenger: { name: string };
  rating?: { score: number; comment?: string };
}

export default function DriverHistoryPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = getSession();
    if (!s) { router.push('/login'); return; }

    api.get('/trips/driver-trips')
      .then(r => setTrips(r.data.trips))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="app-container" style={{ padding: '24px', background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <Link href="/driver" style={{ color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 700 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          VOLVER AL MAPA
        </Link>
      </header>

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '8px' }}>Historial de Viajes</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Tus ganancias y recorridos completados.</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="spinner" />
        </div>
      ) : trips.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginBottom: '16px' }}>
            <IconoRuta size={48} color="var(--gold)" style={{ opacity: 0.4 }} />
          </div>
          <p style={{ color: 'var(--text-muted)' }}>Aún no has completado ningún viaje.</p>
          <Link href="/driver" className="btn btn-primary" style={{ marginTop: '24px' }}>Empezar a conducir</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {trips.map(trip => (
            <div key={trip.id} className="card" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                    {new Date(trip.createdAt).toLocaleDateString('es-CL', { dateStyle: 'long' })} · {new Date(trip.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{trip.passenger.name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent)' }}>Viaje Colectivo</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                    {trip.paymentMethod === 'cash' ? <IconoEfectivo size={13} color="var(--gold)" /> : <IconoTarjeta size={13} color="var(--gold)" />}
                    <span>{trip.paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta'}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{trip.originAddress}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning)' }} />
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{trip.destAddress}</div>
                </div>
              </div>

              {trip.rating && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i < trip.rating!.score ? 'var(--warning)' : 'rgba(255,255,255,0.1)'}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    ))}
                  </div>
                  {trip.rating.comment && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>"{trip.rating.comment}"</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
