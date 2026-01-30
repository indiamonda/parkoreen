/**
 * PARKOREEN - Game Engine
 * Core game mechanics: physics, player, camera, collisions
 */

// ============================================
// CONSTANTS
// ============================================
const GRID_SIZE = 32;
const GRAVITY = 0.8;
const JUMP_FORCE = -14;
const MOVE_SPEED = 5;
const FLY_SPEED = 8;
const CAMERA_LERP = 0.08;
const PLAYER_SIZE = 32;

// ============================================
// GAME STATE
// ============================================
const GameState = {
    EDITOR: 'editor',
    PLAYING: 'playing',
    TESTING: 'testing'
};

// ============================================
// AUDIO MANAGER
// ============================================
class AudioManager {
    constructor() {
        this.sounds = {};
        this.volume = 1;
        this.loadSounds();
    }

    loadSounds() {
        this.sounds.jump = new Audio('/parkoreen/assets/mp3/jump.mp3');
        this.sounds.jump.volume = this.volume;
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
        Object.values(this.sounds).forEach(sound => {
            sound.volume = this.volume;
        });
        localStorage.setItem('parkoreen_volume', this.volume);
    }

    play(soundName) {
        const sound = this.sounds[soundName];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(() => {});
        }
    }

    loadVolumeFromStorage() {
        const saved = localStorage.getItem('parkoreen_volume');
        if (saved !== null) {
            this.setVolume(parseFloat(saved));
        }
    }
}

// ============================================
// PLAYER CLASS
// ============================================
class Player {
    constructor(x, y, name, color) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.width = PLAYER_SIZE;
        this.height = PLAYER_SIZE;
        this.name = name || 'Player';
        this.color = color || this.generateRandomColor();
        
        // States
        this.isOnGround = false;
        this.canJump = true;
        this.jumpsRemaining = 1;
        this.maxJumps = 1;
        this.additionalAirjump = false;
        this.isFlying = false;
        
        // Input state
        this.input = {
            left: false,
            right: false,
            up: false,
            down: false,
            jump: false
        };
        
        // Touchboxes
        this.groundTouchbox = { x: 0, y: 0, width: PLAYER_SIZE, height: PLAYER_SIZE };
        this.hurtTouchbox = { x: 4, y: 4, width: PLAYER_SIZE - 8, height: PLAYER_SIZE - 8 };
        
