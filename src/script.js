(function () {
  const nav = document.getElementById("cat-nav");
  const filtros = document.getElementById("filtros");
  const resultado = document.getElementById("resultado");
  const main = document.getElementById("lista");
  const progress = document.getElementById("hero-progress");

  const STORAGE_KEY = "cha-de-panela-minhas-escolhas";
  let claims = {};

  /* ---------- preço ---------- */

  // Enquanto nenhum presente tiver preço (ver scripts/atualiza-catalogo.mjs),
  // a barra de faixas e a ordenação por preço nem aparecem, em vez de virarem
  // controles mortos que não mudam nada na tela.
  const TEM_PRECOS = ITEMS.some((i) => typeof i.price === "number");

  const dinheiro = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const FAIXAS = [
    { id: "todas", label: "Qualquer preço", testa: () => true },
    { id: "ate-50", label: "Até R$ 50", testa: (p) => p !== null && p <= 50 },
    { id: "50-150", label: "R$ 50 a 150", testa: (p) => p !== null && p > 50 && p <= 150 },
    { id: "150-300", label: "R$ 150 a 300", testa: (p) => p !== null && p > 150 && p <= 300 },
    { id: "acima-300", label: "Acima de R$ 300", testa: (p) => p !== null && p > 300 },
    { id: "sem-preco", label: "Sem preço", testa: (p) => p === null },
  ];

  function preco(item) {
    return typeof item.price === "number" ? item.price : null;
  }

  function precoMaisRecente() {
    const datas = ITEMS.map((i) => i.precoEm).filter(Boolean).sort();
    return datas.length ? datas[datas.length - 1] : null;
  }

  function dataCurta(iso) {
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  /* ---------- estado dos filtros ---------- */

  let categoriaAtiva = "Todos";
  let faixaAtiva = "todas";
  let ordem = "categoria";
  let esconderEscolhidos = false;

  /* ---------- helpers ---------- */

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

  /* ---------- card ---------- */

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

    const valor = preco(item);
    if (TEM_PRECOS) {
      const linha = document.createElement("p");
      linha.className = "card-price" + (valor === null ? " card-price--vazio" : "");
      linha.textContent = valor === null ? "Ver preço no link" : dinheiro.format(valor);
      body.appendChild(linha);
    }

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
        a.setAttribute("aria-label", `${l.label} — ${item.name} (abre em nova aba)`);
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

  /* ---------- filtro + ordenação ---------- */

  function visiveis() {
    const faixa = FAIXAS.find((f) => f.id === faixaAtiva) || FAIXAS[0];
    return ITEMS.filter((item) => {
      if (categoriaAtiva !== "Todos" && item.category !== categoriaAtiva) return false;
      if (esconderEscolhidos && claims[item.id]) return false;
      if (TEM_PRECOS && !faixa.testa(preco(item))) return false;
      return true;
    });
  }

  // Presente sem preço vai pro fim da lista nos dois sentidos: ele não é
  // "barato", só não sabemos quanto custa.
  function porPreco(a, b, crescente) {
    const pa = preco(a);
    const pb = preco(b);
    if (pa === null && pb === null) return a.name.localeCompare(b.name, "pt-BR");
    if (pa === null) return 1;
    if (pb === null) return -1;
    return crescente ? pa - pb : pb - pa;
  }

  function render() {
    main.innerHTML = "";
    const mineMap = getMyClaims();
    const lista = visiveis();

    if (!lista.length) {
      const vazio = document.createElement("p");
      vazio.className = "vazio";
      vazio.textContent = esconderEscolhidos
        ? "Todos os presentes desta busca já foram escolhidos — obrigado!"
        : "Nenhum presente nesta faixa de preço.";
      main.appendChild(vazio);
      atualizaResultado(0);
      return;
    }

    if (ordem === "categoria") {
      const cats = categoriaAtiva === "Todos" ? CATEGORIES : [categoriaAtiva];
      cats.forEach((cat) => {
        const doGrupo = lista.filter((i) => i.category === cat);
        if (!doGrupo.length) return;
        main.appendChild(secao(cat, doGrupo, mineMap));
      });
    } else {
      const crescente = ordem === "menor-preco";
      const ordenada = [...lista].sort((a, b) => porPreco(a, b, crescente));
      const titulo = crescente ? "Do mais barato ao mais caro" : "Do mais caro ao mais barato";
      main.appendChild(secao(titulo, ordenada, mineMap));
    }

    atualizaResultado(lista.length);
  }

  function secao(titulo, itens, mineMap) {
    const section = document.createElement("section");
    section.className = "category-section";

    const h2 = document.createElement("h2");
    h2.className = "category-title";
    h2.textContent = titulo;
    section.appendChild(h2);

    const grid = document.createElement("div");
    grid.className = "grid";
    itens.forEach((item) => grid.appendChild(buildCard(item, !!mineMap[item.id])));
    section.appendChild(grid);
    return section;
  }

  function atualizaResultado(quantos) {
    if (!resultado) return;
    const filtrando =
      categoriaAtiva !== "Todos" || faixaAtiva !== "todas" || esconderEscolhidos;
    resultado.textContent = filtrando
      ? `${quantos} ${quantos === 1 ? "presente" : "presentes"} de ${ITEMS.length}`
      : "";
  }

  /* ---------- controles ---------- */

  function renderNav() {
    nav.innerHTML = "";
    ["Todos", ...CATEGORIES].forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = "cat-pill" + (cat === categoriaAtiva ? " active" : "");
      btn.setAttribute("aria-pressed", cat === categoriaAtiva ? "true" : "false");
      btn.textContent = cat;
      btn.addEventListener("click", () => {
        categoriaAtiva = cat;
        renderNav();
        render();
      });
      nav.appendChild(btn);
    });
  }

  function renderFiltros() {
    if (!filtros) return;
    filtros.innerHTML = "";

    if (TEM_PRECOS) {
      const grupoFaixa = document.createElement("div");
      grupoFaixa.className = "filtro-grupo";
      grupoFaixa.setAttribute("role", "group");
      grupoFaixa.setAttribute("aria-label", "Faixa de preço");

      const rotulo = document.createElement("span");
      rotulo.className = "filtro-rotulo";
      rotulo.textContent = "Preço";
      grupoFaixa.appendChild(rotulo);

      FAIXAS.forEach((f) => {
        // "Sem preço" só aparece se houver de fato presente sem preço
        if (f.id === "sem-preco" && !ITEMS.some((i) => preco(i) === null)) return;
        const btn = document.createElement("button");
        btn.className = "faixa-pill" + (f.id === faixaAtiva ? " active" : "");
        btn.setAttribute("aria-pressed", f.id === faixaAtiva ? "true" : "false");
        btn.textContent = f.label;
        btn.addEventListener("click", () => {
          faixaAtiva = f.id;
          renderFiltros();
          render();
        });
        grupoFaixa.appendChild(btn);
      });
      filtros.appendChild(grupoFaixa);

      const grupoOrdem = document.createElement("div");
      grupoOrdem.className = "filtro-grupo";

      const labelOrdem = document.createElement("label");
      labelOrdem.className = "filtro-rotulo";
      labelOrdem.setAttribute("for", "ordenar");
      labelOrdem.textContent = "Ordenar";
      grupoOrdem.appendChild(labelOrdem);

      const select = document.createElement("select");
      select.className = "filtro-select";
      select.id = "ordenar";
      [
        ["categoria", "Por categoria"],
        ["menor-preco", "Mais baratos primeiro"],
        ["maior-preco", "Mais caros primeiro"],
      ].forEach(([valor, texto]) => {
        const opt = document.createElement("option");
        opt.value = valor;
        opt.textContent = texto;
        if (valor === ordem) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener("change", () => {
        ordem = select.value;
        render();
      });
      grupoOrdem.appendChild(select);
      filtros.appendChild(grupoOrdem);
    }

    const grupoEsconder = document.createElement("div");
    grupoEsconder.className = "filtro-grupo";

    const check = document.createElement("label");
    check.className = "filtro-check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = esconderEscolhidos;
    input.addEventListener("change", () => {
      esconderEscolhidos = input.checked;
      render();
    });
    check.appendChild(input);
    check.appendChild(document.createTextNode("Esconder os já escolhidos"));
    grupoEsconder.appendChild(check);
    filtros.appendChild(grupoEsconder);

    const em = precoMaisRecente();
    if (em) {
      const nota = document.createElement("p");
      nota.className = "filtro-nota";
      nota.textContent = `Preços consultados em ${dataCurta(em)} — podem ter mudado desde então.`;
      filtros.appendChild(nota);
    }
  }

  function renderAll() {
    renderFiltros();
    render();
  }

  (async function init() {
    renderNav();
    renderAll();
    claims = await fetchClaims();
    updateProgress();
    renderAll();
  })();
})();
