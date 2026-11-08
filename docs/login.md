# Login na rede do estúdio: Produtor e Dados

Com os dois PINs definidos, a página de controle pergunta quem está operando antes de abrir
(BAJAOVRLAY-29). Há dois papéis, cada um com o seu PIN:

- **Produtor** comanda o show e pode tudo.
- **Dados** prepara: Cadastros, Fontes e correções, gravações, itens e rundown, painéis de
  atalhos, macros e gatilhos (editar, não rodar), regras de eventos, saídas e camadas. Nunca
  muda o que está no Programa ou na Prévia.

Cada comando, e cada linha do Histórico, diz o papel e a estação: "Produtor · Mesa 1".

Não há contas por pessoa: o PIN é do papel, e a estação é só um nome para o Histórico.

## 1. Definir os PINs

| Variável                  | O que é                                       | Exemplo         |
| ------------------------- | --------------------------------------------- | --------------- |
| `BAJAOVRLAY_PIN_PRODUCER` | O PIN do Produtor: de 6 a 8 algarismos.       | (escolha um)    |
| `BAJAOVRLAY_PIN_DATA`     | O PIN de Dados: de 6 a 8, diferente do outro. | (escolha outro) |

Por que seis algarismos no mínimo: com cinco tentativas por minuto por computador, um PIN de
quatro algarismos seria adivinhado dentro de um dia de prova; um de seis levaria meses.

- **Nenhum dos dois**: sem login, como antes. O log do servidor avisa ao ligar, e o topo da
  página mostra "Sem login" para ninguém esquecer.
- **Só um**, **dois iguais**, ou um PIN que não seja de 6 a 8 algarismos: o servidor não liga
  e diz o motivo em português no log (sem nunca escrever o PIN).

Onde preencher: no PC de transmissão, no `compose.yaml`, no bloco `environment:` do serviço,
como as variáveis do OBS ([obs.md](obs.md)); no TrueNAS, nas variáveis da stack. Os PINs
nunca aparecem no log nem na página.

## 2. Entrar e sair

1. Abra a página de controle. Sem sessão, ela vai para **Entrar** (`#/entrar`), a única página
   que abre sem login.
2. Escolha o papel, digite o PIN e o nome da estação ("Mesa 1"). O navegador lembra a estação
   para a próxima vez. O nome tem até 30 caracteres: letras (com acento), números, espaços e
   `- . _ ( ) #`.
3. **Entrar** abre o console. A sessão vale 18 horas (um dia de prova) e continua depois de um
   reinício do servidor.
4. **Sair**, no topo, encerra a sessão no servidor e volta para Entrar. As outras abas da mesma
   sessão também voltam para Entrar.

Cinco PINs errados seguidos do mesmo computador fazem esse computador esperar 60 s, e a
página diz quanto falta.

## 3. O que o papel Dados vê

A mesma página do Produtor, com o que Dados não pode usar apagado (nunca escondido), e o
motivo ao passar o mouse: "O papel Dados não pode mudar o que está no ar. Peça ao Produtor."
Isso vale para "Tomar" e "Tomar tudo" dos monitores, "Disparar" e "Prévia" do rundown e dos
atalhos, as macros, "Limpar", "Próximo" e "Desfazer" das Camadas, "Desfazer última", "Limpar
tudo", "Atualizar no ar", o "No ar" dos eventos, "Rodar" dos gatilhos e "Pausar gatilhos". As
teclas desses comandos (Espaço, Shift+Espaço, Backspace, Esc, setas, 1 a 9, P, Ctrl+Z) não
fazem nada para Dados. Mesmo que um comando desses chegue ao servidor, ele recusa.

**Automação é do Produtor.** Um gatilho ou uma regra de evento em "Automático" põe coisas no
ar sem ninguém apertar nada. Por isso Dados cria e edita gatilhos e regras só em "Perguntar"
ou "Ignorar": "Automático" aparece apagado, com o motivo ao lado. Num gatilho que já é
automático, Dados pode mudar o nome e o intervalo, desligá-lo ou voltá-lo para "Perguntar",
mas não a macro nem o que ele espera (o tipo e o filtro), e não pode ligá-lo. Numa regra
automática, Dados não muda o item nem os tempos. E Dados não muda os passos de uma macro que um
gatilho automático roda (o nome e a cor, sim).

## 4. O que não pede login

- As páginas do OBS (`/render/`) e os monitores da página de controle: continuam sem login na
  rede do estúdio e só informam o que está na tela.
- A API de comandos (Companion, Stream Deck, D200; [buttons.md](buttons.md)): continua com os
  seus tokens e o modo aberto, sem papel. **O modo aberto (`BAJAOVRLAY_API_OPEN=true`) passa por
  cima do login, de propósito**: qualquer computador da rede pode tomar, limpar e rodar macros
  pela API, com ou sem PIN. Com os PINs definidos e o modo aberto ligado, o log avisa ao ligar o
  servidor. Para que só os botões cadastrados operem, use tokens e deixe o modo aberto desligado.
- `/health`, as imagens (`/media/…`), os gráficos e o tema.

A tabela de quem acessa cada endereço fica em
`apps/server/src/core/operatorLogin/routeAccess.ts`.

## 5. O que Dados muda no ar, de propósito

Dados nunca toma, limpa, nem mexe na prévia. Mas duas coisas que fazem parte do trabalho de
Dados aparecem no ar, e isso foi aceito (gate 2 do PR #51):

- **Correções** de um campo ligado a uma fonte (o nome de uma equipe, um tempo errado) trocam o
  valor também no gráfico que está no ar, que é para isso que existem.
- **A altura ou a ordem de uma camada** (Saídas e camadas) reempilha os gráficos que estão no
  ar naquela saída.

## 6. Sem HTTPS

A rede do estúdio é confiável e a página é servida por `http://`. Por isso o cookie da sessão
(`bajaovrlay_sessao`) não tem a marca `Secure`: com ela, o navegador nunca o mandaria de volta
por `http://`. O cookie é `HttpOnly` (nenhum script da página o lê) e `SameSite=Strict`: o
navegador não o envia a partir de páginas de outros endereços.

Mas, para o navegador, "outro site" é outro computador, não outra porta. A interface web do
Companion, ou outro app no mesmo TrueNAS, está no mesmo site que o BajaOvrLay e receberia o
cookie. Por isso o servidor confere também de onde vem a página (o cabeçalho `Origin`): o
WebSocket do console e o envio de imagens só aceitam páginas do próprio endereço do servidor,
ou de um endereço listado em `BAJAOVRLAY_PUBLIC_ORIGINS` (o do proxy, no TrueNAS). Uma página
de outro endereço, ou de outra porta da mesma máquina, é recusada, com login ou sem. O OBS e o
Companion falando com a API não são páginas e não mandam `Origin`; continuam funcionando.

O banco guarda só um resumo (SHA-256) do identificador de cada sessão, nunca o identificador:
uma cópia do banco, ou um backup, não serve para montar um cookie que funcione.

Quem enxerga o tráfego da rede enxerga o cookie; não use o login como proteção numa rede
aberta.
