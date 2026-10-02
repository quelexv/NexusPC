// Личный кабинет: профиль, авторизация, заказы и избранное.
import "./firebase-client.js";

const account = window.NexusAccount;
const shop = window.NexusShop;
await shop.productsReady;
const accountStatus = document.getElementById("account-status");
const authSection = document.getElementById("account-auth");
const dashboard = document.getElementById("account-dashboard");
const authErrorMessage = document.getElementById("account-auth-error");
const loginPanel = document.getElementById("account-login-panel");
const registerPanel = document.getElementById("account-register-panel");
const loginTab = document.getElementById("account-tab-login");
const registerTab = document.getElementById("account-tab-register");
const profileForm = document.getElementById("account-profile-form");
const requestedPage = new URLSearchParams(location.search).get("return") || "";
const returnPage = requestedPage === "cart.html" || /^product\.html\?id=[a-z0-9-]+$/.test(requestedPage) ? requestedPage : null;
const productNames = new Map([
  ...window.NEXUS_PCS, ...window.NEXUS_COMPONENTS, ...window.NEXUS_PERIPHERALS,
].map((item) => [item.id, item.name]));

function getAuthErrorMessage(error) {
  const errors = {
    "auth/invalid-email": "Проверьте адрес электронной почты.",
    "auth/invalid-credential": "Неверный email или пароль.",
    "auth/operation-not-allowed": "Включите Email/Password в Firebase Authentication → Sign-in method.",
    "auth/configuration-not-found": "Включите Firebase Authentication в консоли проекта.",
    "auth/email-already-in-use": "Этот email уже зарегистрирован. Войдите в аккаунт.",
    "auth/weak-password": "Пароль слишком короткий или простой.",
    "auth/network-request-failed": "Нет связи с Firebase. Проверьте интернет-соединение.",
    "auth/too-many-requests": "Слишком много попыток входа. Попробуйте позже.",
    "auth/unauthorized-domain": "Домен сайта не добавлен в разрешённые домены Firebase Authentication.",
    "auth/popup-blocked": "Браузер заблокировал окно входа через Google.",
    "permission-denied": "Доступ к Firestore запрещён. Проверьте правила базы данных.",
    "unavailable": "Firestore сейчас недоступен. Проверьте соединение и попробуйте ещё раз.",
  };
  return errors[error?.code] || error?.message || "Не удалось выполнить действие. Попробуйте ещё раз.";
}

function showAccountStatus(text, bad = false) {
  accountStatus.textContent = text;
  accountStatus.classList.toggle("is-error", bad);
  accountStatus.hidden = !text;
}

function showAuthError(error) {
  authErrorMessage.textContent = getAuthErrorMessage(error);
  authErrorMessage.hidden = false;
}

function showAuthTab(register) {
  loginTab.classList.toggle("is-active", !register);
  registerTab.classList.toggle("is-active", register);
  loginTab.setAttribute("aria-selected", String(!register));
  registerTab.setAttribute("aria-selected", String(register));
  loginPanel.hidden = register;
  registerPanel.hidden = !register;
  authErrorMessage.hidden = true;
}
loginTab.addEventListener("click", () => showAuthTab(false));
registerTab.addEventListener("click", () => showAuthTab(true));

async function submitAuthForm(form, run) {
  authErrorMessage.hidden = true;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try { await run(); }
  catch (error) { showAuthError(error); }
  finally { button.disabled = false; }
}

