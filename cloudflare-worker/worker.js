/**
 * PARKOREEN - Cloudflare Worker
 * Handles authentication, map storage, and real-time multiplayer
 * 
 * Required KV Namespaces (bind in Cloudflare dashboard):
 * - USERS: User data storage
 * - MAPS: Map data storage
 * - SESSIONS: Session/token storage
 * - ROOMS: Active game rooms
 */

// ============================================
// CONFIGURATION
// ============================================
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

const JWT_SECRET = 'parkoreen-secret-key-change-in-production';
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================
// UTILITIES
// ============================================
function generateId(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar chars
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Allowed characters for username: letters, numbers, and specific symbols
const ALLOWED_USERNAME_CHARS = /^[a-zA-Z0-9,""''\.?/:;\-_=+{}\[\]\\|~`【】<> ]+$/;

// Reserved display names (case-insensitive) - only specific usernames can use these
const RESERVED_NAMES = {
    'jimmyqrg': ['jimmyqrg', 'jimmyqrgschool']
};

// Invisible/problematic characters to block in display names
const BLOCKED_DISPLAY_CHARS = ['ㅤ']; // Hangul Filler U+3164

function validateUsername(username) {
    if (!username || typeof username !== 'string') {
        return { valid: false, error: 'Username is required' };
    }
    
    const trimmed = username.trim();
    
    if (trimmed.length === 0 || trimmed === ' ') {
        return { valid: false, error: 'Username cannot be empty or just a space' };
    }
    
    if (trimmed.length < 3) {
        return { valid: false, error: 'Username must be at least 3 characters' };
    }
    
    if (trimmed.length > 30) {
        return { valid: false, error: 'Username must be at most 30 characters' };
    }
    
    if (!ALLOWED_USERNAME_CHARS.test(trimmed)) {
        return { valid: false, error: 'Username contains invalid characters. Allowed: letters, numbers, and , " " \' \' . ? / : ; - _ = + { } [ ] \\ | ~ ` 【 】 < > space' };
    }
    
    return { valid: true };
}

function validateDisplayName(name, username) {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: 'Display name is required' };
    }
    
    const trimmed = name.trim();
    
    if (trimmed.length === 0 || trimmed === ' ') {
        return { valid: false, error: 'Display name cannot be empty or just a space' };
    }
    
    if (trimmed.length > 50) {
        return { valid: false, error: 'Display name must be at most 50 characters' };
    }
    
    // Check for blocked characters
    for (const char of BLOCKED_DISPLAY_CHARS) {
        if (trimmed.includes(char)) {
            return { valid: false, error: 'Display name contains invalid characters' };
        }
    }
    
    // Check reserved names
    const nameLower = trimmed.toLowerCase();
    for (const [reservedName, allowedUsernames] of Object.entries(RESERVED_NAMES)) {
        if (nameLower === reservedName) {
            const usernameLower = (username || '').toLowerCase();
            if (!allowedUsernames.includes(usernameLower)) {
                return { valid: false, error: `The name "${trimmed}" is reserved` };
            }
        }
    }
    
    return { valid: true };
}

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + JWT_SECRET);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, hash) {
    const passwordHash = await hashPassword(password);
    return passwordHash === hash;
}

function generateToken(userId) {
    const payload = {
        userId,
        exp: Date.now() + TOKEN_EXPIRY,
        iat: Date.now()
    };
    // Simple base64 encoding - in production, use proper JWT
    return btoa(JSON.stringify(payload));
}

