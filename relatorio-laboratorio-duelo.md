# Relatório: abas Laboratório e Duelo

**Minerva · 19 de novembro de 2026**

Fiz a análise de duas formas: li o código das duas abas (tela, regras e servidor) e testei no site rodando nesta máquina, com banco local e contas de teste. Usei duas larguras: desktop e celular (375 px). No Duelo também chamei a API direto, com dois jogadores, para testar casos difíceis de reproduzir pela tela.

Cada item diz como foi confirmado:

- **Testado:** reproduzi no navegador ou na API.
- **Pelo código:** li o código e o comportamento é certo, mas não reproduzi na tela.

Nada foi corrigido ainda.

---

## Resumo

| Prioridade | Aba | Problema | Como confirmei |
|---|---|---|---|
| Alta | Duelo | Cada consulta (1 por segundo, por jogador) carrega o banco inteiro do site | Pelo código |
| Alta | Duelo | Sair logo no começo contra a Mine dá 10 XP e conta para as conquistas | Testado |
| Alta | Laboratório | Mexer no controle durante o voo da bola conta o desafio sem lançar de novo | Testado |
| Alta | Laboratório | O desafio paga XP de novo no dia seguinte só de abrir a aba | Testado |
| Média | Duelo | Enter no campo do tema cria duas salas e gasta duas da cota | Testado (API) e pelo código |
| Média | Duelo | Celular: só a alternativa A aparece, e o botão da Mine cobre o texto | Testado |
| Média | Duelo | Trocar de app por 2 min é derrota; adversário que sumiu obriga o outro a jogar sozinho por 2 min | Testado (API) |
| Média | Duelo | O XP é criado pelo navegador e não é conferido com o resultado guardado no servidor | Pelo código |
| Média | Ambas | A tela mostra "+XP" mesmo depois do limite do dia, quando o XP já não conta | Pelo código |
| Média | Laboratório | Celular: os 4 cartões empurram a simulação para baixo, e tocar num cartão não rola até ela | Testado |
| Baixa | Laboratório | Circuito: as cargas em movimento passam por cima dos nomes dos resistores | Testado |
| Baixa | Duelo | A revisão mostra "marcou D", mas não o texto da alternativa D | Testado |
| Baixa | Duelo | O leitor de tela anuncia o cronômetro a cada segundo | Pelo código |
| Baixa | Duelo | O campo de código aceita O, 0, I, 1 e L, que o servidor recusa | Testado (API) |
| Baixa | Ambas | Outros detalhes (lista no fim) | Pelo código |

---

## Laboratório

### 1. Desafio do alvo conta sem lançar de novo · Alta · Testado

**O que acontece:** ao apertar "Lançar", o código agenda um aviso de "a bola caiu" para o fim do voo. Mexer em um controle apaga o lançamento, mas não cancela esse aviso. Quando ele dispara, os valores novos contam como se tivessem sido lançados.

**Como reproduzi:**
1. Lancei com 18 m/s. O alcance foi de cerca de 32 m, longe do alvo.
2. 0,3 s depois, mudei a velocidade para 20 m/s.
3. O desafio apareceu como "Cumprido! +10 XP", e a sessão foi gravada, sem nenhum lançamento com 20 m/s.

**Onde:** `src/laboratorio/LaboratorioView.tsx`, função `lancar`.

**Como corrigir:** guardar o temporizador numa ref e cancelá-lo em `mudar`, em "voltar ao começo", em `trocarExp` e ao sair da aba. Outra opção é dar um número a cada lançamento e só aceitar o aviso do lançamento atual.

### 2. XP de novo no dia seguinte, sem fazer nada · Alta · Testado

**O que acontece:** os valores dos controles ficam salvos no aparelho. Se eles já cumprem um desafio, a aba conta esse desafio assim que abre num dia novo.

**Como reproduzi:** deixei a rampa em 35° com μ = 0,75 e marquei o registro de desafios como sendo de ontem. Ao recarregar a página, apareceu "Cumprido! +10 XP" e uma sessão nova.

**Onde:** o efeito que registra o desafio cumprido (`useEffect` com `cumprido`).

**Como corrigir:** contar só quando o valor muda por ação do aluno. Por exemplo, guardar uma flag "mexeu desde que abriu" e exigir que ela esteja ligada. No lançamento isso já vem do item 1, com `lancou`.

*Observação:* no modo de desenvolvimento, esse mesmo efeito gravou a sessão duas vezes. Isso acontece porque o React roda os efeitos duas vezes nesse modo. No site publicado deve ser uma vez só, mas mostra que conceder XP dentro de um efeito sem uma trava (ref) é frágil.

### 3. "+10 XP" aparece mesmo acima do limite · Média · Pelo código

**O que acontece:** a partir do 7º desafio do dia, o código grava a sessão com 0 XP, mas a tela continua mostrando "Cumprido! +10 XP".

**Como corrigir:** mostrar "Cumprido! (limite de XP de hoje atingido)" quando `ids.length > labPorDia`.

### 4. Celular: a simulação fica longe dos cartões · Média · Testado

