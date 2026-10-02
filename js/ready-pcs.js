// Каталог готовых компьютеров: фильтры, карточки и сортировка.
(async () => {
  "use strict";

  const readyPcs = window.NEXUS_PCS;
  const shop = window.NexusShop;
  const filtersForm = document.getElementById("pc-filters-form");
  if (!filtersForm || !shop) return;
  await shop.productsReady;
  const { createElement, formatPrice } = shop;
  const productGrid = document.getElementById("pc-grid");
  const filterTags = document.getElementById("pc-filter-tags");
  const emptyMessage = document.getElementById("pc-empty");
  const priceError = document.getElementById("pc-price-error");
  const minPriceInput = filtersForm.elements.minPrice;
  const maxPriceInput = filtersForm.elements.maxPrice;
  const searchInput = filtersForm.elements.query;
  searchInput.value = new URLSearchParams(location.search).get("q") || "";
  const sortInput = filtersForm.elements.sort;
  const priceSlider = document.getElementById("pc-price-slider");
  const pageNavigation = document.getElementById("pc-page-nav");
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
  const normalizeSearch = (text) =>
    text.toLocaleLowerCase("ru").replace(/\s+/g, " ").trim();

  document.querySelector(".catalog-heading__count").textContent = `${readyPcs.length} КОМПЬЮТЕРОВ`;
  priceSlider.max = String(Math.max(10000, Math.ceil(readyPcs.reduce((max, item) => Math.max(max, item.price), 0) / 10000) * 10000));
  priceSlider.value = priceSlider.max;
  function createFilterOptions(name) {
    const container = filtersForm.querySelector(`[data-filter="${name}"]`);
    if (!container) return;
    const values = [...new Set(readyPcs.map((product) => String(product[name])))].sort((a, b) => name === "ram" ? Number(a) - Number(b) : a.localeCompare(b, "ru"));
    container.replaceChildren(...values.map((value) => {
      const label = createElement("label", name === "ram" ? "memory-option pc-memory-option" : "brand-option");
      const content = name === "ram" ? label : createElement("span", "brand-option__content");
      const input = createElement("input", "pc-checkbox");
      input.type = "checkbox";
      input.name = name;
      input.value = value;
      content.append(input, createElement("span", name === "ram" ? "" : "brand-option__text", name === "ram" ? `${value} ГБ` : value));
      if (name !== "ram") label.append(content, createElement("span", "category-count", String(readyPcs.filter((item) => String(item[name]) === value).length)));
      return label;
    }));
  }
  for (const name of ["cpu", "gpu", "ram"]) createFilterOptions(name);

  function showPagination(totalPages) {
    const links = [];
    const addPageLink = (page, label, className) => {
      const link = createElement("a", className, label);
      link.href = getPageUrl(page);
      link.dataset.page = String(page);
      links.push(link);
    };
    if (currentPage > 1) addPageLink(currentPage - 1, "← Назад", "pagination__previous");
    for (let page = 1; page <= totalPages; page += 1) {
      if (page === currentPage) {
        const current = createElement("span", "pagination__current", String(page));
        current.setAttribute("aria-current", "page");
        links.push(current);
      } else addPageLink(page, String(page), "pagination__page");
    }
    if (currentPage < totalPages) addPageLink(currentPage + 1, "Вперёд →", "pagination__next");
    pageNavigation.replaceChildren(...links);
  }

  function getSelectedValues(name) {
    return [...filtersForm.querySelectorAll(`input[name="${name}"]:checked`)].map(
      (input) => input.value,
    );
  }

  const createProductCard = shop.createProductCard;

  function createFilterTag(label, name, value = "") {
    const button = createElement("button", "filter-tag");
    button.type = "button";
    button.dataset.removeFilter = name;
    button.dataset.value = value;
    button.setAttribute("aria-label", `Убрать фильтр: ${label}`);
    const close = createElement(
      "span",
      "material-symbols-outlined filter-tag__close",
      "close",
    );
    close.setAttribute("aria-hidden", "true");
    button.append(createElement("span", "", label), close);
    filterTags.append(button);
  }

  function showReadyPcs() {
    const focused = document.activeElement;
    const restore = productGrid.contains(focused)
      ? { action: focused.dataset.shopAction, id: focused.dataset.pcId }
      : null;
    const query = normalizeSearch(searchInput.value);
    const cpu = getSelectedValues("cpu");
    const gpu = getSelectedValues("gpu");
    const ram = getSelectedValues("ram");
    const min = minPriceInput.value === "" ? 0 : Number(minPriceInput.value);
    const max = maxPriceInput.value === "" ? Infinity : Number(maxPriceInput.value);
    const invalid =
      minPriceInput.validity.badInput ||
      maxPriceInput.validity.badInput ||
      !Number.isFinite(min) ||
      (maxPriceInput.value !== "" && !Number.isFinite(max)) ||
      min < 0 ||
      max < 0 ||
      min > max;
    const message =
      min > max
        ? "Цена «От» не должна превышать цену «До»."
        : "Введите неотрицательную цену числом.";
    priceError.hidden = !invalid;
    priceError.textContent = invalid ? message : "";
    minPriceInput.setAttribute("aria-invalid", String(invalid));
    maxPriceInput.setAttribute("aria-invalid", String(invalid));
    priceSlider.value = String(
      Math.max(
        0,
        Math.min(
          Number(priceSlider.max),
          max === Infinity ? Number(priceSlider.max) : max,
        ),
      ),
    );
    document.querySelectorAll(".quick-filter").forEach((label) => {
      const checked = label.querySelector("input").checked;
      label.querySelector(
        ".quick-filter__track, .quick-filter__track--active",
      ).className = checked
        ? "quick-filter__track--active"
        : "quick-filter__track";
      label.querySelector(
        ".quick-filter__thumb, .quick-filter__thumb--active",
      ).className = checked
        ? "quick-filter__thumb--active"
        : "quick-filter__thumb";
      label.querySelector(
        ".quick-filter__text, .quick-filter__text--active",
      ).className = checked
        ? "quick-filter__text--active"
        : "quick-filter__text";
    });

    let filtered = invalid
      ? []
      : readyPcs.filter((product) => {
          const searchable = normalizeSearch(
            [
              product.name,
              product.cpu,
              product.cpuModel,
              product.gpu,
              product.gpuModel,
              product.memory,
              product.storage,
              ...(product.express ? ["Экспресс-доставка"] : []),
            ].join(" "),
          );
          return (
            query.split(" ").every((word) => searchable.includes(word)) &&
            product.price >= min &&
            product.price <= max &&
            (!cpu.length || cpu.includes(product.cpu)) &&
            (!gpu.length || gpu.includes(product.gpu)) &&
            (!ram.length || ram.includes(String(product.ram))) &&
            (!filtersForm.elements.inStock.checked || product.inStock) &&
            (!filtersForm.elements.favorites.checked || shop.isFavorite(product.id))
          );
        });
    if (sortInput.value === "price-asc") filtered.sort((a, b) => a.price - b.price);
    else if (sortInput.value === "price-desc")
      filtered.sort((a, b) => b.price - a.price);
    else if (sortInput.value === "name")
      filtered.sort((a, b) => a.name.localeCompare(b.name, "ru"));

    const totalPages = Math.ceil(filtered.length / productsPerPage);
    currentPage = Math.min(currentPage, Math.max(1, totalPages));
    savePageUrl("replaceState");
    const start = (currentPage - 1) * productsPerPage;
    const shown = filtered.slice(start, start + productsPerPage);
    productGrid.replaceChildren(...shown.map(createProductCard));
    emptyMessage.hidden = filtered.length !== 0;
    showPagination(totalPages);
    document
      .getElementById("pc-results-count")
      .replaceChildren(
        document.createTextNode("Показано "),
        createElement("span", "catalog-toolbar__number", filtered.length ? `${start + 1}–${start + shown.length}` : "0"),
        document.createTextNode(" из "),
        createElement("span", "catalog-toolbar__number", String(filtered.length)),
        document.createTextNode(" компьютеров"),
      );
    filterTags.replaceChildren();
    if (query) createFilterTag(`Поиск: ${searchInput.value.trim()}`, "query");
    if (minPriceInput.value) createFilterTag(`От ${formatPrice(min)}`, "minPrice");
    if (maxPriceInput.value) createFilterTag(`До ${formatPrice(max)}`, "maxPrice");
    cpu.forEach((value) => createFilterTag(value, "cpu", value));
    gpu.forEach((value) => createFilterTag(value, "gpu", value));
    ram.forEach((value) => createFilterTag(`${value} ГБ ОЗУ`, "ram", value));
    if (filtersForm.elements.inStock.checked) createFilterTag("В наличии", "inStock");
    if (filtersForm.elements.favorites.checked) createFilterTag("Избранное", "favorites");
    filterTags.hidden = !filterTags.children.length;
    document.getElementById("pc-active-filters").hidden = !filterTags.children.length;
    shop.updateShopButtons();
    if (restore) {
      const replacement = [...productGrid.querySelectorAll("[data-shop-action]")].find(
        (button) =>
          button.dataset.shopAction === restore.action &&
          button.dataset.pcId === restore.id,
      );
      (replacement || searchInput).focus({ preventScroll: true });
    }
  }

  function resetFilters() {
    filtersForm.reset();
    currentPage = 1;
    showReadyPcs();
  }

  const showFirstPage = () => { currentPage = 1; showReadyPcs(); };
  filtersForm.addEventListener("input", (event) => {
    if (event.target !== priceSlider) showFirstPage();
  });
  document
    .querySelectorAll('[form="pc-filters-form"]')
    .forEach((control) =>
      control.addEventListener(
        control.tagName === "SELECT" ? "change" : "input",
        control.name === "sort" ? showReadyPcs : showFirstPage,
      ),
    );
  priceSlider.addEventListener("input", () => {
    maxPriceInput.value = priceSlider.value;
    showFirstPage();
  });
  filtersForm.addEventListener("submit", (event) => event.preventDefault());
  document
    .querySelectorAll("[data-reset-filters]")
    .forEach((button) => button.addEventListener("click", resetFilters));
  filterTags.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-filter]");
    if (!button) return;
    const name = button.dataset.removeFilter;
    if (["cpu", "gpu", "ram"].includes(name)) {
      [...filtersForm.querySelectorAll(`input[name="${name}"]`)].find(
        (input) => input.value === button.dataset.value,
      ).checked = false;
    } else if (["inStock", "favorites"].includes(name))
      filtersForm.elements[name].checked = false;
    else filtersForm.elements[name].value = "";
    showFirstPage();
  });
  document.addEventListener("nexus:shop-change", showReadyPcs);
  pageNavigation.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-page]");
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    currentPage = Number(link.dataset.page);
    savePageUrl("pushState");
    showReadyPcs();
    productGrid.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  window.addEventListener("popstate", () => { currentPage = getPageNumber(); showReadyPcs(); });
  document
    .querySelector(".pc-filters-toggle")
    .addEventListener("click", (event) => {
      const button = event.currentTarget;
      const expanded = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(expanded));
      button.textContent = expanded ? "Скрыть фильтры" : "Показать фильтры";
      filtersForm.classList.toggle("is-expanded", expanded);
    });
  document.querySelectorAll("[data-pc-view]").forEach((button) =>
    button.addEventListener("click", () => {
      productGrid.classList.toggle("pc-list-view", button.dataset.pcView === "list");
      document.querySelectorAll("[data-pc-view]").forEach((viewButton) => {
        const active = viewButton === button;
        viewButton.className = active
          ? "view-switch__button--active"
          : "view-switch__button";
        viewButton.setAttribute("aria-pressed", String(active));
      });
    }),
  );
  showReadyPcs();
})();
