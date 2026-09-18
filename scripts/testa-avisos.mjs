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
const { enviaEmail, notificaPlanilha, separaRemetente, destinatarios } = claims;

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
    "SHEETS_WEBHOOK_URL", "SHEETS_WEBHOOK_TOKEN",
  ]) delete process.env[k];
  smtpEnviado = null;
  httpEnviado = null;
}

const AVISO = { assunto: "Tia Cida escolheu: Batedeira", html: "<p>oi</p>", texto: "oi" };

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

/* ---------- SMTP tem prioridade ---------- */

limpaAmbiente();
process.env.CLAIM_EMAIL_TO = "g@hotmail.com,p@gmail.com";
process.env.SMTP_USER = "p@gmail.com";
process.env.SMTP_PASS = "senha-de-app";
process.env.BREVO_API_KEY = "brevo";
process.env.RESEND_API_KEY = "resend";
confere("SMTP vence os outros", await enviaEmail(AVISO), "enviado por SMTP");
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

confere("o presente foi gravado com e-mail E planilha falhando", respostas[0].codigo, 200);
confere("e ele aparece como escolhido", respostas[0].corpo.batedeira.name, "Tia Cida");

globalThis.fetch = fetchOriginal;
Module._load = cargaOriginal;

console.log(`\n${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
