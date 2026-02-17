/**
 * Hollow Knight Plugin - Injection Script
 * Hooks into game systems to add HK mechanics
 */

(function(ctx) {
    const { pluginManager, pluginId, world, hooks, sounds } = ctx;
    
    // Load soul container SVG images
    const soulEmptyImg = new Image();
    soulEmptyImg.src = 'assets/plugins/hk/svg/soulcontainer-empty.svg';
    
    const soulFullImg = new Image();
    soulFullImg.src = 'assets/plugins/hk/svg/soulcontainer-full.svg';
    
    // Helper to get current config (reads dynamically so changes are reflected)
    function getConfig() {
        return world?.plugins?.hk || HK_DEFAULTS;
    }
    
    // ============================================
    // PLAYER INITIALIZATION
    // ============================================
    pluginManager.registerHook('player.init', (data) => {
        const { player } = data;
        const config = getConfig();
        
        // Add HK properties
        player.soul = 0;
        player.maxSoul = config.maxSoul || 99;
        player.facingDirection = 1;
        
        // Attack
        player.isAttacking = false;
        player.attackDirection = 'forward';
        player.attackStartTime = 0;
        player.attackCooldown = 0;
        
        // Monarch Wing - always set to true initially, reads from config during gameplay
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
        
        // Mantis Claw (wall cling + wall jump)
        player.hasMantisClaw = config.mantisClaw || false;
        player.isWallClinging = false;
        player.wallClingDirection = 0; // -1 = left wall, 1 = right wall
        player.wallJumpCooldown = 0;
        player.wallSlideSpeed = 2; // Slower fall when clinging
        player._wallJumpReady = true; // Prevents repeated wall jumps from held key
        
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
        const config = getConfig();
        
        // Sync abilities from config (allows dynamic enable/disable)
        player.hasMonarchWing = config.monarchWing || false;
        player.monarchWingAmount = config.monarchWingAmount || 1;
        player.hasDash = config.dash || false;
        player.hasSuperDash = config.superDash || false;
        player.hasMantisClaw = config.mantisClaw || false;
        
        // Update facing based on movement
        if (player.input?.left && !player.input?.right) player.facingDirection = -1;
        if (player.input?.right && !player.input?.left) player.facingDirection = 1;
        
        // ===== MANTIS CLAW (Wall Cling) =====
        if (player.hasMantisClaw && !player.isOnGround && !player.isDashing && !player.isSuperDashing) {
            const touchingWall = checkWallContact(player, world);
            
            if (touchingWall !== 0) {
                // Player is touching a wall
                const pressingTowardWall = (touchingWall === -1 && player.input?.left) || 
                                           (touchingWall === 1 && player.input?.right);
                
                if (pressingTowardWall && player.vy >= 0) {
                    // Start or continue wall cling
                    if (!player.isWallClinging) {
                        player.isWallClinging = true;
                        player.wallClingDirection = touchingWall;
                        player.monarchWingsUsed = 0; // Reset double jump when grabbing wall
                    }
                } else if (player.isWallClinging && !pressingTowardWall) {
                    // Released wall
                    player.isWallClinging = false;
                }
            } else {
                // Not touching any wall
                player.isWallClinging = false;
            }
        } else {
            player.isWallClinging = false;
        }
        
        // Reset wall cling on ground
        if (player.isOnGround) {
            player.isWallClinging = false;
        }
        
        // Handle wall cling physics - use skipPhysics to control fall speed
        if (player.isWallClinging) {
            const worldJumpForce = world?.jumpForce ?? -14;
            const worldGravity = world?.gravity ?? 0.8;
            const gravityRatio = worldGravity / 0.8;
            
            // Check for wall jump input
            if (player.input?.jump && player._wallJumpReady !== false) {
                // Wall jump: push away from wall and up
                const wallJumpForceX = 8; // Horizontal push away from wall
                const wallJumpForceY = worldJumpForce * 0.9 * Math.sqrt(gravityRatio);
                
                player.vx = -player.wallClingDirection * wallJumpForceX;
                player.vy = wallJumpForceY;
                player.facingDirection = -player.wallClingDirection;
                player.isWallClinging = false;
                player.monarchWingsUsed = 0; // Reset double jump after wall jump
                player._wallJumpReady = false; // Prevent repeated jumps from held key
                
                pluginManager.playSound(pluginId, 'monarchWings');
                
                // Apply movement with collision
                player.moveWithCollision(world);
                
                return { ...data, skipPhysics: true };
            }
            
            // Reset wall jump ready when jump key is released
            if (!player.input?.jump) {
                player._wallJumpReady = true;
            }
            
            // Apply slow wall slide instead of normal gravity
            player.vy += worldGravity * 0.1; // Very slow gravity while clinging
            player.vy = Math.min(player.vy, player.wallSlideSpeed); // Cap at slide speed
            
            // Prevent horizontal movement away from wall while clinging
            player.vx = 0;
            
            // Apply movement with collision
            player.moveWithCollision(world);
            
            return { ...data, skipPhysics: true };
        }
        
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
            if (elapsed >= 150) {
                player.isDashing = false;
                player.dashCooldown = now + 400;
            } else {
                player.vx = player.dashDirection * 12;
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
        // When jump is released while ascending, cut the upward velocity
        if (!player.input?.jump && player.vy < 0 && !player.isOnGround) {
            // Cap upward velocity to -2 so player starts falling sooner
            if (player.vy < -2) {
                player.vy = -2;
            }
        }
        
        return data;
    }, pluginId);
    
    // ============================================
    // MONARCH WING JUMP HANDLING
    // (Mantis Claw wall jump is handled in player.update since it uses skipPhysics)
    // ============================================
    pluginManager.registerHook('player.jump', (data) => {
        const { player, canJump } = data;
        
        const worldJumpForce = world?.jumpForce ?? -14;
        const worldGravity = world?.gravity ?? 0.8;
        const gravityRatio = worldGravity / 0.8; // Ratio vs default gravity
        
        // MONARCH WING - Double jump when out of normal jumps
        if (!canJump && player.hasMonarchWing && !player.isOnGround && 
            player.monarchWingsUsed < player.monarchWingAmount) {
            
            player.monarchWingsUsed++;
            
            // Monarch wing is 85% of normal jump, scaled with gravity
            player.vy = worldJumpForce * 0.85 * Math.sqrt(gravityRatio);
            
            pluginManager.playSound(pluginId, 'monarchWings');
            
            return { ...data, preventDefault: false, didJump: true };
        }
        
        return data;
    }, pluginId);
    
    // Reset monarch wings on land
    pluginManager.registerHook('player.land', (data) => {
        const { player } = data;
        player.monarchWingsUsed = 0;
        player.isWallClinging = false;
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
        player.isWallClinging = false;
        player._wallJumpReady = true;
        
        return data;
    }, pluginId);
    
    // ============================================
    // PLAYER EFFECTS RENDERING - Attack slash, dash trail, etc.
    // ============================================
    pluginManager.registerHook('render.player', (data) => {
        const { ctx, player, camera } = data;
        
        // Draw attack slash effect
        if (player.isAttacking) {
            const hitbox = getAttackHitbox(player, player.attackDirection);
            const screenX = hitbox.x - camera.x;
            const screenY = hitbox.y - camera.y;
            
            // Calculate attack progress for animation
            const elapsed = Date.now() - player.attackStartTime;
            const progress = Math.min(elapsed / 200, 1);
            
            ctx.save();
            ctx.globalAlpha = 1 - progress * 0.5; // Fade out as attack progresses
            
            // Draw slash arc based on direction
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            
            if (player.attackDirection === 'up') {
                // Upward slash - horizontal arc above player
                const centerX = screenX + hitbox.width / 2;
                const centerY = screenY + hitbox.height;
                ctx.beginPath();
                ctx.arc(centerX, centerY, hitbox.height * 0.8, Math.PI + 0.3, Math.PI * 2 - 0.3);
                ctx.stroke();
            } else if (player.attackDirection === 'down') {
                // Downward slash - horizontal arc below player
                const centerX = screenX + hitbox.width / 2;
                const centerY = screenY;
                ctx.beginPath();
                ctx.arc(centerX, centerY, hitbox.height * 0.8, 0.3, Math.PI - 0.3);
                ctx.stroke();
            } else {
                // Forward slash - vertical arc in front of player
                const centerX = player.facingDirection > 0 ? screenX : screenX + hitbox.width;
                const centerY = screenY + hitbox.height / 2;
                const startAngle = player.facingDirection > 0 ? -Math.PI / 2 - 0.5 : Math.PI / 2 - 0.5;
                const endAngle = player.facingDirection > 0 ? Math.PI / 2 + 0.5 : -Math.PI / 2 + 0.5;
                ctx.beginPath();
                ctx.arc(centerX, centerY, hitbox.width * 0.8, startAngle, endAngle);
                ctx.stroke();
            }
            
            ctx.restore();
        }
        
        // Draw wall cling indicator
        if (player.isWallClinging) {
            const screenX = player.x - camera.x;
            const screenY = player.y - camera.y;
            
            ctx.save();
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = '#88f';
            
            // Small particles near the wall
            const wallX = player.wallClingDirection === -1 ? screenX - 2 : screenX + player.width + 2;
            for (let i = 0; i < 3; i++) {
                const particleY = screenY + player.height * (0.2 + i * 0.3);
                ctx.fillRect(wallX - 2, particleY, 4, 4);
            }
            
            ctx.restore();
        }
        
        return data;
    }, pluginId);
    
    // ============================================
    // HUD RENDERING - Soul vessel using SVG icons
    // ============================================
    pluginManager.registerHook('render.hud', (data) => {
        const { ctx, player } = data;
        let xOffset = data.xOffset || 20;
        const yOffset = data.yOffset || 20;
        
        const containerSize = 60;
        const soulPercent = player.soul / player.maxSoul;
        
        // Draw empty soul container
        if (soulEmptyImg.complete) {
            ctx.drawImage(soulEmptyImg, xOffset, yOffset, containerSize, containerSize);
        }
        
        // Draw filled soul container with clipping based on soul percentage
        if (soulPercent > 0 && soulFullImg.complete) {
            ctx.save();
            // Clip from bottom up based on soul percentage
            const fillHeight = containerSize * soulPercent;
            ctx.beginPath();
            ctx.rect(xOffset, yOffset + containerSize - fillHeight, containerSize, fillHeight);
            ctx.clip();
            ctx.drawImage(soulFullImg, xOffset, yOffset, containerSize, containerSize);
            ctx.restore();
        }
        
        // Soul number
        ctx.fillStyle = '#000';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(Math.floor(player.soul).toString(), xOffset + containerSize / 2, yOffset + containerSize / 2 + 5);
        
        // Heal progress indicator
        if (player.isHealing) {
            const elapsed = Date.now() - player.healStartTime;
            const progress = elapsed / 900;
            
            ctx.strokeStyle = '#4CAF50';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(xOffset + containerSize / 2, yOffset + containerSize / 2, containerSize / 2 + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
            ctx.stroke();
        }
        
        // Update xOffset for HP hearts
        return { ...data, xOffset: xOffset + containerSize + 20 };
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
    
    // Check if player is touching a wall on either side
    // Returns: -1 = touching left wall, 1 = touching right wall, 0 = no wall contact
    function checkWallContact(player, world) {
        const margin = 2; // How close to count as "touching"
        
        // Check left side
        const leftBox = { 
            x: player.x - margin, 
            y: player.y + 4, // Slightly inside to avoid corners
            width: margin, 
            height: player.height - 8 
        };
        
        // Check right side
        const rightBox = { 
            x: player.x + player.width, 
            y: player.y + 4, 
            width: margin, 
            height: player.height - 8 
        };
        
        let touchingLeft = false;
        let touchingRight = false;
        
        for (const obj of world.objects) {
            if (!obj.collision) continue;
            if (obj.actingType === 'text' || obj.actingType === 'teleportal') continue;
            
            if (boxIntersects(leftBox, obj)) touchingLeft = true;
            if (boxIntersects(rightBox, obj)) touchingRight = true;
        }
        
        // Prioritize the direction player is facing/moving
        if (touchingLeft && touchingRight) {
            return player.facingDirection === -1 ? -1 : 1;
        }
        if (touchingLeft) return -1;
        if (touchingRight) return 1;
        return 0;
    }
    
    function checkCollisions(player, world, direction) {
        const collisions = [];
        // Check slightly ahead in the direction of movement
        const lookAhead = direction === 'horizontal' ? 
            { x: player.x + (player.superDashDirection || player.facingDirection) * 5, y: player.y } :
            { x: player.x, y: player.y + 5 };
        const box = { x: lookAhead.x, y: lookAhead.y, width: player.width, height: player.height };
        
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
