(function () {
  const nav = document.getElementById("cat-nav");
  const main = document.getElementById("lista");

  function render(filter) {
    main.innerHTML = "";
    const cats = filter === "Todos" ? CATEGORIES : [filter];

    cats.forEach((cat) => {
      const items = ITEMS.filter((i) => i.category === cat);
      if (!items.length) return;

      const section = document.createElement("section");
      section.className = "category-section";

      const title = document.createElement("h2");
      title.className = "category-title";
      title.textContent = cat;
      section.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "grid";

      items.forEach((item) => {
        const card = document.createElement("div");
        card.className = "card" + (item.links.length === 0 ? " big-item" : "");

        const name = document.createElement("p");
        name.className = "card-name";
        name.textContent = item.name;
        card.appendChild(name);

        if (item.links.length === 0) {
          const badge = document.createElement("span");
          badge.className = "big-item-badge";
          badge.textContent = "Ainda sem link — fala com a gente 💬";
          card.appendChild(badge);
        } else {
          const linksWrap = document.createElement("div");
          linksWrap.className = "card-links";
          item.links.forEach((l) => {
            const a = document.createElement("a");
            a.className = "card-link";
            a.href = l.url;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.textContent = l.label;
            linksWrap.appendChild(a);
          });
          card.appendChild(linksWrap);
        }

        grid.appendChild(card);
      });

      section.appendChild(grid);
      main.appendChild(section);
    });
  }

  function renderNav(active) {
    nav.innerHTML = "";
    ["Todos", ...CATEGORIES].forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = "cat-pill" + (cat === active ? " active" : "");
      btn.textContent = cat;
      btn.addEventListener("click", () => {
        renderNav(cat);
        render(cat);
      });
      nav.appendChild(btn);
    });
  }

  renderNav("Todos");
  render("Todos");
})();
