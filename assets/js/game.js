/**
 * PARKOREEN - Game Engine
 * Core game mechanics: physics, player, camera, collisions
 */

// ============================================
// CONSTANTS
// ============================================
const GRID_SIZE = 32;
const DEFAULT_GRAVITY = 0.8;
const DEFAULT_JUMP_FORCE = -14;
const DEFAULT_MOVE_SPEED = 5;
const FLY_SPEED = 8;
const CAMERA_LERP = 0.08;
const PLAYER_SIZE = 32;

// ============================================
// GAME STATE
// ============================================
const GameState = {
    EDITOR: 'editor',
    PLAYING: 'playing',
    TESTING: 'testing',
    ENDED: 'ended'
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
            jump: false,
            shift: false
        };
        
        // Touchboxes - positioned lower on the player sprite
        // Ground touchbox: used for ground collision (slightly smaller, lower)
        this.groundTouchbox = { x: 4, y: 8, width: PLAYER_SIZE - 8, height: PLAYER_SIZE - 8 };
        // Hurt touchbox: used for spike damage detection (smaller, even lower)
        this.hurtTouchbox = { x: 8, y: 12, width: PLAYER_SIZE - 16, height: PLAYER_SIZE - 14 };
        
        this.isLocal = false;
        this.isDead = false;
        
        // Direction change tracking for checkpoint jump reset
        this.lastDirection = 0; // -1 left, 0 none, 1 right
        this.lastDirectionChangeTime = 0;
        this.directionChangeCount = 0;
        this.directionChangeWindowStart = 0;
    }

    generateRandomColor() {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
            '#F8B500', '#00CED1', '#FF69B4', '#32CD32', '#FFD700'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    update(world, audioManager, editorMode = false) {
        if (this.isDead) return;

        if (this.isFlying) {
            this.updateFlying(world, editorMode);
        } else {
            this.updatePhysics(world, audioManager, editorMode);
        }
    }

    updateFlying(world, editorMode = false) {
        const speed = FLY_SPEED;
        
        if (this.input.left) this.x -= speed;
        if (this.input.right) this.x += speed;
        // W/ArrowUp OR Space moves up in fly mode
        if (this.input.up || this.input.jump) this.y -= speed;
        // S/ArrowDown OR Shift moves down in fly mode
        if (this.input.down || this.input.shift) this.y += speed;
        
        this.vx = 0;
        this.vy = 0;
        
        // Check for hurt collisions while flying (but not in editor mode)
        if (world && !editorMode) {
            this.checkHurtCollisions(world);
        }
    }

    updatePhysics(world, audioManager, editorMode = false) {
        // Get physics settings from world or use defaults
        const moveSpeed = world?.playerSpeed ?? DEFAULT_MOVE_SPEED;
        const gravity = world?.gravity ?? DEFAULT_GRAVITY;
        const jumpForce = world?.jumpForce ?? DEFAULT_JUMP_FORCE;
        
        // Horizontal movement
        let currentDirection = 0;
        if (this.input.left) {
            this.vx = -moveSpeed;
            currentDirection = -1;
        } else if (this.input.right) {
            this.vx = moveSpeed;
            currentDirection = 1;
        } else {
            this.vx = 0;
        }
        
        // Track direction changes for checkpoint jump reset
        const now = Date.now();
        if (currentDirection !== 0 && currentDirection !== this.lastDirection && this.lastDirection !== 0) {
            // Direction changed
            if (now - this.directionChangeWindowStart > 500) {
                // Start new window
                this.directionChangeWindowStart = now;
                this.directionChangeCount = 1;
            } else {
                this.directionChangeCount++;
            }
            this.lastDirectionChangeTime = now;
        }
        if (currentDirection !== 0) {
            this.lastDirection = currentDirection;
        }

        // Apply gravity
        this.vy += gravity;
        
        // Cap fall speed (scaled with gravity)
        const maxFallSpeed = 20 * (gravity / DEFAULT_GRAVITY);
        if (this.vy > maxFallSpeed) this.vy = maxFallSpeed;

        // Handle jump - infinite jumps in editor mode
        const canJumpNow = editorMode ? true : (this.jumpsRemaining > 0);
        if (this.input.jump && this.canJump && canJumpNow) {
            this.vy = jumpForce;
            if (!editorMode) {
                this.jumpsRemaining--;
            }
            this.canJump = false;
            this.isOnGround = false;
            if (audioManager) audioManager.play('jump');
        }

        if (!this.input.jump) {
            this.canJump = true;
        }

        // Apply movement with collision
        this.moveWithCollision(world, editorMode);
    }

    moveWithCollision(world, editorMode = false) {
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

        // Check hurt collisions (skip in editor mode)
        if (!editorMode) {
            this.checkHurtCollisions(world);
        }
    }

    checkCollisions(world, direction) {
        const collisions = [];
        const box = this.getGroundTouchbox();
        const worldSpikeMode = world?.spikeTouchbox || 'normal';
        
        for (const obj of world.objects) {
            // Skip objects without collision
            if (!obj.collision) continue;
            
            // Handle spike ground collision based on mode
            if (obj.actingType === 'spike') {
                // Use per-object spikeTouchbox if set, otherwise use world default
                const spikeMode = obj.spikeTouchbox || worldSpikeMode;
                
                // If spike is attached to ground, skip ground collision for this spike
                // (the attached ground block will handle it)
                if (world.isSpikeAttachedToGround(obj)) {
                    continue;
                }
                
                // In 'air' mode, spikes have no interaction
                if (spikeMode === 'air') continue;
                
                // In 'full' mode, spikes don't act as ground
                if (spikeMode === 'full') continue;
                
                // For normal, tip, ground, flag modes - check flat part collision
                if (this.boxIntersects(box, obj)) {
                    const flatBox = this.getSpikeFlat(obj);
                    if (this.boxIntersects(box, flatBox)) {
                        // Flat part acts as ground in normal, tip, ground, flag modes
                        collisions.push({ ...obj, ...flatBox });
                    }
                    // In 'ground' mode, entire spike acts as ground
                    else if (spikeMode === 'ground') {
                        collisions.push(obj);
                    }
                }
                continue;
            }
            
            if (this.boxIntersects(box, obj)) {
                collisions.push(obj);
            }
        }
        
        return collisions;
    }

    checkHurtCollisions(world) {
        if (!world || !world.objects) return;
        
        const hurtBox = this.getHurtTouchbox();
        const worldSpikeMode = world?.spikeTouchbox || 'normal';
        
        for (const obj of world.objects) {
            // Only check objects that act as spikes and have collision enabled
            if (obj.actingType === 'spike' && obj.collision !== false) {
                // Use per-object spikeTouchbox if set, otherwise use world default
                const spikeMode = obj.spikeTouchbox || worldSpikeMode;
                
                // In 'air', 'ground', or 'flag' mode, spikes don't damage
                if (spikeMode === 'air' || spikeMode === 'ground' || spikeMode === 'flag') continue;
                
                // In 'full' mode, any contact with spike = damage
                if (spikeMode === 'full') {
                    if (this.boxIntersects(hurtBox, obj)) {
                        this.die();
                        return;
                    }
                    continue;
                }
                
                // In 'normal' mode, flat part is safe, rest damages
                if (spikeMode === 'normal') {
                    const flatBox = this.getSpikeFlat(obj);
                    const dangerBox = this.getSpikeDanger(obj);
                    
                    // Check if touching danger zone (not in flat area)
                    if (this.boxIntersects(hurtBox, dangerBox) && !this.boxIntersects(hurtBox, flatBox)) {
                        this.die();
                        return;
                    }
                    continue;
                }
                
                // In 'tip' mode, only the very tip damages
                if (spikeMode === 'tip') {
                    const tipBox = this.getSpikeTip(obj);
                    if (this.boxIntersects(hurtBox, tipBox)) {
                        this.die();
                        return;
                    }
                    continue;
                }
            }
        }
    }
    
    // Get the flat (base) part of a spike based on rotation
    getSpikeFlat(spike) {
        const rotation = spike.rotation || 0;
        const flatDepth = spike.height * 0.25; // 25% of spike is flat base
        
        switch (rotation) {
            case 0: // Tip up, flat at bottom
                return { x: spike.x, y: spike.y + spike.height - flatDepth, width: spike.width, height: flatDepth };
            case 90: // Tip right, flat at left
                return { x: spike.x, y: spike.y, width: flatDepth, height: spike.height };
            case 180: // Tip down, flat at top
                return { x: spike.x, y: spike.y, width: spike.width, height: flatDepth };
            case 270: // Tip left, flat at right
                return { x: spike.x + spike.width - flatDepth, y: spike.y, width: flatDepth, height: spike.height };
            default:
                return { x: spike.x, y: spike.y + spike.height - flatDepth, width: spike.width, height: flatDepth };
        }
    }
    
    // Get the danger zone of a spike (everything except flat)
    getSpikeDanger(spike) {
        const rotation = spike.rotation || 0;
        const flatDepth = spike.height * 0.25;
        
        switch (rotation) {
            case 0: // Tip up
                return { x: spike.x, y: spike.y, width: spike.width, height: spike.height - flatDepth };
            case 90: // Tip right
                return { x: spike.x + flatDepth, y: spike.y, width: spike.width - flatDepth, height: spike.height };
            case 180: // Tip down
                return { x: spike.x, y: spike.y + flatDepth, width: spike.width, height: spike.height - flatDepth };
            case 270: // Tip left
                return { x: spike.x, y: spike.y, width: spike.width - flatDepth, height: spike.height };
            default:
                return { x: spike.x, y: spike.y, width: spike.width, height: spike.height - flatDepth };
        }
    }
    
    // Get only the tip of a spike (top 20%)
    getSpikeTip(spike) {
        const rotation = spike.rotation || 0;
        const tipDepth = spike.height * 0.2; // Top 20% is the tip
        
        switch (rotation) {
            case 0: // Tip up
                return { x: spike.x + spike.width * 0.25, y: spike.y, width: spike.width * 0.5, height: tipDepth };
            case 90: // Tip right
                return { x: spike.x + spike.width - tipDepth, y: spike.y + spike.height * 0.25, width: tipDepth, height: spike.height * 0.5 };
            case 180: // Tip down
                return { x: spike.x + spike.width * 0.25, y: spike.y + spike.height - tipDepth, width: spike.width * 0.5, height: tipDepth };
            case 270: // Tip left
                return { x: spike.x, y: spike.y + spike.height * 0.25, width: tipDepth, height: spike.height * 0.5 };
            default:
                return { x: spike.x + spike.width * 0.25, y: spike.y, width: spike.width * 0.5, height: tipDepth };
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
        ctx.font = '14px "Parkoreen Game", monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 2;
        ctx.fillText(this.name, screenX + this.width / 2, screenY + this.height + 16);
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
        this.font = config.font || 'Parkoreen Game';
        this.fontSize = config.fontSize || 24;
        this.hAlign = config.hAlign || 'center'; // left, center, right
        this.vAlign = config.vAlign || 'center'; // top, center, bottom
        this.hSpacing = config.hSpacing || 0;
        this.vSpacing = config.vSpacing || 0;
        
        // Checkpoint state (default, active, touched)
        this.checkpointState = config.checkpointState || 'default';
        
        // Per-spike touchbox mode (null = use world default, or 'full', 'normal', 'tip', 'ground', 'flag', 'air')
        this.spikeTouchbox = config.spikeTouchbox || null;
        
        // Zone-specific property
        this.zoneName = config.zoneName || null;
        
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

    render(ctx, camera, checkpointColors = null) {
        // Note: ctx already has camera.zoom applied via ctx.scale()
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;
        const width = this.width;
        const height = this.height;

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
            this.renderCheckpoint(ctx, screenX, screenY, width, height, checkpointColors);
        } else if (this.appearanceType === 'spawnpoint') {
            this.renderSpawnpoint(ctx, screenX, screenY, width, height);
        } else if (this.appearanceType === 'endpoint') {
            this.renderEndpoint(ctx, screenX, screenY, width, height);
        } else if (this.appearanceType === 'zone') {
            this.renderZone(ctx, screenX, screenY, width, height);
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

    renderCheckpoint(ctx, x, y, w, h, checkpointColors = null) {
        // Flag pole
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(x + w * 0.4, y + h * 0.2, w * 0.1, h * 0.8);
        
        // Flag color based on state (use provided colors or defaults)
        const defaultColor = checkpointColors?.default || '#808080';
        const activeColor = checkpointColors?.active || '#4CAF50';
        const touchedColor = checkpointColors?.touched || '#2196F3';
        
        let flagColor = defaultColor;
        if (this.checkpointState === 'active') {
            flagColor = activeColor;
        } else if (this.checkpointState === 'touched') {
            flagColor = touchedColor;
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
    
    renderZone(ctx, x, y, w, h) {
        // Semi-transparent white fill (30% opacity)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(x, y, w, h);
        
        // Solid white border
        ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
        ctx.setLineDash([]);
        
        // Zone name label
        if (this.zoneName) {
            ctx.font = '12px "Parkoreen Game", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            
            const padding = 4;
            const textWidth = ctx.measureText(this.zoneName).width;
            
            // Background for label
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(x + 4, y + 4, textWidth + padding * 2, 18);
            
            // Text (white to match border)
            ctx.fillStyle = 'rgba(255, 255, 255, 1)';
            ctx.fillText(this.zoneName, x + 4 + padding, y + 6);
        }
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
            spikeTouchbox: this.spikeTouchbox,
            zoneName: this.zoneName,
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
        this.background = 'sky'; // sky, galaxy, custom
        
        // Music settings
        this.music = {
            type: 'none', // 'none', 'chill', 'adventure', 'retro', 'epic', 'peaceful', 'custom'
            customData: null, // base64 audio data for custom music
            customName: null, // filename of custom music
            volume: 50, // 0-100
            loop: true
        };
        
        // Custom background settings
        this.customBackground = {
            enabled: false,
            type: null, // 'image', 'gif', 'video'
            data: null, // base64 or URL
            playMode: 'loop', // 'once', 'loop', 'bounce'
            loopCount: -1, // -1 = infinite, otherwise number of times
            endType: 'freeze', // 'freeze', 'replace' (for play once)
            endBackground: null, // Another customBackground object for replacement
            sameAcrossScreens: false, // Sync playback across all players
            reverse: false // Play backwards
        };
        this.defaultBlockColor = '#787878';
        this.defaultSpikeColor = '#c45a3f';
        this.defaultTextColor = '#000000';
        
        // Checkpoint color settings
        this.checkpointDefaultColor = '#808080'; // Gray - default state
        this.checkpointActiveColor = '#4CAF50';  // Green - current checkpoint
        this.checkpointTouchedColor = '#2196F3'; // Blue - already touched
        
        this.maxJumps = 1;
        this.infiniteJumps = false;
        this.additionalAirjump = false;
        this.collideWithEachOther = true;
        this.spawnPoint = null;
        this.checkpoints = [];
        this.endpoint = null;
        this.mapName = 'Untitled Map';
        this.dieLineY = 2000; // Y position below which players die (void death)
        
        // Physics settings
        this.playerSpeed = DEFAULT_MOVE_SPEED; // Horizontal movement speed (default: 5)
        this.jumpForce = DEFAULT_JUMP_FORCE;   // Jump force/height (default: -14, negative = upward)
        this.gravity = DEFAULT_GRAVITY;         // Gravity strength (default: 0.8)
        
        // Spike touchbox mode
        // 'full' - Entire spike damages player
        // 'normal' - Flat part = ground, rest = damage (default)
        // 'tip' - Only spike tip damages, flat = ground, middle = nothing
        // 'ground' - Entire spike acts as ground (no damage)
        // 'flag' - Only flat part acts as ground, rest = air
        // 'air' - No interaction at all
        this.spikeTouchbox = 'normal';
        
        // Stored data type for .pkrn export
        // 'json' - Human-readable, larger file size
        // 'dat' - Binary format, smaller file size
        this.storedDataType = 'json';
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
    
    getObjectsAt(x, y) {
        // Return all objects at this point
        return this.objects.filter(obj => obj.containsPoint(x, y));
    }
    
    /**
     * Check if a spike is attached to a ground block
     * Returns true if the spike's flat side (determined by rotation) is touching a ground block
     * @param {WorldObject} spike - The spike to check
     * @returns {boolean}
     */
    isSpikeAttachedToGround(spike) {
        if (spike.appearanceType !== 'spike') return false;
        
        // Determine which side is the flat side based on rotation
        // rotation 0 = spike pointing up, flat side at bottom (y + height)
        // rotation 90 = spike pointing right, flat side at left (x - 1)
        // rotation 180 = spike pointing down, flat side at top (y - 1)
        // rotation 270 = spike pointing left, flat side at right (x + width)
        
        let checkX, checkY;
        const r = spike.rotation % 360;
        
        if (r === 0) {
            // Flat side at bottom
            checkX = spike.x + spike.width / 2;
            checkY = spike.y + spike.height + 1;
        } else if (r === 90) {
            // Flat side at left
            checkX = spike.x - 1;
            checkY = spike.y + spike.height / 2;
        } else if (r === 180) {
            // Flat side at top
            checkX = spike.x + spike.width / 2;
            checkY = spike.y - 1;
        } else if (r === 270) {
            // Flat side at right
            checkX = spike.x + spike.width + 1;
            checkY = spike.y + spike.height / 2;
        } else {
            return false;
        }
        
        // Check if there's a ground block at that position
        const objectsAtPoint = this.getObjectsAt(checkX, checkY);
        return objectsAtPoint.some(obj => 
            obj.id !== spike.id && 
            obj.actingType === 'ground' && 
            obj.collision
        );
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
        // Render objects by layer (skip zones - they render on top)
        const layers = [[], [], []];
        
        // Checkpoint colors to pass to objects
        const checkpointColors = {
            default: this.checkpointDefaultColor,
            active: this.checkpointActiveColor,
            touched: this.checkpointTouchedColor
        };
        
        for (const obj of this.objects) {
            if (obj.appearanceType === 'zone') continue; // Zones render last
            layers[obj.layer].push(obj);
        }
        
        // Behind player (layer 0)
        for (const obj of layers[0]) {
            obj.render(ctx, camera, checkpointColors);
        }
        
        return { layers, checkpointColors }; // Return for player rendering between layers
    }

    renderAbovePlayer(ctx, camera, checkpointColors) {
        // Above player (layer 2) - skip zones
        for (const obj of this.objects) {
            if (obj.layer === 2 && obj.appearanceType !== 'zone') {
                obj.render(ctx, camera, checkpointColors);
            }
        }
    }
    
    renderZones(ctx, camera) {
        // Render all zones on top of everything
        for (const obj of this.objects) {
            if (obj.appearanceType === 'zone') {
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
            checkpointDefaultColor: this.checkpointDefaultColor,
            checkpointActiveColor: this.checkpointActiveColor,
            checkpointTouchedColor: this.checkpointTouchedColor,
            maxJumps: this.maxJumps,
            infiniteJumps: this.infiniteJumps,
            additionalAirjump: this.additionalAirjump,
            collideWithEachOther: this.collideWithEachOther,
            mapName: this.mapName,
            dieLineY: this.dieLineY,
            // Physics settings
            playerSpeed: this.playerSpeed,
            jumpForce: this.jumpForce,
            gravity: this.gravity,
            // Spike settings
            spikeTouchbox: this.spikeTouchbox,
            // Export/Import settings
            storedDataType: this.storedDataType,
            // Custom background
            customBackground: this.customBackground,
            // Music
            music: this.music
        };
    }

    fromJSON(data) {
        this.clear();
        this.background = data.background || 'sky';
        this.defaultBlockColor = data.defaultBlockColor || '#787878';
        this.defaultSpikeColor = data.defaultSpikeColor || '#c45a3f';
        this.defaultTextColor = data.defaultTextColor || '#000000';
        this.checkpointDefaultColor = data.checkpointDefaultColor || '#808080';
        this.checkpointActiveColor = data.checkpointActiveColor || '#4CAF50';
        this.checkpointTouchedColor = data.checkpointTouchedColor || '#2196F3';
        this.maxJumps = data.maxJumps || 1;
        this.infiniteJumps = data.infiniteJumps || false;
        this.additionalAirjump = data.additionalAirjump || false;
        this.collideWithEachOther = data.collideWithEachOther !== false;
        this.mapName = data.mapName || 'Untitled Map';
        this.dieLineY = data.dieLineY ?? 2000;
        
        // Physics settings with defaults for backward compatibility
        this.playerSpeed = (typeof data.playerSpeed === 'number' && data.playerSpeed > 0) ? data.playerSpeed : DEFAULT_MOVE_SPEED;
        this.jumpForce = (typeof data.jumpForce === 'number' && data.jumpForce < 0) ? data.jumpForce : DEFAULT_JUMP_FORCE;
        this.gravity = (typeof data.gravity === 'number' && data.gravity > 0) ? data.gravity : DEFAULT_GRAVITY;
        
        // Spike touchbox mode
        const validSpikeModes = ['full', 'normal', 'tip', 'ground', 'flag', 'air'];
        this.spikeTouchbox = validSpikeModes.includes(data.spikeTouchbox) ? data.spikeTouchbox : 'normal';
        
        // Stored data type for export
        const validDataTypes = ['json', 'dat'];
        this.storedDataType = validDataTypes.includes(data.storedDataType) ? data.storedDataType : 'json';
        
        // Custom background with defaults
        if (data.customBackground && data.customBackground.enabled) {
            this.customBackground = {
                enabled: true,
                type: data.customBackground.type || null,
                data: data.customBackground.data || null,
                playMode: ['once', 'loop', 'bounce'].includes(data.customBackground.playMode) ? data.customBackground.playMode : 'loop',
                loopCount: typeof data.customBackground.loopCount === 'number' ? data.customBackground.loopCount : -1,
                endType: ['freeze', 'replace'].includes(data.customBackground.endType) ? data.customBackground.endType : 'freeze',
                endBackground: data.customBackground.endBackground || null,
                sameAcrossScreens: !!data.customBackground.sameAcrossScreens,
                reverse: !!data.customBackground.reverse
            };
        } else {
            this.customBackground = {
                enabled: false,
                type: null,
                data: null,
                playMode: 'loop',
                loopCount: -1,
                endType: 'freeze',
                endBackground: null,
                sameAcrossScreens: false,
                reverse: false
            };
        }
        
        // Music settings with defaults
        const validMusicTypes = ['none', 'maccary-bay', 'reggae-party', 'custom'];
        if (data.music) {
            this.music = {
                type: validMusicTypes.includes(data.music.type) ? data.music.type : 'none',
                customData: data.music.customData || null,
                customName: data.music.customName || null,
                volume: (typeof data.music.volume === 'number' && data.music.volume >= 0 && data.music.volume <= 100) ? data.music.volume : 50,
                loop: data.music.loop !== false
            };
        } else {
            this.music = {
                type: 'none',
                customData: null,
                customName: null,
                volume: 50,
                loop: true
            };
        }
        
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

    isTypingInInput() {
        const activeEl = document.activeElement;
        return activeEl && (
            activeEl.tagName === 'INPUT' || 
            activeEl.tagName === 'TEXTAREA' || 
            activeEl.contentEditable === 'true'
        );
    }

    onKeyDown(e) {
        // Don't capture keyboard for player/game when typing in input
        if (this.isTypingInInput()) {
            // Still emit for editor shortcuts (they have their own input check)
            if (this.onKeyPress) {
                this.onKeyPress(e);
            }
            return;
        }
        
        this.keys[e.code] = true;
        
        // Update player input in all active modes (including editor)
        if (this.localPlayer) {
            this.updatePlayerInput();
        }
        
        // Emit for editor shortcuts
        if (this.onKeyPress) {
            this.onKeyPress(e);
        }
    }

    onKeyUp(e) {
        // Don't capture keyboard for player/game when typing in input
        if (this.isTypingInInput()) {
            return;
        }
        
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
        this.localPlayer.input.shift = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
        
        // Jump: Space always, W/Up also triggers jump in both modes
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
            
            // Update remote players with prediction
            for (const player of this.remotePlayers.values()) {
                // Predict position based on velocity since last update
                if (player.lastUpdateTime && player.vx !== undefined) {
                    const timeSinceUpdate = (performance.now() - player.lastUpdateTime) / 1000;
                    // Only predict for short time (max 200ms) to prevent drift
                    if (timeSinceUpdate < 0.2) {
                        const predictedX = player.serverX + player.vx * timeSinceUpdate;
                        const predictedY = player.serverY + player.vy * timeSinceUpdate;
                        // Lerp towards predicted position for smoothness
                        player.x += (predictedX - player.x) * 0.2;
                        player.y += (predictedY - player.y) * 0.2;
                    }
                }
            }
        } else if (this.state === GameState.EDITOR) {
            // In editor mode, update player movement
            if (this.localPlayer) {
                // Update player (respects fly mode toggle)
                if (this.localPlayer.isFlying) {
                    this.localPlayer.updateFlying(this.world, true); // true = editor mode, no hurt checks
                } else {
                    // Platformer physics in editor (for testing) - but no death
                    this.localPlayer.updatePhysics(this.world, null, true); // true = editor mode
                }
                
                // Camera follows player in editor mode
                this.camera.follow(this.localPlayer);
            }
        }
        
        this.camera.update();
    }

    checkSpecialCollisions() {
        if (!this.localPlayer || this.localPlayer.isDead) return;
        
        const playerBox = this.localPlayer.getGroundTouchbox();
        let onCheckpoint = false;
        
        for (const obj of this.world.objects) {
            if (!this.localPlayer.boxIntersects(playerBox, obj)) continue;
            
            if (obj.actingType === 'checkpoint') {
                onCheckpoint = true;
                
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
        
        // Check for quick direction changes on checkpoint to reset jumps
        // Works for both left→right AND right→left direction changes
        if (onCheckpoint && this.localPlayer.directionChangeCount >= 1) {
            const now = Date.now();
            // If direction change within 500ms while on checkpoint, reset jumps
            if (now - this.localPlayer.directionChangeWindowStart <= 500) {
                this.localPlayer.resetJumps();
                this.localPlayer.directionChangeCount = 0;
                this.localPlayer.directionChangeWindowStart = now;
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
        // Set game state to ended
        const previousState = this.state;
        this.state = GameState.ENDED;
        
        // Calculate time elapsed
        const endTime = Date.now();
        const elapsedMs = endTime - this.gameStartTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        const milliseconds = elapsedMs % 1000;
        
        const timeString = minutes > 0 
            ? `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
            : `${seconds}.${milliseconds.toString().padStart(3, '0')}s`;
        
        // Call callback with time info
        if (this.onGameEndCallback) {
            this.onGameEndCallback({
                time: timeString,
                elapsedMs: elapsedMs,
                wasTestMode: previousState === GameState.TESTING,
                playerName: this.localPlayer?.name || 'Player'
            });
        }
    }

    render() {
        // Clear using camera dimensions (DPR transform is already applied)
        this.ctx.clearRect(0, 0, this.camera.width, this.camera.height);
        
        // Apply zoom
        this.ctx.save();
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        
        // Render world objects behind player
        const { layers, checkpointColors } = this.world.render(this.ctx, this.camera);
        
        // Render same layer objects
        for (const obj of layers[1]) {
            obj.render(this.ctx, this.camera, checkpointColors);
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
        this.world.renderAbovePlayer(this.ctx, this.camera, checkpointColors);
        
        // Render zones on top of everything
        this.world.renderZones(this.ctx, this.camera);
        
        // Render editor overlays
        if (this.state === GameState.EDITOR && this.renderEditorOverlay) {
            this.renderEditorOverlay(this.ctx, this.camera);
        }
        
        this.ctx.restore();
    }

    startGame(playerName, playerColor) {
        this.state = GameState.PLAYING;
        this.lastCheckpoint = null;
        this.gameStartTime = Date.now();
        
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
        this.gameStartTime = Date.now();
        
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
        this.localPlayer.isFlying = true; // Start with fly mode in editor
        this.localPlayer.setMaxJumps(999, true); // Infinite jumps in editor mode
        
        this.state = GameState.EDITOR;
    }

    addRemotePlayer(id, name, color, x, y) {
        const player = new Player(x, y, name, color);
        this.remotePlayers.set(id, player);
        return player;
    }

    updateRemotePlayer(id, x, y, vx = 0, vy = 0) {
        const player = this.remotePlayers.get(id);
        if (player) {
            // Store actual server position
            player.serverX = x;
            player.serverY = y;
            player.vx = vx;
            player.vy = vy;
            player.lastUpdateTime = performance.now();
            
            // Snap to actual position (with small lerp for smoothness)
            const lerpFactor = 0.3;
            player.x = player.x + (x - player.x) * lerpFactor;
            player.y = player.y + (y - player.y) * lerpFactor;
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
