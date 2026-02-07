/**
 * PARKOREEN - Export/Import System
 * Handles .pkrn file format and map data serialization
 * 
 * .pkrn format v2.0:
 * - Actually a ZIP file renamed to .pkrn
 * - Contains: data.json or data.dat, plus uploaded media files
 * - Backward compatible with v1.x (raw JSON)
 */

// ============================================
// FILE FORMAT VERSION
// ============================================
const PKRN_VERSION = '2.0';
const PKRN_FORMAT_JSON = 'json';
const PKRN_FORMAT_DAT = 'dat';

// Default values for backward compatibility
const PKRN_DEFAULTS = {
    background: 'sky',
    defaultBlockColor: '#787878',
    defaultSpikeColor: '#c45a3f',
    defaultTextColor: '#000000',
    checkpointDefaultColor: '#808080',
    checkpointActiveColor: '#4CAF50',
    checkpointTouchedColor: '#2196F3',
    maxJumps: 1,
    infiniteJumps: false,
    additionalAirjump: false,
    collideWithEachOther: true,
    dieLineY: 2000,
    playerSpeed: 5,
    jumpForce: -14,
    gravity: 0.8,
    spikeTouchbox: 'normal',
    dropHurtOnly: false,
    storedDataType: 'json', // 'json' or 'dat'
    customBackground: {
        enabled: false,
        type: null,
        data: null,
        playMode: 'loop',
        loopCount: -1,
        endType: 'freeze',
        endBackground: null,
        sameAcrossScreens: false,
        reverse: false
    },
    music: {
        type: 'none',
        customData: null,
        customName: null,
        volume: 50,
        loop: true
    }
};

// ============================================
// BINARY DATA UTILITIES
// ============================================
class BinaryUtils {
    /**
     * Encode data to binary format (.dat)
     * Uses a simple but efficient binary format
     */
    static encode(data) {
        const json = JSON.stringify(data);
        const encoder = new TextEncoder();
        const bytes = encoder.encode(json);
        
        // Simple compression: RLE for repeated bytes
        const compressed = this.compress(bytes);
        return compressed;
    }
    
    /**
     * Decode binary format back to data
     */
    static decode(buffer) {
        const decompressed = this.decompress(new Uint8Array(buffer));
        const decoder = new TextDecoder();
        const json = decoder.decode(decompressed);
        return JSON.parse(json);
    }
    
    /**
     * Simple RLE compression
     */
    static compress(bytes) {
        const result = [];
        let i = 0;
        
        while (i < bytes.length) {
            const byte = bytes[i];
            let count = 1;
            
            // Count consecutive same bytes (max 255)
            while (i + count < bytes.length && bytes[i + count] === byte && count < 255) {
                count++;
            }
            
            if (count >= 4) {
                // RLE marker: 0xFF, count, byte
                result.push(0xFF, count, byte);
                i += count;
            } else {
                // Store byte directly (escape 0xFF as 0xFF 0x00)
                if (byte === 0xFF) {
                    result.push(0xFF, 0x00);
                } else {
                    result.push(byte);
                }
                i++;
            }
        }
        
        return new Uint8Array(result);
    }
    
    /**
     * Simple RLE decompression
     */
    static decompress(bytes) {
        const result = [];
        let i = 0;
        
        while (i < bytes.length) {
            if (bytes[i] === 0xFF) {
                i++;
                if (bytes[i] === 0x00) {
                    // Escaped 0xFF
                    result.push(0xFF);
                    i++;
                } else {
                    // RLE: count, byte
                    const count = bytes[i++];
                    const byte = bytes[i++];
                    for (let j = 0; j < count; j++) {
                        result.push(byte);
                    }
                }
            } else {
                result.push(bytes[i++]);
            }
        }
        
        return new Uint8Array(result);
    }
}