        this.isLocal = false;
        this.isDead = false;
    }

    generateRandomColor() {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
            '#F8B500', '#00CED1', '#FF69B4', '#32CD32', '#FFD700'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    update(world, audioManager) {
        if (this.isDead) return;

        if (this.isFlying) {
            this.updateFlying(world);
        } else {
            this.updatePhysics(world, audioManager);
        }
    }

    updateFlying(world, editorMode = false) {
        const speed = FLY_SPEED;
        
        if (this.input.left) this.x -= speed;
        if (this.input.right) this.x += speed;
        if (this.input.up || this.input.jump) this.y -= speed;
        if (this.input.down) this.y += speed;
        
        this.vx = 0;
        this.vy = 0;
        
        // Check for hurt collisions while flying (but not in editor mode)
        if (world && !editorMode) {
            this.checkHurtCollisions(world);
        }
    }

    updatePhysics(world, audioManager) {
        // Horizontal movement
        if (this.input.left) {
            this.vx = -MOVE_SPEED;
        } else if (this.input.right) {
            this.vx = MOVE_SPEED;
        } else {
            this.vx = 0;
        }

        // Apply gravity
        this.vy += GRAVITY;
        
        // Cap fall speed
        if (this.vy > 20) this.vy = 20;

        // Handle jump
        if (this.input.jump && this.canJump && this.jumpsRemaining > 0) {
            this.vy = JUMP_FORCE;
            this.jumpsRemaining--;
            this.canJump = false;
            this.isOnGround = false;
            if (audioManager) audioManager.play('jump');
        }

        if (!this.input.jump) {
            this.canJump = true;
        }

        // Apply movement with collision
        this.moveWithCollision(world);
    }

    moveWithCollision(world) {
        // Move horizontally
        this.x += this.vx;
        
        // Check horizontal collisions
        const hCollisions = this.checkCollisions(world, 'horizontal');
        for (const obj of hCollisions) {
            if (obj.collision) {
                if (this.vx > 0) {
                    this.x = obj.x - this.width;
                } else if (this.vx < 0) {
                    this.x = obj.x + obj.width;
                }
                this.vx = 0;
            }
        }

        // Move vertically
        this.y += this.vy;
        
        // Check vertical collisions
        const wasOnGround = this.isOnGround;
        this.isOnGround = false;
        
        const vCollisions = this.checkCollisions(world, 'vertical');
        for (const obj of vCollisions) {
            if (obj.collision) {
                if (this.vy > 0) {
                    // Landing on ground
                    this.y = obj.y - this.height;
                    this.isOnGround = true;
                    this.resetJumps();
                } else if (this.vy < 0) {
                    // Hitting ceiling
                    this.y = obj.y + obj.height;
                }
                this.vy = 0;
            }
        }

        // Check hurt collisions
        this.checkHurtCollisions(world);
    }

    checkCollisions(world, direction) {
        const collisions = [];
        const box = this.getGroundTouchbox();
        
        for (const obj of world.objects) {
            if (!obj.collision) continue;
            
            if (this.boxIntersects(box, obj)) {
                collisions.push(obj);
            }
        }
        
        return collisions;
    }

    checkHurtCollisions(world) {
        const box = this.getHurtTouchbox();
        
        for (const obj of world.objects) {
            // Spikes only hurt if collision is enabled
            if (obj.actingType === 'spike' && obj.collision !== false) {
                if (this.boxIntersects(box, obj)) {
                    this.die();
                    return;
                }
            }
        }
    }

    getGroundTouchbox() {
        return {
            x: this.x + this.groundTouchbox.x,
            y: this.y + this.groundTouchbox.y,
            width: this.groundTouchbox.width,
            height: this.groundTouchbox.height
        };
    }

    getHurtTouchbox() {
        return {
            x: this.x + this.hurtTouchbox.x,
            y: this.y + this.hurtTouchbox.y,
            width: this.hurtTouchbox.width,
            height: this.hurtTouchbox.height
        };
    }

    boxIntersects(a, b) {
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    }

    resetJumps() {
        if (this.additionalAirjump) {
            this.jumpsRemaining = this.maxJumps;
        } else {
            // On ground: 1 jump, then maxJumps - 1 in air
            this.jumpsRemaining = this.maxJumps;
        }
    }

    die() {
        this.isDead = true;
        // Will respawn at checkpoint or spawn
    }

    respawn(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.isDead = false;
        this.isOnGround = false;
        this.resetJumps();
    }

    setMaxJumps(num, additionalAirjump = false) {
        this.maxJumps = num;
        this.additionalAirjump = additionalAirjump;
        this.resetJumps();
    }

    render(ctx, camera) {
        if (this.isDead) return;

        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;
        
        // Draw player cube with pixel art style
        ctx.fillStyle = this.color;
        ctx.fillRect(screenX, screenY, this.width, this.height);
        
        // Pixel shading
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(screenX + this.width - 4, screenY + 4, 4, this.height - 4);
        ctx.fillRect(screenX + 4, screenY + this.height - 4, this.width - 4, 4);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(screenX, screenY, this.width - 4, 4);
        ctx.fillRect(screenX, screenY, 4, this.height - 4);
        
        // Draw name
        ctx.fillStyle = 'white';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 2;
        ctx.fillText(this.name, screenX + this.width / 2, screenY + this.height + 14);
        ctx.shadowBlur = 0;
    }
}

// ============================================
// CAMERA CLASS
// ============================================
class Camera {
    constructor(width, height) {
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.width = width;
        this.height = height;
        this.zoom = 1;
        this.minZoom = 0.5;
        this.maxZoom = 2;
    }

    follow(target) {
        this.targetX = target.x + target.width / 2 - this.width / 2 / this.zoom;
        this.targetY = target.y + target.height / 2 - this.height / 2 / this.zoom;
    }

    update() {
        // Smooth camera movement
        this.x += (this.targetX - this.x) * CAMERA_LERP;
        this.y += (this.targetY - this.y) * CAMERA_LERP;
    }

    setZoom(zoom) {
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    }

    zoomIn() {
        this.setZoom(this.zoom + 0.1);
    }

    zoomOut() {
        this.setZoom(this.zoom - 0.1);
    }

    screenToWorld(screenX, screenY) {
        return {
            x: this.x + screenX / this.zoom,
            y: this.y + screenY / this.zoom
        };
    }

    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.x) * this.zoom,
            y: (worldY - this.y) * this.zoom
        };
    }
}

