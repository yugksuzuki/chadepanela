/**
 * Configuração que o navegador do convidado precisa conhecer.
 *
 * Hoje é só a chave do Web3Forms. Ela mora aqui, e não dentro de src/, porque
 * o site é estático e não tem build: um valor escrito no arquivo estaria no
 * repositório público, onde robô de spam encontra e queima a cota de 250
 * envios por mês. Servida por aqui, ela continua pública para quem abre a
 * página — que é como o Web3Forms foi feito para funcionar — mas não fica
 * catalogada no GitHub.
 */
module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const web3forms = (process.env.WEB3FORMS_KEYS || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  // Cache curto: a chave quase nunca muda, mas trocá-la não pode exigir
  // que todo convidado limpe o navegador.
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.status(200).json({ web3forms });
};
