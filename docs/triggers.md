# Gatilhos: macros que rodam sozinhas

Um gatilho roda uma macro quando acontece algo fora das mãos do operador: uma cena do OBS
entra ou sai do Programa, chega uma chamada HTTP (um botão do D200, um script), a caixa de
eventos registra uma penalidade, ou chega um horário da programação. Cada gatilho é uma regra:

- **quando** algo acontece (o tipo e o filtro);
- **então** uma macro roda, na hora (**auto**) ou depois que o operador diz sim (**perguntar**);
- **com** os dados do gatilho preenchendo campos dos itens que a macro põe no ar.

Os gatilhos ficam em **Eventos** (`#/eventos`), aba **Gatilhos**, ao lado de **Regras**. O botão
**Pausar gatilhos** fica no topo do console.

## Os quatro tipos e os dados de cada um

Os dados de um disparo são uma lista simples de chave → texto ou número, com chaves em
português. São eles que um passo de macro lê em **Dado do gatilho › <chave>**.

| Tipo        | Quando dispara                                                                                                                                          | Dados                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Cena do OBS | a cena escolhida entra no Programa do OBS, ou sai dele                                                                                                  | `cena`                                                                                                                                     |
| HTTP        | uma chamada a `POST /api/v1/triggers/<id>` ([buttons.md](buttons.md), seção 10)                                                                         | o corpo da chamada, como veio                                                                                                              |
| Evento      | a caixa de eventos registra uma penalidade, uma volta mais rápida, uma troca de líder ou um incidente                                                   | `tipo`, `carro` e, quando o evento traz, `equipe`, `escola`, `motivo`, `punicao`, `volta`, `tempo`                                         |
| Horário     | um horário do dia (relógio do servidor, horário de Brasília), ou N minutos antes ou depois do início de uma sessão da Programação (uma sessão ou todas) | numa sessão: `sessao`, `prova` e `inicio` (o início, em ms, que preenche a largada de uma contagem regressiva); num horário do dia: nenhum |

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
