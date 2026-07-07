const getApiBaseUrl = () => {
  const configuredUrl = window.__MESA_AYUDA_API_BASE_URL__ || window.API_BASE_URL;

  if (typeof configuredUrl === "string" && configuredUrl.trim()) {
    return configuredUrl.replace(/\/$/, "");
  }

  const metaTag = document.querySelector('meta[name="api-base-url"]');
  if (metaTag?.content) {
    return metaTag.content.replace(/\/$/, "");
  }

  if (window.location.protocol === "file:") {
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
  showToast(isError ? "error" : "info", message);
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
  const fragment = document.createDocumentFragment();

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Sin asignar';
  fragment.appendChild(defaultOption);

  state.agents.forEach((agent) => {
    const option = document.createElement('option');
    option.value = agent.email;
    option.textContent = `${agent.name} (${agent.email})`;
    fragment.appendChild(option);
  });

  elements.assignedToSelect.innerHTML = '';
  elements.assignedToSelect.appendChild(fragment);
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
  const counts = {
    kpiTotal: tickets.length,
    kpiOpen: tickets.filter((t) => t.status === "abierto").length,
    kpiInProgress: tickets.filter((t) => t.status === "en_progreso").length,
    kpiResolved: tickets.filter((t) => t.status === "resuelto").length,
    kpiHigh: tickets.filter((t) => t.priority === "alta").length,
  };
  Object.entries(counts).forEach(([id, target]) => {
    const el = elements[id];
    if (!el) return;
    const current = parseInt(el.textContent, 10) || 0;
    if (current !== target) animateCounter(el, target);
  });
};

const renderTable = () => {
  const filtered = applyFilters([...state.tickets].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
  const fragment = document.createDocumentFragment();

  if (!filtered.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.setAttribute('colspan', '7');
    td.textContent = 'No hay tickets que coincidan con los filtros actuales.';
    tr.appendChild(td);
    fragment.appendChild(tr);
    elements.ticketsBody.innerHTML = '';
    elements.ticketsBody.appendChild(fragment);
    return;
  }

  filtered.forEach((ticket) => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-id', ticket.id);

    const td1 = document.createElement('td');
    const titleP = document.createElement('p');
    titleP.className = 'ticket-title';
    titleP.textContent = ticket.title;
    const descP = document.createElement('p');
    descP.className = 'ticket-desc';
    descP.textContent = ticket.description;
    td1.appendChild(titleP);
    td1.appendChild(descP);
    tr.appendChild(td1);

    const td2 = document.createElement('td');
    td2.textContent = ticket.category;
    tr.appendChild(td2);

    const td3 = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = `pill prio-${ticket.priority}`;
    pill.textContent = ticket.priority;
    td3.appendChild(pill);
    tr.appendChild(td3);

    const td4 = document.createElement('td');
    const statusSelect = document.createElement('select');
    statusSelect.className = 'status-select';
    statusSelect.setAttribute('data-action', 'status');
    if (!canEditTicket(ticket)) statusSelect.disabled = true;
    STATUS_OPTIONS.forEach((opt) => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === ticket.status) option.selected = true;
      statusSelect.appendChild(option);
    });
    td4.appendChild(statusSelect);
    tr.appendChild(td4);

    const td5 = document.createElement('td');
    const assignSelect = document.createElement('select');
    assignSelect.className = 'assign-select';
    assignSelect.setAttribute('data-action', 'assign');
    if (state.user?.role !== 'admin') assignSelect.disabled = true;
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Sin asignar';
    assignSelect.appendChild(defaultOpt);
    state.agents.forEach((agent) => {
      const option = document.createElement('option');
      option.value = agent.email;
      option.textContent = agent.name;
      if (agent.email === ticket.assignedTo) option.selected = true;
      assignSelect.appendChild(option);
    });
    td5.appendChild(assignSelect);
    tr.appendChild(td5);

    const td6 = document.createElement('td');
    td6.textContent = formatDate(ticket.updatedAt);
    tr.appendChild(td6);

    const td7 = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'actions';

    const canTake = state.user?.role === 'agente' && !ticket.assignedTo;
    const canDelete = state.user?.role === 'admin';

    if (canTake) {
      const takeBtn = document.createElement('button');
      takeBtn.type = 'button';
      takeBtn.className = 'mini';
      takeBtn.setAttribute('data-action', 'take');
      takeBtn.textContent = 'Tomar';
      actions.appendChild(takeBtn);
    }

    if (canDelete) {
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'mini danger-btn';
      deleteBtn.setAttribute('data-action', 'delete');
      deleteBtn.textContent = 'Eliminar';
      actions.appendChild(deleteBtn);
    }

    td7.appendChild(actions);
    tr.appendChild(td7);
    fragment.appendChild(tr);
  });

  elements.ticketsBody.innerHTML = '';
  elements.ticketsBody.appendChild(fragment);
  requestAnimationFrame(() => animateRows());
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

const showToast = (type, message, duration = 4000) => {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { info: 'info', error: 'error', success: 'check_circle' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconSpan = document.createElement('span');
  iconSpan.className = 'toast-icon material-symbols-rounded';
  iconSpan.textContent = icons[type] || 'info';

  const textSpan = document.createElement('span');
  textSpan.className = 'toast-text';
  textSpan.textContent = message;

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'toast-dismiss material-symbols-rounded';
  dismissBtn.setAttribute('aria-label', 'Cerrar');
  dismissBtn.textContent = 'close';
  dismissBtn.addEventListener('click', () => dismissToast(toast));

  toast.appendChild(iconSpan);
  toast.appendChild(textSpan);
  toast.appendChild(dismissBtn);
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  toast._timeout = setTimeout(() => dismissToast(toast), duration);
};

const dismissToast = (toast) => {
  if (toast._dismissed) return;
  toast._dismissed = true;
  clearTimeout(toast._timeout);
  toast.classList.remove('show');
  toast.classList.add('hiding');
  setTimeout(() => toast.remove(), 350);
};

const animateCounter = (element, target, duration = 600) => {
  const start = parseInt(element.textContent, 10) || 0;
  if (start === target) return;

  const diff = target - start;
  const startTime = performance.now();

  const tick = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + diff * eased);
    element.textContent = current;
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      element.textContent = target;
    }
  };

  requestAnimationFrame(tick);
};

const animateRows = () => {
  const rows = elements.ticketsBody.querySelectorAll('tr');
  rows.forEach((row, index) => {
    row.style.opacity = '0';
    row.style.transform = 'translateY(8px)';
    row.style.transition = `opacity 0.35s ease ${index * 0.05}s, transform 0.35s ease ${index * 0.05}s`;
    requestAnimationFrame(() => {
      row.style.opacity = '1';
      row.style.transform = 'translateY(0)';
    });
  });
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
