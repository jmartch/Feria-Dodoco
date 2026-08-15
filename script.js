"use strict";

/* ===== Datos de productos ===== */
const PRODUCTS = [
  { id: "pines", name: "Pines", price: 12000 },
  { id: "llaveros", name: "Llaveros de celular", price: 16000 },
  { id: "diademas", name: "Diademas de Sanrio", price: 15000 },
  { id: "stickers-peq", name: "Stickers pequeños", price: 5000 },
  { id: "stickers-grandes", name: "Stickers grandes", price: 18000 },
];

const DISCOUNT_RATE = 0.1; // 10%
const STORAGE_KEY = "dodoco_ventas"; // ventas guardadas en localStorage

/* ===== Formateador de moneda (pesos colombianos) ===== */
const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

const formatCOP = (value) => cop.format(value);

/* ===== Referencias del DOM ===== */
const productList = document.getElementById("productList");
const subtotalGeneralEl = document.getElementById("subtotalGeneral");
const discountToggle = document.getElementById("discountToggle");
const discountRow = document.getElementById("discountRow");
const discountValueEl = document.getElementById("discountValue");
const totalFinalEl = document.getElementById("totalFinal");
const clearButton = document.getElementById("clearButton");

const montoRecibidoEl = document.getElementById("montoRecibido");
const changeRow = document.getElementById("changeRow");
const changeValueEl = document.getElementById("changeValue");
const registerButton = document.getElementById("registerButton");

const salesList = document.getElementById("salesList");
const salesCountEl = document.getElementById("salesCount");
const salesDayTotalEl = document.getElementById("salesDayTotal");
const salesEmptyEl = document.getElementById("salesEmpty");
const exportButton = document.getElementById("exportButton");
const copyButton = document.getElementById("copyButton");
const clearDayButton = document.getElementById("clearDayButton");
const toastEl = document.getElementById("toast");

/* Estado de cálculo actual (se actualiza en cada recálculo) */
let current = { items: [], subtotalGeneral: 0, discount: 0, total: 0 };

/* ===== Utilidades ===== */
// Clave de día local (YYYY-MM-DD) para agrupar las ventas de hoy
function dayKey(date) {
  const d = date ? new Date(date) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("toast--show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove("toast--show"), 2200);
}

/* ===== Construcción de las tarjetas de producto ===== */
function buildProductCards() {
  const fragment = document.createDocumentFragment();

  PRODUCTS.forEach((product) => {
    const li = document.createElement("li");
    li.className = "product-card";

    li.innerHTML = `
      <div class="product-card__info">
        <span class="product-card__name">${product.name}</span>
        <span class="product-card__price">${product.name} (${formatCOP(product.price)})</span>
      </div>
      <div class="qty">
        <label for="qty-${product.id}">Cantidad de ${product.name}</label>
        <input
          type="number"
          id="qty-${product.id}"
          data-id="${product.id}"
          min="0"
          step="1"
          inputmode="numeric"
          placeholder="0"
        />
      </div>
      <span class="subtotal" id="subtotal-${product.id}">${formatCOP(0)}</span>
    `;

    fragment.appendChild(li);
  });

  productList.appendChild(fragment);
}

/* ===== Lectura y saneamiento de una cantidad ===== */
function sanitizeInt(rawValue) {
  // Vacío cuenta como 0. Solo enteros >= 0.
  let value = parseInt(rawValue, 10);
  if (isNaN(value) || value < 0) value = 0;
  return value;
}

/* ===== Cálculo y actualización en tiempo real ===== */
function recalculate() {
  let subtotalGeneral = 0;
  const items = [];

  PRODUCTS.forEach((product) => {
    const input = document.getElementById(`qty-${product.id}`);
    const qty = sanitizeInt(input.value);
    const subtotal = qty * product.price;
    subtotalGeneral += subtotal;

    if (qty > 0) {
      items.push({ name: product.name, price: product.price, qty, subtotal });
    }

    document.getElementById(`subtotal-${product.id}`).textContent =
      formatCOP(subtotal);
  });

  const applyDiscount = discountToggle.checked;
  const discount = applyDiscount ? subtotalGeneral * DISCOUNT_RATE : 0;
  const total = subtotalGeneral - discount;

  subtotalGeneralEl.textContent = formatCOP(subtotalGeneral);
  discountValueEl.textContent = `−${formatCOP(discount)}`;
  totalFinalEl.textContent = formatCOP(total);
  discountRow.style.opacity = applyDiscount ? "1" : "0.55";

  current = { items, subtotalGeneral, discount, total, applyDiscount };

  updateChange();

  // Solo se puede registrar si hay algo que cobrar
  registerButton.disabled = total <= 0;
}

/* ===== Cambio a devolver ===== */
function updateChange() {
  const recibido = sanitizeInt(montoRecibidoEl.value);
  const change = recibido - current.total;

  if (montoRecibidoEl.value === "" || recibido === 0) {
    changeValueEl.textContent = formatCOP(0);
    changeRow.classList.remove("pay__change--short");
    return;
  }

  if (change < 0) {
    changeValueEl.textContent = `Faltan ${formatCOP(Math.abs(change))}`;
    changeRow.classList.add("pay__change--short");
  } else {
    changeValueEl.textContent = formatCOP(change);
    changeRow.classList.remove("pay__change--short");
  }
}

/* ===== Saneamiento de inputs numéricos mientras se escribe ===== */
function cleanNumericInput(input) {
  // Elimina cualquier caracter que no sea dígito (bloquea "-", ".", "e", etc.)
  const cleaned = input.value.replace(/[^\d]/g, "");
  if (cleaned !== input.value) input.value = cleaned;
}

function handleProductInput(event) {
  const input = event.target;
  if (!input.matches('input[type="number"]')) return;
  cleanNumericInput(input);
  recalculate();
}

function handleMontoInput() {
  cleanNumericInput(montoRecibidoEl);
  updateChange();
}

/* ===== Limpiar la calculadora (sin borrar ventas) ===== */
function clearCalculator() {
  document
    .querySelectorAll('#productList input[type="number"]')
    .forEach((input) => {
      input.value = "";
    });
  discountToggle.checked = false;
  montoRecibidoEl.value = "";
  recalculate();
}

/* ===== localStorage: cargar / guardar ventas ===== */
function loadSales() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn("No se pudieron leer las ventas guardadas:", e);
    return [];
  }
}

