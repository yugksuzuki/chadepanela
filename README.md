# Chá de Panela — Paloma & Guilherme

Site simples (HTML/CSS/JS puro, sem build) com a lista de presentes do chá de panela.

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

## Deploy

Site estático sem framework. O `vercel.json` aponta `outputDirectory` para `src/`, então basta importar este repositório no Vercel.

**Deployment Protection precisa ficar desligada.** Com ela ligada, todo domínio
`.vercel.app` do projeto pede login da Vercel — inclusive o de produção — e o
convidado que abrir o link do WhatsApp bate numa tela de login em vez da lista.
Confira em Vercel → Settings → Deployment Protection antes de mandar o link.
