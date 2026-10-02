// Сборка компьютера из компонентов: выбор, проверка и конфигурация.
(async () => {
  "use strict";
  const builderForm = document.getElementById("builder-form");
  const shop = window.NexusShop;
  if (!builderForm || !shop) return;
  await shop.productsReady;
  const resultPanel = document.getElementById("builder-result");
  const welcomePanel = document.getElementById("builder-welcome");
  const partsById = new Map(window.NEXUS_COMPONENTS.map((item) => [item.id, item]));
  const buildTemplates = [
    { tier: 1, label: "Базовая сборка", ids: ["cpu-r5-7600", "mobo-b650", "ram-ddr5-16", "gpu-rx-7600", "ssd-1tb", "psu-650", "case-air", "cooler-tower"] },
    { tier: 2, label: "Сбалансированная сборка", ids: ["cpu-r7-7700", "mobo-b650", "ram-ddr5-32", "tuf-4070-super", "ssd-2tb", "psu-750", "case-air", "cooler-tower"] },
    { tier: 3, label: "Мощная игровая сборка", ids: ["cpu-r7-7800x3d", "mobo-b650e", "ram-ddr5-32", "msi-4070-ti-super", "ssd-2tb", "psu-850", "case-quiet", "cooler-aio"] },
    { tier: 4, label: "Флагманская сборка", ids: ["cpu-r9-7950x3d", "mobo-b650e", "ram-ddr5-64", "rog-strix-4080-super", "ssd-2tb", "psu-1000", "case-quiet", "cooler-aio"] },
  ];
  const pcLevels = { "streamer-pro": 2, "phantom-ultra": 3, "cyberpunk-beast": 4, "apex-titan": 4 };
  const createElement = (tag, className, text) => shop.createElement(tag, className, text);

  function getUserNeeds(text, selectedResolution) {
    const query = text.toLocaleLowerCase("ru");
    const resolution = /(?:4k|4к|2160)/i.test(query) ? 2160 : /(?:1440|2k|2к|qhd)/i.test(query) ? 1440 : /(?:1080|full\s*hd|fhd)/i.test(query) ? 1080 : selectedResolution;
    const creative = /(?:3d|3д|рендер|blender|cad|нейросет|машинн|моделир)/i.test(query);
    const video = /(?:монтаж|видео|премьер|premiere|after effects|обработк|дизайн|фото|photoshop|illustrator)/i.test(query);
    const streaming = /(?:стрим|трансляц|stream)/i.test(query);
    const gaming = /(?:игр|гейм|gaming|fps|cyberpunk|dota|valorant|counter.strike|cs2|pubg)/i.test(query);
    if (creative) return { label: "3D и сложные рабочие задачи", minTier: Math.max(3, resolution === 2160 ? 4 : 3), cap: 4, type: "creative", resolution };
    if (gaming) return { label: streaming ? "Игры и стриминг" : "Игры", minTier: resolution === 2160 ? 4 : resolution === 1440 || streaming ? 2 : 1, cap: 4, type: streaming ? "stream" : "gaming", resolution };
    if (video) return { label: "Монтаж и творчество", minTier: resolution === 2160 ? 3 : 2, cap: 4, type: "creative", resolution };
    if (streaming) return { label: "Стриминг", minTier: 2, cap: 3, type: "stream", resolution };
    return { label: "Работа и повседневные задачи", minTier: 1, cap: 1, type: "work", resolution };
  }

  function getBuildFromTemplate(base, quiet) {
    const ids = quiet ? base.ids.map((id) => id === "case-air" ? "case-quiet" : id) : [...base.ids];
    const products = ids.map((id) => partsById.get(id));
    if (products.some((item) => !item)) return null;
    return { ...base, ids, products, price: products.reduce((sum, item) => sum + item.price, 0) };
  }

  function createParagraph(text, className = "builder-copy") { return createElement("p", className, text); }
  function createHeading(text) { return createElement("h3", "builder-result__title", text); }
  function createBadge(text) { return createElement("span", "builder-badge", text); }

  function showReadyPc(pc, budget) {
    const section = createElement("section", "builder-result__section");
    section.append(createBadge("ГОТОВЫЙ ПК"), createHeading("Можно взять готовую модель"), createParagraph("Модель подходит по выбранному классу задач и укладывается в бюджет."));
    const grid = createElement("div", "product-grid builder-ready-grid");
    grid.append(shop.createProductCard(pc));
    section.append(grid, createParagraph(`Остаётся от бюджета: ${shop.formatPrice(budget - pc.price)}.`, "builder-result__remainder"));
    return section;
  }

  function showCustomBuild(preset, budget, compromise) {
    const section = createElement("section", "builder-result__section");
    section.append(createBadge("СОБРАТЬ СВОЙ"), createHeading(preset.label));
    section.append(createParagraph(compromise
      ? "Этот вариант укладывается в бюджет, но ниже рекомендуемого класса для выбранной задачи. Для заданного разрешения или нагрузки потребуется увеличить бюджет."
      : "Пример сборки из комплектующих каталога. Все позиции можно добавить в корзину вместе или по отдельности."));
    const summary = createElement("div", "builder-build-summary");
    summary.append(createElement("span", "", "Комплектующие без услуги сборки"), createElement("strong", "", shop.formatPrice(preset.price)));
    section.append(summary, createParagraph(`Остаётся от бюджета: ${shop.formatPrice(budget - preset.price)}.`, "builder-result__remainder"));
    const list = createElement("ul", "builder-parts");
    preset.products.forEach((product) => {
      const row = createElement("li", "builder-part");
      const image = createElement("img", "builder-part__image");
      image.src = product.image;
      image.alt = "";
      shop.setFallbackImage(image, product.fallback);
      const info = createElement("div", "builder-part__info");
      info.append(createElement("span", "builder-part__category", product.category), createElement("strong", "builder-part__name", product.name), createElement("span", "builder-part__specs", product.specs.join(" · ")));
      const actions = createElement("div", "builder-part__actions");
      actions.append(createElement("strong", "builder-part__price", shop.formatPrice(product.price)));
      const add = createElement("button", "builder-part__add", "В корзину");
      add.type = "button";
      add.dataset.shopAction = "add";
      add.dataset.pcId = product.id;
      actions.append(add);
      row.append(image, info, actions);
      list.append(row);
    });
    section.append(list);
    const actionRow = createElement("div", "builder-result__actions");
    const addAll = createElement("button", "product-card__buy", "Добавить всю сборку в корзину");
    addAll.type = "button";
    addAll.dataset.addBuild = preset.ids.join(",");
    const link = createElement("a", "shop-secondary-button", "Каталог комплектующих");
    link.href = "catalog.html";
    actionRow.append(addAll, link);
    section.append(actionRow);
    return section;
  }

  function showRecommendations() {
    builderForm.elements.purpose.setCustomValidity(builderForm.elements.purpose.value.trim().length < 4 ? "Опишите задачу хотя бы четырьмя символами." : "");
    if (!builderForm.reportValidity()) return;
    const budget = Number(builderForm.elements.budget.value);
    if (!Number.isFinite(budget)) return;
    const profile = getUserNeeds(builderForm.elements.purpose.value.trim(), Number(builderForm.elements.resolution.value));
    const quiet = builderForm.elements.priority.value === "quiet";
    const presets = buildTemplates.map((base) => getBuildFromTemplate(base, quiet)).filter(Boolean);
    const affordable = presets.filter((item) => item.price <= budget && item.tier <= profile.cap);
    const suitable = affordable.filter((item) => item.tier >= profile.minTier);
    const priority = builderForm.elements.priority.value;
    const selected = suitable.length
      ? priority === "performance" ? suitable.at(-1) : suitable[0]
      : affordable.at(-1);
    const ready = profile.type === "work" || quiet ? null : window.NEXUS_PCS
      .filter((pc) => pc.inStock && pc.price <= budget && (pcLevels[pc.id] || 1) >= profile.minTier)
      .sort((a, b) => priority === "performance" ? b.price - a.price : a.price - b.price)[0];

    resultPanel.replaceChildren();
    resultPanel.append(createBadge("РЕЗУЛЬТАТ ПОДБОРА"), createHeading(profile.label), createParagraph(`Бюджет: ${shop.formatPrice(budget)} · экран: ${profile.resolution === 2160 ? "4K" : profile.resolution === 1440 ? "QHD" : "Full HD"} · приоритет: ${priority === "quiet" ? "тихая работа" : priority === "performance" ? "производительность" : "баланс"}.`));
    if (ready) resultPanel.append(showReadyPc(ready, budget));
    if (selected) resultPanel.append(showCustomBuild(selected, budget, selected.tier < profile.minTier));
    if (!ready && !selected) {
      const minimum = presets[0]?.price;
      const note = createElement("div", "builder-budget-note");
      note.append(createHeading("Пока нет сборки в этом бюджете"), createParagraph(minimum
        ? `Минимальная полная сборка из текущих комплектующих стоит ${shop.formatPrice(minimum)}. Увеличьте бюджет или посмотрите готовые ПК.`
        : "Для готовой конфигурации не хватает комплектующих. Посмотрите доступные готовые ПК."));
      const link = createElement("a", "shop-secondary-button", "Смотреть готовые ПК");
      link.href = "ready-pcs.html";
      note.append(link);
      resultPanel.append(note);
    } else if (!suitable.length) {
      const target = presets.find((item) => item.tier >= profile.minTier);
      if (target) resultPanel.append(createParagraph(`Для выбранной задачи рекомендуем бюджет от ${shop.formatPrice(target.price)} на сборку из комплектующих.`, "builder-warning"));
    }
    resultPanel.append(createParagraph("Подбор основан на категориях задач и характеристиках в каталоге. Он не измеряет FPS, уровень шума и производительность ваших программ; перед заказом проверьте актуальные цены, наличие и физическую совместимость деталей.", "builder-form__note"));
    welcomePanel.hidden = true;
    resultPanel.hidden = false;
    shop.updateShopButtons();
    resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  builderForm.addEventListener("submit", (event) => { event.preventDefault(); showRecommendations(); });
  builderForm.elements.purpose.addEventListener("input", () => builderForm.elements.purpose.setCustomValidity(""));
  builderForm.addEventListener("reset", () => { resultPanel.hidden = true; welcomePanel.hidden = false; resultPanel.replaceChildren(); });
  document.querySelectorAll("[data-example]").forEach((button) => button.addEventListener("click", () => {
    builderForm.elements.purpose.value = button.dataset.example;
    builderForm.elements.purpose.focus();
  }));
  resultPanel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-build]");
    if (button) shop.addBuildToCart(button.dataset.addBuild.split(","));
  });
})();
