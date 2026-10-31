//! Roc Waves — library: Toasts, categorias, drag & drop, ações dos cartões e eliminação com undo.
// Script clássico carregado por ordem no index.html (partilha o âmbito global
// com os outros módulos de js/app/). Ver ordem em index.html.

// Toast Notification Engine
function showToast(msg, icon = '✨', type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100'
    : type === 'warning' ? 'bg-amber-950/95 border-amber-500/50 text-amber-100'
    : 'bg-slate-900/95 border-cyan-500/50 text-slate-100';
  toast.className = `toast-slide p-3.5 rounded-2xl border shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs pointer-events-auto transition-all ${bgClass}`;
  toast.innerHTML = `
    <span class="text-xl flex-shrink-0">${icon}</span>
    <span class="flex-1 font-medium leading-tight">${escapeHtml(msg)}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Category Creation & Management Engine
function renderCategories() {
  const sidebarList = document.getElementById('sidebar-categories-list');
  const carousel = document.getElementById('categories-carousel');
  const all = getAllStations();

  if (sidebarList) {
    sidebarList.innerHTML = userCategories.map(cat => {
      const isSelected = selectedCategory === cat.id;
      const count = cat.id === 'Todas' ? all.length : all.filter(s => s.category === cat.id).length;
      return `
        <button 
          ${uiAction('selectCategory', cat.id)} 
          id="cat-${escapeHtml(cat.id)}" 
          ondragover="handleDragOver(event)" 
          ondragleave="handleDragLeave(event)" 
          data-drop-category="${escapeHtml(cat.id)}" 
          class="cat-btn w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium transition ${isSelected ? 'bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}"
        >
          <span class="flex items-center gap-2 truncate">
            <span>${cat.icon || '📁'}</span> 
            <span class="truncate">${escapeHtml(cat.name)}</span>
          </span>
          <span class="text-[10px] ${isSelected ? 'bg-cyan-500/30 text-cyan-300' : 'bg-slate-800 text-slate-400'} px-2 py-0.5 rounded-full flex-shrink-0">${count}</span>
        </button>
      `;
    }).join('');
  }

  if (carousel) {
    carousel.innerHTML = userCategories.map(cat => {
      const isSelected = selectedCategory === cat.id;
      return `
        <button 
          ${uiAction('selectCategory', cat.id)} 
          id="car-cat-${escapeHtml(cat.id)}" 
          ondragover="handleDragOver(event)" 
          ondragleave="handleDragLeave(event)" 
          data-drop-category="${escapeHtml(cat.id)}" 
          class="cat-pill-btn px-3.5 py-1.5 rounded-xl font-medium border flex-shrink-0 transition flex items-center gap-1.5 ${isSelected ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-md shadow-cyan-500/20' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'}"
        >
          <span>${cat.icon || '📁'}</span>
          <span>${escapeHtml(cat.name)}</span>
        </button>
      `;
    }).join('');
  }
}

function openCreateCategoryModal() {
  document.getElementById('category-create-modal').classList.remove('hidden');
  document.getElementById('cat-create-name').value = '';
}
function closeCreateCategoryModal() {
  document.getElementById('category-create-modal').classList.add('hidden');
}

function selectCategoryEmoji(emoji, btn) {
  document.getElementById('cat-create-icon').value = emoji;
  document.querySelectorAll('#emoji-picker-grid button').forEach(b => {
    b.className = 'emoji-opt-btn p-2 rounded-xl bg-slate-950 hover:bg-cyan-500/20 text-xl border border-slate-800 text-center';
  });
  if (btn) {
    btn.className = 'emoji-opt-btn p-2 rounded-xl bg-slate-950 ring-2 ring-cyan-400 text-xl border border-slate-800 text-center';
  }
}

document.getElementById('category-create-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('cat-create-name').value.trim();
  const icon = document.getElementById('cat-create-icon').value || '🎵';
  if (!name) return;

  const newCat = {
    id: name,
    name: name,
    icon: icon
  };

  if (!userCategories.some(c => c.id.toLowerCase() === name.toLowerCase())) {
    userCategories.push(newCat);
    persist('roc_user_categories', JSON.stringify(userCategories));
    showToast(t('categoryCreated', { name }), icon, 'success');
  }
  closeCreateCategoryModal();
  selectCategory(newCat.id);
});

// Drag & Drop Handlers
function handleDragStart(e, stationId) {
  draggedStationId = String(stationId);
  e.dataTransfer.setData('text/plain', stationId);
  e.dataTransfer.effectAllowed = 'move';
  const card = e.target.closest('.station-card');
  if (card) card.classList.add('card-dragging');
}

function handleDragEnd(e) {
  draggedStationId = null;
  document.querySelectorAll('.station-card').forEach(c => c.classList.remove('card-dragging'));
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const target = e.currentTarget;
  target.classList.add('drag-target-active');
}

function handleDragLeave(e) {
  const target = e.currentTarget;
  target.classList.remove('drag-target-active');
}

function handleDropCategory(e, catId, target = e.currentTarget) {
  e.preventDefault();
  target.classList.remove('drag-target-active');
  const stationId = e.dataTransfer.getData('text/plain') || draggedStationId;
  if (!stationId || catId === 'Todas') return;

  assignCategoryToStation(stationId, catId);
}

// Touch Category Assignment Modal
function openStationCategoryModal(stationId, event) {
  if (event) event.stopPropagation();
  targetStationForCategory = String(stationId);
  const all = getAllStations();
  const station = all.find(s => String(s.id) === targetStationForCategory) || getCurrentStation();

  const infoEl = document.getElementById('station-category-target-info');
  if (infoEl) {
    infoEl.innerHTML = `
      <span class="text-2xl">${station.flag || '📻'}</span>
      <div class="min-w-0 flex-1">
        <h4 class="text-xs font-bold text-white truncate">${escapeHtml(station.name)}</h4>
        <p class="text-[11px] text-slate-400">${t('currentCategory')}: <span class="text-cyan-400 font-semibold">${escapeHtml(station.category || 'Música')}</span></p>
      </div>
    `;
  }

  const listEl = document.getElementById('station-category-options-list');
  if (listEl) {
    listEl.innerHTML = userCategories.filter(c => c.id !== 'Todas').map(cat => `
      <button ${uiAction('assignCategoryToStation', targetStationForCategory, cat.id)} class="w-full p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 flex items-center justify-between text-xs transition">
        <span class="flex items-center gap-2 font-medium text-white"><span>${cat.icon || '📁'}</span> <span>${escapeHtml(cat.name)}</span></span>
        <span class="text-cyan-400 font-bold text-xs">${t('moveTo')}</span>
      </button>
    `).join('');
  }

  document.getElementById('station-category-modal').classList.remove('hidden');
}

function closeStationCategoryModal() {
  document.getElementById('station-category-modal').classList.add('hidden');
  targetStationForCategory = null;
}

function assignCategoryToStation(stationId, catId) {
  const strId = String(stationId);
  stationCategoryOverrides[strId] = catId;
  persist('roc_user_station_cats', JSON.stringify(stationCategoryOverrides));

  // Also update userCustomStations if present
  const custStation = userCustomStations.find(s => String(s.id) === strId);
  if (custStation) {
    custStation.category = catId;
    custStation.genre = catId;
    persist('roc_user_custom_stations', JSON.stringify(userCustomStations));
  }

  // Automatically pin to library
  if (!userLibrary.includes(strId)) {
    userLibrary.push(strId);
    persist('roc_user_library', JSON.stringify(userLibrary));
  }

  const all = getAllStations();
  const station = all.find(s => String(s.id) === strId);
  const catObj = userCategories.find(c => c.id === catId);
  const stName = station ? station.name : 'Rádio';
  const catName = catObj ? catObj.name : catId;
  const catIcon = catObj ? catObj.icon : '🏷️';

  showToast(t('stationAssigned', { station: stName, cat: catName }), catIcon, 'success');

  closeStationCategoryModal();
  saveState();
}

// Mobile Sheet Player & Tools
function handlePlayerClick() {
  if (window.innerWidth < 768) {
    openMobileSheetPlayer();
  } else {
    openTVMode();
  }
}

function openMobileSheetPlayer() {
  const s = getCurrentStation();
  document.getElementById('sheet-station-name').textContent = s.name;
  document.getElementById('sheet-now-playing').textContent = `${s.country || 'Global'} • ${s.genre || s.category}`;
  document.getElementById('sheet-volume-slider').value = volume;
  
  const imgEl = document.getElementById('sheet-cover-img');
  const fallbackEl = document.getElementById('sheet-cover-fallback');
  // Capa via cadeia de logos (image → favicon → homepage → monograma)
  if (imgEl) {
    imgEl.classList.remove('hidden');
    setImgWithLogoChain(imgEl, s);
  }
  if (fallbackEl) fallbackEl.classList.add('hidden');
  document.getElementById('sheet-fav-btn').textContent = userFavorites.includes(String(s.id)) ? '⭐ Favorito' : '☆ Favorito';
  document.getElementById('sheet-lib-btn').textContent = userLibrary.includes(String(s.id)) ? '📌 Na Biblioteca' : '➕ Biblioteca';
  document.getElementById('sheet-play-btn').textContent = isPlaying ? '⏸️' : '▶️';
  document.getElementById('mobile-player-sheet').classList.remove('hidden');
}

function closeMobileSheetPlayer() {
  document.getElementById('mobile-player-sheet').classList.add('hidden');
}

function openMobileToolsDrawer() {
  document.getElementById('mobile-tools-modal').classList.remove('hidden');
}
function closeMobileToolsDrawer() {
  document.getElementById('mobile-tools-modal').classList.add('hidden');
}

// Explicit Card Action Handlers
let lastDeletedStation = null;

function handleCardDeleteClick(stationId, event) {
  if (event) {
    try {
      if (event.stopPropagation) event.stopPropagation();
      if (event.preventDefault) event.preventDefault();
    } catch(e) {}
  }
  deleteStationDirect(stationId);
}

function handleCardCategoryClick(stationId, event) {
  if (event) {
    try {
      if (event.stopPropagation) event.stopPropagation();
      if (event.preventDefault) event.preventDefault();
    } catch(e) {}
  }
  openStationCategoryModal(stationId, event);
}

function handleCardLibraryClick(stationId, event) {
  if (event) {
    try {
      if (event.stopPropagation) event.stopPropagation();
      if (event.preventDefault) event.preventDefault();
    } catch(e) {}
  }
  toggleLibraryInclusion(stationId, event);
}

function handleCardFavClick(stationId, event) {
  if (event) {
    try {
      if (event.stopPropagation) event.stopPropagation();
      if (event.preventDefault) event.preventDefault();
    } catch(e) {}
  }
  toggleFavorite(stationId, event);
}

// Delete / Hide Station Engine (Instant with Undo Toast)
function deleteStationDirect(stationId) {
  const strId = String(stationId || currentStationId);
  const all = getAllStations();
  const station = all.find(s => String(s.id) === strId) || 
                  userCustomStations.find(s => String(s.id) === strId) ||
                  MASTER_CATALOG.find(s => String(s.id) === strId) ||
                  apiSearchResults.find(s => String(s.id) === strId);
  
  const stName = station ? station.name : 'Rádio';
  const wasFav = userFavorites.map(String).includes(strId);
  const wasLib = userLibrary.map(String).includes(strId);
  const wasRec = recentIds.map(String).includes(strId);
  const savedCats = stationCategoryOverrides[strId];
  const customObj = userCustomStations.find(s => String(s.id) === strId);

  // Save for Undo
  lastDeletedStation = {
    id: strId,
    name: stName,
    wasFav,
    wasLib,
    wasRec,
    savedCats,
    customObj: customObj ? JSON.parse(JSON.stringify(customObj)) : null
  };

  // 1. Remove permanently from custom stations if it was custom
  userCustomStations = userCustomStations.filter(s => String(s.id) !== strId);

  // 2. Remove from favorites, library, recents, playlists
  userFavorites = userFavorites.filter(id => String(id) !== strId);
  userLibrary = userLibrary.filter(id => String(id) !== strId);
  recentIds = recentIds.filter(id => String(id) !== strId);
  userPlaylists.forEach(pl => {
    if (pl && pl.stationIds) {
      pl.stationIds = pl.stationIds.filter(id => String(id) !== strId);
    }
  });

  // 3. Remove from search results
  apiSearchResults = apiSearchResults.filter(s => String(s.id) !== strId);

  // 4. Mark as deleted/hidden
  if (!deletedStationIds.map(String).includes(strId)) {
    deletedStationIds.push(strId);
  }
  persist('roc_user_deleted_stations', JSON.stringify(deletedStationIds));

  // 5. Delete category override
  delete stationCategoryOverrides[strId];
  persist('roc_user_station_cats', JSON.stringify(stationCategoryOverrides));

  // 6. Close modals if any
  closeDeleteStationModal();
  closeStationCategoryModal();
  closeMobileSheetPlayer();

  // 7. Save state and re-render grid immediately
  saveState();

  // 8. Show interactive Toast with Undo button!
  showDeleteUndoToast(stName, strId);

  // 9. If deleted station was currently playing, switch to next
  if (String(currentStationId) === strId) {
    const remaining = getAllStations();
    if (remaining.length > 0) {
      selectStation(remaining[0].id, isPlaying);
    } else {
      stopAudio();
    }
  }
}

function showDeleteUndoToast(stationName, stationId) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-slide p-4 rounded-2xl border border-red-500/40 bg-slate-900/98 shadow-2xl backdrop-blur-lg flex items-center justify-between gap-3 text-xs pointer-events-auto transition-all text-white z-[99999]';
  toast.innerHTML = `
    <div class="flex items-center gap-2.5 min-w-0 flex-1">
      <span class="text-xl flex-shrink-0">🗑️</span>
      <span class="font-bold truncate text-slate-200">${t('stationDeleted', { name: `<span class="text-white font-extrabold">"${escapeHtml(stationName)}"</span>` })}</span>
    </div>
    <button onclick="undoLastDelete(this)" class="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition active:scale-95 flex-shrink-0 shadow-md shadow-cyan-500/20">
      ↩️ ${t('undo')}
    </button>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    if (toast && toast.parentElement) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}

