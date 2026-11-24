const assert = require("node:assert/strict");
const { test } = require("node:test");
const { getTokenFor } = require("./helpers/fixtures");
const { getServer, setup } = require("./helpers/setup");

setup();

const tokenPromises = new Map();
const getToken = (role) => {
  if (!tokenPromises.has(role)) {
    tokenPromises.set(role, getTokenFor(getServer().baseUrl, role));
  }
  return tokenPromises.get(role);
};

test("agent cannot delete a ticket", async () => {
  const { baseUrl } = getServer();
  const token = await getToken("agent1");
  const response = await fetch(`${baseUrl}/api/tickets/ticket-5`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  assert.equal(response.status, 403);
});

test("admin can delete a ticket", async () => {
  const { baseUrl } = getServer();
  const token = await getToken("admin");
  const response = await fetch(`${baseUrl}/api/tickets/ticket-5`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  assert.equal(response.status, 204);
});

test("agent sees only tickets assigned to them or created by them", async () => {
  const { baseUrl } = getServer();
  const token = await getToken("agent1");
  const response = await fetch(`${baseUrl}/api/tickets`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(
    body.data.map((ticket) => ticket.id).sort(),
    ["ticket-1", "ticket-2", "ticket-6"]
  );
});

test("admin sees all seeded tickets", async () => {
  const { baseUrl } = getServer();
  const token = await getToken("admin");
  const response = await fetch(`${baseUrl}/api/tickets`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.length, 6);
});

test("agent can take an unassigned ticket they created", async () => {
  const { baseUrl } = getServer();
  const token = await getToken("agent2");
  const response = await fetch(`${baseUrl}/api/tickets/ticket-4`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      assignedTo: "agent2@test.com",
      status: "en_progreso"
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.assignedTo, "agent2@test.com");
  assert.equal(body.data.status, "en_progreso");
});

test("agent cannot update a ticket belonging to another user", async () => {
  const { baseUrl } = getServer();
  const token = await getToken("agent1");
  const response = await fetch(`${baseUrl}/api/tickets/ticket-5`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status: "en_progreso" })
  });

  assert.equal(response.status, 403);
});
