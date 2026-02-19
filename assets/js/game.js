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
const CAMERA_LERP_X = 0.12;
const CAMERA_LERP_Y = 0.12;
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
            shift: false,
            // Plugin inputs (HK controls)
            attack: false,
            heal: false,
            dash: false,
            superDash: false
        };
        
        // Touchboxes - positioned lower on the player sprite
        // Ground touchbox: used for ground collision (full width for partial ground contact)
        this.groundTouchbox = { x: 0, y: 8, width: PLAYER_SIZE, height: PLAYER_SIZE - 8 };
        // Hurt touchbox: used for spike damage detection (smaller, even lower)
        this.hurtTouchbox = { x: 8, y: 12, width: PLAYER_SIZE - 16, height: PLAYER_SIZE - 14 };
        
        this.isLocal = false;
        this.isDead = false;
        
        // Direction change tracking for checkpoint jump reset
        this.lastDirection = 0; // -1 left, 0 none, 1 right
        this.lastDirectionChangeTime = 0;
        this.directionChangeCount = 0;
        this.directionChangeWindowStart = 0;
        
        // Coyote time - grace period after leaving ground where ground jump still counts
        this.coyoteTimeStart = null;
        this.COYOTE_TIME = 250; // 0.25 seconds in milliseconds
        
        // Plugin-injectable properties (plugins can add properties dynamically)
        // These are set by plugins via hooks
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
        // Check coyote time - if within grace period, the jump counts as a ground jump
        const inCoyoteTime = this.coyoteTimeStart !== null && (now - this.coyoteTimeStart) <= this.COYOTE_TIME;
        const canJumpNow = editorMode ? true : (this.jumpsRemaining > 0 || inCoyoteTime);
        
        if (this.input.jump && this.canJump && canJumpNow) {
            this.vy = jumpForce;
            if (!editorMode) {
                // If jumping during coyote time, it counts as ground jump (use full jumps minus 1)
                if (inCoyoteTime && this.jumpsRemaining === 0) {
                    // Restore to max jumps minus 1 (the ground jump we're using now)
                    this.jumpsRemaining = Math.max(0, this.maxJumps - 1);
                } else {
                this.jumpsRemaining--;
                }
                // Clear coyote time after jumping
                this.coyoteTimeStart = null;
            }
            this.canJump = false;
            this.isOnGround = false;
            if (audioManager) audioManager.play('jump');
        } else if (this.input.jump && this.canJump && !canJumpNow && !editorMode) {
            // Can't jump normally - let plugins handle (e.g., monarch wings)
            if (window.PluginManager) {
                const result = window.PluginManager.executeHook('player.jump', {
                    player: this,
                    canJump: false
                });
                if (result.didJump) {
                    this.canJump = false;
                }
            }
        }
        
        // Expire coyote time if not used
        if (this.coyoteTimeStart !== null && (now - this.coyoteTimeStart) > this.COYOTE_TIME) {
            this.coyoteTimeStart = null;
        }

        if (!this.input.jump) {
            this.canJump = true;
            
            // Variable jump height - cut upward velocity when jump key is released
            // This allows for shorter jumps by tapping vs holding
            if (this.vy < 0 && !this.isOnGround) {
                this.vy = Math.max(this.vy, jumpForce * 0.4); // Cap at 40% of jump force
            }
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
        
        // Check if player walked off a ledge (was on ground, now falling, didn't jump)
        // If additionalAirjump is disabled, start coyote time instead of immediately losing the ground jump
        if (wasOnGround && !this.isOnGround && !this.additionalAirjump && this.jumpsRemaining === this.maxJumps) {
            // Player walked off ledge - start coyote time grace period
            this.coyoteTimeStart = Date.now();
            // Reduce jumps now, but coyote time allows recovery if jump happens within the window
            this.jumpsRemaining = Math.max(0, this.maxJumps - 1);
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
            
            // Skip text objects (actingType 'text' means no touchbox)
            if (obj.actingType === 'text') continue;
            
            // Skip teleportals - they don't act as ground, only trigger teleportation
            if (obj.type === 'teleportal') continue;
            
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
        const dropHurtOnly = world?.dropHurtOnly || false;
        
        for (const obj of world.objects) {
            // Only check objects that act as spikes and have collision enabled
            if (obj.actingType === 'spike' && obj.collision !== false) {
                // Use per-object spikeTouchbox if set, otherwise use world default
                const spikeMode = obj.spikeTouchbox || worldSpikeMode;
                
                // In 'air', 'ground', or 'flag' mode, spikes don't damage
                if (spikeMode === 'air' || spikeMode === 'ground' || spikeMode === 'flag') continue;
                
                // Check dropHurtOnly - if enabled, only hurt when player moves toward spike tip
                // Use per-object dropHurtOnly if set, otherwise use world default
                const useDropHurtOnly = obj.dropHurtOnly !== undefined ? obj.dropHurtOnly : dropHurtOnly;
                if (useDropHurtOnly && !this.isMovingTowardSpikeTip(obj)) {
                    continue;
                }
                
                let gotHit = false;
                
                // In 'full' mode, any contact with spike = damage
                if (spikeMode === 'full') {
                if (this.boxIntersects(hurtBox, obj)) {
                        gotHit = true;
                    }
                }
                
                // In 'normal' mode, flat part is safe, rest damages
                if (spikeMode === 'normal') {
                    const flatBox = this.getSpikeFlat(obj);
                    const dangerBox = this.getSpikeDanger(obj);
                    
                    // Check if touching danger zone (not in flat area)
                    if (this.boxIntersects(hurtBox, dangerBox) && !this.boxIntersects(hurtBox, flatBox)) {
                        gotHit = true;
                    }
                }
                
                // In 'tip' mode, only the very tip damages
                if (spikeMode === 'tip') {
                    const tipBox = this.getSpikeTip(obj);
                    if (this.boxIntersects(hurtBox, tipBox)) {
                        gotHit = true;
                    }
                }
                
                if (gotHit) {
                    // Let plugins handle damage via hook
                    if (window.PluginManager) {
                        const result = window.PluginManager.executeHook('player.damage', { 
                            player: this, 
                            source: obj,
                            world: world
                        });
                        if (result.preventDefault) {
                            return; // Plugin handled the damage
                        }
                    }
                    this.die();
                    return;
                }
            }
        }
    }
    
    // Get the flat (base) part of a spike based on rotation
    getSpikeFlat(spike) {
        const rotation = spike.rotation || 0;
        const flatDepth = spike.height * 0.35; // 35% of spike is flat base (increased from 25%)
        
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
    
    // Get the danger zone of a spike (much smaller - only the tip area)
    getSpikeDanger(spike) {
        const rotation = spike.rotation || 0;
        const safeDepth = spike.height * 0.5; // Bottom 50% is safe (increased from 25%)
        const sideInset = spike.width * 0.2; // Inset from sides (20% on each side)
        
        switch (rotation) {
            case 0: // Tip up - danger is smaller triangle at top
                return { 
                    x: spike.x + sideInset, 
                    y: spike.y, 
                    width: spike.width - sideInset * 2, 
                    height: spike.height - safeDepth 
                };
            case 90: // Tip right
                return { 
                    x: spike.x + safeDepth, 
                    y: spike.y + sideInset, 
                    width: spike.width - safeDepth, 
                    height: spike.height - sideInset * 2 
                };
            case 180: // Tip down
                return { 
                    x: spike.x + sideInset, 
                    y: spike.y + safeDepth, 
                    width: spike.width - sideInset * 2, 
                    height: spike.height - safeDepth 
                };
            case 270: // Tip left
                return { 
                    x: spike.x, 
                    y: spike.y + sideInset, 
                    width: spike.width - safeDepth, 
                    height: spike.height - sideInset * 2 
                };
            default:
                return { 
                    x: spike.x + sideInset, 
                    y: spike.y, 
                    width: spike.width - sideInset * 2, 
                    height: spike.height - safeDepth 
                };
        }
    }
    
    // Get only the tip of a spike (very small - top 10%)
    getSpikeTip(spike) {
        const rotation = spike.rotation || 0;
        const tipDepth = spike.height * 0.1; // Top 10% is the tip (reduced from 20%)
        const tipWidth = spike.width * 0.3; // 30% width (reduced from 50%)
        
        switch (rotation) {
            case 0: // Tip up
                return { x: spike.x + spike.width * 0.35, y: spike.y, width: tipWidth, height: tipDepth };
            case 90: // Tip right
                return { x: spike.x + spike.width - tipDepth, y: spike.y + spike.height * 0.35, width: tipDepth, height: tipWidth };
            case 180: // Tip down
                return { x: spike.x + spike.width * 0.35, y: spike.y + spike.height - tipDepth, width: tipWidth, height: tipDepth };
            case 270: // Tip left
                return { x: spike.x, y: spike.y + spike.height * 0.35, width: tipDepth, height: tipWidth };
            default:
                return { x: spike.x + spike.width * 0.35, y: spike.y, width: tipWidth, height: tipDepth };
        }
    }
    
    // Check if player is moving toward the spike's tip direction
    isMovingTowardSpikeTip(spike) {
        const rotation = spike.rotation || 0;
        const vx = this.vx || 0;
        const vy = this.vy || 0;
        const speed = Math.sqrt(vx * vx + vy * vy);
        
        // If not moving, don't trigger drop hurt
        if (speed < 0.5) return false;
        
        // Check movement direction relative to spike tip direction
        switch (rotation) {
            case 0: // Tip up - player must be moving down (positive vy)
                return vy > 0;
            case 90: // Tip right - player must be moving left (negative vx)
                return vx < 0;
            case 180: // Tip down - player must be moving up (negative vy)
                return vy < 0;
            case 270: // Tip left - player must be moving right (positive vx)
                return vx > 0;
            default:
                return vy > 0; // Default to tip up
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
        // When landing on ground, reset to full jumps
        // (The walk-off-ledge penalty is handled in moveWithCollision)
            this.jumpsRemaining = this.maxJumps;
        // Clear coyote time when landing
        this.coyoteTimeStart = null;
        // Notify plugins of landing
        if (window.PluginManager) {
            window.PluginManager.executeHook('player.land', { player: this });
        }
        // Reset monarch wings
        this.monarchWingsUsed = 0;
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

    render(ctx, camera, showPosition = false) {
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
        
        // Draw position above player (editor/test mode only)
        if (showPosition) {
            const fontScale = (typeof Settings !== 'undefined' && Settings.get('fontSize')) ? Settings.get('fontSize') / 100 : 1;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = `${Math.round(16 * fontScale)}px "Parkoreen Game", monospace`;
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowBlur = 4;
            const posText = `(${Math.round(this.x)}, ${Math.round(this.y)})`;
            ctx.fillText(posText, screenX + this.width / 2, screenY - 10);
            ctx.shadowBlur = 0;
        }
        
        // Draw name
        const nameFontScale = (typeof Settings !== 'undefined' && Settings.get('fontSize')) ? Settings.get('fontSize') / 100 : 1;
        ctx.fillStyle = 'white';
        ctx.font = `${Math.round(14 * nameFontScale)}px "Parkoreen Game", monospace`;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 2;
        ctx.fillText(this.name, screenX + this.width / 2, screenY + this.height + Math.round(16 * nameFontScale));
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

    update(lerpX = CAMERA_LERP_X, lerpY = CAMERA_LERP_Y) {
        // Smooth camera movement (separate horizontal/vertical smoothness)
        this.x += (this.targetX - this.x) * lerpX;
        this.y += (this.targetY - this.y) * lerpY;
    }

    setZoom(zoom, centerX = null, centerY = null) {
        const oldZoom = this.zoom;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
        
        if (oldZoom !== newZoom && centerX !== null && centerY !== null) {
            // Adjust camera position to keep the center point in the same screen position
            // Before zoom: screenCenter = (centerX - this.x) * oldZoom
            // After zoom: screenCenter = (centerX - newX) * newZoom
            // We want them equal, so: (centerX - this.x) * oldZoom = (centerX - newX) * newZoom
            // Solving for newX: newX = centerX - (centerX - this.x) * oldZoom / newZoom
            this.x = centerX - (centerX - this.x) * oldZoom / newZoom;
            this.y = centerY - (centerY - this.y) * oldZoom / newZoom;
            this.targetX = this.x;
            this.targetY = this.y;
        }
        
        this.zoom = newZoom;
    }

    zoomIn(centerX = null, centerY = null) {
        this.setZoom(this.zoom + 0.1, centerX, centerY);
    }

    zoomOut(centerX = null, centerY = null) {
        this.setZoom(this.zoom - 0.1, centerX, centerY);
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
// IMAGE LOADERS
// ============================================
const SpikeImage = {
    image: null,
    loaded: false,
    load() {
        if (this.image) return;
        this.image = new Image();
        this.image.onload = () => { this.loaded = true; };
        this.image.src = '/parkoreen/assets/svg/spike-64x.svg';
    }
};

const PortalImage = {
    image: null,
    loaded: false,
    load() {
        if (this.image) return;
        this.image = new Image();
        this.image.onload = () => { this.loaded = true; };
        this.image.src = '/parkoreen/assets/svg/portal-64x.svg';
    }
};

// Load images immediately
SpikeImage.load();
PortalImage.load();

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
        this.flipHorizontal = config.flipHorizontal || false;
        
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
        
        // Per-spike dropHurtOnly (undefined = use world default, true/false = override)
        this.dropHurtOnly = config.dropHurtOnly;
        
        // Zone-specific property
        this.zoneName = config.zoneName || null;
        
        // Teleportal-specific properties
        this.teleportalName = config.teleportalName || null;
        // sendTo/receiveFrom: Array of {name, enabled} objects (backward compatible with string arrays)
        this.sendTo = (config.sendTo || []).map(item => 
            typeof item === 'string' ? { name: item, enabled: true } : item
        );
        this.receiveFrom = (config.receiveFrom || []).map(item => 
            typeof item === 'string' ? { name: item, enabled: true } : item
        );
        
        this.name = config.name || this.getDefaultName();
    }

    generateId() {
        return 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getDefaultName() {
        if (this.type === 'teleportal') {
            return 'Teleportal';
        }
        const typeNames = {
            ground: 'Block',
            spike: 'Spike',
            checkpoint: 'Checkpoint',
            spawnpoint: 'Spawn Point',
            endpoint: 'End Point',
            teleportal: 'Teleportal'
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
        
        // Apply rotation and flip
        if (this.rotation !== 0 || this.flipHorizontal) {
            ctx.translate(screenX + width / 2, screenY + height / 2);
            if (this.rotation !== 0) {
            ctx.rotate(this.rotation * Math.PI / 180);
            }
            if (this.flipHorizontal) {
                ctx.scale(-1, 1);
            }
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
        } else if (this.type === 'teleportal' || this.appearanceType === 'teleportal') {
            this.renderTeleportal(ctx, screenX, screenY, width, height);
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
        // Use the SVG spike image if loaded
        if (SpikeImage.loaded && SpikeImage.image) {
            // Create an offscreen canvas to tint the spike with the object's color
            const offscreen = document.createElement('canvas');
            offscreen.width = w;
            offscreen.height = h;
            const offCtx = offscreen.getContext('2d');
            
            // Draw the spike image scaled to fit
            offCtx.drawImage(SpikeImage.image, 0, 0, w, h);
            
            // Tint the spike with the object's color using multiply blend
            offCtx.globalCompositeOperation = 'source-in';
            offCtx.fillStyle = this.color;
            offCtx.fillRect(0, 0, w, h);
            
            // Draw the tinted spike to the main canvas
            ctx.drawImage(offscreen, x, y);
        } else {
            // Fallback: simple triangle spikes if image not loaded
            const color = this.color;
            const numTeeth = Math.max(3, Math.min(6, Math.round(w / 12)));
            const toothWidth = w / numTeeth;
            const baseHeight = h * 0.17;
            
            ctx.fillStyle = color;
            ctx.fillRect(x, y + h - baseHeight, w, baseHeight);
            
            for (let t = 0; t < numTeeth; t++) {
                const toothX = x + t * toothWidth;
        ctx.beginPath();
                ctx.moveTo(toothX, y + h - baseHeight);
                ctx.lineTo(toothX + toothWidth / 2, y);
                ctx.lineTo(toothX + toothWidth, y + h - baseHeight);
        ctx.closePath();
        ctx.fill();
            }
        }
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
            const zoneFontScale = (typeof Settings !== 'undefined' && Settings.get('fontSize')) ? Settings.get('fontSize') / 100 : 1;
            ctx.font = `${Math.round(12 * zoneFontScale)}px "Parkoreen Game", sans-serif`;
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
    
    renderTeleportal(ctx, x, y, w, h) {
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        
        // Use the SVG portal image if loaded
        if (PortalImage.loaded && PortalImage.image) {
            // Create an offscreen canvas to tint the portal with the object's color
            const offscreen = document.createElement('canvas');
            offscreen.width = w;
            offscreen.height = h;
            const offCtx = offscreen.getContext('2d');
            
            // Draw the portal image scaled to fit
            offCtx.drawImage(PortalImage.image, 0, 0, w, h);
            
            // Tint the portal with the object's color using source-in blend
            offCtx.globalCompositeOperation = 'source-in';
            offCtx.fillStyle = this.color;
            offCtx.fillRect(0, 0, w, h);
            
            // Draw the tinted portal to the main canvas
            ctx.drawImage(offscreen, x, y);
        } else {
            // Fallback: circular portal appearance if image not loaded
            const radius = Math.min(w, h) * 0.4;
            
            // Outer glow
            const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.3, centerX, centerY, radius);
            gradient.addColorStop(0, this.color);
            gradient.addColorStop(0.7, this.color + '80');
            gradient.addColorStop(1, this.color + '00');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Inner swirl effect
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                const startAngle = (i * Math.PI * 2 / 3);
                ctx.arc(centerX, centerY, radius * 0.6, startAngle, startAngle + Math.PI * 0.6);
            }
            ctx.stroke();
            
            // Center dot
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * 0.15, 0, Math.PI * 2);
            ctx.fill();
            
            // Portal border
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Teleportal name label
        if (this.teleportalName) {
            const tpFontScale = (typeof Settings !== 'undefined' && Settings.get('fontSize')) ? Settings.get('fontSize') / 100 : 1;
            ctx.font = `${Math.round(10 * tpFontScale)}px "Parkoreen Game", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            
            const textWidth = ctx.measureText(this.teleportalName).width;
            const padding = 3;
            
            // Text
            ctx.fillStyle = this.color;
            ctx.fillText(this.teleportalName, centerX, y + h - 12);
        }
    }

    renderText(ctx, x, y, w, h) {
        ctx.fillStyle = this.color;
        const scaleFactor = w / this.width;
        
        // Apply global font size setting (from Settings)
        const globalFontScale = (typeof Settings !== 'undefined' && Settings.get('fontSize')) 
            ? Settings.get('fontSize') / 100 
            : 1;
        
        const fontSize = this.fontSize * scaleFactor * globalFontScale;
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
            flipHorizontal: this.flipHorizontal,
            content: this.content,
            font: this.font,
            fontSize: this.fontSize,
            hAlign: this.hAlign,
            vAlign: this.vAlign,
            hSpacing: this.hSpacing,
            vSpacing: this.vSpacing,
            spikeTouchbox: this.spikeTouchbox,
            dropHurtOnly: this.dropHurtOnly,
            zoneName: this.zoneName,
            teleportalName: this.teleportalName,
            sendTo: this.sendTo,
            receiveFrom: this.receiveFrom,
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
        this.cameraLerpX = CAMERA_LERP_X;       // Horizontal camera smoothness (default: 0.12)
        this.cameraLerpY = CAMERA_LERP_Y;       // Vertical camera smoothness (default: 0.12)
        
        // Spike touchbox mode
        // 'full' - Entire spike damages player
        // 'normal' - Flat part = ground, rest = damage (default)
        // 'tip' - Only spike tip damages, flat = ground, middle = nothing
        // 'ground' - Entire spike acts as ground (no damage)
        // 'flag' - Only flat part acts as ground, rest = air
        // 'air' - No interaction at all
        this.spikeTouchbox = 'normal';
        
        // Drop Hurt Only - spikes only damage when player moves toward the spike tip
        this.dropHurtOnly = false;
        
        // Stored data type for .pkrn export
        // 'json' - Human-readable, larger file size
        // 'dat' - Binary format, smaller file size
        this.storedDataType = 'json';
        
        // Plugins system - configs are dynamically added when plugins are enabled
        this.plugins = {
            enabled: [] // Array of enabled plugin IDs
            // Plugin configs are added dynamically: this.plugins[pluginId] = {...}
        };
        
        // Keyboard layout (applies in test/play mode only)
        // 'jimmyqrg' - Default JimmyQrg layout
        // 'default' - Standard Parkoreen controls
        // 'hk' - Hollow Knight style controls
        this.keyboardLayout = 'jimmyqrg';
        
        // Code plugin data (triggers and actions)
        this.codeData = {
            triggers: [],
            actions: []
        };
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
    
    renderTeleportalConnections(ctx, camera, time) {
        // Only show connections for teleportals that are acting as portals
        const teleportals = this.objects.filter(obj => obj.type === 'teleportal' && obj.actingType === 'portal');
        
        for (const portal of teleportals) {
            if (!portal.teleportalName) continue;
            
            const portalCenterX = portal.x + portal.width / 2 - camera.x;
            const portalCenterY = portal.y + portal.height / 2 - camera.y;
            
            // Process sendTo connections
            for (const conn of portal.sendTo) {
                const targetName = conn?.name || conn;
                const isEnabled = conn?.enabled !== false;
                if (!targetName || !isEnabled) continue;
                
                const targetPortal = teleportals.find(p => p.teleportalName === targetName);
                if (!targetPortal) continue;
                
                const targetCenterX = targetPortal.x + targetPortal.width / 2 - camera.x;
                const targetCenterY = targetPortal.y + targetPortal.height / 2 - camera.y;
                
                // Check if this is a valid two-way connection (target receives from this portal and is enabled)
                const receiveConn = targetPortal.receiveFrom.find(c => (c?.name || c) === portal.teleportalName);
                const isValid = receiveConn && receiveConn?.enabled !== false;
                
                if (isValid) {
                    // Valid connection: Green glowing line with animated arrows
                    this.renderValidTeleportalConnection(ctx, portalCenterX, portalCenterY, targetCenterX, targetCenterY, time);
                } else {
                    // Invalid send: Red fading arrows going out
                    this.renderInvalidSendConnection(ctx, portalCenterX, portalCenterY, targetCenterX, targetCenterY, time);
                }
            }
            
            // Process receiveFrom connections (only render invalid ones - valid ones already rendered from sender)
            for (const conn of portal.receiveFrom) {
                const sourceName = conn?.name || conn;
                const isEnabled = conn?.enabled !== false;
                if (!sourceName || !isEnabled) continue;
                
                const sourcePortal = teleportals.find(p => p.teleportalName === sourceName);
                if (!sourcePortal) continue;
                
                // Check if source portal sends to this one (and is enabled)
                const sendConn = sourcePortal.sendTo.find(c => (c?.name || c) === portal.teleportalName);
                const isValid = sendConn && sendConn?.enabled !== false;
                
                if (!isValid) {
                    // Invalid receive: Red arrows coming IN to this portal
                    const sourceCenterX = sourcePortal.x + sourcePortal.width / 2 - camera.x;
                    const sourceCenterY = sourcePortal.y + sourcePortal.height / 2 - camera.y;
                    this.renderInvalidReceiveConnection(ctx, sourceCenterX, sourceCenterY, portalCenterX, portalCenterY, time);
                }
            }
        }
    }
    
    renderValidTeleportalConnection(ctx, x1, y1, x2, y2, time) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        // Green line (no shadow for performance)
        ctx.save();
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        
        // Animated arrows along the line
        const arrowCount = Math.max(2, Math.floor(dist / 60));
        const animOffset = (time * 0.001) % 1; // 0 to 1 over 1 second
        
        for (let i = 0; i < arrowCount; i++) {
            const t = ((i / arrowCount) + animOffset) % 1;
            const ax = x1 + dx * t;
            const ay = y1 + dy * t;
            
            this.drawArrowHead(ctx, ax, ay, angle, '#4ade80', 8);
        }
        
        ctx.restore();
    }
    
    renderInvalidSendConnection(ctx, x1, y1, x2, y2, time) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const maxDist = Math.min(dist * 0.4, 80); // Fade out distance
        
        ctx.save();
        
        // Animated arrows that fade out
        const arrowCount = 3;
        const animOffset = (time * 0.002) % 1;
        
        for (let i = 0; i < arrowCount; i++) {
            const t = ((i / arrowCount) + animOffset) % 1;
            const currentDist = t * maxDist;
            const ax = x1 + Math.cos(angle) * currentDist;
            const ay = y1 + Math.sin(angle) * currentDist;
            const opacity = 1 - t;
            
            ctx.globalAlpha = opacity;
            this.drawArrowHead(ctx, ax, ay, angle, '#f87171', 8);
        }
        
        ctx.restore();
    }
    
    renderInvalidReceiveConnection(ctx, x1, y1, x2, y2, time) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const maxDist = Math.min(dist * 0.4, 80);
        
        ctx.save();
        
        // Animated arrows that fade IN toward the receiving portal
        const arrowCount = 3;
        const animOffset = (time * 0.002) % 1;
        
        for (let i = 0; i < arrowCount; i++) {
            const t = ((i / arrowCount) + animOffset) % 1;
            const startDist = dist - maxDist;
            const currentDist = startDist + t * maxDist;
            const ax = x1 + Math.cos(angle) * currentDist;
            const ay = y1 + Math.sin(angle) * currentDist;
            const opacity = t; // Fade IN as they approach
            
            ctx.globalAlpha = opacity;
            this.drawArrowHead(ctx, ax, ay, angle, '#f87171', 8);
        }
        
        ctx.restore();
    }
    
    drawArrowHead(ctx, x, y, angle, color, size) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.6, -size * 0.5);
        ctx.lineTo(-size * 0.6, size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
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
            cameraLerpX: this.cameraLerpX,
            cameraLerpY: this.cameraLerpY,
            // Spike settings
            spikeTouchbox: this.spikeTouchbox,
            dropHurtOnly: this.dropHurtOnly,
            // Export/Import settings
            storedDataType: this.storedDataType,
            // Custom background
            customBackground: this.customBackground,
            // Music
            music: this.music,
            // Plugins
            plugins: this.plugins,
            // Keyboard layout
            keyboardLayout: this.keyboardLayout,
            // Code plugin data
            codeData: this.codeData
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
        this.cameraLerpX = (typeof data.cameraLerpX === 'number' && data.cameraLerpX > 0 && data.cameraLerpX <= 1) ? data.cameraLerpX : CAMERA_LERP_X;
        this.cameraLerpY = (typeof data.cameraLerpY === 'number' && data.cameraLerpY > 0 && data.cameraLerpY <= 1) ? data.cameraLerpY : CAMERA_LERP_Y;
        
        // Spike touchbox mode
        const validSpikeModes = ['full', 'normal', 'tip', 'ground', 'flag', 'air'];
        this.spikeTouchbox = validSpikeModes.includes(data.spikeTouchbox) ? data.spikeTouchbox : 'normal';
        
        // Drop Hurt Only
        this.dropHurtOnly = data.dropHurtOnly === true;
        
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
        
        // Plugins settings - load dynamically without hardcoded defaults
        if (data.plugins) {
            this.plugins = {
                enabled: Array.isArray(data.plugins.enabled) ? data.plugins.enabled : []
            };
            // Copy all plugin configs dynamically
            for (const key of Object.keys(data.plugins)) {
                if (key !== 'enabled' && typeof data.plugins[key] === 'object') {
                    this.plugins[key] = { ...data.plugins[key] };
                }
            }
        }
        
        // Keyboard layout
        const validLayouts = ['default', 'hk', 'jimmyqrg'];
        this.keyboardLayout = validLayouts.includes(data.keyboardLayout) ? data.keyboardLayout : 'jimmyqrg';
        
        // Code plugin data
        if (data.codeData && typeof data.codeData === 'object') {
            this.codeData = {
                triggers: Array.isArray(data.codeData.triggers) ? data.codeData.triggers : [],
                actions: Array.isArray(data.codeData.actions) ? data.codeData.actions : []
            };
        } else {
            this.codeData = { triggers: [], actions: [] };
        }
        
        if (data.objects) {
            for (const objData of data.objects) {
                this.addObject(new WorldObject(objData));
            }
        }
    }
    
    // Check if a plugin is enabled
    hasPlugin(pluginId) {
        return this.plugins.enabled.includes(pluginId);
    }
    
    // Enable a plugin (also enables via PluginManager if available)
    async enablePlugin(pluginId) {
        if (!this.plugins.enabled.includes(pluginId)) {
            this.plugins.enabled.push(pluginId);
        }
        // Also enable in PluginManager to register hooks
        if (window.PluginManager && !window.PluginManager.isEnabled(pluginId)) {
            await window.PluginManager.enablePlugin(pluginId, this);
        }
    }
    
    // Disable a plugin (also disables via PluginManager if available)
    disablePlugin(pluginId) {
        const index = this.plugins.enabled.indexOf(pluginId);
        if (index !== -1) {
            this.plugins.enabled.splice(index, 1);
        }
        // Also disable in PluginManager
        if (window.PluginManager) {
            window.PluginManager.disablePlugin(pluginId, this);
        }
    }
    
    // Get objects using a specific plugin
    getPluginObjects(pluginId) {
        // Returns objects that use features from a specific plugin
        const pluginObjects = [];
        
        if (pluginId === 'hk') {
            // Check for soul status objects
            for (const obj of this.objects) {
                if (obj.actingType === 'soulStatus') {
                    pluginObjects.push({ section: 'Map', name: 'Soul Status', obj });
                }
            }
        }

        return pluginObjects;
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
        
        // Particle system
        this.particles = [];
        
        this.setupCanvas();
        this.setupInput();
        this.audioManager.loadVolumeFromStorage();
    }
    
    // Spawn circular particles (for checkpoint touch effect)
    spawnCheckpointParticles(x, y, color = '#4CAF50') {
        const particleCount = 12;
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 / particleCount) * i + (Math.random() - 0.5) * 0.5;
            const speed = 80 + Math.random() * 60;
            const size = 4 + Math.random() * 4;
            
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: size,
                color: color,
                alpha: 1,
                life: 1,
                decay: 0.02 + Math.random() * 0.01
            });
        }
    }
    
    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 200 * dt; // gravity
            p.life -= p.decay;
            p.alpha = p.life;
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    renderParticles() {
        for (const p of this.particles) {
            const screenX = (p.x - this.camera.x) * this.camera.zoom;
            const screenY = (p.y - this.camera.y) * this.camera.zoom;
            const size = p.size * this.camera.zoom;
            
            this.ctx.save();
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }
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
        
        // Prevent browser zoom via Ctrl+wheel (only in editor/test mode)
        document.addEventListener('wheel', (e) => {
            if ((e.ctrlKey || e.metaKey) && (this.state === GameState.EDITOR || this.state === GameState.TESTING)) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Prevent browser zoom via Ctrl+/- keys (only in editor/test mode)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '_') && 
                (this.state === GameState.EDITOR || this.state === GameState.TESTING)) {
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
        
        // Prevent default for game keys to avoid browser delays
        const gameKeys = ['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyX', 'KeyC', 'KeyF', 'KeyN',
                          'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Comma', 'Period',
                          'ShiftLeft', 'ShiftRight'];
        if (gameKeys.includes(e.code)) {
            e.preventDefault();
        }
        
        this.keys[e.code] = true;
        
        // Let plugins handle keydown
        if (window.PluginManager && this.localPlayer) {
            window.PluginManager.executeHook('input.keydown', { 
                key: e.code, 
                player: this.localPlayer 
            });
        }
        
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
        
        // Let plugins handle keyup
        if (window.PluginManager && this.localPlayer) {
            window.PluginManager.executeHook('input.keyup', { 
                key: e.code, 
                player: this.localPlayer 
            });
        }
        
        if (this.localPlayer) {
            this.updatePlayerInput();
        }
    }

    updatePlayerInput() {
        if (!this.localPlayer) return;
        
        // Get keyboard layout (only applies in play/test mode)
        const inGameMode = this.state === GameState.PLAYING || this.state === GameState.TESTING;
        const layout = inGameMode ? (this.world?.keyboardLayout || 'jimmyqrg') : 'jimmyqrg';
        
        // Define keyboard layouts
        const layouts = {
            default: {
                left: this.keys['KeyA'] || this.keys['ArrowLeft'],
                right: this.keys['KeyD'] || this.keys['ArrowRight'],
                up: this.keys['KeyW'] || this.keys['ArrowUp'],
                down: this.keys['KeyS'] || this.keys['ArrowDown'],
                jump: this.keys['Space'] || this.keys['KeyW'] || this.keys['ArrowUp'],
                shift: this.keys['ShiftLeft'] || this.keys['ShiftRight'],
                // Plugin inputs (no conflicts with movement)
                attack: this.keys['KeyX'],
                heal: this.keys['KeyF'],
                dash: this.keys['Comma'],
                superDash: this.keys['Period']
            },
            hk: {
                // Hollow Knight Original layout (requires HK plugin)
                left: this.keys['ArrowLeft'],
                right: this.keys['ArrowRight'],
                up: this.keys['ArrowUp'],
                down: this.keys['ArrowDown'],
                jump: this.keys['KeyZ'],
                shift: this.keys['ShiftLeft'] || this.keys['ShiftRight'],
                // Plugin inputs
                attack: this.keys['KeyX'],
                heal: this.keys['KeyA'],
                dash: this.keys['KeyC'],
                superDash: this.keys['KeyS']
            },
            jimmyqrg: {
                // JimmyQrg custom layout
                left: this.keys['KeyA'],
                right: this.keys['KeyD'],
                up: this.keys['ArrowUp'],
                down: this.keys['ArrowDown'],
                jump: this.keys['KeyW'],
                shift: this.keys['ShiftLeft'] || this.keys['ShiftRight'],
                // Plugin inputs
                attack: this.keys['KeyN'],
                heal: this.keys['ShiftLeft'],
                dash: this.keys['Comma'],
                superDash: this.keys['KeyF']
            }
        };
        
        const keymap = layouts[layout] || layouts.default;
        
        this.localPlayer.input.left = keymap.left;
        this.localPlayer.input.right = keymap.right;
        this.localPlayer.input.up = keymap.up;
        this.localPlayer.input.down = keymap.down;
        this.localPlayer.input.jump = keymap.jump;
        this.localPlayer.input.shift = keymap.shift;
        
        // Store plugin inputs for plugins to use
        this.localPlayer.input.attack = keymap.attack;
        this.localPlayer.input.heal = keymap.heal;
        this.localPlayer.input.dash = keymap.dash;
        this.localPlayer.input.superDash = keymap.superDash;
        
        // Let plugins handle additional input via hooks
        if (window.PluginManager) {
            window.PluginManager.executeHook('input.update', { 
                player: this.localPlayer, 
                keys: this.keys,
                layout: layout
            });
        }
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
        // Ctrl+Scroll zoom only available in editor and test mode
        if ((e.ctrlKey || e.metaKey) && (this.state === GameState.EDITOR || this.state === GameState.TESTING)) {
            e.preventDefault();
            
            // Get the center point for zoom (player position if available, otherwise screen center)
            let centerX, centerY;
            if (this.localPlayer) {
                centerX = this.localPlayer.x + this.localPlayer.width / 2;
                centerY = this.localPlayer.y + this.localPlayer.height / 2;
            } else {
                // Use screen center as fallback
                centerX = this.camera.x + this.camera.width / 2 / this.camera.zoom;
                centerY = this.camera.y + this.camera.height / 2 / this.camera.zoom;
            }
            
            // Ctrl+Shift+Scroll: Reset zoom to default (1.0)
            if (e.shiftKey) {
                this.camera.setZoom(1.0, centerX, centerY);
            } else {
                // Scale zoom amount based on deltaY for smoother trackpad zoom
                // Limit to small increments for smooth zooming
                const zoomAmount = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY) * 0.002, 0.1);
                this.camera.setZoom(this.camera.zoom - zoomAmount, centerX, centerY);
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
        this.accumulator = 0;
        // Fixed timestep: 60 ticks per second
        this.fixedDeltaTime = 1 / 60;
        // Bind once to avoid creating new functions every frame
        this._boundGameLoop = this._boundGameLoop || this.gameLoop.bind(this);
        requestAnimationFrame(this._boundGameLoop);
    }

    stop() {
        this.isRunning = false;
    }

    gameLoop(currentTime) {
        if (!this.isRunning) return;
        
        // Use performance.now() if not provided (first call)
        currentTime = currentTime || performance.now();
        
        let deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        // Cap deltaTime to prevent spiral of death on slow frames
        if (deltaTime > 0.25) deltaTime = 0.25;
        
        // Accumulate time for fixed timestep physics
        this.accumulator += deltaTime;
        
        // Run physics at fixed 60Hz
        while (this.accumulator >= this.fixedDeltaTime) {
            this.update(this.fixedDeltaTime);
            this.accumulator -= this.fixedDeltaTime;
        }
        
        this.render();
        
        requestAnimationFrame(this._boundGameLoop);
    }

    update(deltaTime) {
        if (this.state === GameState.PLAYING || this.state === GameState.TESTING) {
            // Update local player
            if (this.localPlayer) {
                // Let plugins handle pre-update logic via hook
                if (window.PluginManager) {
                    const result = window.PluginManager.executeHook('player.update', {
                        player: this.localPlayer,
                        world: this.world,
                        audioManager: this.audioManager,
                        deltaTime
                    });
                    
                    // Skip normal physics if plugin says so (e.g., during dash)
                    if (!result.skipPhysics) {
                this.localPlayer.update(this.world, this.audioManager);
                    } else {
                        // Plugin is controlling movement - apply velocity with collision checking
                        this.localPlayer.moveWithCollision(this.world);
                    }
                } else {
                    this.localPlayer.update(this.world, this.audioManager);
                }
                
                // Check for die line (void death)
                const dieLineY = this.world.dieLineY ?? 2000;
                if (this.localPlayer.y > dieLineY) {
                    this.localPlayer.die();
                }
                
                // Check for respawn
                if (this.localPlayer.isDead) {
                    this.respawnPlayer();
                    // Let plugins handle post-respawn via hook
                    if (window.PluginManager) {
                        window.PluginManager.executeHook('player.respawn', {
                            player: this.localPlayer,
                            world: this.world
                        });
                    }
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
        
        // Update particles
        this.updateParticles(deltaTime);
        
        this.camera.update(this.world?.cameraLerpX ?? CAMERA_LERP_X, this.world?.cameraLerpY ?? CAMERA_LERP_Y);
    }

    checkSpecialCollisions() {
        if (!this.localPlayer || this.localPlayer.isDead) return;
        
        const playerBox = this.localPlayer.getGroundTouchbox();
        let onCheckpoint = false;
        
        for (const obj of this.world.objects) {
            if (!this.localPlayer.boxIntersects(playerBox, obj)) continue;
            
            if (obj.actingType === 'checkpoint') {
                onCheckpoint = true;
                
                // Spawn particles when checkpoint is first touched
                const wasUntouched = obj.checkpointState === 'default';
                
                // Mark previous checkpoint as touched (blue)
                if (this.lastCheckpoint && this.lastCheckpoint !== obj) {
                    this.lastCheckpoint.checkpointState = 'touched';
                }
                // Mark new checkpoint as active (green)
                obj.checkpointState = 'active';
                this.lastCheckpoint = obj;
                
                // Spawn green particles on first touch
                if (wasUntouched) {
                    const centerX = obj.x + obj.width / 2;
                    const centerY = obj.y + obj.height / 2;
                    this.spawnCheckpointParticles(centerX, centerY, this.world.checkpointActiveColor);
                }
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
        
        // Check for teleportal collisions
        this.checkTeleportalCollisions();
    }
    
    checkTeleportalCollisions() {
        if (!this.localPlayer || this.localPlayer.isDead) return;
        
        // Cooldown to prevent instant re-teleporting
        const now = Date.now();
        if (this.lastTeleportTime && now - this.lastTeleportTime < 500) return;
        
        // Use smaller hurt touchbox for teleportation detection
        const playerBox = this.localPlayer.getHurtTouchbox();
        
        for (const obj of this.world.objects) {
            if (obj.type !== 'teleportal') continue;
            if (obj.actingType !== 'portal') continue; // Only teleport when acting as portal
            if (!obj.teleportalName) continue;
            if (!this.localPlayer.boxIntersects(playerBox, obj)) continue;
            
            // Check if this portal has valid send connections
            for (const conn of obj.sendTo) {
                const targetName = conn?.name || conn;
                const isEnabled = conn?.enabled !== false;
                if (!targetName || !isEnabled) continue;
                
                // Find the target portal (must also be acting as portal)
                const targetPortal = this.world.objects.find(p => 
                    p.type === 'teleportal' && 
                    p.actingType === 'portal' && 
                    p.teleportalName === targetName
                );
                
                if (!targetPortal) continue;
                
                // Check if it's a valid two-way connection (target receives from this portal and is enabled)
                const receiveConn = targetPortal.receiveFrom.find(c => (c?.name || c) === obj.teleportalName);
                const isValid = receiveConn && receiveConn?.enabled !== false;
                
                if (isValid) {
                    // Teleport the player to the target portal
                    const targetX = targetPortal.x + targetPortal.width / 2 - this.localPlayer.width / 2;
                    const targetY = targetPortal.y + targetPortal.height / 2 - this.localPlayer.height / 2;
                    
                    this.localPlayer.x = targetX;
                    this.localPlayer.y = targetY;
                    this.lastTeleportTime = now;
                    
                    // Spawn teleport particles at destination
                    this.spawnTeleportParticles(targetX + this.localPlayer.width / 2, targetY + this.localPlayer.height / 2, obj.color);
                    
                    return; // Only teleport once per frame
                }
            }
        }
    }
    
    spawnTeleportParticles(x, y, color) {
        // Create a burst of particles at teleport destination
        const particleCount = 12;
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const speed = 80 + Math.random() * 40;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.6 + Math.random() * 0.3,
                maxLife: 0.6 + Math.random() * 0.3,
                size: 4 + Math.random() * 4,
                color: color || '#9b59b6'
            });
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
            // Show position in editor and test mode
            const showPosition = this.state === GameState.EDITOR || this.state === GameState.TESTING;
            
            // Remote players
            for (const player of this.remotePlayers.values()) {
                player.render(this.ctx, this.camera, showPosition);
            }
            
            // Local player on top
            if (this.localPlayer) {
                this.localPlayer.render(this.ctx, this.camera, showPosition);
                
                // Let plugins render effects around the player (attack slashes, etc.)
                if (window.PluginManager) {
                    window.PluginManager.executeHook('render.player', {
                        ctx: this.ctx,
                        player: this.localPlayer,
                        camera: this.camera,
                        world: this.world
                    });
                }
            }
        }
        
        // Render objects above player
        this.world.renderAbovePlayer(this.ctx, this.camera, checkpointColors);
        
        // Render zones on top of everything
        this.world.renderZones(this.ctx, this.camera);
        
        // Render teleportal connections (in editor and test mode)
        if (this.state === GameState.EDITOR || this.state === GameState.TESTING) {
            this.world.renderTeleportalConnections(this.ctx, this.camera, Date.now());
        }
        
        // Render editor overlays
        if (this.state === GameState.EDITOR && this.renderEditorOverlay) {
            this.renderEditorOverlay(this.ctx, this.camera);
        }
        
        this.ctx.restore();
        
        // Render particles (after restore to use screen coordinates)
        this.renderParticles();
        
        // Render HUD (HP, Soul) if plugins are enabled
        if (this.state === GameState.PLAYING || this.state === GameState.TESTING) {
            this.renderHUD();
        }
    }
    
    renderHUD() {
        if (!this.localPlayer) return;
        
        // Let plugins render their HUD elements via hook
        if (window.PluginManager) {
            window.PluginManager.executeHook('render.hud', {
                ctx: this.ctx,
                canvas: this.canvas,
                player: this.localPlayer,
                world: this.world,
                xOffset: 20,
                yOffset: 20
            });
        }
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
        
        // Initialize plugins via hook
        if (window.PluginManager) {
            window.PluginManager.executeHook('player.init', { 
                player: this.localPlayer, 
                world: this.world 
            });
        }
        
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
        
        // Initialize plugins via hook
        if (window.PluginManager) {
            window.PluginManager.executeHook('player.init', { 
                player: this.localPlayer, 
                world: this.world 
            });
        }
        
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