**O que acontece:** a 375 px, os 4 cartões de experimento ficam empilhados e ocupam cerca de 600 px. A bancada só começa depois de muita rolagem, e tocar em outro experimento não leva o aluno até ela.

**Como corrigir:** no celular, transformar os cartões numa faixa horizontal compacta (só ícone e nome), ou rolar até `.lab-bancada` ao trocar de experimento.

### 5. Circuito: cargas por cima dos nomes dos resistores · Baixa · Testado

**O que acontece:** as bolinhas que mostram a corrente são desenhadas depois dos resistores. Por isso passam por cima de "R1 6 Ω" e "R2 3 Ω", e o texto fica parcialmente coberto. No modo paralelo, no celular, o fio vertical do ramo também encosta na caixa do resistor.

**Como corrigir:** desenhar as cargas antes dos resistores e da lâmpada, ou pular as cargas no trecho ocupado pela caixa do resistor.

### 6. Outros detalhes do Laboratório · Baixa · Pelo código

- **Béquer vazio:** com 0 mL de ácido e 0 mL de base, a tela diz "pH 7, neutra, roxo". Melhor mostrar "béquer vazio".
- **Lâmpada:** o brilho segue a potência total, mas a lâmpada não entra na conta do circuito. Uma frase no rodapé explicaria isso, ou ela poderia ser trocada por um "medidor de potência".
- **Cartão "Continuar de onde parou" no Início:** as sessões do Laboratório e do Duelo usam `subjectId` "laboratorio" e "duelo", que não são matérias de verdade. Quando a última sessão é uma delas, o cartão some em vez de mostrar a última sessão válida.
- **Acessibilidade das abas de experimento:** os botões têm `role="tab"`, mas não há `tabpanel` nem navegação pelas setas do teclado.
- **O que conferi e está certo:** as fórmulas e os sentidos das forças (peso, normal, atrito), a lei de Ohm em série e em paralelo, o pH da titulação forte com forte e o alcance e a altura do lançamento. Os números da tela batem com o desenho.

---

## Duelo

### 7. Cada consulta carrega o banco inteiro · Alta · Pelo código

**O que acontece:** toda chamada a `/api/duelo` roda `readStore()` só para descobrir o nome de quem chamou. Essa função lê a linha única `minerva_state`, que guarda o site inteiro, com anexos em base64, e também todas as senhas criptografadas. A tela consulta a cada 1 s durante a partida e também durante os até 15 minutos de sala esperando. O saguão consulta a cada 6 s.

**Por que importa:** dois jogadores fazem cerca de 120 leituras do banco inteiro por minuto, e o custo cresce com o tamanho do banco. Aqui, com o banco local pequeno, cada consulta levou 15 ms. Em produção, no Neon, deve ser bem mais lento e mais caro. **Isso eu não medi em produção.**

**Além disso:** cada consulta abre uma transação com trava na linha do duelo e regrava essa linha, mesmo quando nada mudou.

**Como corrigir:**
- Pegar o nome pela sessão, com uma consulta só do usuário, ou guardar o nome no próprio duelo, que já guarda.
- Gravar a linha só quando o estado mudar.
- Deixar a consulta mais espaçada enquanto a sala espera (por exemplo, a cada 3 s).

### 8. Sair contra a Mine dá XP e conta como duelo jogado · Alta · Testado (API)

**O que acontece:** criar um duelo contra a Mine e sair na mesma hora termina com resultado "derrota". A tela então grava uma sessão de **10 XP** ("por jogar até o fim") e ela conta para as conquistas "Primeiro duelo" e "Duelista (10 duelos)", que juntas valem 100 XP. Dá para repetir até a cota de 20 duelos criados por dia.

**Como corrigir:** desistência dá 0 XP e não conta como duelo jogado. Na prática, só criar a sessão quando `abandono` estiver vazio, ou quando o abandono for do outro jogador.

### 9. Enter cria duas salas · Média · Testado (API) e pelo código

**O que acontece:** o campo do tema chama `onCriar(false)` ao apertar Enter sem checar se já há uma criação em andamento. Os botões ficam desativados, mas o Enter não. A criação leva de 13 a 20 s, então é fácil apertar de novo.

**Como reproduzi:** mandei dois pedidos de criação seguidos. Os dois deram certo, saíram duas salas (5SBJE e QCJTU), ambas apareceram na lista de salas abertas e as duas contaram na cota.

**Como corrigir:** ignorar o Enter quando `ocupado` estiver ligado. No servidor, também dá para reaproveitar a sala que a mesma pessoa abriu com o mesmo tema nos últimos segundos.

### 10. Celular: alternativas abaixo da dobra e cobertas pela Mine · Média · Testado

**O que acontece:** a 375 px, durante a pergunta, só a alternativa A cabe acima da barra de navegação de baixo. O botão flutuante da Mine (canto inferior direito) cobre parte do texto dela. O título e a descrição da página continuam no topo, e a rolagem automática para a partida não chega a deixar a pergunta inteira na tela. Com 20 segundos por pergunta, o aluno perde tempo rolando.