function saveSales(sales) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sales));
  } catch (e) {
    console.warn("No se pudieron guardar las ventas:", e);
    showToast("⚠️ No se pudo guardar en este navegador");
  }
}

function todaySales() {
  const today = dayKey();
  return loadSales().filter((s) => s.dayKey === today);
}

/* ===== Registrar una venta ===== */
function registerSale() {
  if (current.total <= 0) {
    showToast("Agrega productos antes de registrar");
    return;
  }

  const recibido = sanitizeInt(montoRecibidoEl.value);
  const sale = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    dayKey: dayKey(),
    items: current.items,
    subtotalGeneral: current.subtotalGeneral,
    discountApplied: current.applyDiscount,
    discount: current.discount,
    total: current.total,
    recibido: recibido,
    cambio: recibido > 0 ? Math.max(0, recibido - current.total) : 0,
  };

  const sales = loadSales();
  sales.push(sale);
  saveSales(sales);

  renderSales();
  clearCalculator();
  showToast("✅ Venta registrada");
}

/* ===== Eliminar una venta ===== */
function deleteSale(id) {
  const sales = loadSales().filter((s) => s.id !== id);
  saveSales(sales);
  renderSales();
  showToast("Venta eliminada");
}

/* ===== Vaciar las ventas de hoy ===== */
function clearDay() {
  const today = dayKey();
  const count = todaySales().length;
  if (count === 0) {
    showToast("No hay ventas de hoy");
    return;
  }
  const ok = window.confirm(
    `¿Vaciar las ${count} venta(s) de hoy? Esta acción no se puede deshacer.`
  );
  if (!ok) return;

  const remaining = loadSales().filter((s) => s.dayKey !== today);
  saveSales(remaining);
  renderSales();
  showToast("Ventas de hoy vaciadas");
}

