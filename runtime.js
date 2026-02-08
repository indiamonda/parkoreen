/**
 * PARKOREEN - Runtime
 * Shared functionality across all pages
 */

// ============================================
// API CONFIGURATION
// ============================================
const API_URL = 'https://parkoreen.ikunbeautiful.workers.dev';
const API_TIMEOUT = 10000; // 10 seconds timeout

// Set to true to use local storage instead of API (for testing without backend)
// KV namespaces are now configured!
const USE_LOCAL_MODE = false;

// ============================================
// FETCH WITH TIMEOUT
// ============================================
async function fetchWithTimeout(url, options = {}, timeout = API_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Please check your connection.');
        }
        throw new Error('Network error. Please check your connection.');
    }
}

// ============================================
// AUTH MANAGER
// ============================================
class AuthManager {
    constructor() {
        this.user = null;
        this.token = null;
        this.loadFromStorage();
    }

    loadFromStorage() {
        const savedUser = localStorage.getItem('parkoreen_user');
        const savedToken = localStorage.getItem('parkoreen_token');
        
        if (savedUser && savedToken) {
            try {
                this.user = JSON.parse(savedUser);
                this.token = savedToken;
            } catch (e) {
                this.logout();
            }
        }
    }

    saveToStorage() {
        if (this.user && this.token) {
            localStorage.setItem('parkoreen_user', JSON.stringify(this.user));
            localStorage.setItem('parkoreen_token', this.token);
        }
    }

    isLoggedIn() {
        return !!(this.user && this.token);
    }

    getToken() {
        return this.token;
    }

    getUser() {
        return this.user;
    }

    async login(username, password) {
        // Local mode - check local storage
        if (USE_LOCAL_MODE) {
            return this.localLogin(username, password);
        }

        const response = await fetchWithTimeout(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Login failed' }));
            throw new Error(error.message);
        }

        const data = await response.json();
        this.user = data.user;
        this.token = data.token;
        this.saveToStorage();
        
        return data;
    }

