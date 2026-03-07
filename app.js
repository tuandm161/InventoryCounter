// ===== DATA STORE =====
let models = [];    // { id, name, order }
let variants = [];  // { id, modelId, color, stock, sold }
let nextModelId = 1;
let nextVariantId = 1;
let addColorTargetModelId = null;

// ===== INIT =====
(function init() {
  loadData();
  renderAll();
})();

// ===== LOCAL STORAGE =====
function saveData() {
  const data = { models, variants, nextModelId, nextVariantId };
  localStorage.setItem('live_counter_data', JSON.stringify(data));
}

function loadData() {
  try {
    const raw = localStorage.getItem('live_counter_data');
    if (raw) {
      const data = JSON.parse(raw);
      models = data.models || [];
      variants = data.variants || [];
      nextModelId = data.nextModelId || 1;
      nextVariantId = data.nextVariantId || 1;
    }
  } catch (e) {
    console.warn('Load data error:', e);
  }
}

// ===== RENDER =====
function renderAll() {
  renderProducts();
  renderStats();
}

function renderStats() {
  const totalSold = variants.reduce((sum, v) => sum + v.sold, 0);
  document.getElementById('total-orders').textContent = totalSold.toLocaleString('vi-VN');
  document.getElementById('total-models').textContent = models.length;
}

