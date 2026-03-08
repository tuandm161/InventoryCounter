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

  const imgHtml = model.image
    ? `<img src="${model.image}" onclick="document.getElementById('upload-img-${model.id}').click()" style="width: 150px; height: 150px; border-radius: 4px; object-fit: cover; border: 1px solid var(--border); cursor: pointer; background: #fff; flex-shrink: 0;" title="Bấm để đổi ảnh">`
    : `<div onclick="document.getElementById('upload-img-${model.id}').click()" style="width: 150px; height: 150px; border-radius: 4px; border: 1px dashed var(--border); display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; font-size: 0.9rem; color: var(--text-muted); background: #fff; flex-shrink: 0;" title="Thêm ảnh"><span style="font-size:2rem; font-weight: 300; line-height: 1; margin-bottom: 2px;">+</span>Ảnh</div>`;

  return `
    <div class="model-card" id="model-${model.id}" data-id="${model.id}" draggable="true">
      <div class="model-header" style="cursor: grab; display: flex; align-items: flex-start; gap: 8px; padding: 6px; background: #fff;" title="Kéo thả để sắp xếp">
        <div style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
          ${imgHtml}
          <input type="file" id="upload-img-${model.id}" accept="image/*" style="display:none;" onchange="updateModelImage(${model.id}, this)">
          <span class="model-total" style="font-size: 0.85rem; color: var(--accent); background: #fafafa; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border); width: 100%; text-align: center;">Tổng: <strong>${totalSold}</strong></span>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; gap: 6px; padding: 0; min-width: 0;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px;">
            <span class="model-name" onclick="editModelName(${model.id})" style="font-size: 1rem; line-height: 1.2; word-break: break-word; cursor: pointer; text-decoration: underline dashed #ccc;" title="Bấm để sửa tên mẫu">${escHtml(model.name)}</span>
          </div>
          
          <div class="model-body" style="display: flex; flex-direction: column; gap: 4px; padding: 0;">
            ${modelVariants.map(v => renderVariantRow(v)).join('')}
            ${modelVariants.length === 0 ? '<p style="color:var(--text-muted);font-size:0.85rem; margin: 0;">Chưa có màu nào.</p>' : ''}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
              <button class="btn" onclick="openAddColorModal(${model.id})" style="padding: 2px 6px; font-size: 0.7rem; border-style: dashed;">＋ Thêm màu</button>
              <button class="btn btn-danger" onclick="deleteModel(${model.id})" title="Xóa mẫu này" style="padding: 2px 6px; font-size: 0.7rem;">✕ Xóa mẫu</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderVariantRow(v) {
  const model = models.find(m => m.id === v.modelId);

  return `
    <div class="variant-row" id="variant-${v.id}" style="justify-content: space-between; background: #fafafa; border: 1px solid var(--border); border-radius: 4px; padding: 2px 4px; font-size: 0.75rem;">
      <span class="variant-color" onclick="editColorName(${v.id})" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; cursor: pointer; text-decoration: underline dashed #ccc;" title="Bấm để sửa màu">${escHtml(v.color)}</span>
      <div class="variant-controls" style="gap: 1px;">
        <button class="counter-btn minus" onclick="changeSold(${v.id}, -1)" ${v.sold <= 0 ? 'disabled' : ''} style="width: 20px; height: 20px;">−</button>
        <span class="sold-count" id="sold-${v.id}" style="min-width: 20px; font-size: 0.8rem;">${v.sold}</span>
        <button class="counter-btn plus" onclick="changeSold(${v.id}, 1)" style="width: 20px; height: 20px;">＋</button>
      </div>
    </div>
  `;
}

function editModelName(modelId) {
  const model = models.find(m => m.id === modelId);
  if (!model) return;
  const newName = prompt(`Nhập tên mới cho mẫu này:`, model.name);
  if (newName !== null && newName.trim() !== '') {
    model.name = newName.trim();
    saveData();
    renderAll();
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

  const row = document.getElementById(`variant-${v.id}`);
  if (row) {
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
    if (totalEl) totalEl.innerHTML = `Tổng: <strong>${totalSold}</strong>`;
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
  document.getElementById('input-model-image').value = '';
  document.getElementById('input-model-color').value = '';
  openModal('modal-add-model');
  setTimeout(() => document.getElementById('input-model-name').focus(), 300);
}

function addModel() {
  const nameEl = document.getElementById('input-model-name');
  const colorEl = document.getElementById('input-model-color');
  const imageEl = document.getElementById('input-model-image');

  const name = nameEl.value.trim();
  const color = colorEl.value.trim();

  if (!name) { nameEl.focus(); return; }
  if (!color) { colorEl.focus(); return; }

  const btn = document.querySelector('#modal-add-model .btn-primary');
  if (btn) btn.disabled = true;

  compressImage(imageEl.files[0], (base64Img) => {
    if (btn) btn.disabled = false;
    const model = { id: nextModelId++, name, order: models.length, image: base64Img };
    models.push(model);

    const variant = { id: nextVariantId++, modelId: model.id, color, stock: 0, sold: 0 };
    variants.push(variant);

    saveData();
    renderAll();
    closeModal('modal-add-model');
  });
}

// ===== ADD COLOR =====
function openAddColorModal(modelId) {
  addColorTargetModelId = modelId;
  const model = models.find(m => m.id === modelId);
  document.getElementById('add-color-model-name').textContent = model ? model.name : '';
  document.getElementById('input-color-name').value = '';
  openModal('modal-add-color');
  setTimeout(() => document.getElementById('input-color-name').focus(), 300);
}

function addColor() {
  if (!addColorTargetModelId) return;

  const colorEl = document.getElementById('input-color-name');

  const color = colorEl.value.trim();

  if (!color) { colorEl.focus(); return; }

  const variant = { id: nextVariantId++, modelId: addColorTargetModelId, color, stock: 0, sold: 0 };
  variants.push(variant);

  saveData();
  renderAll();
  closeModal('modal-add-color');
  addColorTargetModelId = null;
}

// ===== RESET =====
function resetAll() {
  if (models.length === 0 && variants.length === 0) {
    alert('Chưa có dữ liệu nào để reset!');
    return;
  }
  if (!confirm('Xác nhận reset toàn bộ số CHỐT ĐƠN (Đã bán) của TẤT CẢ CÁC MẪU về 0?')) return;

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

function editColorName(variantId) {
  const v = variants.find(x => x.id === variantId);
  if (!v) return;
  const newName = prompt(`Nhập màu mới:`, v.color);
  if (newName !== null && newName.trim() !== '') {
    v.color = newName.trim();
    saveData();
    renderAll();
  }
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
document.getElementById('input-model-color').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addModel();
});

document.getElementById('input-color-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addColor();
});

// ===== IMAGE HELPERS =====
function compressImage(file, callback) {
  if (!file) {
    return callback(null);
  }
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 300; // 300px max size for better picture quality
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function updateModelImage(modelId, fileInput) {
  const file = fileInput.files[0];
  if (!file) return;
  compressImage(file, (base64Img) => {
    const model = models.find(m => m.id === modelId);
    if (model) {
      model.image = base64Img;
      saveData();
      renderProducts();
    }
  });
}

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
