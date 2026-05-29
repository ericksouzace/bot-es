const VALUE_BUTTON = 0.05;
const VALUE_DELIVERY = 5;
const STORAGE_KEY = "controleBotoesLocalAppV1";

const batchForm = document.querySelector("#batchForm");
const batchDate = document.querySelector("#batchDate");
const itemsArea = document.querySelector("#itemsArea");
const addItem = document.querySelector("#addItem");

const deliveryYes = document.querySelector("#deliveryYes");
const deliveryNo = document.querySelector("#deliveryNo");
const deliveryText = document.querySelector("#deliveryText");

const formTitle = document.querySelector("#formTitle");
const saveButton = document.querySelector("#saveButton");
const cancelEdit = document.querySelector("#cancelEdit");

const heroBalance = document.querySelector("#heroBalance");
const generalBalance = document.querySelector("#generalBalance");
const todayBalance = document.querySelector("#todayBalance");
const todayButtons = document.querySelector("#todayButtons");
const generalButtons = document.querySelector("#generalButtons");
const deliveryCount = document.querySelector("#deliveryCount");

const filterDate = document.querySelector("#filterDate");
const filterColor = document.querySelector("#filterColor");
const filterDelivery = document.querySelector("#filterDelivery");
const clearFilters = document.querySelector("#clearFilters");

const colorsSummary = document.querySelector("#colorsSummary");
const historyList = document.querySelector("#historyList");

const downloadReport = document.querySelector("#downloadReport");
const downloadReportTop = document.querySelector("#downloadReportTop");
const installApp = document.querySelector("#installApp");
const clearAll = document.querySelector("#clearAll");
const toast = document.querySelector("#toast");

let state = loadState();
let deliveryDone = false;
let editingId = null;
let deferredInstallPrompt = null;

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
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeLot(rawLot) {
  const items = rawLot.items || rawLot.itens || [];

  return {
    id: String(rawLot.id || createId()),
    date: rawLot.date || rawLot.data || todayISO(),
    deliveryDone: Boolean(rawLot.deliveryDone || rawLot.entregaFeita),
    items: items
      .map((item) => ({
        color: item.color || item.cor || "",
        quantity: Number(item.quantity || item.quantidade || 0)
      }))
      .filter((item) => item.color && item.quantity > 0),
    createdAtMillis: Number(rawLot.createdAtMillis || Date.now())
  };
}