function renderProducts() {
  const container = document.getElementById('product-list');
  const emptyState = document.getElementById('empty-state');

  if (models.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  const sortSelect = document.getElementById('sort-select');
  const sortValue = sortSelect ? sortSelect.value : 'manual';

  let sortedModels = [...models];
  // Ensure order exists
  sortedModels.forEach((m, i) => { if (m.order === undefined) m.order = i; });

  if (sortValue === 'name_asc') {
    sortedModels.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortValue === 'name_desc') {
    sortedModels.sort((a, b) => b.name.localeCompare(a.name));
  } else if (sortValue === 'sold_desc') {
    sortedModels.sort((a, b) => {
      const soldA = variants.filter(v => v.modelId === a.id).reduce((s, x) => s + x.sold, 0);
      const soldB = variants.filter(v => v.modelId === b.id).reduce((s, x) => s + x.sold, 0);
      return soldB - soldA;
    });
  } else {
    sortedModels.sort((a, b) => a.order - b.order);
  }

  container.innerHTML = sortedModels.map(model => renderModelCard(model)).join('');

  if (sortValue === 'manual') {
    initDragAndDrop();
  }
}

function renderModelCard(model) {
  const modelVariants = variants.filter(v => v.modelId === model.id);
  const totalSold = modelVariants.reduce((sum, v) => sum + v.sold, 0);

  return `
    <div class="model-card" id="model-${model.id}" data-id="${model.id}" draggable="true">
      <div class="model-header" style="cursor: grab;" title="Kéo thả để sắp xếp">
        <div class="model-title">
          <span class="model-name">${escHtml(model.name)}</span>
        </div>
        <div class="model-actions">
          <button class="btn btn-ghost" onclick="openAddColorModal(${model.id})" title="Thêm màu">＋ Màu</button>
          <button class="btn btn-danger" onclick="resetModel(${model.id})" title="Reset mẫu này">↺</button>
          <button class="btn btn-danger" onclick="deleteModel(${model.id})" title="Xóa mẫu">✕</button>
        </div>
      </div>
      <div class="model-body">
        ${modelVariants.map(v => renderVariantRow(v)).join('')}
        ${modelVariants.length === 0 ? '<p style="padding:14px 18px;color:var(--text-muted);font-size:0.85rem;">Chưa có màu nào. Bấm "＋ Màu" để thêm.</p>' : ''}
      </div>
      <div class="model-footer">
        <span class="model-total">Tổng ${escHtml(model.name)}: <strong>${totalSold}</strong></span>
      </div>
    </div>
  `;
}

function renderVariantRow(v) {
  const model = models.find(m => m.id === v.modelId);
  const remain = v.stock - v.sold;

  return `
    <div class="variant-row" id="variant-${v.id}">
      <span class="variant-color">${escHtml(v.color)}</span>
      <div class="variant-controls">
        <button class="counter-btn minus" onclick="changeSold(${v.id}, -1)" ${v.sold <= 0 ? 'disabled' : ''}>−</button>
        <span class="sold-count" id="sold-${v.id}">${v.sold}</span>
        <button class="counter-btn plus" onclick="changeSold(${v.id}, 1)">＋</button>
      </div>
      <span class="variant-stock" title="Bấm để sửa tồn kho" style="cursor: pointer; text-decoration: underline dashed #ccc;" onclick="editStock(${v.id})">tồn: <strong id="remain-${v.id}">${remain}</strong> / ${v.stock}</span>
    </div>
  `;
}

function editStock(variantId) {
  const v = variants.find(x => x.id === variantId);
  if (!v) return;
  const newValue = prompt(`Sửa số lượng tồn kho của màu '${v.color}':`, v.stock);
  if (newValue !== null && newValue.trim() !== '') {
    const stockInt = parseInt(newValue);
    if (!isNaN(stockInt) && stockInt >= 0) {
      v.stock = stockInt;
      saveData();
      renderAll();
    }
  }
}

// ===== UPDATE SINGLE VARIANT (fast, no full re-render) =====
function updateVariantUI(variantId) {
  const v = variants.find(x => x.id === variantId);
  if (!v) return;

  const model = models.find(m => m.id === v.modelId);
  if (!model) return;

  // Update sold count with pulse animation
  const soldEl = document.getElementById(`sold-${v.id}`);
  if (soldEl) {
    soldEl.textContent = v.sold;
    soldEl.classList.remove('pulse');
    // force reflow
    void soldEl.offsetWidth;
    soldEl.classList.add('pulse');
  }

  // Update stock display
  const row = document.getElementById(`variant-${v.id}`);
  if (row) {
    const stockEl = row.querySelector('.variant-stock');
    if (stockEl) {
      const remain = v.stock - v.sold;
      stockEl.innerHTML = `tồn: <strong>${remain}</strong> / ${v.stock}`;
    }
    // Update minus button disabled state
    const minusBtn = row.querySelector('.counter-btn.minus');
    if (minusBtn) minusBtn.disabled = v.sold <= 0;
  }

  // Update model totals
  const modelCard = document.getElementById(`model-${v.modelId}`);
  if (modelCard) {
    const modelVariants = variants.filter(x => x.modelId === v.modelId);
    const totalSold = modelVariants.reduce((sum, x) => sum + x.sold, 0);

    const totalEl = modelCard.querySelector('.model-total');
    if (totalEl) totalEl.innerHTML = `Tổng ${escHtml(model.name)}: <strong>${totalSold}</strong>`;
  }

  // Update global stats
  renderStats();
}

// ===== ACTIONS =====
function changeSold(variantId, delta) {
  const v = variants.find(x => x.id === variantId);
  if (!v) return;

  const newSold = v.sold + delta;
  if (newSold < 0) return; // Không cho âm

  v.sold = newSold;
  updateVariantUI(variantId);
  saveData();
}

// ===== ADD MODEL =====
function openAddModelModal() {
  document.getElementById('input-model-name').value = '';
  document.getElementById('input-model-color').value = '';
  document.getElementById('input-model-stock').value = '';
  openModal('modal-add-model');
  setTimeout(() => document.getElementById('input-model-name').focus(), 300);
}

function addModel() {
  const nameEl = document.getElementById('input-model-name');
  const colorEl = document.getElementById('input-model-color');
  const stockEl = document.getElementById('input-model-stock');

  const name = nameEl.value.trim();
  const color = colorEl.value.trim();
  const stock = parseInt(stockEl.value) || 0;

  if (!name) { nameEl.focus(); return; }
  if (!color) { colorEl.focus(); return; }

  const model = { id: nextModelId++, name, order: models.length };
  models.push(model);

  const variant = { id: nextVariantId++, modelId: model.id, color, stock, sold: 0 };
  variants.push(variant);

  saveData();
  renderAll();
  closeModal('modal-add-model');
}

// ===== ADD COLOR =====
function openAddColorModal(modelId) {
  addColorTargetModelId = modelId;
  const model = models.find(m => m.id === modelId);
  document.getElementById('add-color-model-name').textContent = model ? model.name : '';
  document.getElementById('input-color-name').value = '';
  document.getElementById('input-color-stock').value = '';
  openModal('modal-add-color');
  setTimeout(() => document.getElementById('input-color-name').focus(), 300);
}

function addColor() {
  if (!addColorTargetModelId) return;

  const colorEl = document.getElementById('input-color-name');
  const stockEl = document.getElementById('input-color-stock');

  const color = colorEl.value.trim();
  const stock = parseInt(stockEl.value) || 0;

  if (!color) { colorEl.focus(); return; }

  const variant = { id: nextVariantId++, modelId: addColorTargetModelId, color, stock, sold: 0 };
  variants.push(variant);

  saveData();
  renderAll();
  closeModal('modal-add-color');
  addColorTargetModelId = null;
}

// ===== RESET =====
function resetModel(modelId) {
  const model = models.find(m => m.id === modelId);
  if (!model) return;
  if (!confirm(`Reset toàn bộ đơn của mẫu "${model.name}"?`)) return;

  variants.filter(v => v.modelId === modelId).forEach(v => v.sold = 0);
  saveData();
  renderAll();
}

function resetAll() {
  if (variants.length === 0) return;
  if (!confirm('Reset toàn bộ đơn?')) return;

  variants.forEach(v => v.sold = 0);
  saveData();
  renderAll();
}

// ===== DELETE =====
function deleteModel(modelId) {
  const model = models.find(m => m.id === modelId);
  if (!model) return;
  if (!confirm(`Xóa mẫu "${model.name}" và tất cả màu?`)) return;

  models = models.filter(m => m.id !== modelId);
  variants = variants.filter(v => v.modelId !== modelId);
  saveData();
  renderAll();
}

// ===== MODAL =====
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
    }
  });
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  }
});

