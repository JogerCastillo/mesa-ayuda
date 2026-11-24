const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const TEST_JWT_SECRET = "test-only-jwt-secret-with-at-least-32-characters";
const BACKEND_DIR = path.resolve(__dirname, "../..");

const startServer = async ({ seedUsers } = {}) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mesa-ayuda-tests-"));
  let child;

  try {
    if (seedUsers) {
      await seedUsers(dataDir);
    }

    child = spawn(process.execPath, ["src/server.js"], {
      cwd: BACKEND_DIR,
      env: {
        ...process.env,
        DATA_DIR: dataDir,
        JWT_SECRET: TEST_JWT_SECRET,
        PORT: "0",
        ADMIN_PASSWORD: "admin123",
        AGENTE1_PASSWORD: "agent123",
        AGENTE2_PASSWORD: "agent123"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    return await new Promise((resolve, reject) => {
      let output = "";
      let errorOutput = "";
      let settled = false;

      const cleanupListeners = () => {
        child.stdout.off("data", onStdout);
        child.stderr.off("data", onStderr);
        child.off("error", onError);
        child.off("exit", onExit);
      };

      const fail = (error) => {
        if (settled) return;
        settled = true;
        cleanupListeners();
        reject(error);
      };

      const onStdout = (chunk) => {
        output += chunk.toString();
        const match = output.match(/Mesa de ayuda API activa en http:\/\/localhost:(\d+)/);
        if (!match || settled) return;

        settled = true;
        cleanupListeners();
        let closed = false;

        resolve({
          baseUrl: `http://127.0.0.1:${match[1]}`,
          dataDir,
          close: async () => {
            if (closed) return;
            closed = true;

            if (child.exitCode === null && child.signalCode === null) {
              const exited = new Promise((resolveExit) => child.once("exit", resolveExit));
              child.kill();
              await exited;
            }

            fs.rmSync(dataDir, { recursive: true, force: true });
          }
        });
      };

      const onStderr = (chunk) => {
        errorOutput += chunk.toString();
      };

      const onError = (error) => fail(error);
      const onExit = (code) => {
        fail(new Error(
          `Server exited before listening (code ${code}). ${errorOutput || output}`.trim()
        ));
      };

      child.stdout.on("data", onStdout);
      child.stderr.on("data", onStderr);
      child.once("error", onError);
      child.once("exit", onExit);
    });
  } catch (error) {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise((resolveExit) => child.once("exit", resolveExit));
      child.kill();
      await exited;
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
    throw error;
  }
};

module.exports = {
  TEST_JWT_SECRET,
  startServer
};
