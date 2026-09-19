#!/usr/bin/env node
/**
 * Testes do aviso por e-mail. Não manda e-mail nenhum: troca o fetch e o
 * nodemailer por dublês e confere qual provedor foi escolhido e o que seria
 * enviado.
 *
 *   node scripts/testa-avisos.mjs
 */
import { createRequire } from "node:module";
import Module from "node:module";

const require = createRequire(import.meta.url);

let passou = 0;
let falhou = 0;

function confere(nome, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  console.log(`${ok ? "ok  " : "FALHA"}  ${nome}`);
  if (!ok) {
    console.log(`        obtido   ${JSON.stringify(obtido)}`);
    console.log(`        esperado ${JSON.stringify(esperado)}`);
  }
  ok ? passou++ : falhou++;
}

/* dublê do nodemailer, para não abrir conexão SMTP nenhuma */
let smtpEnviado = null;
const cargaOriginal = Module._load;
let blobGravado = null;
Module._load = function (pedido, ...resto) {
  if (pedido === "@vercel/blob") {
    return {
      list: async () => ({ blobs: [] }),
      put: async (caminho, conteudo) => {
        blobGravado = JSON.parse(conteudo);
        return { url: "https://exemplo/claims.json" };
      },
    };
  }
  if (pedido === "nodemailer") {
    return {
      createTransport: (config) => ({
        sendMail: async (msg) => {
          smtpEnviado = { config, msg };
          return { messageId: "teste" };
        },
      }),
    };
  }
  return cargaOriginal.call(this, pedido, ...resto);
};

const claims = require("../api/claims.js");
const { enviaEmail, notificaPlanilha, registraNoSupabase, separaRemetente, destinatarios } = claims;

/* dublê do fetch */
let httpEnviado = null;
const fetchOriginal = globalThis.fetch;
const fetchFalso = async (url, init) => {
  httpEnviado = { url, init, corpo: JSON.parse(init.body) };
  return { ok: true, status: 201, text: async () => "" };
};
globalThis.fetch = fetchFalso;

function limpaAmbiente() {
  for (const k of [
    "SMTP_USER", "SMTP_PASS", "SMTP_HOST", "SMTP_PORT",
    "BREVO_API_KEY", "RESEND_API_KEY", "CLAIM_EMAIL_FROM", "CLAIM_EMAIL_TO",
    "WEB3FORMS_KEYS",
    "SHEETS_WEBHOOK_URL", "SHEETS_WEBHOOK_TOKEN",
    "SUPABASE_URL", "SUPABASE_KEY",
  ]) delete process.env[k];
  smtpEnviado = null;
  httpEnviado = null;
}

const CAMPOS = {
  acao: "Escolhido", presente: "Batedeira", convidado: "Tia Cida",
  total: 3, quando: "19/09/2026 10:15",
};
const AVISO = {
  assunto: "Tia Cida escolheu: Batedeira", html: "<p>oi</p>", texto: "oi", campos: CAMPOS,
};

/* ---------- remetente ---------- */

confere("remetente com nome", separaRemetente("Chá de Casa Nova <avisos@x.com>"),
  { nome: "Chá de Casa Nova", email: "avisos@x.com" });
confere("remetente só e-mail", separaRemetente("avisos@x.com"),
  { nome: "", email: "avisos@x.com" });

/* ---------- destinatários ---------- */

limpaAmbiente();
process.env.CLAIM_EMAIL_TO = " a@a.com , b@b.com ,, ";
confere("destinatários separados e limpos", destinatarios(), ["a@a.com", "b@b.com"]);

/* ---------- nada configurado ---------- */

limpaAmbiente();
confere("sem CLAIM_EMAIL_TO não tenta enviar", await enviaEmail(AVISO), "sem CLAIM_EMAIL_TO");

limpaAmbiente();
process.env.CLAIM_EMAIL_TO = "a@a.com";
confere("sem provedor não tenta enviar", await enviaEmail(AVISO), "nenhum provedor configurado");

/* ---------- Web3Forms: o de menor atrito, vem antes de todos ---------- */

// guarda cada requisição, porque uma chave por destinatário vira várias
let httpTodos = [];
const fetchGravaTudo = async (url, init) => {
  httpEnviado = { url, init, corpo: JSON.parse(init.body) };
  httpTodos.push(httpEnviado);
  return { ok: true, status: 200, text: async () => "" };
};

