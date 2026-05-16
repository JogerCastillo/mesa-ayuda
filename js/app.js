const getApiBaseUrl = () => {
  const configuredUrl = window.__MESA_AYUDA_API_BASE_URL__ || window.API_BASE_URL;

  if (typeof configuredUrl === "string" && configuredUrl.trim()) {
    return configuredUrl.replace(/\/$/, "");
  }

  const metaTag = document.querySelector('meta[name="api-base-url"]');
  if (metaTag?.content) {
    return metaTag.content.replace(/\/$/, "");
  }

  if (
    window.location.protocol === "file:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    return "http://localhost:4200/api";
  }

  return `${window.location.origin}/api`;
};

const API_BASE_URL = getApiBaseUrl();
const AUTH_TOKEN_KEY = "mesa_ayuda_auth_token";
const AUTH_USER_KEY = "mesa_ayuda_auth_user";

const state = {
  apiAvailable: false,
  tickets: [],
  agents: [],
  token: null,
  user: null,
  filters: {
    q: "",
    status: "",
    priority: "",
    mine: false
  }
};

const $ = (selector) => document.querySelector(selector);
const elements = {
  loginForm: $("#loginForm"),
  sessionInfo: $("#sessionInfo"),
  sessionName: $("#sessionName"),
  sessionRole: $("#sessionRole"),
  logoutBtn: $("#logoutBtn"),
  connectionBadge: $("#connectionBadge"),
  feedback: $("#feedback"),
  ticketForm: $("#ticketForm"),
  assignedToSelect: $("#assignedToSelect"),
  filtersForm: $("#filtersForm"),
  ticketsBody: $("#ticketsBody"),
  kpiTotal: $("#kpiTotal"),
  kpiOpen: $("#kpiOpen"),
  kpiInProgress: $("#kpiInProgress"),
  kpiResolved: $("#kpiResolved"),
  kpiHigh: $("#kpiHigh")
};

const STATUS_OPTIONS = [
  { value: "abierto", label: "Abierto" },
  { value: "en_progreso", label: "En progreso" },
  { value: "resuelto", label: "Resuelto" },
  { value: "cerrado", label: "Cerrado" }
];

const showFeedback = (message, isError = false) => {
  elements.feedback.textContent = message;
  elements.feedback.style.color = isError ? "#ffd0c3" : "#b8d3e6";
};

const formatDate = (value) =>
  new Date(value).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short"
  });

const persistSession = () => {
  if (state.token) {
    localStorage.setItem(AUTH_TOKEN_KEY, state.token);
  }
  if (state.user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(state.user));
  }
};

const clearSession = () => {
  state.token = null;
  state.user = null;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
};

const loadSession = () => {
  state.token = localStorage.getItem(AUTH_TOKEN_KEY);
  const userRaw = localStorage.getItem(AUTH_USER_KEY);
  state.user = userRaw ? JSON.parse(userRaw) : null;
};

const updateSessionUI = () => {
  const hasSession = Boolean(state.user && state.token);
  elements.loginForm.classList.toggle("hidden", hasSession);
  elements.sessionInfo.classList.toggle("hidden", !hasSession);

  if (hasSession) {
    elements.sessionName.textContent = `${state.user.name} (${state.user.email})`;
    elements.sessionRole.textContent = state.user.role;
  }
};

const updateConnectionBadge = () => {
  if (state.apiAvailable) {
    elements.connectionBadge.textContent = "API activa";
    elements.connectionBadge.classList.remove("offline");
    return;
  }

  elements.connectionBadge.textContent = "API inactiva";
  elements.connectionBadge.classList.add("offline");
};

const apiRequest = async (path, options = {}) => {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  if (response.status === 204) {
    return null;
  }

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.message || "No fue posible completar la acción.");
  }

  return json;
};

const detectApi = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    state.apiAvailable = response.ok;
  } catch {
    state.apiAvailable = false;
  }
};

const validateSession = async () => {
  if (!state.user || !state.token || !state.apiAvailable) {
    return false;
  }

  try {
    const data = await apiRequest("/auth/me", { method: "GET" });
    state.user = data.user;
    persistSession();
    return true;
  } catch {
    clearSession();
    return false;
  }
};

const loadAgents = async () => {
  if (!state.apiAvailable || !state.user) {
    state.agents = [];
    return;
  }

  const result = await apiRequest("/users/agents", { method: "GET" });
  state.agents = result.data || [];
};

