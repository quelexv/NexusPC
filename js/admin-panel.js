// Панель администратора: управление товарами, отзывами и заказами.
import "./firebase-client.js";

const account = window.NexusAccount;
const shop = window.NexusShop;
const productCatalog = window.NexusProductCatalog;
const getElement = (id) => document.getElementById(id);
const accessMessage = getElement("admin-access");
const adminPanel = getElement("admin-panel");
const toggleButton = getElement("admin-toggle");
const productForm = getElement("admin-product-form");
const adminMessage = getElement("admin-message");
const productStatusMessage = getElement("admin-product-message");
const statusLabels = { new: "Новый", processing: "В обработке", ready: "Готов к выдаче", completed: "Завершён", cancelled: "Отменён" };
const adminViewStorageKey = "nexus-admin-view-v1";
const adminTabs = ["products", "reviews", "orders"];
function loadAdminView() {
  try {
    const value = JSON.parse(sessionStorage.getItem(adminViewStorageKey));
    return { open: value?.open === true, tab: adminTabs.includes(value?.tab) ? value.tab : "products" };
  } catch { return { open: false, tab: "products" }; }
}
let savedView = loadAdminView();
let managedProducts = [];
let activeTab = savedView.tab;
let viewEpoch = 0;

function saveAdminView(open) {
  savedView = { open, tab: activeTab };
  try { sessionStorage.setItem(adminViewStorageKey, JSON.stringify(savedView)); }
  catch {  }
}

function showAdminMessage(value, error = false) {
  adminMessage.textContent = value;
  adminMessage.classList.toggle("is-error", error);
}

function showProductMessage(value, error = false) {
  showAdminMessage(value, error);
  productStatusMessage.textContent = value;
  productStatusMessage.classList.toggle("is-error", error);
}

function getErrorMessage(error) {
  if (error?.code === "permission-denied") return "Доступ запрещён. Опубликуйте обновлённые правила Firestore и проверьте UID аккаунта.";
  return error?.message || "Не удалось выполнить действие.";
}

function createElement(tag, className, value) {
  const createdElement = document.createElement(tag);
  if (className) createdElement.className = className;
  if (value !== undefined) createdElement.textContent = value;
  return createdElement;
}

function showProductOptions() {
  const select = getElement("admin-review-product");
  const previous = select.value;
  const products = [...window.NEXUS_PCS, ...window.NEXUS_COMPONENTS, ...window.NEXUS_PERIPHERALS, ...managedProducts]
    .filter((item, index, all) => all.findIndex((entry) => entry.id === item.id) === index)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  select.replaceChildren(...products.map((item) => {
    const option = createElement("option", "", item.name);
    option.value = item.id;
    return option;
  }));
  if (products.some((item) => item.id === previous)) select.value = previous;
}

function updateProductFields() {
  const pc = productForm.elements.kind.value === "pc";
  const pcFields = getElement("admin-pc-fields");
  const otherFields = getElement("admin-other-fields");
  pcFields.hidden = !pc;
  otherFields.hidden = pc;
  for (const field of pcFields.querySelectorAll("input, select, textarea")) field.disabled = !pc;
  for (const field of otherFields.querySelectorAll("input, select, textarea")) field.disabled = pc;
  getElement("admin-featured-label").hidden = !pc;
  productForm.elements.featured.disabled = !pc;
  for (const name of ["cpu", "cpuModel", "gpu", "gpuModel", "ram", "memory", "storage"]) productForm.elements[name].required = pc;
  for (const name of ["category", "brand", "specs"]) productForm.elements[name].required = !pc;
}

function getProductFormData() {
  const getFormValue = (name) => String(productForm.elements[name].value || "").trim();
  const kind = getFormValue("kind");
  const item = {
    id: getFormValue("id"), kind, name: getFormValue("name"), price: Number(getFormValue("price")),
    image: getFormValue("image"), description: getFormValue("description"),
    inStock: productForm.elements.inStock.checked, express: productForm.elements.express.checked,
  };
  if (kind === "pc") Object.assign(item, {
    cpu: getFormValue("cpu"), cpuModel: getFormValue("cpuModel"), gpu: getFormValue("gpu"), gpuModel: getFormValue("gpuModel"),
    ram: Number(getFormValue("ram")), memory: getFormValue("memory"), storage: getFormValue("storage"),
    featured: productForm.elements.featured.checked,
  });
  else Object.assign(item, {
    category: getFormValue("category"), brand: getFormValue("brand"),
    specs: getFormValue("specs").split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
  });
  if (kind === "component" && getFormValue("memoryGb")) item.memoryGb = Number(getFormValue("memoryGb"));
  return item;
}

function fillProductForm(item) {
  productForm.reset();
  for (const [name, value] of Object.entries(item)) {
    const field = productForm.elements[name];
    if (!field) continue;
    if (field.type === "checkbox") field.checked = Boolean(value);
    else field.value = Array.isArray(value) ? value.join("\n") : value;
  }
  productForm.elements.id.readOnly = true;
  updateProductFields();
  productForm.scrollIntoView({ behavior: "smooth", block: "start" });
  productForm.elements.name.focus();
}

