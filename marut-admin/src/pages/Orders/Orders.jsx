import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, MapPin, Package, RefreshCw, Search, ShoppingBag, Truck, UserRound, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import './orders.css';

const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const PAGE_SIZE = 20;
const STATUSES = ['pending', 'confirmed', 'processing', 'preparing', 'out_for_delivery', 'completed', 'cancelled'];
const money = (value, currency = 'INR') => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '—';
    try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); }
    catch { return `₹${amount.toLocaleString('en-IN')}`; }
};
const humanize = (value) => String(value || '—').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateLabel = (value, time = true) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-IN', time ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
};

function useOrdersApi() {
    return useCallback(async (path) => {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session?.access_token) throw new Error('Your session has expired. Please sign in again.');
        let response;
        try {
            response = await fetch(`${API}/api/v1/orders${path}`, { headers: { Authorization: `Bearer ${data.session.access_token}` } });
        } catch {
            throw new Error('Could not connect to the MARUT API. Check that the backend is running and VITE_API_BASE_URL is correct.');
        }
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = response.status === 403 ? 'You do not have permission to manage orders.' : body.error || `Request failed (${response.status}).`;
            const err = new Error(message); err.status = response.status; throw err;
        }
        return body;
    }, []);
}

function Notice({ children, onClose }) {
    if (!children) return null;
    return <div className="mo-notice" role="alert"><span>{children}</span>{onClose && <button type="button" onClick={onClose} aria-label="Dismiss error"><XCircle size={16} /></button>}</div>;
}

function StatusPill({ status }) {
    const normalized = String(status || 'unknown').toLowerCase();
    return <span className={`mo-status mo-status--${normalized.replace(/[^a-z0-9_-]/g, '')}`}><i />{humanize(normalized)}</span>;
}

