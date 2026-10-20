import { buildApp } from "./app.js";
import { env } from "./env.js";

const app = buildApp();
app.listen({ port: env.PORT, host: "127.0.0.1" }).then((addr) => {
  console.log(`spanish-api listening on ${addr}`);
});
