// Карточки товаров и готовых сборок на главной странице.
(async () => {
  "use strict";
  const shop = window.NexusShop;
  await shop.productsReady;
  const pcs = window.NEXUS_PCS;
  const hero = document.querySelector(".hero");
  const heroProduct = pcs.find((item) => item.id === "cyberpunk-beast")
    || pcs.find((item) => item.featured) || pcs[0];
  hero.hidden = !heroProduct;
  if (heroProduct) {
    const title = hero.querySelector(".hero__title");
    const words = heroProduct.name.split(/\s+/);
    const first = words.shift();
    const highlighted = words.shift();
    const titleParts = [document.createTextNode(first)];
    if (highlighted) {
      const accent = document.createElement("span");
      accent.className = "hero__highlight";
      accent.textContent = highlighted;
      titleParts.push(document.createTextNode(" "), accent);
    }
    if (words.length) titleParts.push(document.createTextNode(` ${words.join(" ")}`));
    title.replaceChildren(...titleParts);
    hero.querySelector(".hero__description").textContent = heroProduct.description;
    const values = hero.querySelectorAll(".hero-specs__value");
    values[0].textContent = heroProduct.gpuModel;
    values[1].textContent = heroProduct.cpuModel;
    values[2].textContent = heroProduct.memory;
    const storageRow = hero.querySelectorAll(".hero-specs .hero__row")[3];
    storageRow.querySelector(".hero-specs__cooling").textContent = heroProduct.storage;
    hero.querySelector(".hero__price").textContent = shop.formatPrice(heroProduct.price);
    const image = hero.querySelector(".hero__image");
    image.src = heroProduct.id === "cyberpunk-beast" ? "images/pcs/cyberpunk-beast-hero.png" : heroProduct.image;
    image.alt = heroProduct.name;
    shop.setFallbackImage(image, heroProduct.image);
    hero.querySelector(".hero__buy-button").dataset.pcId = heroProduct.id;
  }

  const grid = document.querySelector(".rigs__grid");
  const shown = pcs.filter((item) => item.id !== heroProduct?.id)
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)))
    .slice(0, 3);
  grid.closest(".rigs").hidden = !shown.length;
  const createReadyPcCard = (item) => {
    const createElement = shop.createElement;
    const card = createElement("div", item.featured ? "rig-card--featured" : "rig-card");
    const content = createElement("div", "rig-card__content");
    const picture = createElement("div", "rig-card__picture");
    const image = createElement("img", "rig-card__image");
    image.src = item.image;
    image.alt = item.name;
    image.loading = "lazy";
    shop.setFallbackImage(image, item.fallback);
    const status = createElement("span", item.featured ? "rig-card__badge--featured" : "rig-card__availability");
    status.append(createElement("span", item.featured ? "status-dot--dark" : "status-dot"), document.createTextNode(item.inStock ? (item.featured ? "Флагман" : "В наличии") : "Под заказ"));
    const favorite = createElement("button", "rig-card__favorite");
    favorite.type = "button";
    favorite.dataset.shopAction = "favorite";
    favorite.dataset.pcId = item.id;
    favorite.setAttribute("aria-label", `В избранное: ${item.name}`);
    favorite.setAttribute("aria-pressed", "false");
    favorite.append(createElement("span", "material-symbols-outlined icon-base", "favorite"));
    picture.append(image, status, favorite);
    const heading = createElement("div", "rig-card__heading");
    const title = createElement("h3", "rig-card__title");
    const link = createElement("a", "", item.name);
    link.href = `product.html?id=${encodeURIComponent(item.id)}`;
    title.append(link);
    heading.append(title);
    const specs = createElement("div", "rig-card__specs");
    [["Видеокарта", item.gpuModel], ["Процессор", item.cpuModel], ["Память", item.memory], ["Накопитель", item.storage]].forEach(([label, value], index) => {
      const row = createElement("div", index === 3 ? "rig-card__spec-row--last" : "rig-card__spec-row");
      row.append(createElement("span", "rig-card__spec-label", label), createElement("span", "rig-card__spec-value", value));
      specs.append(row);
    });
    content.append(picture, heading, specs);
    const footer = createElement("div", "rig-card__footer");
    const priceWrap = createElement("div", "");
    priceWrap.append(createElement("span", item.featured ? "rig-card__price--featured" : "rig-card__price", shop.formatPrice(item.price)));
    const buy = createElement("button", item.featured ? "rig-card__buy--featured" : "rig-card__buy");
    buy.type = "button";
    buy.dataset.shopAction = "add";
    buy.dataset.pcId = item.id;
    buy.append(createElement("span", "material-symbols-outlined icon-base", "shopping_cart"), document.createTextNode("В корзину"));
    footer.append(priceWrap, buy);
    card.append(content, footer);
    return card;
  };
  grid.replaceChildren(...shown.map(createReadyPcCard));
  shop.updateShopButtons();
})();