// ============================================
// WORLD OBJECT CLASS
// ============================================
class WorldObject {
    constructor(config) {
        this.id = config.id || this.generateId();
        this.x = config.x || 0;
        this.y = config.y || 0;
        this.width = config.width || GRID_SIZE;
        this.height = config.height || GRID_SIZE;
        this.type = config.type || 'block'; // block, koreen, text
        this.appearanceType = config.appearanceType || 'ground'; // ground, spike, checkpoint, spawnpoint, endpoint
        this.actingType = config.actingType || 'ground'; // ground, spike, checkpoint, spawnpoint, endpoint, text
        this.collision = config.collision !== undefined ? config.collision : true;
        this.color = config.color || '#787878';
        this.opacity = config.opacity !== undefined ? config.opacity : 1;
        this.layer = config.layer || 1; // 0: behind, 1: same, 2: above player
        this.rotation = config.rotation || 0;
        
        // Text specific
        this.content = config.content || '';
        this.font = config.font || 'Arial';
        this.fontSize = config.fontSize || 24;
        this.hAlign = config.hAlign || 'center'; // left, center, right
        this.vAlign = config.vAlign || 'center'; // top, center, bottom
        this.hSpacing = config.hSpacing || 0;
        this.vSpacing = config.vSpacing || 0;
        
        // Checkpoint state (default, active, touched)
        this.checkpointState = config.checkpointState || 'default';
        
        this.name = config.name || this.getDefaultName();
    }