// ============================================
// MEDIA EXTRACTOR
// ============================================
class MediaExtractor {
    /**
     * Extract base64 media from world data and return references
     * @param {Object} data - Serialized world data
     * @returns {Object} { data: modifiedData, files: Map<filename, base64> }
     */
    static extract(data) {
        const files = new Map();
        let imgIndex = 1;
        let soundIndex = 1;
        
        // Clone data to avoid modifying original
        const modified = JSON.parse(JSON.stringify(data));
        
        // Extract custom background
        if (modified.settings?.customBackground?.data) {
            const bgData = modified.settings.customBackground.data;
            if (bgData.startsWith('data:')) {
                const ext = this.getExtensionFromDataUrl(bgData);
                const filename = `uploaded_img_${imgIndex++}.${ext}`;
                files.set(filename, bgData);
                modified.settings.customBackground.data = `@file:${filename}`;
            }
        }
        
        // Extract nested end background
        if (modified.settings?.customBackground?.endBackground?.data) {
            const bgData = modified.settings.customBackground.endBackground.data;
            if (bgData.startsWith('data:')) {
                const ext = this.getExtensionFromDataUrl(bgData);
                const filename = `uploaded_img_${imgIndex++}.${ext}`;
                files.set(filename, bgData);
                modified.settings.customBackground.endBackground.data = `@file:${filename}`;
            }
        }
        
        // Extract custom music
        if (modified.settings?.music?.customData) {
            const musicData = modified.settings.music.customData;
            if (musicData.startsWith('data:')) {
                const ext = this.getExtensionFromDataUrl(musicData);
                const filename = `uploaded_sound_${soundIndex++}.${ext}`;
                files.set(filename, musicData);
                modified.settings.music.customData = `@file:${filename}`;
            }
        }
        
        return { data: modified, files };
    }
    
    /**
     * Inject file references back into data
     * @param {Object} data - Data with file references
     * @param {Map} files - Map of filename to base64 data
     * @returns {Object} Data with embedded base64
     */
    static inject(data, files) {
        const modified = JSON.parse(JSON.stringify(data));
        
        // Inject custom background
        if (modified.settings?.customBackground?.data?.startsWith('@file:')) {
            const filename = modified.settings.customBackground.data.substring(6);
            if (files.has(filename)) {
                modified.settings.customBackground.data = files.get(filename);
            }
        }
        
        // Inject nested end background
        if (modified.settings?.customBackground?.endBackground?.data?.startsWith('@file:')) {
            const filename = modified.settings.customBackground.endBackground.data.substring(6);
            if (files.has(filename)) {
                modified.settings.customBackground.endBackground.data = files.get(filename);
            }
        }
        
        // Inject custom music
        if (modified.settings?.music?.customData?.startsWith('@file:')) {
            const filename = modified.settings.music.customData.substring(6);
            if (files.has(filename)) {
                modified.settings.music.customData = files.get(filename);
            }
        }
        
        return modified;
    }
    
    /**
     * Get file extension from data URL
     */
    static getExtensionFromDataUrl(dataUrl) {
        const match = dataUrl.match(/data:([^;]+)/);
        if (match) {
            const mimeType = match[1];
            const extensions = {
                'image/png': 'png',
                'image/jpeg': 'jpg',
                'image/gif': 'gif',
                'image/webp': 'webp',
                'video/mp4': 'mp4',
                'video/webm': 'webm',
                'audio/mpeg': 'mp3',
                'audio/mp3': 'mp3',
                'audio/wav': 'wav',
                'audio/ogg': 'ogg',
                'audio/webm': 'webm'
            };
            return extensions[mimeType] || 'bin';
        }
        return 'bin';
    }
    
    /**
     * Convert base64 data URL to binary
     */
    static dataUrlToBlob(dataUrl) {
        const parts = dataUrl.split(',');
        const mime = parts[0].match(/:(.*?);/)[1];
        const binary = atob(parts[1]);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }
        return new Blob([array], { type: mime });
    }
    
    /**
     * Convert binary to base64 data URL
     */
    static blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}

