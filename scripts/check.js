const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const ejs = require("ejs");
const skip = new Set(["node_modules", ".git", ".verification"]);
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).filter(x => !skip.has(x.name)).flatMap(x => x.isDirectory() ? walk(path.join(dir, x.name)) : [path.join(dir, x.name)]); }
let javascript = 0, templates = 0;
for (const file of walk(process.cwd())) {
    if (file.endsWith(".js")) { cp.execFileSync(process.execPath, ["--check", file], { stdio: "pipe" }); javascript++; }
    if (file.endsWith(".ejs")) { ejs.compile(fs.readFileSync(file, "utf8"), { filename: file }); templates++; }
}
console.log(`Syntax passed: ${javascript} JavaScript files, ${templates} EJS templates.`);
