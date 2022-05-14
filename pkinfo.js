import path from 'path';
import {fileURLToPath} from 'url';
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const pkInfo = JSON.parse(fs.readFileSync(`${__dirname}/package.json`, 'utf8'));
export const _PARSER_SIG = `${pkInfo.name}@${pkInfo.version} [${pkInfo.homepage}]`;