    generateId() {
        return 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getDefaultName() {
        const typeNames = {
            ground: 'Block',
            spike: 'Spike',
            checkpoint: 'Checkpoint',
            spawnpoint: 'Spawn Point',
            endpoint: 'End Point'
        };
        return typeNames[this.appearanceType] || 'Object';
    }

    render(ctx, camera) {
        const screenX = (this.x - camera.x) * camera.zoom;
        const screenY = (this.y - camera.y) * camera.zoom;
        const width = this.width * camera.zoom;
        const height = this.height * camera.zoom;

        ctx.save();
        ctx.globalAlpha = this.opacity;
        
        // Apply rotation
        if (this.rotation !== 0) {
            ctx.translate(screenX + width / 2, screenY + height / 2);
            ctx.rotate(this.rotation * Math.PI / 180);
            ctx.translate(-(screenX + width / 2), -(screenY + height / 2));
        }

        if (this.type === 'text') {
            this.renderText(ctx, screenX, screenY, width, height);
        } else if (this.appearanceType === 'spike') {
            this.renderSpike(ctx, screenX, screenY, width, height);
        } else if (this.appearanceType === 'checkpoint') {
            this.renderCheckpoint(ctx, screenX, screenY, width, height);
        } else if (this.appearanceType === 'spawnpoint') {
            this.renderSpawnpoint(ctx, screenX, screenY, width, height);
        } else if (this.appearanceType === 'endpoint') {
            this.renderEndpoint(ctx, screenX, screenY, width, height);
        } else {
            this.renderBlock(ctx, screenX, screenY, width, height);
        }

        ctx.restore();
    }

    renderBlock(ctx, x, y, w, h) {
        ctx.fillStyle = this.color;
        ctx.fillRect(x, y, w, h);
        
        // Pixel art shading
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(x + w - 4, y + 4, 4, h - 4);
        ctx.fillRect(x + 4, y + h - 4, w - 4, 4);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(x, y, w - 4, 4);
        ctx.fillRect(x, y, 4, h - 4);
    }

    renderSpike(ctx, x, y, w, h) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        ctx.fill();
        
        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w * 0.6, y + h * 0.4);
        ctx.lineTo(x + w * 0.4, y + h * 0.4);
        ctx.closePath();
        ctx.fill();
    }

    renderCheckpoint(ctx, x, y, w, h) {
        // Flag pole
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(x + w * 0.4, y + h * 0.2, w * 0.1, h * 0.8);
        
        // Flag color based on state
        let flagColor = this.color || '#FFD700'; // Default: gold
        if (this.checkpointState === 'active') {
            flagColor = '#4CAF50'; // Green for active (current checkpoint)
        } else if (this.checkpointState === 'touched') {
            flagColor = '#2196F3'; // Blue for previously touched
        }
        
        ctx.fillStyle = flagColor;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, y + h * 0.2);
        ctx.lineTo(x + w * 0.9, y + h * 0.35);
        ctx.lineTo(x + w * 0.5, y + h * 0.5);
        ctx.closePath();
        ctx.fill();
    }

    renderSpawnpoint(ctx, x, y, w, h) {
        // Base platform
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(x + w * 0.1, y + h * 0.7, w * 0.8, h * 0.2);
        
        // Arrow pointing up
        ctx.fillStyle = '#81C784';
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y + h * 0.2);
        ctx.lineTo(x + w * 0.7, y + h * 0.5);
        ctx.lineTo(x + w * 0.55, y + h * 0.5);
        ctx.lineTo(x + w * 0.55, y + h * 0.7);
        ctx.lineTo(x + w * 0.45, y + h * 0.7);
        ctx.lineTo(x + w * 0.45, y + h * 0.5);
        ctx.lineTo(x + w * 0.3, y + h * 0.5);
        ctx.closePath();
        ctx.fill();
    }

    renderEndpoint(ctx, x, y, w, h) {
        // Trophy base
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(x + w * 0.25, y + h * 0.7, w * 0.5, h * 0.2);
        
        // Trophy cup
        ctx.beginPath();
        ctx.moveTo(x + w * 0.15, y + h * 0.15);
        ctx.quadraticCurveTo(x + w * 0.15, y + h * 0.55, x + w * 0.35, y + h * 0.6);
        ctx.lineTo(x + w * 0.35, y + h * 0.7);
        ctx.lineTo(x + w * 0.65, y + h * 0.7);
        ctx.lineTo(x + w * 0.65, y + h * 0.6);
        ctx.quadraticCurveTo(x + w * 0.85, y + h * 0.55, x + w * 0.85, y + h * 0.15);
        ctx.closePath();
        ctx.fill();
        
        // Star
        ctx.fillStyle = '#FFF';
        const cx = x + w / 2;
        const cy = y + h * 0.35;
        const spikes = 5;
        const outerRadius = w * 0.12;
        const innerRadius = w * 0.05;
        
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI / spikes) - Math.PI / 2;
            const px = cx + Math.cos(angle) * radius;
            const py = cy + Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    }

    renderText(ctx, x, y, w, h) {
        ctx.fillStyle = this.color;
        const scaleFactor = w / this.width;
        const fontSize = this.fontSize * scaleFactor;
        ctx.font = `${fontSize}px "${this.font}"`;
        
        // Apply letter spacing (hSpacing is a percentage)
        const letterSpacing = (this.hSpacing / 100) * fontSize;
        
        // Split content into lines
        const lines = this.content.split('\n');
        const lineHeight = fontSize * (1 + this.vSpacing / 100);
        const totalTextHeight = lines.length * lineHeight;
        
        // Calculate starting Y based on vertical alignment
        let startY = y;
        if (this.vAlign === 'center') {
            startY = y + (h - totalTextHeight) / 2 + fontSize * 0.8;
        } else if (this.vAlign === 'bottom') {
            startY = y + h - totalTextHeight + fontSize * 0.8;
        } else {
            startY = y + fontSize * 0.8; // top alignment
        }
        
        // Render each line
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineY = startY + i * lineHeight;
            
            // Calculate X based on horizontal alignment
            let lineX = x;
            if (this.hAlign === 'center') {
                const lineWidth = this.measureTextWithSpacing(ctx, line, letterSpacing);
                lineX = x + (w - lineWidth) / 2;
            } else if (this.hAlign === 'right') {
                const lineWidth = this.measureTextWithSpacing(ctx, line, letterSpacing);
                lineX = x + w - lineWidth;
            }
            
            // Draw text with letter spacing
            if (letterSpacing === 0) {
                ctx.fillText(line, lineX, lineY);
            } else {
                this.fillTextWithSpacing(ctx, line, lineX, lineY, letterSpacing);
            }
        }
    }
    
    measureTextWithSpacing(ctx, text, spacing) {
        if (spacing === 0) {
            return ctx.measureText(text).width;
        }
        let width = 0;
        for (let i = 0; i < text.length; i++) {
            width += ctx.measureText(text[i]).width;
            if (i < text.length - 1) {
                width += spacing;
            }
        }
        return width;
    }
    
    fillTextWithSpacing(ctx, text, x, y, spacing) {
        let currentX = x;
        for (let i = 0; i < text.length; i++) {
            ctx.fillText(text[i], currentX, y);
            currentX += ctx.measureText(text[i]).width + spacing;
        }
    }

    containsPoint(px, py) {
        return px >= this.x && px < this.x + this.width &&
               py >= this.y && py < this.y + this.height;
    }

    snapToGrid() {
        this.x = Math.round(this.x / GRID_SIZE) * GRID_SIZE;
        this.y = Math.round(this.y / GRID_SIZE) * GRID_SIZE;
    }

    clone() {
        return new WorldObject({
            ...this,
            id: this.generateId(),
            name: this.name + ' Copy'
        });
    }

    toJSON() {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            type: this.type,
            appearanceType: this.appearanceType,
            actingType: this.actingType,
            collision: this.collision,
            color: this.color,
            opacity: this.opacity,
            layer: this.layer,
            rotation: this.rotation,
            content: this.content,
            font: this.font,
            fontSize: this.fontSize,
            hAlign: this.hAlign,
            vAlign: this.vAlign,
            hSpacing: this.hSpacing,
            vSpacing: this.vSpacing,
            name: this.name
        };
    }
}

