/**
 * PARKOREEN - Map Editor
 * Complete editor system with tools, panels, and placement
 */

// ============================================
// EDITOR TOOLS
// ============================================
const EditorTool = {
    NONE: 'none',
    FLY: 'fly',
    MOVE: 'move',
    DUPLICATE: 'duplicate',
    ROTATE: 'rotate',
    ERASE: 'erase'
};

const PlacementMode = {
    NONE: 'none',
    BLOCK: 'block',
    KOREEN: 'koreen',
    TEXT: 'text'
};

// ============================================
// CUSTOM FONTS (loaded from assets/ttf/)
// ============================================
const CUSTOM_FONTS = [
    'Parkoreen Game',  // assets/ttf/jersey10.ttf
    'Tektur'           // assets/ttf/tektur.ttf
];

// ============================================
// GOOGLE FONTS (Popular subset)
// ============================================
const GOOGLE_FONTS = [
    ...CUSTOM_FONTS,
    'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
    'Oswald', 'Raleway', 'Merriweather', 'Ubuntu', 'Playfair Display',
    'Nunito', 'PT Sans', 'Rubik', 'Work Sans', 'Quicksand',
    'Bebas Neue', 'Anton', 'Lobster', 'Pacifico', 'Dancing Script',
    'Satisfy', 'Indie Flower', 'Permanent Marker', 'Shadows Into Light',
    'Caveat', 'Abril Fatface', 'Alfa Slab One', 'Righteous', 'Bangers',
    'Press Start 2P', 'VT323', 'Silkscreen', 'Jersey 10', 'Pixelify Sans',
    'DotGothic16', 'Orbitron', 'Audiowide', 'Bungee', 'Creepster',
    'Special Elite', 'Courier Prime', 'Source Code Pro', 'Fira Code',
    'JetBrains Mono', 'Comic Neue', 'Fredoka One', 'Baloo 2', 'Cabin',
    'Titillium Web', 'Barlow', 'Archivo', 'Manrope', 'Inter'
];

// ============================================
// EDITOR CLASS
// ============================================
class Editor {
    constructor(engine) {
        this.engine = engine;
        this.world = engine.world;
        this.camera = engine.camera;
        
        // Tool state
        this.currentTool = EditorTool.NONE;
        this.placementMode = PlacementMode.NONE;
        this.isFlying = true; // Start with fly mode enabled by default
        this.isErasing = false;
        this.isPlacing = false; // Track if we're actively placing blocks (brush mode)
        
        // Selection state
        this.selectedObject = null;
        this.movingObject = null;
        this.isDragging = false;
        
        // Placement settings
        this.placementSettings = {
            appearanceType: 'ground',
            actingType: 'ground',
            collision: true,
            fillMode: 'add',
            color: '#787878',
            opacity: 1
        };
        
        // Koreen settings
        this.koreenSettings = {
            appearanceType: 'checkpoint',
            actingType: 'checkpoint',
            collision: false, // Koreens don't have collision by default
            fillMode: 'add',
            opacity: 1
        };
        
        // Text settings
        this.textSettings = {
            content: 'Text',
            actingType: 'text',
            font: 'Parkoreen Game',
            color: '#000000',
            opacity: 1,
            hAlign: 'center',
            vAlign: 'center',
            hSpacing: 0,
            vSpacing: 0
        };
        
        // Recent fonts
        this.recentFonts = JSON.parse(localStorage.getItem('parkoreen_recent_fonts') || '[]');
        
        // UI Elements (will be set by initUI)
        this.ui = {};
        
        // Callback for map changes (set by host.html for auto-save)
        this.onMapChange = null;
        
        // Bind engine callbacks
        this.setupEngineCallbacks();
    }
    
    // Trigger map change callback (for auto-save)
    triggerMapChange() {
        if (typeof this.onMapChange === 'function') {
            this.onMapChange();
        }
    }

    setupEngineCallbacks() {
        this.engine.onKeyPress = (e) => this.handleKeyPress(e);
        this.engine.onMouseMoveCallback = (e) => this.handleMouseMove(e);
        this.engine.onMouseDownCallback = (e) => this.handleMouseDown(e);
        this.engine.onMouseUpCallback = (e) => this.handleMouseUp(e);
        this.engine.renderEditorOverlay = (ctx, camera) => this.renderOverlay(ctx, camera);
    }

    // ========================================
    // INITIALIZATION
    // ========================================
    initUI() {
        this.createEditorUI();
        this.createToolbar();
        this.createPanels();
        this.createColorPicker();
        this.createFontDropdown();
        this.attachEventListeners();
        
        // Set fly tool button as active since fly mode is on by default
        const flyBtn = this.ui.toolbar.querySelector('[data-tool="fly"]');
        if (flyBtn) {
            flyBtn.classList.add('active');
        }
    }

    createEditorUI() {
        const container = document.createElement('div');
        container.id = 'editor-ui';
        container.className = 'editor-ui';
        container.innerHTML = `
            <!-- Corner Buttons -->
            <button class="btn btn-icon btn-secondary editor-btn-corner editor-btn-tl" id="btn-config" title="Config">
                <span class="material-symbols-outlined">build</span>
            </button>
            <button class="btn btn-icon btn-secondary editor-btn-corner editor-btn-tr" id="btn-settings" title="Settings">
                <span class="material-symbols-outlined">settings</span>
            </button>
            <button class="btn btn-icon btn-secondary editor-btn-corner editor-btn-bl" id="btn-add" title="Add">
                <span class="material-symbols-outlined">add</span>
            </button>
            <button class="btn btn-icon btn-secondary editor-btn-corner editor-btn-br" id="btn-layers" title="Layers">
                <span class="material-symbols-outlined">stacks</span>
            </button>
            
            <!-- Stop Test Button (hidden by default) -->
            <button class="btn btn-icon btn-danger editor-btn-corner editor-btn-br hidden" id="btn-stop-test" title="Stop Test">
                <span class="material-symbols-outlined">stop_circle</span>
            </button>
        `;
        document.body.appendChild(container);
        
        this.ui.container = container;
        this.ui.btnConfig = document.getElementById('btn-config');
        this.ui.btnSettings = document.getElementById('btn-settings');
        this.ui.btnAdd = document.getElementById('btn-add');
        this.ui.btnLayers = document.getElementById('btn-layers');
        this.ui.btnStopTest = document.getElementById('btn-stop-test');
    }

    createToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        toolbar.id = 'toolbar';
        toolbar.innerHTML = `
            <button class="toolbar-btn" data-tool="fly" title="Fly (G)">
                <span class="material-symbols-outlined">flight</span>
                <span class="toolbar-btn-label">Fly (G)</span>
            </button>
            <button class="toolbar-btn" data-tool="move" title="Move (M)">
                <span class="material-symbols-outlined">open_with</span>
                <span class="toolbar-btn-label">Move (M)</span>
            </button>
            <button class="toolbar-btn" data-tool="duplicate" title="Duplicate (C)">
                <span class="material-symbols-outlined">content_copy</span>
                <span class="toolbar-btn-label">Duplicate (C)</span>
            </button>
            <button class="toolbar-btn" data-tool="rotate" title="Rotate (R)">
                <span class="material-symbols-outlined">rotate_left</span>
                <span class="toolbar-btn-label">Rotate Left (R)</span>
            </button>
            <div class="toolbar-divider"></div>
            <button class="toolbar-btn" data-action="zoom-in" title="Zoom In">
                <span class="material-symbols-outlined">zoom_in</span>
                <span class="toolbar-btn-label">Zoom In</span>
            </button>
            <button class="toolbar-btn" data-action="zoom-out" title="Zoom Out">
                <span class="material-symbols-outlined">zoom_out</span>
                <span class="toolbar-btn-label">Zoom Out</span>
            </button>
            <div class="toolbar-divider"></div>
            <button class="toolbar-btn" data-tool="erase" title="Quick Eraser">
                <span class="material-symbols-outlined">ink_eraser</span>
                <span class="toolbar-btn-label">Eraser</span>
            </button>
        `;
        document.body.appendChild(toolbar);
        this.ui.toolbar = toolbar;
    }

    createPanels() {
        // Config Panel
        const configPanel = document.createElement('div');
        configPanel.className = 'config-panel';
        configPanel.id = 'config-panel';
        configPanel.innerHTML = `
            <div class="panel-header">
                <span class="panel-title">Configuration</span>
                <button class="btn btn-icon btn-ghost" id="close-config">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="panel-body">
                <div class="config-section">
                    <button class="btn btn-primary" id="btn-test-game" style="width: 100%;">
                        <span class="material-symbols-outlined">play_arrow</span>
                        Test Game
                    </button>
                </div>
                
                <div class="config-section collapsible expanded">
                    <div class="config-section-header">
                        <span class="config-section-title">Map Info</span>
                        <span class="material-symbols-outlined config-section-arrow">expand_more</span>
                    </div>
                    <div class="config-section-content">
                        <div class="form-group">
                            <label class="form-label">Map Name</label>
                            <input type="text" class="form-input" id="config-map-name" placeholder="Enter map name">
                        </div>
                    </div>
                </div>
                
                <div class="config-section collapsible">
                    <div class="config-section-header">
                        <span class="config-section-title">Theme</span>
                        <span class="material-symbols-outlined config-section-arrow">expand_more</span>
                    </div>
                    <div class="config-section-content">
                        <div class="form-group">
                            <label class="form-label">Background</label>
                            <select class="form-select" id="config-background">
                                <option value="sky">Sky</option>
                                <option value="galaxy">Galaxy</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Default Block Color</label>
                            <div class="color-picker-option">
                                <div class="color-preview" id="config-block-color-preview" style="background: #787878"></div>
                                <input type="text" class="form-input color-input" id="config-block-color" value="#787878">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Default Spike Color</label>
                            <div class="color-picker-option">
                                <div class="color-preview" id="config-spike-color-preview" style="background: #c45a3f"></div>
                                <input type="text" class="form-input color-input" id="config-spike-color" value="#c45a3f">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Default Text Color</label>
                            <div class="color-picker-option">
                                <div class="color-preview" id="config-text-color-preview" style="background: #000000"></div>
                                <input type="text" class="form-input color-input" id="config-text-color" value="#000000">
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="config-section collapsible">
                    <div class="config-section-header">
                        <span class="config-section-title">Player</span>
                        <span class="material-symbols-outlined config-section-arrow">expand_more</span>
                    </div>
                    <div class="config-section-content">
                        <div class="form-group">
                            <label class="form-label">Jumps</label>
                            <select class="form-select" id="config-jumps">
                                <option value="set">Set Number</option>
                                <option value="infinite">Infinite</option>
                            </select>
                        </div>
                        <div class="form-group" id="config-jumps-number-group">
                            <label class="form-label">Number of Jumps</label>
                            <input type="number" class="form-input" id="config-jumps-number" min="0" value="1">
                        </div>
                        <div class="form-group" id="config-airjump-group">
                            <label class="form-label">Additional Airjump</label>
                            <label class="toggle">
                                <input type="checkbox" id="config-airjump">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Collide with Each Other</label>
                            <label class="toggle">
                                <input type="checkbox" id="config-collide" checked>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="config-section collapsible">
                    <div class="config-section-header">
                        <span class="config-section-title">Physics</span>
                        <span class="material-symbols-outlined config-section-arrow">expand_more</span>
                    </div>
                    <div class="config-section-content">
                        <div class="form-group">
                            <label class="form-label">Player Speed</label>
                            <input type="number" class="form-input" id="config-player-speed" min="0.1" step="0.5" value="5" title="Horizontal movement speed (default: 5)">
                            <small style="color: #888; font-size: 11px;">Default: 5 - Higher = faster movement</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Jump Height</label>
                            <input type="number" class="form-input" id="config-jump-force" min="-50" max="-1" step="0.5" value="-14" title="Jump force (default: -14, negative = upward)">
                            <small style="color: #888; font-size: 11px;">Default: -14 - Lower (more negative) = higher jump</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Gravity</label>
                            <input type="number" class="form-input" id="config-gravity" min="0.1" step="0.1" value="0.8" title="Gravity strength (default: 0.8)">
                            <small style="color: #888; font-size: 11px;">Default: 0.8 - Higher = faster fall/jump speed</small>
                        </div>
                    </div>
                </div>
                
                <div class="config-section collapsible">
                    <div class="config-section-header">
                        <span class="config-section-title">Spike Behavior</span>
                        <span class="material-symbols-outlined config-section-arrow">expand_more</span>
                    </div>
                    <div class="config-section-content">
                        <div class="form-group">
                            <label class="form-label">Spike Touchbox Mode</label>
                            <select class="form-select" id="config-spike-touchbox">
                                <option value="full">Full Spike</option>
                                <option value="normal" selected>Normal Spike</option>
                                <option value="tip">Tip Spike</option>
                                <option value="ground">Ground</option>
                                <option value="flag">Flag</option>
                                <option value="air">Air</option>
                            </select>
                            <div id="spike-touchbox-description" style="margin-top: 8px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px; font-size: 12px; color: #aaa; line-height: 1.5;">
                                <strong style="color: #fff;">Normal Spike:</strong> The flat base of the spike acts as solid ground. All other parts will damage the player on contact.
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="config-section collapsible">
                    <div class="config-section-header">
                        <span class="config-section-title">World</span>
                        <span class="material-symbols-outlined config-section-arrow">expand_more</span>
                    </div>
                    <div class="config-section-content">
                        <div class="form-group">
                            <label class="form-label">Death Line Y Position</label>
                            <input type="number" class="form-input" id="config-die-line-y" value="2000" title="Players die below this Y position (void death)">
                            <small style="color: #888; font-size: 11px;">Players falling below this line will die</small>
                        </div>
                    </div>
                </div>
                
                <div class="config-section collapsible">
                    <div class="config-section-header">
                        <span class="config-section-title">Export & Import</span>
                        <span class="material-symbols-outlined config-section-arrow">expand_more</span>
                    </div>
                    <div class="config-section-content">
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-secondary" id="btn-export" style="flex: 1;">
                                <span class="material-symbols-outlined">download</span>
                                Export
                            </button>
                            <button class="btn btn-secondary" id="btn-import" style="flex: 1;">
                                <span class="material-symbols-outlined">upload</span>
                                Import
                            </button>
                        </div>
                        <input type="file" id="import-file" accept=".pkrn" style="display: none;">
                    </div>
                </div>
                
                <div class="config-section collapsible">
                    <div class="config-section-header">
                        <span class="config-section-title">Host Game</span>
                        <span class="material-symbols-outlined config-section-arrow">expand_more</span>
                    </div>
                    <div class="config-section-content">
                        <div class="form-group">
                            <label class="form-label">Max Player Amount</label>
                            <input type="number" class="form-input" id="config-max-players" min="1" max="999999" value="10">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Use Password</label>
                            <label class="toggle">
                                <input type="checkbox" id="config-use-password">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="form-group hidden" id="config-password-group">
                            <label class="form-label">Custom Password</label>
                            <div style="display: flex; gap: 8px;">
                                <input type="text" class="form-input" id="config-password" style="flex: 1;">
                                <button class="btn btn-icon btn-secondary" id="btn-regenerate-password" title="Regenerate">
                                    <span class="material-symbols-outlined">replay</span>
                                </button>
                            </div>
                        </div>
                        <button class="btn btn-accent" id="btn-host-game" style="width: 100%; margin-top: 8px;">
                            <span class="material-symbols-outlined">videogame_asset</span>
                            Host Game
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(configPanel);
        this.ui.configPanel = configPanel;
        
        // Setup collapsible sections
        this.setupCollapsibleSections();

        // Layers Panel
        const layersPanel = document.createElement('div');
        layersPanel.className = 'layers-panel';
        layersPanel.id = 'layers-panel';
        layersPanel.innerHTML = `
            <div class="panel-header">
                <span class="panel-title">Layers</span>
                <button class="btn btn-icon btn-ghost" id="close-layers">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="panel-body" id="layers-list">
                <!-- Layer items will be dynamically added -->
            </div>
        `;
        document.body.appendChild(layersPanel);
        this.ui.layersPanel = layersPanel;
        this.ui.layersList = document.getElementById('layers-list');

        // Add Menu
        const addMenu = document.createElement('div');
        addMenu.className = 'add-menu';
        addMenu.id = 'add-menu';
        addMenu.innerHTML = `
            <button class="add-menu-btn" data-add="block">
                <span class="material-symbols-outlined">square</span>
                Block
            </button>
            <button class="add-menu-btn" data-add="koreen">
                <span class="material-symbols-outlined">device_hub</span>
                Koreen
            </button>
            <button class="add-menu-btn" data-add="text">
                <span class="material-symbols-outlined">text_fields</span>
                Text Box
            </button>
        `;
        document.body.appendChild(addMenu);
        this.ui.addMenu = addMenu;

        // Placement Toolbar
        this.createPlacementToolbar();

        // Settings Panel (ingame)
        this.createSettingsPanel();
    }

    createPlacementToolbar() {
        const placementToolbar = document.createElement('div');
        placementToolbar.className = 'placement-toolbar';
        placementToolbar.id = 'placement-toolbar';
        placementToolbar.innerHTML = `
            <!-- Block Options -->
            <div class="placement-option" id="placement-appearance">
                <span class="placement-option-label">Appearance</span>
                <div class="placement-option-btns">
                    <button class="placement-opt-btn active" data-appearance="ground">Ground</button>
                    <button class="placement-opt-btn" data-appearance="spike">Spike</button>
                </div>
            </div>
            
            <div class="placement-option" id="placement-acting">
                <span class="placement-option-label">Acting Type</span>
                <div class="placement-option-btns">
                    <button class="placement-opt-btn active" data-acting="ground">Ground</button>
                    <button class="placement-opt-btn" data-acting="spike">Spike</button>
                    <button class="placement-opt-btn" data-acting="checkpoint">Check</button>
                    <button class="placement-opt-btn" data-acting="spawnpoint">Spawn</button>
                    <button class="placement-opt-btn" data-acting="endpoint">End</button>
                </div>
            </div>
            
            <div class="placement-option" id="placement-collision">
                <span class="placement-option-label">Collision</span>
                <div class="placement-option-btns">
                    <button class="placement-opt-btn active" data-collision="true">On</button>
                    <button class="placement-opt-btn" data-collision="false">Off</button>
                </div>
            </div>
            
            <div class="placement-option" id="placement-fill">
                <span class="placement-option-label">Fill</span>
                <div class="placement-option-btns">
                    <button class="placement-opt-btn active" data-fill="add">Add</button>
                    <button class="placement-opt-btn" data-fill="replace">Replace</button>
                </div>
            </div>
            
            <div class="placement-option" id="placement-color">
                <span class="placement-option-label">Color</span>
                <div class="color-picker-option">
                    <div class="color-preview" id="placement-color-preview" style="background: #787878"></div>
                    <input type="text" class="form-input form-input-sm color-input" id="placement-color-input" value="#787878">
                </div>
            </div>
            
            <div class="placement-option" id="placement-opacity">
                <span class="placement-option-label">Opacity</span>
                <input type="number" class="form-input form-input-sm" id="placement-opacity-input" min="0" max="100" value="100" style="width: 60px;">
                <span style="font-size: 12px; color: var(--text-muted);">%</span>
            </div>
            
            <!-- Text-specific options (hidden by default) -->
            <div class="placement-option hidden" id="placement-content" style="flex-direction: column; align-items: flex-start;">
                <span class="placement-option-label">Content</span>
                <textarea class="form-input form-input-sm" id="placement-content-input" rows="3" style="width: 180px; resize: vertical; font-family: inherit;">Text</textarea>
            </div>
            
            <div class="placement-option hidden" id="placement-font">
                <span class="placement-option-label">Font</span>
                <div class="font-dropdown" id="font-dropdown">
                    <button class="font-dropdown-trigger" id="font-dropdown-trigger">
                        <span id="font-dropdown-value">Parkoreen Game</span>
                        <span class="material-symbols-outlined">expand_more</span>
                    </button>
                    <div class="font-dropdown-menu" id="font-dropdown-menu">
                        <!-- Will be populated dynamically -->
                    </div>
                </div>
            </div>
            
            <div class="placement-option hidden" id="placement-halign">
                <span class="placement-option-label">H-Align</span>
                <div class="placement-option-btns">
                    <button class="placement-opt-btn" data-halign="left">
                        <span class="material-symbols-outlined" style="font-size: 16px;">format_align_left</span>
                    </button>
                    <button class="placement-opt-btn active" data-halign="center">
                        <span class="material-symbols-outlined" style="font-size: 16px;">format_align_center</span>
                    </button>
                    <button class="placement-opt-btn" data-halign="right">
                        <span class="material-symbols-outlined" style="font-size: 16px;">format_align_right</span>
                    </button>
                </div>
            </div>
            
            <div class="placement-option hidden" id="placement-valign">
                <span class="placement-option-label">V-Align</span>
                <div class="placement-option-btns">
                    <button class="placement-opt-btn" data-valign="top">
                        <span class="material-symbols-outlined" style="font-size: 16px;">vertical_align_top</span>
                    </button>
                    <button class="placement-opt-btn active" data-valign="center">
                        <span class="material-symbols-outlined" style="font-size: 16px;">vertical_align_center</span>
                    </button>
                    <button class="placement-opt-btn" data-valign="bottom">
                        <span class="material-symbols-outlined" style="font-size: 16px;">vertical_align_bottom</span>
                    </button>
                </div>
            </div>
            
            <div class="placement-option hidden" id="placement-hspacing">
                <span class="placement-option-label" title="Space between characters">Char Spacing</span>
                <input type="number" class="form-input form-input-sm" id="placement-hspacing-input" value="0" style="width: 60px;">
                <span style="font-size: 12px; color: var(--text-muted);">%</span>
            </div>
            
            <div class="placement-option hidden" id="placement-vspacing">
                <span class="placement-option-label" title="Space between lines">Line Spacing</span>
                <input type="number" class="form-input form-input-sm" id="placement-vspacing-input" value="0" style="width: 60px;">
                <span style="font-size: 12px; color: var(--text-muted);">%</span>
            </div>
        `;
        document.body.appendChild(placementToolbar);
        this.ui.placementToolbar = placementToolbar;
    }

    createSettingsPanel() {
        const settingsPanel = document.createElement('div');
        settingsPanel.className = 'settings-panel';
        settingsPanel.id = 'settings-panel';
        settingsPanel.innerHTML = `
            <div class="panel-header">
                <span class="panel-title">Settings</span>
                <button class="btn btn-icon btn-ghost" id="close-settings-panel">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="panel-body">
                <div class="form-group">
                    <label class="form-label">Volume</label>
                    <div class="settings-volume">
                        <input type="range" class="form-range" id="settings-volume-range" min="0" max="100" value="100">
                        <input type="number" class="form-input form-input-sm" id="settings-volume-number" min="0" max="100" value="100" style="width: 60px;">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Touchscreen Mode</label>
                    <label class="toggle">
                        <input type="checkbox" id="settings-touchscreen">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
        `;
        document.body.appendChild(settingsPanel);
        this.ui.settingsPanel = settingsPanel;
    }

    createColorPicker() {
        const popup = document.createElement('div');
        popup.className = 'color-picker-popup';
        popup.id = 'color-picker-popup';
        popup.innerHTML = `
            <div class="color-picker-header">
                <span class="color-picker-title">Choose Color</span>
                <button class="btn btn-icon btn-ghost" id="close-color-picker">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="color-picker-gradient" id="color-picker-gradient">
                <div class="color-picker-cursor" id="color-picker-cursor"></div>
            </div>
            <input type="range" class="color-picker-hue" id="color-picker-hue" min="0" max="360" value="0">
            <div class="color-picker-preview">
                <div class="color-picker-preview-box" id="color-picker-preview-box"></div>
                <input type="text" class="form-input" id="color-picker-hex" value="#FF0000">
            </div>
        `;
        document.body.appendChild(popup);
        this.ui.colorPickerPopup = popup;
        
        this.colorPickerState = {
            hue: 0,
            saturation: 100,
            lightness: 50,
            target: null
        };
    }

    createFontDropdown() {
        // Will be populated when dropdown opens
    }

    attachEventListeners() {
        // Corner buttons - use explicit function calls with error handling
        this.ui.btnConfig.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePanel('config');
        });
        
        this.ui.btnSettings.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePanel('settings');
        });
        
        this.ui.btnAdd.addEventListener('click', (e) => {
            e.stopPropagation();
            // If in placement mode, stop it; otherwise toggle add menu
            if (this.placementMode !== PlacementMode.NONE) {
                this.stopPlacement();
            } else {
                this.toggleAddMenu();
            }
        });
        
        this.ui.btnLayers.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePanel('layers');
        });
        
        this.ui.btnStopTest.addEventListener('click', (e) => {
            e.stopPropagation();
            this.stopTest();
        });

        // Close buttons
        document.getElementById('close-config').addEventListener('click', () => this.closePanel('config'));
        document.getElementById('close-layers').addEventListener('click', () => this.closePanel('layers'));
        document.getElementById('close-settings-panel').addEventListener('click', () => this.closePanel('settings'));
        document.getElementById('close-color-picker').addEventListener('click', () => this.closeColorPicker());

        // Toolbar buttons
        this.ui.toolbar.querySelectorAll('.toolbar-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => this.setTool(btn.dataset.tool));
        });
        
        this.ui.toolbar.querySelectorAll('.toolbar-btn[data-action]').forEach(btn => {
            btn.addEventListener('click', () => this.handleToolbarAction(btn.dataset.action));
        });

        // Add menu buttons
        this.ui.addMenu.querySelectorAll('.add-menu-btn').forEach(btn => {
            btn.addEventListener('click', () => this.startPlacement(btn.dataset.add));
        });

        // Placement toolbar
        this.attachPlacementListeners();

        // Config panel
        this.attachConfigListeners();

        // Color picker
        this.attachColorPickerListeners();

        // Settings
        this.attachSettingsListeners();

        // Font dropdown
        this.attachFontDropdownListeners();
    }

    attachPlacementListeners() {
        // Appearance type
        document.querySelectorAll('[data-appearance]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-appearance]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.placementSettings.appearanceType = btn.dataset.appearance;
                
                // Sync acting type with appearance type (spike looks like spike AND acts like spike)
                this.placementSettings.actingType = btn.dataset.appearance;
                this.syncActingTypeUI(btn.dataset.appearance);
                
                this.updateDefaultColor();
            });
        });

        // Acting type
        document.querySelectorAll('[data-acting]').forEach(btn => {
            btn.addEventListener('click', () => {
                const container = btn.closest('.placement-option-btns');
                container.querySelectorAll('.placement-opt-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (this.placementMode === PlacementMode.BLOCK) {
                    this.placementSettings.actingType = btn.dataset.acting;
                } else if (this.placementMode === PlacementMode.KOREEN) {
                    this.koreenSettings.actingType = btn.dataset.acting;
                } else if (this.placementMode === PlacementMode.TEXT) {
                    this.textSettings.actingType = btn.dataset.acting;
                }
            });
        });

        // Collision
        document.querySelectorAll('[data-collision]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-collision]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.placementSettings.collision = btn.dataset.collision === 'true';
            });
        });

        // Fill mode
        document.querySelectorAll('[data-fill]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-fill]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const fillMode = btn.dataset.fill;
                if (this.placementMode === PlacementMode.BLOCK) {
                    this.placementSettings.fillMode = fillMode;
                } else if (this.placementMode === PlacementMode.KOREEN) {
                    this.koreenSettings.fillMode = fillMode;
                }
            });
        });

        // Color preview click
        document.getElementById('placement-color-preview').addEventListener('click', () => {
            this.openColorPicker('placement');
        });

        // Color input
        document.getElementById('placement-color-input').addEventListener('change', (e) => {
            const color = e.target.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                this.placementSettings.color = color;
                document.getElementById('placement-color-preview').style.background = color;
            }
        });

        // Opacity
        document.getElementById('placement-opacity-input').addEventListener('change', (e) => {
            const opacity = Math.max(0, Math.min(100, parseInt(e.target.value) || 100));
            e.target.value = opacity;
            if (this.placementMode === PlacementMode.BLOCK) {
                this.placementSettings.opacity = opacity / 100;
            } else if (this.placementMode === PlacementMode.KOREEN) {
                this.koreenSettings.opacity = opacity / 100;
            } else if (this.placementMode === PlacementMode.TEXT) {
                this.textSettings.opacity = opacity / 100;
            }
        });

        // Text content
        document.getElementById('placement-content-input').addEventListener('input', (e) => {
            this.textSettings.content = e.target.value;
        });

        // Horizontal align
        document.querySelectorAll('[data-halign]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-halign]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.textSettings.hAlign = btn.dataset.halign;
            });
        });

        // Vertical align
        document.querySelectorAll('[data-valign]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-valign]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.textSettings.vAlign = btn.dataset.valign;
            });
        });

        // Spacing
        document.getElementById('placement-hspacing-input').addEventListener('change', (e) => {
            this.textSettings.hSpacing = parseInt(e.target.value) || 0;
        });
        
        document.getElementById('placement-vspacing-input').addEventListener('change', (e) => {
            this.textSettings.vSpacing = parseInt(e.target.value) || 0;
        });
    }

    attachConfigListeners() {
        // Map Name
        document.getElementById('config-map-name').addEventListener('change', (e) => {
            this.world.mapName = e.target.value.trim() || 'Untitled Map';
            this.triggerMapChange();
        });

        // Background
        document.getElementById('config-background').addEventListener('change', (e) => {
            this.world.background = e.target.value;
            this.updateBackground();
            this.triggerMapChange();
        });

        // Default colors
        ['block', 'spike', 'text'].forEach(type => {
            const preview = document.getElementById(`config-${type}-color-preview`);
            const input = document.getElementById(`config-${type}-color`);
            
            preview.addEventListener('click', () => {
                this.openColorPicker(`config-${type}`);
            });
            
            input.addEventListener('change', (e) => {
                const color = e.target.value;
                if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                    preview.style.background = color;
                    if (type === 'block') this.world.defaultBlockColor = color;
                    else if (type === 'spike') this.world.defaultSpikeColor = color;
                    else if (type === 'text') this.world.defaultTextColor = color;
                    this.triggerMapChange();
                }
            });
        });

        // Jumps
        document.getElementById('config-jumps').addEventListener('change', (e) => {
            const isInfinite = e.target.value === 'infinite';
            this.world.infiniteJumps = isInfinite;
            document.getElementById('config-jumps-number-group').classList.toggle('hidden', isInfinite);
            document.getElementById('config-airjump-group').classList.toggle('hidden', isInfinite);
            this.triggerMapChange();
        });

        document.getElementById('config-jumps-number').addEventListener('change', (e) => {
            this.world.maxJumps = Math.max(0, parseInt(e.target.value) || 1);
            this.triggerMapChange();
        });

        document.getElementById('config-airjump').addEventListener('change', (e) => {
            this.world.additionalAirjump = e.target.checked;
            this.triggerMapChange();
        });

        document.getElementById('config-collide').addEventListener('change', (e) => {
            this.world.collideWithEachOther = e.target.checked;
            this.triggerMapChange();
        });

        // Die line Y
        document.getElementById('config-die-line-y').addEventListener('change', (e) => {
            this.world.dieLineY = parseInt(e.target.value) || 2000;
            this.triggerMapChange();
        });

        // Physics settings
        document.getElementById('config-player-speed').addEventListener('change', (e) => {
            const value = parseFloat(e.target.value);
            this.world.playerSpeed = (value > 0) ? value : 5;
            e.target.value = this.world.playerSpeed;
            this.triggerMapChange();
        });

        document.getElementById('config-jump-force').addEventListener('change', (e) => {
            const value = parseFloat(e.target.value);
            this.world.jumpForce = (value < 0) ? value : -14;
            e.target.value = this.world.jumpForce;
            this.triggerMapChange();
        });

        document.getElementById('config-gravity').addEventListener('change', (e) => {
            const value = parseFloat(e.target.value);
            this.world.gravity = (value > 0) ? value : 0.8;
            e.target.value = this.world.gravity;
            this.triggerMapChange();
        });

        // Spike touchbox mode
        document.getElementById('config-spike-touchbox').addEventListener('change', (e) => {
            this.world.spikeTouchbox = e.target.value;
            this.updateSpikeTouchboxDescription(e.target.value);
            this.triggerMapChange();
        });

        // Test game
        document.getElementById('btn-test-game').addEventListener('click', () => this.startTest());

        // Export/Import
        document.getElementById('btn-export').addEventListener('click', () => this.exportMap());
        document.getElementById('btn-import').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        document.getElementById('import-file').addEventListener('change', (e) => this.importMap(e));

        // Password
        document.getElementById('config-use-password').addEventListener('change', (e) => {
            document.getElementById('config-password-group').classList.toggle('hidden', !e.target.checked);
            if (e.target.checked && !document.getElementById('config-password').value) {
                this.generatePassword();
            }
        });

        document.getElementById('btn-regenerate-password').addEventListener('click', () => this.generatePassword());

        // Host game
        document.getElementById('btn-host-game').addEventListener('click', () => this.hostGame());
    }

    attachColorPickerListeners() {
        const gradient = document.getElementById('color-picker-gradient');
        const hueSlider = document.getElementById('color-picker-hue');
        const hexInput = document.getElementById('color-picker-hex');
        const cursor = document.getElementById('color-picker-cursor');
        const preview = document.getElementById('color-picker-preview-box');

        let isDragging = false;

        const updateFromGradient = (e) => {
            const rect = gradient.getBoundingClientRect();
            const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
            const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
            
            this.colorPickerState.saturation = (x / rect.width) * 100;
            this.colorPickerState.lightness = 100 - (y / rect.height) * 100;
            
            cursor.style.left = x + 'px';
            cursor.style.top = y + 'px';
            
            this.updateColorPickerPreview();
        };

        gradient.addEventListener('mousedown', (e) => {
            isDragging = true;
            updateFromGradient(e);
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) updateFromGradient(e);
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        hueSlider.addEventListener('input', (e) => {
            this.colorPickerState.hue = parseInt(e.target.value);
            gradient.style.background = `
                linear-gradient(to bottom, transparent, black),
                linear-gradient(to right, white, hsl(${this.colorPickerState.hue}, 100%, 50%))
            `;
            this.updateColorPickerPreview();
        });

        hexInput.addEventListener('change', (e) => {
            const hex = e.target.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                this.applyColorPickerColor(hex);
            }
        });
    }

    attachSettingsListeners() {
        const volumeRange = document.getElementById('settings-volume-range');
        const volumeNumber = document.getElementById('settings-volume-number');
        const touchscreen = document.getElementById('settings-touchscreen');

        volumeRange.addEventListener('input', (e) => {
            volumeNumber.value = e.target.value;
            this.engine.audioManager.setVolume(parseInt(e.target.value) / 100);
        });

        volumeNumber.addEventListener('change', (e) => {
            const vol = Math.max(0, Math.min(100, parseInt(e.target.value) || 100));
            volumeRange.value = vol;
            volumeNumber.value = vol;
            this.engine.audioManager.setVolume(vol / 100);
        });

        touchscreen.addEventListener('change', (e) => {
            this.engine.touchscreenMode = e.target.checked;
            localStorage.setItem('parkoreen_touchscreen', e.target.checked);
            this.updateTouchControls();
        });

        // Load saved settings
        const savedTouchscreen = localStorage.getItem('parkoreen_touchscreen') === 'true';
        touchscreen.checked = savedTouchscreen;
        this.engine.touchscreenMode = savedTouchscreen;

        const savedVolume = localStorage.getItem('parkoreen_volume');
        if (savedVolume !== null) {
            const vol = Math.round(parseFloat(savedVolume) * 100);
            volumeRange.value = vol;
            volumeNumber.value = vol;
        }
    }

    attachFontDropdownListeners() {
        const trigger = document.getElementById('font-dropdown-trigger');
        const dropdown = document.getElementById('font-dropdown');
        const menu = document.getElementById('font-dropdown-menu');

        trigger.addEventListener('click', () => {
            dropdown.classList.toggle('active');
            if (dropdown.classList.contains('active')) {
                // Position the menu to stay on screen
                const rect = trigger.getBoundingClientRect();
                const menuHeight = 300; // max-height
                const menuWidth = 200;
                
                // Calculate position
                let top = rect.bottom + 4;
                let left = rect.left;
                
                // Check if menu would go off bottom of screen
                if (top + menuHeight > window.innerHeight) {
                    // Open upwards instead
                    top = rect.top - menuHeight - 4;
                }
                
                // Check if menu would go off right of screen
                if (left + menuWidth > window.innerWidth) {
                    left = window.innerWidth - menuWidth - 10;
                }
                
                // Ensure it's not off the left
                if (left < 10) left = 10;
                
                // Ensure it's not off the top
                if (top < 10) top = 10;
                
                menu.style.top = top + 'px';
                menu.style.left = left + 'px';
                this.populateFontDropdown();
            }
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    }

    populateFontDropdown() {
        const menu = document.getElementById('font-dropdown-menu');
        
        let html = `
            <div class="font-dropdown-search">
                <input type="text" class="form-input form-input-sm" id="font-search" placeholder="Search fonts...">
            </div>
        `;

        // Recent fonts section
        if (this.recentFonts.length > 0) {
            html += `
                <div class="font-dropdown-section" id="font-section-recent">
                    <div class="font-dropdown-section-title">Recently Used</div>
            `;
            for (const font of this.recentFonts) {
                html += `
                    <div class="font-dropdown-item" data-font="${font}">
                        <span style="font-family: '${font}'">${font}</span>
                        <button class="btn btn-icon btn-ghost font-dropdown-item-remove" data-remove-font="${font}">
                            <span class="material-symbols-outlined" style="font-size: 16px;">close</span>
                        </button>
                    </div>
                `;
            }
            html += `</div>`;
        }

        // Custom fonts section (Parkoreen fonts)
        html += `
            <div class="font-dropdown-section" id="font-section-custom">
                <div class="font-dropdown-section-title">Parkoreen Fonts</div>
        `;
        for (const font of CUSTOM_FONTS) {
            html += `
                <div class="font-dropdown-item" data-font="${font}">
                    <span style="font-family: '${font}'">${font}</span>
                </div>
            `;
        }
        html += `</div>`;

        // Google fonts section
        const googleOnlyFonts = GOOGLE_FONTS.filter(f => !CUSTOM_FONTS.includes(f));
        html += `
            <div class="font-dropdown-section" id="font-section-all">
                <div class="font-dropdown-section-title">Google Fonts</div>
        `;
        for (const font of googleOnlyFonts) {
            html += `
                <div class="font-dropdown-item" data-font="${font}">
                    <span style="font-family: '${font}'">${font}</span>
                </div>
            `;
        }
        html += `</div>`;

        menu.innerHTML = html;

        // Attach event listeners
        menu.querySelectorAll('.font-dropdown-item[data-font]').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.font-dropdown-item-remove')) return;
                this.selectFont(item.dataset.font);
            });
        });

        menu.querySelectorAll('[data-remove-font]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeRecentFont(btn.dataset.removeFont);
            });
        });

        // Search functionality
        const searchInput = document.getElementById('font-search');
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            menu.querySelectorAll('.font-dropdown-item').forEach(item => {
                const font = item.dataset.font.toLowerCase();
                item.style.display = font.includes(query) ? '' : 'none';
            });
        });

        // Load fonts dynamically
        this.loadGoogleFonts();
    }

    loadGoogleFonts() {
        // Create link elements for Google Fonts (exclude custom fonts, they're loaded via CSS)
        const fontsToLoad = [...new Set([...this.recentFonts, ...GOOGLE_FONTS])]
            .filter(f => !CUSTOM_FONTS.includes(f));
        const fontFamilies = fontsToLoad.map(f => f.replace(/ /g, '+')).join('&family=');
        
        if (!document.getElementById('google-fonts-link') && fontFamilies) {
            const link = document.createElement('link');
            link.id = 'google-fonts-link';
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${fontFamilies}&display=swap`;
            document.head.appendChild(link);
        }
    }

    selectFont(font) {
        this.textSettings.font = font;
        document.getElementById('font-dropdown-value').textContent = font;
        document.getElementById('font-dropdown').classList.remove('active');
        
        // Add to recent fonts
        this.addRecentFont(font);
    }

    addRecentFont(font) {
        const index = this.recentFonts.indexOf(font);
        if (index !== -1) {
            this.recentFonts.splice(index, 1);
        }
        this.recentFonts.unshift(font);
        if (this.recentFonts.length > 6) {
            this.recentFonts.pop();
        }
        localStorage.setItem('parkoreen_recent_fonts', JSON.stringify(this.recentFonts));
    }

    removeRecentFont(font) {
        const index = this.recentFonts.indexOf(font);
        if (index !== -1) {
            this.recentFonts.splice(index, 1);
            localStorage.setItem('parkoreen_recent_fonts', JSON.stringify(this.recentFonts));
            this.populateFontDropdown();
        }
    }

    // ========================================
    // TOOL MANAGEMENT
    // ========================================
    setTool(tool) {
        // Deactivate previous tool
        if (this.currentTool === EditorTool.FLY) {
            this.isFlying = false;
            if (this.engine.localPlayer) {
                this.engine.localPlayer.isFlying = false;
                // Reset velocity when leaving fly mode
                this.engine.localPlayer.vx = 0;
                this.engine.localPlayer.vy = 0;
                // Reset jumps so player can jump again
                this.engine.localPlayer.resetJumps();
            }
        }
        if (this.currentTool === EditorTool.ERASE) {
            this.isErasing = false;
        }

        // Update button states
        this.ui.toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        if (tool === this.currentTool) {
            // Toggle off
            this.currentTool = EditorTool.NONE;
        } else {
            this.currentTool = tool;
            const btn = this.ui.toolbar.querySelector(`[data-tool="${tool}"]`);
            if (btn) btn.classList.add('active');

            // Activate tool
            if (tool === EditorTool.FLY) {
                this.isFlying = true;
                if (this.engine.localPlayer) {
                    this.engine.localPlayer.isFlying = true;
                    // Reset velocity when entering fly mode
                    this.engine.localPlayer.vx = 0;
                    this.engine.localPlayer.vy = 0;
                }
            } else if (tool === EditorTool.ERASE) {
                this.isErasing = true;
            }
        }
    }

    handleToolbarAction(action) {
        switch (action) {
            case 'zoom-in':
                this.camera.zoomIn();
                break;
            case 'zoom-out':
                this.camera.zoomOut();
                break;
        }
    }

    // ========================================
    // PANEL MANAGEMENT
    // ========================================
    togglePanel(panel) {
        const panels = {
            config: this.ui.configPanel,
            layers: this.ui.layersPanel,
            settings: this.ui.settingsPanel
        };

        const targetPanel = panels[panel];
        const isActive = targetPanel.classList.contains('active');

        // Close all panels
        Object.values(panels).forEach(p => p.classList.remove('active'));

        // Toggle target panel
        if (!isActive) {
            targetPanel.classList.add('active');
            if (panel === 'layers') {
                this.updateLayersList();
            }
        }
    }

    closePanel(panel) {
        const panels = {
            config: this.ui.configPanel,
            layers: this.ui.layersPanel,
            settings: this.ui.settingsPanel
        };
        panels[panel]?.classList.remove('active');
    }

    toggleAddMenu() {
        this.ui.addMenu.classList.toggle('active');
    }

    closeAddMenu() {
        this.ui.addMenu.classList.remove('active');
    }

    // ========================================
    // PLACEMENT MODE
    // ========================================
    startPlacement(mode) {
        this.closeAddMenu();
        this.placementMode = mode;
        
        // Update UI - change add button to close icon (click handler checks placementMode)
        this.ui.btnAdd.innerHTML = '<span class="material-symbols-outlined">close</span>';
        
        this.ui.btnLayers.classList.add('hidden');
        this.ui.toolbar.classList.add('hidden');
        this.ui.placementToolbar.classList.add('active');

        // Show/hide options based on mode
        this.updatePlacementOptions();
        this.updateDefaultColor();
    }

    stopPlacement() {
        this.placementMode = PlacementMode.NONE;
        this.isPlacing = false;
        
        // Reset UI - restore add icon (click handler checks placementMode)
        this.ui.btnAdd.innerHTML = '<span class="material-symbols-outlined">add</span>';
        
        // Make sure button is visible and enabled
        this.ui.btnAdd.classList.remove('hidden');
        this.ui.btnAdd.disabled = false;
        this.ui.btnAdd.style.pointerEvents = '';
        
        this.ui.btnLayers.classList.remove('hidden');
        this.ui.toolbar.classList.remove('hidden');
        this.ui.placementToolbar.classList.remove('active');
        
        // Ensure add menu is closed
        this.closeAddMenu();
    }

    updatePlacementOptions() {
        const options = {
            appearance: document.getElementById('placement-appearance'),
            acting: document.getElementById('placement-acting'),
            collision: document.getElementById('placement-collision'),
            fill: document.getElementById('placement-fill'),
            color: document.getElementById('placement-color'),
            opacity: document.getElementById('placement-opacity'),
            content: document.getElementById('placement-content'),
            font: document.getElementById('placement-font'),
            halign: document.getElementById('placement-halign'),
            valign: document.getElementById('placement-valign'),
            hspacing: document.getElementById('placement-hspacing'),
            vspacing: document.getElementById('placement-vspacing')
        };

        // Hide all first
        Object.values(options).forEach(el => el.classList.add('hidden'));

        if (this.placementMode === PlacementMode.BLOCK) {
            options.appearance.classList.remove('hidden');
            options.acting.classList.remove('hidden');
            options.collision.classList.remove('hidden');
            options.fill.classList.remove('hidden');
            options.color.classList.remove('hidden');
            options.opacity.classList.remove('hidden');

            // Update appearance buttons for block
            const appearanceBtns = options.appearance.querySelector('.placement-option-btns');
            appearanceBtns.innerHTML = `
                <button class="placement-opt-btn ${this.placementSettings.appearanceType === 'ground' ? 'active' : ''}" data-appearance="ground">Ground</button>
                <button class="placement-opt-btn ${this.placementSettings.appearanceType === 'spike' ? 'active' : ''}" data-appearance="spike">Spike</button>
            `;
            this.reattachAppearanceListeners();

            // Update acting type buttons for block
            const actingBtns = options.acting.querySelector('.placement-option-btns');
            actingBtns.innerHTML = `
                <button class="placement-opt-btn ${this.placementSettings.actingType === 'ground' ? 'active' : ''}" data-acting="ground">Ground</button>
                <button class="placement-opt-btn ${this.placementSettings.actingType === 'spike' ? 'active' : ''}" data-acting="spike">Spike</button>
                <button class="placement-opt-btn ${this.placementSettings.actingType === 'checkpoint' ? 'active' : ''}" data-acting="checkpoint">Check</button>
                <button class="placement-opt-btn ${this.placementSettings.actingType === 'spawnpoint' ? 'active' : ''}" data-acting="spawnpoint">Spawn</button>
                <button class="placement-opt-btn ${this.placementSettings.actingType === 'endpoint' ? 'active' : ''}" data-acting="endpoint">End</button>
            `;
            this.reattachActingListeners();
            
            // Update collision buttons
            document.querySelectorAll('[data-collision]').forEach(btn => {
                btn.classList.toggle('active', (btn.dataset.collision === 'true') === this.placementSettings.collision);
            });
        } else if (this.placementMode === PlacementMode.KOREEN) {
            options.appearance.classList.remove('hidden');
            options.acting.classList.remove('hidden');
            options.fill.classList.remove('hidden');
            options.opacity.classList.remove('hidden');

            // Update appearance for koreen
            const appearanceBtns = options.appearance.querySelector('.placement-option-btns');
            appearanceBtns.innerHTML = `
                <button class="placement-opt-btn ${this.koreenSettings.appearanceType === 'checkpoint' ? 'active' : ''}" data-appearance="checkpoint">Checkpoint</button>
                <button class="placement-opt-btn ${this.koreenSettings.appearanceType === 'spawnpoint' ? 'active' : ''}" data-appearance="spawnpoint">Spawnpoint</button>
                <button class="placement-opt-btn ${this.koreenSettings.appearanceType === 'endpoint' ? 'active' : ''}" data-appearance="endpoint">Endpoint</button>
            `;
            this.reattachAppearanceListeners();

            // Update acting type buttons for koreen
            const actingBtns = options.acting.querySelector('.placement-option-btns');
            actingBtns.innerHTML = `
                <button class="placement-opt-btn ${this.koreenSettings.actingType === 'checkpoint' ? 'active' : ''}" data-acting="checkpoint">Check</button>
                <button class="placement-opt-btn ${this.koreenSettings.actingType === 'spawnpoint' ? 'active' : ''}" data-acting="spawnpoint">Spawn</button>
                <button class="placement-opt-btn ${this.koreenSettings.actingType === 'endpoint' ? 'active' : ''}" data-acting="endpoint">End</button>
                <button class="placement-opt-btn ${this.koreenSettings.actingType === 'text' ? 'active' : ''}" data-acting="text">Text</button>
            `;
            this.reattachActingListeners();
        } else if (this.placementMode === PlacementMode.TEXT) {
            options.content.classList.remove('hidden');
            options.acting.classList.remove('hidden');
            options.font.classList.remove('hidden');
            options.color.classList.remove('hidden');
            options.opacity.classList.remove('hidden');
            options.halign.classList.remove('hidden');
            options.valign.classList.remove('hidden');
            options.hspacing.classList.remove('hidden');
            options.vspacing.classList.remove('hidden');

            // Update acting type buttons for text
            const actingBtns = options.acting.querySelector('.placement-option-btns');
            actingBtns.innerHTML = `
                <button class="placement-opt-btn ${this.textSettings.actingType === 'ground' ? 'active' : ''}" data-acting="ground">Ground</button>
                <button class="placement-opt-btn ${this.textSettings.actingType === 'spike' ? 'active' : ''}" data-acting="spike">Spike</button>
                <button class="placement-opt-btn ${this.textSettings.actingType === 'checkpoint' ? 'active' : ''}" data-acting="checkpoint">Check</button>
                <button class="placement-opt-btn ${this.textSettings.actingType === 'spawnpoint' ? 'active' : ''}" data-acting="spawnpoint">Spawn</button>
                <button class="placement-opt-btn ${this.textSettings.actingType === 'endpoint' ? 'active' : ''}" data-acting="endpoint">End</button>
                <button class="placement-opt-btn ${this.textSettings.actingType === 'text' ? 'active' : ''}" data-acting="text">Text</button>
            `;
            this.reattachActingListeners();
            
            // Update content input (textarea)
            const contentInput = document.getElementById('placement-content-input');
            if (contentInput) {
                contentInput.value = this.textSettings.content || '';
            }
            
            // Update color picker
            const colorInput = document.querySelector('#placement-color input[type="color"]');
            if (colorInput) {
                colorInput.value = this.textSettings.color || '#000000';
            }
        }
    }

    reattachAppearanceListeners() {
        const container = document.querySelector('#placement-appearance .placement-option-btns');
        if (!container) return;
        
        // Clone and replace to remove all event listeners
        const newContainer = container.cloneNode(true);
        container.parentNode.replaceChild(newContainer, container);
        
        newContainer.querySelectorAll('[data-appearance]').forEach(btn => {
            btn.addEventListener('click', () => {
                newContainer.querySelectorAll('[data-appearance]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (this.placementMode === PlacementMode.BLOCK) {
                    this.placementSettings.appearanceType = btn.dataset.appearance;
                    // Sync acting type with appearance type for blocks
                    this.placementSettings.actingType = btn.dataset.appearance;
                    this.syncActingTypeUI(btn.dataset.appearance);
                } else if (this.placementMode === PlacementMode.KOREEN) {
                    this.koreenSettings.appearanceType = btn.dataset.appearance;
                    // Sync acting type with appearance type for koreens
                    this.koreenSettings.actingType = btn.dataset.appearance;
                    this.syncActingTypeUI(btn.dataset.appearance);
                }
                this.updateDefaultColor();
            });
        });
    }

    reattachActingListeners() {
        const container = document.querySelector('#placement-acting .placement-option-btns');
        if (!container) return;
        
        // Clone and replace to remove all event listeners
        const newContainer = container.cloneNode(true);
        container.parentNode.replaceChild(newContainer, container);
        
        newContainer.querySelectorAll('[data-acting]').forEach(btn => {
            btn.addEventListener('click', () => {
                newContainer.querySelectorAll('.placement-opt-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (this.placementMode === PlacementMode.BLOCK) {
                    this.placementSettings.actingType = btn.dataset.acting;
                } else if (this.placementMode === PlacementMode.KOREEN) {
                    this.koreenSettings.actingType = btn.dataset.acting;
                } else if (this.placementMode === PlacementMode.TEXT) {
                    this.textSettings.actingType = btn.dataset.acting;
                }
            });
        });
    }

    updateDefaultColor() {
        let color;
        if (this.placementMode === PlacementMode.BLOCK) {
            if (this.placementSettings.appearanceType === 'spike') {
                color = this.world.defaultSpikeColor;
            } else {
                color = this.world.defaultBlockColor;
            }
            this.placementSettings.color = color;
        } else if (this.placementMode === PlacementMode.TEXT) {
            color = this.world.defaultTextColor;
            this.textSettings.color = color;
        } else {
            return;
        }
        
        document.getElementById('placement-color-preview').style.background = color;
        document.getElementById('placement-color-input').value = color;
    }
    
    syncActingTypeUI(actingType) {
        // Update the acting type buttons to show the correct active state
        const actingContainer = document.querySelector('#placement-acting .placement-option-btns');
        if (!actingContainer) return;
        
        actingContainer.querySelectorAll('[data-acting]').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.acting === actingType) {
                btn.classList.add('active');
            }
        });
    }

    // ========================================
    // LAYERS
    // ========================================
    updateLayersList() {
        const list = this.ui.layersList;
        list.innerHTML = '';

        for (let i = this.world.objects.length - 1; i >= 0; i--) {
            const obj = this.world.objects[i];
            const item = document.createElement('div');
            item.className = 'layer-item';
            item.dataset.id = obj.id;
            item.draggable = true;
            
            item.innerHTML = `
                <span class="material-symbols-outlined" style="cursor: grab; color: var(--text-muted);">drag_indicator</span>
                <span class="layer-item-name">${obj.name}</span>
                <div class="layer-item-actions">
                    <button class="layer-btn layer-delete" data-delete="${obj.id}" title="Delete">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                    <button class="layer-btn ${obj.layer === 2 ? 'active' : ''}" data-layer="2" data-obj="${obj.id}" title="On top of player">
                        <span class="material-symbols-outlined">arrow_upward_alt</span>
                    </button>
                    <button class="layer-btn ${obj.layer === 1 ? 'active' : ''}" data-layer="1" data-obj="${obj.id}" title="Same layer">
                        <span class="material-symbols-outlined">remove</span>
                    </button>
                    <button class="layer-btn ${obj.layer === 0 ? 'active' : ''}" data-layer="0" data-obj="${obj.id}" title="Behind player">
                        <span class="material-symbols-outlined">arrow_downward_alt</span>
                    </button>
                </div>
            `;

            // Delete button
            item.querySelector('.layer-delete').addEventListener('click', () => {
                this.world.removeObject(obj.id);
                this.updateLayersList();
                this.triggerMapChange();
            });

            // Layer buttons
            item.querySelectorAll('[data-layer]').forEach(btn => {
                btn.addEventListener('click', () => {
                    obj.layer = parseInt(btn.dataset.layer);
                    this.updateLayersList();
                    this.triggerMapChange();
                });
            });

            // Drag and drop
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', i.toString());
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = Array.from(list.children).indexOf(item);
                const realFromIndex = this.world.objects.length - 1 - fromIndex;
                const realToIndex = this.world.objects.length - 1 - toIndex;
                this.world.reorderLayers(realFromIndex, realToIndex);
                this.updateLayersList();
                this.triggerMapChange();
            });

            list.appendChild(item);
        }
    }

    // ========================================
    // COLOR PICKER
    // ========================================
    openColorPicker(target) {
        this.colorPickerState.target = target;
        this.ui.colorPickerPopup.classList.add('active');
        
        // Get current color
        let currentColor;
        if (target === 'placement') {
            currentColor = this.placementMode === PlacementMode.TEXT 
                ? this.textSettings.color 
                : this.placementSettings.color;
        } else if (target.startsWith('config-')) {
            const type = target.replace('config-', '');
            currentColor = document.getElementById(`config-${type}-color`).value;
        }
        
        // Set initial state from color
        this.setColorPickerFromHex(currentColor);
    }

    closeColorPicker() {
        this.ui.colorPickerPopup.classList.remove('active');
        this.colorPickerState.target = null;
    }

    setColorPickerFromHex(hex) {
        // Convert hex to HSL
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        this.colorPickerState.hue = Math.round(h * 360);
        this.colorPickerState.saturation = Math.round(s * 100);
        this.colorPickerState.lightness = Math.round(l * 100);

        // Update UI
        document.getElementById('color-picker-hue').value = this.colorPickerState.hue;
        document.getElementById('color-picker-hex').value = hex;
        document.getElementById('color-picker-preview-box').style.background = hex;
        
        const gradient = document.getElementById('color-picker-gradient');
        gradient.style.background = `
            linear-gradient(to bottom, transparent, black),
            linear-gradient(to right, white, hsl(${this.colorPickerState.hue}, 100%, 50%))
        `;

        // Position cursor
        const cursor = document.getElementById('color-picker-cursor');
        cursor.style.left = `${this.colorPickerState.saturation}%`;
        cursor.style.top = `${100 - this.colorPickerState.lightness}%`;
    }

    updateColorPickerPreview() {
        const hex = this.hslToHex(
            this.colorPickerState.hue,
            this.colorPickerState.saturation,
            this.colorPickerState.lightness
        );
        
        document.getElementById('color-picker-hex').value = hex;
        document.getElementById('color-picker-preview-box').style.background = hex;
        
        this.applyColorPickerColor(hex);
    }

    applyColorPickerColor(hex) {
        const target = this.colorPickerState.target;
        
        if (target === 'placement') {
            if (this.placementMode === PlacementMode.TEXT) {
                this.textSettings.color = hex;
            } else {
                this.placementSettings.color = hex;
            }
            document.getElementById('placement-color-preview').style.background = hex;
            document.getElementById('placement-color-input').value = hex;
        } else if (target && target.startsWith('config-')) {
            const type = target.replace('config-', '');
            document.getElementById(`config-${type}-color`).value = hex;
            document.getElementById(`config-${type}-color-preview`).style.background = hex;
            
            if (type === 'block') this.world.defaultBlockColor = hex;
            else if (type === 'spike') this.world.defaultSpikeColor = hex;
            else if (type === 'text') this.world.defaultTextColor = hex;
        }
    }

    hslToHex(h, s, l) {
        s /= 100;
        l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }

    // ========================================
    // INPUT HANDLING
    // ========================================
    handleKeyPress(e) {
        if (this.engine.state !== GameState.EDITOR) return;

        switch (e.code) {
            case 'KeyG':
                this.setTool(EditorTool.FLY);
                break;
            case 'KeyM':
                this.setTool(EditorTool.MOVE);
                break;
            case 'KeyC':
                this.setTool(EditorTool.DUPLICATE);
                break;
            case 'KeyR':
                this.rotateSelected();
                break;
            case 'Escape':
                this.handleEscape();
                break;
        }
    }

    handleEscape() {
        if (this.placementMode !== PlacementMode.NONE) {
            this.stopPlacement();
        } else if (this.currentTool !== EditorTool.NONE) {
            this.setTool(this.currentTool); // Toggle off
        } else if (this.movingObject) {
            this.movingObject = null;
        } else {
            this.closeColorPicker();
            this.closeAddMenu();
            this.closePanel('config');
            this.closePanel('layers');
            this.closePanel('settings');
        }
    }

    handleMouseMove(e) {
        if (this.engine.state !== GameState.EDITOR) return;

        const worldPos = this.engine.getMouseWorldPos();
        const gridPos = this.engine.getGridAlignedPos(worldPos.x, worldPos.y);

        // Fly mode camera movement
        if (this.isFlying && this.engine.mouse.down && this.placementMode === PlacementMode.NONE) {
            this.camera.targetX -= e.movementX / this.camera.zoom;
            this.camera.targetY -= e.movementY / this.camera.zoom;
        }

        // Brush-like placement - continue placing while mouse is held
        if (this.isPlacing && this.engine.mouse.down && this.placementMode !== PlacementMode.NONE && !this.isOverUI(e)) {
            this.placeObject(gridPos.x, gridPos.y);
        }

        // Moving object
        if (this.movingObject) {
            this.movingObject.x = gridPos.x;
            this.movingObject.y = gridPos.y;
        }

        // Quick eraser
        if (this.isErasing && this.engine.mouse.down && !this.isOverUI(e)) {
            const obj = this.world.getObjectAt(worldPos.x, worldPos.y);
            if (obj) {
                this.world.removeObject(obj.id);
                this.triggerMapChange();
            }
        }

        // Update hovered object
        this.hoveredObject = this.world.getObjectAt(worldPos.x, worldPos.y);
    }

    handleMouseDown(e) {
        if (this.engine.state !== GameState.EDITOR) return;
        if (this.isOverUI(e)) return;

        const worldPos = this.engine.getMouseWorldPos();
        const gridPos = this.engine.getGridAlignedPos(worldPos.x, worldPos.y);

        // Placement mode - start brush placement
        if (this.placementMode !== PlacementMode.NONE) {
            this.isPlacing = true;
            this.placeObject(gridPos.x, gridPos.y);
            return;
        }

        // Tool actions
        switch (this.currentTool) {
            case EditorTool.MOVE:
                const obj = this.world.getObjectAt(worldPos.x, worldPos.y);
                if (obj) {
                    this.movingObject = obj;
                }
                break;
            
            case EditorTool.DUPLICATE:
                const objToDupe = this.world.getObjectAt(worldPos.x, worldPos.y);
                if (objToDupe) {
                    const clone = objToDupe.clone();
                    this.world.addObject(clone);
                    this.movingObject = clone;
                    this.triggerMapChange();
                }
                break;
            
            case EditorTool.ROTATE:
                const objToRotate = this.world.getObjectAt(worldPos.x, worldPos.y);
                if (objToRotate) {
                    objToRotate.rotation = (objToRotate.rotation - 90 + 360) % 360;
                    this.triggerMapChange();
                }
                break;
            
            case EditorTool.ERASE:
                const objToErase = this.world.getObjectAt(worldPos.x, worldPos.y);
                if (objToErase) {
                    this.world.removeObject(objToErase.id);
                    this.triggerMapChange();
                }
                break;
        }
    }

    handleMouseUp(e) {
        // Stop brush placement
        this.isPlacing = false;
        
        if (this.movingObject) {
            this.movingObject.snapToGrid();
            this.movingObject = null;
            this.setTool(EditorTool.NONE);
            this.triggerMapChange();
        }
    }

    isOverUI(e) {
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        return elements.some(el => 
            el.closest('.toolbar') ||
            el.closest('.panel') ||
            el.closest('.btn') ||
            el.closest('.add-menu') ||
            el.closest('.placement-toolbar') ||
            el.closest('.color-picker-popup') ||
            el.closest('.modal-overlay')
        );
    }

    rotateSelected() {
        const worldPos = this.engine.getMouseWorldPos();
        const obj = this.world.getObjectAt(worldPos.x, worldPos.y);
        if (obj) {
            obj.rotation = (obj.rotation - 90 + 360) % 360;
            this.triggerMapChange();
        }
    }

    // ========================================
    // OBJECT PLACEMENT
    // ========================================
    placeObject(x, y) {
        let settings, type;

        if (this.placementMode === PlacementMode.BLOCK) {
            settings = this.placementSettings;
            type = 'block';
        } else if (this.placementMode === PlacementMode.KOREEN) {
            settings = this.koreenSettings;
            type = 'koreen';
        } else if (this.placementMode === PlacementMode.TEXT) {
            settings = this.textSettings;
            type = 'text';
        } else {
            return;
        }

        // Check fill mode
        const fillMode = settings.fillMode || 'add';
        const existingObj = this.world.getObjectAt(x + GRID_SIZE / 2, y + GRID_SIZE / 2);

        if (fillMode === 'add' && existingObj) {
            return; // Don't place if something exists
        }

        if (fillMode === 'replace' && existingObj) {
            this.world.removeObject(existingObj.id);
        }

        // Create object
        const obj = new WorldObject({
            x: x,
            y: y,
            type: type,
            appearanceType: settings.appearanceType || 'ground',
            actingType: settings.actingType || 'ground',
            collision: settings.collision !== undefined ? settings.collision : true,
            color: settings.color || '#787878',
            opacity: settings.opacity !== undefined ? settings.opacity : 1,
            content: settings.content || '',
            font: settings.font || 'Arial',
            hAlign: settings.hAlign || 'center',
            vAlign: settings.vAlign || 'center',
            hSpacing: settings.hSpacing || 0,
            vSpacing: settings.vSpacing || 0
        });

        // Set default layer based on type
        if (settings.actingType === 'spike') {
            obj.layer = 2; // Above player by default for spikes
        } else if (settings.collision) {
            obj.layer = 1; // Same layer for collidable
        } else {
            obj.layer = 1;
        }

        this.world.addObject(obj);
        this.triggerMapChange();
    }

    // ========================================
    // TEST MODE
    // ========================================
    async startTest() {
        if (!this.world.spawnPoint) {
            this.showToast('Please add a spawn point first!', 'error');
            return;
        }

        // Save before testing
        if (this.onBeforeTest) {
            await this.onBeforeTest();
        }

        this.engine.startTestGame();
        
        // Update UI
        this.ui.btnConfig.classList.add('hidden');
        this.ui.btnAdd.classList.add('hidden');
        this.ui.btnLayers.classList.add('hidden');
        this.ui.btnStopTest.classList.remove('hidden');
        this.ui.placementToolbar.classList.remove('active');
        
        // Show limited toolbar (fly, zoom in, zoom out only)
        this.ui.toolbar.classList.remove('hidden');
        this.ui.toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
            const tool = btn.dataset.tool;
            const action = btn.dataset.action;
            // Show only fly, zoom-in, zoom-out
            if (tool === 'fly' || action === 'zoom-in' || action === 'zoom-out') {
                btn.classList.remove('hidden');
            } else {
                btn.classList.add('hidden');
            }
        });
        // Hide dividers
        this.ui.toolbar.querySelectorAll('.toolbar-divider').forEach(div => {
            div.classList.add('hidden');
        });
        
        this.closePanel('config');
        this.closePanel('layers');
        this.closeAddMenu();
        this.stopPlacement();
    }

    stopTest() {
        this.engine.stopGame();
        
        // Restore UI
        this.ui.btnConfig.classList.remove('hidden');
        this.ui.btnAdd.classList.remove('hidden');
        this.ui.btnLayers.classList.remove('hidden');
        this.ui.btnStopTest.classList.add('hidden');
        
        // Restore full toolbar
        this.ui.toolbar.classList.remove('hidden');
        this.ui.toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
            btn.classList.remove('hidden');
        });
        this.ui.toolbar.querySelectorAll('.toolbar-divider').forEach(div => {
            div.classList.remove('hidden');
        });
    }

    // ========================================
    // EXPORT/IMPORT
    // ========================================
    exportMap() {
        const data = this.world.toJSON();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.world.mapName.replace(/[^a-z0-9]/gi, '_')}.pkrn`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('Map exported successfully!', 'success');
    }

    importMap(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                this.world.fromJSON(data);
                this.updateBackground();
                this.triggerMapChange();
                this.showToast('Map imported successfully!', 'success');
            } catch (err) {
                this.showToast('Invalid map file!', 'error');
            }
        };
        reader.readAsText(file);
        
        // Reset input
        e.target.value = '';
    }

    // ========================================
    // HOST GAME
    // ========================================
    generatePassword() {
        const chars = '0123456789AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz!@#$%';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        document.getElementById('config-password').value = password;
    }

    hostGame() {
        // Validate
        if (!this.world.spawnPoint) {
            this.showToast('Please add a spawn point first!', 'error');
            return;
        }

        const usePassword = document.getElementById('config-use-password').checked;
        const password = document.getElementById('config-password').value;

        if (usePassword && !password) {
            this.showToast('Please enter a password or disable password protection.', 'error');
            return;
        }

        // Host game logic will be handled by multiplayer module
        if (window.MultiplayerManager) {
            window.MultiplayerManager.hostGame({
                mapData: this.world.toJSON(),
                maxPlayers: parseInt(document.getElementById('config-max-players').value) || 10,
                usePassword: usePassword,
                password: password
            });
        } else {
            this.showToast('Multiplayer not available', 'error');
        }
    }

    // ========================================
    // BACKGROUND
    // ========================================
    updateBackground() {
        const gameContainer = document.getElementById('game-container');
        if (!gameContainer) return;

        let bgElement = gameContainer.querySelector('.game-bg');
        if (!bgElement) {
            bgElement = document.createElement('div');
            bgElement.className = 'game-bg';
            gameContainer.insertBefore(bgElement, gameContainer.firstChild);
        }

        bgElement.className = `game-bg ${this.world.background}`;
        
        // Also sync config panel values with world
        this.syncConfigPanel();
    }
    
    syncConfigPanel() {
        // Map Name
        const mapNameInput = document.getElementById('config-map-name');
        if (mapNameInput) mapNameInput.value = this.world.mapName || 'Untitled Map';

        // Background
        const bgSelect = document.getElementById('config-background');
        if (bgSelect) bgSelect.value = this.world.background;
        
        // Colors
        const blockColor = document.getElementById('config-block-color');
        const blockPreview = document.getElementById('config-block-color-preview');
        if (blockColor) blockColor.value = this.world.defaultBlockColor;
        if (blockPreview) blockPreview.style.background = this.world.defaultBlockColor;
        
        const spikeColor = document.getElementById('config-spike-color');
        const spikePreview = document.getElementById('config-spike-color-preview');
        if (spikeColor) spikeColor.value = this.world.defaultSpikeColor;
        if (spikePreview) spikePreview.style.background = this.world.defaultSpikeColor;
        
        const textColor = document.getElementById('config-text-color');
        const textPreview = document.getElementById('config-text-color-preview');
        if (textColor) textColor.value = this.world.defaultTextColor;
        if (textPreview) textPreview.style.background = this.world.defaultTextColor;
        
        // Jumps
        const jumpsSelect = document.getElementById('config-jumps');
        const jumpsNumber = document.getElementById('config-jumps-number');
        const jumpsNumberGroup = document.getElementById('config-jumps-number-group');
        const airjumpGroup = document.getElementById('config-airjump-group');
        const airjumpCheck = document.getElementById('config-airjump');
        const collideCheck = document.getElementById('config-collide');
        
        if (jumpsSelect) {
            jumpsSelect.value = this.world.infiniteJumps ? 'infinite' : 'set';
        }
        if (jumpsNumber) jumpsNumber.value = this.world.maxJumps;
        if (jumpsNumberGroup) jumpsNumberGroup.classList.toggle('hidden', this.world.infiniteJumps);
        if (airjumpGroup) airjumpGroup.classList.toggle('hidden', this.world.infiniteJumps);
        if (airjumpCheck) airjumpCheck.checked = this.world.additionalAirjump;
        if (collideCheck) collideCheck.checked = this.world.collideWithEachOther;
        
        // Die line Y
        const dieLineY = document.getElementById('config-die-line-y');
        if (dieLineY) dieLineY.value = this.world.dieLineY || 2000;
        
        // Physics settings
        const playerSpeed = document.getElementById('config-player-speed');
        if (playerSpeed) playerSpeed.value = this.world.playerSpeed || 5;
        
        const jumpForce = document.getElementById('config-jump-force');
        if (jumpForce) jumpForce.value = this.world.jumpForce || -14;
        
        const gravity = document.getElementById('config-gravity');
        if (gravity) gravity.value = this.world.gravity || 0.8;
        
        // Spike touchbox
        const spikeTouchbox = document.getElementById('config-spike-touchbox');
        if (spikeTouchbox) {
            spikeTouchbox.value = this.world.spikeTouchbox || 'normal';
            this.updateSpikeTouchboxDescription(spikeTouchbox.value);
        }
    }
    
    updateSpikeTouchboxDescription(mode) {
        const descEl = document.getElementById('spike-touchbox-description');
        if (!descEl) return;
        
        const descriptions = {
            'full': '<strong style="color: #ff6b6b;">Full Spike:</strong> The entire spike is dangerous. Any contact with the spike will damage the player. There is no safe zone.',
            'normal': '<strong style="color: #ffd93d;">Normal Spike:</strong> The flat base of the spike acts as solid ground. All other parts will damage the player on contact. This is the default behavior.',
            'tip': '<strong style="color: #6bcb77;">Tip Spike:</strong> Only the very peak of the spike is dangerous. The flat base acts as ground, and the middle section has no collision at all.',
            'ground': '<strong style="color: #4d96ff;">Ground:</strong> The spike acts completely as solid ground. It will not damage the player at all - useful for decorative spikes.',
            'flag': '<strong style="color: #9b59b6;">Flag:</strong> Only the flat base acts as solid ground. The rest of the spike has no collision - player can pass through but won\'t take damage.',
            'air': '<strong style="color: #888;">Air:</strong> The spike has no collision at all. Players pass through completely without any interaction.'
        };
        
        descEl.innerHTML = descriptions[mode] || descriptions['normal'];
    }
    
    setupCollapsibleSections() {
        const sections = document.querySelectorAll('.config-section.collapsible');
        
        sections.forEach(section => {
            const header = section.querySelector('.config-section-header');
            if (!header) return;
            
            header.addEventListener('click', () => {
                section.classList.toggle('expanded');
            });
        });
    }

    // ========================================
    // TOUCH CONTROLS
    // ========================================
    updateTouchControls() {
        let touchControls = document.getElementById('touch-controls');
        
        if (this.engine.touchscreenMode) {
            if (!touchControls) {
                touchControls = document.createElement('div');
                touchControls.id = 'touch-controls';
                touchControls.className = 'touch-controls active';
                touchControls.innerHTML = `
                    <div class="touch-dpad">
                        <button class="touch-btn up" data-dir="up">▲</button>
                        <button class="touch-btn down" data-dir="down">▼</button>
                        <button class="touch-btn left" data-dir="left">◀</button>
                        <button class="touch-btn right" data-dir="right">▶</button>
                    </div>
                    <button class="touch-jump" data-dir="jump">↑</button>
                `;
                document.body.appendChild(touchControls);

                // Attach touch events
                touchControls.querySelectorAll('[data-dir]').forEach(btn => {
                    btn.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        this.engine.setTouchInput(btn.dataset.dir, true);
                    });
                    btn.addEventListener('touchend', (e) => {
                        e.preventDefault();
                        this.engine.setTouchInput(btn.dataset.dir, false);
                    });
                });
            }
            touchControls.classList.add('active');
        } else if (touchControls) {
            touchControls.classList.remove('active');
        }
    }

    // ========================================
    // RENDERING
    // ========================================
    renderOverlay(ctx, camera) {
        // Grid (only in editor mode, not testing)
        if (this.engine.state === GameState.EDITOR) {
            this.renderGrid(ctx, camera);
            this.renderDieLine(ctx, camera);
        }

        // Hover highlight
        if (this.hoveredObject && this.engine.state === GameState.EDITOR) {
            const screenX = (this.hoveredObject.x - camera.x) * camera.zoom;
            const screenY = (this.hoveredObject.y - camera.y) * camera.zoom;
            const width = this.hoveredObject.width * camera.zoom;
            const height = this.hoveredObject.height * camera.zoom;

            ctx.strokeStyle = '#f4a261';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(screenX, screenY, width, height);
            ctx.setLineDash([]);
        }

        // Placement preview
        if (this.placementMode !== PlacementMode.NONE) {
            const worldPos = this.engine.getMouseWorldPos();
            const gridPos = this.engine.getGridAlignedPos(worldPos.x, worldPos.y);
            const screenX = (gridPos.x - camera.x) * camera.zoom;
            const screenY = (gridPos.y - camera.y) * camera.zoom;
            const size = GRID_SIZE * camera.zoom;

            ctx.fillStyle = 'rgba(45, 90, 39, 0.5)';
            ctx.fillRect(screenX, screenY, size, size);
            ctx.strokeStyle = '#4a8c3f';
            ctx.lineWidth = 2;
            ctx.strokeRect(screenX, screenY, size, size);
        }
    }
    
    renderDieLine(ctx, camera) {
        // Die line - players die if they fall below this Y position
        const dieLineY = this.world.dieLineY ?? 2000; // Default 2000 pixels below origin
        const screenY = (dieLineY - camera.y) * camera.zoom;
        
        // Only render if visible on screen
        if (screenY < 0 || screenY > camera.height) return;
        
        // Draw red dashed die line
        ctx.save();
        ctx.strokeStyle = '#ff3333';
        ctx.lineWidth = 3;
        ctx.setLineDash([15, 10]);
        
        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(camera.width, screenY);
        ctx.stroke();
        
        // Draw label
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = '#ff3333';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.setLineDash([]);
        
        // Background for text
        const text = '☠ DEATH LINE - Players die below this point';
        const textWidth = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, screenY - 24, textWidth + 10, 22);
        
        // Text
        ctx.fillStyle = '#ff3333';
        ctx.fillText(text, 15, screenY - 6);
        
        ctx.restore();
    }

    renderGrid(ctx, camera) {
        const gridSize = GRID_SIZE * camera.zoom;
        const startX = Math.floor(camera.x / GRID_SIZE) * GRID_SIZE;
        const startY = Math.floor(camera.y / GRID_SIZE) * GRID_SIZE;
        const endX = camera.x + camera.width / camera.zoom + GRID_SIZE;
        const endY = camera.y + camera.height / camera.zoom + GRID_SIZE;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        for (let x = startX; x < endX; x += GRID_SIZE) {
            const screenX = (x - camera.x) * camera.zoom;
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, camera.height);
            ctx.stroke();
        }

        for (let y = startY; y < endY; y += GRID_SIZE) {
            const screenY = (y - camera.y) * camera.zoom;
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(camera.width, screenY);
            ctx.stroke();
        }
    }

    // ========================================
    // TOAST NOTIFICATIONS
    // ========================================
    showToast(message, type = 'info') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="material-symbols-outlined">${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}</span>
            <span>${message}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Export
window.Editor = Editor;
window.EditorTool = EditorTool;
window.PlacementMode = PlacementMode;
