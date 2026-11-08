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
| `BAJAOVRLAY_PIN_PRODUCER` | O PIN do Produtor: de 4 a 8 algarismos.       | (escolha um)    |
| `BAJAOVRLAY_PIN_DATA`     | O PIN de Dados: de 4 a 8, diferente do outro. | (escolha outro) |

- **Nenhum dos dois**: sem login, como antes. O log do servidor avisa ao ligar, e o topo da
  página mostra "Sem login" para ninguém esquecer.
- **Só um**, **dois iguais**, ou um PIN que não seja de 4 a 8 algarismos: o servidor não liga
  e diz o motivo em português no log (sem nunca escrever o PIN).

Onde preencher: no PC de transmissão, no `compose.yaml`, no bloco `environment:` do serviço,
como as variáveis do OBS ([obs.md](obs.md)); no TrueNAS, nas variáveis da stack. Os PINs
nunca aparecem no log nem na página.

## 2. Entrar e sair

1. Abra a página de controle. Sem sessão, ela vai para **Entrar** (`#/entrar`), a única página
   que abre sem login.
2. Escolha o papel, digite o PIN e o nome da estação ("Mesa 1"). O navegador lembra a estação
   para a próxima vez.
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

## 4. O que não pede login

- As páginas do OBS (`/render/`) e os monitores da página de controle: continuam sem login na
  rede do estúdio e só informam o que está na tela.
- A API de comandos (Companion, Stream Deck, D200; [buttons.md](buttons.md)): continua com os
  seus tokens e o modo aberto, sem papel.
- `/health`, as imagens (`/media/…`), os gráficos e o tema.

A tabela de quem acessa cada endereço fica em
`apps/server/src/core/operatorLogin/routeAccess.ts`.

## 5. Sem HTTPS

A rede do estúdio é confiável e a página é servida por `http://`. Por isso o cookie da sessão
(`bajaovrlay_sessao`) não tem a marca `Secure`: com ela, o navegador nunca o mandaria de volta
por `http://`. O cookie é `HttpOnly` (nenhum script da página o lê) e `SameSite=Strict`
(nenhum outro site faz o navegador enviá-lo). Quem enxerga o tráfego da rede enxerga o cookie;
não use o login como proteção numa rede aberta.
