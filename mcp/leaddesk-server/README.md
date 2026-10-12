# LeadDesk MCP-сервер

Доменний stdio-сервер для лідів LeadDesk: два бізнес-дієслова замість SQL на всю базу.

| Що | Тип | Анотації |
|---|---|---|
| `leaddesk_find_leads` | ліди за статусом (`any` — усі), найновіші першими; лише `id`, `company`, `status`, `source`, `budget`, `createdAt` | `readOnlyHint: true` |
| `leaddesk_set_lead_status` | змінює статус ліда й пише запис аудиту `{ action, leadId, at, reason }` | `readOnlyHint: false` |
| `leaddesk://reference/statuses` | ресурс `text/markdown`: що кожен статус означає для команди | — |

Дані — `fixtures/leads.json` (копія `materials/leads.json`). Сервер читає її один раз; зміни статусів
і аудит живуть лише в пам'яті процесу, файл не переписується. Змінна `LEADDESK_FIXTURE` (необов'язкова)
вказує на іншу фікстуру. Секретів сервер не потребує.

## Запуск

Node.js ≥ 22.19. Git Bash, з кореня репозиторію:

```bash
(cd mcp/leaddesk-server && npm ci)
node mcp/leaddesk-server/src/server.mjs   # чекає клієнта на stdin; Ctrl+C — зупинка
```

## Перевірка Inspector'ом

```bash
npx -y @modelcontextprotocol/inspector@2.8.0 --cli node mcp/leaddesk-server/src/server.mjs --method tools/list
npx -y @modelcontextprotocol/inspector@2.8.0 --cli node mcp/leaddesk-server/src/server.mjs \
  --method tools/call --tool-name leaddesk_find_leads --tool-arg status=new --tool-arg limit=3
npx -y @modelcontextprotocol/inspector@2.8.0 --cli node mcp/leaddesk-server/src/server.mjs \
  --method resources/read --uri leaddesk://reference/statuses
```

Кожен виклик запускає сервер заново, тож стан щоразу чистий. `isError: true` → Inspector виходить
з кодом 5. Збережені результати — у `docs/mcp/*.json`.

## Підключення до Claude Code

Скоуп `local` (за замовчуванням): лише ви й лише цей проєкт, у git нічого не пишеться.

```bash
claude mcp add leaddesk -- node "$(pwd)/mcp/leaddesk-server/src/server.mjs"
```

`leaddesk_set_lead_status` змінює дані: схвалюйте кожен виклик, прочитавши, який лід і на який статус.
