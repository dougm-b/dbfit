# The CHANGE App

App pessoal de fitness (treino, dieta, bioimpedância, chat IA) de página única,
sem dependências nem build tooling em runtime. `index.html` é aberto
diretamente no browser (duplo-clique local, ou GitHub Pages) e sincroniza
dados com `data/db.json` neste mesmo repo via GitHub API, usando um Personal
Access Token guardado só no `localStorage` do browser.

## `index.html` e `detail.html` são gerados — nunca os edites diretamente

Ambos são montados a partir dos ficheiros em `src/` por `build.js`.
Qualquer edição feita diretamente num destes dois ficheiros **é perdida** na
próxima vez que alguém corra o build.

Fluxo de trabalho:
1. Edita os ficheiros relevantes dentro de `src/`.
2. Corre `node build.js` (ou `npm run build`) a partir da raiz do repo —
   regenera **ambos** `index.html` e `detail.html`.
3. Faz commit tanto das fontes (`src/**`) como dos dois HTML regenerados —
   têm de ficar sempre sincronizados no mesmo commit.

## Estrutura de `src/`

```
src/shell.html              esqueleto da app principal (doctype, <head>,
                             wrapper do <body>) com marcadores
                             <!--INCLUDE:caminho/relativo--> → gera index.html
src/detail-shell.html       esqueleto da página de detalhe de um indicador
                             de bioimpedância → gera detail.html
src/css/base.css            variáveis, layout, nav, cards, modais, ecrã de
                             configuração inicial, padrões partilhados entre abas
src/css/{dashboard,diet,train,health,settings}.css
                             estilos específicos de cada aba
src/css/detail.css          estilos só da página de detalhe (detail.html)
src/screens/{dashboard,diet,train,health,settings}.html
                             marcação de cada uma das 5 abas (a div .screen)
src/partials/nav.html       menu de navegação inferior
src/partials/setup.html     ecrã de configuração do token + toast + sync-bar
src/partials/modals/*.html  um ficheiro por modal (adicionar alimento, criar/
                             editar treino, detalhe do dia, registar sessão,
                             atualizar bioimpedância)
src/js/core.js               config GitHub, estado por omissão, migração de
                             esquemas antigos, sync (load/push), auto-sync em
                             segundo plano, navegação, modais genéricos, toast
                             — usado por todos os outros ficheiros, incluindo
                             a página de detalhe
src/js/metrics.js           registo partilhado dos indicadores de
                             bioimpedância (METRICS): explicação, faixa
                             saudável, indicadores relacionados; + histórico
                             (healthHistory) e correlação estatística
                             (Pearson) — usado pela aba Bioimpedância e pela
                             página de detalhe
src/js/dashboard.js         lógica só do Dashboard (updateDash)
src/js/diet.js               lógica só da Dieta (refeições/alimentos)
src/js/train.js             lógica só do Treino (planos, calendário, sessões)
src/js/health.js            lógica só da Bioimpedância (inclui snapshot para
                             o histórico a cada "Guardar dados")
src/js/settings.js          lógica só das Configurações (metas, altura, chaves)
src/js/import.js            importador de histórico (Google Fit / Zepp) —
                             melhor esforço, ver secção própria abaixo
src/js/chat.js               assistente IA com tool-use (add_food/add_exercise)
src/js/boot.js               arranque da app principal — tem de ser o último
                             ficheiro incluído em src/shell.html
src/js/detail.js            renderização da página de detalhe (gráfico SVG,
                             faixa saudável, correlações)
src/js/detail-boot.js       arranque da página de detalhe — tem de ser o
                             último ficheiro incluído em src/detail-shell.html
```

`build.js` percorre uma lista de alvos (`TARGETS`, no topo do ficheiro) e para
cada um concatena os ficheiros incluídos num único `<script>`/`<style>`, pela
ordem em que aparecem no respetivo shell. Como `core.js` define `state`,
`TODAY`, `now`, etc. usados por variáveis de topo de nível noutros ficheiros
(ex: `let calViewDate = new Date(now...)` em `train.js`), **`core.js` tem de
vir sempre primeiro** em qualquer shell, e o ficheiro `*-boot.js` respetivo
tem de vir sempre por último (dispara o arranque só depois de todas as
funções estarem definidas). Ao adicionar um novo ficheiro JS ou uma nova
página, mantém essa ordem e regista o par `{shell, out}` em `TARGETS` dentro
de `build.js`.

### Auto-sync entre dispositivos

`core.js` faz poll ao GitHub a cada 45s (só quando a aba está visível), ao
mudar de separador dentro da app, e quando o browser volta a ficar visível
(`visibilitychange`) — para os dados aparecerem sozinhos quando são
alterados noutro dispositivo. Isto usa `loadFromGitHub({silent:true,
skipIfBusy:true})`, que nunca reverte o estado local para os valores por
omissão em caso de falha de rede (só a carga inicial explícita o faz).

### Histórico de bioimpedância

Cada vez que "Guardar dados" é usado na Bioimpedância, `snapshotHealthHistory()`
(em `metrics.js`) grava uma cópia datada de `state.health` em
`state.healthHistory[data]`. A página de detalhe (`detail.html?metric=<id>`)
lê esse histórico para desenhar o gráfico, calcular mínimo/máximo/média e
correlações reais (Pearson, mínimo 5 pontos coincidentes) entre indicadores.
Não há como recuperar histórico anterior à existência deste campo — só
acumula a partir de quando foi introduzido, ou via importação manual (ver
`src/js/import.js`).

### Importador Google Fit / Zepp (`src/js/import.js`)

Não há API pública para ler estas apps diretamente a partir do browser, por
isso a importação é feita por ficheiro exportado pelo utilizador (Google
Takeout para o Fit, "Exportar dados" na Zepp), lido localmente com
`FileReader` — nada é enviado para servidores externos. O parser é
**melhor esforço**: tenta reconhecer colunas CSV comuns (peso, gordura
corporal, frequência cardíaca, passos, por data) e faz uma pesquisa
heurística em JSON (incluindo o formato "Data Point" do Google Fit Takeout).
Não foi validado contra um ficheiro real do utilizador — se o resultado
não bater certo, pede-se ao utilizador uma amostra do ficheiro (algumas
linhas/objetos) para ajustar `IMPORT_COLUMN_ALIASES` ou
`scanJsonForHealthRecords` ao formato exato.

## Depois de qualquer alteração

Corre sempre `node build.js` e confirma que não há erros. Para validar
visualmente sem precisar de um token GitHub real, podes servir a pasta
localmente (`python3 -m http.server 8000`) e usar Playwright para mockar
`https://api.github.com/repos/dougm-b/dbfit/contents/data/db.json` — não é
preciso nenhuma configuração adicional.

## Porquê isto existe

Antes desta reorganização, `index.html` era um único ficheiro com ~1800
linhas (HTML+CSS+JS misturados). Qualquer alteração — mesmo pequena — exigia
ler e editar esse ficheiro inteiro, gastando muito mais tokens do que
necessário. Esta estrutura existe para que uma alteração numa aba (ex:
"muda a cor do botão de guardar treino") só precise de tocar em 1–2
ficheiros pequenos.