function verifyToken(token) {
    try {
        const payload = JSON.parse(atob(token));
        if (payload.exp < Date.now()) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

// Generate a unique, deterministic player color from user ID (used as fallback)
// Uses HSL to ensure vibrant, distinguishable colors
function generatePlayerColorFromId(userId) {
    // Simple hash function to get a number from the user ID
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        const char = userId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Use the hash to generate HSL values
    // Hue: full spectrum (0-360)
    // Saturation: 60-80% for vibrant colors
    // Lightness: 55-70% for good visibility
    const hue = Math.abs(hash % 360);
    const saturation = 60 + Math.abs((hash >> 8) % 20); // 60-80%
    const lightness = 55 + Math.abs((hash >> 16) % 15);  // 55-70%
    
    return hslToHex(hue, saturation, lightness);
}

// Convert HSL to hex color
function hslToHex(h, s, l) {
    const hNorm = h / 360;
    const sNorm = s / 100;
    const lNorm = l / 100;
    
    const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };
    
    const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
    const p = 2 * lNorm - q;
    const r = Math.round(hue2rgb(p, q, hNorm + 1/3) * 255);
    const g = Math.round(hue2rgb(p, q, hNorm) * 255);
    const b = Math.round(hue2rgb(p, q, hNorm - 1/3) * 255);
    
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Convert hex color to HSL
function hexToHsl(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { h: 0, s: 70, l: 60 };
    
    const r = parseInt(result[1], 16) / 255;
    const g = parseInt(result[2], 16) / 255;
    const b = parseInt(result[3], 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    
    return { h: h * 360, s: s * 100, l: l * 100 };
}

// Calculate the minimum hue distance between a hue and all existing hues
function getMinHueDistance(hue, existingHues) {
    if (existingHues.length === 0) return 360;
    
    let minDist = 360;
    for (const existing of existingHues) {
        // Hue is circular, so we need to consider wrap-around
        let dist = Math.abs(hue - existing);
        if (dist > 180) dist = 360 - dist;
        if (dist < minDist) minDist = dist;
    }
    return minDist;
}

// Generate an optimal player color that's as different as possible from existing colors
// Prioritizes hue differences, only adjusts saturation/lightness if hue difference < 25
function generateOptimalPlayerColor(existingColors) {
    // If no existing colors, return a nice default
    if (!existingColors || existingColors.length === 0) {
        return hslToHex(Math.random() * 360, 70, 60);
    }
    
    // Convert existing colors to HSL
    const existingHsl = existingColors.map(c => hexToHsl(c));
    const existingHues = existingHsl.map(c => c.h);
    
    // Find the best hue by checking evenly spaced candidates
    let bestHue = 0;
    let bestHueDistance = 0;
    
    // Check 72 candidate hues (every 5 degrees)
    for (let candidateHue = 0; candidateHue < 360; candidateHue += 5) {
        const minDist = getMinHueDistance(candidateHue, existingHues);
        if (minDist > bestHueDistance) {
            bestHueDistance = minDist;
            bestHue = candidateHue;
        }
    }
    
    // Default saturation and lightness
    let saturation = 70;
    let lightness = 60;
    
    // If the best hue distance is less than 25, we need to also vary saturation/lightness
    if (bestHueDistance < 25) {
        // Find the closest existing color in terms of hue
        const closeColors = existingHsl.filter(c => {
            let dist = Math.abs(bestHue - c.h);
            if (dist > 180) dist = 360 - dist;
            return dist < 30;
        });
        
        if (closeColors.length > 0) {
            // Get average saturation and lightness of close colors
            const avgSat = closeColors.reduce((sum, c) => sum + c.s, 0) / closeColors.length;
            const avgLight = closeColors.reduce((sum, c) => sum + c.l, 0) / closeColors.length;
            
            // Move saturation and lightness away from existing colors
            // Try to be at least 15 units different in both
            if (avgSat > 65) {
                saturation = Math.max(45, avgSat - 20);
            } else {
                saturation = Math.min(90, avgSat + 20);
            }
            
            if (avgLight > 58) {
                lightness = Math.max(40, avgLight - 15);
            } else {
                lightness = Math.min(75, avgLight + 15);
            }
        }
    }
    
    // Clamp values to ensure good visibility
    saturation = Math.max(45, Math.min(90, saturation));
    lightness = Math.max(40, Math.min(75, lightness));
    
    return hslToHex(bestHue, saturation, lightness);
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS
        }
    });
}

function errorResponse(message, status = 400) {
    return jsonResponse({ error: true, message }, status);
}

