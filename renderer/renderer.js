(function () {
  const MODS_FOLDER_NAME = '~mods';
  const MODS_PATH_SUFFIX = 'PAYDAY3/PAYDAY3/Content/Paks/~mods';
  const SORT_KEYS = ['date_newest', 'date_oldest', 'name_az', 'name_za'];
  const DISCORD_CLIENT_ID = '1475764843851026568';
  const RPC_UPDATE_COOLDOWN_MS = 5000;
  const PRESENCE_POLL_MS = 4000;

  let appDataPath = '';
  let modsDir = '';
  let sortKey = 'date_newest';
  let themeName = 'dark';
  let discordEnabled = true;
  let discordPresencePaused = false;
  let discordStartTime = Math.floor(Date.now() / 1000);
  let lastRpcUpdate = 0;
  let discordAvailable = false;
  let recycleOnDelete = true;
  let currentPage = 'home';
  let zeroPressCount = 0;
  let zeroPressTimer = null;

  const WELCOME_MESSAGES = [
    "Welcome back, heister!",
    "Time to add some mods!",
    "The vault is open. Bag the mods!",
    "Another day, another shitty mod.",
    "Let's get this bread... and these mods.",
    "Modding PAYDAY 3, one pak at a time.",
    "The thermal drill is ready. So are your mods.",
    "The mod. Go get it.",
    "Bain would be proud of your mods (I'm lying).",
    "Clover says: GOBSHITE DAT SHOORE IS A MOD OI ",
    "Dallas approves your mod choices.",
    "Hoxton said OI HOOSTON MODS HOOSTON ADD MODS OI",
    "Chains is in a pickle... about which mods to enable.",
    "Do you know what time it is? It's modding time!",
    "Joy would be ashamed if she saw your mods... Disgusting...",
    "Pearl would want you to disable that one 'Joy mod'.",
    "I wonder if there's a Jenny mod for this game...",
    "Shade's watching. Make your mods count.",
    "I think you should add that one mod.",
    "Chicken burr.",
    "AHHHHHH- I NEED A MOD!!!!",
    "They should add Gumi Techies... (Gumi from Vocaloid I think)",
    "Draw Titties and make a mod",
    "Thrill OFF robbing a bank.",
    "YOU WOULDN'T DOWNLOAD A CAT! BUT you would download mods... Hypocracy at its finest.",
    "glamptastic!",
    "Jarvis. Download PAYDAY 3 hacks.",
    "Dude no way is that Triple Drones? As in Triple Baka? Miku, Teto and the Yellow one??? No way.",
    "Removing the weight of bullets, one sec...",
    "Removed Offline Mode, added Big Oil 2",
    "They're adding P2P as in Pay 2 Play or Pier 2 Pier... Only time will tell.",
    "img:assets/welcome_cat.png",
    "img:assets/welcome_pd3.png",
    "img:assets/welcome_coolcat.png",
    "img:assets/welcome_bank.png",
    "img:assets/welcome_kojima.png",
    "img:assets/welcome_teto.png",
    "img:assets/welcome_67cat.png",
    "img:assets/welcome_pakmod.png",
    "img:assets/welcome_thundercat.png",
    "img:assets/welcome_statement.png",
    "We're going to the bank, not telling you which one"
  ];

  const $ = (id) => document.getElementById(id);
  const pathInput = $('mods-dir');
  const modListEl = $('mod-list');
  const modSearch = $('mod-search');
  const filterWrap = $('filter-wrap');
  const filterTrigger = $('filter-trigger');
  const filterMenu = $('filter-menu');
  const filterLabel = $('filter-trigger-label');
  let filterOpen = false;
  const themeToggle = $('theme-toggle');
  const discordToggle = $('discord-toggle');
  const discordDescBtn = $('rail-discord-desc');
  const dropZone = $('drop-zone');
  const dropOverlay = $('drop-overlay');
  function showModal(modalEl) {
    if (!modalEl) return;
    modalEl.hidden = false;
    requestAnimationFrame(() => { modalEl.classList.add('modal-open'); });
  }
  function closeModal(modalEl, onDone) {
    if (!modalEl) return;
    modalEl.classList.remove('modal-open');
    const done = () => {
      modalEl.hidden = true;
      if (onDone) onDone();
    };
    modalEl.addEventListener('transitionend', (e) => {
      if (e.target === modalEl) done();
    }, { once: true });
  }

  function installModalBackdropClose(modalEl, onBackdrop) {
    if (!modalEl || typeof onBackdrop !== 'function') return;
    modalEl.addEventListener('click', (e) => {
      if (e.target !== modalEl) return;
      onBackdrop();
    });
  }

  function modsDirDisplayPath(dir) {
    if (!dir) return '';
    const norm = dir.replace(/\\/g, '/');
    if (norm.endsWith(MODS_FOLDER_NAME)) {
      if (norm.includes('Content') && norm.includes('Paks')) return MODS_PATH_SUFFIX;
      return MODS_FOLDER_NAME;
    }
    return dir;
  }

  async function loadConfig(name, defaultValue) {
    const p = await window.api.getConfigPath(name);
    const raw = await window.api.readFile(p);
    if (raw === null) return defaultValue;
    return raw.trim();
  }

  async function saveConfig(name, value) {
    const p = await window.api.getConfigPath(name);
    await window.api.writeFile(p, value);
  }

  async function initConfig() {
    try {
      appDataPath = await window.api.getAppDataPath();
      const savedDir = await loadConfig('mods_dir.txt', '');
      if (savedDir) {
        modsDir = savedDir;
        pathInput.value = modsDirDisplayPath(modsDir);
      }
      const theme = await loadConfig('theme.txt', 'dark');
      if (theme === 'light' || theme === 'dark') {
        themeName = theme;
        document.body.className = 'theme-' + themeName;
        themeToggle.textContent = themeName === 'dark' ? 'Theme: Dark' : 'Theme: Light';
      }
      const sortRaw = await loadConfig('sort.txt', '');
      const firstLine = sortRaw.split('\n')[0].trim();
      if (SORT_KEYS.includes(firstLine)) sortKey = firstLine;
      const discordPref = await loadConfig('discord_presence_enabled.txt', '1');
      discordEnabled = !['0', 'false', 'off', 'no'].includes(discordPref.toLowerCase());
      const recyclePref = await loadConfig('recycle_on_delete.txt', '1');
      recycleOnDelete = !['0', 'false', 'off', 'no'].includes(recyclePref.toLowerCase());
      updateSortButtons();
      updateDiscordToggleLabel();
      updateRecycleToggleLabel();
      await setupTitlebarIcon();
      updateMaximizeButton();
      refreshList();
      startDiscordPresence();
      refreshWelcomeMessage();
      await applyHomeVersion();
    } catch (err) {
      console.error('initConfig error:', err);
    }
    checkJumpscareChance();
    await maybeStartupUpdateCheck();
  }

  async function setupTitlebarIcon() {
    try {
      if (!window.api.getTitlebarIconDataUrl) return;
      const url = await window.api.getTitlebarIconDataUrl();
      const img = $('titlebar-icon');
      if (url && img) {
        img.src = url;
        img.hidden = false;
      }
    } catch (_) {}
  }

  function updateMaximizeButton() {
    if (!window.api.windowIsMaximized) return;
    window.api.windowIsMaximized().then((max) => {
      const b = $('win-maximize');
      if (!b) return;
      const maxG = b.querySelector('.win-icon-maximize');
      const restG = b.querySelector('.win-icon-restore');
      if (maxG) maxG.style.display = max ? 'none' : '';
      if (restG) restG.style.display = max ? '' : 'none';
      b.setAttribute('aria-label', max ? 'Restore down' : 'Maximize');
    }).catch(() => {});
  }

  function updateRecycleToggleLabel() {
    const el = $('recycle-toggle');
    if (el) el.textContent = 'Move deleted mods to recycle: ' + (recycleOnDelete ? 'On' : 'Off');
  }

  async function saveModsDir() {
    if (!modsDir) return;
    await saveConfig('mods_dir.txt', modsDir);
  }

  function updateSortButtons() {
    document.querySelectorAll('.sort-btn').forEach((btn) => {
      const asc = btn.dataset.asc;
      const desc = btn.dataset.desc;
      const active = sortKey === asc || sortKey === desc;
      btn.classList.toggle('active', active);
      const arrow = btn.querySelector('.sort-arrow');
      if (active) arrow.textContent = sortKey === asc ? '\u25b2' : '\u25bc';
      else arrow.textContent = '';
    });
  }

  function getSortKeyForClick(kind, currentKey) {
    const btn = document.querySelector(`.sort-btn[data-kind="${kind}"]`);
    if (!btn) return currentKey;
    const asc = btn.dataset.asc;
    const desc = btn.dataset.desc;
    if (currentKey === asc) return desc;
    if (currentKey === desc) return asc;
    return asc;
  }

  const DISABLED_SUFFIX = '.disabled';

  function displayModName(filename) {
    if (!filename || !filename.endsWith(DISABLED_SUFFIX)) return filename;
    return filename.slice(0, -DISABLED_SUFFIX.length);
  }

  function formatStorageBytes(bytes) {
    const n = typeof bytes === 'number' && isFinite(bytes) ? Math.max(0, Math.floor(bytes)) : 0;
    if (n < 1024) return n + ' B';
    const kb = n / 1024;
    if (kb < 1024) return kb.toFixed(kb < 10 ? 1 : 0) + ' KB';
    const mb = kb / 1024;
    if (mb < 1024) return mb.toFixed(1) + ' MB';
    return (mb / 1024).toFixed(2) + ' GB';
  }

  let toastHideTimer = null;
  let toastHideAfterFadeTimer = null;

  function buildModBannerMessage(results) {
    if (!results.length) return '';
    const dq = '\u201c';
    const dqc = '\u201d';
    if (results.length === 1) {
      const r = results[0];
      const verb = r.wasReplace ? 'updated' : 'added';
      return dq + displayModName(r.modName) + dqc + ' has been ' + verb + '.';
    }
    const allUpdated = results.every((x) => x.wasReplace);
    const allAdded = results.every((x) => !x.wasReplace);
    if (allUpdated) return String(results.length) + ' mods have been updated.';
    if (allAdded) return String(results.length) + ' mods have been added.';
    return String(results.length) + ' mods have been added or updated.';
  }

  function showModBanner(message) {
    const el = $('toast-banner');
    const msgEl = $('toast-banner-msg');
    if (!el || !message) return;
    if (msgEl) msgEl.textContent = message;
    else el.textContent = message;
    el.hidden = false;
    clearTimeout(toastHideTimer);
    clearTimeout(toastHideAfterFadeTimer);
    el.classList.remove('is-visible');
    void el.offsetWidth;
    el.classList.add('is-visible');
    toastHideTimer = setTimeout(() => {
      el.classList.remove('is-visible');
      toastHideAfterFadeTimer = setTimeout(() => {
        el.hidden = true;
      }, 900);
    }, 3200);
  }

  function applyModFilters() {
    if (!modListEl) return;
    const q = modSearch ? modSearch.value.trim().toLowerCase() : '';
    const filter = filterWrap ? (filterWrap.dataset.filter || 'all') : 'all';
    modListEl.querySelectorAll('.mod-row').forEach((row) => {
      const fn = (row.dataset.filename || '').toLowerCase();
      const displayBase = fn.endsWith(DISABLED_SUFFIX) ? fn.slice(0, -DISABLED_SUFFIX.length) : fn;
      const matchesSearch = !q || fn.includes(q) || displayBase.includes(q);
      const isEnabled = row.dataset.enabled === 'true';
      const matchesFilter = filter === 'all' || (filter === 'enabled' && isEnabled) || (filter === 'disabled' && !isEnabled);
      row.style.display = matchesSearch && matchesFilter ? '' : 'none';
    });
  }

  function closeFilterMenu() {
    filterOpen = false;
    if (filterMenu) filterMenu.hidden = true;
    if (filterTrigger) filterTrigger.setAttribute('aria-expanded', 'false');
  }

  const FILTER_LABELS = { all: 'All', enabled: 'Enabled', disabled: 'Disabled' };

  function applyFilterChoice(value) {
    if (!filterWrap) return;
    filterWrap.dataset.filter = value;
    if (filterLabel) filterLabel.textContent = FILTER_LABELS[value] || value;
    document.querySelectorAll('.filter-item').forEach((btn) => {
      btn.classList.toggle('filter-item-active', btn.dataset.value === value);
    });
    closeFilterMenu();
    applyModFilters();
  }

  function initFilterDropdown() {
    if (!filterTrigger || !filterMenu || !filterWrap) return;
    const current = filterWrap.dataset.filter || 'all';
    if (filterLabel) filterLabel.textContent = FILTER_LABELS[current] || current;
    document.querySelectorAll('.filter-item').forEach((btn) => {
      btn.classList.toggle('filter-item-active', btn.dataset.value === current);
    });
    filterTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      filterOpen = !filterOpen;
      filterMenu.hidden = !filterOpen;
      filterTrigger.setAttribute('aria-expanded', filterOpen ? 'true' : 'false');
    });
    filterMenu.querySelectorAll('.filter-item').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyFilterChoice(btn.dataset.value);
      });
    });
  }

  function refreshWelcomeMessage() {
    const homeMsg = $('home-message');
    if (!homeMsg) return;
    const msg = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
    if (msg.startsWith('img:')) {
      const img = document.createElement('img');
      img.src = msg.slice(4);
      img.className = 'home-welcome-img';
      img.draggable = false;
      homeMsg.textContent = '';
      homeMsg.appendChild(img);
    } else {
      homeMsg.textContent = msg;
    }
  }

  function scheduleHomeVersionAnim(show) {
    const wrap = $('home-version-wrap');
    if (!wrap) return;
    wrap.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (show) {
      wrap.classList.remove('home-version--visible');
      void wrap.offsetWidth;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => wrap.classList.add('home-version--visible'));
      });
    } else {
      wrap.classList.remove('home-version--visible');
    }
  }

  async function applyHomeVersion() {
    const val = $('home-version-value');
    if (!val || !window.api.getAppVersion) return;
    try {
      val.textContent = await window.api.getAppVersion();
    } catch (_) {
      val.textContent = '\u2014';
    }
    if (currentPage === 'home') {
      scheduleHomeVersionAnim(true);
    }
  }

  function showPage(page) {
    if (page === currentPage) return;
    const homeEl = $('page-home');
    const modsEl = $('page-mods');
    const settingsEl = $('page-settings');
    const navHome = $('nav-home');
    const navMods = $('nav-mods');
    const navSettings = $('nav-settings');

    const map = { home: homeEl, mods: modsEl, settings: settingsEl };
    const outgoing = map[currentPage];
    const incoming = map[page];
    if (!incoming || !outgoing) return;

    outgoing.classList.add('hidden');
    incoming.classList.remove('hidden');
    incoming.classList.add('page-enter');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        incoming.classList.remove('page-enter');
      });
    });

    if (navHome) navHome.classList.toggle('is-active', page === 'home');
    if (navMods) navMods.classList.toggle('is-active', page === 'mods');
    if (navSettings) navSettings.classList.toggle('is-active', page === 'settings');
    currentPage = page;
    if (page === 'home') {
      scheduleHomeVersionAnim(true);
    } else {
      const homeWrap = $('home-version-wrap');
      if (homeWrap) {
        homeWrap.classList.remove('home-version--visible');
        homeWrap.setAttribute('aria-hidden', 'true');
      }
    }
  }

  let jumpscareActive = false;
  let jumpscareAbort = null;

  function closeJumpscare(forceStopAudio) {
    const overlay = $('jumpscare-overlay');
    if (!overlay || overlay.hidden) return;
    if (jumpscareAbort) { jumpscareAbort(); jumpscareAbort = null; }
    overlay.classList.remove('scare-visible');
    const audio = $('jumpscare-audio');
    if (forceStopAudio && audio) { audio.pause(); audio.currentTime = 0; }
    setTimeout(() => {
      overlay.hidden = true;
      const canvas = $('jumpscare-canvas');
      if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
      jumpscareActive = false;
    }, 520);
  }

  async function renderGifOnce(canvas, url) {
    const resp = await fetch(url);
    const buffer = await resp.arrayBuffer();
    const decoder = new ImageDecoder({ data: buffer, type: 'image/gif' });
    await decoder.tracks.ready;
    const track = decoder.tracks.selectedTrack;
    const ctx = canvas.getContext('2d');
    let aborted = false;
    jumpscareAbort = () => { aborted = true; };

    for (let i = 0; i < track.frameCount; i++) {
      if (aborted) break;
      const { image } = await decoder.decode({ frameIndex: i });
      if (i === 0) {
        canvas.width = image.displayWidth;
        canvas.height = image.displayHeight;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      const delayMs = Math.max(Math.round(image.duration / 1000), 16);
      image.close();
      if (i < track.frameCount - 1 && !aborted) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
    decoder.close();
    jumpscareAbort = null;
    return !aborted;
  }

  async function playJumpscare() {
    if (jumpscareActive) return;
    jumpscareActive = true;
    const overlay = $('jumpscare-overlay');
    const canvas = $('jumpscare-canvas');
    if (!overlay || !canvas) { jumpscareActive = false; return; }

    overlay.hidden = false;
    requestAnimationFrame(() => { overlay.classList.add('scare-visible'); });

    const audio = $('jumpscare-audio');
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }

    const finished = await renderGifOnce(canvas, 'assets/foxy_jumpscare.gif');
    if (finished) {
      if (audio && !audio.paused) {
        await new Promise(r => { audio.addEventListener('ended', r, { once: true }); });
      }
      closeJumpscare(false);
    }
  }

  function checkJumpscareChance() {
    if (Math.random() < 0.01) {
      setTimeout(playJumpscare, 800);
    }
  }

  async function refreshList() {
    if (!modsDir) { modListEl.innerHTML = ''; return; }
    let mods = await window.api.listMods(modsDir);
    mods = await window.api.sortMods(modsDir, mods, sortKey);
    const frag = document.createDocumentFragment();
    await Promise.all(mods.map(async ([filename, enabled], i) => {
      const index = i + 1;
      const row = document.createElement('div');
      row.className = 'mod-row';
      row.dataset.filename = filename;
      row.dataset.enabled = String(enabled);
      row.dataset.index = String(index);

      const idxSpan = document.createElement('span');
      idxSpan.className = 'mod-idx';
      idxSpan.textContent = String(index);

      const labelBlock = document.createElement('div');
      labelBlock.className = 'mod-label-block';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'mod-name' + (enabled ? '' : ' disabled');
      nameSpan.textContent = displayModName(filename);

      const toggleWrap = document.createElement('div');
      toggleWrap.className = 'toggle-wrap' + (enabled ? ' on' : '');
      toggleWrap.dataset.filename = filename;
      toggleWrap.dataset.enabled = String(enabled);
      toggleWrap.innerHTML = '<div class="toggle-track"></div><div class="toggle-thumb"></div>';
      toggleWrap.title = 'Enable or disable mod';
      toggleWrap.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMod(toggleWrap, nameSpan, row);
      });

      const metaCol = document.createElement('div');
      metaCol.className = 'mod-meta-col';

      const tagDate = document.createElement('span');
      tagDate.className = 'meta-tag';
      tagDate.textContent = await getBestModDateDisplay(filename);

      const tagState = document.createElement('span');
      tagState.className = 'meta-tag meta-state ' + (enabled ? 'state-on' : 'state-off');
      tagState.textContent = enabled ? 'ENABLED' : 'DISABLED';

      metaCol.appendChild(tagState);
      metaCol.appendChild(tagDate);

      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'mod-actions';
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-remove';
      removeBtn.textContent = 'X';
      removeBtn.title = 'Remove';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmRemove(row.dataset.filename);
      });
      actionsWrap.appendChild(removeBtn);

      labelBlock.appendChild(nameSpan);

      row.appendChild(idxSpan);
      row.appendChild(toggleWrap);
      row.appendChild(labelBlock);
      row.appendChild(metaCol);
      row.appendChild(actionsWrap);
      frag.appendChild(row);
    }));
    const sorted = Array.from(frag.children).sort((a, b) => a.dataset.index - b.dataset.index);
    modListEl.innerHTML = '';
    sorted.forEach(r => modListEl.appendChild(r));
    applyModFilters();
  }

  async function toggleMod(toggleWrap, nameSpan, rowEl) {
    if (!modsDir || !toggleWrap) return;
    if (toggleWrap.dataset.busy === 'true') return;
    toggleWrap.dataset.busy = 'true';
    const row = rowEl || toggleWrap.closest('.mod-row');
    try {
      const filename = toggleWrap.dataset.filename;
      const currentEnabled = toggleWrap.dataset.enabled === 'true';
      const newEnabled = !currentEnabled;
      const newFilename = newEnabled
        ? (filename.endsWith(DISABLED_SUFFIX) ? filename.slice(0, -DISABLED_SUFFIX.length) : filename)
        : filename + DISABLED_SUFFIX;
      toggleWrap.classList.toggle('on', newEnabled);
      nameSpan.classList.toggle('disabled', !newEnabled);
      nameSpan.textContent = displayModName(newFilename);
      toggleWrap.dataset.filename = newFilename;
      toggleWrap.dataset.enabled = String(newEnabled);
      if (row) {
        row.dataset.filename = newFilename;
        row.dataset.enabled = String(newEnabled);
      }
      const tagState = row ? row.querySelector('.meta-state') : null;
      if (tagState) {
        tagState.textContent = newEnabled ? 'ENABLED' : 'DISABLED';
        tagState.classList.toggle('state-on', newEnabled);
        tagState.classList.toggle('state-off', !newEnabled);
      }
      const ok = await window.api.setEnabled(modsDir, filename, newEnabled);
      if (!ok) {
        await refreshList();
        return;
      }
      notifyDiscordUpdate();
    } finally {
      toggleWrap.dataset.busy = 'false';
    }
  }

  function confirmRemove(filename) {
    const modal = $('modal-delete');
    const label = displayModName(filename);
    $('delete-message').textContent = `Are you sure you want to remove "${label}"?`;
    const cleanupBackdrop = () => modal.removeEventListener('click', onBackdrop);
    const onCancel = () => {
      cleanupBackdrop();
      closeModal(modal);
    };
    function onBackdrop(e) {
      if (e.target !== modal) return;
      onCancel();
    }
    modal.addEventListener('click', onBackdrop);
    showModal(modal);
    const onConfirm = async () => {
      cleanupBackdrop();
      closeModal(modal, async () => {
        const ok = await window.api.removeMod(modsDir, filename, recycleOnDelete);
        if (ok) {
          const dq = '\u201c';
          const dqc = '\u201d';
          const name = displayModName(filename);
          showModBanner(
            recycleOnDelete
              ? dq + name + dqc + ' has been moved to recycle.'
              : dq + name + dqc + ' has been deleted.'
          );
          refreshList();
          notifyDiscordUpdate();
        } else {
          showAlert('Error', `Could not remove "${displayModName(filename)}".`);
        }
      });
    };
    $('delete-confirm').addEventListener('click', onConfirm, { once: true });
    $('delete-cancel').addEventListener('click', onCancel, { once: true });
  }

  function showAlert(title, message) {
    const modal = $('modal-alert');
    $('alert-title').textContent = title;
    $('alert-message').textContent = message;
    const cleanupBackdrop = () => modal.removeEventListener('click', onBackdrop);
    const dismiss = () => {
      cleanupBackdrop();
      closeModal(modal);
    };
    function onBackdrop(e) {
      if (e.target !== modal) return;
      dismiss();
    }
    modal.addEventListener('click', onBackdrop);
    showModal(modal);
    $('alert-ok').onclick = () => dismiss();
  }

  async function maybeStartupUpdateCheck() {
    if (!window.api.checkForUpdates) return;
    try {
      const r = await window.api.checkForUpdates();
      if (!r || !r.ok || !r.updateAvailable) return;
      const ver = r.version ? String(r.version) : '';
      const msgEl = $('update-available-message');
      const modal = $('modal-update-available');
      if (!msgEl || !modal) return;
      msgEl.textContent = ver
        ? 'Version ' + ver + ' is available. Download now?'
        : 'A new version is available. Download now?';
      showModal(modal);
    } catch (_) {}
  }

  async function browseModsDir() {
    const choice = await showBrowseChoice();
    if (!choice) return;
    if (choice === 'game') {
      const path = await window.api.showFolderDialog('Select PAYDAY 3 game directory (root folder)');
      if (!path) return;
      modsDir = await window.api.ensureModsDir(path);
    } else {
      const path = await window.api.showFolderDialog('Select ~mods folder');
      if (!path) return;
      const base = path.replace(/\\/g, '/');
      if (base.endsWith(MODS_FOLDER_NAME) || base.split('/').pop() === MODS_FOLDER_NAME) {
        modsDir = path;
      } else {
        showAlert('Invalid folder', 'Please select the folder named ~mods.\n\nIt is usually at: PAYDAY3/PAYDAY3/Content/Paks/~mods');
        return;
      }
    }
    pathInput.value = modsDirDisplayPath(modsDir);
    await saveModsDir();
    refreshList();
    notifyDiscordUpdate();
  }

  function showBrowseChoice() {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.id = 'modal-browse-choice';
      modal.innerHTML = `
        <div class="modal-card">
          <h3>Select where mods are stored</h3>
          <p class="modal-hint">Either the game directory (PAYDAY 3 root) or the ~mods folder directly.</p>
          <div class="modal-buttons" style="margin-top:16px">
            <button type="button" class="btn" id="browse-game">Select game directory</button>
            <button type="button" class="btn" id="browse-mods">Select ~mods folder</button>
            <button type="button" class="btn" id="browse-cancel">Cancel</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      let settled = false;
      const close = (value) => {
        if (settled) return;
        settled = true;
        modal.removeEventListener('click', onBackdrop);
        modal.classList.remove('modal-open');
        modal.addEventListener('transitionend', (e) => {
          if (e.target === modal) { modal.remove(); resolve(value); }
        }, { once: true });
      };
      function onBackdrop(e) {
        if (e.target === modal) close(null);
      }
      modal.addEventListener('click', onBackdrop);
      requestAnimationFrame(() => modal.classList.add('modal-open'));
      modal.querySelector('#browse-game').onclick = () => close('game');
      modal.querySelector('#browse-mods').onclick = () => close('mods');
      modal.querySelector('#browse-cancel').onclick = () => close(null);
    });
  }

  async function addPakOrArchive() {
    if (!modsDir) {
      showAlert('No directory', 'Set the mods directory first.');
      return;
    }
    const paths = await window.api.showOpenDialog({
      title: 'Select .pak or archive',
      properties: ['openFile'],
      filters: [
        { name: 'Pak and archives', extensions: ['pak', 'zip', '7z', 'rar'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    if (paths && paths.length) await processFiles(paths);
  }

  async function getModDateDisplay(modsDir, filename) {
    const stored = await window.api.getModDate(modsDir, filename);
    if (stored) {
      try {
        const d = new Date(stored.replace('Z', '+00:00'));
        return d.toISOString().slice(0, 16).replace('T', ' ');
      } catch (_) {}
    }
    try {
      const mtime = await window.api.getModMtime(modsDir, filename);
      if (mtime) {
        const d = new Date(mtime);
        return d.toISOString().slice(0, 16).replace('T', ' ');
      }
    } catch (_) {}
    return 'unknown';
  }

  async function getBestModDateDisplay(filename) {
    let date = await getModDateDisplay(modsDir, filename);
    if (date !== 'unknown') return date;
    const alt = filename.endsWith(DISABLED_SUFFIX)
      ? filename.slice(0, -DISABLED_SUFFIX.length)
      : filename + DISABLED_SUFFIX;
    date = await getModDateDisplay(modsDir, alt);
    return date;
  }

  async function addSinglePak(srcPath, sourceLabel) {
    const base = srcPath.split(/[/\\]/).pop();
    if (!base.toLowerCase().endsWith('.pak')) return { success: false };
    let wasReplace = false;
    const destExists = await window.api.modExistsAnyVariant(modsDir, base);
    if (destExists) {
      const existingDate = await getBestModDateDisplay(base);
      const choice = await showDuplicateDialog(base, existingDate, sourceLabel);
      if (choice !== 'replace') return { success: false };
      wasReplace = true;
      const disabledVariant = base + DISABLED_SUFFIX;
      await window.api.removeMod(modsDir, base, true);
      await window.api.removeMod(modsDir, disabledVariant, true);
    }
    const ok = await window.api.copyPakToMods(srcPath, modsDir);
    if (ok) {
      await window.api.setModDate(modsDir, base, new Date().toISOString());
      return { success: true, wasReplace, modName: base };
    }
    return { success: false };
  }

  function showDuplicateDialog(modName, existingDateDisplay, newSourceLabel) {
    return new Promise((resolve) => {
      const modal = $('modal-duplicate');
      $('dup-filename').textContent = displayModName(modName);
      $('dup-existing-date').textContent = 'added ' + existingDateDisplay;
      $('dup-new-label').textContent = newSourceLabel + ' (added now)';
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        modal.removeEventListener('click', onBackdrop);
        closeModal(modal, () => resolve(v));
      };
      function onBackdrop(e) {
        if (e.target === modal) finish('cancel');
      }
      modal.addEventListener('click', onBackdrop);
      showModal(modal);
      $('dup-keep').onclick = () => finish('keep');
      $('dup-replace').onclick = () => finish('replace');
      $('dup-cancel').onclick = () => finish('cancel');
    });
  }

  async function processFiles(paths) {
    if (!modsDir) {
      showAlert('No directory', 'Set the mods directory first.');
      return;
    }
    if (currentPage !== 'mods') showPage('mods');
    const exts = ['.pak', '.zip', '.7z', '.rar'];
    const bannerResults = [];
    for (const rawPath of paths) {
      let filePath = rawPath.trim().replace(/^["']|["']$/g, '');
      if (filePath.toLowerCase().startsWith('file://')) filePath = filePath.replace(/^file:\/\/\//i, '').replace(/\//g, '\\');
      const exists = await window.api.fileExists(filePath);
      if (!exists) continue;
      const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
      if (!exts.includes(ext)) continue;
      if (ext === '.pak') {
        const r = await addSinglePak(filePath, filePath);
        if (r.success) bannerResults.push(r);
        continue;
      }
      const paks = await window.api.extractArchive(filePath);
      if (!paks || paks.length === 0) {
        showAlert('No .pak in archive', 'No .pak files found in:\n' + filePath);
        continue;
      }
      if (paks.length === 1) {
        const r = await addSinglePak(paks[0], 'from archive: ' + filePath.split(/[/\\]/).pop());
        if (r.success) bannerResults.push(r);
      } else {
        const selected = await showPakSelectDialog(paks);
        if (selected && selected.length) {
          for (const p of selected) {
            const r = await addSinglePak(p, 'from archive: ' + filePath.split(/[/\\]/).pop());
            if (r.success) bannerResults.push(r);
          }
        }
      }
    }
    if (bannerResults.length) {
      showModBanner(buildModBannerMessage(bannerResults));
      refreshList();
      notifyDiscordUpdate();
    }
  }

  function showPakSelectDialog(pakPaths) {
    return new Promise((resolve) => {
      const modal = $('modal-pak-select');
      const select = $('pak-select-list');
      select.innerHTML = '';
      pakPaths.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p.split(/[/\\]/).pop();
        select.appendChild(opt);
      });
      if (select.options.length) select.options[0].selected = true;
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        modal.removeEventListener('click', onBackdrop);
        closeModal(modal, () => resolve(v));
      };
      function onBackdrop(e) {
        if (e.target === modal) finish(null);
      }
      modal.addEventListener('click', onBackdrop);
      showModal(modal);
      $('pak-add-selected').onclick = () => {
        const selected = Array.from(select.selectedOptions).map((o) => o.value);
        finish(selected);
      };
      $('pak-cancel').onclick = () => finish(null);
    });
  }

  async function launchGame() {
    discordPresencePaused = true;
    updateDiscordToggleLabel();
    notifyDiscordUpdate();
    try {
      await window.api.launchGame();
    } catch (_) {
      discordPresencePaused = false;
      updateDiscordToggleLabel();
      notifyDiscordUpdate();
      showAlert('Error', 'Could not launch Steam. Is Steam installed?');
    }
  }

  function updateDiscordToggleLabel() {
    let text = 'Discord Rich Presence: ';
    if (!discordAvailable) {
      discordToggle.textContent = text + 'Unavailable (click to retry)';
      return;
    }
    if (!discordEnabled) text += 'Off';
    else if (discordPresencePaused) text += 'Auto-paused';
    else text += 'On';
    discordToggle.textContent = text;
  }

  let discordInterval = null;
  let discordConnecting = false;
  async function startDiscordPresence() {
    if (discordConnecting) return;
    discordConnecting = true;
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        discordAvailable = Boolean(await window.api.discordInit(DISCORD_CLIENT_ID));
      } catch (_) {}
      if (discordAvailable) break;
      if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, 2000));
    }
    discordConnecting = false;
    updateDiscordToggleLabel();
    if (!discordAvailable) return;
    if (discordInterval) clearInterval(discordInterval);
    discordInterval = setInterval(updatePresence, PRESENCE_POLL_MS);
    updatePresence();
  }

  function notifyDiscordUpdate() {
    if (!discordAvailable) return;
    lastRpcUpdate = 0;
    updatePresence();
  }

  async function updatePresence() {
    if (!discordAvailable) return;
    const gameRunning = await window.api.isPayday3Running();
    if (gameRunning) {
      discordPresencePaused = true;
      updateDiscordToggleLabel();
      await window.api.discordClear();
      return;
    }
    discordPresencePaused = false;
    updateDiscordToggleLabel();
    if (!discordEnabled || discordPresencePaused) {
      await window.api.discordClear();
      return;
    }
    const now = Date.now();
    if (lastRpcUpdate > 0 && now - lastRpcUpdate < RPC_UPDATE_COOLDOWN_MS) return;
    const toggles = modListEl.querySelectorAll('.toggle-wrap');
    const total = toggles.length;
    let enabled = 0;
    toggles.forEach((t) => { if (t.classList.contains('on')) enabled += 1; });
    const state = total ? `${enabled} of ${total} mods enabled` : 'No mods installed';
    const descPath = await window.api.getConfigPath('discord_description.txt');
    let details = 'Modding PAYDAY 3';
    try {
      const raw = await window.api.readFile(descPath);
      if (raw && raw.trim()) details = raw.trim().slice(0, 128);
    } catch (_) {}
    await window.api.discordUpdate(details, state, discordStartTime);
    lastRpcUpdate = now;
  }

  themeToggle.addEventListener('click', async () => {
    themeName = themeName === 'dark' ? 'light' : 'dark';
    document.body.className = 'theme-' + themeName;
    themeToggle.textContent = themeName === 'dark' ? 'Theme: Dark' : 'Theme: Light';
    await saveConfig('theme.txt', themeName);
    refreshList();
  });

  discordToggle.addEventListener('click', async () => {
    if (!discordAvailable) {
      startDiscordPresence();
      return;
    }
    discordEnabled = !discordEnabled;
    await saveConfig('discord_presence_enabled.txt', discordEnabled ? '1' : '0');
    if (!discordEnabled) {
      if (discordInterval) { clearInterval(discordInterval); discordInterval = null; }
      await window.api.discordClear();
      await new Promise(r => setTimeout(r, 300));
      await window.api.discordShutdown();
      discordAvailable = false;
    } else {
      startDiscordPresence();
    }
    updateDiscordToggleLabel();
  });

  $('recycle-toggle').addEventListener('click', async () => {
    recycleOnDelete = !recycleOnDelete;
    await saveConfig('recycle_on_delete.txt', recycleOnDelete ? '1' : '0');
    updateRecycleToggleLabel();
  });

  let updatesPanelOpen = false;
  const railUpdatesWrap = $('rail-updates-wrap');
  const railUpdatesBtn = $('rail-updates');
  const updatesPanel = $('updates-panel');
  const updatesCheckNow = $('updates-check-now');

  function formatPatchNotesPlain(raw) {
    if (!raw || typeof raw !== 'string') return '';
    return raw
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/^(#{1,6})\s+/gm, '')
      .trim();
  }

  async function loadUpdatesPanelData() {
    const verEl = $('updates-current-version');
    const notesEl = $('updates-patchnotes');
    if (verEl && window.api.getAppVersion) {
      try {
        verEl.textContent = await window.api.getAppVersion();
      } catch (_) {
        verEl.textContent = '\u2014';
      }
    }
    if (notesEl && window.api.getPatchNotes) {
      try {
        const t = await window.api.getPatchNotes();
        const formatted = formatPatchNotesPlain(t && t.trim() ? t.trim() : '');
        notesEl.textContent = formatted || 'No patch notes for this build.';
      } catch (_) {
        notesEl.textContent = 'Could not load patch notes.';
      }
    }
  }

  function setUpdatesPanelOpen(open) {
    updatesPanelOpen = open;
    if (updatesPanel) {
      updatesPanel.classList.toggle('is-open', open);
      updatesPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    if (railUpdatesBtn) {
      railUpdatesBtn.classList.toggle('is-active', open);
      railUpdatesBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      railUpdatesBtn.title = open ? 'Close updates (click again)' : 'Updates & version';
      railUpdatesBtn.setAttribute('aria-label', open ? 'Close updates panel' : 'Open updates and version');
    }
  }

  if (railUpdatesBtn && updatesPanel) {
    railUpdatesBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setUpdatesPanelOpen(!updatesPanelOpen);
      if (updatesPanelOpen) loadUpdatesPanelData();
    });
  }

  if (updatesCheckNow && window.api.checkForUpdates) {
    updatesCheckNow.addEventListener('click', async (e) => {
      e.stopPropagation();
      updatesCheckNow.disabled = true;
      try {
        const r = await window.api.checkForUpdates();
        if (r && r.ok && r.updateAvailable && window.api.downloadUpdate) {
          const d = await window.api.downloadUpdate();
          showModBanner(d && d.ok ? 'Downloading update...' : (d && d.message ? d.message : 'Could not start download.'));
        } else if (r && r.message) {
          showModBanner(r.message);
        } else {
          showModBanner('Could not check for updates.');
        }
      } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        showModBanner(msg);
      } finally {
        updatesCheckNow.disabled = false;
      }
    });
  }

  if (discordDescBtn) discordDescBtn.addEventListener('click', async () => {
    const descPath = await window.api.getConfigPath('discord_description.txt');
    let current = 'Modding PAYDAY 3';
    try {
      const raw = await window.api.readFile(descPath);
      if (raw && raw.trim()) current = raw.trim();
    } catch (_) {}
    const modal = $('modal-discord-desc');
    const input = $('discord-desc-input');
    input.value = current;
    showModal(modal);
    input.focus();
    $('discord-desc-save').onclick = async () => {
      const text = input.value.trim().slice(0, 128) || 'Modding PAYDAY 3';
      await window.api.writeFile(descPath, text);
      closeModal(modal);
      notifyDiscordUpdate();
    };
    $('discord-desc-cancel').onclick = () => closeModal(modal);
  });

  document.querySelectorAll('.sort-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const kind = btn.dataset.kind;
      sortKey = getSortKeyForClick(kind, sortKey);
      await saveConfig('sort.txt', sortKey + '\ndate_oldest\nname_az\nname_za');
      updateSortButtons();
      refreshList();
    });
  });

  if (pathInput) pathInput.addEventListener('click', () => browseModsDir());

  const tOpen = $('toolbar-open');
  const tRef = $('toolbar-refresh');
  const tAdd = $('toolbar-add');
  if (tOpen) tOpen.addEventListener('click', browseModsDir);
  if (tRef) tRef.addEventListener('click', () => refreshList());
  if (tAdd) tAdd.addEventListener('click', addPakOrArchive);

  const navHome = $('nav-home');
  const navMods = $('nav-mods');
  const navSettings = $('nav-settings');
  if (navHome) navHome.addEventListener('click', () => showPage('home'));
  if (navMods) navMods.addEventListener('click', () => showPage('mods'));
  if (navSettings) navSettings.addEventListener('click', () => showPage('settings'));

  const footerLaunch = $('footer-launch');
  if (footerLaunch) footerLaunch.addEventListener('click', launchGame);

  const winMin = $('win-minimize');
  const winMax = $('win-maximize');
  const winClose = $('win-close');
  if (winMin && window.api.windowMinimize) winMin.addEventListener('click', () => window.api.windowMinimize());
  if (winMax && window.api.windowMaximizeToggle) {
    winMax.addEventListener('click', () => {
      window.api.windowMaximizeToggle().then(() => updateMaximizeButton());
    });
  }
  if (winClose && window.api.windowClose) winClose.addEventListener('click', () => window.api.windowClose());

  const titlebarDrag = $('titlebar-drag');
  if (titlebarDrag && window.api.windowMaximizeToggle) {
    titlebarDrag.addEventListener('dblclick', (e) => {
      e.preventDefault();
      window.api.windowMaximizeToggle().then(() => updateMaximizeButton());
    });
  }

  if (typeof window.api.onWindowState === 'function') {
    window.api.onWindowState(() => updateMaximizeButton());
  }

  if (modSearch) modSearch.addEventListener('input', applyModFilters);
  initFilterDropdown();

  let dashPressCount = 0;
  let dashPressTimer = null;

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (filterOpen) closeFilterMenu();
      if (updatesPanelOpen) setUpdatesPanelOpen(false);
      closeJumpscare(true);
      return;
    }
    const tag = (e.target.tagName || '').toLowerCase();
    const inInput = tag === 'input' || tag === 'textarea' || tag === 'select';
    if (e.key === '0' && !e.ctrlKey && !e.altKey && !e.metaKey && !inInput) {
      zeroPressCount++;
      if (zeroPressTimer) clearTimeout(zeroPressTimer);
      if (zeroPressCount >= 2) {
        zeroPressCount = 0;
        zeroPressTimer = null;
        playJumpscare();
      } else {
        zeroPressTimer = setTimeout(() => { zeroPressCount = 0; zeroPressTimer = null; }, 500);
      }
    }
    if (e.key === '-' && !e.ctrlKey && !e.altKey && !e.metaKey && !inInput) {
      dashPressCount++;
      if (dashPressTimer) clearTimeout(dashPressTimer);
      if (dashPressCount >= 2) {
        dashPressCount = 0;
        dashPressTimer = null;
        refreshWelcomeMessage();
      } else {
        dashPressTimer = setTimeout(() => { dashPressCount = 0; dashPressTimer = null; }, 500);
      }
    }
  });

  let pendingRestoreFilename = null;
  let pendingPermanentDeleteFilename = null;

  async function refreshDeletedList() {
    const listEl = $('deleted-list');
    const emptyEl = $('deleted-empty');
    const storageLine = $('deleted-storage-line');
    if (!listEl || !emptyEl) return;
    const names = await window.api.listDeletedMods();
    if (storageLine && window.api.getDeletedModsStorageBytes) {
      try {
        const bytes = await window.api.getDeletedModsStorageBytes();
        storageLine.textContent = 'Total storage: ' + formatStorageBytes(bytes);
      } catch (_) {
        storageLine.textContent = '';
      }
    }
    listEl.innerHTML = '';
    emptyEl.classList.toggle('hidden', names.length > 0);
    names.forEach((filename) => {
      const row = document.createElement('div');
      row.className = 'deleted-row';
      row.innerHTML = `
        <span class="deleted-name">${filename.replace(/</g, '&lt;')}</span>
        <button type="button" class="btn-restore" title="Restore">&#8635;</button>
        <button type="button" class="btn-delete-perm" title="Delete permanently">&#10006;</button>`;
      row.querySelector('.btn-restore').onclick = () => doRestore(filename);
      row.querySelector('.btn-delete-perm').onclick = () => confirmPermanentDelete(filename);
      listEl.appendChild(row);
    });
  }

  async function doRestore(filename) {
    if (!modsDir) {
      showAlert('No directory', 'Set the mods directory first.');
      return;
    }
    const baseName = filename.split(/[/\\]/).pop() || filename;
    const result = await window.api.restoreDeletedMod(modsDir, filename);
    if (result.ok) {
      await window.api.setModDate(modsDir, baseName, new Date().toISOString());
      refreshList();
      refreshDeletedList();
      notifyDiscordUpdate();
      return;
    }
    if (result.exists) {
      pendingRestoreFilename = filename;
      $('restore-conflict-message').textContent = 'A mod with that name is already added. Replace it or cancel?';
      showModal($('modal-restore-conflict'));
      return;
    }
    showAlert('Error', 'Could not restore "' + filename + '".');
  }

  function confirmPermanentDelete(filename) {
    pendingPermanentDeleteFilename = filename;
    showModal($('modal-permanent-delete'));
  }

  $('restore-replace').onclick = async () => {
    if (!pendingRestoreFilename || !modsDir) return;
    closeModal($('modal-restore-conflict'), async () => {
      const baseName = pendingRestoreFilename.split(/[/\\]/).pop() || pendingRestoreFilename;
      await window.api.removeMod(modsDir, baseName, false);
      const altName = baseName.endsWith('.disabled') ? baseName.slice(0, -'.disabled'.length) : baseName + '.disabled';
      await window.api.removeMod(modsDir, altName, false);
      const result = await window.api.restoreDeletedMod(modsDir, pendingRestoreFilename);
      pendingRestoreFilename = null;
      if (result.ok) {
        await window.api.setModDate(modsDir, baseName, new Date().toISOString());
        refreshList();
        refreshDeletedList();
        notifyDiscordUpdate();
      } else {
        showAlert('Error', 'Could not restore.');
      }
    });
  };
  $('restore-cancel').onclick = () => {
    closeModal($('modal-restore-conflict'));
    pendingRestoreFilename = null;
  };

  $('permanent-yes').onclick = () => {
    if (!pendingPermanentDeleteFilename) return;
    const filename = pendingPermanentDeleteFilename;
    closeModal($('modal-permanent-delete'), () => {
      window.api.permanentlyDeleteFromRecycle(filename).then((ok) => {
        pendingPermanentDeleteFilename = null;
        refreshDeletedList();
      });
    });
  };
  $('permanent-no').onclick = () => {
    closeModal($('modal-permanent-delete'));
    pendingPermanentDeleteFilename = null;
  };

  const railDeletedMods = $('rail-deleted-mods');
  if (railDeletedMods) {
    railDeletedMods.addEventListener('click', async () => {
      showModal($('modal-deleted-mods'));
      await refreshDeletedList();
    });
  }
  $('deleted-mods-close').addEventListener('click', () => closeModal($('modal-deleted-mods')));

  const deletedOpenFolder = $('deleted-open-folder');
  if (deletedOpenFolder) {
    deletedOpenFolder.addEventListener('click', async (e) => {
      e.stopPropagation();
      const p = await window.api.getDeletedModsPath();
      if (p) await window.api.openPath(p);
    });
  }
  const deletedDeleteAll = $('deleted-delete-all');
  if (deletedDeleteAll) {
    deletedDeleteAll.addEventListener('click', async (e) => {
      e.stopPropagation();
      const names = await window.api.listDeletedMods();
      if (!names.length) {
        showAlert('Recycle', 'No deleted mods to remove.');
        return;
      }
      $('delete-all-recycle-message').textContent =
        'Permanently delete all ' + names.length + ' file(s) in the recycle folder? This cannot be undone.';
      showModal($('modal-delete-all-recycle'));
    });
  }
  $('delete-all-recycle-yes').addEventListener('click', () => {
    closeModal($('modal-delete-all-recycle'), async () => {
      const r = await window.api.deleteAllFromRecycle();
      if (r && r.deleted > 0) {
        showModBanner('Removed ' + r.deleted + ' file(s) from recycle.');
      } else {
        showModBanner('Nothing was removed.');
      }
      await refreshDeletedList();
    });
  });
  $('delete-all-recycle-no').addEventListener('click', () => closeModal($('modal-delete-all-recycle')));

  installModalBackdropClose($('modal-discord-desc'), () => closeModal($('modal-discord-desc')));
  installModalBackdropClose($('modal-deleted-mods'), () => closeModal($('modal-deleted-mods')));
  installModalBackdropClose($('modal-restore-conflict'), () => {
    closeModal($('modal-restore-conflict'));
    pendingRestoreFilename = null;
  });
  installModalBackdropClose($('modal-permanent-delete'), () => {
    closeModal($('modal-permanent-delete'));
    pendingPermanentDeleteFilename = null;
  });
  installModalBackdropClose($('modal-delete-all-recycle'), () => closeModal($('modal-delete-all-recycle')));

  const updateAvailYes = $('update-available-yes');
  const updateAvailNo = $('update-available-no');
  if (updateAvailYes) {
    updateAvailYes.addEventListener('click', () => {
      closeModal($('modal-update-available'), async () => {
        if (!window.api.downloadUpdate) {
          showModBanner('Download is not available in this build.');
          return;
        }
        const d = await window.api.downloadUpdate();
        showModBanner(d && d.ok ? 'Downloading update...' : (d && d.message ? d.message : 'Could not start download.'));
      });
    });
  }
  if (updateAvailNo) {
    updateAvailNo.addEventListener('click', () => closeModal($('modal-update-available')));
  }
  installModalBackdropClose($('modal-update-available'), () => closeModal($('modal-update-available')));

  function setDropOverlayVisible(visible) {
    const shouldHide = !visible;
    if (dropOverlay.hidden === shouldHide) return;
    dropOverlay.hidden = shouldHide;
  }

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDropOverlayVisible(true);
  });
  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    setDropOverlayVisible(false);
  });
  function getDroppedPaths(dataTransfer) {
    const files = dataTransfer?.files;
    if (!files || !files.length) return [];
    const paths = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      let p = '';
      try {
        if (window.api.getPathForFile) p = window.api.getPathForFile(f);
      } catch (_) {}
      if (!p && typeof f.path === 'string') p = f.path;
      if (p && typeof p === 'string') paths.push(p);
    }
    return paths;
  }
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    setDropOverlayVisible(false);
    const paths = getDroppedPaths(e.dataTransfer);
    if (paths.length) processFiles(paths);
  });
  document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
    setDropOverlayVisible(true);
  });
  document.body.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget || !document.body.contains(e.relatedTarget)) setDropOverlayVisible(false);
  });
  document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    setDropOverlayVisible(false);
    const paths = getDroppedPaths(e.dataTransfer);
    if (paths.length) processFiles(paths);
  });

  document.addEventListener('click', (e) => {
    if (filterOpen && filterWrap && !filterWrap.contains(e.target)) {
      closeFilterMenu();
    }
    if (updatesPanelOpen && railUpdatesWrap && !railUpdatesWrap.contains(e.target)) {
      setUpdatesPanelOpen(false);
    }
  });

  initConfig();
})();
