import path from 'node:path';
import {fileURLToPath} from 'node:url';
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const pkInfo = JSON.parse(fs.readFileSync(`${__dirname}/package.json`, 'utf8'));
export const _PARSER_SIG = `${pkInfo.name}@${pkInfo.version} [${pkInfo.homepage}]`;
