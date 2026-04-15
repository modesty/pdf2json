const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

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

	test("--version outputs version and exits 0", async () => {
		const { stdout, exitCode } = await runCLI(["-v"]);
		expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
		expect(exitCode).toBe(0);
	});

	test("--help outputs usage info and exits 0", async () => {
		const { stdout, exitCode } = await runCLI(["-h"]);
		expect(stdout).toContain("Usage:");
		expect(stdout).toContain("-f, --file");
		expect(exitCode).toBe(0);
	});

	test("no args exits with code 2", async () => {
		const { exitCode, stderr } = await runCLI([]);
		expect(exitCode).toBe(2);
		expect(stderr).toContain("-f|--file parameter is required");
	});

	test("nonexistent file exits with code 3 (I/O error)", async () => {
		const { exitCode, stderr } = await runCLI(["-f", "/nonexistent/file.pdf"]);
		expect(exitCode).toBe(3);
		expect(stderr).toContain("Input path does not exist");
	});

	test("single file processing produces output JSON", async () => {
		const { exitCode } = await runCLI(["-f", TEST_PDF, "-o", tmpDir, "-s"]);
		expect(exitCode).toBe(0);

		const outputFile = path.join(tmpDir, "F1040.json");
		expect(fs.existsSync(outputFile)).toBe(true);

		const content = JSON.parse(fs.readFileSync(outputFile, "utf8"));
		expect(content).toHaveProperty("Pages");
		expect(content.Pages.length).toBeGreaterThan(0);
	});

	test("directory processing produces output for all PDFs", async () => {
		const { exitCode } = await runCLI(["-f", TEST_PDF_DIR, "-o", tmpDir, "-s"]);
		expect(exitCode).toBe(0);

		const files = fs.readdirSync(tmpDir).filter(f => f.endsWith(".json"));
		expect(files.length).toBeGreaterThan(0);
	});

	test("--json flag outputs structured JSON to stdout", async () => {
		const { stdout, exitCode } = await runCLI(["-f", TEST_PDF, "-o", tmpDir, "--json"]);
		expect(exitCode).toBe(0);

		// Extract the JSON line (last line of stdout)
		const lines = stdout.trim().split("\n");
		const jsonLine = lines.find(l => l.startsWith("{"));
		expect(jsonLine).toBeDefined();

		const result = JSON.parse(jsonLine);
		expect(result).toHaveProperty("version");
		expect(result).toHaveProperty("stats");
		expect(result.stats.success).toBe(1);
		expect(result.stats.failed).toBe(0);
		expect(result).toHaveProperty("outputs");
		expect(result.outputs.length).toBeGreaterThan(0);
	});

	test("-t flag generates fields.json output", async () => {
		const { exitCode } = await runCLI(["-f", TEST_PDF, "-o", tmpDir, "-s", "-t"]);
		expect(exitCode).toBe(0);

		expect(fs.existsSync(path.join(tmpDir, "F1040.json"))).toBe(true);
		expect(fs.existsSync(path.join(tmpDir, "F1040.fields.json"))).toBe(true);
	});

	test("-c flag generates content.txt output", async () => {
		const { exitCode } = await runCLI(["-f", TEST_PDF, "-o", tmpDir, "-s", "-c"]);
		expect(exitCode).toBe(0);

		expect(fs.existsSync(path.join(tmpDir, "F1040.json"))).toBe(true);
		expect(fs.existsSync(path.join(tmpDir, "F1040.content.txt"))).toBe(true);
	});

	test("-q flag suppresses non-error output", async () => {
		const { stdout, exitCode } = await runCLI(["-f", TEST_PDF, "-o", tmpDir, "-q"]);
		expect(exitCode).toBe(0);
		// Quiet mode should not print the timer or status messages
		expect(stdout).not.toContain("pdf2json@");
		expect(stdout).not.toContain("Success");
	});
});
