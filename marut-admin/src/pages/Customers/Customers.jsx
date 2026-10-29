import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import './customers.css';

const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const PAGE_SIZE = 20;
const EMPTY_CUSTOMER = { full_name: '', phone: '', email: '', customer_type: 'individual', notes: '' };
const EMPTY_ADDRESS = {
    label: '', recipient_name: '', phone: '', address_line1: '', address_line2: '', area: '',
    city: 'Bengaluru', state: 'Karnataka', postal_code: '', delivery_instructions: '', is_default: false,
};

const money = (amount, currency = 'INR') => {
    const number = Number(amount);
    if (!Number.isFinite(number)) return '—';
    try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(number); }
    catch { return `₹${number.toLocaleString('en-IN')}`; }
};
const dateLabel = (value, includeTime = false) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-IN', includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
};
const humanize = (value) => String(value || '—').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const errorMessage = (body, fallback) => {
    if (body?.duplicate_fields?.length) return `A customer with this ${body.duplicate_fields.join(' and ')} already exists. Check the existing customer record before continuing.`;
    return body?.error || fallback;
};

function Icon({ name }) {
    const paths = {
        search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
        plus: <><path d="M12 5v14M5 12h14" /></>,
        users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
        arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
        back: <><path d="m15 18-6-6 6-6" /></>,
        pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
        phone: <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 2.8a2 2 0 0 1-.6 1.8L7.7 9.6a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 1.8-.6l2.8.5a2 2 0 0 1 1.7 2.7Z" /></>,
        mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
        archive: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8m-7 4v5m-3-3 3 3 3-3" /></>,
        edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
        close: <><path d="m18 6-12 12M6 6l12 12" /></>,
        bag: <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
        check: <><path d="m5 12 4 4L19 6" /></>,
        alert: <><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></>,
        refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" /></>,
    };
    return <svg className="mc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.users}</svg>;
}

function useCustomerApi() {
    return useCallback(async (path, options = {}) => {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session?.access_token) throw new Error('Your session has expired. Please sign in again.');
        let response;
        try {
            response = await fetch(`${API}/api/v1/customers${path}`, {
                ...options,
                headers: {
                    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                    Authorization: `Bearer ${data.session.access_token}`,
                    ...(options.headers || {}),
                },
            });
        } catch {
            throw new Error('Could not connect to the MARUT API. Check that the backend is running and VITE_API_BASE_URL is correct.');
        }
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = response.status === 403 ? 'You do not have permission to manage customers.' : errorMessage(body, `Request failed (${response.status}).`);
            const error = new Error(message);
            error.status = response.status;
            error.body = body;
            throw error;
        }
        return body;
    }, []);
}

function Notice({ type = 'error', children, onClose }) {
    if (!children) return null;
    return <div className={`mc-notice mc-notice--${type}`} role={type === 'error' ? 'alert' : 'status'}><span className="mc-notice-icon"><Icon name={type === 'error' ? 'alert' : 'check'} /></span><span>{children}</span>{onClose && <button className="mc-icon-button" onClick={onClose} aria-label="Dismiss message"><Icon name="close" /></button>}</div>;
}

function Modal({ title, eyebrow, onClose, children, footer, wide = false }) {
    useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return <div className="mc-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <section className={`mc-modal ${wide ? 'mc-modal--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="mc-modal-title">
            <header className="mc-modal-header"><div><div className="mc-eyebrow">{eyebrow || 'MARUT CUSTOMERS'}</div><h2 id="mc-modal-title">{title}</h2></div><button className="mc-icon-button" onClick={onClose} aria-label="Close modal"><Icon name="close" /></button></header>
            <div className="mc-modal-body">{children}</div>{footer && <footer className="mc-modal-footer">{footer}</footer>}
        </section>
    </div>;
}

