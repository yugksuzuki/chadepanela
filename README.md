# Chá de Casa Nova — Paloma & Guilherme

Site simples (HTML/CSS/JS puro, sem build) com a lista de presentes do chá de casa nova.

## Estrutura

- `src/index.html` — página principal
- `src/styles.css` — estilos
- `src/items.js` — lista de categorias e presentes (nome, foto, preço, links)
- `src/script.js` — renderização, filtro por categoria e por faixa de preço
- `src/assets/products/` — foto de cada presente
- `api/claims.js` — função serverless do "marcar como escolhido"
- `scripts/atualiza-catalogo.mjs` — busca preço e foto nos links do casal

## Preço e foto dos presentes

Cada presente em `src/items.js` pode ter `price` (número em reais) e `precoEm`
(a data da consulta, `AAAA-MM-DD`). Enquanto nenhum presente tiver preço, a
barra de faixas e a ordenação por preço não aparecem na página — não faz
sentido mostrar um controle que não muda nada.

Para preencher os dois de uma vez, a partir dos próprios links do Mercado
Livre e da Shopee:

```bash
node scripts/atualiza-catalogo.mjs
```

Ele abre cada anúncio, lê o preço e a foto (`og:image`), salva a imagem em
`src/assets/products/<id>.webp` e reescreve `src/items.js`. Rode de novo perto
da data da festa para atualizar os preços.

Outras formas de rodar:

```bash
node scripts/atualiza-catalogo.mjs --so-precos          # não mexe nas fotos
node scripts/atualiza-catalogo.mjs --so-fotos           # não mexe nos preços
node scripts/atualiza-catalogo.mjs --item ferro-de-passar
node scripts/atualiza-catalogo.mjs --dry                # só mostra o que faria
```

No fim ele lista o que precisa de olho humano:

- **ATENÇÃO** — o título do anúncio não bate com o nome do presente. Quase
  sempre significa foto errada: foi assim que o ferro de passar acabou com
  foto de mop.
- **REPETIDA** — dois presentes baixaram a mesma foto, porque os dois links
  apontam para o mesmo anúncio. Aí o link de um deles é que está errado.
- **FALHOU** — o site bloqueou ou o anúncio saiu do ar. A Shopee costuma cair
  aqui; nesse caso salve a foto na mão em `src/assets/products/<id>.webp`.

Os parsers têm teste, para descobrirmos aqui quando o Mercado Livre mudar o
HTML (e não com a lista no ar mostrando preço errado):

```bash
node scripts/testa-catalogo.mjs
```

## Rodando localmente

Basta abrir `src/index.html` no navegador, ou servir a pasta `src/` com qualquer servidor estático:

```bash
npx serve src
```

## Endereço de entrega

O endereço fica em `ENDERECO_ENTREGA`, no topo de `src/script.js`, e aparece em
dois lugares: na seção "Onde enviar o presente" antes do rodapé, e dentro do
card assim que o convidado marca o presente como escolhido — que é a hora em
que ele precisa do endereço. Os dois têm botão de copiar, com seleção de texto
como plano B onde a área de transferência não está disponível.

Trocar o endereço é trocar essa constante; nada mais depende dela.

## Aviso por e-mail a cada presente escolhido

Quando alguém marca (ou desmarca) um presente, `api/claims.js` manda um e-mail
avisando quem escolheu o quê. O provedor é escolhido pela variável que estiver
configurada, nesta ordem — basta configurar **um** deles.

Todas as variáveis vão em Vercel → Settings → Environment Variables, no
ambiente Production. Depois de salvar, é preciso um novo deploy para a função
enxergar as variáveis.

Comum aos provedores que enviam por conta própria (todos menos o Web3Forms,
que descobre o destino pela chave):

| Variável | O que é |
|---|---|
| `CLAIM_EMAIL_TO` | destinatários, separados por vírgula |
| `CLAIM_EMAIL_FROM` | remetente, `Nome <email>` ou só o e-mail |

### 1. Web3Forms — o de menor atrito

| Variável | O que é |
|---|---|
| `WEB3FORMS_KEYS` | uma chave por destinatário, separadas por vírgula |

