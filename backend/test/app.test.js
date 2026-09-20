const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const app = require("../src/app");

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      http.get({ port: server.address().port, path, headers }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => { server.close(); resolve({ status: res.statusCode, body }); });
      }).on("error", reject);
    });
  });
}

test("boots and answers /api/health with no Firebase credentials", async () => {
  assert.strictEqual((await get("/api/health")).status, 200);
});
test("/api/auth/me without a token is 503 when unconfigured, never a crash", async () => {
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON; delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  assert.strictEqual((await get("/api/auth/me")).status, 503);
});
test("with credentials configured, a missing/garbage token is 401", async () => {
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = "{}";
  assert.strictEqual((await get("/api/auth/me")).status, 401);
  assert.strictEqual((await get("/api/auth/me", { authorization: "Bearer nope" })).status, 401);
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
});
