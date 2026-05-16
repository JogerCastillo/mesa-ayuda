const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");

const PORT = 4200;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function waitForServer(childProcess) {
  return new Promise((resolve, reject) => {
    const onData = (data) => {
      const text = data.toString();
      if (text.includes("Mesa de ayuda API activa")) {
        cleanup();
        resolve();
      }
    };

    const onExit = (code) => {
      cleanup();
      reject(new Error(`El servidor cerro antes de quedar listo. Codigo: ${code}`));
    };

    const cleanup = () => {
      childProcess.stdout.off("data", onData);
      childProcess.stderr.off("data", onData);
      childProcess.off("exit", onExit);
    };

    childProcess.stdout.on("data", onData);
    childProcess.stderr.on("data", onData);
    childProcess.on("exit", onExit);
  });
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

async function requestWithRetry(path, options = {}, attempts = 15) {
  let lastError = null;

  for (let index = 0; index < attempts; index += 1) {
    try {
      return await request(path, options);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  throw lastError;
}

async function main() {
  if (!process.env.JWT_SECRET || !process.env.ADMIN_PASSWORD) {
    throw new Error("Environment required: JWT_SECRET and ADMIN_PASSWORD.");
  }

  const server = spawn(process.execPath, ["src/server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer(server);

    const health = await requestWithRetry("/api/health");
    assert.equal(health.response.ok, true);
    assert.equal(health.body.service, "mesa-ayuda-api");

    const login = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@soporte.local", password: process.env.ADMIN_PASSWORD })
    });

    assert.equal(login.response.ok, true);
    assert.ok(login.body.token);

    const me = await request("/api/auth/me", {
      headers: { Authorization: `Bearer ${login.body.token}` }
    });

    assert.equal(me.response.ok, true);
    assert.equal(me.body.user.email, "admin@soporte.local");

    console.log("Smoke test OK");
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
