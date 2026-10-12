# Перевірка (Task A, Task B, бонус E)

- **Інструмент і версія, модель:** Claude Code 2.1.252 (CLI) · Claude Opus 5.5 (Claude desktop app, вкладка Code)
- **ОС і термінал, Node:** Windows 11 Pro · Git Bash · Node 24.20.0

## Task A — сервер в Inspector

- Команди, якими зроблено чотири файли в `docs/mcp/`: як у walkthrough, крок 4, без змін (Git Bash,
  з кореня репозиторію, `npx -y @modelcontextprotocol/inspector@2.8.0 --cli node mcp/leaddesk-server/src/server.mjs …`).
- `tools-list.json`: рівно два інструменти — `leaddesk_find_leads` (`readOnlyHint: true`) і
  `leaddesk_set_lead_status` (`readOnlyHint: false`, `destructiveHint: false`). У кожного з п'яти параметрів
  є `description`: модель бачить формат (`lead_` і чотири цифри), перелік статусів із відсиланням до
  ресурсу `leaddesk://reference/statuses`, межі `limit` 1–50 і `reason` 3–500 символів. В описі
  `leaddesk_set_lead_status` прямо сказано «ЗМІНЮЄ ДАНІ» і що перед викликом потрібне підтвердження людини.
- `bad-input.json`: `leadId=nope`, `reason=ok` → `"isError": true`, текст: `Input validation error: … leadId:
  Invalid string: must match pattern /^lead_\d{4}$/, reason: Too small: expected string to have >=3 characters`.
  Inspector: `exit=5`, у stderr `{"error":{"code":"tool_is_error",…}}`.
  Додатково (не в файлах): `lead_9999` → `isError` «Лід lead_9999 не знайдено. Знайди правильний id через
  leaddesk_find_leads (status: "any")», exit 5; `lead_0002` → `new` (той самий статус) → `isError` «уже має
  статус new; нічого не змінено».
- `set-status.json`: `lead_0002` (Rynok Books) `new` → `contacted`; запис аудиту
  `{ "action": "lead.status_changed:new->contacted", "leadId": "lead_0002", "at": "2026-10-12T10:35:25.905Z", "reason": "перевірка в Inspector" }`.
- `resource-read.json`: `leaddesk://reference/statuses`, `mimeType: "text/markdown"`, таблиця п'яти статусів.
- Що було найважче в описах інструментів і параметрів: вирішити, що модель має знати без коду — звідки
  брати id (через `leaddesk_find_leads`), що статус має відрізнятися від поточного і що зміна потребує
  підтвердження людини. Кожне з цього довелося написати явно в описах, бо інакше модель вгадувала б.

## Task B — що зробили агенти з серверами

- **Supabase:** <які інструменти викликав агент для міграції й сиду; що ви схвалили вручну; чи щось відхилили>
- **Vercel:** <як задеплоїли (git-інтеграція); яким інструментом отримали лог; що в ньому>
- **Figma:** <`whoami`: план і сіт; скільки викликів витратили з квоти; з якого фрейму токени>
- **Playwright:** <ланцюжок інструментів; чи відправилась форма; що в консолі й мережі>
- Що агент зробив сам, без прохання (наприклад, викликав інструмент, який ви не очікували): <… / нічого>

## Task E (бонус)

- Варіант: <E1 HTTP-сервер / E2 отруєний опис / E3 Cursor>
- <команди, виводи, спостереження — див. walkthrough, Task E>
