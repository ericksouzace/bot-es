const VALUE_BUTTON = 0.05;
const VALUE_DELIVERY = 5;

const STORAGE_KEY = "botoesProCleanV1";
const LAST_SAVE_KEY = "botoesProCleanLastSave";

const defaultState = {
  lots: [],
  models: [],
  settings: {
    dailyGoal: 0
  }
};

let state = loadState();
let editingId = null;
let deferredInstallPrompt = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const screenNames = {
  home: "Início",
  newLot: "Novo lote",
  history: "Histórico",
  closing: "Fechamento",
  reports: "Relatórios",
  backup: "Backup",
  settings: "Configurações"
};

const sidebar = $("#sidebar");
const overlay = $("#overlay");
const screenTitle = $("#screenTitle");
const connectionStatus = $("#connectionStatus");
const lastSaveText = $("#lastSaveText");

const batchForm = $("#batchForm");
const batchDate = $("#batchDate");
const itemsArea = $("#itemsArea");
const addItem = $("#addItem");
const modelSelect = $("#modelSelect");
const applyModel = $("#applyModel");
const saveAsModel = $("#saveAsModel");
const lotPreview = $("#lotPreview");
const formTitle = $("#formTitle");
const saveButton = $("#saveButton");
const cancelEdit = $("#cancelEdit");

const heroBalance = $("#heroBalance");
const todayBalance = $("#todayBalance");
const todayButtons = $("#todayButtons");
const totalButtons = $("#totalButtons");
const totalDeliveries = $("#totalDeliveries");
const goalPercent = $("#goalPercent");
const goalText = $("#goalText");
const goalBar = $("#goalBar");
const lastLotBox = $("#lastLotBox");

const filterDate = $("#filterDate");
const filterColor = $("#filterColor");
const filterDelivery = $("#filterDelivery");
const historyList = $("#historyList");

const closingDate = $("#closingDate");
const closingBox = $("#closingBox");

const periodStart = $("#periodStart");
const periodEnd = $("#periodEnd");

const dailyGoalInput = $("#dailyGoalInput");
const modelsList = $("#modelsList");

const toast = $("#toast");

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(date) {
  if (!date || !date.includes("-")) return date || "";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

function money(value) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function normalizeText(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeLot(raw) {
  const items = raw.items || raw.itens || [];

  return {
    id: String(raw.id || createId()),
    date: raw.date || raw.data || todayISO(),
    deliveryDone: Boolean(raw.deliveryDone || raw.entregaFeita),
    items: items
      .map((item) => ({
        color: String(item.color || item.cor || "").trim(),
        quantity: Number(item.quantity || item.quantidade || 0)
      }))
      .filter((item) => item.color && item.quantity > 0),
    createdAtMillis: Number(raw.createdAtMillis || Date.now())
  };
}

function normalizeModel(raw) {
  const items = raw.items || [];

  return {
    id: String(raw.id || createId()),
    name: String(raw.name || "Modelo").trim(),
    items: items
      .map((item) => ({
        color: String(item.color || "").trim(),
        quantity: Number(item.quantity || 0)
      }))
      .filter((item) => item.color && item.quantity > 0),
    createdAtMillis: Number(raw.createdAtMillis || Date.now())
  };
}

function loadState() {
  const saved = safeParse(localStorage.getItem(STORAGE_KEY));

  if (saved) {
    return {
      ...defaultState,
      ...saved,
      settings: {
        ...defaultState.settings,
        ...(saved.settings || {})
      },
      lots: Array.isArray(saved.lots) ? saved.lots.map(normalizeLot) : [],
      models: Array.isArray(saved.models) ? saved.models.map(normalizeModel) : []
    };
  }

  const oldKeys = [
    "botoesProUltimateV1",
    "botoesProAppTabsV1",
    "controleBotoesLocalAppV1",
    "controleBotoesProfissionalV3"
  ];

  for (const key of oldKeys) {
    const old = safeParse(localStorage.getItem(key));

    if (old && Array.isArray(old.lots)) {
      return {
        ...defaultState,
        lots: old.lots.map(normalizeLot),
        models: Array.isArray(old.models) ? old.models.map(normalizeModel) : [],
        settings: {
          ...defaultState.settings,
          ...(old.settings || {})
        }
      };
    }
  }

  return structuredClone(defaultState);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  localStorage.setItem(LAST_SAVE_KEY, new Date().toLocaleString("pt-BR"));
  renderLastSave();
}

function renderLastSave() {
  lastSaveText.textContent = localStorage.getItem(LAST_SAVE_KEY) || "Ainda não salvo";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function openSidebar() {
  sidebar.classList.add("open");
  overlay.classList.add("show");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  overlay.classList.remove("show");
}

function goToScreen(name) {
  $$(".screen").forEach((screen) => screen.classList.remove("active"));
  $(`#screen-${name}`)?.classList.add("active");

  $$(".nav-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.screen === name);
  });

  screenTitle.textContent = screenNames[name] || "Botões Pro";

  closeSidebar();
  window.scrollTo({ top: 0, behavior: "smooth" });

  renderAll();
}

function createItemRow(container, quantity = "", color = "") {
  const row = document.createElement("div");
  row.className = "row-item";

  row.innerHTML = `
    <input class="item-quantity" type="number" min="1" inputmode="numeric" placeholder="Qtd." value="${quantity}" required />
    <input class="item-color" type="text" list="colorSuggestions" placeholder="Cor" value="${color}" required />
    <button type="button" class="remove-row">×</button>
  `;

  row.querySelector(".remove-row").addEventListener("click", () => {
    const rows = container.querySelectorAll(".row-item");

    if (rows.length > 1) {
      row.remove();
    } else {
      row.querySelector(".item-quantity").value = "";
      row.querySelector(".item-color").value = "";
    }

    updatePreview();
  });

  row.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", updatePreview);
  });

  container.appendChild(row);
  updatePreview();
}

