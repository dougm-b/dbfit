# DB Fit

App pessoal de fitness (treino, dieta, bioimpedância, chat IA) de página única,
sem dependências nem build tooling em runtime. `index.html` é aberto
diretamente no browser (duplo-clique local, ou GitHub Pages) e sincroniza
dados com `data/db.json` neste mesmo repo via GitHub API, usando um Personal
Access Token guardado só no `localStorage` do browser.

## `index.html` é gerado — nunca o edites diretamente

`index.html` é montado a partir dos ficheiros em `src/` por `build.js`.
Qualquer edição feita diretamente em `index.html` **é perdida** na próxima
vez que alguém corra o build.

Fluxo de trabalho:
1. Edita os ficheiros relevantes dentro de `src/`.
2. Corre `node build.js` (ou `npm run build`) a partir da raiz do repo.
3. Faz commit tanto das fontes (`src/**`) como do `index.html` regenerado —
   ambos têm de ficar sincronizados no mesmo commit.

## Estrutura de `src/`

```
src/shell.html            esqueleto (doctype, <head>, wrapper do <body>) com
                           marcadores <!--INCLUDE:caminho/relativo-->
src/css/base.css           variáveis, layout, nav, cards, modais, ecrã de
                           configuração inicial, padrões partilhados entre abas
src/css/{dashboard,diet,train,health,settings}.css
                           estilos específicos de cada aba
src/screens/{dashboard,diet,train,health,settings}.html
                           marcação de cada uma das 5 abas (a div .screen)
src/partials/nav.html      menu de navegação inferior
src/partials/setup.html    ecrã de configuração do token + toast + sync-bar
src/partials/modals/*.html um ficheiro por modal (adicionar alimento, criar/
                           editar treino, detalhe do dia, registar sessão,
                           atualizar bioimpedância)
src/js/core.js             config GitHub, estado por omissão, migração de
                           esquemas antigos, sync (load/push), navegação,
                           modais genéricos, toast — usado por todos os outros
src/js/dashboard.js        lógica só do Dashboard (updateDash)
src/js/diet.js             lógica só da Dieta (refeições/alimentos)
src/js/train.js            lógica só do Treino (planos, calendário, sessões)
src/js/health.js           lógica só da Bioimpedância
src/js/settings.js         lógica só das Configurações (metas, altura, chaves)
src/js/chat.js             assistente IA com tool-use (add_food/add_exercise)
src/js/boot.js             arranque — tem de ser o último ficheiro incluído
```

`build.js` concatena os ficheiros `js/*.js` num único `<script>`, pela ordem
listada em `src/shell.html`. Como `core.js` define `state`, `TODAY`, `now`,
etc. usados por variáveis de topo de nível noutros ficheiros (ex:
`let calViewDate = new Date(now...)` em `train.js`), **`core.js` tem de vir
sempre primeiro** e **`boot.js` tem de vir sempre por último** (chama
`checkToken()`, que arranca a app depois de todas as funções estarem
definidas). Ao adicionar um novo ficheiro JS, mantém essa ordem em
`src/shell.html`.

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
