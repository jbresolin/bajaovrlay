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
`25SU` (Sul 2025). Digite como no app, em maiúsculas.

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
  relógio fica parado em 0:00. Um estado novo que o app venha a criar aparece como bandeira
  amarela, e uma situação nova de carro como "na pista", até alguém mapeá-los.
- **Tabela de resultado.** Os pontos vêm da coluna pela qual a tabela classifica (na Geral,
  "Total"). Ao escolher a tabela, a página lê as colunas dela e mostra uma caixa por coluna
  que pode virar **parte da pontuação**; vêm marcadas as partes da tabela Geral (Penalidade,
  Segurança, Projeto, Dinâmicas, Enduro). A Geral soma tudo; qualquer outra tabela entra como
  "outra". Equipes desclassificadas ficam no fim, sem posição.
- **Chaveamento.** Só entram as fases completas: uma fase com um lado ainda "a definir" fica
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

## Importar as equipes para os Cadastros

Em **Cadastros**, aba Equipes, **"Importar equipes do app Baja"**: digite o código do evento
e aperte "Buscar equipes". As equipes viram o texto de um CSV e abre o **"Importar CSV"** de
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
