#!/usr/bin/env node
/**
 * Atualiza preço e foto de cada presente a partir do próprio link que o casal
 * escolheu (Mercado Livre / Shopee) e reescreve src/items.js.
 *
 * Rode do seu computador — o ambiente do Claude não alcança esses sites:
 *
 *   node scripts/atualiza-catalogo.mjs             # preço + foto de tudo
 *   node scripts/atualiza-catalogo.mjs --so-precos # só atualiza preço
 *   node scripts/atualiza-catalogo.mjs --so-fotos  # só rebaixa as fotos
 *   node scripts/atualiza-catalogo.mjs --item ferro-de-passar
 *   node scripts/atualiza-catalogo.mjs --dry       # mostra o que faria, não grava
 *
 * Precisa só de Node 18+ (usa fetch nativo). Sem dependências.
 *
 * No fim ele imprime um relatório com três coisas que importam:
 *   ATENÇÃO  — o título do anúncio não bate com o nome do presente (foto errada)
 *   REPETIDA — dois presentes baixaram a mesma foto (links apontam pro mesmo anúncio)
 *   FALHOU   — o site bloqueou ou o anúncio saiu do ar
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ITEMS_JS = path.join(RAIZ, "src", "items.js");
const PASTA_FOTOS = path.join(RAIZ, "src", "assets", "products");

const argv = process.argv.slice(2);
const temFlag = (f) => argv.includes(f);
const valorFlag = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : null;
};

const SO_PRECOS = temFlag("--so-precos");
const SO_FOTOS = temFlag("--so-fotos");
const DRY = temFlag("--dry");
const SO_ITEM = valorFlag("--item");
const PAUSA_MS = Number(valorFlag("--pausa") || 1200);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const HOJE = new Date().toISOString().slice(0, 10);

/* ---------- ler items.js ---------- */

function lerCatalogo() {
  const fonte = fs.readFileSync(ITEMS_JS, "utf8");
  const fn = new Function(`${fonte}; return { CATEGORIES, ITEMS };`);
  return fn();
}

/* ---------- extrair dados da página ---------- */

function semAcento(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function acharPreco(html) {
  // 1) JSON-LD / blobs de estado: "price": 129.9  ou  "price":"129.90"
  const jsonLd = html.match(/"price"\s*:\s*"?(\d+(?:[.,]\d{1,2})?)"?/);
  if (jsonLd) return Number(jsonLd[1].replace(",", "."));

  // 2) <meta itemprop="price" content="129.90">
  const meta = html.match(
    /<meta[^>]+(?:itemprop|property)=["'](?:price|product:price:amount|og:price:amount)["'][^>]+content=["']([\d.,]+)["']/i
  ) || html.match(
    /<meta[^>]+content=["']([\d.,]+)["'][^>]+(?:itemprop|property)=["'](?:price|product:price:amount|og:price:amount)["']/i
  );
  if (meta) return Number(meta[1].replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));

  // 3) Mercado Livre renderizado: <span class="andes-money-amount__fraction">129</span>
  //    seguido opcionalmente de <span class="andes-money-amount__cents">90</span>
  const ml = html.match(
    /andes-money-amount__fraction[^>]*>([\d.]+)<\/span>(?:\s*<span[^>]*andes-money-amount__cents[^>]*>(\d{2})<)?/
  );
  if (ml) {
    const inteiro = ml[1].replace(/\./g, "");
    return Number(`${inteiro}.${ml[2] || "00"}`);
  }

  return null;
}

function acharMeta(html, prop) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
    "i"
  );
  const m = html.match(re) || html.match(alt);
  return m ? m[1] : null;
}

function acharTitulo(html) {
  return (
    acharMeta(html, "og:title") ||
    (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] ||
    null
  );
}

/** O nome do presente aparece no título do anúncio? Pega foto de MOP no ferro de passar. */
function tituloBate(nomeItem, tituloAnuncio) {
  if (!tituloAnuncio) return null;
  const alvo = semAcento(tituloAnuncio);
  const palavras = semAcento(nomeItem)
    .split(/\s+/)
    .filter((p) => p.length > 3 && !["para", "com", "de", "do", "da"].includes(p));
  if (!palavras.length) return null;
  return palavras.some((p) => alvo.includes(p.replace(/s$/, "")));
}

async function baixarPagina(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { html: await res.text(), urlFinal: res.url };
}

