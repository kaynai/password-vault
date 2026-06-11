/* ============================================
   Krypton Vault — 密码管理器
   Core Application Logic
   ============================================ */

// ============ 常量与状态 ============
const KV_USERS_KEY = 'kv_users';           // 用户注册表 [{username, userKey}]
const STORAGE_PREFIX = 'kv_vault_';
const SETTINGS_PREFIX = 'kv_settings_';
const SALT_PREFIX = 'kv_salt_';
const CUSTOM_CAT_PREFIX = 'kv_custom_categories_';
const VAULT_VERSION = 1;

const PRESET_CATEGORIES = [
    { id: 'all',    name: '全部', icon: '🏠',  color: '#d946ef' },
    { id: 'social', name: '社交', icon: '💬',  color: '#f472b6' },
    { id: 'email',  name: '邮箱', icon: '📧',  color: '#e879f9' },
    { id: 'finance',name: '金融', icon: '💰',  color: '#4ade80' },
    { id: 'work',   name: '工作', icon: '💼',  color: '#fbbf24' },
    { id: 'other',  name: '其他', icon: '📌',  color: '#c084fc' },
];

const CATEGORY_PALETTE = [
    '#f472b6', '#e879f9', '#fb923c', '#4ade80', '#60a5fa',
    '#fbbf24', '#c084fc', '#fb7185', '#a78bfa', '#34d399',
    '#f97316', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
    '#d946ef', '#facc15', '#818cf8', '#22d3ee', '#a3e635',
];

function getCategoryInfo(catId) {
    const preset = PRESET_CATEGORIES.find(c => c.id === catId);
    if (preset) return preset;
    const custom = appState.customCategories.find(c => c.id === catId);
    if (custom) return custom;
    return { id: catId, name: catId, icon: '📌', color: '#c084fc' };
}

let appState = {
    currentUser: null,        // 当前登录的用户名
    currentUserKey: null,     // 当前用户的存储键哈希
    masterKey: null,          // CryptoKey
    masterPassword: null,     // 明文主密码（仅内存中保存用于重加密）
    entries: [],              // 解密后的密码条目列表
    settings: {
        vaultName: 'Krypton Vault',
        autoLockMinutes: 5,
    },
    selectedEntryId: null,
    currentCategory: 'all',
    autoLockTimer: null,
    generatedPassword: '',
    customCategories: [],     // 用户自定义分类
};

// ============ DOM 元素缓存 ============
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);

const dom = {
    // 屏幕
    lockScreen: $('#lockScreen'),
    mainScreen: $('#mainScreen'),

    // 锁定界面
    appTitle: $('#appTitle'),
    userSelectSection: $('#userSelectSection'),
    userList: $('#userList'),
    noUsersHint: $('#noUsersHint'),
    btnShowCreate: $('#btnShowCreate'),
    setupSection: $('#setupSection'),
    setupUsername: $('#setupUsername'),
    unlockSection: $('#unlockSection'),
    unlockUserName: $('#unlockUserName'),
    masterSetup: $('#masterSetup'),
    masterSetupConfirm: $('#masterSetupConfirm'),
    masterUnlock: $('#masterUnlock'),
    btnSetup: $('#btnSetup'),
    btnUnlock: $('#btnUnlock'),
    btnBackToUsers: $('#btnBackToUsers'),
    btnBackFromCreate: $('#btnBackFromCreate'),
    btnReset: $('#btnReset'),
    unlockError: $('#unlockError'),
    strengthBar: $('#strengthBar'),
    headerTitle: $('#headerTitle'),

    // 主界面
    searchInput: $('#searchInput'),
    btnAdd: $('#btnAdd'),
    btnGenerator: $('#btnGenerator'),
    btnSettings: $('#btnSettings'),
    btnLock: $('#btnLock'),
    entryList: $('#entryList'),
    emptyState: $('#emptyState'),

    // 分类
    categoryBar: $('#categoryBar'),

    // 弹窗 - 条目
    entryModal: $('#entryModal'),
    modalTitle: $('#modalTitle'),
    entryName: $('#entryName'),
    entryUrl: $('#entryUrl'),
    entryUsername: $('#entryUsername'),
    entryPassword: $('#entryPassword'),
    entryCategory: $('#entryCategory'),
    entryNotes: $('#entryNotes'),
    entryId: $('#entryId'),
    btnTogglePw: $('#btnTogglePw'),
    btnGenPw: $('#btnGenPw'),
    btnModalSave: $('#btnModalSave'),
    btnModalCancel: $('#btnModalCancel'),
    btnModalClose: $('#btnModalClose'),

    // 弹窗 - 生成器
    generatorModal: $('#generatorModal'),
    generatedPassword: $('#generatedPassword'),
    pwLength: $('#pwLength'),
    lenValue: $('#lenValue'),
    genUpper: $('#genUpper'),
    genLower: $('#genLower'),
    genNumber: $('#genNumber'),
    genSymbol: $('#genSymbol'),
    btnGenerate: $('#btnGenerate'),
    btnCopyGen: $('#btnCopyGen'),
    btnUseGen: $('#btnUseGen'),
    btnGenClose: $('#btnGenClose'),

    // 弹窗 - 设置
    settingsModal: $('#settingsModal'),
    settingsVaultName: $('#settingsVaultName'),
    settingsAutoLock: $('#settingsAutoLock'),
    settingsOldMaster: $('#settingsOldMaster'),
    settingsNewMaster: $('#settingsNewMaster'),
    btnExport: $('#btnExport'),
    btnImport: $('#btnImport'),
    importFile: $('#importFile'),
    btnResetAll: $('#btnResetAll'),
    btnSettingsSave: $('#btnSettingsSave'),
    btnSettingsClose: $('#btnSettingsClose'),

    // Toast
    toast: $('#toast'),
};

