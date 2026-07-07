require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { z } = require("zod");
const { readJson, writeJson, writeJsonAtomic } = require("./store");

const PORT = Number(process.env.PORT || 4200);
const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
const CORS_ORIGINS = String(process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const USERS_FILE = path.join(__dirname, "..", "data", "users.json");
const TICKETS_FILE = path.join(__dirname, "..", "data", "tickets.json");

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required. Define it in backend/.env or environment variables.");
}

if (JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long for security.");
}

if (!Number.isInteger(BCRYPT_ROUNDS) || BCRYPT_ROUNDS < 8 || BCRYPT_ROUNDS > 14) {
  throw new Error("BCRYPT_ROUNDS must be an integer between 8 and 14.");
}

if (process.env.NODE_ENV === "production" && !CORS_ORIGINS.length) {
  console.info("Production mode: CORS_ORIGIN not set. Cross-origin requests will be blocked.");
}

const app = express();

app.set("trust proxy", 1);

app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  useDefaults: true,
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "https://cdn.tailwindcss.com"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  },
}));

app.use(cors(
  CORS_ORIGINS.length
    ? {
        origin(origin, callback) {
          if (!origin || CORS_ORIGINS.includes(origin)) {
            return callback(null, true);
          }
          return callback(new Error("Origin not allowed by CORS."));
        },
        credentials: true,
        methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
      }
    : { origin: false }
));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: "Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { message: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", apiLimiter);

app.use(morgan("combined"));
app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

const hashPassword = async (password) => bcrypt.hash(password, BCRYPT_ROUNDS);

const tokenBlacklist = new Set();

const userSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  passwordHash: z.string().min(20),
  role: z.enum(["admin", "agente"])
});

const userListSchema = z.array(userSchema);

const readUsers = () => {
  const parsed = userListSchema.safeParse(readJson(USERS_FILE, []));
  return parsed.success ? parsed.data : [];
};

const saveUsers = (usersToSave) => {
  writeJsonAtomic(USERS_FILE, usersToSave);
};

const createBootstrapUser = async ({ id, name, email, password, role }) => ({
  id,
  name,
  email,
  passwordHash: await hashPassword(password),
  role
});

const initializeUsers = async () => {
  const existingUsers = readUsers();
  if (existingUsers.length > 0) {
    return existingUsers;
  }

  const bootstrapCandidates = [
    {
      id: "u-1",
      name: "Admin Soporte",
      email: "admin@soporte.local",
      password: process.env.ADMIN_PASSWORD,
      role: "admin"
    },
    {
      id: "u-2",
      name: "Agente Uno",
      email: "agente1@soporte.local",
      password: process.env.AGENTE1_PASSWORD,
      role: "agente"
    },
    {
      id: "u-3",
      name: "Agente Dos",
      email: "agente2@soporte.local",
      password: process.env.AGENTE2_PASSWORD,
      role: "agente"
    }
  ];

  const bootstrapUsers = await Promise.all(
    bootstrapCandidates
      .filter((candidate) => Boolean(candidate.password))
      .map(async ({ password, ...candidate }) => createBootstrapUser({ ...candidate, password }))
  );

  if (!bootstrapUsers.length) {
    throw new Error(
      "El almacén de usuarios está vacío. Define ADMIN_PASSWORD para crear el primer administrador."
    );
  }

  saveUsers(bootstrapUsers);
  console.info("User store initialized from environment variables.");
  return bootstrapUsers;
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const createTicketSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(5).max(1200),
  category: z.string().min(2).max(40),
  priority: z.enum(["baja", "media", "alta"]),
  assignedTo: z.string().email().optional().nullable(),
  createdBy: z.string().email().optional()
});

const agentUpdateSchema = z.object({
  status: z.enum(["abierto", "en_progreso", "resuelto", "cerrado"]).optional(),
  assignedTo: z.union([z.string().email(), z.literal(""), z.null()]).optional()
});

const adminUpdateSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().min(5).max(1200).optional(),
  category: z.string().min(2).max(40).optional(),
  priority: z.enum(["baja", "media", "alta"]).optional(),
  status: z.enum(["abierto", "en_progreso", "resuelto", "cerrado"]).optional(),
  assignedTo: z.union([z.string().email(), z.literal(""), z.null()]).optional()
});

const getPublicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role
});

const getTickets = () => readJson(TICKETS_FILE, []);
const saveTickets = (tickets) => {
  writeJsonAtomic(TICKETS_FILE, tickets);
};

const requireAuth = (req, res, next) => {
  let token = null;

  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) {
    token = header.slice(7);
  }

  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ message: "Token requerido." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    if (payload.jti && tokenBlacklist.has(payload.jti)) {
      return res.status(401).json({ message: "Token revocado." });
    }

    req.user = payload;
    req.tokenJti = payload.jti;
    return next();
  } catch {
    return res.status(401).json({ message: "Token inválido o expirado." });
  }
};

const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "No tienes permisos para esta acción." });
  }
  return next();
};

