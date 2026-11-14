# Ensaio com dois voluntários — 45 minutos

Um ensaio de um dia de prova, com o simulador no lugar do sistema de cronometragem, para provar que o [guia do operador](guia-do-operador.md) basta. Dois voluntários que nunca usaram o BajaOvrLay, cada um no seu computador: o **Produtor** (Mesa 1) e **Dados** (Mesa 2). O João conduz, provoca os problemas e anota. Os voluntários têm só o guia impresso; o João não explica a tela, só lê os passos em voz alta.

Cada passo diz o que cada voluntário faz e o que **os dois** devem ver. Quando o que aparece não bate, o João anota no fim (onde tropeçaram) e segue. No ensaio, o João é o responsável técnico que o guia manda avisar.

## Antes do ensaio (João, 20 minutos antes)

1. `pnpm build`, depois `pnpm start` com, no `.env`: `HOST=0.0.0.0` (sem isso o servidor só atende a própria máquina e os computadores dos voluntários não conectam), `BAJAOVRLAY_PIN_PRODUCER` e `BAJAOVRLAY_PIN_DATA` (PINs só do ensaio) e um banco novo (`DATABASE_PATH` apontando para um arquivo que ainda não existe). Libere a porta (`PORT`, 3000 se não definida) no firewall.
2. Passe aos voluntários o endereço `http://<IP do servidor>:<porta>` (por exemplo `http://192.168.0.10:3000`) e os PINs.
3. Abra a saída do programa (`/render/`) numa terceira tela ou no OBS, onde só o João vê: é o ar do ensaio.
4. No console do João (entre como "Produtor", "Estação" Mesa 3), em "Fontes", no "Simulador — Enduro": "Editar", "Velocidade (vezes o tempo real)" 3, "Simular Super Chats" ligado, "Salvar fonte". Ainda não ligue a fonte.
5. Em "Cadastros", aba "Patrocinadores": pelo menos um com "+ Patrocinador", com nome e logo ("Escolher imagem"), "Salvar". Sem patrocinador, o rodízio do passo 6 dos passos abaixo é recusado.
6. O logo do canal: na aba "Logo" (**F2**) do console, no botão "Logo do canal", "⋯" → "Editar", escolha a imagem do logo no campo Imagem e "Salvar item". Sem imagem, o "Logo do canal" é recusado no passo 2 dos passos abaixo.
7. Em "Sessão principal", três itens com "+ Item": o "Gráfico" de cada um, o "Rótulo" digitado **exatamente** como o gráfico (os passos usam esses nomes) e "Salvar item":
   - "Relógio de prova", com o tempo em "Relógio da fonte";
   - "Torre de posições", lendo os carros da fonte (a sugestão que o formulário já traz);
   - "Tarja" com um nome e cargo digitados (por exemplo Ana Souza, locutora).
8. Imprima o guia (`docs/operador/guia-do-operador.pdf`, frente e verso), escreva no topo seu nome e telefone como responsável técnico, e deixe uma cópia em cada mesa.
9. **Minuto 0:** ligue a fonte ("Ligada") e clique em "Reiniciar corrida". O Super Prime simulado começa junto, com os 60 carros: uma bateria a cada 20 segundos (uma por minuto simulado, a 3×), dos 32 avos de final às semifinais, depois a "Disputa de 3º lugar" e a "Final", nessa ordem, por volta dos minutos 20 a 25. Um Super Chat simulado chega a cada um ou dois minutos.
10. **Também no minuto 0:** na página "Eventos", "Gatilhos": abra "Patrocinadores a cada 30 min", marque "Gatilho ligado" e "Salvar gatilho". Ele conta a partir de quando é ligado, então pergunta perto do minuto 30 do ensaio.

## Passos

### 1. Entrar e conferir (minutos 0–5) — guia §1

| Quem     | Faz                                                                | Deve ver                                                                                                 |
| -------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Produtor | Entra como "Produtor", Mesa 1. Abre "Menu" → "Verificar servidor". | Cabeçalho com "Fontes" verde, "Conectado", Produtor · Mesa 1. A mensagem diz "Fontes ligadas: todas ok." |
| Dados    | Entra como "Dados", Mesa 2. Confere o cabeçalho.                   | O mesmo cabeçalho, com Dados · Mesa 2.                                                                   |

