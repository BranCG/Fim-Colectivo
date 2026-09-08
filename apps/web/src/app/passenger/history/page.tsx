'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { formatCLP, getSession } from '@/lib/api';

interface Trip {
  id: string;
  createdAt: string;
  originAddress: string;
  destAddress: string;
  estimatedPrice: number;
  status: string;
  paymentMethod: string;
  driver?: { name: string; vehicleBrand: string; vehicleModel: string; vehiclePlate: string };
  rating?: { score: number; comment?: string };
}

export default function PassengerHistoryPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = getSession();
    if (!s) { router.push('/login'); return; }

    api.get('/trips/my-trips')
      .then(r => setTrips(r.data.trips))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="app-container" style={{ padding: '24px', background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <Link href="/passenger" style={{ color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 700 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          VOLVER AL MAPA
        </Link>
      </header>

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '8px' }}>Mis Viajes</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Registro de tus traslados en Fim.</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="spinner" />
        </div>
      ) : trips.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: '16px', opacity: 0.3 }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>Aún no has realizado ningún viaje.</p>
          <Link href="/passenger" className="btn btn-primary" style={{ marginTop: '24px' }}>Solicitar mi primer viaje</Link>
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
                  <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                    {trip.driver ? trip.driver.name : 'Viaje cancelado'}
                  </div>
                  {trip.driver && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {trip.driver.vehicleBrand} {trip.driver.vehicleModel} · {trip.driver.vehiclePlate}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--gold)' }}>{formatCLP(trip.estimatedPrice)}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    {trip.paymentMethod === 'cash' ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                    )}
                    {trip.paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta'}
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
