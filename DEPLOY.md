# Deploy da Minerva

Este projeto tem frontend, APIs serverless e persistência compartilhada.

## Deploy atual

- Plataforma: Vercel
- Projeto: `minerva`
- Banco de dados: PostgreSQL gerenciado
- URL pública: https://minerva-liart.vercel.app

## Como funciona

- `npm run build` gera o frontend Vite em `dist/`.
- A Vercel publica os handlers de `api/` como funções serverless.
- `vercel.json` redireciona as rotas da SPA para `index.html`, preservando as rotas por hash.
- `/api/auth/register` cria conta no backend.
- `/api/auth/login` cria uma sessão segura.
- `/api/data` sincroniza os dados do usuário autenticado.
- `/api/library` consulta livros na Open Library sem expor a API diretamente ao navegador.
- `/api/research` consulta publicações acadêmicas no Crossref.
- `/api/holidays` fornece feriados nacionais do Brasil via Nager.Date.
- Admin autenticado vê todos os usuários e dados no painel.
- Usuário comum recebe apenas os próprios dados.
- `npm start` continua disponível apenas para executar o servidor Node local ou em uma hospedagem tradicional.
- Sem `DATABASE_URL`, o desenvolvimento local usa `.data/minerva-db.json`. Esse fallback não deve ser usado em produção serverless porque o sistema de arquivos é efêmero.

## Variáveis de ambiente

Configure estas variáveis na hospedagem:

```bash
DATABASE_URL=postgresql://usuario:senha@host:5432/banco
DATABASE_SSL=true
ADMIN_ACCESS_PASSWORD=troque-esta-senha

# IA da Mine: NanoGPT (modelo principal openai/gpt-6-luna, busca na web e de imagens)
NANOGPT_API_KEY=sua-chave-nanogpt

PUBLIC_APP_ORIGIN=https://minerva-liart.vercel.app
# Opcional, mas recomendado para identificar o app no pool educado das APIs públicas
# PUBLIC_API_CONTACT_EMAIL=contato@seu-dominio.com
```

Para produção, use um Postgres online gerenciado. O servidor cria as tabelas automaticamente:

- `minerva_state`
- `minerva_credentials`
- `minerva_sessions`

## Configuração na Vercel

```bash
npx vercel env add DATABASE_URL production
npx vercel env add DATABASE_SSL production
npx vercel env add ADMIN_ACCESS_PASSWORD production
npx vercel env add NANOGPT_API_KEY production
npx vercel env add PUBLIC_APP_ORIGIN production
# Opcional
npx vercel env add PUBLIC_API_CONTACT_EMAIL production
```

Defina `PUBLIC_APP_ORIGIN` como `https://minerva-liart.vercel.app`. A Vercel executa `npm run build` e publica `dist/`; não há comando de start no deploy serverless.

Depois de alterar variáveis de ambiente, faça um novo deploy para que as funções recebam os valores atualizados.

## Observações importantes

- Não coloque `.env.local` no GitHub.
- Não coloque nenhuma chave de IA no frontend. Configure-as somente no servidor ou na hospedagem.
- A Mine usa NanoGPT, com modelo principal e reserva definidos em `mine/models.mjs`. Configure alertas de orçamento no provedor e mantenha `MINE_MAX_OUTPUT_TOKENS` e os limites de uso.
- O pool `NANOGPT_API_KEYS` aceita chaves separadas por vírgula para rotação. A busca na web usa a mesma API e também consome cota.
- Relatórios locais de auditoria em `.codex-tmp*/` e documentos Word são excluídos do deploy por `.vercelignore`.
- Use uma senha forte e exclusiva em `ADMIN_ACCESS_PASSWORD`.
- Restrinja `DATABASE_URL` e as chaves de IA aos ambientes da Vercel que realmente precisam delas.
- O banco local `.data/` é ignorado pelo Git e não deve ser usado como banco final online.
