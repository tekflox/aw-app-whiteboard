---
repo: architecture
path: docs/architecture/aw-app-whiteboard.md
source: generated
edited: false
checksum: sha256:113ee3ddb7872a39c7bc0b24b4111110817851f60436210f88b095bb6018ec4c
---
# Whiteboard

- **repo**: aw-app-whiteboard
- **layer**: app
- **technologies**: python, react
- **health** (derived): planned

Persistent, live-synced HTML canvas — set/patch content, broadcast changes over a WebSocket to every open viewer, round-trip with a presentation. Migrated from the aw monolith (src/api/routes/whiteboard.py + whiteboard_manager.py + WhiteboardWindow.jsx).

## Connections
- `db` → **postgres** — app-owned tables in the workspace schema
- `http` → **aw-workspace** — routes mounted at /api/apps/whiteboard
- `stdio-mcp` → **mcp-gateway** — MCP surface aggregated by the gateway

## MCP tools
- `whiteboard_browse`
- `whiteboard_browser_close`
- `whiteboard_click`
- `whiteboard_close`
- `whiteboard_delete`
- `whiteboard_eval`
- `whiteboard_exec_js`
- `whiteboard_get`
- `whiteboard_key`
- `whiteboard_list`
- `whiteboard_load_presentation`
- `whiteboard_point`
- `whiteboard_save_presentation`
- `whiteboard_screenshot`
- `whiteboard_scroll`
- `whiteboard_show_html`
- `whiteboard_status`
- `whiteboard_type`

## Requirements
### A chave do workspace só viaja para a própria origem, comparada por origem parseada
- Given o browse aceita URL arbitrária e reusa o mesmo contexto do Playwright, cujo extra_http_headers vale para toda requisição que aquele contexto fizer
- When os headers de saída são decididos por URL (repos/aw-app-whiteboard/whiteboard_app/browser.py::workspace_api_headers:27)
- Then o X-Api-Key só é anexado quando (scheme, netloc) do alvo é idêntico ao da própria base, e qualquer outra coisa recebe dict vazio — a comparação é de origem parseada e não de prefixo de string de propósito, porque um startswith aceitaria "http://127.0.0.1:9030.evil.test/", mesmos caracteres iniciais e host completamente outro, que é exatamente para onde a chave nunca pode ir. Uma chave de workspace vazada não se conserta rotacionando um board
- intended_status: `not_implemented` · derived health: `not_implemented`
- tests: `repos/aw-app-whiteboard/tests/test_screenshot_auth.py` (passing)

### Origem própria desconhecida ou URL inválida falha fechando
- Given a base da própria origem chega vazia (env não configurada) ou a URL alvo não parseia
- When as duas guardas iniciais rodam antes de qualquer comparação (repos/aw-app-whiteboard/whiteboard_app/browser.py:43-48)
- Then o retorno é dict vazio nos dois casos, e a ausência da chave no ambiente também não é erro (browser.py:55-56) — falhar fechando aqui significa um screenshot que não autentica, e o custo disso é uma imagem errada; falhar abrindo significaria mandar a chave para um destino que não se conseguiu nem identificar, e o custo disso não tem volta. A ordem das guardas é o que garante isso: sem own_base_url nem se chega a olhar a URL
- intended_status: `not_implemented` · derived health: `not_implemented`
- tests: `repos/aw-app-whiteboard/tests/test_screenshot_auth.py` (passing)

### Existe uma única implementação de screenshot, alcançada pelos dois caminhos
- Given o board é capturado tanto pela rota HTTP quanto pelo handler MCP, que é a cópia que todo agente de fato alcança
- When a unicidade é verificada (repos/aw-app-whiteboard/tests/test_screenshot_auth.py::test_there_is_exactly_one_screenshot_implementation:68) sobre repos/aw-app-whiteboard/whiteboard_app/browser.py::screenshot_url:59
- Then routes.py e mcp/http_handler.py chamam a MESMA função — a bifurcação é o que fez o bug original durar semanas: consertar o caminho HTTP e deixar o caminho MCP intacto conserta justamente a cópia que ninguém usa, e o agente continua anexando uma imagem de erro ao relatório enquanto o teste da rota fica verde
- intended_status: `not_implemented` · derived health: `not_implemented`
- tests: `repos/aw-app-whiteboard/tests/test_screenshot_auth.py` (passing)

### A ponte com a API de apresentações só manda a chave quando ela existe
- Given o handler MCP roda fora do processo do workspace e fala HTTP com ele para carregar e salvar apresentações
- When os headers da chamada de saída são montados (repos/aw-app-whiteboard/whiteboard_app/mcp/http_handler.py:282-286)
- Then o X-Api-Key acompanha load e save quando AW_WORKSPACE_API_KEY está no ambiente, e nenhum header é enviado quando ela não está, e com a integração não configurada o roundtrip responde 501 em vez de fingir sucesso — 501 é a resposta honesta para "esse caminho existe mas não está ligado aqui", e é o que distingue app não configurado de app quebrado, que é a confusão que mais custa tempo nesta casa
- intended_status: `not_implemented` · derived health: `not_implemented`
- tests: `repos/aw-app-whiteboard/tests/test_manager_and_routes.py` (passing)

### Um board pedido que não existe nasce em branco em vez de dar 404
- Given um agente pede um board por id sem que ninguém o tenha criado antes
- When o gerenciador resolve o id (repos/aw-app-whiteboard/whiteboard_app/manager.py, exercitado por repos/aw-app-whiteboard/tests/test_manager_and_routes.py::test_ensure_creates_blank_board:74)
- Then um board em branco é criado e devolvido, e a partir daí set/get/list/delete operam sobre ele — para uma lousa o id é o nome, não uma chave gerada, então exigir criação prévia obrigaria todo chamador a um passo extra que só existiria para produzir um 404. O custo assumido é que um id digitado errado cria uma lousa nova e vazia em silêncio, em vez de avisar que a que se queria tem outro nome
- intended_status: `not_implemented` · derived health: `not_implemented`
- tests: `repos/aw-app-whiteboard/tests/test_manager_and_routes.py` (passing)
