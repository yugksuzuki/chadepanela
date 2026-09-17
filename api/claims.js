const { put, list } = require("@vercel/blob");

const CLAIMS_PATH = "claims.json";
const MAX_NAME_LENGTH = 60;

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

module.exports = async (req, res) => {
  if (req.method === "GET") {
    const claims = await readClaims();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(claims);
  }

  if (req.method === "POST") {
    const { itemId, name, action } = req.body || {};

    if (!itemId || typeof itemId !== "string") {
      return res.status(400).json({ error: "itemId é obrigatório" });
    }

    const claims = await readClaims();

    if (action === "unclaim") {
      delete claims[itemId];
      await writeClaims(claims);
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

    claims[itemId] = {
      name: name.trim().slice(0, MAX_NAME_LENGTH),
      claimedAt: new Date().toISOString(),
    };

    await writeClaims(claims);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(claims);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Método não permitido" });
};
