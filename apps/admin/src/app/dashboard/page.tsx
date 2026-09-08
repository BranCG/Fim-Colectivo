'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface Stats {
  totalDrivers: number; pendingDrivers: number; activeDrivers: number;
  totalPassengers: number; totalTrips: number; completedTrips: number;
  membershipsPaid: number; membershipRevenue: number;
}

interface Driver {
  id: string; name: string; email: string; phone: string; rut: string;
  birthDate: string; address: string; status: string; membershipPaid: boolean;
  idFrontUrl: string; idBackUrl: string; licenseNumber: string; licenseUrl: string;
  vehicleBrand: string; vehicleModel: string; vehicleYear: number;
  vehiclePlate: string; vehiclePhotoUrl: string; tagNumber: string;
  totalRating: number; totalTrips: number; createdAt: string; adminNotes?: string;
  selfieUrl?: string;
  membershipPlan: 'PREPAID' | 'PROGRESSIVE';
  membershipProgress: number;
  membershipGoal: number;
  dailyCashTripsCount: number;
  trips?: any[];
}

type View = 'dashboard' | 'pending' | 'all_drivers' | 'driver_detail' | 'revenue_analysis';

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);
}

// Eliminamos lógica de ciclos de viernes (ya no aplica en SaaS)

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'badge-warning', approved: 'badge-info', active: 'badge-success',
    rejected: 'badge-danger', suspended: 'badge-danger',
  };
  const labels: Record<string, string> = {
    pending: 'Pendiente', approved: 'Aprobado', active: 'Activo',
    rejected: 'Rechazado', suspended: 'Suspendido',
  };
  return <span className={`badge ${map[status] || 'badge-muted'}`}>{labels[status] || status}</span>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [view, setView] = useState<View>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingDrivers, setPendingDrivers] = useState<Driver[]>([]);
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [imgModal, setImgModal] = useState<string | null>(null);
  const [historyPayment, setHistoryPayment] = useState<string>('all');

  // Análisis de Ingresos
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [revenueFilter, setRevenueFilter] = useState({ date: new Date().toISOString().split('T')[0] });

  const checkAuth = useCallback(() => {
    if (!localStorage.getItem('fim_admin_token')) router.push('/');
  }, [router]);

  const loadStats = useCallback(async () => {
    try {
      const r = await api.get('/admin/stats');
      setStats(r.data.stats);
    } catch { router.push('/'); }
  }, [router]);

  const loadPending = useCallback(async () => {
    const r = await api.get('/admin/drivers/pending');
    setPendingDrivers(r.data.drivers);
  }, []);

  const loadAll = useCallback(async () => {
    const r = await api.get('/admin/drivers');
    setAllDrivers(r.data.drivers);
  }, []);

  const loadRevenue = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/revenue-report', { params: revenueFilter });
      setRevenueData(r.data.report);
    } catch {
      setActionMsg('❌ Error al cargar análisis');
    } finally { setLoading(false); }
  }, [revenueFilter]);

  useEffect(() => {
    checkAuth();
    loadStats();
  }, [checkAuth, loadStats]);

  useEffect(() => {
    if (view === 'pending') loadPending();
    if (view === 'all_drivers') loadAll();
    if (view === 'revenue_analysis') loadRevenue();
  }, [view, loadPending, loadAll, loadRevenue]);

  async function doAction(driverId: string, action: string, reason?: string) {
    setLoading(true); setActionMsg('');
    try {
      if (action === 'approve') await api.post(`/admin/drivers/${driverId}/approve`);
      else if (action === 'reject') await api.post(`/admin/drivers/${driverId}/reject`, { reason });
      else if (action === 'membership') await api.post(`/admin/drivers/${driverId}/membership-paid`);
      else if (action === 'suspend') await api.post(`/admin/drivers/${driverId}/suspend`, { reason });

      setActionMsg('✅ Acción realizada');
      loadStats();
      if (view === 'pending') loadPending();
      if (view === 'all_drivers') loadAll();
      if (view === 'driver_detail') {
        const r = await api.get(`/admin/drivers/${driverId}`);
        setSelectedDriver(r.data.driver);
      }
    } catch {
      setActionMsg('❌ Error al realizar la acción');
    } finally { setLoading(false); setTimeout(() => setActionMsg(''), 3000); }
  }

  const openDriverDetail = async (driverId: string) => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/drivers/${driverId}`);
      setSelectedDriver(r.data.driver);
      setView('driver_detail');
    } catch {
      setActionMsg('❌ Error al cargar detalle del conductor');
    } finally {
      setLoading(true); // Se queda en loading un momento mientras Next renderiza? No, mejor false
      setLoading(false);
    }
  };

  function logout() { localStorage.removeItem('fim_admin_token'); router.push('/'); }

  const navItems = [
    { key: 'dashboard', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>, label: 'Dashboard' },
    { key: 'pending', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, label: 'Pendientes', badge: stats?.pendingDrivers },
    { key: 'all_drivers', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>, label: 'Conductores' },
    { key: 'revenue_analysis', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>, label: 'Estudios de Mercado' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* Sidebar */}
      <aside style={{ width: '220px', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 100 }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.05em' }}>
            Fim<span style={{ color: 'var(--accent)' }}>.</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>ADMIN PANEL</div>
        </div>

        <nav style={{ padding: '12px 8px', flex: 1 }}>
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => setView(item.key as View)}
              style={{
                width: '100%', padding: '10px 12px', marginBottom: '2px', border: 'none', borderRadius: 'var(--radius)',
                cursor: 'pointer', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '10px',
                background: view === item.key ? 'var(--accent-light)' : 'transparent',
                color: view === item.key ? 'var(--accent)' : 'var(--text-secondary)',
                transition: 'var(--transition)',
              }}
            >
              <span>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge ? <span style={{ background: 'var(--warning)', color: '#09090F', borderRadius: 'var(--radius-full)', padding: '1px 8px', fontSize: '0.72rem', fontWeight: 800 }}>{item.badge}</span> : null}
            </button>
          ))}
        </nav>

        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
          <button onClick={logout} className="btn btn-secondary btn-sm" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ marginLeft: '220px', flex: 1, padding: '28px', minHeight: '100vh' }}>

        {actionMsg && (
          <div style={{ 
            position: 'fixed', 
            top: '24px', 
            left: '50%', 
            transform: 'translateX(-50%)', 
            background: 'var(--bg-card)', 
            color: '#fff',
            border: '1px solid var(--gold)',
            borderRadius: 'var(--radius)', 
            padding: '12px 24px', 
            fontWeight: 800, 
            zIndex: 10000, 
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '0.9rem',
            animation: 'slideDown 0.3s ease-out'
          }}>
            <div style={{ color: actionMsg.includes('Error') ? 'var(--danger)' : 'var(--gold)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            {actionMsg.replace(/[✅❌]/g, '')}
          </div>
        )}

        {/* IMAGE MODAL */}
        {imgModal && (
          <div onClick={() => setImgModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', cursor: 'pointer' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgModal} alt="documento" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px', objectFit: 'contain' }} />
          </div>
        )}

        {/* ── DASHBOARD ─────────────────────────────────────── */}
        {view === 'dashboard' && (
          <div className="animate-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
              <div style={{ color: 'var(--gold)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>Dashboard Global</h1>
            </div>

            {stats && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                  {[
                    { label: 'Conductores totales', value: stats.totalDrivers, icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>, color: 'var(--gold)' },
                    { label: 'Pendientes revisión', value: stats.pendingDrivers, icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, color: 'var(--warning)' },
                    { label: 'Conductores activos', value: stats.activeDrivers, icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>, color: 'var(--success)' },
                    { label: 'Pasajeros totales', value: stats.totalPassengers, icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, color: 'var(--info)' },
                    { label: 'Viajes totales', value: stats.totalTrips, icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h12c.5 0 1 .2 1.4.6.4.4.6.9.6 1.4v18"/><path d="M10 22v-4a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v4"/></svg>, color: 'var(--gold)' },
                    { label: 'Viajes completados', value: stats.completedTrips, icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>, color: 'var(--success)' },
                    { label: 'Membresías cobradas', value: stats.membershipsPaid, icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>, color: 'var(--warning)' },
                    { label: 'Ingresos membresías', value: formatCLP(stats.membershipRevenue), icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, color: 'var(--gold)' },
                  ].map(stat => (
                    <div key={stat.label} className="card" style={{ border: '1px solid rgba(212, 175, 55, 0.1)', background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(20,20,30,1) 100%)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                      <div style={{ color: stat.color, marginBottom: '12px', opacity: 0.8 }}>{stat.icon}</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>{stat.value}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                {stats.pendingDrivers > 0 && (
                  <div style={{ background: 'rgba(255,184,0,0.05)', border: '1px solid rgba(255,184,0,0.15)', borderRadius: 'var(--radius)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ color: 'var(--warning)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      </div>
                      <span style={{ color: 'var(--warning)', fontWeight: 700, fontSize: '0.9rem' }}>
                        Hay {stats.pendingDrivers} conductor(es) esperando validación de seguridad
                      </span>
                    </div>
                    <button className="btn btn-warning btn-sm" onClick={() => setView('pending')}>Revisar ahora →</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── CONDUCTORES PENDIENTES ────────────────────────── */}
        {view === 'pending' && (
          <div className="animate-in">
            <h1 style={{ fontSize: '1.5rem', marginBottom: '24px' }}>⏳ Conductores Pendientes ({pendingDrivers.length})</h1>
            {pendingDrivers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎉</div>
                <p>Sin conductores pendientes. ¡Al día!</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {pendingDrivers.map(driver => (
                  <div key={driver.id} className="card animate-in" style={{ border: '1px solid rgba(255,184,0,0.3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', marginBottom: '4px' }}>{driver.name}</h3>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{driver.email} · {driver.phone}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>RUT: {driver.rut} · Nacimiento: {new Date(driver.birthDate).toLocaleDateString('es-CL')}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Domicilio: {driver.address}</div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Registrado: {new Date(driver.createdAt).toLocaleDateString('es-CL')}
                      </div>
                    </div>

                    {/* Datos del vehículo */}
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: '12px', marginBottom: '14px', display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <span>🚗 {driver.vehicleBrand} {driver.vehicleModel} {driver.vehicleYear}</span>
                      <span>🔤 Patente: <strong style={{ color: 'var(--text-primary)' }}>{driver.vehiclePlate}</strong></span>
                      <span>🏷️ TAG: {driver.tagNumber}</span>
                      <span>📋 Licencia: {driver.licenseNumber}</span>
                    </div>

                    {/* Documentos */}
                    <div style={{ marginBottom: '16px' }}>
                      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px' }}>DOCUMENTOS</p>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {[
                          { label: 'Cédula Frontal', url: driver.idFrontUrl },
                          { label: 'Cédula Posterior', url: driver.idBackUrl },
                          { label: 'Licencia', url: driver.licenseUrl },
                          { label: 'Foto Vehículo', url: driver.vehiclePhotoUrl },
                        ].map(doc => (
                          doc.url ? (
                            <button
                              key={doc.label}
                              onClick={() => setImgModal(doc.url)}
                              style={{ padding: '0', border: '2px solid var(--border)', borderRadius: '8px', cursor: 'pointer', background: 'var(--bg-card)', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '90px', transition: 'var(--transition)' }}
                              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={doc.url} alt={doc.label} style={{ width: '90px', height: '60px', objectFit: 'cover' }} />
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '4px 6px', textAlign: 'center' }}>{doc.label}</span>
                            </button>
                          ) : (
                            <div key={doc.label} style={{ width: '90px', height: '80px', background: 'var(--bg-secondary)', border: '2px dashed var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', padding: '4px' }}>Sin imagen</div>
                          )
                        ))}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button className="btn btn-success" disabled={loading} onClick={() => doAction(driver.id, 'approve')}>
                        ✓ Aprobar conductor
                      </button>
                      <button className="btn btn-warning" disabled={loading} onClick={() => doAction(driver.id, 'membership')}>
                        💳 Aprobar + Marcar membresía pagada
                      </button>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input placeholder="Motivo de rechazo..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={{ width: '200px', padding: '8px 12px' }} />
                        <button className="btn btn-danger btn-sm" disabled={loading || !rejectReason} onClick={() => doAction(driver.id, 'reject', rejectReason)}>
                          ✕ Rechazar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TODOS LOS CONDUCTORES ─────────────────────────── */}
        {view === 'all_drivers' && (
          <div className="animate-in">
            <h1 style={{ fontSize: '1.5rem', marginBottom: '24px' }}>🚗 Todos los Conductores ({allDrivers.length})</h1>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table>
                <thead>
                  <tr>
                    <th>Conductor</th>
                    <th>Vehículo</th>
                    <th>Estado</th>
                    <th>Membresía</th>
                    <th>Rating</th>
                    <th>Viajes</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                    {allDrivers.map(d => (
                    <tr key={d.id}>
                      <td>
                        <div 
                          style={{ fontWeight: 700, color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => openDriverDetail(d.id)}
                        >
                          {d.name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{d.email}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>RUT: {d.rut}</div>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        <div>{d.vehicleBrand} {d.vehicleModel}</div>
                        <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{d.vehiclePlate}</div>
                      </td>
                      <td>{statusBadge(d.status)}</td>
                      <td>
                        {d.membershipPaid
                          ? <span className="badge badge-success">💳 Pagada</span>
                          : <span className="badge badge-danger">Sin pagar</span>}
                      </td>
                      <td style={{ fontWeight: 700, color: d.totalRating > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                        {d.totalRating > 0 ? `⭐ ${d.totalRating.toFixed(1)}` : '—'}
                      </td>
                      <td style={{ fontWeight: 600 }}>{d.totalTrips}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedDriver(d); setView('driver_detail'); }}>Ver</button>
                          {d.status === 'approved' && !d.membershipPaid && (
                            <button className="btn btn-warning btn-sm" disabled={loading} onClick={() => doAction(d.id, 'membership')}>💳 Activar</button>
                          )}
                          {d.status === 'active' && (
                            <button className="btn btn-danger btn-sm" disabled={loading} onClick={() => { const r = prompt('Motivo de suspensión:'); if (r) doAction(d.id, 'suspend', r); }}>Suspender</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ANÁLISIS DE INGRESOS (SAAS) ────────────────────── */}
        {view === 'revenue_analysis' && (
          <div className="animate-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h1 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>📈 Análisis de Ingresos</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Seguimiento diario de la rentabilidad del mercado.</p>
              </div>
              <input 
                type="date" 
                className="form-input" 
                value={revenueFilter.date} 
                onChange={e => setRevenueFilter({ date: e.target.value })}
                style={{ width: '200px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '28px' }}>
              <div className="card">
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Total Generado (Hoy)</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent)' }}>
                  {formatCLP(revenueData.reduce((acc, curr) => acc + curr.totalAmount, 0))}
                </div>
              </div>
              <div className="card">
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Viajes con Tarjeta</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--info)' }}>
                  {formatCLP(revenueData.filter(d => d.paymentMethod === 'card').reduce((acc, curr) => acc + curr.totalAmount, 0))}
                </div>
              </div>
              <div className="card">
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Viajes en Efectivo</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--warning)' }}>
                  {formatCLP(revenueData.filter(d => d.paymentMethod === 'cash').reduce((acc, curr) => acc + curr.totalAmount, 0))}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table>
                <thead>
                  <tr>
                    <th>Conductor</th>
                    <th>Método</th>
                    <th>Viajes</th>
                    <th>Monto Total</th>
                    <th>Ticket Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueData.map((row, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700 }}>{row.driverName}</td>
                      <td>{row.paymentMethod === 'card' ? '💳 Mercado Pago' : '💵 Efectivo'}</td>
                      <td style={{ fontWeight: 600 }}>{row.tripCount}</td>
                      <td style={{ fontWeight: 800, color: 'var(--accent)' }}>{formatCLP(row.totalAmount)}</td>
                      <td>{formatCLP(row.totalAmount / row.tripCount)}</td>
                    </tr>
                  ))}
                  {revenueData.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        No hay registros de viajes para esta fecha.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── DETALLE CONDUCTOR ─────────────────────────────── */}
        {view === 'driver_detail' && selectedDriver && (
          <div className="animate-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setView('all_drivers')}>← Volver</button>
              <h1 style={{ fontSize: '1.4rem' }}>{selectedDriver.name}</h1>
              {statusBadge(selectedDriver.status)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div className="card">
                <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--text-muted)' }}>DATOS PERSONALES</h3>
                {[
                  ['Email', selectedDriver.email], ['Teléfono', selectedDriver.phone],
                  ['RUT', selectedDriver.rut], ['Domicilio', selectedDriver.address],
                  ['Nacimiento', new Date(selectedDriver.birthDate).toLocaleDateString('es-CL')],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                    <span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>

              <div className="card">
                <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--text-muted)' }}>VEHÍCULO</h3>
                {[
                  ['Marca/Modelo', `${selectedDriver.vehicleBrand} ${selectedDriver.vehicleModel}`],
                  ['Año', selectedDriver.vehicleYear], ['Patente', selectedDriver.vehiclePlate],
                  ['TAG', selectedDriver.tagNumber], ['Licencia N°', selectedDriver.licenseNumber],
                  ['Plan', selectedDriver.membershipPlan === 'PROGRESSIVE' ? '📈 Progresivo' : '💰 Prepago'],
                  ['Membresía', selectedDriver.membershipPaid ? '✅ Pagada' : '❌ Sin pagar'],
                  ['Rating', selectedDriver.totalRating > 0 ? `⭐ ${selectedDriver.totalRating.toFixed(1)}` : 'Nuevo'],
                  ['Viajes', selectedDriver.totalTrips],
                ].map(([k, v]) => (
                  <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                    <span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
                
                {/* Meta de Membresía (Solo Progresivo) */}
                {selectedDriver.membershipPlan === 'PROGRESSIVE' && !selectedDriver.membershipPaid && (
                  <div style={{ marginTop: '16px', background: 'rgba(0,229,160,0.05)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-accent)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Meta de Membresía</span>
                      <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{formatCLP(selectedDriver.membershipProgress)} / {formatCLP(selectedDriver.membershipGoal)}</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'var(--accent)', width: `${Math.min((selectedDriver.membershipProgress / selectedDriver.membershipGoal) * 100, 100)}%`, transition: 'width 0.5s ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                      <span>Efectivo Hoy: {selectedDriver.dailyCashTripsCount}/3</span>
                      <span>Límite de bencina activo</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Documentos */}
            <div className="card" style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '14px', color: 'var(--text-muted)' }}>DOCUMENTOS</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Cédula Frontal', url: selectedDriver.idFrontUrl },
                  { label: 'Cédula Posterior', url: selectedDriver.idBackUrl },
                  { label: 'Selfie Seguridad', url: selectedDriver.selfieUrl },
                  { label: 'Licencia', url: selectedDriver.licenseUrl },
                  { label: 'Foto Vehículo', url: selectedDriver.vehiclePhotoUrl },
                ].map(doc => (
                  doc.url ? (
                    <button key={doc.label} onClick={() => setImgModal(doc.url || null)} style={{ border: '2px solid var(--border)', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', background: 'var(--bg-card)', transition: 'var(--transition)' }} onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')} onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={doc.url} alt={doc.label} style={{ width: '120px', height: '80px', objectFit: 'cover', display: 'block' }} />
                      <div style={{ padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>{doc.label}</div>
                    </button>
                  ) : null
                ))}
              </div>
              {(() => {
                const urls = [selectedDriver.idFrontUrl, selectedDriver.idBackUrl, selectedDriver.selfieUrl, selectedDriver.licenseUrl, selectedDriver.vehiclePhotoUrl].filter(Boolean);
                const hasDuplicates = new Set(urls).size !== urls.length;
                if (hasDuplicates) {
                  return (
                    <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,0,0,0.1)', color: '#ff4d4d', borderRadius: '8px', fontSize: '0.85rem', border: '1px solid rgba(255,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>⚠️</span>
                      <div>
                        <strong>ALERTA DE SEGURIDAD:</strong> Se han detectado fotos duplicadas. El usuario subió la misma imagen para varios documentos.
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* HISTORIAL DE VIAJES */}
            <div className="card" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>HISTORIAL DE VIAJES</h3>
                
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pago:</span>
                    <select 
                      className="form-input" 
                      style={{ width: '120px', padding: '6px 10px', fontSize: '0.8rem' }}
                      value={historyPayment}
                      onChange={e => setHistoryPayment(e.target.value)}
                    >
                      <option value="all">Todos</option>
                      <option value="cash">💵 Efectivo</option>
                      <option value="card">💳 Tarjeta</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Pasajero</th>
                      <th>Destino</th>
                      <th>Método</th>
                      <th>Monto</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDriver.trips?.filter((t: any) => {
                      let matchPayment = true;
                      if (historyPayment !== 'all') {
                        matchPayment = t.paymentMethod === historyPayment;
                      }
                      return matchPayment;
                    }).map((trip: any) => (
                      <tr key={trip.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{new Date(trip.createdAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td style={{ fontWeight: 600 }}>{trip.passenger?.name || '—'}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{trip.destAddress}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {trip.paymentMethod === 'card' ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                            )}
                            {trip.paymentMethod === 'card' ? 'Tarjeta' : 'Efectivo'}
                          </div>
                        </td>
                        <td style={{ fontWeight: 700 }}>
                          {formatCLP(trip.estimatedPrice)}
                          {trip.isDiscounted && <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--accent)' }}>% Promo</span>}
                        </td>
                        <td>{statusBadge(trip.status)}</td>
                      </tr>
                    ))}
                    {(!selectedDriver.trips || selectedDriver.trips.length === 0) && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                          No hay viajes registrados para este conductor.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Acciones */}
            <div className="card">
              <h3 style={{ fontSize: '1rem', marginBottom: '14px', color: 'var(--text-muted)' }}>ACCIONES</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                {selectedDriver.status === 'pending' && <>
                  <button className="btn btn-success" disabled={loading} onClick={() => doAction(selectedDriver.id, 'approve')}>Aprobar</button>
                  <button className="btn btn-warning" disabled={loading} onClick={() => doAction(selectedDriver.id, 'membership')}>Aprobar + Activar</button>
                </>}
                {selectedDriver.status === 'approved' && !selectedDriver.membershipPaid && (
                  <button className="btn btn-primary" disabled={loading} onClick={() => doAction(selectedDriver.id, 'membership')}>Confirmar membresía pagada</button>
                )}
                {selectedDriver.status === 'active' && (
                  <button className="btn btn-danger" disabled={loading} onClick={() => { const r = prompt('Motivo de suspensión:'); if (r) doAction(selectedDriver.id, 'suspend', r); }}>Suspender</button>
                )}
                {(selectedDriver.status === 'pending' || selectedDriver.status === 'approved') && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input placeholder="Motivo de rechazo..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={{ width: '220px' }} />
                    <button className="btn btn-danger btn-sm" disabled={loading || !rejectReason} onClick={() => doAction(selectedDriver.id, 'reject', rejectReason)}>Rechazar</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
