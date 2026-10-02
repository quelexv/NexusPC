// Загрузка и хранение каталога товаров через Firestore.
(() => {
  "use strict";
  const catalogUrl = "https://firestore.googleapis.com/v1/projects/nexuspc133/databases/(default)/documents/catalogProducts?pageSize=1000";
  window.NEXUS_PCS = [];
  window.NEXUS_COMPONENTS = [];
  window.NEXUS_PERIPHERALS = [];
  const productLists = { pc: window.NEXUS_PCS, component: window.NEXUS_COMPONENTS, peripheral: window.NEXUS_PERIPHERALS };
  const isValidText = (value, max) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
  const isValidImage = (value) => isValidText(value, 500) && (/^https:\/\/[^\s]+$/i.test(value) || /^images\/[a-z0-9/_-]+\.(?:png|jpe?g|webp|svg)$/i.test(value));
  let loaded = false;

  function isValidProduct(item) {
    if (!item || !/^[a-z0-9-]{1,80}$/.test(item.id) || !productLists[item.kind]
      || !isValidText(item.name, 140) || !Number.isFinite(item.price) || item.price <= 0
      || !isValidImage(item.image) || !isValidText(item.description, 1000)
      || typeof item.inStock !== "boolean") return false;
    if (item.kind === "pc") return isValidText(item.cpu, 100) && isValidText(item.cpuModel, 100)
      && isValidText(item.gpu, 100) && isValidText(item.gpuModel, 100)
      && Number.isInteger(item.ram) && item.ram > 0 && item.ram <= 1024
      && isValidText(item.memory, 100) && isValidText(item.storage, 100);
    return isValidText(item.category, 80) && isValidText(item.brand, 80)
      && (item.memoryGb === undefined || (Number.isInteger(item.memoryGb) && item.memoryGb > 0 && item.memoryGb <= 512))
      && Array.isArray(item.specs) && item.specs.length > 0 && item.specs.length <= 12
      && item.specs.every((spec) => isValidText(spec, 120));
  }

  const catalogReady = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const productsByKind = { pc: [], component: [], peripheral: [] };
      let pageToken = "";
      do {
        const url = new URL(catalogUrl);
        if (pageToken) url.searchParams.set("pageToken", pageToken);
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Firestore: ${response.status}`);
        const data = await response.json();
        for (const document of data.documents || []) {
          try {
            const item = JSON.parse(document.fields?.payload?.stringValue || "");
            if (!isValidProduct(item) || document.name.split("/").pop() !== item.id) continue;
            const product = { ...item };
            if (item.kind === "pc") delete product.kind;
            productsByKind[item.kind].push(product);
          } catch {  }
        }
        pageToken = data.nextPageToken || "";
      } while (pageToken);
      for (const kind of Object.keys(productLists)) productLists[kind].push(...productsByKind[kind]);
      loaded = true;
    } catch (error) {
      console.error("Не удалось загрузить каталог Firebase.", error);
      const notice = document.createElement("p");
      notice.className = "catalog-load-error";
      notice.setAttribute("role", "alert");
      notice.textContent = "Не удалось загрузить товары из Firebase. Проверьте соединение и обновите страницу.";
      document.querySelector("main")?.before(notice);
    } finally {
      clearTimeout(timeout);
    }
  })();
  window.NexusProductCatalog = { catalogReady, isValidProduct, get loaded() { return loaded; } };
})();
