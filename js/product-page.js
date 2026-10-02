// Страница товара: характеристики, похожие товары и отзывы.
const shop = window.NexusShop;
await shop.productsReady;
let account = null;
const allProducts = [...window.NEXUS_PCS, ...window.NEXUS_COMPONENTS, ...window.NEXUS_PERIPHERALS];
const productId = new URLSearchParams(location.search).get("id") || "";
const product = allProducts.find((item) => item.id === productId);
const getElement = (id) => document.getElementById(id);
let reviews = [];
let submitting = false;
let reviewsLoaded = false;
let editingOwnReview = false;
let editorUserId = null;

function getCategoryName(item) {
  return item.kind === "peripheral" ? item.category : item.kind === "component" ? item.category || "Видеокарты" : "Готовые ПК";
}

function getCategoryUrl(item) {
  return item.kind === "peripheral" ? "peripherals.html" : item.kind === "component" ? "catalog.html" : "ready-pcs.html";
}

function getSpecLabel(item, index, value) {
  const category = getCategoryName(item);
  const fixed = {
    "Процессоры": ["Сокет", "Количество ядер", "Потребление / технология"],
    "Материнские платы": ["Сокет", "Тип памяти", "Интерфейсы"],
    "Оперативная память": ["Объём", "Тип памяти", "Частота"],
    "Накопители": ["Объём", "Интерфейс", "Версия интерфейса"],
    "Блоки питания": ["Мощность", "Сертификация", "Стандарт"],
    "Корпуса": ["Форм-фактор", "Особенность", "Охлаждение"],
    "Охлаждение": ["Совместимость", "Тип", "Вентиляторы"],
    "Гарнитуры": ["Подключение", "Динамики", "Автономность"],
    "Мониторы": ["Диагональ", "Разрешение и матрица", "Частота обновления"],
  };
  if (category === "Видеокарты") {
    if (/(?:GB|ГБ)/i.test(value)) return "Видеопамять";
    if (/(?:MHz|МГц)/i.test(value)) return "Частота";
    if (/\bbit\b/i.test(value)) return "Шина памяти";
    if (/(?:Вт|\d+W\b|Max)/i.test(value)) return "Потребление";
    if (/1080p|1440p|4K/i.test(value)) return "Разрешение для игр";
    return `Особенность ${index + 1}`;
  }
  if (category === "Клавиатуры") return ["Тип клавиш", "Формат", index === 2 && value === "RGB" ? "Подсветка" : "Подключение"][index] || `Параметр ${index + 1}`;
  if (category === "Мыши") return ["Подключение", "Чувствительность", /кноп/.test(value) ? "Кнопки" : "Вес"][index] || `Параметр ${index + 1}`;
  return fixed[category]?.[index] || `Параметр ${index + 1}`;
}

function getProductSpecs(item) {
  const delivery = item.express ? [["Доставка", "Экспресс-доставка"]] : [];
  if (typeof item.deliveryTime === "string" && item.deliveryTime.trim())
    delivery.push(["Срок доставки", item.deliveryTime.trim()]); 
  if (!item.kind) return [
    ["Тип товара", "Готовый ПК"], ["Процессор", item.cpuModel], ["Линейка процессора", item.cpu],
    ["Видеокарта", item.gpuModel], ["Серия видеокарты", item.gpu],
    ["Оперативная память", item.memory], ["Объём памяти", `${item.ram} ГБ`],
    ["Накопитель", item.storage], ...delivery, ["Наличие", item.inStock ? "В наличии" : "Под заказ"],
  ];
  return [
    ["Категория", getCategoryName(item)], ["Бренд", item.brand || item.name.split(" ")[0]],
    ...(item.specs || []).map((value, index) => [getSpecLabel(item, index, value), value]),
    ...delivery, ["Наличие", item.inStock === false ? "Под заказ" : "В наличии"],
  ];
}

function addSpecRow(label, value) {
  const row = shop.createElement("div", "product-detail__spec-row");
  row.append(shop.createElement("dt", "", label), shop.createElement("dd", "", value));
  getElement("product-specs").append(row);
}

function createStarsText(value) {
  const rounded = Math.round(value);
  return "★".repeat(rounded) + "☆".repeat(5 - rounded);
}

function formatReviewDate(review) {
  const date = review.updatedAt?.toDate?.() || review.createdAt?.toDate?.();
  return date instanceof Date && !Number.isNaN(date.valueOf()) ? date.toLocaleDateString("ru-RU") : "";
}

