
function catalogueMain(phoneValue) {
  const previousCleanup = window.__MARUT_CATALOGUE_CLEANUP__;
  if (previousCleanup) previousCleanup();

  const section = document.getElementById("catalogue");
  if (!section) return;

  const grid = section.querySelector(".catalogue-grid");
  const filterContainer = document.getElementById("catalogue-filters");

  if (!grid || !filterContainer) {
    console.error("MARUT: Catalogue grid or filters are missing.");
    return;
  }

  const products = window.MARUT_PRODUCTS;

  if (!Array.isArray(products)) {
    console.error("MARUT: Product data is missing or invalid.");
    return;
  }

  const activeProducts = products.filter(product =>
    product &&
    product.available !== false &&
    typeof product.name === "string" &&
    typeof product.id === "string" &&
    typeof product.category === "string" &&
    Array.isArray(product.packSizes)
  );

  if (!activeProducts.length) {
    console.warn("MARUT: No valid active products found.");
    return;
  }

  const PHONE = String(phoneValue || "").replace(/\D/g, "");
  const cleanups = [];
  let disposed = false;

  function on(target, event, handler, options) {
    if (!target) return;

    target.addEventListener(event, handler, options);
    cleanups.push(() =>
      target.removeEventListener(event, handler, options)
    );
  }

  function cleanup() {
    if (disposed) return;
    disposed = true;

    cleanups.forEach(remove => remove());

    if (window.__MARUT_CATALOGUE_CLEANUP__ === cleanup) {
      delete window.__MARUT_CATALOGUE_CLEANUP__;
    }
  }

  window.__MARUT_CATALOGUE_CLEANUP__ = cleanup;

  const escapeHtml = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const packButtons = sizes => sizes.map((size, index) => `
    <button
      type="button"
      class="pack-size-option${index === 0 ? " is-selected" : ""}"
      data-pack-size="${escapeHtml(size)}"
      aria-pressed="${index === 0 ? "true" : "false"}">
      ${escapeHtml(size)}
    </button>
  `).join("");

  grid.innerHTML = activeProducts.map((product, index) => `
    <article
      class="catalogue-card reveal"
      data-category="${escapeHtml(product.category)}"
      data-product="${escapeHtml(product.name)}"
      data-product-id="${escapeHtml(product.id)}"
      data-pack="Pack sizes: ${escapeHtml(product.packSizes.join(", "))}"
      data-selected-pack="${escapeHtml(product.packSizes[0] || "50 g")}"
      data-price="${escapeHtml(product.price || "On enquiry")}">

      <div class="catalogue-image">
        <img
          loading="lazy"
          src="${escapeHtml(product.cardImage || "")}"
          alt="${escapeHtml(product.name)} microgreens">

        <span class="catalogue-number">
          ${String(index + 1).padStart(2, "0")} /
          ${escapeHtml(product.name.toUpperCase())}
        </span>

        <span class="catalogue-tag">
          ${escapeHtml(product.tag || "")}
        </span>
      </div>

      <div class="catalogue-card-body">
        <div class="catalogue-card-top">
          <h3>${escapeHtml(product.name)}</h3>
        </div>

        <p class="catalogue-desc">
          ${escapeHtml(product.description || "")}
        </p>

        <div class="pack-size-picker"
             role="group"
             aria-label="Choose pack size">

          <span class="pack-size-label">PACK SIZE</span>

          <div class="pack-size-options">
            ${packButtons(product.packSizes)}
          </div>
        </div>

        <button
          class="catalogue-view-note"
          type="button"
          data-view-note>
          Explore field notes <span>↗</span>
        </button>

        <div class="catalogue-card-foot">
          <div class="catalogue-price-wrap">
            <span class="catalogue-price-label">Pack sizes</span>
            <span class="catalogue-price">
              ${escapeHtml(product.packSizes.join(" · "))}
            </span>
          </div>

          <div class="catalogue-card-actions">
            <button
              class="catalogue-enquire"
              type="button"
              data-enquire="${escapeHtml(product.name)}">
              Ask about it ↗
            </button>

            <button
              class="catalogue-order-whatsapp"
              type="button"
              data-whatsapp-order="${escapeHtml(product.name)}">
              Order on WhatsApp ↗
            </button>
          </div>
        </div>
      </div>
    </article>
  `).join("");

  const cards = [...section.querySelectorAll(".catalogue-card")];

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  if (
    reduceMotion.matches ||
    !("IntersectionObserver" in window)
  ) {
    cards.forEach(card => card.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: "0px 0px -3% 0px"
    });

    cards.forEach(card => observer.observe(card));
    cleanups.push(() => observer.disconnect());
  }

  const categoryOptions = [
    ...new Map(activeProducts.map(product => [
      product.category,
      {
        value: product.category,
        label: product.categoryLabel || product.category
      }
    ])).values()
  ];

  filterContainer.innerHTML = `
    <button
      class="catalogue-filter"
      type="button"
      data-filter="all"
      aria-pressed="true">
      All microgreens
    </button>

    ${categoryOptions.map(category => `
      <button
        class="catalogue-filter"
        type="button"
        data-filter="${escapeHtml(category.value)}"
        aria-pressed="false">
        ${escapeHtml(category.label)}
      </button>
    `).join("")}
  `;

  const filterButtons = [
    ...section.querySelectorAll("[data-filter]")
  ];

  const audienceButtons = [
    ...section.querySelectorAll("[data-audience]")
  ];

  const count = document.getElementById("catalogue-count");
  const viewLabel = document.getElementById("catalogue-view-label");

  let activeFilter = "all";
  let audience = "home";

  if (count) {
    count.textContent =
      `${String(activeProducts.length).padStart(2, "0")} varieties`;
  }

  const spotlight = Object.fromEntries(
    activeProducts.map((product, index) => [
      product.name,
      {
        image: product.image,
        alt: `${product.name} microgreens`,
        category: product.spotlightCategory ||
          (product.categoryLabel || product.category).toUpperCase(),
        pack: "AVAILABLE PACK SIZES",
        index: `${String(index + 1).padStart(2, "0")} / ${
          String(activeProducts.length).padStart(2, "0")
        }`,
        title: `${escapeHtml(product.name)} <em>.</em>`,
        description:
          product.spotlightDescription || product.description || "",
        taste: product.taste || "",
        uses: product.uses || ""
      }
    ])
  );

  function setActiveCard(card) {
    cards.forEach(item => {
      item.classList.toggle(
        "is-active-card",
        Boolean(card && item === card)
      );
    });

    grid.classList.toggle("has-active-card", Boolean(card));
  }

  cards.forEach(card => {
    card.tabIndex = 0;

    on(card, "click", event => {
      if (event.target.closest(
        "button, a, input, select, textarea, label"
      )) return;

      setActiveCard(card);
    });

    on(card, "keydown", event => {
      if (event.target !== card) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setActiveCard(card);
      }

      if (event.key === "Escape") {
        setActiveCard(null);
      }
    });
  });

  on(document, "click", event => {
    if (!event.target.closest(".catalogue-card")) {
      setActiveCard(null);
    }
  });

  on(document, "keydown", event => {
    if (event.key === "Escape") setActiveCard(null);
  });

  function syncPackButtons(card, pack) {
    if (!card) return;

    card.dataset.selectedPack = pack;

    card.querySelectorAll("[data-pack-size]").forEach(button => {
      const selected = button.dataset.packSize === pack;

      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    document.querySelectorAll("[data-spotlight-pack]").forEach(button => {
      const selected = button.dataset.spotlightPack === pack;

      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function showFieldNotes(card) {
    if (!card) return;

    const name = card.dataset.product;
    const data = spotlight[name];

    if (!data) return;

    syncPackButtons(card, card.dataset.selectedPack || "50 g");

    const product = activeProducts.find(item => item.name === name);
    const spotlightOptions =
      document.getElementById("spotlight-pack-options");

    if (product && spotlightOptions) {
      spotlightOptions.innerHTML = packButtons(product.packSizes)
        .replace(/data-pack-size=/g, "data-spotlight-pack=");

      const selectedPack =
        card.dataset.selectedPack || product.packSizes[0];

      spotlightOptions.querySelectorAll(
        "[data-spotlight-pack]"
      ).forEach(button => {
        const selected =
          button.dataset.spotlightPack === selectedPack;

        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    }

    cards.forEach(item => {
      item.classList.toggle("is-featured", item === card);
    });

    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value ?? "";
    };

    const image = document.getElementById("spotlight-image");

    if (image && data.image) {
      image.style.opacity = "0.25";

      window.setTimeout(() => {
        if (disposed || !image.isConnected) return;

        image.onload = () => {
          image.style.opacity = "1";
        };

        image.onerror = () => {
          image.style.opacity = "1";
        };

        image.src = data.image;
        image.alt = data.alt;

        if (image.complete) image.style.opacity = "1";
      }, 100);
    }

    setText("spotlight-category", data.category);
    setText("spotlight-pack", data.pack);
    setText("spotlight-index", data.index);
    setText("spotlight-description", data.description);
    setText("spotlight-taste", data.taste);
    setText("spotlight-uses", data.uses);

    setText(
      "spotlight-price",
      audience === "business"
        ? "On enquiry"
        : (card.dataset.price || "On enquiry")
    );

    setText(
      "spotlight-price-label",
      audience === "business"
        ? "BULK / RECURRING SUPPLY"
        : "PRICING ON ENQUIRY"
    );

    const title = document.getElementById("spotlight-title");

    if (title) title.innerHTML = data.title;

    const cta = document.getElementById("spotlight-enquire");

    if (cta) {
      cta.dataset.enquire = name;
      cta.innerHTML =
        (audience === "business"
          ? "Discuss supply"
          : "Enquire about a pack") +
        " <span>↗</span>";
    }
  }

  function updateGrid() {
    let visible = 0;

    cards.forEach(card => {
      const show =
        activeFilter === "all" ||
        card.dataset.category === activeFilter;

      card.hidden = !show;
      if (show) visible++;

      const priceWrap = card.querySelector(".catalogue-price-wrap");
      const button = card.querySelector("[data-enquire]");

      if (priceWrap) {
        if (audience === "business") {
          priceWrap.innerHTML = `
            <span class="catalogue-price-label">
              Bulk / recurring supply
            </span>
            <span class="catalogue-price">On enquiry</span>
          `;
        } else {
          priceWrap.innerHTML = `
            <span class="catalogue-price-label">Pack sizes</span>
            <span class="catalogue-price">
              ${escapeHtml(
                card.dataset.pack
                  .replace("Pack sizes: ", "")
                  .replace(/, /g, " · ")
              )}
            </span>
          `;
        }
      }

      if (button) {
        button.textContent = audience === "business"
          ? "Request details ↗"
          : "Ask about it ↗";
      }
    });

    if (count) {
      count.textContent =
        `${String(visible).padStart(2, "0")} varieties`;
    }

    if (viewLabel) {
      viewLabel.textContent = audience === "business"
        ? "Bulk and recurring supply · pricing on enquiry"
        : "Choose your variety and pack size";
    }

    const selected = section.querySelector(
      ".catalogue-card.is-featured"
    );

    const featured =
      selected && !selected.hidden
        ? selected
        : cards.find(card => !card.hidden);

    if (featured) showFieldNotes(featured);
  }

  filterButtons.forEach(button => {
    on(button, "click", () => {
      activeFilter = button.dataset.filter;

      filterButtons.forEach(item => {
        item.setAttribute(
          "aria-pressed",
          String(item === button)
        );
      });

      updateGrid();
    });
  });

  audienceButtons.forEach(button => {
    on(button, "click", () => {
      audience = button.dataset.audience;

      audienceButtons.forEach(item => {
        item.setAttribute(
          "aria-pressed",
          String(item === button)
        );
      });

      updateGrid();
    });
  });

  function openEnquiry(type, product, pack) {
    const isBusiness =
      type === "business" || audience === "business";

    const subject = product
      ? `MARUT enquiry — ${product}${pack ? ` (${pack})` : ""}`
      : isBusiness
        ? "MARUT wholesale and supply enquiry"
        : "Enquiry for MARUT";

    const details = [
      product
        ? `Hello MARUT, I'm interested in ${product}${
            pack ? ` in the ${pack} pack` : ""
          }.`
        : "Hello MARUT, I have an enquiry.",
      isBusiness
        ? "I would like to discuss restaurant, wholesale or recurring supply."
        : "Please share availability, pricing and ordering details.",
      "",
      "Name:",
      "Delivery area:",
      "Quantity / frequency:",
      "",
      "Thank you."
    ].join("\n");

    window.location.href =
      `mailto:info@marut.co.in?subject=${
        encodeURIComponent(subject)
      }&body=${encodeURIComponent(details)}`;
  }

  function orderOnWhatsApp(product, pack) {
    if (!PHONE) {
      console.error(
        "MARUT: VITE_WHATSAPP_NUMBER is not configured."
      );

      window.alert(
        "WhatsApp ordering is temporarily unavailable. Please contact MARUT directly."
      );

      return;
    }

    const message =
      `Hi MARUT! I'd like to order ${product} microgreens (${pack}). ` +
      "Please confirm the price and availability.";

    window.open(
      `https://wa.me/${PHONE}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  cards.forEach(card => {
    card.querySelectorAll("[data-pack-size]").forEach(button => {
      on(button, "click", () => {
        syncPackButtons(card, button.dataset.packSize);
        showFieldNotes(card);
      });
    });

    const noteButton = card.querySelector("[data-view-note]");

    if (noteButton) {
      on(noteButton, "click", () => {
        showFieldNotes(card);

        document.getElementById("catalogue-spotlight")
          ?.scrollIntoView({
            behavior: reduceMotion.matches ? "auto" : "smooth",
            block: "center"
          });
      });
    }

    const cardImage = card.querySelector(".catalogue-image");

    if (cardImage) {
      on(cardImage, "click", () => showFieldNotes(card));
    }
  });

  const spotlightOptions =
    document.getElementById("spotlight-pack-options");

  on(spotlightOptions, "click", event => {
    const button = event.target.closest("[data-spotlight-pack]");
    if (!button) return;

    const featured =
      section.querySelector(".catalogue-card.is-featured") ||
      cards[0];

    if (featured) {
      syncPackButtons(featured, button.dataset.spotlightPack);
    }
  });

  section.querySelectorAll("[data-open-enquiry]").forEach(link => {
    on(link, "click", event => {
      event.preventDefault();
      openEnquiry(link.dataset.openEnquiry);
    });
  });

  section.querySelectorAll("[data-enquire]").forEach(button => {
    on(button, "click", () => {
      const product = button.dataset.enquire;

      const card = cards.find(
        item => item.dataset.product === product
      );

      const pack = card?.dataset.selectedPack || "50 g";

      openEnquiry(audience, product, pack);
    });
  });

  section.querySelectorAll("[data-whatsapp-order]").forEach(button => {
    on(button, "click", () => {
      const product = button.dataset.whatsappOrder;

      const card = cards.find(
        item => item.dataset.product === product
      );

      const pack = card?.dataset.selectedPack || "50 g";

      orderOnWhatsApp(product, pack);
    });
  });

  updateGrid();
}


function catalogueParallaxMain() {
  const previousCleanup = window.__MARUT_PARALLAX_CLEANUP__;
  if (previousCleanup) previousCleanup();

  const root = document.getElementById("catalogue");

  if (!root || root.dataset.parallaxReady === "true") return;

  const feature = root.querySelector("#catalogue-spotlight");
  const visual = root.querySelector(".spotlight-visual");
  const image = root.querySelector("#spotlight-image");
  const stamp = root.querySelector(".spotlight-stamp");
  const index = root.querySelector(".spotlight-index");

  if (!feature || !visual || !image) return;

  root.dataset.parallaxReady = "true";

  const cards = [...root.querySelectorAll(".catalogue-card")];
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  let raf = 0;
  let disposed = false;

  const cleanups = [];

  function on(target, event, handler, options) {
    target.addEventListener(event, handler, options);

    cleanups.push(() =>
      target.removeEventListener(event, handler, options)
    );
  }

  function cleanup() {
    if (disposed) return;
    disposed = true;

    if (raf) window.cancelAnimationFrame(raf);

    cleanups.forEach(remove => remove());

    root.dataset.parallaxReady = "false";

    if (window.__MARUT_PARALLAX_CLEANUP__ === cleanup) {
      delete window.__MARUT_PARALLAX_CLEANUP__;
    }
  }

  window.__MARUT_PARALLAX_CLEANUP__ = cleanup;

  const clamp = (value, min, max) =>
    Math.max(min, Math.min(max, value));

  function updateParallax() {
    raf = 0;

    if (disposed || !root.isConnected) return;

    const viewport = window.innerHeight || 1;
    const isMobile = window.innerWidth <= 760;

    const cardImages = cards
      .map(card => card.querySelector(".catalogue-image img"))
      .filter(Boolean);

    if (reduceMotion.matches) {
      image.style.setProperty("--catalogue-image-shift", "0px");

      if (stamp) {
        stamp.style.setProperty("--catalogue-stamp-shift", "0px");
      }

      if (index) {
        index.style.setProperty("--catalogue-index-shift", "0px");
      }

      cardImages.forEach(img => {
        img.style.setProperty("--catalogue-card-shift", "0px");
      });

      cards.forEach(card => {
        card.style.setProperty("--catalogue-card-x", "0px");
        card.style.setProperty("--catalogue-card-y", "0px");
        card.style.setProperty("--catalogue-card-tilt", "0deg");
        card.style.setProperty("--catalogue-card-scale", "1");
        card.style.opacity = "1";
      });

      return;
    }

    const rect = feature.getBoundingClientRect();

    const progress = clamp(
      (viewport * 0.82 - rect.top) /
        (rect.height + viewport * 0.35),
      0,
      1
    );

    const centered =
      (rect.top + rect.height / 2 - viewport / 2) / viewport;

    image.style.setProperty(
      "--catalogue-image-shift",
      isMobile
        ? "0px"
        : `${Math.round(clamp(centered * -24, -18, 18))}px`
    );

    if (stamp) {
      stamp.style.setProperty(
        "--catalogue-stamp-shift",
        isMobile ? "0px" : `${Math.round(progress * 12)}px`
      );
    }

    if (index) {
      index.style.setProperty(
        "--catalogue-index-shift",
        isMobile ? "0px" : `${Math.round(progress * -8)}px`
      );
    }

    cards.forEach((card, i) => {
      const cardRect = card.getBoundingClientRect();

      const cardCenter =
        (cardRect.top + cardRect.height / 2 - viewport / 2) /
        viewport;

      const direction = i % 2 === 0 ? 1 : -1;
      const normalized = clamp(cardCenter, -1.25, 1.25);

      const y = clamp(
        normalized * (isMobile ? 58 : 76),
        isMobile ? -68 : -92,
        isMobile ? 68 : 92
      );

      const x = direction * clamp(
        Math.abs(normalized) * (isMobile ? 2.5 : 10),
        0,
        isMobile ? 3 : 12
      );

      const tilt = direction * clamp(
        normalized * (isMobile ? 0.35 : 1.7),
        isMobile ? -0.5 : -2.2,
        isMobile ? 0.5 : 2.2
      );

      const scale =
        1 - clamp(Math.abs(normalized) * 0.018, 0, 0.025);

      card.style.setProperty(
        "--catalogue-card-x",
        `${Math.round(x * 10) / 10}px`
      );

      card.style.setProperty(
        "--catalogue-card-y",
        `${Math.round(y * 10) / 10}px`
      );

      card.style.setProperty(
        "--catalogue-card-tilt",
        `${Math.round(tilt * 100) / 100}deg`
      );

      card.style.setProperty(
        "--catalogue-card-scale",
        `${Math.round(scale * 1000) / 1000}`
      );

      card.style.opacity = "1";
    });

    cardImages.forEach((img, i) => {
      const card = img.closest(".catalogue-card");
      if (!card) return;

      const cardRect = card.getBoundingClientRect();

      const cardCenter =
        (cardRect.top + cardRect.height / 2 - viewport / 2) /
        viewport;

      const direction = i % 2 === 0 ? -1 : 1;
      const shift = clamp(cardCenter * -13 * direction, -13, 13);

      img.style.setProperty(
        "--catalogue-card-shift",
        `${Math.round(shift)}px`
      );
    });
  }

  function requestUpdate() {
    if (!raf && !disposed) {
      raf = window.requestAnimationFrame(updateParallax);
    }
  }

  on(window, "scroll", requestUpdate, { passive: true });
  on(window, "resize", requestUpdate, { passive: true });

  if (reduceMotion.addEventListener) {
    on(reduceMotion, "change", requestUpdate);
  } else if (reduceMotion.addListener) {
    reduceMotion.addListener(requestUpdate);

    cleanups.push(() =>
      reduceMotion.removeListener(requestUpdate)
    );
  }

  root.querySelectorAll("[data-view-note]").forEach(button => {
    on(button, "click", () => {
      feature.classList.add("is-changing");

      window.setTimeout(() => {
        if (!disposed) feature.classList.remove("is-changing");
      }, 240);
    });
  });

  requestUpdate();
}


export const catalogueRuntime = [
  `(${catalogueMain.toString()})(${
    JSON.stringify(import.meta.env.VITE_WHATSAPP_NUMBER || "")
  });`,

  `(${catalogueParallaxMain.toString()})();`
];