function OrderList() {
    const request = useOrdersApi();
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [filters, setFilters] = useState({ search: '', status: '', source: '', fulfilment_type: '', from_date: '', to_date: '' });
    const [page, setPage] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);
    const updateFilter = (key, value) => { setFilters((current) => ({ ...current, [key]: value })); setPage(0); };

    useEffect(() => {
        const timer = window.setTimeout(() => { setFilters((current) => current.search === searchInput.trim() ? current : { ...current, search: searchInput.trim() }); setPage(0); }, 300);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    const queryString = useMemo(() => {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
        Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
        return `?${params.toString()}`;
    }, [filters, page]);

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const result = await request(queryString);
            setOrders(Array.isArray(result.orders) ? result.orders : []);
            setTotal(Number(result.pagination?.total || 0));
        } catch (err) { setError(err.message); setOrders([]); setTotal(0); }
        finally { setLoading(false); }
    }, [queryString, request, refreshKey]);
    useEffect(() => { load(); }, [load]);

    const clearFilters = () => { setSearchInput(''); setFilters({ search: '', status: '', source: '', fulfilment_type: '', from_date: '', to_date: '' }); setPage(0); };
    const activeFilters = Boolean(filters.search || filters.status || filters.source || filters.fulfilment_type || filters.from_date || filters.to_date);
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <section className="mo-page reveal">
            <div className="mo-page-heading"><div><span className="mo-eyebrow">MARUT WORKSPACE <b /> ORDER MANAGEMENT</span><h1>Orders<span>, with care.</span></h1><p>Keep every customer order moving, from first request to fulfilment.</p></div><button className="mo-button mo-button--quiet" type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}><RefreshCw size={15} className={loading ? 'mo-spin' : ''} /> Refresh</button></div>
            <Notice>{error}</Notice>
            <div className="mo-overview-strip"><div className="mo-overview-icon"><ShoppingBag size={19} /></div><div><span>Orders matching filters</span><strong>{loading ? '—' : total.toLocaleString('en-IN')}</strong></div><div className="mo-overview-note">Newest orders appear first</div></div>
            <div className="mo-filters-panel">
                <div className="mo-search"><Search size={16} /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search order number, customer or phone…" aria-label="Search orders" /></div>
                <div className="mo-filter-grid">
                    <label>
                        <span>Status</span>
                        <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
                            <option value="">All statuses</option>
                                {STATUSES.map((status) => <option value={status} key={status}>{humanize(status)}</option>)}</select></label>
                    <label><span>Order channel</span><select value={filters.source} onChange={(event) => updateFilter('source', event.target.value)}><option value="">All channels</option><option value="whatsapp">WhatsApp</option><option value="phone">Phone</option><option value="instagram">Instagram</option></select></label>
                    <label><span>Fulfilment</span><select value={filters.fulfilment_type} onChange={(event) => updateFilter('fulfilment_type', event.target.value)}><option value="">Delivery & pickup</option><option value="delivery">Delivery</option><option value="pickup">Pickup</option></select></label>
                    <label><span>From date</span><input type="date" value={filters.from_date} max={filters.to_date || undefined} onChange={(event) => updateFilter('from_date', event.target.value)} /></label>
                    <label><span>To date</span><input type="date" value={filters.to_date} min={filters.from_date || undefined} onChange={(event) => updateFilter('to_date', event.target.value)} /></label>
                    {activeFilters && <button className="mo-clear-filters" type="button" onClick={clearFilters}>Clear filters <XCircle size={14} /></button>}
                </div>
            </div>
            <div className="mo-table-card">
                <div className="mo-table-heading"><div><h2>Order register</h2><p>{total ? `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total} orders` : 'Orders from WhatsApp, phone and Instagram'}</p></div><span className="mo-record-count">{total.toLocaleString('en-IN')} records</span></div>
                <div className="mo-table-scroll"><table className="mo-table"><thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Channel</th><th>Fulfilment</th><th>Status</th><th className="mo-align-right">Total</th><th><span className="mo-sr-only">Open order</span></th></tr></thead><tbody>
                    {loading && <tr><td colSpan="8"><div className="mo-table-state"><span className="mo-loader" />Loading orders…</div></td></tr>}
                    {!loading && !error && orders.length === 0 && <tr><td colSpan="8"><div className="mo-empty"><span><Package size={22} /></span><strong>No orders found</strong><p>{activeFilters ? 'Try adjusting your search or filters.' : 'New customer orders will appear here.'}</p>{activeFilters && <button type="button" className="mo-button mo-button--quiet" onClick={clearFilters}>Clear filters</button>}</div></td></tr>}
                    {!loading && orders.map((order) => {
                        const customer = order.marut_customers || {}; return <tr key={order.id} onClick={() => navigate(`/orders/${order.id}`)} tabIndex="0" onKeyDown={(event) => { if (event.key === 'Enter') navigate(`/orders/${order.id}`); }}>
                            <td><button type="button" className="mo-order-number" onClick={(event) => { event.stopPropagation(); navigate(`/orders/${order.id}`); }}>#{order.order_number ?? String(order.id).slice(0, 8)}</button><small className="mo-muted">{String(order.id).slice(0, 8)}</small></td>
                            <td><div className="mo-customer-cell"><span className="mo-avatar"><UserRound size={15} /></span><div><strong>{customer.full_name || 'Customer'}</strong><small>{customer.phone || customer.email || 'No contact details'}</small></div></div></td>
                            <td><span className="mo-date">{dateLabel(order.created_at, false)}</span><small className="mo-muted">{dateLabel(order.created_at, true).split(', ').slice(-1)[0]}</small></td>
                            <td><span className={`mo-source mo-source--${order.source || 'other'}`}>{humanize(order.source)}</span></td>
                            <td><span className="mo-fulfilment"><span className="mo-mini-icon">{order.fulfilment_type === 'pickup' ? <ShoppingBag size={14} /> : <Truck size={14} />}</span>{humanize(order.fulfilment_type)}</span></td>
                            <td><StatusPill status={order.status} /></td><td className="mo-align-right"><strong className="mo-total">{money(order.total_amount, order.currency)}</strong></td><td><button type="button" className="mo-row-arrow" aria-label={`Open order ${order.order_number}`} onClick={(event) => { event.stopPropagation(); navigate(`/orders/${order.id}`); }}><ArrowRight size={16} /></button></td>
                        </tr>;
                    })}
                </tbody></table></div>
                <div className="mo-pagination"><span>Page {Math.min(page + 1, pageCount)} of {pageCount}</span><div><button type="button" className="mo-button mo-button--quiet" disabled={page === 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))}><ArrowLeft size={14} /> Previous</button><button type="button" className="mo-button mo-button--quiet" disabled={page + 1 >= pageCount || loading} onClick={() => setPage((value) => value + 1)}>Next <ArrowRight size={14} /></button></div></div>
            </div>
            <p className="mo-page-footnote"><span /> Orders are currently view-only. Creation, status updates and payment actions need their corresponding write endpoints.</p>
        </section>)
        ;
}

