'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface Stats {
  totalDrivers: number;
  pendingDrivers: number;
  activeDrivers: number;
  totalPassengers: number;
  totalTrips: number;
  completedTrips: number;
}

interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  rut: string;
  status: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  totalTrips?: number;
  adminNotes?: string | null;
  idFrontUrl?: string;
  idBackUrl?: string;
  selfieUrl?: string;
  licenseUrl?: string;
  vehiclePhotoUrl?: string;
  trips?: Array<{ id: string; createdAt: string; destAddress: string; status: string; passenger?: { name: string } }>;
}

type View = 'overview' | 'pending' | 'drivers' | 'detail';

const labels: Record<string, string> = {
  pending: 'Pendiente', approved: 'Aprobado', active: 'Activo',
  rejected: 'Rechazado', suspended: 'Suspendido',
};

export default function DashboardPage() {
  const router = useRouter();
  const [view, setView] = useState<View>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [pending, setPending] = useState<Driver[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selected, setSelected] = useState<Driver | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    const response = await api.get('/admin/stats');
    setStats(response.data.stats);
  }, []);
  const loadPending = useCallback(async () => {
    const response = await api.get('/admin/drivers/pending');
    setPending(response.data.drivers);
  }, []);
  const loadDrivers = useCallback(async () => {
    const response = await api.get('/admin/drivers');
    setDrivers(response.data.drivers);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('fim_admin_token')) {
      router.replace('/');
      return;
    }
    loadStats().catch(() => router.replace('/'));
  }, [loadStats, router]);

  useEffect(() => {
    if (view === 'pending') loadPending().catch(() => setMessage('No se pudo cargar la lista de pendientes.'));
    if (view === 'drivers') loadDrivers().catch(() => setMessage('No se pudo cargar la lista de conductores.'));
  }, [view, loadPending, loadDrivers]);

  async function openDriver(id: string) {
    try {
      const response = await api.get('/admin/drivers/' + id);
      setSelected(response.data.driver);
      setView('detail');
    } catch {
      setMessage('No se pudo cargar el conductor.');
    }
  }

  async function act(id: string, action: 'approve' | 'reject' | 'suspend') {
    const reason = action === 'approve' ? undefined : window.prompt(action === 'reject' ? 'Motivo del rechazo:' : 'Motivo de la suspensión:');
    if (action !== 'approve' && !reason) return;
    setBusy(true);
    setMessage('');
    try {
      await api.post('/admin/drivers/' + id + '/' + action, reason ? { reason } : undefined);
      await Promise.all([loadStats(), loadPending(), loadDrivers()]);
      if (selected?.id === id) await openDriver(id);
      setMessage(action === 'approve' ? 'Conductor aprobado y activado.' : 'Estado del conductor actualizado.');
    } catch {
      setMessage('No se pudo actualizar el conductor.');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem('fim_admin_token');
    router.replace('/');
  }

  const documents = selected ? [
    ['Cédula frontal', selected.idFrontUrl],
    ['Cédula posterior', selected.idBackUrl],
    ['Selfie', selected.selfieUrl],
    ['Licencia', selected.licenseUrl],
    ['Vehículo', selected.vehiclePhotoUrl],
  ] as const : [];

  return (
    <main style={{ minHeight: '100vh', padding: '28px', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <h1 style={{ margin: 0 }}>Administración FIM Colectivo</h1>
        <button className="btn btn-secondary" onClick={logout}>Cerrar sesión</button>
      </header>
      <nav style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <button className="btn btn-secondary" onClick={() => setView('overview')}>Resumen</button>
        <button className="btn btn-secondary" onClick={() => setView('pending')}>Pendientes</button>
        <button className="btn btn-secondary" onClick={() => setView('drivers')}>Conductores</button>
        {selected && <button className="btn btn-secondary" onClick={() => setView('detail')}>Detalle</button>}
      </nav>
      {message && <p role="status" className="card">{message}</p>}

      {view === 'overview' && (
        <section>
          <h2>Resumen operativo</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            {stats && ([
              ['Conductores', stats.totalDrivers], ['Por revisar', stats.pendingDrivers],
              ['En servicio', stats.activeDrivers], ['Pasajeros', stats.totalPassengers],
              ['Viajes', stats.totalTrips], ['Viajes completados', stats.completedTrips],
            ] as const).map(([label, value]) => (
              <div key={label} className="card"><strong style={{ fontSize: '1.7rem' }}>{value}</strong><p>{label}</p></div>
            ))}
          </div>
        </section>
      )}

      {view === 'pending' && (
        <section>
          <h2>Conductores por revisar</h2>
          {pending.length === 0 && <p>No hay solicitudes pendientes.</p>}
          <div style={{ display: 'grid', gap: '12px' }}>
            {pending.map(driver => (
              <div className="card" key={driver.id}>
                <h3>{driver.name}</h3>
                <p>{driver.vehicleBrand} {driver.vehicleModel} · {driver.vehiclePlate}</p>
                <p>{driver.email} · {driver.phone}</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" onClick={() => openDriver(driver.id)}>Ver documentos</button>
                  <button className="btn btn-primary" disabled={busy} onClick={() => act(driver.id, 'approve')}>Aprobar y activar</button>
                  <button className="btn btn-secondary" disabled={busy} onClick={() => act(driver.id, 'reject')}>Rechazar</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {view === 'drivers' && (
        <section>
          <h2>Conductores</h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {drivers.map(driver => (
              <div className="card" key={driver.id}>
                <h3>{driver.name} · {labels[driver.status] || driver.status}</h3>
                <p>{driver.vehicleBrand} {driver.vehicleModel} · {driver.vehiclePlate} · {driver.totalTrips || 0} viajes</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" onClick={() => openDriver(driver.id)}>Ver detalle</button>
                  {(driver.status === 'pending' || driver.status === 'approved') && <button className="btn btn-primary" disabled={busy} onClick={() => act(driver.id, 'approve')}>Aprobar y activar</button>}
                  {driver.status === 'active' && <button className="btn btn-secondary" disabled={busy} onClick={() => act(driver.id, 'suspend')}>Suspender</button>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {view === 'detail' && selected && (
        <section>
          <h2>{selected.name}</h2>
          <p>Estado: {labels[selected.status] || selected.status} · RUT: {selected.rut}</p>
          <p>{selected.email} · {selected.phone}</p>
          <p>Vehículo: {selected.vehicleBrand} {selected.vehicleModel} · {selected.vehiclePlate}</p>
          {selected.adminNotes && <p>Nota administrativa: {selected.adminNotes}</p>}
          <h3>Documentos</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {documents.map(([label, url]) => url && <button key={label} className="btn btn-secondary" onClick={() => setDocumentUrl(url)}>{label}</button>)}
          </div>
          <h3>Viajes</h3>
          {selected.trips?.length ? selected.trips.map(trip => (
            <p key={trip.id}>{new Date(trip.createdAt).toLocaleDateString('es-CL')} · {trip.passenger?.name || 'Pasajero'} · {trip.destAddress} · {trip.status}</p>
          )) : <p>Sin viajes registrados.</p>}
          <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
            {(selected.status === 'pending' || selected.status === 'approved') && <button className="btn btn-primary" disabled={busy} onClick={() => act(selected.id, 'approve')}>Aprobar y activar</button>}
            {selected.status === 'active' && <button className="btn btn-secondary" disabled={busy} onClick={() => act(selected.id, 'suspend')}>Suspender</button>}
          </div>
        </section>
      )}

      {documentUrl && (
        <div onClick={() => setDocumentUrl(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={documentUrl} alt="Documento del conductor" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }} />
        </div>
      )}
    </main>
  );
}