// ============================================
// AUTH HANDLERS
// ============================================
async function handleSignup(request, env) {
    const { name, username, password } = await request.json();

    if (!name || !username || !password) {
        return errorResponse('Name, username, and password are required');
    }

    // Validate username
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
        return errorResponse(usernameValidation.error);
    }

    // Validate display name
    const nameValidation = validateDisplayName(name, username);
    if (!nameValidation.valid) {
        return errorResponse(nameValidation.error);
    }

    if (password.length < 6) {
        return errorResponse('Password must be at least 6 characters');
    }

    // Check if username exists
    const existingUser = await env.USERS.get(`username:${username.toLowerCase()}`);
    if (existingUser) {
        return errorResponse('Username already taken');
    }

    // Create user
    const userId = generateId();
    const passwordHash = await hashPassword(password);
    const color = generatePlayerColorFromId(userId);
    
    const user = {
        id: userId,
        name,
        username,
        passwordHash,
        color,
        createdAt: new Date().toISOString()
    };

    // Store user
    await env.USERS.put(`user:${userId}`, JSON.stringify(user));
    await env.USERS.put(`username:${username.toLowerCase()}`, userId);

    // Generate token
    const token = generateToken(userId);
    await env.SESSIONS.put(`token:${token}`, userId, { expirationTtl: TOKEN_EXPIRY / 1000 });

    return jsonResponse({
        user: { id: userId, name, username, color },
        token
    });
}

async function handleLogin(request, env) {
    const { username, password } = await request.json();

    if (!username || !password) {
        return errorResponse('Username and password are required');
    }

    // Get user ID by username
    const userId = await env.USERS.get(`username:${username.toLowerCase()}`);
    if (!userId) {
        return errorResponse('Invalid username or password', 401);
    }

    // Get user data
    const userData = await env.USERS.get(`user:${userId}`);
    if (!userData) {
        return errorResponse('User not found', 404);
    }

    const user = JSON.parse(userData);

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
        return errorResponse('Invalid username or password', 401);
    }

    // For existing users without a color, generate one deterministically from their ID
    // This ensures the same color every time
    const color = user.color || generatePlayerColorFromId(user.id);
    
    // If user didn't have a color, save it
    if (!user.color) {
        user.color = color;
        await env.USERS.put(`user:${userId}`, JSON.stringify(user));
    }

    // Generate token
    const token = generateToken(userId);
    await env.SESSIONS.put(`token:${token}`, userId, { expirationTtl: TOKEN_EXPIRY / 1000 });

    return jsonResponse({
        user: { id: user.id, name: user.name, username: user.username, color },
        token
    });
}

async function handleUpdateProfile(request, env, userId) {
    const updates = await request.json();
    
    const userData = await env.USERS.get(`user:${userId}`);
    if (!userData) {
        return errorResponse('User not found', 404);
    }

    const user = JSON.parse(userData);

    if (updates.name) {
        // Validate display name
        const nameValidation = validateDisplayName(updates.name, user.username);
        if (!nameValidation.valid) {
            return errorResponse(nameValidation.error);
        }
        user.name = updates.name;
    }

    await env.USERS.put(`user:${userId}`, JSON.stringify(user));

    return jsonResponse({
        user: { id: user.id, name: user.name, username: user.username }
    });
}

async function handleChangePassword(request, env, userId) {
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
        return errorResponse('Current and new password are required');
    }

    if (newPassword.length < 6) {
        return errorResponse('New password must be at least 6 characters');
    }

    const userData = await env.USERS.get(`user:${userId}`);
    if (!userData) {
        return errorResponse('User not found', 404);
    }

    const user = JSON.parse(userData);

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
        return errorResponse('Current password is incorrect', 401);
    }

    user.passwordHash = await hashPassword(newPassword);
    await env.USERS.put(`user:${userId}`, JSON.stringify(user));

    return jsonResponse({ success: true });
}