function createReviewCard(review) {
  const article = shop.createElement("article", "product-detail__review");
  const heading = shop.createElement("div", "product-detail__review-top");
  heading.append(shop.createElement("strong", "", review.author || "Покупатель"));
  heading.append(shop.createElement("time", "", formatReviewDate(review)));
  if (account.currentUser?.uid === review.uid) {
    const editButton = shop.createElement("button", "product-detail__review-edit", "Изменить");
    editButton.type = "button";
    editButton.setAttribute("aria-controls", "product-review-editor");
    editButton.setAttribute("aria-expanded", String(editingOwnReview));
    editButton.addEventListener("click", () => {
      editingOwnReview = true;
      showReviewForm();
      editButton.setAttribute("aria-expanded", "true");
      getElement("product-review-form-title").focus();
    });
    heading.append(editButton);
  }
  article.append(heading, shop.createElement("span", "product-detail__stars", createStarsText(review.rating)), shop.createElement("p", "", review.text));
  return article;
}

function showReviewMessage(message, error = false) {
  const messageElement = getElement("product-review-message");
  messageElement.textContent = message;
  messageElement.hidden = !message;
  messageElement.classList.toggle("is-error", error);
}

function getReviewErrorMessage(error) {
  if (error?.code === "permission-denied") return "Firestore отклонил операцию с коллекцией reviews. Проверьте опубликованные правила базы (default) и настройки App Check.";
  if (error?.code === "unavailable") return "Нет связи с Firestore. Проверьте интернет и попробуйте позже.";
  return error?.message || "Не удалось выполнить действие. Попробуйте ещё раз.";
}

function updateReviewUser() {
  const user = account.currentUser;
  if (editorUserId !== (user?.uid || null)) {
    editorUserId = user?.uid || null;
    editingOwnReview = false;
  }
}

function showReviewForm() {
  updateReviewUser();
  const user = account.currentUser;
  const own = user && reviews.find((item) => item.uid === user.uid);
  if (!own) editingOwnReview = false;
  getElement("product-review-editor").hidden = !user || !reviewsLoaded || Boolean(own && !editingOwnReview);
  getElement("product-review-login").hidden = Boolean(user);
  if (!user) return;
  const form = getElement("product-review-form");
  form.elements.rating.value = own ? String(own.rating) : "";
  updateRating();
  form.elements.text.value = own?.text || "";
  getElement("product-review-form-title").textContent = own ? "Изменить свой отзыв" : "Оставить отзыв";
  getElement("product-review-submit").textContent = own ? "Сохранить изменения" : "Опубликовать отзыв";
  getElement("product-review-delete").hidden = !own;
  getElement("product-review-cancel").hidden = !own;
}

function updateRating() {
  const rating = Number(getElement("product-review-form").elements.rating.value);
  getElement("product-rating-choice").textContent = rating ? `${rating} из 5 звёзд` : "Выберите от 1 до 5 звёзд";
}

function showReviews() {
  updateReviewUser();
  const count = reviews.length;
  const average = count ? reviews.reduce((sum, item) => sum + item.rating, 0) / count : 0;
  getElement("product-review-average").textContent = count ? average.toFixed(1).replace(".", ",") : "—";
  getElement("product-review-stars").textContent = count ? createStarsText(average) : "☆☆☆☆☆";
  getElement("product-rating-stars").textContent = count ? createStarsText(average) : "☆☆☆☆☆";
  getElement("product-review-count").textContent = count ? `${count} настоящих отзывов` : "Настоящих отзывов пока нет";
  getElement("product-rating-text").textContent = count ? `${average.toFixed(1).replace(".", ",")} · ${count} отзывов` : "Пока без оценок";
  const list = getElement("product-review-list");
  list.replaceChildren(...reviews.map((item) => createReviewCard(item)));
  showReviewForm();
}

async function loadReviews() {
  try {
    reviews = await account.getReviews(productId);
    reviewsLoaded = true;
    showReviews();
    showReviewMessage(reviews.length ? "" : "Будьте первым, кто оставит отзыв об этом товаре.");
  } catch (error) {
    reviewsLoaded = true;
    showReviews();
    showReviewMessage(getReviewErrorMessage(error), true);
  }
}

