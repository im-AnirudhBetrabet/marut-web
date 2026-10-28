import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import './admins.css';

const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/ + $ /, '');
const PERMISSIONS = [
  ['can_manage_users', 'Manage administrators', 'Invite teammates and manage access'],
  ['can_manage_products', 'Manage products', 'Edit the catalogue'],
  ['can_manage_product_prices', 'Manage product prices', 'Change pack pricing'],
  ['can_manage_feedback', 'Manage feedback', 'Review customer feedback'],
  ['can_manage_orders', 'Manage orders', 'Create and update orders'],
  ['can_manage_customers', 'Manage customers', 'Manage customer records'],
  ['can_manage_payments', 'Manage payments', 'Record and reconcile payments'],
  ['can_manage_refunds', 'Manage refunds', 'Handle refunds'],
  ['can_manage_delivery_zones', 'Manage delivery zones', 'Edit delivery areas and fees'],
  ['can_view_reports', 'View reports', 'Access business reports'],
];
const emptyPermissions = () => Object.fromEntries(PERMISSIONS.map(([key]) => [key, false]));
const dateLabel = (value) => value ? new Date(value).toLocaleDateString() : '—';

export default function Admins() {
  const [admins, setAdmins] = useState([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState('');
  const [email, setEmail] = useState('');
  const [invitePermissions, setInvitePermissions] = useState(emptyPermissions());
  const [editAdmin, setEditAdmin] = useState(null);
  const [editPermissions, setEditPermissions] = useState(emptyPermissions());
  const [busy, setBusy] = useState(false);
  const [deactivateAdmin, setDeactivateAdmin] = useState(null);

  const request = useCallback(async (path, options = {}) => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session?.access_token) throw new Error('Your session has expired. Please sign in again.');
    const response = await fetch(`${API}/api/v1/admins${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session.access_token}`,
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await request('/');
      const rows = Array.isArray(result.admins) ? result.admins : [];
      setAdmins(rows);
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id || '';
      setCurrentUserId(userId);
      setCurrentAdmin(rows.find((admin) => admin.user_id === userId) || null);
    } catch (e) {
      setError(e.message || 'Unable to load administrators.');
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = (setter, key, value) => setter((old) => ({ ...old, [key]: value }));

  async function invite(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const result = await request('/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), ...invitePermissions }),
      });
      setModal(''); setNotice(result.message || 'Invitation created. The invitee can set their password from the email link.');
      await refresh();
    } catch (e) { setError(e.message || 'Could not send invitation.'); }
    finally { setBusy(false); }
  }

  function startEdit(admin) {
    setEditAdmin(admin);
    setEditPermissions(Object.fromEntries(PERMISSIONS.map(([key]) => [key, Boolean(admin[key])])));
    setError(''); setModal('edit');
  }

  async function savePermissions(event) {
    event.preventDefault(); if (!editAdmin) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await request(`/${encodeURIComponent(editAdmin.user_id)}/permissions`, {
        method: 'PATCH', body: JSON.stringify(editPermissions),
      });
      setModal(''); setNotice('Administrator permissions updated.');
      await refresh();
    } catch (e) { setError(e.message || 'Could not update permissions.'); }
    finally { setBusy(false); }
  }

  async function deactivate() {
    if (!deactivateAdmin) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await request(`/${encodeURIComponent(deactivateAdmin.user_id)}/deactivate`, {
        method: 'PATCH', body: JSON.stringify({}),
      });
      setNotice('Administrator account deactivated.');
      setDeactivateAdmin(null); await refresh();
    } catch (e) {
      setError(e.message || 'Could not deactivate account.');
      setDeactivateAdmin(null);
    } finally { setBusy(false); }
  }

  const activeCount = admins.filter((a) => a.is_active).length;
  const canManageAdmins = currentAdmin?.role === 'owner' || currentAdmin?.can_manage_users === true;
  const isOwner = currentAdmin?.role === 'owner';

  return <main className="admins-page">
    <header className="admins-header">
      <div><p className="admins-eyebrow">WORKSPACE SETTINGS</p><h1>Administrators</h1>
        <p className="admins-subtitle">Invite teammates and manage MARUT workspace access.</p></div>
      {
        canManageAdmins && <button className="admins-primary" onClick={() => {
        setEmail(''); setInvitePermissions(emptyPermissions()); setError(''); setModal('invite');
      }}>＋ Invite administrator</button>
      }
    </header>

    {notice && <div className="admins-notice" role="status">{notice}</div>}
    {error && !modal && <div className="admins-alert" role="alert">{error}</div>}

    <section className="admins-stats">
      <div><span>Total administrators</span><strong>{admins.length}</strong></div>
      <div><span>Active accounts</span><strong>{activeCount}</strong></div>
      <div><span>Access model</span><strong className="admins-stat-small">Permission-based</strong></div>
    </section>

    <section className="admins-panel">
      <div className="admins-panel-head">
        <div><h2>Team access</h2>
      </div>
        <button className="admins-secondary" onClick={refresh} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
      {loading ? <p className="admins-empty">Loading administrators…</p> :
        admins.length === 0 ? <p className="admins-empty">No administrator records found.</p> :
          <div className="admins-table-wrap"><table className="admins-table">
            <thead><tr><th>Administrator</th><th>Role</th><th>Permissions</th><th>Added</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{admins.map((a) => {
              const count = PERMISSIONS.filter(([key]) => a[key]).length;
              return <tr key={a.user_id}>
                <td><strong>{a.role === 'owner' ? 'Workspace owner' : 'Staff administrator'}</strong><small className="admins-uuid">{a.email}</small></td>
                <td><span className={`admins-role ${a.role === 'owner' ? 'owner' : ''}`}>{a.role || 'staff'}</span></td>
                <td>{count} / 10</td><td>{dateLabel(a.created_at)}</td>
                <td><span className={`admins-status ${a.is_active ? 'active' : ''}`}>{a.is_active ? '● Active' : '● Inactive'}</span></td>
                <td><div className="admins-actions">
                  {canManageAdmins && a.role !== 'owner' && <button className="admins-link" disabled={!a.is_active} onClick={() => startEdit(a)}>Edit access</button>}
                  {a.role !== 'owner' && a.is_active && a.user_id !== currentUserId && <button className="admins-danger-link" onClick={() => setDeactivateAdmin(a)}>Deactivate</button>}
                </div></td>
              </tr>;
            })}</tbody>
          </table></div>}
    </section>

    <section className="admins-panel admins-guide"><h2>Permission guide</h2>
      <p>{isOwner ? 'You can manage permissions for staff administrators. Owner accounts are protected.' : 'You can manage staff permissions, but cannot grant access you do not hold or change administrator-management access.'} The API remains the source of truth for access checks.</p>
      <div className="admins-chips">{PERMISSIONS.map(([, label]) => <span key={label}>{label}</span>)}</div>
    </section>

    {(modal === 'invite' || modal === 'edit') && <div className="admins-overlay" onMouseDown={(e) => {
      if (e.target === e.currentTarget && !busy) setModal('');
    }}>
      <section className="admins-modal" role="dialog" aria-modal="true" aria-labelledby="admins-modal-title">
        <header className="admins-modal-head"><div><p className="admins-eyebrow">{modal === 'invite' ? 'TEAM ACCESS' : 'ACCESS CONTROL'}</p>
          <h2 id="admins-modal-title">{modal === 'invite' ? 'Invite administrator' : 'Edit permissions'}</h2>
          <p>{modal === 'invite' ? 'They will receive an email to set their password.' : editAdmin?.user_id}</p></div>
          <button className="admins-close" type="button" disabled={busy} onClick={() => setModal('')} aria-label="Close">×</button>
        </header>
        <form onSubmit={modal === 'invite' ? invite : savePermissions}>
          {modal === 'invite' && <><label className="admins-label" htmlFor="admins-email">Email address</label>
            <input id="admins-email" className="admins-input" type="email" required maxLength={254} autoComplete="email"
              placeholder="teammate@example.com" value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} /></>}
          <div className="admins-permission-head"><div><h3>Permissions</h3><p>Grant only the access they need.</p></div>
            <button className="admins-link" type="button" disabled={busy}
              onClick={() => (modal === 'invite' ? setInvitePermissions(emptyPermissions()) : setEditPermissions(emptyPermissions()))}>Clear all</button></div>
          <div className="admins-permission-list">{PERMISSIONS.map(([key, label, description]) => {
            const values = modal === 'invite' ? invitePermissions : editPermissions;
            const setter = modal === 'invite' ? setInvitePermissions : setEditPermissions;
            return <label className="admins-permission" key={key}><span><strong>{label}</strong><small>{description}</small></span>
              <input type="checkbox" checked={Boolean(values[key])}
                disabled={busy || (modal === 'invite' && (
                  (key === 'can_manage_users' && !isOwner) ||
                  (!isOwner && !currentAdmin?.[key])
                )) || (modal === 'edit' && !isOwner && (
                  key === 'can_manage_users' || !currentAdmin?.[key]
                ))}
                onChange={(e) => toggle(setter, key, e.target.checked)} /></label>;
          })}</div>
          {error && <div className="admins-alert" role="alert">{error}</div>}
          <footer className="admins-modal-footer"><button className="admins-secondary" type="button" disabled={busy} onClick={() => setModal('')}>Cancel</button>
            <button className="admins-primary" type="submit" disabled={busy}>{busy ? 'Please wait…' : modal === 'invite' ? 'Send invitation' : 'Save permissions'}</button></footer>
        </form>
      </section>
    </div>}

    {deactivateAdmin && <div className="admins-overlay"><section className="admins-confirm" role="dialog" aria-modal="true" aria-labelledby="admins-deactivate-title">
      <div className="admins-warning">!</div><h2 id="admins-deactivate-title">Deactivate this account?</h2>
      <p>This will remove the administrator's active access. Confirm that this is the intended account.</p>
      <small className="admins-uuid">{deactivateAdmin.user_id}</small>
      <footer className="admins-modal-footer"><button className="admins-secondary" disabled={busy} onClick={() => setDeactivateAdmin(null)}>Cancel</button>
        <button className="admins-danger-button" disabled={busy} onClick={deactivate}>{busy ? 'Deactivating…' : 'Deactivate account'}</button></footer>
    </section></div>}
  </main>;
}