// Este é o caso real: o Web3Forms é o único provedor que não usa
// CLAIM_EMAIL_TO, porque a chave já diz para quem entregar. Exigir a
// variável aqui desligava justamente ele — foi o que aconteceu em produção,
// e passou batido porque o teste abaixo definia CLAIM_EMAIL_TO sem precisar.
limpaAmbiente();
httpTodos = [];
globalThis.fetch = fetchGravaTudo;
process.env.WEB3FORMS_KEYS = "chave-sozinha";
confere("Web3Forms funciona sem CLAIM_EMAIL_TO",
  await enviaEmail(AVISO), "enviado pelo Web3Forms (1 de 1)");
confere("Web3Forms sem CLAIM_EMAIL_TO: a requisição saiu", httpTodos.length, 1);

// e o contrário continua valendo: sem Web3Forms, quem envia precisa do destino
limpaAmbiente();
process.env.SMTP_USER = "u";
process.env.SMTP_PASS = "p";
confere("os outros provedores seguem exigindo CLAIM_EMAIL_TO",
  await enviaEmail(AVISO), "sem CLAIM_EMAIL_TO");
confere("e nem tentam enviar", smtpEnviado, null);

limpaAmbiente();
httpTodos = [];
globalThis.fetch = fetchGravaTudo;
process.env.CLAIM_EMAIL_TO = "g@hotmail.com";
process.env.WEB3FORMS_KEYS = "chave-do-gui, chave-da-paloma";
process.env.SMTP_USER = "u";
process.env.SMTP_PASS = "p";
process.env.BREVO_API_KEY = "brevo";
confere("Web3Forms vence todos", await enviaEmail(AVISO), "enviado pelo Web3Forms (2 de 2)");
confere("uma requisição por chave", httpTodos.length, 2);
confere("Web3Forms: endpoint", httpTodos[0].url, "https://api.web3forms.com/submit");
confere("Web3Forms: chaves separadas e limpas",
  httpTodos.map((r) => r.corpo.access_key), ["chave-do-gui", "chave-da-paloma"]);
confere("Web3Forms: campos legíveis no e-mail",
  [httpTodos[0].corpo.Presente, httpTodos[0].corpo.Convidado, httpTodos[0].corpo["Total escolhidos"]],
  ["Batedeira", "Tia Cida", "3"]);
confere("Web3Forms: não chamou SMTP", smtpEnviado, null);

// uma chave falhando não pode calar a outra
limpaAmbiente();
httpTodos = [];
process.env.CLAIM_EMAIL_TO = "g@hotmail.com";
process.env.WEB3FORMS_KEYS = "ruim,boa";
let chamada = 0;
globalThis.fetch = async (url, init) => {
  chamada++;
  httpTodos.push({ url, init, corpo: JSON.parse(init.body) });
  return chamada === 1
    ? { ok: false, status: 401, text: async () => "chave invalida" }
    : { ok: true, status: 200, text: async () => "" };
};
confere("uma chave ruim não cala a boa", await enviaEmail(AVISO), "enviado pelo Web3Forms (1 de 2)");
confere("tentou as duas mesmo assim", httpTodos.length, 2);

// todas falhando aí sim é erro
limpaAmbiente();
process.env.CLAIM_EMAIL_TO = "g@hotmail.com";
process.env.WEB3FORMS_KEYS = "ruim1,ruim2";
globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => "chave invalida" });
let erroWeb3 = null;
try { await enviaEmail(AVISO); } catch (e) { erroWeb3 = e.message.slice(0, 44); }
confere("todas falhando vira exceção", erroWeb3, "Web3Forms falhou em todas as chaves — 401: c");
globalThis.fetch = fetchFalso;

/* ---------- SMTP tem prioridade ---------- */

