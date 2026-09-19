const { put, list } = require("@vercel/blob");

const CLAIMS_PATH = "claims.json";
const MAX_NAME_LENGTH = 60;
const MAX_ITEM_NAME_LENGTH = 120;

async function readClaims() {
  const { blobs } = await list({ prefix: CLAIMS_PATH, limit: 1 });
  const found = blobs.find((b) => b.pathname === CLAIMS_PATH);
  if (!found) return {};

  const response = await fetch(found.url, { cache: "no-store" });
  if (!response.ok) return {};
  return response.json();
}

async function writeClaims(claims) {
  await put(CLAIMS_PATH, JSON.stringify(claims), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

/* ---------- aviso por e-mail ---------- */

function escapaHtml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function destinatarios() {
  return (process.env.CLAIM_EMAIL_TO || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

/** Aceita "Nome <email@dominio>" ou só "email@dominio". */
function separaRemetente(bruto) {
  const m = /^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/.exec(bruto || "");
  if (m) return { nome: m[1] || "", email: m[2] };
  return { nome: "", email: (bruto || "").trim() };
}

/**
 * Escolhe o provedor pela variável que estiver configurada, nesta ordem:
 *
 *   WEB3FORMS_KEYS          Web3Forms. É o de menor atrito: nenhuma tela de
 *                           permissão, nenhuma senha de app, nenhum domínio —
 *                           a chave chega por e-mail depois de digitar o
 *                           endereço em web3forms.com. Uma chave por
 *                           destinatário, separadas por vírgula, porque no
 *                           plano grátis cada chave manda para um endereço só.
 *   SMTP_USER + SMTP_PASS   SMTP direto (Gmail com senha de app, por exemplo).
 *                           Não exige domínio próprio: o remetente é a própria
 *                           conta, então a mensagem passa pela autenticação do
 *                           Google e não cai em spam.
 *   BREVO_API_KEY           Brevo. Verifica um endereço avulso por código de
 *                           6 dígitos, também sem domínio.
 *   RESEND_API_KEY          Resend. Precisa de domínio verificado para entregar
 *                           em endereço que não seja o dono da conta.
 *
 * Devolve uma descrição do que aconteceu; nunca lança.
 */
async function enviaEmail({ assunto, html, texto, campos }) {
  // O Web3Forms vem antes da exigência de CLAIM_EMAIL_TO de propósito: nele
  // quem define o destinatário é a própria chave, então pedir CLAIM_EMAIL_TO
  // aqui desligaria o único provedor que não precisa dele.
  const chavesWeb3 = (process.env.WEB3FORMS_KEYS || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  const de = process.env.CLAIM_EMAIL_FROM || process.env.SMTP_USER || "";

  if (chavesWeb3.length) {
    // Uma requisição por chave: no plano grátis cada chave entrega num
    // endereço só, então dois destinatários são duas chaves.
    const falhas = [];
    for (const chave of chavesWeb3) {
      try {
        const res = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            access_key: chave,
            subject: assunto,
            // campos livres: o Web3Forms repassa no corpo do e-mail como vierem
            Presente: campos.presente,
            Convidado: campos.convidado || "—",
            "O que aconteceu": campos.acao,
            "Total escolhidos": String(campos.total),
            Quando: campos.quando,
          }),
        });
        if (!res.ok) falhas.push(`${res.status}: ${await res.text()}`);
      } catch (e) {
        falhas.push(String(e));
      }
    }
    // Uma chave que falha não invalida a outra: o importante é alguém ser avisado.
    if (falhas.length === chavesWeb3.length) {
      throw new Error(`Web3Forms falhou em todas as chaves — ${falhas.join(" | ")}`);
    }
    const ok = chavesWeb3.length - falhas.length;
    return `enviado pelo Web3Forms (${ok} de ${chavesWeb3.length})`;
  }

  // Daqui para baixo, todo provedor manda por conta própria e precisa saber
  // para quem.
  const para = destinatarios();
  if (!para.length) return "sem CLAIM_EMAIL_TO";

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    // require aqui dentro: se nodemailer faltar, só este provedor cai,
    // e a escolha do convidado segue gravada do mesmo jeito.
    const nodemailer = require("nodemailer");
    const porta = Number(process.env.SMTP_PORT || 465);
    const transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: porta,
      secure: porta === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    // sem callback: com callback a função serverless pode encerrar antes do envio
    await transporte.sendMail({
      from: de || process.env.SMTP_USER,
      to: para.join(", "),
      subject: assunto,
      text: texto,
      html,
    });
    return "enviado por SMTP";
  }

  if (process.env.BREVO_API_KEY) {
    const remetente = separaRemetente(de);
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: remetente.nome
          ? { name: remetente.nome, email: remetente.email }
          : { email: remetente.email },
        to: para.map((email) => ({ email })),
        subject: assunto,
        htmlContent: html,
        textContent: texto,
      }),
    });
    if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
    return "enviado pela Brevo";
  }

  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: de, to: para, subject: assunto, html, text: texto }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    return "enviado pelo Resend";
  }

  return "nenhum provedor configurado";
}

/**
 * Registra o evento numa tabela do Supabase.
 *
 * A chave em SUPABASE_KEY é uma publishable/anon, e a política de RLS da
 * tabela só permite INSERT: se ela vazar, o pior que acontece é alguém sujar a
 * lista com linhas falsas — não dá para ler quem escolheu o quê, nem apagar,
 * nem alterar. O casal lê pelo painel do Supabase, que entra como dono.
 */