    async signup(name, username, password) {
        // Check for reserved name easter egg
        if (window.JimmyQrgManager?.isReservedName(name)) {
            window.JimmyQrgManager.triggerForReservedName();
            throw new Error('Nice try! ;)');
        }

        // Local mode - store in local storage
        if (USE_LOCAL_MODE) {
            return this.localSignup(name, username, password);
        }

        const response = await fetchWithTimeout(`${API_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, username, password })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Signup failed' }));
            throw new Error(error.message);
        }

        const data = await response.json();
        this.user = data.user;
        this.token = data.token;
        this.saveToStorage();
        
        return data;
    }

    // ========== LOCAL MODE METHODS (for testing without backend) ==========
    
    localLogin(username, password) {
        try {
            const usersStr = localStorage.getItem('parkoreen_local_users');
            console.log('[Auth] Local users storage:', usersStr);
            const users = JSON.parse(usersStr || '{}');
            const userKey = username.toLowerCase();
            const user = users[userKey];
            
            console.log('[Auth] Looking for user:', userKey);
            console.log('[Auth] Found user:', user ? 'yes' : 'no');
            
            if (!user) {
                throw new Error('User not found');
            }
            
            // Simple password check (not secure, just for local testing)
            if (user.password !== password) {
                console.log('[Auth] Password mismatch');
                throw new Error('Invalid password');
            }
            
            this.user = { id: user.id, name: user.name, username: user.username };
            this.token = 'local_' + user.id;
            this.saveToStorage();
            
            console.log('[Auth] Login successful:', this.user);
            return { user: this.user, token: this.token };
        } catch (e) {
            console.error('[Auth] Login error:', e);
            throw e;
        }
    }

    localSignup(name, username, password) {
        // Check for reserved name easter egg
        if (window.JimmyQrgManager?.isReservedName(name)) {
            window.JimmyQrgManager.triggerForReservedName();
            throw new Error('Nice try! ;)');
        }

        try {
            const usersStr = localStorage.getItem('parkoreen_local_users');
            const users = JSON.parse(usersStr || '{}');
            const userKey = username.toLowerCase();
            
            console.log('[Auth] Checking if username exists:', userKey);
            
            if (users[userKey]) {
                console.log('[Auth] Username already exists');
                throw new Error('Username already exists. Please choose a different username.');
            }
            
            const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            users[userKey] = {
                id: userId,
                name,
                username,
                password, // In local mode, we store password directly (not secure, just for testing)
                createdAt: new Date().toISOString()
            };
            
            localStorage.setItem('parkoreen_local_users', JSON.stringify(users));
            console.log('[Auth] User created:', userId);
            
            this.user = { id: userId, name, username };
            this.token = 'local_' + userId;
            this.saveToStorage();
            
            return { user: this.user, token: this.token };
        } catch (e) {
            console.error('[Auth] Signup error:', e);
            throw e;
        }
    }

    async updateProfile(updates) {
        // Check for reserved name easter egg
        if (updates.name && window.JimmyQrgManager?.isReservedName(updates.name)) {
            window.JimmyQrgManager.triggerForReservedName();
            throw new Error('Nice try! ;)');
        }

        if (USE_LOCAL_MODE) {
            return this.localUpdateProfile(updates);
        }

        const response = await fetchWithTimeout(`${API_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify(updates)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Update failed' }));
            throw new Error(error.message);
        }

        const data = await response.json();
        this.user = { ...this.user, ...data.user };
        this.saveToStorage();
        
        return data;
    }

    async changePassword(currentPassword, newPassword) {
        if (USE_LOCAL_MODE) {
            return this.localChangePassword(currentPassword, newPassword);
        }

        const response = await fetchWithTimeout(`${API_URL}/auth/password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Password change failed' }));
            throw new Error(error.message);
        }

        return response.json();
    }

    localUpdateProfile(updates) {
        // Check for reserved name easter egg
        if (updates.name && window.JimmyQrgManager?.isReservedName(updates.name)) {
            window.JimmyQrgManager.triggerForReservedName();
            throw new Error('Nice try! ;)');
        }

        const users = JSON.parse(localStorage.getItem('parkoreen_local_users') || '{}');
        const userKey = this.user.username.toLowerCase();
        
        if (users[userKey] && updates.name) {
            users[userKey].name = updates.name;
            localStorage.setItem('parkoreen_local_users', JSON.stringify(users));
            this.user.name = updates.name;
            this.saveToStorage();
        }
        
        return { user: this.user };
    }

    localChangePassword(currentPassword, newPassword) {
        const users = JSON.parse(localStorage.getItem('parkoreen_local_users') || '{}');
        const userKey = this.user.username.toLowerCase();
        
        if (!users[userKey]) {
            throw new Error('User not found');
        }
        
        if (users[userKey].password !== currentPassword) {
            throw new Error('Current password is incorrect');
        }
        
        users[userKey].password = newPassword;
        localStorage.setItem('parkoreen_local_users', JSON.stringify(users));
        
        return { success: true };
    }

    logout() {
        this.user = null;
        this.token = null;
        localStorage.removeItem('parkoreen_user');
        localStorage.removeItem('parkoreen_token');
    }

    requireAuth() {
        if (!this.isLoggedIn()) {
            // Preserve current URL as redirect destination
            var currentPath = window.location.pathname + window.location.search;
            window.location.href = '/parkoreen/login/?redirect=' + encodeURIComponent(currentPath);
            return false;
        }
        return true;
    }
}

// ============================================
// MAP MANAGER
// ============================================
class MapManager {
    constructor(auth) {
        this.auth = auth;
    }

    // Get local maps storage key for current user
    _getLocalMapsKey() {
        const user = this.auth.getUser();
        return user ? `parkoreen_local_maps_${user.id}` : 'parkoreen_local_maps';
    }

    _getLocalMaps() {
        return JSON.parse(localStorage.getItem(this._getLocalMapsKey()) || '{}');
    }

    _saveLocalMaps(maps) {
        localStorage.setItem(this._getLocalMapsKey(), JSON.stringify(maps));
    }

    async listMaps() {
        if (USE_LOCAL_MODE) {
            const maps = this._getLocalMaps();
            return Object.values(maps).map(m => ({
                id: m.id,
                name: m.name,
                createdAt: m.createdAt,
                updatedAt: m.updatedAt
            }));
        }

        const response = await fetchWithTimeout(`${API_URL}/maps`, {
            headers: {
                'Authorization': `Bearer ${this.auth.getToken()}`
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to load maps' }));
            throw new Error(error.message);
        }

        return response.json();
    }

    async getMap(mapId) {
        if (USE_LOCAL_MODE) {
            const maps = this._getLocalMaps();
            const map = maps[mapId];
            if (!map) {
                throw new Error('Map not found');
            }
            return map;
        }

        const response = await fetchWithTimeout(`${API_URL}/maps/${mapId}`, {
            headers: {
                'Authorization': `Bearer ${this.auth.getToken()}`
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to load map' }));
            throw new Error(error.message);
        }

        return response.json();
    }

    // Generate a unique name by appending a number if the name already exists
    _getUniqueName(existingMaps, baseName) {
        const existingNames = existingMaps.map(m => m.name.toLowerCase());
        
        // Check if the base name is already unique
        if (!existingNames.includes(baseName.toLowerCase())) {
            return baseName;
        }
        
        // Find the highest number suffix for this base name
        let maxNum = 1;
        const baseNameLower = baseName.toLowerCase();
        
        for (const existingName of existingNames) {
            // Check for exact match with number suffix (e.g., "Map 2", "Map 3")
            const match = existingName.match(new RegExp(`^${this._escapeRegex(baseNameLower)}\\s*(\\d+)?$`));
            if (match) {
                const num = match[1] ? parseInt(match[1]) : 1;
                if (num >= maxNum) {
                    maxNum = num + 1;
                }
            }
        }
        
        return `${baseName} ${maxNum}`;
    }
    
    _escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    async createMap(name) {
        if (USE_LOCAL_MODE) {
            const maps = this._getLocalMaps();
            const existingMaps = Object.values(maps);
            const uniqueName = this._getUniqueName(existingMaps, name);
            
            const mapId = 'map_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const map = {
                id: mapId,
                name: uniqueName,
                data: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            maps[mapId] = map;
            this._saveLocalMaps(maps);
            
            return { id: mapId, name: uniqueName };
        }

        // For API mode, first get existing maps to check for duplicates
        const existingMaps = await this.listMaps();
        const uniqueName = this._getUniqueName(existingMaps, name);

        const response = await fetchWithTimeout(`${API_URL}/maps`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.auth.getToken()}`
            },
            body: JSON.stringify({ name: uniqueName })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to create map' }));
            throw new Error(error.message);
        }

        return response.json();
    }