function collectItems(container) {
  const map = {};

  container.querySelectorAll(".row-item").forEach((row) => {
    const quantity = Number(row.querySelector(".item-quantity").value);
    const color = row.querySelector(".item-color").value.trim();

    if (quantity > 0 && color) {
      const key = normalizeText(color);

      if (!map[key]) {
        map[key] = {
          color,
          quantity: 0
        };
      }

      map[key].quantity += quantity;
    }
  });

  return Object.values(map);
}

function updatePreview() {
  const items = collectItems(itemsArea);
  const buttons = items.reduce((sum, item) => sum + item.quantity, 0);
  lotPreview.textContent = `${buttons} botões • ${money(buttons * VALUE_BUTTON)}`;
}

function clearForm() {
  editingId = null;
  formTitle.textContent = "Novo lote";
  saveButton.textContent = "Salvar lote";
  cancelEdit.style.display = "none";

  batchDate.value = todayISO();
  itemsArea.innerHTML = "";
  createItemRow(itemsArea);
  updatePreview();
}

function lotButtons(lot) {
  return lot.items.reduce((sum, item) => sum + Number(item.quantity), 0);
}

function lotBalance(lot) {
  return lotButtons(lot) * VALUE_BUTTON + (lot.deliveryDone ? VALUE_DELIVERY : 0);
}

function getLotsByDate(date) {
  return state.lots.filter((lot) => lot.date === date);
}

function getStats(lots) {
  const buttons = lots.reduce((sum, lot) => sum + lotButtons(lot), 0);
  const deliveries = lots.filter((lot) => lot.deliveryDone).length;

  return {
    buttons,
    deliveries,
    buttonValue: buttons * VALUE_BUTTON,
    deliveryValue: deliveries * VALUE_DELIVERY,
    total: buttons * VALUE_BUTTON + deliveries * VALUE_DELIVERY
  };
}

function renderDashboard() {
  const today = todayISO();

  const totalStats = getStats(state.lots);
  const todayStats = getStats(getLotsByDate(today));

  heroBalance.textContent = money(totalStats.total);
  todayBalance.textContent = money(todayStats.total);
  todayButtons.textContent = todayStats.buttons;
  totalButtons.textContent = totalStats.buttons;
  totalDeliveries.textContent = totalStats.deliveries;

  const goal = Number(state.settings.dailyGoal || 0);
  const percent = goal > 0 ? Math.min(100, Math.round((todayStats.buttons / goal) * 100)) : 0;

  goalPercent.textContent = goal > 0 ? `${percent}%` : "Sem meta";
  goalText.textContent = goal > 0
    ? `${todayStats.buttons} de ${goal} botões hoje.`
    : "Configure uma meta nas configurações.";

  goalBar.style.width = `${percent}%`;

  renderLastLot();
}

