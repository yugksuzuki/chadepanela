#!/usr/bin/env node
/**
 * Testa como a página se comporta quando a rede falha — o caso de um
 * convidado no 4G do interior, ou do site sendo republicado bem na hora do
 * clique, que foi o que aconteceu no primeiro teste real.
 *
 * Sobe o site e derruba o /api/claims de propósito, num navegador de verdade.
 *
 *   cd src && python3 -m http.server 4180 &
 *   mkdir -p /tmp/pw && cd /tmp/pw && npm init -y && npm i playwright-core
 *   NODE_PATH=/tmp/pw/node_modules node scripts/testa-rede.mjs
 *
 * Precisa do playwright-core, que não é dependência do site: instale numa
 * pasta temporária, para não sujar o package.json de um projeto sem build.
 * O import é via createRequire de propósito — o `import` do ESM resolve o
 * pacote a partir da pasta deste arquivo e ignora NODE_PATH; o require do
 * CommonJS respeita.
 */
import { createRequire } from "node:module";
import fs from "node:fs";

const { chromium } = createRequire(import.meta.url)("playwright-core");

const base = "/opt/pw-browsers";
const dir = fs.readdirSync(base).find((d) => d.startsWith("chromium-"));
const nav = await chromium.launch({ executablePath: `${base}/${dir}/chrome-linux/chrome` });
const URL = "http://127.0.0.1:4180/index.html";

let passou = 0, falhou = 0;
function confere(nome, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  console.log(`${ok ? "ok   " : "FALHA"} ${nome}`);
  if (!ok) console.log(`        obtido ${JSON.stringify(obtido)} / esperado ${JSON.stringify(esperado)}`);
  ok ? passou++ : falhou++;
}

/** Abre a página com o /api/claims sob controle nosso. */
async function abre(aoReceberPost, opcoes = {}) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  let estado = {};
  let posts = 0;
  const avisos = [];

  // /api/config entrega as chaves do Web3Forms ao navegador
  await ctx.route("**/api/config", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ web3forms: opcoes.chaves ?? ["chave-de-teste"] }),
    })
  );

  // o Web3Forms de verdade fica atrás do Cloudflare; aqui é um dublê
  await ctx.route("https://api.web3forms.com/**", async (route) => {
    avisos.push(JSON.parse(route.request().postData() || "{}"));
    if (opcoes.web3formsCai) return route.abort("connectionfailed");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await ctx.route("**/api/claims", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(estado) });
    }
    posts++;
    const corpo = JSON.parse(route.request().postData() || "{}");
    const acao = await aoReceberPost(posts, corpo);
    if (acao === "cai") return route.abort("connectionfailed");
    if (corpo.action === "unclaim") delete estado[corpo.itemId];
    // como a API de verdade: a resposta diz que tem dono, não quem é
    else estado[corpo.itemId] = { claimedAt: new Date().toISOString() };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(estado) });
  });
  await p.goto(URL + (opcoes.query || ""), { waitUntil: "networkidle" });
  await p.waitForTimeout(1000);
  return { ctx, p, contaPosts: () => posts, avisos };
}

/* 1. a rede cai uma vez: a segunda tentativa salva, sem o convidado ver nada */

{
  const alertas = [];
  const { ctx, p, contaPosts } = await abre((n) => (n === 1 ? "cai" : "ok"));
  p.on("dialog", async (d) => {
    if (d.type() === "prompt") return d.accept("Tia Cida");
    alertas.push(d.message());
    await d.accept();
  });
  await p.locator("button.claim-btn").first().click();
  await p.waitForTimeout(3000);

  confere("uma queda de rede: tentou 2 vezes", contaPosts(), 2);
  confere("uma queda de rede: nenhum alerta para o convidado", alertas, []);
  confere("uma queda de rede: o presente ficou marcado",
    await p.locator(".card.claimed").count() > 0, true);
  await ctx.close();
}

/* 2. a rede cai sempre: aí sim fala com o convidado, em português */

{
  const alertas = [];
  const { ctx, p, contaPosts } = await abre(() => "cai");
  p.on("dialog", async (d) => {
    if (d.type() === "prompt") return d.accept("Tia Cida");
    alertas.push(d.message());
    await d.accept();
  });
  await p.locator("button.claim-btn").first().click();
  await p.waitForTimeout(3500);

  confere("rede fora: desistiu depois de 2 tentativas", contaPosts(), 2);
  confere("rede fora: avisou em português", alertas,
    ["Não conseguimos falar com o site. Confira sua internet e tente de novo."]);
  confere("rede fora: nada de 'Failed to fetch'",
    alertas.some((a) => /failed to fetch/i.test(a)), false);
  confere("rede fora: o presente não ficou marcado",
    await p.locator(".card.claimed").count(), 0);
  confere("rede fora: dá para tentar de novo",
    await p.locator("button.claim-btn").first().isEnabled(), true);
  await ctx.close();
}

/* 3. o "Desmarcar" que falha não pode travar o botão */