// ============================================
// MAP HANDLERS
// ============================================
async function handleListMaps(env, userId) {
    // Get user's map list
    const mapListData = await env.MAPS.get(`user:${userId}:maps`);
    const mapList = mapListData ? JSON.parse(mapListData) : [];

    // Get map details
    const maps = [];
    for (const mapId of mapList) {
        const mapData = await env.MAPS.get(`map:${mapId}`);
        if (mapData) {
            const map = JSON.parse(mapData);
            maps.push({
                id: map.id,
                name: map.name,
                createdAt: map.createdAt,
                updatedAt: map.updatedAt
            });
        }
    }

    return jsonResponse(maps);
}

async function handleGetMap(mapId, env, userId) {
    const mapData = await env.MAPS.get(`map:${mapId}`);
    if (!mapData) {
        return errorResponse('Map not found', 404);
    }

    const map = JSON.parse(mapData);

    // Check ownership
    if (map.userId !== userId) {
        return errorResponse('Access denied', 403);
    }

    return jsonResponse(map);
}

async function handleCreateMap(request, env, userId) {
    const { name } = await request.json();

    if (!name || !name.trim()) {
        return errorResponse('Map name is required');
    }

    const mapId = generateId();
    const map = {
        id: mapId,
        name: name.trim(),
        userId,
        data: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    // Store map
    await env.MAPS.put(`map:${mapId}`, JSON.stringify(map));

    // Add to user's map list
    const mapListData = await env.MAPS.get(`user:${userId}:maps`);
    const mapList = mapListData ? JSON.parse(mapListData) : [];
    mapList.push(mapId);
    await env.MAPS.put(`user:${userId}:maps`, JSON.stringify(mapList));

    return jsonResponse({ id: mapId, name: map.name });
}

async function handleUpdateMap(mapId, request, env, userId) {
    const mapData = await env.MAPS.get(`map:${mapId}`);
    if (!mapData) {
        return errorResponse('Map not found', 404);
    }

    const map = JSON.parse(mapData);

    if (map.userId !== userId) {
        return errorResponse('Access denied', 403);
    }

    const updates = await request.json();

    if (updates.name) {
        map.name = updates.name;
    }
    if (updates.data !== undefined) {
        map.data = updates.data;
    }
    map.updatedAt = new Date().toISOString();

    await env.MAPS.put(`map:${mapId}`, JSON.stringify(map));

    return jsonResponse({ success: true });
}

async function handleDeleteMap(mapId, env, userId) {
    const mapData = await env.MAPS.get(`map:${mapId}`);
    if (!mapData) {
        return errorResponse('Map not found', 404);
    }

    const map = JSON.parse(mapData);

    if (map.userId !== userId) {
        return errorResponse('Access denied', 403);
    }

    // Delete map
    await env.MAPS.delete(`map:${mapId}`);

    // Remove from user's map list
    const mapListData = await env.MAPS.get(`user:${userId}:maps`);
    const mapList = mapListData ? JSON.parse(mapListData) : [];
    const index = mapList.indexOf(mapId);
    if (index !== -1) {
        mapList.splice(index, 1);
        await env.MAPS.put(`user:${userId}:maps`, JSON.stringify(mapList));
    }

    return jsonResponse({ success: true });
}

// ============================================
// WEBSOCKET HANDLER (MULTIPLAYER)
// ============================================
class GameRoom {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.sessions = new Map();
        this.roomData = null;
    }

    async fetch(request) {
        const url = new URL(request.url);
        
        if (url.pathname === '/ws') {
            if (request.headers.get('Upgrade') !== 'websocket') {
                return new Response('Expected websocket', { status: 400 });
            }

            const pair = new WebSocketPair();
            const [client, server] = Object.values(pair);
            
            await this.handleSession(server, request);

            return new Response(null, { status: 101, webSocket: client });
        }

        return new Response('Not found', { status: 404 });
    }

    async handleSession(webSocket, request) {
        webSocket.accept();

        const sessionId = generateId();
        const session = {
            id: sessionId,
            webSocket,
            userId: null,
            user: null,
            roomCode: null,
            isHost: false,
            playerColor: null // Will be set during auth from user's persistent color
        };

        this.sessions.set(sessionId, session);

        webSocket.addEventListener('message', async (event) => {
            try {
                const data = JSON.parse(event.data);
                await this.handleMessage(session, data);
            } catch (error) {
                console.error('Message handling error:', error);
            }
        });

        webSocket.addEventListener('close', () => {
            this.handleDisconnect(session);
        });
    }

    async handleMessage(session, data) {
        switch (data.type) {
            case 'auth':
                await this.handleAuth(session, data);
                break;
            case 'create_room':
                await this.handleCreateRoom(session, data);
                break;
            case 'join_room':
                await this.handleJoinRoom(session, data);
                break;
            case 'rejoin_room':
                await this.handleRejoinRoom(session, data);
                break;
            case 'leave_room':
                await this.handleLeaveRoom(session);
                break;
            case 'position':
                this.handlePosition(session, data);
                break;
            case 'kick_player':
                this.handleKickPlayer(session, data);
                break;
            case 'chat':
                this.handleChat(session, data);
                break;
        }
    }

    async handleAuth(session, data) {
        const payload = verifyToken(data.token);
        if (!payload) {
            this.send(session, { type: 'error', message: 'Invalid token' });
            return;
        }

        // Get user data
        const userData = await this.env.USERS.get(`user:${payload.userId}`);
        if (!userData) {
            this.send(session, { type: 'error', message: 'User not found' });
            return;
        }

        const user = JSON.parse(userData);
        session.userId = payload.userId;
        
        // Get or generate user color
        const color = user.color || generatePlayerColorFromId(user.id);
        session.user = { id: user.id, name: user.name, username: user.username, color };
        session.playerColor = color; // Use user's persistent color

        this.send(session, { type: 'auth_success' });
    }

    async handleCreateRoom(session, data) {
        if (!session.userId) {
            this.send(session, { type: 'error', message: 'Not authenticated' });
            return;
        }

        // Generate unique room code (retry if already exists)
        let roomCode;
        let attempts = 0;
        const maxAttempts = 10;
        
        do {
            roomCode = generateRoomCode();
            const existingRoom = await this.state.storage.get(`room:${roomCode}`);
            if (!existingRoom) break;
            attempts++;
        } while (attempts < maxAttempts);
        
        if (attempts >= maxAttempts) {
            this.send(session, { type: 'error', message: 'Failed to generate unique room code. Please try again.' });
            return;
        }
        
        // Store room data
        const room = {
            code: roomCode,
            hostId: session.id,
            hostUserId: session.userId,
            mapData: data.mapData,
            maxPlayers: data.maxPlayers || 10,
            usePassword: data.usePassword || false,
            password: data.password || null,
            players: new Map(),
            createdAt: Date.now()
        };

        await this.state.storage.put(`room:${roomCode}`, JSON.stringify({
            ...room,
            players: []
        }));

        session.roomCode = roomCode;
        session.isHost = true;
        
        // Host gets an optimal color (first player, so it'll be a random vibrant color)
        session.playerColor = generateOptimalPlayerColor([]);

        this.send(session, {
            type: 'room_created',
            roomCode
        });
    }

    async handleJoinRoom(session, data) {
        if (!session.userId) {
            this.send(session, { type: 'error', message: 'Not authenticated' });
            return;
        }

        // Check if already in a room
        if (session.roomCode) {
            this.send(session, { type: 'error', message: 'You are already in a room. Leave it first.' });
            return;
        }

        const roomData = await this.state.storage.get(`room:${data.roomCode}`);
        if (!roomData) {
            this.send(session, { type: 'error', message: 'Room not found. Please check the game code.' });
            return;
        }

        const room = JSON.parse(roomData);

        // Check password
        if (room.usePassword && room.password !== data.password) {
            this.send(session, { type: 'error', message: 'Password required' });
            return;
        }

        // Check max players
        const playersInRoom = this.getPlayersInRoom(data.roomCode);
        if (playersInRoom.length >= room.maxPlayers) {
            this.send(session, { type: 'error', message: 'Room is full' });
            return;
        }

        // Check if this user is already in the room (same account from different device/tab)
        const existingPlayer = playersInRoom.find(p => p.userId === session.userId);
        if (existingPlayer) {
            this.send(session, { type: 'error', message: 'This account is already in this room.' });
            return;
        }

        session.roomCode = data.roomCode;
        session.isHost = false;
        
        // Generate an optimal color that's different from existing players
        const existingColors = playersInRoom.map(p => p.playerColor).filter(c => c);
        session.playerColor = generateOptimalPlayerColor(existingColors);

        // Notify existing players
        this.broadcastToRoom(data.roomCode, {
            type: 'player_joined',
            playerId: session.id,
            playerName: session.user.name,
            playerColor: session.playerColor
        }, session.id);

        // Send room data to new player
        this.send(session, {
            type: 'room_joined',
            roomCode: data.roomCode,
            mapData: room.mapData,
            players: playersInRoom.map(p => ({
                id: p.id,
                name: p.user.name,
                color: p.playerColor
            }))
        });
    }

    async handleRejoinRoom(session, data) {
        if (!session.userId) {
            this.send(session, { type: 'error', message: 'Not authenticated' });
            return;
        }

        const roomData = await this.state.storage.get(`room:${data.roomCode}`);
        if (!roomData) {
            this.send(session, { type: 'error', message: 'Room no longer exists.' });
            return;
        }

        const room = JSON.parse(roomData);
        
        session.roomCode = data.roomCode;
        session.isHost = room.hostUserId === session.userId;

        // Get existing players in room (excluding self)
        const playersInRoom = this.getPlayersInRoom(data.roomCode).filter(p => p.id !== session.id);
        
        // Generate an optimal color that's different from existing players
        const existingColors = playersInRoom.map(p => p.playerColor).filter(c => c);
        session.playerColor = generateOptimalPlayerColor(existingColors);

        // Notify others
        this.broadcastToRoom(data.roomCode, {
            type: 'player_joined',
            playerId: session.id,
            playerName: session.user.name,
            playerColor: session.playerColor
        }, session.id);

        // Send room data to rejoined player
        this.send(session, {
            type: 'room_rejoined',
            roomCode: data.roomCode,
            isHost: session.isHost,
            players: playersInRoom.map(p => ({
                id: p.id,
                name: p.user.name,
                color: p.playerColor
            }))
        });
    }

    async handleLeaveRoom(session) {
        if (!session.roomCode) return;

        const roomCode = session.roomCode;
        const wasHost = session.isHost;

        session.roomCode = null;
        session.isHost = false;

        if (wasHost) {
            // Close room and kick everyone
            this.broadcastToRoom(roomCode, {
                type: 'room_closed',
                message: 'Host left the room'
            });

            // Clear room data
            await this.state.storage.delete(`room:${roomCode}`);

            // Disconnect all players in room
            for (const [id, s] of this.sessions) {
                if (s.roomCode === roomCode) {
                    s.roomCode = null;
                }
            }
        } else {
            // Notify other players
            this.broadcastToRoom(roomCode, {
                type: 'player_left',
                playerId: session.id,
                playerName: session.user?.name
            });
        }
    }

    handlePosition(session, data) {
        if (!session.roomCode) return;

        this.broadcastToRoom(session.roomCode, {
            type: 'player_position',
            playerId: session.id,
            x: data.x,
            y: data.y,
            vx: data.vx || 0,
            vy: data.vy || 0
        }, session.id);
    }

    handleKickPlayer(session, data) {
        if (!session.isHost || !session.roomCode) return;

        const targetSession = this.sessions.get(data.playerId);
        if (targetSession && targetSession.roomCode === session.roomCode) {
            this.send(targetSession, {
                type: 'player_kicked',
                message: 'You have been kicked by the host'
            });

            targetSession.roomCode = null;

            this.broadcastToRoom(session.roomCode, {
                type: 'player_left',
                playerId: targetSession.id,
                playerName: targetSession.user?.name,
                kicked: true
            });
        }
    }

    handleChat(session, data) {
        if (!session.roomCode || !data.message) return;

        this.broadcastToRoom(session.roomCode, {
            type: 'chat_message',
            playerId: session.id,
            playerName: session.user?.name,
            playerColor: session.playerColor,
            message: data.message.slice(0, 200) // Limit message length
        });
    }

    handleDisconnect(session) {
        if (session.roomCode) {
            this.handleLeaveRoom(session);
        }
        this.sessions.delete(session.id);
    }

    getPlayersInRoom(roomCode) {
        const players = [];
        for (const [id, session] of this.sessions) {
            if (session.roomCode === roomCode && session.userId) {
                players.push(session);
            }
        }
        return players;
    }

    broadcastToRoom(roomCode, message, excludeId = null) {
        for (const [id, session] of this.sessions) {
            if (session.roomCode === roomCode && id !== excludeId) {
                this.send(session, message);
            }
        }
    }

    send(session, message) {
        try {
            session.webSocket.send(JSON.stringify(message));
        } catch (error) {
            // Connection might be closed
        }
    }
}

