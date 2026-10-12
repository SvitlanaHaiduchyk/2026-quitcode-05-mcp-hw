// LeadDesk over Streamable HTTP (Task E1): the same factory as src/server.mjs, local only.
//
//   node src/http.mjs        http://127.0.0.1:3333/mcp
//
// The Host/Origin guards must be called here by hand: passed as an option to toNodeHandler they are
// silently ignored, and a forged Host gets 200 (DNS rebinding from a browser tab).
import { createServer } from "node:http";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { toNodeHandler, localhostHostValidation, localhostOriginValidation } from "@modelcontextprotocol/node";
import { factory } from "./leaddesk.mjs";

const PORT = 3333;
const mcp = toNodeHandler(createMcpHandler(factory));
const checkHost = localhostHostValidation();
const checkOrigin = localhostOriginValidation();

createServer(async (req, res) => {
  if (!checkHost(req, res)) return; // the guard has already answered 403
  if (!checkOrigin(req, res)) return;
  await mcp(req, res);
}).listen(PORT, "127.0.0.1", () => console.error(`[leaddesk] http://127.0.0.1:${PORT}/mcp`));