function undoLastDelete(btnEl) {
  if (!lastDeletedStation) return;
  const d = lastDeletedStation;

  // 1. Remove from deletedStationIds
  deletedStationIds = deletedStationIds.filter(id => String(id) !== String(d.id));
  persist('roc_user_deleted_stations', JSON.stringify(deletedStationIds));

  // 2. Restore custom station if it was custom
  if (d.customObj && !userCustomStations.some(s => String(s.id) === String(d.id))) {
    userCustomStations.push(d.customObj);
  }

  // 3. Restore favorites, library, recents
  if (d.wasFav && !userFavorites.includes(d.id)) userFavorites.push(d.id);
  if (d.wasLib && !userLibrary.includes(d.id)) userLibrary.push(d.id);
  if (d.wasRec && !recentIds.includes(d.id)) recentIds.unshift(d.id);
  if (d.savedCats) stationCategoryOverrides[d.id] = d.savedCats;

  lastDeletedStation = null;
  saveState();

  if (btnEl && btnEl.closest('.toast-slide')) {
    btnEl.closest('.toast-slide').remove();
  }

  showToast(t('stationRestored', { name: d.name }), '🔄', 'success');
}

function openDeleteStationModal(stationId, event) {
  if (event) {
    try {
      if (event.stopPropagation) event.stopPropagation();
      if (event.preventDefault) event.preventDefault();
    } catch(e) {}
  }
  deleteStationDirect(stationId);
}

function closeDeleteStationModal() {
  const modal = document.getElementById('delete-confirm-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
  stationToDeleteId = null;
}

function confirmDeleteStation() {
  if (!stationToDeleteId) return;
  deleteStationDirect(stationToDeleteId);
}

function restoreAllDeletedStations() {
  if (!deletedStationIds || deletedStationIds.length === 0) {
    showToast(t('nothingToRestore'), 'ℹ️', 'info');
    return;
  }
  const count = deletedStationIds.length;
  deletedStationIds = [];
  persist('roc_user_deleted_stations', JSON.stringify([]));
  saveState();
  showToast(t('stationsRestored', { count }), '🔄', 'success');
  closeBackupModal();
}

// View Explainer Banner Helper
function updateExplainerBanner(icon, title, desc) {
  const iconEl = document.getElementById('explainer-icon');
  const titleEl = document.getElementById('explainer-title');
  const descEl = document.getElementById('explainer-desc');
  if (iconEl) iconEl.textContent = icon;
  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = desc;
}