**Como corrigir:**
- Durante `jogando`, esconder o cabeçalho e o botão da Mine.
- Rolar de modo que a pergunta e as 4 alternativas caibam, ou fixar as alternativas numa grade compacta 2×2 no celular.

### 11. Ausência de 2 minutos vira derrota · Média · Testado (API)

**O que acontece:** a tela para de consultar quando a aba fica escondida (`document.hidden`). Assim, quem troca de app no celular ou bloqueia a tela por 2 minutos perde por "sumiu", sem nenhum aviso.

**O outro lado:** quando um jogador some de verdade, o outro continua respondendo sozinho (a tela diz "Esperando o adversário…" a cada pergunta) até completar 2 minutos e ganhar.

**Como corrigir:**
- Avisar "se sair desta tela por 2 min você perde".
- Mostrar "seu adversário está desconectado" depois de cerca de 20 s sem ele consultar.
- Dar a vitória antes, quando o adversário não responde 2 perguntas seguidas.

### 12. XP do Duelo não é conferido no servidor · Média · Pelo código

**O que acontece:** o resultado fica guardado no servidor (`minerva_duelos`), mas a sessão com o XP é criada pelo navegador e gravada junto com o resto dos dados. O ranking aceita qualquer sessão "Duelo" de até 30 XP, no máximo 6 por dia. Quem quiser trapacear consegue somar 180 XP por dia sem jogar.

O mesmo vale para o Laboratório (até 60 XP por dia). É o modelo geral do site, que confia nos dados que o navegador manda, mas no Duelo dá para conferir, porque o servidor já guarda o resultado.

**Como corrigir:** o servidor grava a sessão do Duelo quando a partida termina. Ou então, ao calcular o ranking, aceita só sessões cujo código de sala existe e terminou com aquele resultado.

### 13. "+30 XP" depois do limite · Média · Pelo código

**O que acontece:** a tela final mostra `+{dueloXp} XP` mesmo do 7º duelo do dia em diante, quando o ranking já não conta esse XP. O subtítulo da página fala em "até 6 duelos por dia", mas a tela final não confere.

### 14. Revisão sem o texto da alternativa escolhida · Baixa · Testado

**O que acontece:** a revisão final mostra "Você: marcou D · Mine: marcou D", mas não o texto da alternativa D. Para estudar com o erro, o aluno precisa saber o que marcou.

**Como corrigir:** mostrar `p.alternativas[minha.escolha]`.

### 15. Outros detalhes do Duelo · Baixa

- **Gabarito antes da revelação** (testado, API): logo depois de responder, a resposta do próprio jogador já traz `certo` e `pontos`. A tela não mostra, mas quem olhar a rede descobre na hora se acertou. Esconder `certo` e `pontos` até a revelação, como já é feito com o adversário.
- **Leitor de tela** (pelo código): a pergunta inteira está numa região `aria-live="polite"` que contém o cronômetro. Os segundos mudam o tempo todo, e o leitor de tela fica repetindo. Tirar o cronômetro dessa região.
- **Código da sala** (testado): o campo aceita O, 0, I, 1 e L, que nunca aparecem num código. Quem digita "ABCO1" recebe "Código inválido". Converter O→0 e I/L→1 não resolve, porque esses dígitos também não existem no alfabeto. Melhor filtrar no campo e avisar enquanto a pessoa digita.
- **Menos de 5 perguntas** (pelo código): a conferência do gabarito descarta perguntas, e o duelo pode sair com 3 ou 4, embora a página prometa "Cinco perguntas". Pedir uma reposição ou completar com a reserva.
- **Mensagem de erro presa** (pelo código): um erro ao responder (rede) aparece em vermelho e só some em outra ação. Limpar na próxima consulta que der certo.
- **Revanche** (pelo código): "Revanche (nova sala)" abre uma sala nova, mas o adversário não fica sabendo. Mostrar um "convite de revanche" para ele na tela final.
- **Espera** (testado): criar um duelo leva de 13 a 20 s. A dica "leva uns segundos" está certa, mas uma barra de progresso ou "escrevendo a pergunta 3 de 8" diminuiria a sensação de travamento.
- **O que conferi e está certo:**
  - O gabarito da pergunta aberta fica escondido.
  - A escolha e o placar do adversário só aparecem na revelação.
  - Responder duas vezes é recusado.
  - Duas pessoas entrando na mesma sala ao mesmo tempo são resolvidas pela trava de linha.
  - A partida contra a Mine terminou com o placar e a revisão certos.

---

## Ordem sugerida de correção

1. **Duelo #7 (custo do banco).** É a única que afeta o site todo, não só as duas abas.
2. **Laboratório #1 e #2, Duelo #8.** São brechas de XP e são correções pequenas.
3. **Duelo #9 e #10.** São o que o aluno sente no celular.
4. **Duelo #11 e #12.** Pedem decidir regras: quanto tempo de ausência vira derrota e quem grava o XP.
5. O restante.

Depois de cada correção, vale repetir o que está descrito em "Como reproduzi" nos itens 1, 2, 8 e 9.