// ============================================
// WORLD CLASS
// ============================================
class World {
    constructor() {
        this.objects = [];
        this.background = 'sky'; // sky, galaxy
        this.defaultBlockColor = '#787878';
        this.defaultSpikeColor = '#c45a3f';
        this.defaultTextColor = '#000000';
        this.maxJumps = 1;
        this.infiniteJumps = false;
        this.additionalAirjump = false;
        this.collideWithEachOther = true;
        this.spawnPoint = null;
        this.checkpoints = [];
        this.endpoint = null;
        this.mapName = 'Untitled Map';
        this.dieLineY = 2000; // Y position below which players die (void death)
    }

    addObject(obj) {
        this.objects.push(obj);
        this.updateSpecialPoints();
        return obj;
    }

    removeObject(id) {
        const index = this.objects.findIndex(o => o.id === id);
        if (index !== -1) {
            this.objects.splice(index, 1);
            this.updateSpecialPoints();
            return true;
        }
        return false;
    }

    getObjectAt(x, y) {
        // Search from top layer to bottom
        for (let i = this.objects.length - 1; i >= 0; i--) {
            if (this.objects[i].containsPoint(x, y)) {
                return this.objects[i];
            }
        }
        return null;
    }

    getObjectById(id) {
        return this.objects.find(o => o.id === id);
    }

    hasObjectAt(x, y, excludeId = null) {
        return this.objects.some(o => 
            o.id !== excludeId && o.containsPoint(x, y)
        );
    }

    updateSpecialPoints() {
        this.spawnPoint = null;
        this.checkpoints = [];
        this.endpoint = null;
        
        for (const obj of this.objects) {
            if (obj.actingType === 'spawnpoint') {
                this.spawnPoint = obj;
            } else if (obj.actingType === 'checkpoint') {
                this.checkpoints.push(obj);
            } else if (obj.actingType === 'endpoint') {
                this.endpoint = obj;
            }
        }
    }

    reorderLayers(fromIndex, toIndex) {
        const [item] = this.objects.splice(fromIndex, 1);
        this.objects.splice(toIndex, 0, item);
    }

    clear() {
        this.objects = [];
        this.spawnPoint = null;
        this.checkpoints = [];
        this.endpoint = null;
    }

    render(ctx, camera) {
        // Render objects by layer
        const layers = [[], [], []];
        
        for (const obj of this.objects) {
            layers[obj.layer].push(obj);
        }
        
        // Behind player (layer 0)
        for (const obj of layers[0]) {
            obj.render(ctx, camera);
        }
        
        return layers; // Return for player rendering between layers
    }

    renderAbovePlayer(ctx, camera) {
        // Above player (layer 2)
        for (const obj of this.objects) {
            if (obj.layer === 2) {
                obj.render(ctx, camera);
            }
        }
    }

    toJSON() {
        return {
            objects: this.objects.map(o => o.toJSON()),
            background: this.background,
            defaultBlockColor: this.defaultBlockColor,
            defaultSpikeColor: this.defaultSpikeColor,
            defaultTextColor: this.defaultTextColor,
            maxJumps: this.maxJumps,
            infiniteJumps: this.infiniteJumps,
            additionalAirjump: this.additionalAirjump,
            collideWithEachOther: this.collideWithEachOther,
            mapName: this.mapName,
            dieLineY: this.dieLineY
        };
    }

