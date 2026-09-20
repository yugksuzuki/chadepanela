(function () {
  const nav = document.getElementById("cat-nav");
  const filtros = document.getElementById("filtros");
  const resultado = document.getElementById("resultado");
  const main = document.getElementById("lista");
  const progress = document.getElementById("hero-progress");

  // A chave continua com o nome antigo de propósito: trocá-la faria todo
  // convidado perder o "Desmarcar" do que já tinha escolhido.
  const STORAGE_KEY = "cha-de-panela-minhas-escolhas";

  const ENDERECO_ENTREGA =
    "Av. Marechal Floriano Peixoto, 53 - Socomim - Telêmaco Borba/PR";

  // Chaves do Web3Forms, buscadas em /api/config. O aviso ao casal sai daqui,
  // do navegador, e não do servidor: o Web3Forms fica atrás do Cloudflare, que
  // responde a chamada vinda de um data center com um desafio de JavaScript.
  // Do navegador é o uso para o qual ele foi feito — e é por isso que a chave
  // deles é pública por definição.
  let chavesDeAviso = [];

  // Abrir o site com ?casal na URL mostra "Desmarcar" em todo presente já
  // escolhido, não só nos deste navegador. Sem isso, um presente marcado sem
  // querer por quem depois limpou o navegador ficaria preso para sempre —
  // nem o casal conseguiria liberar. Não é senha nem proteção: a API nunca
  // teve autenticação, por escolha (é lista de família, não loja). É só o
  // botão deixando de ficar escondido.
  const MODO_CASAL = new URLSearchParams(window.location.search).has("casal");
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

  /**
   * Falha de rede no meio da festa é esperada: celular no 4G do interior,
   * wi-fi lotado, o site sendo republicado. O fetch só lança nesses casos —
   * resposta de erro do servidor chega com res.ok falso e passa direto por
   * aqui. Então uma segunda tentativa costuma resolver, e quando não resolve
   * o convidado ouve português em vez de "Failed to fetch".
   */
  async function postClaims(corpo) {
    for (let tentativa = 1; ; tentativa++) {
      try {
        return await fetch("/api/claims", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corpo),
        });
      } catch (e) {
        if (tentativa >= 2) {
          throw new Error(
            "Não conseguimos falar com o site. Confira sua internet e tente de novo."
          );
        }
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }

  async function claimItem(itemId, name, itemName) {
    const res = await postClaims({ itemId, name, itemName });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || "Não foi possível marcar o item");
      err.claims = data.claims;
      throw err;
    }
    return data;
  }

  async function unclaimItem(itemId, itemName) {
    const res = await postClaims({ itemId, itemName, action: "unclaim" });
    return res.json();
  }

  /* ---------- aviso ao casal ---------- */

  async function carregaChavesDeAviso() {
    try {
      const res = await fetch("/api/config", { cache: "no-store" });
      if (!res.ok) return;
      const dados = await res.json();
      if (Array.isArray(dados.web3forms)) chavesDeAviso = dados.web3forms;
    } catch (e) {
      // Sem aviso o convidado não perde nada: a escolha dele já está no
      // Supabase, que é o registro que vale.
    }
  }

  /**
   * Avisa o casal por e-mail. Roda depois de a escolha já estar gravada, e
   * sem await de propósito: se o Web3Forms estiver fora do ar ou bloqueado
   * por uma extensão, o convidado não pode nem perceber.
   */
  function avisaOCasal(evento) {
    for (const chave of chavesDeAviso) {
      fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: chave,
          subject:
            evento.acao === "Escolhido"
              ? `Presente escolhido: ${evento.presente}`
              : `${evento.presente} voltou para a lista`,
          Presente: evento.presente,
          // O nome não entra: este e-mail vai para o casal, e quem deu o quê
          // é surpresa. Ele fica só no Supabase, para depois da festa.
          Convidado: "surpresa",
          "O que aconteceu": evento.acao,
          "Total escolhidos": String(evento.total),
          Quando: new Date().toLocaleString("pt-BR"),
        }),
      }).catch(() => {});
    }
  }

  /* ---------- endereço de entrega ---------- */

  async function copiarEndereco(botao) {
    const original = botao.textContent;
    let copiou = false;
    try {
      await navigator.clipboard.writeText(ENDERECO_ENTREGA);
      copiou = true;
    } catch (e) {
      // Safari antigo, http sem TLS, permissão negada: cai no seletor de texto,
      // que pelo menos deixa o convidado copiar com o dedo.
      const alvo = botao.parentElement.querySelector(".entrega-endereco, .card-entrega-texto");
      if (alvo && window.getSelection) {
        const faixa = document.createRange();
        faixa.selectNodeContents(alvo);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(faixa);
      }
    }
    botao.textContent = copiou ? "Endereço copiado!" : "Selecione e copie";
    setTimeout(() => { botao.textContent = original; }, 2600);
  }

  function blocoEntregaDoCard() {
    const wrap = document.createElement("div");
    wrap.className = "card-entrega";

    const rotulo = document.createElement("span");
    rotulo.className = "card-entrega-rotulo";
    rotulo.textContent = "Enviar para";
    wrap.appendChild(rotulo);

    const texto = document.createElement("p");
    texto.className = "card-entrega-texto";
    texto.textContent = ENDERECO_ENTREGA;
    wrap.appendChild(texto);

    const botao = document.createElement("button");
    botao.className = "card-entrega-copiar";
    botao.type = "button";
    botao.textContent = "Copiar endereço";
    botao.addEventListener("click", () => copiarEndereco(botao));
    wrap.appendChild(botao);

    return wrap;
  }

  function ligarCopiaDoRodape() {
    document.querySelectorAll("[data-copiar-endereco]").forEach((botao) => {
      botao.addEventListener("click", () => copiarEndereco(botao));
    });
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
    // Sem preço e sem link não há para onde mandar ninguém: "Ver preço no link"
    // ficaria logo acima do selo que diz justamente que link não há. Nos itens
    // grandes o selo já explica sozinho.
    if (TEM_PRECOS && (valor !== null || item.links.length > 0)) {
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
      // Sem nome de propósito: quem deu o quê é surpresa até a festa. O que
      // importa aqui é o presente aparecer como tomado, para ninguém repetir.
      badgeText.textContent = mine
        ? "Você escolheu este presente"
        : "Já escolhido";
      badge.appendChild(badgeText);
      badge.appendChild(heartIcon());
      claimArea.appendChild(badge);

      if (mine) {
        // Quem acabou de escolher precisa do endereço agora, não depois de
        // procurar no rodapé. No modo casal isso não vale: eles não estão
        // comprando, estão arrumando a lista.
        claimArea.appendChild(blocoEntregaDoCard());
      }

      if (mine || MODO_CASAL) {
        const undoBtn = document.createElement("button");
        undoBtn.className = "claim-undo";
        undoBtn.textContent = "Desmarcar";
        undoBtn.addEventListener("click", async () => {
          undoBtn.disabled = true;
          try {
            await unclaimItem(item.id, item.name);
            avisaOCasal({
              acao: "Desmarcado",
              presente: item.name,
              total: Object.keys(claims).length - 1,
            });
          } catch (e) {
            // Sem isto o botão ficava desabilitado para sempre e o erro
            // sumia no console, com o convidado achando que desmarcou.
            undoBtn.disabled = false;
            window.alert(e.message);
            return;
          }
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
      claimBtn.textContent = "Vou dar este presente";
      claimBtn.addEventListener("click", async () => {
        const guestName = window.prompt(
          "Seu nome (fica em segredo — no site aparece só que o presente já " +
            "foi escolhido, e os noivos vão adivinhar na festa):"
        );
        if (guestName === null) return;
        if (!guestName.trim()) {
          window.alert("Por favor, digite seu nome.");
          return;
        }
        claimBtn.disabled = true;
        claimBtn.textContent = "Marcando...";
        try {
          const updated = await claimItem(item.id, guestName, item.name);
          claims = updated;
          avisaOCasal({
            acao: "Escolhido",
            presente: item.name,
            total: Object.keys(claims).length,
          });
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
    carregaChavesDeAviso();
    ligarCopiaDoRodape();
    renderNav();
    renderAll();
    claims = await fetchClaims();
    updateProgress();
    renderAll();
  })();
})();
