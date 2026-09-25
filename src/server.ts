import { createServer } from "node:http";
import { deliverMatter } from "./legal-delivery.js";

const server = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/matters/deliver") { res.writeHead(404); res.end("not found"); return; }
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const result = await deliverMatter(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(result));
  } catch (error) {
    res.writeHead(400, { "content-type": "application/json" }); res.end(JSON.stringify({ error: error instanceof Error ? error.message : "invalid request" }));
  }
});
server.listen(Number(process.env.PORT ?? 3000));
console.log("legal delivery service listening on port", process.env.PORT ?? 3000);