function renderLastLot() {
  const lot = [...state.lots].sort((a, b) => b.createdAtMillis - a.createdAtMillis)[0];

  if (!lot) {
    lastLotBox.innerHTML = `<div class="empty">Nenhum lote registrado ainda.</div>`;
    return;
  }

  const buttons = lotButtons(lot);

  lastLotBox.innerHTML = `
    <div class="last-card">
      <h3>${formatDate(lot.date)}</h3>
      <p>${buttons} botões • ${money(buttons * VALUE_BUTTON)}</p>
      <p>${lot.deliveryDone ? "Entrega confirmada" : "Entrega pendente"}</p>
    </div>
  `;
}

function filteredLots() {
  let list = [...state.lots];

  if (filterDate.value) {
    list = list.filter((lot) => lot.date === filterDate.value);
  }

  if (filterColor.value.trim()) {
    const search = normalizeText(filterColor.value);

    list = list.filter((lot) => {
      return lot.items.some((item) => normalizeText(item.color).includes(search));
    });
  }

  if (filterDelivery.value === "yes") {
    list = list.filter((lot) => lot.deliveryDone);
  }

  if (filterDelivery.value === "no") {
    list = list.filter((lot) => !lot.deliveryDone);
  }

  return list.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.createdAtMillis - a.createdAtMillis;
  });
}

function groupByDate(lots) {
  return lots.reduce((groups, lot) => {
    groups[lot.date] = groups[lot.date] || [];
    groups[lot.date].push(lot);
    return groups;
  }, {});
}

function renderHistory() {
  const lots = filteredLots();
  historyList.innerHTML = "";

  if (!lots.length) {
    historyList.innerHTML = `<div class="empty">Nenhum lote encontrado.</div>`;
    return;
  }

  const groups = groupByDate(lots);

  Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach((date) => {
    const dayLots = groups[date];
    const stats = getStats(dayLots);

    const wrapper = document.createElement("div");
    wrapper.className = "history-day";

    wrapper.innerHTML = `
      <h3 class="day-title">${formatDate(date)} • ${stats.buttons} botões • ${money(stats.total)}</h3>
    `;

    dayLots.forEach((lot) => {
      wrapper.appendChild(createHistoryCard(lot));
    });

    historyList.appendChild(wrapper);
  });
}

function createHistoryCard(lot) {
  const buttons = lotButtons(lot);
  const card = document.createElement("article");

  card.className = "history-card";

  card.innerHTML = `
    <div class="chips">
      <span class="chip">${buttons} botões</span>
      <span class="chip">${money(buttons * VALUE_BUTTON)}</span>
      <span class="chip ${lot.deliveryDone ? "ok" : "no"}">${lot.deliveryDone ? "Entrega confirmada" : "Entrega pendente"}</span>
      <span class="chip ok">Total: ${money(lotBalance(lot))}</span>
    </div>

    <ul class="items-list">
      ${lot.items.map((item) => `
        <li>
          <span>${item.quantity} ${item.color}</span>
          <strong>${money(item.quantity * VALUE_BUTTON)}</strong>
        </li>
      `).join("")}
    </ul>

    <div class="history-actions">
      <button class="btn primary" data-action="delivery" data-id="${lot.id}" type="button">
        ${lot.deliveryDone ? "Remover entrega" : "Confirmar entrega"}
      </button>

      <button class="btn ghost" data-action="duplicate" data-id="${lot.id}" type="button">
        Duplicar
      </button>

      <button class="btn dark" data-action="edit" data-id="${lot.id}" type="button">
        Editar
      </button>

      <button class="btn danger" data-action="delete" data-id="${lot.id}" type="button">
        Apagar
      </button>
    </div>
  `;

  return card;
}

