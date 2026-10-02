// Каталог комплектующих и периферии: фильтры, сортировка и карточки.
(async () => {
  "use strict";
  const isPeripheralCatalog = document.body.dataset.catalog === "peripheral";
  const sourceProducts = isPeripheralCatalog ? window.NEXUS_PERIPHERALS : window.NEXUS_COMPONENTS;
  const shop = window.NexusShop;
  if (!sourceProducts || !shop) return;
  await shop.productsReady;
  const catalogProducts = sourceProducts.map((item) => ({
    ...item,
    category: item.category || "Видеокарты",
    brand: item.brand || item.name.split(" ")[0].toUpperCase(),
    memoryGb: item.memoryGb,
    inStock: item.inStock !== false,
    express: Boolean(item.express),
  }));
  const productsPerPage = 12;
  const getPageNumber = () => {
    const value = Number(new URLSearchParams(location.search).get("page"));
    return Number.isSafeInteger(value) && value > 0 ? value : 1;
  };
  let currentPage = getPageNumber();
  const getPageUrl = (page) => {
    const url = new URL(location.href);
    if (page === 1) url.searchParams.delete("page");
    else url.searchParams.set("page", String(page));
    return url;
  };
  const savePageUrl = (method) => {
    const url = getPageUrl(currentPage);
    if (url.href !== location.href) history[method](null, "", url);
  };
  const title = isPeripheralCatalog ? "Периферия для ПК" : "Комплектующие для ПК";
  const description = isPeripheralCatalog
    ? "Клавиатуры, мыши, гарнитуры, мониторы и аксессуары для вашей игровой системы. Изображения товаров носят иллюстративный характер."
    : "Видеокарты, процессоры, память и другие комплектующие для ПК. Изображения товаров носят иллюстративный характер.";
  const maximumPrice = Math.max(10000, Math.ceil(catalogProducts.reduce((max, item) => Math.max(max, item.price), 0) / 10000) * 10000);
  const getUniqueValues = (key) => [...new Set(catalogProducts.map((item) => item[key]))];
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (symbol) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[symbol]);
  const createFilterOption = (name, value, label = value) => `<label class="brand-option"><span class="brand-option__content"><input class="pc-checkbox" type="checkbox" name="${name}" value="${escapeHtml(value)}"><span class="brand-option__text">${escapeHtml(label)}</span></span><span class="category-count">${catalogProducts.filter((product) => String(product[name]) === String(value)).length}</span></label>`;
  const categoryLinks = `<a class="category-link" href="ready-pcs.html"><span>Готовые ПК</span></a><a class="category-link${isPeripheralCatalog ? "" : "--active"}" href="catalog.html" ${isPeripheralCatalog ? "" : 'aria-current="page"'}><span>Комплектующие</span></a><a class="category-link${isPeripheralCatalog ? "--active" : ""}" href="peripherals.html" ${isPeripheralCatalog ? 'aria-current="page"' : ""}><span>Периферия</span></a>`;
  document.querySelector("main").innerHTML = `
    <div class="page-content"><div class="catalog ready-catalog">
      <div class="catalog__glow" aria-hidden="true"></div><div class="catalog__glow-secondary" aria-hidden="true"></div>
      <section class="catalog-heading"><nav class="breadcrumbs" aria-label="Хлебные крошки"><a class="breadcrumbs__home" href="index.html"><span class="material-symbols-outlined icon-small" aria-hidden="true">home</span>Главная</a><span aria-hidden="true">/</span><span class="breadcrumbs__current" aria-current="page">${title}</span></nav>
        <div class="catalog-heading__row"><div class="catalog-heading__text"><div class="catalog-heading__title-row"><h1 class="catalog-heading__title">${title}</h1><span class="catalog-heading__count">${catalogProducts.length} ТОВАРОВ</span></div><p class="catalog-heading__description">${description}</p></div><div class="stock-status"><span class="stock-status__dot"></span><span class="stock-status__text">В НАЛИЧИИ: ${catalogProducts.filter((item) => item.inStock).length} ИЗ ${catalogProducts.length}</span></div></div>
        <div class="active-filters" id="catalog-active" hidden><span class="active-filters__label">АКТИВНЫЕ ФИЛЬТРЫ:</span><div class="pc-filter-tags" id="catalog-tags"></div><button class="active-filters__clear" type="button" data-reset>Очистить все</button></div>
      </section>
      <div class="catalog__layout"><aside class="filters" aria-labelledby="catalog-filters-title"><div class="filters__header"><div class="filters__heading"><span class="material-symbols-outlined icon-accent" aria-hidden="true">tune</span><h2 class="filters__title" id="catalog-filters-title">Фильтры</h2></div><button class="filters__reset" type="button" data-reset>Сбросить</button></div>
        <button class="filters__reset pc-filters-toggle" type="button" aria-expanded="false" aria-controls="catalog-form">Показать фильтры</button>
        <form class="pc-filter-form" id="catalog-form"><div class="filters__categories"><span class="filters__label">Разделы каталога</span><div class="category-list">${categoryLinks}</div></div><div class="filters__divider"></div>
          <fieldset class="filters__group"><legend class="filters__label">Цена, ₸</legend><div class="price-inputs"><label class="price-field"><span class="price-field__label">от</span><input class="price-field__input" type="number" name="minPrice" min="0" step="1" placeholder="0" aria-label="Цена от, тенге" aria-describedby="catalog-price-error"></label><label class="price-field"><span class="price-field__label">до</span><input class="price-field__input" type="number" name="maxPrice" min="0" step="1" placeholder="${maximumPrice}" aria-label="Цена до, тенге" aria-describedby="catalog-price-error"></label></div><input class="pc-price-slider" id="catalog-slider" type="range" min="0" max="${maximumPrice}" step="1000" value="${maximumPrice}" aria-label="Максимальная цена, тенге"><p class="pc-filter-error" id="catalog-price-error" role="alert" hidden></p></fieldset>
          <div class="filters__divider"></div><fieldset class="filters__group"><legend class="filters__label">${isPeripheralCatalog ? "Тип устройства" : "Тип комплектующего"}</legend><div class="brand-list">${getUniqueValues("category").map((value) => createFilterOption("category", value)).join("")}</div></fieldset>
          <div class="filters__divider"></div><fieldset class="filters__group"><legend class="filters__label">Бренд</legend><div class="brand-list">${getUniqueValues("brand").map((value) => createFilterOption("brand", value)).join("")}</div></fieldset>
          ${isPeripheralCatalog ? "" : `<div class="filters__divider"></div><fieldset class="filters__group"><legend class="filters__label">Объём видеопамяти</legend><div class="memory-options">${getUniqueValues("memoryGb").filter(Number.isFinite).sort((a,b) => a-b).map((value) => `<label class="memory-option pc-memory-option"><input class="pc-checkbox" type="checkbox" name="memoryGb" value="${value}">${value} ГБ</label>`).join("")}</div></fieldset>`}
        </form></aside>
        <section class="catalog__results" aria-label="${title}"><label class="pc-search" for="catalog-search"><span class="material-symbols-outlined" aria-hidden="true">search</span><input class="price-field__input" id="catalog-search" type="search" name="query" form="catalog-form" placeholder="Поиск по названию или характеристикам" aria-label="Поиск товаров" autocomplete="off"></label>
          <div class="catalog-toolbar"><div class="catalog-toolbar__filters"><p class="catalog-toolbar__count" id="catalog-count" role="status" aria-live="polite" tabindex="-1"></p><div class="catalog-toolbar__divider"></div><label class="quick-filter"><input class="pc-switch-input" type="checkbox" name="inStock" form="catalog-form"><span class="quick-filter__track" aria-hidden="true"><span class="quick-filter__thumb"></span></span><span class="quick-filter__text">Только в наличии</span></label><label class="quick-filter"><input class="pc-switch-input" type="checkbox" name="express" form="catalog-form"><span class="quick-filter__track" aria-hidden="true"><span class="quick-filter__thumb"></span></span><span class="quick-filter__text">Экспресс-доставка</span></label><label class="quick-filter"><input class="pc-switch-input" type="checkbox" name="favorites" form="catalog-form"><span class="quick-filter__track" aria-hidden="true"><span class="quick-filter__thumb"></span></span><span class="quick-filter__text">Избранное</span></label></div>
            <div class="catalog-toolbar__sorting"><label class="sort-control" for="catalog-sort"><span class="sort-control__label">Сортировка:</span><span class="sort-control__field"><select class="sort-control__select" name="sort" id="catalog-sort" form="catalog-form"><option value="popular">Сначала популярные</option><option value="price-asc">Сначала дешевле</option><option value="price-desc">Сначала дороже</option><option value="name">По названию</option></select><span class="material-symbols-outlined sort-control__icon" aria-hidden="true">expand_more</span></span></label><div class="view-switch" role="group" aria-label="Вид каталога"><button class="view-switch__button--active" type="button" data-view="grid" aria-label="Плитка" aria-pressed="true"><span class="material-symbols-outlined icon-button" aria-hidden="true">grid_view</span></button><button class="view-switch__button" type="button" data-view="list" aria-label="Список" aria-pressed="false"><span class="material-symbols-outlined icon-button" aria-hidden="true">table_rows</span></button></div></div></div>
          <div class="product-grid" id="catalog-grid"></div><div class="pc-empty" id="catalog-empty" hidden><span class="material-symbols-outlined" aria-hidden="true">search_off</span><h2>Ничего не найдено</h2><p>Измените запрос или уберите часть фильтров.</p><button class="product-card__buy" type="button" data-reset>Сбросить фильтры</button></div><noscript><p class="pc-empty">Для фильтрации товаров включите JavaScript.</p></noscript><div class="catalog-pagination" id="catalog-pagination"><span class="category-count" id="catalog-page-summary"></span><nav class="pagination" id="catalog-page-nav" aria-label="Страницы каталога"></nav></div>
        </section></div></div></div>`;

  const form = document.getElementById("catalog-form");
  form.elements.query.value = new URLSearchParams(location.search).get("q") || "";
  const productGrid = document.getElementById("catalog-grid");
  const filterTags = document.getElementById("catalog-tags");
  const priceError = document.getElementById("catalog-price-error");
  const priceSlider = document.getElementById("catalog-slider");
  const paginationNode = document.getElementById("catalog-pagination");
  const pageNavigation = document.getElementById("catalog-page-nav");
  const getSelectedValues = (name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
  const normalizeSearch = (value) => String(value).toLocaleLowerCase("ru").replace(/\s+/g, " ").trim();

  function showPagination(totalPages) {
    paginationNode.hidden = totalPages === 0;
    pageNavigation.hidden = totalPages <= 1;
    if (!totalPages) return;
    document.getElementById("catalog-page-summary").textContent = `Страница ${currentPage} из ${totalPages}`;
    const links = [];
    const addPageLink = (page, label, className) => {
      const link = shop.createElement("a", className, label);
      link.href = getPageUrl(page).href;
      link.dataset.page = String(page);
      links.push(link);
    };
    if (currentPage > 1) addPageLink(currentPage - 1, "← Назад", "pagination__previous");
    for (let page = 1; page <= totalPages; page += 1) {
      if (page === currentPage) {
        const current = shop.createElement("span", "pagination__current", String(page));
        current.setAttribute("aria-current", "page");
        links.push(current);
      } else addPageLink(page, String(page), "pagination__page");
    }
    if (currentPage < totalPages) addPageLink(currentPage + 1, "Вперёд →", "pagination__next");
    pageNavigation.replaceChildren(...links);
  }

  function showCatalog() {
    const focus = document.activeElement;
    const focusKey = productGrid.contains(focus) ? [focus.dataset.shopAction, focus.dataset.pcId] : null;
    const minField = form.elements.minPrice;
    const maxField = form.elements.maxPrice;
    const min = minField.value === "" ? 0 : Number(minField.value);
    const max = maxField.value === "" ? Infinity : Number(maxField.value);
    const invalid = minField.validity.badInput || maxField.validity.badInput || min < 0 || max < 0 || min > max || !Number.isFinite(min) || (max !== Infinity && !Number.isFinite(max));
    priceError.hidden = !invalid;
    priceError.textContent = invalid ? (min > max ? "Цена «От» не должна превышать цену «До»." : "Введите неотрицательную цену числом.") : "";
    minField.setAttribute("aria-invalid", String(invalid));
    maxField.setAttribute("aria-invalid", String(invalid));
    priceSlider.value = String(Math.max(0, Math.min(maximumPrice, max === Infinity ? maximumPrice : max)));
    const query = normalizeSearch(form.elements.query.value);
    const categories = getSelectedValues("category");
    const brands = getSelectedValues("brand");
    const memories = isPeripheralCatalog ? [] : getSelectedValues("memoryGb");
    let filtered = invalid ? [] : catalogProducts.filter((item) => {
      const searchable = normalizeSearch([item.name, item.category, item.brand, item.description, ...item.specs, ...(item.express ? ["Экспресс-доставка"] : [])].join(" "));
      return query.split(" ").every((word) => searchable.includes(word)) && item.price >= min && item.price <= max && (!categories.length || categories.includes(item.category)) && (!brands.length || brands.includes(item.brand)) && (!memories.length || memories.includes(String(item.memoryGb))) && (!form.elements.inStock.checked || item.inStock) && (!form.elements.express.checked || item.express) && (!form.elements.favorites.checked || shop.isFavorite(item.id));
    });
    if (form.elements.sort.value === "price-asc") filtered.sort((a,b) => a.price - b.price);
    if (form.elements.sort.value === "price-desc") filtered.sort((a,b) => b.price - a.price);
    if (form.elements.sort.value === "name") filtered.sort((a,b) => a.name.localeCompare(b.name, "ru"));
    const totalPages = Math.ceil(filtered.length / productsPerPage);
    currentPage = Math.min(currentPage, Math.max(1, totalPages));
    savePageUrl("replaceState");
    const start = (currentPage - 1) * productsPerPage;
    const shown = filtered.slice(start, start + productsPerPage);
    productGrid.replaceChildren(...shown.map(shop.createProductCard));
    document.getElementById("catalog-empty").hidden = filtered.length !== 0;
    document.getElementById("catalog-count").textContent = filtered.length ? `Показано ${start + 1}–${start + shown.length} из ${filtered.length} товаров` : "Товары не найдены";
    showPagination(totalPages);
    filterTags.replaceChildren();
    const addFilterTag = (label, name, value = "") => {
      const button = shop.createElement("button", "filter-tag", `${label} ×`);
      button.type = "button";
      button.dataset.removeFilter = name;
      button.dataset.value = value;
      button.setAttribute("aria-label", `Убрать фильтр: ${label}`);
      filterTags.append(button);
    };
    if (query) addFilterTag(`Поиск: ${form.elements.query.value.trim()}`, "query");
    if (minField.value) addFilterTag(`От ${shop.formatPrice(min)}`, "minPrice");
    if (maxField.value) addFilterTag(`До ${shop.formatPrice(max)}`, "maxPrice");
    categories.forEach((value) => addFilterTag(value, "category", value));
    brands.forEach((value) => addFilterTag(value, "brand", value));
    memories.forEach((value) => addFilterTag(`${value} ГБ`, "memoryGb", value));
    if (form.elements.inStock.checked) addFilterTag("В наличии", "inStock");
    if (form.elements.express.checked) addFilterTag("Экспресс-доставка", "express");
    if (form.elements.favorites.checked) addFilterTag("Избранное", "favorites");
    document.getElementById("catalog-active").hidden = filterTags.children.length === 0;
    document.querySelectorAll(".quick-filter").forEach((label) => {
      const checked = label.querySelector("input").checked;
      label.querySelector("[class^=quick-filter__track]").className = checked ? "quick-filter__track--active" : "quick-filter__track";
      label.querySelector("[class^=quick-filter__thumb]").className = checked ? "quick-filter__thumb--active" : "quick-filter__thumb";
      label.querySelector("[class^=quick-filter__text]").className = checked ? "quick-filter__text--active" : "quick-filter__text";
    });
    shop.updateShopButtons();
    if (focusKey) ([...grid.querySelectorAll("[data-shop-action]")].find((button) => button.dataset.shopAction === focusKey[0] && button.dataset.pcId === focusKey[1]) || form.elements.query).focus({ preventScroll: true });
  }

  const showFirstPage = () => { currentPage = 1; savePageUrl("replaceState"); showCatalog(); };
  const clearFilters = () => { form.reset(); showFirstPage(); };
  const onFilterChange = (event) => {
    if (event.target.name === "sort") showCatalog();
    else showFirstPage();
  };
  form.addEventListener("input", (event) => {
    if (event.target !== priceSlider && event.target.type !== "checkbox") onFilterChange(event);
  });
  form.addEventListener("change", (event) => {
    if (event.target.type === "checkbox" || event.target.tagName === "SELECT") onFilterChange(event);
  });
  form.addEventListener("submit", (event) => event.preventDefault());
  document.querySelectorAll('[form="catalog-form"]').forEach((control) => {
    control.addEventListener(control.type === "checkbox" || control.tagName === "SELECT" ? "change" : "input", onFilterChange);
  });
  priceSlider.addEventListener("input", () => { form.elements.maxPrice.value = priceSlider.value; showFirstPage(); });
  document.querySelectorAll("[data-reset]").forEach((button) => button.addEventListener("click", clearFilters));
  filterTags.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-filter]");
    if (!button) return;
    const name = button.dataset.removeFilter;
    if (["category", "brand", "memoryGb"].includes(name)) [...form.querySelectorAll(`input[name="${name}"]`)].find((input) => input.value === button.dataset.value).checked = false;
    else if (["inStock", "express", "favorites"].includes(name)) form.elements[name].checked = false;
    else form.elements[name].value = "";
    showFirstPage();
  });
  pageNavigation.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-page]");
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    currentPage = Number(link.dataset.page);
    savePageUrl("pushState");
    showCatalog();
    document.getElementById("catalog-count").focus({ preventScroll: true });
    document.querySelector(".catalog__results").scrollIntoView({ block: "start", behavior: "smooth" });
  });
  window.addEventListener("popstate", () => { currentPage = getPageNumber(); showCatalog(); });
  document.querySelector(".pc-filters-toggle").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const expanded = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(expanded));
    button.textContent = expanded ? "Скрыть фильтры" : "Показать фильтры";
    form.classList.toggle("is-expanded", expanded);
  });
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
    productGrid.classList.toggle("pc-list-view", button.dataset.view === "list");
    document.querySelectorAll("[data-view]").forEach((view) => {
      const active = view === button;
      view.className = active ? "view-switch__button--active" : "view-switch__button";
      view.setAttribute("aria-pressed", String(active));
    });
  }));
  document.addEventListener("nexus:shop-change", showCatalog);
  showCatalog();
})();