// Submit on Enter in modals
document.getElementById('input-model-stock').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addModel();
});

document.getElementById('input-color-stock').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addColor();
});

// ===== HELPERS =====
function formatMoney(amount) {
  if (amount >= 1_000_000_000) {
    return (amount / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + ' tỷ';
  }
  if (amount >= 1_000_000) {
    return (amount / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' tr';
  }
  if (amount >= 1_000) {
    return Math.round(amount / 1_000) + 'k';
  }
  return amount.toLocaleString('vi-VN') + 'đ';
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== DRAG AND DROP =====
let draggedModelId = null;

function initDragAndDrop() {
  const cards = document.querySelectorAll('.model-card');
  cards.forEach(card => {
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('drop', handleDrop);
    card.addEventListener('dragenter', handleDragEnter);
    card.addEventListener('dragleave', handleDragLeave);
  });
}

function handleDragStart(e) {
  draggedModelId = parseInt(this.getAttribute('data-id'));
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedModelId);
  setTimeout(() => this.classList.add('dragging'), 0);
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDragEnter(e) {
  e.preventDefault();
  this.classList.add('drag-over');
}

function handleDragLeave(e) {
  this.classList.remove('drag-over');
}

function handleDrop(e) {
  e.stopPropagation();
  this.classList.remove('drag-over');

  const targetModelId = parseInt(this.getAttribute('data-id'));
  // Ensure we are in manual mode
  const sortValue = document.getElementById('sort-select').value;

  if (sortValue === 'manual' && draggedModelId !== null && draggedModelId !== targetModelId) {
    // Current sorted models Array
    const sortedModels = [...models].sort((a, b) => (a.order || 0) - (b.order || 0));

    const fromIndex = sortedModels.findIndex(m => m.id === draggedModelId);
    const toIndex = sortedModels.findIndex(m => m.id === targetModelId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const [moved] = sortedModels.splice(fromIndex, 1);
      sortedModels.splice(toIndex, 0, moved);

      // Update actual global models order
      sortedModels.forEach((m, idx) => {
        const originalModel = models.find(x => x.id === m.id);
        if (originalModel) originalModel.order = idx;
      });

      saveData();
      renderProducts();
    }
  }
  return false;
}
