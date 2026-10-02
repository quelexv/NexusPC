// Страницы корзины и избранного, оформление заказа.
(async () => {
  "use strict";

  const shopPageType = document.body.dataset.shopPage;
  const shop = window.NexusShop;
  if (!shop || !["favorites", "cart"].includes(shopPageType)) return;
  await shop.productsReady;
  const { createElement, formatPrice } = shop;
  const productsById = new Map(
    [...window.NEXUS_PCS, ...window.NEXUS_COMPONENTS, ...window.NEXUS_PERIPHERALS].map((product) => [
      product.id,
      product,
    ]),
  );
  const itemCount = document.getElementById("shop-page-count");
  const emptyMessage = document.getElementById("shop-page-empty");
  const productList = document.getElementById(
    shopPageType === "favorites" ? "favorites-grid" : "cart-list",
  );
  const sortInput = document.getElementById("favorites-sort");
  const favoritesSearch = document.getElementById("favorites-search");
  const favoritesCategory = document.getElementById("favorites-category");
  const checkoutDialog = document.getElementById("checkout-dialog");
  const form = document.getElementById("checkout-form");
  let latestOrder = null;

  function createActionButton(label, action, product, className = "shop-text-button") {
    const actionButton = createElement("button", className, label);
    actionButton.type = "button";
    actionButton.dataset.shopAction = action;
    actionButton.dataset.pcId = product.id;
    return actionButton;
  }

  function createProductName(product) {
    const heading = createElement("h3", "shop-item__name");
    const link = createElement("a", "shop-item__name-link", product.name);
    link.href = `product.html?id=${encodeURIComponent(product.id)}`;
    heading.append(link);
    return heading;
  }

  function createCartRow(item) {
    const product = productsById.get(item.id);
    const row = createElement("article", "shop-item cart-item");
    row.dataset.productId = product.id;
    const image = createElement("img", "shop-item__image");
    image.src = product.image;
    image.alt = product.name;
    image.loading = "lazy";
    shop.setFallbackImage(image, product.fallback);
    const info = createElement("div", "shop-item__info");
    if (product.kind === "component" || product.kind === "peripheral") {
      info.append(
        createElement("span", "cart-item__stock" + (product.inStock === false ? " cart-item__stock--order" : ""), product.inStock === false ? "ПОД ЗАКАЗ" : product.category?.toUpperCase() || "КОМПЛЕКТУЮЩИЕ"),
        createProductName(product),
        createElement("p", "shop-item__spec", product.specs.join(" / ")),
      );
    } else {
      info.append(
        createElement(
          "span",
          "cart-item__stock" +
            (!product.inStock ? " cart-item__stock--order" : ""),
          product.inStock ? "В НАЛИЧИИ" : "ПОД ЗАКАЗ",
        ),
        createProductName(product),
        createElement(
          "p",
          "shop-item__spec",
          `${product.gpuModel} / ${product.cpuModel}`,
        ),
        createElement(
          "p",
          "shop-item__spec",
          `${product.memory} / ${product.storage}`,
        ),
      );
    }
    info.append(
      createElement("p", "shop-item__price", `${formatPrice(product.price)} / шт.`),
    );
    const links = createElement("div", "cart-item__links");
    const favorite = createActionButton(
      "Избранное",
      "favorite",
      product,
      "shop-text-button cart-item__favorite",
    );
    const icon = createElement(
      "span",
      "material-symbols-outlined icon-small",
      "favorite",
    );
    icon.setAttribute("aria-hidden", "true");
    favorite.prepend(icon);
    const remove = createActionButton("Удалить", "remove", product);
    remove.setAttribute("aria-label", `Удалить из корзины: ${product.name}`);
    links.append(favorite, remove);
    info.append(links);

    const actions = createElement("div", "shop-item__actions");
    const quantity = createElement("div", "shop-quantity");
    quantity.setAttribute("role", "group");
    quantity.setAttribute("aria-label", `Количество ${product.name}`);
    const minus = createActionButton("−", "decrease", product, "shop-quantity__button");
    const plus = createActionButton("+", "increase", product, "shop-quantity__button");
    minus.setAttribute("aria-label", `Уменьшить количество ${product.name}`);
    plus.setAttribute("aria-label", `Увеличить количество ${product.name}`);
    minus.disabled = item.quantity <= 1;
    plus.disabled = item.quantity >= 99;
    const input = createElement("input", "shop-quantity__input");
    input.type = "number";
    input.min = "1";
    input.max = "99";
    input.step = "1";
    input.required = true;
    input.value = String(item.quantity);
    input.inputMode = "numeric";
    input.dataset.cartQuantity = "";
    input.dataset.pcId = product.id;
    input.setAttribute("aria-label", `Количество ${product.name}`);
    quantity.append(minus, input, plus);
    actions.append(
      quantity,
      createElement("p", "shop-item__subtotal", formatPrice(product.price * item.quantity)),
    );
    row.append(image, info, actions);
    return row;
  }

  function calculateTotal(items) {
    return items.reduce(
      (sum, item) => sum + productsById.get(item.id).price * item.quantity,
      0,
    );
  }

  function getGoodsLabel(number) {
    const lastTwo = number % 100;
    const form =
      lastTwo >= 11 && lastTwo <= 14
        ? "ТОВАРОВ"
        : number % 10 === 1
          ? "ТОВАР"
          : [2, 3, 4].includes(number % 10)
            ? "ТОВАРА"
            : "ТОВАРОВ";
    return `${number} ${form}`;
  }

  function showShopPage() {
    const focused = document.activeElement;
    const restore = productList.contains(focused)
      ? {
          action: focused.dataset.shopAction,
          quantity: focused.hasAttribute("data-cart-quantity"),
          id: focused.dataset.pcId,
        }
      : null;
    const state = shop.getState();
    let items =
      shopPageType === "cart"
        ? state.cart
        : state.favorites.map((id) => productsById.get(id));
    if (shopPageType === "favorites") {
      const allFavorites = items;
      const query = favoritesSearch.value.toLocaleLowerCase("ru").trim();
      items = items.filter((product) =>
        (favoritesCategory.value === "all" || (product.kind || "pc") === favoritesCategory.value) &&
        query.split(/\s+/).every((word) => [product.name, product.description, ...(product.specs || []), product.cpuModel, product.gpuModel]
          .filter(Boolean).join(" ").toLocaleLowerCase("ru").includes(word)),
      );
      if (sortInput.value === "price-asc") items.sort((a, b) => a.price - b.price);
      else if (sortInput.value === "price-desc")
        items.sort((a, b) => b.price - a.price);
      else if (sortInput.value === "name")
        items.sort((a, b) => a.name.localeCompare(b.name, "ru"));
      document.getElementById("favorites-toolbar").hidden = !allFavorites.length;
      document.getElementById("favorites-filters").hidden = !allFavorites.length;
      document.getElementById("favorites-no-results").hidden = !allFavorites.length || Boolean(items.length);
      productList.replaceChildren(...items.map(shop.createProductCard));
    } else {
      document.getElementById("cart-layout").hidden = !items.length;
      productList.replaceChildren(...items.map(createCartRow));
      const units = items.reduce((sum, item) => sum + item.quantity, 0);
      document.getElementById("cart-unit-count").textContent = String(units);
      document.getElementById("cart-subtotal").textContent = formatPrice(
        calculateTotal(items),
      );
      document.getElementById("cart-total").textContent = formatPrice(calculateTotal(items));
      document.getElementById("checkout-total").textContent = formatPrice(
        calculateTotal(items),
      );
      document.getElementById("cart-stock-note").hidden = !items.some(
        (item) =>
          productsById.get(item.id).kind === undefined &&
          !productsById.get(item.id).inStock,
      );
      document.getElementById("cart-assembly-row").hidden = !items.some(
        (item) => productsById.get(item.id).kind === undefined,
      );
      const success = document.getElementById("order-success");
      success.hidden = !latestOrder || Boolean(items.length);
      if (latestOrder)
        document.getElementById("order-success-details").textContent =
          `№ ${latestOrder.number} · ${new Date(latestOrder.date).toLocaleDateString("ru-RU")} · ${formatPrice(latestOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}`;
      if (checkoutDialog.open && !items.length) checkoutDialog.close();
    }
    itemCount.textContent = `${getGoodsLabel(shopPageType === "favorites" ? state.favorites.length : items.length)}${shopPageType === "cart" ? " В КОРЗИНЕ" : ""}`;
    emptyMessage.hidden = shopPageType === "favorites" ? Boolean(state.favorites.length) : Boolean(items.length);
    shop.updateShopButtons();
    if (restore) {
      const replacement = [...list.querySelectorAll("[data-pc-id]")].find(
        (node) =>
          node.dataset.pcId === restore.id &&
          !node.disabled &&
          (restore.quantity
            ? node.hasAttribute("data-cart-quantity")
            : node.dataset.shopAction === restore.action),
      );
      const fallback =
        productList.querySelector("[data-shop-action]") || emptyMessage.querySelector("a");
      (replacement || fallback)?.focus({ preventScroll: true });
    }
  }

  document.addEventListener("nexus:shop-change", showShopPage);
  sortInput?.addEventListener("change", showShopPage);
  favoritesSearch?.addEventListener("input", showShopPage);
  favoritesCategory?.addEventListener("change", showShopPage);
  function resetFavoritesFilters() {
    favoritesSearch.value = "";
    favoritesCategory.value = "all";
    showShopPage();
  }
  document.getElementById("favorites-reset")?.addEventListener("click", resetFavoritesFilters);
  document.getElementById("favorites-no-results-reset")?.addEventListener("click", resetFavoritesFilters);

  if (shopPageType === "cart") {
    const error = document.getElementById("checkout-error");
    let submitting = false;
    document.addEventListener("nexus:auth-state", async (event) => {
      if (!event.detail?.user) {
        latestOrder = null;
        showShopPage();
        return;
      }
      if (!form.elements.email.value) form.elements.email.value = event.detail.user.email || "";
      try {
        const profile = await window.NexusAccount.getProfile();
        if (!form.elements.customer.value) form.elements.customer.value = profile?.name || "";
        if (!form.elements.phone.value) form.elements.phone.value = profile?.phone || "";
      } catch {  }
    });
    document.getElementById("checkout-open").addEventListener("click", async () => {
      const account = window.NexusAccount;
      if (!account) {
        shop.showMessage(window.NexusFirebaseLoadFailed
          ? "Firebase недоступен. Проверьте интернет и обновите страницу."
          : "Подключение Firebase ещё не завершено. Повторите попытку.");
        return;
      }
      await account.ready;
      if (!account.currentUser) {
        location.href = "account.html?return=cart.html";
        return;
      }
      error.hidden = true;
      checkoutDialog.showModal();
      document.body.classList.add("shop-modal-open");
    });
    document
      .getElementById("checkout-close")
      .addEventListener("click", () => checkoutDialog.close());
    checkoutDialog.addEventListener("close", () => {
      document.body.classList.remove("shop-modal-open");
      if (shop.getState().cart.length)
        document.getElementById("checkout-open").focus();
    });
    checkoutDialog.addEventListener("click", (event) => {
      const bounds = checkoutDialog.getBoundingClientRect();
      if (
        event.target === checkoutDialog &&
        (event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom)
      )
        checkoutDialog.close();
    });
    function updateDeliveryFields() {
      const delivery = form.elements.delivery.value === "delivery";
      document.getElementById("checkout-address-label").hidden = !delivery;
      form.elements.address.required = delivery;
      form.elements.address.disabled = !delivery;
      form.elements.address.setCustomValidity("");
    }
    form.elements.delivery.addEventListener("change", updateDeliveryFields);
    form.addEventListener("input", (event) => {
      event.target.setCustomValidity?.("");
      error.hidden = true;
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submitting) return;
      const items = shop.getState().cart;
      if (!items.length) return;
      form.elements.customer.setCustomValidity(
        form.elements.customer.value.trim() ? "" : "Введите имя.",
      );
      const digits = form.elements.phone.value.replace(/\D/g, "");
      form.elements.phone.setCustomValidity(
        digits.length >= 10 && digits.length <= 15
          ? ""
          : "В номере должно быть от 10 до 15 цифр.",
      );
      if (form.elements.delivery.value === "delivery")
        form.elements.address.setCustomValidity(
          form.elements.address.value.trim() ? "" : "Введите адрес доставки.",
        );
      if (!form.reportValidity()) return;
      const order = {
        number: `NX-${Date.now().toString(36).toUpperCase()}`,
        date: new Date().toISOString(),
        customer: form.elements.customer.value.trim(),
        phone: form.elements.phone.value.trim(),
        email: form.elements.email.value.trim(),
        delivery: form.elements.delivery.value,
        address:
          form.elements.delivery.value === "delivery"
            ? form.elements.address.value.trim()
            : "",
        comment: form.elements.comment.value.trim(),
        items: items.map((item) => ({
          ...item,
          name: productsById.get(item.id).name,
          price: productsById.get(item.id).price,
        })),
      };
      const submit = form.querySelector('button[type="submit"]');
      submitting = true;
      submit.disabled = true;
      try {
        const state = shop.getState();
        await window.NexusAccount.saveOrder(order, { favorites: state.favorites, cart: [] });
      } catch (failure) {
        error.textContent = `Не удалось записать заказ в Firebase: ${failure.message || "проверьте соединение и правила Firestore"}. Товары остались в корзине.`;
        error.hidden = false;
        submit.disabled = false;
        submitting = false;
        return;
      }
      submit.disabled = false;
      submitting = false;
      latestOrder = order;
      checkoutDialog.close();
      form.reset();
      updateDeliveryFields();
      shop.clearCart("Заказ сохранён в вашем аккаунте");
      document.getElementById("order-success-title").focus();
    });
    document.getElementById("order-download").addEventListener("click", () => {
      if (!latestOrder) return;
      const order = latestOrder;
      const lines = [
        `NEXUS PC — заказ № ${order.number}`,
        new Date(order.date).toLocaleString("ru-RU"),
        "",
        `Имя: ${order.customer}`,
        `Телефон: ${order.phone}`,
        `Email: ${order.email || "—"}`,
        `Получение: ${order.delivery === "pickup" ? "Самовывоз" : "Доставка"}`,
        `Адрес: ${order.address || "—"}`,
        `Комментарий: ${order.comment || "—"}`,
        "",
        ...order.items.map(
          (item) =>
            `${productsById.get(item.id).name} — ${item.quantity} шт. × ${formatPrice(item.price)} = ${formatPrice(item.price * item.quantity)}`,
        ),
        "",
        `Итого: ${formatPrice(order.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}`,
        "",
        "Заказ сохранён в аккаунте Firebase. Для подтверждения: +7 (727) 355-35-90. Оплата на сайте не производится.",
      ];
      const url = URL.createObjectURL(
        new Blob(["\uFEFF", lines.join("\n")], {
          type: "text/plain;charset=utf-8",
        }),
      );
      const link = createElement("a");
      link.href = url;
      link.download = `NEXUS-${order.number}.txt`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    updateDeliveryFields();
  }
  showShopPage();
})();