const canEditTicket = (ticket, currentUser) => {
  if (currentUser.role === "admin") {
    return true;
  }
  return ticket.assignedTo === currentUser.email || ticket.createdBy === currentUser.email;
};

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "mesa-ayuda-api" });
});

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Datos de acceso inválidos." });
  }

  const { email, password } = parsed.data;
  const user = users.find((item) => item.email === email);

  if (!user) {
    return res.status(401).json({ message: "Credenciales incorrectas." });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ message: "Credenciales incorrectas." });
  }

  const publicUser = getPublicUser(user);
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    {
      sub: user.id,
      iss: "mesa-ayuda-api",
      iat: Math.floor(Date.now() / 1000),
      jti,
      ...publicUser
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 8 * 60 * 60 * 1000,
    path: "/",
  });

  return res.json({
    token,
    user: publicUser
  });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  if (req.tokenJti) {
    tokenBlacklist.add(req.tokenJti);
  }

  res.clearCookie("token", { path: "/" });

  return res.json({ message: "Sesión cerrada correctamente." });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/users/agents", requireAuth, (req, res) => {
  const agents = users
    .filter((user) => user.role === "agente")
    .map((user) => ({ email: user.email, name: user.name }));

  res.json({ data: agents });
});

app.get("/api/tickets", requireAuth, (req, res) => {
  const { q, status, priority, mine } = req.query;

  let tickets = getTickets();

  if (req.user.role === "agente") {
    tickets = tickets.filter(
      (ticket) => ticket.assignedTo === req.user.email || ticket.createdBy === req.user.email
    );
  }

  if (q) {
    const normalized = String(q).toLowerCase();
    tickets = tickets.filter(
      (ticket) =>
        ticket.title.toLowerCase().includes(normalized) ||
        ticket.description.toLowerCase().includes(normalized) ||
        ticket.category.toLowerCase().includes(normalized)
    );
  }

  if (status) {
    tickets = tickets.filter((ticket) => ticket.status === status);
  }

  if (priority) {
    tickets = tickets.filter((ticket) => ticket.priority === priority);
  }

  if (mine === "true") {
    tickets = tickets.filter((ticket) => ticket.assignedTo === req.user.email);
  }

  const sorted = tickets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  res.json({ data: sorted });
});

app.post("/api/tickets", requireAuth, (req, res) => {
  const parsed = createTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Datos inválidos para crear ticket." });
  }

  const now = new Date().toISOString();
  const payload = parsed.data;

  const createdBy = req.user.role === "admin" ? payload.createdBy || req.user.email : req.user.email;

  const ticket = {
    id: crypto.randomUUID(),
    title: payload.title,
    description: payload.description,
    category: payload.category,
    priority: payload.priority,
    status: "abierto",
    createdAt: now,
    updatedAt: now,
    createdBy,
    assignedTo: payload.assignedTo || null
  };

  const tickets = getTickets();
  tickets.push(ticket);
  saveTickets(tickets);

  res.status(201).json({ data: ticket });
});

app.patch("/api/tickets/:id", requireAuth, (req, res) => {
  const schema = req.user.role === "admin" ? adminUpdateSchema : agentUpdateSchema;
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Datos inválidos para actualizar ticket." });
  }

  const tickets = getTickets();
  const index = tickets.findIndex((ticket) => ticket.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ message: "Ticket no encontrado." });
  }

  const currentTicket = tickets[index];
  if (!canEditTicket(currentTicket, req.user)) {
    return res.status(403).json({ message: "No puedes editar este ticket." });
  }

  const nextData = { ...parsed.data };
  if (Object.prototype.hasOwnProperty.call(nextData, "assignedTo")) {
    if (!nextData.assignedTo) {
      nextData.assignedTo = null;
    }
  }

  const updatedTicket = {
    ...currentTicket,
    ...nextData,
    updatedAt: new Date().toISOString()
  };

  tickets[index] = updatedTicket;
  saveTickets(tickets);

  res.json({ data: updatedTicket });
});

app.delete("/api/tickets/:id", requireAuth, requireRole("admin"), (req, res) => {
  const tickets = getTickets();
  const exists = tickets.some((ticket) => ticket.id === req.params.id);

  if (!exists) {
    return res.status(404).json({ message: "Ticket no encontrado." });
  }

  const nextTickets = tickets.filter((ticket) => ticket.id !== req.params.id);
  saveTickets(nextTickets);

  res.status(204).send();
});

app.get("/api/dashboard/kpis", requireAuth, (req, res) => {
  let tickets = getTickets();
  if (req.user.role === "agente") {
    tickets = tickets.filter(
      (ticket) => ticket.assignedTo === req.user.email || ticket.createdBy === req.user.email
    );
  }

  const kpis = {
    total: tickets.length,
    abiertos: tickets.filter((t) => t.status === "abierto").length,
    enProgreso: tickets.filter((t) => t.status === "en_progreso").length,
    resueltos: tickets.filter((t) => t.status === "resuelto").length,
    cerrados: tickets.filter((t) => t.status === "cerrado").length,
    prioridadAlta: tickets.filter((t) => t.priority === "alta").length
  };

  res.json({ data: kpis });
});

if (process.env.NODE_ENV === "production") {
  const frontendRoot = path.join(__dirname, "..", "..");
  app.use(express.static(frontendRoot));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(frontendRoot, "index.html"));
  });
}

let users = [];

const initializeApp = async () => {
  try { fs.unlinkSync(path.join(__dirname, "..", "data", "users.json.tmp")); } catch {}
  try { fs.unlinkSync(path.join(__dirname, "..", "data", "tickets.json.tmp")); } catch {}

  users = await initializeUsers();

  app.listen(PORT, () => {
    console.log(`Mesa de ayuda API activa en http://localhost:${PORT}`);
  });
};

initializeApp();
