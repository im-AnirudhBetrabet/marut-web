import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Activity, AlertCircle, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight,
    BarChart3, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, FileText,
    Filter, Leaf, LoaderCircle, MessageCircle, MessageSquareText, Phone, RefreshCw,
    Search, Star, UserRound, UsersRound, X, Sprout, TrendingUp, ClipboardList,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import './feedback.css'


const API           = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const PAGE_SIZE     = 12;
const STATUSES      = ['new', 'contacted', 'converted', 'closed'];
const STATUS_LABELS = { new: 'New', contacted: 'Contacted', converted: 'Converted', closed: 'Closed' };
const STATUS_HELP   = { new: 'Needs first contact', contacted: 'Follow-up in progress', converted: 'Successfully converted', closed: 'No further action' };
const fmtNumber     = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value || 0));
const fmtDate       = (value, time = false) => value ? new Date(value).toLocaleString('en-IN', time ? { dateStyle: 'medium', timeStyle: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const initials      = (value) => String(value || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const friendly      = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (match) => match.toUpperCase());

function Notice({ children, type = 'error', onClose }) {
    if (!children) return null;
    return (
        <div className={`marut-fb-notice marut-fb-notice--${type}`} role={type === 'error' ? 'alert' : 'status'}>
            <AlertCircle size={16} />
            <span>
                {children}
            </span>
            {onClose && 
            <button type="button" onClick={onClose} aria-label="Dismiss notice">
                <X size={15} />
            </button>}
        </div>
    );
}

function useFeedbackApi() {
    return useCallback(async (path, options = {}) => {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session?.access_token) throw new Error('Your session has expired. Please sign in again.');
        let response;
        try {
            response = await fetch(`${API}/api/v1/feedback${path}`, {
                ...options,
                headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${data.session.access_token}`, ...(options.headers || {}) },
            });
        } catch {
            throw new Error('Could not connect to the MARUT API. Check VITE_API_BASE_URL and make sure the backend is running.');
        }
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = response.status === 403 ? 'You do not have permission to manage feedback.' : body.error || `Request failed (${response.status}).`;
            const requestError = new Error(message); requestError.status = response.status; throw requestError;
        }
        return body;
    }, []);
}

function StatusPill({ status }) {
    return (
            <span className={`marut-fb-status marut-fb-status--${status || 'new'}`}>
                <i />
                {STATUS_LABELS[status] || friendly(status) || 'Unknown'}
            </span>
    );
}

function ActionButton({ children, variant = 'secondary', className = '', ...props }) {
    return (
        <button className={`marut-fb-button marut-fb-button--${variant} ${className}`} {...props}>
            {children}
        </button>
    );
}

function EmptyState({ icon: Icon = MessageSquareText, title, copy, action }) {
    return (
        <div className="marut-fb-empty">
            <span className="marut-fb-empty-icon">
                <Icon size={22} />
            </span>
            <h3>{title}</h3>
            <p>{copy}</p>
            {action}
        </div>
    );
}

function PanelHeading({ eyebrow, title, description, action }) {
    return <div className="marut-fb-panel-heading"><div>{eyebrow && <span className="marut-fb-eyebrow">{eyebrow}</span>}<h3>{title}</h3>{description && <p>{description}</p>}</div>{action}</div>;
}

function KpiCard({ label, value, note, icon: Icon, tone = 'olive', footnote }) {
    return <article className="marut-fb-kpi"><div className="marut-fb-kpi-head"><span>{label}</span><span className={`marut-fb-kpi-icon marut-fb-kpi-icon--${tone}`}><Icon size={18} strokeWidth={1.8} /></span></div><strong className="marut-fb-kpi-value">{value}</strong><span className="marut-fb-kpi-note">{note}</span>{footnote && <span className="marut-fb-kpi-footnote">{footnote}</span>}</article>;
}

function SimpleLineChart({ data, series, emptyMessage = 'More feedback will make this trend meaningful.' }) {
    const width = 760; const height = 250; const pad = { top: 20, right: 18, bottom: 42, left: 36 };
    const innerW = width - pad.left - pad.right; const innerH = height - pad.top - pad.bottom;
    const values = data.flatMap((point) => series.map((item) => point[item.key] === null || point[item.key] === undefined ? null : Number(point[item.key])).filter((value) => value !== null));
    const max = Math.max(5, ...values); const min = 0;
    const x = (index) => pad.left + (data.length <= 1 ? innerW / 2 : index * innerW / (data.length - 1));
    const y = (value) => pad.top + innerH - ((value - min) / (max - min || 1)) * innerH;
    const ticks = [...new Set([0, Math.round(max / 2), max])];
    const indexes = [...new Set([0, Math.floor((data.length - 1) / 3), Math.floor((data.length - 1) * 2 / 3), data.length - 1])].filter((i) => i >= 0);
    if (!data.length) return <div className="marut-fb-chart-empty">{emptyMessage}</div>;
    return <div className="marut-fb-chart-scroll"><svg className="marut-fb-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Feedback trend chart">
        {ticks.map((tick) => <g key={tick}><line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="marut-fb-chart-grid" /><text x={pad.left - 10} y={y(tick) + 4} textAnchor="end" className="marut-fb-chart-axis">{fmtNumber(tick)}</text></g>)}
        {series.map((item) => { let path = ''; let segmentOpen = false; data.forEach((point, index) => { const raw = point[item.key]; if (raw === null || raw === undefined || !Number.isFinite(Number(raw))) { segmentOpen = false; return; } path += `${segmentOpen ? 'L' : 'M'} ${x(index)} ${y(Number(raw))} `; segmentOpen = true; }); return <g key={item.key}><path d={path} className={`marut-fb-chart-line marut-fb-chart-line--${item.tone || 'olive'}`} />{data.map((point, index) => point[item.key] === null || point[item.key] === undefined ? null : <circle key={`${item.key}-${point.date}`} cx={x(index)} cy={y(Number(point[item.key]))} r={data.length < 40 ? 3 : 1.8} className={`marut-fb-chart-point marut-fb-chart-point--${item.tone || 'olive'}`}><title>{point.date}: {item.label} {fmtNumber(point[item.key])}</title></circle>)}</g>; })}
        {indexes.map((index) => <text key={`${data[index]?.date}-${index}`} x={x(index)} y={height - 12} textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'} className="marut-fb-chart-axis">{new Date(`${data[index].date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</text>)}
    </svg><div className="marut-fb-chart-legend">{series.map((item) => <span key={item.key}><i className={`marut-fb-legend-dot marut-fb-legend-dot--${item.tone || 'olive'}`} />{item.label}</span>)}</div></div>;
}

function RatingBar({ item, index = 0, maxRating = 5 }) {
    const pct = Math.max(0, Math.min(100, Number(item.average_rating || 0) / maxRating * 100));
    return <div className="marut-fb-rating-bar-row"><div className="marut-fb-rating-bar-label"><span className="marut-fb-rank">{String(index + 1).padStart(2, '0')}</span><span className="marut-fb-rating-name">{item.name || friendly(item.key)}</span><strong><Star size={13} fill="currentColor" /> {fmtNumber(item.average_rating)}<small>/5</small></strong></div><div className="marut-fb-rating-track"><span style={{ width: `${pct}%` }} /></div><span className="marut-fb-rating-count">{fmtNumber(item.rating_count)} {Number(item.rating_count) === 1 ? 'rating' : 'ratings'}</span></div>;
}

function RatingDistribution({ item }) {
    const distribution = item.distribution || {};
    const total = Number(item.rating_count || 0);
    return <div className="marut-fb-distribution"><div className="marut-fb-distribution-head"><span>{item.name || friendly(item.key)}</span><strong>{fmtNumber(item.average_rating)}<small>/5</small></strong></div><div className="marut-fb-distribution-bars">{[5, 4, 3, 2, 1].map((rating) => { const count = Number(distribution[String(rating)] || 0); return <div className="marut-fb-distribution-row" key={rating}><span>{rating} <Star size={10} fill="currentColor" /></span><div><i style={{ width: `${total ? count / total * 100 : 0}%` }} /></div><small>{count}</small></div>; })}</div><span className="marut-fb-distribution-total">{fmtNumber(total)} responses</span></div>;
}

function Analytics({ request }) {
    const [period, setPeriod] = useState('30');
    const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [custom, setCustom] = useState(false);
    const [analytics, setAnalytics] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
    const load = useCallback(async (query = {}) => {
        setLoading(true); setError('');
        try { const params = new URLSearchParams(query); const result = await request(`/analytics?${params.toString()}`); setAnalytics(result.data); }
        catch (requestError) { setError(requestError.message); }
        finally { setLoading(false); }
    }, [request]);
    useEffect(() => { load({ period: '30' }); }, [load]);
    useEffect(() => { const refreshAnalytics = () => load(custom ? { from, to } : { period }); window.addEventListener('marut-feedback-analytics-refresh', refreshAnalytics); return () => window.removeEventListener('marut-feedback-analytics-refresh', refreshAnalytics); }, [load, custom, from, to, period]);
    const applyPeriod = (next) => { setPeriod(next); setCustom(false); load({ period: next }); };
    const applyCustom = (event) => { event.preventDefault(); if (!from || !to) { setError('Choose both a start and end date.'); return; } if (from > to) { setError('The start date must be on or before the end date.'); return; } setCustom(true); load({ from, to }); };
    const summary = analytics?.summary || {};
    const products = analytics?.products || {};
    const impressions = analytics?.impressions || {};
    const rankings = products.rankings || [];
    const attributes = impressions.attributes || [];
    const productRatingCount = rankings.reduce((sum, item) => sum + Number(item.rating_count || 0), 0);
    const qualityRatingCount = attributes.reduce((sum, item) => sum + Number(item.rating_count || 0), 0);
    const weightedAverage = (items, count) => count ? items.reduce((sum, item) => sum + Number(item.average_rating || 0) * Number(item.rating_count || 0), 0) / count : 0;
    const averageProduct = weightedAverage(rankings, productRatingCount);
    const averageQuality = weightedAverage(attributes, qualityRatingCount);
    const topProduct = [...rankings].sort((a, b) => Number(b.average_rating || 0) - Number(a.average_rating || 0))[0];
    const change = analytics?.comparison?.change_percent;
    const productTrendData = useMemo(() => (products.trend || []).map((day) => { const result = { date: day.date }; for (const rating of day.ratings || []) result[rating.key] = Number(rating.average_rating || 0); return result; }), [products.trend]);
    const topTrendProducts = useMemo(() => [...rankings].sort((a, b) => Number(b.rating_count || 0) - Number(a.rating_count || 0)).slice(0, 4), [rankings]);
    const qualityTrendData = useMemo(() => (impressions.trend || []).map((day) => { const result = { date: day.date }; for (const rating of day.ratings || []) result[rating.key] = Number(rating.average_rating || 0); return result; }), [impressions.trend]);
    const topQuality = useMemo(() => [...attributes].sort((a, b) => Number(b.rating_count || 0) - Number(a.rating_count || 0)).slice(0, 4), [attributes]);
    const productSeries = topTrendProducts.map((item, index) => ({ key: item.key, label: item.name, tone: ['olive', 'ochre', 'sage', 'clay'][index] }));
    const qualitySeries = topQuality.map((item, index) => ({ key: item.key, label: item.name, tone: ['olive', 'ochre', 'sage', 'clay'][index] }));
    const productTrendWithGaps = useMemo(() => productTrendData.map((point) => { const result = { date: point.date }; for (const item of topTrendProducts) result[item.key] = Object.prototype.hasOwnProperty.call(point, item.key) ? point[item.key] : null; return result; }), [productTrendData, topTrendProducts]);
    const qualityTrendWithGaps = useMemo(() => qualityTrendData.map((point) => { const result = { date: point.date }; for (const item of topQuality) result[item.key] = Object.prototype.hasOwnProperty.call(point, item.key) ? point[item.key] : null; return result; }), [qualityTrendData, topQuality]);
    const cards = [
        { label: 'Feedback responses', value: fmtNumber(summary.total), note: analytics?.period?.label || 'Selected period', icon: MessageSquareText, tone: 'olive' },
        { label: 'Average product rating', value: productRatingCount ? `${averageProduct.toFixed(2)}/5` : '—', note: `${fmtNumber(productRatingCount)} product ratings`, icon: Sprout, tone: 'sage' },
        { label: 'Average quality rating', value: qualityRatingCount ? `${averageQuality.toFixed(2)}/5` : '—', note: `${fmtNumber(qualityRatingCount)} quality ratings`, icon: Star, tone: 'ochre' },
        { label: 'Top-rated variety', value: topProduct?.name || '—', note: topProduct ? `${Number(topProduct.average_rating).toFixed(2)}/5 average` : 'Awaiting ratings', icon: TrendingUp, tone: 'clay' },
    ];
    return <section className="marut-fb-analytics">
        <div className="marut-fb-section-title"><div><span className="marut-fb-eyebrow">CUSTOMER SIGNALS</span><h2>Feedback analytics</h2><p>See what customers think about your produce, quality, and experience.</p></div><ActionButton onClick={() => load(custom ? { from, to } : { period })} disabled={loading}><RefreshCw size={15} className={loading ? 'marut-fb-spin' : ''} /> Refresh</ActionButton></div>
        <div className="marut-fb-period-bar"><div className="marut-fb-period-options" role="group" aria-label="Reporting period">{[['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['all', 'All time']].map(([value, label]) => <button type="button" key={value} className={!custom && period === value ? 'is-active' : ''} onClick={() => applyPeriod(value)}>{label}</button>)}</div><button className={`marut-fb-custom-toggle${custom ? ' is-active' : ''}`} type="button" onClick={() => setCustom((current) => !current)}><CalendarDays size={15} /> Custom dates</button></div>
        {custom && <form className="marut-fb-custom-dates" onSubmit={applyCustom}><label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} required /></label><label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} required /></label><ActionButton variant="primary" type="submit" disabled={loading}>Apply range</ActionButton></form>}
        <Notice>{error}</Notice>
        {loading && !analytics && <div className="marut-fb-kpi-grid">{[1, 2, 3, 4].map((item) => <div className="marut-fb-kpi marut-fb-skeleton" key={item}><span /><strong /><small /></div>)}</div>}
        {analytics && <>
            <div className="marut-fb-kpi-grid">{cards.map((card) => <KpiCard key={card.label} {...card} footnote={card.label === 'Feedback responses' && change !== null && change !== undefined ? <span className={change >= 0 ? 'marut-fb-change-positive' : 'marut-fb-change-negative'}>{change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(change)}% vs previous period</span> : null} />)}</div>
            <div className="marut-fb-analytics-grid marut-fb-analytics-grid--wide">
                <article className="marut-fb-panel marut-fb-panel--chart"><PanelHeading eyebrow="VOLUME" title="Enquiry activity" description={`${analytics.period?.from || ''} — ${analytics.period?.to || ''} · ${analytics.period?.timezone || 'Asia/Kolkata'}`} action={<span className="marut-fb-panel-icon"><Activity size={18} /></span>} /><SimpleLineChart data={analytics.trend || []} series={[{ key: 'enquiries', label: 'Enquiries', tone: 'olive' }, { key: 'converted', label: 'Currently converted', tone: 'ochre' }]} emptyMessage="No enquiry activity in this reporting window." /></article>
                <article className="marut-fb-panel"><PanelHeading eyebrow="PIPELINE" title="Enquiry status" description="Current status of enquiries received in this period" action={<span className="marut-fb-panel-icon"><Filter size={18} /></span>} /><div className="marut-fb-status-list">{(analytics.status_breakdown || []).map((item) => { const total = Number(summary.total || 0); const pct = total ? Number(item.count || 0) / total * 100 : 0; return <div className="marut-fb-status-row" key={item.status}><div className="marut-fb-status-row-label"><StatusPill status={item.status} /><strong>{fmtNumber(item.count)}<small>{Math.round(pct)}%</small></strong></div><div className="marut-fb-status-track"><span className={`marut-fb-status-fill marut-fb-status-fill--${item.status}`} style={{ width: `${pct}%` }} /></div></div>; })}</div></article>
            </div>
            <div className="marut-fb-analytics-grid">
                <article className="marut-fb-panel"><PanelHeading eyebrow="PRODUCT FEEDBACK" title="Product ratings" description="Average customer rating by microgreen variety" action={<span className="marut-fb-panel-icon"><Sprout size={18} /></span>} />{rankings.length ? <><div className="marut-fb-rating-leaderboard">{rankings.map((item, index) => <RatingBar item={item} index={index} key={item.key} />)}</div><div className="marut-fb-panel-footnote">Ranked by average rating. Response count is shown for context.</div></> : <EmptyState icon={Sprout} title="No product ratings yet" copy="Product rankings will appear when customers submit variety ratings." />}</article>
                <article className="marut-fb-panel"><PanelHeading eyebrow="QUALITY PERCEPTION" title="What shapes the experience" description="Ratings across taste, freshness, presentation, and texture" action={<span className="marut-fb-panel-icon"><Star size={18} /></span>} />{attributes.length ? <div className="marut-fb-rating-leaderboard">{attributes.map((item, index) => <RatingBar item={item} index={index} key={item.key} />)}</div> : <EmptyState icon={Star} title="No quality ratings yet" copy="Quality attribute ratings will appear here when customers respond." />}</article>
            </div>
            <div className="marut-fb-analytics-grid">
                <article className="marut-fb-panel marut-fb-panel--chart"><PanelHeading eyebrow="RATING MOMENTUM" title="Product rating trends" description="Daily average ratings for the most-rated varieties" action={<span className="marut-fb-panel-icon"><TrendingUp size={18} /></span>} />{productSeries.length ? <SimpleLineChart data={productTrendWithGaps} series={productSeries} emptyMessage="No product rating trend for this period." /> : <EmptyState icon={TrendingUp} title="Not enough trend data" copy="Choose a wider reporting period as more ratings arrive." />}</article>
                <article className="marut-fb-panel marut-fb-panel--chart"><PanelHeading eyebrow="QUALITY MOMENTUM" title="Quality attribute trends" description="Daily average rating for the most-rated experience attributes" action={<span className="marut-fb-panel-icon"><BarChart3 size={18} /></span>} />{qualitySeries.length ? <SimpleLineChart data={qualityTrendWithGaps} series={qualitySeries} emptyMessage="No quality trend for this period." /> : <EmptyState icon={BarChart3} title="Not enough trend data" copy="Quality trends will appear as customers submit feedback." />}</article>
            </div>
            <article className="marut-fb-panel"><PanelHeading eyebrow="RATING MIX" title="Rating distribution" description="How customers score each product, from 1 to 5 stars" action={<span className="marut-fb-panel-icon"><ClipboardList size={18} /></span>} />{rankings.length ? <div className="marut-fb-distribution-grid">{rankings.map((item) => <RatingDistribution item={item} key={item.key} />)}</div> : <EmptyState icon={ClipboardList} title="No rating distribution yet" copy="Distribution charts will populate as feedback comes in." />}</article>
            <div className="marut-fb-activity-summary"><div className="marut-fb-activity-summary-copy"><span className="marut-fb-eyebrow">TEAM FOLLOW-UP, WITHOUT LEADERBOARDS</span><h3>Customer conversations</h3><p>Follow-up actions logged during the selected period.</p></div><div className="marut-fb-activity-metric"><span className="marut-fb-activity-metric-icon"><Phone size={17} /></span><div><strong>{fmtNumber(analytics.activity?.contact_attempts)}</strong><span>Contact attempts</span></div></div><div className="marut-fb-activity-metric"><span className="marut-fb-activity-metric-icon marut-fb-activity-metric-icon--note"><FileText size={17} /></span><div><strong>{fmtNumber(analytics.activity?.internal_notes)}</strong><span>Internal notes</span></div></div></div>
        </>}
    </section>;
}

function RatingGroup({ title, values }) {
    if (!values || typeof values !== 'object' || !Object.keys(values).length) return null;
    return <section className="marut-fb-record-rating-group"><h4>{title}</h4><div className="marut-fb-record-rating-grid">{Object.entries(values).map(([key, value]) => <div className="marut-fb-record-rating" key={key}><div><span>{friendly(key.replaceAll('-', ' '))}</span><strong>{value}<small>/5</small></strong></div><div className="marut-fb-record-rating-track"><span style={{ width: `${Math.max(0, Math.min(5, Number(value) || 0)) * 20}%` }} /></div></div>)}</div></section>;
}

function FeedbackDetail({ id, request, admins }) {
    const navigate = useNavigate();
    const [record, setRecord] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [activityType, setActivityType] = useState('contact_attempt'); const [note, setNote] = useState(''); const [activityError, setActivityError] = useState(''); const [success, setSuccess] = useState('');
    const load = useCallback(async () => { setLoading(true); setError(''); try { const result = await request(`/${id}`); setRecord(result.data); } catch (requestError) { setError(requestError.message); } finally { setLoading(false); } }, [id, request]);
    useEffect(() => { load(); }, [load]);
    const updateStatus = async (status) => { setBusy(true); setError(''); setSuccess(''); try { await request(`/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); setSuccess('Enquiry status updated.'); await load(); } catch (requestError) { setError(requestError.message); } finally { setBusy(false); } };
    const updateAssignee = async (assigned_to) => { setBusy(true); setError(''); setSuccess(''); try { await request(`/${id}/assignment`, { method: 'PATCH', body: JSON.stringify({ assigned_to: assigned_to || null }) }); setSuccess('Assignment updated.'); await load(); } catch (requestError) { setError(requestError.message); } finally { setBusy(false); } };
    const addActivity = async (event) => { event.preventDefault(); if (!note.trim()) return; setBusy(true); setActivityError(''); setSuccess(''); try { await request(`/${id}/activities`, { method: 'POST', body: JSON.stringify({ activity_type: activityType, note: note.trim() }) }); setNote(''); setSuccess('Follow-up added to the timeline.'); await load(); } catch (requestError) { setActivityError(requestError.message); } finally { setBusy(false); } };
    const activities = record?.activities || [];
    if (loading && !record) return <main className="marut-fb-page"><div className="marut-fb-centered-state"><LoaderCircle className="marut-fb-spin" size={25} />Loading enquiry…</div></main>;
    if (error && !record) return <main className="marut-fb-page"><ActionButton onClick={() => navigate('/feedback')}><ArrowLeft size={15} /> Back to inbox</ActionButton><div className="marut-fb-panel marut-fb-detail-error"><Notice>{error}</Notice><ActionButton onClick={load}><RefreshCw size={14} /> Retry</ActionButton></div></main>;
    return <main className="marut-fb-page marut-fb-record-page">
        <div className="marut-fb-detail-topbar"><ActionButton onClick={() => navigate('/feedback')}><ArrowLeft size={15} /> Back to inbox</ActionButton><span className="marut-fb-breadcrumb">CUSTOMER EXPERIENCE <i>/</i> ENQUIRY RECORD</span></div>
        <header className="marut-fb-record-header"><div><span className="marut-fb-eyebrow">ENQUIRY RECORD</span><h1>{record?.cafe_name || 'Feedback enquiry'}</h1><p>Received {fmtDate(record?.created_at, true)}</p></div><StatusPill status={record?.status} /></header>
        <Notice type="success" onClose={() => setSuccess('')}>{success}</Notice><Notice>{error && record ? error : ''}</Notice>
        <div className="marut-fb-record-layout"><div className="marut-fb-record-main">
            <section className="marut-fb-panel marut-fb-original"><PanelHeading eyebrow="CUSTOMER VOICE" title="Feedback received" description="The customer's original submission" action={<span className="marut-fb-panel-icon"><MessageSquareText size={18} /></span>} /><div className="marut-fb-original-message">{record?.notes?.trim() || <span className="marut-fb-muted">No written feedback was provided with this submission.</span>}</div></section>
            <section className="marut-fb-panel"><PanelHeading eyebrow="PRODUCT EXPERIENCE" title="Product ratings" description="Ratings submitted by the customer" action={<span className="marut-fb-panel-icon"><Sprout size={18} /></span>} /><RatingGroup title="Variety ratings" values={record?.variety_ratings} /><RatingGroup title="Quality ratings" values={record?.quality_ratings} />{!record?.variety_ratings && !record?.quality_ratings && <p className="marut-fb-muted">No ratings were included.</p>}</section>
            <section className="marut-fb-panel"><PanelHeading eyebrow="CUSTOMER PREFERENCES" title="Growing & menu preferences" description="Additional details from the submission" action={<span className="marut-fb-panel-icon"><Leaf size={18} /></span>} /><div className="marut-fb-preference-grid">{[['Shelf life', record?.shelf_life], ['Menu interest', record?.menu_interest], ['Weekly quantity', record?.weekly_quantity], ['Trial kit requested', record?.wants_trial_kit === true ? 'Yes' : record?.wants_trial_kit === false ? 'No' : null]].filter(([, value]) => value !== null && value !== undefined && value !== '').map(([label, value]) => <div className="marut-fb-preference-item" key={label}><span>{label}</span><strong>{String(value)}</strong></div>)}</div></section>
            <section className="marut-fb-panel"><PanelHeading eyebrow="HISTORY" title="Activity timeline" description="Status changes, assignments, and follow-ups" action={<span className="marut-fb-count-pill">{activities.length} entries</span>} />{activities.length ? <div className="marut-fb-timeline">{activities.map((activity) => <div className="marut-fb-timeline-item" key={activity.id}><span className="marut-fb-timeline-dot" /><div><div className="marut-fb-timeline-head"><strong>{friendly(activity.activity_type)}</strong><time>{fmtDate(activity.created_at, true)}</time></div>{activity.activity_type === 'status_changed' && <p>Status changed from <b>{friendly(activity.previous_status)}</b> to <b>{friendly(activity.new_status)}</b>.</p>}{activity.activity_type === 'assignment_changed' && <p>Administrator assignment updated.</p>}{activity.note && <p className="marut-fb-timeline-note">{activity.note}</p>}</div></div>)}</div> : <p className="marut-fb-muted">No activity has been recorded yet.</p>}</section>
        </div><aside className="marut-fb-record-aside">
                <section className="marut-fb-panel"><PanelHeading title="Contact information" description="Business and primary contact" /><div className="marut-fb-contact-card"><span className="marut-fb-contact-avatar"><UserRound size={21} /></span><div><strong>{record?.contact_name || 'Contact name not provided'}</strong><span>{record?.cafe_name || 'Business name not provided'}</span></div></div><div className="marut-fb-contact-row"><span><MessageCircle size={15} /> WhatsApp</span>{record?.whatsapp_number ? <a href={`https://wa.me/${String(record.whatsapp_number).replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{record.whatsapp_number}<ArrowRight size={13} /></a> : <strong>Not provided</strong>}</div>{record?.email && <div className="marut-fb-contact-row"><span>Email</span><a href={`mailto:${record.email}`}>{record.email}</a></div>}</section>
                <section className="marut-fb-panel"><PanelHeading title="Manage enquiry" description="Keep the next step up to date" /><label className="marut-fb-field">Status<select value={record?.status || 'new'} disabled={busy} onChange={(event) => updateStatus(event.target.value)}>{STATUSES.map((status) => <option value={status} key={status}>{STATUS_LABELS[status]}</option>)}</select><small>{STATUS_HELP[record?.status] || ''}</small></label><label className="marut-fb-field">Assigned administrator<select value={record?.assigned_to || ''} disabled={busy} onChange={(event) => updateAssignee(event.target.value)}><option value="">Unassigned</option>{admins.map((admin) => <option value={admin.user_id} key={admin.user_id}>{admin.display_name || admin.full_name || admin.email || admin.user_id}</option>)}</select></label></section>
                <section className="marut-fb-panel"><PanelHeading title="Log a follow-up" description="Keep a record of customer communication" /><form className="marut-fb-followup-form" onSubmit={addActivity}><div className="marut-fb-activity-types"><button type="button" className={activityType === 'contact_attempt' ? 'is-active' : ''} onClick={() => setActivityType('contact_attempt')}><Phone size={14} /> Contact attempt</button><button type="button" className={activityType === 'internal_note' ? 'is-active' : ''} onClick={() => setActivityType('internal_note')}><FileText size={14} /> Internal note</button></div><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={5000} rows={4} placeholder={activityType === 'contact_attempt' ? 'What happened during the contact attempt?' : 'Add an internal note for the team…'} required /><div className="marut-fb-note-footer"><small>{note.length}/5000</small><ActionButton variant="primary" type="submit" disabled={busy || !note.trim()}>{busy ? 'Saving…' : 'Add to timeline'}</ActionButton></div><Notice>{activityError}</Notice></form></section>
            </aside></div>
    </main>;
}

function FeedbackInbox() {
    const navigate = useNavigate(); const request = useFeedbackApi();
    const [view, setView] = useState('analytics'); const [items, setItems] = useState([]); const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
    const [search, setSearch] = useState(''); const [searchInput, setSearchInput] = useState(''); const [status, setStatus] = useState(''); const [assigned, setAssigned] = useState(''); const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [admins, setAdmins] = useState([]); const [myStats, setMyStats] = useState({ assigned_to_me: 0, by_status: { new: 0, contacted: 0, converted: 0, closed: 0 } }); const [statsLoading, setStatsLoading] = useState(false);
    const requestAdmins = useCallback(async () => { const { data, error: sessionError } = await supabase.auth.getSession(); if (sessionError || !data.session?.access_token) throw new Error('Your session has expired. Please sign in again.'); const response = await fetch(`${API}/api/v1/admins/`, { headers: { Authorization: `Bearer ${data.session.access_token}` } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || `Admin lookup failed (${response.status})`); return payload; }, []);
    const loadInbox = useCallback(async () => { setLoading(true); setError(''); try { const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) }); if (search.trim()) params.set('search', search.trim()); if (status) params.set('status', status); if (assigned) params.set('assigned', assigned); const result = await request(`?${params.toString()}`); setItems(result.data || []); setPagination(result.pagination || { page, limit: PAGE_SIZE, total: 0, totalPages: 0 }); } catch (requestError) { setError(requestError.message); } finally { setLoading(false); } }, [request, page, search, status, assigned]);
    const loadMyStats = useCallback(async () => { setStatsLoading(true); try { const result = await request('/my/count'); const data = result.data || {}; setMyStats({ assigned_to_me: Number(data.assigned_to_me || 0), by_status: { new: Number(data.by_status?.new || 0), contacted: Number(data.by_status?.contacted || 0), converted: Number(data.by_status?.converted || 0), closed: Number(data.by_status?.closed || 0) } }); } catch (requestError) { setNotice(`Couldn't load your assigned-feedback counts: ${requestError.message}`); } finally { setStatsLoading(false); } }, [request]);
    useEffect(() => { if (view === 'inbox') { loadInbox(); loadMyStats(); } }, [view, loadInbox, loadMyStats]);
    useEffect(() => { const timer = window.setTimeout(() => { setPage(1); setSearch(searchInput); }, 280); return () => window.clearTimeout(timer); }, [searchInput]);
    useEffect(() => { let active = true; requestAdmins().then((result) => { if (active) setAdmins(Array.isArray(result.admins) ? result.admins.filter((admin) => admin.is_active !== false) : []); }).catch(() => { }); return () => { active = false; }; }, [requestAdmins]);
    const refresh = async () => { if (view === 'inbox') { await Promise.all([loadInbox(), loadMyStats()]); } else window.dispatchEvent(new CustomEvent('marut-feedback-analytics-refresh')); setNotice('Feedback data refreshed.'); };
    const clearFilters = () => { setSearchInput(''); setSearch(''); setStatus(''); setAssigned(''); setPage(1); };
    const statusCounts = useMemo(() => STATUSES.map((value) => ({ status: value, count: myStats.by_status[value] || 0 })), [myStats]);
    return <main className="marut-fb-page">
        <header className="marut-fb-hero"><div className="marut-fb-hero-copy"><span className="marut-fb-eyebrow"><Leaf size={13} /> MARUT CUSTOMER EXPERIENCE</span><h1>Feedback<span>, with care.</span></h1><p>Understand what customers love, spot opportunities, and keep every enquiry moving forward.</p></div><div className="marut-fb-hero-actions"><ActionButton onClick={refresh} disabled={loading}><RefreshCw size={15} className={loading ? 'marut-fb-spin' : ''} /> Refresh</ActionButton></div><div className="marut-fb-hero-decoration" aria-hidden="true"><span /><span /><span /></div></header>
        <div className="marut-fb-tabs" role="tablist" aria-label="Feedback views"><button type="button" role="tab" aria-selected={view === 'analytics'} className={view === 'analytics' ? 'is-active' : ''} onClick={() => setView('analytics')}><BarChart3 size={16} /> Analytics</button><button type="button" role="tab" aria-selected={view === 'inbox'} className={view === 'inbox' ? 'is-active' : ''} onClick={() => setView('inbox')}><MessageSquareText size={16} /> Enquiry inbox {pagination.total > 0 && <span>{fmtNumber(pagination.total)}</span>}</button></div>
        <Notice type="success" onClose={() => setNotice('')}>{notice}</Notice>
        {view === 'analytics' ? <Analytics request={request} /> : <section className="marut-fb-inbox-view">
            <div className="marut-fb-section-title"><div><span className="marut-fb-eyebrow">RELATIONSHIP MANAGEMENT</span><h2>Enquiry inbox</h2><p>Every enquiry deserves a thoughtful next step.</p></div><span className="marut-fb-total-chip"><MessageSquareText size={15} /> {fmtNumber(pagination.total)} enquiries</span></div>
            <div className="marut-fb-my-summary"><div className="marut-fb-my-summary-copy"><span className="marut-fb-eyebrow">YOUR WORK QUEUE</span><strong>{statsLoading ? '…' : fmtNumber(myStats.assigned_to_me)}</strong><span>Enquiries assigned to me</span></div><div className="marut-fb-my-statuses"><div className="marut-fb-quick-filter-label">My assigned enquiries by status <span>Choose a status to open your queue</span></div><div className="marut-fb-inbox-summary">{statusCounts.map(({ status: itemStatus, count }) => <button type="button" key={itemStatus} className={assigned === 'me' && status === itemStatus ? 'is-active' : ''} onClick={() => { const active = assigned === 'me' && status === itemStatus; setAssigned(active ? '' : 'me'); setStatus(active ? '' : itemStatus); setPage(1); }}><span className={`marut-fb-status-dot marut-fb-status-dot--${itemStatus}`} /><span>{STATUS_LABELS[itemStatus]}</span><strong>{statsLoading ? '—' : fmtNumber(count)}</strong></button>)}</div></div></div>
            <div className="marut-fb-toolbar"><label className="marut-fb-search"><Search size={17} /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search café, contact or WhatsApp…" aria-label="Search enquiries" />{searchInput && <button type="button" onClick={() => setSearchInput('')} aria-label="Clear search"><X size={14} /></button>}</label><label className="marut-fb-filter"><Filter size={15} /><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{STATUSES.map((itemStatus) => <option value={itemStatus} key={itemStatus}>{STATUS_LABELS[itemStatus]}</option>)}</select></label><label className="marut-fb-filter"><UsersRound size={15} /><select value={assigned} onChange={(event) => { setAssigned(event.target.value); setPage(1); }}><option value="">All assignees</option><option value="unassigned">Unassigned</option><option value="me">Assigned to me</option>{admins.map((admin) => <option value={admin.user_id} key={admin.user_id}>{admin.display_name || admin.full_name || admin.email || admin.user_id}</option>)}</select></label>{(searchInput || status || assigned) && <ActionButton onClick={clearFilters}>Clear</ActionButton>}</div>
            <Notice>{error}</Notice>
            <section className="marut-fb-inbox-panel"><div className="marut-fb-inbox-panel-head"><div><h3>All enquiries</h3><p>{loading ? 'Loading records…' : `Showing ${items.length} of ${fmtNumber(pagination.total)} enquiries`}</p></div><span className="marut-fb-live-label"><i /> Connected to API</span></div>
                {loading ? <div className="marut-fb-inbox-skeleton">{[1, 2, 3, 4, 5].map((item) => <div key={item}><span /><span /><span /></div>)}</div> : error ? <EmptyState icon={AlertCircle} title="Couldn't load enquiries" copy="Check your connection and permissions, then try again." action={<ActionButton onClick={loadInbox}><RefreshCw size={14} /> Retry</ActionButton>} /> : items.length === 0 ? <EmptyState title={search || status || assigned ? 'No matching enquiries' : 'Your inbox is clear'} copy={search || status || assigned ? 'Try changing your search or filters.' : 'New customer enquiries will appear here when they arrive.'} action={(search || status || assigned) ? <ActionButton onClick={clearFilters}>Clear filters</ActionButton> : null} /> : <>
                    <div className="marut-fb-table-wrap"><table className="marut-fb-table"><thead><tr><th>Business / contact</th><th>Status</th><th>Received</th><th>Assignment</th><th>Updated</th><th><span className="marut-fb-sr-only">Open</span></th></tr></thead><tbody>{items.map((item) => { const assignee = admins.find((admin) => admin.user_id === item.assigned_to); return <tr key={item.id} onClick={() => navigate(`/feedback/${item.id}`)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(`/feedback/${item.id}`); } }}><td><div className="marut-fb-business-cell"><span className="marut-fb-business-avatar">{initials(item.cafe_name || item.contact_name)}</span><span><strong>{item.cafe_name || 'Business not provided'}</strong><small>{item.contact_name || 'Contact not provided'}{item.whatsapp_number ? ` · ${item.whatsapp_number}` : ''}</small></span></div></td><td><StatusPill status={item.status} /></td><td><span>{fmtDate(item.created_at)}</span><small className="marut-fb-table-subline">{fmtDate(item.created_at, true).split(', ').at(-1)}</small></td><td><span className="marut-fb-assignee"><i>{initials(assignee?.display_name || assignee?.full_name || assignee?.email || '—')}</i>{assignee?.display_name || assignee?.full_name || assignee?.email || 'Unassigned'}</span></td><td>{fmtDate(item.updated_at || item.created_at)}</td><td><button type="button" className="marut-fb-row-open" aria-label={`Open ${item.cafe_name || 'enquiry'}`} onClick={(event) => { event.stopPropagation(); navigate(`/feedback/${item.id}`); }}><ArrowRight size={16} /></button></td></tr>; })}</tbody></table></div>
                    <div className="marut-fb-mobile-list">{items.map((item) => { const assignee = admins.find((admin) => admin.user_id === item.assigned_to); return <button type="button" className="marut-fb-mobile-enquiry" key={item.id} onClick={() => navigate(`/feedback/${item.id}`)}><span className="marut-fb-business-avatar">{initials(item.cafe_name || item.contact_name)}</span><span className="marut-fb-mobile-enquiry-main"><strong>{item.cafe_name || 'Business not provided'}</strong><small>{item.contact_name || 'Contact not provided'}{item.whatsapp_number ? ` · ${item.whatsapp_number}` : ''}</small><span className="marut-fb-mobile-enquiry-meta"><StatusPill status={item.status} /><small>{fmtDate(item.created_at)}</small></span>{assigned && <small>Assigned: {assignee?.display_name || assignee?.full_name || assignee?.email || 'Unassigned'}</small>}</span><ArrowRight size={17} /></button>; })}</div>
                    <div className="marut-fb-pagination"><span>Showing <strong>{(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> of <strong>{fmtNumber(pagination.total)}</strong></span><div><ActionButton onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}><ChevronLeft size={15} /> Previous</ActionButton><span>Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span><ActionButton onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} disabled={page >= pagination.totalPages || loading}>Next <ChevronRight size={15} /></ActionButton></div></div>
                </>}
            </section>
            <p className="marut-fb-inbox-footnote"><Leaf size={14} /> Thoughtful follow-up builds lasting relationships.</p>
        </section>}
    </main>;
}

function FeedbackRecordPage() {
    const { id } = useParams(); const request = useFeedbackApi();   
    const requestAdmins = useCallback(async () => { const { data, error } = await supabase.auth.getSession(); if (error || !data.session?.access_token) throw new Error('Your session has expired. Please sign in again.'); const response = await fetch(`${API}/api/v1/admins/`, { headers: { Authorization: `Bearer ${data.session.access_token}` } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || `Admin lookup failed (${response.status})`); return payload; }, []);
    const [admins, setAdmins] = useState([]);
    useEffect(() => { let active = true; requestAdmins().then((result) => { if (active) setAdmins(Array.isArray(result.admins) ? result.admins.filter((admin) => admin.is_active !== false) : []); }).catch(() => { }); return () => { active = false; }; }, [requestAdmins]);
    return <FeedbackDetail id={id} request={request} admins={admins} />;
}

export default function Feedback() {
    const { id } = useParams();
    return id ? <FeedbackRecordPage /> : <FeedbackInbox />;
}
