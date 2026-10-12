# Підключення MCP-серверів LeadDesk (Task B)

- **Акаунти** (особисті чи одноразові, без клієнтських організацій і команд): Supabase — особистий
  акаунт, одноразовий порожній проєкт на Free-плані · Vercel — особистий акаунт, Hobby, GitHub App
  має доступ лише до цього форку · Figma — особистий акаунт (зареєстрований на навчальну пошту, без
  клієнтських команд і файлів; `whoami` показав одну особисту команду), Starter-план, сіт View, власний
  файл із одним маленьким фреймом
- **Третій сервер:** Figma — чому саме він: хотіла побачити випадок, коли на сервері звузити нічим
  (єдиний OAuth-скоуп `mcp:connect`) і весь захист — лише deny на клієнті; до того ж Figma не дає
  агенту браузер, тобто ще одного каналу назовні.
- **Vercel CLI на цій машині:** не встановлено (`vercel` не знаходиться ні в Git Bash, ні в
  PowerShell). Агент сам пробував `vercel inspect --logs` і пропонував `npm i -g vercel` + вхід —
  відмовлено.

## Сервери

| Сервер | Який доступ | Навіщо нам | Що станеться при компрометації | Чим саме звужено |
|---|---|---|---|---|
| `supabase` | Один проєкт Supabase. Групи `database` (`list_tables`, `list_migrations`, `list_extensions`, `apply_migration`, `execute_sql`), `development` (`get_project_url`, `get_publishable_keys`, `generate_typescript_types`), `docs` (`search_docs`) — 9 інструментів. `execute_sql` і `apply_migration` ходять під роллю `postgres` (власник таблиць, RLS не діє): читання й запис **усієї** бази проєкту, DDL. | Міграція схеми `leads` і сид 20 лідів для Task C | Хто має OAuth-токен або керує моделлю (prompt injection з рядків бази), може прочитати всі дані проєкту, змінити чи знищити схему й дані, винести їх через інший відкритий у сесії канал. Інші проєкти й організації — недосяжні: інструменти прив'язані до одного `project_ref`. | `project_ref=ohczlmiigkkmvktiaptg` — зникає `project_id`, інших проєктів не видно. `features=database,development,docs`: немає `account` (`list_organizations`, `list_projects`, `create_project`…), `functions` (канал назовні — деплой коду), `branching` (платне). `read_only=true` свідомо немає: потрібен `apply_migration`. В `allow` лише `search_docs`, `list_tables`, `list_migrations`; `execute_sql` і `apply_migration` — кожен виклик схвалюю вручну. |
| `vercel` | Увесь мій користувач Vercel: OAuth-скоуп один (`openid`). Читає проєкти, деплої, логи; без deny міг би деплоїти, купувати (`buy_*`), роздавати посилання в обхід Deployment Protection, писати в toolbar-листування. | Знайти останній деплой і прочитати лог білду | Деплой у production, списання з картки (`buy_pro`, `buy_domain`…), публічні посилання на захищені деплої, повідомлення клієнту в toolbar. Через `use_vercel_cli` — ще й `env`, `rollback`, `rm`, якщо CLI залогінений. | На сервері звузити нічим. `deny` на всі 11 інструментів, що змінюють стан або роздають доступ (`buy_pro`, `buy_credits`, `buy_addon`, `buy_domain`, `deploy_to_vercel`, `get_access_to_vercel_url`, `import-claude-design-from-url` і 4 toolbar). В `allow` — лише `list_deployments`, `get_deployment`, `get_deployment_build_logs`, `list_deployment_events` (лог фактично повертає саме він). Vercel CLI не встановлено. Деплой — лише через git-інтеграцію, не через MCP. |
| `figma` | Увесь мій акаунт Figma: OAuth-скоуп один (`mcp:connect`). 41 інструмент: читання файлів, змінних, скриншотів; запис у файли (`use_figma`), створення файлів, завантаження асетів, генерація дизайнів і зображень, Code Connect, шейдери, Weave-моделі. | Змінні (дизайн-токени) з одного маленького фрейма | Читання всіх файлів, доступних акаунту; створення й зміна файлів, мапінги Code Connect, витрата квоти (20 викликів/міс. на Starter) і AI-кредитів. | На сервері звузити нічим. `deny` на 16 записуючих або витратних інструментів: 4 обов'язкові (`use_figma`, `create_new_file`, `upload_assets`, `generate_diagram`) + `generate_figma_design`, `generate_image`, `add_code_connect_map`, `send_code_connect_mappings`, `create_/update_generative_plugin`, `create_/update_shader`, `weave_run_model`, `weave_run_tool`, `weave_upload_asset`, `weave_cancel_tool_run`. Це захист лише на клієнті: токен однаково має повний `mcp:connect`. В `allow` нічого з Figma — кожен виклик питає (квота). |