    async saveMap(mapId, data) {
        if (USE_LOCAL_MODE) {
            const maps = this._getLocalMaps();
            if (!maps[mapId]) {
                throw new Error('Map not found');
            }
            
            maps[mapId] = {
                ...maps[mapId],
                ...data,
                updatedAt: new Date().toISOString()
            };
            this._saveLocalMaps(maps);
            
            return { success: true };
        }

        const response = await fetchWithTimeout(`${API_URL}/maps/${mapId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.auth.getToken()}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to save map' }));
            throw new Error(error.message);
        }

        return response.json();
    }

    async deleteMap(mapId) {
        if (USE_LOCAL_MODE) {
            const maps = this._getLocalMaps();
            if (!maps[mapId]) {
                throw new Error('Map not found');
            }
            
            delete maps[mapId];
            this._saveLocalMaps(maps);
            
            return { success: true };
        }

        const response = await fetchWithTimeout(`${API_URL}/maps/${mapId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.auth.getToken()}`
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to delete map' }));
            throw new Error(error.message);
        }

        return response.json();
    }

    async duplicateMap(mapId) {
        // Get the original map data
        const originalMap = await this.getMap(mapId);
        
        // Create a new map with the same name (will be auto-numbered)
        const newMap = await this.createMap(originalMap.name);
        
        // Copy the map data to the new map
        if (originalMap.data) {
            await this.saveMap(newMap.id, { data: originalMap.data });
        }
        
        return newMap;
    }
}

// ============================================
// MULTIPLAYER MANAGER
// ============================================
class MultiplayerManager {
    constructor(auth) {
        this.auth = auth;
        this.ws = null;
        this.roomCode = null;
        this.isHost = false;
        this.isAuthenticated = false;
        this.players = new Map();
        this.callbacks = {};
    }

    on(event, callback) {
        this.callbacks[event] = callback;
    }

    emit(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event](data);
        }
    }

    connect() {
        return new Promise((resolve, reject) => {
            const wsUrl = API_URL.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws';
            console.log('[Multiplayer] Connecting to:', wsUrl);
            
            try {
                this.ws = new WebSocket(wsUrl);
            } catch (error) {
                console.error('[Multiplayer] Failed to create WebSocket:', error);
                reject(new Error('Multiplayer service unavailable. WebSocket connection failed.'));
                return;
            }
            
            // Connection timeout
            const timeout = setTimeout(() => {
                if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
                    this.ws.close();
                    reject(new Error('Connection timed out. Multiplayer server may be unavailable.'));
                }
            }, 10000);
            
            this.ws.onopen = () => {
                clearTimeout(timeout);
                console.log('[Multiplayer] Connected!');
                // Authenticate
                this.send({
                    type: 'auth',
                    token: this.auth.getToken()
                });
                resolve();
            };
            
            this.ws.onerror = (error) => {
                clearTimeout(timeout);
                console.error('[Multiplayer] WebSocket error:', error);
                reject(new Error('Multiplayer server unavailable. You can still edit maps locally.'));
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (e) {
                    console.error('[Multiplayer] Failed to parse message:', e);
                }
            };
            
            this.ws.onclose = (event) => {
                clearTimeout(timeout);
                console.log('[Multiplayer] Connection closed:', event.code, event.reason);
                this.emit('disconnected');
                this.ws = null;
            };
        });
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.roomCode = null;
        this.isHost = false;
        this.isAuthenticated = false;
        this.players.clear();
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'auth_success':
                this.emit('authenticated');
                break;
                
            case 'room_created':
                this.roomCode = data.roomCode;
                this.isHost = true;
                this.emit('roomCreated', data);
                break;
                
            case 'room_joined':
                this.roomCode = data.roomCode;
                this.isHost = false;
                this.emit('roomJoined', data);
                break;
                
            case 'room_rejoined':
                this.roomCode = data.roomCode;
                this.isHost = data.isHost || false;
                // Add existing players
                if (data.players) {
                    data.players.forEach(p => {
                        this.players.set(p.id, { id: p.id, name: p.name, color: p.color });
                    });
                }
                this.emit('roomRejoined', data);
                break;
                
            case 'player_joined':
                this.players.set(data.playerId, {
                    id: data.playerId,
                    name: data.playerName,
                    color: data.playerColor
                });
                this.emit('playerJoined', data);
                break;
                
            case 'player_left':
                this.players.delete(data.playerId);
                this.emit('playerLeft', data);
                break;
                
            case 'player_position':
                this.emit('playerPosition', data);
                break;
            
            case 'position_ack':
                this.emit('positionAck', data);
                break;
                
            case 'player_kicked':
                this.emit('kicked', data);
                break;
                
            case 'room_closed':
                this.emit('roomClosed', data);
                break;
                
            case 'game_end':
                this.emit('gameEnd', data);
                break;
                
            case 'chat_message':
                this.emit('chatMessage', data);
                break;
                
            case 'error':
                this.emit('error', data);
                break;
        }
    }

    async hostGame(options) {
        if (!this.ws) {
            await this.connect();
        }

        // Wait for authentication before creating room
        await this.waitForAuth();

        this.send({
            type: 'create_room',
            mapData: options.mapData,
            maxPlayers: options.maxPlayers,
            usePassword: options.usePassword,
            password: options.password
        });
    }

    async joinGame(roomCode, password = null) {
        if (!this.ws) {
            await this.connect();
        }

        // Wait for authentication before joining room
        await this.waitForAuth();

        this.send({
            type: 'join_room',
            roomCode,
            password
        });
    }

    waitForAuth() {
        return new Promise((resolve, reject) => {
            // If already authenticated, resolve immediately
            if (this.isAuthenticated) {
                resolve();
                return;
            }

            // Wait for auth_success
            const timeout = setTimeout(() => {
                reject(new Error('Authentication timed out'));
            }, 10000);

            const originalCallback = this.callbacks['authenticated'];
            this.on('authenticated', () => {
                clearTimeout(timeout);
                this.isAuthenticated = true;
                if (originalCallback) originalCallback();
                resolve();
            });
        });
    }

    leaveRoom() {
        this.send({ type: 'leave_room' });
        this.roomCode = null;
        this.isHost = false;
        this.players.clear();
    }

    sendPosition(x, y, vx = 0, vy = 0, jumps = 1) {
        this.send({
            type: 'position',
            x,
            y,
            vx,
            vy,
            jumps
        });
    }

    kickPlayer(playerId) {
        if (!this.isHost) return;
        
        this.send({
            type: 'kick_player',
            playerId
        });
    }

    sendChatMessage(message) {
        this.send({
            type: 'chat',
            message
        });
    }

    getPlayers() {
        return Array.from(this.players.values());
    }

    getRoomCode() {
        return this.roomCode;
    }
}

// ============================================
// JIMMYQRG EASTER EGG MANAGER
// ============================================
const RESERVED_DISPLAY_NAMES = ['jimmyqrg'];

class JimmyQrgManager {
    constructor() {
        this.DB_NAME = 'ParkoreenEasterEgg';
        this.DB_STORE = 'flags';
        this.FLAG_KEY = 'JIMMYQRG';
        this.popupElement = null;
        this.isPhase2 = false;
    }

    // Check if name is reserved
    isReservedName(name) {
        if (!name) return false;
        return RESERVED_DISPLAY_NAMES.includes(name.toLowerCase().trim());
    }

    // ========== LOCAL STORAGE ==========
    getLocalStorage() {
        return localStorage.getItem(this.FLAG_KEY) === 'true';
    }

    setLocalStorage(value) {
        if (value) {
            localStorage.setItem(this.FLAG_KEY, 'true');
        } else {
            localStorage.removeItem(this.FLAG_KEY);
        }
    }

    // ========== INDEXED DB ==========
    async openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.DB_STORE)) {
                    db.createObjectStore(this.DB_STORE, { keyPath: 'key' });
                }
            };
        });
    }

    async getIndexedDB() {
        try {
            const db = await this.openDB();
            return new Promise((resolve) => {
                const tx = db.transaction(this.DB_STORE, 'readonly');
                const store = tx.objectStore(this.DB_STORE);
                const request = store.get(this.FLAG_KEY);
                request.onsuccess = () => resolve(request.result?.value === true);
                request.onerror = () => resolve(false);
            });
        } catch {
            return false;
        }
    }

    async setIndexedDB(value) {
        try {
            const db = await this.openDB();
            return new Promise((resolve) => {
                const tx = db.transaction(this.DB_STORE, 'readwrite');
                const store = tx.objectStore(this.DB_STORE);
                if (value) {
                    store.put({ key: this.FLAG_KEY, value: true });
                } else {
                    store.delete(this.FLAG_KEY);
                }
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        } catch {
            return false;
        }
    }

    // ========== SERVER STORAGE ==========
    async getServer() {
        try {
            const token = window.Auth?.getToken();
            if (!token) return false;
            
            const response = await fetch(`${API_URL}/flag/${this.FLAG_KEY}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) return false;
            const data = await response.json();
            return data.value === true;
        } catch {
            return false;
        }
    }

    async setServer(value) {
        try {
            const token = window.Auth?.getToken();
            if (!token) return false;
            
            await fetch(`${API_URL}/flag/${this.FLAG_KEY}`, {
                method: value ? 'PUT' : 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ value: true })
            });
            return true;
        } catch {
            return false;
        }
    }

    // ========== COMBINED OPERATIONS ==========
    async checkFlagExists() {
        const [local, indexed, server] = await Promise.all([
            this.getLocalStorage(),
            this.getIndexedDB(),
            this.getServer()
        ]);
        return local || indexed || server;
    }

    async setAllFlags(value) {
        await Promise.all([
            this.setLocalStorage(value),
            this.setIndexedDB(value),
            this.setServer(value)
        ]);
    }

    async clearAllFlags() {
        await this.setAllFlags(false);
    }

    // ========== POPUP MANAGEMENT ==========
    createPopup() {
        // Remove existing popup if any
        this.removePopup();

        const overlay = document.createElement('div');
        overlay.id = 'jimmyqrg-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            font-family: 'Parkoreen UI', -apple-system, BlinkMacSystemFont, sans-serif;
        `;

        const popup = document.createElement('div');
        popup.id = 'jimmyqrg-popup';
        popup.style.cssText = `
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 2px solid #4ade80;
            border-radius: 16px;
            padding: 32px;
            max-width: 450px;
            text-align: center;
            box-shadow: 0 0 40px rgba(74, 222, 128, 0.3);
        `;

        this.updatePopupContent(popup);
        overlay.appendChild(popup);
        document.body.appendChild(overlay);
        this.popupElement = overlay;

        // Prevent closing via escape or clicking outside
        overlay.addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('keydown', this.blockEscape);

        // Anti-adblocker: Re-create if removed
        this.startAntiRemovalCheck();
    }

    updatePopupContent(popup) {
        if (!popup) popup = document.getElementById('jimmyqrg-popup');
        if (!popup) return;

        const title = this.isPhase2 ? ':):):):):):):):):)' : ':):):):):)';
        const content = this.isPhase2 
            ? "Come on, you can't avoid this."
            : "If you really love me that much, why don't you go ahead and create a fan club?";
        
        const buttonLabels = this.isPhase2
            ? ['YES I DID', 'YES I DID', 'YES I DID', 'YES I DID', 'No one would do that']
            : ['YES I DID', 'Yes I did', 'Yes I did', 'Yes I did', 'No one would do that'];

        popup.innerHTML = `
            <h1 style="color: #4ade80; font-size: 2.5rem; margin: 0 0 20px 0; letter-spacing: 4px;">${title}</h1>
            <p style="color: #e0e0e0; font-size: 1.1rem; line-height: 1.6; margin: 0 0 28px 0;">${content}</p>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${buttonLabels.map((label, index) => {
                    const isDisabled = this.isPhase2 && index === 4;
                    const isDefault = index === 0;
                    return `
                        <button 
                            class="jimmyqrg-btn" 
                            data-index="${index}"
                            style="
                                padding: 14px 24px;
                                font-size: 1rem;
                                font-weight: ${isDefault ? '600' : '500'};
                                border-radius: 8px;
                                cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
                                transition: all 0.2s ease;
                                font-family: inherit;
                                ${isDefault ? `
                                    background: linear-gradient(135deg, #22c55e, #16a34a);
                                    border: none;
                                    color: white;
                                    box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
                                ` : isDisabled ? `
                                    background: #333;
                                    border: 1px solid #444;
                                    color: #666;
                                ` : `
                                    background: rgba(255,255,255,0.1);
                                    border: 1px solid rgba(255,255,255,0.2);
                                    color: #ccc;
                                `}
                            "
                            ${isDisabled ? 'disabled' : ''}
                        >${label}</button>
                    `;
                }).join('')}
            </div>
        `;

        // Attach button handlers
        popup.querySelectorAll('.jimmyqrg-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleButtonClick(e));
            btn.addEventListener('mouseenter', (e) => {
                if (!e.target.disabled) {
                    e.target.style.transform = 'scale(1.02)';
                }
            });
            btn.addEventListener('mouseleave', (e) => {
                e.target.style.transform = 'scale(1)';
            });
        });
    }

    async handleButtonClick(e) {
        const index = parseInt(e.target.dataset.index);
        
        if (index === 4) {
            // "No one would do that" button
            if (!this.isPhase2) {
                this.isPhase2 = true;
                this.updatePopupContent();
            }
            return;
        }

        // Any "YES I DID" / "Yes I did" button
        this.removePopup();
        await this.clearAllFlags();
        this.showGoodBoyPopup();
    }

    showGoodBoyPopup() {
        const message = this.isPhase2 ? 'GOOOOOOOOD BOOOOOYY :)' : 'Good Boy';
        
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            font-family: 'Parkoreen UI', -apple-system, BlinkMacSystemFont, sans-serif;
        `;

        const popup = document.createElement('div');
        popup.style.cssText = `
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 2px solid #4ade80;
            border-radius: 16px;
            padding: 40px 60px;
            text-align: center;
            box-shadow: 0 0 60px rgba(74, 222, 128, 0.4);
        `;

        popup.innerHTML = `
            <h1 style="color: #4ade80; font-size: ${this.isPhase2 ? '2rem' : '2.5rem'}; margin: 0 0 24px 0;">${message}</h1>
            <button id="goodboy-ok" style="
                padding: 14px 48px;
                font-size: 1.1rem;
                font-weight: 600;
                background: linear-gradient(135deg, #22c55e, #16a34a);
                border: none;
                color: white;
                border-radius: 8px;
                cursor: pointer;
                font-family: inherit;
                box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
            ">OK</button>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        document.getElementById('goodboy-ok').addEventListener('click', () => {
            overlay.remove();
            document.removeEventListener('keydown', this.blockEscape);
        });
    }

    blockEscape = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    removePopup() {
        if (this.popupElement) {
            this.popupElement.remove();
            this.popupElement = null;
        }
        const existing = document.getElementById('jimmyqrg-overlay');
        if (existing) existing.remove();
        this.stopAntiRemovalCheck();
    }

    // Anti-removal check (in case popup is removed by extensions)
    startAntiRemovalCheck() {
        this.antiRemovalInterval = setInterval(() => {
            if (!document.getElementById('jimmyqrg-overlay')) {
                this.createPopup();
            }
        }, 100);
    }

    stopAntiRemovalCheck() {
        if (this.antiRemovalInterval) {
            clearInterval(this.antiRemovalInterval);
            this.antiRemovalInterval = null;
        }
    }

    // ========== MAIN TRIGGER ==========
    async triggerForReservedName() {
        await this.setAllFlags(true);
        this.isPhase2 = false;
        this.createPopup();
    }

    // Check on page load
    async checkOnLoad() {
        const flagExists = await this.checkFlagExists();
        if (flagExists) {
            this.isPhase2 = false;
            this.createPopup();
        }
    }
}

// Global instance
window.JimmyQrgManager = new JimmyQrgManager();

// Check on page load
document.addEventListener('DOMContentLoaded', () => {
    window.JimmyQrgManager.checkOnLoad();
});

// ============================================
// SETTINGS MANAGER
// ============================================
class SettingsManager {
    constructor() {
        this.defaults = {
            volume: 100,
            touchscreenMode: false,
            fontSize: 100 // percentage (50-150)
        };
        this.settings = { ...this.defaults };
        this.load();
        this.applyFontSize();
    }
    
    applyFontSize() {
        const size = this.settings.fontSize || 100;
        document.documentElement.style.fontSize = `${size}%`;
    }

    load() {
        const saved = localStorage.getItem('parkoreen_settings');
        if (saved) {
            try {
                this.settings = { ...this.defaults, ...JSON.parse(saved) };
            } catch (e) {
                this.settings = { ...this.defaults };
            }
        }
    }

    save() {
        localStorage.setItem('parkoreen_settings', JSON.stringify(this.settings));
    }

    get(key) {
        return this.settings[key];
    }

    set(key, value) {
        this.settings[key] = value;
        this.save();
        
        // Apply font size immediately when changed
        if (key === 'fontSize') {
            this.applyFontSize();
        }
    }

    reset() {
        this.settings = { ...this.defaults };
        this.save();
    }
}

// ============================================
// NAVIGATION
// ============================================
const Navigation = {
    toDashboard() {
        window.location.href = '/parkoreen/dashboard/';
    },
    
    toEditor(mapId) {
        window.location.href = `/parkoreen/host.html?map=${mapId}`;
    },
    
    toJoin() {
        window.location.href = '/parkoreen/join.html';
    },
    
    toSettings() {
        window.location.href = '/parkoreen/settings/';
    },
    
    toHowToPlay() {
        window.location.href = '/parkoreen/howtoplay/';
    },
    
    toLogin() {
        window.location.href = '/parkoreen/login/';
    },
    
    toSignup() {
        window.location.href = '/parkoreen/signup/';
    }
};

// ============================================
// FOOTER
// ============================================
function createFooter() {
    const footer = document.createElement('footer');
    footer.className = 'page-footer';
    footer.innerHTML = `
        <span>© Copyright JimmyQrg 2026</span>
        <a href="https://github.com/jimmyqrg/" target="_blank" rel="noopener" class="github-link">
            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z'/%3E%3C/svg%3E" alt="GitHub">
        </a>
    `;
    return footer;
}

// ============================================
// GLOBAL INSTANCES
// ============================================
console.log('[Runtime] Initializing global instances...');
window.API_URL = API_URL;
window.Auth = new AuthManager();
window.MapManager = new MapManager(window.Auth);
window.MultiplayerManager = new MultiplayerManager(window.Auth);
window.Settings = new SettingsManager();
window.Navigation = Navigation;
window.createFooter = createFooter;
console.log('[Runtime] Global instances initialized:', {
    Auth: typeof window.Auth,
    MapManager: typeof window.MapManager,
    MultiplayerManager: typeof window.MultiplayerManager,
    'MultiplayerManager.on': typeof window.MultiplayerManager?.on
});

// Auto-add footer to pages
document.addEventListener('DOMContentLoaded', () => {
    const pageContainer = document.querySelector('.page-container');
    if (pageContainer && !document.querySelector('.page-footer')) {
        pageContainer.appendChild(createFooter());
    }
});
