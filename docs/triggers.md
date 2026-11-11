# Gatilhos: macros que rodam sozinhas

Um gatilho roda uma macro quando acontece algo fora das mãos do operador: uma cena do OBS
entra ou sai do Programa, chega uma chamada HTTP (um botão do D200, um script), a caixa de
eventos registra uma penalidade, ou chega um horário da programação. Cada gatilho é uma regra:

- **quando** algo acontece (o tipo e o filtro);
- **então** uma macro roda, na hora (**auto**) ou depois que o operador diz sim (**perguntar**);
- **com** os dados do gatilho preenchendo campos dos itens que a macro põe no ar.

Os gatilhos ficam em **Eventos** (`#/eventos`), aba **Gatilhos**, ao lado de **Regras**. **Pausar gatilhos**
fica no **Menu** (☰) no topo do console; enquanto os gatilhos estão pausados, o topo mostra
**Gatilhos pausados** com **Retomar**.

## Os quatro tipos e os dados de cada um

Os dados de um disparo são uma lista simples de chave → texto ou número, com chaves em
português. São eles que um passo de macro lê em **Dado do gatilho › <chave>**.

| Tipo        | Quando dispara                                                                                                                                                                         | Dados                                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cena do OBS | a cena escolhida entra no Programa do OBS, ou sai dele                                                                                                                                 | `cena`                                                                                                                                                        |
| HTTP        | uma chamada a `POST /api/v1/triggers/<id>` ([buttons.md](buttons.md), seção 10)                                                                                                        | o corpo da chamada, como veio                                                                                                                                 |
| Evento      | a caixa de eventos registra uma penalidade, uma volta mais rápida, uma troca de líder ou um incidente                                                                                  | `tipo`, `carro` e, quando o evento traz, `equipe`, `escola`, `motivo`, `punicao`, `volta`, `tempo`                                                            |
| Horário     | um horário do dia (relógio do servidor, horário de Brasília), N minutos antes ou depois do início de uma sessão da Programação (uma sessão ou todas), ou **a cada N minutos** (abaixo) | numa sessão: `sessao`, `prova` e `inicio` (o início, em ms, que preenche a largada de uma contagem regressiva); num horário do dia e a cada N minutos: nenhum |

- **Penalidade** é qualquer evento que diga que é penalidade, vindo da fonte ou digitado em
  "+ Evento". **Incidente** é um incidente da fonte que não é penalidade. Um aviso digitado que
  não é penalidade e um Super Chat não disparam gatilho.
- Ligar ou desligar o OBS não conta como entrar ou sair de uma cena.
- Uma sessão mudada de horário na Programação depois de o gatilho ser criado vale pelo horário
  novo: o gatilho lê a Programação a cada segundo. Isso é de propósito: o gatilho segue a
  sessão. Se o gatilho já disparou e a sessão for adiada para depois, ele dispara de novo no
  horário novo (por exemplo, a contagem do Enduro roda às 12:50 e de novo às 13:20 se a
  largada passar para 13:30). Se não quiser o segundo disparo, desligue o gatilho depois do
  primeiro.
- Um horário que passou com o servidor desligado (ou o PC dormindo) não dispara atrasado.

## A cada N minutos

O terceiro tipo de **Horário** (BAJAOVRLAY-64) dispara **a cada N minutos**, de 5 a 240, o dia
todo ou só entre dois horários do dia (**Só entre dois horários**: **De** e **Até**, os dois
incluídos, no relógio do servidor, horário de Brasília; um **De** depois do **Até** atravessa a
meia-noite, por exemplo 22:00 a 02:00).

- A contagem começa no momento em que o gatilho é **ligado**: ligado às 10:07, a cada 30 min,
  dispara às 10:37, 11:07… Desligar e ligar de novo recomeça a contagem; salvar com outro N
  também. O momento fica salvo, então um reinício não muda a grade (os horários que passaram
  com o servidor desligado não disparam atrasados).
- Fora da janela, o horário da grade passa sem disparar; a grade não se desloca.
- Vale tudo o que vale para os outros gatilhos: auto ou perguntar, o intervalo mínimo,
  **Pausar gatilhos** e nada de disparo atrasado depois de o PC dormir.
- **Enquanto a camada da macro ainda tem um gráfico no ar, o disparo não acontece.** Se a
  camada de um item que a macro põe no ar ainda tem qualquer gráfico no Programa (a passada de
  patrocinadores que não terminou, uma cópia do item, ou o mesmo item mandado ao ar pela
  **Prévia**), o disparo é ignorado, sem linha no log de eventos, e o log do servidor diz por
  quê: `O gatilho "<nome>" não disparou: a camada "<camada>" ainda tem um gráfico no ar.`
  Disparar por cima reiniciaria a passada no meio. Os outros tipos de gatilho continuam
  disparando por cima do que está no ar, como antes.