// ============ 用户管理（多用户存储隔离） ============
function userStorageKey(prefix, userKey) {
    return prefix + (userKey || appState.currentUserKey || '');
}

function getRegisteredUsers() {
    const raw = localStorage.getItem(KV_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
}

function saveRegisteredUsers(users) {
    localStorage.setItem(KV_USERS_KEY, JSON.stringify(users));
}

async function hashUsername(username) {
    // 用 SHA-256 生成存储键（避免特殊字符问题）
    const data = new TextEncoder().encode(username.toLowerCase().trim());
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

async function registerUser(username) {
    const name = username.trim();
    if (!name || name.length < 1) return null;
    const users = getRegisteredUsers();
    if (users.some(u => u.username.toLowerCase() === name.toLowerCase())) {
        return null; // 用户名已存在
    }
    const userKey = await hashUsername(name);
    users.push({ username: name, userKey });
    saveRegisteredUsers(users);
    return userKey;
}

function deleteUserAccount(username) {
    const users = getRegisteredUsers();
    const user = users.find(u => u.username === username);
    if (!user) return;
    // 清除该用户的所有存储数据
    localStorage.removeItem(STORAGE_PREFIX + user.userKey);
    localStorage.removeItem(SETTINGS_PREFIX + user.userKey);
    localStorage.removeItem(SALT_PREFIX + user.userKey);
    localStorage.removeItem(CUSTOM_CAT_PREFIX + user.userKey);
    // 从注册表移除
    saveRegisteredUsers(users.filter(u => u.username !== username));
}

function renderUserList() {
    const users = getRegisteredUsers();
    dom.noUsersHint.classList.toggle('hidden', users.length > 0);

    if (users.length === 0) {
        dom.userList.innerHTML = '';
        return;
    }

    dom.userList.innerHTML = users.map(u =>
        `<button class="user-chip" data-username="${escapeHtml(u.username)}">👤 ${escapeHtml(u.username)}</button>`
    ).join('');
}

function showUserSelect() {
    dom.setupSection.classList.add('hidden');
    dom.unlockSection.classList.add('hidden');
    dom.userSelectSection.classList.remove('hidden');
    renderUserList();
}

function selectUserForUnlock(username) {
    const users = getRegisteredUsers();
    const user = users.find(u => u.username === username);
    if (!user) return;

    appState.currentUser = username;
    appState.currentUserKey = user.userKey;

    dom.userSelectSection.classList.add('hidden');
    dom.setupSection.classList.add('hidden');
    dom.unlockSection.classList.remove('hidden');
    dom.unlockUserName.textContent = username;
    dom.unlockError.textContent = '';
    dom.masterUnlock.value = '';
    dom.masterUnlock.focus();
}

// ============ 工具函数 ============
function showToast(msg, type = '') {
    const toast = dom.toast;
    toast.textContent = msg;
    toast.className = 'toast ' + type + ' show';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), 2200);
}

function switchScreen(show) {
    dom.lockScreen.classList.toggle('active', show === 'lock');
    dom.mainScreen.classList.toggle('active', show === 'main');
}

function openModal(modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function closeAllModals() {
    [dom.entryModal, dom.generatorModal, dom.settingsModal].forEach(closeModal);
}

// ============ 密码强度 ============
function evaluateStrength(password) {
    if (!password) return '';
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (password.length >= 16) score++;

    if (score <= 2) return 'weak';
    if (score <= 4) return 'fair';
    if (score <= 6) return 'good';
    return 'strong';
}

function updateStrengthBar(password) {
    const bar = dom.strengthBar;
    const level = evaluateStrength(password);
    bar.className = 'password-strength ' + level;
}

// ============ 加密 / 解密 ============
function arrayBufferToBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToArrayBuffer(base64) {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;
}

async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encryptData(key, data) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        enc.encode(JSON.stringify(data))
    );
    return {
        iv: arrayBufferToBase64(iv),
        data: arrayBufferToBase64(encrypted),
        version: VAULT_VERSION,
    };
}

async function decryptData(key, encryptedObj) {
    try {
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: base64ToArrayBuffer(encryptedObj.iv) },
            key,
            base64ToArrayBuffer(encryptedObj.data)
        );
        return JSON.parse(new TextDecoder().decode(decrypted));
    } catch {
        return null;
    }
}

// ============ 持久化 ============
function saveEncryptedVault(encryptedData) {
    localStorage.setItem(userStorageKey(STORAGE_PREFIX), JSON.stringify(encryptedData));
}

function getEncryptedVault() {
    const raw = localStorage.getItem(userStorageKey(STORAGE_PREFIX));
    return raw ? JSON.parse(raw) : null;
}

function getSalt() {
    const saltKey = userStorageKey(SALT_PREFIX);
    let saltB64 = localStorage.getItem(saltKey);
    if (!saltB64) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        saltB64 = arrayBufferToBase64(salt);
        localStorage.setItem(saltKey, saltB64);
    }
    return base64ToArrayBuffer(saltB64);
}

function loadSettings() {
    const raw = localStorage.getItem(userStorageKey(SETTINGS_PREFIX));
    if (raw) {
        try { Object.assign(appState.settings, JSON.parse(raw)); } catch {}
    }
}