## Supabase: схема й сид

- Міграція `supabase/migrations/0001_leaddesk.sql` створює таблиці: `public.leads` (`id`, `full_name`,
  `company`, `email`, `source`, `status` з `check` на 5 статусів, `budget`, `message`, `created_at`),
  індекси за `status` і `created_at desc`, RLS увімкнено без політик
- Сид `supabase/seed/leads.sql`: 20 рядків, `lead_0001`–`lead_0020`, ті самі, що в `materials/leads.json`
  (звірено статус, бюджет, email і дату — 0 розбіжностей); `select count(*) from leads` → 20
- Скільки інструментів Supabase видно в `/mcp` із вашим URL: 9
- Якими викликами створено схему й дані і що ви схвалювали вручну: `apply_migration` (схема) і
  `execute_sql` (insert 20 рядків, потім `count(*)` і перевірка ролі) — кожен виклик прочитано й
  схвалено вручну, без «don't ask again»

## Сесії: що вмикаємо разом

У кожній сесії — щонайбільше один сервер із правом запису; браузерний сервер — ніколи разом із Supabase.

| Крок | Увімкнено в `/mcp` | Сервер із правом запису в цій сесії |
|---|---|---|
| Вхід (OAuth) | `supabase`, `vercel`, `figma` — лише Authenticate, агенту нічого не писали | — (жодного запиту агенту) |
| Міграція й сид | `supabase` (`vercel`, `figma`, конектор claude.ai Claude Docs — вимкнено) | `supabase` |
| Лог білду | `vercel` | —, записуючі інструменти під deny |
| Знімок «до» | `figma` (без deny для Figma) | `figma` — записуючі ще доступні, агент нічого не викликав |
| Токени з Figma, знімок «після» | `figma` | —, записуючі інструменти під deny |

Конектор claude.ai Claude Docs (8 інструментів, створює й редагує документи) приходить з акаунта
claude.ai, а не з `.mcp.json`, і за замовчуванням увімкнений — у кожній сесії вимикала його вручну.
`.mcp.json` лежить у репозиторії: `claude -p` у цій теці підняв би всі три сервери без питань.

## До і після звуження: третій сервер

- Як отримали перелік: нова сесія, у `/mcp` лише `figma`, запит «Перелічи всі інструменти сервера
  figma, які тобі зараз доступні. Нічого не викликай.»; відповідь агента збережено по інструменту на рядок
- `docs/mcp/evidence/mcp-before.txt`: 41 інструмент
- `docs/mcp/evidence/mcp-after.txt`: 25 інструментів; зникли рівно 16 з `deny`: `use_figma`,
  `create_new_file`, `upload_assets`, `generate_diagram`, `generate_figma_design`, `generate_image`,
  `add_code_connect_map`, `send_code_connect_mappings`, `create_generative_plugin`,
  `update_generative_plugin`, `create_shader`, `update_shader`, `weave_run_model`, `weave_run_tool`,
  `weave_upload_asset`, `weave_cancel_tool_run`. Нових не з'явилось, жоден інший не зник.
