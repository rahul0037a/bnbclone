const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { getConfig } = require("../utils/config");
const { StartupConfigurationError, describeStartupError } = require("../utils/startupError");

test("production startup reports the rejected setting without logging its value", () => {
    const base = { ...process.env, NODE_ENV: "production", PREVIEW_MODE: "false", SECRET: "test-only-secret-with-at-least-32-characters", ATLASDB_URL: "", DB_NAME: "", PORT: "10000" };
    const cases = [
        [{ SECRET: "private-short-secret" }, "INVALID_SESSION_SECRET", /at least 32 characters/],
        [{}, "MISSING_DATABASE_URL", /Set ATLASDB_URL/],
        [{ PORT: "private-invalid-port" }, "INVALID_PORT", /valid TCP port/],
        [{ PREVIEW_MODE: "true", DB_NAME: "private-production-database" }, "INVALID_PREVIEW_DATABASE", /PREVIEW_MODE=false/],
    ];
    for (const [overrides, code, guidance] of cases) {
        const result = spawnSync(process.execPath, ["app.js"], {
            cwd: path.resolve(__dirname, ".."), env: { ...base, ...overrides }, encoding: "utf8", timeout: 10000,
        });
        assert.equal(result.error, undefined);
        assert.equal(result.status, 1, result.stderr);
        assert.ok(result.stderr.includes(`Startup failed: [${code}]`), result.stderr);
        assert.match(result.stderr, guidance);
        assert.doesNotMatch(result.stdout + result.stderr, /private-|test-only-secret|mongodb(?:\+srv)?:\/\//);
    }
});

test("database startup diagnostics classify failures without exposing raw messages", () => {
    const raw = "mongodb+srv://private-user:private-password@private-host/private-database";
    const failures = [
        [{ code: 18, name: "MongoServerError" }, "DATABASE_AUTHENTICATION"],
        [{ codeName: "AuthenticationFailed" }, "DATABASE_AUTHENTICATION"],
        [{ name: "MongoParseError" }, "INVALID_DATABASE_URL"],
        [{ code: "ENOTFOUND" }, "DATABASE_DNS"],
        [{ name: "MongooseServerSelectionError" }, "DATABASE_CONNECTION"],
        [{ name: "MongoNetworkError" }, "DATABASE_CONNECTION"],
        [{ name: raw }, "STARTUP_ERROR"],
    ];
    for (const [details, code] of failures) {
        const error = Object.assign(new Error(raw), details);
        const result = describeStartupError(error);
        assert.ok(result.startsWith(`[${code}]`), result);
        assert.doesNotMatch(result, /private-|mongodb(?:\+srv)?:\/\//);
    }
    const configError = new StartupConfigurationError("INVALID_SESSION_SECRET");
    configError.message = raw;
    assert.doesNotMatch(describeStartupError(configError), /private-/);
});

test("malformed database URL escapes produce safe configuration diagnostics", () => {
    assert.throws(
        () => getConfig({ ATLASDB_URL: "mongodb://private-user:private-password@localhost/%invalid" }),
        error => error instanceof StartupConfigurationError && error.code === "INVALID_DATABASE_URL",
    );
});
