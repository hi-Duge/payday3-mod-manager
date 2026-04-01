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
  /** Set by initCrosshairUI; called when switching to the crosshair page so preview lays out after display:none. */
  let crosshairRefreshPreview = null;
  /** Set by initCrosshairUI; refreshes Restore button enabled state when opening crosshair page. */
  let crosshairRefreshRestore = null;

  const WELCOME_MESSAGES = [
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
    "img:assets/welcome_67cat.gif",
    "img:assets/welcome_pakmod.png",
    "img:assets/welcome_thundercat.png",
    "img:assets/welcome_statement.png",
    "img:assets/welcome_besert.png",
    "img:assets/welcome_shix_sheven.png",
    "img:assets/welcome_lime_eyes.png",
    "img:assets/welcome_intruder.png",
    "img:assets/welcome_dinner_cat.png",
    "img:assets/welcome_mmmm_penits.gif",
    "img:assets/welcome_manga_cat.png",
    "We're going to the bank, not telling you which one",
    "Man I'm so hungry I could eat a mod",
    "heck you",
    "Meta is the worst company ever.",
    "Can you believe it guys? PAYDAY 3 update. Just 3 years away!",
    "I came, I saw, I blew shit up, I came again - Wrench Watch dogs 2",
    "Hey look at this cool tweet I found!.. SORRY X. https://x.com/tmszhjh88/status/2037291612762775751?s=20",
    "What kind of Mod manager is this. This is PAYDAY3 MOD MANAGER, it has the worst code ever written.",
    "Ramadan. Do Muslims, do Muslims eat 30 days? Do Muslims. Damn. Eat 30 days? Do Muslims eat? Do Muslims eat? Do Muslims... not eat every 30 days. during Ramadamen.",
    "What kind of cat lover is this. This is catlover56. He's a dumbass that uses world models instead of pov models.",
    "I should be fixing my other mod but I'm writing this message.",
    "Welcome message.",
    "video:assets/welcome_twitter_clip.mp4",
    "video:assets/welcome_turbid_station.mp4",
  ];

  const $ = (id) => document.getElementById(id);
  let bootSplashDismissed = false;
  let bootSplashSkipShowTimer = null;
  /** Minimum time the boot splash stays visible (init may finish sooner). */
  const BOOT_SPLASH_MIN_MS = 1100;
  let bootSplashShownAt = 0;

  function dismissBootSplash() {
    const splash = $('boot-splash');
    if (!splash || splash.hidden || bootSplashDismissed) return;
    if (splash.classList.contains('boot-splash--exiting')) return;
    if (bootSplashSkipShowTimer) {
      clearTimeout(bootSplashSkipShowTimer);
      bootSplashSkipShowTimer = null;
    }
    const skipBtn = $('boot-splash-skip');
    if (skipBtn) skipBtn.hidden = true;
    let finishDone = false;
    const finish = () => {
      if (finishDone) return;
      finishDone = true;
      splash.hidden = true;
      splash.classList.remove('boot-splash--exiting');
      splash.setAttribute('aria-hidden', 'true');
      splash.removeAttribute('aria-modal');
      splash.removeAttribute('aria-busy');
      bootSplashDismissed = true;
    };
    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      finish();
      return;
    }
    splash.classList.add('boot-splash--exiting');
    const onEnd = (e) => {
      if (e.target !== splash || e.propertyName !== 'opacity') return;
      splash.removeEventListener('transitionend', onEnd);
      finish();
    };
    splash.addEventListener('transitionend', onEnd);
    setTimeout(() => {
      splash.removeEventListener('transitionend', onEnd);
      finish();
    }, 450);
  }

  function scheduleBootSplashSkipButton() {
    const splash = $('boot-splash');
    const skipBtn = $('boot-splash-skip');
    if (!splash || !skipBtn || bootSplashDismissed) return;
    if (bootSplashSkipShowTimer) {
      clearTimeout(bootSplashSkipShowTimer);
      bootSplashSkipShowTimer = null;
    }
    bootSplashSkipShowTimer = setTimeout(() => {
      bootSplashSkipShowTimer = null;
      if (
        !bootSplashDismissed &&
        skipBtn &&
        splash &&
        !splash.hidden &&
        !splash.classList.contains('boot-splash--exiting')
      ) {
        skipBtn.hidden = false;
      }
    }, 30000);
  }

  const pathInput = $('mods-dir');
  const modListEl = $('mod-list');
  const modSearch = $('mod-search');
  const filterWrap = $('filter-wrap');
  const filterTrigger = $('filter-trigger');
  const filterMenu = $('filter-menu');
  const filterLabel = $('filter-trigger-label');
  let filterOpen = false;
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

  const DEFAULT_CUSTOM = {
    accent: '#ffffff',
    bg: '#000000',
    panel: '#0a0a0a',
    fg: '#f0f0f0',
    fgDim: '#8a8a8a',
    border: '#2a2a2a',
  };

  let appearanceState = {
    preset: 'default',
    custom: { ...DEFAULT_CUSTOM },
    savedPalettes: [],
  };

  function normalizeCustomPalette(custom) {
    const out = { ...DEFAULT_CUSTOM };
    if (!custom || typeof custom !== 'object') return out;
    const keys = ['accent', 'bg', 'panel', 'fg', 'fgDim', 'border'];
    keys.forEach((k) => {
      const v = custom[k];
      if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) out[k] = v;
    });
    return out;
  }

  function readCustomFromInputs() {
    return normalizeCustomPalette({
      accent: $('appearance-c-accent').value,
      bg: $('appearance-c-bg').value,
      panel: $('appearance-c-panel').value,
      fg: $('appearance-c-fg').value,
      fgDim: $('appearance-c-fgdim').value,
      border: $('appearance-c-border').value,
    });
  }

  function syncPresetDropdownSavedOptions() {
    const group = $('appearance-preset-saved-optgroup');
    if (!group) return;
    group.innerHTML = '';
    (appearanceState.savedPalettes || []).forEach((p) => {
      const o = document.createElement('option');
      o.value = 'saved:' + p.id;
      o.textContent = p.name;
      group.appendChild(o);
    });
    group.hidden = !(appearanceState.savedPalettes && appearanceState.savedPalettes.length);
  }

  const APPEARANCE_PRESETS = {
    midnight: {
      '--accent': '#9bb6ff',
      '--accent-dim': '#7a8fcf',
      '--bg': '#0c0e14',
      '--bg-panel': '#141820',
      '--card': '#181c26',
      '--card-alt': '#1c2230',
      '--fg': '#e8eef4',
      '--fg-dim': '#8890a0',
      '--border': '#2a3240',
      '--entry-bg': '#0c0e14',
      '--btn-bg': '#1a2230',
      '--btn-fg': '#e8eef4',
      '--btn-hover': '#242d3d',
      '--scroll-bg': '#4a5a6e',
      '--scroll-trough': '#0c0e14',
      '--tog-on-track': '#9bb6ff',
      '--tog-off-track': '#333c4a',
      '--tog-on-thumb': '#0c0e14',
      '--tog-off-thumb': '#8890a0',
      '--thumb-outline': '#1a2230',
      '--enabled-fg': '#e8eef4',
      '--disabled-fg': '#5a6470',
      '--drop-bg': '#0a0a12',
      '--drop-border': '#3a4a5c',
      '--drop-fg': '#8890a0',
      '--sort-bar': '#141820',
      '--sort-active-bg': '#222a38',
      '--sort-active-arrow': '#9bb6ff',
      '--danger': '#e05555',
      '--danger-hover': '#ff6666',
      '--modal-overlay': 'rgba(0, 0, 0, 0.88)',
      '--status-bar-bg': '#101420',
      '--status-bar-fg': '#a0aab8',
      '--status-accent': '#9bb6ff',
      '--titlebar-bg': '#101420',
      '--titlebar-border': '#2a3240',
      '--titlebar-btn-hover': '#1a2230',
      '--rail-bg': '#0c0e14',
      '--rail-border': '#2a3240',
      '--bg-elevated': '#1c2230',
    },
    ocean: {
      '--accent': '#38bdf8',
      '--accent-dim': '#0ea5e9',
      '--bg': '#0a1620',
      '--bg-panel': '#0f2433',
      '--card': '#123548',
      '--card-alt': '#164056',
      '--fg': '#e0f2fe',
      '--fg-dim': '#7ba7bc',
      '--border': '#1e4a63',
      '--entry-bg': '#0a1620',
      '--btn-bg': '#123548',
      '--btn-fg': '#e0f2fe',
      '--btn-hover': '#1a4a63',
      '--scroll-bg': '#3a7a9a',
      '--scroll-trough': '#0a1620',
      '--tog-on-track': '#38bdf8',
      '--tog-off-track': '#2a4a5a',
      '--tog-on-thumb': '#0a1620',
      '--tog-off-thumb': '#7ba7bc',
      '--thumb-outline': '#123548',
      '--enabled-fg': '#e0f2fe',
      '--disabled-fg': '#5a7a8a',
      '--drop-bg': '#081420',
      '--drop-border': '#2a5a78',
      '--drop-fg': '#7ba7bc',
      '--sort-bar': '#0f2433',
      '--sort-active-bg': '#1a4a63',
      '--sort-active-arrow': '#38bdf8',
      '--danger': '#e05555',
      '--danger-hover': '#ff6666',
      '--modal-overlay': 'rgba(0, 0, 0, 0.88)',
      '--status-bar-bg': '#0c2030',
      '--status-bar-fg': '#9ec5d8',
      '--status-accent': '#38bdf8',
      '--titlebar-bg': '#0c2030',
      '--titlebar-border': '#1e4a63',
      '--titlebar-btn-hover': '#123548',
      '--rail-bg': '#0a1620',
      '--rail-border': '#1e4a63',
      '--bg-elevated': '#164056',
    },
    warm: {
      '--accent': '#ffb74d',
      '--accent-dim': '#ff9800',
      '--bg': '#141210',
      '--bg-panel': '#1c1814',
      '--card': '#221e1a',
      '--card-alt': '#282420',
      '--fg': '#f5ebe3',
      '--fg-dim': '#a89888',
      '--border': '#3d342c',
      '--entry-bg': '#141210',
      '--btn-bg': '#2a241e',
      '--btn-fg': '#f5ebe3',
      '--btn-hover': '#342e28',
      '--scroll-bg': '#6a5a4a',
      '--scroll-trough': '#141210',
      '--tog-on-track': '#ffb74d',
      '--tog-off-track': '#4a4038',
      '--tog-on-thumb': '#141210',
      '--tog-off-thumb': '#a89888',
      '--thumb-outline': '#2a241e',
      '--enabled-fg': '#f5ebe3',
      '--disabled-fg': '#6a5c50',
      '--drop-bg': '#100e0c',
      '--drop-border': '#504438',
      '--drop-fg': '#a89888',
      '--sort-bar': '#1c1814',
      '--sort-active-bg': '#302820',
      '--sort-active-arrow': '#ffb74d',
      '--danger': '#e05555',
      '--danger-hover': '#ff6666',
      '--modal-overlay': 'rgba(0, 0, 0, 0.88)',
      '--status-bar-bg': '#181410',
      '--status-bar-fg': '#c8b8a8',
      '--status-accent': '#ffb74d',
      '--titlebar-bg': '#181410',
      '--titlebar-border': '#3d342c',
      '--titlebar-btn-hover': '#2a241e',
      '--rail-bg': '#141210',
      '--rail-border': '#3d342c',
      '--bg-elevated': '#282420',
    },
    slate: {
      '--accent': '#94a3b8',
      '--accent-dim': '#64748b',
      '--bg': '#0f172a',
      '--bg-panel': '#1e293b',
      '--card': '#243146',
      '--card-alt': '#2a3850',
      '--fg': '#f1f5f9',
      '--fg-dim': '#94a3b8',
      '--border': '#334155',
      '--entry-bg': '#0f172a',
      '--btn-bg': '#273549',
      '--btn-fg': '#f1f5f9',
      '--btn-hover': '#334155',
      '--scroll-bg': '#64748b',
      '--scroll-trough': '#0f172a',
      '--tog-on-track': '#94a3b8',
      '--tog-off-track': '#3d4f66',
      '--tog-on-thumb': '#0f172a',
      '--tog-off-thumb': '#94a3b8',
      '--thumb-outline': '#273549',
      '--enabled-fg': '#f1f5f9',
      '--disabled-fg': '#64748b',
      '--drop-bg': '#0c1220',
      '--drop-border': '#475569',
      '--drop-fg': '#94a3b8',
      '--sort-bar': '#1e293b',
      '--sort-active-bg': '#334155',
      '--sort-active-arrow': '#94a3b8',
      '--danger': '#e05555',
      '--danger-hover': '#ff6666',
      '--modal-overlay': 'rgba(0, 0, 0, 0.88)',
      '--status-bar-bg': '#1a2436',
      '--status-bar-fg': '#cbd5e1',
      '--status-accent': '#94a3b8',
      '--titlebar-bg': '#1a2436',
      '--titlebar-border': '#334155',
      '--titlebar-btn-hover': '#273549',
      '--rail-bg': '#0f172a',
      '--rail-border': '#334155',
      '--bg-elevated': '#2a3850',
    },
    paper: {
      '--accent': '#3d3528',
      '--accent-dim': '#5c5346',
      '--bg': '#faf8f5',
      '--bg-panel': '#f5f2ed',
      '--card': '#ffffff',
      '--card-alt': '#faf8f5',
      '--fg': '#1c1914',
      '--fg-dim': '#6b6458',
      '--border': '#ddd6cc',
      '--entry-bg': '#ffffff',
      '--btn-bg': '#ebe6df',
      '--btn-fg': '#1c1914',
      '--btn-hover': '#e2dcd3',
      '--scroll-bg': '#a89888',
      '--scroll-trough': '#f5f2ed',
      '--tog-on-track': '#3d3528',
      '--tog-off-track': '#c4bcb0',
      '--tog-on-thumb': '#ffffff',
      '--tog-off-thumb': '#ebe6df',
      '--thumb-outline': '#b8b0a4',
      '--enabled-fg': '#1c1914',
      '--disabled-fg': '#8a8276',
      '--drop-bg': '#faf8f5',
      '--drop-border': '#b8b0a4',
      '--drop-fg': '#6b6458',
      '--sort-bar': '#ebe6df',
      '--sort-active-bg': '#e2dcd3',
      '--sort-active-arrow': '#3d3528',
      '--danger': '#b00020',
      '--danger-hover': '#8b0018',
      '--modal-overlay': 'rgba(80, 80, 80, 0.4)',
      '--status-bar-bg': '#f0ebe4',
      '--status-bar-fg': '#4a443a',
      '--status-accent': '#3d3528',
      '--titlebar-bg': '#f5f2ed',
      '--titlebar-border': '#ddd6cc',
      '--titlebar-btn-hover': '#ebe6df',
      '--rail-bg': '#faf8f5',
      '--rail-border': '#ddd6cc',
      '--bg-elevated': '#ffffff',
    },
    frost: {
      '--accent': '#2563eb',
      '--accent-dim': '#3b82f6',
      '--bg': '#f8fafc',
      '--bg-panel': '#f1f5f9',
      '--card': '#ffffff',
      '--card-alt': '#f8fafc',
      '--fg': '#0f172a',
      '--fg-dim': '#64748b',
      '--border': '#cbd5e1',
      '--entry-bg': '#ffffff',
      '--btn-bg': '#e2e8f0',
      '--btn-fg': '#0f172a',
      '--btn-hover': '#cbd5e1',
      '--scroll-bg': '#94a3b8',
      '--scroll-trough': '#f1f5f9',
      '--tog-on-track': '#2563eb',
      '--tog-off-track': '#cbd5e1',
      '--tog-on-thumb': '#ffffff',
      '--tog-off-thumb': '#e2e8f0',
      '--thumb-outline': '#94a3b8',
      '--enabled-fg': '#0f172a',
      '--disabled-fg': '#94a3b8',
      '--drop-bg': '#f8fafc',
      '--drop-border': '#94a3b8',
      '--drop-fg': '#64748b',
      '--sort-bar': '#e2e8f0',
      '--sort-active-bg': '#cbd5e1',
      '--sort-active-arrow': '#2563eb',
      '--danger': '#b00020',
      '--danger-hover': '#8b0018',
      '--modal-overlay': 'rgba(80, 80, 80, 0.4)',
      '--status-bar-bg': '#e8eef4',
      '--status-bar-fg': '#334155',
      '--status-accent': '#2563eb',
      '--titlebar-bg': '#f1f5f9',
      '--titlebar-border': '#cbd5e1',
      '--titlebar-btn-hover': '#e2e8f0',
      '--rail-bg': '#f8fafc',
      '--rail-border': '#cbd5e1',
      '--bg-elevated': '#ffffff',
    },
    dawn: {
      '--accent': '#c2410c',
      '--accent-dim': '#ea580c',
      '--bg': '#fff7ed',
      '--bg-panel': '#ffedd5',
      '--card': '#ffffff',
      '--card-alt': '#fff7ed',
      '--fg': '#431407',
      '--fg-dim': '#9a3412',
      '--border': '#fdba74',
      '--entry-bg': '#ffffff',
      '--btn-bg': '#fed7aa',
      '--btn-fg': '#431407',
      '--btn-hover': '#fdba74',
      '--scroll-bg': '#fb923c',
      '--scroll-trough': '#ffedd5',
      '--tog-on-track': '#c2410c',
      '--tog-off-track': '#fdba74',
      '--tog-on-thumb': '#ffffff',
      '--tog-off-thumb': '#fed7aa',
      '--thumb-outline': '#fb923c',
      '--enabled-fg': '#431407',
      '--disabled-fg': '#9a3412',
      '--drop-bg': '#fff7ed',
      '--drop-border': '#fb923c',
      '--drop-fg': '#9a3412',
      '--sort-bar': '#fed7aa',
      '--sort-active-bg': '#fdba74',
      '--sort-active-arrow': '#c2410c',
      '--danger': '#b00020',
      '--danger-hover': '#8b0018',
      '--modal-overlay': 'rgba(80, 80, 80, 0.4)',
      '--status-bar-bg': '#ffedd5',
      '--status-bar-fg': '#7c2d12',
      '--status-accent': '#c2410c',
      '--titlebar-bg': '#ffedd5',
      '--titlebar-border': '#fdba74',
      '--titlebar-btn-hover': '#fed7aa',
      '--rail-bg': '#fff7ed',
      '--rail-border': '#fdba74',
      '--bg-elevated': '#ffffff',
    },
    cream: {
      '--accent': '#6d4c41',
      '--accent-dim': '#8d6e63',
      '--bg': '#fffef8',
      '--bg-panel': '#faf6ef',
      '--card': '#ffffff',
      '--card-alt': '#fffef8',
      '--fg': '#2d2420',
      '--fg-dim': '#6d5c54',
      '--border': '#e0d5c8',
      '--entry-bg': '#ffffff',
      '--btn-bg': '#efe8df',
      '--btn-fg': '#2d2420',
      '--btn-hover': '#e0d5c8',
      '--scroll-bg': '#a1887f',
      '--scroll-trough': '#faf6ef',
      '--tog-on-track': '#6d4c41',
      '--tog-off-track': '#d7ccc8',
      '--tog-on-thumb': '#ffffff',
      '--tog-off-thumb': '#efe8df',
      '--thumb-outline': '#bcaaa4',
      '--enabled-fg': '#2d2420',
      '--disabled-fg': '#8d6e63',
      '--drop-bg': '#fffef8',
      '--drop-border': '#bcaaa4',
      '--drop-fg': '#6d5c54',
      '--sort-bar': '#efe8df',
      '--sort-active-bg': '#e0d5c8',
      '--sort-active-arrow': '#6d4c41',
      '--danger': '#b00020',
      '--danger-hover': '#8b0018',
      '--modal-overlay': 'rgba(80, 80, 80, 0.4)',
      '--status-bar-bg': '#f5efe6',
      '--status-bar-fg': '#4e342e',
      '--status-accent': '#6d4c41',
      '--titlebar-bg': '#faf6ef',
      '--titlebar-border': '#e0d5c8',
      '--titlebar-btn-hover': '#efe8df',
      '--rail-bg': '#fffef8',
      '--rail-border': '#e0d5c8',
      '--bg-elevated': '#ffffff',
    },
    mint: {
      '--accent': '#0d9488',
      '--accent-dim': '#14b8a6',
      '--bg': '#f0fdfa',
      '--bg-panel': '#ccfbf1',
      '--card': '#ffffff',
      '--card-alt': '#f0fdfa',
      '--fg': '#134e4a',
      '--fg-dim': '#5b9088',
      '--border': '#99f6e4',
      '--entry-bg': '#ffffff',
      '--btn-bg': '#a7f3d0',
      '--btn-fg': '#134e4a',
      '--btn-hover': '#6ee7b7',
      '--scroll-bg': '#2dd4bf',
      '--scroll-trough': '#ccfbf1',
      '--tog-on-track': '#0d9488',
      '--tog-off-track': '#99f6e4',
      '--tog-on-thumb': '#ffffff',
      '--tog-off-thumb': '#a7f3d0',
      '--thumb-outline': '#5eead4',
      '--enabled-fg': '#134e4a',
      '--disabled-fg': '#5b9088',
      '--drop-bg': '#f0fdfa',
      '--drop-border': '#5eead4',
      '--drop-fg': '#5b9088',
      '--sort-bar': '#a7f3d0',
      '--sort-active-bg': '#6ee7b7',
      '--sort-active-arrow': '#0d9488',
      '--danger': '#b00020',
      '--danger-hover': '#8b0018',
      '--modal-overlay': 'rgba(80, 80, 80, 0.4)',
      '--status-bar-bg': '#d1fae5',
      '--status-bar-fg': '#115e59',
      '--status-accent': '#0d9488',
      '--titlebar-bg': '#ccfbf1',
      '--titlebar-border': '#99f6e4',
      '--titlebar-btn-hover': '#a7f3d0',
      '--rail-bg': '#f0fdfa',
      '--rail-border': '#99f6e4',
      '--bg-elevated': '#ffffff',
    },
    mint_dark: {
      '--accent': '#2dd4bf',
      '--accent-dim': '#14b8a6',
      '--bg': '#0a1614',
      '--bg-panel': '#0f2420',
      '--card': '#122e29',
      '--card-alt': '#163832',
      '--fg': '#e6fffa',
      '--fg-dim': '#6b9e94',
      '--border': '#1e4d45',
      '--entry-bg': '#0a1614',
      '--btn-bg': '#143832',
      '--btn-fg': '#e6fffa',
      '--btn-hover': '#1a453d',
      '--scroll-bg': '#2d6a5f',
      '--scroll-trough': '#0a1614',
      '--tog-on-track': '#2dd4bf',
      '--tog-off-track': '#2a4a44',
      '--tog-on-thumb': '#0a1614',
      '--tog-off-thumb': '#6b9e94',
      '--thumb-outline': '#143832',
      '--enabled-fg': '#e6fffa',
      '--disabled-fg': '#4a6b64',
      '--drop-bg': '#081210',
      '--drop-border': '#2a5c54',
      '--drop-fg': '#6b9e94',
      '--sort-bar': '#0f2420',
      '--sort-active-bg': '#1a453d',
      '--sort-active-arrow': '#2dd4bf',
      '--danger': '#e05555',
      '--danger-hover': '#ff6666',
      '--modal-overlay': 'rgba(0, 0, 0, 0.88)',
      '--status-bar-bg': '#0c1e1a',
      '--status-bar-fg': '#8ec5b8',
      '--status-accent': '#2dd4bf',
      '--titlebar-bg': '#0c1e1a',
      '--titlebar-border': '#1e4d45',
      '--titlebar-btn-hover': '#143832',
      '--rail-bg': '#0a1614',
      '--rail-border': '#1e4d45',
      '--bg-elevated': '#163832',
    },
    ember: {
      '--accent': '#f87171',
      '--accent-dim': '#ef4444',
      '--bg': '#140c0c',
      '--bg-panel': '#1f1414',
      '--card': '#281a1a',
      '--card-alt': '#2e1f1f',
      '--fg': '#fef2f2',
      '--fg-dim': '#b89191',
      '--border': '#4a3030',
      '--entry-bg': '#140c0c',
      '--btn-bg': '#321f1f',
      '--btn-fg': '#fef2f2',
      '--btn-hover': '#3d2828',
      '--scroll-bg': '#8a4a4a',
      '--scroll-trough': '#140c0c',
      '--tog-on-track': '#f87171',
      '--tog-off-track': '#4a3030',
      '--tog-on-thumb': '#140c0c',
      '--tog-off-thumb': '#b89191',
      '--thumb-outline': '#321f1f',
      '--enabled-fg': '#fef2f2',
      '--disabled-fg': '#6a5050',
      '--drop-bg': '#100808',
      '--drop-border': '#5a3838',
      '--drop-fg': '#b89191',
      '--sort-bar': '#1f1414',
      '--sort-active-bg': '#3d2828',
      '--sort-active-arrow': '#f87171',
      '--danger': '#e05555',
      '--danger-hover': '#ff6666',
      '--modal-overlay': 'rgba(0, 0, 0, 0.88)',
      '--status-bar-bg': '#1a1010',
      '--status-bar-fg': '#d4a8a8',
      '--status-accent': '#f87171',
      '--titlebar-bg': '#1a1010',
      '--titlebar-border': '#4a3030',
      '--titlebar-btn-hover': '#321f1f',
      '--rail-bg': '#140c0c',
      '--rail-border': '#4a3030',
      '--bg-elevated': '#2e1f1f',
    },
    amethyst: {
      '--accent': '#c4b5fd',
      '--accent-dim': '#a78bfa',
      '--bg': '#0f0a18',
      '--bg-panel': '#181024',
      '--card': '#221830',
      '--card-alt': '#1c1430',
      '--fg': '#f5f3ff',
      '--fg-dim': '#9a8ac4',
      '--border': '#3d3260',
      '--entry-bg': '#0f0a18',
      '--btn-bg': '#2a1f4a',
      '--btn-fg': '#f5f3ff',
      '--btn-hover': '#352858',
      '--scroll-bg': '#6b5a9c',
      '--scroll-trough': '#0f0a18',
      '--tog-on-track': '#c4b5fd',
      '--tog-off-track': '#3d3260',
      '--tog-on-thumb': '#0f0a18',
      '--tog-off-thumb': '#9a8ac4',
      '--thumb-outline': '#2a1f4a',
      '--enabled-fg': '#f5f3ff',
      '--disabled-fg': '#6a5a8a',
      '--drop-bg': '#0c0814',
      '--drop-border': '#4a3d70',
      '--drop-fg': '#9a8ac4',
      '--sort-bar': '#181024',
      '--sort-active-bg': '#352858',
      '--sort-active-arrow': '#c4b5fd',
      '--danger': '#e05555',
      '--danger-hover': '#ff6666',
      '--modal-overlay': 'rgba(0, 0, 0, 0.88)',
      '--status-bar-bg': '#140c20',
      '--status-bar-fg': '#c4b5e8',
      '--status-accent': '#c4b5fd',
      '--titlebar-bg': '#140c20',
      '--titlebar-border': '#3d3260',
      '--titlebar-btn-hover': '#2a1f4a',
      '--rail-bg': '#0f0a18',
      '--rail-border': '#3d3260',
      '--bg-elevated': '#221830',
    },
    charcoal: {
      '--accent': '#d4d4d4',
      '--accent-dim': '#a3a3a3',
      '--bg': '#0a0a0a',
      '--bg-panel': '#141414',
      '--card': '#1a1a1a',
      '--card-alt': '#1f1f1f',
      '--fg': '#f5f5f5',
      '--fg-dim': '#737373',
      '--border': '#404040',
      '--entry-bg': '#0a0a0a',
      '--btn-bg': '#262626',
      '--btn-fg': '#f5f5f5',
      '--btn-hover': '#333333',
      '--scroll-bg': '#737373',
      '--scroll-trough': '#0a0a0a',
      '--tog-on-track': '#d4d4d4',
      '--tog-off-track': '#404040',
      '--tog-on-thumb': '#0a0a0a',
      '--tog-off-thumb': '#737373',
      '--thumb-outline': '#262626',
      '--enabled-fg': '#f5f5f5',
      '--disabled-fg': '#525252',
      '--drop-bg': '#080808',
      '--drop-border': '#525252',
      '--drop-fg': '#737373',
      '--sort-bar': '#141414',
      '--sort-active-bg': '#333333',
      '--sort-active-arrow': '#d4d4d4',
      '--danger': '#e05555',
      '--danger-hover': '#ff6666',
      '--modal-overlay': 'rgba(0, 0, 0, 0.88)',
      '--status-bar-bg': '#121212',
      '--status-bar-fg': '#a3a3a3',
      '--status-accent': '#d4d4d4',
      '--titlebar-bg': '#121212',
      '--titlebar-border': '#404040',
      '--titlebar-btn-hover': '#262626',
      '--rail-bg': '#0a0a0a',
      '--rail-border': '#404040',
      '--bg-elevated': '#1f1f1f',
    },
    forest: {
      '--accent': '#86efac',
      '--accent-dim': '#4ade80',
      '--bg': '#0a120e',
      '--bg-panel': '#0f1f18',
      '--card': '#142a22',
      '--card-alt': '#183228',
      '--fg': '#ecfdf5',
      '--fg-dim': '#6b9e82',
      '--border': '#1e4a38',
      '--entry-bg': '#0a120e',
      '--btn-bg': '#1a3328',
      '--btn-fg': '#ecfdf5',
      '--btn-hover': '#224038',
      '--scroll-bg': '#3d7a5c',
      '--scroll-trough': '#0a120e',
      '--tog-on-track': '#86efac',
      '--tog-off-track': '#2a4a3c',
      '--tog-on-thumb': '#0a120e',
      '--tog-off-thumb': '#6b9e82',
      '--thumb-outline': '#1a3328',
      '--enabled-fg': '#ecfdf5',
      '--disabled-fg': '#4a6b5c',
      '--drop-bg': '#0a0e0c',
      '--drop-border': '#2a5c48',
      '--drop-fg': '#6b9e82',
      '--sort-bar': '#0f1f18',
      '--sort-active-bg': '#224038',
      '--sort-active-arrow': '#86efac',
      '--danger': '#e05555',
      '--danger-hover': '#ff6666',
      '--modal-overlay': 'rgba(0, 0, 0, 0.88)',
      '--status-bar-bg': '#0c1814',
      '--status-bar-fg': '#9ec5b0',
      '--status-accent': '#86efac',
      '--titlebar-bg': '#0c1814',
      '--titlebar-border': '#1e4a38',
      '--titlebar-btn-hover': '#1a3328',
      '--rail-bg': '#0a120e',
      '--rail-border': '#1e4a38',
      '--bg-elevated': '#183228',
    },
    lilac: {
      '--accent': '#7c3aed',
      '--accent-dim': '#8b5cf6',
      '--bg': '#faf5ff',
      '--bg-panel': '#f3e8ff',
      '--card': '#ffffff',
      '--card-alt': '#faf5ff',
      '--fg': '#1e1b4b',
      '--fg-dim': '#6b5a9c',
      '--border': '#ddd6fe',
      '--entry-bg': '#ffffff',
      '--btn-bg': '#ede9fe',
      '--btn-fg': '#1e1b4b',
      '--btn-hover': '#ddd6fe',
      '--scroll-bg': '#a78bfa',
      '--scroll-trough': '#f3e8ff',
      '--tog-on-track': '#7c3aed',
      '--tog-off-track': '#ddd6fe',
      '--tog-on-thumb': '#ffffff',
      '--tog-off-thumb': '#ede9fe',
      '--thumb-outline': '#c4b5fd',
      '--enabled-fg': '#1e1b4b',
      '--disabled-fg': '#8b7ab8',
      '--drop-bg': '#faf5ff',
      '--drop-border': '#c4b5fd',
      '--drop-fg': '#6b5a9c',
      '--sort-bar': '#ede9fe',
      '--sort-active-bg': '#ddd6fe',
      '--sort-active-arrow': '#7c3aed',
      '--danger': '#b00020',
      '--danger-hover': '#8b0018',
      '--modal-overlay': 'rgba(80, 80, 80, 0.4)',
      '--status-bar-bg': '#ede9fe',
      '--status-bar-fg': '#4c1d95',
      '--status-accent': '#7c3aed',
      '--titlebar-bg': '#f3e8ff',
      '--titlebar-border': '#ddd6fe',
      '--titlebar-btn-hover': '#ede9fe',
      '--rail-bg': '#faf5ff',
      '--rail-border': '#ddd6fe',
      '--bg-elevated': '#ffffff',
    },
    sand: {
      '--accent': '#b45309',
      '--accent-dim': '#d97706',
      '--bg': '#fffbeb',
      '--bg-panel': '#fef3c7',
      '--card': '#ffffff',
      '--card-alt': '#fffbeb',
      '--fg': '#422006',
      '--fg-dim': '#92400e',
      '--border': '#fcd34d',
      '--entry-bg': '#ffffff',
      '--btn-bg': '#fde68a',
      '--btn-fg': '#422006',
      '--btn-hover': '#fcd34d',
      '--scroll-bg': '#d97706',
      '--scroll-trough': '#fef3c7',
      '--tog-on-track': '#b45309',
      '--tog-off-track': '#fcd34d',
      '--tog-on-thumb': '#ffffff',
      '--tog-off-thumb': '#fde68a',
      '--thumb-outline': '#fbbf24',
      '--enabled-fg': '#422006',
      '--disabled-fg': '#a16207',
      '--drop-bg': '#fffbeb',
      '--drop-border': '#fbbf24',
      '--drop-fg': '#92400e',
      '--sort-bar': '#fde68a',
      '--sort-active-bg': '#fcd34d',
      '--sort-active-arrow': '#b45309',
      '--danger': '#b00020',
      '--danger-hover': '#8b0018',
      '--modal-overlay': 'rgba(80, 80, 80, 0.4)',
      '--status-bar-bg': '#fef3c7',
      '--status-bar-fg': '#78350f',
      '--status-accent': '#b45309',
      '--titlebar-bg': '#fef3c7',
      '--titlebar-border': '#fcd34d',
      '--titlebar-btn-hover': '#fde68a',
      '--rail-bg': '#fffbeb',
      '--rail-border': '#fcd34d',
      '--bg-elevated': '#ffffff',
    },
    chrome: {
      '--accent': '#374151',
      '--accent-dim': '#4b5563',
      '--bg': '#f9fafb',
      '--bg-panel': '#f3f4f6',
      '--card': '#ffffff',
      '--card-alt': '#f9fafb',
      '--fg': '#111827',
      '--fg-dim': '#6b7280',
      '--border': '#d1d5db',
      '--entry-bg': '#ffffff',
      '--btn-bg': '#e5e7eb',
      '--btn-fg': '#111827',
      '--btn-hover': '#d1d5db',
      '--scroll-bg': '#9ca3af',
      '--scroll-trough': '#f3f4f6',
      '--tog-on-track': '#374151',
      '--tog-off-track': '#d1d5db',
      '--tog-on-thumb': '#ffffff',
      '--tog-off-thumb': '#e5e7eb',
      '--thumb-outline': '#9ca3af',
      '--enabled-fg': '#111827',
      '--disabled-fg': '#9ca3af',
      '--drop-bg': '#f9fafb',
      '--drop-border': '#9ca3af',
      '--drop-fg': '#6b7280',
      '--sort-bar': '#e5e7eb',
      '--sort-active-bg': '#d1d5db',
      '--sort-active-arrow': '#374151',
      '--danger': '#b00020',
      '--danger-hover': '#8b0018',
      '--modal-overlay': 'rgba(80, 80, 80, 0.4)',
      '--status-bar-bg': '#e5e7eb',
      '--status-bar-fg': '#374151',
      '--status-accent': '#374151',
      '--titlebar-bg': '#f3f4f6',
      '--titlebar-border': '#d1d5db',
      '--titlebar-btn-hover': '#e5e7eb',
      '--rail-bg': '#f9fafb',
      '--rail-border': '#d1d5db',
      '--bg-elevated': '#ffffff',
    },
    blush: {
      '--accent': '#db2777',
      '--accent-dim': '#ec4899',
      '--bg': '#fff1f2',
      '--bg-panel': '#ffe4e6',
      '--card': '#ffffff',
      '--card-alt': '#fff1f2',
      '--fg': '#500724',
      '--fg-dim': '#9d174d',
      '--border': '#fecdd3',
      '--entry-bg': '#ffffff',
      '--btn-bg': '#fecdd3',
      '--btn-fg': '#500724',
      '--btn-hover': '#fda4af',
      '--scroll-bg': '#f472b6',
      '--scroll-trough': '#ffe4e6',
      '--tog-on-track': '#db2777',
      '--tog-off-track': '#fecdd3',
      '--tog-on-thumb': '#ffffff',
      '--tog-off-thumb': '#fecdd3',
      '--thumb-outline': '#fb7185',
      '--enabled-fg': '#500724',
      '--disabled-fg': '#be185d',
      '--drop-bg': '#fff1f2',
      '--drop-border': '#fb7185',
      '--drop-fg': '#9d174d',
      '--sort-bar': '#fecdd3',
      '--sort-active-bg': '#fda4af',
      '--sort-active-arrow': '#db2777',
      '--danger': '#b00020',
      '--danger-hover': '#8b0018',
      '--modal-overlay': 'rgba(80, 80, 80, 0.4)',
      '--status-bar-bg': '#ffe4e6',
      '--status-bar-fg': '#831843',
      '--status-accent': '#db2777',
      '--titlebar-bg': '#ffe4e6',
      '--titlebar-border': '#fecdd3',
      '--titlebar-btn-hover': '#fecdd3',
      '--rail-bg': '#fff1f2',
      '--rail-border': '#fecdd3',
      '--bg-elevated': '#ffffff',
    },
  };

  const LIGHT_PRESETS = new Set([
    'paper', 'frost', 'dawn', 'cream', 'mint', 'lilac', 'sand', 'chrome', 'blush',
  ]);

  const APPEARANCE_COLOR_KEYS = [
    '--accent', '--accent-dim', '--bg', '--bg-panel', '--card', '--card-alt',
    '--fg', '--fg-dim', '--border', '--entry-bg', '--btn-bg', '--btn-fg', '--btn-hover',
    '--scroll-bg', '--scroll-trough', '--tog-on-track', '--tog-off-track',
    '--tog-on-thumb', '--tog-off-thumb', '--thumb-outline', '--enabled-fg', '--disabled-fg',
    '--drop-bg', '--drop-border', '--drop-fg', '--sort-bar', '--sort-active-bg', '--sort-active-arrow',
    '--danger', '--danger-hover', '--modal-overlay', '--status-bar-bg', '--status-bar-fg',
    '--status-accent', '--titlebar-bg', '--titlebar-border', '--titlebar-btn-hover',
    '--rail-bg', '--rail-border', '--bg-elevated',
  ];

  function hexToRgb(hex) {
    const h = String(hex || '').replace('#', '');
    if (h.length !== 6) return { r: 0, g: 0, b: 0 };
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((x) => {
      const s = Math.max(0, Math.min(255, Math.round(x))).toString(16);
      return s.length === 1 ? '0' + s : s;
    }).join('');
  }

  function mixHex(a, b, t) {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    return rgbToHex(
      A.r + (B.r - A.r) * t,
      A.g + (B.g - A.g) * t,
      A.b + (B.b - A.b) * t
    );
  }

  function isLightBg(hex) {
    const { r, g, b } = hexToRgb(hex);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 160;
  }

  function deriveCustomTheme(c) {
    const accent = c.accent;
    const bg = c.bg;
    const panel = c.panel;
    const fg = c.fg;
    const fgDim = c.fgDim;
    const border = c.border;
    const light = isLightBg(bg);
    const accentDim = mixHex(accent, fgDim, 0.4);
    const card = mixHex(panel, bg, 0.35);
    const cardAlt = mixHex(panel, bg, 0.2);
    const btnBg = mixHex(panel, bg, 0.45);
    const btnHover = mixHex(btnBg, fg, 0.12);
    const sortBar = mixHex(panel, bg, 0.35);
    const sortActiveBg = mixHex(panel, accent, 0.18);
    const dropBg = mixHex(bg, panel, 0.25);
    const elevated = mixHex(card, panel, 0.5);
    const scrollBg = mixHex(border, fg, 0.25);
    const toggleOffTrack = mixHex(panel, border, 0.55);
    const toggleOnThumb = light ? '#ffffff' : bg;
    const toggleOffThumb = light ? mixHex(fgDim, fg, 0.45) : fgDim;
    const thumbOutline = mixHex(bg, border, 0.5);
    const danger = light ? '#b00020' : '#e05555';
    const dangerHover = light ? '#8b0018' : '#ff6666';
    const modalOverlay = light ? 'rgba(80, 80, 80, 0.4)' : 'rgba(0, 0, 0, 0.88)';
    return {
      '--accent': accent,
      '--accent-dim': accentDim,
      '--bg': bg,
      '--bg-panel': panel,
      '--card': card,
      '--card-alt': cardAlt,
      '--fg': fg,
      '--fg-dim': fgDim,
      '--border': border,
      '--entry-bg': bg,
      '--btn-bg': btnBg,
      '--btn-fg': fg,
      '--btn-hover': btnHover,
      '--scroll-bg': scrollBg,
      '--scroll-trough': bg,
      '--tog-on-track': accent,
      '--tog-off-track': toggleOffTrack,
      '--tog-on-thumb': toggleOnThumb,
      '--tog-off-thumb': toggleOffThumb,
      '--thumb-outline': thumbOutline,
      '--enabled-fg': fg,
      '--disabled-fg': fgDim,
      '--drop-bg': dropBg,
      '--drop-border': border,
      '--drop-fg': fgDim,
      '--sort-bar': sortBar,
      '--sort-active-bg': sortActiveBg,
      '--sort-active-arrow': accent,
      '--danger': danger,
      '--danger-hover': dangerHover,
      '--modal-overlay': modalOverlay,
      '--status-bar-bg': panel,
      '--status-bar-fg': fgDim,
      '--status-accent': accent,
      '--titlebar-bg': panel,
      '--titlebar-border': border,
      '--titlebar-btn-hover': mixHex(panel, bg, 0.35),
      '--rail-bg': bg,
      '--rail-border': border,
      '--bg-elevated': elevated,
    };
  }

  function clearAppearanceColorOverrides() {
    APPEARANCE_COLOR_KEYS.forEach((k) => {
      document.body.style.removeProperty(k);
    });
  }

  async function syncBodyThemeFromAppearance() {
    let next = 'dark';
    const p = appearanceState.preset;
    if (p === 'default') {
      next = 'dark';
    } else if (p === 'custom') {
      next = isLightBg(appearanceState.custom.bg) ? 'light' : 'dark';
    } else if (p.startsWith('saved:')) {
      const id = p.slice(6);
      const entry = (appearanceState.savedPalettes || []).find((x) => x.id === id);
      const c = entry ? entry.custom : appearanceState.custom;
      next = isLightBg(c.bg) ? 'light' : 'dark';
    } else if (LIGHT_PRESETS.has(p)) {
      next = 'light';
    } else {
      next = 'dark';
    }
    themeName = next;
    document.body.className = 'theme-' + themeName;
    await saveConfig('theme.txt', themeName);
  }

  async function applyAppearance() {
    await syncBodyThemeFromAppearance();
    clearAppearanceColorOverrides();
    const preset = appearanceState.preset;
    if (preset === 'custom') {
      const t = deriveCustomTheme(appearanceState.custom);
      Object.entries(t).forEach(([k, v]) => {
        document.body.style.setProperty(k, v);
      });
    } else if (preset.startsWith('saved:')) {
      const id = preset.slice(6);
      const entry = (appearanceState.savedPalettes || []).find((x) => x.id === id);
      const c = entry ? entry.custom : appearanceState.custom;
      const t = deriveCustomTheme(c);
      Object.entries(t).forEach(([k, v]) => {
        document.body.style.setProperty(k, v);
      });
    } else if (preset !== 'default' && APPEARANCE_PRESETS[preset]) {
      Object.entries(APPEARANCE_PRESETS[preset]).forEach(([k, v]) => {
        document.body.style.setProperty(k, v);
      });
    }
  }

  async function loadAppearanceState() {
    try {
      const p = await window.api.getConfigPath('appearance.json');
      const raw = await window.api.readFile(p);
      if (raw) {
        const j = JSON.parse(raw);
        if (j && typeof j === 'object') {
          const allowedBuiltIn = [
            'default', 'midnight', 'ocean', 'warm', 'slate', 'mint_dark', 'ember', 'amethyst', 'charcoal', 'forest',
            'paper', 'frost', 'dawn', 'cream', 'mint', 'lilac', 'sand', 'chrome', 'blush',
            'custom',
          ];
          if (j.custom && typeof j.custom === 'object') {
            appearanceState.custom = normalizeCustomPalette(j.custom);
          }
          if (Array.isArray(j.savedPalettes)) {
            appearanceState.savedPalettes = j.savedPalettes
              .filter(
                (s) =>
                  s &&
                  typeof s === 'object' &&
                  typeof s.id === 'string' &&
                  typeof s.name === 'string' &&
                  s.custom &&
                  typeof s.custom === 'object'
              )
              .map((s) => ({
                id: s.id,
                name: String(s.name).slice(0, 64),
                custom: normalizeCustomPalette(s.custom),
              }))
              .slice(0, 20);
          }
          if (typeof j.preset === 'string') {
            const pr = j.preset;
            if (allowedBuiltIn.includes(pr)) {
              appearanceState.preset = pr;
            } else if (pr.startsWith('saved:')) {
              const sid = pr.slice(6);
              const found = (appearanceState.savedPalettes || []).find((x) => x.id === sid);
              if (found) {
                appearanceState.preset = pr;
                appearanceState.custom = { ...found.custom };
              }
            }
          }
        }
      }
    } catch (_) {}
  }

  async function saveAppearanceState() {
    const p = await window.api.getConfigPath('appearance.json');
    const ok = await window.api.writeFile(p, JSON.stringify(appearanceState), 'utf-8');
    if (ok === false) {
      showAlert('Settings', 'Could not save appearance settings to disk.');
    }
    return ok !== false;
  }

  function syncAppearanceUI() {
    syncPresetDropdownSavedOptions();
    let preset = appearanceState.preset;
    if (preset.startsWith('saved:')) {
      const sid = preset.slice(6);
      const found = (appearanceState.savedPalettes || []).find((x) => x.id === sid);
      if (!found) {
        appearanceState.preset = 'custom';
        preset = 'custom';
        void saveAppearanceState();
      }
    }
    const sel = $('appearance-preset');
    if (sel) sel.value = preset;
    const wrap = $('appearance-custom-wrap');
    const showCustom = preset === 'custom' || preset.startsWith('saved:');
    if (wrap) wrap.hidden = !showCustom;
    const c = appearanceState.custom;
    const setCol = (id, val) => {
      const el = $(id);
      if (el) el.value = val;
    };
    setCol('appearance-c-accent', c.accent);
    setCol('appearance-c-bg', c.bg);
    setCol('appearance-c-panel', c.panel);
    setCol('appearance-c-fg', c.fg);
    setCol('appearance-c-fgdim', c.fgDim);
    setCol('appearance-c-border', c.border);
    syncPaletteNameFromPreset();
  }

  function syncPaletteNameFromPreset() {
    const inp = $('appearance-palette-name');
    if (!inp) return;
    if (appearanceState.preset.startsWith('saved:')) {
      const sid = appearanceState.preset.slice(6);
      const entry = (appearanceState.savedPalettes || []).find((x) => x.id === sid);
      inp.value = entry ? entry.name : '';
    } else {
      inp.value = '';
    }
  }

  function initAppearanceUI() {
    const presetEl = $('appearance-preset');
    if (presetEl) {
      presetEl.addEventListener('change', async () => {
        const v = presetEl.value;
        if (v.startsWith('saved:')) {
          const id = v.slice(6);
          const entry = (appearanceState.savedPalettes || []).find((x) => x.id === id);
          if (!entry) return;
          appearanceState.custom = { ...entry.custom };
          appearanceState.preset = v;
        } else {
          appearanceState.preset = v;
        }
        await saveAppearanceState();
        syncAppearanceUI();
        await applyAppearance();
      });
    }
    const onCustomInput = async () => {
      appearanceState.preset = 'custom';
      appearanceState.custom.accent = $('appearance-c-accent').value;
      appearanceState.custom.bg = $('appearance-c-bg').value;
      appearanceState.custom.panel = $('appearance-c-panel').value;
      appearanceState.custom.fg = $('appearance-c-fg').value;
      appearanceState.custom.fgDim = $('appearance-c-fgdim').value;
      appearanceState.custom.border = $('appearance-c-border').value;
      const sel = $('appearance-preset');
      if (sel) sel.value = 'custom';
      const wrap = $('appearance-custom-wrap');
      if (wrap) wrap.hidden = false;
      await saveAppearanceState();
      await applyAppearance();
    };
    ['appearance-c-accent', 'appearance-c-bg', 'appearance-c-panel', 'appearance-c-fg', 'appearance-c-fgdim', 'appearance-c-border'].forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener('input', onCustomInput);
    });

    const savePaletteBtn = $('appearance-save-palette');
    if (savePaletteBtn) {
      savePaletteBtn.addEventListener('click', async () => {
        if (!appearanceState.savedPalettes) appearanceState.savedPalettes = [];
        if (appearanceState.savedPalettes.length >= 20) {
          showAlert('Palettes', 'You can keep at most 20 saved palettes.');
          return;
        }
        const n = appearanceState.savedPalettes.length + 1;
        const name = 'Palette ' + n;
        appearanceState.custom = readCustomFromInputs();
        const wrap = $('appearance-custom-wrap');
        if (wrap) wrap.hidden = false;
        const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
        appearanceState.savedPalettes.push({
          id,
          name,
          custom: { ...appearanceState.custom },
        });
        appearanceState.preset = 'saved:' + id;
        if (presetEl) presetEl.value = 'saved:' + id;
        const ok = await saveAppearanceState();
        if (!ok) return;
        syncAppearanceUI();
        await applyAppearance();
        showModBanner('Palette saved.');
      });
    }

    const renamePaletteBtn = $('appearance-rename-palette');
    if (renamePaletteBtn) {
      renamePaletteBtn.addEventListener('click', async () => {
        const pr = appearanceState.preset;
        if (!pr.startsWith('saved:')) {
          showAlert('Palettes', 'Choose a saved palette in Color preset (Saved section), then enter a new name here.');
          return;
        }
        const paletteId = pr.slice(6);
        const nameEl = $('appearance-palette-name');
        const newName = (nameEl && nameEl.value ? String(nameEl.value) : '').trim().slice(0, 64);
        if (!newName) {
          showAlert('Palettes', 'Enter a new name in the field above.');
          return;
        }
        const entry = (appearanceState.savedPalettes || []).find((x) => x.id === paletteId);
        if (!entry) return;
        entry.name = newName;
        const ok = await saveAppearanceState();
        if (!ok) return;
        syncAppearanceUI();
        await applyAppearance();
        showModBanner('Palette renamed.');
      });
    }

    const deletePaletteBtn = $('appearance-delete-palette');
    if (deletePaletteBtn) {
      deletePaletteBtn.addEventListener('click', async () => {
        const pr = appearanceState.preset;
        if (!pr.startsWith('saved:')) {
          showAlert('Palettes', 'Choose a saved palette in Color preset (Saved section) first.');
          return;
        }
        const id = pr.slice(6);
        appearanceState.savedPalettes = (appearanceState.savedPalettes || []).filter((x) => x.id !== id);
        appearanceState.preset = 'custom';
        if (presetEl) presetEl.value = 'custom';
        const ok = await saveAppearanceState();
        if (!ok) return;
        syncAppearanceUI();
        await applyAppearance();
        showModBanner('Saved palette removed.');
      });
    }
  }

  let birageUnlocked = false;
  let birageCaseRunning = false;
  let birageBuffer = '';

  /** Hex border for tier key from filename stem (red.png / pink1.png → red / pink). Unknown keys get a stable hue. */
  const BIRAGE_TIER_HEX = {
    red: '#e53935', crimson: '#c62828', scarlet: '#d32f2f',
    pink: '#ec407a', rose: '#f48fb1', magenta: '#d81b60',
    blue: '#1e88e5', navy: '#1565c0', cyan: '#00acc1', teal: '#00897b', sky: '#29b6f6',
    green: '#43a047', lime: '#cddc39', yellow: '#fdd835', gold: '#ffc107', orange: '#fb8c00',
    purple: '#8e24aa', violet: '#7e57c2', indigo: '#3949ab',
    black: '#424242', white: '#eceff1', gray: '#9e9e9e', grey: '#9e9e9e',
    brown: '#6d4c41', bronze: '#a1887f', silver: '#b0bec5',
  };

  function birageColorForTierKey(tierKey) {
    const k = (tierKey || '').toLowerCase();
    if (BIRAGE_TIER_HEX[k]) return BIRAGE_TIER_HEX[k];
    let h = 0;
    for (let i = 0; i < k.length; i++) {
      h = ((h << 5) - h) + k.charCodeAt(i);
      h |= 0;
    }
    return `hsl(${Math.abs(h) % 360} 58% 52%)`;
  }

  /** Drop odds (Besert-style): white common, red extremely rare. */
  const BIRAGE_DROP_WEIGHTS = [
    ['white', 0.80],
    ['lightBlue', 0.16],
    ['darkBlue', 0.032],
    ['purple', 0.0064],
    ['pink', 0.00128],
    ['red', 0.000256],
  ];
  const BIRAGE_DROP_SUM = BIRAGE_DROP_WEIGHTS.reduce((a, [, w]) => a + w, 0);

  function tierKeyToBirageBucket(tierKey) {
    const k = (tierKey || '').toLowerCase();
    if (['red', 'crimson', 'scarlet'].includes(k)) return 'red';
    if (['pink', 'rose'].includes(k)) return 'pink';
    if (['purple', 'violet', 'magenta'].includes(k)) return 'purple';
    if (['navy', 'indigo'].includes(k)) return 'darkBlue';
    if (['blue', 'cyan', 'teal', 'sky'].includes(k)) return 'lightBlue';
    return 'white';
  }

  function buildBirageBucketMap(pool) {
    const map = {
      white: [], lightBlue: [], darkBlue: [], purple: [], pink: [], red: [],
    };
    for (let i = 0; i < pool.length; i++) {
      const sk = pool[i];
      const b = tierKeyToBirageBucket(sk.tierKey);
      if (map[b]) map[b].push(sk);
    }
    return map;
  }

  function pickSkinByDropOdds(pool, byBucket) {
    if (!pool.length) return null;
    function onePick() {
      const r = Math.random() * BIRAGE_DROP_SUM;
      let acc = 0;
      for (let i = 0; i < BIRAGE_DROP_WEIGHTS.length; i++) {
        const bucket = BIRAGE_DROP_WEIGHTS[i][0];
        acc += BIRAGE_DROP_WEIGHTS[i][1];
        if (r <= acc) {
          const list = byBucket[bucket];
          if (list && list.length) {
            return list[Math.floor(Math.random() * list.length)];
          }
          return null;
        }
      }
      return null;
    }
    let sk = onePick();
    if (sk) return sk;
    for (let attempt = 0; attempt < 48; attempt++) {
      sk = onePick();
      if (sk) return sk;
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function setBirageRailVisible(show) {
    const btn = $('rail-birage');
    if (!btn) return;
    btn.classList.toggle('hidden', !show);
    btn.hidden = !show;
  }

  async function initBirage() {
    birageUnlocked = false;
    setBirageRailVisible(false);
    const railBirage = $('rail-birage');
    const openBtn = $('birage-open-btn');
    if (railBirage) {
      railBirage.addEventListener('click', () => {
        if (!birageUnlocked) return;
        showPage('birage');
      });
    }
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        if (!birageCaseRunning) runBirageCase();
      });
    }
    const birageSteamLink = $('birage-steam-link');
    if (birageSteamLink && window.api.openExternal) {
      birageSteamLink.addEventListener('click', (e) => {
        e.preventDefault();
        const href = birageSteamLink.getAttribute('href');
        if (href) void window.api.openExternal(href);
      });
    }
  }

  /** Reserve case viewport size (same as rolling) so the Open case button does not jump. */
  function layoutBirageViewport() {
    const viewportEl = $('birage-viewport');
    const innerEl = viewportEl && viewportEl.closest('.birage-page-inner');
    const wrap = $('birage-strip-wrap');
    if (!viewportEl || !innerEl) return null;
    const pageBirage = $('page-birage');
    if (pageBirage && pageBirage.classList.contains('hidden')) return null;

    const NUM_VISIBLE_ITEMS = 5;
    const borderTotal = 4;
    void innerEl.offsetWidth;
    const innerW = innerEl.clientWidth;
    const targetInner = Math.min(Math.max(innerW - 48, 300), 680);
    let itemW = Math.floor(targetInner / NUM_VISIBLE_ITEMS);
    itemW = Math.max(72, Math.min(132, itemW));
    viewportEl.style.width = NUM_VISIBLE_ITEMS * itemW + borderTotal + 'px';
    viewportEl.style.height = itemW + borderTotal + 'px';
    void viewportEl.offsetWidth;
    if (!wrap) return { itemW, numVisible: NUM_VISIBLE_ITEMS };
    void wrap.offsetWidth;
    const wrapW = wrap.clientWidth;
    const ITEM_W = Math.max(1, Math.floor(wrapW / NUM_VISIBLE_ITEMS));
    viewportEl.style.height = ITEM_W + borderTotal + 'px';
    return { itemW: ITEM_W, numVisible: NUM_VISIBLE_ITEMS };
  }

  async function runBirageCase() {
    const strip = $('birage-strip');
    const wrap = $('birage-strip-wrap');
    const viewportEl = $('birage-viewport');
    const openBtn = $('birage-open-btn');
    if (!strip || !wrap || !viewportEl || birageCaseRunning) return;

    birageCaseRunning = true;
    if (openBtn) openBtn.disabled = true;

    /** Matches biragepackage_sample.py: REEL_ITEMS_COUNT, NUM_VISIBLE_ITEMS, easing, wobble, clamp. */
    const REEL_ITEMS_COUNT = 45;
    const NUM_VISIBLE_ITEMS = 5;
    const targetIndex = Math.floor(REEL_ITEMS_COUNT / 2);
    const centerSlot = Math.floor(NUM_VISIBLE_ITEMS / 2);

    const dim = layoutBirageViewport();
    const ITEM_W = dim ? dim.itemW : 100;
    const ITEM_H = ITEM_W;

    let skinPool = [];
    if (window.api.birageLoadSkinsData) {
      const pack = await window.api.birageLoadSkinsData(null);
      if (pack && pack.ok && pack.skins && pack.skins.length) {
        skinPool = pack.skins;
      }
    }

    const skinsByBucket = buildBirageBucketMap(skinPool);

    function randomSkin() {
      return pickSkinByDropOdds(skinPool, skinsByBucket);
    }

    function makePlaceholderDataUrl(hex, w, h) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect fill="${hex}" width="100%" height="100%"/><text x="50%" y="50%" fill="rgba(0,0,0,.35)" font-size="11" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">?</text></svg>`;
      return 'data:image/svg+xml,' + encodeURIComponent(svg);
    }

    const winningSkin = randomSkin();
    const reelData = [];
    for (let i = 0; i < REEL_ITEMS_COUNT; i++) {
      const sk = i === targetIndex ? winningSkin : randomSkin();
      if (sk) {
        const border = birageColorForTierKey(sk.tierKey);
        reelData.push({ src: sk.dataUrl, border });
      } else {
        const ph = '#5c5c5c';
        reelData.push({ src: makePlaceholderDataUrl(ph, ITEM_W, ITEM_H), border: ph });
      }
    }

    strip.innerHTML = '';
    strip.style.transform = 'translateX(0px)';
    reelData.forEach((item) => {
      const cell = document.createElement('div');
      cell.className = 'birage-cell';
      cell.style.width = ITEM_W + 'px';
      cell.style.height = ITEM_H + 'px';
      cell.style.border = '3px solid ' + item.border;
      const img = document.createElement('img');
      img.src = item.src;
      img.alt = '';
      img.draggable = false;
      cell.appendChild(img);
      strip.appendChild(cell);
    });

    const targetStartX = (targetIndex - centerSlot) * ITEM_W;
    const maxScroll = (REEL_ITEMS_COUNT - NUM_VISIBLE_ITEMS) * ITEM_W;
    const duration = 3800;
    const start = performance.now();

    function easeOutQuart(t) {
      return 1 - Math.pow(1 - t, 4);
    }

    function tick(now) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = easeOutQuart(t);
      let currentTargetScroll = eased * targetStartX;
      let finalWobble = 0;
      if (t > 0.95) {
        const wobbleIntensity = (1 - (1 - t) / 0.05) * 3;
        finalWobble = (Math.random() - 0.5) * 2 * wobbleIntensity;
      }
      const scroll = Math.max(0, Math.min(currentTargetScroll + finalWobble, maxScroll));
      strip.style.transform = 'translateX(' + (-scroll) + 'px)';
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        birageCaseRunning = false;
        if (openBtn) openBtn.disabled = false;
      }
    }
    requestAnimationFrame(tick);
  }

  async function unlockBirageEasterEgg() {
    if (birageUnlocked) return;
    birageUnlocked = true;
    setBirageRailVisible(true);
    showModBanner('Something was unlocked.');
  }

  async function initConfig() {
    bootSplashShownAt = Date.now();
    scheduleBootSplashSkipButton();
    try {
      appDataPath = await window.api.getAppDataPath();
      const savedDir = await loadConfig('mods_dir.txt', '');
      if (savedDir) {
        modsDir = savedDir;
        pathInput.value = modsDirDisplayPath(modsDir);
      }
      await loadAppearanceState();
      await applyAppearance();
      syncAppearanceUI();
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
      await refreshWelcomeMessage();
      await applyHomeVersion();
    } catch (err) {
      console.error('initConfig error:', err);
    }
    checkJumpscareChance();
    await maybeStartupUpdateCheck();
    await initBirage();
    const elapsed = Date.now() - bootSplashShownAt;
    const waitMore = Math.max(0, BOOT_SPLASH_MIN_MS - elapsed);
    if (waitMore > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMore));
    }
    dismissBootSplash();
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

  function setWelcomeMessageWithLinks(homeMsg, text) {
    homeMsg.textContent = '';
    const parts = text.split(/(https?:\/\/[^\s]+)/gi);
    parts.forEach((part) => {
      if (!part) return;
      if (/^https?:\/\//i.test(part)) {
        const a = document.createElement('a');
        a.href = part;
        a.textContent = part;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'home-welcome-link';
        homeMsg.appendChild(a);
      } else {
        homeMsg.appendChild(document.createTextNode(part));
      }
    });
  }

  async function refreshWelcomeMessage() {
    const homeMsg = $('home-message');
    if (!homeMsg) return;
    const msg = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
    if (msg.startsWith('img:')) {
      const img = document.createElement('img');
      const path = msg.slice(4);
      img.src = path;
      img.className = 'home-welcome-img';
      if (path.includes('welcome_besert') || path.includes('welcome_manga_cat')) img.classList.add('home-welcome-img--strip');
      img.alt = '';
      img.draggable = false;
      homeMsg.textContent = '';
      homeMsg.appendChild(img);
    } else if (msg.startsWith('video:')) {
      const rawPath = msg.slice(6);
      homeMsg.textContent = '';
      const video = document.createElement('video');
      video.className = 'home-welcome-video';
      video.controls = true;
      video.playsInline = true;
      video.setAttribute('preload', 'metadata');
      video.setAttribute('aria-label', 'Welcome clip');
      homeMsg.appendChild(video);
      if (/^[a-zA-Z]:[\\/]/.test(rawPath) || rawPath.startsWith('/')) {
        if (window.api.pathToFileUrl) {
          const src = await window.api.pathToFileUrl(rawPath);
          if (src) video.src = src;
        }
      } else {
        video.src = rawPath;
      }
    } else {
      setWelcomeMessageWithLinks(homeMsg, msg);
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
    if (page === 'birage' && !birageUnlocked) return;
    if (page === currentPage) return;
    const homeEl = $('page-home');
    const modsEl = $('page-mods');
    const settingsEl = $('page-settings');
    const birageEl = $('page-birage');
    const crosshairEl = $('page-crosshair');
    const navHome = $('nav-home');
    const navMods = $('nav-mods');
    const navSettings = $('nav-settings');
    const navBirage = $('rail-birage');
    const navCrosshair = $('nav-crosshair');

    const map = { home: homeEl, mods: modsEl, settings: settingsEl, birage: birageEl, crosshair: crosshairEl };
    const outgoing = map[currentPage];
    const incoming = map[page];
    if (!incoming || !outgoing) return;

    outgoing.classList.add('hidden');
    incoming.classList.remove('hidden');
    incoming.classList.add('page-enter');
    void incoming.offsetWidth;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        incoming.classList.remove('page-enter');
      });
    });

    if (navHome) navHome.classList.toggle('is-active', page === 'home');
    if (navMods) navMods.classList.toggle('is-active', page === 'mods');
    if (navSettings) navSettings.classList.toggle('is-active', page === 'settings');
    if (navBirage) navBirage.classList.toggle('is-active', page === 'birage');
    if (navCrosshair) navCrosshair.classList.toggle('is-active', page === 'crosshair');
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
    if (page === 'birage') {
      layoutBirageViewport();
      requestAnimationFrame(() => layoutBirageViewport());
    }
    if (page === 'crosshair' && typeof crosshairRefreshPreview === 'function') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => crosshairRefreshPreview());
      });
    }
    if (page === 'crosshair' && typeof crosshairRefreshRestore === 'function') {
      requestAnimationFrame(() => crosshairRefreshRestore());
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
      const row = document.createElement('div');
      row.className = 'mod-row';
      row.dataset.filename = filename;
      row.dataset.enabled = String(enabled);
      row.dataset.sortOrder = String(i);

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

      row.appendChild(toggleWrap);
      row.appendChild(labelBlock);
      row.appendChild(metaCol);
      row.appendChild(actionsWrap);
      frag.appendChild(row);
    }));
    const sorted = Array.from(frag.children).sort((a, b) => Number(a.dataset.sortOrder) - Number(b.dataset.sortOrder));
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
      discordToggle.textContent = text + 'Off';
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

  function formatBytesShort(n) {
    if (typeof n !== 'number' || !isFinite(n) || n < 0) return '';
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < u.length - 1) {
      v /= 1024;
      i++;
    }
    if (i === 0) return String(Math.round(v)) + ' ' + u[i];
    return (v >= 10 ? v.toFixed(0) : v.toFixed(1)) + ' ' + u[i];
  }

  function showUpdateDownloadProgressUI(data) {
    const pct = typeof data.percent === 'number' ? Math.min(100, Math.max(0, data.percent)) : 0;
    const bar = $('update-download-banner-fill');
    const msg = $('update-download-banner-msg');
    const sub = $('update-download-banner-sub');
    const wrap = $('update-download-banner');
    if (msg) msg.textContent = 'Downloading update… ' + Math.round(pct) + '%';
    if (bar) bar.style.width = pct + '%';
    if (sub) {
      const parts = [];
      if (data.transferred != null && data.total != null && data.total > 0) {
        parts.push(formatBytesShort(data.transferred) + ' / ' + formatBytesShort(data.total));
      }
      if (data.bytesPerSecond != null && data.bytesPerSecond > 0) {
        parts.push(formatBytesShort(data.bytesPerSecond) + '/s');
      }
      sub.textContent = parts.join(' · ');
    }
    if (wrap) {
      wrap.hidden = false;
      wrap.classList.add('is-visible');
      wrap.setAttribute('aria-hidden', 'false');
    }
  }

  function hideUpdateDownloadBanner() {
    const wrap = $('update-download-banner');
    if (!wrap) return;
    wrap.classList.remove('is-visible');
    wrap.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      if (!wrap.classList.contains('is-visible')) wrap.hidden = true;
    }, 420);
  }

  let updateInstallQueued = false;
  function showUpdateInstallingAndQuit() {
    if (updateInstallQueued) return;
    updateInstallQueued = true;
    const msg = $('update-download-banner-msg');
    const sub = $('update-download-banner-sub');
    const bar = $('update-download-banner-fill');
    const wrap = $('update-download-banner');
    if (msg) msg.textContent = 'Installing update…';
    if (sub) sub.textContent = 'The app will restart shortly.';
    if (bar) bar.style.width = '100%';
    if (wrap) {
      wrap.hidden = false;
      wrap.classList.add('is-visible');
      wrap.setAttribute('aria-hidden', 'false');
    }
    setTimeout(() => {
      if (window.api.quitAndInstall) window.api.quitAndInstall();
    }, 650);
  }

  function initAppUpdateDownloadListeners() {
    if (!window.api.onUpdateDownloadProgress) return;
    window.api.onUpdateDownloadProgress((data) => {
      showUpdateDownloadProgressUI(data);
    });
    window.api.onUpdateDownloaded(() => {
      showUpdateInstallingAndQuit();
    });
    window.api.onUpdateDownloadError((payload) => {
      hideUpdateDownloadBanner();
      const m = payload && payload.message ? String(payload.message) : 'Update download failed.';
      showModBanner(m);
    });
  }

  async function beginAppUpdateDownload() {
    showUpdateDownloadProgressUI({ percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 });
    setUpdatesPanelOpen(true);
    if (!window.api.downloadUpdate) {
      hideUpdateDownloadBanner();
      showModBanner('Update download is not available.');
      return;
    }
    const d = await window.api.downloadUpdate();
    if (!d || !d.ok) {
      hideUpdateDownloadBanner();
      showModBanner(d && d.message ? d.message : 'Could not start download.');
    }
  }

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
          await beginAppUpdateDownload();
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
  const navCrosshairBtn = $('nav-crosshair');
  if (navCrosshairBtn) navCrosshairBtn.addEventListener('click', () => showPage('crosshair'));
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
        void refreshWelcomeMessage();
      } else {
        dashPressTimer = setTimeout(() => { dashPressCount = 0; dashPressTimer = null; }, 500);
      }
    }
    if (currentPage === 'home' && !inInput && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        birageBuffer = (birageBuffer + e.key.toLowerCase()).slice(-32);
        if (birageBuffer.includes('birage') || birageBuffer.includes('besert')) {
          birageBuffer = '';
          void unlockBirageEasterEgg();
        }
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
        await beginAppUpdateDownload();
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

  const bootSplashSkip = $('boot-splash-skip');
  if (bootSplashSkip) {
    bootSplashSkip.addEventListener('click', () => dismissBootSplash());
  }

  const CROSSHAIR_PRESETS_FILE = 'crosshair_presets.json';

  function crosshairFmtFloat6(n) {
    const x = Number(n);
    if (!isFinite(x)) return '0.000000';
    return x.toFixed(6);
  }

  function crosshairFormatUnrealColor(r, g, b, a) {
    return `(R=${crosshairFmtFloat6(r)},G=${crosshairFmtFloat6(g)},B=${crosshairFmtFloat6(b)},A=${crosshairFmtFloat6(a)})`;
  }

  function crosshairParseUnrealColor(s) {
    const m = String(s).match(/R=([\d.]+)\s*,\s*G=([\d.]+)\s*,\s*B=([\d.]+)\s*,\s*A=([\d.]+)/);
    if (!m) return { r: 1, g: 1, b: 1, a: 1 };
    return { r: parseFloat(m[1]), g: parseFloat(m[2]), b: parseFloat(m[3]), a: parseFloat(m[4]) };
  }

  function crosshairRgb01ToHex(r, g, b) {
    const t = (x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0');
    return '#' + t(r) + t(g) + t(b);
  }

  function crosshairHexToRgb01(hex) {
    const h = String(hex).replace('#', '');
    if (h.length !== 6) return { r: 1, g: 1, b: 1 };
    return {
      r: parseInt(h.slice(0, 2), 16) / 255,
      g: parseInt(h.slice(2, 4), 16) / 255,
      b: parseInt(h.slice(4, 6), 16) / 255,
    };
  }

  function crosshairDefaults() {
    return {
      CrosshairsBarWidth: '2.000000',
      CrosshairsBarLength: '5.000000',
      CrosshairsDotSize: '1.000000',
      bCrosshairsShowAccuracy: 'False',
      CrosshairsCenterGap: '2.500000',
      CrosshairsBarColor: '(R=1.000000,G=1.000000,B=1.000000,A=1.000000)',
      CrosshairsDotColor: '(R=1.000000,G=1.000000,B=1.000000,A=0.000000)',
    };
  }

  const CS2_SHARECODE_DICT = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefhijkmnopqrstuvwxyz23456789';
  const CS2_SHARECODE_RE = /^CSGO-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/;
  const CS2_COLOR_PRESETS = [
    [250, 50, 50],
    [50, 250, 50],
    [250, 250, 50],
    [50, 50, 250],
    [50, 250, 250],
  ];

  function decodeCS2CrosshairCode(shareCode) {
    const trimmed = shareCode.trim();
    if (!CS2_SHARECODE_RE.test(trimmed)) return null;
    const code = trimmed.slice(5).replace(/-/g, '');
    const chars = code.split('').reverse();
    let big = 0n;
    const base = BigInt(CS2_SHARECODE_DICT.length);
    for (const c of chars) {
      const idx = CS2_SHARECODE_DICT.indexOf(c);
      if (idx < 0) return null;
      big = big * base + BigInt(idx);
    }
    const hex = big.toString(16).padStart(38, '0');
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.slice(i, i + 2), 16));
    }
    const colorIndex = bytes[11] & 7;
    let red, green, blue;
    if (colorIndex >= 0 && colorIndex <= 4) {
      [red, green, blue] = CS2_COLOR_PRESETS[colorIndex];
    } else {
      red = bytes[5];
      green = bytes[6];
      blue = bytes[7];
    }
    return {
      gap: (bytes[3] > 127 ? bytes[3] - 256 : bytes[3]) / 10,
      red,
      green,
      blue,
      alpha: bytes[8],
      colorIndex,
      thickness: (bytes[13] & 0x3F) / 10,
      length: (((bytes[16] & 0x1F) << 8) + bytes[15]) / 10,
      hasCenterDot: (bytes[14] & 0x10) !== 0,
      hasOutline: (bytes[11] & 8) !== 0,
      useAlpha: (bytes[14] & 0x40) !== 0,
    };
  }

  function cs2CrosshairToPD3(cs2) {
    if (!cs2) return null;
    const r = cs2.red / 255;
    const g = cs2.green / 255;
    const b = cs2.blue / 255;
    const a = cs2.useAlpha ? cs2.alpha / 255 : 1;
    const dotA = cs2.hasCenterDot ? 1 : 0;
    const pd3Width = cs2.thickness * 2;
    const pd3Length = cs2.length * 1.4;
    const pd3Gap = cs2.gap * -0.1425 + 0.86;
    return {
      CrosshairsBarWidth: crosshairFmtFloat6(pd3Width),
      CrosshairsBarLength: crosshairFmtFloat6(pd3Length),
      CrosshairsDotSize: crosshairFmtFloat6(cs2.hasCenterDot ? 1 : 0),
      bCrosshairsShowAccuracy: 'False',
      CrosshairsCenterGap: crosshairFmtFloat6(pd3Gap),
      CrosshairsBarColor: crosshairFormatUnrealColor(r, g, b, a),
      CrosshairsDotColor: crosshairFormatUnrealColor(r, g, b, dotA),
    };
  }

  function crosshairExtractIniKey(content, key) {
    const lines = content.split(/\r?\n/);
    const prefix = key + '=';
    for (const line of lines) {
      const t = line.trimStart();
      if (t.startsWith(prefix)) {
        return line.slice(line.indexOf('=') + 1).trim();
      }
    }
    return null;
  }

  function crosshairMergeFromIni(content) {
    const d = crosshairDefaults();
    Object.keys(d).forEach((k) => {
      const v = crosshairExtractIniKey(content, k);
      if (v != null && v !== '') d[k] = v;
    });
    return d;
  }

  function crosshairTupleToRgbaCss(tupleStr) {
    const o = crosshairParseUnrealColor(tupleStr);
    const r = Number.isFinite(o.r) ? o.r : 1;
    const g = Number.isFinite(o.g) ? o.g : 1;
    const b = Number.isFinite(o.b) ? o.b : 1;
    const a = Number.isFinite(o.a) ? o.a : 1;
    const ri = Math.round(r * 255);
    const gi = Math.round(g * 255);
    const bi = Math.round(b * 255);
    if (a >= 0.99) return `rgb(${ri},${gi},${bi})`;
    return `rgba(${ri},${gi},${bi},${a})`;
  }

  function crosshairMergeRepForPreview(rep) {
    const d = crosshairDefaults();
    if (!rep || typeof rep !== 'object') return d;
    const out = { ...d };
    Object.keys(d).forEach((k) => {
      if (rep[k] != null && rep[k] !== '') out[k] = String(rep[k]);
    });
    return out;
  }

  function crosshairPx(repKey, scale, defNum, allowNegative) {
    const v = parseFloat(repKey);
    const n = Number.isFinite(v) ? v : defNum;
    const scaled = n * scale;
    if (allowNegative) return scaled;
    return Math.max(0, scaled);
  }

  const CROSSHAIR_BG_COUNT = 5;
  const CROSSHAIR_BG_PATHS = [
    null,
    null,
    'assets/crosshair_bg_1.png',
    'assets/crosshair_bg_2.png',
    'assets/crosshair_bg_3.png',
  ];
  const CROSSHAIR_BG_SOLIDS = ['#000000', '#ffffff', null, null, null];
  const crosshairBgImages = CROSSHAIR_BG_PATHS.map((src) => {
    if (!src) return null;
    const img = new Image();
    img.src = src;
    return img;
  });

  /** Approximate PD3-style cross: four bars + optional center dot (game-style framed preview). */
  function crosshairDrawPreview(canvas, rep, bgIdx) {
    if (!canvas) return;
    const merged = crosshairMergeRepForPreview(rep);
    const parent = canvas.parentElement;
    if (!parent) return;
    let cw = Math.floor(parent.clientWidth);
    let ch = Math.floor(parent.clientHeight);
    if (cw < 2 || ch < 2) {
      const r = parent.getBoundingClientRect();
      if (cw < 2) cw = Math.floor(r.width);
      if (ch < 2) ch = Math.floor(r.height);
    }
    if (!Number.isFinite(cw) || cw < 2) cw = 320;
    if (!Number.isFinite(ch) || ch < 2) ch = Math.round((cw * 9) / 16);
    cw = Math.max(64, cw);
    ch = Math.max(64, ch);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.floor(cw * dpr);
    canvas.height = Math.floor(ch * dpr);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const solidColor = CROSSHAIR_BG_SOLIDS[bgIdx];
    if (solidColor) {
      ctx.fillStyle = solidColor;
      ctx.fillRect(0, 0, cw, ch);
    } else {
      const bgImg = crosshairBgImages[bgIdx];
      if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        const imgAr = bgImg.naturalWidth / bgImg.naturalHeight;
        const canAr = cw / ch;
        let sx, sy, sw, sh;
        if (imgAr > canAr) {
          sh = bgImg.naturalHeight;
          sw = sh * canAr;
          sx = (bgImg.naturalWidth - sw) / 2;
          sy = 0;
        } else {
          sw = bgImg.naturalWidth;
          sh = sw / canAr;
          sx = 0;
          sy = (bgImg.naturalHeight - sh) / 2;
        }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
      } else {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, cw, ch);
      }
    }

    const innerSide = Math.round(Math.min(cw, ch) * 0.5);
    const ix = Math.round((cw - innerSide) / 2);
    const iy = Math.round((ch - innerSide) / 2);

    const cx = cw / 2;
    const cy = ch / 2;
    const pxPerUnit = Math.max(0.82, Math.min(2.05, innerSide / 118));
    const bw = Math.max(1, Math.round(crosshairPx(merged.CrosshairsBarWidth, pxPerUnit, 2)));
    const bl = Math.max(0, Math.round(crosshairPx(merged.CrosshairsBarLength, pxPerUnit, 5)));
    const cg = Math.round(crosshairPx(merged.CrosshairsCenterGap, pxPerUnit, 2.5, true));
    const ds = Math.max(0, Math.round(crosshairPx(merged.CrosshairsDotSize, pxPerUnit, 1)));
    const barCss = crosshairTupleToRgbaCss(merged.CrosshairsBarColor);
    const dotCss = crosshairTupleToRgbaCss(merged.CrosshairsDotColor);
    function drawBar(x, y, w, h) {
      ctx.fillStyle = barCss;
      ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
    }
    if (bl > 0 && bw > 0) {
      const bx = Math.round(cx - bw / 2);
      const by = Math.round(cy - bw / 2);
      drawBar(bx, Math.round(cy - cg - bl), bw, bl);
      drawBar(bx, Math.round(cy + cg), bw, bl);
      drawBar(Math.round(cx - cg - bl), by, bl, bw);
      drawBar(Math.round(cx + cg), by, bl, bw);
    }
    if (ds > 0) {
      const side = Math.max(1, ds);
      ctx.fillStyle = dotCss;
      ctx.fillRect(Math.round(cx - side / 2), Math.round(cy - side / 2), side, side);
    }
    if (/^true$/i.test(String(merged.bCrosshairsShowAccuracy || ''))) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '600 10px system-ui, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('ACC', Math.round(cx), iy + innerSide - 8);
    }
  }

  function initCrosshairUI() {
    const pathEl = $('crosshair-ini-path');
    const loadBtn = $('crosshair-load-from-game');
    const saveBtn = $('crosshair-save-to-game');
    const barW = $('crosshair-bar-width');
    const barL = $('crosshair-bar-length');
    const dotS = $('crosshair-dot-size');
    const gap = $('crosshair-center-gap');
    const showAcc = $('crosshair-show-accuracy');
    const barCol = $('crosshair-bar-color');
    const barA = $('crosshair-bar-alpha');
    const dotCol = $('crosshair-dot-color');
    const dotA = $('crosshair-dot-alpha');
    const presetSelect = $('crosshair-preset-select');
    const presetName = $('crosshair-preset-name');
    const presetSave = $('crosshair-preset-save');
    const presetLoad = $('crosshair-preset-load');
    const presetDelete = $('crosshair-preset-delete');
    const crosshairIniBrowse = $('crosshair-ini-browse');
    const crosshairIniClear = $('crosshair-ini-clear');
    const restoreIniBtn = $('crosshair-restore-ini');
    if (!loadBtn || !saveBtn || !barW || !presetSelect) return;

    const previewCanvas = $('crosshair-preview-canvas');

    function clamp255(n) {
      const x = Math.round(Number(n));
      if (!isFinite(x)) return 0;
      return Math.max(0, Math.min(255, x));
    }

    function normalizeHex6(s) {
      const t = String(s || '').trim();
      const m = t.match(/^#?([0-9a-fA-F]{6})$/);
      if (!m) return null;
      return '#' + m[1].toLowerCase();
    }

    function crosshairPrefixForColorKind(kind) {
      return kind === 'bar' ? 'crosshair-bar-color' : 'crosshair-dot-color';
    }

    function crosshairRgb255ToHsv(r, g, b) {
      r /= 255;
      g /= 255;
      b /= 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      let h = 0;
      if (d !== 0) {
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
        h *= 360;
      }
      const s = max === 0 ? 0 : d / max;
      const v = max;
      return { h, s, v };
    }

    function crosshairHsvToRgb255(h, s, v) {
      h = ((h % 360) + 360) % 360;
      const c = v * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = v - c;
      let r0;
      let g0;
      let b0;
      if (h < 60) {
        r0 = c;
        g0 = x;
        b0 = 0;
      } else if (h < 120) {
        r0 = x;
        g0 = c;
        b0 = 0;
      } else if (h < 180) {
        r0 = 0;
        g0 = c;
        b0 = x;
      } else if (h < 240) {
        r0 = 0;
        g0 = x;
        b0 = c;
      } else if (h < 300) {
        r0 = x;
        g0 = 0;
        b0 = c;
      } else {
        r0 = c;
        g0 = 0;
        b0 = x;
      }
      return {
        r: clamp255((r0 + m) * 255),
        g: clamp255((g0 + m) * 255),
        b: clamp255((b0 + m) * 255),
      };
    }

    function crosshairDrawSVPlane(canvas, hDeg) {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      const hNorm = ((hDeg % 360) + 360) % 360;
      const c = crosshairHsvToRgb255(hNorm, 1, 1);
      const topRight = `rgb(${c.r},${c.g},${c.b})`;
      const gradH = ctx.createLinearGradient(0, 0, w, 0);
      gradH.addColorStop(0, '#ffffff');
      gradH.addColorStop(1, topRight);
      ctx.fillStyle = gradH;
      ctx.fillRect(0, 0, w, h);
      const gradV = ctx.createLinearGradient(0, 0, 0, h);
      gradV.addColorStop(0, 'rgba(0,0,0,0)');
      gradV.addColorStop(1, '#000000');
      ctx.fillStyle = gradV;
      ctx.fillRect(0, 0, w, h);
    }

    function crosshairUpdateGripFromSV(gripEl, s, v) {
      if (!gripEl) return;
      const ss = Math.max(0, Math.min(1, s));
      const vv = Math.max(0, Math.min(1, v));
      gripEl.style.left = `${ss * 100}%`;
      gripEl.style.top = `${(1 - vv) * 100}%`;
    }

    function setInlineSlidersFromHex(kind, hex) {
      const n = normalizeHex6(hex) || '#ffffff';
      const rgb = crosshairHexToRgb01(n);
      const R = Math.round(rgb.r * 255);
      const G = Math.round(rgb.g * 255);
      const B = Math.round(rgb.b * 255);
      const p = crosshairPrefixForColorKind(kind);
      const rN = $(`${p}-r-num`);
      const gN = $(`${p}-g-num`);
      const bN = $(`${p}-b-num`);
      const hexEl = $(`${p}-hex`);
      const hueRange = $(`${p}-hue-range`);
      const svCanvas = $(`${p}-sv`);
      const grip = $(`${p}-sv-grip`);
      if (rN) rN.value = String(R);
      if (gN) gN.value = String(G);
      if (bN) bN.value = String(B);
      if (hexEl) hexEl.value = n;
      const hsv = crosshairRgb255ToHsv(R, G, B);
      if (hueRange) {
        if (hsv.s > 0.001) hueRange.value = String(Math.round(hsv.h));
        const hPlane = parseFloat(hueRange.value) || 0;
        if (svCanvas) crosshairDrawSVPlane(svCanvas, hPlane);
        if (grip) crosshairUpdateGripFromSV(grip, hsv.s, hsv.v);
      }
      const strip = $(`crosshair-${kind}-color-strip`);
      if (strip) strip.style.background = n;
    }

    function hexFromInlineSliders(kind) {
      const p = crosshairPrefixForColorKind(kind);
      const rN = $(`${p}-r-num`);
      const gN = $(`${p}-g-num`);
      const bN = $(`${p}-b-num`);
      const r = clamp255(rN ? rN.value : 255);
      const g = clamp255(gN ? gN.value : 255);
      const b = clamp255(bN ? bN.value : 255);
      return crosshairRgb01ToHex(r / 255, g / 255, b / 255);
    }

    function commitInlineColor(kind) {
      const hidden = kind === 'bar' ? barCol : dotCol;
      const hex = hexFromInlineSliders(kind);
      if (hidden) hidden.value = hex;
      const p = crosshairPrefixForColorKind(kind);
      const hexEl = $(`${p}-hex`);
      if (hexEl) hexEl.value = hex;
      const strip = $(`crosshair-${kind}-color-strip`);
      if (strip) strip.style.background = hex;
      const rN = $(`${p}-r-num`);
      const gN = $(`${p}-g-num`);
      const bN = $(`${p}-b-num`);
      const r = clamp255(rN ? rN.value : 255);
      const g = clamp255(gN ? gN.value : 255);
      const b = clamp255(bN ? bN.value : 255);
      const hsv = crosshairRgb255ToHsv(r, g, b);
      const hueRange = $(`${p}-hue-range`);
      const svCanvas = $(`${p}-sv`);
      const grip = $(`${p}-sv-grip`);
      if (hueRange) {
        if (hsv.s > 0.001) hueRange.value = String(Math.round(hsv.h));
        const hPlane = parseFloat(hueRange.value) || 0;
        if (svCanvas) crosshairDrawSVPlane(svCanvas, hPlane);
        if (grip) crosshairUpdateGripFromSV(grip, hsv.s, hsv.v);
      }
      updatePreview();
    }

    function wireCrosshairColorInline(kind) {
      const p = crosshairPrefixForColorKind(kind);
      const hidden = kind === 'bar' ? barCol : dotCol;
      const svCanvas = $(`${p}-sv`);
      const hueRange = $(`${p}-hue-range`);
      const rN = $(`${p}-r-num`);
      const gN = $(`${p}-g-num`);
      const bN = $(`${p}-b-num`);

      if (hueRange) {
        hueRange.addEventListener('input', () => {
          const r = clamp255(rN ? rN.value : 255);
          const g = clamp255(gN ? gN.value : 255);
          const b = clamp255(bN ? bN.value : 255);
          const { s, v } = crosshairRgb255ToHsv(r, g, b);
          const h = parseFloat(hueRange.value);
          const rgb = crosshairHsvToRgb255(h, s, v);
          if (rN) rN.value = String(rgb.r);
          if (gN) gN.value = String(rgb.g);
          if (bN) bN.value = String(rgb.b);
          commitInlineColor(kind);
        });
      }

      function applySV(clientX, clientY) {
        if (!svCanvas || !hueRange) return;
        const rect = svCanvas.getBoundingClientRect();
        const s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const v = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
        const h = parseFloat(hueRange.value);
        const rgb = crosshairHsvToRgb255(h, s, v);
        if (rN) rN.value = String(rgb.r);
        if (gN) gN.value = String(rgb.g);
        if (bN) bN.value = String(rgb.b);
        commitInlineColor(kind);
      }

      let svDragging = false;
      if (svCanvas) {
        svCanvas.addEventListener('pointerdown', (e) => {
          if (!hueRange) return;
          svDragging = true;
          try {
            svCanvas.setPointerCapture(e.pointerId);
          } catch (_) {}
          applySV(e.clientX, e.clientY);
        });
        svCanvas.addEventListener('pointermove', (e) => {
          if (!svDragging) return;
          applySV(e.clientX, e.clientY);
        });
        svCanvas.addEventListener('pointerup', (e) => {
          svDragging = false;
          try {
            svCanvas.releasePointerCapture(e.pointerId);
          } catch (_) {}
        });
        svCanvas.addEventListener('pointercancel', () => {
          svDragging = false;
        });
      }

      [rN, gN, bN].forEach((num) => {
        if (!num) return;
        num.addEventListener('input', () => {
          const v = clamp255(num.value);
          num.value = String(v);
          commitInlineColor(kind);
        });
        num.addEventListener('change', () => {
          const v = clamp255(num.value);
          num.value = String(v);
          commitInlineColor(kind);
        });
      });

      const hexIn = $(`${p}-hex`);
      if (hexIn) {
        hexIn.addEventListener('change', () => {
          const n = normalizeHex6(hexIn.value);
          if (!n || !hidden) return;
          hidden.value = n;
          setInlineSlidersFromHex(kind, n);
          updatePreview();
        });
      }
    }

    wireCrosshairColorInline('bar');
    wireCrosshairColorInline('dot');

    function setCrosshairColorPanelOpen(panel, trigger, open) {
      if (!panel || !trigger) return;
      if (open) {
        panel.classList.add('is-open');
        panel.setAttribute('aria-hidden', 'false');
        trigger.setAttribute('aria-expanded', 'true');
      } else {
        panel.classList.remove('is-open');
        panel.setAttribute('aria-hidden', 'true');
        trigger.setAttribute('aria-expanded', 'false');
      }
    }

    function setupCrosshairColorDropdown(kind) {
      const trigger = $(`crosshair-${kind}-color-trigger`);
      const panel = $(`crosshair-${kind}-color-panel`);
      if (!trigger || !panel) return;
      const otherKind = kind === 'bar' ? 'dot' : 'bar';
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const opening = !panel.classList.contains('is-open');
        if (opening) {
          const otherPanel = $(`crosshair-${otherKind}-color-panel`);
          const otherTrigger = $(`crosshair-${otherKind}-color-trigger`);
          if (otherPanel && otherPanel.classList.contains('is-open')) {
            setCrosshairColorPanelOpen(otherPanel, otherTrigger, false);
          }
        }
        setCrosshairColorPanelOpen(panel, trigger, opening);
        if (opening) {
          const hidden = kind === 'bar' ? barCol : dotCol;
          requestAnimationFrame(() => {
            if (hidden) setInlineSlidersFromHex(kind, hidden.value);
          });
        }
      });
      document.addEventListener('click', (e) => {
        if (!panel.classList.contains('is-open')) return;
        if (trigger.contains(e.target) || panel.contains(e.target)) return;
        setCrosshairColorPanelOpen(panel, trigger, false);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (!panel.classList.contains('is-open')) return;
        setCrosshairColorPanelOpen(panel, trigger, false);
      });
    }
    setupCrosshairColorDropdown('bar');
    setupCrosshairColorDropdown('dot');

    let previewBg = 0;

    async function refreshIniPathUI() {
      if (window.api.getPayday3GameUserSettingsPathInfo) {
        try {
          const info = await window.api.getPayday3GameUserSettingsPathInfo();
          if (pathEl) pathEl.textContent = info.path || '';
          if (crosshairIniClear) crosshairIniClear.hidden = !info.customIniPath;
        } catch (_) {
          if (pathEl) pathEl.textContent = '';
          if (crosshairIniClear) crosshairIniClear.hidden = true;
        }
      } else if (window.api.getPayday3GameUserSettingsPath) {
        try {
          const p = await window.api.getPayday3GameUserSettingsPath();
          if (pathEl) pathEl.textContent = p || '';
        } catch (_) {
          if (pathEl) pathEl.textContent = '';
        }
        if (crosshairIniClear) crosshairIniClear.hidden = true;
      }
    }
    void refreshIniPathUI();

    async function refreshRestoreButton() {
      if (!restoreIniBtn || !window.api.hasPayday3CrosshairBackup) return;
      try {
        const r = await window.api.hasPayday3CrosshairBackup();
        restoreIniBtn.disabled = !r.hasBackup;
      } catch (_) {
        restoreIniBtn.disabled = true;
      }
    }
    void refreshRestoreButton();

    if (crosshairIniBrowse && window.api.showOpenDialog && window.api.setPayday3GameUserSettingsCustomPath) {
      crosshairIniBrowse.addEventListener('click', async () => {
        let defaultPath = '';
        try {
          if (window.api.getPayday3GameUserSettingsPathInfo) {
            const info = await window.api.getPayday3GameUserSettingsPathInfo();
            defaultPath = info.pathDir || '';
          }
        } catch (_) {}
        const files = await window.api.showOpenDialog({
          title: 'Select GameUserSettings.ini',
          defaultPath: defaultPath || undefined,
          filters: [{ name: 'INI', extensions: ['ini'] }],
          properties: ['openFile'],
        });
        if (!files || !files[0]) return;
        const r = await window.api.setPayday3GameUserSettingsCustomPath(files[0]);
        if (!r.ok) {
          showAlert('Config file', r.message || 'Could not set path.');
          return;
        }
        await refreshIniPathUI();
        showModBanner('Config file path updated.');
      });
    }
    if (crosshairIniClear && window.api.setPayday3GameUserSettingsCustomPath) {
      crosshairIniClear.addEventListener('click', async () => {
        await window.api.setPayday3GameUserSettingsCustomPath(null);
        await refreshIniPathUI();
        showModBanner('Using default config location.');
      });
    }

    function gatherCrosshairReplacements() {
      const brgb = crosshairHexToRgb01(barCol ? barCol.value : '#ffffff');
      const drgb = crosshairHexToRgb01(dotCol ? dotCol.value : '#ffffff');
      const ba = barA ? parseFloat(barA.value) : 1;
      const da = dotA ? parseFloat(dotA.value) : 0;
      return {
        CrosshairsBarWidth: crosshairFmtFloat6(barW.value),
        CrosshairsBarLength: crosshairFmtFloat6(barL.value),
        CrosshairsDotSize: crosshairFmtFloat6(dotS.value),
        bCrosshairsShowAccuracy: showAcc && showAcc.checked ? 'True' : 'False',
        CrosshairsCenterGap: crosshairFmtFloat6(gap.value),
        CrosshairsBarColor: crosshairFormatUnrealColor(brgb.r, brgb.g, brgb.b, isFinite(ba) ? ba : 1),
        CrosshairsDotColor: crosshairFormatUnrealColor(drgb.r, drgb.g, drgb.b, isFinite(da) ? da : 0),
      };
    }

    function syncCrosshairRangesFromNumbers() {
      const pairs = [
        [barW, $('crosshair-bar-width-range')],
        [barL, $('crosshair-bar-length-range')],
        [dotS, $('crosshair-dot-size-range')],
        [gap, $('crosshair-center-gap-range')],
        [barA, $('crosshair-bar-alpha-range')],
        [dotA, $('crosshair-dot-alpha-range')],
      ];
      pairs.forEach(([num, range]) => {
        if (!num || !range) return;
        let v = parseFloat(num.value);
        if (!isFinite(v)) return;
        const min = parseFloat(range.min);
        const max = parseFloat(range.max);
        v = Math.min(max, Math.max(min, v));
        range.value = String(v);
      });
    }

    function applyCrosshairToUI(rep) {
      if (!rep) return;
      const num = (v, fallback) => {
        const n = parseFloat(v);
        return isFinite(n) ? n : fallback;
      };
      barW.value = num(rep.CrosshairsBarWidth, 2);
      barL.value = num(rep.CrosshairsBarLength, 5);
      dotS.value = num(rep.CrosshairsDotSize, 1);
      gap.value = num(rep.CrosshairsCenterGap, 2.5);
      const acc = String(rep.bCrosshairsShowAccuracy || '');
      if (showAcc) showAcc.checked = /^true$/i.test(acc) || acc === '1';
      const bc = crosshairParseUnrealColor(rep.CrosshairsBarColor || '');
      const dc = crosshairParseUnrealColor(rep.CrosshairsDotColor || '');
      if (barCol) barCol.value = crosshairRgb01ToHex(bc.r, bc.g, bc.b);
      if (barA) barA.value = bc.a;
      if (dotCol) dotCol.value = crosshairRgb01ToHex(dc.r, dc.g, dc.b);
      if (dotA) dotA.value = dc.a;
      syncCrosshairRangesFromNumbers();
      if (barCol) setInlineSlidersFromHex('bar', barCol.value);
      if (dotCol) setInlineSlidersFromHex('dot', dotCol.value);
      updatePreview();
    }

    function updatePreview() {
      if (previewCanvas) crosshairDrawPreview(previewCanvas, gatherCrosshairReplacements(), previewBg);
    }

    for (const img of crosshairBgImages) {
      if (img) img.onload = () => updatePreview();
    }

    async function loadPresetList() {
      const p = await window.api.getConfigPath(CROSSHAIR_PRESETS_FILE);
      const raw = await window.api.readFile(p);
      if (!raw) return { presets: [] };
      try {
        const j = JSON.parse(raw);
        if (j && Array.isArray(j.presets)) return j;
      } catch (_) {}
      return { presets: [] };
    }

    async function savePresetList(data) {
      const p = await window.api.getConfigPath(CROSSHAIR_PRESETS_FILE);
      await window.api.writeFile(p, JSON.stringify(data, null, 2), 'utf-8');
    }

    async function refreshPresetSelect() {
      const data = await loadPresetList();
      presetSelect.innerHTML = '';
      if (data.presets.length === 0) {
        const opt0 = document.createElement('option');
        opt0.value = '';
        opt0.textContent = '\u2014 Select preset \u2014';
        presetSelect.appendChild(opt0);
      }
      data.presets.forEach((preset, i) => {
        const o = document.createElement('option');
        o.value = String(i);
        o.textContent = preset.name;
        presetSelect.appendChild(o);
      });
    }

    applyCrosshairToUI(crosshairDefaults());

    loadBtn.addEventListener('click', async () => {
      if (!window.api.readPayday3GameUserSettings) return;
      const r = await window.api.readPayday3GameUserSettings();
      if (!r.ok) {
        showAlert('Could not load', r.message || 'GameUserSettings.ini could not be read. Is PAYDAY 3 installed?');
        return;
      }
      applyCrosshairToUI(crosshairMergeFromIni(r.content));
      showModBanner('Crosshair values loaded from game.');
    });

    saveBtn.addEventListener('click', async () => {
      if (!window.api.writePayday3GameUserSettingsCrosshairs) return;
      const rep = gatherCrosshairReplacements();
      const wr = await window.api.writePayday3GameUserSettingsCrosshairs(rep);
      if (!wr.ok) {
        showAlert('Could not save', wr.message || 'Write failed. Close the game and try again.');
        return;
      }
      showModBanner('Crosshair values saved to GameUserSettings.ini.');
      void refreshRestoreButton();
    });

    if (restoreIniBtn && window.api.restorePayday3GameUserSettingsCrosshairs) {
      restoreIniBtn.addEventListener('click', async () => {
        const r = await window.api.restorePayday3GameUserSettingsCrosshairs();
        if (!r.ok) {
          showAlert('Restore', r.message || 'Could not restore.');
          return;
        }
        if (window.api.readPayday3GameUserSettings) {
          const rd = await window.api.readPayday3GameUserSettings();
          if (rd.ok) applyCrosshairToUI(crosshairMergeFromIni(rd.content));
        }
        updatePreview();
        showModBanner('Restored crosshair values from before your last save.');
        void refreshRestoreButton();
      });
    }

    if (presetSave) {
      presetSave.addEventListener('click', async () => {
        let name = (presetName && presetName.value ? presetName.value : '').trim();
        if (!name) {
          showAlert('Preset name', 'Enter a name for this preset.');
          return;
        }
        const data = await loadPresetList();
        const existingNames = new Set(data.presets.map((x) => x.name));
        if (existingNames.has(name)) {
          const base = name.replace(/\d+$/, '');
          let n = 2;
          const trailing = name.match(/(\d+)$/);
          if (trailing) n = parseInt(trailing[1], 10) + 1;
          while (existingNames.has(base + n)) n++;
          name = base + n;
        }
        const values = gatherCrosshairReplacements();
        data.presets.push({ name, values });
        await savePresetList(data);
        await refreshPresetSelect();
        const newIdx = data.presets.findIndex((x) => x.name === name);
        if (newIdx >= 0) presetSelect.value = String(newIdx);
        if (presetName) presetName.value = name;
        showModBanner('Preset saved as "' + name + '".');
      });
    }

    if (presetLoad) {
      presetLoad.addEventListener('click', async () => {
        const idx = parseInt(presetSelect.value, 10);
        if (isNaN(idx) || idx < 0) {
          showAlert('Preset', 'Choose a preset from the list.');
          return;
        }
        const data = await loadPresetList();
        const preset = data.presets[idx];
        if (!preset || !preset.values) return;
        applyCrosshairToUI(preset.values);
        showModBanner('Preset loaded into the editor.');
      });
    }

    if (presetDelete) {
      presetDelete.addEventListener('click', async () => {
        const idx = parseInt(presetSelect.value, 10);
        if (isNaN(idx) || idx < 0) {
          showAlert('Preset', 'Choose a preset to delete.');
          return;
        }
        const data = await loadPresetList();
        data.presets.splice(idx, 1);
        await savePresetList(data);
        await refreshPresetSelect();
        showModBanner('Preset removed.');
      });
    }

    void refreshPresetSelect();

    const cs2CodeInput = $('crosshair-cs2-code');
    const cs2ImportBtn = $('crosshair-cs2-import');
    if (cs2ImportBtn && cs2CodeInput) {
      cs2ImportBtn.addEventListener('click', () => {
        const raw = cs2CodeInput.value.trim();
        if (!raw) {
          showAlert('CS2 Import', 'Paste a CS2 crosshair share code (CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx).');
          return;
        }
        const decoded = decodeCS2CrosshairCode(raw);
        if (!decoded) {
          showAlert('CS2 Import', 'Invalid share code. Expected format: CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx');
          return;
        }
        const pd3 = cs2CrosshairToPD3(decoded);
        if (!pd3) {
          showAlert('CS2 Import', 'Could not convert the crosshair settings.');
          return;
        }
        applyCrosshairToUI(pd3);
        cs2CodeInput.value = '';
        showModBanner('CS2 crosshair imported.');
      });
      cs2CodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') cs2ImportBtn.click();
      });
    }

    const rangePairs = [
      [barW, $('crosshair-bar-width-range')],
      [barL, $('crosshair-bar-length-range')],
      [dotS, $('crosshair-dot-size-range')],
      [gap, $('crosshair-center-gap-range')],
      [barA, $('crosshair-bar-alpha-range')],
      [dotA, $('crosshair-dot-alpha-range')],
    ];
    rangePairs.forEach(([num, range]) => {
      if (!num || !range) return;
      range.addEventListener('input', () => {
        num.value = range.value;
        updatePreview();
      });
      const onNumber = () => {
        let v = parseFloat(num.value);
        if (!isFinite(v)) return;
        const min = parseFloat(range.min);
        const max = parseFloat(range.max);
        v = Math.min(max, Math.max(min, v));
        range.value = String(v);
        updatePreview();
      };
      num.addEventListener('input', onNumber);
      num.addEventListener('change', onNumber);
    });

    if (showAcc) {
      showAcc.addEventListener('input', () => updatePreview());
      showAcc.addEventListener('change', () => updatePreview());
    }

    function updateCrosshairBgLabel() {
      const el = $('crosshair-bg-label');
      if (el) el.textContent = 'Background ' + (previewBg + 1) + ' / ' + CROSSHAIR_BG_COUNT;
    }
    const bgPrev = $('crosshair-bg-prev');
    const bgNext = $('crosshair-bg-next');
    if (bgPrev) {
      bgPrev.addEventListener('click', () => {
        previewBg = (previewBg + CROSSHAIR_BG_COUNT - 1) % CROSSHAIR_BG_COUNT;
        updateCrosshairBgLabel();
        updatePreview();
      });
    }
    if (bgNext) {
      bgNext.addEventListener('click', () => {
        previewBg = (previewBg + 1) % CROSSHAIR_BG_COUNT;
        updateCrosshairBgLabel();
        updatePreview();
      });
    }
    updateCrosshairBgLabel();

    const previewReset = $('crosshair-preview-reset');
    if (previewReset) {
      previewReset.addEventListener('click', () => {
        applyCrosshairToUI(crosshairDefaults());
        showModBanner('Editor reset to defaults.');
      });
    }
    const previewViewport = $('crosshair-preview-viewport');
    if (previewViewport && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => updatePreview());
      ro.observe(previewViewport);
    }
    crosshairRefreshPreview = updatePreview;
    crosshairRefreshRestore = refreshRestoreButton;
  }

  function initSettingsAbout() {
    const btn = $('settings-about-toggle');
    const copy = $('settings-about-copy');
    if (!btn || !copy) return;

    function finishCloseAbout() {
      copy.hidden = true;
      copy.classList.remove('settings-about-copy--closing');
      btn.setAttribute('aria-expanded', 'false');
    }

    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      if (expanded) {
        const reduce =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) {
          finishCloseAbout();
          return;
        }
        if (copy.classList.contains('settings-about-copy--closing')) return;
        copy.classList.add('settings-about-copy--closing');
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(safety);
          copy.removeEventListener('animationend', onEnd);
          finishCloseAbout();
        };
        const onEnd = (e) => {
          const n = e.animationName || '';
          if (n !== 'settings-about-hide' && !n.includes('settings-about-hide')) return;
          finish();
        };
        const safety = setTimeout(finish, 500);
        copy.addEventListener('animationend', onEnd);
      } else {
        copy.classList.remove('settings-about-copy--closing');
        copy.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  function initSettingsEaster() {
    const hit = $('settings-easter-hit');
    const msg = $('settings-easter-msg');
    if (!hit || !msg) return;
    let hits = 0;
    let idleTimer = null;
    const IDLE_MS = 2800;

    hit.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!msg.hidden) return;
      if (idleTimer) clearTimeout(idleTimer);
      hits += 1;
      if (hits >= 3) {
        hits = 0;
        msg.hidden = false;
        return;
      }
      idleTimer = setTimeout(() => {
        hits = 0;
        idleTimer = null;
      }, IDLE_MS);
    });
  }

  initCrosshairUI();
  initSettingsAbout();
  initSettingsEaster();
  initAppUpdateDownloadListeners();
  initAppearanceUI();
  initConfig();
})();
