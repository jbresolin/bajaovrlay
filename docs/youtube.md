# YouTube: Super Chats na tela depois de aprovados

O servidor do BajaOvrLay lê o chat ao vivo da transmissão no YouTube e traz só os **Super
Chats** (mensagens pagas de texto) para a caixa de **Eventos**. Nada que um espectador escreve
vai ao ar sem uma pessoa aprovar:

1. o Super Chat chega como **aguardando aprovação**;
2. **Dados** (ou o **Produtor**, quando está sozinho) clica **Aprovar** ou **Descartar**;
3. só os aprovados aparecem para o Produtor, que usa **Prévia** e **No ar** como em qualquer
   evento, com o modelo "Super Chat" (em **Regras**, desde BAJAOVRLAY-67).

O chat de uma transmissão pública é público, então basta uma **chave de API** do Google: não há
login com conta Google nem token guardado. Ficam de fora: Super Stickers, membros e membros
presenteados, a foto do espectador, e editar a mensagem antes de ir ao ar.

## 1. Criar a chave no Google Cloud (uma vez)

1. Entre em <https://console.cloud.google.com/> com a conta Google da equipe de transmissão.
2. No seletor de projetos, no topo, clique em **Novo projeto**. Nome: `BajaOvrLay`. Clique em
   **Criar** e selecione o projeto novo.
3. Abra **APIs e serviços → Biblioteca**, procure **YouTube Data API v3**, abra e clique em
   **Ativar**.
4. Abra **APIs e serviços → Credenciais → Criar credenciais → Chave de API**. O Google mostra a
   chave: copie.
5. Ainda na janela da chave, clique em **Editar chave de API** (ou no nome da chave na lista):
   - em **Restrições de API**, marque **Restringir chave** e escolha só **YouTube Data API v3**;
   - em **Restrições de aplicativo**, deixe **Nenhuma** (o servidor roda atrás da internet de
     casa ou do autódromo, cujo IP muda).
   - Clique em **Salvar**.

A chave restrita só serve para ler dados públicos do YouTube; mesmo assim, trate-a como senha:
não cole em chat, em print nem em issue.

## 2. Colocar a chave no servidor

A chave fica numa variável de ambiente do servidor, nunca na página:

```
BAJAOVRLAY_YOUTUBE_API_KEY=<a chave da API do YouTube>
BAJAOVRLAY_YOUTUBE_DAILY_UNITS=9000
```

- **Dev:** no `.env` da raiz do repositório.
- **PC de transmissão:** no arquivo do compose, em `environment:`.
- **TrueNAS:** nas "Environment variables" da stack.

Reinicie o servidor. A chave é lida a cada leitura do chat e só vai para o Google: nunca aparece
no log, numa página, numa gravação nem no Histórico.

## 3. Adicionar a fonte com o endereço da live

1. Em **Fontes**, clique em **+ Fonte** e escolha **Chat do YouTube (Super Chats)**.
2. Cole o endereço da transmissão como o YouTube mostra. Valem os três formatos:
   `youtube.com/watch?v=…`, `youtu.be/…` (botão **Compartilhar**) e `youtube.com/live/…`.
3. Deixe o intervalo em **30 s** (o mínimo é 10 s).
4. Ligue a fonte quando a live estiver no ar com o chat aberto. A linha da fonte mostra as
   unidades da cota gastas hoje.

Se a live ainda não começou, ou o chat está desligado, a fonte fica atrasada com o motivo
("Esta transmissão não tem chat ao vivo ativo") e tenta de novo a cada intervalo. Quando a live
termina, a fonte diz "A transmissão terminou: o chat ao vivo foi encerrado"; desligue-a.

Na primeira leitura depois de ligar a fonte, entram só os Super Chats dos **últimos 15
minutos**: ligar a fonte no meio da tarde não enche a caixa com o chat do dia inteiro. Depois de
reiniciar o servidor, os Super Chats pagos enquanto ele estava parado chegam (os que o YouTube
ainda devolve como recentes), e nenhum aparece duas vezes.

## 4. A cota de um dia de corrida

O Google dá à chave **10 000 unidades por dia**. Cada leitura custa:

| O quê                                | Unidades | Quando                                   |
| ------------------------------------ | -------- | ---------------------------------------- |
| achar o chat da live (`videos.list`) | 1        | uma vez por live (e depois de reiniciar) |
| ler o chat (`liveChatMessages.list`) | 5        | a cada intervalo da fonte                |

A **30 s**, são 120 leituras por hora, **600 unidades por hora**: um dia de 10 horas gasta cerca
de **6 000**. A 10 s, o triplo: a cota acaba antes do fim da tarde.

O servidor para sozinho em `BAJAOVRLAY_YOUTUBE_DAILY_UNITS` (9 000 se não estiver definida),
guardando um décimo para qualquer outro uso da chave. Ao chegar lá, a fonte fica atrasada com
"Cota diária do YouTube esgotada; volta às 5h", os Super Chats já recebidos continuam na caixa,
e a leitura volta sozinha quando o Google zera a cota: **meia-noite no horário do Pacífico**,
que é **5h em Brasília** (ou **4h** entre março e novembro, no horário de verão dos EUA).

A conta das unidades fica em `DATA_DIR/youtube-quota.json`, então reiniciar o servidor não
zera a contagem. Se o próprio Google recusar por cota (outra ferramenta usou a mesma chave), a
fonte diz "O YouTube recusou: a cota diária da chave acabou no Google".

## Ensaiar sem live

No simulador (**Fontes → Simulador — Enduro → Editar**), ligue **Simular Super Chats**: a cada 5
minutos simulados chega o Super Chat de um torcedor fictício. Com a velocidade em 60×, um a cada
5 segundos. Todo o caminho (aprovar, Prévia, No ar) funciona igual ao de uma live de verdade.
