import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, ShoppingBasket, Sprout, UsersRound, Star, Plus, Sun, Leaf } from 'lucide-react';

const orders = [
  ['#MR-1024', 'RS', 'Rohit Sharma', 'Microgreens mix', 'Delivery', 'Preparing', '₹360'],
  ['#MR-1023', 'PN', 'Priya Nair', 'Broccoli · 50g', 'Pickup', 'Ready', '₹180'],
  ['#MR-1022', 'KM', 'Karan Mehta', 'Radish · 50g', 'Delivery', 'Out for delivery', '₹240'],
  ['#MR-1021', 'SI', 'Sneha Iyer', 'Pak choi · 50g', 'Delivery', 'Delivered', '₹180'],
  ['#MR-1020', 'AG', 'Amit Gupta', 'Microgreens mix', 'Pickup', 'Cancelled', '₹360'],
];

const metrics = [
  { label: 'Total orders', value: 124, trend: '12.8%', note: 'vs last month', kind: 'olive', icon: ShoppingBasket },
  { label: 'Revenue this month', value: 58420, trend: '8.4%', note: 'vs last month', kind: 'ochre', icon: Sprout, currency: true },
  { label: 'New customers', value: 38, trend: '6.2%', note: 'vs last month', kind: 'sage', icon: UsersRound },
  { label: 'Average rating', value: '4.8', trend: '+0.3', note: 'from 42 reviews', kind: 'clay', icon: Star, rating: true },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { search = '' } = useOutletContext() || {};
  const [counts, setCounts] = useState([0, 0, 0]);
  const [noticeVisible, setNoticeVisible] = useState(true);

  useEffect(() => {
    const start = performance.now();
    let frame;
    const animate = (now) => {
      const progress = Math.min((now - start) / 950, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCounts([124 * eased, 58420 * eased, 38 * eased]);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  const filteredOrders = orders.filter(row => row.join(' ').toLowerCase().includes(search.toLowerCase()));
  const displayMetric = (metric, index) => {
    if (metric.currency) return `₹${Math.round(counts[index]).toLocaleString('en-IN')}`;
    if (metric.rating) return metric.value;
    return Math.round(counts[index === 0 ? 0 : 2]).toLocaleString('en-IN');
  };

  const exportSummary = () => {
    const summary = `MARUT ADMIN — CONCEPT DASHBOARD\nDate: 27 October 2026\nTotal orders: 124\nRevenue this month: ₹58,420\nNew customers: 38\nAverage rating: 4.8/5\n\nIllustrative demo data only.`;
    const url = URL.createObjectURL(new Blob([summary], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'marut-dashboard-summary.txt'; link.click();
    URL.revokeObjectURL(url);
    window.dispatchEvent(new CustomEvent('marut-toast', { detail: 'Demo summary exported.' }));
  };

  return (
    <section className="page-content">
      <div className="welcome-row reveal">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> TUESDAY, 27 OCTOBER 2026</div>
          <h1>Growing good, <em>every day.</em></h1>
          <p className="muted">A little overview of what’s happening at MARUT today.</p>
        </div>
        <div className="welcome-actions">
          <button className="button button-quiet" onClick={exportSummary}><ArrowDownToLine size={14} /> Export summary</button>
          <button className="button button-primary" onClick={() => window.dispatchEvent(new CustomEvent('marut-toast', { detail: 'Order creation screen is next on our build list.' }))}><Plus size={15} /> Create order</button>
        </div>
      </div>

      {noticeVisible && <div className="notice-banner reveal"><div className="notice-symbol">✦</div><div><strong>Fresh things are growing.</strong><span>Your workspace is looking healthy. Here’s your latest snapshot.</span></div><button className="notice-close" onClick={() => setNoticeVisible(false)} aria-label="Dismiss notice">×</button><div className="notice-orbit" /></div>}

      <section className="stats-grid reveal" aria-label="Key metrics">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return <article className={`stat-card stat-${metric.kind}`} key={metric.label}>
            <div className="stat-top"><span className="stat-label">{metric.label}</span><span className="stat-icon"><Icon size={15} /></span></div>
            <div className="stat-value">{displayMetric(metric, index)}{metric.rating && <span className="value-small">/5</span>}</div>
            <div className="stat-bottom"><span className="trend positive">↗ {metric.trend}</span><span className="stat-period">{metric.note}</span>{metric.rating ? <span className="rating-stars">★★★★★</span> : <svg viewBox="0 0 100 30" className="sparkline"><polyline points="0,24 12,19 22,23 34,12 44,17 57,6 67,12 79,4 89,10 100,2" /></svg>}</div>
          </article>;
        })}
      </section>

      <div className="section-heading reveal"><div><span className="section-kicker">THE DAILY PICTURE</span><h2>At a glance</h2></div><button className="text-button" onClick={() => navigate('/reports')}>View reports <ArrowUpRight size={14} /></button></div>

      <section className="dashboard-grid reveal">
        <article className="panel orders-panel">
          <div className="panel-header"><div><h3>Recent orders</h3><p className="muted">The latest from your customers</p></div><button className="text-button" onClick={() => navigate('/orders')}>All orders <ArrowRight size={14} /></button></div>
          <div className="table-wrap"><table><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>ITEMS</th><th>FULFILMENT</th><th>STATUS</th><th>TOTAL</th></tr></thead>
            <tbody>{filteredOrders.map(row => <tr key={row[0]}><td className="order-id">{row[0]}</td><td><span className="customer-avatar">{row[1]}</span>{row[2]}</td><td>{row[3]}</td><td>{row[4]}</td><td><span className={`status status-${row[5].toLowerCase().replaceAll(' ', '-')}`}>{row[5]}</span></td><td>{row[6]}</td></tr>)}</tbody>
          </table>{filteredOrders.length === 0 && <div className="empty-search">No recent orders match that search.</div>}</div>
          <div className="panel-footer"><span><i className="live-dot" /> Updated just now</span><button className="text-button" onClick={() => navigate('/orders')}>Manage orders <ArrowRight size={14} /></button></div>
        </article>

        <article className="panel activity-panel">
          <div className="panel-header"><div><h3>Today, so far</h3><p className="muted">Tuesday · 27 October</p></div><span className="today-icon"><Sun size={17} /></span></div>
          <div className="activity-metric"><span className="activity-icon olive"><ShoppingBasket size={16} /></span><div><span>Orders received</span><strong>24</strong></div><MiniBars /></div>
          <div className="activity-metric"><span className="activity-icon ochre">₹</span><div><span>Sales today</span><strong>₹5,420</strong></div><MiniBars ochre /></div>
          <div className="activity-metric"><span className="activity-icon sage"><UsersRound size={16} /></span><div><span>New customers</span><strong>6</strong></div><span className="metric-note">This week</span></div>
          <div className="activity-metric"><span className="activity-icon clay"><Star size={16} /></span><div><span>Feedback to review</span><strong>3</strong></div><button className="tiny-link" onClick={() => navigate('/feedback')}>Review →</button></div>
          <div className="goal-block"><div className="goal-copy"><span>Weekly order goal</span><strong>76 <small>/ 100 orders</small></strong></div><div className="progress-track"><span /></div><span className="goal-caption">You’re 76% of the way there. Keep growing!</span></div>
        </article>
      </section>

      <div className="section-heading quick-heading reveal"><div><span className="section-kicker">MAKE IT HAPPEN</span><h2>Quick actions</h2></div></div>
      <section className="quick-grid reveal">
        <QuickCard title="Manage products" description="Edit your catalogue and product details" icon={<Sprout size={18} />} kind="products" onClick={() => navigate('/products')} />
        <QuickCard title="Manage orders" description="Review, update and fulfil orders" icon={<ShoppingBasket size={18} />} kind="orders" onClick={() => navigate('/orders')} />
        <QuickCard title="Customer feedback" description="See what people are saying about MARUT" icon={<Star size={18} />} kind="feedback" onClick={() => navigate('/feedback')} />
      </section>
      <footer className="footer"><span>© 2026 MARUT · Grown with care.</span><span><i className="footer-dot" /> All systems looking good</span></footer>
    </section>
  );
}

function MiniBars({ ochre = false }) {
  return <div className={`mini-bars${ochre ? ' ochre-bars' : ''}`}>{[35, 58, 44, 76, 55, 90, 68].map((height, i) => <i key={i} style={{ height: `${height}%`, animationDelay: `${i * 45}ms` }} />)}</div>;
}

function QuickCard({ title, description, icon, kind, onClick }) {
  return <button className={`quick-card quick-${kind}`} onClick={onClick}><span className="quick-icon">{icon}</span><span className="quick-text"><strong>{title}</strong><small>{description}</small></span><span className="quick-arrow">↗</span><span className="quick-decoration">✳</span></button>;
}
