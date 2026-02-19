/**
 * PARKOREEN - Plugin Manager
 * Handles loading, enabling, and managing game plugins
 */

// ============================================
// PLUGIN MANAGER
// ============================================
class PluginManager {
    constructor() {
        this.plugins = new Map(); // pluginId -> plugin metadata
        this.enabled = new Set(); // Set of enabled plugin IDs
        this.loadedScripts = new Map(); // pluginId -> { globals, inject, script }
        this.sounds = new Map(); // pluginId -> { soundName: Audio }
        this.hooks = {}; // Hook name -> array of callbacks
        this.basePath = '/parkoreen/assets/plugins/';
    }
    
    // ============================================
    // PLUGIN DISCOVERY & LOADING
    // ============================================
    
    async discoverPlugins() {
        // List of known plugins (could be made dynamic later)
        const pluginIds = ['hp', 'hk', 'code'];
        
        for (const id of pluginIds) {
            try {
                const pluginPath = id === 'hk' ? 'hk' : id;
                const response = await fetch(`${this.basePath}${pluginPath}/plugin.json`);
                if (response.ok) {
                    const metadata = await response.json();
                    this.plugins.set(metadata.id, {
                        ...metadata,
                        path: `${this.basePath}${pluginPath}/`
                    });
                }
            } catch (e) {
                console.warn(`Failed to load plugin ${id}:`, e);
            }
        }
        
        return Array.from(this.plugins.values());
    }
    
    async loadPluginScripts(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin || this.loadedScripts.has(pluginId)) return;
        
        const scripts = {};
        
        // Load library scripts first (executed as <script> tags for global scope)
        // These are scripts that need to run in global scope (like Skulpt)
        const libraryScripts = ['skulpt', 'skulptStdlib', 'pythonCompiler'];
        for (const scriptName of libraryScripts) {
            if (plugin.scripts?.[scriptName]) {
                try {
                    await this.loadScriptTag(plugin.path + plugin.scripts[scriptName]);
                } catch (e) {
                    console.warn(`Failed to load ${scriptName} for ${pluginId}:`, e);
                }
            }
        }
        
        // Load globals (fetched as text for eval)
        if (plugin.scripts?.globals) {
            try {
                const response = await fetch(plugin.path + plugin.scripts.globals);
                if (response.ok) {
                    scripts.globals = await response.text();
                }
            } catch (e) {
                console.warn(`Failed to load globals for ${pluginId}:`, e);
            }
        }
        
        // Load inject
        if (plugin.scripts?.inject) {
            try {
                const response = await fetch(plugin.path + plugin.scripts.inject);
                if (response.ok) {
                    scripts.inject = await response.text();
                }
            } catch (e) {
                console.warn(`Failed to load inject for ${pluginId}:`, e);
            }
        }
        
        // Load main script
        if (plugin.scripts?.script) {
            try {
                const response = await fetch(plugin.path + plugin.scripts.script);
                if (response.ok) {
                    scripts.script = await response.text();
                }
            } catch (e) {
                console.warn(`Failed to load script for ${pluginId}:`, e);
            }
        }
        
        // Load editor script (for plugins with editor UI)
        if (plugin.scripts?.editor) {
            try {
                await this.loadScriptTag(plugin.path + plugin.scripts.editor);
            } catch (e) {
                console.warn(`Failed to load editor for ${pluginId}:`, e);
            }
        }
        
        this.loadedScripts.set(pluginId, scripts);
        
