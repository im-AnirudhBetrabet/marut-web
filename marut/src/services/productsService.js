
import { supabase } from '../lib/supabase.js';

// Keep random image choices stable for the lifetime of this page session.
const sessionImageCache = new Map();

const IMAGE_EXTENSIONS = /\.(avif|gif|jpe?g|png|webp)$/i;

function chooseRandom(items) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function getPublicImageUrl(path) {
  const { data } = supabase.storage
    .from('product-images')
    .getPublicUrl(path);

  return data.publicUrl;
}

async function getProductImages(product) {
  const fallback = {
    cardImage: product.card_image_url || product.image_url || '',
    image: product.image_url || product.card_image_url || '',
    galleryImages: [],
  };

  if (!product.image_folder) {
    return {
      ...fallback,
      galleryImages: fallback.image ? [fallback.image] : [],
    };
  }

  // Reuse this product's choices if we've already loaded it this session.
  if (sessionImageCache.has(product.slug)) {
    return sessionImageCache.get(product.slug);
  }

  try {
    const { data, error } = await supabase.storage
      .from('product-images')
      .list(product.image_folder, {
        limit: 100,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (error) throw error;

    const files = (data || []).filter(
      (file) => file.name && IMAGE_EXTENSIONS.test(file.name)
    );

    const imageUrls = files.map((file) =>
      getPublicImageUrl(`${product.image_folder}/${file.name}`)
    );

    const result = {
      cardImage: chooseRandom(imageUrls) || fallback.cardImage,
      image: chooseRandom(imageUrls) || fallback.image,
      galleryImages: imageUrls.length
        ? imageUrls
        : (fallback.image ? [fallback.image] : []),
    };

    sessionImageCache.set(product.slug, result);
    return result;
  } catch (error) {
    console.error(
      `Unable to load images for ${product.name}:`,
      error.message
    );

    const result = {
      ...fallback,
      galleryImages: fallback.image ? [fallback.image] : [],
    };

    sessionImageCache.set(product.slug, result);
    return result;
  }
}

function mapProduct(record, images) {
  return {
    id: record.slug,
    slug: record.slug,
    name: record.name,
    category: record.category,
    categoryLabel: record.category_label,
    cardImage: images.cardImage,
    image: images.image,
    galleryImages: images.galleryImages,
    tag: record.tagline || '',
    spotlightCategory: record.spotlight_category || '',
    description: record.description || '',
    spotlightDescription: record.spotlight_description || '',
    taste: record.taste || '',
    uses: record.uses || '',
    packSizes: record.pack_sizes || [],
    price: 'On enquiry',
    available: record.is_available,
  };
}

export async function getPublishedProducts() {
  const { data, error } = await supabase
    .from('products')
    .select(`
      name,
      slug,
      category,
      category_label,
      tagline,
      description,
      spotlight_category,
      spotlight_description,
      taste,
      uses,
      card_image_url,
      image_url,
      image_folder,
      pack_sizes,
      is_available,
      is_published,
      sort_order
    `)
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Unable to load MARUT products: ${error.message}`);
  }

  return Promise.all(
    (data || []).map(async (record) => {
      const images = await getProductImages(record);
      return mapProduct(record, images);
    })
  );
}
