/**
 * Code Plugin - Inject Script
 * Handles runtime trigger evaluation and action execution
 */

(function() {
    'use strict';
    
    const pluginId = 'code';
    
    // Get plugin manager
    const getPluginManager = () => typeof pluginManager !== 'undefined' ? pluginManager : null;
    
    // Check if plugin is enabled
    const isEnabled = () => {
        const pm = getPluginManager();
        return pm && pm.isEnabled(pluginId);
    };
    
    // Get world's code data safely
    const getCodeData = (world) => {
        if (!world) return { triggers: [], actions: [] };
        if (!world.codeData) {
            world.codeData = { triggers: [], actions: [] };
        }
        return world.codeData;
    };
    
    // Get all zones in the world
    const getZones = (world) => {
        if (!world || !world.objects) return [];
        return world.objects.filter(obj => obj.appearanceType === 'zone' && obj.zoneName);
    };
    
    // Find zone by name
    const findZone = (world, zoneName) => {
        if (!zoneName) return null;
        return getZones(world).find(z => z.zoneName === zoneName);
    };
    
    // Check if player is inside a zone (AABB collision)
    const isPlayerInZone = (player, zone) => {
        if (!player || !zone) return false;
        
        const playerLeft = player.x;
        const playerRight = player.x + (player.width || 24);
        const playerTop = player.y;
        const playerBottom = player.y + (player.height || 24);
        
        const zoneLeft = zone.x;
        const zoneRight = zone.x + zone.width;
        const zoneTop = zone.y;
        const zoneBottom = zone.y + zone.height;
        
        return playerLeft < zoneRight && 
               playerRight > zoneLeft && 
               playerTop < zoneBottom && 
               playerBottom > zoneTop;
    };
    
    // Track player state for triggers (per-player in multiplayer)
    const createPlayerState = () => ({
        previousZones: new Set(),
        currentZones: new Set(),
        fallStartY: null,
        fallStartTime: null,
        isFalling: false,
        wasFalling: false, // For single "fall" trigger (not continuous)
        wasJumping: false,
        jumpStartTime: null,
        lastJumpWasGrounded: false,
        justJumped: false // Set by player.jump hook
    });
    
    // Global state
    const globalState = {
        gameStarted: false,
        gameStartFired: false,
        repeatTimers: new Map(), // trigger id -> last execution time
        pressedKeys: new Set(),
        keyJustPressed: new Set(), // Keys that were just pressed this frame
        playerStates: new Map() // player id -> player state
    };
    
    // Get or create player state
    const getPlayerState = (player) => {
        if (!player || !player.id) return createPlayerState();
        
        if (!globalState.playerStates.has(player.id)) {
            globalState.playerStates.set(player.id, createPlayerState());
        }
        return globalState.playerStates.get(player.id);
    };
    
    // Execute an action by ID
    const executeAction = (actionId, world, player, context = {}) => {
        if (!actionId) return;
        
        const codeData = getCodeData(world);
        const action = codeData.actions.find(a => a.id === actionId);
        
        if (!action || !action.enabled) {
            return;
        }
        
        // Execute Python code (if available)
        if (action.code && typeof runPython === 'function') {
            try {
                // Provide context to the Python code
                const pythonContext = {
                    player: player ? {
                        x: player.x,
                        y: player.y,
                        vx: player.vx,
                        vy: player.vy
                    } : null,
                    ...context
                };
                
                runPython(action.code, {
                    onError: (err) => {
                        console.warn(`[Code Plugin] Action "${action.name}" error:`, err);
                    }
                });
            } catch (e) {
                console.warn(`[Code Plugin] Action "${action.name}" failed:`, e);
            }
        }
    };
    
    // Check if trigger should fire
    const evaluateTrigger = (trigger, world, player, data) => {
        if (!trigger || !trigger.enabled) return false;
        
        const config = trigger.config || {};
        const playerState = getPlayerState(player);
        
        try {
            switch (trigger.triggerType) {
                case CODE_TRIGGER_TYPES.GAME_STARTS:
                    // Only fires once per game session
                    if (globalState.gameStarted && !globalState.gameStartFired) {
                        globalState.gameStartFired = true;
                        return true;
                    }
                    return false;
                    
                case CODE_TRIGGER_TYPES.PLAYER_ENTER_ZONE:
                    if (!config.zoneName) return false;
                    const enterZone = findZone(world, config.zoneName);
                    if (!enterZone) return false; // Zone doesn't exist - skip silently
                    return playerState.currentZones.has(config.zoneName) && 
                           !playerState.previousZones.has(config.zoneName);
                           
                case CODE_TRIGGER_TYPES.PLAYER_LEAVE_ZONE:
                    if (!config.zoneName) return false;
                    const leaveZone = findZone(world, config.zoneName);
                    if (!leaveZone) return false; // Zone doesn't exist - skip silently
                    return !playerState.currentZones.has(config.zoneName) && 
                           playerState.previousZones.has(config.zoneName);
                           
                case CODE_TRIGGER_TYPES.REPEAT:
                    const interval = Math.max(1, config.interval || 1);
                    const unit = config.unit || 'seconds';
                    const now = Date.now();
                    const lastExec = globalState.repeatTimers.get(trigger.id) || 0;
                    
                    let intervalMs;
                    switch (unit) {
                        case 'ticks':
                            intervalMs = interval * (1000 / 60); // ~16.67ms per tick at 60fps
                            break;
                        case 'minutes':
                            intervalMs = interval * 60000;
                            break;
                        case 'seconds':
                        default:
                            intervalMs = interval * 1000;
                    }
                    
                    // First run after game starts: use a small delay to avoid immediate fire
                    if (lastExec === 0) {
                        globalState.repeatTimers.set(trigger.id, now);
                        return false;
                    }
                    
                    if (now - lastExec >= intervalMs) {
                        globalState.repeatTimers.set(trigger.id, now);
                        return true;
                    }
                    return false;
                    
                case CODE_TRIGGER_TYPES.PLAYER_KEY_INPUT:
                    if (!config.keys || config.keys.length === 0) return false;
                    
                    // All specified keys must be pressed simultaneously
                    const allKeysPressed = config.keys.every(key => {
                        if (key === 'any') {
                            return globalState.pressedKeys.size > 0;
                        }
                        if (key === 'all') {
                            return globalState.pressedKeys.size > 0; // At least one key
                        }
                        if (key === 'allAlphabet') {
                            const alphabetKeys = ['KeyA','KeyB','KeyC','KeyD','KeyE','KeyF','KeyG','KeyH','KeyI','KeyJ','KeyK','KeyL','KeyM','KeyN','KeyO','KeyP','KeyQ','KeyR','KeyS','KeyT','KeyU','KeyV','KeyW','KeyX','KeyY','KeyZ'];
                            return alphabetKeys.some(k => globalState.pressedKeys.has(k));
                        }
                        if (key === 'allNumbers') {
                            const numberKeys = ['Digit0','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9'];
                            return numberKeys.some(k => globalState.pressedKeys.has(k));
                        }
                        if (key === 'allAlphanumeric') {
                            const alphanumericKeys = [
                                'KeyA','KeyB','KeyC','KeyD','KeyE','KeyF','KeyG','KeyH','KeyI','KeyJ','KeyK','KeyL','KeyM','KeyN','KeyO','KeyP','KeyQ','KeyR','KeyS','KeyT','KeyU','KeyV','KeyW','KeyX','KeyY','KeyZ',
                                'Digit0','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9'
                            ];
                            return alphanumericKeys.some(k => globalState.pressedKeys.has(k));
                        }
                        return globalState.pressedKeys.has(key);
                    });
                    
                    // Only fire once when combination is first pressed, not continuously
                    if (allKeysPressed && globalState.keyJustPressed.size > 0) {
                        return true;
                    }
                    return false;
                    
                case CODE_TRIGGER_TYPES.PLAYER_ACTION_INPUT:
                    const action = config.action;
                    if (!action) return false;
                    
                    switch (action) {
                        case 'jump':
                            return playerState.justJumped === true;
                        case 'groundJump':
                            return playerState.justJumped === true && playerState.lastJumpWasGrounded === true;
                        case 'airJump':
                            return playerState.justJumped === true && playerState.lastJumpWasGrounded === false;
                        case 'die':
                            return data?.died === true;
                        case 'fall':
                            // Fire once when player starts falling
                            if (player?.vy > 0 && !playerState.wasFalling) {
                                playerState.wasFalling = true;
                                return true;
                            }
                            if (player?.vy <= 0 || player?.isOnGround || player?.grounded) {
                                playerState.wasFalling = false;
                            }
                            return false;
                        case 'fallForTime':
                            if (player?.vy > 0) {
                                if (!playerState.isFalling) {
                                    playerState.isFalling = true;
                                    playerState.fallStartTime = Date.now();
                                }
                                const fallTime = (Date.now() - playerState.fallStartTime) / 1000;
                                const targetTime = parseFloat(config.actionValue) || 1;
                                return fallTime >= targetTime;
                            }
                            return false;
                        case 'fallForDistance':
                            if (player?.vy > 0) {
                                if (!playerState.isFalling) {
                                    playerState.isFalling = true;
                                    playerState.fallStartY = player.y;
                                }
                                const fallDistance = player.y - playerState.fallStartY;
                                const targetDistance = parseFloat(config.actionValue) || 100;
                                return fallDistance >= targetDistance;
                            }
                            return false;
                        case 'move':
                            return (player?.vx !== 0 || player?.vy !== 0);
                        case 'moveHorizontally':
                            return player?.vx !== 0;
                        case 'moveLeft':
                            return player?.vx < 0;
                        case 'moveRight':
                            return player?.vx > 0;
                        case 'teleport':
                            return data?.teleported === true;
                        case 'touchOtherPlayer':
                            return data?.touchedPlayer === true;
                        // Message triggers would require chat integration
                        case 'sendMessage':
                        case 'sendMessageExact':
                        case 'sendMessageContains':
                        case 'sendMessageExcludes':
                            // TODO: Implement when chat system is available
                            return false;
                        default:
                            return false;
                    }
                    
                case CODE_TRIGGER_TYPES.PLAYER_STATS:
                    // These require comparing player properties
                    const stat = config.stat;
                    const statValue = config.statValue;
                    if (!stat || !statValue || !player) return false;
                    
                    let playerValue = '';
                    switch (stat) {
                        case 'username':
                            playerValue = player.username || player.name || '';
                            break;
                        case 'displayName':
                            playerValue = player.displayName || player.name || '';
                            break;
                        case 'color':
                            playerValue = player.color || '';
                            break;
                        case 'tag':
                            playerValue = player.tag || '';
                            break;
                        case 'hostOrGuest':
                            playerValue = player.isHost ? 'host' : 'guest';
                            break;
                    }
                    
                    return playerValue.toLowerCase() === statValue.toLowerCase();
                    
                default:
                    return false;
            }
        } catch (error) {
            console.warn(`[Code Plugin] Error evaluating trigger "${trigger.name}":`, error);
            return false;
        }
    };
    
    // Reset game state (call when game restarts)
    const resetGameState = () => {
        globalState.gameStarted = true;
        globalState.gameStartFired = false;
        globalState.repeatTimers.clear();
        globalState.playerStates.clear();
    };
    
    // Register hooks
    const pm = getPluginManager();
    if (pm) {
        // Player update hook - track zones and evaluate triggers
        pm.registerHook('player.update', (data) => {
            if (!isEnabled()) return data;
            
            const { player, world } = data;
            if (!player || !world) return data;
            
            const playerState = getPlayerState(player);
            
            // Mark game as started on first player update (handles game.start)
            if (!globalState.gameStarted) {
                globalState.gameStarted = true;
                // Don't fire gameStarted trigger immediately - wait for next frame
            }
            
            // Store previous zone state
            playerState.previousZones = new Set(playerState.currentZones);
            playerState.currentZones.clear();
            
            // Check which zones player is currently in
            const zones = getZones(world);
            for (const zone of zones) {
                if (isPlayerInZone(player, zone)) {
                    playerState.currentZones.add(zone.zoneName);
                }
            }
            
            // Track fall state
            if (player.vy > 0 && !player.isOnGround && !player.grounded) {
                if (!playerState.isFalling) {
                    playerState.isFalling = true;
                    playerState.fallStartY = player.y;
                    playerState.fallStartTime = Date.now();
                }
            } else if (player.isOnGround || player.grounded || player.vy <= 0) {
                playerState.isFalling = false;
                playerState.fallStartY = null;
                playerState.fallStartTime = null;
            }
            
            // Evaluate all triggers
            const codeData = getCodeData(world);
            for (const trigger of codeData.triggers || []) {
                try {
                    if (evaluateTrigger(trigger, world, player, data)) {
                        // Execute linked action if any
                        if (trigger.config?.actionId) {
                            executeAction(trigger.config.actionId, world, player, {
                                trigger: trigger.name,
                                triggerType: trigger.triggerType
                            });
                        }
                    }
                } catch (error) {
                    console.warn(`[Code Plugin] Error processing trigger "${trigger.name}":`, error);
                }
            }
            
            // Clear just-pressed keys after processing
            globalState.keyJustPressed.clear();
            
            return data;
        });
        
        // Player jump hook - track jump events
        pm.registerHook('player.jump', (data) => {
            if (!isEnabled()) return data;
            
            const { player } = data;
            if (!player) return data;
            
            const playerState = getPlayerState(player);
            
            // Track if this was a grounded jump
            playerState.lastJumpWasGrounded = player.isOnGround || player.grounded || false;
            playerState.justJumped = true;
            
            // Clear after a short delay
            setTimeout(() => {
                playerState.justJumped = false;
            }, 100);
            
            return data;
        });
        
        // Track key presses
        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', (e) => {
                if (!globalState.pressedKeys.has(e.code)) {
                    globalState.keyJustPressed.add(e.code);
                }
                globalState.pressedKeys.add(e.code);
            });
            
            window.addEventListener('keyup', (e) => {
                globalState.pressedKeys.delete(e.code);
            });
            
            window.addEventListener('blur', () => {
                globalState.pressedKeys.clear();
                globalState.keyJustPressed.clear();
            });
        }
    }
    
    // Expose reset function for testing/debugging
    if (typeof window !== 'undefined') {
        window.CodePluginReset = resetGameState;
    }
})();
