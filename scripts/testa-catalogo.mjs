#!/usr/bin/env node
/**
 * Testes do atualiza-catalogo.mjs. Não acessa a internet — roda em HTML de
 * exemplo. Serve pra garantir que, quando o Mercado Livre mudar o HTML, a
 * gente descubra aqui e não com a lista no ar com preço errado.
 *
 *   node scripts/testa-catalogo.mjs
 */
import {
  acharPreco,
  acharTitulo,
  tituloBate,
  lerCatalogo,
  serializar,
} from "./atualiza-catalogo.mjs";

let passou = 0;
let falhou = 0;

/** Compara sem depender da ordem das chaves do objeto. */
function estavel(v) {
  if (Array.isArray(v)) return v.map(estavel);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, estavel(v[k])]));
  }
  return v;
}

function confere(nome, obtido, esperado) {
  const ok = JSON.stringify(estavel(obtido)) === JSON.stringify(estavel(esperado));
  console.log(`${ok ? "ok  " : "FALHA"}  ${nome}`);
  if (!ok) {
    const corta = (v) => JSON.stringify(estavel(v)).slice(0, 400);
    console.log(`        obtido ${corta(obtido)}`);
    console.log(`        esperado ${corta(esperado)}`);
  }
  ok ? passou++ : falhou++;
}

/* ---------- preço ---------- */

confere("preço em JSON-LD", acharPreco('<script>{"price":129.9}</script>'), 129.9);
confere("preço em meta itemprop com milhar", acharPreco('<meta itemprop="price" content="1.299,90">'), 1299.9);
confere("preço em product:price:amount", acharPreco('<meta property="product:price:amount" content="89.90">'), 89.9);
confere(
  "preço renderizado do Mercado Livre",
  acharPreco('<span class="andes-money-amount__fraction">1.249</span><span class="andes-money-amount__cents">90</span>'),
  1249.9
);
confere(
  "preço do Mercado Livre sem centavos",
  acharPreco('<span class="andes-money-amount__fraction">249</span></span>'),
  249
);
confere("página sem preço", acharPreco("<html>sem preco aqui</html>"), null);

/* ---------- título ---------- */

confere(
  "og:title",
  acharTitulo('<meta property="og:title" content="Ferro De Passar Mondial">'),
  "Ferro De Passar Mondial"
);
confere("fallback pro <title>", acharTitulo("<title>Torradeira Philco</title>"), "Torradeira Philco");

/* ---------- o anúncio é do produto certo? ---------- */

confere("pega a foto de mop no ferro de passar", tituloBate("Ferro de passar", "Mop Giratório Flat Mop Balde"), false);
confere("aceita o anúncio certo", tituloBate("Ferro de passar", "Ferro De Passar Roupa A Vapor Mondial"), true);
confere("pega potes no lugar da jarra", tituloBate("Jarra de suco", "Kit 10 Potes De Vidro 370ml"), false);
confere("ignora acento e plural", tituloBate("Xícaras de chá", "Conjunto 6 Xicaras De Cha Porcelana"), true);
confere("sem título, sem veredito", tituloBate("Sofá", null), null);

/* ---------- ida e volta do items.js ---------- */

const catalogo = lerCatalogo();
const copia = JSON.parse(JSON.stringify(catalogo));
copia.ITEMS[0].price = 349.9;
copia.ITEMS[0].precoEm = "2026-09-17";

const texto = serializar(copia.CATEGORIES, copia.ITEMS);
const relido = new Function(`${texto}; return { CATEGORIES, ITEMS };`)();
const ordena = (arr) => [...arr].sort((a, b) => a.id.localeCompare(b.id));

confere("categorias sobrevivem à reescrita", relido.CATEGORIES, copia.CATEGORIES);
confere("nenhum presente se perde", relido.ITEMS.length, copia.ITEMS.length);
confere("todos os campos sobrevivem", ordena(relido.ITEMS), ordena(copia.ITEMS));
confere(
  "o preço gravado volta como número",
  relido.ITEMS.find((i) => i.id === copia.ITEMS[0].id).price,
  349.9
);

console.log(`\n${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
