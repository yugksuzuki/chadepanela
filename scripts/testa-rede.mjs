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
async function abre(aoReceberPost) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  let estado = {};
  let posts = 0;
  await ctx.route("**/api/claims", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(estado) });
    }
    posts++;
    const corpo = JSON.parse(route.request().postData() || "{}");
    const acao = await aoReceberPost(posts, corpo);
    if (acao === "cai") return route.abort("connectionfailed");
    if (corpo.action === "unclaim") delete estado[corpo.itemId];
    else estado[corpo.itemId] = { name: corpo.name, claimedAt: new Date().toISOString() };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(estado) });
  });
  await p.goto(URL, { waitUntil: "networkidle" });
  await p.waitForTimeout(1000);
  return { ctx, p, contaPosts: () => posts };
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

await nav.close();
console.log(`\n${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
