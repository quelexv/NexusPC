// Общие элементы сайта, навигация и подвал.
const currentPage = location.pathname.split("/").pop() || "index.html";

const header = document.querySelector(".site-header");
if (header) {
  const announcement = document.createElement("div");
  announcement.className = "store-announcement";
  announcement.textContent = "NEXUS PC  /  СБОРКИ, КОМПЛЕКТУЮЩИЕ И ПЕРИФЕРИЯ С ДОСТАВКОЙ ПО КАЗАХСТАНУ";
  header.prepend(announcement);

  const navigationMenu = header.querySelector(".site-nav");
  const headerContent = header.querySelector(".site-header__inner");
  const headerActions = header.querySelector(".header-actions");
  const mobileMenuButton = document.createElement("button");
  mobileMenuButton.className = "mobile-nav-toggle";
  mobileMenuButton.type = "button";
  mobileMenuButton.setAttribute("aria-label", "Открыть меню");
  mobileMenuButton.setAttribute("aria-controls", "store-navigation");
  mobileMenuButton.setAttribute("aria-expanded", "false");
  mobileMenuButton.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">menu</span>';
  navigationMenu.id = "store-navigation";
  headerContent.prepend(mobileMenuButton);

  const searchButton = document.createElement("button");
  searchButton.className = "store-search-toggle";
  searchButton.type = "button";
  searchButton.setAttribute("aria-label", "Открыть поиск");
  searchButton.setAttribute("aria-controls", "store-search-panel");
  searchButton.setAttribute("aria-expanded", "false");
  searchButton.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">search</span>';
  headerActions.prepend(searchButton);

  const searchPanel = document.createElement("div");
  searchPanel.className = "store-search-panel";
  searchPanel.id = "store-search-panel";
  searchPanel.innerHTML = '<form class="store-search-form" action="catalog.html" method="get"><span class="material-symbols-outlined" aria-hidden="true">search</span><input type="search" name="q" placeholder="Поиск комплектующих" aria-label="Поиск комплектующих" required><button type="submit">Найти →</button></form>';
  header.append(searchPanel);

  const closeMobileMenu = () => {
    navigationMenu.classList.remove("is-open");
    mobileMenuButton.setAttribute("aria-expanded", "false");
    mobileMenuButton.setAttribute("aria-label", "Открыть меню");
    mobileMenuButton.querySelector("span").textContent = "menu";
  };
  const closeSearchPanel = () => {
    searchPanel.classList.remove("is-open");
    searchButton.setAttribute("aria-expanded", "false");
    searchButton.setAttribute("aria-label", "Открыть поиск");
  };
  mobileMenuButton.addEventListener("click", () => {
    const isOpen = !navigationMenu.classList.contains("is-open");
    closeSearchPanel();
    navigationMenu.classList.toggle("is-open", isOpen);
    mobileMenuButton.setAttribute("aria-expanded", String(isOpen));
    mobileMenuButton.setAttribute("aria-label", isOpen ? "Закрыть меню" : "Открыть меню");
    mobileMenuButton.querySelector("span").textContent = isOpen ? "close" : "menu";
  });
  searchButton.addEventListener("click", () => {
    const isOpen = !searchPanel.classList.contains("is-open");
    closeMobileMenu();
    searchPanel.classList.toggle("is-open", isOpen);
    searchButton.setAttribute("aria-expanded", String(isOpen));
    searchButton.setAttribute("aria-label", isOpen ? "Закрыть поиск" : "Открыть поиск");
    if (isOpen) searchPanel.querySelector("input").focus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { closeMobileMenu(); closeSearchPanel(); }
  });
  document.addEventListener("click", (event) => {
    if (!header.contains(event.target)) { closeMobileMenu(); closeSearchPanel(); }
  });
}

document.querySelectorAll(".site-header a[data-path], .home-footer a[data-path]").forEach((link) => {
  const linkPage = new URL(link.href).pathname.split("/").pop();
  if (linkPage !== currentPage) return;
  link.setAttribute("aria-current", "page");
  if (link.classList.contains("site-nav__link")) {
    link.classList.add("site-nav__link--active");
  }
});