// ============================================
// MAIN HANDLER
// ============================================
export default {
    async fetch(request, env, ctx) {
        // ALWAYS wrap in try-catch to ensure CORS headers are returned
        try {
            const url = new URL(request.url);
            const path = url.pathname;
            const method = request.method;

            // Handle CORS preflight
            if (method === 'OPTIONS') {
                return new Response(null, { headers: CORS_HEADERS });
            }

            // Root path - health check
            if (path === '/' || path === '') {
                return jsonResponse({ status: 'ok', message: 'Parkoreen API is running' });
            }

            // Check if KV bindings are available
            if (!env.USERS || !env.MAPS || !env.SESSIONS) {
                console.error('KV namespaces not bound:', { USERS: !!env.USERS, MAPS: !!env.MAPS, SESSIONS: !!env.SESSIONS });
                return errorResponse('Server not configured: KV namespaces not bound. Please check wrangler.toml', 503);
            }

            // WebSocket handling - delegate to Durable Object
            if (path === '/ws') {
                if (!env.GAME_ROOMS) {
                    return errorResponse('Multiplayer not configured', 503);
                }
                const id = env.GAME_ROOMS.idFromName('main');
                const room = env.GAME_ROOMS.get(id);
                return room.fetch(request);
            }

            // Auth middleware
            let userId = null;
            const authHeader = request.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.slice(7);
                const payload = verifyToken(token);
                if (payload) {
                    userId = payload.userId;
                }
            }

            // Routes
            // Auth routes (no auth required)
            if (path === '/auth/signup' && method === 'POST') {
                return handleSignup(request, env);
            }
            if (path === '/auth/login' && method === 'POST') {
                return handleLogin(request, env);
            }

            // Protected routes
            if (!userId) {
                return errorResponse('Unauthorized', 401);
            }

            // Profile routes
            if (path === '/auth/profile' && method === 'PUT') {
                return handleUpdateProfile(request, env, userId);
            }
            if (path === '/auth/password' && method === 'PUT') {
                return handleChangePassword(request, env, userId);
            }

            // Map routes
            if (path === '/maps' && method === 'GET') {
                return handleListMaps(env, userId);
            }
            if (path === '/maps' && method === 'POST') {
                return handleCreateMap(request, env, userId);
            }

            const mapMatch = path.match(/^\/maps\/([a-zA-Z0-9]+)$/);
            if (mapMatch) {
                const mapId = mapMatch[1];
                if (method === 'GET') {
                    return handleGetMap(mapId, env, userId);
                }
                if (method === 'PUT') {
                    return handleUpdateMap(mapId, request, env, userId);
                }
                if (method === 'DELETE') {
                    return handleDeleteMap(mapId, env, userId);
                }
            }

            return errorResponse('Not found', 404);
        } catch (error) {
            console.error('Worker error:', error);
            // Always return with CORS headers even on error
            return new Response(JSON.stringify({ error: true, message: 'Internal server error: ' + error.message }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...CORS_HEADERS
                }
            });
        }
    }
};

// Export Durable Object class
export { GameRoom };