    fromJSON(data) {
        this.clear();
        this.background = data.background || 'sky';
        this.defaultBlockColor = data.defaultBlockColor || '#787878';
        this.defaultSpikeColor = data.defaultSpikeColor || '#c45a3f';
        this.defaultTextColor = data.defaultTextColor || '#000000';
        this.maxJumps = data.maxJumps || 1;
        this.infiniteJumps = data.infiniteJumps || false;
        this.additionalAirjump = data.additionalAirjump || false;
        this.collideWithEachOther = data.collideWithEachOther !== false;
        this.mapName = data.mapName || 'Untitled Map';
        this.dieLineY = data.dieLineY ?? 2000;
        
        if (data.objects) {
            for (const objData of data.objects) {
                this.addObject(new WorldObject(objData));
            }
        }
    }
}

// ============================================
// GAME ENGINE CLASS
// ============================================
class GameEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.world = new World();
        this.camera = new Camera(window.innerWidth, window.innerHeight);
        this.audioManager = new AudioManager();
        
        this.localPlayer = null;
        this.remotePlayers = new Map();
        
        this.state = GameState.EDITOR;
        this.isRunning = false;
        this.lastTime = 0;
        
        // Editor state
        this.selectedObject = null;
        this.hoveredObject = null;
        
        // Input
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        
        this.touchscreenMode = false;
        
        this.setupCanvas();
        this.setupInput();
        this.audioManager.loadVolumeFromStorage();
    }

    setupCanvas() {
        // Make canvas always fill the viewport visually using CSS
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100vw';
        this.canvas.style.height = '100vh';
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Also handle visual viewport changes (for mobile and zoom)
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => this.resizeCanvas());
        }
        
        // Prevent zoom via Ctrl+wheel
        document.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Prevent zoom via Ctrl+/- keys
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '_')) {
                e.preventDefault();
            }
        });
    }

    resizeCanvas() {
        // Get the actual rendered size of the canvas (accounts for browser zoom)
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        // Set internal canvas resolution to match actual pixel size
        // This ensures crisp rendering regardless of browser zoom
        const width = Math.round(rect.width * dpr);
        const height = Math.round(rect.height * dpr);
        
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            
            // Scale the context to account for devicePixelRatio
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        
        // Camera uses CSS pixel dimensions (what the user sees)
        this.camera.width = rect.width;
        this.camera.height = rect.height;
    }

    setupInput() {
        // Keyboard
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        
        // Mouse
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        
        // Touch
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));
        
        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    onKeyDown(e) {
        this.keys[e.code] = true;
        
        if (this.localPlayer && (this.state === GameState.PLAYING || this.state === GameState.TESTING)) {
            this.updatePlayerInput();
        }
        
        // Emit for editor shortcuts
        if (this.onKeyPress) {
            this.onKeyPress(e);
        }
    }

    onKeyUp(e) {
        this.keys[e.code] = false;
        
        if (this.localPlayer) {
            this.updatePlayerInput();
        }
    }

    updatePlayerInput() {
        if (!this.localPlayer) return;
        
        this.localPlayer.input.left = this.keys['KeyA'] || this.keys['ArrowLeft'];
        this.localPlayer.input.right = this.keys['KeyD'] || this.keys['ArrowRight'];
        this.localPlayer.input.up = this.keys['KeyW'] || this.keys['ArrowUp'];
        this.localPlayer.input.down = this.keys['KeyS'] || this.keys['ArrowDown'];
        this.localPlayer.input.jump = this.keys['Space'] || this.keys['KeyW'] || this.keys['ArrowUp'];
    }

    onMouseMove(e) {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        
        if (this.onMouseMoveCallback) {
            this.onMouseMoveCallback(e);
        }
    }

    onMouseDown(e) {
        this.mouse.down = true;
        this.mouse.button = e.button;
        
        if (this.onMouseDownCallback) {
            this.onMouseDownCallback(e);
        }
    }

    onMouseUp(e) {
        this.mouse.down = false;
        
        if (this.onMouseUpCallback) {
            this.onMouseUpCallback(e);
        }
    }

    onWheel(e) {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.deltaY < 0) {
                this.camera.zoomIn();
            } else {
                this.camera.zoomOut();
            }
        }
        
        if (this.onWheelCallback) {
            this.onWheelCallback(e);
        }
    }

    onTouchStart(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            this.mouse.x = touch.clientX;
            this.mouse.y = touch.clientY;
            this.mouse.down = true;
        }
    }

    onTouchMove(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            this.mouse.x = touch.clientX;
            this.mouse.y = touch.clientY;
        }
    }

    onTouchEnd(e) {
        this.mouse.down = false;
    }

    setTouchInput(direction, pressed) {
        if (!this.localPlayer) return;
        
        switch (direction) {
            case 'up':
                this.localPlayer.input.up = pressed;
                this.localPlayer.input.jump = pressed;
                break;
            case 'down':
                this.localPlayer.input.down = pressed;
                break;
            case 'left':
                this.localPlayer.input.left = pressed;
                break;
            case 'right':
                this.localPlayer.input.right = pressed;
                break;
            case 'jump':
                this.localPlayer.input.jump = pressed;
                break;
        }
    }

    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastTime = performance.now();
        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
    }

    gameLoop(currentTime = performance.now()) {
        if (!this.isRunning) return;
        
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        this.update(deltaTime);
        this.render();
        
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    update(deltaTime) {
        if (this.state === GameState.PLAYING || this.state === GameState.TESTING) {
            // Update local player
            if (this.localPlayer) {
                this.localPlayer.update(this.world, this.audioManager);
                
                // Check for die line (void death)
                const dieLineY = this.world.dieLineY ?? 2000;
                if (this.localPlayer.y > dieLineY) {
                    this.localPlayer.die();
                }
                
                // Check for respawn
                if (this.localPlayer.isDead) {
                    this.respawnPlayer();
                }
                
                // Check for checkpoint/endpoint collision
                this.checkSpecialCollisions();
                
                // Camera follows player
                this.camera.follow(this.localPlayer);
            }
            
            // Update remote players
            for (const player of this.remotePlayers.values()) {
                // Remote players just interpolate to their positions
            }
        } else if (this.state === GameState.EDITOR) {
            // In editor mode, update player movement (fly mode) without death mechanics
            if (this.localPlayer) {
                // Force fly mode in editor
                this.localPlayer.isFlying = true;
                this.localPlayer.updateFlying(this.world, true); // true = editor mode, no hurt checks
                
                // Camera follows player in editor mode
                this.camera.follow(this.localPlayer);
            }
        }
        
        this.camera.update();
    }

    checkSpecialCollisions() {
        if (!this.localPlayer || this.localPlayer.isDead) return;
        
        const playerBox = this.localPlayer.getGroundTouchbox();
        
        for (const obj of this.world.objects) {
            if (!this.localPlayer.boxIntersects(playerBox, obj)) continue;
            
            if (obj.actingType === 'checkpoint') {
                // Mark previous checkpoint as touched (blue)
                if (this.lastCheckpoint && this.lastCheckpoint !== obj) {
                    this.lastCheckpoint.checkpointState = 'touched';
                }
                // Mark new checkpoint as active (green)
                obj.checkpointState = 'active';
                this.lastCheckpoint = obj;
            } else if (obj.actingType === 'endpoint') {
                this.onGameEnd();
            }
        }
    }

    respawnPlayer() {
        if (!this.localPlayer) return;
        
        let spawnX, spawnY;
        
        if (this.lastCheckpoint) {
            spawnX = this.lastCheckpoint.x + this.lastCheckpoint.width / 2 - PLAYER_SIZE / 2;
            spawnY = this.lastCheckpoint.y - PLAYER_SIZE;
        } else if (this.world.spawnPoint) {
            spawnX = this.world.spawnPoint.x + this.world.spawnPoint.width / 2 - PLAYER_SIZE / 2;
            spawnY = this.world.spawnPoint.y - PLAYER_SIZE;
        } else {
            spawnX = 100;
            spawnY = 100;
        }
        
        this.localPlayer.respawn(spawnX, spawnY);
    }

    onGameEnd() {
        // Override this for multiplayer handling
        if (this.onGameEndCallback) {
            this.onGameEndCallback();
        }
    }

    render() {
        // Clear using camera dimensions (DPR transform is already applied)
        this.ctx.clearRect(0, 0, this.camera.width, this.camera.height);
        
        // Apply zoom
        this.ctx.save();
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        
        // Render world objects behind player
        const layers = this.world.render(this.ctx, this.camera);
        
        // Render same layer objects
        for (const obj of layers[1]) {
            obj.render(this.ctx, this.camera);
        }
        
        // Render players
        if (this.state === GameState.PLAYING || this.state === GameState.TESTING || this.state === GameState.EDITOR) {
            // Remote players
            for (const player of this.remotePlayers.values()) {
                player.render(this.ctx, this.camera);
            }
            
            // Local player on top
            if (this.localPlayer) {
                this.localPlayer.render(this.ctx, this.camera);
            }
        }
        
        // Render objects above player
        this.world.renderAbovePlayer(this.ctx, this.camera);
        
        // Render editor overlays
        if (this.state === GameState.EDITOR && this.renderEditorOverlay) {
            this.renderEditorOverlay(this.ctx, this.camera);
        }
        
        this.ctx.restore();
    }

    startGame(playerName, playerColor) {
        this.state = GameState.PLAYING;
        this.lastCheckpoint = null;
        
        // Reset checkpoint states
        for (const obj of this.world.objects) {
            if (obj.actingType === 'checkpoint') {
                obj.checkpointState = 'default';
            }
        }
        
        // Create local player at spawn point
        let spawnX = 100, spawnY = 100;
        if (this.world.spawnPoint) {
            spawnX = this.world.spawnPoint.x + this.world.spawnPoint.width / 2 - PLAYER_SIZE / 2;
            spawnY = this.world.spawnPoint.y - PLAYER_SIZE;
        }
        
        this.localPlayer = new Player(spawnX, spawnY, playerName, playerColor);
        this.localPlayer.isLocal = true;
        
        // Apply world settings
        if (this.world.infiniteJumps) {
            this.localPlayer.setMaxJumps(999, true);
        } else {
            this.localPlayer.setMaxJumps(this.world.maxJumps, this.world.additionalAirjump);
        }
        
        this.camera.x = this.localPlayer.x - this.camera.width / 2;
        this.camera.y = this.localPlayer.y - this.camera.height / 2;
    }

    startTestGame() {
        this.state = GameState.TESTING;
        this.lastCheckpoint = null;
        
        // Reset checkpoint states
        for (const obj of this.world.objects) {
            if (obj.actingType === 'checkpoint') {
                obj.checkpointState = 'default';
            }
        }
        
        // Store current camera position for returning
        this.editorCameraX = this.camera.x;
        this.editorCameraY = this.camera.y;
        
        let spawnX = 100, spawnY = 100;
        if (this.world.spawnPoint) {
            spawnX = this.world.spawnPoint.x + this.world.spawnPoint.width / 2 - PLAYER_SIZE / 2;
            spawnY = this.world.spawnPoint.y - PLAYER_SIZE;
        }
        
        this.localPlayer = new Player(spawnX, spawnY, 'Tester', '#4ECDC4');
        this.localPlayer.isLocal = true;
        
        if (this.world.infiniteJumps) {
            this.localPlayer.setMaxJumps(999, true);
        } else {
            this.localPlayer.setMaxJumps(this.world.maxJumps, this.world.additionalAirjump);
        }
    }

    stopGame() {
        this.state = GameState.EDITOR;
        this.localPlayer = null;
        this.remotePlayers.clear();
        
        // Restore camera position if coming from test mode
        if (this.editorCameraX !== undefined) {
            this.camera.x = this.editorCameraX;
            this.camera.y = this.editorCameraY;
        }
        
        // Recreate editor player
        this.createEditorPlayer();
    }

    createEditorPlayer() {
        // Create a player for editor mode (fly mode, no death)
        let spawnX = 100;
        let spawnY = 100;
        
        if (this.world.spawnPoint) {
            spawnX = this.world.spawnPoint.x + this.world.spawnPoint.width / 2 - PLAYER_SIZE / 2;
            spawnY = this.world.spawnPoint.y - PLAYER_SIZE;
        }
        
        this.localPlayer = new Player(spawnX, spawnY, 'Editor', '#45B7D1');
        this.localPlayer.isLocal = true;
        this.localPlayer.isFlying = true; // Always fly in editor mode
        
        this.state = GameState.EDITOR;
    }

    addRemotePlayer(id, name, color, x, y) {
        const player = new Player(x, y, name, color);
        this.remotePlayers.set(id, player);
        return player;
    }

    updateRemotePlayer(id, x, y) {
        const player = this.remotePlayers.get(id);
        if (player) {
            player.x = x;
            player.y = y;
        }
    }

    removeRemotePlayer(id) {
        this.remotePlayers.delete(id);
    }

    getMouseWorldPos() {
        return this.camera.screenToWorld(this.mouse.x, this.mouse.y);
    }

    getGridAlignedPos(x, y) {
        return {
            x: Math.floor(x / GRID_SIZE) * GRID_SIZE,
            y: Math.floor(y / GRID_SIZE) * GRID_SIZE
        };
    }
}

// Export for use in other modules
window.GameEngine = GameEngine;
window.Player = Player;
window.Camera = Camera;
window.World = World;
window.WorldObject = WorldObject;
window.AudioManager = AudioManager;
window.GameState = GameState;
window.GRID_SIZE = GRID_SIZE;