function saveSettings() {
    localStorage.setItem(userStorageKey(SETTINGS_PREFIX), JSON.stringify(appState.settings));
    dom.headerTitle.textContent = appState.settings.vaultName;
    dom.appTitle.textContent = appState.settings.vaultName;
    document.title = appState.settings.vaultName + ' — 密码管理器';
}

function loadCustomCategories() {
    const raw = localStorage.getItem(userStorageKey(CUSTOM_CAT_PREFIX));
    if (raw) {
        try { appState.customCategories = JSON.parse(raw); } catch { appState.customCategories = []; }
    }
}

function saveCustomCategories() {
    localStorage.setItem(userStorageKey(CUSTOM_CAT_PREFIX), JSON.stringify(appState.customCategories));
}

function generateCatColor(name) {
    // 根据名称哈希选择调色板颜色
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length];
}

// ============ 应用初始化 ============
async function init() {
    dom.headerTitle.textContent = appState.settings.vaultName;
    dom.appTitle.textContent = appState.settings.vaultName;
    document.title = appState.settings.vaultName + ' — 密码管理器';
    dom.settingsVaultName.value = appState.settings.vaultName;
    dom.settingsAutoLock.value = appState.settings.autoLockMinutes;

    // 渲染分类栏（提前渲染结构）
    renderCategoryBar();
    renderCategoryDropdown();

    // 显示用户选择界面
    showUserSelect();

    switchScreen('lock');
    bindEvents();
}

// ============ 创建保险库 ============
async function createVault() {
    const username = dom.setupUsername.value.trim();
    const password = dom.masterSetup.value;
    const confirm = dom.masterSetupConfirm.value;

    if (!username || username.length < 1) {
        showToast('请输入用户名', 'error');
        return;
    }
    if (username.length > 20) {
        showToast('用户名不超过20个字符', 'error');
        return;
    }
    if (!password || password.length < 4) {
        showToast('密码长度至少4位', 'error');
        return;
    }
    if (password !== confirm) {
        showToast('两次密码不一致', 'error');
        return;
    }

    // 检查用户名是否已存在
    const userKey = await registerUser(username);
    if (!userKey) {
        showToast('用户名已存在，请换一个', 'error');
        return;
    }

    appState.currentUser = username;
    appState.currentUserKey = userKey;

    const salt = getSalt();
    const key = await deriveKey(password, salt);
    const entries = [];
    const encrypted = await encryptData(key, { entries, version: VAULT_VERSION });
    saveEncryptedVault(encrypted);

    appState.masterKey = key;
    appState.masterPassword = password;
    appState.entries = entries;

    // 新用户初始化设置
    appState.settings = { vaultName: 'Krypton Vault', autoLockMinutes: 5 };
    appState.customCategories = [];
    saveSettings();
    saveCustomCategories();

    switchScreen('main');
    renderEntries();
    startAutoLockTimer();
    showToast(`账号「${username}」创建成功！`, 'success');
    dom.masterSetup.value = '';
    dom.masterSetupConfirm.value = '';
    dom.setupUsername.value = '';
}

// ============ 解锁保险库 ============
async function unlockVault() {
    const password = dom.masterUnlock.value;
    if (!password) {
        showToast('请输入主密码', 'error');
        return;
    }
    if (!appState.currentUserKey) {
        dom.unlockError.textContent = '请先选择账号';
        return;
    }

    const salt = getSalt();
    const key = await deriveKey(password, salt);
    const vault = getEncryptedVault();

    if (!vault) {
        dom.unlockError.textContent = '未找到保险库数据';
        return;
    }

    const data = await decryptData(key, vault);
    if (data === null) {
        dom.unlockError.textContent = '主密码错误，请重试';
        dom.masterUnlock.value = '';
        return;
    }

    appState.masterKey = key;
    appState.masterPassword = password;
    appState.entries = data.entries || [];

    // 加载该用户的设置和自定义分类
    loadSettings();
    loadCustomCategories();
    dom.headerTitle.textContent = appState.settings.vaultName;
    dom.appTitle.textContent = appState.settings.vaultName;
    dom.settingsVaultName.value = appState.settings.vaultName;
    dom.settingsAutoLock.value = appState.settings.autoLockMinutes;
    renderCategoryBar();
    renderCategoryDropdown();

    dom.unlockError.textContent = '';
    dom.masterUnlock.value = '';

    switchScreen('main');
    renderEntries();
    startAutoLockTimer();
    showToast(`欢迎「${appState.currentUser}」，共 ${appState.entries.length} 条记录`, 'success');
}

// ============ 锁定 ============
function lockVault() {
    clearTimeout(appState.autoLockTimer);
    appState.currentUser = null;
    appState.currentUserKey = null;
    appState.masterKey = null;
    appState.masterPassword = null;
    appState.entries = [];
    appState.currentCategory = 'all';
    appState.selectedEntryId = null;
    appState.customCategories = [];

    dom.searchInput.value = '';
    dom.entryList.innerHTML = '';
    dom.emptyState.classList.add('hidden');

    closeAllModals();
    showUserSelect();
    switchScreen('lock');
}

// ============ 自动锁定 ============
function startAutoLockTimer() {
    clearTimeout(appState.autoLockTimer);
    const mins = appState.settings.autoLockMinutes;
    if (mins > 0) {
        appState.autoLockTimer = setTimeout(() => {
            lockVault();
            showToast('已自动锁定');
        }, mins * 60 * 1000);
    }
}