function renderClosing() {
  const date = closingDate.value || todayISO();
  closingDate.value = date;

  const lots = getLotsByDate(date);
  const stats = getStats(lots);

  if (!lots.length) {
    closingBox.innerHTML = `<div class="empty">Nenhum lote em ${formatDate(date)}.</div>`;
    return;
  }

  closingBox.innerHTML = `
    <div class="closing-card">
      <h3>${formatDate(date)}</h3>

      <div class="closing-grid">
        <div><span>Botões</span><strong>${stats.buttons}</strong></div>
        <div><span>Valor botões</span><strong>${money(stats.buttonValue)}</strong></div>
        <div><span>Entregas</span><strong>${stats.deliveries}</strong></div>
        <div><span>Valor entregas</span><strong>${money(stats.deliveryValue)}</strong></div>
        <div><span>Lotes</span><strong>${lots.length}</strong></div>
        <div><span>Total</span><strong>${money(stats.total)}</strong></div>
      </div>
    </div>
  `;
}

function renderModels() {
  modelSelect.innerHTML = `<option value="">Nenhum modelo</option>`;

  state.models.forEach((model) => {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.name;
    modelSelect.appendChild(option);
  });

  if (!state.models.length) {
    modelsList.innerHTML = `<div class="empty">Nenhum modelo salvo.</div>`;
    return;
  }

  modelsList.innerHTML = state.models.map((model) => `
    <article class="model-card">
      <h3>${model.name}</h3>

      <ul class="items-list">
        ${model.items.map((item) => `
          <li>
            <span>${item.quantity} ${item.color}</span>
            <strong>${money(item.quantity * VALUE_BUTTON)}</strong>
          </li>
        `).join("")}
      </ul>

      <div class="model-actions">
        <button class="btn primary" data-model-use="${model.id}" type="button">Usar</button>
        <button class="btn danger" data-model-delete="${model.id}" type="button">Apagar</button>
      </div>
    </article>
  `).join("");
}

function renderAll() {
  renderDashboard();
  renderHistory();
  renderClosing();
  renderModels();
  renderLastSave();

  dailyGoalInput.value = state.settings.dailyGoal || "";
}

function saveLot(event) {
  event.preventDefault();

  const items = collectItems(itemsArea);

  if (!items.length) {
    showToast("Adicione pelo menos uma cor.");
    return;
  }

  const buttons = items.reduce((sum, item) => sum + item.quantity, 0);

  if (buttons > 5000) {
    const ok = confirm(`Você está salvando ${buttons} botões. Está correto?`);
    if (!ok) return;
  }

  const old = state.lots.find((lot) => lot.id === editingId);

  const lot = {
    id: editingId || createId(),
    date: batchDate.value,
    deliveryDone: old ? old.deliveryDone : false,
    items,
    createdAtMillis: old ? old.createdAtMillis : Date.now()
  };

  if (editingId) {
    state.lots = state.lots.map((item) => item.id === editingId ? lot : item);
    showToast("Lote atualizado.");
  } else {
    state.lots.push(lot);
    showToast("Lote salvo. Confirme a entrega depois.");
  }

  saveState();
  clearForm();
  renderAll();
  goToScreen("history");
}

function editLot(id) {
  const lot = state.lots.find((item) => item.id === id);

  if (!lot) {
    showToast("Lote não encontrado.");
    return;
  }

  editingId = lot.id;
  formTitle.textContent = "Editando lote";
  saveButton.textContent = "Atualizar lote";
  cancelEdit.style.display = "block";

  batchDate.value = lot.date;
  itemsArea.innerHTML = "";

  lot.items.forEach((item) => {
    createItemRow(itemsArea, item.quantity, item.color);
  });

  updatePreview();
  goToScreen("newLot");
}

function duplicateLot(id) {
  const lot = state.lots.find((item) => item.id === id);

  if (!lot) {
    showToast("Lote não encontrado.");
    return;
  }

  editingId = null;
  formTitle.textContent = "Novo lote duplicado";
  saveButton.textContent = "Salvar lote";
  cancelEdit.style.display = "none";

  batchDate.value = todayISO();
  itemsArea.innerHTML = "";

  lot.items.forEach((item) => {
    createItemRow(itemsArea, item.quantity, item.color);
  });

  updatePreview();
  goToScreen("newLot");
  showToast("Lote duplicado. Revise e salve.");
}

function deleteLot(id) {
  if (!confirm("Apagar este lote?")) return;

  state.lots = state.lots.filter((lot) => lot.id !== id);

  if (editingId === id) {
    clearForm();
  }

  saveState();
  renderAll();
  showToast("Lote apagado.");
}

