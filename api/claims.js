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

/**
 * Avisa o casal que alguém escolheu (ou desmarcou) um presente.
 *
 * Nunca derruba o pedido: se faltar configuração, ou o Resend responder erro,
 * a escolha do convidado já foi gravada e é isso que importa. O erro vai para
 * os logs da função (Vercel → Logs) em vez de virar uma tela vermelha na festa.
 *
 * Configuração, em Vercel → Settings → Environment Variables:
 *   RESEND_API_KEY     chave da conta em resend.com
 *   CLAIM_EMAIL_FROM   remetente verificado, ex.: "Chá de Casa Nova <avisos@seudominio.com>"
 *   CLAIM_EMAIL_TO     destinatários separados por vírgula
 */
async function avisaPorEmail({ acao, itemId, itemName, guestName, total }) {
  const chave = process.env.RESEND_API_KEY;
  const de = process.env.CLAIM_EMAIL_FROM;
  const para = destinatarios();

  if (!chave || !de || !para.length) {
    console.log("[claims] aviso por e-mail desligado (falta RESEND_API_KEY, CLAIM_EMAIL_FROM ou CLAIM_EMAIL_TO)");
    return;
  }

  const presente = itemName || itemId;
  const escolheu = acao === "claim";
  const assunto = escolheu
    ? `${guestName} escolheu: ${presente}`
    : `${presente} voltou para a lista`;

  const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const corpo = escolheu
    ? `<p><strong>${escapaHtml(guestName)}</strong> escolheu <strong>${escapaHtml(presente)}</strong>.</p>`
    : `<p><strong>${escapaHtml(presente)}</strong> foi desmarcado e está disponível de novo.</p>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: de,
        to: para,
        subject: assunto,
        html:
          corpo +
          `<p style="color:#5c5c42">${escapaHtml(String(total))} presente(s) escolhido(s) até agora.<br>` +
          `${escapaHtml(quando)}</p>`,
      }),
    });

    if (!res.ok) {
      console.error(`[claims] Resend respondeu ${res.status}: ${await res.text()}`);
    }
  } catch (e) {
    console.error("[claims] falha ao enviar o aviso por e-mail:", e);
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
