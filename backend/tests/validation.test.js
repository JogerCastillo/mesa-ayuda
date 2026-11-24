const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { getTokenFor } = require("./helpers/fixtures");
const { getServer, setup } = require("./helpers/setup");

setup();

let adminTokenPromise;
const getAdminToken = () => {
  if (!adminTokenPromise) {
    adminTokenPromise = getTokenFor(getServer().baseUrl, "admin");
  }
  return adminTokenPromise;
};

test("creating a ticket without a body returns 400", async () => {
  const { baseUrl } = getServer();
  const token = await getAdminToken();
  const response = await fetch(`${baseUrl}/api/tickets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });

  assert.equal(response.status, 400);
});

test("creating a ticket with required fields missing returns 400", async () => {
  const { baseUrl } = getServer();
  const token = await getAdminToken();
  const response = await fetch(`${baseUrl}/api/tickets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ title: "Incomplete ticket" })
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.message, "Datos inválidos para crear ticket.");
});

test("creating a ticket with a field of the wrong type returns 400", async () => {
  const { baseUrl } = getServer();
  const token = await getAdminToken();
  const response = await fetch(`${baseUrl}/api/tickets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: 123,
      description: "A sufficiently long description",
      category: "access",
      priority: "media"
    })
  });

  assert.equal(response.status, 400);
});

test("patching a ticket with an invalid status returns 400", async () => {
  const { baseUrl } = getServer();
  const token = await getAdminToken();
  const response = await fetch(`${baseUrl}/api/tickets/ticket-1`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status: "pending" })
  });

  assert.equal(response.status, 400);
});

test("unexpected route errors return sanitized JSON without a stack", async () => {
  const { baseUrl, dataDir } = getServer();
  const token = await getAdminToken();
  fs.writeFileSync(
    path.join(dataDir, "tickets.json"),
    JSON.stringify([{ id: "invalid-ticket", title: 123 }])
  );

  const response = await fetch(`${baseUrl}/api/tickets?q=trigger-error`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.deepEqual(body, { error: "Internal server error" });
  assert.equal(JSON.stringify(body).includes("stack"), false);
});
