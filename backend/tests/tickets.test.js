const assert = require("node:assert/strict");
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

test("admin gets all seeded tickets", async () => {
  const { baseUrl } = getServer();
  const token = await getAdminToken();
  const response = await fetch(`${baseUrl}/api/tickets`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.length, 6);
});

test("status filter returns only open tickets", async () => {
  const { baseUrl } = getServer();
  const token = await getAdminToken();
  const response = await fetch(`${baseUrl}/api/tickets?status=abierto`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(body.data.length > 0);
  assert.ok(body.data.every((ticket) => ticket.status === "abierto"));
});

test("priority filter returns only high-priority tickets", async () => {
  const { baseUrl } = getServer();
  const token = await getAdminToken();
  const response = await fetch(`${baseUrl}/api/tickets?priority=alta`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.length, 2);
  assert.ok(body.data.every((ticket) => ticket.priority === "alta"));
});

test("q search matches ticket title, description, or category", async () => {
  const { baseUrl } = getServer();
  const token = await getAdminToken();
  const response = await fetch(`${baseUrl}/api/tickets?q=impresora`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.data.map((ticket) => ticket.id), ["ticket-4"]);
});

test("creating a ticket persists it in the JSON store", async () => {
  const { baseUrl } = getServer();
  const token = await getAdminToken();
  const createResponse = await fetch(`${baseUrl}/api/tickets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: "Nuevo acceso",
      description: "Solicito acceso al sistema de reportes",
      category: "acceso",
      priority: "media"
    })
  });
  const created = await createResponse.json();
  const listResponse = await fetch(`${baseUrl}/api/tickets`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const listed = await listResponse.json();

  assert.equal(createResponse.status, 201);
  assert.equal(created.data.status, "abierto");
  assert.ok(listed.data.some((ticket) => ticket.id === created.data.id));
});

test("patching a ticket changes and persists its status", async () => {
  const { baseUrl } = getServer();
  const token = await getAdminToken();
  const updateResponse = await fetch(`${baseUrl}/api/tickets/ticket-1`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status: "en_progreso" })
  });
  const updated = await updateResponse.json();
  const listResponse = await fetch(`${baseUrl}/api/tickets`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const listed = await listResponse.json();

  assert.equal(updateResponse.status, 200);
  assert.equal(updated.data.status, "en_progreso");
  assert.equal(
    listed.data.find((ticket) => ticket.id === "ticket-1").status,
    "en_progreso"
  );
});