function resetAutoLockTimer() {
    if (appState.masterKey) {
        startAutoLockTimer();
    }
}

// ============ 加密并保存当前数据 ============
async function persistVault() {
    if (!appState.masterKey) return;
    const encrypted = await encryptData(appState.masterKey, {
        entries: appState.entries,
        version: VAULT_VERSION
    });
    saveEncryptedVault(encrypted);
}

// ============ 密码条目操作 ============
function generateId() {
    return 'e_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

function openAddModal() {
    dom.modalTitle.textContent = '新增密码';
    dom.entryName.value = '';
    dom.entryUrl.value = '';
    dom.entryUsername.value = '';
    dom.entryPassword.value = '';
    dom.entryNotes.value = '';
    dom.entryId.value = '';
    dom.entryPassword.type = 'password';
    dom.btnTogglePw.textContent = '👁️';
    renderCategoryDropdown();
    dom.entryCategory.value = 'social';
    openModal(dom.entryModal);
    dom.entryName.focus();
}

function openEditModal(entry) {
    dom.modalTitle.textContent = '编辑密码';
    dom.entryName.value = entry.name;
    dom.entryUrl.value = entry.url || '';
    dom.entryUsername.value = entry.username;
    dom.entryPassword.value = entry.password;
    dom.entryCategory.value = entry.category;
    dom.entryNotes.value = entry.notes || '';
    dom.entryId.value = entry.id;
    dom.entryPassword.type = 'password';
    dom.btnTogglePw.textContent = '👁️';
    openModal(dom.entryModal);
    dom.entryName.focus();
}

async function saveEntry() {
    const name = dom.entryName.value.trim();
    const username = dom.entryUsername.value.trim();
    const password = dom.entryPassword.value;

    if (!name || !username || !password) {
        showToast('请填写名称、用户名和密码', 'error');
        return;
    }

    const entry = {
        id: dom.entryId.value || generateId(),
        name,
        url: dom.entryUrl.value.trim(),
        username,
        password,
        category: dom.entryCategory.value,
        notes: dom.entryNotes.value.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    const existingIdx = appState.entries.findIndex(e => e.id === entry.id);
    if (existingIdx >= 0) {
        entry.createdAt = appState.entries[existingIdx].createdAt;
        appState.entries[existingIdx] = entry;
    } else {
        appState.entries.unshift(entry);
    }

    await persistVault();
    renderEntries();
    closeModal(dom.entryModal);
    showToast(existingIdx >= 0 ? '密码已更新' : '密码已保存', 'success');
}

function deleteEntry(id) {
    // 使用内置确认弹窗（比 window.confirm 更可靠）
    const entry = appState.entries.find(e => e.id === id);
    if (!entry) return;

    const overlay = document.getElementById('confirmOverlay');
    const msgEl = document.getElementById('confirmMsg');
    if (!overlay || !msgEl) {
        // 降级到原生 confirm
        if (!window.confirm('确定删除？')) return;
        doDeleteEntry(id);
        return;
    }

    msgEl.textContent = '确定要删除「' + entry.name + '」吗？';
    _pendingDeleteId = id;
    overlay.classList.add('active');
}

async function doDeleteEntry(id) {
    appState.entries = appState.entries.filter(e => e.id !== id);
    try {
        await persistVault();
        showToast('已删除', 'success');
    } catch (err) {
        console.error('删除持久化失败', err);
        showToast('删除失败，请重试', 'error');
        // 恢复数据
        return;
    }
    renderEntries();
}

async function copyToClipboard(text, label) {
    try {
        await navigator.clipboard.writeText(text);
        showToast(`${label || '已'}复制到剪贴板`, 'success');
    } catch {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast(`${label || '已'}复制到剪贴板`, 'success');
    }
}

// ============ 渲染密码列表 ============
function renderEntries() {
    let entries = [...appState.entries];

    // 分类筛选
    if (appState.currentCategory !== 'all') {
        entries = entries.filter(e => e.category === appState.currentCategory);
    }

    // 搜索筛选
    const query = dom.searchInput.value.trim().toLowerCase();
    if (query) {
        entries = entries.filter(e =>
            e.name.toLowerCase().includes(query) ||
            e.username.toLowerCase().includes(query) ||
            (e.url && e.url.toLowerCase().includes(query)) ||
            (e.notes && e.notes.toLowerCase().includes(query))
        );
    }

    if (entries.length === 0) {
        dom.entryList.innerHTML = '';
        dom.emptyState.classList.remove('hidden');
        if (query || appState.currentCategory !== 'all') {
            dom.emptyState.querySelector('p').textContent = '没有匹配的记录';
        } else {
            dom.emptyState.querySelector('p').textContent = '还没有保存任何密码';
        }
        return;
    }

    dom.emptyState.classList.add('hidden');
    dom.entryList.innerHTML = entries.map(entry => {
        const initial = entry.name.charAt(0).toUpperCase();
        const catInfo = getCategoryInfo(entry.category);
        const catColor = catInfo.color;
        return `
            <div class="entry-card" data-id="${entry.id}" data-category="${entry.category}">
                <div class="entry-avatar" style="background:${catColor}22;color:${catColor}">
                    ${initial}
                </div>
                <div class="entry-info">
                    <div class="entry-name">${escapeHtml(entry.name)}</div>
                    <div class="entry-username">${escapeHtml(entry.username)}</div>
                </div>
                <div class="entry-actions">
                    <button class="entry-action-btn copy-user" data-id="${entry.id}" title="复制用户名">📋</button>
                    <button class="entry-action-btn copy-pass" data-id="${entry.id}" title="复制密码">🔑</button>
                    <button class="entry-action-btn delete" data-id="${entry.id}" title="删除">🗑️</button>
                </div>
            </div>`;
    }).join('');

    // 绑定事件
    dom.entryList.querySelectorAll('.entry-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // 不拦截操作按钮的点击
            if (e.target.closest('.entry-action-btn')) return;
            const id = card.dataset.id;
            const entry = appState.entries.find(e => e.id === id);
            if (entry) openEditModal(entry);
        });
    });

    dom.entryList.querySelectorAll('.copy-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const entry = appState.entries.find(e => e.id === btn.dataset.id);
            if (entry) copyToClipboard(entry.username, '用户名');
        });
    });

    dom.entryList.querySelectorAll('.copy-pass').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const entry = appState.entries.find(e => e.id === btn.dataset.id);
            if (entry) copyToClipboard(entry.password, '密码');
        });
    });
}

