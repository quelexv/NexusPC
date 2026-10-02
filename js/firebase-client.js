// Авторизация и хранение данных пользователей через Firebase.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
  updateProfile, GoogleAuthProvider, signInWithPopup,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs,
  query, where, orderBy, serverTimestamp, writeBatch, collectionGroup,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig, authProviders } from "./firebase-config.js";

const firebaseApp = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
const database = getFirestore(firebaseApp);
const shop = window.NexusShop;
const guestStorageKey = "nexus-pc-shop-v1";
const adminUserId = "Fl9pGUw9HYhpXUBj70X0uu3tf053";
const getPendingStorageKey = (uid) => `nexus-pc-cloud-pending-${uid}`;
let currentUser = null;
let cloudReady = false;
let syncError = null;
let writeQueue = Promise.resolve();
let authEpoch = 0;
let readyResolved = false;
let resolveReady;
const ready = new Promise((resolve) => { resolveReady = resolve; });

function getPendingShopState(uid) {
  try { return JSON.parse(localStorage.getItem(getPendingStorageKey(uid))); }
  catch { return null; }
}

function hasShopItems(state) {
  return Boolean(state?.favorites?.length || state?.cart?.length);
}

function mergeShopStates(remote, guest) {
  const favorites = [...new Set([...(remote?.favorites || []), ...(guest?.favorites || [])])];
  const cart = (remote?.cart || []).map((item) => ({ ...item }));
  for (const item of guest?.cart || []) {
    const existing = cart.find((entry) => entry.id === item.id);
    if (existing) existing.quantity = Math.max(existing.quantity, item.quantity);
    else cart.push({ ...item });
  }
  return { favorites, cart };
}

function updateHeaderUser(user) {
  document.querySelectorAll('[data-path="profil"]').forEach((link) => {
    link.setAttribute("aria-label", user ? `Личный кабинет: ${user.email || user.displayName || "пользователь"}` : "Войти в личный кабинет");
    link.title = user ? "Личный кабинет" : "Войти";
  });
}