async function loadProducts() {
  const epoch = viewEpoch;
  const list = getElement("admin-product-list");
  list.replaceChildren(createElement("p", "admin-panel__empty", "Загружаем товары…"));
  try {
    managedProducts = await account.adminGetProducts();
    if (epoch !== viewEpoch || !account.isAdmin) return;
    managedProducts.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    list.replaceChildren();
    if (!managedProducts.length) list.append(createElement("p", "admin-panel__empty", "Товаров в Firebase пока нет."));
    for (const item of managedProducts) {
      const card = createElement("article", "admin-panel__item");
      const details = createElement("div", "admin-panel__item-main");
      details.append(createElement("strong", "", item.name), createElement("span", "", `${item.id} · ${shop.formatPrice(item.price)}`));
      const actions = createElement("div", "admin-panel__item-actions");
      const edit = createElement("button", "shop-secondary-button", "Изменить");
      edit.type = "button";
      edit.addEventListener("click", () => fillProductForm(item));
      const remove = createElement("button", "admin-panel__danger", "Удалить");
      remove.type = "button";
      remove.addEventListener("click", async () => {
        if (!confirm(`Удалить товар «${item.name}»?`)) return;
        remove.disabled = true;
        try {
          await account.adminDeleteProduct(item.id);
          showAdminMessage("Товар удалён. Он исчезнет из каталога после обновления страницы.");
          await loadProducts();
          showProductOptions();
        } catch (error) { showAdminMessage(getErrorMessage(error), true); remove.disabled = false; }
      });
      actions.append(edit, remove);
      card.append(details, actions);
      list.append(card);
    }
    showProductOptions();
  } catch (error) { if (epoch === viewEpoch && account.isAdmin) list.replaceChildren(createElement("p", "admin-panel__empty", getErrorMessage(error))); }
}

async function loadReviews() {
  const epoch = viewEpoch;
  const productId = getElement("admin-review-product").value;
  const list = getElement("admin-review-list");
  list.replaceChildren(createElement("p", "admin-panel__empty", "Загружаем отзывы…"));
  if (!productId) { list.replaceChildren(createElement("p", "admin-panel__empty", "Товары не найдены.")); return; }
  try {
    const reviews = await account.getReviews(productId);
    if (epoch !== viewEpoch || !account.isAdmin || getElement("admin-review-product").value !== productId) return;
    list.replaceChildren();
    if (!reviews.length) list.append(createElement("p", "admin-panel__empty", "У этого товара пока нет отзывов."));
    for (const review of reviews) {
      const card = createElement("article", "admin-panel__item");
      const details = createElement("div", "admin-panel__item-main");
      details.append(createElement("strong", "", `${review.author || "Покупатель"} · ${"★".repeat(Math.max(0, Math.min(5, review.rating || 0)))}`), createElement("p", "", review.text || ""));
      const remove = createElement("button", "admin-panel__danger", "Удалить отзыв");
      remove.type = "button";
      remove.addEventListener("click", async () => {
        if (!confirm("Удалить этот отзыв без возможности восстановления?")) return;
        remove.disabled = true;
        try { await account.adminDeleteReview(productId, review.uid); showAdminMessage("Отзыв удалён."); await loadReviews(); }
        catch (error) { showAdminMessage(getErrorMessage(error), true); remove.disabled = false; }
      });
      card.append(details, remove);
      list.append(card);
    }
  } catch (error) { if (epoch === viewEpoch && account.isAdmin) list.replaceChildren(createElement("p", "admin-panel__empty", getErrorMessage(error))); }
}

async function loadOrders() {
  const epoch = viewEpoch;
  const list = getElement("admin-order-list");
  list.replaceChildren(createElement("p", "admin-panel__empty", "Загружаем заказы…"));
  try {
    const orders = await account.adminGetOrders();
    if (epoch !== viewEpoch || !account.isAdmin) return;
    list.replaceChildren();
    if (!orders.length) list.append(createElement("p", "admin-panel__empty", "Заказов пока нет."));
    for (const order of orders) {
      const card = createElement("article", "admin-panel__item admin-panel__order");
      const details = createElement("div", "admin-panel__item-main");
      details.append(createElement("strong", "", `№ ${order.number || order.id} · ${shop.formatPrice(order.total || 0)}`));
      details.append(createElement("span", "", `${order.customer || "Клиент"} · ${order.phone || ""} · ${order.email || ""}`));
      details.append(createElement("span", "", `${order.date ? new Date(order.date).toLocaleString("ru-RU") : ""} · ${order.delivery || ""} ${order.address || ""}`));
      details.append(createElement("p", "", (order.items || []).map((item) => `${item.name || item.id} × ${item.quantity}`).join(" · ")));
      if (order.comment) details.append(createElement("p", "", `Комментарий: ${order.comment}`));
      const status = createElement("select", "admin-panel__status");
      status.setAttribute("aria-label", `Статус заказа ${order.number || order.id}`);
      for (const [value, label] of Object.entries(statusLabels)) {
        const option = createElement("option", "", label);
        option.value = value;
        status.append(option);
      }
      status.value = order.status || "new";
      status.addEventListener("change", async () => {
        const previous = order.status || "new";
        status.disabled = true;
        try {
          await account.adminSetOrderStatus(order.uid, order.id, status.value);
          order.status = status.value;
          showAdminMessage(`Статус заказа № ${order.number || order.id} сохранён.`);
        } catch (error) { status.value = previous; showAdminMessage(getErrorMessage(error), true); }
        finally { status.disabled = false; }
      });
      card.append(details, status);
      list.append(card);
    }
  } catch (error) { if (epoch === viewEpoch && account.isAdmin) list.replaceChildren(createElement("p", "admin-panel__empty", getErrorMessage(error))); }
}