limpaAmbiente();
process.env.CLAIM_EMAIL_TO = "g@hotmail.com,p@gmail.com";
process.env.SMTP_USER = "p@gmail.com";
process.env.SMTP_PASS = "senha-de-app";
process.env.BREVO_API_KEY = "brevo";
process.env.RESEND_API_KEY = "resend";
confere("SMTP vence Brevo e Resend", await enviaEmail(AVISO), "enviado por SMTP");
confere("SMTP: host padrão do Gmail", smtpEnviado.config.host, "smtp.gmail.com");
confere("SMTP: 465 é seguro", [smtpEnviado.config.port, smtpEnviado.config.secure], [465, true]);
confere("SMTP: remetente cai no próprio usuário", smtpEnviado.msg.from, "p@gmail.com");
confere("SMTP: os dois destinatários", smtpEnviado.msg.to, "g@hotmail.com, p@gmail.com");
confere("SMTP: não chamou HTTP", httpEnviado, null);

/* ---------- porta 587 não usa TLS implícito ---------- */

limpaAmbiente();
process.env.CLAIM_EMAIL_TO = "a@a.com";
process.env.SMTP_USER = "u";
process.env.SMTP_PASS = "p";
process.env.SMTP_PORT = "587";
await enviaEmail(AVISO);
confere("porta 587 com secure false", [smtpEnviado.config.port, smtpEnviado.config.secure], [587, false]);

/* ---------- Brevo ---------- */

limpaAmbiente();
process.env.CLAIM_EMAIL_TO = "g@hotmail.com,p@gmail.com";
process.env.CLAIM_EMAIL_FROM = "Chá de Casa Nova <p@gmail.com>";
process.env.BREVO_API_KEY = "chave-brevo";
process.env.RESEND_API_KEY = "resend";
confere("Brevo vence o Resend", await enviaEmail(AVISO), "enviado pela Brevo");
confere("Brevo: endpoint", httpEnviado.url, "https://api.brevo.com/v3/smtp/email");
confere("Brevo: header da chave", httpEnviado.init.headers["api-key"], "chave-brevo");
confere("Brevo: remetente com nome", httpEnviado.corpo.sender,
  { name: "Chá de Casa Nova", email: "p@gmail.com" });
confere("Brevo: destinatários como objetos", httpEnviado.corpo.to,
  [{ email: "g@hotmail.com" }, { email: "p@gmail.com" }]);
confere("Brevo: assunto e html", [httpEnviado.corpo.subject, httpEnviado.corpo.htmlContent],
  [AVISO.assunto, AVISO.html]);

/* ---------- Resend ---------- */

limpaAmbiente();
process.env.CLAIM_EMAIL_TO = "g@hotmail.com";
process.env.CLAIM_EMAIL_FROM = "avisos@meudominio.com";
process.env.RESEND_API_KEY = "chave-resend";
confere("Resend quando é o único", await enviaEmail(AVISO), "enviado pelo Resend");
confere("Resend: endpoint", httpEnviado.url, "https://api.resend.com/emails");
confere("Resend: destinatários como lista", httpEnviado.corpo.to, ["g@hotmail.com"]);

/* ---------- erro do provedor sobe para quem chamou tratar ---------- */

limpaAmbiente();
process.env.CLAIM_EMAIL_TO = "a@a.com";
process.env.BREVO_API_KEY = "chave";
globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => "chave inválida" });
let erro = null;
try { await enviaEmail(AVISO); } catch (e) { erro = e.message; }
confere("erro do provedor vira exceção", erro, "Brevo 401: chave inválida");
globalThis.fetch = fetchFalso;

/* ---------- Supabase ---------- */

const EVENTO = {
  acao: "Escolhido", itemId: "batedeira", presente: "Batedeira",
  convidado: "Tia Cida", total: 3, quando: "19/09/2026 10:15",
};

limpaAmbiente();
confere("sem SUPABASE_URL não tenta gravar", await registraNoSupabase(EVENTO), "Supabase não configurado");

limpaAmbiente();
process.env.SUPABASE_URL = "https://pjcuruezxmukopwzqxks.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_teste";
confere("grava no Supabase", await registraNoSupabase(EVENTO), "registrado no Supabase");
confere("Supabase: endpoint da tabela", httpEnviado.url,
  "https://pjcuruezxmukopwzqxks.supabase.co/rest/v1/escolhas");
confere("Supabase: a chave vai nos dois cabeçalhos",
  [httpEnviado.init.headers.apikey, httpEnviado.init.headers.Authorization],
  ["sb_publishable_teste", "Bearer sb_publishable_teste"]);
