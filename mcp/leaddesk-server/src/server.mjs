// LeadDesk as a domain MCP server over stdio (Task A): two business verbs instead of SQL on the whole database.
//
//   node src/server.mjs                                   fixture next to this module
//   LEADDESK_FIXTURE=/path/to/leads.json node src/server.mjs
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { factory } from "./leaddesk.mjs";

await serveStdio(factory);
