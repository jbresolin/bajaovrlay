# Fontes do app Baja

Guia do operador (BAJAOVRLAY-54). O app Baja publica os resultados de cada evento numa API
pública, `https://api.bajasaebrasil.net`. O BajaOvrLay lê essa API de duas formas: como
**fontes de dados** (a corrida, uma tabela de resultado, um chaveamento) e como **lista de
equipes** para os Cadastros. Tudo é lido pelo servidor do BajaOvrLay, nunca pelo navegador:
o computador onde o servidor roda precisa de internet.

No evento, é a internet do computador da transmissão: se ela cair, as fontes do app ficam
"Atrasadas" e o último dado bom continua no ar, até a conexão voltar.

## Qual código de evento digitar

O código do evento é o que o app Baja usa no endereço dos resultados (`?evt=26BR`): dois
dígitos do ano e a sigla da etapa. Exemplos: `26BR` (Nacional 2026), `26SE` (Sudeste 2026),
`25SU` (Sul 2025). Digite como no app, em maiúsculas: a API diferencia maiúsculas, então
`26br` é recusado na própria página, antes de qualquer leitura, e a página não troca as
letras por você.

## Adicionar uma fonte

Em **Fontes de dados**, "+ Fonte" → **"Adicionar fonte do app Baja"**:

1. "Endereço da API" já vem com o do app. Só troque para usar uma cópia local (por exemplo
   `http://localhost:4791`, de `pnpm serve:baja-example`, para ensaiar uma corrida).
2. Digite o código do evento e aperte **"Ler evento"**. A página lista o que o evento tem,
   com os nomes do app.
3. Escolha um item de uma das três listas e aperte **"Continuar"**. Abre o formulário
   normal de fonte HTTP/JSON (flexível), já preenchido e com o nome "App Baja — 26BR —
   Enduro". Dá para conferir, usar "Testar", exportar. Nada é salvo até **"Salvar fonte"**.
4. Ligue a fonte na lista.

### Um resultado fora do menu do evento

Alguns resultados respondem mas não aparecem no menu do evento (o Super Prime de 26BR,
`26BR_SPR`, é um deles). Para esses, escolha **"Outro resultado (digite o id)"**, digite o id
(o código do evento, `_` e até 3 letras ou algarismos, como `26BR_SPR`) e aperte **"Ler
resultado"**. A página pergunta primeiro como tabela; se o app responder que é um torneio,
lê como chaveamento. Ela mostra o que achou ("Tabela: …" ou "Chaveamento: …") e "Continuar"
segue como nas listas. Uma tabela lida assim entra como "outra", nunca como a Geral.

### O que cada fonte alimenta

| Lista                           | Vira              | Alimenta                                                             | Lida a cada |
| ------------------------------- | ----------------- | -------------------------------------------------------------------- | ----------- |
| Corridas com contagem de voltas | sessão e posições | relógio de prova, bandeira, torre de posições e tudo que lê posições | 2 s         |
| Tabelas de resultado            | classificação     | quadro de classificação                                              | 5 s         |
| Chaveamentos                    | chaves            | chaveamento (Super Prime)                                            | 5 s         |

- **Corrida.** As equipes e escolas aparecem pelo nome curto da lista de equipes do evento
  (lida de novo a cada 10 minutos); sem nome curto, pelo nome que a corrida traz. As
  diferenças (para o líder e para o carro da frente) são calculadas pelo BajaOvrLay a partir
  das voltas e da última passagem: valem na última passagem pela linha. Antes da largada o
  relógio fica parado em 0:00. Um estado de corrida que o preset não conhece **não vira
  bandeira nenhuma**: a leitura é recusada (veja abaixo) e o último dado bom fica no ar. Uma
  situação nova de carro aparece como "na pista", até alguém mapeá-la.
- **Tabela de resultado.** Os pontos vêm da coluna que o app marca como a da classificação
  (na Geral, "Total"). Uma tabela que não classifica ninguém (como Segurança Estática) ou que
  não marca coluna nenhuma não vira fonte: a página diz por quê e "Continuar" fica apagado. Ao escolher a tabela, a página lê as colunas dela e mostra uma caixa por coluna
  que pode virar **parte da pontuação**; vêm marcadas as partes da tabela Geral (Penalidade,
  Segurança, Projeto, Dinâmicas, Enduro). A Geral soma tudo; qualquer outra tabela entra como
  "outra". Equipes desclassificadas ficam no fim, sem posição.
