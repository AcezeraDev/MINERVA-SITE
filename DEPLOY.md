# Deploy da Minerva

Este projeto agora tem frontend, backend e persistencia compartilhada.

## Deploy atual

- Railway project: `minerva`
- Web service: `minerva-web`
- Database service: `Postgres`
- URL publica: https://minerva-web-production-0104.up.railway.app

## Como funciona

- `npm run build` gera o frontend em `dist/`.
- `npm start` inicia `server.mjs`, serve o site e expõe as APIs.
- `/api/auth/register` cria conta no backend.
- `/api/auth/login` cria uma sessão segura.
- `/api/data` sincroniza dados do usuário.
- Admin autenticado vê todos os usuários e dados no painel.
- Usuário comum recebe apenas os próprios dados.
- Sem `DATABASE_URL`, o servidor usa `.data/minerva-db.json` apenas para desenvolvimento local.

## Variáveis de ambiente

Configure estas variáveis na hospedagem:

```bash
DATABASE_URL=postgresql://usuario:senha@host:5432/banco
DATABASE_SSL=true
ADMIN_ACCESS_PASSWORD=troque-esta-senha

# Principal e pool opcional de chaves do OpenRouter
OPENROUTER_API_KEY=sua-chave-openrouter
# OPENROUTER_API_KEYS=chave-projeto-1,chave-projeto-2

# Provedores gratuitos de reserva
# GOOGLE_GEMINI_API_KEY=sua-chave-google-ai-studio
# GOOGLE_GEMINI_API_KEYS=chave-projeto-1,chave-projeto-2
# GROQ_API_KEY=sua-chave-groq
# GROQ_API_KEYS=chave-projeto-1,chave-projeto-2

# Ultima rede de seguranca
NVIDIA_API_KEY=sua-chave-nvidia
# NVIDIA_API_KEYS=chave-projeto-1,chave-projeto-2

PUBLIC_APP_ORIGIN=https://seu-dominio.com
PORT=3000
```

Para produção, use um Postgres online gerenciado. O servidor cria as tabelas automaticamente:

- `minerva_state`
- `minerva_credentials`
- `minerva_sessions`

## Comandos da hospedagem

```bash
npm install
npm run build
npm start
```

Use `npm run build` como comando de build e `npm start` como comando de start.

## Observações importantes

- Não coloque `.env.local` no GitHub.
- Não coloque nenhuma chave de IA no frontend. Configure-as somente no servidor ou na hospedagem.
- Pools de chaves aceitam valores separados por vírgula. As cotas normalmente são por projeto ou organização; para redundância real, use provedores ou projetos independentes.
- Troque `ADMIN_ACCESS_PASSWORD` na hospedagem se quiser uma senha mais forte.
- O banco local `.data/` é ignorado pelo Git e não deve ser usado como banco final online.
