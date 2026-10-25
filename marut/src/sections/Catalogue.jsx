
import { useEffect, useRef } from 'react';
import { products as fallbackProducts } from '../data/products';
import { getPublishedProducts } from '../services/productsService';
import { catalogueRuntime } from '../catalogueRuntime';
import { markup } from '../catalogueMarkup';
import '../styles/catalogue.css';
import React from 'react';
export default function Catalogue() {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let scriptNodes = [];

    async function initialiseCatalogue() {
      let catalogueProducts = fallbackProducts;

      try {
        const supabaseProducts = await getPublishedProducts();

        if (supabaseProducts.length > 0) {
          catalogueProducts = supabaseProducts;
        }
      } catch (error) {
        console.error(
          'Unable to load MARUT products from Supabase. Using local fallback.',
          error
        );
      }

      if (cancelled) return;

      window.MARUT_PRODUCTS = catalogueProducts;

      catalogueRuntime.forEach((source) => {
        const script = document.createElement('script');
        script.textContent = source;
        host.appendChild(script);
        scriptNodes.push(script);
      });
    }

    initialiseCatalogue();

    return () => {
      cancelled = true;
      scriptNodes.forEach((script) => script.remove());
      delete window.MARUT_PRODUCTS;
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="catalogue-experience"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
