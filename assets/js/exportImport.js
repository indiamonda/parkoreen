/**
 * PARKOREEN - Export/Import System
 * Handles .pkrn file format and map data serialization
 */

// ============================================
// FILE FORMAT VERSION
// ============================================
const PKRN_VERSION = '1.1';

// Default values for backward compatibility
const PKRN_DEFAULTS = {
    background: 'sky',
    defaultBlockColor: '#787878',
    defaultSpikeColor: '#c45a3f',
    defaultTextColor: '#000000',
    maxJumps: 1,
    infiniteJumps: false,
    additionalAirjump: false,
    collideWithEachOther: true,
    dieLineY: 2000,
    playerSpeed: 5,
    jumpForce: -14,
    gravity: 0.8
};

// ============================================
// EXPORT MANAGER
// ============================================
class ExportManager {
    constructor() {
        this.version = PKRN_VERSION;
    }

    /**
     * Export world data to .pkrn file
     * @param {World} world - The world object to export
     * @param {string} filename - Optional filename (without extension)
     */
    exportToFile(world, filename = null) {
        const data = this.serialize(world);
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const name = filename || world.mapName || 'untitled_map';
        const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.pkrn`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return true;
    }

    /**
     * Export world data to JSON string
     * @param {World} world - The world object to export
     * @returns {string} JSON string
     */
    exportToString(world) {
        const data = this.serialize(world);
        return JSON.stringify(data);
    }

    /**
     * Export world data to base64 string (for URL sharing)
     * @param {World} world - The world object to export
     * @returns {string} Base64 encoded string
     */
    exportToBase64(world) {
        const json = this.exportToString(world);
        return btoa(encodeURIComponent(json));
    }

    /**
     * Serialize world to exportable format
     * @param {World} world - The world object
     * @returns {Object} Serialized data
     */
    serialize(world) {
        return {
            version: this.version,
            metadata: {
                name: world.mapName,
                createdAt: new Date().toISOString(),
                objectCount: world.objects.length
            },
            settings: {
                background: world.background,
                defaultBlockColor: world.defaultBlockColor,
                defaultSpikeColor: world.defaultSpikeColor,
                defaultTextColor: world.defaultTextColor,
                maxJumps: world.maxJumps,
                infiniteJumps: world.infiniteJumps,
                additionalAirjump: world.additionalAirjump,
                collideWithEachOther: world.collideWithEachOther,
                dieLineY: world.dieLineY,
                // Physics settings
                playerSpeed: world.playerSpeed,
                jumpForce: world.jumpForce,
                gravity: world.gravity
            },
            objects: world.objects.map(obj => this.serializeObject(obj))
        };
    }

    /**
     * Serialize a single world object
     * @param {WorldObject} obj - The object to serialize
     * @returns {Object} Serialized object data
     */
    serializeObject(obj) {
        const data = {
            id: obj.id,
            x: obj.x,
            y: obj.y,
            w: obj.width,
            h: obj.height,
            t: obj.type,
            at: obj.appearanceType,
            act: obj.actingType,
            col: obj.collision ? 1 : 0,
            c: obj.color,
            o: obj.opacity,
            l: obj.layer,
            r: obj.rotation,
            n: obj.name
        };

        // Text-specific properties
        if (obj.type === 'text') {
            data.txt = obj.content;
            data.f = obj.font;
            data.fs = obj.fontSize;
            data.ha = obj.hAlign;
            data.va = obj.vAlign;
            data.hs = obj.hSpacing;
            data.vs = obj.vSpacing;
        }

        return data;
    }
}

// ============================================
// IMPORT MANAGER
// ============================================
class ImportManager {
    constructor() {
        this.supportedVersions = ['1.0', '1.1'];
    }

    /**
     * Import from file
     * @param {File} file - The file to import
     * @returns {Promise<Object>} Parsed data
     */
    importFromFile(file) {
        return new Promise((resolve, reject) => {
            if (!file.name.endsWith('.pkrn')) {
                reject(new Error('Invalid file type. Please select a .pkrn file.'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    const result = this.validate(data);
                    if (result.valid) {
                        resolve(this.deserialize(data));
                    } else {
                        reject(new Error(result.error));
                    }
                } catch (err) {
                    reject(new Error('Failed to parse file: ' + err.message));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Import from JSON string
     * @param {string} json - JSON string to import
     * @returns {Object} Parsed data
     */
    importFromString(json) {
        try {
            const data = JSON.parse(json);
            const result = this.validate(data);
            if (result.valid) {
                return this.deserialize(data);
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            throw new Error('Failed to parse data: ' + err.message);
        }
    }

    /**
     * Import from base64 string
     * @param {string} base64 - Base64 encoded string
     * @returns {Object} Parsed data
     */
    importFromBase64(base64) {
        try {
            const json = decodeURIComponent(atob(base64));
            return this.importFromString(json);
        } catch (err) {
            throw new Error('Failed to decode data: ' + err.message);
        }
    }

    /**
     * Validate imported data
     * @param {Object} data - Data to validate
     * @returns {Object} Validation result
     */
    validate(data) {
        if (!data || typeof data !== 'object') {
            return { valid: false, error: 'Invalid data format' };
        }

        if (!data.version) {
            return { valid: false, error: 'Missing version information' };
        }

        if (!this.supportedVersions.includes(data.version)) {
            return { valid: false, error: `Unsupported version: ${data.version}` };
        }

        if (!data.objects || !Array.isArray(data.objects)) {
            return { valid: false, error: 'Missing or invalid objects array' };
        }

        return { valid: true };
    }

    /**
     * Deserialize data to world format
     * Uses PKRN_DEFAULTS for any missing or invalid values (backward compatibility)
     * @param {Object} data - Serialized data
     * @returns {Object} World-compatible data
     */
    deserialize(data) {
        const settings = data.settings || {};
        
        // Helper to get value with type validation and default fallback
        const getNumber = (val, def, validator = () => true) => {
            return (typeof val === 'number' && validator(val)) ? val : def;
        };
        const getBool = (val, def) => {
            return typeof val === 'boolean' ? val : def;
        };
        const getString = (val, def) => {
            return typeof val === 'string' && val.length > 0 ? val : def;
        };
        
        return {
            mapName: data.metadata?.name || 'Imported Map',
            background: getString(settings.background, PKRN_DEFAULTS.background),
            defaultBlockColor: getString(settings.defaultBlockColor, PKRN_DEFAULTS.defaultBlockColor),
            defaultSpikeColor: getString(settings.defaultSpikeColor, PKRN_DEFAULTS.defaultSpikeColor),
            defaultTextColor: getString(settings.defaultTextColor, PKRN_DEFAULTS.defaultTextColor),
            maxJumps: getNumber(settings.maxJumps, PKRN_DEFAULTS.maxJumps, v => v >= 0),
            infiniteJumps: getBool(settings.infiniteJumps, PKRN_DEFAULTS.infiniteJumps),
            additionalAirjump: getBool(settings.additionalAirjump, PKRN_DEFAULTS.additionalAirjump),
            collideWithEachOther: settings.collideWithEachOther !== false,
            dieLineY: getNumber(settings.dieLineY, PKRN_DEFAULTS.dieLineY),
            // Physics settings with validation
            playerSpeed: getNumber(settings.playerSpeed, PKRN_DEFAULTS.playerSpeed, v => v > 0),
            jumpForce: getNumber(settings.jumpForce, PKRN_DEFAULTS.jumpForce, v => v < 0),
            gravity: getNumber(settings.gravity, PKRN_DEFAULTS.gravity, v => v > 0),
            objects: (data.objects || []).map(obj => this.deserializeObject(obj))
        };
    }

    /**
     * Deserialize a single object
     * @param {Object} obj - Serialized object
     * @returns {Object} WorldObject-compatible data
     */
    deserializeObject(obj) {
        const data = {
            id: obj.id,
            x: obj.x,
            y: obj.y,
            width: obj.w || obj.width || 32,
            height: obj.h || obj.height || 32,
            type: obj.t || obj.type || 'block',
            appearanceType: obj.at || obj.appearanceType || 'ground',
            actingType: obj.act || obj.actingType || 'ground',
            collision: obj.col !== undefined ? !!obj.col : (obj.collision !== false),
            color: obj.c || obj.color || '#787878',
            opacity: obj.o !== undefined ? obj.o : (obj.opacity !== undefined ? obj.opacity : 1),
            layer: obj.l !== undefined ? obj.l : (obj.layer !== undefined ? obj.layer : 1),
            rotation: obj.r || obj.rotation || 0,
            name: obj.n || obj.name || 'Object'
        };

        // Text-specific properties
        if (data.type === 'text') {
            data.content = obj.txt || obj.content || '';
            data.font = obj.f || obj.font || 'Arial';
            data.fontSize = obj.fs || obj.fontSize || 24;
            data.hAlign = obj.ha || obj.hAlign || 'center';
            data.vAlign = obj.va || obj.vAlign || 'center';
            data.hSpacing = obj.hs || obj.hSpacing || 0;
            data.vSpacing = obj.vs || obj.vSpacing || 0;
        }

        return data;
    }
}

// ============================================
// CLOUD SYNC MANAGER
// ============================================
class CloudSyncManager {
    constructor(apiUrl) {
        this.apiUrl = apiUrl;
        this.exportManager = new ExportManager();
        this.importManager = new ImportManager();
    }

    /**
     * Save map to cloud
     * @param {World} world - World to save
     * @param {string} token - Auth token
     * @param {string} mapId - Optional map ID for updates
     * @returns {Promise<Object>} Save result
     */
    async saveToCloud(world, token, mapId = null) {
        const data = this.exportManager.serialize(world);
        
        const endpoint = mapId 
            ? `${this.apiUrl}/maps/${mapId}` 
            : `${this.apiUrl}/maps`;
        
        const method = mapId ? 'PUT' : 'POST';
        
        const response = await fetch(endpoint, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(error.message || 'Failed to save map');
        }

        return response.json();
    }

    /**
     * Load map from cloud
     * @param {string} mapId - Map ID to load
     * @param {string} token - Auth token
     * @returns {Promise<Object>} Map data
     */
    async loadFromCloud(mapId, token) {
        const response = await fetch(`${this.apiUrl}/maps/${mapId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(error.message || 'Failed to load map');
        }

        const data = await response.json();
        const result = this.importManager.validate(data);
        
        if (!result.valid) {
            throw new Error(result.error);
        }

        return this.importManager.deserialize(data);
    }

    /**
     * Delete map from cloud
     * @param {string} mapId - Map ID to delete
     * @param {string} token - Auth token
     * @returns {Promise<boolean>} Success status
     */
    async deleteFromCloud(mapId, token) {
        const response = await fetch(`${this.apiUrl}/maps/${mapId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(error.message || 'Failed to delete map');
        }

        return true;
    }

    /**
     * List all maps
     * @param {string} token - Auth token
     * @returns {Promise<Array>} List of maps
     */
    async listMaps(token) {
        const response = await fetch(`${this.apiUrl}/maps`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(error.message || 'Failed to list maps');
        }

        return response.json();
    }
}

// Export
window.ExportManager = ExportManager;
window.ImportManager = ImportManager;
window.CloudSyncManager = CloudSyncManager;
