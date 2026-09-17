# Chá de Panela — Paloma & Guilherme

Site simples (HTML/CSS/JS puro, sem build) com a lista de presentes do chá de panela.

## Estrutura

- `src/index.html` — página principal
- `src/styles.css` — estilos
- `src/items.js` — lista de categorias e presentes
- `src/script.js` — renderização da lista e filtro por categoria

## Rodando localmente

Basta abrir `src/index.html` no navegador, ou servir a pasta `src/` com qualquer servidor estático:

```bash
npx serve src
```

## Deploy

Site estático sem framework. O `vercel.json` aponta `outputDirectory` para `src/`, então basta importar este repositório no Vercel.