document.getElementById("account-login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  submitAuthForm(form, () => account.signIn(form.elements.email.value.trim(), form.elements.password.value));
});
document.getElementById("account-register-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  submitAuthForm(form, () => account.register(form.elements.email.value.trim(), form.elements.password.value, form.elements.name.value.trim()));
});
document.getElementById("account-reset-password").addEventListener("click", async () => {
  const email = document.getElementById("account-login-form").elements.email.value.trim();
  if (!email) { showAuthError(new Error("Сначала введите email в форме входа.")); return; }
  try {
    await account.resetPassword(email);
    authErrorMessage.hidden = true;
    showAccountStatus("Если адрес зарегистрирован, письмо для сброса пароля отправлено.");
  } catch (error) { showAuthError(error); }
});
document.getElementById("account-google").hidden = !account.providers.google;
document.getElementById("account-google").addEventListener("click", async () => {
  try { await account.signInGoogle(); }
  catch (error) { showAuthError(error); }
});
document.getElementById("account-signout").addEventListener("click", async () => {
  try { await account.signOut(); showAccountStatus("Вы вышли из аккаунта."); }
  catch (error) { showAccountStatus(getAuthErrorMessage(error), true); }
});
profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = profileForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await account.saveProfile({ name: profileForm.elements.name.value, phone: profileForm.elements.phone.value });
    document.getElementById("account-greeting").textContent = `Здравствуйте, ${profileForm.elements.name.value.trim()}`;
    showAccountStatus("Профиль сохранён в Firebase.");
  } catch (error) { showAccountStatus(getAuthErrorMessage(error), true); }
  finally { button.disabled = false; }
});

function showSavedCounts() {
  const state = shop.getState();
  document.getElementById("account-favorites-count").textContent = String(state.favorites.length);
  document.getElementById("account-cart-count").textContent = String(state.cart.reduce((sum, item) => sum + item.quantity, 0));
}
document.addEventListener("nexus:shop-change", showSavedCounts);

function showOrders(orders) {
  const list = document.getElementById("account-orders-list");
  list.replaceChildren();
  document.getElementById("account-orders-empty").hidden = orders.length !== 0;
  for (const order of orders) {
    const article = shop.createElement("article", "account-order");
    const top = shop.createElement("div", "account-order__top");
    const statusLabels = { new: "Новый", processing: "В обработке", ready: "Готов к выдаче", completed: "Завершён", cancelled: "Отменён" };
    top.append(shop.createElement("strong", "", `№ ${order.number}`), shop.createElement("span", "", statusLabels[order.status] || "Новый"), shop.createElement("span", "", new Date(order.date).toLocaleDateString("ru-RU")));
    article.append(top);
    const details = shop.createElement("p", "account-order__items", order.items.map((item) => `${item.name || productNames.get(item.id) || item.id} × ${item.quantity}`).join(" · "));
    const total = shop.createElement("strong", "account-order__total", shop.formatPrice(order.total ?? order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)));
    article.append(details, total);
    list.append(article);
  }
}

async function showAccount(event) {
  const user = event.detail?.user ?? account.currentUser;
  if (!user) {
    authSection.hidden = false;
    dashboard.hidden = true;
    if (event.detail?.error) showAccountStatus(getAuthErrorMessage(event.detail.error), true);
    else if (!accountStatus.textContent || accountStatus.textContent === "Подключаем Firebase…") showAccountStatus("");
    return;
  }
  if (returnPage && !event.detail?.error) { location.href = returnPage; return; }
  authSection.hidden = true;
  dashboard.hidden = false;
  document.getElementById("account-email").textContent = user.email || "";
  document.getElementById("account-greeting").textContent = user.displayName ? `Здравствуйте, ${user.displayName}` : "Ваш профиль";
  profileForm.elements.email.value = user.email || "";
  showSavedCounts();
  if (event.detail?.error) showAccountStatus(getAuthErrorMessage(event.detail.error), true);
  else showAccountStatus("");
  try {
    const [profile, orders] = await Promise.all([account.getProfile(), account.getOrders()]);
    profileForm.elements.name.value = profile?.name || user.displayName || "";
    profileForm.elements.phone.value = profile?.phone || "";
    showOrders(orders);
  } catch (error) { showAccountStatus(getAuthErrorMessage(error), true); }
}
document.addEventListener("nexus:auth-state", showAccount);
account.ready.then(() => {
  if (authSection.hidden && dashboard.hidden) showAccount({ detail: { user: account.currentUser, error: account.syncError } });
});