confere("Supabase: não pede o registro de volta (a política não dá SELECT)",
  httpEnviado.init.headers.Prefer, "return=minimal");
confere("Supabase: colunas da tabela", httpEnviado.corpo,
  { acao: "Escolhido", presente: "Batedeira", item_id: "batedeira", convidado: "Tia Cida", total: 3 });

// URL com barra no fim não pode virar caminho duplo
limpaAmbiente();
process.env.SUPABASE_URL = "https://x.supabase.co/";
process.env.SUPABASE_KEY = "k";
await registraNoSupabase(EVENTO);
confere("barra sobrando na URL é aparada", httpEnviado.url, "https://x.supabase.co/rest/v1/escolhas");

// desmarcar não tem convidado: a coluna aceita nulo
limpaAmbiente();
process.env.SUPABASE_URL = "https://x.supabase.co";
process.env.SUPABASE_KEY = "k";
await registraNoSupabase({ ...EVENTO, acao: "Desmarcado", convidado: "" });
confere("sem convidado grava nulo, não string vazia", httpEnviado.corpo.convidado, null);

limpaAmbiente();
process.env.SUPABASE_URL = "https://x.supabase.co";
process.env.SUPABASE_KEY = "k";
globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => "chave invalida" });
let erroSupa = null;
try { await registraNoSupabase(EVENTO); } catch (e) { erroSupa = e.message; }
confere("Supabase: erro vira exceção", erroSupa, "Supabase 401: chave invalida");
globalThis.fetch = fetchFalso;

/* ---------- planilha ---------- */

const LINHA = {
  acao: "Escolhido", itemId: "batedeira", presente: "Batedeira",
  convidado: "Tia Cida", total: 3, quando: "18/09/2026 18:40",
};

limpaAmbiente();
confere("sem URL não tenta escrever", await notificaPlanilha(LINHA), "planilha não configurada");

limpaAmbiente();
process.env.SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/abc/exec";
process.env.SHEETS_WEBHOOK_TOKEN = "segredo";
confere("escreve na planilha", await notificaPlanilha(LINHA), "linha acrescentada na planilha");
confere("planilha: URL do Apps Script", httpEnviado.url, process.env.SHEETS_WEBHOOK_URL);
confere("planilha: segue o redirecionamento do Google", httpEnviado.init.redirect, "follow");
confere("planilha: manda a linha inteira mais o token", httpEnviado.corpo,
  { ...LINHA, token: "segredo" });

limpaAmbiente();
process.env.SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/abc/exec";
await notificaPlanilha(LINHA);
confere("planilha: token vazio quando não há", httpEnviado.corpo.token, "");

limpaAmbiente();
process.env.SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/abc/exec";
globalThis.fetch = async () => ({ ok: false, status: 403, text: async () => "sem permissão" });
let erroPlanilha = null;
try { await notificaPlanilha(LINHA); } catch (e) { erroPlanilha = e.message; }
confere("planilha: erro vira exceção", erroPlanilha, "planilha 403: sem permissão");
globalThis.fetch = fetchFalso;

/* ---------- o que mais importa: aviso quebrado não derruba a escolha ---------- */

limpaAmbiente();
process.env.CLAIM_EMAIL_TO = "a@a.com";
process.env.BREVO_API_KEY = "chave-ruim";
process.env.SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/abc/exec";
process.env.SUPABASE_URL = "https://x.supabase.co";
process.env.SUPABASE_KEY = "k";
globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => "fora do ar" });

const respostas = [];
const res = {
  setHeader() {},
  status(codigo) { this._codigo = codigo; return this; },
  json(corpo) { respostas.push({ codigo: this._codigo, corpo }); return this; },
};

const erroConsole = console.error;
console.error = () => {};
await claims({ method: "POST", body: { itemId: "batedeira", name: "Tia Cida", itemName: "Batedeira" } }, res);
console.error = erroConsole;

confere("presente gravado com e-mail, planilha E Supabase falhando", respostas[0].codigo, 200);
confere("e ele aparece como escolhido", respostas[0].corpo.batedeira.name, "Tia Cida");

globalThis.fetch = fetchOriginal;
Module._load = cargaOriginal;

console.log(`\n${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