### 2. Pôr no ar e tirar (minutos 5–10) — guia §2 e §3

| Quem     | Faz                                                                                      | Deve ver                                                                                             |
| -------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Produtor | "Prévia" no "Relógio de prova", confere o monitor, "Tomar".                              | O relógio em "Programa" e "No ar" na linha "Relógio" de "Camadas". No ar (João): o relógio contando. |
| Produtor | Clica no nome da "Torre de posições" para marcá-la "Próximo" e aperta a barra de espaço. | A torre em "Programa"; a "Tarja" passa a ser o "Próximo".                                            |
| Produtor | **F2**, depois **1**.                                                                    | O "Logo do canal" no canto do "Programa".                                                            |
| Produtor | "Limpar" na linha "Logo do canal" de "Camadas".                                          | O logo some; relógio e torre ficam.                                                                  |
| Dados    | Tenta "Disparar" a "Tarja".                                                              | O botão está cinza: Dados não muda o ar.                                                             |

### 3. Eventos e Super Chats (minutos 10–15) — guia §4 e §5

| Quem     | Faz                                                                                                         | Deve ver                                                 |
| -------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Dados    | Abre a aba "Eventos"; quando a lista _N aguardando aprovação_ (já aberta) mostrar um Super Chat, "Aprovar". | O Super Chat sai da sua lista.                           |
| Produtor | Na aba "Eventos", "No ar" no Super Chat aprovado.                                                           | O Super Chat na tela pelo tempo da regra, e sai sozinho. |
| Dados    | No Super Chat seguinte, o João diz que esse não vai ao ar: "Descartar".                                     | Ele sai da lista; nada vai ao ar.                        |
| Produtor | Quando a primeira penalidade do simulador aparecer na aba "Eventos": "Prévia", depois "No ar".              | A penalidade na tela; o número da aba diminui.           |

### 4. A fonte cai e volta (minutos 15–18) — guia §8

João, na página "Fontes": "Editar" no "Simulador — Enduro", liga "Falha simulada", "Salvar fonte". Dois minutos depois, desliga do mesmo jeito.

| Quem    | Faz                                                         | Deve ver                                                                                                                                                                                                |
| ------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Os dois | Percebem o problema e dizem em voz alta o que o guia manda. | Selo "Fontes" amarelo e "fonte atrasada" na linha "Torre" de "Camadas"; depois de 1 minuto, vermelho e "fonte com erro". A torre e o relógio **continuam no ar** com o último dado. Ninguém limpa nada. |
| Dados   | Avisa o Produtor e o responsável técnico (o João).          | —                                                                                                                                                                                                       |
| Os dois | Esperam a fonte voltar.                                     | Selo verde de novo; a torre volta a mudar sozinha.                                                                                                                                                      |

### 5. Super Prime, até a final (minutos 18–25) — guia §6

| Quem     | Faz                                                                                                                                            | Deve ver                                                                                    |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Produtor | Em "Partidas da chave", "Usar sugestão" sempre que uma partida terminar. Uma vez, **F3** e **1** para pôr a partida "agora" no ar.             | O painel diz quem venceu e sugere a próxima; o gráfico no ar muda para a partida escolhida. |
| Produtor | Quando a "Disputa de 3º lugar" terminar: "Usar sugestão" (a sugerida deve ser a "Final"). Se não for, "Escolher partida" → "Agora" na "Final". | "agora" mostra a "Final".                                                                   |
| Dados    | Acompanha o painel.                                                                                                                            | Vê as mesmas partidas, sem poder mudar (os botões são do Produtor).                         |

### 6. Erro, desfazer e gatilho (minutos 25–32) — guia §3 e §7