// ============================================
// EXPORT MANAGER
// ============================================
class ExportManager {
    constructor() {
        this.version = PKRN_VERSION;
    }

    /**
     * Export world data to .pkrn file (ZIP format)
     * @param {World} world - The world object to export
     * @param {string} filename - Optional filename (without extension)
     * @param {string} format - 'json' or 'dat'
     */
    async exportToFile(world, filename = null, format = null) {
        const dataFormat = format || world.storedDataType || PKRN_FORMAT_JSON;
        
        try {
            const zip = new JSZip();
            const serialized = this.serialize(world);
            
            // Extract media files
            const { data, files } = MediaExtractor.extract(serialized);
            
            // Add data file
            if (dataFormat === PKRN_FORMAT_DAT) {
                const binary = BinaryUtils.encode(data);
                zip.file('data.dat', binary);
            } else {
                const json = JSON.stringify(data, null, 2);
                zip.file('data.json', json);
            }
            
            // Add media files
            for (const [filename, dataUrl] of files) {
                const blob = MediaExtractor.dataUrlToBlob(dataUrl);
                zip.file(filename, blob);
            }
            
            // Generate ZIP
            const blob = await zip.generateAsync({ 
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });
            
            // Download
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
        } catch (err) {
            console.error('Export failed:', err);
            throw new Error('Failed to export: ' + err.message);
        }
    }

    /**
     * Export world data to JSON string (for internal use)
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
                checkpointDefaultColor: world.checkpointDefaultColor,
                checkpointActiveColor: world.checkpointActiveColor,
                checkpointTouchedColor: world.checkpointTouchedColor,
                maxJumps: world.maxJumps,
                infiniteJumps: world.infiniteJumps,
                additionalAirjump: world.additionalAirjump,
                collideWithEachOther: world.collideWithEachOther,
                dieLineY: world.dieLineY,
                // Physics settings
                playerSpeed: world.playerSpeed,
                jumpForce: world.jumpForce,
                gravity: world.gravity,
                // Spike settings
                spikeTouchbox: world.spikeTouchbox,
                dropHurtOnly: world.dropHurtOnly,
                // Storage preference
                storedDataType: world.storedDataType || 'json',
                // Custom background
                customBackground: world.customBackground,
                // Music
                music: world.music
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
            fh: obj.flipHorizontal ? 1 : 0,
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
        
        // Spike-specific properties
        if (obj.spikeTouchbox) {
            data.stb = obj.spikeTouchbox;
        }
        if (obj.dropHurtOnly !== undefined) {
            data.dho = obj.dropHurtOnly;
        }
        
        // Zone-specific properties
        if (obj.zoneName) {
            data.zn = obj.zoneName;
        }
        
        // Teleportal-specific properties
        if (obj.teleportalName) {
            data.tpn = obj.teleportalName;
        }
        if (obj.sendTo && obj.sendTo.length > 0) {
            data.tps = obj.sendTo;
        }
        if (obj.receiveFrom && obj.receiveFrom.length > 0) {
            data.tpr = obj.receiveFrom;
        }

        return data;
    }
}

// ============================================
// IMPORT MANAGER
// ============================================
class ImportManager {
    constructor() {
        this.supportedVersions = ['1.0', '1.1', '1.2', '2.0'];
    }

    /**
     * Import from file (supports both old JSON and new ZIP format)
     * @param {File} file - The file to import
     * @returns {Promise<Object>} Parsed data
     */
    async importFromFile(file) {
        if (!file.name.endsWith('.pkrn')) {
            throw new Error('Invalid file type. Please select a .pkrn file.');
        }

        const buffer = await this.readFileAsArrayBuffer(file);
        
        // Check if it's a ZIP file (starts with PK signature)
        const header = new Uint8Array(buffer.slice(0, 4));
        const isZip = header[0] === 0x50 && header[1] === 0x4B;
        
        if (isZip) {
            return await this.importFromZip(buffer);
        } else {
            // Legacy format: raw JSON
            return await this.importFromLegacyFormat(buffer);
        }
    }
    
