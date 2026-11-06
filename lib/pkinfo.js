import * as pkInfo from "../package.json";

const PARSER_SIG = `${pkInfo.name}@${pkInfo.version} [${pkInfo.homepage}]`;

export { pkInfo, PARSER_SIG };