function toggleDelivery(id) {
  const lot = state.lots.find((item) => item.id === id);

  if (!lot) {
    showToast("Lote não encontrado.");
    return;
  }

  lot.deliveryDone = !lot.deliveryDone;

  saveState();
  renderAll();

  showToast(lot.deliveryDone ? "Entrega confirmada: + R$ 5,00." : "Entrega removida.");
}

function saveCurrentAsModel() {
  const items = collectItems(itemsArea);

  if (!items.length) {
    showToast("Adicione itens antes de salvar modelo.");
    return;
  }

  const name = prompt("Nome do modelo:");

  if (!name || !name.trim()) {
    return;
  }

  state.models.push({
    id: createId(),
    name: name.trim(),
    items,
    createdAtMillis: Date.now()
  });

  saveState();
  renderAll();
  showToast("Modelo salvo.");
}

function useModel(id) {
  const model = state.models.find((item) => item.id === id);

  if (!model) {
    showToast("Modelo não encontrado.");
    return;
  }

  editingId = null;
  formTitle.textContent = "Novo lote";
  saveButton.textContent = "Salvar lote";
  cancelEdit.style.display = "none";

  batchDate.value = todayISO();
  itemsArea.innerHTML = "";

  model.items.forEach((item) => {
    createItemRow(itemsArea, item.quantity, item.color);
  });

  updatePreview();
  goToScreen("newLot");
}

function applySelectedModel() {
  if (!modelSelect.value) {
    showToast("Escolha um modelo.");
    return;
  }

  useModel(modelSelect.value);
}

function deleteModel(id) {
  if (!confirm("Apagar este modelo?")) return;

  state.models = state.models.filter((model) => model.id !== id);
  saveState();
  renderAll();
  showToast("Modelo apagado.");
}

function buildCSV(lots) {
  let csv = "Data;Tipo;Cor;Quantidade;Valor unitario;Subtotal;Entrega confirmada;Total do lote\n";

  lots.forEach((lot) => {
    const totalLot = lotBalance(lot);

    lot.items.forEach((item) => {
      csv += [
        formatDate(lot.date),
        "Botões",
        item.color,
        item.quantity,
        VALUE_BUTTON.toFixed(2),
        (item.quantity * VALUE_BUTTON).toFixed(2),
        lot.deliveryDone ? "Sim" : "Não",
        totalLot.toFixed(2)
      ].join(";") + "\n";
    });

    if (lot.deliveryDone) {
      csv += [
        formatDate(lot.date),
        "Entrega",
        "",
        1,
        VALUE_DELIVERY.toFixed(2),
        VALUE_DELIVERY.toFixed(2),
        "Sim",
        totalLot.toFixed(2)
      ].join(";") + "\n";
    }
  });

  const stats = getStats(lots);

  csv += "\n";
  csv += `TOTAL DE BOTÕES;;;${stats.buttons};;${stats.buttonValue.toFixed(2)};;\n`;
  csv += `TOTAL DE ENTREGAS;;;${stats.deliveries};;${stats.deliveryValue.toFixed(2)};;\n`;
  csv += `SALDO FINAL;;;;;${stats.total.toFixed(2)};;\n`;

  return csv;
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function downloadCSV(lots, filename) {
  if (!lots.length) {
    showToast("Não há dados para baixar.");
    return;
  }

  downloadFile("\uFEFF" + buildCSV(lots), filename, "text/csv;charset=utf-8;");
  showToast("Relatório baixado.");
}

function exportBackup() {
  const backup = {
    app: "Botões Pro",
    exportedAt: new Date().toISOString(),
    state
  };

  downloadFile(
    JSON.stringify(backup, null, 2),
    `backup-botoes-pro-${todayISO()}.json`,
    "application/json;charset=utf-8;"
  );

  showToast("Backup exportado.");
}

function importBackup(event) {
  const file = event.target.files[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    const data = safeParse(reader.result);
    const importedState = data?.state || data;

    if (!importedState || !Array.isArray(importedState.lots)) {
      showToast("Backup inválido.");
      return;
    }

    if (!confirm("Importar backup e substituir os dados atuais?")) return;

    state = {
      ...defaultState,
      ...importedState,
      settings: {
        ...defaultState.settings,
        ...(importedState.settings || {})
      },
      lots: importedState.lots.map(normalizeLot),
      models: Array.isArray(importedState.models) ? importedState.models.map(normalizeModel) : []
    };

    saveState();
    renderAll();
    showToast("Backup importado.");
  };

  reader.readAsText(file);
  event.target.value = "";
}

function clearAll() {
  if (!confirm("Apagar todos os dados deste aparelho?")) return;
  if (!confirm("Última confirmação. Essa ação não pode ser desfeita.")) return;

  state = structuredClone(defaultState);
  saveState();
  clearForm();
  renderAll();
  showToast("Tudo apagado.");
}

async function refreshApp() {
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  location.reload();
}

function setupInstall() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  $("#installApp").addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      return;
    }

    alert(
      "Para instalar:\n\n" +
      "iPhone: Safari → Compartilhar → Adicionar à Tela de Início.\n\n" +
      "Android: Chrome → três pontinhos → Instalar app."
    );
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(console.error);
  });
}