        // Load sounds
        if (plugin.sounds) {
            await this.loadPluginSounds(pluginId, plugin);
        }
    }
    
    // Load a script as a <script> tag (for libraries that need global scope)
    loadScriptTag(src) {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    async loadPluginSounds(pluginId, plugin) {
        const sounds = {};
        
        for (const [name, path] of Object.entries(plugin.sounds)) {
            if (Array.isArray(path)) {
                // Multiple sounds (for random selection)
                sounds[name] = path.map(p => {
                    const audio = new Audio(plugin.path + p);
                    audio.volume = 1;
                    return audio;
                });
            } else {
                const audio = new Audio(plugin.path + path);
                audio.volume = 1;
                if (name === 'superdashFlying') {
                    audio.loop = true;
                }
                sounds[name] = audio;
            }
        }
        
        this.sounds.set(pluginId, sounds);
    }
    
    // ============================================
    // PLUGIN ENABLE/DISABLE
    // ============================================
    
    async enablePlugin(pluginId, world) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) return { success: false, error: 'Plugin not found' };
        
        // Check dependencies
        for (const depId of plugin.dependencies || []) {
            if (!this.enabled.has(depId)) {
                // Auto-enable dependency
                const result = await this.enablePlugin(depId, world);
                if (!result.success) {
                    return { success: false, error: `Dependency ${depId} failed: ${result.error}` };
                }
            }
        }
        
        // Load scripts if not loaded
        await this.loadPluginScripts(pluginId);
        
        // Execute globals (defines constants/variables)
        const scripts = this.loadedScripts.get(pluginId);
        if (scripts?.globals) {
            try {
                eval(scripts.globals);
            } catch (e) {
                console.error(`Error executing globals for ${pluginId}:`, e);
            }
        }
        
        // Execute inject (hooks into game systems)
        if (scripts?.inject) {
            try {
                // Create a context for the plugin
                const ctx = {
                    pluginManager: this,
                    pluginId,
                    world,
                    hooks: this.hooks,
                    sounds: this.sounds.get(pluginId) || {}
                };
                const injectFn = new Function('ctx', scripts.inject);
                injectFn(ctx);
            } catch (e) {
                console.error(`Error executing inject for ${pluginId}:`, e);
            }
        }
        
        // Execute main script
        if (scripts?.script) {
            try {
                eval(scripts.script);
            } catch (e) {
                console.error(`Error executing script for ${pluginId}:`, e);
            }
        }
        
        this.enabled.add(pluginId);
        
        // Add to world's enabled plugins and initialize config if needed
        if (world) {
            if (!world.plugins.enabled.includes(pluginId)) {
                world.plugins.enabled.push(pluginId);
            }
            // Initialize default config for plugin if not exists
            if (!world.plugins[pluginId] && plugin.config) {
                world.plugins[pluginId] = {};
                for (const [key, config] of Object.entries(plugin.config)) {
                    world.plugins[pluginId][key] = config.default;
                }
            }
        }
        
        return { success: true };
    }
    
    disablePlugin(pluginId, world) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) return { success: false, error: 'Plugin not found' };
        
        // Check if other enabled plugins depend on this one
        for (const [otherId, otherPlugin] of this.plugins) {
            if (this.enabled.has(otherId) && (otherPlugin.dependencies || []).includes(pluginId)) {
                return { 
                    success: false, 
                    error: `Cannot disable: ${otherPlugin.name} depends on this plugin`
                };
            }
        }
        
        // Check for plugin objects in the world
        if (world) {
            const pluginObjects = this.getPluginObjects(pluginId, world);
            if (pluginObjects.length > 0) {
                const locations = pluginObjects.map(o => `${o.section}/${o.name}`).join(', ');
                return {
                    success: false,
                    error: `Cannot disable: Objects still using this plugin at: ${locations}`
                };
            }
        }
        
        this.enabled.delete(pluginId);
        
        // Remove from world's enabled plugins
        if (world) {
            const idx = world.plugins.enabled.indexOf(pluginId);
            if (idx !== -1) {
                world.plugins.enabled.splice(idx, 1);
            }
        }
        
        // Clean up hooks for this plugin
        for (const hookName in this.hooks) {
            this.hooks[hookName] = this.hooks[hookName].filter(h => h.pluginId !== pluginId);
        }
        
        return { success: true };
    }
    
    isEnabled(pluginId) {
        return this.enabled.has(pluginId);
    }
    
    getPluginObjects(pluginId, world) {
        const objects = [];
        
        if (pluginId === 'hk') {
            for (const obj of world.objects) {
                if (obj.actingType === 'soulStatus') {
                    objects.push({ section: 'Map', name: 'Soul Status', obj });
                }
            }
        }
        
        return objects;
    }
    
    // ============================================
    // HOOK SYSTEM
    // ============================================
    
    /**
     * Register a hook callback
     * @param {string} hookName - Name of the hook
     * @param {Function} callback - Callback function
     * @param {string} pluginId - ID of the plugin registering the hook
     * @param {number} priority - Lower priority runs first (default: 10)
     */
    registerHook(hookName, callback, pluginId, priority = 10) {
        if (!this.hooks[hookName]) {
            this.hooks[hookName] = [];
        }
        
        this.hooks[hookName].push({ callback, pluginId, priority });
        this.hooks[hookName].sort((a, b) => a.priority - b.priority);
    }
    
    /**
     * Execute all callbacks for a hook
     * @param {string} hookName - Name of the hook
     * @param {Object} data - Data to pass to callbacks
     * @returns {Object} - Modified data after all callbacks
     */
    executeHook(hookName, data = {}) {
        const hooks = this.hooks[hookName] || [];
        
        for (const hook of hooks) {
            try {
                const result = hook.callback(data);
                if (result !== undefined) {
                    data = { ...data, ...result };
                }
            } catch (e) {
                console.error(`Error in hook ${hookName} from ${hook.pluginId}:`, e);
            }
        }
        
        return data;
    }
    
    /**
     * Check if a hook should prevent default behavior
     * @param {string} hookName - Name of the hook
     * @param {Object} data - Data to pass to callbacks
     * @returns {boolean} - True if any callback returned { preventDefault: true }
     */
    shouldPreventDefault(hookName, data = {}) {
        const result = this.executeHook(hookName, data);
        return result.preventDefault === true;
    }
    
    // ============================================
    // SOUND HELPERS
    // ============================================
    
    playSound(pluginId, soundName, volume = 1) {
        const sounds = this.sounds.get(pluginId);
        if (!sounds) return;
        
        const sound = sounds[soundName];
        if (!sound) return;
        
        if (Array.isArray(sound)) {
            // Play random from array
            const s = sound[Math.floor(Math.random() * sound.length)];
            s.volume = volume;
            s.currentTime = 0;
            s.play().catch(() => {});
        } else {
            sound.volume = volume;
            sound.currentTime = 0;
            sound.play().catch(() => {});
        }
    }
    
    stopSound(pluginId, soundName) {
        const sounds = this.sounds.get(pluginId);
        if (!sounds) return;
        
        const sound = sounds[soundName];
        if (sound && !Array.isArray(sound)) {
            sound.pause();
            sound.currentTime = 0;
        }
    }
    
    // ============================================
    // CONFIG HELPERS
    // ============================================
    
    getDefaultConfig(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin || !plugin.config) return {};
        
        const config = {};
        for (const [key, def] of Object.entries(plugin.config)) {
            config[key] = def.default;
        }
        return config;
    }
    
    // ============================================
    // SERIALIZATION
    // ============================================
    
    /**
     * Initialize plugins from world data (called when loading a map)
     */
    async initFromWorld(world) {
        // Ensure plugins are discovered first
        if (this.plugins.size === 0) {
            await this.discoverPlugins();
        }
        
        // Clear current state
        this.enabled.clear();
        for (const hookName in this.hooks) {
            this.hooks[hookName] = [];
        }
        
        // Enable plugins that are in the world's enabled list
        for (const pluginId of world.plugins?.enabled || []) {
            await this.enablePlugin(pluginId, world);
        }
    }
}

// Global plugin manager instance
window.PluginManager = new PluginManager();

// ============================================
// AVAILABLE HOOKS
// ============================================
/*
Hooks that plugins can register for:

PLAYER HOOKS:
- player.init(player, world) - Called when a player is initialized
- player.update(player, world, deltaTime) - Called each frame to update player
- player.damage(player, source, world) - Called when player takes damage, return { preventDefault: true } to cancel death
- player.die(player, world) - Called when player dies
- player.respawn(player, world) - Called when player respawns
- player.jump(player, world) - Called when player jumps
- player.land(player, world) - Called when player lands on ground

INPUT HOOKS:
- input.keydown(key, player) - Called on keydown
- input.keyup(key, player) - Called on keyup

RENDER HOOKS:
- render.hud(ctx, player, world) - Called to render HUD elements
- render.player(ctx, player, camera) - Called after player is rendered

COLLISION HOOKS:
- collision.spike(player, spike, world) - Called when player touches spike
- collision.checkpoint(player, checkpoint, world) - Called when player touches checkpoint
*/