    /**
     * Import from ZIP format (.pkrn v2.0)
     */
    async importFromZip(buffer) {
        try {
            const zip = await JSZip.loadAsync(buffer);
            
            // Find data file
            let data;
            if (zip.files['data.json']) {
                const json = await zip.files['data.json'].async('string');
                data = JSON.parse(json);
            } else if (zip.files['data.dat']) {
                const binary = await zip.files['data.dat'].async('arraybuffer');
                data = BinaryUtils.decode(binary);
            } else {
                throw new Error('Invalid .pkrn file: missing data file');
            }
            
            // Load media files
            const files = new Map();
            for (const filename of Object.keys(zip.files)) {
                if (filename.startsWith('uploaded_')) {
                    const blob = await zip.files[filename].async('blob');
                    const dataUrl = await MediaExtractor.blobToDataUrl(blob);
                    files.set(filename, dataUrl);
                }
            }
            
            // Inject media back into data
            const injected = MediaExtractor.inject(data, files);
            
            // Validate and deserialize
            const result = this.validate(injected);
            if (result.valid) {
                return this.deserialize(injected);
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            throw new Error('Failed to parse ZIP file: ' + err.message);
        }
    }
    
    /**
     * Import from legacy JSON format (.pkrn v1.x)
     */
    async importFromLegacyFormat(buffer) {
        try {
            const decoder = new TextDecoder();
            const json = decoder.decode(buffer);
            const data = JSON.parse(json);
            
            const result = this.validate(data);
            if (result.valid) {
                return this.deserialize(data);
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            throw new Error('Failed to parse legacy format: ' + err.message);
        }
    }
    
    /**
     * Read file as ArrayBuffer
     */
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
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
            checkpointDefaultColor: getString(settings.checkpointDefaultColor, PKRN_DEFAULTS.checkpointDefaultColor),
            checkpointActiveColor: getString(settings.checkpointActiveColor, PKRN_DEFAULTS.checkpointActiveColor),
            checkpointTouchedColor: getString(settings.checkpointTouchedColor, PKRN_DEFAULTS.checkpointTouchedColor),
            maxJumps: getNumber(settings.maxJumps, PKRN_DEFAULTS.maxJumps, v => v >= 0),
            infiniteJumps: getBool(settings.infiniteJumps, PKRN_DEFAULTS.infiniteJumps),
            additionalAirjump: getBool(settings.additionalAirjump, PKRN_DEFAULTS.additionalAirjump),
            collideWithEachOther: settings.collideWithEachOther !== false,
            dieLineY: getNumber(settings.dieLineY, PKRN_DEFAULTS.dieLineY),
            // Physics settings with validation
            playerSpeed: getNumber(settings.playerSpeed, PKRN_DEFAULTS.playerSpeed, v => v > 0),
            jumpForce: getNumber(settings.jumpForce, PKRN_DEFAULTS.jumpForce, v => v < 0),
            gravity: getNumber(settings.gravity, PKRN_DEFAULTS.gravity, v => v > 0),
            // Spike settings
            spikeTouchbox: ['full', 'normal', 'tip', 'ground', 'flag', 'air'].includes(settings.spikeTouchbox) 
                ? settings.spikeTouchbox : PKRN_DEFAULTS.spikeTouchbox,
            dropHurtOnly: settings.dropHurtOnly === true,
            // Storage preference
            storedDataType: ['json', 'dat'].includes(settings.storedDataType) 
                ? settings.storedDataType : PKRN_DEFAULTS.storedDataType,
            // Custom background with validation
            customBackground: this.deserializeCustomBackground(settings.customBackground),
            // Music with validation
            music: this.deserializeMusic(settings.music),
            objects: (data.objects || []).map(obj => this.deserializeObject(obj))
        };
    }
    