- Um reinício do servidor no meio de uma passada tira os patrocinadores do ar (o tempo da
  passada fica só na memória), para que o gráfico não fique parado no último patrocinador e o
  gatilho volte a dispará-lo no horário seguinte.

### Patrocinadores a cada 30 min

Todo banco novo (e, uma vez, um banco que já existia) ganha:

- a camada **Patrocinadores (rodízio)**, logo acima da camada do bug, no mesmo canto: durante a
  passada o cartão cobre o bug, e quando sai o bug continua lá, no ar o dia todo;
- o item **Patrocinadores (simples)**, único botão do painel **Patrocinadores** de **Atalhos e
  macros**, no gráfico de patrocinadores simples (`sponsor-roll-plain`), nessa camada, com a
  lista de patrocinadores dos **Cadastros**;
- a macro **Patrocinadores (simples)**, que põe o item no ar;
- o gatilho **Patrocinadores a cada 30 min**, que roda a macro a cada 30 minutos, o dia todo,
  **desligado e em perguntar**: nada vai ao ar de surpresa até o operador ligá-lo.

Os patrocinadores passam uma vez cada um, cada nível pelo seu tempo (um patrocinador sem logo
fica de fora; se nenhum tiver logo, o item não entra no ar e a macro para nesse passo dizendo
por quê), e o gráfico sai sozinho no fim da passada: o servidor calcula o tempo da passada pela mesma tabela do gráfico. Uma
lista mudada no meio da passada não a encurta nem a alonga; a próxima passada já sai com a lista
nova. O que o operador excluir não volta.

## Auto ou perguntar

- **Auto** roda a macro na hora. Se outra macro estiver rodando, o disparo vira um
  **perguntar**, com o motivo: nunca entra numa fila e nunca cancela a macro que está rodando.
- **Perguntar** põe uma linha na aba **Eventos** do console: "Gatilho: <nome> → <macro>", com os
  dados. **Rodar** roda a macro com esses dados; **Descartar** dispensa; depois de descartar,
  **Desfazer** aparece por 30 s.
- Um gatilho novo começa em **perguntar**: nada vai ao ar de surpresa.

## Intervalo mínimo e pausa

- Cada gatilho tem um **intervalo mínimo** entre dois disparos (10 s, se não mudar). Um segundo
  disparo antes disso é ignorado, sem linha no log.
- **Pausar gatilhos** para todos de uma vez, para ensaio. Os disparos que já esperam ficam e
  podem ser rodados ou descartados.
- Cada disparo grava uma linha no log de eventos como `sistema:gatilhos`, com o nome do gatilho
  e os dados.

## As duas regras contra laço

1. Uma troca de cena feita pelo passo "Cena do OBS" de uma macro não dispara gatilho de cena. O
   servidor sabe quem pediu cada troca; não adivinha pelo tempo. Se o diretor troca a cena no
   próprio OBS logo depois, essa troca dispara normalmente.
2. Nada que uma macro iniciada por um gatilho cause dispara outro gatilho.

## Dados do gatilho num passo de macro

No editor de macros, um passo que põe um item no ar pode preencher qualquer campo do item com
**Dado do gatilho › <chave>**, no mesmo seletor de cada campo do editor de itens. Por exemplo,
o "Nome" da tarja a partir de `nome`.

- O dado é lido uma vez, nesse passo, e fica congelado no ar.
- Um campo **obrigatório** cuja chave não veio faz a macro parar nesse passo, com o motivo no
  botão da macro ("Nome: o gatilho não trouxe o dado "nome".").
- Um campo **opcional** cuja chave não veio fica de fora (nem o valor do próprio item entra).
- Um número num campo de texto vira texto (carro 47 → "47"). Nada mais é convertido.
- Uma macro rodada à mão não tem dados de gatilho: esses campos contam como ausentes. O editor
  avisa.
- A **Prévia** de uma macro mostra os itens com os valores deles, sem os dados do gatilho.

## O que fica salvo

- Os gatilhos ficam salvos no banco: um reinício os mantém.
- A pausa, os disparos e a hora do último disparo de cada gatilho ficam só na memória: o
  servidor sempre começa sem pausa, e um disparo que esperava antes de um reinício não aparece
  depois dele.
- Uma macro que um gatilho usa não pode ser excluída: a recusa lista os gatilhos. Mude ou
  exclua os gatilhos antes.

## O que fica de fora

- Condições que combinem vários gatilhos.
- Transformações nos dados do gatilho além do que os campos já aceitam.
- Gatilhos de áudio (XR18).