async function createProfileIfMissing(user) {
  const ref = doc(database, "users", user.uid);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    await setDoc(ref, {
      name: user.displayName || "",
      email: user.email || "",
      phone: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

async function loadUserShopState(user, epoch) {
  await shop.productsReady;
  if (epoch !== authEpoch) return;
  const stateRef = doc(database, "users", user.uid, "shop", "state");
  const snapshot = await getDoc(stateRef);
  if (epoch !== authEpoch) return;
  const pending = getPendingShopState(user.uid);
  let remote = shop.cleanShopState(pending || (snapshot.exists() ? snapshot.data() : { favorites: [], cart: [] }));
  let merged;
  while (epoch === authEpoch) {
    const guest = shop.readGuestState();
    const guestVersion = JSON.stringify(guest);
    merged = shop.cleanShopState(mergeShopStates(remote, guest));
    if (pending || hasShopItems(guest) || !snapshot.exists()) {
      await setDoc(stateRef, { ...merged, updatedAt: serverTimestamp() });
    }
    if (epoch !== authEpoch) return;
    if (guestVersion === JSON.stringify(shop.readGuestState())) break;
    remote = merged;
  }
  if (epoch !== authEpoch) return;
  cloudReady = true;
  shop.setCloudMode(true);
  shop.setShopState(merged);
  try {
    localStorage.removeItem(guestStorageKey);
    localStorage.removeItem(getPendingStorageKey(user.uid));
  } catch {  }
}

function saveShopState() {
  if (!currentUser || !cloudReady) return;
  const uid = currentUser.uid;
  const value = shop.getState();
  const serialized = JSON.stringify(value);
  try { localStorage.setItem(getPendingStorageKey(uid), serialized); }
  catch {  }
  const saveToCloud = async () => {
    await setDoc(doc(database, "users", uid, "shop", "state"), { ...value, updatedAt: serverTimestamp() });
    try {
      if (localStorage.getItem(getPendingStorageKey(uid)) === serialized) localStorage.removeItem(getPendingStorageKey(uid));
    } catch {  }
    syncError = null;
  };
  writeQueue = writeQueue.catch(() => {}).then(saveToCloud).catch((error) => {
    syncError = error;
    shop.showMessage("Не удалось сохранить корзину или избранное в Firebase. Повторите действие после восстановления связи.");
  });
}

document.addEventListener("nexus:shop-change", (event) => {
  if (event.detail?.source === "local") saveShopState();
});

async function saveProfile({ name, phone }) {
  await ready;
  if (!currentUser) throw new Error("Сначала войдите в аккаунт.");
  const cleanName = String(name || "").trim().slice(0, 100);
  const cleanPhone = String(phone || "").trim().slice(0, 30);
  await updateProfile(currentUser, { displayName: cleanName });
  await setDoc(doc(database, "users", currentUser.uid), {
    name: cleanName, phone: cleanPhone, email: currentUser.email || "", updatedAt: serverTimestamp(),
  }, { merge: true });
}

async function getProfile() {
  await ready;
  if (!currentUser) return null;
  const snapshot = await getDoc(doc(database, "users", currentUser.uid));
  return snapshot.exists() ? snapshot.data() : { name: currentUser.displayName || "", email: currentUser.email || "", phone: "" };
}

async function getOrders() {
  await ready;
  if (!currentUser) return [];
  const snapshot = await getDocs(query(collection(database, "users", currentUser.uid, "orders"), orderBy("date", "desc")));
  return snapshot.docs.map((entry) => entry.data());
}

async function getReviews(productId) {
  await ready;
  const snapshot = await getDocs(query(collection(database, "reviews"), where("productId", "==", productId)));
  return snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}

async function saveReview(productId, rating, text) {
  await ready;
  if (!currentUser) throw new Error("Войдите в аккаунт, чтобы оставить отзыв.");
  const cleanText = String(text || "").trim();
  const cleanRating = Number(rating);
  if (cleanText.length < 10 || cleanText.length > 1000 || !Number.isInteger(cleanRating) || cleanRating < 1 || cleanRating > 5) {
    throw new Error("Поставьте оценку от 1 до 5 и напишите отзыв длиной от 10 до 1000 символов.");
  }
  const uid = currentUser.uid;
  const ref = doc(database, "reviews", `${productId}_${uid}`);
  const author = String(currentUser.displayName || "Покупатель").trim().slice(0, 60) || "Покупатель";
  const existing = await getDoc(ref);
  const fields = { productId, uid, author, rating: cleanRating, text: cleanText, updatedAt: serverTimestamp() };
  if (existing.exists()) await updateDoc(ref, fields);
  else await setDoc(ref, { ...fields, createdAt: serverTimestamp() });
}

async function deleteReview(productId) {
  await ready;
  if (!currentUser) throw new Error("Войдите в аккаунт, чтобы удалить отзыв.");
  await deleteDoc(doc(database, "reviews", `${productId}_${currentUser.uid}`));
}

async function saveOrder(order, nextShopState) {
  await ready;
  if (!currentUser || !cloudReady) throw new Error("Войдите в аккаунт и дождитесь подключения Firebase.");
  await writeQueue;
  const uid = currentUser.uid;
  const total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const batch = writeBatch(database);
  batch.set(doc(database, "users", uid, "orders", order.number), {
    ...order, uid, total, status: "new", createdAt: serverTimestamp(),
  });
  batch.set(doc(database, "users", uid, "shop", "state"), {
    favorites: nextShopState.favorites,
    cart: nextShopState.cart,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  try { localStorage.removeItem(getPendingStorageKey(uid)); } catch {  }
  return order;
}

async function checkAdminAccess() {
  await ready;
  if (currentUser?.uid !== adminUserId) throw new Error("Доступ к админ-панели запрещён.");
}

async function adminGetProducts() {
  await checkAdminAccess();
  const snapshot = await getDocs(collection(database, "catalogProducts"));
  return snapshot.docs.flatMap((entry) => {
    try {
      const item = JSON.parse(entry.data().payload);
      return window.NexusProductCatalog.isValidProduct(item) && item.id === entry.id ? [item] : [];
    } catch { return []; }
  });
}

async function adminSaveProduct(item) {
  await checkAdminAccess();
  if (!window.NexusProductCatalog.isValidProduct(item)) throw new Error("Проверьте поля товара.");
  const payload = JSON.stringify(item);
  if (payload.length > 10000) throw new Error("Описание товара слишком длинное.");
  await setDoc(doc(database, "catalogProducts", item.id), { payload, updatedAt: serverTimestamp() });
}

async function adminDeleteProduct(productId) {
  await checkAdminAccess();
  await deleteDoc(doc(database, "catalogProducts", productId));
}

async function adminGetOrders() {
  await checkAdminAccess();
  const snapshot = await getDocs(collectionGroup(database, "orders"));
  return snapshot.docs.filter((entry) => entry.ref.parent.parent?.path.startsWith("users/"))
    .map((entry) => ({ ...entry.data(), uid: entry.ref.parent.parent.id, id: entry.id }))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

async function adminSetOrderStatus(uid, orderId, status) {
  await checkAdminAccess();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid) || !/^[A-Za-z0-9_-]{1,128}$/.test(orderId)
    || !["new", "processing", "ready", "completed", "cancelled"].includes(status)) {
    throw new Error("Недопустимый заказ или статус.");
  }
  await updateDoc(doc(database, "users", uid, "orders", orderId), { status, updatedAt: serverTimestamp() });
}

async function adminDeleteReview(productId, reviewId) {
  await checkAdminAccess();
  if (!/^[a-z0-9-]{1,80}$/.test(productId) || !/^[A-Za-z0-9_-]{1,128}$/.test(reviewId)) throw new Error("Недопустимый отзыв.");
  await deleteDoc(doc(database, "reviews", `${productId}_${reviewId}`));
}

const accountApi = {
  ready,
  get currentUser() { return currentUser; },
  get syncError() { return syncError; },
  get isAdmin() { return currentUser?.uid === adminUserId; },
  providers: authProviders,
  register: async (email, password, name) => {
    const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    if (name?.trim()) {
      const cleanName = name.trim().slice(0, 100);
      await updateProfile(credential.user, { displayName: cleanName });
      await setDoc(doc(database, "users", credential.user.uid), { name: cleanName, email: credential.user.email || "", phone: "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    }
    return credential.user;
  },
  signIn: async (email, password) => (await signInWithEmailAndPassword(firebaseAuth, email, password)).user,
  signInGoogle: async () => {
    if (!authProviders.google) throw new Error("Вход через Google ещё не включён.");
    return (await signInWithPopup(firebaseAuth, new GoogleAuthProvider())).user;
  },
  resetPassword: (email) => sendPasswordResetEmail(firebaseAuth, email),
  signOut: () => signOut(firebaseAuth),
  saveProfile,
  getProfile,
  getOrders,
  saveOrder,
  getReviews,
  saveReview,
  deleteReview,
  adminGetProducts,
  adminSaveProduct,
  adminDeleteProduct,
  adminGetOrders,
  adminSetOrderStatus,
  adminDeleteReview,
};
window.NexusAccount = accountApi;

onAuthStateChanged(firebaseAuth, async (user) => {
  const epoch = ++authEpoch;
  currentUser = user;
  cloudReady = false;
  syncError = null;
  updateHeaderUser(user);
  try {
    if (user) {
      await loadUserShopState(user, epoch);
      if (epoch !== authEpoch) return;
      await createProfileIfMissing(user);
    } else {
      shop.setCloudMode(false);
      shop.setShopState(shop.readGuestState());
    }
  } catch (error) {
    if (epoch !== authEpoch) return;
    syncError = error;
    shop.setCloudMode(false);
    console.error("Firebase sync failed", error);
  } finally {
    if (epoch !== authEpoch) return;
    if (!readyResolved) { readyResolved = true; resolveReady(user); }
    document.dispatchEvent(new CustomEvent("nexus:auth-state", { detail: { user, error: syncError } }));
  }
}, (error) => {
  syncError = error;
  if (!readyResolved) { readyResolved = true; resolveReady(null); }
  document.dispatchEvent(new CustomEvent("nexus:auth-state", { detail: { user: null, error } }));
});
