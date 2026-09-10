const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const CLI_PATH = path.join(__dirname, "../bin/pdf2json.js");
const TEST_PDF = path.join(__dirname, "pdf/fd/form/F1040.pdf");
const TEST_PDF_DIR = path.join(__dirname, "pdf/mpf");

function runCLI(args, timeout = 15000) {
	return new Promise((resolve) => {
		execFile("node", [CLI_PATH, ...args], { timeout }, (error, stdout, stderr) => {
			resolve({
				stdout,
				stderr,
				exitCode: error ? error.code : 0,
			});
		});
	});
}

describe("CLI", () => {
	let tmpDir;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf2json-test-"));
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("--version outputs version and exits 0", async () => {
		const { stdout, exitCode } = await runCLI(["-v"]);
		assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
		assert.strictEqual(exitCode, 0);
	});

	it("--help outputs usage info and exits 0", async () => {
		const { stdout, exitCode } = await runCLI(["-h"]);
		assert.ok(stdout.includes("Usage:"));
		assert.ok(stdout.includes("-f, --file"));
		assert.strictEqual(exitCode, 0);
	});

	it("no args exits with code 2", async () => {
		const { exitCode, stderr } = await runCLI([]);
		assert.strictEqual(exitCode, 2);
		assert.ok(stderr.includes("-f|--file parameter is required"));
	});

	it("nonexistent file exits with code 3 (I/O error)", async () => {
		const { exitCode, stderr } = await runCLI(["-f", "/nonexistent/file.pdf"]);
		assert.strictEqual(exitCode, 3);
		assert.ok(stderr.includes("Input path does not exist"));
	});

	it("single file processing produces output JSON", async () => {
		const { exitCode } = await runCLI(["-f", TEST_PDF, "-o", tmpDir, "-s"]);
		assert.strictEqual(exitCode, 0);

		const outputFile = path.join(tmpDir, "F1040.json");
		assert.ok(fs.existsSync(outputFile));

		const content = JSON.parse(fs.readFileSync(outputFile, "utf8"));
		assert.ok("Pages" in content);
		assert.ok(content.Pages.length > 0);
	});

	it("directory processing produces output for all PDFs", async () => {
		const { exitCode } = await runCLI(["-f", TEST_PDF_DIR, "-o", tmpDir, "-s"]);
		assert.strictEqual(exitCode, 0);

		const files = fs.readdirSync(tmpDir).filter(f => f.endsWith(".json"));
		assert.ok(files.length > 0);
	});

	it("--json flag outputs structured JSON to stdout", async () => {
		const { stdout, exitCode } = await runCLI(["-f", TEST_PDF, "-o", tmpDir, "--json"]);
		assert.strictEqual(exitCode, 0);

		// Extract the JSON line (last line of stdout)
		const lines = stdout.trim().split("\n");
		const jsonLine = lines.find(l => l.startsWith("{"));
		assert.ok(jsonLine);

		const result = JSON.parse(jsonLine);
		assert.ok("version" in result);
		assert.ok("stats" in result);
		assert.strictEqual(result.stats.success, 1);
		assert.strictEqual(result.stats.failed, 0);
		assert.ok("outputs" in result);
		assert.ok(result.outputs.length > 0);
	});

	it("-t flag generates fields.json output", async () => {
		const { exitCode } = await runCLI(["-f", TEST_PDF, "-o", tmpDir, "-s", "-t"]);
		assert.strictEqual(exitCode, 0);

		assert.ok(fs.existsSync(path.join(tmpDir, "F1040.json")));
		assert.ok(fs.existsSync(path.join(tmpDir, "F1040.fields.json")));
	});

	it("-c flag generates content.txt output", async () => {
		const { exitCode } = await runCLI(["-f", TEST_PDF, "-o", tmpDir, "-s", "-c"]);
		assert.strictEqual(exitCode, 0);

		assert.ok(fs.existsSync(path.join(tmpDir, "F1040.json")));
		assert.ok(fs.existsSync(path.join(tmpDir, "F1040.content.txt")));
	});

	it("-q flag suppresses non-error output", async () => {
		const { stdout, exitCode } = await runCLI(["-f", TEST_PDF, "-o", tmpDir, "-q"]);
		assert.strictEqual(exitCode, 0);
		// Quiet mode should not print the timer or status messages
		assert.ok(!stdout.includes("pdf2json@"));
		assert.ok(!stdout.includes("Success"));
	});
});
