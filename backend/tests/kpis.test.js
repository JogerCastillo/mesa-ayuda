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

test("admin KPI counts include all seeded tickets", async () => {
  const { baseUrl } = getServer();
  const token = await getToken("admin");
  const response = await fetch(`${baseUrl}/api/dashboard/kpis`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.data, {
    total: 6,
    abiertos: 2,
    enProgreso: 1,
    resueltos: 2,
    cerrados: 1,
    prioridadAlta: 2
  });
});

test("agent KPI counts include only tickets visible to that agent", async () => {
  const { baseUrl } = getServer();
  const token = await getToken("agent1");
  const response = await fetch(`${baseUrl}/api/dashboard/kpis`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.data, {
    total: 3,
    abiertos: 1,
    enProgreso: 1,
    resueltos: 1,
    cerrados: 0,
    prioridadAlta: 1
  });
});
