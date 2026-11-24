const bcrypt = require("bcryptjs");
const fs = require("node:fs");
const path = require("node:path");

const TEST_USERS = {
  admin: { email: "admin@test.com", password: "admin123" },
  agent1: { email: "agent1@test.com", password: "agent123" },
  agent2: { email: "agent2@test.com", password: "agent123" }
};

const seedUsers = async (dataDir) => {
  fs.mkdirSync(dataDir, { recursive: true });
  const users = await Promise.all([
    {
      id: "test-admin",
      name: "Test Admin",
      ...TEST_USERS.admin,
      role: "admin"
    },
    {
      id: "test-agent-1",
      name: "Test Agent One",
      ...TEST_USERS.agent1,
      role: "agente"
    },
    {
      id: "test-agent-2",
      name: "Test Agent Two",
      ...TEST_USERS.agent2,
      role: "agente"
    }
  ].map(async ({ password, ...user }) => ({
    ...user,
    passwordHash: await bcrypt.hash(password, 10)
  })));

  fs.writeFileSync(path.join(dataDir, "users.json"), JSON.stringify(users, null, 2));
};

const seedTickets = (dataDir) => {
  const tickets = [
    {
      id: "ticket-1",
      title: "Acceso a VPN",
      description: "No puedo conectarme a la VPN",
      category: "acceso",
      priority: "alta",
      status: "abierto",
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-01T10:00:00.000Z",
      createdBy: TEST_USERS.admin.email,
      assignedTo: TEST_USERS.agent1.email
    },
    {
      id: "ticket-2",
      title: "Actualizar permisos",
      description: "Necesito permisos para el sistema",
      category: "acceso",
      priority: "media",
      status: "en_progreso",
      createdAt: "2026-01-02T10:00:00.000Z",
      updatedAt: "2026-01-02T10:00:00.000Z",
      createdBy: TEST_USERS.agent1.email,
      assignedTo: TEST_USERS.agent1.email
    },
    {
      id: "ticket-3",
      title: "Reporte mensual",
      description: "El reporte mensual no carga",
      category: "reportes",
      priority: "alta",
      status: "resuelto",
      createdAt: "2026-01-03T10:00:00.000Z",
      updatedAt: "2026-01-03T10:00:00.000Z",
      createdBy: TEST_USERS.admin.email,
      assignedTo: TEST_USERS.agent2.email
    },
    {
      id: "ticket-4",
      title: "Impresora sin conexión",
      description: "La impresora de recepción está fuera de línea",
      category: "hardware",
      priority: "baja",
      status: "abierto",
      createdAt: "2026-01-04T10:00:00.000Z",
      updatedAt: "2026-01-04T10:00:00.000Z",
      createdBy: TEST_USERS.agent2.email,
      assignedTo: null
    },
    {
      id: "ticket-5",
      title: "Solicitud administrativa",
      description: "Revisar acceso administrativo",
      category: "administracion",
      priority: "media",
      status: "cerrado",
      createdAt: "2026-01-05T10:00:00.000Z",
      updatedAt: "2026-01-05T10:00:00.000Z",
      createdBy: TEST_USERS.admin.email,
      assignedTo: null
    },
    {
      id: "ticket-6",
      title: "Restablecer contraseña",
      description: "No puedo restablecer mi contraseña",
      category: "acceso",
      priority: "baja",
      status: "resuelto",
      createdAt: "2026-01-06T10:00:00.000Z",
      updatedAt: "2026-01-06T10:00:00.000Z",
      createdBy: TEST_USERS.agent1.email,
      assignedTo: TEST_USERS.agent2.email
    }
  ];

  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "tickets.json"), JSON.stringify(tickets, null, 2));
};

const login = async (baseUrl, email, password) => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Login failed with status ${response.status}: ${body.message}`);
  }

  return { token: body.token, user: body.user };
};

const getTokenFor = async (baseUrl, role) => {
  const credentials = role === "admin"
    ? TEST_USERS.admin
    : role === "agent2"
      ? TEST_USERS.agent2
      : TEST_USERS.agent1;
  const { token } = await login(baseUrl, credentials.email, credentials.password);
  return token;
};

module.exports = {
  TEST_USERS,
  getTokenFor,
  login,
  seedTickets,
  seedUsers
};