async function registraNoSupabase(dados) {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_KEY;
  if (!url || !chave) return "Supabase não configurado";

  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/escolhas`, {
    method: "POST",
    headers: {
      apikey: chave,
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/json",
      // sem "return=representation": a política não dá SELECT, então pedir o
      // registro de volta faria o insert falhar mesmo tendo gravado
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      acao: dados.acao,
      presente: dados.presente,
      item_id: dados.itemId,
      convidado: dados.convidado || null,
      total: dados.total,
    }),
  });

  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return "registrado no Supabase";
}

/**
 * Acrescenta uma linha na planilha do Google.
 *
 * Do outro lado é um Apps Script publicado como aplicativo web — o código está
 * em scripts/planilha-apps-script.gs. Não envolve senha de app, chave de API
 * nem OAuth: a única credencial é a própria URL, guardada em
 * SHEETS_WEBHOOK_URL, mais um token opcional em SHEETS_WEBHOOK_TOKEN para o
 * caso de a URL vazar.
 *
 * Um aplicativo web do Apps Script responde com um 302 para
 * script.googleusercontent.com; o fetch segue o redirecionamento sozinho.
 */
async function notificaPlanilha(dados) {
  const url = process.env.SHEETS_WEBHOOK_URL;
  if (!url) return "planilha não configurada";

  const res = await fetch(url, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...dados, token: process.env.SHEETS_WEBHOOK_TOKEN || "" }),
  });

  if (!res.ok) throw new Error(`planilha ${res.status}: ${await res.text()}`);
  return "linha acrescentada na planilha";
}

/**
 * Avisa o casal que alguém escolheu (ou desmarcou) um presente.
 *
 * Nunca derruba o pedido: se faltar configuração, ou o provedor responder erro,
 * a escolha do convidado já foi gravada e é isso que importa. O erro vai para
 * os logs da função (Vercel → Logs) em vez de virar uma tela vermelha na festa.
 */
async function avisaPorEmail({ acao, itemId, itemName, guestName, total }) {
  const presente = itemName || itemId;
  const escolheu = acao === "claim";

  const assunto = escolheu
    ? `${guestName} escolheu: ${presente}`
    : `${presente} voltou para a lista`;

  const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const linha = escolheu
    ? `${guestName} escolheu ${presente}.`
    : `${presente} foi desmarcado e está disponível de novo.`;

  const corpo = escolheu
    ? `<p><strong>${escapaHtml(guestName)}</strong> escolheu <strong>${escapaHtml(presente)}</strong>.</p>`
    : `<p><strong>${escapaHtml(presente)}</strong> foi desmarcado e está disponível de novo.</p>`;

  try {
    const resultado = await enviaEmail({
      assunto,
      campos: {
        acao: escolheu ? "Escolhido" : "Desmarcado",
        presente,
        convidado: guestName || "",
        total,
        quando,
      },
      html:
        corpo +
        `<p style="color:#5c5c42">${escapaHtml(String(total))} presente(s) escolhido(s) até agora.<br>` +
        `${escapaHtml(quando)}</p>`,
      texto: `${linha}\n\n${total} presente(s) escolhido(s) até agora.\n${quando}`,
    });
    console.log(`[claims] aviso: ${resultado}`);
  } catch (e) {
    console.error("[claims] falha ao enviar o aviso por e-mail:", e);
  }

  // Canais separados, falhas separadas: um fora do ar não impede os outros, e
  // nenhum deles pode derrubar a escolha do convidado.
  // "linha" acima já é a versão em texto do aviso; este é o evento em si.
  const evento = {
    acao: escolheu ? "Escolhido" : "Desmarcado",
    itemId,
    presente,
    convidado: guestName || "",
    total,
    quando,
  };

  try {
    const resultado = await registraNoSupabase(evento);
    console.log(`[claims] supabase: ${resultado}`);
  } catch (e) {
    console.error("[claims] falha ao registrar no Supabase:", e);
  }

  try {
    const resultado = await notificaPlanilha(evento);
    console.log(`[claims] planilha: ${resultado}`);
  } catch (e) {
    console.error("[claims] falha ao escrever na planilha:", e);
  }
}

module.exports = async (req, res) => {
  if (req.method === "GET") {
    const claims = await readClaims();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(claims);
  }

  if (req.method === "POST") {
    const { itemId, name, itemName, action } = req.body || {};

    if (!itemId || typeof itemId !== "string") {
      return res.status(400).json({ error: "itemId é obrigatório" });
    }

    const claims = await readClaims();
    const nomeDoPresente =
      typeof itemName === "string" ? itemName.trim().slice(0, MAX_ITEM_NAME_LENGTH) : "";

    if (action === "unclaim") {
      delete claims[itemId];
      await writeClaims(claims);
      await avisaPorEmail({
        acao: "unclaim",
        itemId,
        itemName: nomeDoPresente,
        total: Object.keys(claims).length,
      });
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(claims);
    }

    if (claims[itemId]) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(409).json({ error: "Este item já foi escolhido", claims });
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Informe seu nome" });
    }

    const nomeDoConvidado = name.trim().slice(0, MAX_NAME_LENGTH);

    claims[itemId] = {
      name: nomeDoConvidado,
      claimedAt: new Date().toISOString(),
    };

    await writeClaims(claims);
    await avisaPorEmail({
      acao: "claim",
      itemId,
      itemName: nomeDoPresente,
      guestName: nomeDoConvidado,
      total: Object.keys(claims).length,
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(claims);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Método não permitido" });
};

// Exportado só para scripts/testa-avisos.mjs. A função continua sendo o handler.
module.exports.enviaEmail = enviaEmail;
module.exports.notificaPlanilha = notificaPlanilha;
module.exports.registraNoSupabase = registraNoSupabase;
module.exports.separaRemetente = separaRemetente;
module.exports.destinatarios = destinatarios;