Em [web3forms.com](https://web3forms.com) você digita o e-mail e a chave chega
nele. Não há tela de permissão do Google, senha de app, domínio nem conta com
senha. No plano grátis cada chave entrega num endereço só e o limite é 250
envios por mês — a lista tem 63 presentes, então sobra.

Como cada chave atende um endereço, dois destinatários são duas chaves, e o
código faz uma requisição para cada. Uma chave com problema não cala a outra:
só vira erro se todas falharem. `CLAIM_EMAIL_TO` e `CLAIM_EMAIL_FROM` não são
usados por este provedor — quem define o destino é a própria chave.

### 2. SMTP direto — não precisa de domínio nem de cadastro

| Variável | O que é |
|---|---|
| `SMTP_USER` | o e-mail que envia, ex.: uma conta do Gmail |
| `SMTP_PASS` | senha de app dessa conta (não a senha normal) |
| `SMTP_HOST` | opcional, padrão `smtp.gmail.com` |
| `SMTP_PORT` | opcional, padrão `465` |

No Gmail: ative a verificação em duas etapas e gere uma **senha de app** em
myaccount.google.com/apppasswords. `CLAIM_EMAIL_FROM` pode ficar de fora — aí
o remetente é o próprio `SMTP_USER`.

É a rota mais confiável sem domínio: a mensagem sai autenticada pelo Google,
com o remetente sendo de fato aquela conta, então não cai em spam. A Vercel
bloqueia a porta 25 mas deixa 465 e 587 abertas, que é o que isto usa.

### 3. Brevo — sem domínio, mas com cadastro

| Variável | O que é |
|---|---|
| `BREVO_API_KEY` | chave de uma conta em brevo.com |

A Brevo verifica um endereço avulso por código de 6 dígitos, sem exigir
domínio. Grátis até 300 e-mails por dia. Dois poréns: conta nova passa por uma
aprovação manual antes de liberar envio, e como o remetente é um endereço de
webmail sem autenticação de domínio, vale conferir a caixa de spam nos
primeiros envios.

### 4. Resend — só com domínio próprio

| Variável | O que é |
|---|---|
| `RESEND_API_KEY` | chave de uma conta em resend.com |

Sem domínio verificado, o Resend só entrega no e-mail dono da conta. Se um dia
houver um domínio, é a opção mais limpa.

## Planilha do Google que se preenche sozinha

Cada presente marcado ou desmarcado vira uma linha numa planilha do Google.
É o caminho mais simples de ser avisado sem senha de app, chave de API ou
domínio: a única credencial é uma URL.

Planilha já criada: **Chá de Casa Nova — Presentes escolhidos**
(`10_tyTFweZ3ueuLaMrIscl35hmGgM9BR745VUvLb9Rg4`)

Colunas: quando, o que aconteceu, presente, convidado, total escolhidos, id do
item.

O passo a passo está no cabeçalho de `scripts/planilha-apps-script.gs`, mas em
resumo: cola aquele arquivo em script.google.com, publica como aplicativo web
("Executar como: Eu", "Quem tem acesso: Qualquer pessoa"), e põe a URL `/exec`
na Vercel:

| Variável | O que é |
|---|---|
| `SHEETS_WEBHOOK_URL` | a URL que termina em `/exec` |
| `SHEETS_WEBHOOK_TOKEN` | opcional, uma palavra secreta; a mesma no `.gs` |

"Qualquer pessoa" assusta, mas é necessário: quem chama é o site, não uma
pessoa logada. O token existe para o caso de a URL vazar — sem ele, quem
descobrisse a URL conseguiria escrever linhas na planilha.

### Ser avisado a cada linha nova

Na planilha: **Ferramentas → Regras de notificação → Qualquer alteração →
Enviar e-mail imediatamente**. Cada pessoa configura a sua, bastando que a
planilha esteja compartilhada com ela. É o Google mandando o e-mail, então não
há remetente para verificar nem risco de cair em spam.

### Como isso se comporta quando dá errado

Os dois canais — e-mail e planilha — são independentes: um fora do ar não
impede o outro, e nenhum dos dois derruba a escolha do convidado.

Sem nenhuma dessas variáveis, a função registra no log que o aviso está
desligado e segue normalmente. Se o provedor responder erro, o erro vai para
Vercel → Logs e o convidado não vê nada: a escolha dele já foi gravada antes de
o e-mail ser tentado, e é isso que importa durante a festa. Há teste cobrindo
exatamente esse caso.

Os e-mails ficam em variável de ambiente de propósito: endereço de e-mail em
texto puro num repositório público vira alvo de robô de spam.

```bash
node scripts/testa-avisos.mjs
```

Escolhe o provedor certo, monta o corpo, monta a linha da planilha e garante
que falha de aviso não derruba a escolha — tudo com dublês, sem mandar e-mail
nem escrever em planilha nenhuma.

## Deploy

Site estático sem framework. O `vercel.json` aponta `outputDirectory` para `src/`, então basta importar este repositório no Vercel.

**Deployment Protection precisa ficar desligada.** Com ela ligada, todo domínio
`.vercel.app` do projeto pede login da Vercel — inclusive o de produção — e o
convidado que abrir o link do WhatsApp bate numa tela de login em vez da lista.
Confira em Vercel → Settings → Deployment Protection antes de mandar o link.