function loadState() {
  const saved = safeParse(localStorage.getItem(STORAGE_KEY));

  if (saved && Array.isArray(saved.lots)) {
    return {
      lots: saved.lots.map(normalizeLot)
    };
  }

  const oldKeys = [
    "controleBotoesProfissionalV3",
    "controleBotoesProfissionalV2",
    "controleBotoesUltraV1",
    "lotesBotoesPro",
    "lotesBotoes"
  ];

  for (const key of oldKeys) {
    const oldData = safeParse(localStorage.getItem(key));

    if (oldData && Array.isArray(oldData.lots)) {
      return {
        lots: oldData.lots.map(normalizeLot)
      };
    }

    if (Array.isArray(oldData)) {
      return {
        lots: oldData.map(normalizeLot)
      };
    }
  }

  const oldProductions = safeParse(localStorage.getItem("producoesBotoes"));

  if (Array.isArray(oldProductions) && oldProductions.length > 0) {
    const grouped = {};

    oldProductions.forEach((item) => {
      const date = item.data || todayISO();

      if (!grouped[date]) {
        grouped[date] = {
          id: createId(),
          date,
          deliveryDone: false,
          items: [],
          createdAtMillis: Date.now()
        };
      }

      grouped[date].items.push({
        color: item.cor,
        quantity: Number(item.quantidade)
      });
    });

    return {
      lots: Object.values(grouped).map(normalizeLot)
    };
  }

  return {
    lots: []
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function formatDate(date) {
  if (!date || !date.includes("-")) {
    return date || "";
  }

  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function money(value) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function normalize(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function setDelivery(value) {
  deliveryDone = value;

  if (deliveryDone) {
    deliveryYes.classList.add("active");
    deliveryNo.classList.remove("active");
    deliveryText.textContent = "Entrega feita: R$ 5,00 serão adicionados ao saldo deste lote.";
  } else {
    deliveryNo.classList.add("active");
    deliveryYes.classList.remove("active");
    deliveryText.textContent = "Sem entrega: nenhum valor extra será adicionado.";
  }
}

function createItemRow(quantity = "", color = "") {
  const row = document.createElement("div");
  row.className = "row-item";

  row.innerHTML = `
    <input
      class="item-quantity"
      type="number"
      inputmode="numeric"
      min="1"
      placeholder="Qtd."
      value="${quantity}"
      required
    />

    <input
      class="item-color"
      type="text"
      list="colorSuggestions"
      placeholder="Cor. Ex: Pink"
      value="${color}"
      required
    />

    <button type="button" class="remove-row">×</button>
  `;

  const removeButton = row.querySelector(".remove-row");

  removeButton.addEventListener("click", () => {
    const rows = document.querySelectorAll(".row-item");

    if (rows.length > 1) {
      row.remove();
      return;
    }

    row.querySelector(".item-quantity").value = "";
    row.querySelector(".item-color").value = "";
  });

  itemsArea.appendChild(row);
}

function collectItems() {
  const rows = document.querySelectorAll(".row-item");
  const map = {};

  rows.forEach((row) => {
    const quantity = Number(row.querySelector(".item-quantity").value);
    const color = row.querySelector(".item-color").value.trim();

    if (quantity > 0 && color !== "") {
      const key = normalize(color);

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

function clearForm() {
  editingId = null;

  formTitle.textContent = "Novo lote";
  saveButton.textContent = "Salvar lote";
  cancelEdit.style.display = "none";

  batchDate.value = todayISO();
  itemsArea.innerHTML = "";

  createItemRow();
  setDelivery(false);
}

function lotButtons(lot) {
  return lot.items.reduce((total, item) => total + Number(item.quantity), 0);
}

function lotBalance(lot) {
  const buttonsValue = lotButtons(lot) * VALUE_BUTTON;
  const deliveryValue = lot.deliveryDone ? VALUE_DELIVERY : 0;

  return buttonsValue + deliveryValue;
}

function allItems() {
  const list = [];

  state.lots.forEach((lot) => {
    lot.items.forEach((item) => {
      list.push({
        lotId: lot.id,
        date: lot.date,
        deliveryDone: lot.deliveryDone,
        color: item.color,
        quantity: Number(item.quantity)
      });
    });
  });

  return list;
}

function calculateGeneralBalance() {
  const totalButtons = allItems().reduce((total, item) => total + item.quantity, 0);
  const totalDeliveries = state.lots.filter((lot) => lot.deliveryDone).length;

  return (totalButtons * VALUE_BUTTON) + (totalDeliveries * VALUE_DELIVERY);
}

function renderDashboard() {
  const today = todayISO();
  const items = allItems();

  const totalButtons = items.reduce((total, item) => total + item.quantity, 0);

  const buttonsToday = items
    .filter((item) => item.date === today)
    .reduce((total, item) => total + item.quantity, 0);

  const totalDeliveries = state.lots.filter((lot) => lot.deliveryDone).length;

  const deliveriesToday = state.lots
    .filter((lot) => lot.date === today && lot.deliveryDone)
    .length;

  const balance = calculateGeneralBalance();
  const balanceToday = (buttonsToday * VALUE_BUTTON) + (deliveriesToday * VALUE_DELIVERY);

  heroBalance.textContent = money(balance);
  generalBalance.textContent = money(balance);
  todayBalance.textContent = money(balanceToday);
  todayButtons.textContent = buttonsToday;
  generalButtons.textContent = totalButtons;
  deliveryCount.textContent = totalDeliveries;
}

function renderColorsSummary() {
  const items = allItems();
  const summary = {};

  items.forEach((item) => {
    const key = normalize(item.color);

    if (!summary[key]) {
      summary[key] = {
        color: item.color,
        quantity: 0
      };
    }

    summary[key].quantity += item.quantity;
  });

  const result = Object.values(summary).sort((a, b) => b.quantity - a.quantity);
  const max = result.length ? result[0].quantity : 1;

  colorsSummary.innerHTML = "";

  if (result.length === 0) {
    colorsSummary.innerHTML = `<div class="empty">Nenhuma cor registrada ainda.</div>`;
    return;
  }

  result.forEach((item) => {
    const percent = Math.max(8, Math.round((item.quantity / max) * 100));
    const balance = item.quantity * VALUE_BUTTON;

    const div = document.createElement("div");
    div.className = "color-card";
    div.style.setProperty("--w", `${percent}%`);

    div.innerHTML = `
      <div class="color-card-inner">
        <span>${item.color}</span>
        <strong>${item.quantity} • ${money(balance)}</strong>
      </div>
    `;

    colorsSummary.appendChild(div);
  });
}

function filteredLots() {
  let list = [...state.lots];

  if (filterDate.value) {
    list = list.filter((lot) => lot.date === filterDate.value);
  }

  if (filterColor.value.trim() !== "") {
    const search = normalize(filterColor.value);

    list = list.filter((lot) => {
      return lot.items.some((item) => normalize(item.color).includes(search));
    });
  }

  if (filterDelivery.value === "yes") {
    list = list.filter((lot) => lot.deliveryDone);
  }

  if (filterDelivery.value === "no") {
    list = list.filter((lot) => !lot.deliveryDone);
  }

  return list.sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }

    return b.createdAtMillis - a.createdAtMillis;
  });
}

function renderHistory() {
  const list = filteredLots();
  historyList.innerHTML = "";

  if (list.length === 0) {
    historyList.innerHTML = `<div class="empty">Nenhum lote encontrado.</div>`;
    return;
  }

  list.forEach((lot) => {
    const total = lotButtons(lot);
    const buttonsBalance = total * VALUE_BUTTON;
    const deliveryBalance = lot.deliveryDone ? VALUE_DELIVERY : 0;
    const balance = lotBalance(lot);

    const itemsHTML = lot.items
      .map((item) => {
        const subtotal = item.quantity * VALUE_BUTTON;

        return `
          <li>
            <span>${item.quantity} ${item.color}</span>
            <strong>${money(subtotal)}</strong>
          </li>
        `;
      })
      .join("");

    const deliveryChip = lot.deliveryDone
      ? `<span class="chip chip-ok">Entrega: Sim + ${money(deliveryBalance)}</span>`
      : `<span class="chip chip-no">Entrega: Não</span>`;

    const div = document.createElement("article");
    div.className = "history-card";

    div.innerHTML = `
      <h3>Lote de ${formatDate(lot.date)}</h3>

      <div class="chips">
        <span class="chip">Botões: ${total}</span>
        <span class="chip">Valor botões: ${money(buttonsBalance)}</span>
        ${deliveryChip}
        <span class="chip chip-ok">Total: ${money(balance)}</span>
      </div>

      <ul class="items-list">
        ${itemsHTML}
      </ul>

      <div class="history-actions">
        <button class="btn btn-dark" type="button" data-action="edit" data-id="${lot.id}">
          Editar
        </button>

        <button class="btn btn-danger" type="button" data-action="delete" data-id="${lot.id}">
          Apagar
        </button>
      </div>
    `;

    historyList.appendChild(div);
  });
}

function renderAll() {
  renderDashboard();
  renderColorsSummary();
  renderHistory();
}

function saveLot(event) {
  event.preventDefault();

  const items = collectItems();

  if (items.length === 0) {
    showToast("Adicione pelo menos uma cor ao lote.");
    return;
  }

  const lot = {
    id: editingId || createId(),
    date: batchDate.value,
    deliveryDone,
    items,
    createdAtMillis: editingId
      ? state.lots.find((item) => String(item.id) === String(editingId))?.createdAtMillis || Date.now()
      : Date.now()
  };

  if (editingId) {
    state.lots = state.lots.map((item) => {
      return String(item.id) === String(editingId) ? lot : item;
    });

    showToast("Lote atualizado com sucesso.");
  } else {
    state.lots.push(lot);
    showToast("Lote salvo com sucesso.");
  }

  saveState();
  clearForm();
  renderAll();
}

function editLot(id) {
  const lot = state.lots.find((item) => String(item.id) === String(id));

  if (!lot) {
    showToast("Não encontrei esse lote para editar.");
    return;
  }

  editingId = String(lot.id);

  formTitle.textContent = "Editando lote";
  saveButton.textContent = "Atualizar lote";
  cancelEdit.style.display = "block";

  batchDate.value = lot.date;
  setDelivery(Boolean(lot.deliveryDone));

  itemsArea.innerHTML = "";

  lot.items.forEach((item) => {
    createItemRow(item.quantity, item.color);
  });

  document.querySelector("#formPanel").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function deleteLot(id) {
  const confirmDelete = confirm("Apagar este lote? O saldo será recalculado automaticamente.");

  if (!confirmDelete) {
    return;
  }

  const before = state.lots.length;

  state.lots = state.lots.filter((lot) => String(lot.id) !== String(id));

  if (state.lots.length === before) {
    showToast("Não encontrei esse lote para apagar.");
    return;
  }

  if (editingId && String(editingId) === String(id)) {
    clearForm();
  }

  saveState();
  renderAll();

  showToast("Lote apagado. Saldo atualizado.");
}

function escapeCSV(value) {
  const text = String(value ?? "");

  if (text.includes(";") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function downloadCSV() {
  if (state.lots.length === 0) {
    showToast("Não há dados para baixar.");
    return;
  }

  let csv = "Data;Tipo;Cor;Quantidade;Valor unitario;Subtotal;Entrega feita;Total do lote\n";

  state.lots.forEach((lot) => {
    const totalLot = lotBalance(lot);

    lot.items.forEach((item) => {
      const subtotal = item.quantity * VALUE_BUTTON;

      csv += [
        formatDate(lot.date),
        "Botões",
        item.color,
        item.quantity,
        VALUE_BUTTON.toFixed(2),
        subtotal.toFixed(2),
        lot.deliveryDone ? "Sim" : "Não",
        totalLot.toFixed(2)
      ].map(escapeCSV).join(";") + "\n";
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
      ].map(escapeCSV).join(";") + "\n";
    }
  });

  const totalButtons = allItems().reduce((total, item) => total + item.quantity, 0);
  const totalDeliveries = state.lots.filter((lot) => lot.deliveryDone).length;
  const buttonBalance = totalButtons * VALUE_BUTTON;
  const deliveryBalance = totalDeliveries * VALUE_DELIVERY;
  const finalBalance = buttonBalance + deliveryBalance;

  csv += "\n";
  csv += ["TOTAL DE BOTÕES", "", "", totalButtons, "", buttonBalance.toFixed(2), "", ""].map(escapeCSV).join(";") + "\n";
  csv += ["TOTAL DE ENTREGAS", "", "", totalDeliveries, "", deliveryBalance.toFixed(2), "", ""].map(escapeCSV).join(";") + "\n";
  csv += ["SALDO FINAL", "", "", "", "", finalBalance.toFixed(2), "", ""].map(escapeCSV).join(";") + "\n";

  const file = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const link = document.createElement("a");
  const url = URL.createObjectURL(file);

  link.href = url;
  link.download = `relatorio-controle-de-botoes-${todayISO()}.csv`;
  link.click();

  URL.revokeObjectURL(url);

  showToast("Relatório baixado.");
}

function clearAllHistory() {
  const first = confirm("Tem certeza que deseja apagar TODO o histórico deste aparelho?");

  if (!first) {
    return;
  }

  const second = confirm("Última confirmação: essa ação não pode ser desfeita.");

  if (!second) {
    return;
  }

  state.lots = [];
  saveState();
  clearForm();
  renderAll();

  showToast("Histórico apagado.");
}

function setupInstallButton() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  installApp.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      return;
    }

    alert(
      "Para instalar:\n\n" +
      "iPhone: abra no Safari → Compartilhar → Adicionar à Tela de Início.\n\n" +
      "Android: Chrome → três pontinhos → Instalar app ou Adicionar à tela inicial."
    );
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.error("Erro no Service Worker:", error);
    });
  });
}

batchForm.addEventListener("submit", saveLot);

deliveryYes.addEventListener("click", () => setDelivery(true));
deliveryNo.addEventListener("click", () => setDelivery(false));

addItem.addEventListener("click", () => createItemRow());

cancelEdit.addEventListener("click", () => {
  clearForm();
  showToast("Edição cancelada.");
});

historyList.addEventListener("click", (event) => {
  const button = event.target.closest("button");

  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const id = button.dataset.id;

  if (action === "edit") {
    editLot(id);
  }

  if (action === "delete") {
    deleteLot(id);
  }
});

filterDate.addEventListener("change", renderHistory);
filterColor.addEventListener("input", renderHistory);
filterDelivery.addEventListener("change", renderHistory);

clearFilters.addEventListener("click", () => {
  filterDate.value = "";
  filterColor.value = "";
  filterDelivery.value = "all";

  renderHistory();
});

downloadReport.addEventListener("click", downloadCSV);
downloadReportTop.addEventListener("click", downloadCSV);
clearAll.addEventListener("click", clearAllHistory);

setupInstallButton();
registerServiceWorker();
clearForm();
saveState();
renderAll();