function OrderDetail() {
    const { id } = useParams(); const navigate = useNavigate(); const request = useOrdersApi();
    const [record, setRecord] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [refreshKey, setRefreshKey] = useState(0);
    const load = useCallback(async () => { setLoading(true); setError(''); try { setRecord(await request(`/${encodeURIComponent(id)}`)); } catch (err) { setError(err.message); setRecord(null); } finally { setLoading(false); } }, [id, request, refreshKey]);
    useEffect(() => { load(); }, [load]);
    const order = record?.order; const customer = order?.marut_customers || {}; const items = record?.items || []; const address = order?.delivery_address_snapshot || order?.marut_customer_addresses || {};
    if (loading) return <section className="mo-page"><button className="mo-back" onClick={() => navigate('/orders')}><ArrowLeft size={15} /> All orders</button><div className="mo-detail-loading"><span className="mo-loader" />Loading order details…</div></section>;
    if (!order) return <section className="mo-page"><button className="mo-back" onClick={() => navigate('/orders')}><ArrowLeft size={15} /> All orders</button><Notice>{error || 'Order not found.'}</Notice><button className="mo-button mo-button--primary" onClick={() => setRefreshKey((value) => value + 1)}>Try again</button></section>;
    return <section className="mo-page reveal">
        <button className="mo-back" type="button" onClick={() => navigate('/orders')}><ArrowLeft size={15} /> Back to orders</button>
        <div className="mo-page-heading mo-detail-heading"><div><span className="mo-eyebrow">ORDER DETAILS <b /> PLACED {dateLabel(order.created_at, false).toUpperCase()}</span><h1>Order #{order.order_number ?? String(order.id).slice(0, 8)}</h1><p>Review the order, customer information and status history.</p></div><div className="mo-detail-actions"><StatusPill status={order.status} /><button className="mo-button mo-button--quiet" type="button" onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw size={15} /> Refresh</button></div></div>
        <Notice>{error}</Notice>
        <div className="mo-detail-grid">
            <div className="mo-detail-main">
                <section className="mo-detail-card"><div className="mo-card-title"><div className="mo-card-title-icon"><Package size={17} /></div><div><h2>Items ordered</h2><p>{items.length} {items.length === 1 ? 'line item' : 'line items'}</p></div></div>
                    {items.length ? <div className="mo-item-list">{items.map((item) => <div className="mo-item-row" key={item.id}><div className="mo-item-thumb"><SproutMark /></div><div className="mo-item-copy"><strong>{item.product_name_snapshot || 'Product'}</strong><span>{[item.pack_size_snapshot, item.sku_snapshot].filter(Boolean).join(' · ') || 'MARUT produce'}</span><small>{money(item.unit_price, order.currency)} × {item.quantity}</small></div><strong className="mo-item-total">{money(item.line_total, order.currency)}</strong></div>)}</div> : <div className="mo-inline-empty">No line items were returned for this order.</div>}
                    <div className="mo-totals"><div><span>Subtotal</span><strong>{money(order.subtotal, order.currency)}</strong></div><div><span>Delivery fee</span><strong>{money(order.delivery_fee, order.currency)}</strong></div><div><span>Discount</span><strong>−{money(order.discount_amount, order.currency)}</strong></div><div className="mo-grand-total"><span>Total amount</span><strong>{money(order.total_amount, order.currency)}</strong></div></div>
                </section>
                <section className="mo-detail-card"><div className="mo-card-title"><div className="mo-card-title-icon"><Clock3 size={17} /></div><div><h2>Status history</h2><p>Recorded changes for this order</p></div></div>
                    {record.status_history?.length ? <ol className="mo-history">{record.status_history.map((entry) => <li key={entry.id}><span className="mo-history-dot"><CheckCircle2 size={13} /></span><div><strong>{humanize(entry.new_status)}</strong><p>{entry.old_status ? `${humanize(entry.old_status)} → ${humanize(entry.new_status)}` : 'Order created'}</p>{entry.note && <p className="mo-history-note">{entry.note}</p>}<small>{dateLabel(entry.created_at)}</small></div></li>)}</ol> : <div className="mo-inline-empty">No status history is available.</div>}
                </section>
                {Array.isArray(record.payments) && <section className="mo-detail-card"><div className="mo-card-title"><div className="mo-card-title-icon"><CheckCircle2 size={17} /></div><div><h2>Payments</h2><p>Transaction records available to your account</p></div></div>{record.payments.length ? <div className="mo-payment-list">{record.payments.map((payment) => <div className="mo-payment-row" key={payment.id}><div><strong>{humanize(payment.transaction_type)} · {humanize(payment.method)}</strong><small>{dateLabel(payment.created_at)}{payment.reference ? ` · Ref ${payment.reference}` : ''}</small>{payment.notes && <small>{payment.notes}</small>}</div><div><strong>{money(payment.amount, order.currency)}</strong><StatusPill status={payment.status} /></div></div>)}</div> : <div className="mo-inline-empty">No payment transactions recorded.</div>}</section>}
            </div>
            <aside className="mo-detail-side">
                <section className="mo-detail-card"><div className="mo-card-title"><div className="mo-card-title-icon"><UserRound size={17} /></div><div><h2>Customer</h2><p>Contact details on the order</p></div></div><div className="mo-customer-profile"><div className="mo-customer-avatar"><UserRound size={20} /></div><strong>{customer.full_name || 'Customer'}</strong>{customer.customer_type && <span className="mo-customer-type">{humanize(customer.customer_type)}</span>}<div className="mo-contact-line">{customer.phone || 'No phone number'}</div><div className="mo-contact-line">{customer.email || 'No email address'}</div></div><button className="mo-text-button" type="button" onClick={() => customer.id && navigate(`/customers/${customer.id}`)} disabled={!customer.id}>View customer profile <ArrowRight size={14} /></button></section>
                <section className="mo-detail-card"><div className="mo-card-title"><div className="mo-card-title-icon"><Truck size={17} /></div><div><h2>Fulfilment</h2><p>{humanize(order.fulfilment_type)}</p></div></div>{order.fulfilment_type === 'delivery' ? <div className="mo-address"><MapPin size={16} /><div><strong>{address.recipient_name || customer.full_name || 'Delivery address'}</strong><p>{[address.address_line1, address.address_line2, address.area, address.city, address.state, address.postal_code].filter(Boolean).join(', ') || 'No delivery address snapshot available.'}</p>{address.phone && <small>{address.phone}</small>}{address.delivery_instructions && <p className="mo-address-note">Instructions: {address.delivery_instructions}</p>}</div></div> : <div className="mo-pickup-note"><ShoppingBag size={17} /><span>Customer pickup</span></div>}{order.delivery_fee != null && <div className="mo-side-fee"><span>Delivery fee</span><strong>{money(order.delivery_fee, order.currency)}</strong></div>}</section>
                <section className="mo-detail-card"><div className="mo-card-title"><div className="mo-card-title-icon"><CalendarDays size={17} /></div><div><h2>Order timeline</h2><p>Key timestamps</p></div></div><div className="mo-timeline-facts"><div><span>Created</span><strong>{dateLabel(order.created_at)}</strong></div><div><span>Confirmed</span><strong>{dateLabel(order.confirmed_at)}</strong></div><div><span>Completed</span><strong>{dateLabel(order.completed_at)}</strong></div>{order.cancelled_at && <div><span>Cancelled</span><strong>{dateLabel(order.cancelled_at)}</strong></div>}</div></section>
                {order.customer_notes && <section className="mo-detail-card"><div className="mo-card-title"><div className="mo-card-title-icon"><Package size={17} /></div><div><h2>Customer notes</h2><p>Provided with the order</p></div></div><p className="mo-notes-text">{order.customer_notes}</p></section>}
                {order.internal_notes && <section className="mo-detail-card"><div className="mo-card-title"><div className="mo-card-title-icon"><Package size={17} /></div><div><h2>Internal notes</h2><p>For MARUT staff</p></div></div><p className="mo-notes-text">{order.internal_notes}</p></section>}
                {order.cancellation_reason && <section className="mo-detail-card mo-cancel-card"><div className="mo-card-title"><div className="mo-card-title-icon"><XCircle size={17} /></div><div><h2>Cancellation reason</h2></div></div><p className="mo-notes-text">{order.cancellation_reason}</p></section>}
            </aside>
        </div>
        <p className="mo-page-footnote"><span /> Details are view-only until the order status, order creation and payment write routes are available.</p>
    </section>;
}

function SproutMark() { return <span className="mo-sprout-mark"><span /><span /></span>; }

export default function Orders() {
    const { id } = useParams();
    return id ? <OrderDetail /> : <OrderList />;
}
