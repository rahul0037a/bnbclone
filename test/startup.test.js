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

test("startup handles a session index failure before closing MongoDB", () => {
    const result = spawnSync(process.execPath, ["-e", `
        const assert = require("node:assert/strict");
        const mongoose = require("mongoose");
        const { start } = require("./app");
        const index = Promise.withResolvers();
        const indexStarted = Promise.withResolvers();
        const failure = new Error("Session index could not be created");
        let closed = false;
        mongoose.connect = async () => {};
        mongoose.disconnect = async () => { closed = true; };
        mongoose.connection.getClient = () => ({
            db: () => ({ collection: () => ({ createIndex() {
                indexStarted.resolve();
                return index.promise;
            } }) }),
        });
        (async () => {
            const rejected = assert.rejects(start(), error => error === failure);
            await indexStarted.promise;
            assert.equal(closed, false);
            index.reject(failure);
            await rejected;
            assert.equal(closed, true);
        })().catch(error => { console.error(error); process.exitCode = 1; });
    `], {
        cwd: path.resolve(__dirname, ".."),
        env: { ...process.env, NODE_ENV: "production", PREVIEW_MODE: "false", SECRET: "test-only-secret-with-at-least-32-characters", ATLASDB_URL: "mongodb://127.0.0.1:1/unused", DB_NAME: "unused", PORT: "10000" },
        encoding: "utf8", timeout: 10000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /WanderLust ready/);
});
