// Общая логика магазина: товары, состояние корзины и избранное.
(() => {
  "use strict";

  const productsById = new Map();
  let catalogLoaded = false;
  const isKnownProduct = (id) => productsById.has(id) || (!catalogLoaded && typeof id === "string" && /^[a-z0-9-]{1,80}$/.test(id));
  const shopStorageKey = "nexus-pc-shop-v1";
  const priceFormatter = new Intl.NumberFormat("ru-RU");
  const formatPrice = (value) => `${priceFormatter.format(value)} ₸`;

  function createElement(tag, className, text) {
    const createdElement = document.createElement(tag);
    if (className) createdElement.className = className;
    if (text !== undefined) createdElement.textContent = text;
    return createdElement;
  }

  function setFallbackImage(image, fallback) {
    if (!fallback) return;
    const showFallbackImage = () => {
      if (image.getAttribute("src") !== fallback) image.src = fallback;
    };
    image.addEventListener("error", showFallbackImage);
    if (image.complete && !image.naturalWidth) showFallbackImage();
  }

  function cleanShopState(value) {
    const favorites = Array.isArray(value?.favorites)
      ? [...new Set(value.favorites.filter(isKnownProduct))]
      : [];
    const cart = [];
    if (Array.isArray(value?.cart)) {
      for (const item of value.cart) {
        if (
          !isKnownProduct(item?.id) ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1
        )
          continue;
        const previous = cart.find((entry) => entry.id === item.id);
        if (previous)
          previous.quantity = Math.min(99, previous.quantity + item.quantity);
        else cart.push({ id: item.id, quantity: Math.min(99, item.quantity) });
      }
    }
    return { favorites, cart };
  }

  function loadShopState() {
    try {
      return cleanShopState(JSON.parse(localStorage.getItem(shopStorageKey)));
    } catch {
      return { favorites: [], cart: [] };
    }
  }

  let state = loadShopState();
  let cloudMode = false;
  let toastTimer;
  const toast = createElement("div", "shop-toast");
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  document.body.append(toast);

  function showMessage(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3500);
  }

  function updateShopButtons() {
    document
      .querySelectorAll('[data-shop-action="favorite"]')
      .forEach((button) => {
        const saved = state.favorites.includes(button.dataset.pcId);
        button.setAttribute("aria-pressed", String(saved));
        const name = productsById.get(button.dataset.pcId)?.name || "компьютер";
        const label = `${saved ? "Убрать из избранного" : "В избранное"}: ${name}`;
        button.setAttribute("aria-label", label);
        button.title = label;
      });
    document.querySelectorAll('[data-shop-action="add"]').forEach((button) => {
      const item = state.cart.find((entry) => entry.id === button.dataset.pcId);
      button.classList.toggle("is-in-cart", Boolean(item));
      button.title = item
        ? `В корзине: ${item.quantity}. Добавить ещё один`
        : "Добавить в корзину";
    });
  }

  function createProductCard(product) {
    const article = createElement("article", "product-card");
    article.dataset.productId = product.id;
    const detailUrl = `product.html?id=${encodeURIComponent(product.id)}`;
    const picture = createElement("div", "product-card__picture");
    const image = createElement("img", "product-card__image");
    image.src = product.image;
    image.alt = product.name;
    image.loading = "lazy";
    setFallbackImage(image, product.fallback);
    const imageLink = createElement("a", "product-card__image-link");
    imageLink.href = detailUrl;
    imageLink.setAttribute("aria-label", `Подробнее о ${product.name}`);
    imageLink.append(image);
    const badges = createElement("div", "product-card__badges");
    if (product.featured)
      badges.append(createElement("span", "product-badge--hit", "ФЛАГМАН"));
    const favoriteWrap = createElement("div", "product-card__favorite-wrap");
    const favorite = createElement("button", "product-card__favorite");
    favorite.type = "button";
    favorite.dataset.shopAction = "favorite";
    favorite.dataset.pcId = product.id;
    favorite.setAttribute(
      "aria-pressed",
      String(state.favorites.includes(product.id)),
    );
    const heart = createElement(
      "span",
      "material-symbols-outlined icon-button",
      "favorite",
    );
    heart.setAttribute("aria-hidden", "true");
    favorite.append(heart);
    favoriteWrap.append(favorite);
    picture.append(badges, favoriteWrap, imageLink);

    const info = createElement("div", "pc-card-content");
    const status = createElement("div", "product-card__status-row");
    const inStock = product.inStock !== false;
    const availability = createElement(
      "span",
      "product-card__stock" + (inStock ? "" : " pc-stock-order"),
    );
    const dot = createElement("span", "product-card__stock-dot");
    dot.setAttribute("aria-hidden", "true");
    availability.append(dot, createElement("span", "", inStock ? "В НАЛИЧИИ" : "ПОД ЗАКАЗ"));
    status.append(availability);
    const title = createElement("h2", "product-card__title");
    const titleLink = createElement("a", "product-card__title-link", product.name);
    titleLink.href = detailUrl;
    title.append(titleLink);
    info.append(picture, status, title);
    const description = String(product.description || "").trim();
    if (description && !(product.kind === "component" && description.toLocaleLowerCase("ru") === "видеокарта")) {
      info.append(createElement("p", "pc-description", description));
    }
    const specs = createElement("div", "product-card__specs");
    const specifications =
      product.kind === "component" || product.kind === "peripheral"
        ? product.specs.map((value) => ["Характеристика", value])
        : [
            ["Видеокарта", product.gpuModel],
            ["Процессор", product.cpuModel],
            ["Память", product.memory],
            ["Накопитель", product.storage],
          ];
    for (const [label, value] of specifications) {
      const spec = createElement("span", "product-card__spec", value);
      spec.title = `${label}: ${value}`;
      specs.append(spec);
    }
    if (product.express) {
      const express = createElement("span", "product-card__spec product-card__spec--express", "Экспресс-доставка");
      express.title = "Доставка: Экспресс-доставка";
      specs.append(express);
    }
    info.append(specs);
    const details = createElement("a", "product-card__details", "Подробнее о товаре →");
    details.href = detailUrl;
    info.append(details);
    const footer = createElement("div", "product-card__footer");
    const price = createElement("div", "product-card__prices");
    price.append(createElement("span", "product-card__price", formatPrice(product.price)));
    const buy = createElement("button", "product-card__buy");
    const cartIcon = createElement(
      "span",
      "material-symbols-outlined icon-button",
      "shopping_cart",
    );
    cartIcon.setAttribute("aria-hidden", "true");
    buy.append(cartIcon, document.createTextNode("В корзину"));
    buy.type = "button";
    buy.dataset.shopAction = "add";
    buy.dataset.pcId = product.id;
    footer.append(price, buy);
    article.append(info, footer);
    return article;
  }

  function saveShopState(message) {
    let saved = true;
    if (!cloudMode) {
      try {
        localStorage.setItem(shopStorageKey, JSON.stringify(state));
      } catch {
        saved = false;
      }
    }
    updateShopButtons();
    document.dispatchEvent(new CustomEvent("nexus:shop-change", { detail: { source: "local" } }));
    showMessage(
      saved
        ? message
        : `${message}. Сохранение недоступно: данные останутся в этой вкладке.`,
    );
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-shop-action]");
    if (!button || button.disabled) return;
    if (button.dataset.shopAction === "clear-cart") {
      clearCart();
      return;
    }
    if (button.dataset.shopAction === "clear-favorites") {
      state.favorites = [];
      saveShopState("Избранное очищено");
      return;
    }
    const id = button.dataset.pcId;
    const product = productsById.get(id);
    if (!product) return;
    const action = button.dataset.shopAction;
    if (action === "favorite") {
      const saved = state.favorites.includes(id);
      state.favorites = saved
        ? state.favorites.filter((entry) => entry !== id)
        : [...state.favorites, id];
      saveShopState(saved ? "Товар убран из избранного" : "Товар добавлен в избранное");
    } else if (action === "add" || action === "buy") {
      const item = state.cart.find((entry) => entry.id === id);
      if (item?.quantity === 99) {
        showMessage("В корзине уже 99 товаров этой модели");
        return;
      }
      if (item) item.quantity += 1;
      else state.cart.push({ id, quantity: 1 });
      saveShopState(`${product.name} добавлен в корзину`);
      if (action === "buy") location.href = "cart.html";
    } else if (action === "remove") {
      state.cart = state.cart.filter((entry) => entry.id !== id);
      saveShopState("Товар удалён из корзины");
    } else if (action === "increase" || action === "decrease") {
      const item = state.cart.find((entry) => entry.id === id);
      if (item) {
        item.quantity = Math.max(
          1,
          Math.min(99, item.quantity + (action === "increase" ? 1 : -1)),
        );
        saveShopState("Количество обновлено");
      }
    }
  });

  function clearCart(message = "Корзина очищена") {
    state.cart = [];
    saveShopState(message);
  }

  function addBuildToCart(ids) {
    if (!Array.isArray(ids) || !ids.length || ids.some((id) => !productsById.has(id)) || new Set(ids).size !== ids.length) return false;
    if (ids.some((id) => state.cart.find((item) => item.id === id)?.quantity === 99)) {
      showMessage("В корзине уже 99 штук одного из комплектующих");
      return false;
    }
    ids.forEach((id) => {
      const item = state.cart.find((entry) => entry.id === id);
      if (item) item.quantity += 1;
      else state.cart.push({ id, quantity: 1 });
    });
    saveShopState("Комплектующие сборки добавлены в корзину");
    return true;
  }

  document.addEventListener("change", (event) => {
    const input = event.target.closest("[data-cart-quantity]");
    if (!input) return;
    const item = state.cart.find((entry) => entry.id === input.dataset.pcId);
    if (!item) return;
    if (!input.checkValidity() || !Number.isInteger(Number(input.value))) {
      input.reportValidity();
      input.value = String(item.quantity);
      return;
    }
    item.quantity = Number(input.value);
    saveShopState("Количество обновлено");
  });

  window.addEventListener("storage", (event) => {
    if (cloudMode || (event.key !== shopStorageKey && event.key !== null)) return;
    state = loadShopState();
    updateShopButtons();
    document.dispatchEvent(new CustomEvent("nexus:shop-change", { detail: { source: "guest-storage" } }));
  });
  function setShopState(nextState, source = "cloud") {
    state = cleanShopState(nextState);
    updateShopButtons();
    document.dispatchEvent(new CustomEvent("nexus:shop-change", { detail: { source } }));
  }
  const productsReady = (window.NexusProductCatalog?.catalogReady || Promise.resolve()).then(() => {
    productsById.clear();
    for (const product of [...window.NEXUS_PCS, ...window.NEXUS_COMPONENTS, ...window.NEXUS_PERIPHERALS]) {
      productsById.set(product.id, product);
    }
    catalogLoaded = Boolean(window.NexusProductCatalog?.loaded);
    state = cleanShopState(state);
    updateShopButtons();
    document.dispatchEvent(new CustomEvent("nexus:shop-change", { detail: { source: "catalog" } }));
  });
  window.NexusShop = {
    productsReady,
    formatPrice,
    createElement,
    updateShopButtons,
    isFavorite: (id) => state.favorites.includes(id),
    getState: () => ({
      favorites: [...state.favorites],
      cart: state.cart.map((item) => ({ ...item })),
    }),
    clearCart,
    addBuildToCart,
    readGuestState: loadShopState,
    cleanShopState,
    setCloudMode: (enabled) => { cloudMode = Boolean(enabled); },
    setShopState,
    showMessage,
    createProductCard,
    setFallbackImage,
  };
  document.querySelectorAll(".product-card__image").forEach((image) => {
    if (image.getAttribute("src")?.startsWith("https://")) {
      setFallbackImage(image, "images/gpu-card.svg");
    }
  });
  updateShopButtons();
  if (["#cart", "#favorites"].includes(location.hash)) {
    location.replace(
      location.hash === "#cart" ? "cart.html" : "favorites.html",
    );
  }
})();