    /**
     * Deserialize music settings with defaults
     * @param {Object} music - Music settings
     * @returns {Object} Validated music data
     */
    deserializeMusic(music) {
        const validTypes = ['none', 'maccary-bay', 'reggae-party', 'custom'];
        
        if (!music) {
            return {
                type: 'none',
                customData: null,
                customName: null,
                volume: 50,
                loop: true
            };
        }
        
        return {
            type: validTypes.includes(music.type) ? music.type : 'none',
            customData: music.customData || null,
            customName: music.customName || null,
            volume: (typeof music.volume === 'number' && music.volume >= 0 && music.volume <= 100) ? music.volume : 50,
            loop: music.loop !== false
        };
    }

    /**
     * Deserialize custom background with defaults
     * @param {Object} cb - Custom background settings
     * @returns {Object} Validated custom background data
     */
    deserializeCustomBackground(cb) {
        if (!cb || typeof cb !== 'object' || !cb.enabled) {
            return { ...PKRN_DEFAULTS.customBackground };
        }

        return {
            enabled: true,
            type: ['image', 'gif', 'video'].includes(cb.type) ? cb.type : null,
            data: typeof cb.data === 'string' ? cb.data : null,
            playMode: ['once', 'loop', 'bounce'].includes(cb.playMode) ? cb.playMode : 'loop',
            loopCount: typeof cb.loopCount === 'number' ? cb.loopCount : -1,
            endType: ['freeze', 'replace'].includes(cb.endType) ? cb.endType : 'freeze',
            endBackground: cb.endBackground && typeof cb.endBackground === 'object' 
                ? this.deserializeCustomBackground(cb.endBackground) : null,
            sameAcrossScreens: !!cb.sameAcrossScreens,
            reverse: !!cb.reverse
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
            flipHorizontal: obj.fh ? !!obj.fh : (obj.flipHorizontal || false),
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
        
        // Spike-specific properties
        const validSpikeModes = ['full', 'normal', 'tip', 'ground', 'flag', 'air'];
        const spikeTouchbox = obj.stb || obj.spikeTouchbox;
        if (spikeTouchbox && validSpikeModes.includes(spikeTouchbox)) {
            data.spikeTouchbox = spikeTouchbox;
        }
        const dropHurtOnly = obj.dho !== undefined ? obj.dho : obj.dropHurtOnly;
        if (dropHurtOnly !== undefined) {
            data.dropHurtOnly = dropHurtOnly === true;
        }
        
        // Zone-specific properties
        const zoneName = obj.zn || obj.zoneName;
        if (zoneName) {
            data.zoneName = zoneName;
        }
        
        // Teleportal-specific properties
        const teleportalName = obj.tpn || obj.teleportalName;
        if (teleportalName) {
            data.teleportalName = teleportalName;
        }
        
        // Teleportal connections
        const sendTo = obj.tps || obj.sendTo;
        if (sendTo && Array.isArray(sendTo)) {
            data.sendTo = sendTo;
        }
        
        const receiveFrom = obj.tpr || obj.receiveFrom;
        if (receiveFrom && Array.isArray(receiveFrom)) {
            data.receiveFrom = receiveFrom;
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
        
        const response = await fetch(`${this.apiUrl}/maps${mapId ? '/' + mapId : ''}`, {
            method: mapId ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Failed to save to cloud');
        }

        return await response.json();
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
            throw new Error('Failed to load from cloud');
        }

        const data = await response.json();
        return this.importManager.importFromString(JSON.stringify(data));
    }

    /**
     * List user's maps
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
            throw new Error('Failed to list maps');
        }

        return await response.json();
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

        return response.ok;
    }
}

// Export for use
if (typeof window !== 'undefined') {
    window.ExportManager = ExportManager;
    window.ImportManager = ImportManager;
    window.CloudSyncManager = CloudSyncManager;
    window.PKRN_VERSION = PKRN_VERSION;
    window.PKRN_DEFAULTS = PKRN_DEFAULTS;
}
