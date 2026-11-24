const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const path = require("node:path");
const { test } = require("node:test");
const { login, TEST_USERS } = require("./helpers/fixtures");
const { getServer, setup } = require("./helpers/setup");
const { TEST_JWT_SECRET } = require("./helpers/server");

setup({ withTickets: false });

test("server authenticates a user loaded from the configured temp DATA_DIR", async () => {
  const { baseUrl, dataDir } = getServer();
  assert.notEqual(dataDir, path.resolve(__dirname, "..", "data"));

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(TEST_USERS.admin)
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(jwt.verify(body.token, TEST_JWT_SECRET).role, "admin");
  assert.deepEqual(body.user, {
    id: "test-admin",
    name: "Test Admin",
    email: TEST_USERS.admin.email,
    role: "admin"
  });
});

test("incorrect password is rejected", async () => {
  const { baseUrl } = getServer();
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_USERS.admin.email, password: "wrongpass" })
  });

  assert.equal(response.status, 401);
});

test("unknown email is rejected", async () => {
  const { baseUrl } = getServer();
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "unknown@test.com", password: "admin123" })
  });

  assert.equal(response.status, 401);
});

test("valid token returns the authenticated user from /me", async () => {
  const { baseUrl } = getServer();
  const { token } = await login(baseUrl, TEST_USERS.agent1.email, TEST_USERS.agent1.password);
  const response = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.user.email, TEST_USERS.agent1.email);
  assert.equal(body.user.role, "agente");
});

test("missing token is rejected by /me", async () => {
  const { baseUrl } = getServer();
  const response = await fetch(`${baseUrl}/api/auth/me`);

  assert.equal(response.status, 401);
});

test("malformed token is rejected by /me", async () => {
  const { baseUrl } = getServer();
  const response = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: "Bearer not-a-valid-jwt" }
  });

  assert.equal(response.status, 401);
});
