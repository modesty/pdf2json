// import path from "path";
// import { fileURLToPath } from "url";
// import fs from "fs";
import * as pkInfo from "../package.json";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const pkInfo = JSON.parse(fs.readFileSync(`${__dirname}/../package.json`, "utf8"));
const _PARSER_SIG = `${pkInfo.name}@${pkInfo.version} [${pkInfo.homepage}]`;

export { pkInfo, _PARSER_SIG };
