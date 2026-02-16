/**
 * Hollow Knight Plugin - Injection Script
 * Hooks into game systems to add HK mechanics
 */

(function(ctx) {
    const { pluginManager, pluginId, world, hooks, sounds } = ctx;
    
    // Get config from world or use defaults
    const config = world?.plugins?.hollowknight || HK_DEFAULTS;
    
    // ============================================
    // PLAYER INITIALIZATION
    // ============================================
    pluginManager.registerHook('player.init', (data) => {
        const { player } = data;
        
        // Add HK properties
        player.soul = 0;
        player.maxSoul = config.maxSoul || 99;
        player.facingDirection = 1;
        
        // Attack
        player.isAttacking = false;
        player.attackDirection = 'forward';
        player.attackStartTime = 0;
        player.attackCooldown = 0;
        
        // Monarch Wing
        player.hasMonarchWing = config.monarchWing || false;
        player.monarchWingAmount = config.monarchWingAmount || 1;
        player.monarchWingsUsed = 0;
        
        // Dash
        player.hasDash = config.dash || false;
        player.isDashing = false;
        player.dashStartTime = 0;
        player.dashCooldown = 0;
        player.dashDirection = 1;
        
        // Super Dash
        player.hasSuperDash = config.superDash || false;
        player.isSuperDashing = false;
        player.superDashCharging = false;
        player.superDashChargeStart = 0;
        player.superDashDirection = 1;
        player._playedCharge2 = false;
        
        // Heal
        player.isHealing = false;
        player.healStartTime = 0;
        
        return data;
    }, pluginId, 5); // Run before HP plugin
    
    // ============================================
    // INPUT HANDLING
    // ============================================
    // Input is now handled by the game engine's keyboard layout system
    // The game sets player.input.attack, player.input.heal, etc.
    // We just need to update facing direction
    pluginManager.registerHook('input.keydown', (data) => {
        const { key, player } = data;
        if (!player) return data;
        
        // Update facing direction
        if (key === 'KeyA' || key === 'ArrowLeft') player.facingDirection = -1;
        if (key === 'KeyD' || key === 'ArrowRight') player.facingDirection = 1;
        
        return data;
    }, pluginId);
    
    // ============================================
    // PLAYER UPDATE - HK Mechanics
    // ============================================
    pluginManager.registerHook('player.update', (data) => {
        const { player, world, audioManager } = data;
        const now = Date.now();
        
        // Update facing based on movement
        if (player.input?.left && !player.input?.right) player.facingDirection = -1;
        if (player.input?.right && !player.input?.left) player.facingDirection = 1;
        
        // ===== ATTACK =====
        if (player.input?.attack && !player.isAttacking && now > player.attackCooldown) {
            let direction = 'forward';
            if (player.input?.up) direction = 'up';
            else if (player.input?.down && !player.isOnGround) direction = 'down';
            
            player.isAttacking = true;
            player.attackDirection = direction;
            player.attackStartTime = now;
            
            // Check for spike collision with attack hitbox
            const hitbox = getAttackHitbox(player, direction);
            for (const obj of world.objects) {
                if (obj.actingType === 'spike' && obj.collision !== false) {
                    if (boxIntersects(hitbox, obj)) {
                        // Gain soul
                        player.soul = Math.min(player.maxSoul, player.soul + 16.5);
                        pluginManager.playSound(pluginId, 'getSoul');
                        
                        // Bounce
                        if (direction === 'down') {
                            player.vy = -14 * 0.4; // Pogo bounce
                        } else {
                            player.vx = -player.facingDirection * 3;
                            player.vy = -3;
                        }
                        break;
                    }
                }
            }
        }
        
        // Update attack state
        if (player.isAttacking && now - player.attackStartTime >= 200) {
            player.isAttacking = false;
            player.attackCooldown = now + 100;
        }
        
        // ===== DASH =====
        if (player.input?.dash && player.hasDash && !player.isDashing && now > player.dashCooldown) {
            player.isDashing = true;
            player.dashStartTime = now;
            player.dashDirection = player.facingDirection;
            pluginManager.playSound(pluginId, 'dash');
        }
        
        if (player.isDashing) {
            const elapsed = now - player.dashStartTime;
            if (elapsed >= 200) {
                player.isDashing = false;
                player.dashCooldown = now + 400;
            } else {
                player.vx = player.dashDirection * 15;
                player.vy = 0;
                return { ...data, skipPhysics: true };
            }
        }
        
        // ===== SUPER DASH =====
        if (player.input?.superDash && player.hasSuperDash && !player.isSuperDashing && !player.superDashCharging) {
            player.superDashCharging = true;
            player.superDashChargeStart = now;
            player.superDashDirection = player.facingDirection;
            player._playedCharge2 = false;
            pluginManager.playSound(pluginId, 'superdashCharge1');
        }
        
        if (player.superDashCharging) {
            const elapsed = now - player.superDashChargeStart;
            
            // Play charge2 sound halfway
            if (elapsed >= 400 && !player._playedCharge2) {
                player._playedCharge2 = true;
                pluginManager.playSound(pluginId, 'superdashCharge2');
            }
            
            // Release check
            if (!player.input?.superDash) {
                player.superDashCharging = false;
                if (elapsed >= 800) {
                    // Fully charged - burst!
                    player.isSuperDashing = true;
                    pluginManager.playSound(pluginId, 'superdashBurst');
                    pluginManager.playSound(pluginId, 'superdashFlying');
                }
            }
        }
        
        if (player.isSuperDashing) {
            player.vx = player.superDashDirection * 20;
            player.vy = 0;
            
            // Check for wall collision
            const collisions = checkCollisions(player, world, 'horizontal');
            if (collisions.length > 0) {
                stopSuperDash(player, 'wall');
            }
            
            // Jump cancels super dash
            if (player.input?.attack || (player.input?.jump && player.canJump)) {
                stopSuperDash(player, 'manual');
            }
            
            return { ...data, skipPhysics: true };
        }
        
        // ===== HEAL =====
        if (player.input?.heal && !player.isHealing && !player.isDashing && !player.isSuperDashing) {
            if (player.soul >= 33 && player.hp < player.maxHP) {
                player.isHealing = true;
                player.healStartTime = now;
                pluginManager.playSound(pluginId, 'healCharging');
            }
        }
        
        if (player.isHealing) {
            if (!player.input?.heal) {
                // Cancelled
                player.isHealing = false;
                pluginManager.stopSound(pluginId, 'healCharging');
            } else if (now - player.healStartTime >= 900) {
                // Complete!
                player.soul -= 33;
                player.hp = Math.min(player.maxHP, player.hp + 1);
                player.isHealing = false;
                pluginManager.playSound(pluginId, 'healComplete');
            }
        }
        
        // ===== VARIABLE JUMP HEIGHT =====
        if (!player.input?.jump && player.vy < 0) {
            player.vy = Math.min(player.vy, -2);
        }
        
        return data;
    }, pluginId);
    
    // ============================================
    // MONARCH WING - Extra jump when out of normal jumps
    // ============================================
    pluginManager.registerHook('player.jump', (data) => {
        const { player, canJump } = data;
        
        if (!canJump && player.hasMonarchWing && !player.isOnGround && 
            player.monarchWingsUsed < player.monarchWingAmount) {
            
            player.monarchWingsUsed++;
            
            // Small drop then wing flap
            player.vy = 2;
            setTimeout(() => {
                player.vy = -14 * 0.9;
            }, 50);
            
            pluginManager.playSound(pluginId, 'monarchWings');
            
            return { ...data, preventDefault: false, didJump: true };
        }
        
        return data;
    }, pluginId);
    
    // Reset monarch wings on land
    pluginManager.registerHook('player.land', (data) => {
        const { player } = data;
        player.monarchWingsUsed = 0;
        return data;
    }, pluginId);
    
    // ============================================
    // RESPAWN - Reset HK state
    // ============================================
    pluginManager.registerHook('player.respawn', (data) => {
        const { player } = data;
        
        player.soul = 0;
        player.isAttacking = false;
        player.isDashing = false;
        player.isSuperDashing = false;
        player.superDashCharging = false;
        player.isHealing = false;
        player.monarchWingsUsed = 0;
        
        return data;
    }, pluginId);
    
    // ============================================
    // HUD RENDERING - Soul vessel
    // ============================================
    pluginManager.registerHook('render.hud', (data) => {
        const { ctx, player } = data;
        let xOffset = data.xOffset || 20;
        const yOffset = data.yOffset || 20;
        
        // Soul vessel background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.arc(xOffset + 30, yOffset + 30, 35, 0, Math.PI * 2);
        ctx.fill();
        
        // Soul fill
        const soulPercent = player.soul / player.maxSoul;
        if (soulPercent > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(xOffset + 30, yOffset + 30, 30, 0, Math.PI * 2);
            ctx.clip();
            
            const fillHeight = 60 * soulPercent;
            const gradient = ctx.createLinearGradient(
                xOffset + 30, yOffset + 60 - fillHeight,
                xOffset + 30, yOffset + 60
            );
            gradient.addColorStop(0, '#a0d8ef');
            gradient.addColorStop(1, '#6bb3d9');
            ctx.fillStyle = gradient;
            ctx.fillRect(xOffset, yOffset + 60 - fillHeight, 60, fillHeight);
            ctx.restore();
        }
        
        // Soul number
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(Math.floor(player.soul).toString(), xOffset + 30, yOffset + 35);
        
        // Heal progress indicator
        if (player.isHealing) {
            const elapsed = Date.now() - player.healStartTime;
            const progress = elapsed / 900;
            
            ctx.strokeStyle = '#4CAF50';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(xOffset + 30, yOffset + 30, 38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
            ctx.stroke();
        }
        
        // Update xOffset for HP hearts
        return { ...data, xOffset: xOffset + 80 };
    }, pluginId, 10); // Priority 10, runs before HP plugin
    
    // ============================================
    // HELPER FUNCTIONS
    // ============================================
    
    function getAttackHitbox(player, direction) {
        const attackRange = 40;
        const attackWidth = 32;
        const attackHeight = 24;
        
        if (direction === 'up') {
            return {
                x: player.x + (player.width - attackWidth) / 2,
                y: player.y - attackRange,
                width: attackWidth,
                height: attackRange
            };
        } else if (direction === 'down') {
            return {
                x: player.x + (player.width - attackWidth) / 2,
                y: player.y + player.height,
                width: attackWidth,
                height: attackRange
            };
        } else {
            return {
                x: player.facingDirection > 0 ? player.x + player.width : player.x - attackRange,
                y: player.y + (player.height - attackHeight) / 2,
                width: attackRange,
                height: attackHeight
            };
        }
    }
    
    function boxIntersects(a, b) {
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    }
    
    function checkCollisions(player, world, direction) {
        const collisions = [];
        const box = { x: player.x, y: player.y, width: player.width, height: player.height };
        
        for (const obj of world.objects) {
            if (!obj.collision) continue;
            if (obj.actingType === 'text' || obj.actingType === 'teleportal') continue;
            
            if (boxIntersects(box, obj)) {
                collisions.push(obj);
            }
        }
        
        return collisions;
    }
    
    function stopSuperDash(player, reason) {
        player.isSuperDashing = false;
        pluginManager.stopSound(pluginId, 'superdashFlying');
        
        if (reason === 'wall') {
            pluginManager.playSound(pluginId, 'superdashHitwallstop');
        } else if (reason === 'manual') {
            pluginManager.playSound(pluginId, 'superdashTriggerstop');
        }
    }
    
})(ctx);