const fillAssignedSelect = () => {
  const options = state.agents
    .map((agent) => `<option value="${agent.email}">${agent.name} (${agent.email})</option>`)
    .join("");
  elements.assignedToSelect.innerHTML = `<option value="">Sin asignar</option>${options}`;
};

const canEditTicket = (ticket) => {
  if (!state.user) return false;
  if (state.user.role === "admin") return true;
  return ticket.assignedTo === state.user.email || ticket.createdBy === state.user.email;
};

const applyFilters = (tickets) =>
  tickets.filter((ticket) => {
    if (state.filters.q) {
      const text = state.filters.q.toLowerCase();
      const haystack = `${ticket.title} ${ticket.description} ${ticket.category}`.toLowerCase();
      if (!haystack.includes(text)) return false;
    }

    if (state.filters.status && ticket.status !== state.filters.status) return false;
    if (state.filters.priority && ticket.priority !== state.filters.priority) return false;
    if (state.filters.mine && ticket.assignedTo !== state.user?.email) return false;
    return true;
  });

const renderKpis = () => {
  const tickets = state.tickets;
  elements.kpiTotal.textContent = tickets.length;
  elements.kpiOpen.textContent = tickets.filter((t) => t.status === "abierto").length;
  elements.kpiInProgress.textContent = tickets.filter((t) => t.status === "en_progreso").length;
  elements.kpiResolved.textContent = tickets.filter((t) => t.status === "resuelto").length;
  elements.kpiHigh.textContent = tickets.filter((t) => t.priority === "alta").length;
};

