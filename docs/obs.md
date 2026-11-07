# OBS: troca de cena e tally

O servidor do BajaOvrLay conversa com o OBS 32 do PC de transmissão pelo servidor WebSocket
que já vem no OBS (obs-websocket 5). Com isso:

- uma macro pode trocar a cena do OBS como um dos passos, então um botão só troca a cena e põe
  no ar os gráficos dela ("Pista + torre");
- o topo da página de controle mostra sempre se o OBS está conectado e qual cena está no
  Programa do OBS (e na Prévia do OBS, com o Modo Estúdio ligado);
- um botão do Companion ou do Stream Deck pode trocar a cena (`POST /api/v1/obs-scene/<cena>`,
  em [buttons.md](buttons.md)).

Só o servidor fala com o OBS, por uma conexão só. A página de controle nunca fala com o OBS:
ela lê o que o servidor ouviu.

## 1. Ligar o servidor WebSocket no OBS 32

1. No OBS, abra **Ferramentas → Configurações do servidor WebSocket**
   (em inglês, _Tools → WebSocket Server Settings_).
2. Marque **Ativar servidor WebSocket**.
3. Deixe a **porta** em `4455` (o padrão).
4. Marque **Ativar autenticação** e escolha uma senha. Clique em **Mostrar informações de
   conexão** para copiar a senha exatamente como o OBS a guarda.
5. Clique em **OK**. O OBS guarda isso no perfil; não é preciso repetir a cada abertura.

Se o servidor do BajaOvrLay roda no mesmo PC que o OBS (o caso do PC de transmissão), nada
mais é preciso no OBS. Se o Windows perguntar se o OBS pode receber conexões, permita na rede
privada.

## 2. Preencher as duas variáveis

| Variável                  | O que é                                                                                                                                                       | Exemplo                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `BAJAOVRLAY_OBS_URL`      | Onde está o servidor WebSocket do OBS: `ws://` (ou `wss://`), o host e a porta. Sem ela, o controle do OBS fica desligado e o topo diz "OBS não configurado". | `ws://host.docker.internal:4455` |
| `BAJAOVRLAY_OBS_PASSWORD` | A senha do passo 1.4. Vazia se a autenticação do OBS estiver desligada. Nunca aparece no log nem na página.                                                   | (a senha do OBS)                 |

Onde preencher:

- **PC de transmissão (Docker Desktop)**: no `C:\BajaOvrLay\compose.yaml`, dentro de
  `services: bajaovrlay:`, num bloco `environment:` (junte com as variáveis que já estiverem
  lá, como `BAJAOVRLAY_API_OPEN`):

  ```yaml
  environment:
    BAJAOVRLAY_OBS_URL: ws://host.docker.internal:4455
    BAJAOVRLAY_OBS_PASSWORD: <a senha do OBS>
  ```

  O endereço é `host.docker.internal`, não `127.0.0.1`: dentro do contêiner, `127.0.0.1` é o
  próprio contêiner, e `host.docker.internal` é o PC onde o OBS está aberto. Depois rode
  `docker compose up -d` na pasta `C:\BajaOvrLay` para o servidor reiniciar com elas.

- **Desenvolvimento (`pnpm dev`)**: no `.env` na raiz do repositório, com
  `BAJAOVRLAY_OBS_URL=ws://127.0.0.1:4455`, e reinicie o servidor.

Um endereço que não começa com `ws://` ou `wss://` impede o servidor de iniciar, e o log diz
qual variável corrigir (por exemplo, `http://127.0.0.1:4455` colado por engano).

Para conferir: o topo da página de controle mostra **OBS ●** e a cena no Programa
("Programa: Pista"). Passe o mouse sobre ele para ver o endereço e o último erro.

## 3. Fazer a macro "Pista + torre"

1. Na faixa de atalhos, aba **Macros**, clique em **+ Macro**.
2. Rótulo: `Pista + torre`. Escolha uma cor.
3. **+ Passo**, tipo **Trocar cena do OBS**, cena **Pista**, saída **Programa do OBS**.
   A lista de cenas é a do OBS, na ordem do painel Cenas do OBS. Com o OBS desconectado ela
   fica vazia ("Sem cenas: OBS não conectado"), e um passo novo não tem cena para escolher.
   Um passo que já tem cena continua com ela e a macro salva normalmente; se o OBS não tiver
   essa cena agora (desconectado, ou a cena foi renomeada), o passo mostra o aviso **"Cena não
   encontrada no OBS agora"**. Ao rodar, a macro para nesse passo se o OBS ainda não tiver a
   cena.
4. **+ Passo**, tipo **Pôr item no ar**, item da torre de posições.
5. **Salvar macro**.

Ao apertar a macro, o servidor pede ao OBS a cena "Pista", **espera o OBS responder** e só
então põe a torre no ar. Se o OBS recusar ou estiver fora, a macro para nesse passo, nada
depois dele entra no ar, e o botão da macro mostra **"Parou no passo 1"** com o motivo (passe
o mouse). O aviso some quando a macro roda de novo.

A **Prévia** da macro (⋯ → Prévia) mostra só as camadas do BajaOvrLay: ela pula o passo do
OBS e não troca a cena do OBS. "Tomar tudo" também não troca a cena; para isso, use
**Executar**.

A saída **Prévia do OBS (Modo Estúdio)** põe a cena na Prévia do OBS em vez do Programa, e
só funciona com o Modo Estúdio ligado no OBS.

## 4. Quando o OBS fecha

- O topo passa a mostrar **OBS ● Sem conexão** (ponto vermelho), sem cena nenhuma: o
  BajaOvrLay não afirma uma cena que o OBS pode não estar mostrando. O mouse sobre ele mostra
  o motivo ("A conexão com o OBS caiu…", "O OBS não respondeu em…", "O OBS em … aceitou a
  conexão, mas não respondeu a tempo…", "O OBS recusou a senha…").
- O servidor tenta de novo **a cada 5 s**, sozinho, enquanto estiver rodando. O log do
  servidor (`docker logs bajaovrlay`) ganha uma linha quando a conexão cai e outra quando ela
  volta, nunca uma por tentativa.
- A conexão só conta como de volta quando o OBS entrega a lista de cenas. Um OBS travado,
  que aceita a conexão mas não cumprimenta o servidor ou não manda a lista em 3 s, conta
  como mais uma tentativa que falhou: o topo continua em **Sem conexão** e o log não ganha
  uma linha por tentativa.
- Nada mais para: os gráficos no ar continuam no ar, as fontes de dados continuam, e todo
  comando que não é do OBS funciona normalmente.
- Uma troca de cena (macro, botão ou API) é recusada na hora com "O OBS não está conectado",
  e uma macro com passo de OBS para nesse passo, sem pôr no ar o que vem depois.
- Quando o OBS abre de novo, em até 5 s o topo volta a mostrar a cena, e a lista de cenas é
  lida de novo (cenas renomeadas ou criadas enquanto ele estava fechado já aparecem).
- Se o OBS não responder a uma troca em 3 s, ou cair no meio dela, a troca conta como recusada
  e o motivo vai para o registro de eventos.

## O que fica de fora

Iniciar ou parar a transmissão e a gravação, o áudio (XR18), comandar o BajaOvrLay a partir
do OBS, e os gatilhos (BAJAOVRLAY-48) não fazem parte deste controle.
