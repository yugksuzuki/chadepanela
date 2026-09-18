/**
 * Preenche a planilha "Chá de Casa Nova — Presentes escolhidos" a cada presente
 * que um convidado marca ou desmarca no site.
 *
 * Como ligar isto (leva uns 5 minutos, tudo pelo navegador):
 *
 * 1. Abra script.google.com → Novo projeto.
 * 2. Apague o conteúdo e cole este arquivo inteiro.
 * 3. Salve (o nome do projeto pode ser "Chá de Casa Nova").
 * 4. Implantar → Nova implantação → engrenagem → Aplicativo da web.
 *      Executar como:   Eu
 *      Quem tem acesso: Qualquer pessoa
 *    Isso é necessário porque quem chama é o site, não uma pessoa logada.
 *    Autorize quando o Google pedir (é a sua conta escrevendo na sua planilha).
 * 5. Copie a URL que termina em /exec.
 * 6. Na Vercel → Settings → Environment Variables → Production:
 *      SHEETS_WEBHOOK_URL    a URL /exec
 *      SHEETS_WEBHOOK_TOKEN  uma palavra secreta qualquer (opcional)
 *    Se usar o token, ponha a mesma palavra em TOKEN aqui embaixo.
 *
 * Para ser avisado: na planilha, Ferramentas → Regras de notificação →
 * "Qualquer alteração" + "Enviar e-mail imediatamente". Dá para fazer isso em
 * cada conta que deve receber, bastando compartilhar a planilha com ela.
 */

// A planilha criada para isto. Para usar outra, troque pelo id que aparece na
// URL dela, entre /d/ e /edit.
var ID_DA_PLANILHA = "10_tyTFweZ3ueuLaMrIscl35hmGgM9BR745VUvLb9Rg4";

// Deixe "" para não exigir token. Se preencher, use o mesmo valor em
// SHEETS_WEBHOOK_TOKEN na Vercel.
var TOKEN = "";

var CABECALHO = [
  "Quando",
  "O que aconteceu",
  "Presente",
  "Convidado",
  "Total escolhidos",
  "id do item",
];

function doPost(e) {
  try {
    var dados = JSON.parse(e.postData.contents);

    if (TOKEN && dados.token !== TOKEN) {
      return responde({ ok: false, erro: "token invalido" });
    }

    var aba = SpreadsheetApp.openById(ID_DA_PLANILHA).getSheets()[0];

    // primeira chamada numa planilha vazia: escreve o cabeçalho e congela a linha
    if (aba.getLastRow() === 0) {
      aba.appendRow(CABECALHO);
      aba.setFrozenRows(1);
      aba.getRange(1, 1, 1, CABECALHO.length).setFontWeight("bold");
    }

    aba.appendRow([
      dados.quando || new Date(),
      dados.acao || "",
      dados.presente || dados.itemId || "",
      dados.convidado || "",
      dados.total === undefined ? "" : dados.total,
      dados.itemId || "",
    ]);

    return responde({ ok: true });
  } catch (erro) {
    // Devolve o erro em vez de estourar: assim ele aparece nos logs da Vercel
    // e não vira uma página de erro do Google.
    return responde({ ok: false, erro: String(erro) });
  }
}

function doGet() {
  return responde({ ok: true, aviso: "este endereço só aceita POST" });
}

function responde(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * Roda uma vez pelo editor (Executar → testa) para conferir que o id da
 * planilha está certo e que a autorização foi concedida, antes de depender
 * disso na festa.
 */
function testa() {
  var resposta = doPost({
    postData: {
      contents: JSON.stringify({
        token: TOKEN,
        acao: "Escolhido",
        presente: "Teste — pode apagar esta linha",
        convidado: "Teste",
        total: 0,
        itemId: "teste",
        quando: new Date().toLocaleString("pt-BR"),
      }),
    },
  });
  Logger.log(resposta.getContent());
}
