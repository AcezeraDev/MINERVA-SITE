# Minerva

Plataforma educacional interativa com inteligência artificial, jogos e experiências de aprendizagem.

Produção: https://minerva-liart.vercel.app

## Recursos

- Assistente Mine na NanoGPT: um modelo só (`openai/gpt-6-luna`), reserva interna automática, pesquisa na web com fontes citadas e fotos da Wikipédia com reserva na internet.
- Jogos educacionais interativos com XP, progressão e desafios.
- Área administrativa e acompanhamento de dados.
- Busca de livros e publicações com Open Library e Crossref.
- Feriados nacionais do Brasil integrados à agenda com Nager.Date.
- Interface responsiva construída com React, TypeScript e animações.
- API Node.js compatível com execução local e deploy na Vercel.

## Executar localmente

Requisitos: Node.js 20 ou superior.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Preencha apenas as variáveis necessárias em `.env.local`. Esse arquivo é ignorado pelo Git e não deve ser publicado.

## Comandos

```bash
npm test       # executa os testes automatizados
npm run build  # gera o build de produção
npm start      # inicia o servidor Node.js
```

### Atualização 2.0.1 — Mine

O chat preserva mensagens de até 12.000 caracteres e blocos de código, ensina idiomas com exemplos no idioma estudado e explica o XP a partir das regras do aplicativo. A pesquisa considera cargos atuais e continuações de conversa; traduções e ações na conta não disparam busca apenas por conter “ontem” ou “agora”. Pedidos de fontes oficiais usam consultas dirigidas, verificação de domínio e um refinamento dentro do mesmo limite de tempo.

Os testes automatizados incluem regressões para essas correções. Para avaliar respostas reais, inicie o servidor e rode `npm run test:mine:live -- --endpoint http://127.0.0.1:5187/api/mine/chat`. O comando faz chamadas reais que consomem cota, usa dados fictícios e salva respostas para revisão. Use `--only ingles,codigo,xp` para selecionar cenários e `--output caminho.json` para escolher o relatório. Os critérios automáticos são verificações específicas, não uma garantia geral de precisão da IA.

As instruções de publicação e configuração de ambiente estão em [DEPLOY.md](DEPLOY.md).

## Tecnologias

React, TypeScript, Vite, Tailwind CSS, Framer Motion, GSAP, Three.js, Node.js e PostgreSQL.