let _pendingDeleteId = null;

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ 密码生成器 ============
function generatePassword() {
    const length = parseInt(dom.pwLength.value);
    const useUpper = dom.genUpper.checked;
    const useLower = dom.genLower.checked;
    const useNumber = dom.genNumber.checked;
    const useSymbol = dom.genSymbol.checked;

    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let chars = '';
    if (useUpper) chars += upper;
    if (useLower) chars += lower;
    if (useNumber) chars += numbers;
    if (useSymbol) chars += symbols;

    if (!chars) {
        showToast('请至少选择一种字符类型', 'error');
        return '';
    }

    // 确保每种选中类型至少有一个字符
    let password = '';
    if (useUpper) password += upper[Math.floor(Math.random() * upper.length)];
    if (useLower) password += lower[Math.floor(Math.random() * lower.length)];
    if (useNumber) password += numbers[Math.floor(Math.random() * numbers.length)];
    if (useSymbol) password += symbols[Math.floor(Math.random() * symbols.length)];

    const array = new Uint32Array(length - password.length);
    crypto.getRandomValues(array);
    for (let i = 0; i < array.length; i++) {
        password += chars[array[i] % chars.length];
    }

    // 打乱顺序
    password = password.split('').sort(() => {
        const arr = new Uint32Array(1);
        crypto.getRandomValues(arr);
        return (arr[0] % 2) ? 1 : -1;
    }).join('');

    return password;
}

