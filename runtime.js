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
const USE_LOCAL_MODE = true;

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
        const users = JSON.parse(localStorage.getItem('parkoreen_local_users') || '{}');
        const user = users[username.toLowerCase()];
        
        if (!user) {
            throw new Error('Invalid username or password');
        }
        
        // Simple password check (not secure, just for local testing)
        if (user.password !== password) {
            throw new Error('Invalid username or password');
        }
        
        this.user = { id: user.id, name: user.name, username: user.username };
        this.token = 'local_' + user.id;
        this.saveToStorage();
        
        return { user: this.user, token: this.token };
    }

    localSignup(name, username, password) {
        const users = JSON.parse(localStorage.getItem('parkoreen_local_users') || '{}');
        
        if (users[username.toLowerCase()]) {
            throw new Error('Username already taken');
        }
        
        const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        users[username.toLowerCase()] = {
            id: userId,
            name,
            username,
            password, // In local mode, we store password directly (not secure, just for testing)
            createdAt: new Date().toISOString()
        };
        
        localStorage.setItem('parkoreen_local_users', JSON.stringify(users));
        
        this.user = { id: userId, name, username };
        this.token = 'local_' + userId;
        this.saveToStorage();
        
        return { user: this.user, token: this.token };
    }

    async updateProfile(updates) {
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
            window.location.href = '/parkoreen/login/';
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

    async createMap(name) {
        if (USE_LOCAL_MODE) {
            const mapId = 'map_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const map = {
                id: mapId,
                name,
                data: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            const maps = this._getLocalMaps();
            maps[mapId] = map;
            this._saveLocalMaps(maps);
            
            return { id: mapId, name };
        }

        const response = await fetchWithTimeout(`${API_URL}/maps`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.auth.getToken()}`
            },
            body: JSON.stringify({ name })
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
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                // Authenticate
                this.send({
                    type: 'auth',
                    token: this.auth.getToken()
                });
                resolve();
            };
            
            this.ws.onerror = (error) => {
                reject(error);
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (e) {
                    console.error('Failed to parse message:', e);
                }
            };
            
            this.ws.onclose = () => {
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

        this.send({
            type: 'join_room',
            roomCode,
            password
        });
    }

    leaveRoom() {
        this.send({ type: 'leave_room' });
        this.roomCode = null;
        this.isHost = false;
        this.players.clear();
    }

    sendPosition(x, y) {
        this.send({
            type: 'position',
            x,
            y
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
// SETTINGS MANAGER
// ============================================
class SettingsManager {
    constructor() {
        this.defaults = {
            volume: 100,
            touchscreenMode: false
        };
        this.settings = { ...this.defaults };
        this.load();
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
window.API_URL = API_URL;
window.Auth = new AuthManager();
window.MapManager = new MapManager(window.Auth);
window.MultiplayerManager = new MultiplayerManager(window.Auth);
window.Settings = new SettingsManager();
window.Navigation = Navigation;
window.createFooter = createFooter;

// Auto-add footer to pages
document.addEventListener('DOMContentLoaded', () => {
    const pageContainer = document.querySelector('.page-container');
    if (pageContainer && !document.querySelector('.page-footer')) {
        pageContainer.appendChild(createFooter());
    }
});
