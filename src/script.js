(function () {
  const nav = document.getElementById("cat-nav");
  const main = document.getElementById("lista");
  const progress = document.getElementById("hero-progress");

  const STORAGE_KEY = "cha-de-panela-minhas-escolhas";
  let claims = {};

  function heartIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon-heart");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#icon-heart-fill");
    svg.appendChild(use);
    return svg;
  }

  function updateProgress() {
    if (!progress) return;
    progress.textContent = "";
    const total = ITEMS.length;
    const chosen = Object.keys(claims).length;
    const text = document.createElement("span");
    text.textContent = chosen === 0
      ? `${total} presentes na lista — nenhum escolhido ainda`
      : `${chosen} de ${total} presentes já escolhidos`;
    progress.appendChild(text);
    if (chosen > 0) progress.appendChild(heartIcon());
  }

  function getMyClaims() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function rememberMyClaim(itemId) {
    try {
      const mine = getMyClaims();
      mine[itemId] = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mine));
    } catch (e) {
      /* localStorage indisponível — segue sem lembrar */
    }
  }

  function forgetMyClaim(itemId) {
    try {
      const mine = getMyClaims();
      delete mine[itemId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mine));
    } catch (e) {
      /* localStorage indisponível — segue sem lembrar */
    }
  }

  async function fetchClaims() {
    try {
      const res = await fetch("/api/claims", { cache: "no-store" });
      if (!res.ok) return {};
      return await res.json();
    } catch (e) {
      return {};
    }
  }

  async function claimItem(itemId, name) {
    const res = await fetch("/api/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, name }),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || "Não foi possível marcar o item");
      err.claims = data.claims;
      throw err;
    }
    return data;
  }

  async function unclaimItem(itemId) {
    const res = await fetch("/api/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, action: "unclaim" }),
    });
    return res.json();
  }

  function buildCard(item, mine) {
    const card = document.createElement("div");
    const claim = claims[item.id];
    card.className = "card" + (item.links.length === 0 ? " big-item" : "") + (claim ? " claimed" : "") + (item.image ? " has-image" : "");

    if (item.image) {
      const imageWrap = document.createElement("div");
      imageWrap.className = "card-image-wrap";
      const img = document.createElement("img");
      img.className = "card-image";
      img.src = item.image;
      img.alt = item.name;
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", () => {
        imageWrap.remove();
        card.classList.remove("has-image");
      });
      imageWrap.appendChild(img);
      card.appendChild(imageWrap);
    }

    const body = document.createElement("div");
    body.className = "card-body";
    card.appendChild(body);

    const name = document.createElement("p");
    name.className = "card-name";
    name.textContent = item.name;
    body.appendChild(name);

    if (item.links.length > 0) {
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
      body.appendChild(linksWrap);
    } else if (!claim) {
      const badge = document.createElement("span");
      badge.className = "big-item-badge";
      badge.textContent = "Ainda sem link — fala com a gente";
      body.appendChild(badge);
    }

    const claimArea = document.createElement("div");
    claimArea.className = "claim-area";

    if (claim) {
      const badge = document.createElement("span");
      badge.className = "claim-badge";
      const badgeText = document.createElement("span");
      badgeText.textContent = mine
        ? "Você escolheu este presente"
        : `Já escolhido por ${claim.name}`;
      badge.appendChild(badgeText);
      badge.appendChild(heartIcon());
      claimArea.appendChild(badge);

      if (mine) {
        const undoBtn = document.createElement("button");
        undoBtn.className = "claim-undo";
        undoBtn.textContent = "Desmarcar";
        undoBtn.addEventListener("click", async () => {
          undoBtn.disabled = true;
          await unclaimItem(item.id);
          forgetMyClaim(item.id);
          delete claims[item.id];
          updateProgress();
          renderAll();
        });
        claimArea.appendChild(undoBtn);
      }
    } else {
      const claimBtn = document.createElement("button");
      claimBtn.className = "claim-btn";
      claimBtn.textContent = "Marcar como escolhido";
      claimBtn.addEventListener("click", async () => {
        const guestName = window.prompt(
          "Seu nome, para avisarmos quem já escolheu este presente:"
        );
        if (guestName === null) return;
        if (!guestName.trim()) {
          window.alert("Por favor, digite seu nome.");
          return;
        }
        claimBtn.disabled = true;
        claimBtn.textContent = "Marcando...";
        try {
          const updated = await claimItem(item.id, guestName);
          claims = updated;
          rememberMyClaim(item.id);
          updateProgress();
          renderAll();
        } catch (e) {
          if (e.claims) claims = e.claims;
          updateProgress();
          window.alert(e.message);
          renderAll();
        }
      });
      claimArea.appendChild(claimBtn);
    }

    body.appendChild(claimArea);
    return card;
  }

  function render(filter) {
    main.innerHTML = "";
    const cats = filter === "Todos" ? CATEGORIES : [filter];
    const mineMap = getMyClaims();

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
        grid.appendChild(buildCard(item, !!mineMap[item.id]));
      });

      section.appendChild(grid);
      main.appendChild(section);
    });
  }

  let activeCategory = "Todos";

  function renderAll() {
    render(activeCategory);
  }

  function renderNav(active) {
    activeCategory = active;
    nav.innerHTML = "";
    ["Todos", ...CATEGORIES].forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = "cat-pill" + (cat === active ? " active" : "");
      btn.setAttribute("aria-pressed", cat === active ? "true" : "false");
      btn.textContent = cat;
      btn.addEventListener("click", () => {
        renderNav(cat);
        render(cat);
      });
      nav.appendChild(btn);
    });
  }

  (async function init() {
    renderNav("Todos");
    render("Todos");
    claims = await fetchClaims();
    updateProgress();
    renderAll();
  })();
})();
