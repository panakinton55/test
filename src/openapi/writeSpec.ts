import { mkdirSync, writeFileSync } from "node:fs";
import { openApiDocument } from "./document.js";

mkdirSync("openapi", { recursive: true });
writeFileSync("openapi/openapi.json", `${JSON.stringify(openApiDocument, null, 2)}\n`);