{
  const alertas = [];
  // marca normalmente; só o unclaim cai
  const { ctx, p, contaPosts } = await abre((n, corpo) =>
    corpo.action === "unclaim" ? "cai" : "ok");
  p.on("dialog", async (d) => {
    if (d.type() === "prompt") return d.accept("Tia Cida");
    alertas.push(d.message());
    await d.accept();
  });
  await p.locator("button.claim-btn").first().click();
  await p.waitForTimeout(1500);

  const desmarcar = p.locator("button.claim-undo").first();
  await desmarcar.click();
  await p.waitForTimeout(3500);

  confere("desmarcar falhando: avisou o convidado", alertas,
    ["Não conseguimos falar com o site. Confira sua internet e tente de novo."]);
  confere("desmarcar falhando: o botão voltou a funcionar",
    await p.locator("button.claim-undo").first().isEnabled(), true);
  confere("desmarcar falhando: continua marcado, sem mentir para o convidado",
    await p.locator(".card.claimed").count() > 0, true);
  await ctx.close();
}

/* 4. o aviso ao casal sai do navegador, com os campos certos */

{
  const { ctx, p, avisos } = await abre(() => "ok");
  p.on("dialog", async (d) => {
    if (d.type() === "prompt") return d.accept("Tia Cida");
    await d.accept();
  });
  await p.locator("button.claim-btn").first().click();
  await p.waitForTimeout(2000);

  confere("marcar dispara um aviso", avisos.length, 1);
  confere("aviso: manda a chave vinda de /api/config", avisos[0]?.access_key, "chave-de-teste");
  confere("aviso: assunto diz qual presente saiu",
    /^Presente escolhido: .+/.test(avisos[0]?.subject || ""), true);
  confere("aviso: campos legíveis no corpo",
    [avisos[0]?.Convidado, avisos[0]?.["O que aconteceu"], avisos[0]?.["Total escolhidos"]],
    ["surpresa", "Escolhido", "1"]);
  confere("aviso: o nome do convidado não vai junto",
    JSON.stringify(avisos[0]).includes("Tia Cida"), false);

  await p.locator("button.claim-undo").first().click();
  await p.waitForTimeout(2000);
  confere("desmarcar também avisa", avisos.length, 2);
  confere("aviso de desmarcação", avisos[1]?.["O que aconteceu"], "Desmarcado");
  await ctx.close();
}

/* 5. uma chave por destinatário vira um aviso por chave */

{
  const { ctx, p, avisos } = await abre(() => "ok", { chaves: ["chave-gui", "chave-paloma"] });
  p.on("dialog", async (d) => {
    if (d.type() === "prompt") return d.accept("Tia Cida");
    await d.accept();
  });
  await p.locator("button.claim-btn").first().click();
  await p.waitForTimeout(2000);
  confere("duas chaves, dois avisos", avisos.map((a) => a.access_key),
    ["chave-gui", "chave-paloma"]);
  await ctx.close();
}

/* 6. o aviso falhando não pode atrapalhar o convidado */

{
  const alertas = [];
  const { ctx, p } = await abre(() => "ok", { web3formsCai: true });
  p.on("dialog", async (d) => {
    if (d.type() === "prompt") return d.accept("Tia Cida");
    alertas.push(d.message());
    await d.accept();
  });
  await p.locator("button.claim-btn").first().click();
  await p.waitForTimeout(2500);

  confere("Web3Forms fora do ar: o presente fica marcado",
    await p.locator(".card.claimed").count() > 0, true);
  confere("Web3Forms fora do ar: o convidado não vê erro", alertas, []);
  await ctx.close();
}

/* 7. presente escolhido por outra pessoa: preso para o convidado, livre no modo casal */

{
  // marca num navegador...
  const um = await abre(() => "ok");
  um.p.on("dialog", async (d) => {
    if (d.type() === "prompt") return d.accept("Tia Cida");
    await d.accept();
  });
  await um.p.locator("button.claim-btn").first().click();
  await um.p.waitForTimeout(1500);
  const marcado = await um.p.locator(".card.claimed .card-name").first().textContent();
  await um.ctx.close();

  // ...e abre noutro, sem o localStorage de quem marcou
  const estadoAlheio = {};
  async function comClaimAlheio(query) {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await ctx.route("**/api/config", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ web3forms: [] }) }));
    await ctx.route("**/api/claims", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ mixer: { claimedAt: new Date().toISOString() } }),
      }));
    await p.goto(URL + query, { waitUntil: "networkidle" });
    await p.waitForTimeout(1200);
    return { ctx, p };
  }

  const normal = await comClaimAlheio("");
  confere("presente de outra pessoa aparece como escolhido",
    await normal.p.locator(".card.claimed").count(), 1);
  confere("sem ?casal, ninguém consegue desmarcar",
    await normal.p.locator("button.claim-undo").count(), 0);
  confere("e o endereço não aparece no card dos outros",
    await normal.p.locator(".card-entrega").count(), 0);
  confere("o card diz que tem dono, sem dizer quem",
    (await normal.p.locator(".claim-badge").first().textContent()).trim(), "Já escolhido");
  await normal.ctx.close();

  const casal = await comClaimAlheio("?casal");
  confere("com ?casal, dá para desmarcar o presente de qualquer um",
    await casal.p.locator("button.claim-undo").count(), 1);
  confere("modo casal não mostra o endereço de entrega",
    await casal.p.locator(".card-entrega").count(), 0);
  confere("nem no modo casal o nome aparece",
    (await casal.p.locator(".claim-badge").first().textContent()).trim(), "Já escolhido");
  await casal.ctx.close();
}

await nav.close();
console.log(`\n${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