function showProduct() {
  if (!product) {
    getElement("product-status").hidden = true;
    getElement("product-not-found").hidden = false;
    return;
  }
  document.title = `${product.name} — NEXUS PC`;
  const category = getCategoryName(product);
  getElement("product-category-link").textContent = category;
  getElement("product-category-link").href = getCategoryUrl(product);
  getElement("product-breadcrumb").textContent = product.name;
  getElement("product-title").textContent = product.name;
  getElement("product-category").textContent = category.toUpperCase();
  const description = String(product.description || "").trim();
  const descriptionElement = getElement("product-description");
  descriptionElement.hidden = !description || (product.kind === "component" && description.toLocaleLowerCase("ru") === "видеокарта");
  descriptionElement.textContent = descriptionElement.hidden ? "" : description;
  getElement("product-image").src = product.image;
  getElement("product-image").alt = product.name;
  shop.setFallbackImage(getElement("product-image"), product.fallback || (product.image.startsWith("https://") ? "images/gpu-card.svg" : null));
  getElement("product-image-caption").textContent = category.toUpperCase();
  getElement("product-stock").textContent = product.inStock === false ? "ПОД ЗАКАЗ" : "В НАЛИЧИИ";
  getElement("product-stock").classList.toggle("is-order", product.inStock === false);
  getElement("product-price").textContent = shop.formatPrice(product.price);
  for (const [label, value] of getProductSpecs(product)) addSpecRow(label, value);
  const highlights = product.kind ? product.specs || [] : [product.cpuModel, product.gpuModel, product.memory, product.storage];
  const highlightNodes = highlights.map((value) => shop.createElement("span", "", value));
  if (product.express) highlightNodes.push(shop.createElement("span", "product-detail__highlight--express", "Экспресс-доставка"));
  getElement("product-highlights").replaceChildren(...highlightNodes);
  for (const id of ["product-add", "product-favorite"]) getElement(id).dataset.pcId = product.id;
  shop.updateShopButtons();
  const related = allProducts.filter((item) => item.id !== product.id && item.kind === product.kind && (item.category || "Видеокарты") === (product.category || "Видеокарты"));
  if (related.length < 3) related.push(...allProducts.filter((item) => item.id !== product.id && item.kind === product.kind && !related.includes(item)));
  getElement("product-related").replaceChildren(...related.slice(0, 3).map(shop.createProductCard));
  getElement("product-related-section").hidden = !related.length;
  getElement("product-review-login-link").href = `account.html?return=${encodeURIComponent(`product.html?id=${product.id}`)}`;
  getElement("product-status").hidden = true;
  getElement("product-content").hidden = false;
}

showProduct();
if (product) {
  try {
    await import("./firebase-client.js");
    account = window.NexusAccount;
    if (!account) throw new Error("Firebase account module is unavailable");
    document.addEventListener("nexus:auth-state", showReviews);
    account.ready.then(showReviews);
    loadReviews();
    getElement("product-review-form").addEventListener("change", (event) => {
      if (event.target.name === "rating") updateRating();
    });
    getElement("product-review-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submitting) return;
      const form = event.currentTarget;
      submitting = true;
      getElement("product-review-submit").disabled = true;
      showReviewMessage("Сохраняем отзыв…");
      try {
        await account.saveReview(productId, form.elements.rating.value, form.elements.text.value);
        editingOwnReview = false;
        await loadReviews();
        showReviewMessage("Отзыв сохранён в Firebase.");
      } catch (error) { showReviewMessage(getReviewErrorMessage(error), true); }
      finally { submitting = false; getElement("product-review-submit").disabled = false; }
    });
    getElement("product-review-cancel").addEventListener("click", () => {
      editingOwnReview = false;
      showReviews();
      getElement("product-review-list").querySelector(".product-detail__review-edit")?.focus();
    });
    getElement("product-review-delete").addEventListener("click", async () => {
      if (submitting || !confirm("Удалить ваш отзыв об этом товаре?")) return;
      submitting = true;
      getElement("product-review-delete").disabled = true;
      try {
        await account.deleteReview(productId);
        editingOwnReview = false;
        await loadReviews();
        showReviewMessage("Отзыв удалён.");
      } catch (error) { showReviewMessage(getReviewErrorMessage(error), true); }
      finally { submitting = false; getElement("product-review-delete").disabled = false; }
    });
  } catch (error) {
    console.error("Reviews are unavailable:", error);
    getElement("product-review-login").hidden = true;
    showReviewMessage("Отзывы временно недоступны. Проверьте подключение к интернету и обновите страницу.", true);
  }
}