const renderTable = () => {
  const filtered = applyFilters([...state.tickets].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
  if (!filtered.length) {
    elements.ticketsBody.innerHTML = '<tr><td colspan="7">No hay tickets que coincidan con los filtros actuales.</td></tr>';
    return;
  }

  elements.ticketsBody.innerHTML = filtered
    .map((ticket) => {
      const statusOptions = STATUS_OPTIONS.map(
        (option) => `<option value="${option.value}" ${option.value === ticket.status ? "selected" : ""}>${option.label}</option>`
      ).join("");

      const assignOptions = state.agents
        .map((agent) => `<option value="${agent.email}" ${agent.email === ticket.assignedTo ? "selected" : ""}>${agent.name}</option>`)
        .join("");

      const canEdit = canEditTicket(ticket);
      const canAssign = state.user?.role === "admin";
      const canDelete = state.user?.role === "admin";
      const canTake = state.user?.role === "agente" && !ticket.assignedTo;

      return `
      <tr data-id="${ticket.id}">
        <td>
          <p class="ticket-title">${ticket.title}</p>
          <p class="ticket-desc">${ticket.description}</p>
        </td>
        <td>${ticket.category}</td>
        <td><span class="pill prio-${ticket.priority}">${ticket.priority}</span></td>
        <td>
          <select class="status-select" data-action="status" ${canEdit ? "" : "disabled"}>
            ${statusOptions}
          </select>
        </td>
        <td>
          <select class="assign-select" data-action="assign" ${canAssign ? "" : "disabled"}>
            <option value="">Sin asignar</option>
            ${assignOptions}
          </select>
        </td>
        <td>${formatDate(ticket.updatedAt)}</td>
        <td>
          <div class="actions">
            ${canTake ? '<button type="button" class="mini" data-action="take">Tomar</button>' : ""}
            ${canDelete ? '<button type="button" class="mini danger-btn" data-action="delete">Eliminar</button>' : ""}
          </div>
        </td>
      </tr>`;
    })
    .join("");
};

const renderAll = () => {
  renderKpis();
  renderTable();
};

const loadTickets = async () => {
  if (!state.user) {
    state.tickets = [];
    renderAll();
    return;
  }

  if (!state.apiAvailable) {
    state.tickets = [];
    renderAll();
    throw new Error("La API no esta disponible. Verifica backend y API_BASE_URL.");
  }

  const result = await apiRequest("/tickets", { method: "GET" });
  state.tickets = result.data || [];
  renderAll();
};

const createTicket = async (payload) => {
  if (!state.apiAvailable) {
    throw new Error("La API no esta disponible.");
  }

  const result = await apiRequest("/tickets", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  state.tickets = [result.data, ...state.tickets];
};

const updateTicket = async (id, patch) => {
  if (!state.apiAvailable) {
    throw new Error("La API no esta disponible.");
  }

  await apiRequest(`/tickets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch)
  });
  await loadTickets();
};

const deleteTicket = async (id) => {
  if (state.user?.role !== "admin") {
    throw new Error("Solo admin puede eliminar tickets.");
  }

  if (!state.apiAvailable) {
    throw new Error("La API no esta disponible.");
  }

  await apiRequest(`/tickets/${id}`, { method: "DELETE" });
  state.tickets = state.tickets.filter((ticket) => ticket.id !== id);
};

const onLogin = async (event) => {
  event.preventDefault();
  if (!state.apiAvailable) {
    showFeedback("La API no está disponible. Inicia el backend para iniciar sesión.", true);
    return;
  }

  const form = new FormData(elements.loginForm);
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "").trim();

  try {
    const result = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    state.token = result.token;
    state.user = result.user;
    persistSession();
    updateSessionUI();
    await loadAgents();
    fillAssignedSelect();
    await loadTickets();
    showFeedback(`Sesión iniciada como ${state.user.role}.`);
    elements.loginForm.reset();
  } catch (error) {
    showFeedback(error.message, true);
  }
};

const onLogout = () => {
  clearSession();
  updateSessionUI();
  state.tickets = [];
  renderAll();
  showFeedback("Sesión cerrada.");
};

const onCreateTicket = async (event) => {
  event.preventDefault();
  if (!state.user) {
    showFeedback("Debes iniciar sesión para crear tickets.", true);
    return;
  }

  const formData = new FormData(elements.ticketForm);
  const payload = {
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    category: String(formData.get("category") || "").trim(),
    priority: String(formData.get("priority") || "media"),
    createdBy: String(formData.get("createdBy") || "").trim(),
    assignedTo: String(formData.get("assignedTo") || "").trim()
  };

  try {
    await createTicket(payload);
    elements.ticketForm.reset();
    renderAll();
    showFeedback("Ticket creado correctamente.");
  } catch (error) {
    showFeedback(error.message, true);
  }
};

const onFiltersChange = (event) => {
  const formData = new FormData(elements.filtersForm);
  state.filters.q = String(formData.get("q") || "").trim();
  state.filters.status = String(formData.get("status") || "").trim();
  state.filters.priority = String(formData.get("priority") || "").trim();
  state.filters.mine = Boolean(formData.get("mine"));

  if (event.type === "submit") {
    event.preventDefault();
  }

  renderTable();
};

const onTableAction = async (event) => {
  const target = event.target;
  const row = target.closest("tr[data-id]");
  if (!row) return;

  const ticketId = row.dataset.id;
  const action = target.dataset.action;

  try {
    if (action === "status") {
      await updateTicket(ticketId, { status: target.value });
      renderAll();
      showFeedback("Estado actualizado.");
      return;
    }

    if (action === "assign") {
      await updateTicket(ticketId, { assignedTo: target.value });
      renderAll();
      showFeedback("Asignacion actualizada.");
      return;
    }

    if (action === "take") {
      await updateTicket(ticketId, { assignedTo: state.user.email, status: "en_progreso" });
      renderAll();
      showFeedback("Ticket tomado por el agente activo.");
      return;
    }

    if (action === "delete") {
      await deleteTicket(ticketId);
      renderAll();
      showFeedback("Ticket eliminado.");
    }
  } catch (error) {
    showFeedback(error.message, true);
  }
};

const init = async () => {
  elements.loginForm.addEventListener("submit", onLogin);
  elements.logoutBtn.addEventListener("click", onLogout);
  elements.ticketForm.addEventListener("submit", onCreateTicket);
  elements.filtersForm.addEventListener("input", onFiltersChange);
  elements.filtersForm.addEventListener("change", onFiltersChange);
  elements.filtersForm.addEventListener("submit", onFiltersChange);
  elements.ticketsBody.addEventListener("change", onTableAction);
  elements.ticketsBody.addEventListener("click", onTableAction);

  await detectApi();
  loadSession();
  updateConnectionBadge();

  const valid = await validateSession();
  if (!valid) {
    clearSession();
  }

  updateSessionUI();
  await loadAgents();
  fillAssignedSelect();

  try {
    await loadTickets();
  } catch (error) {
    showFeedback(error.message, true);
  }

  if (!state.user) {
    showFeedback("Inicia sesión para comenzar.");
  } else {
    showFeedback("Sesión activa con API.");
  }
};

init();