async function baixarFoto(urlFoto, id) {
  const res = await fetch(urlFoto, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`foto HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const tipo = res.headers.get("content-type") || "";
  let ext = ".webp";
  if (tipo.includes("jpeg") || tipo.includes("jpg")) ext = ".jpg";
  else if (tipo.includes("png")) ext = ".png";
  else if (urlFoto.includes(".jpg")) ext = ".jpg";

  const destino = path.join(PASTA_FOTOS, id + ext);
  if (!DRY) {
    fs.mkdirSync(PASTA_FOTOS, { recursive: true });
    // limpa versões antigas do mesmo item em outra extensão
    for (const outra of [".webp", ".jpg", ".png"]) {
      const antigo = path.join(PASTA_FOTOS, id + outra);
      if (outra !== ext && fs.existsSync(antigo)) fs.unlinkSync(antigo);
    }
    fs.writeFileSync(destino, buf);
  }
  return {
    caminho: `assets/products/${id}${ext}`,
    hash: crypto.createHash("md5").update(buf).digest("hex"),
    bytes: buf.length,
  };
}

/* ---------- reescrever items.js ---------- */

function serializar(CATEGORIES, ITEMS) {
  const campo = (v) => JSON.stringify(v);
  const linhas = [];
  linhas.push("// Lista de presentes — gerada a partir do CHA.txt");
  linhas.push("// Preço e foto são atualizados por scripts/atualiza-catalogo.mjs.");
  linhas.push("const CATEGORIES = [");
  linhas.push(CATEGORIES.map((c) => `  ${campo(c)}`).join(",\n"));
  linhas.push("];");
  linhas.push("");
  linhas.push("const ITEMS = [");

  CATEGORIES.forEach((cat, i) => {
    const doGrupo = ITEMS.filter((it) => it.category === cat);
    if (!doGrupo.length) return;
    if (i > 0) linhas.push("");
    for (const it of doGrupo) {
      const partes = [
        `id: ${campo(it.id)}`,
        `name: ${campo(it.name)}`,
        `category: ${campo(it.category)}`,
      ];
      if (it.image) partes.push(`image: ${campo(it.image)}`);
      if (typeof it.price === "number") partes.push(`price: ${it.price.toFixed(2)}`);
      if (it.precoEm) partes.push(`precoEm: ${campo(it.precoEm)}`);
      partes.push(
        `links: [${it.links
          .map((l) => `{ label: ${campo(l.label)}, url: ${campo(l.url)} }`)
          .join(", ")}]`
      );
      linhas.push(`  { ${partes.join(", ")} },`);
    }
  });

  linhas.push("];");
  linhas.push("");
  return linhas.join("\n");
}

/* ---------- rodar ---------- */

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { CATEGORIES, ITEMS } = lerCatalogo();
  const alvos = ITEMS.filter(
    (it) => it.links.length > 0 && (!SO_ITEM || it.id === SO_ITEM)
  );

  console.log(
    `${alvos.length} presentes com link` +
      (SO_ITEM ? ` (filtrado por --item ${SO_ITEM})` : "") +
      (DRY ? " — modo --dry, nada será gravado" : "")
  );

  const avisos = [];
  const falhas = [];
  const porHash = new Map();
  let comPreco = 0;
  let comFoto = 0;

  for (const item of alvos) {
    const url = item.links[0].url;
    process.stdout.write(`  ${item.name.padEnd(34)} `);
    try {
      const { html, urlFinal } = await baixarPagina(url);
      const titulo = acharTitulo(html);
      const bate = tituloBate(item.name, titulo);

      if (bate === false) {
        avisos.push(
          `ATENÇÃO  ${item.id}: o anúncio se chama "${(titulo || "").slice(0, 70)}"`
        );
      }

      let saida = [];

      if (!SO_FOTOS) {
        const preco = acharPreco(html);
        if (preco && preco > 0) {
          item.price = preco;
          item.precoEm = HOJE;
          comPreco++;
          saida.push(`R$ ${preco.toFixed(2).replace(".", ",")}`);
        } else {
          saida.push("preço não encontrado");
        }
      }

      if (!SO_PRECOS) {
        const foto = acharMeta(html, "og:image");
        if (foto) {
          const r = await baixarFoto(foto, item.id);
          item.image = r.caminho;
          comFoto++;
          saida.push(`foto ${(r.bytes / 1024).toFixed(0)}kB`);
          const igual = porHash.get(r.hash);
          if (igual) {
            avisos.push(
              `REPETIDA ${item.id} e ${igual}: mesma foto — os links apontam pro mesmo anúncio`
            );
          } else {
            porHash.set(r.hash, item.id);
          }
        } else {
          saida.push("sem og:image");
        }
      }

      if (urlFinal && !urlFinal.includes("meli.la")) saida.push("");
      console.log(saida.filter(Boolean).join("  ·  "));
    } catch (e) {
      console.log(`FALHOU (${e.message})`);
      falhas.push(`FALHOU   ${item.id}: ${e.message} — ${url}`);
    }
    await espera(PAUSA_MS);
  }

  const semFoto = ITEMS.filter((it) => !it.image);

  if (!DRY) {
    fs.writeFileSync(ITEMS_JS, serializar(CATEGORIES, ITEMS), "utf8");
    console.log(`\nsrc/items.js reescrito.`);
  }

  console.log(
    `\n${comPreco} preços e ${comFoto} fotos atualizados de ${alvos.length} presentes.`
  );

  if (avisos.length || falhas.length) {
    console.log("\nO que precisa de olho humano:\n");
    for (const l of [...avisos, ...falhas]) console.log("  " + l);
  }

  if (semFoto.length) {
    console.log(
      `\n${semFoto.length} presentes continuam sem foto (não têm link de loja):`
    );
    for (const it of semFoto) console.log(`  ${it.id} — ${it.name}`);
    console.log(
      `\n  Pra dar foto a eles: salve a imagem em src/assets/products/<id>.webp\n` +
        `  e acrescente image: "assets/products/<id>.webp" na linha do item.`
    );
  }
}

const executadoDireto =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (executadoDireto) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

// exportado para os testes em scripts/testa-catalogo.mjs
export { lerCatalogo, serializar, acharPreco, acharTitulo, acharMeta, tituloBate };