function showAdminTab(name, persist = true) {
  activeTab = name;
  if (persist) saveAdminView(!adminPanel.hidden);
  for (const tab of adminPanel.querySelectorAll("[data-admin-tab]")) {
    const selected = tab.dataset.adminTab === name;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
  }
  for (const section of ["products", "reviews", "orders"]) getElement(`admin-${section}`).hidden = section !== name;
  if (name === "reviews") loadReviews();
  if (name === "orders") loadOrders();
}

async function setAdminPanelOpen(expanded) {
  adminPanel.hidden = !expanded;
  toggleButton.setAttribute("aria-expanded", String(expanded));
  toggleButton.textContent = expanded ? "Выключить админку" : "Включить админку";
  saveAdminView(expanded);
  if (!expanded) { viewEpoch++; return; }
  showAdminMessage("");
  const epoch = ++viewEpoch;
  await shop.productsReady;
  if (epoch !== viewEpoch || !account.isAdmin || adminPanel.hidden) return;
  await loadProducts();
  if (activeTab !== "products") showAdminTab(activeTab);
}

function updateAdminAccess() {
  const authorized = account.isAdmin;
  accessMessage.hidden = !authorized;
  if (authorized) {
    if (savedView.open && adminPanel.hidden) void setAdminPanelOpen(true);
  } else {
    adminPanel.hidden = true;
    toggleButton.setAttribute("aria-expanded", "false");
    toggleButton.textContent = "Включить админку";
    showAdminTab("products", false);
    savedView = { open: false, tab: activeTab };
    try { sessionStorage.removeItem(adminViewStorageKey); }
    catch {  }
    managedProducts = [];
    for (const id of ["admin-product-list", "admin-review-list", "admin-order-list", "admin-review-product"]) getElement(id).replaceChildren();
    productForm.reset();
    productForm.elements.id.readOnly = false;
    updateProductFields();
    showAdminMessage("");
    productStatusMessage.textContent = "";
    productStatusMessage.classList.remove("is-error");
    viewEpoch++;
  }
}

toggleButton.addEventListener("click", async () => {
  if (!account.isAdmin) return;
  await setAdminPanelOpen(adminPanel.hidden);
});

for (const tab of adminPanel.querySelectorAll("[data-admin-tab]")) tab.addEventListener("click", () => showAdminTab(tab.dataset.adminTab));
productForm.elements.kind.addEventListener("change", updateProductFields);
getElement("admin-product-reset").addEventListener("click", () => {
  productForm.reset(); productForm.elements.id.readOnly = false; updateProductFields();
  productStatusMessage.textContent = "";
  productStatusMessage.classList.remove("is-error");
});
productForm.addEventListener("invalid", (event) => {
  const label = event.target.closest("label")?.childNodes[0]?.textContent?.trim() || event.target.name;
  showProductMessage(`Проверьте поле «${label}».`, true);
}, true);
productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!account.isAdmin) { showProductMessage("Войдите как администратор.", true); return; }
  const button = productForm.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const item = getProductFormData();
    if (!productCatalog.isValidProduct(item)) throw new Error("Проверьте характеристики, цену и ссылку на изображение.");
    showProductMessage("Сохраняем товар…");
    await account.adminSaveProduct(item);
    showProductMessage("Товар сохранён. Он появится в каталоге после обновления страницы.");
    productForm.reset(); productForm.elements.id.readOnly = false; updateProductFields();
    await loadProducts();
  } catch (error) { showProductMessage(getErrorMessage(error), true); }
  finally { button.disabled = false; }
});
getElement("admin-review-product").addEventListener("change", loadReviews);
getElement("admin-orders-refresh").addEventListener("click", loadOrders);
document.addEventListener("nexus:auth-state", updateAdminAccess);
account.ready.then(updateAdminAccess);
updateProductFields();
