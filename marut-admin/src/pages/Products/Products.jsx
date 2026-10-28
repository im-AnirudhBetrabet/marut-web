import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import './products.css';

const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const DEFAULT_PACK_SIZES = ['50 g', '100 g', '250 g', '500 g'];

const EMPTY_FORM = {
  name: '',
  slug: '',
  category: '',
  category_label: '',
  tagline: '',
  description: '',
  spotlight_category: '',
  spotlight_description: '',
  taste: '',
  uses: '',
  card_image_url: '',
  image_url: '',
  image_folder: '',
  pack_sizes: DEFAULT_PACK_SIZES,
  is_available: true,
  is_featured: false,
  sort_order: 100,
  is_test_product: false,
};

const FIELD_GROUPS = [
  { title: 'Product identity', fields: [
    ['name', 'Product name', 'text', true],
    ['slug', 'URL slug', 'text', true],
    ['category', 'Category key', 'text', true],
    ['category_label', 'Category label', 'text', true],
    ['tagline', 'Tagline', 'text'],
  ]},
  { title: 'Product story', fields: [
    ['description', 'Description', 'textarea'],
    ['spotlight_category', 'Spotlight category', 'text'],
    ['spotlight_description', 'Spotlight description', 'textarea'],
    ['taste', 'Taste profile', 'textarea'],
    ['uses', 'Suggested uses', 'textarea'],
  ]},
  { title: 'Images & packs', fields: [
    ['card_image_url', 'Card image URL', 'url'],
    ['image_url', 'Main image URL', 'url'],
    ['image_folder', 'Image folder', 'text'],
    ['pack_sizes_text', 'Pack sizes (comma-separated)', 'text'],
  ]},
];

