/**
 * HP Plugin - Injection Script
 * This script hooks into the game systems to add HP functionality
 */

(function(ctx) {
    const { pluginManager, pluginId, world, hooks } = ctx;
    
    // Get config from world or use defaults
    const config = world?.plugins?.hp || { defaultHP: 3 };
    
    // Load HP SVG images
    const hpFullImg = new Image();
    hpFullImg.src = 'assets/plugins/hp/svg/hpfull.svg';
    
    const hpEmptyImg = new Image();
    hpEmptyImg.src = 'assets/plugins/hp/svg/hpempty.svg';
    
    // ============================================
    // PLAYER INITIALIZATION HOOK
    // ============================================
    pluginManager.registerHook('player.init', (data) => {
        const { player } = data;
        
        // Add HP properties to player
        player.hp = config.defaultHP;
        player.maxHP = config.defaultHP;
        player.useHPSystem = true;
        player.invincibleUntil = 0;
        player.safeGroundHistory = [];
        player.damageStunUntil = 0; // Prevents movement during damage stun
        player.originalColor = player.color; // Store original color for flashing
        
        return data;
    }, pluginId);
    
    // Grid size for alignment
    const GRID_SIZE = 32;
    
    // Helper: Check if a position is safe (not overlapping any spike)
    function isPositionSafe(x, y, playerWidth, playerHeight) {
        const playerBox = { x, y, width: playerWidth, height: playerHeight };
        const margin = 4; // Extra margin around spikes
        
        for (const obj of world.objects) {
            if (obj.actingType !== 'spike') continue;
            
            // Expanded spike box for safety margin
            const spikeBox = {
                x: obj.x - margin,
                y: obj.y - margin,
                width: obj.width + margin * 2,
                height: obj.height + margin * 2
            };
            
            // Check overlap
            if (playerBox.x < spikeBox.x + spikeBox.width &&
                playerBox.x + playerBox.width > spikeBox.x &&
                playerBox.y < spikeBox.y + spikeBox.height &&
                playerBox.y + playerBox.height > spikeBox.y) {
                return false;
            }
        }
        return true;
    }
    
    // Helper: Align to grid
    function alignToGrid(value) {
        return Math.round(value / GRID_SIZE) * GRID_SIZE;
    }
    
    // ============================================
    // PLAYER UPDATE HOOK - Record safe ground & handle stun
    // ============================================
    let lastSafeGroundCheck = 0;
    const SAFE_GROUND_CHECK_INTERVAL = 200; // Only check every 200ms to reduce lag
    
    pluginManager.registerHook('player.update', (data) => {
        const { player } = data;
        const now = Date.now();
        
        // Handle damage stun - prevent movement
        if (player.useHPSystem && player.damageStunUntil && now < player.damageStunUntil) {
            // Clear input during stun
            player.vx = 0;
            // Keep gravity, but don't allow player input
            player.input = {
                ...player.input,
                left: false,
                right: false,
                jump: false,
                up: false,
                down: false
            };
        }
        
        // Record safe ground when player is on ground (throttled)
        if (player.isOnGround && !player.isDead && player.useHPSystem) {
            const now = Date.now();
            
            // Throttle the check to reduce performance impact
            if (now - lastSafeGroundCheck < SAFE_GROUND_CHECK_INTERVAL) {
                return data;
            }
            lastSafeGroundCheck = now;
            
            // Grid-align the position
            const alignedX = alignToGrid(player.x);
            const alignedY = alignToGrid(player.y);
            
            // Avoid duplicate consecutive positions (fast check first)
            const lastEntry = player.safeGroundHistory[player.safeGroundHistory.length - 1];
            if (lastEntry && lastEntry.x === alignedX && lastEntry.y === alignedY) {
                return data;
            }
            
            // Only record if position is safe (not near spikes)
            if (isPositionSafe(alignedX, alignedY, player.width, player.height)) {
                player.safeGroundHistory.push({
                    x: alignedX,
                    y: alignedY,
                    time: now
                });
            }
            
            // Keep only last N entries
            if (player.safeGroundHistory.length > 20) {
                player.safeGroundHistory.shift();
            }
        }
        
        return data;
    }, pluginId);
    
    // ============================================
    // DAMAGE HOOK - Handle HP damage instead of instant death
    // ============================================
    pluginManager.registerHook('player.damage', (data) => {
        const { player, source } = data;
        
        if (!player.useHPSystem) return data;
        
        const now = Date.now();
        
        // Check invincibility
        if (now < player.invincibleUntil) {
            return { ...data, preventDefault: true };
        }
        
        // Take damage
        player.hp--;
        player.invincibleUntil = now + 1000; // 1 second invincibility
        player.damageStunUntil = now + 500; // 0.5 second stun (can't move)
        
        // Store original color if not already stored
        if (!player.originalColor) {
            player.originalColor = player.color;
        }
        
        if (player.hp <= 0) {
            // Player dies - don't prevent default
            return data;
        }
        
        // Player survives - teleport to a safe ground position
        // Search backward through history to find a truly safe spot
        let foundSafe = false;
        for (let i = player.safeGroundHistory.length - 1; i >= 0; i--) {
            const safeGround = player.safeGroundHistory[i];
            
            // Verify this position is still safe
            if (isPositionSafe(safeGround.x, safeGround.y, player.width, player.height)) {
                player.x = safeGround.x;
                player.y = safeGround.y;
                player.vx = 0;
                player.vy = 0;
                foundSafe = true;
                
                // Remove entries after this one (they might be unsafe)
                player.safeGroundHistory = player.safeGroundHistory.slice(0, i + 1);
                break;
            }
        }
        
        // If no safe ground found, use checkpoint or spawn point
        if (!foundSafe) {
            // Get the game engine's last checkpoint if available
            const engine = window.gameEngine || window.engine;
            const lastCheckpoint = engine?.lastCheckpoint;
            const dieLineY = world.dieLineY ?? 2000;
            
            let newX = 100, newY = 100; // Default fallback
            
            if (lastCheckpoint && (lastCheckpoint.y - player.height) < dieLineY) {
                // Use checkpoint (if it's above the void)
                newX = lastCheckpoint.x + lastCheckpoint.width / 2 - player.width / 2;
                newY = lastCheckpoint.y - player.height;
            } else if (world.spawnPoint && (world.spawnPoint.y - player.height) < dieLineY) {
                // Use spawn point (if it's above the void)
                newX = world.spawnPoint.x + world.spawnPoint.width / 2 - player.width / 2;
                newY = world.spawnPoint.y - player.height;
            }
            // else use default (100, 100) which should be safe
            
            player.x = newX;
            player.y = newY;
            player.vx = 0;
            player.vy = 0;
            // Clear history since we're at spawn/checkpoint
            player.safeGroundHistory = [];
        }
        
        // Prevent default death behavior
        return { ...data, preventDefault: true };
    }, pluginId);
    
    // ============================================
    // RESPAWN HOOK - Reset HP on respawn
    // ============================================
    pluginManager.registerHook('player.respawn', (data) => {
        const { player } = data;
        
        if (player.useHPSystem) {
            player.hp = player.maxHP;
            player.invincibleUntil = 0;
            player.damageStunUntil = 0;
            player.safeGroundHistory = [];
        }
        
        return data;
    }, pluginId);
    
    // ============================================
    // HUD RENDERING HOOK - Draw HP using SVG icons
    // ============================================
    pluginManager.registerHook('render.hud', (data) => {
        const { ctx, player, xOffset = 20, yOffset = 20 } = data;
        
        if (!player.useHPSystem) return data;
        
        const hpSize = 24;
        const hpSpacing = 28;
        let currentX = xOffset;
        
        for (let i = 0; i < player.maxHP; i++) {
            const hpX = currentX + i * hpSpacing;
            const hpY = yOffset;
            
            // Draw HP icon using SVG images
            if (i < player.hp) {
                // Full HP
                if (hpFullImg.complete) {
                    ctx.drawImage(hpFullImg, hpX, hpY, hpSize, hpSize);
                }
            } else {
                // Empty HP
                if (hpEmptyImg.complete) {
                    ctx.drawImage(hpEmptyImg, hpX, hpY, hpSize, hpSize);
                }
            }
        }
        
        // Update xOffset for next HUD element
        return { ...data, xOffset: currentX + player.maxHP * hpSpacing + 10 };
    }, pluginId, 20); // Priority 20 so it renders after soul
    
    // ============================================
    // PLAYER RENDER HOOK - Flash player sprite during invincibility
    // ============================================
    pluginManager.registerHook('render.player', (data) => {
        const { ctx, player, camera } = data;
        
        if (!player.useHPSystem) return data;
        
        const now = Date.now();
        
        // During invincibility, flash between black overlay and normal
        if (player.invincibleUntil && now < player.invincibleUntil) {
            // Flash frequency: alternate every 100ms
            const flashPhase = Math.floor(now / 100) % 2;
            
            if (flashPhase === 0) {
                // Draw black overlay on the player
                const screenX = player.x - camera.x;
                const screenY = player.y - camera.y;
                
                ctx.fillStyle = '#000000';
                ctx.fillRect(screenX, screenY, player.width, player.height);
            }
            // On odd phase, player is shown normally (already rendered)
        }
        
        return data;
    }, pluginId);
    
})(ctx);