/* ===== Render de la lista de ventas de hoy ===== */
function renderSales() {
  const sales = todaySales().sort((a, b) => b.id - a.id); // más recientes primero
  salesList.innerHTML = "";

  const dayTotal = sales.reduce((sum, s) => sum + s.total, 0);
  salesCountEl.textContent = `(${sales.length})`;
  salesDayTotalEl.textContent = formatCOP(dayTotal);

  if (sales.length === 0) {
    salesEmptyEl.style.display = "block";
    return;
  }
  salesEmptyEl.style.display = "none";

  const fragment = document.createDocumentFragment();

  sales.forEach((sale) => {
    const li = document.createElement("li");
    li.className = "sale-item";

    const time = new Date(sale.timestamp).toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const productos = sale.items
      .map((it) => `${it.qty}× ${it.name}`)
      .join(", ");

    const descTxt = sale.discountApplied
      ? ` · desc. ${formatCOP(sale.discount)}`
      : "";
    const pagoTxt =
      sale.recibido > 0
        ? ` · recibido ${formatCOP(sale.recibido)} · cambio ${formatCOP(sale.cambio)}`
        : "";

    li.innerHTML = `
      <span class="sale-item__time">${time}</span>
      <span class="sale-item__details">
        <b>${formatCOP(sale.total)}</b>${descTxt}${pagoTxt}<br />
        ${productos}
      </span>
      <button type="button" class="sale-item__delete" data-id="${sale.id}" title="Eliminar venta" aria-label="Eliminar venta">✕</button>
    `;

    fragment.appendChild(li);
  });

  salesList.appendChild(fragment);
}

/* ===== Exportar CSV de las ventas de hoy ===== */
function exportCSV() {
  const sales = todaySales().sort((a, b) => a.id - b.id);
  if (sales.length === 0) {
    showToast("No hay ventas para exportar");
    return;
  }

  const headers = [
    "Hora",
    "Productos",
    "Subtotal",
    "Descuento",
    "Total",
    "Recibido",
    "Cambio",
  ];

  const rows = sales.map((sale) => {
    const hora = new Date(sale.timestamp).toLocaleTimeString("es-CO");
    const productos = sale.items.map((it) => `${it.qty}x ${it.name}`).join(" | ");
    return [
      hora,
      productos,
      sale.subtotalGeneral,
      sale.discount,
      sale.total,
      sale.recibido,
      sale.cambio,
    ];
  });

  const dayTotal = sales.reduce((sum, s) => sum + s.total, 0);
  rows.push([]);
  rows.push(["", "TOTAL DEL DÍA", "", "", dayTotal, "", ""]);

  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers, ...rows]
    .map((r) => r.map(escape).join(","))
    .join("\r\n");

  // BOM para que Excel abra bien los acentos y el símbolo $
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ventas-dodoco-${dayKey()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("⬇️ CSV descargado");
}

/* ===== Copiar resumen de texto ===== */
async function copySummary() {
  const sales = todaySales().sort((a, b) => a.id - b.id);
  if (sales.length === 0) {
    showToast("No hay ventas para copiar");
    return;
  }

  const dayTotal = sales.reduce((sum, s) => sum + s.total, 0);
  let text = `🧸 Ventas Dodoco — ${dayKey()}\n\n`;

  sales.forEach((sale, i) => {
    const hora = new Date(sale.timestamp).toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const productos = sale.items.map((it) => `${it.qty}× ${it.name}`).join(", ");
    text += `${i + 1}. ${hora} — ${formatCOP(sale.total)}\n   ${productos}\n`;
  });

  text += `\nTotal del día (${sales.length} ventas): ${formatCOP(dayTotal)}`;

  try {
    await navigator.clipboard.writeText(text);
    showToast("📋 Resumen copiado");
  } catch (e) {
    // Fallback si el navegador bloquea el portapapeles
    window.prompt("Copia el resumen:", text);
  }
}

/* ===== Inicialización ===== */
function init() {
  buildProductCards();

  productList.addEventListener("input", handleProductInput);
  discountToggle.addEventListener("change", recalculate);
  montoRecibidoEl.addEventListener("input", handleMontoInput);
  clearButton.addEventListener("click", clearCalculator);
  registerButton.addEventListener("click", registerSale);

  salesList.addEventListener("click", (event) => {
    const btn = event.target.closest(".sale-item__delete");
    if (btn) deleteSale(Number(btn.dataset.id));
  });

  exportButton.addEventListener("click", exportCSV);
  copyButton.addEventListener("click", copySummary);
  clearDayButton.addEventListener("click", clearDay);

  recalculate();
  renderSales();
}

document.addEventListener("DOMContentLoaded", init);