| Quem     | Faz                                                                        | Deve ver                                                 |
| -------- | -------------------------------------------------------------------------- | -------------------------------------------------------- |
| Produtor | O João pede para limpar tudo: "Limpar tudo" e confirma. Depois **Ctrl+Z**. | Tudo sai; com o **Ctrl+Z**, tudo o que estava volta.     |
| Produtor | Por volta do minuto 30, o gatilho pergunta na aba "Eventos": "Rodar".      | O rodízio de patrocinadores passa uma vez e sai sozinho. |
| Produtor | "Menu" → "Pausar gatilhos"; depois "Retomar".                              | "Gatilhos e eventos automáticos pausados" no cabeçalho.  |

### 7. A página recarrega no meio da prova (minutos 32–35) — guia §8

| Quem     | Faz                                                                  | Deve ver                                                                                               |
| -------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Produtor | O João aperta **F5** no computador do Produtor, sem avisar.          | A página volta sozinha, ainda como Produtor · Mesa 1, com tudo como estava. No ar (João): nada piscou. |
| Dados    | Fecha a aba e abre o endereço de novo.                               | Volta ao console sem perder nada.                                                                      |
| João     | Tira o cabo de rede (ou o Wi-Fi) do Dados por 30 segundos e devolve. | Dados vê "Reconectando…" e os botões cinza; depois "Conectado" de novo, sozinho.                       |

### 8. Tomada recusada (minutos 35–38) — guia §8

| Quem            | Faz                                                                                              | Deve ver                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| João e Produtor | Na contagem do João, os dois tomam a "Tarja" ao mesmo tempo, o João na Mesa 3 um instante antes. | A tomada do Produtor é recusada com uma mensagem que diz por quê. O Produtor confere "Programa" e "Camadas" antes de tentar de novo. |

### 9. Aviso digitado, mostrar de novo e cópia (minutos 38–45) — guia §4 e §8

| Quem     | Faz                                                                                                                                                                         | Deve ver                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Produtor | "Abrir a página de eventos", "+ Evento", "Sem equipe (aviso geral)", "Tipo" "Aviso", "Motivo" Pista liberada em 5 minutos, "Criar evento". Depois "No ar" na aba "Eventos". | O aviso na tela, sem equipe.                                |
| Produtor | Na página de eventos, "Mostrar de novo" na penalidade do passo 3; "No ar" na aba "Eventos".                                                                                 | A mesma penalidade de novo na tela.                         |
| Dados    | "Menu" → "Cópia de segurança" → "Baixar", e salva.                                                                                                                          | O arquivo .zip baixado; a última cópia com a hora de agora. |
| Produtor | "Limpar tudo" e confirma, para encerrar.                                                                                                                                    | Tela limpa.                                                 |

## Lista do João

Marque cada linha: **ok**, **com ajuda** (o voluntário precisou de mais do que o guia) ou **falhou**.

| #   | O quê                                                       | Resultado | Observação |
| --- | ----------------------------------------------------------- | --------- | ---------- |
| 1   | Os dois entraram e conferiram o cabeçalho sozinhos          |           |            |
| 2   | Prévia → Tomar, barra de espaço, atalho com F2 e 1, Limpar  |           |            |
| 2   | Dados não conseguiu mudar o ar                              |           |            |
| 3   | Super Chat aprovado e posto no ar; outro descartado         |           |            |
| 3   | Penalidade posta no ar pela aba Eventos                     |           |            |
| 4   | Fonte caiu: ninguém limpou nada; avisaram; voltou sozinha   |           |            |
| 5   | Partidas acompanhadas; a final escolhida depois do 3º lugar |           |            |
| 6   | Limpar tudo e Ctrl+Z                                        |           |            |
| 6   | Gatilho rodado; pausar e retomar                            |           |            |
| 7   | F5 e aba fechada sem perder nada; reconectou sozinho        |           |            |
| 8   | Tomada recusada entendida                                   |           |            |
| 9   | Aviso geral digitado e posto no ar; mostrar de novo         |           |            |
| 9   | Cópia de segurança salva                                    |           |            |
| —   | O ar nunca piscou nem ficou vazio sem alguém mandar         |           |            |

## Onde os voluntários tropeçaram

Uma linha por tropeço: o passo, o que a pessoa procurou ou fez, e o que mudar (no guia, ou um pedido no Plane).

1.
2.
3.
4.
5.
