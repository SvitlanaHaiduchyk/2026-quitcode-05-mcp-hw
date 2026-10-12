// LeadDesk as a domain MCP server (Task A): two business verbs instead of SQL on the whole database.
//
//   node src/server.mjs                                   fixture next to this module
//   LEADDESK_FIXTURE=/path/to/leads.json node src/server.mjs
//
// The fixture is read once; status changes and the audit live only in this process's memory.
// The file is never written. stdout is the protocol channel: log only via console.error, no personal data.
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const FIXTURE = process.env.LEADDESK_FIXTURE ?? fileURLToPath(new URL("../fixtures/leads.json", import.meta.url));

// Same vocabulary as the app: LEAD_STATUSES in lib/types.ts, leadId() in lib/db.ts.
const LEAD_STATUSES = ["new", "contacted", "qualified", "won", "lost"];

const leads = JSON.parse(await readFile(FIXTURE, "utf8"));
const audit = [];

// Only what the two verbs need: no name, email or request text.
const publicLead = ({ id, company, status, source, budget, createdAt }) => ({ id, company, status, source, budget, createdAt });

const fail = (text) => ({ isError: true, content: [{ type: "text", text }] });

const STATUSES_DOC = `# Статуси лідів LeadDesk

| Статус | Що означає для команди |
|---|---|
| \`new\` | Заявка щойно надійшла з форми чи іншого джерела. Ніхто з команди ще не зв'язувався з клієнтом. |
| \`contacted\` | Менеджер уперше зв'язався з клієнтом (дзвінок, email чи месенджер) і отримав відповідь або залишив повідомлення. Лід стає \`contacted\` одразу після першого контакту. |
| \`qualified\` | Після розмови підтверджено три речі: є реальна потреба в наших послугах, є бюджет (або діапазон) і є людина, яка ухвалює рішення. Без усіх трьох лід лишається \`contacted\`. |
| \`won\` | Клієнт погодив кошторис і підписав договір або сплатив аванс. У \`won\` переводить лише акаунт-менеджер, який веде угоду, після підтвердження оплати чи підпису. |
| \`lost\` | Клієнт відмовився, не відповідає після трьох спроб зв'язку або не підходить нам (немає бюджету, не наш профіль). У причині завжди вказуємо, чому. |

Звичайний шлях: \`new\` → \`contacted\` → \`qualified\` → \`won\` або \`lost\`. Перевести в \`lost\` можна з будь-якого статусу.
Кожна зміна статусу — лише через \`leaddesk_set_lead_status\`, з причиною й після підтвердження людини; вона лишає запис в аудиті.
`;

const factory = () => {
  const server = new McpServer({ name: "leaddesk", version: "0.1.0" });

  server.registerTool(
    "leaddesk_find_leads",
    {
      title: "Знайти ліди",
      description:
        "Повертає ліди LeadDesk за статусом, найновіші першими: id, компанія, статус, джерело, бюджет, дата створення. Застосовуй, щоб показати, хто в роботі, або знайти id ліда перед зміною статусу. Імен, email і тексту заявки не повертає. Тільки читає.",
      inputSchema: {
        status: z
          .enum([...LEAD_STATUSES, "any"])
          .describe("Який статус шукати: new, contacted, qualified, won, lost; any — усі статуси. Що означає кожен — у ресурсі leaddesk://reference/statuses"),
        limit: z.number().int().min(1).max(50).default(10).describe("Скільки лідів повернути, від 1 до 50; за замовчуванням 10"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ status, limit = 10 }) => {
      const found = leads
        .filter((l) => status === "any" || l.status === status)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map(publicLead);
      const lines = found.map((l) => `- ${l.id} · ${l.company} · ${l.status} · ${l.source} · бюджет ${l.budget ?? "—"} · ${l.createdAt.slice(0, 10)}`);
      const text = found.length
        ? `Знайдено лідів: ${found.length} (статус: ${status}, найновіші першими)\n${lines.join("\n")}`
        : `Лідів зі статусом ${status} немає.`;
      return { content: [{ type: "text", text }], structuredContent: { status, count: found.length, leads: found } };
    },
  );

  server.registerTool(
    "leaddesk_set_lead_status",
    {
      title: "Змінити статус ліда",
      description:
        "ЗМІНЮЄ ДАНІ: переводить лід LeadDesk у новий статус і записує зміну в аудит. Перед викликом обов'язково отримай підтвердження людини у форматі «змінити статус lead_XXXX на <статус>». Id ліда бери з leaddesk_find_leads, значення статусів — з ресурсу leaddesk://reference/statuses.",
      inputSchema: {
        leadId: z.string().regex(/^lead_\d{4}$/).describe("Ідентифікатор ліда у форматі lead_ і чотири цифри, напр. lead_0002"),
        status: z.enum(LEAD_STATUSES).describe("Новий статус: new, contacted, qualified, won або lost. Має відрізнятися від поточного"),
        reason: z.string().min(3).max(500).describe("Чому змінюємо статус, 3–500 символів, напр. «дзвінок 07.10: клієнт підтвердив бюджет»"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ leadId, status, reason }) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return fail(`Лід ${leadId} не знайдено. Знайди правильний id через leaddesk_find_leads (status: "any").`);
      if (lead.status === status) return fail(`Лід ${leadId} уже має статус ${status}; нічого не змінено.`);

      const from = lead.status;
      lead.status = status;
      const entry = { action: `lead.status_changed:${from}->${status}`, leadId, at: new Date().toISOString(), reason };
      audit.push(entry);
      console.error(`[leaddesk] ${entry.action} ${leadId}`);

      return {
        content: [{ type: "text", text: `Статус ${leadId} змінено: ${from} → ${status}. Запис аудиту: ${entry.action} о ${entry.at}.` }],
        structuredContent: { lead: publicLead(lead), previousStatus: from, audit: entry },
      };
    },
  );

  server.registerResource(
    "leaddesk-statuses",
    "leaddesk://reference/statuses",
    { title: "Статуси лідів", description: "П'ять статусів ліда й що кожен означає для команди: коли переводити й хто це робить", mimeType: "text/markdown" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: STATUSES_DOC }] }),
  );

  return server;
};

await serveStdio(factory);
