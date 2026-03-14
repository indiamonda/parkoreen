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
        player.dashTrail = []; // Trail of recent positions for dash effect
        
        // Super Dash
        player.hasSuperDash = config.superDash || false;
        player.isSuperDashing = false;
        player.superDashCharging = false;
        player.superDashChargeStart = 0;
        player.superDashDirection = 1;
        player._playedCharge2 = false;
        player._superDashKeyReady = true;
        
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
        
        // Wall bounce state (horizontal push off wall)
        player.isWallBouncing = false;
        player.wallBounceEndTime = 0;
        player.wallBounceMidTime = 0; // Time when horizontal push stops (halfway through)
        player.wallBounceDirection = 0;
        player._monarchWingReady = true; // Must release and press jump to use monarch wing
        player._wasOnGround = true; // Track ground state for jump detection
        
        // Attack bounce invincibility (prevents damage during pogo bounce)
        player.attackBounceUntil = 0;
        
        // Attack hit flags (prevent variable jump height interference)
        player._pogoJumping = false;
        player._hitUpward = false;
        player._attackHitThisSwing = false;

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
            // Only check for wall contact if player is pressing toward a wall direction
            // This optimizes performance by avoiding collision checks when not needed
            const pressingLeft = player.input?.left && !player.input?.right;
            const pressingRight = player.input?.right && !player.input?.left;
            
            if ((pressingLeft || pressingRight) && player.vy >= 0) {
                // Player is pressing toward a wall and falling - check for wall contact
                const touchingWall = checkWallContact(player, world, pressingLeft ? -1 : 1);
                
                if (touchingWall !== 0) {
                    // Start or continue wall cling
                    if (!player.isWallClinging) {
                        player.isWallClinging = true;
                        player.wallClingDirection = touchingWall;
                        player.monarchWingsUsed = 0; // Reset double jump when grabbing wall
                    }
                } else {
                    player.isWallClinging = false;
                }
            } else if (player.isWallClinging) {
                // Not pressing toward wall anymore - release
                player.isWallClinging = false;
            }
        } else {
            player.isWallClinging = false;
        }
        
        // Reset wall cling on ground
        if (player.isOnGround) {
            player.isWallClinging = false;
        }
        
        // Track when player leaves ground via jump - disable monarch wing until jump released
        if (player._wasOnGround && !player.isOnGround && player.vy < 0 && player.input?.jump) {
            // Player just jumped from ground while holding jump
            player._monarchWingReady = false;
        }
        player._wasOnGround = player.isOnGround;
        
        // Handle wall bounce (horizontal push after wall jump)
        if (player.isWallBouncing) {
            if (now < player.wallBounceEndTime) {
                const playerSpeed = world?.playerSpeed ?? 5;
                
                // Horizontal push only happens during the first half of the bounce
                // Use reduced speed (30% of player speed) for gentler wall repel
                if (now < player.wallBounceMidTime) {
                    player.vx = player.wallBounceDirection * playerSpeed * 0.3;
                }
                // After midpoint, player regains horizontal control (vx handled by normal physics)
                
                // Normal gravity applies during bounce (0.5 is the default from game.js)
                const DEFAULT_GRAVITY = 0.5;
                const worldGravity = world?.gravity ?? DEFAULT_GRAVITY;
                player.vy += worldGravity;
                
                // Cap fall speed (same formula as main physics)
                const maxFallSpeed = 20 * (worldGravity / DEFAULT_GRAVITY);
                if (player.vy > maxFallSpeed) player.vy = maxFallSpeed;
                
                // Don't call moveWithCollision here - game engine will call it when skipPhysics is true
                return { ...data, skipPhysics: true };
            } else {
                // Bounce ended - return to normal physics
                player.isWallBouncing = false;
            }
        }
        
        // Handle wall cling physics - use skipPhysics to control fall speed
        if (player.isWallClinging) {
            const DEFAULT_GRAVITY_CLING = 0.5;
            const worldGravity = world?.gravity ?? DEFAULT_GRAVITY_CLING;
            const worldJumpForce = world?.jumpForce ?? -11;
            const playerSpeed = world?.playerSpeed ?? 5;
            
            // Check for wall jump input
            if (player.input?.jump && player._wallJumpReady !== false) {
                // Wall jump: push away from wall + modest upward jump
                player.isWallClinging = false;
                player.isWallBouncing = true;
                player.wallBounceDirection = -player.wallClingDirection;
                const bounceDuration = 60; // Wall bounce total duration (60ms) - very short
                player.wallBounceEndTime = now + bounceDuration;
                player.wallBounceMidTime = now + bounceDuration / 2; // Horizontal push stops at half duration
                
                // Horizontal push away from wall (30% of player speed for gentle repel)
                player.vx = player.wallBounceDirection * playerSpeed * 0.3;
                
                // Wall jump is 50% of normal jump (no gravity scaling - consistent height)
                player.vy = worldJumpForce * 0.5;
                
                player.facingDirection = player.wallBounceDirection;
                
                // Reset monarch wings (double jump) after wall jump
                player.monarchWingsUsed = 0;
                
                player._wallJumpReady = false; // Prevent repeated jumps from held key
                player._monarchWingReady = false; // Must release jump before monarch wing can trigger
                
                // Play normal jump sound
                if (audioManager) audioManager.play('jump');
                
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
            
            // Don't call moveWithCollision here - game engine will call it when skipPhysics is true
            return { ...data, skipPhysics: true };
        }
        
        // ===== ATTACK =====
        if (player.input?.attack && !player.isAttacking && now > player.attackCooldown) {
            // If wall clinging, force attack direction away from wall and detach
            if (player.isWallClinging) {
                player.facingDirection = -player.wallClingDirection;
                player.isWallClinging = false; // Detach from wall when attacking
            }
            
            let direction = 'forward';
            if (player.input?.up) direction = 'up';
            else if (player.input?.down && !player.isOnGround) direction = 'down';
            
            player.isAttacking = true;
            player.attackDirection = direction;
            player.attackStartTime = now;
            player._attackHitThisSwing = false; // Reset hit flag for new attack
        }
        
        // Continuous collision check during attack (for pogo bounce to work mid-attack)
        if (player.isAttacking && !player._attackHitThisSwing) {
            const hitbox = getAttackHitbox(player, player.attackDirection);
            const worldJumpForce = world?.jumpForce ?? -11;
            
            // Only check objects that can be hit (spike or soulStatus)
            for (let i = 0; i < world.objects.length; i++) {
                const obj = world.objects[i];
                // Quick reject: only check hittable objects
                const isHittable = obj.actingType === 'soulStatus' || (obj.actingType === 'spike' && obj.collision !== false);
                if (!isHittable) continue;
                
                // Quick reject: rough bounding box check before precise check
                if (obj.x > hitbox.x + hitbox.width + 50 || obj.x + obj.width < hitbox.x - 50 ||
                    obj.y > hitbox.y + hitbox.height + 50 || obj.y + obj.height < hitbox.y - 50) {
                    continue;
                }
                
                if (boxIntersects(hitbox, obj)) {
                    player._attackHitThisSwing = true;
                    
                    // Soul Statue - hit sound now, soul + getSoul sound 0.5s later
                    if (obj.actingType === 'soulStatus') {
                        pluginManager.playSound(pluginId, 'hitSoulStatus');
                        setTimeout(() => {
                            player.soul = Math.min(player.maxSoul, player.soul + 16.5);
                            pluginManager.playSound(pluginId, 'getSoul');
                        }, 500);
                    }
                    
                    // Bounce based on attack direction
                    if (player.attackDirection === 'down') {
                        const pogoMultiplier = HK_CONFIG.pogoBouncePower || 1.2;
                        player.vy = worldJumpForce * pogoMultiplier;
                        player.monarchWingsUsed = 0;
                        player._pogoJumping = true;
                    } else if (player.attackDirection === 'up') {
                        player.vy = 2;
                        player._hitUpward = true;
                    } else {
                        player.vx = -player.facingDirection * 5;
                    }
                    player.attackBounceUntil = now + 200;
                    break;
                }
            }
        }
        
        // Update attack state
        if (player.isAttacking && now - player.attackStartTime >= 200) {
            player.isAttacking = false;
            player._attackHitThisSwing = false; // Reset for next attack
            player.attackCooldown = now + 100;
        }
        
        // ===== DASH =====
        if (player.input?.dash && player.hasDash && !player.isDashing && now > player.dashCooldown) {
            // If wall clinging, force dash direction away from wall and detach
            if (player.isWallClinging) {
                player.facingDirection = -player.wallClingDirection;
                player.isWallClinging = false;
            }
            
            player.isDashing = true;
            player.dashStartTime = now;
            player.dashDirection = player.facingDirection;
            pluginManager.playSound(pluginId, 'dash');
        }
        
        if (player.isDashing) {
            const elapsed = now - player.dashStartTime;
            if (elapsed >= 150) { // Dash duration: 150ms
                player.isDashing = false;
                player.dashCooldown = now + 400;
            } else {
                // Add trail position every 25ms (not every frame) - max 6 positions
                const lastTrail = player.dashTrail[player.dashTrail.length - 1];
                if (!lastTrail || now - lastTrail.time >= 25) {
                    // Limit to 6 trail positions max
                    if (player.dashTrail.length >= 6) {
                        player.dashTrail.shift();
                    }
                    player.dashTrail.push({
                        x: player.x,
                        y: player.y,
                        time: now
                    });
                }
                
                player.vx = player.dashDirection * 12; // Dash speed
                player.vy = 0;
                return { ...data, skipPhysics: true };
            }
        } else if (player.dashTrail.length > 0) {
            // Clean up old trail only when there are items and not dashing
            const oldest = player.dashTrail[0];
            if (oldest && now - oldest.time > 200) {
                player.dashTrail.shift();
            }
        }
        
        // ===== SUPER DASH =====
        // Track key release to prevent instant re-charge after manual stop
        if (!player.input?.superDash) {
            player._superDashKeyReady = true;
        }
        
        if (player.input?.superDash && player.hasSuperDash && !player.isSuperDashing && !player.superDashCharging && player._superDashKeyReady) {
            // If wall clinging, force super dash direction away from wall and detach
            if (player.isWallClinging) {
                player.facingDirection = -player.wallClingDirection;
                player.isWallClinging = false;
            }
            
            player.superDashCharging = true;
            player.superDashChargeStart = now;
            player.superDashDirection = player.facingDirection;
            player._playedCharge2 = false;
            player._superDashKeyReady = false; // Require key release before next charge
            pluginManager.playSound(pluginId, 'superdashCharge1');
        }
        
        if (player.superDashCharging) {
            const elapsed = now - player.superDashChargeStart;
            
            // Play charge2 sound when charging finishes
            if (elapsed >= 800 && !player._playedCharge2) {
                player._playedCharge2 = true;
                pluginManager.playSound(pluginId, 'superdashCharge2');
            }
            
            // Release check - player releases key to burst
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
            
            // Super dash key, jump, or attack cancels super dash
            if (player.input?.superDash || player.input?.attack || player.input?.jump) {
                stopSuperDash(player, 'manual');
            }
            
            return { ...data, skipPhysics: true };
        }
        
        // ===== HEAL =====
        if (player.input?.heal && !player.isHealing && !player.isDashing && !player.isSuperDashing && player.isOnGround) {
            if (player.soul >= 33 && player.hp < player.maxHP) {
                player.isHealing = true;
                player.healStartTime = now;
                pluginManager.playSound(pluginId, 'healCharging');
            }
        }
        
        if (player.isHealing) {
            // Player cannot move while healing
            player.vx = 0;
            
            if (!player.input?.heal) {
                // Cancelled by releasing heal key
                player.isHealing = false;
                pluginManager.stopSound(pluginId, 'healCharging');
            } else if (!player.isOnGround) {
                // Cancelled by leaving ground (falling off edge, getting hit, etc.)
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
        // BUT don't interfere with pogo bounce or upward hit
        if (!player.input?.jump && player.vy < 0 && !player.isOnGround && !player._pogoJumping) {
            // Cap upward velocity to -2 so player starts falling sooner
            if (player.vy < -2) {
                player.vy = -2;
            }
        }
        
        // Reset pogo jumping flag when player starts falling or lands
        if (player._pogoJumping && (player.vy >= 0 || player.isOnGround)) {
            player._pogoJumping = false;
        }
        
        // Reset hit upward flag when player lands
        if (player._hitUpward && player.isOnGround) {
            player._hitUpward = false;
        }
        
        // Reset monarch wing ready when jump key is released (allows monarch wing on next press)
        if (!player.input?.jump) {
            player._monarchWingReady = true;
        }
        
        return data;
    }, pluginId);
    
    // ============================================
    // MONARCH WING JUMP HANDLING
    // (Mantis Claw wall jump is handled in player.update since it uses skipPhysics)
    // ============================================
    pluginManager.registerHook('player.jump', (data) => {
        const { player, canJump } = data;
        
        const worldJumpForce = world?.jumpForce ?? -11;
        
        // MONARCH WING - Double jump when out of normal jumps
        // Requires: jump key was released since last jump/wall jump (fresh press)
        if (!canJump && player.hasMonarchWing && !player.isOnGround && 
            player.monarchWingsUsed < player.monarchWingAmount &&
            player._monarchWingReady) {
            
            player.monarchWingsUsed++;
            player._monarchWingReady = false; // Must release jump again before next monarch wing
            
            // Monarch wing is 85% of normal jump (no gravity scaling - consistent height)
            player.vy = worldJumpForce * 0.85;
            
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
        player.isWallBouncing = false;
        return data;
    }, pluginId);
    
    // ============================================
    // ATTACK BOUNCE INVINCIBILITY - Prevent damage during pogo bounce
    // ============================================
    pluginManager.registerHook('player.damage', (data) => {
        const { player, source } = data;
        const now = Date.now();
        
        // If player is in attack bounce invincibility, prevent damage from spikes
        if (player.attackBounceUntil && now < player.attackBounceUntil) {
            if (source?.actingType === 'spike') {
                return { ...data, preventDefault: true };
            }
        }
        
        return data;
    }, pluginId, 1); // Priority 1 - run before HP plugin
    
    // ============================================
    // RESPAWN - Reset HK state
    // ============================================
    pluginManager.registerHook('player.respawn', (data) => {
        const { player } = data;
        
        player.soul = 0;
        player.isAttacking = false;
        player.isDashing = false;
        player.dashTrail = [];
        player.isSuperDashing = false;
        player.superDashCharging = false;
        player._playedCharge2 = false;
        player._superDashKeyReady = true;
        player.isHealing = false;
        player.monarchWingsUsed = 0;
        player.isWallClinging = false;
        player.isWallBouncing = false;
        player._wallJumpReady = true;
        player._monarchWingReady = true;
        player._wasOnGround = true;
        player.attackBounceUntil = 0;
        player._pogoJumping = false;
        player._hitUpward = false;
        
        return data;
    }, pluginId);
    
    // ============================================
    // PLAYER EFFECTS RENDERING - Attack slash, dash trail, etc.
    // ============================================
    pluginManager.registerHook('render.player', (data) => {
        const { ctx, player, camera } = data;
        
        // Draw dash trail effect (optimized)
        if (player.dashTrail && player.dashTrail.length > 0) {
            const now = Date.now();
            const color = player.color || '#45B7D1';
            
            ctx.save();
            ctx.fillStyle = color;
            
            for (let i = 0; i < player.dashTrail.length; i++) {
                const trail = player.dashTrail[i];
                const age = now - trail.time;
                if (age > 200) continue; // Skip expired trails
                
                const alpha = (1 - age / 200) * 0.4;
                ctx.globalAlpha = alpha;
                ctx.fillRect(
                    trail.x - camera.x,
                    trail.y - camera.y,
                    player.width,
                    player.height
                );
            }
            
            ctx.restore();
        }
        
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
            
            // Draw oval attack effect
            ctx.strokeStyle = '#fff';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 2;

            if (player.attackDirection === 'up') {
                // Upward attack - vertical oval above player
                const centerX = screenX + hitbox.width / 2;
                const centerY = screenY + hitbox.height / 2;
                const radiusX = hitbox.width / 2;
                const radiusY = hitbox.height / 2;
                ctx.beginPath();
                ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else if (player.attackDirection === 'down') {
                // Downward attack - vertical oval below player
                const centerX = screenX + hitbox.width / 2;
                const centerY = screenY + hitbox.height / 2;
                const radiusX = hitbox.width / 2;
                const radiusY = hitbox.height / 2;
                ctx.beginPath();
                ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else {
                // Forward attack - horizontal oval in front of player
                const centerX = screenX + hitbox.width / 2;
                const centerY = screenY + hitbox.height / 2;
                const radiusX = hitbox.width / 2;
                const radiusY = hitbox.height / 2;
                ctx.beginPath();
                ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
                ctx.fill();
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
    // HUD RENDERING - Soul vessel using SVG icons (TOP RIGHT)
    // ============================================
    pluginManager.registerHook('render.hud', (data) => {
        const { ctx, player } = data;
        const yOffset = data.yOffset || 20;
        
        const containerSize = 60;
        const soulPercent = player.soul / player.maxSoul;
        
        // Position Soul on top-right (matching SVG layout)
        const canvasWidth = ctx.canvas.width;
        const soulX = canvasWidth - containerSize - 20;
        
        // Draw empty soul container
        if (soulEmptyImg.complete) {
            ctx.drawImage(soulEmptyImg, soulX, yOffset, containerSize, containerSize);
        }
        
        // Draw filled soul container with clipping based on soul percentage
        if (soulPercent > 0 && soulFullImg.complete) {
            ctx.save();
            // Clip from bottom up based on soul percentage
            const fillHeight = containerSize * soulPercent;
            ctx.beginPath();
            ctx.rect(soulX, yOffset + containerSize - fillHeight, containerSize, fillHeight);
            ctx.clip();
            ctx.drawImage(soulFullImg, soulX, yOffset, containerSize, containerSize);
            ctx.restore();
        }
        
        // Soul number - white text with black outline for visibility
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const soulText = Math.floor(player.soul).toString();
        const textX = soulX + containerSize / 2;
        const textY = yOffset + containerSize / 2;
        
        // Black outline
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeText(soulText, textX, textY);
        
        // White fill
        ctx.fillStyle = '#fff';
        ctx.fillText(soulText, textX, textY);
        
        // Heal progress indicator
        if (player.isHealing) {
            const elapsed = Date.now() - player.healStartTime;
            const progress = elapsed / 900;
            
            ctx.strokeStyle = '#4CAF50';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(soulX + containerSize / 2, yOffset + containerSize / 2, containerSize / 2 + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
            ctx.stroke();
        }
        
        // HP stays on left side - don't modify xOffset
        return data;
    }, pluginId, 10); // Priority 10, runs before HP plugin
    
    // ============================================
    // HELPER FUNCTIONS
    // ============================================
    
    function getAttackHitbox(player, direction) {
        const attackLength = 72; // How far the attack reaches (length of oval)
        const attackWidth = 20; // Width of oval (shorter axis)

        if (direction === 'up') {
            return {
                x: player.x + (player.width - attackWidth) / 2,
                y: player.y - attackLength,
                width: attackWidth,
                height: attackLength
            };
        } else if (direction === 'down') {
            return {
                x: player.x + (player.width - attackWidth) / 2,
                y: player.y + player.height,
                width: attackWidth,
                height: attackLength
            };
        } else {
            // Forward attack - extends in the direction player is facing
            return {
                x: player.facingDirection > 0 ? player.x + player.width : player.x - attackLength,
                y: player.y + (player.height - attackWidth) / 2,
                width: attackLength,
                height: attackWidth
            };
        }
    }
    
    function boxIntersects(a, b) {
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    }
    
    // Check if player is touching a wall on a specific side
    // direction: -1 = check left only, 1 = check right only
    // Returns: -1 = touching left wall, 1 = touching right wall, 0 = no wall contact
    function checkWallContact(player, world, direction) {
        const margin = 2; // How close to count as "touching"
        
        // Only create the box for the side we're checking
        const checkBox = direction === -1 
            ? { x: player.x - margin, y: player.y + 4, width: margin, height: player.height - 8 }
            : { x: player.x + player.width, y: player.y + 4, width: margin, height: player.height - 8 };
        
        for (const obj of world.objects) {
            if (!obj.collision) continue;
            if (obj.actingType === 'text' || obj.actingType === 'teleportal') continue;
            
            if (boxIntersects(checkBox, obj)) {
                return direction; // Return the direction we found a wall
            }
        }
        
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