function CustomerFormModal({ customer, onClose, onSaved, request }) {
    const [form, setForm] = useState(() => customer ? { full_name: customer.full_name || '', phone: customer.phone || '', email: customer.email || '', customer_type: customer.customer_type || 'individual', notes: customer.notes || '' } : { ...EMPTY_CUSTOMER });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
    const submit = async (event) => {
        event.preventDefault(); setBusy(true); setError('');
        const payload = { ...form, email: form.email.trim(), notes: form.notes.trim() || null };
        try {
            const result = await request(customer ? `/${customer.id}` : '', { method: customer ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
            onSaved(result.customer, Boolean(customer));
        } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    };
    return <Modal title={customer ? 'Edit customer' : 'Add customer'} onClose={onClose} footer={<><button className="mc-button mc-button--quiet" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="mc-button mc-button--primary" type="submit" form="mc-customer-form" disabled={busy}>{busy ? 'Saving…' : customer ? 'Save changes' : 'Create customer'}</button></>}>
        <form id="mc-customer-form" onSubmit={submit} className="mc-form">
            <Notice>{error}</Notice>
            <div className="mc-field"><label htmlFor="mc-full-name">Full name <span>*</span></label><input id="mc-full-name" required maxLength={200} value={form.full_name} onChange={(e) => update('full_name', e.target.value)} autoFocus placeholder="Customer or restaurant name" /></div>
            <div className="mc-form-grid"><div className="mc-field"><label htmlFor="mc-phone">Phone number <span>*</span></label><input id="mc-phone" required minLength={7} maxLength={25} value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+91 98765 43210" /></div><div className="mc-field"><label htmlFor="mc-email">Email</label><input id="mc-email" type="email" maxLength={254} value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="name@example.com" /></div></div>
            <div className="mc-field"><label htmlFor="mc-customer-type">Customer type <span>*</span></label><select id="mc-customer-type" value={form.customer_type} onChange={(e) => update('customer_type', e.target.value)}><option value="individual">Individual</option><option value="restaurant">Restaurant</option></select></div>
            <div className="mc-field"><label htmlFor="mc-customer-notes">Internal notes</label><textarea id="mc-customer-notes" rows={4} maxLength={5000} value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Preferences, delivery notes or other context…" /><small>{form.notes.length}/5000 characters</small></div>
        </form>
    </Modal>;
}

function AddressFormModal({ address, onClose, onSaved, request, customerId, canDelete = false, onDelete }) {
    const [form, setForm] = useState(() => address ? { ...EMPTY_ADDRESS, ...address } : { ...EMPTY_ADDRESS });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
    const submit = async (event) => {
        event.preventDefault(); setBusy(true); setError('');
        const payload = { ...form, label: form.label.trim() || null, address_line2: form.address_line2.trim() || null, delivery_instructions: form.delivery_instructions.trim() || null };
        try {
            const result = await request(`/${customerId}/addresses${address ? `/${address.id}` : ''}`, { method: address ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
            onSaved(result.address, Boolean(address));
        } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    };
    return <Modal title={address ? 'Edit address' : 'Add delivery address'} eyebrow="CUSTOMER ADDRESS BOOK" onClose={onClose} wide footer={<><button className="mc-button mc-button--quiet" type="button" onClick={onClose} disabled={busy}>Cancel</button>{canDelete && <button className="mc-button mc-button--danger-quiet" type="button" onClick={onDelete} disabled={busy}>Delete address</button>}<button className="mc-button mc-button--primary" type="submit" form="mc-address-form" disabled={busy}>{busy ? 'Saving…' : address ? 'Save address' : 'Add address'}</button></>}>
        <form id="mc-address-form" onSubmit={submit} className="mc-form">
            <Notice>{error}</Notice>
            <div className="mc-form-grid"><div className="mc-field"><label htmlFor="mc-address-label">Address label</label><input id="mc-address-label" maxLength={80} value={form.label || ''} onChange={(e) => update('label', e.target.value)} placeholder="Home, Office, Restaurant…" /></div><div className="mc-field"><label htmlFor="mc-address-recipient">Recipient name <span>*</span></label><input id="mc-address-recipient" required maxLength={200} value={form.recipient_name || ''} onChange={(e) => update('recipient_name', e.target.value)} /></div></div>
            <div className="mc-field"><label htmlFor="mc-address-phone">Contact phone <span>*</span></label><input id="mc-address-phone" required minLength={7} maxLength={25} value={form.phone || ''} onChange={(e) => update('phone', e.target.value)} /></div>
            <div className="mc-field"><label htmlFor="mc-address-line1">Address line 1 <span>*</span></label><input id="mc-address-line1" required maxLength={300} value={form.address_line1 || ''} onChange={(e) => update('address_line1', e.target.value)} placeholder="Building, street, landmark" /></div>
            <div className="mc-field"><label htmlFor="mc-address-line2">Address line 2</label><input id="mc-address-line2" maxLength={300} value={form.address_line2 || ''} onChange={(e) => update('address_line2', e.target.value)} placeholder="Apartment, suite, floor (optional)" /></div>
            <div className="mc-form-grid mc-form-grid--three"><div className="mc-field"><label htmlFor="mc-address-area">Area <span>*</span></label><input id="mc-address-area" required maxLength={150} value={form.area || ''} onChange={(e) => update('area', e.target.value)} /></div><div className="mc-field"><label htmlFor="mc-address-city">City <span>*</span></label><input id="mc-address-city" required maxLength={150} value={form.city || ''} onChange={(e) => update('city', e.target.value)} /></div><div className="mc-field"><label htmlFor="mc-address-postal">Postal code <span>*</span></label><input id="mc-address-postal" required minLength={4} maxLength={12} value={form.postal_code || ''} onChange={(e) => update('postal_code', e.target.value)} /></div></div>
            <div className="mc-field"><label htmlFor="mc-address-state">State <span>*</span></label><input id="mc-address-state" required maxLength={150} value={form.state || ''} onChange={(e) => update('state', e.target.value)} /></div>
            <div className="mc-field"><label htmlFor="mc-address-instructions">Delivery instructions</label><textarea id="mc-address-instructions" rows={3} maxLength={2000} value={form.delivery_instructions || ''} onChange={(e) => update('delivery_instructions', e.target.value)} placeholder="Gate code, preferred drop-off, timing…" /></div>
            <label className="mc-check-row"><input type="checkbox" checked={Boolean(form.is_default)} onChange={(e) => update('is_default', e.target.checked)} /><span><strong>Set as default address</strong><small>Use this as the primary address for this customer.</small></span></label>
        </form>
    </Modal>;
}

export default function Customers() {
    const request = useCustomerApi();
    const navigate = useNavigate();
    const [customers, setCustomers] = useState([]);
    const [pagination, setPagination] = useState({ limit: PAGE_SIZE, offset: 0, total: 0 });
    const [filters, setFilters] = useState({ search: '', customer_type: '', include_archived: false });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [modalCustomer, setModalCustomer] = useState(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [actionBusy, setActionBusy] = useState('');
    const loadCustomers = useCallback(async (offset = 0, currentFilters = filters) => {
        setLoading(true); setError('');
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
        if (currentFilters.search.trim()) params.set('search', currentFilters.search.trim());
        if (currentFilters.customer_type) params.set('customer_type', currentFilters.customer_type);
        if (currentFilters.include_archived) params.set('include_archived', 'true');
        try {
            const result = await request(`?${params.toString()}`);
            setCustomers(result.customers || []); setPagination(result.pagination || { limit: PAGE_SIZE, offset, total: 0 });
        } catch (err) { setError(err.message); setCustomers([]); }
        finally { setLoading(false); }
    }, [filters, request]);
    useEffect(() => { const timer = window.setTimeout(() => loadCustomers(0, filters), 250); return () => window.clearTimeout(timer); }, [filters.search, filters.customer_type, filters.include_archived, loadCustomers]);

    const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
    const savedCustomer = (customer, isEdit) => { setCreateOpen(false); setModalCustomer(null); setNotice(isEdit ? 'Customer details updated.' : 'Customer created successfully.'); loadCustomers(0, filters); if (!isEdit && customer?.id) navigate(`/customers/${customer.id}`); };
    const toggleArchive = async (customer) => {
        const action = customer.is_active ? 'archive' : 'restore';
        const confirmation = customer.is_active
            ? `Archive ${customer.full_name}? Their order history will be retained, but they will no longer appear in the active customer list.`
            : `Restore ${customer.full_name}?`;
        if (!window.confirm(confirmation)) return;
        setActionBusy(customer.id); setError(''); setNotice('');
        try { await request(`/${customer.id}/${action}`, { method: 'PATCH' }); setNotice(customer.is_active ? 'Customer archived. Order history has been preserved.' : 'Customer restored.'); await loadCustomers(pagination.offset, filters); }
        catch (err) { setError(err.message); }
        finally { setActionBusy(''); }
    };

    const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / PAGE_SIZE));
    const currentPage = Math.floor((pagination.offset || 0) / PAGE_SIZE) + 1;
    const activeVisible = customers.filter((customer) => customer.is_active).length;
    const restaurantVisible = customers.filter((customer) => customer.customer_type === 'restaurant').length;

    return <main className="mc-page">
        <div className="mc-page-topline"><div className="mc-breadcrumb">MARUT <span>/</span> Customers</div><div className="mc-live-label"><span /> CUSTOMER DIRECTORY</div></div>
        <section className="mc-page-heading"><div><div className="mc-eyebrow">RELATIONSHIPS, WELL GROWN</div><h1>Customers</h1><p>Keep customer details, delivery addresses and order history in one place.</p></div><button className="mc-button mc-button--primary" onClick={() => { setModalCustomer(null); setCreateOpen(true); }}><Icon name="plus" /> Add customer</button></section>
        <div className="mc-metrics">
            <article className="mc-metric"><div className="mc-metric-icon mc-metric-icon--sage"><Icon name="users" /></div><div><span>Customers in view</span><strong>{loading ? '—' : pagination.total.toLocaleString('en-IN')}</strong><small>{filters.include_archived ? 'Active and archived records' : 'Active customer records'}</small></div></article>
            <article className="mc-metric"><div className="mc-metric-icon mc-metric-icon--sand"><Icon name="users" /></div><div><span>Active on this page</span><strong>{loading ? '—' : activeVisible}</strong><small>Of {customers.length} displayed</small></div></article>
            <article className="mc-metric"><div className="mc-metric-icon mc-metric-icon--clay"><Icon name="bag" /></div><div><span>Restaurant accounts</span><strong>{loading ? '—' : restaurantVisible}</strong><small>On this page</small></div></article>
        </div>
        <Notice>{error}</Notice><Notice type="success" onClose={() => setNotice('')}>{notice}</Notice>
        <section className="mc-directory-panel">
            <div className="mc-directory-toolbar"><div><h2>Customer directory</h2><p>Search and manage your customer relationships.</p></div><button className="mc-button mc-button--quiet mc-refresh" onClick={() => loadCustomers(pagination.offset, filters)} disabled={loading}><Icon name="refresh" /> Refresh</button></div>
            <div className="mc-filter-row"><label className="mc-search"><Icon name="search" /><input value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} maxLength={120} placeholder="Search name, phone or email" aria-label="Search customers" /></label><select aria-label="Filter customer type" value={filters.customer_type} onChange={(e) => updateFilter('customer_type', e.target.value)}><option value="">All customer types</option><option value="individual">Individuals</option><option value="restaurant">Restaurants</option></select><label className="mc-check-filter"><input type="checkbox" checked={filters.include_archived} onChange={(e) => updateFilter('include_archived', e.target.checked)} /> Include archived</label></div>
            <div className="mc-table-wrap"><table className="mc-table"><thead><tr><th>Customer</th><th>Contact</th><th>Type</th><th>Status</th><th>Added</th><th aria-label="Actions" /></tr></thead><tbody>
                {loading && <tr><td colSpan="6"><div className="mc-table-state"><span className="mc-spinner" /> Loading customers…</div></td></tr>}
                {!loading && !customers.length && <tr><td colSpan="6"><div className="mc-empty"><div className="mc-empty-mark"><Icon name="users" /></div><h3>{filters.search || filters.customer_type ? 'No matching customers' : 'Your customer book is ready'}</h3><p>{filters.search || filters.customer_type ? 'Try changing the search or filters.' : 'Add your first customer to start building their address book and order history.'}</p>{!filters.search && !filters.customer_type && <button className="mc-button mc-button--primary" onClick={() => setCreateOpen(true)}><Icon name="plus" /> Add first customer</button>}</div></td></tr>}
                {!loading && customers.map((customer) => <tr key={customer.id}>
                    <td><button className="mc-customer-name" onClick={() => navigate(`/customers/${customer.id}`)}><span className="mc-avatar">{(customer.full_name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><span><strong>{customer.full_name}</strong><small>{customer.email || 'No email added'}</small></span></button></td>
                    <td><a className="mc-contact-link" href={`tel:${String(customer.phone || '').replace(/[^+\d]/g, '')}`}><Icon name="phone" />{customer.phone}</a></td>
                    <td><span className={`mc-type-pill mc-type-pill--${customer.customer_type}`}>{customer.customer_type === 'restaurant' ? 'Restaurant' : 'Individual'}</span></td>
                    <td><span className={`mc-status-pill ${customer.is_active ? 'is-active' : 'is-archived'}`}><span />{customer.is_active ? 'Active' : 'Archived'}</span></td>
                    <td className="mc-date-cell">{dateLabel(customer.created_at)}</td>
                    <td><div className="mc-row-actions"><button className="mc-icon-button" onClick={() => { setModalCustomer(customer); setCreateOpen(false); }} title="Edit customer" aria-label={`Edit ${customer.full_name}`}><Icon name="edit" /></button><button className="mc-icon-button" onClick={() => toggleArchive(customer)} disabled={actionBusy === customer.id} title={customer.is_active ? 'Archive customer' : 'Restore customer'} aria-label={customer.is_active ? `Archive ${customer.full_name}` : `Restore ${customer.full_name}`}><Icon name={customer.is_active ? 'archive' : 'refresh'} /></button><button className="mc-icon-button mc-row-open" onClick={() => navigate(`/customers/${customer.id}`)} title="Open customer profile" aria-label={`Open ${customer.full_name}`}><Icon name="arrow" /></button></div></td>
                </tr>)}
            </tbody></table></div>
            <footer className="mc-table-footer"><span>{pagination.total ? `Showing ${(pagination.offset || 0) + 1}–${Math.min((pagination.offset || 0) + customers.length, pagination.total)} of ${pagination.total} customers` : 'No customers to display'}</span><div className="mc-pagination"><button className="mc-button mc-button--quiet mc-button--small" disabled={loading || currentPage <= 1} onClick={() => loadCustomers(Math.max(0, pagination.offset - PAGE_SIZE), filters)}>Previous</button><span>Page {currentPage} of {totalPages}</span><button className="mc-button mc-button--quiet mc-button--small" disabled={loading || currentPage >= totalPages} onClick={() => loadCustomers(pagination.offset + PAGE_SIZE, filters)}>Next</button></div></footer>
        </section>
        {(createOpen || modalCustomer) && <CustomerFormModal customer={modalCustomer} request={request} onClose={() => { setCreateOpen(false); setModalCustomer(null); }} onSaved={savedCustomer} />}
    </main>;
}

export function CustomerProfile({ orderDetailPath = (order) => `/orders/${order.id}`, onOpenOrder }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const request = useCustomerApi();
    const [record, setRecord] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [customerModal, setCustomerModal] = useState(false);
    const [addressModal, setAddressModal] = useState(false);
    const [editingAddress, setEditingAddress] = useState(null);
    const [actionBusy, setActionBusy] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

    const loadProfile = useCallback(async () => {
        setLoading(true); setError('');
        try { const result = await request(`/${id}`); setRecord(result); }
        catch (err) { setError(err.message); setRecord(null); }
        finally { setLoading(false); }
    }, [id, request]);
    useEffect(() => { loadProfile(); }, [loadProfile]);

    const customer = record?.customer;
    const addresses = record?.addresses || [];
    const orders = record?.orders || [];
    const summary = record?.summary || {};
    const completedCount = summary.completed_orders_returned ?? orders.filter((order) => order.status === 'completed').length;
    const completedValue = summary.completed_order_value ?? 0;

    const customerSaved = (updated, isEdit) => { setCustomerModal(false); setRecord((current) => current ? { ...current, customer: updated } : current); setNotice(isEdit ? 'Customer details updated.' : 'Customer created.'); };
    const addressSaved = (saved, isEdit) => {
        setAddressModal(false); setEditingAddress(null);
        setRecord((current) => {
            if (!current) return current;
            let nextAddresses = isEdit ? current.addresses.map((item) => item.id === saved.id ? saved : item) : [...current.addresses, saved];
            if (saved.is_default) nextAddresses = nextAddresses.map((item) => ({ ...item, is_default: item.id === saved.id }));
            return { ...current, addresses: nextAddresses.sort((a, b) => Number(Boolean(b.is_default)) - Number(Boolean(a.is_default))) };
        });
        setNotice(isEdit ? 'Address updated.' : 'Address added.');
        loadProfile();
    };
    const setDefaultAddress = async (address) => {
        setActionBusy(true); setError(''); setNotice('');
        try { await request(`/${customer.id}/addresses/${address.id}`, { method: 'PATCH', body: JSON.stringify({ is_default: true }) }); await loadProfile(); setNotice('Default address updated.'); }
        catch (err) { setError(err.message); }
        finally { setActionBusy(false); }
    };
    const deleteAddress = async (address) => {
        if (!window.confirm(`Delete this ${address.label || 'delivery'} address? This cannot be undone.`)) return;
        setActionBusy(true); setError(''); setNotice('');
        try { await request(`/${customer.id}/addresses/${address.id}`, { method: 'DELETE' }); setAddressModal(false); setEditingAddress(null); await loadProfile(); setNotice('Address deleted.'); }
        catch (err) { setError(err.message); }
        finally { setActionBusy(false); }
    };
    const archiveRestore = async () => {
        const action = customer.is_active ? 'archive' : 'restore';
        if (!window.confirm(customer.is_active ? `Archive ${customer.full_name}? Their order history will be retained.` : `Restore ${customer.full_name}?`)) return;
        setActionBusy(true); setError(''); setNotice('');
        try { const result = await request(`/${customer.id}/${action}`, { method: 'PATCH' }); setRecord((current) => ({ ...current, customer: result.customer })); setNotice(customer.is_active ? 'Customer archived. Order history has been preserved.' : 'Customer restored.'); }
        catch (err) { setError(err.message); }
        finally { setActionBusy(false); }
    };

    if (loading) return <main className="mc-page"><div className="mc-profile-loading"><span className="mc-spinner" /><p>Loading customer profile…</p></div></main>;
    if (!record) return <main className="mc-page"><button className="mc-button mc-button--quiet" onClick={() => navigate('/customers')}><Icon name="back" /> Back to customers</button><div className="mc-profile-error"><Notice>{error || 'Customer not found.'}</Notice><button className="mc-button mc-button--primary" onClick={() => navigate('/customers')}>Return to directory</button></div></main>;

    const openOrder = (order) => {
        if (onOpenOrder) onOpenOrder(order);
        else navigate(typeof orderDetailPath === 'function' ? orderDetailPath(order) : String(orderDetailPath).replace(':id', order.id));
    };

    return (
        <main className="mc-page mc-profile-page">
            <div className="mc-page-topline">
                <button className="mc-back-link" onClick={() => navigate('/customers')}>
                    <Icon name="back" />
                    All customers
                </button>
                <div className="mc-live-label">
                    <span /> 
                    CUSTOMER PROFILE
                </div>
            </div>
            <section className="mc-profile-hero">
                <div className="mc-profile-identity">
                    <div className="mc-avatar mc-avatar--large">
                        {
                            (customer.full_name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
                        }
                    </div>
                <div>
                <div className="mc-profile-badges">
                    <span className={`mc-type-pill mc-type-pill--${customer.customer_type}`}>
                        {humanize(customer.customer_type)}
                    </span><span className={`mc-status-pill ${customer.is_active ? 'is-active' : 'is-archived'}`}><span />{customer.is_active ? 'Active customer' : 'Archived customer'}</span></div><h1>{customer.full_name}</h1><p className="mc-profile-since">Customer since {dateLabel(customer.created_at)}</p><div className="mc-profile-contact"><span><Icon name="phone" />{customer.phone}</span>{customer.email && <a href={`mailto:${customer.email}`}><Icon name="mail" />{customer.email}</a>}</div></div></div><div className="mc-profile-actions"><button className="mc-button mc-button--quiet" onClick={() => setCustomerModal(true)}><Icon name="edit" /> Edit details</button><button className={`mc-button ${customer.is_active ? 'mc-button--danger-quiet' : 'mc-button--primary'}`} onClick={archiveRestore} disabled={actionBusy}><Icon name={customer.is_active ? 'archive' : 'refresh'} />{customer.is_active ? 'Archive' : 'Restore'}</button></div></section>
            <Notice>{error}</Notice><Notice type="success" onClose={() => setNotice('')}>{notice}</Notice>
            {!customer.is_active && <div className="mc-archived-banner"><Icon name="archive" /><span><strong>This customer is archived.</strong> You can review their history, but addresses cannot be added until the customer is restored.</span><button className="mc-button mc-button--quiet mc-button--small" onClick={archiveRestore} disabled={actionBusy}>Restore customer</button></div>}
            <div className="mc-profile-metrics"><article className="mc-profile-stat"><span>Orders returned</span><strong>{summary.orders_returned ?? orders.length}</strong><small>Most recent 100 orders at most</small></article><article className="mc-profile-stat"><span>Completed orders returned</span><strong>{completedCount}</strong><small>Within the returned order history</small></article><article className="mc-profile-stat"><span>Completed order value</span><strong>{money(completedValue, orders[0]?.currency || 'INR')}</strong><small>Completed orders returned only</small></article><article className="mc-profile-stat"><span>Saved addresses</span><strong>{addresses.length}</strong><small>{addresses.some((address) => address.is_default) ? 'Default address set' : 'No default address set'}</small></article></div>
            <nav className="mc-profile-tabs" aria-label="Customer profile sections"><button className={activeTab === 'overview' ? 'is-current' : ''} onClick={() => setActiveTab('overview')}>Overview</button><button className={activeTab === 'addresses' ? 'is-current' : ''} onClick={() => setActiveTab('addresses')}>Addresses <span>{addresses.length}</span></button><button className={activeTab === 'orders' ? 'is-current' : ''} onClick={() => setActiveTab('orders')}>Order history <span>{orders.length}</span></button></nav>
            {activeTab === 'overview' && <div className="mc-profile-grid"><section className="mc-content-card"><div className="mc-card-heading"><div><div className="mc-eyebrow">CUSTOMER INFORMATION</div><h2>About this customer</h2></div><button className="mc-icon-button" onClick={() => setCustomerModal(true)} aria-label="Edit customer information"><Icon name="edit" /></button></div><dl className="mc-detail-list"><div><dt>Full name</dt><dd>{customer.full_name}</dd></div><div><dt>Customer type</dt><dd>{humanize(customer.customer_type)}</dd></div><div><dt>Phone</dt><dd>{customer.phone}</dd></div><div><dt>Email</dt><dd>{customer.email || 'Not provided'}</dd></div><div className="mc-detail-notes"><dt>Internal notes</dt><dd>{customer.notes || 'No notes added yet.'}</dd></div><div><dt>Last updated</dt><dd>{dateLabel(customer.updated_at, true)}</dd></div></dl></section><section className="mc-content-card"><div className="mc-card-heading"><div><div className="mc-eyebrow">DELIVERY DETAILS</div><h2>Address book</h2></div>{customer.is_active && <button className="mc-button mc-button--quiet mc-button--small" onClick={() => { setEditingAddress(null); setAddressModal(true); }}><Icon name="plus" /> Add</button>}</div>{addresses.length ? <div className="mc-address-stack">{addresses.slice(0, 3).map((address) => <article className="mc-address-compact" key={address.id}><div className="mc-address-heading"><strong>{address.label || 'Delivery address'}</strong>{address.is_default && <span className="mc-default-pill">Default</span>}</div><p>{address.recipient_name} · {address.phone}</p><p>{address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ''}</p><p>{address.area}, {address.city} {address.postal_code}</p></article>)}</div> : <div className="mc-inline-empty"><Icon name="pin" /><p>No saved addresses yet.</p>{customer.is_active && <button className="mc-text-button" onClick={() => { setEditingAddress(null); setAddressModal(true); }}>Add first address</button>}</div>}{addresses.length > 3 && <button className="mc-text-button" onClick={() => setActiveTab('addresses')}>View all {addresses.length} addresses <Icon name="arrow" /></button>}</section><section className="mc-content-card mc-recent-orders-card"><div className="mc-card-heading"><div><div className="mc-eyebrow">RECENT ACTIVITY</div><h2>Latest orders</h2></div><button className="mc-text-button" onClick={() => setActiveTab('orders')}>View all <Icon name="arrow" /></button></div>{orders.length ? <div className="mc-mini-order-list">{orders.slice(0, 4).map((order) => <button key={order.id} className="mc-mini-order" onClick={() => openOrder(order)}><span className="mc-order-glyph"><Icon name="bag" /></span><span className="mc-mini-order-main"><strong>{order.order_number || `Order ${String(order.id).slice(0, 8)}`}</strong><small>{dateLabel(order.created_at)} · {humanize(order.source)}</small></span><span className="mc-mini-order-right"><strong>{money(order.total_amount, order.currency)}</strong><small className={`mc-order-status mc-order-status--${order.status}`}>{humanize(order.status)}</small></span><Icon name="arrow" /></button>)}</div> : <div className="mc-inline-empty"><Icon name="bag" /><p>No orders are linked to this customer yet.</p></div>}</section></div>}
            {activeTab === 'addresses' && <section className="mc-content-card mc-tab-card"><div className="mc-card-heading"><div><div className="mc-eyebrow">SAVED DELIVERY LOCATIONS</div><h2>Address book</h2><p>Manage delivery details and choose the customer's default address.</p></div>{customer.is_active && <button className="mc-button mc-button--primary" onClick={() => { setEditingAddress(null); setAddressModal(true); }}><Icon name="plus" /> Add address</button>}</div>{addresses.length ? <div className="mc-address-grid">{addresses.map((address) => <article className={`mc-address-card ${address.is_default ? 'is-default' : ''}`} key={address.id}><div className="mc-address-card-top"><span className="mc-address-symbol"><Icon name="pin" /></span><div className="mc-address-title"><h3>{address.label || 'Delivery address'}</h3>{address.is_default && <span className="mc-default-pill">Default address</span>}</div><button className="mc-icon-button" onClick={() => { setEditingAddress(address); setAddressModal(true); }} aria-label={`Edit ${address.label || 'address'}`}><Icon name="edit" /></button></div><div className="mc-address-copy"><strong>{address.recipient_name}</strong><span>{address.phone}</span><p>{address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ''}</p><p>{address.area}, {address.city}, {address.state} {address.postal_code}</p>{address.delivery_instructions && <p className="mc-delivery-instructions">“{address.delivery_instructions}”</p>}</div><div className="mc-address-card-actions">{!address.is_default && <button className="mc-text-button" onClick={() => setDefaultAddress(address)} disabled={actionBusy}>Set as default</button>}<button className="mc-text-button" onClick={() => { setEditingAddress(address); setAddressModal(true); }}>Edit address</button></div></article>)}</div> : <div className="mc-empty mc-empty--inside"><div className="mc-empty-mark"><Icon name="pin" /></div><h3>No saved addresses</h3><p>Add a delivery address so it can be selected for future orders.</p>{customer.is_active && <button className="mc-button mc-button--primary" onClick={() => { setEditingAddress(null); setAddressModal(true); }}><Icon name="plus" /> Add address</button>}</div>}</section>}
            {activeTab === 'orders' && <section className="mc-content-card mc-tab-card"><div className="mc-card-heading"><div><div className="mc-eyebrow">PURCHASE HISTORY</div><h2>Order history</h2><p>Showing the most recent {orders.length} orders returned by the API.</p></div></div>{orders.length ? <div className="mc-order-table-wrap"><table className="mc-table mc-order-table"><thead><tr><th>Order</th><th>Date</th><th>Source</th><th>Fulfilment</th><th>Status</th><th>Total</th><th /></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><button className="mc-order-number" onClick={() => openOrder(order)}>{order.order_number || `#${String(order.id).slice(0, 8)}`}<small>Open order details <Icon name="arrow" /></small></button></td><td className="mc-date-cell">{dateLabel(order.created_at, true)}</td><td>{humanize(order.source)}</td><td>{humanize(order.fulfilment_type)}</td><td><span className={`mc-order-status mc-order-status--${order.status}`}>{humanize(order.status)}</span></td><td className="mc-order-total">{money(order.total_amount, order.currency)}</td><td><button className="mc-icon-button" onClick={() => openOrder(order)} aria-label={`Open order ${order.order_number || order.id}`}><Icon name="arrow" /></button></td></tr>)}</tbody></table></div> : <div className="mc-empty mc-empty--inside"><div className="mc-empty-mark"><Icon name="bag" /></div><h3>No order history yet</h3><p>Orders linked to this customer will appear here.</p></div>}<div className="mc-order-history-note"><Icon name="alert" /><span>The backend returns up to 100 most recent orders. The completed-order value above only reflects completed orders in this returned history; payment balances are not calculated by this endpoint.</span></div></section>}
            {customerModal && <CustomerFormModal customer={customer} request={request} onClose={() => setCustomerModal(false)} onSaved={customerSaved} />}
            {addressModal && (customer.is_active || editingAddress) && <AddressFormModal address={editingAddress} customerId={customer.id} request={request} onClose={() => { setAddressModal(false); setEditingAddress(null); }} onSaved={addressSaved} canDelete={Boolean(editingAddress)} onDelete={() => editingAddress && deleteAddress(editingAddress)} />}
        </main>
    );
}