// ============ 导出 / 导入 ============
async function exportData() {
    const password = prompt('请输入主密码以确认导出：');
    if (!password) return;

    const salt = getSalt();
    const key = await deriveKey(password, salt);
    const vault = getEncryptedVault();
    const data = await decryptData(key, vault);

    if (data === null) {
        showToast('密码错误', 'error');
        return;
    }

    // 导出为明文的JSON (用户自己保管)
    const exportObj = {
        appName: appState.settings.vaultName,
        exportedAt: new Date().toISOString(),
        version: VAULT_VERSION,
        entries: data.entries,
    };

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `krypton-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('导出成功，请妥善保管备份文件', 'success');
}

async function importData() {
    const file = dom.importFile.files[0];
    if (!file) return;

    if (!confirm('导入将替换当前所有数据，确定继续吗？')) {
        dom.importFile.value = '';
        return;
    }

    try {
        const text = await file.text();
        const importObj = JSON.parse(text);

        if (!importObj.entries || !Array.isArray(importObj.entries)) {
            throw new Error('无效的备份文件格式');
        }

        // 标准化条目
        appState.entries = importObj.entries.map(e => ({
            id: e.id || generateId(),
            name: e.name || 'Unknown',
            url: e.url || '',
            username: e.username || '',
            password: e.password || '',
            category: e.category || 'other',
            notes: e.notes || '',
            createdAt: e.createdAt || new Date().toISOString(),
            updatedAt: e.updatedAt || new Date().toISOString(),
        }));

        await persistVault();
        renderEntries();
        showToast(`成功导入 ${appState.entries.length} 条记录`, 'success');
    } catch (err) {
        showToast('导入失败：无效的文件格式', 'error');
    }
    dom.importFile.value = '';
}

// ============ 修改主密码 ============
async function changeMasterPassword() {
    const oldPw = dom.settingsOldMaster.value;
    const newPw = dom.settingsNewMaster.value;

    if (!oldPw && !newPw) return; // 都没填，跳过
    if (!oldPw) { showToast('请输入当前主密码', 'error'); return; }
    if (!newPw || newPw.length < 4) { showToast('新密码至少4位', 'error'); return; }
    if (oldPw !== appState.masterPassword) {
        showToast('当前主密码错误', 'error');
        return;
    }

    const salt = getSalt();
    const newKey = await deriveKey(newPw, salt);
    appState.masterKey = newKey;
    appState.masterPassword = newPw;

    await persistVault();
    showToast('主密码已更新', 'success');
    dom.settingsOldMaster.value = '';
    dom.settingsNewMaster.value = '';
}

// ============ 重置（删除当前锁定界面选中的用户） ============
function resetCurrentUser() {
    const username = appState.currentUser;
    if (!username) return;
    const confirmOverlay = document.getElementById('confirmOverlay');
    const msgEl = document.getElementById('confirmMsg');
    if (confirmOverlay && msgEl) {
        msgEl.textContent = `确定要删除账号「${username}」及其所有密码数据吗？`;
        _pendingDeleteUser = username;
        confirmOverlay.classList.add('active');
    } else if (confirm(`确定删除账号「${username}」吗？此操作不可恢复！`)) {
        doResetUser(username);
    }
}

let _pendingDeleteUser = null;

function doResetUser(username) {
    deleteUserAccount(username);
    appState.currentUser = null;
    appState.currentUserKey = null;
    appState.masterKey = null;
    appState.masterPassword = null;
    appState.entries = [];
    appState.customCategories = [];
    showToast(`账号「${username}」已删除`, 'success');
    showUserSelect();
}

async function resetAll() {
    if (!confirm('⚠️ 确定要删除当前账号的所有密码数据吗？此操作不可恢复！\n\n请确保已导出备份。')) return;
    if (!confirm('再次确认：删除所有密码数据？')) return;

    localStorage.removeItem(userStorageKey(STORAGE_PREFIX));
    localStorage.removeItem(userStorageKey(SALT_PREFIX));
    localStorage.removeItem(userStorageKey(SETTINGS_PREFIX));
    localStorage.removeItem(userStorageKey(CUSTOM_CAT_PREFIX));

    appState.entries = [];
    appState.masterKey = null;
    appState.masterPassword = null;
    appState.customCategories = [];
    appState.settings = { vaultName: 'Krypton Vault', autoLockMinutes: 5 };

    closeAllModals();
    showToast('所有数据已清除', 'success');

    setTimeout(() => {
        lockVault();
    }, 500);
}

// ============ 分类栏渲染 ============
function renderCategoryBar() {
    const allCategories = [
        ...PRESET_CATEGORIES.filter(c => c.id !== 'all'),
        ...appState.customCategories,
    ];

    const chipsHTML = [
        // 「全部」芯片
        `<button class="cat-chip ${appState.currentCategory === 'all' ? 'active' : ''}" data-cat="all">
            全部
        </button>`,
        // 预设 + 自定义分类
        ...allCategories.map(cat =>
            `<button class="cat-chip custom ${appState.currentCategory === cat.id ? 'active' : ''}" data-cat="${cat.id}">
                ${cat.icon} ${escapeHtml(cat.name)}
                <span class="cat-chip-delete" data-cat="${cat.id}" title="删除分类">×</span>
            </button>`
        ),
        // 添加按钮
        `<button class="cat-add-btn" id="btnAddCategory" title="添加分类">+</button>`,
    ].join('');

    dom.categoryBar.innerHTML = chipsHTML;
}

function renderCategoryDropdown() {
    const allCategories = [
        ...PRESET_CATEGORIES.filter(c => c.id !== 'all'),
        ...appState.customCategories,
    ];

    dom.entryCategory.innerHTML = allCategories.map(cat =>
        `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`
    ).join('');
}

function addCustomCategory(name) {
    name = name.trim();
    if (!name || name.length > 10) {
        showToast('分类名称需1-10个字符', 'error');
        return;
    }

    // 检查名称是否已存在
    const allNames = [
        ...PRESET_CATEGORIES.map(c => c.name),
        ...appState.customCategories.map(c => c.name),
    ];
    if (allNames.includes(name)) {
        showToast('分类名称已存在', 'error');
        return;
    }

    const newCat = {
        id: 'cc_' + Date.now().toString(36),
        name: name,
        icon: '🏷️',
        color: generateCatColor(name),
    };

    appState.customCategories.push(newCat);
    saveCustomCategories();
    renderCategoryBar();
    renderCategoryDropdown();
    showToast(`分类「${name}」已添加`, 'success');
}

function deleteCustomCategory(catId) {
    const cat = appState.customCategories.find(c => c.id === catId);
    if (!cat) return;

    if (!confirm(`确定删除分类「${cat.name}」吗？\n该分类下的密码条目将保留，归类会变为「其他」。`)) return;

    appState.customCategories = appState.customCategories.filter(c => c.id !== catId);

    // 将该分类下的条目迁移到「other」
    let changed = 0;
    appState.entries.forEach(e => {
        if (e.category === catId) {
            e.category = 'other';
            changed++;
        }
    });

    saveCustomCategories();
    if (changed > 0) persistVault();

    // 如果当前筛选的是被删除的分类，切回全部
    if (appState.currentCategory === catId) {
        appState.currentCategory = 'all';
    }

    renderCategoryBar();
    renderCategoryDropdown();
    renderEntries();
    showToast(`分类「${cat.name}」已删除`, 'success');
}

// ============ 事件绑定 ============
function bindEvents() {
    // === 用户选择界面 ===
    // 用户芯片点击（事件委托）
    dom.userList.addEventListener('click', (e) => {
        const chip = e.target.closest('.user-chip');
        if (!chip) return;
        const username = chip.dataset.username;
        if (username) selectUserForUnlock(username);
    });

    // 显示创建账号表单
    dom.btnShowCreate.addEventListener('click', () => {
        dom.userSelectSection.classList.add('hidden');
        dom.unlockSection.classList.add('hidden');
        dom.setupSection.classList.remove('hidden');
        dom.setupUsername.value = '';
        dom.masterSetup.value = '';
        dom.masterSetupConfirm.value = '';
        dom.setupUsername.focus();
    });

    // 从解锁返回用户列表
    dom.btnBackToUsers.addEventListener('click', () => {
        appState.currentUser = null;
        appState.currentUserKey = null;
        dom.masterUnlock.value = '';
        dom.unlockError.textContent = '';
        showUserSelect();
    });

    // 从创建返回用户列表
    dom.btnBackFromCreate.addEventListener('click', () => {
        dom.setupUsername.value = '';
        dom.masterSetup.value = '';
        dom.masterSetupConfirm.value = '';
        showUserSelect();
    });

    // 创建保险库
    dom.btnSetup.addEventListener('click', createVault);
    dom.masterSetupConfirm.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') createVault();
    });

    // 解锁
    dom.btnUnlock.addEventListener('click', unlockVault);
    dom.masterUnlock.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') unlockVault();
    });

    // 密码强度监测
    dom.masterSetup.addEventListener('input', () => updateStrengthBar(dom.masterSetup.value));

    // 锁定
    dom.btnLock.addEventListener('click', lockVault);
    // 删除账号按钮（在解锁界面上）
    dom.btnReset.addEventListener('click', resetCurrentUser);

    // 新增
    dom.btnAdd.addEventListener('click', openAddModal);

    // 搜索
    dom.searchInput.addEventListener('input', renderEntries);

    // 分类 — 事件委托
    dom.categoryBar.addEventListener('click', (e) => {
        // 分类删除按钮
        const delBtn = e.target.closest('.cat-chip-delete');
        if (delBtn) {
            e.stopPropagation();
            e.preventDefault();
            deleteCustomCategory(delBtn.dataset.cat);
            return;
        }

        // 分类芯片点击
        const chip = e.target.closest('.cat-chip');
        if (chip) {
            appState.currentCategory = chip.dataset.cat;
            renderCategoryBar();
            renderEntries();
            return;
        }

        // 添加分类按钮 — 切换弹窗
        const addBtn = e.target.closest('#btnAddCategory');
        if (addBtn) {
            e.stopPropagation();
            e.preventDefault();
            const popup = document.getElementById('catAddPopup');
            if (popup) {
                const isActive = popup.classList.contains('active');
                if (isActive) {
                    popup.classList.remove('active');
                } else {
                    // 动态定位弹窗在按钮下方
                    const rect = addBtn.getBoundingClientRect();
                    popup.style.top = (rect.bottom + 8) + 'px';
                    popup.style.left = Math.min(rect.left, window.innerWidth - 220) + 'px';
                    popup.classList.add('active');
                    const input = document.getElementById('catAddInput');
                    if (input) setTimeout(() => input.focus(), 50);
                }
            }
            return;
        }
    });

    // 弹窗 - 条目保存
    dom.btnModalSave.addEventListener('click', saveEntry);
    dom.btnModalCancel.addEventListener('click', () => closeModal(dom.entryModal));
    dom.btnModalClose.addEventListener('click', () => closeModal(dom.entryModal));
    dom.entryModal.querySelector('.modal-backdrop').addEventListener('click', () => closeModal(dom.entryModal));

    // 弹窗 - 条目中密码显示/隐藏
    dom.btnTogglePw.addEventListener('click', () => {
        const isPassword = dom.entryPassword.type === 'password';
        dom.entryPassword.type = isPassword ? 'text' : 'password';
        dom.btnTogglePw.textContent = isPassword ? '🙈' : '👁️';
    });

    // 弹窗 - 条目中生成密码
    dom.btnGenPw.addEventListener('click', () => {
        const pw = generatePassword();
        if (pw) {
            dom.entryPassword.value = pw;
            dom.entryPassword.type = 'text';
            dom.btnTogglePw.textContent = '🙈';
            showToast('随机密码已生成', 'success');
        }
    });

    // 生成器弹窗
    dom.btnGenerator.addEventListener('click', () => {
        appState.generatedPassword = '';
        dom.generatedPassword.textContent = '点击生成';
        openModal(dom.generatorModal);
    });
    dom.btnGenClose.addEventListener('click', () => closeModal(dom.generatorModal));
    dom.generatorModal.querySelector('.modal-backdrop').addEventListener('click', () => closeModal(dom.generatorModal));

    dom.pwLength.addEventListener('input', () => {
        dom.lenValue.textContent = dom.pwLength.value;
        appState.generatedPassword = '';
        dom.generatedPassword.textContent = '点击生成';
    });

    dom.btnGenerate.addEventListener('click', () => {
        const pw = generatePassword();
        if (pw) {
            appState.generatedPassword = pw;
            dom.generatedPassword.textContent = pw;
        }
    });

    dom.btnCopyGen.addEventListener('click', () => {
        if (appState.generatedPassword) {
            copyToClipboard(appState.generatedPassword, '密码');
        } else {
            showToast('请先生成密码', 'error');
        }
    });

    dom.btnUseGen.addEventListener('click', () => {
        if (appState.generatedPassword) {
            dom.entryPassword.value = appState.generatedPassword;
            dom.entryPassword.type = 'text';
            dom.btnTogglePw.textContent = '🙈';
            closeModal(dom.generatorModal);
            if (!dom.entryModal.classList.contains('active')) {
                openAddModal();
                dom.entryPassword.value = appState.generatedPassword;
                dom.entryPassword.type = 'text';
                dom.btnTogglePw.textContent = '🙈';
            }
        } else {
            showToast('请先生成密码', 'error');
        }
    });

    // 设置弹窗
    dom.btnSettings.addEventListener('click', () => {
        dom.settingsVaultName.value = appState.settings.vaultName;
        dom.settingsAutoLock.value = appState.settings.autoLockMinutes;
        dom.settingsOldMaster.value = '';
        dom.settingsNewMaster.value = '';
        openModal(dom.settingsModal);
    });
    dom.btnSettingsClose.addEventListener('click', () => closeModal(dom.settingsModal));
    dom.settingsModal.querySelector('.modal-backdrop').addEventListener('click', () => closeModal(dom.settingsModal));

    dom.btnSettingsSave.addEventListener('click', async () => {
        const newName = dom.settingsVaultName.value.trim() || 'Krypton Vault';
        const autoLock = parseInt(dom.settingsAutoLock.value) || 0;

        appState.settings.vaultName = newName;
        appState.settings.autoLockMinutes = Math.max(0, Math.min(60, autoLock));
        saveSettings();

        // 修改主密码
        await changeMasterPassword();

        closeModal(dom.settingsModal);
        startAutoLockTimer();
        showToast('设置已保存', 'success');
    });

    // 导出/导入
    dom.btnExport.addEventListener('click', exportData);
    dom.btnImport.addEventListener('click', () => dom.importFile.click());
    dom.importFile.addEventListener('change', importData);

    // 重置
    dom.btnResetAll.addEventListener('click', resetAll);

    // 自定义标题
    dom.appTitle.addEventListener('blur', () => {
        const newName = dom.appTitle.textContent.trim() || 'Krypton Vault';
        appState.settings.vaultName = newName;
        saveSettings();
    });
    dom.appTitle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            dom.appTitle.blur();
        }
    });

    // 分类弹窗：确认按钮
    const catAddPopup = document.getElementById('catAddPopup');
    const catAddInput = document.getElementById('catAddInput');
    const catAddConfirm = document.getElementById('catAddConfirm');
    const catAddCancel = document.getElementById('catAddCancel');

    if (catAddConfirm) {
        catAddConfirm.addEventListener('click', () => {
            const name = catAddInput.value.trim();
            if (name) addCustomCategory(name);
            catAddPopup.classList.remove('active');
            catAddInput.value = '';
        });
    }
    if (catAddCancel) {
        catAddCancel.addEventListener('click', () => {
            catAddPopup.classList.remove('active');
            catAddInput.value = '';
        });
    }
    if (catAddInput) {
        catAddInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const name = catAddInput.value.trim();
                if (name) addCustomCategory(name);
                catAddPopup.classList.remove('active');
                catAddInput.value = '';
            }
            if (e.key === 'Escape') {
                catAddPopup.classList.remove('active');
                catAddInput.value = '';
            }
        });
    }

    // 全局：点击外部关闭分类弹窗
    document.addEventListener('click', (e) => {
        const popup = document.getElementById('catAddPopup');
        if (popup && popup.classList.contains('active')) {
            if (!e.target.closest('#catAddPopup') && !e.target.closest('#btnAddCategory')) {
                popup.classList.remove('active');
            }
        }
    });

    // 删除确认弹窗事件
    const confirmOverlay = document.getElementById('confirmOverlay');
    const confirmOk = document.getElementById('confirmOk');
    const confirmCancel = document.getElementById('confirmCancel');

    if (confirmOk) {
        confirmOk.addEventListener('click', async () => {
            const id = _pendingDeleteId;
            const username = _pendingDeleteUser;
            confirmOverlay.classList.remove('active');
            _pendingDeleteId = null;
            _pendingDeleteUser = null;
            if (username) {
                doResetUser(username);
            } else if (id) {
                await doDeleteEntry(id);
            }
        });
    }
    if (confirmCancel) {
        confirmCancel.addEventListener('click', () => {
            confirmOverlay.classList.remove('active');
            _pendingDeleteId = null;
            _pendingDeleteUser = null;
        });
    }
    // 点击遮罩关闭
    if (confirmOverlay) {
        confirmOverlay.addEventListener('click', (e) => {
            if (e.target === confirmOverlay) {
                confirmOverlay.classList.remove('active');
                _pendingDeleteId = null;
                _pendingDeleteUser = null;
            }
        });
    }

    // 密码列表：事件委托处理删除按钮
    dom.entryList.addEventListener('click', (e) => {
        const delBtn = e.target.closest('.entry-action-btn.delete');
        if (!delBtn) return;
        e.stopPropagation();
        e.preventDefault();
        const id = delBtn.dataset.id;
        if (id) deleteEntry(id);
    });

    // 全局：键盘快捷键
    document.addEventListener('keydown', (e) => {
        // Ctrl+L 锁定
        if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
            if (appState.masterKey) {
                e.preventDefault();
                lockVault();
            }
        }
        // Ctrl+N 新增
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            if (appState.masterKey) {
                e.preventDefault();
                openAddModal();
            }
        }
        // Escape 关闭弹窗
        if (e.key === 'Escape') {
            // 优先关闭确认弹窗
            const confirmOverlay = document.getElementById('confirmOverlay');
            if (confirmOverlay && confirmOverlay.classList.contains('active')) {
                confirmOverlay.classList.remove('active');
                _pendingDeleteId = null;
                _pendingDeleteUser = null;
                return;
            }
            closeAllModals();
        }
    });

    // 全局：鼠标/键盘活动重置自动锁定
    ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, () => {
            if (appState.masterKey) resetAutoLockTimer();
        }, { passive: true });
    });
}

// ============ 启动 ============
init();

console.log('%c🔐 Krypton Vault %c已就绪',
    'font-size:1.2em;font-weight:bold;color:#d946ef;',
    'color:#aaa;');
console.log('%c所有数据仅存储在您的浏览器本地，通过 AES-256-GCM 加密保护。',
    'color:#888;font-style:italic;');
