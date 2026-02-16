/**
 * HP Plugin - Injection Script
 * This script hooks into the game systems to add HP functionality
 */

(function(ctx) {
    const { pluginManager, pluginId, world, hooks } = ctx;
    
    // Get config from world or use defaults
    const config = world?.plugins?.hp || { defaultHP: 3 };
    
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
        
        return data;
    }, pluginId);
    
    // ============================================
    // PLAYER UPDATE HOOK - Record safe ground
    // ============================================
    pluginManager.registerHook('player.update', (data) => {
        const { player } = data;
        
        // Record safe ground when player is on ground
        if (player.isOnGround && !player.isDead && player.useHPSystem) {
            const now = Date.now();
            player.safeGroundHistory.push({
                x: player.x,
                y: player.y,
                time: now
            });
            
            // Keep only last N entries
            if (player.safeGroundHistory.length > 60) {
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
        
        if (player.hp <= 0) {
            // Player dies - don't prevent default
            return data;
        }
        
        // Player survives - teleport to last safe ground
        if (player.safeGroundHistory.length > 0) {
            const safeGround = player.safeGroundHistory[player.safeGroundHistory.length - 1];
            player.x = safeGround.x;
            player.y = safeGround.y;
            player.vx = 0;
            player.vy = 0;
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
            player.safeGroundHistory = [];
        }
        
        return data;
    }, pluginId);
    
    // ============================================
    // HUD RENDERING HOOK - Draw hearts
    // ============================================
    pluginManager.registerHook('render.hud', (data) => {
        const { ctx, player, xOffset = 20, yOffset = 20 } = data;
        
        if (!player.useHPSystem) return data;
        
        const heartSize = 24;
        const heartSpacing = 28;
        let currentX = xOffset;
        
        for (let i = 0; i < player.maxHP; i++) {
            const heartX = currentX + i * heartSpacing;
            const heartY = yOffset;
            
            // Draw heart shape
            ctx.beginPath();
            const topCurveHeight = heartSize * 0.3;
            ctx.moveTo(heartX + heartSize / 2, heartY + heartSize);
            ctx.bezierCurveTo(
                heartX, heartY + heartSize * 0.7,
                heartX, heartY + topCurveHeight,
                heartX + heartSize / 2, heartY + topCurveHeight
            );
            ctx.bezierCurveTo(
                heartX + heartSize, heartY + topCurveHeight,
                heartX + heartSize, heartY + heartSize * 0.7,
                heartX + heartSize / 2, heartY + heartSize
            );
            
            // Fill color based on HP
            if (i < player.hp) {
                ctx.fillStyle = '#FF6B6B'; // Red for filled hearts
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; // Dim for empty hearts
            }
            ctx.fill();
            
            // Heart outline
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // Update xOffset for next HUD element
        return { ...data, xOffset: currentX + player.maxHP * heartSpacing + 10 };
    }, pluginId, 20); // Priority 20 so it renders after soul
    
    // Invincibility flash effect
    pluginManager.registerHook('render.hud', (data) => {
        const { ctx, player, canvas } = data;
        
        if (player.useHPSystem && player.invincibleUntil > Date.now()) {
            const flashOpacity = Math.sin(Date.now() / 50) * 0.2 + 0.2;
            ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        return data;
    }, pluginId, 100); // High priority, runs last
    
})(ctx);