const pretty = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase());
const dateLabel = (value) => value ? new Date(value).toLocaleDateString() : '—';

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ limit: 12, offset: 0, total: 0, has_more: false });
  const [filters, setFilters] = useState({ search: '', category: '', is_published: '', is_available: '', is_test_product: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [packSizesText, setPackSizesText] = useState(DEFAULT_PACK_SIZES.join(', '));
  const [confirmPublish, setConfirmPublish] = useState(null);
  const [productImages, setProductImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const [imageNotice, setImageNotice] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);

  const request = useCallback(async (path, options = {}) => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session?.access_token) throw new Error('Your session has expired. Please sign in again.');
    const isMultipart = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const response = await fetch(`${API}/api/v1/products${path}`, {
      ...options,
      headers: {
        ...(!isMultipart ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${data.session.access_token}`,
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const fieldErrors = payload.details && typeof payload.details === 'object'
        ? Object.entries(payload.details).flatMap(([key, messages]) => (messages || []).map((message) => `${pretty(key)}: ${message}`)).join(' ')
        : '';
      throw new Error([payload.error || `Request failed (${response.status})`, fieldErrors].filter(Boolean).join(' — '));
    }
    return payload;
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', String(pagination.limit));
    params.set('offset', String(pagination.offset));
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '') params.set(key, value);
    });
    return `?${params.toString()}`;
  }, [filters, pagination.limit, pagination.offset]);

  const refresh = useCallback(async ({ resetOffset = false } = {}) => {
    setLoading(true);
    setError('');
    try {
      const currentOffset = resetOffset ? 0 : pagination.offset;
      const params = new URLSearchParams();
      params.set('limit', String(pagination.limit));
      params.set('offset', String(currentOffset));
      Object.entries(filters).forEach(([key, value]) => { if (value !== '') params.set(key, value); });
      const result = await request(`?${params.toString()}`);
      setProducts(Array.isArray(result.products) ? result.products : []);
      setPagination((old) => ({ ...old, ...(result.pagination || {}), offset: currentOffset }));
    } catch (e) {
      setError(e.message || 'Unable to load products.');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit, pagination.offset, request]);

  useEffect(() => { refresh(); }, [refresh]);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);
  const publishedCount = products.filter((p) => p.is_published).length;
  const availableCount = products.filter((p) => p.is_available).length;
  const draftCount = products.filter((p) => !p.is_published).length;

  function updateFilter(key, value) {
    setPagination((old) => ({ ...old, offset: 0 }));
    setFilters((old) => ({ ...old, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setProductImages([]); setSelectedFiles([]); setImageError(''); setImageNotice('');
    setForm({ ...EMPTY_FORM, pack_sizes: [...DEFAULT_PACK_SIZES] });
    setPackSizesText(DEFAULT_PACK_SIZES.join(', '));
    setError('');
    setNotice('');
    setModal('create');
  }

  function openEdit(product) {
    setEditing(product);
    setProductImages([]); setSelectedFiles([]); setImageError(''); setImageNotice('');
    void loadProductImages(product.id);
    const next = { ...EMPTY_FORM, ...product, pack_sizes: Array.isArray(product.pack_sizes) ? product.pack_sizes : [...DEFAULT_PACK_SIZES] };
    setForm(next);
    setPackSizesText(next.pack_sizes.join(', '));
    setError('');
    setNotice('');
    setModal('edit');
  }

  function changeField(key, value) {
    setForm((old) => {
      const next = { ...old, [key]: value };
      if (key === 'name' && (!editing || old.slug === slugify(old.name))) next.slug = slugify(value);
      if (key === 'slug') next.slug = slugify(value);
      return next;
    });
  }

  function payloadFromForm() {
    return {
      name: form.name.trim(),
      slug: form.slug.trim(),
      category: form.category.trim(),
      category_label: form.category_label.trim(),
      tagline: form.tagline,
      description: form.description,
      spotlight_category: form.spotlight_category,
      spotlight_description: form.spotlight_description,
      taste: form.taste,
      uses: form.uses,
      card_image_url: form.card_image_url,
      image_url: form.image_url,
      image_folder: form.image_folder || form.slug,
      pack_sizes: packSizesText.split(',').map((x) => x.trim()).filter(Boolean),
      is_available: Boolean(form.is_available),
      is_featured: Boolean(form.is_featured),
      sort_order: Number(form.sort_order),
      is_test_product: Boolean(form.is_test_product),
    };
  }


  async function loadProductImages(productId) {
    setImagesLoading(true); setImageError('');
    try {
      const result = await request(`/${encodeURIComponent(productId)}/images`);
      setProductImages(Array.isArray(result.images) ? result.images : []);
    } catch (e) {
      setImageError(e.message || 'Unable to load product images.');
    } finally { setImagesLoading(false); }
  }

  async function uploadProductImages() {
    if (!editing?.id || selectedFiles.length === 0) return;
    setImageBusy(true); setImageError(''); setImageNotice('');
    try {
      const body = new FormData();
      selectedFiles.forEach((file) => body.append('images', file));
      const result = await request(`/${encodeURIComponent(editing.id)}/images`, { method: 'POST', body });
      setSelectedFiles([]);
      setImageNotice(`${(result.images || []).length} image(s) uploaded successfully.`);
      await loadProductImages(editing.id);
      const refreshed = await request(`/${encodeURIComponent(editing.id)}`);
      if (refreshed.product) {
        setEditing(refreshed.product);
        setForm((old) => ({ ...old, card_image_url: refreshed.product.card_image_url || '', image_url: refreshed.product.image_url || '', image_folder: refreshed.product.image_folder || '' }));
      }
      await refresh();
    } catch (e) { setImageError(e.message || 'Unable to upload images.'); }
    finally { setImageBusy(false); }
  }

  async function setImageFallback(image, target) {
    if (!editing?.id) return;
    setImageBusy(true); setImageError(''); setImageNotice('');
    try {
      await request(`/${encodeURIComponent(editing.id)}/images/fallback`, {
        method: 'PATCH', body: JSON.stringify({ image_name: image.name, target }),
      });
      setImageNotice(target === 'both' ? 'Card and primary images updated.' : `${target === 'card' ? 'Card' : 'Primary'} image updated.`);
      await loadProductImages(editing.id);
      const refreshed = await request(`/${encodeURIComponent(editing.id)}`);
      if (refreshed.product) {
        setEditing(refreshed.product);
        setForm((old) => ({ ...old, card_image_url: refreshed.product.card_image_url || '', image_url: refreshed.product.image_url || '', image_folder: refreshed.product.image_folder || '' }));
      }
      await refresh();
    } catch (e) { setImageError(e.message || 'Unable to update fallback image.'); }
    finally { setImageBusy(false); }
  }

  async function deleteProductImage(image) {
    if (!editing?.id || !window.confirm(`Delete ${image.name}? This cannot be undone.`)) return;
    setImageBusy(true); setImageError(''); setImageNotice('');
    try {
      await request(`/${encodeURIComponent(editing.id)}/images/${encodeURIComponent(image.name)}`, { method: 'DELETE' });
      setImageNotice('Image deleted.');
      await loadProductImages(editing.id);
    } catch (e) { setImageError(e.message || 'Unable to delete image.'); }
    finally { setImageBusy(false); }
  }

  async function saveProduct(event) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const payload = payloadFromForm();
      const path = modal === 'edit' ? `/${encodeURIComponent(editing.id)}` : '';
      await request(path, { method: modal === 'edit' ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setModal('');
      setNotice(modal === 'create' ? 'Product created as a draft.' : 'Product changes saved.');
      await refresh();
    } catch (e) { setError(e.message || 'Unable to save product.'); }
    finally { setBusy(false); }
  }

  async function patchProduct(product, patch, successMessage) {
    setBusy(true); setError(''); setNotice('');
    try {
      await request(`/${encodeURIComponent(product.id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
      setNotice(successMessage);
      await refresh();
    } catch (e) { setError(e.message || 'Unable to update product.'); }
    finally { setBusy(false); }
  }

  async function setPublication(product, isPublished) {
    setBusy(true); setError(''); setNotice('');
    try {
      await request(`/${encodeURIComponent(product.id)}/publication`, {
        method: 'PATCH', body: JSON.stringify({ is_published: isPublished }),
      });
      setConfirmPublish(null);
      setNotice(isPublished ? 'Product published to the catalogue.' : 'Product unpublished and returned to drafts.');
      await refresh();
    } catch (e) { setError(e.message || 'Unable to change publication status.'); setConfirmPublish(null); }
    finally { setBusy(false); }
  }

  return <main className="products-page">
    <header className="products-header">
      <div>
        <p className="products-eyebrow">CATALOGUE MANAGEMENT</p>
        <h1>Products</h1>
        <p className="products-subtitle">Create products, manage catalogue details, and control what customers can see.</p>
      </div>
      <button className="products-primary" onClick={openCreate}>＋ Add product</button>
    </header>

    {notice && <div className="products-notice" role="status">{notice}</div>}
    {error && !modal && <div className="products-alert" role="alert">{error}</div>}

    <section className="products-stats">
      <div><span>Products in this view</span><strong>{pagination.total}</strong></div>
      <div><span>Published on this page</span><strong>{publishedCount}</strong></div>
      <div><span>Available on this page</span><strong>{availableCount}</strong></div>
      <div><span>Drafts on this page</span><strong>{draftCount}</strong></div>
    </section>

    <section className="products-panel">
      <div className="products-toolbar">
        <div className="products-search-wrap">
          <label className="products-sr-only" htmlFor="products-search">Search products</label>
          <input id="products-search" className="products-input" value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} placeholder="Search product name…" />
        </div>
        <label className="products-filter-label">Category
          <select className="products-input" value={filters.category} onChange={(e) => updateFilter('category', e.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label className="products-filter-label">Publication
          <select className="products-input" value={filters.is_published} onChange={(e) => updateFilter('is_published', e.target.value)}>
            <option value="">All</option><option value="true">Published</option><option value="false">Drafts</option>
          </select>
        </label>
        <label className="products-filter-label">Availability
          <select className="products-input" value={filters.is_available} onChange={(e) => updateFilter('is_available', e.target.value)}>
            <option value="">All</option><option value="true">Available</option><option value="false">Unavailable</option>
          </select>
        </label>
        <label className="products-filter-label">Product type
          <select className="products-input" value={filters.is_test_product} onChange={(e) => updateFilter('is_test_product', e.target.value)}>
            <option value="">All products</option><option value="false">Regular</option><option value="true">Test products</option>
          </select>
        </label>
        <button className="products-secondary" onClick={() => refresh()} disabled={loading}>{loading ? 'Loading…' : '↻ Refresh'}</button>
      </div>

      {loading ? <p className="products-empty">Loading products…</p> :
        products.length === 0 ? <div className="products-empty-state"><span>✳</span><h3>No products found</h3><p>Try changing the filters or add a new product.</p><button className="products-secondary" onClick={openCreate}>Add a product</button></div> :
        <div className="products-grid">{products.map((product) => <article className="products-card" key={product.id}>
          <div className="products-card-image">
            {product.card_image_url || product.image_url
              ? <img src={product.card_image_url || product.image_url} alt={product.name} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              : <div className="products-image-placeholder"><span>✳</span><small>Product imagery</small></div>}
            <div className="products-card-top-badges">
              <span className={`products-badge ${product.is_published ? 'published' : 'draft'}`}>{product.is_published ? 'Published' : 'Draft'}</span>
              {product.is_test_product && <span className="products-badge test">Test</span>}
            </div>
            <button className="products-edit-image-button" onClick={() => openEdit(product)} aria-label={`Edit ${product.name}`}>Edit</button>
          </div>
          <div className="products-card-body">
            <div className="products-card-kicker">{product.category_label || product.category || 'Uncategorised'}</div>
            <h2>{product.name}</h2>
            <p className="products-card-tagline">{product.tagline || 'No tagline added yet.'}</p>
            <div className="products-card-meta">
              <span className={`products-status ${product.is_available ? 'available' : 'unavailable'}`}>{product.is_available ? '● Available' : '● Unavailable'}</span>
              <span>{product.is_featured ? '★ Featured' : 'Not featured'}</span>
            </div>
            <div className="products-pack-list">{(product.pack_sizes || []).map((size) => <span key={size}>{size}</span>)}</div>
            <div className="products-card-footer">
              <small>Order: {product.sort_order ?? 0}</small>
              <div className="products-actions">
                <button className="products-link" disabled={busy} onClick={() => patchProduct(product, { is_available: !product.is_available }, product.is_available ? 'Product marked unavailable.' : 'Product marked available.')}>{product.is_available ? 'Mark unavailable' : 'Make available'}</button>
                <button className="products-link" disabled={busy} onClick={() => patchProduct(product, { is_featured: !product.is_featured }, product.is_featured ? 'Product removed from featured.' : 'Product marked featured.')}>{product.is_featured ? 'Unfeature' : 'Feature'}</button>
                <button className="products-publish-link" disabled={busy || (product.is_test_product && !product.is_published)} onClick={() => product.is_published ? setPublication(product, false) : setConfirmPublish(product)}>
                  {product.is_published ? 'Unpublish' : 'Publish'}
                </button>
              </div>
            </div>
          </div>
        </article>)}</div>}

      <footer className="products-pagination">
        <span>Showing {pagination.total === 0 ? 0 : pagination.offset + 1}–{Math.min(pagination.offset + products.length, pagination.total)} of {pagination.total}</span>
        <div><button className="products-secondary" disabled={loading || pagination.offset <= 0} onClick={() => setPagination((old) => ({ ...old, offset: Math.max(0, old.offset - old.limit) }))}>Previous</button>
          <button className="products-secondary" disabled={loading || !pagination.has_more} onClick={() => setPagination((old) => ({ ...old, offset: old.offset + old.limit }))}>Next</button></div>
      </footer>
    </section>

    <section className="products-note-panel">
      <div><h2>Publishing rules</h2><p>New products are created as drafts. Test products cannot be published until the test flag is removed.</p></div>
      <div><h2>Image handling</h2><p>Upload up to 10 images per batch (8 MB each), choose card and primary fallbacks, and remove unused images from each product’s storage folder.</p></div>
      <div><h2>Pack pricing</h2><p>Pack prices are not part of the supplied products API schema. Price editing needs the separate pricing endpoint/schema before it can be wired into this page.</p></div>
    </section>

    {(modal === 'create' || modal === 'edit') && <div className="products-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setModal(''); }}>
      <section className="products-modal" role="dialog" aria-modal="true" aria-labelledby="products-modal-title">
        <header className="products-modal-head"><div><p className="products-eyebrow">{modal === 'create' ? 'NEW CATALOGUE ITEM' : 'PRODUCT DETAILS'}</p><h2 id="products-modal-title">{modal === 'create' ? 'Add product' : 'Edit product'}</h2><p>{modal === 'create' ? 'Products start as unpublished drafts.' : `Editing ${editing?.name || 'product'}`}</p></div>
          <button className="products-close" type="button" disabled={busy} onClick={() => setModal('')} aria-label="Close">×</button>
        </header>
        <form onSubmit={saveProduct} className="products-form">
          {FIELD_GROUPS.map((group) => <section className="products-form-section" key={group.title}>
            <h3>{group.title}</h3><div className="products-form-grid">
              {group.fields.map(([key, label, type, required]) => {
                const value = key === 'pack_sizes_text' ? packSizesText : form[key] ?? '';
                const onChange = key === 'pack_sizes_text' ? setPackSizesText : (next) => changeField(key, next);
                return <label className={`products-field ${type === 'textarea' ? 'wide' : ''}`} key={key}>
                  <span>{label}{required && <b> *</b>}</span>
                  {type === 'textarea'
                    ? <textarea value={value} maxLength={key === 'description' ? 5000 : key === 'spotlight_description' ? 3000 : key === 'uses' ? 1000 : 500} rows={3} onChange={(e) => onChange(e.target.value)} disabled={busy} />
                    : <input type={type} value={value} required={Boolean(required)} maxLength={key === 'name' ? 160 : key === 'slug' ? 120 : key === 'category' ? 80 : key === 'category_label' ? 100 : undefined}
                        pattern={key === 'slug' ? '[a-z0-9]+(-[a-z0-9]+)*' : undefined}
                        onChange={(e) => onChange(e.target.value)} disabled={busy} />}
                </label>;
              })}
            </div>
          </section>)}
          {modal === 'edit' && editing && <section className="products-form-section products-image-manager">
            <div className="products-image-manager-head"><div><h3>Product image library</h3><p>Images are stored in this product’s existing Supabase Storage folder.</p></div><span className="products-image-count">{productImages.length} images</span></div>
            {imageError && <div className="products-alert" role="alert">{imageError}</div>}
            {imageNotice && <div className="products-notice" role="status">{imageNotice}</div>}
            <div className="products-upload-row">
              <label className="products-field products-file-field"><span>Upload images (AVIF, GIF, JPEG, PNG, WebP; max 8 MB each, 10 per batch)</span><input type="file" accept="image/avif,image/gif,image/jpeg,image/png,image/webp" multiple onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))} disabled={imageBusy || busy} /></label>
              <button type="button" className="products-primary" onClick={uploadProductImages} disabled={imageBusy || busy || selectedFiles.length === 0}>{imageBusy ? 'Working…' : `Upload ${selectedFiles.length || ''} image${selectedFiles.length === 1 ? '' : 's'}`}</button>
            </div>
            {selectedFiles.length > 0 && <p className="products-image-help">Selected: {selectedFiles.map((file) => file.name).join(', ')}</p>}
            {imagesLoading ? <p className="products-empty">Loading image library…</p> : productImages.length === 0 ? <div className="products-empty-state"><span>✳</span><h3>No uploaded images yet</h3><p>Choose one or more image files above to add them to this product.</p></div> : <div className="products-image-library">
              {productImages.map((image) => <article className="products-library-card" key={image.name}>
                <img src={image.url} alt={image.name} loading="lazy" />
                <div className="products-library-card-body"><strong title={image.name}>{image.name}</strong><small>{image.size != null ? `${(Number(image.size) / 1024).toFixed(0)} KB` : image.content_type || 'Image file'}</small>
                  <div className="products-image-tags">{image.is_card_fallback && <span>Card fallback</span>}{image.is_primary_fallback && <span>Primary fallback</span>}</div>
                  <div className="products-image-actions">
                    <button type="button" className="products-link" disabled={imageBusy || image.is_card_fallback} onClick={() => setImageFallback(image, 'card')}>Use for card</button>
                    <button type="button" className="products-link" disabled={imageBusy || image.is_primary_fallback} onClick={() => setImageFallback(image, 'primary')}>Use as primary</button>
                    <button type="button" className="products-link" disabled={imageBusy || (image.is_card_fallback && image.is_primary_fallback)} onClick={() => setImageFallback(image, 'both')}>Use for both</button>
                    <button type="button" className="products-image-delete" disabled={imageBusy || image.is_card_fallback || image.is_primary_fallback} title={image.is_card_fallback || image.is_primary_fallback ? 'Choose a different fallback before deleting this image' : 'Delete image'} onClick={() => deleteProductImage(image)}>Delete</button>
                  </div>
                </div>
              </article>)}
            </div>}
            <p className="products-image-help">An image currently used as the card or primary fallback cannot be deleted. Choose a different fallback first.</p>
          </section>}
          <section className="products-form-section"><h3>Catalogue controls</h3>
            <div className="products-form-grid">
              <label className="products-field"><span>Sort order</span><input type="number" min="0" max="100000" step="1" value={form.sort_order} onChange={(e) => changeField('sort_order', e.target.value === '' ? '' : Number(e.target.value))} required disabled={busy} /></label>
              {[
                ['is_available', 'Available for customers', 'Controls availability without unpublishing.'],
                ['is_featured', 'Featured product', 'Highlights this product in featured areas.'],
                ['is_test_product', 'Test product', 'Test products cannot be published.'],
              ].map(([key, label, help]) => <label className="products-switch-field" key={key}><span><strong>{label}</strong><small>{help}</small></span><input type="checkbox" checked={Boolean(form[key])} onChange={(e) => changeField(key, e.target.checked)} disabled={busy} /></label>)}
            </div>
          </section>
          {error && <div className="products-alert" role="alert">{error}</div>}
          <footer className="products-modal-footer"><button type="button" className="products-secondary" disabled={busy} onClick={() => setModal('')}>Cancel</button><button type="submit" className="products-primary" disabled={busy}>{busy ? 'Saving…' : modal === 'create' ? 'Create draft' : 'Save changes'}</button></footer>
        </form>
      </section>
    </div>}

    {confirmPublish && <div className="products-overlay"><section className="products-confirm" role="dialog" aria-modal="true" aria-labelledby="products-publish-title">
      <div className="products-confirm-mark">↗</div><h2 id="products-publish-title">Publish {confirmPublish.name}?</h2>
      <p>This makes the product eligible to appear in the public catalogue. Confirm the details and images are ready.</p>
      {confirmPublish.is_test_product && <p className="products-alert">Test products cannot be published. Edit the product and remove the test flag first.</p>}
      <footer className="products-modal-footer"><button className="products-secondary" disabled={busy} onClick={() => setConfirmPublish(null)}>Cancel</button><button className="products-primary" disabled={busy || confirmPublish.is_test_product} onClick={() => setPublication(confirmPublish, true)}>{busy ? 'Publishing…' : 'Publish product'}</button></footer>
    </section></div>}
  </main>;
}