function updateConnection() {
  connectionStatus.textContent = navigator.onLine ? "Online" : "Offline";
}

$("#openMenu").addEventListener("click", openSidebar);
$("#closeMenu").addEventListener("click", closeSidebar);
overlay.addEventListener("click", closeSidebar);

$$(".nav-link").forEach((button) => {
  button.addEventListener("click", () => goToScreen(button.dataset.screen));
});

$$("[data-go]").forEach((button) => {
  button.addEventListener("click", () => goToScreen(button.dataset.go));
});

batchForm.addEventListener("submit", saveLot);
addItem.addEventListener("click", () => createItemRow(itemsArea));
saveAsModel.addEventListener("click", saveCurrentAsModel);
applyModel.addEventListener("click", applySelectedModel);

cancelEdit.addEventListener("click", () => {
  clearForm();
  showToast("Edição cancelada.");
});

historyList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === "delivery") toggleDelivery(id);
  if (action === "duplicate") duplicateLot(id);
  if (action === "edit") editLot(id);
  if (action === "delete") deleteLot(id);
});

modelsList.addEventListener("click", (event) => {
  const useButton = event.target.closest("[data-model-use]");
  const deleteButton = event.target.closest("[data-model-delete]");

  if (useButton) useModel(useButton.dataset.modelUse);
  if (deleteButton) deleteModel(deleteButton.dataset.modelDelete);
});

filterDate.addEventListener("change", renderHistory);
filterColor.addEventListener("input", renderHistory);
filterDelivery.addEventListener("change", renderHistory);

$("#clearFilters").addEventListener("click", () => {
  filterDate.value = "";
  filterColor.value = "";
  filterDelivery.value = "all";
  renderHistory();
});

closingDate.addEventListener("change", renderClosing);

$("#downloadDayReport").addEventListener("click", () => {
  const date = closingDate.value || todayISO();
  downloadCSV(getLotsByDate(date), `fechamento-${date}.csv`);
});

$("#downloadReport").addEventListener("click", () => {
  downloadCSV(state.lots, `relatorio-geral-${todayISO()}.csv`);
});

$("#downloadPeriodReport").addEventListener("click", () => {
  const start = periodStart.value;
  const end = periodEnd.value;

  if (!start || !end) {
    showToast("Escolha início e fim.");
    return;
  }

  if (start > end) {
    showToast("Data inicial maior que a final.");
    return;
  }

  const lots = state.lots.filter((lot) => lot.date >= start && lot.date <= end);
  downloadCSV(lots, `relatorio-${start}-a-${end}.csv`);
});

$("#exportBackup").addEventListener("click", exportBackup);
$("#importBackup").addEventListener("change", importBackup);

$("#goalForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.settings.dailyGoal = Number(dailyGoalInput.value || 0);
  saveState();
  renderAll();
  showToast("Meta salva.");
});

$("#refreshApp").addEventListener("click", refreshApp);
$("#clearAll").addEventListener("click", clearAll);

window.addEventListener("online", updateConnection);
window.addEventListener("offline", updateConnection);

closingDate.value = todayISO();
periodStart.value = todayISO();
periodEnd.value = todayISO();

dailyGoalInput.value = state.settings.dailyGoal || "";

clearForm();
setupInstall();
registerServiceWorker();
updateConnection();
renderAll();
saveState();