- **Chaveamento.** As equipes aparecem pelo nome curto da lista de equipes, senão pelo do
  chaveamento, senão pelo nome completo (num evento sem nomes curtos, como 26SE). Um "bye"
  de qualquer lado é vitória por W.O. Só entram as fases completas: uma fase com um lado ainda "a definir" fica
  de fora, com as seguintes, até o app completá-la. A disputa de 3º lugar vem logo antes da
  final.

## O que quer dizer na página Fontes

Quando uma leitura é recusada, a fonte fica **"Atrasada"** (e "Erro" depois de um minuto),
o motivo aparece na fonte, e **o que já estava no ar continua no ar**. Assim que o app volta
a responder normalmente, a fonte volta a "Ok" sozinha.

- **"Resultado com spoilers ativos: a organização esconde as posições agora."** A
  organização ligou os spoilers no app: posições e totais ficam escondidos. O BajaOvrLay não
  mostra uma tabela escondida. Não há nada a corrigir; espere a organização desligar os
  spoilers.
- **"Corrida em modo simulação: marque 'Aceitar corrida simulada' para usar."** O app marcou
  a corrida como simulação (um teste da cronometragem). Para que ela não vá ao ar como
  corrida de verdade, a fonte a recusa. Para testes e ensaios, faça a fonte de novo com
  **"Aceitar corrida simulada"** marcado.
- **"Estado de corrida desconhecido: "…". Atualize o preset da fonte."** O app mandou um
  estado de corrida que o preset não conhece (entre aspas, a palavra que veio). Nenhuma
  bandeira vai ao ar por palpite: a fonte fica atrasada até o preset aprender a palavra. Avise
  o técnico; é uma linha a mais no preset (`corrida.preset.json`). Marcar "Aceitar corrida
  simulada" não tira esta recusa.

## Importar as equipes para os Cadastros

Em **Cadastros**, aba Equipes, **"Importar equipes do app Baja"**: digite o código do evento
e aperte "Buscar equipes". "Endereço da API" vem com o do app, como em Fontes; troque só
para ensaiar com uma cópia local (`pnpm serve:baja-example`). As equipes viram o texto de um CSV e abre o **"Importar CSV"** de
sempre, com a prévia ("novo", "atualiza", "erro"). Confira e aperte "Importar N linhas
válidas".

- carro ← número; equipe ← nome curto, senão o nome completo; escola ← sigla, senão o nome
  completo da escola; escola completa ← nome completo; cidade; UF.
- Uma equipe que já existe é atualizada e **mantém suas imagens**. Onde o app não tem nome
  curto, ou deixa um campo em branco, fica o que já estava cadastrado.
- A escola tem no máximo 30 caracteres. Se o app não tem a sigla e o nome completo é maior,
  a linha aparece como "erro": escreva a sigla no texto da caixa e a prévia é refeita.
- UF que não é de um estado (as equipes de teste do app usam "EX", "TE") fica em branco.

## Para o técnico

- Se `BAJAOVRLAY_SOURCE_ALLOWED_HOSTS` estiver definido no servidor, inclua
  `api.bajasaebrasil.net` (veja `.env.example`).
- Os presets ficam em `packages/shared/src/flexMapping/presets/bajaApp/` (um JSON por tipo);
  o contrato da API é `docs/results-api.md` no repositório do app Baja.
- **O relógio de prova conta a partir da hora do servidor do app Baja.** O preset de corrida
  liga `clock.referenceWallClockMs` a `clock.server_time_ms`: o momento em que o servidor do
  app leu o relógio da corrida. O relógio no ar compara esse momento com o relógio do
  servidor do BajaOvrLay, e os dois andam na hora certa pelo NTP (o BajaOvrLay pelo
  `BAJAOVRLAY_NTP_SERVERS`, NTP.br por padrão; o app Baja pelo da sua VPS). Por isso a conta
  fica certa mesmo com o cache de 2 s da API: uma resposta guardada traz o momento em que foi
  lida, não o da entrega. Se um dos dois servidores ficar sem NTP e se afastar da hora certa,
  o relógio no ar erra pela mesma diferença; "Verificar servidor" mostra a última resposta do
  NTP do BajaOvrLay. Usar o momento da leitura (`fromPollMoment`) em vez de `server_time_ms`
  é uma escolha do preset, que este não faz: o relógio no ar ficaria atrasado pela idade do
  cache.
