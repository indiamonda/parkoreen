/**
 * PARKOREEN - Game Engine
 * Core game mechanics: physics, player, camera, collisions
 */

// ============================================
// CONSTANTS
// ============================================
const GRID_SIZE = 32;
// Physics: Lower gravity for floatier feel, jump force adjusted to maintain same jump HEIGHT
// Formula: h = v²/(2g), so to keep h constant: v₂ = v₁ * sqrt(g₂/g₁)
// Old: g=0.8, v=-14, h=122.5 | New: g=0.5, v=-13.2
const DEFAULT_GRAVITY = 0.71;
const DEFAULT_JUMP_FORCE = -13.2;
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
        this.sounds.jump = new Audio('/parkoreen/assets/ogg/jump.ogg');
        this.sounds.jump.volume = this.volume;
        this.sounds.coin = new Audio('/parkoreen/assets/ogg/coin.ogg');
        this.sounds.coin.volume = this.volume;
        this.sounds.bounce = new Audio('/parkoreen/assets/ogg/bounce.ogg');
        this.sounds.bounce.volume = this.volume;
        this.sounds.button = new Audio('/parkoreen/assets/ogg/button.ogg');
        this.sounds.button.volume = this.volume;
        this.sounds.checkpoint = new Audio('/parkoreen/assets/ogg/checkpoint.ogg');
        this.sounds.checkpoint.volume = this.volume;
        this.sounds.endpoint = new Audio('/parkoreen/assets/ogg/endpoint.ogg');
        this.sounds.endpoint.volume = this.volume;
        this.sounds.place = new Audio('/parkoreen/assets/ogg/tile.ogg');
        this.sounds.place.volume = this.volume;
        this.sounds.erase = new Audio('/parkoreen/assets/ogg/erase.ogg');
        this.sounds.erase.volume = this.volume;
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
            space: false,
            // Plugin inputs (HK controls)
            attack: false,
            heal: false,
            dash: false,
            superDash: false
        };
        
        // Touchboxes - positioned lower on the player sprite
        // Ground touchbox: used for ground collision (full width for partial ground contact)
        this.groundTouchbox = { x: 0, y: 8, width: PLAYER_SIZE, height: PLAYER_SIZE - 8 };
        // Hurt touchbox: used for spike damage detection (moderately inset from visual)
        this.hurtTouchbox = { x: 4, y: 6, width: PLAYER_SIZE - 8, height: PLAYER_SIZE - 8 };
        
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
        let dx = 0, dy = 0;
        if (this.input.left) dx -= 1;
        if (this.input.right) dx += 1;
        if (this.input.up) dy -= 1;
        if (this.input.down || this.input.shift) dy += 1;
        
        // Normalize so diagonal movement isn't faster
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
            dx /= len;
            dy /= len;
        }
        
        // Space key = 2x speed boost while flying
        const speed = this.input.space ? FLY_SPEED * 2 : FLY_SPEED;
        this.x += dx * speed;
        this.y += dy * speed;
        
        this.vx = 0;
        this.vy = 0;
        
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
        if (this.input.left && this.input.right) {
            // Both pressed - stay in place
            this.vx = 0;
        } else if (this.input.left) {
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
        const maxFallSpeed = 16 * (gravity / DEFAULT_GRAVITY);
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
        }

        // Apply movement with collision
        this.moveWithCollision(world, editorMode);
    }

    moveWithCollision(world, editorMode = false) {
        const CORNER_TOLERANCE = 6;

        // Move horizontally
        this.x += this.vx;
        
        // Check horizontal collisions
        const hCollisions = this.checkCollisions(world, 'horizontal');
        for (const obj of hCollisions) {
            if (obj.collision) {
                // Corner correction: if player barely clips a block vertically,
                // nudge them into an adjacent gap instead of stopping
                if (this._tryCornerNudgeVertical(obj, world, CORNER_TOLERANCE)) continue;

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
                // Corner correction: nudge horizontally into an adjacent gap
                if (this._tryCornerNudgeHorizontal(obj, world, CORNER_TOLERANCE)) continue;

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

    _hasBlockAt(world, x, y) {
        if (!this._blockCheckBox) this._blockCheckBox = { x: 0, y: 0, width: GRID_SIZE - 2, height: GRID_SIZE - 2 };
        this._blockCheckBox.x = x + 1;
        this._blockCheckBox.y = y + 1;
        const near = world.queryNear(x + 1, y + 1, GRID_SIZE - 2, GRID_SIZE - 2);
        for (let i = 0; i < near.length; i++) {
            const o = near[i];
            if (!o.collision || o.actingType === 'spike' || o.actingType === 'text' || o.type === 'teleportal') continue;
            if (o.type === 'spinner' || o.appearanceType === 'spinner') continue;
            if (this.boxIntersects(this._blockCheckBox, o)) return true;
        }
        return false;
    }

    _tryCornerNudgeVertical(obj, world, tolerance) {
        const box = this.getGroundTouchbox();
        const overlapTop = box.y + box.height - obj.y;
        const overlapBottom = obj.y + obj.height - box.y;

        if (overlapTop > 0 && overlapTop <= tolerance) {
            // Player's bottom clips the top edge of the block — try nudging up
            const gapY = obj.y - GRID_SIZE;
            if (!this._hasBlockAt(world, obj.x, gapY)) {
                this.y -= overlapTop;
                return true;
            }
        } else if (overlapBottom > 0 && overlapBottom <= tolerance) {
            // Player's top clips the bottom edge — try nudging down
            const gapY = obj.y + obj.height;
            if (!this._hasBlockAt(world, obj.x, gapY)) {
                this.y += overlapBottom;
                return true;
            }
        }
        return false;
    }

    _tryCornerNudgeHorizontal(obj, world, tolerance) {
        const box = this.getGroundTouchbox();
        const overlapLeft = box.x + box.width - obj.x;
        const overlapRight = obj.x + obj.width - box.x;

        if (overlapLeft > 0 && overlapLeft <= tolerance) {
            // Player's right clips the left edge — try nudging left
            const gapX = obj.x - GRID_SIZE;
            if (!this._hasBlockAt(world, gapX, obj.y)) {
                this.x -= overlapLeft;
                return true;
            }
        } else if (overlapRight > 0 && overlapRight <= tolerance) {
            // Player's left clips the right edge — try nudging right
            const gapX = obj.x + obj.width;
            if (!this._hasBlockAt(world, gapX, obj.y)) {
                this.x += overlapRight;
                return true;
            }
        }
        return false;
    }

    checkCollisions(world, direction) {
        if (!this._collisionsH) { this._collisionsH = []; this._collisionsV = []; }
        const collisions = direction === 'horizontal' ? this._collisionsH : this._collisionsV;
        collisions.length = 0;
        const box = this.getGroundTouchbox();
        const worldSpikeMode = world?.spikeTouchbox || 'normal';
        
        const nearby = world.queryNear(box.x - 2, box.y - 2, box.width + 4, box.height + 4);
        for (let ni = 0; ni < nearby.length; ni++) {
            const obj = nearby[ni];
            if (!obj.collision) continue;
            if (obj.actingType === 'text') continue;
            if (obj.type === 'teleportal') continue;
            
            // Spinners (saw blades) acting as spikes have no ground collision
            // They only damage - player should not stand on them
            if ((obj.type === 'spinner' || obj.appearanceType === 'spinner') && obj.actingType === 'spike') {
                continue;
            }
            
            // Handle spike collision based on mode
            if (obj.actingType === 'spike') {
                const spikeMode = obj.spikeTouchbox || worldSpikeMode;
                
                // In 'air' mode, spikes have no collision at all
                if (spikeMode === 'air') continue;
                
                // In 'full' or 'all-spike' mode, spikes only damage, no ground collision
                if (spikeMode === 'full' || spikeMode === 'all-spike') continue;
                
                // Only the flat base of the spike is solid ground.
                // The pointy part must let the player through so they can take damage.
                // The flat part only acts as a floor/ceiling (vertical), never as a wall (horizontal).
                // Skip flat collision entirely if a solid block is adjacent on the flat side.
                if (this.boxIntersects(box, obj)) {
                    if (spikeMode === 'ground') {
                        collisions.push(obj);
                    } else if (direction === 'vertical' && !this._spikeHasAdjacentBlock(obj, world)) {
                        const flatBox = this.getSpikeFlat(obj);
                        if (this.boxIntersects(box, flatBox)) {
                            if (!this._flatCollision) this._flatCollision = { collision: true };
                            this._flatCollision.x = flatBox.x;
                            this._flatCollision.y = flatBox.y;
                            this._flatCollision.width = flatBox.width;
                            this._flatCollision.height = flatBox.height;
                            this._flatCollision.collision = obj.collision;
                            collisions.push(this._flatCollision);
                        }
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
        if (GameEngine._invincible) return;
        
        const hurtBox = this.getHurtTouchbox();
        const worldSpikeMode = world?.spikeTouchbox || 'normal';
        const dropHurtOnly = world?.dropHurtOnly || false;
        
        const nearby = world.queryNear(hurtBox.x - 2, hurtBox.y - 2, hurtBox.width + 4, hurtBox.height + 4);
        for (let ni = 0; ni < nearby.length; ni++) {
            const obj = nearby[ni];
            if (obj.actingType !== 'spike' || obj.collision === false) continue;
            {
                let gotHit = false;
                
                // Spinners (saw blades) use circular hitbox slightly smaller than visual
                if (obj.type === 'spinner' || obj.appearanceType === 'spinner') {
                    const cx = obj.x + obj.width / 2;
                    const cy = obj.y + obj.height / 2;
                    const r = Math.min(obj.width, obj.height) / 2 * 0.82;
                    if (this.circleIntersectsBox(cx, cy, r, hurtBox)) {
                        gotHit = true;
                    }
                } else {
                    // Regular spike - apply touchbox modes
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
                    
                    // In 'full' mode, any contact with spike = damage
                    if (spikeMode === 'full') {
                        if (this.boxIntersects(hurtBox, obj)) {
                            gotHit = true;
                        }
                    }
                    
                    // In 'all-spike' mode, danger zone AND flat base both damage (no safe ground)
                    if (spikeMode === 'all-spike') {
                        const dangerBox = this.getSpikeDanger(obj);
                        const flatBox = this.getSpikeFlat(obj);
                        if (this.boxIntersects(hurtBox, dangerBox) || this.boxIntersects(hurtBox, flatBox)) {
                            gotHit = true;
                        }
                    }
                    
                    // In 'normal' mode, danger zone damages (between visual tip and flat base)
                    if (spikeMode === 'normal') {
                        const dangerBox = this.getSpikeDanger(obj);
                        if (this.boxIntersects(hurtBox, dangerBox)) {
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
    
    getSpikeFlat(spike) {
        const r = spike.rotation || 0;
        const fd = spike.height * 0.22;
        const b = this._spikeFlat || (this._spikeFlat = { x: 0, y: 0, width: 0, height: 0 });
        if (r === 0 || (r !== 90 && r !== 180 && r !== 270)) {
            b.x = spike.x; b.y = spike.y + spike.height - fd; b.width = spike.width; b.height = fd;
        } else if (r === 90) {
            b.x = spike.x; b.y = spike.y; b.width = fd; b.height = spike.height;
        } else if (r === 180) {
            b.x = spike.x; b.y = spike.y; b.width = spike.width; b.height = fd;
        } else {
            b.x = spike.x + spike.width - fd; b.y = spike.y; b.width = fd; b.height = spike.height;
        }
        return b;
    }

    _spikeHasAdjacentBlock(spike, world) {
        const r = spike.rotation || 0;
        const probe = 2;
        if (!this._adjProbe) this._adjProbe = { x: 0, y: 0, width: 0, height: 0 };
        const p = this._adjProbe;
        // Probe a thin strip on the outside of the flat side
        if (r === 0 || (r !== 90 && r !== 180 && r !== 270)) {
            // tip up, flat at bottom → probe below
            p.x = spike.x; p.y = spike.y + spike.height; p.width = spike.width; p.height = probe;
        } else if (r === 90) {
            // tip right, flat at left → probe to the left
            p.x = spike.x - probe; p.y = spike.y; p.width = probe; p.height = spike.height;
        } else if (r === 180) {
            // tip down, flat at top → probe above
            p.x = spike.x; p.y = spike.y - probe; p.width = spike.width; p.height = probe;
        } else {
            // tip left, flat at right → probe to the right
            p.x = spike.x + spike.width; p.y = spike.y; p.width = probe; p.height = spike.height;
        }
        const near = world.queryNear(p.x, p.y, p.width, p.height);
        for (let i = 0; i < near.length; i++) {
            const o = near[i];
            if (o === spike) continue;
            if (!o.collision) continue;
            if (o.actingType === 'spike' || o.actingType === 'text' || o.type === 'teleportal') continue;
            if (o.type === 'spinner' || o.appearanceType === 'spinner') continue;
            if (this.boxIntersects(p, o)) return true;
        }
        return false;
    }

    getSpikeDanger(spike) {
        const r = spike.rotation || 0;
        const w = spike.width;
        const h = spike.height;
        // Danger zone sits near the flat base of the spike.
        // Flat zone is 22% from base (78%-100%). Danger spans 58%-86%.
        const dangerStart = 0.58;
        const dangerLen = 0.28;
        const b = this._spikeDanger || (this._spikeDanger = { x: 0, y: 0, width: 0, height: 0 });
        if (r === 0 || (r !== 90 && r !== 180 && r !== 270)) {
            b.x = spike.x; b.y = spike.y + h * dangerStart; b.width = w; b.height = h * dangerLen;
        } else if (r === 90) {
            b.x = spike.x + w * (1 - dangerStart - dangerLen); b.y = spike.y; b.width = w * dangerLen; b.height = h;
        } else if (r === 180) {
            b.x = spike.x; b.y = spike.y + h * (1 - dangerStart - dangerLen); b.width = w; b.height = h * dangerLen;
        } else {
            b.x = spike.x + w * dangerStart; b.y = spike.y; b.width = w * dangerLen; b.height = h;
        }
        return b;
    }
    
    getSpikeTip(spike) {
        const r = spike.rotation || 0;
        const td = spike.height * 0.1;
        const tw = spike.width * 0.3;
        const b = this._spikeTip || (this._spikeTip = { x: 0, y: 0, width: 0, height: 0 });
        if (r === 0 || (r !== 90 && r !== 180 && r !== 270)) {
            b.x = spike.x + spike.width * 0.35; b.y = spike.y; b.width = tw; b.height = td;
        } else if (r === 90) {
            b.x = spike.x + spike.width - td; b.y = spike.y + spike.height * 0.35; b.width = td; b.height = tw;
        } else if (r === 180) {
            b.x = spike.x + spike.width * 0.35; b.y = spike.y + spike.height - td; b.width = tw; b.height = td;
        } else {
            b.x = spike.x; b.y = spike.y + spike.height * 0.35; b.width = td; b.height = tw;
        }
        return b;
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
        // Reuse cached object to avoid GC pressure in hot collision loops
        if (!this._groundBox) this._groundBox = { x: 0, y: 0, width: 0, height: 0 };
        this._groundBox.x = this.x + this.groundTouchbox.x;
        this._groundBox.y = this.y + this.groundTouchbox.y;
        this._groundBox.width = this.groundTouchbox.width;
        this._groundBox.height = this.groundTouchbox.height;
        return this._groundBox;
    }

    getHurtTouchbox() {
        if (!this._hurtBox) this._hurtBox = { x: 0, y: 0, width: 0, height: 0 };
        this._hurtBox.x = this.x + this.hurtTouchbox.x;
        this._hurtBox.y = this.y + this.hurtTouchbox.y;
        this._hurtBox.width = this.hurtTouchbox.width;
        this._hurtBox.height = this.hurtTouchbox.height;
        return this._hurtBox;
    }

    boxIntersects(a, b) {
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    }

    circleIntersectsBox(cx, cy, r, box) {
        const closestX = Math.max(box.x, Math.min(cx, box.x + box.width));
        const closestY = Math.max(box.y, Math.min(cy, box.y + box.height));
        const dx = cx - closestX;
        const dy = cy - closestY;
        return dx * dx + dy * dy <= r * r;
    }

    resetJumps() {
            this.jumpsRemaining = this.maxJumps;
        this.coyoteTimeStart = null;
        if (window.PluginManager) {
            if (!this._landData) this._landData = {};
            this._landData.player = this;
            window.PluginManager.executeHook('player.land', this._landData);
        }
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
        
        ctx.fillStyle = this.color;
        ctx.fillRect(screenX, screenY, this.width, this.height);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(screenX + this.width - 4, screenY + 4, 4, this.height - 4);
        ctx.fillRect(screenX + 4, screenY + this.height - 4, this.width - 4, 4);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(screenX, screenY, this.width - 4, 4);
        ctx.fillRect(screenX, screenY, 4, this.height - 4);
        
        // Cache font strings to avoid per-frame string concatenation + font parsing
        if (!this._cachedFonts) {
            const scale = (typeof Settings !== 'undefined' && Settings.get('fontSize')) ? Settings.get('fontSize') / 100 : 1;
            this._cachedFonts = {
                pos: `${Math.round(16 * scale)}px "Parkoreen Game", sans-serif`,
                name: `${Math.round(14 * scale)}px "Parkoreen Game", sans-serif`,
                nameOffsetY: Math.round(16 * scale)
            };
        }
        
        ctx.save();
        ctx.textAlign = 'center';
        
        if (showPosition) {
            const posText = `(${Math.round(this.x)}, ${Math.round(this.y)})`;
            const tx = screenX + this.width / 2;
            ctx.font = this._cachedFonts.pos;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillText(posText, tx + 1, screenY - 9);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillText(posText, tx, screenY - 10);
        }
        
        const nameY = screenY + this.height + this._cachedFonts.nameOffsetY;
        const nameX = screenX + this.width / 2;
        ctx.font = this._cachedFonts.name;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillText(this.name, nameX + 1, nameY + 1);
        ctx.fillStyle = 'white';
        ctx.fillText(this.name, nameX, nameY);
        ctx.restore();
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
        this.defaultZoom = 1.5; // Default zoom level (1.5x zoomed in)
        this.zoom = this.defaultZoom;
        this.minZoom = 0.5; // Can zoom out to 0.5x in editor/test
        this.maxZoom = 4; // Can zoom in to 4x
    }
    
    // Set zoom limits based on game mode
    setZoomLimits(mode) {
        if (mode === 'editor') {
            this.minZoom = 0.5;
            this.maxZoom = 4;
        } else {
            // Test/Play: zoom is locked to default
            this.minZoom = this.defaultZoom;
            this.maxZoom = this.defaultZoom;
        }
        // Clamp current zoom to new limits
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));
    }
    
    // Reset zoom to default
    resetZoom() {
        this.zoom = this.defaultZoom;
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
        this.image.src = '/parkoreen/assets/svg/spike-512x.svg';
    }
};

const PortalImage = {
    image: null,
    loaded: false,
    load() {
        if (this.image) return;
        this.image = new Image();
        this.image.onload = () => { this.loaded = true; };
        this.image.src = '/parkoreen/assets/svg/portal-512x.svg';
    }
};

const SpinnerImage = {
    image: null,
    loaded: false,
    load() {
        if (this.image) return;
        this.image = new Image();
        this.image.onload = () => { this.loaded = true; };
        this.image.src = 'assets/svg/spinner.svg';
    }
};

const CoinImage = {
    image: null,
    loaded: false,
    load() {
        if (this.image) return;
        this.image = new Image();
        this.image.onload = () => { this.loaded = true; };
        this.image.src = '/parkoreen/assets/svg/coin.svg';
    }
};

const BouncerImage = {
    image: null,
    loaded: false,
    load() {
        if (this.image) return;
        this.image = new Image();
        this.image.onload = () => { this.loaded = true; };
        this.image.src = '/parkoreen/assets/svg/bouncer.svg';
    }
};

// Block Textures
const BlockTextures = {
    brick: {
        image: null,
        loaded: false,
        load() {
            if (this.image) return;
            this.image = new Image();
            this.image.onload = () => { this.loaded = true; };
            this.image.src = 'assets/svg/block-brick-pattern.svg';
        }
    }
};

/**
 * Repeating block texture fill in rectangle (x,y,w,h) in screen space.
 * Must translate + clip then fill: patterns repeat from the canvas origin unless
 * the coordinate system is moved so the tile phase follows the block.
 */
function fillBlockSurfaceTexture(ctx, textureKey, x, y, w, h) {
    const tex = BlockTextures[textureKey];
    if (!tex?.loaded || !tex.image) return;
    if (!tex._pattern) {
        tex._pattern = ctx.createPattern(tex.image, 'repeat');
    }
    const pattern = tex._pattern;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
}

const CloudImages = {
    images: [],
    loaded: false,
    _loadCount: 0,
    /** Must match numbered files assets/svg/cloud1.svg … cloud{N}.svg */
    _total: 9,
    load() {
        if (this.images.length) return;
        for (let i = 1; i <= this._total; i++) {
            const img = new Image();
            img.onload = () => {
                this._loadCount++;
                if (this._loadCount >= this._total) this.loaded = true;
            };
            img.src = `assets/svg/cloud${i}.svg`;
            this.images.push(img);
        }
    }
};

// Load images immediately
SpikeImage.load();
PortalImage.load();
SpinnerImage.load();
CoinImage.load();
BouncerImage.load();
BlockTextures.brick.load();
CloudImages.load();

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
        this.texture = config.texture || 'solid'; // solid, brick, etc.
        
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

        // Bouncer-specific properties
        this.bouncerStrength = config.bouncerStrength !== undefined ? config.bouncerStrength : 20;
        const legacyBouncerRotation = ((config.rotation || 0) % 360 + 360) % 360;
        const hasBouncerDirection = config.bouncerDirection !== undefined;
        const hasBouncerAppearanceDirection = config.bouncerAppearanceDirection !== undefined;
        this.bouncerDirection = hasBouncerDirection
            ? config.bouncerDirection
            : (config.appearanceType === 'bouncer' ? legacyBouncerRotation : 0); // 0=up, 90=right, 180=down, 270=left
        this.bouncerMatchAppearance = config.bouncerMatchAppearance !== undefined ? config.bouncerMatchAppearance : true;
        this.bouncerAppearanceDirection = hasBouncerAppearanceDirection
            ? config.bouncerAppearanceDirection
            : (config.appearanceType === 'bouncer' ? legacyBouncerRotation : this.bouncerDirection);

        // Legacy maps may store bouncer orientation in generic rotation only.
        if (config.appearanceType === 'bouncer' && !hasBouncerDirection && !hasBouncerAppearanceDirection && legacyBouncerRotation !== 0) {
            this.rotation = 0;
        }

        // Coin-specific properties
        this.coinAmount = config.coinAmount !== undefined ? config.coinAmount : 1;
        this.coinActivityScope = config.coinActivityScope || 'global'; // 'global' | 'player'
        if (this.appearanceType === 'coin') {
            const coinSeed = this._stableSeedFromString(this.id || `${this.x},${this.y}`);
            this._bobOffset = (coinSeed % 6283) / 1000; // 0..~2PI
            this._bobFlowDiv = 320 + (coinSeed % 240); // lower = faster bob
            this._bobAmplitude = 3 + ((coinSeed >> 6) % 21) / 10; // 3.0..5.0
        }

        // Damage amount (for spikes and spinners)
        this.damageAmount = config.damageAmount !== undefined ? config.damageAmount : 1;

        // Spinner-specific properties
        this.spinSpeed = config.spinSpeed !== undefined ? config.spinSpeed : 1;
        this.spinDirection = config.spinDirection !== undefined ? config.spinDirection : 1; // 1=clockwise, -1=counter-clockwise

        // Button-specific properties
        this.displayName = config.displayName || '';
        this.displayDescription = config.displayDescription || '';
        this.buttonVisible = config.buttonVisible !== undefined ? config.buttonVisible : true;
        this.buttonWidth = config.buttonWidth || null;
        this.buttonHeight = config.buttonHeight || null;
        this.buttonInteraction = config.buttonInteraction || 'click'; // 'click' | 'collide'
        this.buttonOnlyOnce = config.buttonOnlyOnce !== undefined ? config.buttonOnlyOnce : false;
        this.buttonColor2 = config.buttonColor2 || '#CFCFCF';

        // Teleportal-specific properties
        this.teleportalName = config.teleportalName || null;
        // sendTo/receiveFrom: Array of {name, enabled} objects (backward compatible with string arrays)
        this.sendTo = (config.sendTo || []).map(item => 
            typeof item === 'string' ? { name: item, enabled: true } : item
        );
        this.receiveFrom = (config.receiveFrom || []).map(item => 
            typeof item === 'string' ? { name: item, enabled: true } : item
        );
        this.particleOpacity = config.particleOpacity !== undefined ? config.particleOpacity : 100;
        
        this.name = config.name || this.getDefaultName();
    }

    generateId() {
        return 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    _stableSeedFromString(str) {
        const text = String(str || 'coin');
        let hash = 2166136261;
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
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
            teleportal: 'Teleportal',
            soulStatue: 'Soul Statue',
            button: 'Button',
            bouncer: 'Bouncer',
            coin: 'Coin'
        };
        return typeNames[this.appearanceType] || 'Object';
    }

    render(ctx, camera, checkpointColors = null) {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;
        const width = this.width;
        const height = this.height;

        const at = this.appearanceType;
        const isSpinner = at === 'spinner' || this.type === 'spinner';

        // Saw blade: editor rotation + spin animation must share one pivot. The generic
        // translate(center)-rotate-translate(-center) wrapper breaks inner translate(center)
        // because nested translates use the already-rotated axes — blade "unpins" from hitbox.
        if (isSpinner) {
            ctx.save();
            if (this.opacity !== 1) ctx.globalAlpha = this.opacity;
            ctx.translate(screenX + width / 2, screenY + height / 2);
            if (this.rotation !== 0) ctx.rotate(this.rotation * Math.PI / 180);
            if (this.flipHorizontal) ctx.scale(-1, 1);
            this.renderSpinner(ctx, width, height, camera);
            ctx.restore();
            return;
        }

        const isBouncer = at === 'bouncer';
        const needsTransform = !isBouncer && (this.rotation !== 0 || this.flipHorizontal);
        const needsAlpha = this.opacity !== 1;
        
        // Only save/restore when we actually change state
        if (needsTransform || needsAlpha) {
            ctx.save();
            if (needsAlpha) ctx.globalAlpha = this.opacity;
            if (needsTransform) {
                ctx.translate(screenX + width / 2, screenY + height / 2);
                if (this.rotation !== 0) ctx.rotate(this.rotation * Math.PI / 180);
                if (this.flipHorizontal) ctx.scale(-1, 1);
                ctx.translate(-(screenX + width / 2), -(screenY + height / 2));
            }
        }

        if (this.type === 'text') {
            this.renderText(ctx, screenX, screenY, width, height);
        } else if (at === 'spike') {
            this.renderSpike(ctx, screenX, screenY, width, height);
        } else if (at === 'checkpoint') {
            this.renderCheckpoint(ctx, screenX, screenY, width, height, checkpointColors);
        } else if (at === 'spawnpoint') {
            this.renderSpawnpoint(ctx, screenX, screenY, width, height);
        } else if (at === 'endpoint') {
            this.renderEndpoint(ctx, screenX, screenY, width, height);
        } else if (at === 'zone') {
            this.renderZone(ctx, screenX, screenY, width, height);
        } else if (at === 'button') {
            this.renderButton(ctx, screenX, screenY, width, height);
        } else if (at === 'bouncer') {
            this.renderBouncer(ctx, screenX, screenY, width, height);
        } else if (at === 'coin') {
            if (!this._collected) this.renderCoin(ctx, screenX, screenY, width, height);
        } else if (at === 'teleportal' || this.type === 'teleportal') {
            this.renderTeleportal(ctx, screenX, screenY, width, height);
        } else if (at === 'soulStatue') {
            const hookData = {
                ctx,
                screenX,
                screenY,
                width,
                height,
                obj: this,
                handled: false
            };
            if (window.PluginManager) {
                window.PluginManager.executeHook('render.soulStatue', hookData);
            }
            if (!hookData.handled) {
                this.renderSoulStatueFallback(ctx, screenX, screenY, width, height);
            }
        } else {
            this.renderBlock(ctx, screenX, screenY, width, height);
        }

        if (needsTransform || needsAlpha) {
            ctx.restore();
        }
    }

    renderBlock(ctx, x, y, w, h) {
        const texture = this.texture || 'solid';
        
        ctx.fillStyle = this.color;
        ctx.fillRect(x, y, w, h);
        
        if (texture !== 'solid' && BlockTextures[texture]?.loaded && BlockTextures[texture]?.image) {
            fillBlockSurfaceTexture(ctx, texture, x, y, w, h);
        } else if (texture === 'solid' && w >= 16 && h >= 16) {
            // Shadow (bottom-right): two rects combined into one beginPath for fewer GPU state flushes
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.beginPath();
            ctx.rect(x + w - 4, y + 4, 4, h - 4);
            ctx.rect(x + 4, y + h - 4, w - 4, 4);
            ctx.fill();
            // Highlight (top-left)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath();
            ctx.rect(x, y, w - 4, 4);
            ctx.rect(x, y, 4, h - 4);
            ctx.fill();
        }
    }

    renderSpike(ctx, x, y, w, h) {
        if (SpikeImage.loaded && SpikeImage.image) {
            const dpr = window.devicePixelRatio || 1;
            const cacheKey = `${this.color}_${w}_${h}_${dpr}`;
            if (this._spikeCacheKey !== cacheKey) {
                const offscreen = document.createElement('canvas');
                offscreen.width = w * dpr;
                offscreen.height = h * dpr;
                const offCtx = offscreen.getContext('2d');
                offCtx.scale(dpr, dpr);
                offCtx.drawImage(SpikeImage.image, 0, 0, w, h);
                offCtx.globalCompositeOperation = 'source-in';
                offCtx.fillStyle = this.color;
                offCtx.fillRect(0, 0, w, h);
                this._spikeCache = offscreen;
                this._spikeCacheKey = cacheKey;
            }
            ctx.drawImage(this._spikeCache, 0, 0, this._spikeCache.width, this._spikeCache.height, x, y, w, h);
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
    
    /** Fallback if no plugin draws soul statue (e.g. HK not loaded) */
    renderSoulStatueFallback(ctx, x, y, w, h) {
        ctx.fillStyle = 'rgba(100, 80, 140, 0.35)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(180, 160, 220, 0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
    }

    _renderSoulStatueWithImage(ctx, x, y, w, h, img) {
        if (img.complete && img.naturalWidth > 0) {
            const imgAspect = img.naturalWidth / img.naturalHeight;
            const boxAspect = w / h;
            
            let drawWidth, drawHeight;
            if (imgAspect > boxAspect) {
                drawWidth = w;
                drawHeight = w / imgAspect;
            } else {
                drawHeight = h;
                drawWidth = h * imgAspect;
            }
            
            // Center within the touchbox
            const drawX = x + (w - drawWidth) / 2;
            const drawY = y + (h - drawHeight) / 2;
            
            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        } else {
            // Fallback: simple placeholder while loading
            ctx.fillStyle = '#3a3a4a';
            ctx.fillRect(x, y, w, h);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(x + w / 2, y + h * 0.3, w * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
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
    
    renderButton(ctx, x, y, w, h) {
        if (!this.buttonVisible) return;

        if (this.buttonInteraction === 'collide') {
            // Pressure-plate appearance — sits at bottom of zone
            const bw = this.buttonWidth || w;
            const plateH = Math.max(10, Math.min(20, h));
            const bx = x + (w - bw) / 2;
            const by = y + h - plateH;

            // Shadow / depth
            ctx.fillStyle = this.buttonColor2 || '#CFCFCF';
            ctx.fillRect(bx + 3, by + 5, bw, plateH);

            // Main surface (rounded top)
            const r = Math.min(4, bw / 6, plateH / 2);
            ctx.beginPath();
            ctx.moveTo(bx + r, by);
            ctx.lineTo(bx + bw - r, by);
            ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
            ctx.lineTo(bx + bw, by + plateH);
            ctx.lineTo(bx, by + plateH);
            ctx.lineTo(bx, by + r);
            ctx.quadraticCurveTo(bx, by, bx + r, by);
            ctx.closePath();
            ctx.fillStyle = this.color || '#F52C2C';
            ctx.fill();

            // Shine strip
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillRect(bx + bw * 0.08, by + 3, bw * 0.84, 3);

            // Raised edge highlight
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(bx, by + plateH);
            ctx.lineTo(bx, by + r);
            ctx.quadraticCurveTo(bx, by, bx + r, by);
            ctx.lineTo(bx + bw - r, by);
            ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
            ctx.lineTo(bx + bw, by + plateH);
            ctx.stroke();

            // Label above the plate
            if (this.displayName) {
                const fontSize = Math.min(13, h * 0.38);
                ctx.font = `bold ${fontSize}px "Parkoreen Game", sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 3;
                ctx.fillStyle = '#fff';
                ctx.fillText(this.displayName, x + w / 2, by - 2);
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';
            }
            return;
        }

        const bw = this.buttonWidth || w;
        const bh = this.buttonHeight || h;
        const bx = x + (w - bw) / 2;
        const by = y + (h - bh) / 2;
        
        // Rounded rectangle fill
        const r = Math.min(8, bw / 4, bh / 4);
        ctx.beginPath();
        ctx.moveTo(bx + r, by);
        ctx.lineTo(bx + bw - r, by);
        ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
        ctx.lineTo(bx + bw, by + bh - r);
        ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
        ctx.lineTo(bx + r, by + bh);
        ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
        ctx.lineTo(bx, by + r);
        ctx.quadraticCurveTo(bx, by, bx + r, by);
        ctx.closePath();
        
        ctx.fillStyle = this.color || '#F52C2C';
        ctx.fill();
        ctx.strokeStyle = this.buttonColor2 || '#CFCFCF';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Display name label
        if (this.displayName) {
            const fontSize = Math.min(14, bh * 0.4);
            ctx.font = `bold ${fontSize}px "Parkoreen Game", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.fillText(this.displayName, bx + bw / 2, by + bh / 2);
        }
    }

    renderCoin(ctx, x, y, w, h) {
        const now = Date.now();
        const bobDiv = this._bobFlowDiv || 400;
        const bobAmp = this._bobAmplitude || 4;
        const bob = Math.sin(now / bobDiv + (this._bobOffset || 0)) * bobAmp;
        const cx = x + w / 2;
        const cy = y + h / 2 + bob;
        const r = Math.min(w, h) * 0.42;

        // Outer glow
        const grd = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.4);
        grd.addColorStop(0, 'rgba(255, 230, 60, 0.35)');
        grd.addColorStop(1, 'rgba(255, 230, 60, 0)');
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        if (CoinImage.loaded && CoinImage.image) {
            const drawSize = Math.min(w, h) * 1.02;
            const drawX = cx - drawSize / 2;
            const drawY = cy - drawSize / 2;
            ctx.drawImage(CoinImage.image, drawX, drawY, drawSize, drawSize);
        } else {
            // Fallback if SVG is not ready yet.
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = this.color || '#FFDD00';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = '#c8960c';
            ctx.lineWidth = Math.max(1.5, r * 0.12);
            ctx.stroke();
        }
    }

    renderBouncer(ctx, x, y, w, h) {
        const color = this.color || '#461A0C';

        // Determine appearance direction
        const appearDir = this.bouncerMatchAppearance !== false
            ? (this.bouncerDirection || 0)
            : (this.bouncerAppearanceDirection || 0);

        // Spring animation: damped oscillation offset.
        let padOffset = 0;
        if (this._bounceAnimStart) {
            const ANIM_DURATION = 700;
            const elapsed = Date.now() - this._bounceAnimStart;
            if (elapsed < ANIM_DURATION) {
                const t = elapsed / 1000; // seconds
                const A = Math.min(h * 0.35, 14) * (this._bounceIntensity || 1);
                padOffset = -A * Math.exp(-5 * t) * Math.sin(18 * t);
            } else {
                this._bounceAnimStart = null;
                this._bounceIntensity = 1;
            }
        }

        const maxUp = h * 0.45;
        const maxDown = h * 0.25;
        padOffset = Math.max(-maxUp, Math.min(maxDown, padOffset));

        const drawOffset = padOffset * 0.3;
        const cx = x + w / 2;
        const cy = y + h / 2;

        if (BouncerImage.loaded && BouncerImage.image) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(appearDir * Math.PI / 180);
            ctx.drawImage(BouncerImage.image, -w / 2, -h / 2 + drawOffset, w, h);
            ctx.restore();
            return;
        }

        // Fallback: simple rect if SVG is not ready yet.
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(appearDir * Math.PI / 180);
        ctx.fillStyle = color;
        ctx.fillRect(-w / 2, -h / 2 + drawOffset, w, h);
        ctx.restore();
    }

    renderTeleportal(ctx, x, y, w, h) {
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        
        if (PortalImage.loaded && PortalImage.image) {
            const dpr = window.devicePixelRatio || 1;
            const cacheKey = `${this.color}_${w}_${h}_${dpr}`;
            if (this._portalCacheKey !== cacheKey) {
                const offscreen = document.createElement('canvas');
                offscreen.width = w * dpr;
                offscreen.height = h * dpr;
                const offCtx = offscreen.getContext('2d');
                offCtx.scale(dpr, dpr);
                offCtx.drawImage(PortalImage.image, 0, 0, w, h);
                offCtx.globalCompositeOperation = 'source-in';
                offCtx.fillStyle = this.color;
                offCtx.fillRect(0, 0, w, h);
                this._portalCache = offscreen;
                this._portalCacheKey = cacheKey;
            }
            ctx.drawImage(this._portalCache, 0, 0, this._portalCache.width, this._portalCache.height, x, y, w, h);
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
    }

    /**
     * Draw saw blade with origin at object center (caller must translate to screen center first).
     */
    renderSpinner(ctx, w, h, camera) {
        // Spin only when the object has 0° editor rotation. Non-zero rotation (e.g. 10°, 20°) is static
        // at that angle — matches design refs: horizontal blade animates at 0°, tilted placements do not spin.
        let rotNorm = Math.round(this.rotation) % 360;
        if (rotNorm < 0) rotNorm += 360;
        const spinAllowedByRotation = rotNorm === 0;

        const screenLeft = this.x - (camera ? camera.x : 0);
        const screenTop = this.y - (camera ? camera.y : 0);

        // Determine if spinning should be active:
        // 1. Not in editor mode
        // 2. Editor rotation is 0° (otherwise show fixed orientation only)
        // 3. Visible on screen (viewport check using camera dimensions and zoom)
        let shouldSpin = !WorldObject._editorMode && spinAllowedByRotation;
        if (shouldSpin && camera) {
            const vpW = camera.width / camera.zoom;
            const vpH = camera.height / camera.zoom;
            if (screenLeft + w < 0 || screenLeft > vpW || screenTop + h < 0 || screenTop > vpH) {
                shouldSpin = false;
            }
        }

        let rotationAngle = 0;
        if (shouldSpin) {
            const spinSpeed = this.spinSpeed || 1;
            const periodMs = 1000 / spinSpeed;
            rotationAngle = ((Date.now() % periodMs) / periodMs) * Math.PI * 2 * (this.spinDirection || 1);
        }
        
        ctx.save();
        if (rotationAngle !== 0) ctx.rotate(rotationAngle);
        
        if (SpinnerImage.loaded && SpinnerImage.image) {
            const dpr = window.devicePixelRatio || 1;
            const cacheKey = `${this.color}_${w}_${h}_${dpr}`;
            if (this._spinnerCacheKey !== cacheKey) {
                const offscreen = document.createElement('canvas');
                offscreen.width = w * dpr;
                offscreen.height = h * dpr;
                const offCtx = offscreen.getContext('2d');
                offCtx.scale(dpr, dpr);
                offCtx.drawImage(SpinnerImage.image, 0, 0, w, h);
                offCtx.globalCompositeOperation = 'source-in';
                offCtx.fillStyle = this.color;
                offCtx.fillRect(0, 0, w, h);
                this._spinnerCache = offscreen;
                this._spinnerCacheKey = cacheKey;
            }
            ctx.drawImage(this._spinnerCache, 0, 0, this._spinnerCache.width, this._spinnerCache.height, -w / 2, -h / 2, w, h);
        } else {
            // Fallback: draw a simple saw blade shape
            const radiusX = w / 2;
            const radiusY = h / 2;
            const teeth = 8;
            
            ctx.fillStyle = this.color;
            ctx.beginPath();
            
            for (let i = 0; i < teeth; i++) {
                const angle1 = (i / teeth) * Math.PI * 2;
                const angle2 = ((i + 0.5) / teeth) * Math.PI * 2;
                
                // Outer point (tooth tip)
                const outerX = Math.cos(angle1) * radiusX;
                const outerY = Math.sin(angle1) * radiusY;
                
                // Inner point (between teeth)
                const innerX = Math.cos(angle2) * radiusX * 0.7;
                const innerY = Math.sin(angle2) * radiusY * 0.7;
                
                if (i === 0) {
                    ctx.moveTo(outerX, outerY);
                } else {
                    ctx.lineTo(outerX, outerY);
                }
                ctx.lineTo(innerX, innerY);
            }
            
            ctx.closePath();
            ctx.fill();
            
            // Center hole
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.ellipse(0, 0, radiusX * 0.15, radiusY * 0.15, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }

    renderText(ctx, x, y, w, h) {
        ctx.textAlign = 'left';
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
        if (this.appearanceType === 'coin') {
            // Coins are smaller than a tile; snap them to tile center instead of tile top-left.
            const gx = Math.round(this.x / GRID_SIZE) * GRID_SIZE;
            const gy = Math.round(this.y / GRID_SIZE) * GRID_SIZE;
            this.x = gx + (GRID_SIZE - this.width) / 2;
            this.y = gy + (GRID_SIZE - this.height) / 2;
            return;
        }
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
            texture: this.texture,
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
            bouncerStrength: this.bouncerStrength,
            bouncerDirection: this.bouncerDirection,
            bouncerMatchAppearance: this.bouncerMatchAppearance,
            bouncerAppearanceDirection: this.bouncerAppearanceDirection,
            coinAmount: this.coinAmount,
            coinActivityScope: this.coinActivityScope,
            spinSpeed: this.spinSpeed,
            displayName: this.displayName,
            displayDescription: this.displayDescription,
            buttonVisible: this.buttonVisible,
            buttonWidth: this.buttonWidth,
            buttonHeight: this.buttonHeight,
            buttonInteraction: this.buttonInteraction,
            buttonOnlyOnce: this.buttonOnlyOnce,
            buttonColor2: this.buttonColor2,
            teleportalName: this.teleportalName,
            sendTo: this.sendTo,
            receiveFrom: this.receiveFrom,
            particleOpacity: this.particleOpacity,
            name: this.name
        };
    }
}
WorldObject._editorMode = true;

// ============================================
// WORLD CLASS
// ============================================
class SpatialHash {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.cells = new Map();
        this._stamp = 0;
    }

    clear() {
        this.cells.clear();
    }

    _key(cx, cy) {
        return (cx * 73856093) ^ (cy * 19349663);
    }

    insert(obj) {
        const cs = this.cellSize;
        const x0 = Math.floor(obj.x / cs);
        const y0 = Math.floor(obj.y / cs);
        const x1 = Math.floor((obj.x + obj.width) / cs);
        const y1 = Math.floor((obj.y + obj.height) / cs);
        for (let cx = x0; cx <= x1; cx++) {
            for (let cy = y0; cy <= y1; cy++) {
                const k = this._key(cx, cy);
                let cell = this.cells.get(k);
                if (!cell) { cell = []; this.cells.set(k, cell); }
                cell.push(obj);
            }
        }
    }

    build(objects) {
        this.clear();
        for (let i = 0; i < objects.length; i++) {
            this.insert(objects[i]);
        }
    }

    query(x, y, w, h) {
        const cs = this.cellSize;
        const x0 = Math.floor(x / cs);
        const y0 = Math.floor(y / cs);
        const x1 = Math.floor((x + w) / cs);
        const y1 = Math.floor((y + h) / cs);
        // Use integer stamp for dedup — avoids Set allocation and hashing overhead
        const stamp = ++this._stamp;
        const result = this._result || (this._result = []);
        result.length = 0;
        for (let cx = x0; cx <= x1; cx++) {
            for (let cy = y0; cy <= y1; cy++) {
                const cell = this.cells.get(this._key(cx, cy));
                if (!cell) continue;
                for (let i = 0; i < cell.length; i++) {
                    const obj = cell[i];
                    if (obj._spatialStamp !== stamp) {
                        obj._spatialStamp = stamp;
                        result.push(obj);
                    }
                }
            }
        }
        return result;
    }
}

class World {
    constructor() {
        this.objects = [];
        this.spatialHash = new SpatialHash(128);
        this._spatialDirty = true;
        // Tile cache for static object rendering (play/test mode)
        this._tileSize = 512;
        this._tiles = new Map();
        this._tileCacheReady = false;
        // Editor merged block cache
        this._editorMergedDirty = true;
        this._editorMergedCache = null;
        // Teleportal list cache
        this._teleportalListDirty = true;
        this._teleportalList = [];
        // Zone/button list cache
        this._zoneListDirty = true;
        this._zoneList = [];
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
        this.defaultPortalColor = '#9b59b6';
        this.defaultBouncerColor = '#461A0C';
        this.showCoinCounter = true;
        
        // Cloud color settings (null = auto based on background)
        this.cloudColorSky = '#ffffff';      // White for sky background
        this.cloudColorGalaxy = '#9382a8';   // Grayish purple for galaxy background

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
        this.dieLineY = 1000; // Y position below which players die (void death)
        
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
        // 'all-spike' - No ground: both danger zone AND flat base damage the player
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
        
        // Code plugin data (triggers and actions)
        this.codeData = {
            triggers: [],
            actions: []
        };
    }

    markSpatialDirty() {
        this._spatialDirty = true;
    }

    markEditorDirty() {
        this._editorMergedDirty = true;
        this._teleportalListDirty = true;
        this._zoneListDirty = true;
    }

    getTeleportals() {
        if (this._teleportalListDirty) {
            this._teleportalList.length = 0;
            for (let i = 0; i < this.objects.length; i++) {
                if (this.objects[i].type === 'teleportal') {
                    this._teleportalList.push(this.objects[i]);
                }
            }
            this._teleportalListDirty = false;
        }
        return this._teleportalList;
    }

    getZones() {
        if (this._zoneListDirty) {
            this._zoneList.length = 0;
            for (let i = 0; i < this.objects.length; i++) {
                const at = this.objects[i].appearanceType;
                if (at === 'zone' || at === 'button') {
                    this._zoneList.push(this.objects[i]);
                }
            }
            this._zoneListDirty = false;
        }
        return this._zoneList;
    }

    rebuildSpatialHash() {
        if (!this._spatialDirty) return;
        this._spatialDirty = false;
        this.spatialHash.build(this.objects);
    }

    queryNear(x, y, w, h) {
        this.rebuildSpatialHash();
        return this.spatialHash.query(x, y, w, h);
    }

    addObject(obj) {
        this.objects.push(obj);
        this._spatialDirty = true;
        this._tileCacheReady = false;
        this._mergedBlockCache = null;
        this._editorMergedDirty = true;
        this._teleportalListDirty = true;
        this._zoneListDirty = true;
        this.updateSpecialPoints();
        return obj;
    }

    removeObject(id) {
        const index = this.objects.findIndex(o => o.id === id);
        if (index !== -1) {
            this.objects.splice(index, 1);
            this._spatialDirty = true;
            this._tileCacheReady = false;
            this._mergedBlockCache = null;
            this._editorMergedDirty = true;
            this._teleportalListDirty = true;
            this._zoneListDirty = true;
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
        this._editorMergedDirty = true;
    }

    clear() {
        this.objects = [];
        this._spatialDirty = true;
        this._editorMergedDirty = true;
        this._teleportalListDirty = true;
        this._zoneListDirty = true;
        this.invalidateTileCache();
        this.spawnPoint = null;
        this.checkpoints = [];
        this.endpoint = null;
    }

    // ---- Block merging (greedy meshing) ----

    _isMergeableBlock(obj) {
        const at = obj.appearanceType;
        if (at !== 'ground') return false;
        if (obj.type !== 'block') return false;
        if (obj.rotation !== 0) return false;
        if (obj.flipHorizontal) return false;
        if (obj.width !== GRID_SIZE || obj.height !== GRID_SIZE) return false;
        if (Math.round(obj.x) % GRID_SIZE !== 0 || Math.round(obj.y) % GRID_SIZE !== 0) return false;
        return true;
    }

    _gridKey(gx, gy) {
        return (gx + 500000) * 1000000 + (gy + 500000);
    }

    _buildMergedBlocks(objects) {
        const mergeable = [];
        const nonMergeable = [];

        for (let i = 0; i < objects.length; i++) {
            const obj = objects[i];
            if (this._isMergeableBlock(obj)) {
                mergeable.push(obj);
            } else {
                nonMergeable.push(obj);
            }
        }

        if (mergeable.length === 0) return { merged: [], nonMerged: nonMergeable };

        const groups = new Map();
        for (let i = 0; i < mergeable.length; i++) {
            const obj = mergeable[i];
            const key = `${obj.color}|${obj.texture || 'solid'}|${obj.opacity}|${obj.layer || 1}`;
            let list = groups.get(key);
            if (!list) { list = []; groups.set(key, list); }
            list.push(obj);
        }

        const merged = [];

        for (const [, blocks] of groups) {
            const grid = new Set();
            for (let i = 0; i < blocks.length; i++) {
                const gx = Math.round(blocks[i].x / GRID_SIZE);
                const gy = Math.round(blocks[i].y / GRID_SIZE);
                grid.add(this._gridKey(gx, gy));
            }

            blocks.sort((a, b) => {
                const ay = Math.round(a.y / GRID_SIZE);
                const by = Math.round(b.y / GRID_SIZE);
                if (ay !== by) return ay - by;
                return Math.round(a.x / GRID_SIZE) - Math.round(b.x / GRID_SIZE);
            });

            const visited = new Set();
            const sample = blocks[0];

            for (let i = 0; i < blocks.length; i++) {
                const startGx = Math.round(blocks[i].x / GRID_SIZE);
                const startGy = Math.round(blocks[i].y / GRID_SIZE);
                const startKey = this._gridKey(startGx, startGy);

                if (visited.has(startKey)) continue;

                let endGx = startGx;
                while (grid.has(this._gridKey(endGx + 1, startGy)) && !visited.has(this._gridKey(endGx + 1, startGy))) {
                    endGx++;
                }

                let endGy = startGy;
                let canExtend = true;
                while (canExtend) {
                    const nextGy = endGy + 1;
                    for (let gx = startGx; gx <= endGx; gx++) {
                        const k = this._gridKey(gx, nextGy);
                        if (!grid.has(k) || visited.has(k)) {
                            canExtend = false;
                            break;
                        }
                    }
                    if (canExtend) endGy = nextGy;
                }

                for (let gy = startGy; gy <= endGy; gy++) {
                    for (let gx = startGx; gx <= endGx; gx++) {
                        visited.add(this._gridKey(gx, gy));
                    }
                }

                merged.push({
                    x: startGx * GRID_SIZE,
                    y: startGy * GRID_SIZE,
                    width: (endGx - startGx + 1) * GRID_SIZE,
                    height: (endGy - startGy + 1) * GRID_SIZE,
                    color: sample.color,
                    texture: sample.texture || 'solid',
                    opacity: sample.opacity,
                    layer: sample.layer || 1
                });
            }
        }

        return { merged, nonMerged: nonMergeable };
    }

    _renderMergedBlock(ctx, x, y, w, h, color, texture, opacity) {
        if (opacity !== 1) {
            ctx.save();
            ctx.globalAlpha = opacity;
        }

        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);

        if (texture !== 'solid' && BlockTextures[texture]?.loaded && BlockTextures[texture]?.image) {
            fillBlockSurfaceTexture(ctx, texture, x, y, w, h);
        } else if (texture === 'solid' && w >= 16 && h >= 16) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(x + w - 4, y + 4, 4, h - 4);
            ctx.fillRect(x + 4, y + h - 4, w - 4, 4);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(x, y, w - 4, 4);
            ctx.fillRect(x, y, 4, h - 4);
        }

        if (opacity !== 1) {
            ctx.restore();
        }
    }

    // ---- Tile cache for static world rendering ----

    _isStaticObject(obj) {
        const at = obj.appearanceType;
        if (at === 'zone' || at === 'button') return false;
        if (at === 'coin') return false;
        if (at === 'checkpoint') return false;
        if (obj.type === 'spinner' || at === 'spinner') return false;
        if (obj.type === 'text') return false;
        return true;
    }

    _isDynamicRenderable(obj) {
        const at = obj.appearanceType;
        if (at === 'zone' || at === 'button') return false;
        return !this._isStaticObject(obj);
    }

    invalidateTileCache() {
        this._tiles.clear();
        this._tileCacheReady = false;
        this._mergedBlockCache = null;
        this._editorMergedDirty = true;
    }

    buildTileCache() {
        this._tiles.clear();
        const ts = this._tileSize;
        const cpColors = {
            default: this.checkpointDefaultColor,
            active: this.checkpointActiveColor,
            touched: this.checkpointTouchedColor
        };

        this._dynamicObjects = [];

        const staticObjects = [];
        for (let i = 0; i < this.objects.length; i++) {
            const obj = this.objects[i];
            if (!this._isStaticObject(obj)) {
                if (this._isDynamicRenderable(obj)) this._dynamicObjects.push(obj);
                continue;
            }
            staticObjects.push(obj);
        }

        const { merged, nonMerged } = this._buildMergedBlocks(staticObjects);
        this._mergedBlockCache = merged;

        const fakeCamera = { x: 0, y: 0, width: ts, height: ts, zoom: 1 };

        const _getTile = (layer, tx, ty) => {
            const key = layer * 67108864 + (tx + 32768) * 65536 + (ty + 32768);
            let tile = this._tiles.get(key);
            if (!tile) {
                tile = document.createElement('canvas');
                tile.width = ts;
                tile.height = ts;
                tile._ctx = tile.getContext('2d');
                this._tiles.set(key, tile);
            }
            return tile;
        };

        for (let i = 0; i < merged.length; i++) {
            const m = merged[i];
            const layer = m.layer;
            const tx0 = Math.floor(m.x / ts);
            const ty0 = Math.floor(m.y / ts);
            const tx1 = Math.floor((m.x + m.width - 1) / ts);
            const ty1 = Math.floor((m.y + m.height - 1) / ts);

            for (let tx = tx0; tx <= tx1; tx++) {
                for (let ty = ty0; ty <= ty1; ty++) {
                    const tile = _getTile(layer, tx, ty);
                    this._renderMergedBlock(
                        tile._ctx,
                        m.x - tx * ts, m.y - ty * ts,
                        m.width, m.height,
                        m.color, m.texture, m.opacity
                    );
                }
            }
        }

        for (let i = 0; i < nonMerged.length; i++) {
            const obj = nonMerged[i];
            const layer = obj.layer || 1;
            const tx0 = Math.floor(obj.x / ts);
            const ty0 = Math.floor(obj.y / ts);
            const tx1 = Math.floor((obj.x + obj.width - 1) / ts);
            const ty1 = Math.floor((obj.y + obj.height - 1) / ts);

            for (let tx = tx0; tx <= tx1; tx++) {
                for (let ty = ty0; ty <= ty1; ty++) {
                    const tile = _getTile(layer, tx, ty);
                    fakeCamera.x = tx * ts;
                    fakeCamera.y = ty * ts;
                    obj.render(tile._ctx, fakeCamera, cpColors);
                }
            }
        }

        this._tileCacheReady = true;
    }

    _tileKey(layer, tx, ty) {
        return layer * 67108864 + (tx + 32768) * 65536 + (ty + 32768);
    }

    renderTiles(ctx, camera, layerArray) {
        const ts = this._tileSize;
        const vLeft = camera.x;
        const vRight = camera.x + camera.width / camera.zoom;
        const vTop = camera.y;
        const vBottom = camera.y + camera.height / camera.zoom;
        const tx0 = Math.floor(vLeft / ts) - 1;
        const ty0 = Math.floor(vTop / ts) - 1;
        const tx1 = Math.floor(vRight / ts) + 1;
        const ty1 = Math.floor(vBottom / ts) + 1;

        for (let li = 0; li < layerArray.length; li++) {
            const layer = layerArray[li];
            for (let tx = tx0; tx <= tx1; tx++) {
                for (let ty = ty0; ty <= ty1; ty++) {
                    const tile = this._tiles.get(this._tileKey(layer, tx, ty));
                    if (tile) {
                        ctx.drawImage(tile, tx * ts - camera.x, ty * ts - camera.y);
                    }
                }
            }
        }
    }

    renderDynamic(ctx, camera, layerArray, checkpointColors) {
        if (!this._dynamicObjects || this._dynamicObjects.length === 0) return;
        const margin = 100;
        const vLeft = camera.x - margin;
        const vRight = camera.x + camera.width / camera.zoom + margin;
        const vTop = camera.y - margin;
        const vBottom = camera.y + camera.height / camera.zoom + margin;

        for (let i = 0; i < this._dynamicObjects.length; i++) {
            const obj = this._dynamicObjects[i];
            const layer = obj.layer || 1;
            let match = false;
            for (let li = 0; li < layerArray.length; li++) {
                if (layerArray[li] === layer) { match = true; break; }
            }
            if (!match) continue;
            if (obj.x + obj.width < vLeft || obj.x > vRight ||
                obj.y + obj.height < vTop || obj.y > vBottom) continue;
            obj.render(ctx, camera, checkpointColors);
        }
    }

    // ---- Standard rendering (editor mode) ----

    _rebuildEditorMergedCache() {
        if (!this._editorMergedDirty && this._editorMergedCache) return;
        this._editorMergedDirty = false;

        const layer0 = [], layer1 = [], layer2 = [];
        for (let i = 0; i < this.objects.length; i++) {
            const obj = this.objects[i];
            const at = obj.appearanceType;
            if (at === 'zone' || at === 'button') continue;
            if (obj.layer === 0) layer0.push(obj);
            else if (obj.layer === 2) layer2.push(obj);
            else layer1.push(obj);
        }

        const r0 = this._buildMergedBlocks(layer0);
        const r1 = this._buildMergedBlocks(layer1);
        const r2 = this._buildMergedBlocks(layer2);

        this._editorMergedCache = {
            merged0: r0.merged, nonMerged0: r0.nonMerged,
            merged1: r1.merged, nonMerged1: r1.nonMerged,
            merged2: r2.merged, nonMerged2: r2.nonMerged
        };
    }

    render(ctx, camera) {
        if (!this._cpColorsEditor) this._cpColorsEditor = {};
        this._cpColorsEditor.default = this.checkpointDefaultColor;
        this._cpColorsEditor.active = this.checkpointActiveColor;
        this._cpColorsEditor.touched = this.checkpointTouchedColor;
        const checkpointColors = this._cpColorsEditor;
        
        const margin = 100;
        const vLeft = camera.x - margin;
        const vRight = camera.x + camera.width / camera.zoom + margin;
        const vTop = camera.y - margin;
        const vBottom = camera.y + camera.height / camera.zoom + margin;
        
        this._rebuildEditorMergedCache();
        const cache = this._editorMergedCache;

        if (!this._zones) this._zones = [];
        this._zones.length = 0;
        for (let i = 0; i < this.objects.length; i++) {
            const obj = this.objects[i];
            const at = obj.appearanceType;
            if (at !== 'zone' && at !== 'button') continue;
            if (obj.x + obj.width < vLeft || obj.x > vRight ||
                obj.y + obj.height < vTop || obj.y > vBottom) continue;
            this._zones.push(obj);
        }

        this._renderMergedLayer(ctx, camera, cache.merged0, cache.nonMerged0, checkpointColors, vLeft, vRight, vTop, vBottom);

        // Layer 1: only render merged blocks here; nonMerged1 is returned to caller
        // so the player renders between layer 1 non-merged objects and layer 2
        for (let i = 0; i < cache.merged1.length; i++) {
            const m = cache.merged1[i];
            if (m.x + m.width < vLeft || m.x > vRight || m.y + m.height < vTop || m.y > vBottom) continue;
            this._renderMergedBlock(ctx, m.x - camera.x, m.y - camera.y, m.width, m.height, m.color, m.texture, m.opacity);
        }

        this._editorMerged2 = cache.merged2;
        this._editorNonMerged2 = cache.nonMerged2;

        return { layers: [cache.nonMerged0, cache.nonMerged1, cache.nonMerged2], checkpointColors };
    }

    _renderMergedLayer(ctx, camera, merged, nonMerged, checkpointColors, vL, vR, vT, vB) {
        for (let i = 0; i < merged.length; i++) {
            const m = merged[i];
            if (m.x + m.width < vL || m.x > vR || m.y + m.height < vT || m.y > vB) continue;
            this._renderMergedBlock(ctx, m.x - camera.x, m.y - camera.y, m.width, m.height, m.color, m.texture, m.opacity);
        }
        for (let i = 0; i < nonMerged.length; i++) {
            const obj = nonMerged[i];
            if (obj.x + obj.width < vL || obj.x > vR || obj.y + obj.height < vT || obj.y > vB) continue;
            obj.render(ctx, camera, checkpointColors);
        }
    }

    renderAbovePlayer(ctx, camera, checkpointColors) {
        const margin = 100;
        const vL = camera.x - margin;
        const vR = camera.x + camera.width / camera.zoom + margin;
        const vT = camera.y - margin;
        const vB = camera.y + camera.height / camera.zoom + margin;

        if (this._editorMerged2) {
            for (let i = 0; i < this._editorMerged2.length; i++) {
                const m = this._editorMerged2[i];
                if (m.x + m.width < vL || m.x > vR || m.y + m.height < vT || m.y > vB) continue;
                this._renderMergedBlock(ctx, m.x - camera.x, m.y - camera.y, m.width, m.height, m.color, m.texture, m.opacity);
            }
        }
        const list = this._editorNonMerged2 || [];
        for (let i = 0; i < list.length; i++) {
            const obj = list[i];
            if (obj.x + obj.width < vL || obj.x > vR || obj.y + obj.height < vT || obj.y > vB) continue;
            obj.render(ctx, camera, checkpointColors);
        }
    }
    
    renderZones(ctx, camera) {
        for (let i = 0; i < this._zones.length; i++) {
            this._zones[i].render(ctx, camera);
        }
    }

    renderVisibleZones(ctx, camera) {
        const zones = this.getZones();
        if (zones.length === 0) return;
        const margin = 100;
        const vLeft = camera.x - margin;
        const vRight = camera.x + camera.width / camera.zoom + margin;
        const vTop = camera.y - margin;
        const vBottom = camera.y + camera.height / camera.zoom + margin;
        for (let i = 0; i < zones.length; i++) {
            const obj = zones[i];
            if (obj.x + obj.width < vLeft || obj.x > vRight ||
                obj.y + obj.height < vTop || obj.y > vBottom) continue;
            obj.render(ctx, camera);
        }
    }
    
    renderTeleportalConnections(ctx, camera, time) {
        const allPortals = this.getTeleportals();
        const portalByName = this._portalByName || (this._portalByName = new Map());
        portalByName.clear();
        if (!this._activePortals) this._activePortals = [];
        this._activePortals.length = 0;
        for (let i = 0; i < allPortals.length; i++) {
            const obj = allPortals[i];
            if (obj.actingType === 'portal' && obj.teleportalName) {
                portalByName.set(obj.teleportalName, obj);
                this._activePortals.push(obj);
            }
        }
        const portals = this._activePortals;
        
        for (const portal of portals) {
            const portalCenterX = portal.x + portal.width / 2 - camera.x;
            const portalCenterY = portal.y + portal.height / 2 - camera.y;
            
            for (const conn of portal.sendTo) {
                const targetName = conn?.name || conn;
                if (!targetName || conn?.enabled === false) continue;
                
                const targetPortal = portalByName.get(targetName);
                if (!targetPortal) continue;
                
                const targetCenterX = targetPortal.x + targetPortal.width / 2 - camera.x;
                const targetCenterY = targetPortal.y + targetPortal.height / 2 - camera.y;
                
                const receiveConn = targetPortal.receiveFrom.find(c => (c?.name || c) === portal.teleportalName);
                const isValid = receiveConn && receiveConn?.enabled !== false;
                
                if (isValid) {
                    this.renderValidTeleportalConnection(ctx, portalCenterX, portalCenterY, targetCenterX, targetCenterY, time);
                } else {
                    this.renderInvalidSendConnection(ctx, portalCenterX, portalCenterY, targetCenterX, targetCenterY, time);
                }
            }
            
            for (const conn of portal.receiveFrom) {
                const sourceName = conn?.name || conn;
                if (!sourceName || conn?.enabled === false) continue;
                
                const sourcePortal = portalByName.get(sourceName);
                if (!sourcePortal) continue;
                
                const sendConn = sourcePortal.sendTo.find(c => (c?.name || c) === portal.teleportalName);
                const isValid = sendConn && sendConn?.enabled !== false;
                
                if (!isValid) {
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
            defaultPortalColor: this.defaultPortalColor,
            defaultBouncerColor: this.defaultBouncerColor,
            showCoinCounter: this.showCoinCounter,
            cloudColorSky: this.cloudColorSky,
            cloudColorGalaxy: this.cloudColorGalaxy,
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
        this.defaultPortalColor = data.defaultPortalColor || '#9b59b6';
        this.defaultBouncerColor = data.defaultBouncerColor || '#461A0C';
        this.showCoinCounter = data.showCoinCounter !== false;
        this.cloudColorSky = data.cloudColorSky || '#ffffff';
        this.cloudColorGalaxy = data.cloudColorGalaxy || '#9382a8';
        this.checkpointDefaultColor = data.checkpointDefaultColor || '#808080';
        this.checkpointActiveColor = data.checkpointActiveColor || '#4CAF50';
        this.checkpointTouchedColor = data.checkpointTouchedColor || '#2196F3';
        this.maxJumps = data.maxJumps || 1;
        this.infiniteJumps = data.infiniteJumps || false;
        this.additionalAirjump = data.additionalAirjump || false;
        this.collideWithEachOther = data.collideWithEachOther !== false;
        this.mapName = data.mapName || 'Untitled Map';
        this.dieLineY = data.dieLineY ?? 1000;
        
        // Physics settings with defaults for backward compatibility
        this.playerSpeed = (typeof data.playerSpeed === 'number' && data.playerSpeed > 0) ? data.playerSpeed : DEFAULT_MOVE_SPEED;
        this.jumpForce = (typeof data.jumpForce === 'number' && data.jumpForce < 0) ? data.jumpForce : DEFAULT_JUMP_FORCE;
        this.gravity = (typeof data.gravity === 'number' && data.gravity > 0) ? data.gravity : DEFAULT_GRAVITY;
        this.cameraLerpX = (typeof data.cameraLerpX === 'number' && data.cameraLerpX > 0 && data.cameraLerpX <= 1) ? data.cameraLerpX : CAMERA_LERP_X;
        this.cameraLerpY = (typeof data.cameraLerpY === 'number' && data.cameraLerpY > 0 && data.cameraLerpY <= 1) ? data.cameraLerpY : CAMERA_LERP_Y;
        
        // Spike touchbox mode
        const validSpikeModes = ['full', 'normal', 'tip', 'ground', 'flag', 'air', 'all-spike'];
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
    
    // Get objects using a specific plugin (metadata from each plugin's plugin.json)
    getPluginObjects(pluginId) {
        if (window.PluginManager) {
            return window.PluginManager.getPluginObjects(pluginId, this);
        }
        return [];
    }
}

// ============================================
// GAME ENGINE CLASS
// ============================================
const GAME_KEYS = new Set([
    'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyX', 'KeyC', 'KeyF', 'KeyN',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Comma', 'Period',
    'ShiftLeft', 'ShiftRight'
]);

class GameEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.world = new World();
        this.camera = new Camera(window.innerWidth, window.innerHeight);
        this.camera.setZoomLimits('editor'); // Start with editor zoom limits
        this.audioManager = new AudioManager();
        
        this.localPlayer = null;
        this.remotePlayers = new Map();
        
        this.state = GameState.EDITOR;
        WorldObject._editorMode = true;
        this.isRunning = false;
        this.lastTime = 0;
        
        // Debug tools
        this.invincibilityEnabled = false;
        this._voidConfirmShowing = false;
        /** `performance.now()` of last void teleport confirm while invincible; null = not in void / reset */
        this._voidInvincibleLastPromptTime = null;
        
        // Editor state
        this.selectedObject = null;
        this.hoveredObject = null;
        
        // Input
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        
        this.touchscreenMode = false;
        
        // Particle system
        this.particles = [];
        this._portalParticles = [];
        this._portalParticleTimer = 0;
        this._walkParticleTimer = 0;
        
        // Cloud system
        this.clouds = [];
        this.cloudsGenerated = false;
        this.cloudTime = 0; // For slow cloud drift
        
        this.setupCanvas();
        this.setupInput();
        this.audioManager.loadVolumeFromStorage();
    }
    
    // Spawn circular particles (for checkpoint touch effect)
    spawnCheckpointParticles(x, y, color = '#4CAF50') {
        const particleCount = 14;
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 / particleCount) * i + (Math.random() - 0.5) * 0.5;
            const speed = 70 + Math.random() * 50;
            const size = 3 + Math.random() * 4;

            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: size,
                color: color,
                alpha: 1,
                life: 1,
                decay: 0.018 + Math.random() * 0.01,
                shape: 'circle'
            });
        }
    }

    spawnWalkParticles(player) {
        if (!player.isOnGround || player.isFlying) return;
        const moving = Math.abs(player.vx) > 0.5;
        if (!moving) return;
        const px = player.x + player.width / 2 + (Math.random() - 0.5) * player.width * 0.6;
        const py = player.y + player.height;
        this.particles.push({
            x: px,
            y: py,
            vx: (Math.random() - 0.5) * 30,
            vy: -(10 + Math.random() * 20),
            size: 2 + Math.random() * 2,
            color: player.color,
            alpha: 0.5,
            life: 0.5 + Math.random() * 0.3,
            decay: 0.04 + Math.random() * 0.02,
            maxAlpha: 0.5,
            shape: 'circle'
        });
    }

    updateParticles(dt) {
        const cam = this.camera;
        const vpL = cam.x - 200;
        const vpR = cam.x + cam.width / cam.zoom + 200;
        const vpT = cam.y - 200;
        const vpB = cam.y + cam.height / cam.zoom + 200;
        let writeIdx = 0;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 200 * dt;
            p.life -= p.decay;
            p.alpha = p.life * (p.maxAlpha !== undefined ? p.maxAlpha : 1);
            if (p.life > 0 && p.x >= vpL && p.x <= vpR && p.y >= vpT && p.y <= vpB) {
                this.particles[writeIdx++] = p;
            }
        }
        this.particles.length = writeIdx;
    }
    
    updatePortalParticles(dt) {
        const pad = GRID_SIZE * 3;
        const cam = this.camera;
        const vpL = cam.x - pad;
        const vpR = cam.x + cam.width / cam.zoom + pad;
        const vpT = cam.y - pad;
        const vpB = cam.y + cam.height / cam.zoom + pad;

        this._portalParticleTimer += dt;
        const spawnInterval = 0.08;

        if (this._portalParticleTimer >= spawnInterval) {
            this._portalParticleTimer -= spawnInterval;

            const portals = this.world.getTeleportals();
            for (let i = 0; i < portals.length; i++) {
                const obj = portals[i];
                const cx = obj.x + obj.width / 2;
                const cy = obj.y + obj.height / 2;
                if (cx + obj.width / 2 < vpL || cx - obj.width / 2 > vpR ||
                    cy + obj.height / 2 < vpT || cy - obj.height / 2 > vpB) continue;

                const radius = Math.min(obj.width, obj.height) * 0.5;
                const angle = Math.random() * Math.PI * 2;
                const dist = radius * (0.6 + Math.random() * 0.5);
                const px = cx + Math.cos(angle) * dist;
                const py = cy + Math.sin(angle) * dist;
                const orbitSpeed = (0.8 + Math.random() * 0.6) * (Math.random() < 0.5 ? 1 : -1);

                this._portalParticles.push({
                    x: px, y: py,
                    cx: cx, cy: cy,
                    angle: Math.atan2(py - cy, px - cx),
                    dist: dist,
                    orbitSpeed: orbitSpeed,
                    driftIn: -8 - Math.random() * 6,
                    size: 1.5 + Math.random() * 2,
                    color: obj.color,
                    life: 1,
                    decay: 0.008 + Math.random() * 0.006,
                    maxAlpha: (obj.particleOpacity !== undefined ? obj.particleOpacity : 100) / 100
                });
            }
        }

        let w = 0;
        for (let i = 0; i < this._portalParticles.length; i++) {
            const p = this._portalParticles[i];
            p.angle += p.orbitSpeed * dt;
            p.dist += p.driftIn * dt;
            if (p.dist < 0) p.dist = 0;
            p.x = p.cx + Math.cos(p.angle) * p.dist;
            p.y = p.cy + Math.sin(p.angle) * p.dist;
            p.life -= p.decay;
            if (p.life > 0) {
                this._portalParticles[w++] = p;
            }
        }
        this._portalParticles.length = w;
    }

    renderPortalParticles() {
        if (this._portalParticles.length === 0) return;
        const ctx = this.ctx;
        const cx = this.camera.x;
        const cy = this.camera.y;
        const zoom = this.camera.zoom;
        let lastColor = '';
        let lastAlpha = -1;
        for (let i = 0; i < this._portalParticles.length; i++) {
            const p = this._portalParticles[i];
            const alpha = p.life * (p.maxAlpha !== undefined ? p.maxAlpha : 1) * 0.7;
            if (alpha !== lastAlpha) { ctx.globalAlpha = alpha; lastAlpha = alpha; }
            if (p.color !== lastColor) { ctx.fillStyle = p.color; lastColor = p.color; }
            const sz = p.size * zoom;
            ctx.fillRect((p.x - cx) * zoom - sz, (p.y - cy) * zoom - sz, sz * 2, sz * 2);
        }
        ctx.globalAlpha = 1;
    }

    renderParticles() {
        if (this.particles.length === 0) return;
        const ctx = this.ctx;
        const cx = this.camera.x;
        const cy = this.camera.y;
        const zoom = this.camera.zoom;
        const TAU = Math.PI * 2;

        // First pass: square particles (fillRect — no path overhead)
        let lastColor = '';
        let lastAlpha = -1;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (p.shape === 'circle') continue;
            if (p.alpha !== lastAlpha) { ctx.globalAlpha = p.alpha; lastAlpha = p.alpha; }
            if (p.color !== lastColor) { ctx.fillStyle = p.color; lastColor = p.color; }
            const size = p.size * zoom;
            ctx.fillRect((p.x - cx) * zoom - size, (p.y - cy) * zoom - size, size * 2, size * 2);
        }

        // Second pass: circle particles — batch all circles of same color+alpha into one path
        lastColor = '';
        lastAlpha = -1;
        let pathOpen = false;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (p.shape !== 'circle') continue;
            if (p.alpha !== lastAlpha || p.color !== lastColor) {
                if (pathOpen) { ctx.fill(); pathOpen = false; }
                if (p.alpha !== lastAlpha) { ctx.globalAlpha = p.alpha; lastAlpha = p.alpha; }
                if (p.color !== lastColor) { ctx.fillStyle = p.color; lastColor = p.color; }
                ctx.beginPath();
                pathOpen = true;
            }
            const size = p.size * zoom;
            ctx.moveTo((p.x - cx) * zoom + size, (p.y - cy) * zoom);
            ctx.arc((p.x - cx) * zoom, (p.y - cy) * zoom, size, 0, TAU);
        }
        if (pathOpen) ctx.fill();
        ctx.globalAlpha = 1;
    }
    
    generateClouds() {
        this.clouds = [];
        if (!CloudImages.loaded) return;

        const numClouds = 10 + Math.floor(Math.random() * 6);

        const screenWidth = this.camera.width / this.camera.zoom;
        const screenHeight = this.camera.height / this.camera.zoom;

        const cloudAreaWidth = screenWidth * 3;
        const cloudAreaHeight = screenHeight * 0.45;

        let lastY = Math.random() * cloudAreaHeight + 15;

        for (let i = 0; i < numClouds; i++) {
            const imgIndex = Math.floor(Math.random() * CloudImages.images.length);
            const img = CloudImages.images[imgIndex];

            const screenX = (i / numClouds) * cloudAreaWidth - cloudAreaWidth / 3 + (Math.random() - 0.5) * 200;

            const yOffset = (50 + Math.random() * 1050) * (Math.random() < 0.5 ? -1 : 1);
            let screenY = lastY + yOffset;
            if (screenY < 15) screenY = 15 + Math.random() * 100;
            if (screenY > cloudAreaHeight) screenY = cloudAreaHeight - Math.random() * 100;
            lastY = screenY;

            const scale = 0.15 + Math.random() * 0.35;

            const normalizedScale = (scale - 0.15) / 0.35;
            const parallaxFactor = 0.15 + normalizedScale * 0.35;

            const opacity = 0.4 + normalizedScale * 0.35;

            const driftSpeed = -(14 + Math.random() * 22);

            this.clouds.push({
                screenX,
                screenY,
                scale,
                imgIndex,
                flipHorizontal: Math.random() < 0.5,
                sourceWidth: img.naturalWidth || img.width,
                sourceHeight: img.naturalHeight || img.height,
                parallaxFactor,
                opacity,
                driftSpeed,
                driftOffset: Math.random() * 5000
            });
        }

        this.clouds.sort((a, b) => a.scale - b.scale);
        this.cloudsGenerated = true;
    }

    renderClouds() {
        const background = this.world?.background;
        if (background === 'custom') return;
        if (!CloudImages.loaded) return;

        if (!this.cloudsGenerated) {
            this.generateClouds();
        }

        this.cloudTime += 1 / 60;

        let cloudColor;
        if (background === 'galaxy') {
            cloudColor = this.world?.cloudColorGalaxy || '#9382a8';
        } else {
            cloudColor = this.world?.cloudColorSky || '#ffffff';
        }

        if (!this._cloudCacheColor || this._cloudCacheColor !== cloudColor) {
            this._cloudCacheColor = cloudColor;
            this._preRenderCloudImages(cloudColor);
        }

        const viewWidth = this.camera.width / this.camera.zoom;
        const viewHeight = this.camera.height / this.camera.zoom;
        const cameraX = this.camera.x;
        const cameraY = this.camera.y;
        const wrapWidth = viewWidth * 3;

        let lastAlpha = -1;
        for (const cloud of this.clouds) {
            const cloudWidth = cloud._cachedWidth;
            const cloudHeight = cloud._cachedHeight;

            const driftX = cloud.driftOffset + this.cloudTime * cloud.driftSpeed;
            const parallaxX = -cameraX * cloud.parallaxFactor;
            const parallaxY = -cameraY * cloud.parallaxFactor;

            let screenX = cloud.screenX + driftX + parallaxX;
            const screenY = cloud.screenY + parallaxY;

            screenX = ((screenX % wrapWidth) + wrapWidth) % wrapWidth - viewWidth * 0.5;

            if (screenY + cloudHeight < -50 || screenY > viewHeight + 50) continue;
            if (screenX + cloudWidth < -50 || screenX > viewWidth + 50) continue;

            if (cloud.opacity !== lastAlpha) { this.ctx.globalAlpha = cloud.opacity; lastAlpha = cloud.opacity; }
            this.ctx.drawImage(cloud._cachedImage, 0, 0, cloud._cachedImage.width, cloud._cachedImage.height, screenX, screenY, cloud._cachedWidth, cloud._cachedHeight);
        }
        this.ctx.globalAlpha = 1;
    }

    _preRenderCloudImages(color) {
        const dpr = window.devicePixelRatio || 1;
        for (const cloud of this.clouds) {
            const w = Math.ceil(cloud.sourceWidth * cloud.scale) + 2;
            const h = Math.ceil(cloud.sourceHeight * cloud.scale) + 2;
            const offscreen = document.createElement('canvas');
            offscreen.width = w * dpr;
            offscreen.height = h * dpr;
            const offCtx = offscreen.getContext('2d');
            offCtx.scale(dpr, dpr);
            const img = CloudImages.images[cloud.imgIndex];
            const sw = img.naturalWidth || img.width;
            const sh = img.naturalHeight || img.height;
            if (cloud.flipHorizontal) {
                offCtx.save();
                offCtx.translate(w, 0);
                offCtx.scale(-1, 1);
                offCtx.drawImage(img, 0, 0, sw, sh, 0, 0, w, h);
                offCtx.restore();
            } else {
                offCtx.drawImage(img, 0, 0, sw, sh, 0, 0, w, h);
            }
            offCtx.globalCompositeOperation = 'source-in';
            offCtx.fillStyle = color;
            offCtx.fillRect(0, 0, w, h);
            cloud._cachedImage = offscreen;
            cloud._cachedWidth = w;
            cloud._cachedHeight = h;
        }
    }

    regenerateClouds() {
        this.cloudsGenerated = false;
        this.cloudTime = 0;
        this._cloudCacheColor = null;
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
        
        // Prevent browser zoom via Ctrl+wheel (use game zoom instead)
        document.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Prevent browser zoom via Ctrl+/- keys (use game zoom instead)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '_')) {
                e.preventDefault();
            }
        });
    }

    resizeCanvas() {
        // Get the actual rendered size of the canvas (accounts for browser zoom)
        const rect = this.canvas.getBoundingClientRect();
        const dpr = 1;

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
        
        // Touch (passive: false to allow preventDefault for placement modes)
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
        
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
        
        if (GAME_KEYS.has(e.code)) {
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
        
        const layout = (typeof Settings !== 'undefined' ? Settings.get('keyboardLayout') : null) || 'jimmyqrg';
        const k = this.keys;
        const inp = this.localPlayer.input;

        if (layout === 'hk') {
            inp.left = k['ArrowLeft'];
            inp.right = k['ArrowRight'];
            inp.up = k['ArrowUp'];
            inp.down = k['ArrowDown'];
            inp.jump = k['KeyZ'];
            inp.shift = k['ShiftLeft'] || k['ShiftRight'];
            inp.attack = k['KeyX'];
            inp.heal = k['KeyA'];
            inp.dash = k['KeyC'];
            inp.superDash = k['KeyS'];
        } else {
            inp.left = k['KeyA'];
            inp.right = k['KeyD'];
            inp.up = k['ArrowUp'];
            inp.down = k['ArrowDown'];
            inp.jump = k['KeyW'] || k['Space'];
            inp.shift = k['ShiftLeft'] || k['ShiftRight'];
            inp.attack = k['KeyN'];
            inp.heal = k['ShiftLeft'];
            inp.dash = k['Comma'];
            inp.superDash = k['KeyF'];
        }
        inp.space = !!k['Space'];

        // Flying always uses WASD regardless of layout
        if (this.localPlayer.isFlying) {
            inp.up = inp.up || k['KeyW'];
            inp.down = inp.down || k['KeyS'];
        }
        
        if (window.PluginManager) {
            if (!this._inputHookData) this._inputHookData = {};
            this._inputHookData.player = this.localPlayer;
            this._inputHookData.keys = k;
            this._inputHookData.layout = layout;
            window.PluginManager.executeHook('input.update', this._inputHookData);
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
        // Ctrl+Scroll zoom available in all modes (limits are set based on mode)
        if (e.ctrlKey || e.metaKey) {
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
            
            // Ctrl+Shift+Scroll: Reset zoom to default
            if (e.shiftKey) {
                this.camera.setZoom(this.camera.defaultZoom, centerX, centerY);
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
            this.mouse.button = 0; // Simulate left click
            
            // Store last touch position for movement calculation
            this._lastTouchX = touch.clientX;
            this._lastTouchY = touch.clientY;
            
            // Prevent scrolling in editor mode
            if (this.state === GameState.EDITOR) {
                e.preventDefault();
            }
            
            // Call editor callback with synthetic mouse event
            if (this.onMouseDownCallback) {
                const syntheticEvent = {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    button: 0,
                    movementX: 0,
                    movementY: 0,
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                };
                this.onMouseDownCallback(syntheticEvent);
            }
        }
    }

    onTouchMove(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const movementX = touch.clientX - (this._lastTouchX || touch.clientX);
            const movementY = touch.clientY - (this._lastTouchY || touch.clientY);
            
            this.mouse.x = touch.clientX;
            this.mouse.y = touch.clientY;
            
            this._lastTouchX = touch.clientX;
            this._lastTouchY = touch.clientY;
            
            // Prevent scrolling in editor mode
            if (this.state === GameState.EDITOR) {
                e.preventDefault();
            }
            
            // Call editor callback with synthetic mouse event
            if (this.onMouseMoveCallback) {
                const syntheticEvent = {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    movementX: movementX,
                    movementY: movementY,
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                };
                this.onMouseMoveCallback(syntheticEvent);
            }
        }
    }

    onTouchEnd(e) {
        this.mouse.down = false;
        
        // Prevent scrolling in editor mode
        if (this.state === GameState.EDITOR) {
            e.preventDefault();
        }
        
        // Call editor callback with synthetic mouse event
        if (this.onMouseUpCallback) {
            const syntheticEvent = {
                clientX: this._lastTouchX || this.mouse.x,
                clientY: this._lastTouchY || this.mouse.y,
                button: 0,
                preventDefault: () => e.preventDefault(),
                stopPropagation: () => e.stopPropagation()
            };
            this.onMouseUpCallback(syntheticEvent);
        }
        
        // Clear last touch position
        this._lastTouchX = null;
        this._lastTouchY = null;
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
            case 'attack':
                this.localPlayer.input.attack = pressed;
                break;
            case 'dash':
                this.localPlayer.input.dash = pressed;
                break;
            case 'heal':
                this.localPlayer.input.heal = pressed;
                break;
        }
    }

    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastTime = null; // Will be set on first frame to match rAF timing
        this.accumulator = 0;
        // Fixed timestep: 60 ticks per second
        this.fixedDeltaTime = 1 / 60;
        // Maximum physics updates per frame to prevent spiral of death
        this.maxUpdatesPerFrame = 3;
        // Bind once to avoid creating new functions every frame
        this._boundGameLoop = this._boundGameLoop || this.gameLoop.bind(this);
        requestAnimationFrame(this._boundGameLoop);
    }

    stop() {
        this.isRunning = false;
    }

    gameLoop(currentTime) {
        if (!this.isRunning) return;
        
        if (this.lastTime === null) {
            this.lastTime = currentTime;
            this._fpsFrames = 0;
            this._fpsTime = currentTime;
            this._fpsDisplay = 0;
            requestAnimationFrame(this._boundGameLoop);
            return;
        }
        
        // FPS tracking
        this._fpsFrames++;
        if (currentTime - this._fpsTime >= 1000) {
            this._fpsDisplay = Math.round(this._fpsFrames * 1000 / (currentTime - this._fpsTime));
            this._fpsFrames = 0;
            this._fpsTime = currentTime;
        }
        
        let deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        if (deltaTime > 0.1) deltaTime = 0.1;
        
        this.accumulator += deltaTime;
        
        const maxAccumulator = this.fixedDeltaTime * this.maxUpdatesPerFrame;
        if (this.accumulator > maxAccumulator) {
            this.accumulator = maxAccumulator;
        }
        
        let updateCount = 0;
        while (this.accumulator >= this.fixedDeltaTime && updateCount < this.maxUpdatesPerFrame) {
            this.update(this.fixedDeltaTime);
            this.accumulator -= this.fixedDeltaTime;
            updateCount++;
        }
        
        this.render();
        
        requestAnimationFrame(this._boundGameLoop);
    }

    update(deltaTime) {
        // Rebuild spatial hash once per update (lazy — only if dirty)
        if (this.world) this.world.rebuildSpatialHash();
        
        const isPlaying = this.state === GameState.PLAYING || this.state === GameState.TESTING;
        
        if (isPlaying) {
            if (this.localPlayer) {
                if (window.PluginManager) {
                    if (!this._updateHookData) this._updateHookData = {};
                    this._updateHookData.player = this.localPlayer;
                    this._updateHookData.world = this.world;
                    this._updateHookData.audioManager = this.audioManager;
                    this._updateHookData.deltaTime = deltaTime;
                    this._updateHookData.skipPhysics = false;
                    const result = window.PluginManager.executeHook('player.update', this._updateHookData);
                    
                    if (!result.skipPhysics) {
                        this.localPlayer.update(this.world, this.audioManager);
                    } else {
                        this.localPlayer.moveWithCollision(this.world);
                    }
                } else {
                    this.localPlayer.update(this.world, this.audioManager);
                }
                
                // Die line check
                const dieLineY = this.world.dieLineY ?? 1000;
                const voidInvinciblePromptIntervalMs = 30000;
                if (this.localPlayer.y > dieLineY) {
                    if (this.invincibilityEnabled) {
                        const now = performance.now();
                        const due =
                            this._voidInvincibleLastPromptTime == null ||
                            now - this._voidInvincibleLastPromptTime >= voidInvinciblePromptIntervalMs;
                        if (due && !this._voidConfirmShowing) {
                            this._voidConfirmShowing = true;
                            const doTP = confirm('You fell into the void. Teleport back?');
                            this._voidConfirmShowing = false;
                            this._voidInvincibleLastPromptTime = performance.now();
                            if (doTP) {
                                this.respawnPlayer();
                                if (window.PluginManager) {
                                    if (!this._respawnData) this._respawnData = {};
                                    this._respawnData.player = this.localPlayer;
                                    this._respawnData.world = this.world;
                                    window.PluginManager.executeHook('player.respawn', this._respawnData);
                                }
                            }
                        }
                    } else if (window.PluginManager) {
                        if (!this._voidSource) this._voidSource = { type: 'void', actingType: 'void' };
                        if (!this._damageData) this._damageData = {};
                        this._damageData.player = this.localPlayer;
                        this._damageData.source = this._voidSource;
                        this._damageData.world = this.world;
                        this._damageData.preventDefault = false;
                        const result = window.PluginManager.executeHook('player.damage', this._damageData);
                        if (!result.preventDefault) {
                            this.localPlayer.die();
                        }
                    } else {
                        this.localPlayer.die();
                    }
                } else {
                    this._voidInvincibleLastPromptTime = null;
                }
                
                // Respawn
                if (this.localPlayer.isDead) {
                    this.respawnPlayer();
                    if (window.PluginManager) {
                        if (!this._respawnData) this._respawnData = {};
                        this._respawnData.player = this.localPlayer;
                        this._respawnData.world = this.world;
                        window.PluginManager.executeHook('player.respawn', this._respawnData);
                    }
                }
                
                this.checkSpecialCollisions();
                this.camera.follow(this.localPlayer);
            }
            
            // Remote player prediction
            for (const player of this.remotePlayers.values()) {
                if (player._adminDragged) continue;
                if (player.lastUpdateTime && player.vx !== undefined) {
                    const timeSinceUpdate = (performance.now() - player.lastUpdateTime) / 1000;
                    if (timeSinceUpdate < 0.2) {
                        const predictedX = player.serverX + player.vx * timeSinceUpdate;
                        const predictedY = player.serverY + player.vy * timeSinceUpdate;
                        player.x += (predictedX - player.x) * 0.2;
                        player.y += (predictedY - player.y) * 0.2;
                    }
                }
            }
            
            // Particles only in play mode
            this.updateParticles(deltaTime);
            this.updatePortalParticles(deltaTime);

            // Walking particles
            if (this.localPlayer && !this.localPlayer.isDead) {
                this._walkParticleTimer += deltaTime;
                if (this._walkParticleTimer >= 0.06) {
                    this._walkParticleTimer = 0;
                    this.spawnWalkParticles(this.localPlayer);
                }
            }
        } else if (this.state === GameState.EDITOR) {
            if (this.localPlayer) {
                if (this.localPlayer.isFlying) {
                    this.localPlayer.updateFlying(this.world, true);
                } else {
                    this.localPlayer.updatePhysics(this.world, null, true);
                    this.checkBouncerCollisions();
                }
                this.camera.follow(this.localPlayer);
            }
        }
        
        this.camera.update(this.world?.cameraLerpX ?? CAMERA_LERP_X, this.world?.cameraLerpY ?? CAMERA_LERP_Y);
    }

    checkSpecialCollisions() {
        if (!this.localPlayer || this.localPlayer.isDead) return;
        
        const playerBox = this.localPlayer.getGroundTouchbox();
        let onCheckpoint = false;
        
        const nearby = this.world.queryNear(playerBox.x, playerBox.y, playerBox.width, playerBox.height);
        for (let ni = 0; ni < nearby.length; ni++) {
            const obj = nearby[ni];
            if (obj.actingType !== 'checkpoint' && obj.actingType !== 'endpoint') continue;
            if (!this.localPlayer.boxIntersects(playerBox, obj)) continue;
            
            if (obj.actingType === 'checkpoint') {
                onCheckpoint = true;

                const wasUntouched = obj.checkpointState === 'default';
                const isNewContact = !this._onCheckpointObj || this._onCheckpointObj !== obj;

                if (this.lastCheckpoint && this.lastCheckpoint !== obj) {
                    this.lastCheckpoint.checkpointState = 'touched';
                }
                obj.checkpointState = 'active';
                this.lastCheckpoint = obj;
                this._onCheckpointObj = obj;

                // Fire checkpoint hook every frame while touching (heals to full HP, etc.)
                if (this.localPlayer && window.PluginManager) {
                    if (!this._cpHookData) this._cpHookData = {};
                    this._cpHookData.player = this.localPlayer;
                    this._cpHookData.world = this.world;
                    this._cpHookData.checkpoint = obj;
                    window.PluginManager.executeHook('player.checkpoint', this._cpHookData);
                }

                if (isNewContact) {
                    const centerX = obj.x + obj.width / 2;
                    const centerY = obj.y + obj.height / 2;
                    this.spawnCheckpointParticles(centerX, centerY, this.world.checkpointActiveColor);
                    if (this.audioManager) this.audioManager.play('checkpoint');
                }
            } else if (obj.actingType === 'endpoint') {
                if (this.audioManager) this.audioManager.play('endpoint');
                this.onGameEnd();
            }
        }
        
        // Clear contact tracking when player leaves all checkpoints
        if (!onCheckpoint) {
            this._onCheckpointObj = null;
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
        
        // Check for button collisions
        this.checkButtonCollisions();

        // Check for teleportal collisions
        this.checkTeleportalCollisions();

        // Check for bouncer collisions
        this.checkBouncerCollisions();

        // Check for coin collisions
        this.checkCoinCollisions();
    }
    
    checkButtonCollisions() {
        if (!this.localPlayer || this.localPlayer.isDead) return;
        
        const playerBox = this.localPlayer.getGroundTouchbox();
        
        const nearby = this.world.queryNear(playerBox.x, playerBox.y, playerBox.width, playerBox.height);
        for (let ni = 0; ni < nearby.length; ni++) {
            const obj = nearby[ni];
            if (obj.appearanceType !== 'button' || obj.actingType !== 'button') continue;
            if (!this.localPlayer.boxIntersects(playerBox, obj)) {
                // Player left the button zone — mark as not inside
                if (obj._playerInside) {
                    obj._playerInside = false;
                }
                continue;
            }
            
            // Player is inside this button zone
            if (!obj._playerInside) {
                obj._playerInside = true;
                if (obj.buttonInteraction === 'collide') {
                    // Only trigger if not yet spent (for onlyOnce buttons)
                    if (!obj.buttonOnlyOnce || !obj._triggered) {
                        if (obj.buttonOnlyOnce) obj._triggered = true;
                        // Immediate trigger — no popup
                        if (this.audioManager) this.audioManager.play('button');
                        if (window.PluginManager) {
                            window.PluginManager.executeHook('button.pressed', {
                                button: obj,
                                player: this.localPlayer,
                                world: this.world
                            });
                        }
                    }
                } else {
                    this.showButtonUI(obj);
                }
            }
        }
    }
    
    showButtonUI(buttonObj) {
        // Don't show if this is a one-time button already triggered
        if (buttonObj.buttonOnlyOnce && buttonObj._triggered) return;
        // Don't show if one is already visible for this button
        if (document.getElementById('game-button-ui')) return;
        
        const overlay = document.createElement('div');
        overlay.id = 'game-button-ui';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            display: flex; align-items: center; justify-content: center;
            z-index: 9999; pointer-events: none;
        `;
        
        const panel = document.createElement('div');
        panel.style.cssText = `
            background: rgba(15, 15, 30, 0.95); border: 1px solid rgba(59, 130, 246, 0.5);
            border-radius: 16px; padding: 32px 40px; max-width: 420px; width: 90%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 30px rgba(59, 130, 246, 0.15);
            pointer-events: all; cursor: pointer; position: relative;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = `
            position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,0.1);
            border: none; color: #aaa; width: 32px; height: 32px; border-radius: 8px;
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            font-size: 18px; transition: background 0.15s;
        `;
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = 'rgba(255,255,255,0.2)'; });
        closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'rgba(255,255,255,0.1)'; });
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            overlay.remove();
        });
        
        const title = document.createElement('div');
        title.style.cssText = 'font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 12px; padding-right: 30px;';
        title.textContent = buttonObj.displayName || 'Button';
        
        const desc = document.createElement('div');
        desc.style.cssText = 'font-size: 14px; color: rgba(255,255,255,0.7); line-height: 1.6; white-space: pre-wrap;';
        desc.textContent = buttonObj.displayDescription || '';
        
        panel.appendChild(closeBtn);
        panel.appendChild(title);
        if (buttonObj.displayDescription) panel.appendChild(desc);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        
        // Hover effect
        panel.addEventListener('mouseenter', () => {
            panel.style.transform = 'scale(1.02)';
            panel.style.boxShadow = '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(59, 130, 246, 0.25)';
        });
        panel.addEventListener('mouseleave', () => {
            panel.style.transform = '';
            panel.style.boxShadow = '';
        });
        
        // Click panel (not close) = trigger
        panel.addEventListener('click', () => {
            overlay.remove();
            if (buttonObj.buttonOnlyOnce) buttonObj._triggered = true;
            if (this.audioManager) this.audioManager.play('button');
            // Fire button trigger via plugin hook
            if (window.PluginManager) {
                window.PluginManager.executeHook('button.pressed', {
                    button: buttonObj,
                    player: this.localPlayer,
                    world: this.world
                });
            }
        });
    }
    
    checkTeleportalCollisions() {
        if (!this.localPlayer || this.localPlayer.isDead) return;
        
        // Cooldown to prevent instant re-teleporting
        const now = Date.now();
        if (this.lastTeleportTime && now - this.lastTeleportTime < 500) return;
        
        const playerBox = this.localPlayer.getGroundTouchbox();
        const pad = 6;
        
        const nearby = this.world.queryNear(playerBox.x - pad, playerBox.y - pad, playerBox.width + pad * 2, playerBox.height + pad * 2);
        if (!this._tpBox) this._tpBox = { x: 0, y: 0, width: 0, height: 0 };
        for (let ni = 0; ni < nearby.length; ni++) {
            const obj = nearby[ni];
            if (obj.type !== 'teleportal') continue;
            if (obj.actingType !== 'portal') continue;
            if (!obj.teleportalName) continue;
            this._tpBox.x = obj.x - pad;
            this._tpBox.y = obj.y - pad;
            this._tpBox.width = obj.width + pad * 2;
            this._tpBox.height = obj.height + pad * 2;
            if (!this.localPlayer.boxIntersects(playerBox, this._tpBox)) continue;
            
            // Check if this portal has valid send connections
            for (const conn of obj.sendTo) {
                const targetName = conn?.name || conn;
                const isEnabled = conn?.enabled !== false;
                if (!targetName || !isEnabled) continue;
                
                const teleportals = this.world.getTeleportals();
                let targetPortal = null;
                for (let ti = 0; ti < teleportals.length; ti++) {
                    const p = teleportals[ti];
                    if (p.actingType === 'portal' && p.teleportalName === targetName) {
                        targetPortal = p;
                        break;
                    }
                }
                
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
                    const particleMaxAlpha = (obj.particleOpacity !== undefined ? obj.particleOpacity : 100) / 100;
                    this.spawnTeleportParticles(targetX + this.localPlayer.width / 2, targetY + this.localPlayer.height / 2, obj.color, particleMaxAlpha);
                    
                    return; // Only teleport once per frame
                }
            }
        }
    }

    checkCoinCollisions() {
        if (!this.localPlayer || this.localPlayer.isDead) return;
        const playerBox = this.localPlayer.getGroundTouchbox();
        const nearby = this.world.queryNear(playerBox.x, playerBox.y, playerBox.width, playerBox.height);
        let anyCollected = false;
        for (let ni = 0; ni < nearby.length; ni++) {
            const obj = nearby[ni];
            if (obj.appearanceType !== 'coin') continue;
            if (obj._collected) continue;
            if (!this.localPlayer.boxIntersects(playerBox, obj)) continue;
            obj._collected = true;
            this.coinsCollected = (this.coinsCollected || 0) + (typeof obj.coinAmount === 'number' ? obj.coinAmount : 1);
            anyCollected = true;
            // Play coin sound
            if (this.audioManager) this.audioManager.play('coin');
            // Collect sparkle particles
            const cx = obj.x + obj.width / 2;
            const cy = obj.y + obj.height / 2;
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const speed = 50 + Math.random() * 50;
                this.particles.push({
                    x: cx, y: cy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 0.5 + Math.random() * 0.3,
                    maxLife: 0.5 + Math.random() * 0.3,
                    size: 3 + Math.random() * 3,
                    color: '#f5c518'
                });
            }
        }
        if (anyCollected) this.updateCoinCounterUI();
    }

    checkBouncerCollisions() {
        if (!this.localPlayer || this.localPlayer.isDead) return;

        const now = Date.now();
        // Per-object cooldown of 200ms to prevent immediate re-trigger
        const BOUNCER_COOLDOWN = 200;

        const playerBox = this.localPlayer.getGroundTouchbox();
        const nearby = this.world.queryNear(playerBox.x, playerBox.y, playerBox.width, playerBox.height);

        for (let ni = 0; ni < nearby.length; ni++) {
            const obj = nearby[ni];
            if (obj.actingType !== 'bouncer') continue;
            if (!this.localPlayer.boxIntersects(playerBox, obj)) continue;

            // Cooldown check
            if (obj._lastBounceTime && now - obj._lastBounceTime < BOUNCER_COOLDOWN) continue;

            const strength = typeof obj.bouncerStrength === 'number' ? obj.bouncerStrength : 20;
            const bouncerDir = typeof obj.bouncerDirection === 'number' ? obj.bouncerDirection : 0;
            if (bouncerDir === 90) { // right
                this.localPlayer.vx = strength;
                this.localPlayer.vy = 0;
                this.localPlayer.isOnGround = false;
            } else if (bouncerDir === 180) { // down
                this.localPlayer.vy = strength;
                this.localPlayer.isOnGround = false;
            } else if (bouncerDir === 270) { // left
                this.localPlayer.vx = -strength;
                this.localPlayer.vy = 0;
                this.localPlayer.isOnGround = false;
            } else { // 0 = up (default)
                this.localPlayer.vy = -strength;
                this.localPlayer.isOnGround = false;
            }

            // Spring animation state
            const BOUNCE_ANIM_DURATION = 700;
            if (obj._bounceAnimStart && now - obj._bounceAnimStart < BOUNCE_ANIM_DURATION) {
                obj._bounceIntensity = Math.min((obj._bounceIntensity || 1) + 0.6, 3.5);
            } else {
                obj._bounceIntensity = 1;
            }
            obj._bounceAnimStart = now;

            obj._lastBounceTime = now;
            if (this.audioManager) this.audioManager.play('bounce');

            // Spawn a small burst of particles at the bounce point
            const cx = obj.x + obj.width / 2;
            const cy = obj.y;
            const color = obj.color || '#f59e0b';
            for (let i = 0; i < 8; i++) {
                const angle = -Math.PI + (i / 8) * Math.PI; // upward arc
                const speed = 60 + Math.random() * 40;
                this.particles.push({
                    x: cx,
                    y: cy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 0.4 + Math.random() * 0.2,
                    maxLife: 0.4 + Math.random() * 0.2,
                    size: 3 + Math.random() * 3,
                    color: color
                });
            }

            break; // Only one bouncer per frame
        }
    }

    spawnTeleportParticles(x, y, color, maxAlpha = 1) {
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
                life: 1,
                decay: 0.018 + Math.random() * 0.01,
                maxAlpha: maxAlpha,
                size: 4 + Math.random() * 4,
                color: color || '#9b59b6',
                shape: 'circle'
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
        
        this._onCheckpointObj = null;
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
        this.ctx.clearRect(0, 0, this.camera.width, this.camera.height);
        
        this.ctx.save();
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        
        const isPlaying = this.state === GameState.PLAYING || this.state === GameState.TESTING;
        const isEditor = this.state === GameState.EDITOR;
        const useTileCache = isPlaying && this.world._tileCacheReady;
        
        if (isPlaying) {
            this.renderClouds();
        }
        
        if (useTileCache) {
            // Fast path: draw pre-rendered tiles + only dynamic objects per frame
            if (!this._cpColors) this._cpColors = {};
            this._cpColors.default = this.world.checkpointDefaultColor;
            this._cpColors.active = this.world.checkpointActiveColor;
            this._cpColors.touched = this.world.checkpointTouchedColor;
            
            if (!this._layers01) { this._layers01 = [0, 1]; this._layers2 = [2]; }
            
            // Behind + same-layer static tiles
            this.world.renderTiles(this.ctx, this.camera, this._layers01);
            this.world.renderDynamic(this.ctx, this.camera, this._layers01, this._cpColors);
            
            // Players
            if (this.localPlayer) {
                const showPosition = this.state === GameState.TESTING;
                for (const player of this.remotePlayers.values()) {
                    player.render(this.ctx, this.camera, showPosition);
                }
                this.localPlayer.render(this.ctx, this.camera, showPosition);
                if (window.PluginManager) {
                    if (!this._renderPlayerData) this._renderPlayerData = {};
                    this._renderPlayerData.ctx = this.ctx;
                    this._renderPlayerData.player = this.localPlayer;
                    this._renderPlayerData.camera = this.camera;
                    this._renderPlayerData.world = this.world;
                    window.PluginManager.executeHook('render.player', this._renderPlayerData);
                }
            }
            
            // Above-player static tiles + dynamic
            this.world.renderTiles(this.ctx, this.camera, this._layers2);
            this.world.renderDynamic(this.ctx, this.camera, this._layers2, this._cpColors);
            
            // Zones/buttons
            this.world.renderVisibleZones(this.ctx, this.camera);
        } else {
            // Standard path: per-object rendering (editor mode)
            const { layers, checkpointColors } = this.world.render(this.ctx, this.camera);
            
            for (const obj of layers[1]) {
                obj.render(this.ctx, this.camera, checkpointColors);
            }
            
            if (this.localPlayer) {
                const showPosition = isEditor || this.state === GameState.TESTING;
                if (isPlaying) {
                    for (const player of this.remotePlayers.values()) {
                        player.render(this.ctx, this.camera, showPosition);
                    }
                }
                this.localPlayer.render(this.ctx, this.camera, showPosition);
                if (isPlaying && window.PluginManager) {
                    if (!this._renderPlayerData) this._renderPlayerData = {};
                    this._renderPlayerData.ctx = this.ctx;
                    this._renderPlayerData.player = this.localPlayer;
                    this._renderPlayerData.camera = this.camera;
                    this._renderPlayerData.world = this.world;
                    window.PluginManager.executeHook('render.player', this._renderPlayerData);
                }
            }
            
            this.world.renderAbovePlayer(this.ctx, this.camera, checkpointColors);
            this.world.renderZones(this.ctx, this.camera);
        }
        
        // Teleportal connections (editor & test only)
        if (isEditor || this.state === GameState.TESTING) {
            this.world.renderTeleportalConnections(this.ctx, this.camera, Date.now());
        }
        
        if ((isEditor || this.state === GameState.TESTING) && this.renderEditorOverlay) {
            this.renderEditorOverlay(this.ctx, this.camera);
        }
        
        this.ctx.restore();
        
        if (isPlaying) {
            this.renderPortalParticles();
            this.renderParticles();
            this.renderHUD();
        }
        
        // FPS counter (top-right corner)
        if (this._fpsDisplay !== undefined && this.state === GameState.TESTING) {
            const fps = this._fpsDisplay;
            this.ctx.save();
            this.ctx.font = '12px monospace';
            this.ctx.textAlign = 'right';
            this.ctx.fillStyle = fps < 30 ? '#ff4444' : fps < 50 ? '#ffaa00' : '#44ff44';
            this.ctx.fillText(`${fps} FPS`, this.camera.width - 8, 16);
            this.ctx.restore();
        }
    }
    
    renderHUD() {
        if (!this.localPlayer) return;
        
        if (window.PluginManager) {
            if (!this._hudData) this._hudData = {};
            this._hudData.ctx = this.ctx;
            this._hudData.canvas = this.canvas;
            this._hudData.player = this.localPlayer;
            this._hudData.world = this.world;
            this._hudData.xOffset = 20;
            this._hudData.yOffset = 20;
            window.PluginManager.executeHook('render.hud', this._hudData);
        }
        this.updateCoinCounterUI();
    }

    updateCoinCounterUI() {
        if (!this.world.showCoinCounter) {
            const existing = document.getElementById('coin-counter-ui');
            if (existing) existing.remove();
            return;
        }
        const totalCoins = this.world.objects.filter(o => o.appearanceType === 'coin').length;
        if (totalCoins === 0) {
            const existing = document.getElementById('coin-counter-ui');
            if (existing) existing.remove();
            return;
        }
        let el = document.getElementById('coin-counter-ui');
        if (!el) {
            el = document.createElement('div');
            el.id = 'coin-counter-ui';
            el.style.cssText = [
                'position:fixed',
                'left:50%',
                'transform:translateX(-50%)',
                'background:rgba(15,15,30,0.88)',
                'border:1px solid rgba(245,197,24,0.6)',
                'border-radius:20px',
                'padding:5px 16px',
                'display:flex',
                'align-items:center',
                'gap:6px',
                'font-size:15px',
                'font-weight:700',
                'color:#f5c518',
                'pointer-events:none',
                'z-index:9990',
                'transition:bottom 0.25s ease',
                'white-space:nowrap'
            ].join(';');
            el.innerHTML = '<span style="font-size:18px;">&#9678;</span><span id="coin-counter-text"></span>';
            document.body.appendChild(el);
        }
        // Position above the highest visible toolbar
        const toolbarEls = Array.from(document.querySelectorAll(
            '.toolbar:not(.hidden), .placement-toolbar.active, #admin-toolbar:not(.hidden)'
        ));
        let bottomOffset = 24;
        for (const tb of toolbarEls) {
            const rect = tb.getBoundingClientRect();
            if (rect.width === 0) continue;
            const spaceAbove = window.innerHeight - rect.top + 8;
            if (spaceAbove > bottomOffset) bottomOffset = spaceAbove;
        }
        el.style.bottom = bottomOffset + 'px';
        const collected = this.coinsCollected || 0;
        document.getElementById('coin-counter-text').textContent = `${collected} / ${totalCoins}`;
    }

    startGame(playerName, playerColor) {
        this.state = GameState.PLAYING;
        WorldObject._editorMode = false;
        this.lastCheckpoint = null;
        this._onCheckpointObj = null;
        this.gameStartTime = Date.now();
        // Reset coin state
        this.coinsCollected = 0;
        for (const obj of this.world.objects) {
            if (obj.appearanceType === 'coin') obj._collected = false;
            if (obj.appearanceType === 'button') obj._triggered = false;
        }
        
        // Regenerate clouds for new game session
        this.regenerateClouds();

        // Set zoom limits for play mode (can only zoom in from default)
        this.camera.setZoomLimits('play');
        this.camera.resetZoom();

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
        
        // Build tile cache for fast rendering
        this.world.buildTileCache();
    }

    startTestGame() {
        this.state = GameState.TESTING;
        WorldObject._editorMode = false;
        this.lastCheckpoint = null;
        this._onCheckpointObj = null;
        this.gameStartTime = Date.now();
        // Reset coin state
        this.coinsCollected = 0;
        for (const obj of this.world.objects) {
            if (obj.appearanceType === 'coin') obj._collected = false;
            if (obj.appearanceType === 'button') obj._triggered = false;
        }
        
        // Regenerate clouds for test session
        this.regenerateClouds();
        
        // Set zoom limits for test mode (zoom freely)
        this.camera.setZoomLimits('test');
        
        // Reset checkpoint states
        for (const obj of this.world.objects) {
            if (obj.actingType === 'checkpoint') {
                obj.checkpointState = 'default';
            }
        }
        
        // Store current camera position and zoom for returning
        this.editorCameraX = this.camera.x;
        this.editorCameraY = this.camera.y;
        this.editorCameraZoom = this.camera.zoom;
        
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
        
        // Build tile cache for fast rendering
        this.world.buildTileCache();
    }

    stopGame() {
        this.state = GameState.EDITOR;
        WorldObject._editorMode = true;
        this.localPlayer = null;
        this.remotePlayers.clear();
        this.particles = [];
        this._portalParticles = [];
        this._portalParticleTimer = 0;
        this.world.invalidateTileCache();

        const buttonUI = document.getElementById('game-button-ui');
        if (buttonUI) buttonUI.remove();
        const coinUI = document.getElementById('coin-counter-ui');
        if (coinUI) coinUI.remove();
        // Reset collected flags
        for (const obj of this.world.objects) { if (obj.appearanceType === 'coin') obj._collected = false; }
        
        for (const obj of this.world.objects) {
            if (obj.appearanceType === 'button') obj._playerInside = false;
            if (obj.actingType === 'checkpoint') obj.checkpointState = 'default';
        }
        this.lastCheckpoint = null;

        // Set zoom limits for editor mode (zoom freely)
        this.camera.setZoomLimits('editor');
        
        // Restore camera position and zoom if coming from test mode
        if (this.editorCameraX !== undefined) {
            this.camera.x = this.editorCameraX;
            this.camera.y = this.editorCameraY;
            if (this.editorCameraZoom !== undefined) {
                this.camera.zoom = this.editorCameraZoom;
            }
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
        WorldObject._editorMode = true;
    }

    addRemotePlayer(id, name, color, x, y) {
        const player = new Player(x, y, name, color);
        this.remotePlayers.set(id, player);
        return player;
    }

    updateRemotePlayer(id, x, y, vx = 0, vy = 0) {
        const player = this.remotePlayers.get(id);
        if (player) {
            if (player._adminDragged) return;
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

GameEngine._invincible = false;

// Export for use in other modules
window.GameEngine = GameEngine;
window.Player = Player;
window.Camera = Camera;
window.World = World;
window.WorldObject = WorldObject;
window.AudioManager = AudioManager;
window.GameState = GameState;
window.GRID_SIZE = GRID_SIZE;
