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
    ROTATE_LEFT: 'rotate-left',
    ROTATE_RIGHT: 'rotate-right',
    ERASE: 'erase',
    SELECT: 'select'
};

const SelectionMode = {
    QUOT: 'quot',
    MULTI: 'multi',
    MOUSE: 'mouse'
};

const SelectionAction = {
    SELECT: 'select',
    DESELECT: 'deselect'
};

const PlacementMode = {
    NONE: 'none',
    BLOCK: 'block',
    OBSTACLE: 'obstacle',
    KOREEN: 'koreen',
    TEXT: 'text',
    TELEPORTAL: 'teleportal',
    BUTTON: 'button'
};

// ============================================
// BLOCK TEXTURES
// ============================================
const BLOCK_TEXTURES = [
    { id: 'solid', name: 'Solid', preview: null, pattern: null },
    { id: 'brick', name: 'Brick', preview: 'assets/svg/block-brick.svg', pattern: 'assets/svg/block-brick-pattern.svg' },
];

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
        this.flyClickStart = null; // Track mouse position for fly mode click detection
        
        // Selection state
        this.selectedObject = null;
        this.movingObject = null;
        this.isDragging = false;
        this.highlightedLayerObject = null; // Object highlighted from layers panel hover
        
        // Rotation drag state
        this.rotatingObject = null;
        this.rotationStartPos = null;
        
        // Placement settings
        this.placementSettings = {
            appearanceType: 'ground',
            actingType: 'ground',
            texture: 'solid', // solid, brick, stone, etc.
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
        
        // Obstacle settings (spike or saw blade)
        this.obstacleSettings = {
            appearanceType: 'spike', // spike or spinner (saw blade)
            actingType: 'spike',
            collision: true,
            fillMode: 'add',
            width: 2,  // in grid units (for spinner)
            height: 2, // in grid units (for spinner)
            color: '#ff4444',
            opacity: 1,
            spinSpeed: 1 // rotations per second (for spinner)
        };

        // Zone placement state
        this.zonePlacement = {
            isPlacing: false,
            startX: 0,
            startY: 0,
            endX: 0,
            endY: 0
        };

        // Obstacle placement state for saw blade (similar to zone)
        this.obstaclePlacement = {
            isPlacing: false,
            startX: 0,
            startY: 0,
            endX: 0,
            endY: 0
        };
        
        // Zone adjustment mode
        this.zoneAdjustment = {
            active: false,
            zone: null,
            draggerHeld: null
        };
        
        // Text settings
        this.textSettings = {
            content: 'Text',
            actingType: 'text',
            font: 'Parkoreen Game',
            fontSize: 24,
            color: '#000000',
            opacity: 1,
            hAlign: 'center',
            vAlign: 'center',
            hSpacing: 0,
            vSpacing: 0
        };
        
        // Multi-selection state
        this.selectedObjects = new Set();
        this.selectionMode = SelectionMode.QUOT;
        this.selectionAction = SelectionAction.SELECT;
        this.selectionRect = null; // {startX, startY, endX, endY} for Quot mode drag
        this.isSelectionActive = false; // Whether we're in "select tool" mode
        this.selectionMovingObjects = null; // Array of {obj, offsetX, offsetY} during move
        this.selectionMoveStart = null; // {x, y} world pos where move started
        
        // Button placement state (drag-to-draw like zone)
        this.buttonPlacement = {
            isPlacing: false,
            startX: 0,
            startY: 0,
            endX: 0,
            endY: 0
        };
        
        // Grid visibility
        this.showGrid = true;
        
        // Debug tools
        this.invincibilityEnabled = false;
        this.showTouchboxes = false;
        
        // Erase settings
        this.eraseSettings = {
            eraseType: 'all', // 'all', 'top', 'bottom'
            width: 1,  // Width in grid units
            height: 1  // Height in grid units
        };
        
        // Teleportal settings
        this.teleportalSettings = {
            actingType: 'portal',
            color: '#9C27B0', // Purple default for teleportals
            opacity: 1
        };
        
        // Teleportal names registry (must be unique)
        this.teleportalNames = new Set();
        
        // Pending teleportal (waiting for naming)
        this.pendingTeleportal = null;
        
        // Recent fonts
        this.recentFonts = JSON.parse(localStorage.getItem('parkoreen_recent_fonts') || '[]');
        
        // UI Elements (will be set by initUI)
        this.ui = {};
        
        // Callback for map changes (set by host.html for auto-save)
        this.onMapChange = null;
        
        // Audio elements for music
        this.previewAudio = null;
        this.bgMusic = null;
        
        // Bind engine callbacks
        this.setupEngineCallbacks();
    }
    
    // Trigger map change callback (for auto-save)
    triggerMapChange() {
        this.world.markSpatialDirty();
        this.world._tileCacheReady = false;
        this.world._editorMergedDirty = true;
        this.world._teleportalListDirty = true;
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
            <button class="toolbar-btn" data-action="zoom-in" title="Zoom In">
                <span class="material-symbols-outlined">zoom_in</span>
                <span class="toolbar-btn-label">Zoom In</span>
            </button>
            <button class="toolbar-btn" data-action="zoom-out" title="Zoom Out">
                <span class="material-symbols-outlined">zoom_out</span>
                <span class="toolbar-btn-label">Zoom Out</span>
            </button>
            <button class="toolbar-btn" data-tool="erase" title="Quick Eraser">
                <span class="material-symbols-outlined">ink_eraser</span>
                <span class="toolbar-btn-label">Eraser</span>
            </button>
            <div class="toolbar-extra" id="toolbar-extra">
                <button class="toolbar-btn" data-tool="rotate-left" title="Rotate Left">
                    <span class="material-symbols-outlined">rotate_left</span>
                    <span class="toolbar-btn-label">Rotate Left</span>
                </button>
                <button class="toolbar-btn" data-tool="rotate-right" title="Rotate Right">
                    <span class="material-symbols-outlined">rotate_right</span>
                    <span class="toolbar-btn-label">Rotate Right</span>
                </button>
                <button class="toolbar-btn" data-tool="rotate" title="Rotate (drag)">
                    <span class="material-symbols-outlined">sync</span>
                    <span class="toolbar-btn-label">Rotate (R)</span>
                </button>
                <button class="toolbar-btn" data-tool="select" title="Select (V)">
                    <span class="material-symbols-outlined">select_all</span>
                    <span class="toolbar-btn-label">Select (V)</span>
                </button>
                <button class="toolbar-btn active" data-action="toggle-grid" title="Toggle Grid (H)">
                    <span class="material-symbols-outlined">grid_on</span>
                    <span class="toolbar-btn-label">Grid (H)</span>
                </button>
            </div>
            <button class="toolbar-btn toolbar-expand-btn" id="toolbar-expand-btn" title="More Tools">
                <span class="material-symbols-outlined toolbar-expand-icon">chevron_right</span>
            </button>
            <button class="toolbar-btn hidden test-mode-tool" data-action="toggle-invincibility" title="Invincibility">
                <span class="material-symbols-outlined">shield</span>
                <span class="toolbar-btn-label">Invincible</span>
            </button>
            <button class="toolbar-btn hidden test-mode-tool" data-action="toggle-touchboxes" title="Show Touchboxes">
                <span class="material-symbols-outlined">select</span>
                <span class="toolbar-btn-label">Touchbox</span>
            </button>
            <button class="toolbar-btn hidden test-mode-tool" data-action="respawn" title="Respawn at Checkpoint">
                <span class="material-symbols-outlined">restart_alt</span>
                <span class="toolbar-btn-label">Respawn</span>
            </button>
        `;
        document.body.appendChild(toolbar);
        this.ui.toolbar = toolbar;
        this.toolbarExpanded = false;
        
        // Expand/collapse toolbar toggle
        document.getElementById('toolbar-expand-btn').addEventListener('click', () => {
            this.toolbarExpanded = !this.toolbarExpanded;
            const extra = document.getElementById('toolbar-extra');
            const btn = document.getElementById('toolbar-expand-btn');
            extra.classList.toggle('expanded', this.toolbarExpanded);
            btn.classList.toggle('expanded', this.toolbarExpanded);
        });
        
        this.createSelectionToolbar();
    }
    
    createSelectionToolbar() {
        // Main selection toolbar (modes and selection actions)
        const selToolbar = document.createElement('div');
        selToolbar.className = 'toolbar selection-toolbar hidden';
        selToolbar.id = 'selection-toolbar';
        selToolbar.innerHTML = `
            <div class="sel-toolbar-section">
                <span class="sel-toolbar-label">Mode</span>
                <button class="toolbar-btn active" data-sel-mode="quot" title="Rectangle Select">
                    <span class="material-symbols-outlined">select</span>
                    <span class="toolbar-btn-label">Quot</span>
                </button>
                <button class="toolbar-btn" data-sel-mode="multi" title="Multi Select">
                    <span class="material-symbols-outlined">library_add_check</span>
                    <span class="toolbar-btn-label">Multi</span>
                </button>
                <button class="toolbar-btn" data-sel-mode="mouse" title="Mouse (interact)">
                    <span class="material-symbols-outlined">arrow_selector_tool</span>
                    <span class="toolbar-btn-label">Mouse</span>
                </button>
            </div>
            <div class="toolbar-divider"></div>
            <div class="sel-toolbar-section">
                <span class="sel-toolbar-label">Action</span>
                <button class="toolbar-btn active" data-sel-action="select" title="Select objects">
                    <span class="material-symbols-outlined">add_circle</span>
                    <span class="toolbar-btn-label">Select</span>
                </button>
                <button class="toolbar-btn" data-sel-action="deselect" title="Deselect objects">
                    <span class="material-symbols-outlined">remove_circle</span>
                    <span class="toolbar-btn-label">Deselect</span>
                </button>
            </div>
            <div class="toolbar-divider"></div>
            <button class="toolbar-btn" data-sel-cmd="select-all" title="Select All">
                <span class="material-symbols-outlined">select_all</span>
                <span class="toolbar-btn-label">All</span>
            </button>
            <button class="toolbar-btn" data-sel-cmd="deselect-all" title="Deselect All">
                <span class="material-symbols-outlined">deselect</span>
                <span class="toolbar-btn-label">None</span>
            </button>
            <button class="toolbar-btn" data-sel-cmd="reverse" title="Reverse Selection">
                <span class="material-symbols-outlined">swap_horiz</span>
                <span class="toolbar-btn-label">Reverse</span>
            </button>
            <div class="toolbar-divider"></div>
            <span class="sel-count" id="sel-count">0 selected</span>
            <div class="toolbar-divider"></div>
            <button class="toolbar-btn sel-done-btn" data-sel-cmd="done" title="Done (exit selection)">
                <span class="material-symbols-outlined">check_circle</span>
                <span class="toolbar-btn-label">Done</span>
            </button>
        `;
        document.body.appendChild(selToolbar);
        this.ui.selectionToolbar = selToolbar;
        
        // Mouse mode action toolbar (appears above selection toolbar)
        const mouseToolbar = document.createElement('div');
        mouseToolbar.className = 'toolbar selection-mouse-toolbar hidden';
        mouseToolbar.id = 'selection-mouse-toolbar';
        mouseToolbar.innerHTML = `
            <button class="toolbar-btn" data-sel-mouse="move" title="Move Selected">
                <span class="material-symbols-outlined">open_with</span>
                <span class="toolbar-btn-label">Move</span>
            </button>
            <button class="toolbar-btn" data-sel-mouse="duplicate" title="Duplicate Selected">
                <span class="material-symbols-outlined">content_copy</span>
                <span class="toolbar-btn-label">Duplicate</span>
            </button>
            <div class="toolbar-divider"></div>
            <button class="toolbar-btn" data-sel-mouse="rotate-left" title="Rotate Left 90°">
                <span class="material-symbols-outlined">rotate_left</span>
                <span class="toolbar-btn-label">Left 90°</span>
            </button>
            <button class="toolbar-btn" data-sel-mouse="rotate-right" title="Rotate Right 90°">
                <span class="material-symbols-outlined">rotate_right</span>
                <span class="toolbar-btn-label">Right 90°</span>
            </button>
            <button class="toolbar-btn" data-sel-mouse="rotate-180" title="Rotate 180°">
                <span class="material-symbols-outlined">sync</span>
                <span class="toolbar-btn-label">180°</span>
            </button>
        `;
        document.body.appendChild(mouseToolbar);
        this.ui.selectionMouseToolbar = mouseToolbar;
        
        this.attachSelectionToolbarListeners();
    }
    
    attachSelectionToolbarListeners() {
        // Mode buttons
        this.ui.selectionToolbar.querySelectorAll('[data-sel-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setSelectionMode(btn.dataset.selMode);
            });
        });
        
        // Action buttons (Select / Deselect)
        this.ui.selectionToolbar.querySelectorAll('[data-sel-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setSelectionAction(btn.dataset.selAction);
            });
        });
        
        // Command buttons (All, None, Reverse)
        this.ui.selectionToolbar.querySelectorAll('[data-sel-cmd]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleSelectionCommand(btn.dataset.selCmd);
            });
        });
        
        // Mouse mode action buttons
        this.ui.selectionMouseToolbar.querySelectorAll('[data-sel-mouse]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleSelectionMouseAction(btn.dataset.selMouse);
            });
        });
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
                <!-- Test Game Button -->
                <div class="config-section">
                    <button class="btn btn-primary" id="btn-test-game" style="width: 100%;">
                        <span class="material-symbols-outlined">play_arrow</span>
                        Test Game
                    </button>
                </div>
                
                <!-- Map Info -->
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
                
                <!-- Theme & Visuals -->
                <div class="config-section collapsible">
                    <div class="config-section-header">
                        <span class="config-section-title">Theme & Visuals</span>
                        <span class="material-symbols-outlined config-section-arrow">expand_more</span>
                    </div>
                    <div class="config-section-content">
                        <!-- Background -->
                    <div class="form-group">
                        <label class="form-label">Background</label>
                        <select class="form-select" id="config-background">
                            <option value="sky">Sky</option>
                            <option value="galaxy">Galaxy</option>
                                <option value="custom">Custom</option>
                        </select>
                    </div>
                    
                        <!-- Cloud Colors -->
                        <div class="form-group" style="margin-top: 12px;">
                            <label class="form-label">Cloud Colors</label>
                            <div style="display: flex; gap: 12px; margin-top: 8px;">
                                <div style="flex: 1;">
                                    <label style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px; display: block;">Sky</label>
                                    <div class="color-picker-option">
                                        <div class="color-preview" id="config-cloud-sky-preview" style="background: #ffffff"></div>
                                        <input type="text" class="form-input color-input" id="config-cloud-sky" value="#ffffff" style="font-size: 11px;">
                                    </div>
                                </div>
                                <div style="flex: 1;">
                                    <label style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px; display: block;">Galaxy</label>
                                    <div class="color-picker-option">
                                        <div class="color-preview" id="config-cloud-galaxy-preview" style="background: #9382a8"></div>
                                        <input type="text" class="form-input color-input" id="config-cloud-galaxy" value="#9382a8" style="font-size: 11px;">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Custom Background Options -->
                        <div id="custom-bg-options" class="hidden" style="margin-top: 12px; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                    <div class="form-group">
                                <label class="form-label">Upload Background</label>
                                <div class="custom-bg-upload" id="custom-bg-dropzone" style="border: 2px dashed var(--surface-light); border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; transition: all 0.2s;">
                                    <span class="material-symbols-outlined" style="font-size: 32px; color: var(--text-muted);">upload_file</span>
                                    <p style="margin: 8px 0 0; color: var(--text-muted); font-size: 12px;">Drop image, GIF, or video here<br>or click to browse</p>
                                    <input type="file" id="custom-bg-file" accept="image/*,video/*" style="display: none;">
                                </div>
                                <div id="custom-bg-preview" class="hidden" style="margin-top: 8px; position: relative;">
                                    <img id="custom-bg-preview-img" src="" style="width: 100%; border-radius: 6px; display: none;">
                                    <video id="custom-bg-preview-video" src="" style="width: 100%; border-radius: 6px; display: none;" muted loop></video>
                                    <button class="btn btn-icon btn-danger" id="custom-bg-remove" style="position: absolute; top: 4px; right: 4px; width: 24px; height: 24px;">
                                        <span class="material-symbols-outlined" style="font-size: 16px;">close</span>
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Video/GIF Options -->
                            <div id="custom-bg-video-options" class="hidden">
                                <div class="form-group">
                                    <label class="form-label">Play Mode</label>
                                    <select class="form-select" id="custom-bg-playmode">
                                        <option value="once">Play Once</option>
                                        <option value="loop" selected>Loop</option>
                                        <option value="bounce">Bounce</option>
                                    </select>
                                </div>
                                
                                <div id="custom-bg-loop-options" class="form-group">
                                    <label class="form-label">Loop Amount</label>
                                    <div style="display: flex; gap: 8px; align-items: center;">
                                        <select class="form-select" id="custom-bg-loop-type" style="flex: 1;">
                                            <option value="infinite" selected>Infinite</option>
                                            <option value="set">Set Number</option>
                                        </select>
                                        <input type="number" class="form-input" id="custom-bg-loop-count" min="1" value="1" style="width: 80px; display: none;">
                                    </div>
                                </div>
                                
                                <div id="custom-bg-end-options" class="form-group hidden">
                                    <label class="form-label">End Type</label>
                                    <select class="form-select" id="custom-bg-endtype">
                                        <option value="freeze" selected>Freeze at Last Frame</option>
                                        <option value="replace">Replace with Another Background</option>
                                    </select>
                                </div>
                                
                                <div id="custom-bg-end-upload" class="form-group hidden">
                                    <label class="form-label">End Background</label>
                                    <div class="custom-bg-upload" id="custom-bg-end-dropzone" style="border: 2px dashed var(--surface-light); border-radius: 8px; padding: 12px; text-align: center; cursor: pointer;">
                                        <span class="material-symbols-outlined" style="font-size: 24px; color: var(--text-muted);">upload_file</span>
                                        <p style="margin: 4px 0 0; color: var(--text-muted); font-size: 11px;">Upload end background</p>
                                        <input type="file" id="custom-bg-end-file" accept="image/*,video/*" style="display: none;">
                                    </div>
                                </div>
                                
                                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--surface-light);">
                                    <label class="form-label">Playback Options</label>
                                    <div class="form-group" style="display: flex; align-items: center; justify-content: space-between;">
                                        <div>
                                            <span style="font-size: 13px;">Same Across Screens</span>
                                            <p style="margin: 2px 0 0; font-size: 10px; color: var(--text-muted);">All players see same frame</p>
                                        </div>
                                        <label class="toggle">
                                            <input type="checkbox" id="custom-bg-sync">
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </div>
                                    <div class="form-group" style="display: flex; align-items: center; justify-content: space-between;">
                                        <div>
                                            <span style="font-size: 13px;">Reverse</span>
                                            <p style="margin: 2px 0 0; font-size: 10px; color: var(--text-muted);">Play backwards</p>
                                        </div>
                                        <label class="toggle">
                                            <input type="checkbox" id="custom-bg-reverse">
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Default Colors -->
                        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--surface-light);">
                            <label class="form-label" style="font-weight: 600; margin-bottom: 12px;">Default Colors</label>
                            <div class="form-group">
                                <label class="form-label">Block Color</label>
                        <div class="color-picker-option">
                            <div class="color-preview" id="config-block-color-preview" style="background: #787878"></div>
                            <input type="text" class="form-input color-input" id="config-block-color" value="#787878">
                        </div>
                    </div>
                    <div class="form-group">
                                <label class="form-label">Spike Color</label>
                        <div class="color-picker-option">
                            <div class="color-preview" id="config-spike-color-preview" style="background: #c45a3f"></div>
                            <input type="text" class="form-input color-input" id="config-spike-color" value="#c45a3f">
                        </div>
                    </div>
                    <div class="form-group">
                                <label class="form-label">Text Color</label>
                        <div class="color-picker-option">
                            <div class="color-preview" id="config-text-color-preview" style="background: #000000"></div>
                            <input type="text" class="form-input color-input" id="config-text-color" value="#000000">
                        </div>
                    </div>
                </div>
                
                        <!-- Checkpoint Colors -->
                        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--surface-light);">
                            <label class="form-label" style="font-weight: 600; margin-bottom: 12px;">Checkpoint Colors</label>
                    <div class="form-group">
                                <label class="form-label">Default</label>
                                <div class="color-picker-option">
                                    <div class="color-preview" id="config-checkpoint-default-preview" style="background: #808080"></div>
                                    <input type="text" class="form-input color-input" id="config-checkpoint-default" value="#808080">
                                </div>
                                <small style="color: #888; font-size: 11px;">Untouched checkpoints</small>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Active</label>
                                <div class="color-picker-option">
                                    <div class="color-preview" id="config-checkpoint-active-preview" style="background: #4CAF50"></div>
                                    <input type="text" class="form-input color-input" id="config-checkpoint-active" value="#4CAF50">
                                </div>
                                <small style="color: #888; font-size: 11px;">Current/latest checkpoint</small>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Already Checked</label>
                                <div class="color-picker-option">
                                    <div class="color-preview" id="config-checkpoint-touched-preview" style="background: #2196F3"></div>
                                    <input type="text" class="form-input color-input" id="config-checkpoint-touched" value="#2196F3">
                                </div>
                                <small style="color: #888; font-size: 11px;">Previously touched checkpoints</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Music -->
                <div class="config-section collapsible">
                    <div class="config-section-header">
                        <span class="config-section-title">Music</span>
                        <span class="material-symbols-outlined config-section-arrow">expand_more</span>
                    </div>
                    <div class="config-section-content">
                        <div class="form-group">
                            <label class="form-label">Background Music</label>
                            <select class="form-select" id="config-music">
                                <option value="none">None</option>
                                <option value="maccary-bay">Maccary Bay</option>
                                <option value="reggae-party">Reggae Party</option>
                                <option value="custom">Custom (Upload)</option>
                            </select>
                        </div>
                        
                        <div id="custom-music-options" class="hidden" style="margin-top: 12px;">
                            <div class="form-group">
                                <label class="form-label">Upload Music</label>
                                <div class="custom-music-upload" id="custom-music-dropzone" style="border: 2px dashed var(--surface-light); border-radius: 8px; padding: 16px; text-align: center; cursor: pointer; transition: all 0.2s;">
                                    <span class="material-symbols-outlined" style="font-size: 28px; color: var(--text-muted);">music_note</span>
                                    <p style="margin: 6px 0 0; color: var(--text-muted); font-size: 11px;">Drop audio file here or click to browse<br>(MP3, WAV, OGG)</p>
                                    <input type="file" id="custom-music-file" accept="audio/*" style="display: none;">
                                </div>
                                <div id="custom-music-preview" class="hidden" style="margin-top: 8px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px;">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <button class="btn btn-icon btn-sm" id="custom-music-play" title="Play/Pause">
                                            <span class="material-symbols-outlined">play_arrow</span>
                                        </button>
                                        <span id="custom-music-name" style="flex: 1; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">No file selected</span>
                                        <button class="btn btn-icon btn-sm btn-danger" id="custom-music-remove" title="Remove">
                                            <span class="material-symbols-outlined">close</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-group" id="music-volume-group">
                            <label class="form-label">Volume</label>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <input type="range" class="form-range" id="config-music-volume" min="0" max="100" value="50" style="flex: 1;">
                                <span id="config-music-volume-label" style="font-size: 12px; color: var(--text-muted); min-width: 35px;">50%</span>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Loop</label>
                            <label class="toggle">
                                <input type="checkbox" id="config-music-loop" checked>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <!-- Player -->
                <div class="config-section collapsible">
                    <div class="config-section-header">
                        <span class="config-section-title">Player</span>
                        <span class="material-symbols-outlined config-section-arrow">expand_more</span>
                    </div>
                    <div class="config-section-content">
                        <div class="form-group">
                            <label class="form-label">Movement Speed</label>
                            <input type="number" class="form-input" id="config-player-speed" min="0.1" step="0.5" value="5">
                            <small style="color: #888; font-size: 11px;">Default: 5 - Higher = faster</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Jump Height</label>
                            <input type="number" class="form-input" id="config-jump-force" min="-50" max="-1" step="0.5" value="-14">
                            <small style="color: #888; font-size: 11px;">Default: -14 - Lower = higher jump</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Jump Count</label>
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
                            <small style="color: #888; font-size: 11px;">When enabled, all jumps available in air</small>
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
                
                <!-- Keyboard -->
                <div class="config-section collapsible">
                    <div class="config-section-header">
                        <span class="config-section-title">Keyboard</span>
                        <span class="material-symbols-outlined config-section-arrow">expand_more</span>
                    </div>
                    <div class="config-section-content">
                    <div class="form-group">
                            <label class="form-label">Layout</label>
                            <select class="form-select" id="config-keyboard-layout">
                                <option value="jimmyqrg">JimmyQrg (Default)</option>
                                <option value="default">Parkoreen</option>
                                <option value="hk">Hollow Knight Original</option>
                            </select>
                            <small style="color: #888; font-size: 11px;">Applies in test mode & room play only</small>
                        </div>
                        <div id="keyboard-layout-info" style="margin-top: 12px; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px; font-size: 12px; color: #aaa; line-height: 1.6;">
                            <div id="keyboard-info-jimmyqrg">
                                <strong style="color: #fff;">JimmyQrg (Default):</strong><br>
                                Move: A/D<br>
                                Jump: W<br>
                                Attack: N<br>
                                Heal: LeftShift<br>
                                Dash: , (comma)<br>
                                Super Dash: F<br>
                                Up/Down: ↑/↓
                            </div>
                            <div id="keyboard-info-default" style="display: none;">
                                <strong style="color: #fff;">Parkoreen:</strong><br>
                                Move: A/D or ←/→<br>
                                Jump: Space or W or ↑<br>
                                Up/Down: W/S or ↑/↓<br>
                                <span style="color: #667eea;">Plugin:</span> Attack: X, Heal: F, Dash: , (comma), Super Dash: . (period)
                            </div>
                            <div id="keyboard-info-hk" style="display: none;">
                                <strong style="color: #fff;">Hollow Knight Original:</strong><br>
                                Move: ←/→<br>
                                Jump: Z<br>
                                Attack: X<br>
                                Heal: A<br>
                                Dash: C<br>
                                Super Dash: S<br>
                                Up/Down: ↑/↓
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- World -->
                <div class="config-section collapsible">
                    <div class="config-section-header">
                        <span class="config-section-title">World</span>
                        <span class="material-symbols-outlined config-section-arrow">expand_more</span>
                    </div>
                    <div class="config-section-content">
                    <div class="form-group">
                            <label class="form-label">Gravity</label>
                            <input type="number" class="form-input" id="config-gravity" min="0.1" step="0.1" value="0.8">
                            <small style="color: #888; font-size: 11px;">Default: 0.8 - Higher = faster fall</small>
                    </div>
                        <div class="form-group">
                            <label class="form-label">Camera Horizontal Smoothness</label>
                            <input type="range" class="form-range" id="config-camera-lerp-x" min="0.02" max="1" step="0.01" value="0.12" style="width: 100%;">
                            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #666;">
                                <span>Smooth</span>
                                <span id="config-camera-lerp-x-value">0.12</span>
                                <span>Snappy</span>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Camera Vertical Smoothness</label>
                            <input type="range" class="form-range" id="config-camera-lerp-y" min="0.02" max="1" step="0.01" value="0.12" style="width: 100%;">
                            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #666;">
                                <span>Smooth</span>
                                <span id="config-camera-lerp-y-value">0.12</span>
                                <span>Snappy</span>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Death Line Y</label>
                            <input type="number" class="form-input" id="config-die-line-y" value="2000">
                            <small style="color: #888; font-size: 11px;">Players die below this Y position</small>
                </div>
                
                        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--surface-light);">
                            <label class="form-label" style="font-weight: 600; margin-bottom: 12px;">Spike Behavior</label>
                            <div class="form-group">
                                <label class="form-label">Touchbox Mode</label>
                                <select class="form-select" id="config-spike-touchbox">
                                    <option value="full">Full Spike</option>
                                    <option value="normal" selected>Normal Spike</option>
                                    <option value="tip">Tip Spike</option>
                                    <option value="ground">Ground</option>
                                    <option value="flag">Flag</option>
                                    <option value="air">Air</option>
                                </select>
                                <div id="spike-touchbox-description" style="margin-top: 8px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px; font-size: 12px; color: #aaa; line-height: 1.5;">
                                    <strong style="color: #fff;">Normal Spike:</strong> The flat base acts as ground. Other parts damage the player.
                                </div>
                            </div>
                            
                            <div class="form-group" style="margin-top: 12px;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                    <label class="toggle">
                                        <input type="checkbox" id="config-drop-hurt-only">
                                        <span class="toggle-slider"></span>
                                    </label>
                                    <label class="form-label" for="config-drop-hurt-only" style="margin: 0; cursor: pointer;">Drop Hurt Only</label>
                                </div>
                                <div id="drop-hurt-only-description" style="padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px; font-size: 12px; color: #aaa; line-height: 1.5;">
                                    <strong style="color: #fff;">Drop Hurt Only:</strong> Spikes only damage the player when they are moving <em>toward</em> the spike's tip direction. For example, a spike pointing up will only hurt a player who is falling down (or moving down-left/down-right). If the player jumps up through the spike, they won't be hurt.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Export & Import -->
                <div class="config-section collapsible">
                    <div class="config-section-header">
                        <span class="config-section-title">Export & Import</span>
                        <span class="material-symbols-outlined config-section-arrow">expand_more</span>
                    </div>
                    <div class="config-section-content">
                        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
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
                        
                        <div class="form-group">
                            <label class="form-label">Data Format <span style="color: #888; font-size: 11px;">(Advanced)</span></label>
                            <select class="form-select" id="config-stored-data-type">
                                <option value="json" selected>.json</option>
                                <option value="dat">.dat</option>
                            </select>
                            <div id="stored-data-type-description" style="margin-top: 8px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px; font-size: 12px; color: #aaa; line-height: 1.5;">
                                <strong style="color: #fff;">.json:</strong> Human-readable. Recommended for smaller maps.
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Host Game -->
                <div class="config-section collapsible">
                    <div class="config-section-header">
                        <span class="config-section-title">Host Game</span>
                        <span class="material-symbols-outlined config-section-arrow">expand_more</span>
                    </div>
                    <div class="config-section-content">
                    <div class="form-group">
                            <label class="form-label">Max Players</label>
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
                            <label class="form-label">Password</label>
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
                
                <!-- Plugins -->
                <div class="config-section" style="margin-top: 16px; padding-top: 16px; border-top: 2px solid var(--surface-light);">
                    <button class="btn btn-secondary" id="btn-plugins" style="width: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; color: white;">
                        <span class="material-symbols-outlined">extension</span>
                        Plugins
                    </button>
                </div>
                
                <!-- Mechanics (always visible) -->
                <div class="config-section" style="margin-top: 12px;">
                    <button class="btn btn-secondary" id="btn-edit-mechanics" style="width: 100%; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border: none; color: white;">
                        <span class="material-symbols-outlined">code</span>
                        Edit Mechanics
                    </button>
                </div>
                
                <!-- HP Section (hidden by default, shown when HP plugin enabled) -->
                <div class="config-section collapsible hidden" id="config-section-hp">
                    <div class="config-section-header">
                        <span class="config-section-title">❤️ HP Settings</span>
                        <span class="material-symbols-outlined config-section-arrow">expand_more</span>
                    </div>
                    <div class="config-section-content">
                        <div class="form-group">
                            <label class="form-label">Default HP</label>
                            <input type="number" class="form-input" id="config-hp-default" min="1" max="99" value="3">
                            <small style="color: #888; font-size: 11px;">Starting health points for players</small>
                        </div>
                    </div>
                </div>
                
                <!-- Hollow Knight Section (hidden by default, shown when HK plugin enabled) -->
                <div class="config-section collapsible hidden" id="config-section-hk">
                    <div class="config-section-header">
                        <span class="config-section-title">Hollow Knight</span>
                        <span class="material-symbols-outlined config-section-arrow">expand_more</span>
                    </div>
                    <div class="config-section-content">
                        <div class="form-group">
                            <label class="form-label">HK Gravity</label>
                            <input type="number" class="form-input" id="config-hk-gravity" min="0.1" max="3" step="0.01" value="1.14">
                            <small style="color: #888; font-size: 11px;">1.14 = 70% jump height (HK-style)</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">HK Camera Horizontal</label>
                            <input type="range" class="form-range" id="config-hk-camera-x" min="0.02" max="0.5" step="0.01" value="0.04" style="width: 100%;">
                            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #666;">
                                <span>Smooth</span>
                                <span id="config-hk-camera-x-value">0.04</span>
                                <span>Snappy</span>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">HK Camera Vertical</label>
                            <input type="range" class="form-range" id="config-hk-camera-y" min="0.02" max="0.5" step="0.01" value="0.15" style="width: 100%;">
                            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #666;">
                                <span>Smooth</span>
                                <span id="config-hk-camera-y-value">0.15</span>
                                <span>Snappy</span>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Max Soul</label>
                            <input type="number" class="form-input" id="config-hk-maxsoul" min="33" max="198" value="99">
                            <small style="color: #888; font-size: 11px;">33 = one heal, 99 = three heals</small>
                        </div>
                        <div class="form-group" style="display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <span style="font-size: 13px;">Monarch Wings</span>
                                <p style="margin: 2px 0 0; font-size: 10px; color: var(--text-muted);">Double jump ability</p>
                            </div>
                            <label class="toggle">
                                <input type="checkbox" id="config-hk-monarchwing">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="form-group" id="config-hk-monarchwing-amount-group">
                            <label class="form-label">Monarch Wing Amount</label>
                            <input type="number" class="form-input" id="config-hk-monarchwing-amount" min="1" max="99" value="1">
                        </div>
                        <div class="form-group" style="display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <span style="font-size: 13px;">Mothwing Cloak (Dash)</span>
                                <p style="margin: 2px 0 0; font-size: 10px; color: var(--text-muted);">Press comma (,) to dash</p>
                            </div>
                            <label class="toggle">
                                <input type="checkbox" id="config-hk-dash">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="form-group" style="display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <span style="font-size: 13px;">Crystal Heart (Super Dash)</span>
                                <p style="margin: 2px 0 0; font-size: 10px; color: var(--text-muted);">Hold period (.) to charge</p>
                            </div>
                            <label class="toggle">
                                <input type="checkbox" id="config-hk-superdash">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="form-group" style="display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <span style="font-size: 13px;">Mantis Claw (Wall Jump)</span>
                                <p style="margin: 2px 0 0; font-size: 10px; color: var(--text-muted);">Cling to walls and wall jump</p>
                            </div>
                            <label class="toggle">
                                <input type="checkbox" id="config-hk-mantisclaw">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <!-- Code Section is now hidden (mechanics are built-in) -->
            </div>
        `;
        document.body.appendChild(configPanel);
        this.ui.configPanel = configPanel;
        
        // Plugins Library Popup
        const pluginsPopup = document.createElement('div');
        pluginsPopup.className = 'modal-overlay';
        pluginsPopup.id = 'plugins-popup';
        pluginsPopup.innerHTML = `
            <div class="modal" style="max-width: 700px; width: 95%; max-height: 85vh; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid var(--surface-light);">
                    <h2 class="modal-title" style="margin: 0;">🧩 Plugins Library</h2>
                    <button class="btn btn-icon btn-ghost" id="close-plugins-popup">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div style="overflow-y: auto; padding: 16px 0; flex: 1;">
                    <!-- HP Plugin -->
                    <div class="plugin-card" data-plugin="hp" style="background: var(--bg-light); border-radius: 12px; overflow: hidden; margin-bottom: 16px;">
                        <img src="assets/plugins/hp/cover.png" alt="HP Plugin" style="width: 100%; height: auto; display: block;">
                        <div style="padding: 16px 20px 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div style="flex: 1;">
                                    <h3 style="margin: 0 0 8px 0; color: #FF6B6B;">
                                        HP (Health Points)
                                    </h3>
                                    <p style="margin: 0 0 12px 0; color: var(--text-muted); font-size: 13px; line-height: 1.5;">
                                        Adds a health system to the game. Players start with configurable HP. 
                                        Touching spikes removes 1 HP and teleports player to the last safe ground they stood on.
                                    </p>
                                </div>
                                <button class="btn plugin-toggle-btn" data-plugin="hp" style="min-width: 80px; margin-left: 16px;">
                                    Add
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Hollow Knight Plugin -->
                    <div class="plugin-card" data-plugin="hk" style="background: var(--bg-light); border-radius: 12px; overflow: hidden; margin-bottom: 16px;">
                        <img src="assets/plugins/hk/cover.png" alt="Hollow Knight Plugin" style="width: 100%; height: auto; display: block;">
                        <div style="padding: 16px 20px 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div style="flex: 1;">
                                    <h3 style="margin: 0 0 8px 0; color: #667eea; display: flex; align-items: center; gap: 8px;">
                                        Hollow Knight
                                        <span style="font-size: 11px; background: rgba(255,107,107,0.2); color: #FF6B6B; padding: 2px 8px; border-radius: 4px;">Requires HP</span>
                                    </h3>
                                    <p style="margin: 0 0 12px 0; color: var(--text-muted); font-size: 13px; line-height: 1.5;">
                                        Adds Hollow Knight-style mechanics: Soul system, nail attacks, 
                                        Monarch Wings (double jump), Mothwing Cloak (dash), Crystal Heart (super dash), 
                                        and Focus healing.
                                    </p>
                                    <div style="font-size: 11px; color: var(--text-muted); display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                                        <span>X - Attack (+ ↑/↓ for direction)</span>
                                        <span>, (comma) - Dash</span>
                                        <span>. (period) - Super Dash (hold)</span>
                                        <span>F - Focus/Heal (hold)</span>
                                    </div>
                                </div>
                                <button class="btn plugin-toggle-btn" data-plugin="hk" style="min-width: 80px; margin-left: 16px;">
                                    Add
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Code Plugin is hidden (mechanics are built into the game) -->
                </div>
            </div>
        `;
        document.body.appendChild(pluginsPopup);
        this.ui.pluginsPopup = pluginsPopup;
        
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
            <button class="add-menu-btn" data-add="obstacle">
                <span class="material-symbols-outlined">warning</span>
                Obstacle
            </button>
            <button class="add-menu-btn" data-add="koreen">
                <span class="material-symbols-outlined">device_hub</span>
                Koreen
            </button>
            <button class="add-menu-btn" data-add="text">
                <span class="material-symbols-outlined">text_fields</span>
                Text Box
            </button>
            <button class="add-menu-btn" data-add="button">
                <span class="material-symbols-outlined">smart_button</span>
                Button
            </button>
            <button class="add-menu-btn" data-add="teleportal">
                <span class="material-symbols-outlined">move</span>
                Teleportal
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
            <!-- Block Texture Option -->
            <div class="placement-option" id="placement-texture">
                <span class="placement-option-label">Texture</span>
                <div class="texture-dropdown" id="texture-dropdown">
                    <button class="texture-dropdown-trigger" id="texture-dropdown-trigger">
                        <div class="texture-preview" id="texture-preview-solid" style="width: 24px; height: 24px; background: #787878; border-radius: 4px;"></div>
                        <span id="texture-dropdown-value">Solid</span>
                        <span class="material-symbols-outlined">expand_more</span>
                    </button>
                    <div class="texture-dropdown-menu" id="texture-dropdown-menu">
                        <!-- Will be populated dynamically -->
                    </div>
                </div>
            </div>
            
            <!-- Hidden appearance for backwards compatibility -->
            <div class="placement-option hidden" id="placement-appearance">
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
                    <button class="placement-opt-btn" data-fill="overlap">Overlap</button>
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
                <textarea class="form-input form-input-sm" id="placement-content-input" rows="3" style="width: 180px; resize: vertical; font-family: 'Parkoreen Game';">Text</textarea>
            </div>
            
            <div class="placement-option hidden" id="placement-font">
                <span class="placement-option-label">Font</span>
                <div class="font-dropdown" id="font-dropdown">
                    <button class="font-dropdown-trigger" id="font-dropdown-trigger">
                        <span id="font-dropdown-value" style="font-family: 'Parkoreen Game';">Parkoreen Game</span>
                        <span class="material-symbols-outlined">expand_more</span>
                    </button>
                    <div class="font-dropdown-menu" id="font-dropdown-menu">
                        <!-- Will be populated dynamically -->
                    </div>
                </div>
            </div>
            
            <div class="placement-option hidden" id="placement-fontsize">
                <span class="placement-option-label">Font Size</span>
                <input type="number" class="form-input form-input-sm" id="placement-fontsize-input" min="8" max="200" value="24" style="width: 70px;">
                <span style="font-size: 12px; color: var(--text-muted);">px</span>
            </div>
            
            <div class="placement-option hidden" id="placement-font-preview" style="flex-direction: column; align-items: flex-start; width: 100%;">
                <span class="placement-option-label">Preview</span>
                <div id="font-preview-box" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px; min-height: 36px; display: flex; align-items: center; justify-content: center;">
                    <span id="font-preview-text" style="font-family: 'Parkoreen Game'; font-size: 16px; color: #fff;">Text</span>
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
        
        // Erase Toolbar
        this.createEraseToolbar();
    }
    
    createEraseToolbar() {
        // Erase options are now part of the placement toolbar
        // This creates a container that will be shown inside placement toolbar when erasing
        const eraseOptions = document.createElement('div');
        eraseOptions.id = 'erase-options';
        eraseOptions.className = 'erase-options';
        eraseOptions.style.display = 'none';
        eraseOptions.innerHTML = `
            <div class="placement-option">
                <span class="placement-option-label">Erase Type</span>
                <div class="placement-option-btns">
                    <button class="placement-opt-btn active" data-erase-type="all">All</button>
                    <button class="placement-opt-btn" data-erase-type="top">Top Layer</button>
                    <button class="placement-opt-btn" data-erase-type="bottom">Bottom Layer</button>
                </div>
            </div>
            <div class="placement-option">
                <span class="placement-option-label">Eraser Size</span>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <label style="font-size: 12px; color: var(--text-muted);">W:</label>
                    <input type="number" id="erase-width" class="form-input" style="width: 60px;" value="1" min="1" max="20">
                    <label style="font-size: 12px; color: var(--text-muted);">H:</label>
                    <input type="number" id="erase-height" class="form-input" style="width: 60px;" value="1" min="1" max="20">
                </div>
            </div>
        `;
        // Append to placement toolbar instead of body
        this.ui.placementToolbar.appendChild(eraseOptions);
        this.ui.eraseOptions = eraseOptions;
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
                    <label class="form-label">Font Size</label>
                    <div class="settings-volume">
                        <input type="range" class="form-range" id="settings-fontsize-range" min="50" max="150" value="100">
                        <input type="number" class="form-input form-input-sm" id="settings-fontsize-number" min="50" max="150" value="100" style="width: 60px;">
                        <span style="font-size: 12px; color: var(--text-muted);">%</span>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Touchscreen Mode</label>
                    <label class="toggle">
                        <input type="checkbox" id="settings-touchscreen">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--surface-light);">
                    <button class="btn btn-secondary" id="settings-how-to-play" style="width: 100%; margin-bottom: 8px;">
                        <span class="material-symbols-outlined">help</span>
                        How To Play
                    </button>
                    <button class="btn btn-primary" id="settings-back-to-dashboard" style="width: 100%;">
                        <span class="material-symbols-outlined">home</span>
                        Back to Dashboard
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(settingsPanel);
        this.ui.settingsPanel = settingsPanel;
        
        // Object Edit Popup
        this.createObjectEditPopup();
    }
    
    createObjectEditPopup() {
        const popup = document.createElement('div');
        popup.className = 'object-edit-popup modal-overlay';
        popup.id = 'object-edit-popup';
        popup.innerHTML = `
            <div class="object-edit-panel">
                <div class="panel-header">
                    <span class="panel-title" id="object-edit-title">Edit Object</span>
                    <button class="btn btn-icon btn-ghost" id="close-object-edit">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="panel-body">
                    <div class="form-group">
                        <label class="form-label">Name</label>
                        <input type="text" class="form-input" id="object-edit-name" placeholder="Object Name">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Color</label>
                        <div class="color-picker-option">
                            <div class="color-preview" id="object-edit-color-preview" style="background: #787878"></div>
                            <input type="text" class="form-input form-input-sm color-input" id="object-edit-color" value="#787878">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Opacity</label>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="range" class="form-range" id="object-edit-opacity-range" min="0" max="100" value="100" style="flex: 1;">
                            <span id="object-edit-opacity-label" style="font-size: 12px; min-width: 35px;">100%</span>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Rotation</label>
                        <div class="placement-option-btns" style="justify-content: flex-start;">
                            <button class="placement-opt-btn" id="object-edit-rotate-left" title="Rotate Left">
                                <span class="material-symbols-outlined" style="font-size: 16px;">rotate_left</span>
                            </button>
                            <button class="placement-opt-btn" id="object-edit-rotate-right" title="Rotate Right">
                                <span class="material-symbols-outlined" style="font-size: 16px;">rotate_right</span>
                            </button>
                            <span id="object-edit-rotation-label" style="font-size: 12px; margin-left: 8px;">0°</span>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Collision</label>
                        <label class="toggle">
                            <input type="checkbox" id="object-edit-collision" checked>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="form-group" id="object-edit-flip-group">
                        <label class="form-label">Flip Horizontal</label>
                        <label class="toggle">
                            <input type="checkbox" id="object-edit-flip-horizontal">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="form-group" id="object-edit-spinner-group" style="display: none;">
                        <label class="form-label">Size (px)</label>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <label style="font-size: 12px; color: #aaa;">W</label>
                            <input type="number" class="form-input form-input-sm" id="object-edit-spinner-width" min="16" step="16" style="width: 72px;">
                            <label style="font-size: 12px; color: #aaa;">H</label>
                            <input type="number" class="form-input form-input-sm" id="object-edit-spinner-height" min="16" step="16" style="width: 72px;">
                        </div>
                        <div style="margin-top: 8px;">
                            <label class="form-label">Spin Speed</label>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <input type="range" class="form-range" id="object-edit-spin-speed-range" min="0" max="50" step="1" value="10" style="flex: 1;">
                                <span id="object-edit-spin-speed-label" style="font-size: 12px; min-width: 40px;">1.0/s</span>
                            </div>
                        </div>
                        <div style="margin-top: 8px;">
                            <label class="form-label">Spin Direction</label>
                            <div style="display: flex; gap: 6px;">
                                <button class="placement-opt-btn active" id="object-edit-spin-dir-cw" data-spin-dir="1">Clockwise</button>
                                <button class="placement-opt-btn" id="object-edit-spin-dir-ccw" data-spin-dir="-1">Counter-CW</button>
                            </div>
                        </div>
                        <div style="margin-top: 8px;">
                            <label class="form-label">Damage Amount</label>
                            <input type="number" class="form-input form-input-sm" id="object-edit-spinner-damage" min="0" step="1" value="1" style="width: 72px;">
                        </div>
                    </div>

                    <div class="form-group" id="object-edit-spike-group" style="display: none;">
                        <label class="form-label">Spike Touchbox</label>
                        <select class="form-select" id="object-edit-spike-touchbox">
                            <option value="">Use World Default</option>
                            <option value="full">Full Spike</option>
                            <option value="normal">Normal Spike</option>
                            <option value="tip">Tip Spike</option>
                            <option value="ground">Ground</option>
                            <option value="flag">Flag</option>
                            <option value="air">Air</option>
                        </select>
                        <div id="object-edit-spike-desc" style="margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 6px; font-size: 11px; color: #aaa; line-height: 1.4;"></div>
                        
                        <div style="margin-top: 12px;">
                            <label class="form-label" style="display: flex; align-items: center; gap: 8px;">
                                <select class="form-select" id="object-edit-drop-hurt-only" style="width: auto;">
                                    <option value="">Use World Default</option>
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                                Drop Hurt Only
                            </label>
                            <div style="margin-top: 6px; padding: 6px 8px; background: rgba(0,0,0,0.2); border-radius: 6px; font-size: 11px; color: #aaa; line-height: 1.4;">
                                When enabled, this spike only hurts the player when they move toward the spike's tip.
                            </div>
                        </div>
                        
                        <div id="object-edit-spike-attached" style="margin-top: 8px; padding: 8px; background: rgba(255,193,7,0.15); border-radius: 6px; font-size: 11px; color: #ffc107; line-height: 1.4; display: none;">
                            <span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle;">info</span>
                            This spike is attached to ground - its flat side will act as ground regardless of the touchbox setting.
                        </div>
                        <div style="margin-top: 12px;">
                            <label class="form-label">Damage Amount</label>
                            <input type="number" class="form-input form-input-sm" id="object-edit-spike-damage" min="0" step="1" value="1" style="width: 72px;">
                        </div>
                    </div>
                    
                    <div class="form-group" id="object-edit-text-group" style="display: none;">
                        <label class="form-label">Font</label>
                        <div class="font-dropdown" id="object-edit-font-dropdown" style="margin-bottom: 12px;">
                            <button type="button" class="font-dropdown-trigger" id="object-edit-font-trigger">
                                <span id="object-edit-font-value">Parkoreen Game</span>
                                <span class="material-symbols-outlined">expand_more</span>
                            </button>
                            <div class="font-dropdown-menu" id="object-edit-font-menu">
                                <!-- Will be populated dynamically -->
                            </div>
                        </div>
                        
                        <label class="form-label">Text Content</label>
                        <textarea class="form-input" id="object-edit-content" rows="3" style="resize: vertical;"></textarea>
                        
                        <div id="object-edit-font-preview" style="margin-top: 8px; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 6px; min-height: 40px; display: flex; align-items: center; justify-content: center;">
                            <span id="object-edit-font-preview-text" style="font-size: 18px;">Preview Text</span>
                        </div>
                    </div>
                    
                    <div class="form-group" id="object-edit-teleportal-group" style="display: none;">
                        <div class="teleportal-section">
                            <label class="form-label">
                                <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle;">output</span>
                                Send To
                            </label>
                            <div id="teleportal-send-list" class="teleportal-connection-list"></div>
                            <button class="btn btn-sm btn-secondary" id="teleportal-add-send" style="margin-top: 8px;">
                                <span class="material-symbols-outlined" style="font-size: 16px;">add</span>
                                Add
                            </button>
                        </div>
                        
                        <div class="teleportal-section" style="margin-top: 16px;">
                            <label class="form-label">
                                <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle;">input</span>
                                Receive From
                            </label>
                            <div id="teleportal-receive-list" class="teleportal-connection-list"></div>
                            <button class="btn btn-sm btn-secondary" id="teleportal-add-receive" style="margin-top: 8px;">
                                <span class="material-symbols-outlined" style="font-size: 16px;">add</span>
                                Add
                            </button>
                        </div>
                        
                        <div id="teleportal-connection-info" style="margin-top: 12px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 6px; font-size: 11px; color: #aaa; line-height: 1.4;">
                            <strong>Connection Guide:</strong><br>
                            • <span style="color: #4ade80;">Green</span> = Valid two-way connection (player will teleport)<br>
                            • <span style="color: #f87171;">Red</span> = One-way only (no teleport)
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--surface-light);">
                        <button class="btn btn-danger" id="object-edit-delete" style="width: 100%;">
                            <span class="material-symbols-outlined">delete</span>
                            Delete Object
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(popup);
        this.ui.objectEditPopup = popup;
        
        // Track the currently editing object
        this.editingObject = null;
        
        // Setup event listeners for object edit popup
        this.setupObjectEditListeners();
    }
    
    setupObjectEditListeners() {
        const popup = this.ui.objectEditPopup;
        
        // Close button
        document.getElementById('close-object-edit').addEventListener('click', () => {
            this.closeObjectEditPopup();
        });
        
        // Click outside to close
        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                this.closeObjectEditPopup();
            }
        });
        
        // Name change
        document.getElementById('object-edit-name').addEventListener('change', (e) => {
            if (this.editingObject) {
                this.editingObject.name = e.target.value || this.editingObject.getDefaultName();
                this.updateLayersList();
                this.triggerMapChange();
            }
        });
        
        // Color preview click
        document.getElementById('object-edit-color-preview').addEventListener('click', () => {
            this.showColorPicker('object-edit');
        });
        
        // Color input change
        document.getElementById('object-edit-color').addEventListener('change', (e) => {
            if (this.editingObject) {
                let color = this.autoCorrectHex(e.target.value);
                const fullColor = '#' + color;
                e.target.value = fullColor;
                this.editingObject.color = fullColor;
                document.getElementById('object-edit-color-preview').style.background = fullColor;
                this.triggerMapChange();
            }
        });
        
        // Opacity range
        document.getElementById('object-edit-opacity-range').addEventListener('input', (e) => {
            if (this.editingObject) {
                const value = parseInt(e.target.value);
                this.editingObject.opacity = value / 100;
                document.getElementById('object-edit-opacity-label').textContent = value + '%';
                this.updateLayersList();
                this.triggerMapChange();
            }
        });
        
        // Rotation buttons
        document.getElementById('object-edit-rotate-left').addEventListener('click', () => {
            if (this.editingObject) {
                this.editingObject.rotation = (this.editingObject.rotation - 90 + 360) % 360;
                document.getElementById('object-edit-rotation-label').textContent = this.editingObject.rotation + '°';
                this.updateSpikeAttachedWarning();
                this.triggerMapChange();
            }
        });
        
        document.getElementById('object-edit-rotate-right').addEventListener('click', () => {
            if (this.editingObject) {
                this.editingObject.rotation = (this.editingObject.rotation + 90) % 360;
                document.getElementById('object-edit-rotation-label').textContent = this.editingObject.rotation + '°';
                this.updateSpikeAttachedWarning();
                this.triggerMapChange();
            }
        });
        
        // Collision toggle
        document.getElementById('object-edit-collision').addEventListener('change', (e) => {
            if (this.editingObject) {
                this.editingObject.collision = e.target.checked;
                this.triggerMapChange();
            }
        });
        
        // Flip horizontal toggle
        document.getElementById('object-edit-flip-horizontal').addEventListener('change', (e) => {
            if (this.editingObject) {
                this.editingObject.flipHorizontal = e.target.checked;
                this.triggerMapChange();
            }
        });
        
        // Spinner width
        document.getElementById('object-edit-spinner-width').addEventListener('change', (e) => {
            if (this.editingObject && (this.editingObject.type === 'spinner' || this.editingObject.appearanceType === 'spinner')) {
                const val = Math.max(16, parseInt(e.target.value) || 32);
                this.editingObject.width = val;
                e.target.value = val;
                this.triggerMapChange();
            }
        });
        
        // Spinner height
        document.getElementById('object-edit-spinner-height').addEventListener('change', (e) => {
            if (this.editingObject && (this.editingObject.type === 'spinner' || this.editingObject.appearanceType === 'spinner')) {
                const val = Math.max(16, parseInt(e.target.value) || 32);
                this.editingObject.height = val;
                e.target.value = val;
                this.triggerMapChange();
            }
        });
        
        // Spinner spin speed
        document.getElementById('object-edit-spin-speed-range').addEventListener('input', (e) => {
            if (this.editingObject && (this.editingObject.type === 'spinner' || this.editingObject.appearanceType === 'spinner')) {
                const speed = parseInt(e.target.value) / 10;
                this.editingObject.spinSpeed = speed;
                document.getElementById('object-edit-spin-speed-label').textContent = speed.toFixed(1) + '/s';
                this.triggerMapChange();
            }
        });
        
        // Spinner spin direction
        document.querySelectorAll('[data-spin-dir]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.editingObject && (this.editingObject.type === 'spinner' || this.editingObject.appearanceType === 'spinner')) {
                    document.querySelectorAll('[data-spin-dir]').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.editingObject.spinDirection = parseInt(btn.dataset.spinDir);
                    this.triggerMapChange();
                }
            });
        });

        // Spinner damage amount
        document.getElementById('object-edit-spinner-damage').addEventListener('change', (e) => {
            if (this.editingObject && (this.editingObject.type === 'spinner' || this.editingObject.appearanceType === 'spinner')) {
                this.editingObject.damageAmount = Math.max(0, parseInt(e.target.value) || 1);
                e.target.value = this.editingObject.damageAmount;
                this.triggerMapChange();
            }
        });

        // Spike damage amount
        document.getElementById('object-edit-spike-damage').addEventListener('change', (e) => {
            if (this.editingObject && (this.editingObject.appearanceType === 'spike' || this.editingObject.actingType === 'spike')) {
                this.editingObject.damageAmount = Math.max(0, parseInt(e.target.value) || 1);
                e.target.value = this.editingObject.damageAmount;
                this.triggerMapChange();
            }
        });

        // Spike touchbox
        document.getElementById('object-edit-spike-touchbox').addEventListener('change', (e) => {
            if (this.editingObject && this.editingObject.appearanceType === 'spike') {
                this.editingObject.spikeTouchbox = e.target.value || null;
                this.updateSpikeTouchboxEditDescription(e.target.value);
                this.triggerMapChange();
            }
        });
        
        // Object edit drop hurt only
        document.getElementById('object-edit-drop-hurt-only').addEventListener('change', (e) => {
            if (this.editingObject && (this.editingObject.appearanceType === 'spike' || this.editingObject.actingType === 'spike')) {
                const value = e.target.value;
                if (value === '') {
                    this.editingObject.dropHurtOnly = undefined;
                } else {
                    this.editingObject.dropHurtOnly = value === 'true';
                }
                this.triggerMapChange();
            }
        });
        
        // Text content
        document.getElementById('object-edit-content').addEventListener('input', (e) => {
            if (this.editingObject && this.editingObject.type === 'text') {
                this.editingObject.content = e.target.value;
                this.updateObjectEditFontPreview();
                this.triggerMapChange();
            }
        });
        
        // Object edit font dropdown
        document.getElementById('object-edit-font-trigger').addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('object-edit-font-dropdown');
            const trigger = document.getElementById('object-edit-font-trigger');
            const menu = document.getElementById('object-edit-font-menu');
            
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
                
                // Populate dropdown with current font
                const currentFont = this.editingObject?.font || 'Parkoreen Game';
                this.populateObjectEditFontDropdown(currentFont);
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('object-edit-font-dropdown');
            if (dropdown && !dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
        
        // Delete button
        document.getElementById('object-edit-delete').addEventListener('click', () => {
            if (this.editingObject) {
                this.world.removeObject(this.editingObject.id);
                this.closeObjectEditPopup();
                this.updateLayersList();
                this.triggerMapChange();
            }
        });
        
        // Teleportal: Add Send button
        document.getElementById('teleportal-add-send').addEventListener('click', () => {
            if (this.editingObject && this.editingObject.type === 'teleportal') {
                this.editingObject.sendTo.push({ name: '', enabled: true });
                this.updateTeleportalConnectionLists();
                this.triggerMapChange();
            }
        });
        
        // Teleportal: Add Receive button
        document.getElementById('teleportal-add-receive').addEventListener('click', () => {
            if (this.editingObject && this.editingObject.type === 'teleportal') {
                this.editingObject.receiveFrom.push({ name: '', enabled: true });
                this.updateTeleportalConnectionLists();
                this.triggerMapChange();
            }
        });
    }
    
    closeObjectEditPopup() {
        this.editingObject = null;
        this.ui.objectEditPopup.classList.remove('active');
        this.closeColorPicker();
    }
    
    updateSpikeTouchboxEditDescription(mode) {
        const descEl = document.getElementById('object-edit-spike-desc');
        if (!descEl) return;
        
        const descriptions = {
            '': 'Uses the world\'s default spike touchbox setting.',
            'full': 'The entire spike is dangerous. Any contact damages the player.',
            'normal': 'The flat base acts as ground. Other parts damage the player.',
            'tip': 'Only the peak is dangerous. Base is ground, middle has no collision.',
            'ground': 'Acts completely as solid ground. No damage.',
            'flag': 'Only the flat base acts as ground. Rest has no collision.',
            'air': 'No collision at all. Players pass through.'
        };
        
        descEl.textContent = descriptions[mode] || descriptions[''];
    }
    
    updateSpikeAttachedWarning() {
        const warningEl = document.getElementById('object-edit-spike-attached');
        if (!warningEl || !this.editingObject) return;
        
        if (this.editingObject.appearanceType === 'spike' || this.editingObject.actingType === 'spike') {
            const isAttached = this.world.isSpikeAttachedToGround(this.editingObject);
            warningEl.style.display = isAttached ? 'block' : 'none';
        } else {
            warningEl.style.display = 'none';
        }
    }
    
    // ========================================
    // TELEPORTAL CONNECTION MANAGEMENT
    // ========================================
    getOtherTeleportals() {
        // Get all teleportals except the currently editing one
        return this.world.objects.filter(obj => 
            obj.type === 'teleportal' && 
            obj.teleportalName && 
            obj !== this.editingObject
        );
    }
    
    isTeleportalConnectionValid(fromPortal, toPortalName, direction) {
        // Check if the connection forms a valid two-way link
        const toPortal = this.world.objects.find(obj => 
            obj.type === 'teleportal' && obj.teleportalName === toPortalName
        );
        
        if (!toPortal) return false;
        
        if (direction === 'send') {
            // fromPortal sends to toPortal - check if toPortal receives from fromPortal (and is enabled)
            const conn = toPortal.receiveFrom.find(c => (c?.name || c) === fromPortal.teleportalName);
            return conn && conn?.enabled !== false;
        } else {
            // fromPortal receives from toPortal - check if toPortal sends to fromPortal (and is enabled)
            const conn = toPortal.sendTo.find(c => (c?.name || c) === fromPortal.teleportalName);
            return conn && conn?.enabled !== false;
        }
    }
    
    updateTeleportalConnectionLists() {
        if (!this.editingObject || this.editingObject.type !== 'teleportal') return;
        
        const sendList = document.getElementById('teleportal-send-list');
        const receiveList = document.getElementById('teleportal-receive-list');
        const otherPortals = this.getOtherTeleportals();
        
        // Build Send list
        if (this.editingObject.sendTo.length === 0) {
            sendList.innerHTML = '<div class="teleportal-connection-empty">No outgoing connections</div>';
        } else {
            sendList.innerHTML = this.editingObject.sendTo.map((conn, index) => {
                const targetName = conn?.name || conn;
                const isEnabled = conn?.enabled !== false;
                const isConnected = this.isTeleportalConnectionValid(this.editingObject, targetName, 'send');
                const optionsHtml = otherPortals.map(p => 
                    `<option value="${p.teleportalName}" ${p.teleportalName === targetName ? 'selected' : ''}>${p.teleportalName}</option>`
                ).join('');
                
                return `
                    <div class="teleportal-connection-item ${isConnected && isEnabled ? 'connected' : ''} ${!isEnabled ? 'disabled' : ''}" data-index="${index}" data-type="send">
                        <button class="toggle-connection ${isEnabled ? 'enabled' : ''}" title="${isEnabled ? 'Disable' : 'Enable'}">
                            <span class="material-symbols-outlined" style="font-size: 14px;">${isEnabled ? 'toggle_on' : 'toggle_off'}</span>
                        </button>
                        <select ${!isEnabled ? 'disabled' : ''}>
                            <option value="">Select portal...</option>
                            ${optionsHtml}
                        </select>
                        <button class="remove-connection" title="Remove">
                            <span class="material-symbols-outlined" style="font-size: 16px;">close</span>
                        </button>
                    </div>
                `;
            }).join('');
        }
        
        // Build Receive list
        if (this.editingObject.receiveFrom.length === 0) {
            receiveList.innerHTML = '<div class="teleportal-connection-empty">No incoming connections</div>';
        } else {
            receiveList.innerHTML = this.editingObject.receiveFrom.map((conn, index) => {
                const sourceName = conn?.name || conn;
                const isEnabled = conn?.enabled !== false;
                const isConnected = this.isTeleportalConnectionValid(this.editingObject, sourceName, 'receive');
                const optionsHtml = otherPortals.map(p => 
                    `<option value="${p.teleportalName}" ${p.teleportalName === sourceName ? 'selected' : ''}>${p.teleportalName}</option>`
                ).join('');
                
                return `
                    <div class="teleportal-connection-item ${isConnected && isEnabled ? 'connected' : ''} ${!isEnabled ? 'disabled' : ''}" data-index="${index}" data-type="receive">
                        <button class="toggle-connection ${isEnabled ? 'enabled' : ''}" title="${isEnabled ? 'Disable' : 'Enable'}">
                            <span class="material-symbols-outlined" style="font-size: 14px;">${isEnabled ? 'toggle_on' : 'toggle_off'}</span>
                        </button>
                        <select ${!isEnabled ? 'disabled' : ''}>
                            <option value="">Select portal...</option>
                            ${optionsHtml}
                        </select>
                        <button class="remove-connection" title="Remove">
                            <span class="material-symbols-outlined" style="font-size: 16px;">close</span>
                        </button>
                    </div>
                `;
            }).join('');
        }
        
        // Attach event listeners
        this.attachTeleportalListeners();
    }
    
    attachTeleportalListeners() {
        // Select change listeners
        document.querySelectorAll('#teleportal-send-list .teleportal-connection-item select').forEach(select => {
            select.addEventListener('change', (e) => {
                const item = e.target.closest('.teleportal-connection-item');
                const index = parseInt(item.dataset.index);
                const conn = this.editingObject.sendTo[index];
                if (typeof conn === 'object') {
                    conn.name = e.target.value;
                } else {
                    this.editingObject.sendTo[index] = { name: e.target.value, enabled: true };
                }
                this.updateTeleportalConnectionLists();
                this.triggerMapChange();
            });
        });
        
        document.querySelectorAll('#teleportal-receive-list .teleportal-connection-item select').forEach(select => {
            select.addEventListener('change', (e) => {
                const item = e.target.closest('.teleportal-connection-item');
                const index = parseInt(item.dataset.index);
                const conn = this.editingObject.receiveFrom[index];
                if (typeof conn === 'object') {
                    conn.name = e.target.value;
                } else {
                    this.editingObject.receiveFrom[index] = { name: e.target.value, enabled: true };
                }
                this.updateTeleportalConnectionLists();
                this.triggerMapChange();
            });
        });
        
        // Toggle button listeners
        document.querySelectorAll('#teleportal-send-list .toggle-connection').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = e.target.closest('.teleportal-connection-item');
                const index = parseInt(item.dataset.index);
                const conn = this.editingObject.sendTo[index];
                if (typeof conn === 'object') {
                    conn.enabled = !conn.enabled;
                } else {
                    this.editingObject.sendTo[index] = { name: conn, enabled: false };
                }
                this.updateTeleportalConnectionLists();
                this.triggerMapChange();
            });
        });
        
        document.querySelectorAll('#teleportal-receive-list .toggle-connection').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = e.target.closest('.teleportal-connection-item');
                const index = parseInt(item.dataset.index);
                const conn = this.editingObject.receiveFrom[index];
                if (typeof conn === 'object') {
                    conn.enabled = !conn.enabled;
                } else {
                    this.editingObject.receiveFrom[index] = { name: conn, enabled: false };
                }
                this.updateTeleportalConnectionLists();
                this.triggerMapChange();
            });
        });
        
        // Remove button listeners
        document.querySelectorAll('#teleportal-send-list .remove-connection').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = e.target.closest('.teleportal-connection-item');
                const index = parseInt(item.dataset.index);
                this.editingObject.sendTo.splice(index, 1);
                this.updateTeleportalConnectionLists();
                this.triggerMapChange();
            });
        });
        
        document.querySelectorAll('#teleportal-receive-list .remove-connection').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = e.target.closest('.teleportal-connection-item');
                const index = parseInt(item.dataset.index);
                this.editingObject.receiveFrom.splice(index, 1);
                this.updateTeleportalConnectionLists();
                this.triggerMapChange();
            });
        });
    }
    
    // ========================================
    // ZONE METHODS
    // ========================================
    
    completeZonePlacement() {
        const { startX, startY, endX, endY } = this.zonePlacement;
        
        // Calculate rectangle bounds
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const width = Math.abs(endX - startX) + GRID_SIZE;
        const height = Math.abs(endY - startY) + GRID_SIZE;
        
        // Minimum zone size
        if (width < GRID_SIZE || height < GRID_SIZE) {
            return; // Too small, cancel
        }
        
        // Create the zone object
        const zone = new WorldObject({
            x: x,
            y: y,
            width: width,
            height: height,
            type: 'koreen',
            appearanceType: 'zone',
            actingType: 'zone',
            collision: false,
            color: 'rgba(255, 255, 255, 0.3)',
            opacity: this.koreenSettings.opacity,
            name: 'New Zone',
            zoneName: '' // Will be set by naming popup
        });
        
        // Show naming popup
        this.pendingZone = zone;
        this.showZoneNamePopup();
    }

    completeSpinnerPlacement() {
        const { startX, startY, endX, endY } = this.obstaclePlacement;

        // Calculate rectangle bounds
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const width = Math.abs(endX - startX) + GRID_SIZE;
        const height = Math.abs(endY - startY) + GRID_SIZE;

        // Minimum spinner size (2x2 blocks default)
        const minSize = GRID_SIZE * 2;
        const finalWidth = Math.max(width, minSize);
        const finalHeight = Math.max(height, minSize);

        // Create the spinner object
        const spinner = new WorldObject({
            x: x,
            y: y,
            width: finalWidth,
            height: finalHeight,
            type: 'spinner',
            appearanceType: 'spinner',
            actingType: this.obstacleSettings.actingType || 'spike',
            collision: true,
            color: this.obstacleSettings.color || '#ff4444',
            opacity: this.obstacleSettings.opacity || 1,
            spinSpeed: this.obstacleSettings.spinSpeed || 1,
            rotation: 0
        });

        spinner.layer = 2; // Above player by default

        this.world.addObject(spinner);
        this.triggerMapChange();
    }

    completeButtonPlacement() {
        const { startX, startY, endX, endY } = this.buttonPlacement;
        
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const width = Math.abs(endX - startX) + GRID_SIZE;
        const height = Math.abs(endY - startY) + GRID_SIZE;
        
        if (width < GRID_SIZE || height < GRID_SIZE) return;
        
        const button = new WorldObject({
            x, y, width, height,
            type: 'koreen',
            appearanceType: 'button',
            actingType: 'button',
            collision: false,
            color: 'rgba(59, 130, 246, 0.35)',
            opacity: this.koreenSettings.opacity || 1,
            name: 'New Button',
            displayName: 'Button',
            displayDescription: '',
            buttonVisible: true,
            buttonWidth: null,
            buttonHeight: null
        });
        
        this.world.addObject(button);
        this.updateLayersList();
        this.triggerMapChange();
        
        // Open edit popup for the new button
        this.openButtonEditPopup(button);
    }

    showZoneNamePopup() {
        // Create popup if it doesn't exist
        let popup = document.getElementById('zone-name-popup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'zone-name-popup';
            popup.className = 'modal-overlay';
            popup.innerHTML = `
                <div class="zone-name-panel">
                    <div class="panel-header">
                        <span class="panel-title">Name Zone</span>
                        <button class="btn btn-icon btn-ghost" id="close-zone-name-popup">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    <div class="panel-body">
                        <div class="form-group">
                            <label class="form-label">Zone Name</label>
                            <input type="text" class="form-input" id="zone-name-input" placeholder="Enter unique zone name">
                            <div id="zone-name-error" style="color: #ff6b6b; font-size: 12px; margin-top: 4px; display: none;"></div>
                        </div>
                        <div class="form-group" style="margin-top: 16px;">
                            <button class="btn btn-primary" id="zone-name-confirm" style="width: 100%;">Create Zone</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(popup);
            
            // Event listeners
            document.getElementById('close-zone-name-popup').addEventListener('click', () => {
                this.closeZoneNamePopup();
            });
            
            popup.addEventListener('click', (e) => {
                if (e.target === popup) this.closeZoneNamePopup();
            });
            
            document.getElementById('zone-name-confirm').addEventListener('click', () => {
                this.confirmZoneName();
            });
            
            document.getElementById('zone-name-input').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.confirmZoneName();
                }
            });
        }
        
        // Reset and show
        document.getElementById('zone-name-input').value = '';
        document.getElementById('zone-name-error').style.display = 'none';
        popup.classList.add('active');
        document.getElementById('zone-name-input').focus();
    }
    
    closeZoneNamePopup() {
        const popup = document.getElementById('zone-name-popup');
        if (popup) popup.classList.remove('active');
        this.pendingZone = null;
    }
    
    confirmZoneName() {
        const input = document.getElementById('zone-name-input');
        const errorEl = document.getElementById('zone-name-error');
        const name = input.value.trim();
        
        if (!name) {
            errorEl.textContent = 'Please enter a zone name.';
            errorEl.style.display = 'block';
            return;
        }
        
        // Check for duplicate names
        const existingZone = this.world.objects.find(obj => 
            obj.appearanceType === 'zone' && obj.zoneName === name
        );
        
        if (existingZone) {
            errorEl.textContent = 'A zone with this name already exists.';
            errorEl.style.display = 'block';
            return;
        }
        
        // Set the zone name and add to world
        this.pendingZone.zoneName = name;
        this.pendingZone.name = 'Zone: ' + name;
        this.world.addObject(this.pendingZone);
        this.updateLayersList();
        this.triggerMapChange();
        
        this.closeZoneNamePopup();
    }
    
    // Teleportal placement
    placeTeleportal(x, y) {
        // Create the teleportal object
        const teleportal = new WorldObject({
            x: x,
            y: y,
            type: 'teleportal',
            appearanceType: 'teleportal',
            actingType: this.teleportalSettings.actingType || 'portal',
            collision: true,
            color: this.teleportalSettings.color || '#9C27B0',
            opacity: this.teleportalSettings.opacity || 1,
            name: 'New Teleportal',
            teleportalName: '' // Will be set by naming popup
        });
        
        // Show naming popup
        this.pendingTeleportal = teleportal;
        this.showTeleportalNamePopup();
    }
    
    showTeleportalNamePopup() {
        // Create popup if it doesn't exist
        let popup = document.getElementById('teleportal-name-popup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'teleportal-name-popup';
            popup.className = 'modal-overlay';
            popup.innerHTML = `
                <div class="zone-name-panel">
                    <div class="panel-header">
                        <span class="panel-title">Name Teleportal</span>
                        <button class="btn btn-icon btn-ghost" id="close-teleportal-name-popup">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    <div class="panel-body">
                        <div class="form-group">
                            <label class="form-label">Teleportal Name</label>
                            <input type="text" class="form-input" id="teleportal-name-input" placeholder="Enter unique teleportal name">
                            <div id="teleportal-name-error" style="color: #ff6b6b; font-size: 12px; margin-top: 4px; display: none;"></div>
                        </div>
                        <p style="font-size: 11px; color: #888; margin-top: 8px;">
                            Note: Teleportal names must be unique among other teleportals, but can share names with zones.
                        </p>
                        <div class="form-group" style="margin-top: 16px;">
                            <button class="btn btn-primary" id="teleportal-name-confirm" style="width: 100%;">Create Teleportal</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(popup);
            
            // Event listeners
            document.getElementById('close-teleportal-name-popup').addEventListener('click', () => {
                this.closeTeleportalNamePopup();
            });
            
            popup.addEventListener('click', (e) => {
                if (e.target === popup) this.closeTeleportalNamePopup();
            });
            
            document.getElementById('teleportal-name-confirm').addEventListener('click', () => {
                this.confirmTeleportalName();
            });
            
            document.getElementById('teleportal-name-input').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.confirmTeleportalName();
                }
            });
        }
        
        // Reset and show
        document.getElementById('teleportal-name-input').value = '';
        document.getElementById('teleportal-name-error').style.display = 'none';
        popup.classList.add('active');
        document.getElementById('teleportal-name-input').focus();
    }
    
    closeTeleportalNamePopup() {
        const popup = document.getElementById('teleportal-name-popup');
        if (popup) popup.classList.remove('active');
        this.pendingTeleportal = null;
    }
    
    confirmTeleportalName() {
        const input = document.getElementById('teleportal-name-input');
        const errorEl = document.getElementById('teleportal-name-error');
        const name = input.value.trim();
        
        if (!name) {
            errorEl.textContent = 'Please enter a teleportal name.';
            errorEl.style.display = 'block';
            return;
        }
        
        // Check for duplicate names among teleportals only
        const existingTeleportal = this.world.objects.find(obj => 
            obj.type === 'teleportal' && obj.teleportalName === name
        );
        
        if (existingTeleportal) {
            errorEl.textContent = 'A teleportal with this name already exists.';
            errorEl.style.display = 'block';
            return;
        }
        
        // Set the teleportal name and add to world
        this.pendingTeleportal.teleportalName = name;
        this.pendingTeleportal.name = 'Teleportal: ' + name;
        this.world.addObject(this.pendingTeleportal);
        this.updateLayersList();
        this.triggerMapChange();
        
        this.closeTeleportalNamePopup();
    }
    
    // Override object edit popup for zones
    openObjectEditPopup(obj) {
        if (!obj) return;
        
        // Special handling for zones
        if (obj.appearanceType === 'zone') {
            this.openZoneEditPopup(obj);
            return;
        }
        
        // Special handling for buttons
        if (obj.appearanceType === 'button') {
            this.openButtonEditPopup(obj);
            return;
        }
        
        this.editingObject = obj;
        const popup = this.ui.objectEditPopup;
        
        // Set title
        document.getElementById('object-edit-title').textContent = 'Edit ' + obj.name;
        
        // Set values
        document.getElementById('object-edit-name').value = obj.name;
        document.getElementById('object-edit-color').value = obj.color;
        document.getElementById('object-edit-color-preview').style.background = obj.color;
        document.getElementById('object-edit-opacity-range').value = Math.round(obj.opacity * 100);
        document.getElementById('object-edit-opacity-label').textContent = Math.round(obj.opacity * 100) + '%';
        document.getElementById('object-edit-rotation-label').textContent = obj.rotation + '°';
        document.getElementById('object-edit-collision').checked = obj.collision;
        
        // Show/hide flip horizontal (not for zones)
        const flipGroup = document.getElementById('object-edit-flip-group');
        if (obj.appearanceType === 'zone') {
            flipGroup.style.display = 'none';
        } else {
            flipGroup.style.display = 'block';
            document.getElementById('object-edit-flip-horizontal').checked = obj.flipHorizontal || false;
        }
        
        // Show/hide spinner options (size + spin speed)
        const spinnerGroup = document.getElementById('object-edit-spinner-group');
        const isSpinner = obj.type === 'spinner' || obj.appearanceType === 'spinner';
        if (isSpinner) {
            spinnerGroup.style.display = 'block';
            document.getElementById('object-edit-spinner-width').value = obj.width;
            document.getElementById('object-edit-spinner-height').value = obj.height;
            const speed = obj.spinSpeed || 1;
            document.getElementById('object-edit-spin-speed-range').value = Math.round(speed * 10);
            document.getElementById('object-edit-spin-speed-label').textContent = speed.toFixed(1) + '/s';
            const dir = obj.spinDirection || 1;
            document.getElementById('object-edit-spin-dir-cw').classList.toggle('active', dir === 1);
            document.getElementById('object-edit-spin-dir-ccw').classList.toggle('active', dir === -1);
            document.getElementById('object-edit-spinner-damage').value = obj.damageAmount !== undefined ? obj.damageAmount : 1;
        } else {
            spinnerGroup.style.display = 'none';
        }

        // Show/hide spike options (not for spinners/saw blades)
        const spikeGroup = document.getElementById('object-edit-spike-group');
        if (!isSpinner && (obj.appearanceType === 'spike' || obj.actingType === 'spike')) {
            spikeGroup.style.display = 'block';
            document.getElementById('object-edit-spike-touchbox').value = obj.spikeTouchbox || '';
            this.updateSpikeTouchboxEditDescription(obj.spikeTouchbox || '');
            this.updateSpikeAttachedWarning();
            
            // Set dropHurtOnly value
            const dropHurtOnlySelect = document.getElementById('object-edit-drop-hurt-only');
            if (obj.dropHurtOnly === true) {
                dropHurtOnlySelect.value = 'true';
            } else if (obj.dropHurtOnly === false) {
                dropHurtOnlySelect.value = 'false';
            } else {
                dropHurtOnlySelect.value = '';
            }
            document.getElementById('object-edit-spike-damage').value = obj.damageAmount !== undefined ? obj.damageAmount : 1;
        } else {
            spikeGroup.style.display = 'none';
        }
        
        // Show/hide text options
        const textGroup = document.getElementById('object-edit-text-group');
        if (obj.type === 'text') {
            textGroup.style.display = 'block';
            document.getElementById('object-edit-content').value = obj.content || '';
            
            // Set font and populate font dropdown
            const fontValue = document.getElementById('object-edit-font-value');
            fontValue.textContent = obj.font || 'Parkoreen Game';
            fontValue.style.fontFamily = `"${obj.font || 'Parkoreen Game'}"`;
            
            // Set content textarea font
            document.getElementById('object-edit-content').style.fontFamily = `"${obj.font || 'Parkoreen Game'}"`;
            
            // Populate font dropdown
            this.populateObjectEditFontDropdown(obj.font || 'Parkoreen Game');
            
            // Update font preview
            this.updateObjectEditFontPreview();
        } else {
            textGroup.style.display = 'none';
        }
        
        // Show/hide teleportal options (only when actingType is 'portal')
        const teleportalGroup = document.getElementById('object-edit-teleportal-group');
        if (obj.type === 'teleportal' && obj.actingType === 'portal') {
            teleportalGroup.style.display = 'block';
            this.updateTeleportalConnectionLists();
        } else {
            teleportalGroup.style.display = 'none';
        }
        
        // Show popup
        popup.classList.add('active');
    }
    
    openZoneEditPopup(zone) {
        // Create popup if it doesn't exist
        let popup = document.getElementById('zone-edit-popup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'zone-edit-popup';
            popup.className = 'modal-overlay';
            popup.innerHTML = `
                <div class="zone-edit-panel">
                    <div class="panel-header">
                        <span class="panel-title" id="zone-edit-title">Edit Zone</span>
                        <button class="btn btn-icon btn-ghost" id="close-zone-edit">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    <div class="panel-body">
                        <div class="form-group">
                            <label class="form-label">Zone Name</label>
                            <input type="text" class="form-input" id="zone-edit-name" placeholder="Zone name">
                            <div id="zone-edit-name-error" style="color: #ff6b6b; font-size: 12px; margin-top: 4px; display: none;"></div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Opacity</label>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <input type="range" class="form-range" id="zone-edit-opacity" min="0" max="100" value="30" style="flex: 1;">
                                <span id="zone-edit-opacity-label" style="font-size: 12px; min-width: 35px;">30%</span>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <button class="btn btn-secondary" id="zone-edit-adjust" style="width: 100%;">
                                <span class="material-symbols-outlined">open_with</span>
                                Adjust Region
                            </button>
                        </div>
                        
                        <div class="form-group" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--surface-light);">
                            <button class="btn btn-danger" id="zone-edit-delete" style="width: 100%;">
                                <span class="material-symbols-outlined">delete</span>
                                Delete Zone
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(popup);
            
            // Event listeners
            document.getElementById('close-zone-edit').addEventListener('click', () => {
                this.closeZoneEditPopup();
            });
            
            popup.addEventListener('click', (e) => {
                if (e.target === popup) this.closeZoneEditPopup();
            });
            
            document.getElementById('zone-edit-name').addEventListener('change', (e) => {
                this.updateZoneName(e.target.value);
            });
            
            document.getElementById('zone-edit-opacity').addEventListener('input', (e) => {
                if (this.editingZone) {
                    const value = parseInt(e.target.value);
                    this.editingZone.opacity = value / 100;
                    document.getElementById('zone-edit-opacity-label').textContent = value + '%';
                    this.triggerMapChange();
                }
            });
            
            document.getElementById('zone-edit-adjust').addEventListener('click', () => {
                this.startZoneAdjustmentMode();
            });
            
            document.getElementById('zone-edit-delete').addEventListener('click', () => {
                if (this.editingZone) {
                    this.world.removeObject(this.editingZone.id);
                    this.closeZoneEditPopup();
                    this.updateLayersList();
                    this.triggerMapChange();
                }
            });
        }
        
        this.editingZone = zone;
        
        // Set values
        document.getElementById('zone-edit-title').textContent = 'Edit Zone: ' + (zone.zoneName || 'Unnamed');
        document.getElementById('zone-edit-name').value = zone.zoneName || '';
        document.getElementById('zone-edit-opacity').value = Math.round(zone.opacity * 100);
        document.getElementById('zone-edit-opacity-label').textContent = Math.round(zone.opacity * 100) + '%';
        document.getElementById('zone-edit-name-error').style.display = 'none';
        
        popup.classList.add('active');
    }
    
    closeZoneEditPopup() {
        const popup = document.getElementById('zone-edit-popup');
        if (popup) popup.classList.remove('active');
        this.editingZone = null;
    }
    
    openButtonEditPopup(button) {
        let popup = document.getElementById('button-edit-popup');
        if (popup) popup.remove();
        
        popup = document.createElement('div');
        popup.id = 'button-edit-popup';
        popup.className = 'modal-overlay';
        popup.innerHTML = `
            <div class="object-edit-panel" style="max-width: 420px;">
                <div class="panel-header">
                    <span class="panel-title">Edit Button</span>
                    <button class="btn btn-icon btn-ghost" id="close-button-edit">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="panel-body">
                    <div class="form-group">
                        <label class="form-label">Object Name</label>
                        <input type="text" class="form-input" id="button-edit-name" value="${this.escapeAttr(button.name)}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Display Name</label>
                        <input type="text" class="form-input" id="button-edit-display-name" value="${this.escapeAttr(button.displayName)}" placeholder="Title shown to player">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Display Description</label>
                        <textarea class="form-input" id="button-edit-display-desc" rows="4" placeholder="Description shown to player" style="resize: vertical;">${this.escapeAttr(button.displayDescription)}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Button Visible</label>
                        <label class="toggle">
                            <input type="checkbox" id="button-edit-visible" ${button.buttonVisible ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Button Display Size</label>
                        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
                            Custom display size (leave empty to match zone size)
                        </div>
                        <div style="display: flex; gap: 12px;">
                            <div style="flex: 1;">
                                <label style="font-size: 11px; color: var(--text-muted);">Width (px)</label>
                                <input type="number" class="form-input" id="button-edit-width" value="${button.buttonWidth || ''}" placeholder="Auto" min="10" step="1">
                            </div>
                            <div style="flex: 1;">
                                <label style="font-size: 11px; color: var(--text-muted);">Height (px)</label>
                                <input type="number" class="form-input" id="button-edit-height" value="${button.buttonHeight || ''}" placeholder="Auto" min="10" step="1">
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Opacity</label>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="range" class="form-range" id="button-edit-opacity" min="0" max="100" value="${Math.round(button.opacity * 100)}" style="flex: 1;">
                            <span id="button-edit-opacity-label" style="font-size: 12px; min-width: 35px;">${Math.round(button.opacity * 100)}%</span>
                        </div>
                    </div>
                    <div class="form-group" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--surface-light);">
                        <button class="btn btn-danger" id="button-edit-delete" style="width: 100%;">
                            <span class="material-symbols-outlined">delete</span>
                            Delete Button
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(popup);
        popup.classList.add('active');
        
        this.editingButton = button;
        
        // Close
        document.getElementById('close-button-edit').addEventListener('click', () => {
            this.closeButtonEditPopup();
        });
        popup.addEventListener('click', (e) => {
            if (e.target === popup) this.closeButtonEditPopup();
        });
        
        // Name
        document.getElementById('button-edit-name').addEventListener('change', (e) => {
            button.name = e.target.value || 'Button';
            this.updateLayersList();
            this.triggerMapChange();
        });
        
        // Display name
        document.getElementById('button-edit-display-name').addEventListener('input', (e) => {
            button.displayName = e.target.value;
            this.triggerMapChange();
        });
        
        // Display description
        document.getElementById('button-edit-display-desc').addEventListener('input', (e) => {
            button.displayDescription = e.target.value;
            this.triggerMapChange();
        });
        
        // Visible
        document.getElementById('button-edit-visible').addEventListener('change', (e) => {
            button.buttonVisible = e.target.checked;
            this.triggerMapChange();
        });
        
        // Width
        document.getElementById('button-edit-width').addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            button.buttonWidth = val > 0 ? val : null;
            this.triggerMapChange();
        });
        
        // Height
        document.getElementById('button-edit-height').addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            button.buttonHeight = val > 0 ? val : null;
            this.triggerMapChange();
        });
        
        // Opacity
        document.getElementById('button-edit-opacity').addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            button.opacity = val / 100;
            document.getElementById('button-edit-opacity-label').textContent = val + '%';
            this.triggerMapChange();
        });
        
        // Delete
        document.getElementById('button-edit-delete').addEventListener('click', () => {
            this.world.removeObject(button.id);
            this.closeButtonEditPopup();
            this.updateLayersList();
            this.triggerMapChange();
        });
    }
    
    closeButtonEditPopup() {
        const popup = document.getElementById('button-edit-popup');
        if (popup) {
            popup.classList.remove('active');
            setTimeout(() => popup.remove(), 200);
        }
        this.editingButton = null;
    }
    
    escapeAttr(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    
    updateZoneName(newName) {
        const errorEl = document.getElementById('zone-edit-name-error');
        const name = newName.trim();
        
        if (!name) {
            errorEl.textContent = 'Zone name cannot be empty.';
            errorEl.style.display = 'block';
            return;
        }
        
        // Check for duplicate names (excluding current zone)
        const existingZone = this.world.objects.find(obj => 
            obj.appearanceType === 'zone' && 
            obj.zoneName === name && 
            obj.id !== this.editingZone.id
        );
        
        if (existingZone) {
            errorEl.textContent = 'A zone with this name already exists.';
            errorEl.style.display = 'block';
            return;
        }
        
        errorEl.style.display = 'none';
        this.editingZone.zoneName = name;
        this.editingZone.name = 'Zone: ' + name;
        document.getElementById('zone-edit-title').textContent = 'Edit Zone: ' + name;
        this.updateLayersList();
        this.triggerMapChange();
    }
    
    startZoneAdjustmentMode() {
        if (!this.editingZone) return;
        
        this.zoneAdjustment.active = true;
        this.zoneAdjustment.zone = this.editingZone;
        
        // Close the edit popup
        this.closeZoneEditPopup();
        
        // Hide all UI except the stop button
        document.querySelectorAll('.toolbar, .panel, .add-menu, .placement-toolbar, .editor-btn-corner').forEach(el => {
            el.style.display = 'none';
        });
        
        // Create stop button
        let stopBtn = document.getElementById('zone-adjust-stop');
        if (!stopBtn) {
            stopBtn = document.createElement('button');
            stopBtn.id = 'zone-adjust-stop';
            stopBtn.className = 'btn btn-danger zone-adjust-stop';
            stopBtn.innerHTML = '<span class="material-symbols-outlined">close</span> Stop Adjusting';
            stopBtn.addEventListener('click', () => this.exitZoneAdjustmentMode());
            document.body.appendChild(stopBtn);
        }
        stopBtn.style.display = 'flex';
        
        // Enable fly mode for navigation
        this.isFlying = true;
    }
    
    exitZoneAdjustmentMode() {
        this.zoneAdjustment.active = false;
        this.zoneAdjustment.zone = null;
        this.zoneAdjustment.draggerHeld = null;
        
        // Hide stop button
        const stopBtn = document.getElementById('zone-adjust-stop');
        if (stopBtn) stopBtn.style.display = 'none';
        
        // Restore all UI
        document.querySelectorAll('.toolbar, .editor-btn-corner').forEach(el => {
            el.style.display = '';
        });
        
        // Re-show panels that were open (they'll handle their own visibility)
        this.updateLayersList();
        this.triggerMapChange();
    }
    
    handleZoneDraggerMove(gridX, gridY) {
        const zone = this.zoneAdjustment.zone;
        const dragger = this.zoneAdjustment.draggerHeld;
        if (!zone || !dragger) return;
        
        const minSize = GRID_SIZE;
        
        switch (dragger) {
            case 'top':
                const newTop = gridY;
                const maxTop = zone.y + zone.height - minSize;
                if (newTop <= maxTop) {
                    const diff = zone.y - newTop;
                    zone.y = newTop;
                    zone.height += diff;
                }
                break;
            case 'bottom':
                const newBottom = gridY + GRID_SIZE;
                const minBottom = zone.y + minSize;
                if (newBottom >= minBottom) {
                    zone.height = newBottom - zone.y;
                }
                break;
            case 'left':
                const newLeft = gridX;
                const maxLeft = zone.x + zone.width - minSize;
                if (newLeft <= maxLeft) {
                    const diff = zone.x - newLeft;
                    zone.x = newLeft;
                    zone.width += diff;
                }
                break;
            case 'right':
                const newRight = gridX + GRID_SIZE;
                const minRight = zone.x + minSize;
                if (newRight >= minRight) {
                    zone.width = newRight - zone.x;
                }
                break;
            case 'top-left':
                this.handleZoneDraggerMove(gridX, gridY); // This won't recurse properly, handle manually
                {
                    const newT = gridY;
                    const maxT = zone.y + zone.height - minSize;
                    if (newT <= maxT) {
                        const diffY = zone.y - newT;
                        zone.y = newT;
                        zone.height += diffY;
                    }
                    const newL = gridX;
                    const maxL = zone.x + zone.width - minSize;
                    if (newL <= maxL) {
                        const diffX = zone.x - newL;
                        zone.x = newL;
                        zone.width += diffX;
                    }
                }
                break;
            case 'top-right':
                {
                    const newT = gridY;
                    const maxT = zone.y + zone.height - minSize;
                    if (newT <= maxT) {
                        const diffY = zone.y - newT;
                        zone.y = newT;
                        zone.height += diffY;
                    }
                    const newR = gridX + GRID_SIZE;
                    const minR = zone.x + minSize;
                    if (newR >= minR) {
                        zone.width = newR - zone.x;
                    }
                }
                break;
            case 'bottom-left':
                {
                    const newB = gridY + GRID_SIZE;
                    const minB = zone.y + minSize;
                    if (newB >= minB) {
                        zone.height = newB - zone.y;
                    }
                    const newL = gridX;
                    const maxL = zone.x + zone.width - minSize;
                    if (newL <= maxL) {
                        const diffX = zone.x - newL;
                        zone.x = newL;
                        zone.width += diffX;
                    }
                }
                break;
            case 'bottom-right':
                {
                    const newB = gridY + GRID_SIZE;
                    const minB = zone.y + minSize;
                    if (newB >= minB) {
                        zone.height = newB - zone.y;
                    }
                    const newR = gridX + GRID_SIZE;
                    const minR = zone.x + minSize;
                    if (newR >= minR) {
                        zone.width = newR - zone.x;
                    }
                }
                break;
        }
    }
    
    getZoneDraggerAtPoint(worldX, worldY) {
        if (!this.zoneAdjustment.active || !this.zoneAdjustment.zone) return null;
        
        const zone = this.zoneAdjustment.zone;
        const handleSize = 12 / this.camera.zoom; // Size in world units
        
        const draggers = [
            { name: 'top-left', x: zone.x, y: zone.y },
            { name: 'top', x: zone.x + zone.width / 2, y: zone.y },
            { name: 'top-right', x: zone.x + zone.width, y: zone.y },
            { name: 'left', x: zone.x, y: zone.y + zone.height / 2 },
            { name: 'right', x: zone.x + zone.width, y: zone.y + zone.height / 2 },
            { name: 'bottom-left', x: zone.x, y: zone.y + zone.height },
            { name: 'bottom', x: zone.x + zone.width / 2, y: zone.y + zone.height },
            { name: 'bottom-right', x: zone.x + zone.width, y: zone.y + zone.height }
        ];
        
        for (const d of draggers) {
            if (Math.abs(worldX - d.x) < handleSize && Math.abs(worldY - d.y) < handleSize) {
                return d.name;
            }
        }
        
        return null;
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
                <div class="hex-input-wrapper">
                    <span class="hex-prefix">#</span>
                    <input type="text" class="form-input hex-input" id="color-picker-hex" value="FF0000" maxlength="6">
                </div>
            </div>
        `;
        document.body.appendChild(popup);
        this.ui.colorPickerPopup = popup;
        
        this.colorPickerState = {
            hue: 0,
            saturation: 100,
            value: 100,
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
            // If in selection mode, exit it
            if (this.isSelectionActive) {
                this.exitSelectionMode();
                return;
            }
            // If in erase mode, stop it
            if (this.isErasing) {
                this.setTool(EditorTool.ERASE); // Toggle off
            }
            // If in placement mode, stop it
            else if (this.placementMode !== PlacementMode.NONE) {
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
        
        // Erase toolbar
        this.attachEraseListeners();

        // Config panel
        this.attachConfigListeners();

        // Color picker
        this.attachColorPickerListeners();

        // Settings
        this.attachSettingsListeners();

        // Font dropdown
        this.attachFontDropdownListeners();
        
        // Texture dropdown
        this.attachTextureDropdownListeners();
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
                } else if (this.placementMode === PlacementMode.OBSTACLE) {
                    this.obstacleSettings.actingType = btn.dataset.acting;
                } else if (this.placementMode === PlacementMode.KOREEN) {
                    this.koreenSettings.actingType = btn.dataset.acting;
                } else if (this.placementMode === PlacementMode.TEXT) {
                    this.textSettings.actingType = btn.dataset.acting;
                } else if (this.placementMode === PlacementMode.TELEPORTAL) {
                    this.teleportalSettings.actingType = btn.dataset.acting;
                }
            });
        });

        // Collision
        document.querySelectorAll('[data-collision]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-collision]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const collision = btn.dataset.collision === 'true';
                if (this.placementMode === PlacementMode.OBSTACLE) {
                    this.obstacleSettings.collision = collision;
                } else {
                    this.placementSettings.collision = collision;
                }
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
                } else if (this.placementMode === PlacementMode.OBSTACLE && this.obstacleSettings.appearanceType === 'spike') {
                    this.obstacleSettings.fillMode = fillMode;
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
                if (this.placementMode === PlacementMode.TEXT) {
                    this.textSettings.color = color;
                } else if (this.placementMode === PlacementMode.TELEPORTAL) {
                    this.teleportalSettings.color = color;
                } else if (this.placementMode === PlacementMode.OBSTACLE) {
                    this.obstacleSettings.color = color;
                } else if (this.placementMode === PlacementMode.KOREEN) {
                    this.koreenSettings.color = color;
                } else {
                this.placementSettings.color = color;
                    // Update texture preview with new background color
                    this.updateTexturePreview();
                }
                document.getElementById('placement-color-preview').style.background = color;
            }
        });

        // Opacity
        document.getElementById('placement-opacity-input').addEventListener('change', (e) => {
            const opacity = Math.max(0, Math.min(100, parseInt(e.target.value) || 100));
            e.target.value = opacity;
            if (this.placementMode === PlacementMode.BLOCK) {
                this.placementSettings.opacity = opacity / 100;
            } else if (this.placementMode === PlacementMode.OBSTACLE) {
                this.obstacleSettings.opacity = opacity / 100;
            } else if (this.placementMode === PlacementMode.KOREEN) {
                this.koreenSettings.opacity = opacity / 100;
            } else if (this.placementMode === PlacementMode.TEXT) {
                this.textSettings.opacity = opacity / 100;
            } else if (this.placementMode === PlacementMode.TELEPORTAL) {
                this.teleportalSettings.opacity = opacity / 100;
            }
        });

        // Text content
        document.getElementById('placement-content-input').addEventListener('input', (e) => {
            this.textSettings.content = e.target.value;
            this.updatePlacementFontPreview();
        });
        
        // Font size
        document.getElementById('placement-fontsize-input').addEventListener('change', (e) => {
            const size = Math.max(8, Math.min(200, parseInt(e.target.value) || 24));
            e.target.value = size;
            this.textSettings.fontSize = size;
            this.updatePlacementFontPreview();
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
    
    attachEraseListeners() {
        // Erase type
        document.querySelectorAll('[data-erase-type]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-erase-type]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.eraseSettings.eraseType = btn.dataset.eraseType;
            });
        });
        
        // Eraser size
        const widthInput = document.getElementById('erase-width');
        const heightInput = document.getElementById('erase-height');
        
        if (widthInput) {
            widthInput.addEventListener('change', (e) => {
                this.eraseSettings.width = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
                e.target.value = this.eraseSettings.width;
            });
        }
        
        if (heightInput) {
            heightInput.addEventListener('change', (e) => {
                this.eraseSettings.height = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
                e.target.value = this.eraseSettings.height;
            });
        }
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

            // Show/hide custom background options
            const customOptions = document.getElementById('custom-bg-options');
            if (e.target.value === 'custom') {
                customOptions.classList.remove('hidden');
            } else {
                customOptions.classList.add('hidden');
                // Disable custom background when switching away
                this.world.customBackground.enabled = false;
            }

            this.updateBackground();
            this.triggerMapChange();
        });
        
        // Cloud colors
        ['sky', 'galaxy'].forEach(type => {
            const preview = document.getElementById(`config-cloud-${type}-preview`);
            const input = document.getElementById(`config-cloud-${type}`);
            
            if (preview && input) {
                preview.addEventListener('click', () => {
                    this.openColorPicker(`config-cloud-${type}`);
                });
                
                input.addEventListener('change', (e) => {
                    const color = e.target.value;
                    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                        preview.style.background = color;
                        if (type === 'sky') this.world.cloudColorSky = color;
                        else if (type === 'galaxy') this.world.cloudColorGalaxy = color;
                        this.triggerMapChange();
                    }
                });
            }
        });
        
        // Custom background file upload
        this.setupCustomBackgroundListeners();

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
        
        // Checkpoint colors
        ['default', 'active', 'touched'].forEach(type => {
            const preview = document.getElementById(`config-checkpoint-${type}-preview`);
            const input = document.getElementById(`config-checkpoint-${type}`);
            
            if (preview && input) {
                preview.addEventListener('click', () => {
                    this.openColorPicker(`config-checkpoint-${type}`);
                });
                
                input.addEventListener('change', (e) => {
                    const color = e.target.value;
                    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                        preview.style.background = color;
                        if (type === 'default') this.world.checkpointDefaultColor = color;
                        else if (type === 'active') this.world.checkpointActiveColor = color;
                        else if (type === 'touched') this.world.checkpointTouchedColor = color;
                        this.triggerMapChange();
                    }
                });
            }
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
        
        // Keyboard layout
        document.getElementById('config-keyboard-layout').addEventListener('change', (e) => {
            this.world.keyboardLayout = e.target.value;
            this.updateKeyboardLayoutInfo(e.target.value);
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

        document.getElementById('config-camera-lerp-x').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.world.cameraLerpX = (value > 0 && value <= 1) ? value : 0.12;
            document.getElementById('config-camera-lerp-x-value').textContent = this.world.cameraLerpX.toFixed(2);
            this.triggerMapChange();
        });

        document.getElementById('config-camera-lerp-y').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.world.cameraLerpY = (value > 0 && value <= 1) ? value : 0.12;
            document.getElementById('config-camera-lerp-y-value').textContent = this.world.cameraLerpY.toFixed(2);
            this.triggerMapChange();
        });

        // Spike touchbox mode
        document.getElementById('config-spike-touchbox').addEventListener('change', (e) => {
            this.world.spikeTouchbox = e.target.value;
            this.updateSpikeTouchboxDescription(e.target.value);
            this.triggerMapChange();
        });
        
        // Drop Hurt Only toggle
        document.getElementById('config-drop-hurt-only').addEventListener('change', (e) => {
            this.world.dropHurtOnly = e.target.checked;
            this.triggerMapChange();
        });
        
        // Stored data type
        document.getElementById('config-stored-data-type').addEventListener('change', (e) => {
            this.world.storedDataType = e.target.value;
            this.updateStoredDataTypeDescription(e.target.value);
            this.triggerMapChange();
        });
        
        // Music settings
        const musicSelect = document.getElementById('config-music');
        const customMusicOptions = document.getElementById('custom-music-options');
        const customMusicDropzone = document.getElementById('custom-music-dropzone');
        const customMusicFile = document.getElementById('custom-music-file');
        const customMusicPreview = document.getElementById('custom-music-preview');
        const customMusicName = document.getElementById('custom-music-name');
        const customMusicPlay = document.getElementById('custom-music-play');
        const customMusicRemove = document.getElementById('custom-music-remove');
        const musicVolume = document.getElementById('config-music-volume');
        const musicVolumeLabel = document.getElementById('config-music-volume-label');
        const musicLoop = document.getElementById('config-music-loop');
        
        // Audio element for preview
        this.previewAudio = new Audio();
        
        musicSelect.addEventListener('change', (e) => {
            this.world.music.type = e.target.value;
            if (e.target.value === 'custom') {
                customMusicOptions.classList.remove('hidden');
            } else {
                customMusicOptions.classList.add('hidden');
            }
            this.triggerMapChange();
            this.updateMusicPlayback();
        });
        
        // Custom music dropzone
        customMusicDropzone.addEventListener('click', () => {
            customMusicFile.click();
        });
        
        customMusicDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            customMusicDropzone.style.borderColor = 'var(--primary)';
            customMusicDropzone.style.background = 'rgba(99, 102, 241, 0.1)';
        });
        
        customMusicDropzone.addEventListener('dragleave', () => {
            customMusicDropzone.style.borderColor = 'var(--surface-light)';
            customMusicDropzone.style.background = '';
        });
        
        customMusicDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            customMusicDropzone.style.borderColor = 'var(--surface-light)';
            customMusicDropzone.style.background = '';
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('audio/')) {
                this.handleMusicUpload(file);
            }
        });
        
        customMusicFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleMusicUpload(file);
            }
        });
        
        customMusicPlay.addEventListener('click', () => {
            if (this.previewAudio.paused) {
                this.previewAudio.play();
                customMusicPlay.querySelector('.material-symbols-outlined').textContent = 'pause';
            } else {
                this.previewAudio.pause();
                customMusicPlay.querySelector('.material-symbols-outlined').textContent = 'play_arrow';
            }
        });
        
        customMusicRemove.addEventListener('click', () => {
            this.world.music.customData = null;
            this.world.music.customName = null;
            this.previewAudio.pause();
            this.previewAudio.src = '';
            customMusicPreview.classList.add('hidden');
            customMusicDropzone.classList.remove('hidden');
            customMusicPlay.querySelector('.material-symbols-outlined').textContent = 'play_arrow';
            this.triggerMapChange();
            this.updateMusicPlayback();
        });
        
        musicVolume.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.world.music.volume = value;
            musicVolumeLabel.textContent = value + '%';
            this.previewAudio.volume = value / 100;
            this.triggerMapChange();
            this.updateMusicPlayback();
        });
        
        musicLoop.addEventListener('change', (e) => {
            this.world.music.loop = e.target.checked;
            this.triggerMapChange();
            this.updateMusicPlayback();
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
        
        // Plugins button
        document.getElementById('btn-plugins').addEventListener('click', () => this.openPluginsPopup());
        document.getElementById('close-plugins-popup').addEventListener('click', () => this.closePluginsPopup());
        document.getElementById('plugins-popup').addEventListener('click', (e) => {
            if (e.target.id === 'plugins-popup') this.closePluginsPopup();
        });
        
        // Plugin toggle buttons
        document.querySelectorAll('.plugin-toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pluginId = e.target.dataset.plugin;
                this.togglePlugin(pluginId);
            });
        });
        
        // HP settings
        document.getElementById('config-hp-default')?.addEventListener('change', (e) => {
            if (!this.world.plugins.hp) this.world.plugins.hp = { defaultHP: 3 };
            this.world.plugins.hp.defaultHP = Math.max(1, Math.min(99, parseInt(e.target.value) || 3));
            e.target.value = this.world.plugins.hp.defaultHP;
            this.triggerMapChange();
        });
        
        // Hollow Knight settings
        document.getElementById('config-hk-gravity')?.addEventListener('change', (e) => {
            this.ensureHKConfig();
            const value = parseFloat(e.target.value) || 1.14;
            this.world.plugins.hk.defaultGravity = Math.max(0.1, Math.min(3, value));
            // Also apply to world gravity
            this.world.gravity = this.world.plugins.hk.defaultGravity;
            e.target.value = this.world.plugins.hk.defaultGravity;
            // Update the physics gravity input too
            const gravityInput = document.getElementById('config-gravity');
            if (gravityInput) gravityInput.value = this.world.gravity;
            this.triggerMapChange();
        });
        
        document.getElementById('config-hk-camera-x')?.addEventListener('input', (e) => {
            this.ensureHKConfig();
            const value = parseFloat(e.target.value) || 0.04;
            this.world.plugins.hk.defaultCameraLerpX = Math.max(0.02, Math.min(0.5, value));
            // Also apply to world camera
            this.world.cameraLerpX = this.world.plugins.hk.defaultCameraLerpX;
            document.getElementById('config-hk-camera-x-value').textContent = this.world.cameraLerpX.toFixed(2);
            // Update the physics camera input too
            const cameraInput = document.getElementById('config-camera-lerp-x');
            const cameraValue = document.getElementById('config-camera-lerp-x-value');
            if (cameraInput) cameraInput.value = this.world.cameraLerpX;
            if (cameraValue) cameraValue.textContent = this.world.cameraLerpX.toFixed(2);
            this.triggerMapChange();
        });
        
        document.getElementById('config-hk-camera-y')?.addEventListener('input', (e) => {
            this.ensureHKConfig();
            const value = parseFloat(e.target.value) || 0.15;
            this.world.plugins.hk.defaultCameraLerpY = Math.max(0.02, Math.min(0.5, value));
            // Also apply to world camera
            this.world.cameraLerpY = this.world.plugins.hk.defaultCameraLerpY;
            document.getElementById('config-hk-camera-y-value').textContent = this.world.cameraLerpY.toFixed(2);
            // Update the physics camera input too
            const cameraInput = document.getElementById('config-camera-lerp-y');
            const cameraValue = document.getElementById('config-camera-lerp-y-value');
            if (cameraInput) cameraInput.value = this.world.cameraLerpY;
            if (cameraValue) cameraValue.textContent = this.world.cameraLerpY.toFixed(2);
            this.triggerMapChange();
        });
        
        document.getElementById('config-hk-maxsoul')?.addEventListener('change', (e) => {
            this.ensureHKConfig();
            this.world.plugins.hk.maxSoul = Math.max(33, Math.min(198, parseInt(e.target.value) || 99));
            e.target.value = this.world.plugins.hk.maxSoul;
            this.triggerMapChange();
        });
        
        document.getElementById('config-hk-monarchwing')?.addEventListener('change', (e) => {
            this.ensureHKConfig();
            this.world.plugins.hk.monarchWing = e.target.checked;
            document.getElementById('config-hk-monarchwing-amount-group').classList.toggle('hidden', !e.target.checked);
            this.triggerMapChange();
        });
        
        document.getElementById('config-hk-monarchwing-amount')?.addEventListener('change', (e) => {
            this.ensureHKConfig();
            this.world.plugins.hk.monarchWingAmount = Math.max(1, Math.min(99, parseInt(e.target.value) || 1));
            e.target.value = this.world.plugins.hk.monarchWingAmount;
            this.triggerMapChange();
        });
        
        document.getElementById('config-hk-dash')?.addEventListener('change', (e) => {
            this.ensureHKConfig();
            this.world.plugins.hk.dash = e.target.checked;
            this.refreshTouchControls();
            this.triggerMapChange();
        });
        
        document.getElementById('config-hk-superdash')?.addEventListener('change', (e) => {
            this.ensureHKConfig();
            this.world.plugins.hk.superDash = e.target.checked;
            this.triggerMapChange();
        });
        
        document.getElementById('config-hk-mantisclaw')?.addEventListener('change', (e) => {
            this.ensureHKConfig();
            this.world.plugins.hk.mantisClaw = e.target.checked;
            this.triggerMapChange();
        });
        
        // Edit Mechanics button (always available)
        document.getElementById('btn-edit-mechanics')?.addEventListener('click', () => {
            if (typeof CodeEditor !== 'undefined' && CodeEditor.open) {
                CodeEditor.open();
            } else {
                console.warn('Mechanics Editor not available');
            }
        });
    }
    
    ensureCodeConfig() {
        // Ensure Code config object exists with defaults
        if (!this.world.plugins.code) {
            this.world.plugins.code = {
                autoRespawn: true
            };
        }
    }
    
    openPluginsPopup() {
        this.updatePluginsPopupState();
        document.getElementById('plugins-popup').classList.add('active');
    }
    
    closePluginsPopup() {
        document.getElementById('plugins-popup').classList.remove('active');
    }
    
    updatePluginsPopupState() {
        const enabledPlugins = this.world.plugins.enabled;
        
        document.querySelectorAll('.plugin-toggle-btn').forEach(btn => {
            const pluginId = btn.dataset.plugin;
            const isEnabled = enabledPlugins.includes(pluginId);
            
            if (isEnabled) {
                btn.textContent = 'Remove';
                btn.style.background = '#dc3545';
                btn.style.borderColor = '#dc3545';
                btn.style.color = 'white';
            } else {
                btn.textContent = 'Add';
                btn.style.background = '#28a745';
                btn.style.borderColor = '#28a745';
                btn.style.color = 'white';
            }
        });
    }
    
    async togglePlugin(pluginId) {
        const isEnabled = this.world.plugins.enabled.includes(pluginId);
        
        if (isEnabled) {
            // Try to remove plugin
            // Check for dependencies first
            if (pluginId === 'hp' && this.world.plugins.enabled.includes('hk')) {
                this.showPluginError('Cannot remove HP plugin', 'The Hollow Knight plugin depends on HP. Remove Hollow Knight first.');
                return;
            }
            
            // Check for plugin objects in the map
            const pluginObjects = this.world.getPluginObjects(pluginId);
            if (pluginObjects.length > 0) {
                const locations = pluginObjects.map(o => `${o.section}/${o.name}`).join(', ');
                this.showPluginError('Cannot remove plugin', `There are still objects using this plugin at: ${locations}. Remove them first.`);
                return;
            }
            
            this.world.disablePlugin(pluginId);
        } else {
            // Enable plugin
            // Check dependencies
            if (pluginId === 'hk' && !this.world.plugins.enabled.includes('hp')) {
                // Auto-enable HP when enabling Hollow Knight
                await this.world.enablePlugin('hp');
            }
            
            await this.world.enablePlugin(pluginId);
            
            // When enabling HK plugin, apply default gravity and camera settings
            if (pluginId === 'hk') {
                this.ensureHKConfig();
                const hkGravity = this.world.plugins.hk.defaultGravity ?? 1.14;
                const hkCameraLerpX = this.world.plugins.hk.defaultCameraLerpX ?? 0.04;
                const hkCameraLerpY = this.world.plugins.hk.defaultCameraLerpY ?? 0.15;
                
                this.world.gravity = hkGravity;
                this.world.cameraLerpX = hkCameraLerpX;
                this.world.cameraLerpY = hkCameraLerpY;
                
                // Update UI
                const gravityInput = document.getElementById('config-gravity');
                if (gravityInput) gravityInput.value = this.world.gravity;
                
                const cameraLerpXInput = document.getElementById('config-camera-lerp-x');
                const cameraLerpXValue = document.getElementById('config-camera-lerp-x-value');
                if (cameraLerpXInput) cameraLerpXInput.value = this.world.cameraLerpX;
                if (cameraLerpXValue) cameraLerpXValue.textContent = this.world.cameraLerpX.toFixed(2);
                
                const cameraLerpYInput = document.getElementById('config-camera-lerp-y');
                const cameraLerpYValue = document.getElementById('config-camera-lerp-y-value');
                if (cameraLerpYInput) cameraLerpYInput.value = this.world.cameraLerpY;
                if (cameraLerpYValue) cameraLerpYValue.textContent = this.world.cameraLerpY.toFixed(2);
            }
        }
        
        this.updatePluginsPopupState();
        this.updatePluginConfigSections();
        this.updateKeyboardLayoutOptions();
        this.refreshTouchControls();
        this.updateTouchButtonVisibility();
        this.triggerMapChange();
    }
    
    showPluginError(title, message) {
        if (window.ModalManager?.alert) {
            window.ModalManager.alert(title, message);
        } else {
            alert(`${title}\n\n${message}`);
        }
    }
    
    updatePluginConfigSections() {
        const hpSection = document.getElementById('config-section-hp');
        const hkSection = document.getElementById('config-section-hk');
        
        if (hpSection) {
            hpSection.classList.toggle('hidden', !this.world.plugins.enabled.includes('hp'));
        }
        if (hkSection) {
            hkSection.classList.toggle('hidden', !this.world.plugins.enabled.includes('hk'));
        }
        // Code/Mechanics section is now always available (built into base game)
    }
    
    updateZoneButtonState() {
        // Zone is always available now (mechanics built into base game)
        const zoneBtn = document.querySelector('[data-appearance="zone"]');
        if (zoneBtn) {
            zoneBtn.disabled = false;
            zoneBtn.style.opacity = '1';
            zoneBtn.title = 'Zone';
        }
    }
    
    ensureHKConfig() {
        // Ensure HK config object exists with defaults
        if (!this.world.plugins.hk) {
            this.world.plugins.hk = {
                defaultGravity: 1.14,
                defaultCameraLerpX: 0.04,  // Very smooth horizontal
                defaultCameraLerpY: 0.15,  // Slightly above default vertical
                maxSoul: 99,
                monarchWing: false,
                monarchWingAmount: 1,
                dash: false,
                superDash: false,
                mantisClaw: false
            };
        }
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
            this.colorPickerState.value = 100 - (y / rect.height) * 100;
            
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

        // Auto-correct and apply hex input on change or enter
        const handleHexInput = () => {
            const corrected = this.autoCorrectHex(hexInput.value);
            hexInput.value = corrected;
            this.setColorPickerFromHex('#' + corrected);
            this.applyColorPickerColor('#' + corrected);
        };
        
        hexInput.addEventListener('change', handleHexInput);
        
        hexInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleHexInput();
                hexInput.blur();
            }
        });
    }
    
    // Auto-correct hex input
    // f → F, F → FFFFFF, FF0 → FFFF00, abc → AABBCC
    autoCorrectHex(input) {
        // Remove # if present and trim
        let hex = input.replace(/^#/, '').trim().toUpperCase();
        
        // Remove any non-hex characters
        hex = hex.replace(/[^0-9A-F]/gi, '');
        
        if (hex.length === 0) {
            return '000000';
        }
        
        if (hex.length === 1) {
            // Single char: F → FFFFFF
            return hex.repeat(6);
        }
        
        if (hex.length === 2) {
            // Two chars: FF → FFFFFF (repeat 3 times)
            return hex.repeat(3);
        }
        
        if (hex.length === 3) {
            // Three chars: RGB → RRGGBB (expand each)
            return hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        
        if (hex.length === 4) {
            // Four chars: take first 3 and expand
            return hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        
        if (hex.length === 5) {
            // Five chars: pad with last char
            return hex + hex[4];
        }
        
        // Six or more: take first 6
        return hex.substring(0, 6);
    }

    attachSettingsListeners() {
        const volumeRange = document.getElementById('settings-volume-range');
        const volumeNumber = document.getElementById('settings-volume-number');
        const fontsizeRange = document.getElementById('settings-fontsize-range');
        const fontsizeNumber = document.getElementById('settings-fontsize-number');
        const touchscreen = document.getElementById('settings-touchscreen');

        // Volume listeners
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

        // Font size listeners
        fontsizeRange.addEventListener('input', (e) => {
            fontsizeNumber.value = e.target.value;
            if (typeof Settings !== 'undefined') {
                Settings.set('fontSize', parseInt(e.target.value));
            }
        });

        fontsizeNumber.addEventListener('change', (e) => {
            const size = Math.max(50, Math.min(150, parseInt(e.target.value) || 100));
            fontsizeRange.value = size;
            fontsizeNumber.value = size;
            if (typeof Settings !== 'undefined') {
                Settings.set('fontSize', size);
            }
        });

        // Touchscreen listener
        touchscreen.addEventListener('change', (e) => {
            this.engine.touchscreenMode = e.target.checked;
            Settings.set('touchscreenMode', e.target.checked);
            this.updateTouchControls();
        });

        // Mobile detection helper
        const isMobileDevice = () => {
            // Check for touch capability
            const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            // Check user agent for mobile devices
            const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            // Check screen size (mobile typically < 1024px width)
            const smallScreen = window.innerWidth <= 1024;
            return hasTouch && (mobileUA || smallScreen);
        };
        
        // Load saved settings or auto-detect for mobile
        let savedTouchscreen = Settings.get('touchscreenMode');
        
        // Auto-enable touchscreen mode on mobile if not explicitly set
        if (savedTouchscreen === undefined || savedTouchscreen === null) {
            savedTouchscreen = isMobileDevice();
            Settings.set('touchscreenMode', savedTouchscreen);
        }
        
        touchscreen.checked = savedTouchscreen;
        this.engine.touchscreenMode = savedTouchscreen;
        
        // Initialize touch controls if enabled
        if (savedTouchscreen) {
            this.updateTouchControls();
        }

        const savedVolume = localStorage.getItem('parkoreen_volume');
        if (savedVolume !== null) {
            const vol = Math.round(parseFloat(savedVolume) * 100);
            volumeRange.value = vol;
            volumeNumber.value = vol;
        }
        
        // Load saved font size
        if (typeof Settings !== 'undefined') {
            const savedFontSize = Settings.get('fontSize') || 100;
            fontsizeRange.value = savedFontSize;
            fontsizeNumber.value = savedFontSize;
        }
        
        // How To Play button
        document.getElementById('settings-how-to-play').addEventListener('click', () => {
            if (typeof Navigation !== 'undefined') {
                Navigation.toHowToPlay();
            } else {
                window.location.href = '/parkoreen/howtoplay/';
            }
        });
        
        // Back to Dashboard button
        document.getElementById('settings-back-to-dashboard').addEventListener('click', () => {
            if (confirm('Are you sure you want to leave? Unsaved changes will be lost.')) {
                if (typeof Navigation !== 'undefined') {
                    Navigation.toDashboard();
                } else {
                    window.location.href = '/parkoreen/dashboard/';
                }
            }
        });
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
        document.getElementById('font-dropdown-value').style.fontFamily = `"${font}"`;
        document.getElementById('font-dropdown').classList.remove('active');
        
        // Update placement content textarea font
        const contentInput = document.getElementById('placement-content-input');
        if (contentInput) {
            contentInput.style.fontFamily = `"${font}"`;
        }
        
        // Update placement font preview
        this.updatePlacementFontPreview();
        
        // Add to recent fonts
        this.addRecentFont(font);
    }
    
    attachTextureDropdownListeners() {
        const trigger = document.getElementById('texture-dropdown-trigger');
        const dropdown = document.getElementById('texture-dropdown');
        const menu = document.getElementById('texture-dropdown-menu');

        if (!trigger || !dropdown || !menu) return;

        trigger.addEventListener('click', () => {
            dropdown.classList.toggle('active');
            if (dropdown.classList.contains('active')) {
                this.populateTextureDropdown();
            }
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    }
    
    populateTextureDropdown() {
        const menu = document.getElementById('texture-dropdown-menu');
        if (!menu) return;
        
        const currentColor = this.placementSettings.color || '#787878';
        
        let html = '<div class="texture-dropdown-grid">';
        
        for (const texture of BLOCK_TEXTURES) {
            const isSelected = this.placementSettings.texture === texture.id;
            
            let previewHtml = '';
            if (texture.id === 'solid') {
                previewHtml = `<div style="width: 100%; height: 100%; background: ${currentColor}; border-radius: 4px;"></div>`;
            } else if (texture.preview) {
                // Show the full texture preview image
                previewHtml = `<img src="${texture.preview}" alt="${texture.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;">`;
            }
            
            html += `
                <div class="texture-dropdown-item ${isSelected ? 'selected' : ''}" data-texture="${texture.id}">
                    <div class="texture-dropdown-item-preview">
                        ${previewHtml}
                    </div>
                    <span class="texture-dropdown-item-name">${texture.name}</span>
                </div>
            `;
        }
        
        html += '</div>';
        menu.innerHTML = html;
        
        // Attach event listeners
        menu.querySelectorAll('.texture-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectTexture(item.dataset.texture);
            });
        });
    }
    
    selectTexture(textureId) {
        this.placementSettings.texture = textureId;
        
        const texture = BLOCK_TEXTURES.find(t => t.id === textureId);
        if (texture) {
            document.getElementById('texture-dropdown-value').textContent = texture.name;
            
            // Update preview
            const preview = document.querySelector('#texture-dropdown-trigger .texture-preview');
            if (preview) {
                const currentColor = this.placementSettings.color || '#787878';
                if (texture.id === 'solid') {
                    preview.style.background = currentColor;
                    preview.innerHTML = '';
                } else if (texture.preview) {
                    // Show the brick preview image
                    preview.style.background = 'transparent';
                    preview.innerHTML = `<img src="${texture.preview}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 2px;">`;
                }
            }
        }
        
        document.getElementById('texture-dropdown').classList.remove('active');
    }
    
    updateTexturePreview() {
        const currentColor = this.placementSettings.color || '#787878';
        const currentTexture = this.placementSettings.texture || 'solid';
        
        const preview = document.querySelector('#texture-dropdown-trigger .texture-preview');
        if (preview) {
            const texture = BLOCK_TEXTURES.find(t => t.id === currentTexture);
            if (texture?.id === 'solid') {
                preview.style.background = currentColor;
                preview.innerHTML = '';
            } else if (texture?.preview) {
                // Show the brick preview image
                preview.style.background = 'transparent';
                preview.innerHTML = `<img src="${texture.preview}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 2px;">`;
            }
        }
    }
    
    populateObjectEditFontDropdown(currentFont) {
        const menu = document.getElementById('object-edit-font-menu');
        if (!menu) return;
        
        let html = `
            <div class="font-dropdown-search">
                <input type="text" class="form-input form-input-sm" id="object-edit-font-search" placeholder="Search fonts...">
            </div>
        `;

        // Recent fonts section
        if (this.recentFonts.length > 0) {
            html += `
                <div class="font-dropdown-section">
                    <div class="font-dropdown-section-title">Recently Used</div>
            `;
            for (const font of this.recentFonts) {
                const isSelected = font === currentFont ? 'font-selected' : '';
                html += `
                    <div class="font-dropdown-item ${isSelected}" data-font="${font}">
                        <span style="font-family: '${font}'">${font}</span>
                    </div>
                `;
            }
            html += `</div>`;
        }

        // Custom fonts section
        html += `
            <div class="font-dropdown-section">
                <div class="font-dropdown-section-title">Parkoreen Fonts</div>
        `;
        for (const font of CUSTOM_FONTS) {
            const isSelected = font === currentFont ? 'font-selected' : '';
            html += `
                <div class="font-dropdown-item ${isSelected}" data-font="${font}">
                    <span style="font-family: '${font}'">${font}</span>
                </div>
            `;
        }
        html += `</div>`;

        // Google fonts section
        const googleOnlyFonts = GOOGLE_FONTS.filter(f => !CUSTOM_FONTS.includes(f));
        html += `
            <div class="font-dropdown-section">
                <div class="font-dropdown-section-title">Google Fonts</div>
        `;
        for (const font of googleOnlyFonts) {
            const isSelected = font === currentFont ? 'font-selected' : '';
            html += `
                <div class="font-dropdown-item ${isSelected}" data-font="${font}">
                    <span style="font-family: '${font}'">${font}</span>
                </div>
            `;
        }
        html += `</div>`;

        menu.innerHTML = html;

        // Attach event listeners
        menu.querySelectorAll('.font-dropdown-item[data-font]').forEach(item => {
            item.addEventListener('click', (e) => {
                this.selectObjectEditFont(item.dataset.font);
            });
        });

        // Search functionality
        const searchInput = document.getElementById('object-edit-font-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                menu.querySelectorAll('.font-dropdown-item').forEach(item => {
                    const font = item.dataset.font.toLowerCase();
                    item.style.display = font.includes(query) ? '' : 'none';
                });
            });
        }
    }
    
    selectObjectEditFont(font) {
        if (!this.editingObject || this.editingObject.type !== 'text') return;
        
        this.editingObject.font = font;
        
        // Update UI
        const fontValue = document.getElementById('object-edit-font-value');
        fontValue.textContent = font;
        fontValue.style.fontFamily = `"${font}"`;
        
        document.getElementById('object-edit-content').style.fontFamily = `"${font}"`;
        document.getElementById('object-edit-font-dropdown').classList.remove('active');
        
        // Update preview
        this.updateObjectEditFontPreview();
        
        // Mark all items
        document.querySelectorAll('#object-edit-font-menu .font-dropdown-item').forEach(item => {
            item.classList.toggle('font-selected', item.dataset.font === font);
        });
        
        // Add to recent fonts
        this.addRecentFont(font);
        this.triggerMapChange();
    }
    
    updateObjectEditFontPreview() {
        if (!this.editingObject || this.editingObject.type !== 'text') return;
        
        const previewText = document.getElementById('object-edit-font-preview-text');
        if (!previewText) return;
        
        const content = document.getElementById('object-edit-content').value || 'Preview Text';
        const font = this.editingObject.font || 'Parkoreen Game';
        const color = this.editingObject.color || '#FFFFFF';
        
        previewText.textContent = content.split('\n')[0].substring(0, 30) || 'Preview Text';
        previewText.style.fontFamily = `"${font}"`;
        previewText.style.color = color;
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
        // Fly is a special mode that can be combined with other tools
        if (tool === EditorTool.FLY) {
            this.toggleFlyMode();
            return;
        }
        
        // Select tool enters selection mode
        if (tool === EditorTool.SELECT) {
            if (this.isSelectionActive) {
                this.exitSelectionMode();
            } else {
                this.enterSelectionMode();
            }
            return;
        }

        // If in placement mode, non-fly tools are disabled
        if (this.placementMode !== PlacementMode.NONE) {
            return;
        }
        
        // Exit selection mode if switching to another tool
        if (this.isSelectionActive) {
            this.exitSelectionMode();
        }

        const isToggleOff = (tool === this.currentTool);
        
        // Always clean up current tool state first
        if (this.currentTool === EditorTool.ERASE) {
            this.isErasing = false;
            this.hideEraseMode();
        }
        this.movingObject = null;
        this.rotatingObject = null;

        // Update non-fly button states
        this.ui.toolbar.querySelectorAll('.toolbar-btn[data-tool]').forEach(btn => {
            if (btn.dataset.tool !== 'fly') {
            btn.classList.remove('active');
            }
        });

        if (isToggleOff) {
            this.currentTool = EditorTool.NONE;
        } else {
            this.currentTool = tool;
            const btn = this.ui.toolbar.querySelector(`[data-tool="${tool}"]`);
            if (btn) btn.classList.add('active');

            if (tool === EditorTool.ERASE) {
                this.isErasing = true;
                this.showEraseMode();
            }
        }
    }
    
    showEraseMode() {
        // Show placement toolbar with erase options
        this.ui.placementToolbar.classList.add('active');
        
        // Hide all placement options
        this.ui.placementToolbar.querySelectorAll('.placement-option').forEach(opt => {
            if (!opt.closest('#erase-options')) {
                opt.style.display = 'none';
            }
        });
        
        // Show erase options
        if (this.ui.eraseOptions) {
            this.ui.eraseOptions.style.display = 'block';
        }
        
        // Change Add button to Close button
        const addBtnIcon = this.ui.btnAdd.querySelector('.material-symbols-outlined');
        if (addBtnIcon) {
            addBtnIcon.textContent = 'close';
        }
        this.ui.btnAdd.title = 'Stop Erasing (Q or Esc)';
        
        // Hide toolbar and layers button
        this.ui.toolbar.classList.add('hidden');
        this.ui.btnLayers.classList.add('hidden');
    }
    
    hideEraseMode() {
        // Hide erase options
        if (this.ui.eraseOptions) {
            this.ui.eraseOptions.style.display = 'none';
        }
        
        // Show all placement options again
        this.ui.placementToolbar.querySelectorAll('.placement-option').forEach(opt => {
            opt.style.display = '';
        });
        
        // Hide placement toolbar if not in placement mode
        if (this.placementMode === PlacementMode.NONE) {
            this.ui.placementToolbar.classList.remove('active');
        }
        
        // Restore Add button
        const addBtnIcon = this.ui.btnAdd.querySelector('.material-symbols-outlined');
        if (addBtnIcon) {
            addBtnIcon.textContent = 'add';
        }
        this.ui.btnAdd.title = 'Add';
        
        // Show toolbar and layers button
        this.ui.toolbar.classList.remove('hidden');
        this.ui.btnLayers.classList.remove('hidden');
    }
    
    toggleFlyMode() {
        this.isFlying = !this.isFlying;
        
        const flyBtn = this.ui.toolbar.querySelector('[data-tool="fly"]');
        if (flyBtn) {
            flyBtn.classList.toggle('active', this.isFlying);
        }
        
                if (this.engine.localPlayer) {
            this.engine.localPlayer.isFlying = this.isFlying;
            // Reset velocity when toggling fly mode
                    this.engine.localPlayer.vx = 0;
                    this.engine.localPlayer.vy = 0;
            
            if (!this.isFlying) {
                // Reset jumps so player can jump again when leaving fly mode
                this.engine.localPlayer.resetJumps();
            }
        }
    }
    
    disableNonFlyTools() {
        if (this.currentTool !== EditorTool.NONE && this.currentTool !== EditorTool.FLY) {
            if (this.currentTool === EditorTool.ERASE) {
                this.isErasing = false;
                this.hideEraseMode();
            }
            this.movingObject = null;
            this.rotatingObject = null;
            this.currentTool = EditorTool.NONE;
            
            this.ui.toolbar.querySelectorAll('.toolbar-btn[data-tool]').forEach(btn => {
                if (btn.dataset.tool !== 'fly') {
                    btn.classList.remove('active');
                }
            });
        }
    }

    handleToolbarAction(action) {
        // Get center point for zoom (player position if available)
        let centerX, centerY;
        if (this.engine.localPlayer) {
            centerX = this.engine.localPlayer.x + this.engine.localPlayer.width / 2;
            centerY = this.engine.localPlayer.y + this.engine.localPlayer.height / 2;
        } else {
            centerX = this.camera.x + this.camera.width / 2 / this.camera.zoom;
            centerY = this.camera.y + this.camera.height / 2 / this.camera.zoom;
        }
        
        switch (action) {
            case 'zoom-in':
                this.camera.zoomIn(centerX, centerY);
                break;
            case 'zoom-out':
                this.camera.zoomOut(centerX, centerY);
                break;
            case 'toggle-grid':
                this.toggleGrid();
                break;
            case 'toggle-invincibility':
                this.toggleInvincibility();
                break;
            case 'toggle-touchboxes':
                this.toggleTouchboxes();
                break;
            case 'respawn':
                this.respawnAtCheckpoint();
                break;
        }
    }
    
    toggleGrid() {
        this.showGrid = !this.showGrid;
        const gridBtn = this.ui.toolbar.querySelector('[data-action="toggle-grid"]');
        if (gridBtn) {
            gridBtn.classList.toggle('active', this.showGrid);
        }
    }

    toggleInvincibility() {
        this.invincibilityEnabled = !this.invincibilityEnabled;
        this.engine.invincibilityEnabled = this.invincibilityEnabled;
        GameEngine._invincible = this.invincibilityEnabled;
        const btn = this.ui.toolbar.querySelector('[data-action="toggle-invincibility"]');
        if (btn) btn.classList.toggle('active', this.invincibilityEnabled);
    }

    toggleTouchboxes() {
        this.showTouchboxes = !this.showTouchboxes;
        const btn = this.ui.toolbar.querySelector('[data-action="toggle-touchboxes"]');
        if (btn) btn.classList.toggle('active', this.showTouchboxes);
    }

    respawnAtCheckpoint() {
        if (this.engine.state !== GameState.TESTING || !this.engine.localPlayer) return;
        this.engine.respawnPlayer();
        this.engine.localPlayer.isFlying = this.isFlying;
        if (window.PluginManager) {
            if (!this.engine._respawnData) this.engine._respawnData = {};
            this.engine._respawnData.player = this.engine.localPlayer;
            this.engine._respawnData.world = this.engine.world;
            window.PluginManager.executeHook('player.respawn', this.engine._respawnData);
        }
    }

    rotateObjectUnderMouse(degrees) {
        const worldPos = this.engine.getMouseWorldPos();
        const obj = this.world.getObjectAt(worldPos.x, worldPos.y);
        if (obj) {
            obj.rotation = (obj.rotation + degrees + 360) % 360;
            this.triggerMapChange();
        }
    }

    // ========================================
    // MULTI-SELECTION SYSTEM
    // ========================================
    enterSelectionMode() {
        this.isSelectionActive = true;
        this.selectedObjects.clear();
        this.selectionMode = SelectionMode.QUOT;
        this.selectionAction = SelectionAction.SELECT;
        this.selectionRect = null;
        this.selectionMovingObjects = null;
        
        // Hide main toolbar, show selection toolbar
        this.ui.toolbar.classList.add('hidden');
        this.ui.selectionToolbar.classList.remove('hidden');
        
        // Replace Add button with Cancel button
        this.ui.btnAdd.querySelector('.material-symbols-outlined').textContent = 'close';
        this.ui.btnAdd.title = 'Exit Selection';
        this.ui.btnAdd.classList.add('sel-cancel-btn');
        
        // Close any open panels/menus
        this.ui.addMenu.classList.remove('active');
        if (this.placementMode !== PlacementMode.NONE) {
            this.stopPlacement();
        }
        
        this.updateSelectionCount();
        this.updateSelectionModeUI();
    }
    
    exitSelectionMode() {
        this.isSelectionActive = false;
        this.selectedObjects.clear();
        this.selectionRect = null;
        this.selectionMovingObjects = null;
        this.selectionMoveStart = null;
        
        // Restore toolbars
        this.ui.toolbar.classList.remove('hidden');
        this.ui.selectionToolbar.classList.add('hidden');
        this.ui.selectionMouseToolbar.classList.add('hidden');
        
        // Restore Add button
        this.ui.btnAdd.querySelector('.material-symbols-outlined').textContent = 'add';
        this.ui.btnAdd.title = 'Add';
        this.ui.btnAdd.classList.remove('sel-cancel-btn');
        
        // Restore tool
        this.setTool(EditorTool.NONE);
    }
    
    setSelectionMode(mode) {
        this.selectionMode = mode;
        this.selectionRect = null;
        this.selectionMovingObjects = null;
        this.selectionMoveStart = null;
        this.updateSelectionModeUI();
    }
    
    setSelectionAction(action) {
        this.selectionAction = action;
        // Update UI
        this.ui.selectionToolbar.querySelectorAll('[data-sel-action]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.selAction === action);
        });
    }
    
    updateSelectionModeUI() {
        // Update mode button active states
        this.ui.selectionToolbar.querySelectorAll('[data-sel-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.selMode === this.selectionMode);
        });
        
        // Show/hide mouse action toolbar
        if (this.selectionMode === SelectionMode.MOUSE) {
            this.ui.selectionMouseToolbar.classList.remove('hidden');
        } else {
            this.ui.selectionMouseToolbar.classList.add('hidden');
        }
    }
    
    updateSelectionCount() {
        const countEl = document.getElementById('sel-count');
        if (countEl) {
            countEl.textContent = `${this.selectedObjects.size} selected`;
        }
    }
    
    handleSelectionCommand(cmd) {
        switch (cmd) {
            case 'select-all':
                for (const obj of this.world.objects) {
                    this.selectedObjects.add(obj);
                }
                break;
            case 'deselect-all':
                this.selectedObjects.clear();
                break;
            case 'reverse': {
                const newSelection = new Set();
                for (const obj of this.world.objects) {
                    if (!this.selectedObjects.has(obj)) {
                        newSelection.add(obj);
                    }
                }
                this.selectedObjects = newSelection;
                break;
            }
            case 'done':
                this.exitSelectionMode();
                return;
        }
        this.updateSelectionCount();
    }
    
    handleSelectionMouseAction(action) {
        if (this.selectedObjects.size === 0) return;
        
        switch (action) {
            case 'move':
                this.showToast('Click and drag to move selected objects', 'info');
                break;
            case 'duplicate':
                this.duplicateSelectedObjects();
                break;
            case 'rotate-left':
                this.rotateSelectedObjects(-90);
                break;
            case 'rotate-right':
                this.rotateSelectedObjects(90);
                break;
            case 'rotate-180':
                this.rotateSelectedObjects(180);
                break;
        }
    }
    
    duplicateSelectedObjects() {
        if (this.selectedObjects.size === 0) return;
        
        const newSelection = new Set();
        for (const obj of this.selectedObjects) {
            const clone = obj.clone();
            clone.x += GRID_SIZE;
            clone.y += GRID_SIZE;
            this.world.addObject(clone);
            newSelection.add(clone);
        }
        this.selectedObjects = newSelection;
        this.updateSelectionCount();
        this.updateLayersList();
        this.triggerMapChange();
        this.showToast(`Duplicated ${newSelection.size} objects`, 'success');
    }
    
    rotateSelectedObjects(degrees) {
        for (const obj of this.selectedObjects) {
            obj.rotation = (obj.rotation + degrees + 360) % 360;
        }
        this.triggerMapChange();
    }
    
    // Handle Quot mode rectangle selection
    handleQuotSelectionDown(worldX, worldY) {
        const gridPos = this.engine.getGridAlignedPos(worldX, worldY);
        this.selectionRect = {
            startX: gridPos.x,
            startY: gridPos.y,
            endX: gridPos.x,
            endY: gridPos.y
        };
    }
    
    handleQuotSelectionMove(worldX, worldY) {
        if (!this.selectionRect) return;
        const gridPos = this.engine.getGridAlignedPos(worldX, worldY);
        this.selectionRect.endX = gridPos.x;
        this.selectionRect.endY = gridPos.y;
    }
    
    handleQuotSelectionUp() {
        if (!this.selectionRect) return;
        
        const { startX, startY, endX, endY } = this.selectionRect;
        const rectX = Math.min(startX, endX);
        const rectY = Math.min(startY, endY);
        const rectW = Math.abs(endX - startX) + GRID_SIZE;
        const rectH = Math.abs(endY - startY) + GRID_SIZE;
        
        const rect = { x: rectX, y: rectY, width: rectW, height: rectH };
        
        for (const obj of this.world.objects) {
            const objRect = { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
            if (this.rectsOverlap(rect, objRect)) {
                if (this.selectionAction === SelectionAction.SELECT) {
                    this.selectedObjects.add(obj);
                } else {
                    this.selectedObjects.delete(obj);
                }
            }
        }
        
        this.selectionRect = null;
        this.updateSelectionCount();
    }
    
    rectsOverlap(a, b) {
        return a.x < b.x + b.width && a.x + a.width > b.x &&
               a.y < b.y + b.height && a.y + a.height > b.y;
    }
    
    // Handle Multi-Select mode click
    handleMultiSelectClick(worldX, worldY) {
        const obj = this.world.getObjectAt(worldX, worldY);
        if (!obj) return;
        
        if (this.selectionAction === SelectionAction.SELECT) {
            this.selectedObjects.add(obj);
        } else {
            this.selectedObjects.delete(obj);
        }
        this.updateSelectionCount();
    }
    
    // Handle Mouse mode click (config or move)
    handleMouseModeDown(worldX, worldY) {
        const obj = this.world.getObjectAt(worldX, worldY);
        
        if (obj && this.selectedObjects.has(obj)) {
            // Start moving all selected objects
            const gridPos = this.engine.getGridAlignedPos(worldX, worldY);
            this.selectionMoveStart = { x: gridPos.x, y: gridPos.y };
            this.selectionMovingObjects = [];
            for (const selObj of this.selectedObjects) {
                this.selectionMovingObjects.push({
                    obj: selObj,
                    offsetX: selObj.x - gridPos.x,
                    offsetY: selObj.y - gridPos.y
                });
            }
        }
    }
    
    handleMouseModeMove(worldX, worldY) {
        if (!this.selectionMovingObjects) return;
        const gridPos = this.engine.getGridAlignedPos(worldX, worldY);
        for (const item of this.selectionMovingObjects) {
            item.obj.x = gridPos.x + item.offsetX;
            item.obj.y = gridPos.y + item.offsetY;
        }
        this.world._spatialDirty = true;
        this.world._editorMergedDirty = true;
    }
    
    handleMouseModeUp(worldX, worldY) {
        if (this.selectionMovingObjects) {
            // Check if we actually moved
            const gridPos = this.engine.getGridAlignedPos(worldX, worldY);
            const didMove = this.selectionMoveStart && 
                (gridPos.x !== this.selectionMoveStart.x || gridPos.y !== this.selectionMoveStart.y);
            
            if (!didMove) {
                // It was a click, not a drag — open config for selected objects
                const obj = this.world.getObjectAt(worldX, worldY);
                if (obj && this.selectedObjects.has(obj)) {
                    this.openMultiObjectEditPopup();
                }
            } else {
                // Snap all moved objects to grid
                for (const item of this.selectionMovingObjects) {
                    item.obj.snapToGrid();
                }
                this.triggerMapChange();
            }
            
            this.selectionMovingObjects = null;
            this.selectionMoveStart = null;
        }
    }
    
    // ========================================
    // MULTI-OBJECT CONFIG POPUP
    // ========================================
    openMultiObjectEditPopup() {
        const objects = Array.from(this.selectedObjects);
        if (objects.length === 0) return;
        
        if (objects.length === 1) {
            this.openObjectEditPopup(objects[0]);
            return;
        }
        
        // Build a popup for editing common properties
        let popup = document.getElementById('multi-object-edit-popup');
        if (popup) popup.remove();
        
        popup = document.createElement('div');
        popup.className = 'object-edit-popup modal-overlay';
        popup.id = 'multi-object-edit-popup';
        
        // Determine which fields are common across all selected objects
        const commonFields = this.getCommonEditFields(objects);
        
        // Track which fields the user has touched
        const touchedFields = new Set();
        
        let fieldsHTML = '';
        
        for (const field of commonFields) {
            fieldsHTML += this.renderMultiEditField(field, objects);
        }
        
        popup.innerHTML = `
            <div class="object-edit-panel">
                <div class="panel-header">
                    <span class="panel-title">Edit ${objects.length} Objects</span>
                    <button class="btn btn-icon btn-ghost" id="multi-edit-close">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="panel-body">
                    ${fieldsHTML}
                    <div class="form-group" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--surface-light);">
                        <button class="btn btn-danger" id="multi-edit-delete" style="width: 100%;">
                            <span class="material-symbols-outlined">delete</span>
                            Delete ${objects.length} Objects
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(popup);
        popup.classList.add('active');
        
        // Attach listeners
        document.getElementById('multi-edit-close').addEventListener('click', () => {
            popup.classList.remove('active');
            setTimeout(() => popup.remove(), 200);
        });
        
        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                popup.classList.remove('active');
                setTimeout(() => popup.remove(), 200);
            }
        });
        
        document.getElementById('multi-edit-delete').addEventListener('click', () => {
            for (const obj of objects) {
                this.world.removeObject(obj.id);
            }
            this.selectedObjects.clear();
            this.updateSelectionCount();
            this.updateLayersList();
            this.triggerMapChange();
            popup.classList.remove('active');
            setTimeout(() => popup.remove(), 200);
            this.showToast(`Deleted ${objects.length} objects`, 'success');
        });
        
        // Attach field-specific listeners
        this.attachMultiEditListeners(popup, objects, commonFields, touchedFields);
    }
    
    getCommonEditFields(objects) {
        const fields = [];
        
        // Name is always available
        fields.push({ key: 'name', label: 'Name', type: 'text' });
        
        // Color — available on all objects
        fields.push({ key: 'color', label: 'Color', type: 'color' });
        
        // Opacity — available on all objects
        fields.push({ key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 100, toValue: v => Math.round(v * 100), fromValue: v => v / 100 });
        
        // Rotation — available on all objects
        fields.push({ key: 'rotation', label: 'Rotation', type: 'rotation' });
        
        // Collision — available on all objects
        fields.push({ key: 'collision', label: 'Collision', type: 'boolean' });
        
        // Flip — available on non-zone objects
        const allNonZone = objects.every(o => o.appearanceType !== 'zone');
        if (allNonZone) {
            fields.push({ key: 'flipHorizontal', label: 'Flip Horizontal', type: 'boolean' });
        }
        
        // Spike touchbox — only if ALL objects are spikes (and not spinners)
        const allSpikesNotSpinner = objects.every(o => 
            (o.appearanceType === 'spike' || o.actingType === 'spike') && 
            o.type !== 'spinner' && o.appearanceType !== 'spinner'
        );
        if (allSpikesNotSpinner) {
            fields.push({ key: 'spikeTouchbox', label: 'Spike Touchbox', type: 'select', options: [
                { value: '', label: 'Use World Default' },
                { value: 'full', label: 'Full Spike' },
                { value: 'normal', label: 'Normal Spike' },
                { value: 'tip', label: 'Tip Spike' },
                { value: 'ground', label: 'Ground' },
                { value: 'flag', label: 'Flag' },
                { value: 'air', label: 'Air' }
            ]});
            fields.push({ key: 'dropHurtOnly', label: 'Drop Hurt Only', type: 'select', options: [
                { value: '', label: 'Use World Default' },
                { value: 'true', label: 'Enabled' },
                { value: 'false', label: 'Disabled' }
            ]});
        }
        
        // Damage amount — if ALL objects are spikes or spinners (anything that can deal damage)
        const allDamaging = objects.every(o =>
            o.appearanceType === 'spike' || o.actingType === 'spike' ||
            o.type === 'spinner' || o.appearanceType === 'spinner'
        );
        if (allDamaging) {
            fields.push({ key: 'damageAmount', label: 'Damage Amount', type: 'number', min: 0, step: 1, defaultValue: 1 });
        }

        // Button fields — only if ALL objects are buttons
        const allButtons = objects.every(o => o.appearanceType === 'button');
        if (allButtons) {
            fields.push({ key: 'displayName', label: 'Display Name', type: 'text' });
            fields.push({ key: 'displayDescription', label: 'Display Description', type: 'textarea' });
            fields.push({ key: 'buttonVisible', label: 'Button Visible', type: 'boolean' });
        }

        // Text content — only if ALL objects are text
        const allText = objects.every(o => o.type === 'text');
        if (allText) {
            fields.push({ key: 'content', label: 'Text Content', type: 'textarea' });
            fields.push({ key: 'font', label: 'Font', type: 'text' });
        }
        
        return fields;
    }
    
    getMultiFieldValue(objects, field) {
        const key = field.key;
        const toValue = field.toValue || (v => v);
        const normalize = v => (v === undefined || v === null) ? '' : v;
        
        let firstVal = toValue(objects[0][key]);
        let allSame = true;
        for (let i = 1; i < objects.length; i++) {
            if (normalize(toValue(objects[i][key])) !== normalize(firstVal)) {
                allSame = false;
                break;
            }
        }
        return { value: firstVal, isMixed: !allSame };
    }
    
    renderMultiEditField(field, objects) {
        const { value, isMixed } = this.getMultiFieldValue(objects, field);
        const mixedStr = isMixed ? 'MIXED' : '';
        
        switch (field.type) {
            case 'text':
                return `
                    <div class="form-group">
                        <label class="form-label">${field.label}</label>
                        <input type="text" class="form-input" data-multi-field="${field.key}" 
                            value="${isMixed ? '' : (value || '')}" placeholder="${isMixed ? 'MIXED' : ''}">
                    </div>`;
                    
            case 'textarea':
                return `
                    <div class="form-group">
                        <label class="form-label">${field.label}</label>
                        <textarea class="form-input" data-multi-field="${field.key}" rows="3" 
                            placeholder="${isMixed ? 'MIXED' : ''}" style="resize: vertical;">${isMixed ? '' : (value || '')}</textarea>
                    </div>`;
                    
            case 'color':
                return `
                    <div class="form-group">
                        <label class="form-label">${field.label}</label>
                        <div class="color-picker-option">
                            <div class="color-preview" data-multi-color-preview="${field.key}" 
                                style="background: ${isMixed ? 'linear-gradient(135deg, #ff6b6b 25%, #4ecdc4 25%, #4ecdc4 50%, #ff6b6b 50%, #ff6b6b 75%, #4ecdc4 75%)' : value}"></div>
                            <input type="text" class="form-input form-input-sm color-input" data-multi-field="${field.key}" 
                                value="${isMixed ? '' : value}" placeholder="${isMixed ? 'MIXED' : ''}">
                        </div>
                    </div>`;
                    
            case 'range': {
                const displayVal = isMixed ? 'MIXED' : `${value}%`;
                const rangeVal = isMixed ? field.min : value;
                return `
                    <div class="form-group">
                        <label class="form-label">${field.label}</label>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="range" class="form-range" data-multi-field="${field.key}" 
                                min="${field.min}" max="${field.max}" value="${rangeVal}" style="flex: 1;">
                            <span data-multi-range-label="${field.key}" style="font-size: 12px; min-width: 45px;">${displayVal}</span>
                        </div>
                    </div>`;
            }
            
            case 'rotation':
                return `
                    <div class="form-group">
                        <label class="form-label">${field.label}</label>
                        <div class="placement-option-btns" style="justify-content: flex-start;">
                            <button class="placement-opt-btn" data-multi-rotate="-90" title="Rotate Left">
                                <span class="material-symbols-outlined" style="font-size: 16px;">rotate_left</span>
                            </button>
                            <button class="placement-opt-btn" data-multi-rotate="90" title="Rotate Right">
                                <span class="material-symbols-outlined" style="font-size: 16px;">rotate_right</span>
                            </button>
                            <span data-multi-rotation-label style="font-size: 12px; margin-left: 8px;">${isMixed ? 'MIXED' : value + '°'}</span>
                        </div>
                    </div>`;
            
            case 'boolean': {
                const checked = isMixed ? false : !!value;
                return `
                    <div class="form-group" style="position: relative;">
                        <label class="form-label">${field.label}</label>
                        <label class="toggle" style="position: relative;">
                            <input type="checkbox" data-multi-field="${field.key}" ${checked ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                            ${isMixed ? `<div class="multi-mixed-overlay" data-multi-mixed="${field.key}">MIXED</div>` : ''}
                        </label>
                    </div>`;
            }
            
            case 'select': {
                const normalizeVal = v => v === undefined || v === null ? '' : String(v);
                const optionsHTML = field.options.map(o => 
                    `<option value="${o.value}" ${!isMixed && normalizeVal(value) === normalizeVal(o.value) ? 'selected' : ''}>${o.label}</option>`
                ).join('');
                return `
                    <div class="form-group" style="position: relative;">
                        <label class="form-label">${field.label}</label>
                        <select class="form-select" data-multi-field="${field.key}">
                            ${optionsHTML}
                        </select>
                        ${isMixed ? `<div class="multi-mixed-overlay multi-mixed-select" data-multi-mixed="${field.key}">MIXED</div>` : ''}
                    </div>`;
            }
            
            case 'number': {
                const numVal = isMixed ? '' : (value !== undefined ? value : (field.defaultValue ?? ''));
                return `
                    <div class="form-group">
                        <label class="form-label">${field.label}</label>
                        <input type="number" class="form-input form-input-sm" data-multi-field="${field.key}"
                            value="${numVal}" min="${field.min ?? ''}" step="${field.step ?? 1}"
                            placeholder="${isMixed ? 'MIXED' : ''}" style="width: 90px;">
                    </div>`;
            }

            default:
                return '';
        }
    }
    
    attachMultiEditListeners(popup, objects, fields, touchedFields) {
        // Text / textarea / color inputs
        popup.querySelectorAll('input[data-multi-field], textarea[data-multi-field]').forEach(input => {
            const key = input.dataset.multiField;
            const field = fields.find(f => f.key === key);
            if (!field) return;
            
            const handler = () => {
                touchedFields.add(key);
                let val = input.type === 'checkbox' ? input.checked : input.value;
                
                // Remove mixed overlay if present
                const mixedOverlay = popup.querySelector(`[data-multi-mixed="${key}"]`);
                if (mixedOverlay) mixedOverlay.remove();
                
                if (field.type === 'number') {
                    val = Math.max(field.min ?? -Infinity, parseInt(val) || (field.defaultValue ?? 0));
                    input.value = val;
                }

                if (field.type === 'range') {
                    const fromValue = field.fromValue || (v => v);
                    const rangeLabel = popup.querySelector(`[data-multi-range-label="${key}"]`);
                    if (rangeLabel) rangeLabel.textContent = val + '%';
                    val = fromValue(parseFloat(val));
                }
                
                if (field.type === 'color') {
                    const preview = popup.querySelector(`[data-multi-color-preview="${key}"]`);
                    if (preview) preview.style.background = val;
                }
                
                for (const obj of objects) {
                    obj[key] = val;
                }
                this.triggerMapChange();
            };
            
            if (input.type === 'range') {
                input.addEventListener('input', handler);
            } else if (input.type === 'checkbox') {
                input.addEventListener('change', handler);
            } else {
                input.addEventListener('change', handler);
            }
        });
        
        // Select fields
        popup.querySelectorAll('select[data-multi-field]').forEach(select => {
            const key = select.dataset.multiField;
            select.addEventListener('change', () => {
                touchedFields.add(key);
                const mixedOverlay = popup.querySelector(`[data-multi-mixed="${key}"]`);
                if (mixedOverlay) mixedOverlay.remove();
                
                let val = select.value;
                if (val === 'true') val = true;
                else if (val === 'false') val = false;
                else if (val === '') val = undefined;
                
                for (const obj of objects) {
                    obj[key] = val;
                }
                this.triggerMapChange();
            });
        });
        
        // Mixed overlays — clicking removes them and marks field as touched
        popup.querySelectorAll('[data-multi-mixed]').forEach(overlay => {
            overlay.addEventListener('click', () => {
                const key = overlay.dataset.multiMixed;
                touchedFields.add(key);
                overlay.remove();
            });
        });
        
        // Rotation buttons
        popup.querySelectorAll('[data-multi-rotate]').forEach(btn => {
            btn.addEventListener('click', () => {
                touchedFields.add('rotation');
                const deg = parseInt(btn.dataset.multiRotate);
                for (const obj of objects) {
                    obj.rotation = (obj.rotation + deg + 360) % 360;
                }
                // Update label
                const label = popup.querySelector('[data-multi-rotation-label]');
                if (label) {
                    const { value: newVal, isMixed: newMixed } = this.getMultiFieldValue(objects, { key: 'rotation' });
                    label.textContent = newMixed ? 'MIXED' : newVal + '°';
                }
                this.triggerMapChange();
            });
        });
        
        // Color preview click to open color picker
        popup.querySelectorAll('[data-multi-color-preview]').forEach(preview => {
            preview.addEventListener('click', () => {
                const key = preview.dataset.multiColorPreview;
                const input = popup.querySelector(`input[data-multi-field="${key}"]`);
                if (input) {
                    // Create a temporary color input
                    const colorPicker = document.createElement('input');
                    colorPicker.type = 'color';
                    colorPicker.value = input.value || '#787878';
                    colorPicker.style.position = 'fixed';
                    colorPicker.style.opacity = '0';
                    document.body.appendChild(colorPicker);
                    colorPicker.click();
                    colorPicker.addEventListener('input', () => {
                        input.value = colorPicker.value;
                        preview.style.background = colorPicker.value;
                        for (const obj of objects) {
                            obj[key] = colorPicker.value;
                        }
                        this.triggerMapChange();
                    });
                    colorPicker.addEventListener('change', () => {
                        setTimeout(() => colorPicker.remove(), 100);
                    });
                }
            });
        });
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

        // Close all panels and add menu
        Object.values(panels).forEach(p => p.classList.remove('active'));
        this.ui.addMenu.classList.remove('active');

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
        const isActive = this.ui.addMenu.classList.contains('active');
        
        // Close all panels
        this.ui.configPanel.classList.remove('active');
        this.ui.layersPanel.classList.remove('active');
        this.ui.settingsPanel.classList.remove('active');
        
        // Toggle add menu
        if (!isActive) {
            this.ui.addMenu.classList.add('active');
        } else {
            this.ui.addMenu.classList.remove('active');
        }
    }

    closeAddMenu() {
        this.ui.addMenu.classList.remove('active');
    }

    // ========================================
    // PLACEMENT MODE
    // ========================================
    startPlacement(mode) {
        this.closeAddMenu();

        // Obstacle mode for spike and saw blade
        if (mode === 'obstacle') {
            this.placementMode = PlacementMode.OBSTACLE;
            // Default to spike appearance
            if (!this.obstacleSettings.appearanceType) {
                this.obstacleSettings.appearanceType = 'spike';
            }
        } else {
        this.placementMode = mode;
            // Reset block to ground if coming from obstacle mode
            if (mode === 'block') {
                this.placementSettings.appearanceType = 'ground';
                this.placementSettings.actingType = 'ground';
            }
        }

        // Disable non-fly tools when entering placement mode
        this.disableNonFlyTools();
        
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
            texture: document.getElementById('placement-texture'),
            appearance: document.getElementById('placement-appearance'),
            acting: document.getElementById('placement-acting'),
            collision: document.getElementById('placement-collision'),
            fill: document.getElementById('placement-fill'),
            color: document.getElementById('placement-color'),
            opacity: document.getElementById('placement-opacity'),
            content: document.getElementById('placement-content'),
            font: document.getElementById('placement-font'),
            fontSize: document.getElementById('placement-fontsize'),
            fontPreview: document.getElementById('placement-font-preview'),
            halign: document.getElementById('placement-halign'),
            valign: document.getElementById('placement-valign'),
            hspacing: document.getElementById('placement-hspacing'),
            vspacing: document.getElementById('placement-vspacing')
        };

        // Hide all first
        Object.values(options).forEach(el => el && el.classList.add('hidden'));

        if (this.placementMode === PlacementMode.BLOCK) {
            options.texture.classList.remove('hidden'); // Show texture dropdown
            options.acting.classList.remove('hidden');
            options.collision.classList.remove('hidden');
            options.fill.classList.remove('hidden');
            options.color.classList.remove('hidden');
            options.opacity.classList.remove('hidden');

            // Check if HK plugin is enabled for Soul Status option
            const hkEnabledForBlock = this.world.plugins.enabled.includes('hk');

            // Update texture preview
            this.updateTexturePreview();

            // Update acting type buttons for block
            const actingBtns = options.acting.querySelector('.placement-option-btns');
            let blockActingHtml = `
                <button class="placement-opt-btn ${this.placementSettings.actingType === 'ground' ? 'active' : ''}" data-acting="ground">Ground</button>
                <button class="placement-opt-btn ${this.placementSettings.actingType === 'spike' ? 'active' : ''}" data-acting="spike">Spike</button>
                <button class="placement-opt-btn ${this.placementSettings.actingType === 'checkpoint' ? 'active' : ''}" data-acting="checkpoint">Check</button>
                <button class="placement-opt-btn ${this.placementSettings.actingType === 'spawnpoint' ? 'active' : ''}" data-acting="spawnpoint">Spawn</button>
                <button class="placement-opt-btn ${this.placementSettings.actingType === 'endpoint' ? 'active' : ''}" data-acting="endpoint">End</button>
            `;
            if (hkEnabledForBlock) {
                blockActingHtml += `
                <button class="placement-opt-btn ${this.placementSettings.actingType === 'soulStatus' ? 'active' : ''}" data-acting="soulStatus">Soul</button>
                `;
            }
            actingBtns.innerHTML = blockActingHtml;
            this.reattachActingListeners();
            
            // Update collision buttons
            document.querySelectorAll('[data-collision]').forEach(btn => {
                btn.classList.toggle('active', (btn.dataset.collision === 'true') === this.placementSettings.collision);
            });
        } else if (this.placementMode === PlacementMode.OBSTACLE) {
            // Obstacle mode - appearance selection (spike or saw blade)
            options.appearance.classList.remove('hidden');
            options.acting.classList.remove('hidden');
            options.color.classList.remove('hidden');
            options.opacity.classList.remove('hidden');
            
            // Show fill and collision options only for spike appearance
            if (this.obstacleSettings.appearanceType === 'spike') {
                options.fill.classList.remove('hidden');
                options.collision.classList.remove('hidden');
            }

            // Check if HK plugin is enabled for Soul Statue option
            const hkEnabledForObstacle = this.world.plugins.enabled.includes('hk');

            // Update appearance buttons for obstacle
            const appearanceBtnsObstacle = options.appearance.querySelector('.placement-option-btns');
            appearanceBtnsObstacle.innerHTML = `
                <button class="placement-opt-btn ${this.obstacleSettings.appearanceType === 'spike' ? 'active' : ''}" data-appearance="spike">Spike</button>
                <button class="placement-opt-btn ${this.obstacleSettings.appearanceType === 'spinner' ? 'active' : ''}" data-appearance="spinner">Saw Blade</button>
            `;
            this.reattachAppearanceListeners();

            // Update acting type buttons for obstacle
            const actingBtnsObstacle = options.acting.querySelector('.placement-option-btns');
            let obstacleActingHtml = `
                <button class="placement-opt-btn ${this.obstacleSettings.actingType === 'spike' ? 'active' : ''}" data-acting="spike">Spike</button>
                <button class="placement-opt-btn ${this.obstacleSettings.actingType === 'ground' ? 'active' : ''}" data-acting="ground">Ground</button>
                <button class="placement-opt-btn ${this.obstacleSettings.actingType === 'portal' ? 'active' : ''}" data-acting="portal">Portal</button>
            `;
            if (hkEnabledForObstacle) {
                obstacleActingHtml += `<button class="placement-opt-btn ${this.obstacleSettings.actingType === 'soulStatue' ? 'active' : ''}" data-acting="soulStatue">Soul</button>`;
            }
            actingBtnsObstacle.innerHTML = obstacleActingHtml;
            this.reattachActingListeners();

            // Update collision buttons
            document.querySelectorAll('[data-collision]').forEach(btn => {
                btn.classList.toggle('active', (btn.dataset.collision === 'true') === this.obstacleSettings.collision);
            });

            // Sync color picker with obstacle settings
            const obstacleColor = this.obstacleSettings.color || '#ff4444';
            document.getElementById('placement-color-preview').style.background = obstacleColor;
            document.getElementById('placement-color-input').value = obstacleColor;

            // Sync opacity
            const obstacleOpacity = Math.round((this.obstacleSettings.opacity || 1) * 100);
            document.getElementById('placement-opacity-input').value = obstacleOpacity;
        } else if (this.placementMode === PlacementMode.KOREEN) {
            options.appearance.classList.remove('hidden');
            options.acting.classList.remove('hidden');
            options.fill.classList.remove('hidden');
            options.opacity.classList.remove('hidden');

            // Check if HK plugin is enabled for Soul Statue option
            const hkEnabled = this.world.plugins.enabled.includes('hk');

            // Update appearance for koreen
            const appearanceBtns = options.appearance.querySelector('.placement-option-btns');
            let koreenAppearanceHtml = `
                <button class="placement-opt-btn ${this.koreenSettings.appearanceType === 'checkpoint' ? 'active' : ''}" data-appearance="checkpoint">Checkpoint</button>
                <button class="placement-opt-btn ${this.koreenSettings.appearanceType === 'spawnpoint' ? 'active' : ''}" data-appearance="spawnpoint">Spawnpoint</button>
                <button class="placement-opt-btn ${this.koreenSettings.appearanceType === 'endpoint' ? 'active' : ''}" data-appearance="endpoint">Endpoint</button>
                <button class="placement-opt-btn ${this.koreenSettings.appearanceType === 'zone' ? 'active' : ''}" data-appearance="zone">Zone</button>
            `;
            if (hkEnabled) {
                koreenAppearanceHtml += `
                <button class="placement-opt-btn ${this.koreenSettings.appearanceType === 'soulStatue' ? 'active' : ''}" data-appearance="soulStatue">Soul Statue</button>
                `;
            }
            appearanceBtns.innerHTML = koreenAppearanceHtml;
            this.reattachAppearanceListeners();

            // Update acting type buttons for koreen (zone-only if appearance is zone, soulStatus if appearance is soulStatue)
            const actingBtns = options.acting.querySelector('.placement-option-btns');
            if (this.koreenSettings.appearanceType === 'zone') {
            actingBtns.innerHTML = `
                    <button class="placement-opt-btn active" data-acting="zone">Zone</button>
                `;
                this.koreenSettings.actingType = 'zone';
            } else if (this.koreenSettings.appearanceType === 'soulStatue') {
                actingBtns.innerHTML = `
                    <button class="placement-opt-btn active" data-acting="soulStatus">Soul Statue</button>
                `;
                this.koreenSettings.actingType = 'soulStatus';
            } else {
                let koreenActingHtml = `
                <button class="placement-opt-btn ${this.koreenSettings.actingType === 'checkpoint' ? 'active' : ''}" data-acting="checkpoint">Check</button>
                <button class="placement-opt-btn ${this.koreenSettings.actingType === 'spawnpoint' ? 'active' : ''}" data-acting="spawnpoint">Spawn</button>
                <button class="placement-opt-btn ${this.koreenSettings.actingType === 'endpoint' ? 'active' : ''}" data-acting="endpoint">End</button>
                <button class="placement-opt-btn ${this.koreenSettings.actingType === 'text' ? 'active' : ''}" data-acting="text">Text</button>
            `;
                if (hkEnabled) {
                    koreenActingHtml += `
                <button class="placement-opt-btn ${this.koreenSettings.actingType === 'soulStatus' ? 'active' : ''}" data-acting="soulStatus">Soul</button>
                    `;
                }
                actingBtns.innerHTML = koreenActingHtml;
            }
            this.reattachActingListeners();
        } else if (this.placementMode === PlacementMode.TEXT) {
            options.content.classList.remove('hidden');
            options.acting.classList.remove('hidden');
            options.font.classList.remove('hidden');
            options.fontSize.classList.remove('hidden');
            options.fontPreview.classList.remove('hidden');
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
            
            // Update content input (textarea) with font
            const contentInput = document.getElementById('placement-content-input');
            if (contentInput) {
                contentInput.value = this.textSettings.content || '';
                contentInput.style.fontFamily = `"${this.textSettings.font || 'Parkoreen Game'}"`;
            }
            
            // Update font dropdown value
            const fontValue = document.getElementById('font-dropdown-value');
            if (fontValue) {
                fontValue.textContent = this.textSettings.font || 'Parkoreen Game';
                fontValue.style.fontFamily = `"${this.textSettings.font || 'Parkoreen Game'}"`;
            }
            
            // Update font size input
            const fontSizeInput = document.getElementById('placement-fontsize-input');
            if (fontSizeInput) {
                fontSizeInput.value = this.textSettings.fontSize || 24;
            }
            
            // Update font preview
            this.updatePlacementFontPreview();
            
            // Update color picker
            const colorInput = document.querySelector('#placement-color input[type="color"]');
            if (colorInput) {
                colorInput.value = this.textSettings.color || '#000000';
            }
        } else if (this.placementMode === PlacementMode.TELEPORTAL) {
            // Teleportal options - acting type, color, and opacity
            options.acting.classList.remove('hidden');
            options.color.classList.remove('hidden');
            options.opacity.classList.remove('hidden');
            
            // Update acting type buttons for teleportal
            const actingBtns = options.acting.querySelector('.placement-option-btns');
            actingBtns.innerHTML = `
                <button class="placement-opt-btn ${this.teleportalSettings.actingType === 'portal' ? 'active' : ''}" data-acting="portal">Portal</button>
                <button class="placement-opt-btn ${this.teleportalSettings.actingType === 'ground' ? 'active' : ''}" data-acting="ground">Ground</button>
                <button class="placement-opt-btn ${this.teleportalSettings.actingType === 'spike' ? 'active' : ''}" data-acting="spike">Spike</button>
                <button class="placement-opt-btn ${this.teleportalSettings.actingType === 'checkpoint' ? 'active' : ''}" data-acting="checkpoint">Check</button>
                <button class="placement-opt-btn ${this.teleportalSettings.actingType === 'spawnpoint' ? 'active' : ''}" data-acting="spawnpoint">Spawn</button>
                <button class="placement-opt-btn ${this.teleportalSettings.actingType === 'endpoint' ? 'active' : ''}" data-acting="endpoint">End</button>
                <button class="placement-opt-btn ${this.teleportalSettings.actingType === 'text' ? 'active' : ''}" data-acting="text">Text</button>
            `;
            this.reattachActingListeners();
            
            // Sync color picker with teleportal settings
            const teleportalColor = this.teleportalSettings.color || '#9C27B0';
            document.getElementById('placement-color-preview').style.background = teleportalColor;
            document.getElementById('placement-color-input').value = teleportalColor;
            
            // Sync opacity
            const teleportalOpacity = Math.round((this.teleportalSettings.opacity || 1) * 100);
            document.getElementById('placement-opacity-input').value = teleportalOpacity;
        } else if (this.placementMode === PlacementMode.BUTTON) {
            // Button mode - only opacity, drag-to-place like zones
            options.opacity.classList.remove('hidden');
            
            const opacity = Math.round((this.koreenSettings.opacity || 1) * 100);
            document.getElementById('placement-opacity-input').value = opacity;
        }
    }

    updatePlacementFontPreview() {
        const previewText = document.getElementById('font-preview-text');
        if (!previewText) return;
        
        const content = this.textSettings.content || 'Text';
        const font = this.textSettings.font || 'Parkoreen Game';
        const color = this.textSettings.color || '#FFFFFF';
        const fontSize = this.textSettings.fontSize || 24;
        // Scale preview font size - cap at 32px for the preview box
        const previewFontSize = Math.min(fontSize, 32);
        
        previewText.textContent = content.split('\n')[0].substring(0, 30) || 'Text';
        previewText.style.fontFamily = `"${font}"`;
        previewText.style.color = color;
        previewText.style.fontSize = `${previewFontSize}px`;
    }

    reattachAppearanceListeners() {
        const container = document.querySelector('#placement-appearance .placement-option-btns');
        if (!container) return;
        
        // Clone and replace to remove all event listeners
        const newContainer = container.cloneNode(true);
        container.parentNode.replaceChild(newContainer, container);
        
        newContainer.querySelectorAll('[data-appearance]').forEach(btn => {
            btn.addEventListener('click', () => {
                // Zones are always available (mechanics are built-in)
                newContainer.querySelectorAll('[data-appearance]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (this.placementMode === PlacementMode.BLOCK) {
                    this.placementSettings.appearanceType = btn.dataset.appearance;
                    // Sync acting type with appearance type for blocks
                    this.placementSettings.actingType = btn.dataset.appearance;
                    this.syncActingTypeUI(btn.dataset.appearance);
                } else if (this.placementMode === PlacementMode.OBSTACLE) {
                    this.obstacleSettings.appearanceType = btn.dataset.appearance;
                    // Refresh placement options to update UI based on new appearance
                    this.updatePlacementOptions();
                } else if (this.placementMode === PlacementMode.KOREEN) {
                    this.koreenSettings.appearanceType = btn.dataset.appearance;
                    
                    // Rebuild acting type buttons based on appearance (zone vs non-zone vs soulStatue)
                    const actingBtns = document.querySelector('#placement-acting .placement-option-btns');
                    const hkEnabled = this.world.plugins.enabled.includes('hk');
                    
                    if (btn.dataset.appearance === 'zone') {
                        actingBtns.innerHTML = `
                            <button class="placement-opt-btn active" data-acting="zone">Zone</button>
                        `;
                        this.koreenSettings.actingType = 'zone';
                    } else if (btn.dataset.appearance === 'soulStatue') {
                        actingBtns.innerHTML = `
                            <button class="placement-opt-btn active" data-acting="soulStatus">Soul Statue</button>
                        `;
                        this.koreenSettings.actingType = 'soulStatus';
                    } else {
                    // Sync acting type with appearance type for koreens
                    this.koreenSettings.actingType = btn.dataset.appearance;
                        let koreenActingHtml = `
                            <button class="placement-opt-btn ${this.koreenSettings.actingType === 'checkpoint' ? 'active' : ''}" data-acting="checkpoint">Check</button>
                            <button class="placement-opt-btn ${this.koreenSettings.actingType === 'spawnpoint' ? 'active' : ''}" data-acting="spawnpoint">Spawn</button>
                            <button class="placement-opt-btn ${this.koreenSettings.actingType === 'endpoint' ? 'active' : ''}" data-acting="endpoint">End</button>
                            <button class="placement-opt-btn ${this.koreenSettings.actingType === 'text' ? 'active' : ''}" data-acting="text">Text</button>
                        `;
                        if (hkEnabled) {
                            koreenActingHtml += `
                            <button class="placement-opt-btn ${this.koreenSettings.actingType === 'soulStatus' ? 'active' : ''}" data-acting="soulStatus">Soul</button>
                            `;
                        }
                        actingBtns.innerHTML = koreenActingHtml;
                    }
                    this.reattachActingListeners();
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
                } else if (this.placementMode === PlacementMode.OBSTACLE) {
                    this.obstacleSettings.actingType = btn.dataset.acting;
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
                color = this.world.defaultBlockColor;
            this.placementSettings.color = color;
        } else if (this.placementMode === PlacementMode.OBSTACLE) {
            color = this.world.defaultSpikeColor;
            this.obstacleSettings.color = color;
        } else if (this.placementMode === PlacementMode.TEXT) {
            color = this.world.defaultTextColor;
            this.textSettings.color = color;
        } else {
            return;
        }
        
        document.getElementById('placement-color-preview').style.background = color;
        document.getElementById('placement-color-input').value = color;
        
        // Update texture preview with new color
        if (this.placementMode === PlacementMode.BLOCK) {
            this.updateTexturePreview();
        }
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
    
    // Check if two objects overlap
    objectsOverlap(a, b) {
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    }
    
    // Group overlapping objects together
    getOverlapGroups() {
        const objects = [...this.world.objects];
        const groups = [];
        const assigned = new Set();
        
        for (let i = 0; i < objects.length; i++) {
            if (assigned.has(i)) continue;
            
            const group = [i];
            assigned.add(i);
            
            // Find all objects that overlap with any object in the current group
            let changed = true;
            while (changed) {
                changed = false;
                for (let j = 0; j < objects.length; j++) {
                    if (assigned.has(j)) continue;
                    
                    // Check if this object overlaps with any object in the group
                    for (const idx of group) {
                        if (this.objectsOverlap(objects[idx], objects[j])) {
                            group.push(j);
                            assigned.add(j);
                            changed = true;
                            break;
                        }
                    }
                }
            }
            
            groups.push(group);
        }
        
        return groups;
    }
    
    updateLayersList() {
        const list = this.ui.layersList;
        list.innerHTML = '';

        // Get overlap groups
        const groups = this.getOverlapGroups();
        
        // Flatten groups in display order (reverse for top-to-bottom)
        let colorIndex = 0;
        
        for (let g = groups.length - 1; g >= 0; g--) {
            const group = groups[g];
            const groupColor = colorIndex % 2 === 0 ? 'layer-color-light' : 'layer-color-dark';
            colorIndex++;
            
            // Sort group by array index (reverse for display)
            const sortedGroup = [...group].sort((a, b) => b - a);
            
            for (const idx of sortedGroup) {
                const obj = this.world.objects[idx];
            const item = document.createElement('div');
                item.className = `layer-item ${groupColor}`;
            item.dataset.id = obj.id;
                item.dataset.groupIndex = g.toString();
            item.draggable = true;
            
                // Show group indicator for multi-object groups
                const groupIndicator = group.length > 1 ? 
                    `<span class="layer-group-indicator" title="Overlapping with ${group.length - 1} other object(s)">●</span>` : '';
                
                // Create preview element based on object type
                const opacityText = Math.round(obj.opacity * 100) + '%';
                let previewStyle = `background: ${obj.color}; width: 24px; height: 24px; border-radius: 4px; position: relative; flex-shrink: 0;`;
                let previewContent = '';
                
                if (obj.appearanceType === 'spike') {
                    // Triangle for spikes
                    previewStyle = `width: 24px; height: 24px; position: relative; flex-shrink: 0;`;
                    previewContent = `<div style="width: 0; height: 0; border-left: 12px solid transparent; border-right: 12px solid transparent; border-bottom: 20px solid ${obj.color};"></div>`;
                } else if (obj.appearanceType === 'checkpoint') {
                    previewStyle = `width: 24px; height: 24px; position: relative; flex-shrink: 0; display: flex; align-items: center; justify-content: center;`;
                    previewContent = `<span class="material-symbols-outlined" style="font-size: 20px; color: ${obj.color};">flag</span>`;
                } else if (obj.appearanceType === 'spawnpoint') {
                    previewStyle = `width: 24px; height: 24px; position: relative; flex-shrink: 0; display: flex; align-items: center; justify-content: center;`;
                    previewContent = `<span class="material-symbols-outlined" style="font-size: 20px; color: #4CAF50;">person_pin_circle</span>`;
                } else if (obj.appearanceType === 'endpoint') {
                    previewStyle = `width: 24px; height: 24px; position: relative; flex-shrink: 0; display: flex; align-items: center; justify-content: center;`;
                    previewContent = `<span class="material-symbols-outlined" style="font-size: 20px; color: #FFD700;">star</span>`;
                } else if (obj.appearanceType === 'zone') {
                    previewStyle = `width: 24px; height: 24px; position: relative; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border: 2px dashed rgba(255, 255, 255, 1); background: rgba(255, 255, 255, 0.3); border-radius: 4px;`;
                    previewContent = `<span class="material-symbols-outlined" style="font-size: 14px; color: rgba(255, 255, 255, 1);">select_all</span>`;
                } else if (obj.type === 'text') {
                    previewStyle = `width: 24px; height: 24px; position: relative; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-weight: bold; color: ${obj.color}; font-size: 14px;`;
                    previewContent = 'T';
                } else {
                    // Block/ground - square
                    previewContent = '';
                }
                
                // Opacity label overlay
                const opacityLabel = obj.opacity < 1 ? 
                    `<span class="layer-opacity-label">${opacityText}</span>` : '';
            
            item.innerHTML = `
                <span class="material-symbols-outlined" style="cursor: grab; color: var(--text-muted);">drag_indicator</span>
                    ${groupIndicator}
                    <div class="layer-item-preview" style="${previewStyle}">${previewContent}${opacityLabel}</div>
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
                    e.dataTransfer.setData('text/plain', idx.toString());
                    e.dataTransfer.setData('groupIndex', g.toString());
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
                    const fromGroup = parseInt(e.dataTransfer.getData('groupIndex'));
                    const toGroup = parseInt(item.dataset.groupIndex);
                    
                    // Only allow reordering within the same group or to adjacent positions
                    // For simplicity, allow any reorder but keep overlapping objects together
                    const toIndex = idx;
                    
                    if (fromIndex !== toIndex) {
                        this.world.reorderLayers(fromIndex, toIndex);
                this.updateLayersList();
                this.triggerMapChange();
                    }
                });
                
                // Hover to highlight object in editor
                item.addEventListener('mouseenter', () => {
                    this.highlightedLayerObject = obj;
                });
                
                item.addEventListener('mouseleave', () => {
                    if (this.highlightedLayerObject === obj) {
                        this.highlightedLayerObject = null;
                    }
                });
                
                // Click on name to open edit popup
                item.querySelector('.layer-item-name').addEventListener('click', () => {
                    this.openObjectEditPopup(obj);
                });
                
                // Double-click on preview to open edit popup
                item.querySelector('.layer-item-preview').addEventListener('dblclick', () => {
                    this.openObjectEditPopup(obj);
            });

            list.appendChild(item);
            }
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
        } else if (target === 'object-edit') {
            currentColor = this.editingObject ? this.editingObject.color : '#787878';
        } else if (target.startsWith('config-')) {
            const type = target.replace('config-', '');
            currentColor = document.getElementById(`config-${type}-color`).value;
        }
        
        // Set initial state from color
        this.setColorPickerFromHex(currentColor);
    }
    
    showColorPicker(target) {
        // Alias for openColorPicker
        this.openColorPicker(target);
    }

    closeColorPicker() {
        this.ui.colorPickerPopup.classList.remove('active');
        this.colorPickerState.target = null;
    }

    setColorPickerFromHex(hex) {
        // Convert hex to HSV (not HSL - the gradient is HSV style)
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
            const d = max - min;
        
        let h = 0;
        if (d !== 0) {
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        
        const s = max === 0 ? 0 : d / max; // HSV saturation
        const v = max; // HSV value/brightness

        this.colorPickerState.hue = Math.round(h * 360);
        this.colorPickerState.saturation = Math.round(s * 100);
        this.colorPickerState.value = Math.round(v * 100);

        // Update UI
        document.getElementById('color-picker-hue').value = this.colorPickerState.hue;
        document.getElementById('color-picker-hex').value = hex.replace(/^#/, '').toUpperCase();
        document.getElementById('color-picker-preview-box').style.background = hex;
        
        const gradient = document.getElementById('color-picker-gradient');
        gradient.style.background = `
            linear-gradient(to bottom, transparent, black),
            linear-gradient(to right, white, hsl(${this.colorPickerState.hue}, 100%, 50%))
        `;

        // Position cursor - X is saturation, Y is value (inverted)
        const cursor = document.getElementById('color-picker-cursor');
        cursor.style.left = `${this.colorPickerState.saturation}%`;
        cursor.style.top = `${100 - this.colorPickerState.value}%`;
    }

    updateColorPickerPreview() {
        const hex = this.hsvToHex(
            this.colorPickerState.hue,
            this.colorPickerState.saturation,
            this.colorPickerState.value
        );
        
        document.getElementById('color-picker-hex').value = hex.replace(/^#/, '').toUpperCase();
        document.getElementById('color-picker-preview-box').style.background = hex;
        
        this.applyColorPickerColor(hex);
    }

    applyColorPickerColor(hex) {
        const target = this.colorPickerState.target;
        
        if (target === 'placement') {
            if (this.placementMode === PlacementMode.TEXT) {
                this.textSettings.color = hex;
            } else if (this.placementMode === PlacementMode.TELEPORTAL) {
                this.teleportalSettings.color = hex;
            } else if (this.placementMode === PlacementMode.OBSTACLE) {
                this.obstacleSettings.color = hex;
            } else if (this.placementMode === PlacementMode.KOREEN) {
                this.koreenSettings.color = hex;
            } else {
                this.placementSettings.color = hex;
                // Update texture preview with new background color
                this.updateTexturePreview();
            }
            document.getElementById('placement-color-preview').style.background = hex;
            document.getElementById('placement-color-input').value = hex;
        } else if (target === 'object-edit') {
            if (this.editingObject) {
                this.editingObject.color = hex;
                document.getElementById('object-edit-color').value = hex;
                document.getElementById('object-edit-color-preview').style.background = hex;
                this.triggerMapChange();
            }
        } else if (target && target.startsWith('config-')) {
            const type = target.replace('config-', '');
            
            // Handle cloud colors (config-cloud-sky, config-cloud-galaxy)
            if (type.startsWith('cloud-')) {
                document.getElementById(`config-${type}`).value = hex;
                document.getElementById(`config-${type}-preview`).style.background = hex;
                
                if (type === 'cloud-sky') this.world.cloudColorSky = hex;
                else if (type === 'cloud-galaxy') this.world.cloudColorGalaxy = hex;
            } else {
            document.getElementById(`config-${type}-color`).value = hex;
            document.getElementById(`config-${type}-color-preview`).style.background = hex;
            
            if (type === 'block') this.world.defaultBlockColor = hex;
            else if (type === 'spike') this.world.defaultSpikeColor = hex;
            else if (type === 'text') this.world.defaultTextColor = hex;
            }
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
    
    hsvToHex(h, s, v) {
        s /= 100;
        v /= 100;
        
        const c = v * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c;
        
        let r, g, b;
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        
        r = Math.round((r + m) * 255).toString(16).padStart(2, '0');
        g = Math.round((g + m) * 255).toString(16).padStart(2, '0');
        b = Math.round((b + m) * 255).toString(16).padStart(2, '0');
        
        return `#${r}${g}${b}`;
    }

    // ========================================
    // INPUT HANDLING
    // ========================================
    handleKeyPress(e) {
        const isTestMode = this.engine.state === GameState.TESTING;
        const isEditorMode = this.engine.state === GameState.EDITOR;
        
        if (!isEditorMode && !isTestMode) return;
        
        // Don't handle shortcuts if user is typing in an input field
        const activeEl = document.activeElement;
        const isTyping = activeEl && (
            activeEl.tagName === 'INPUT' || 
            activeEl.tagName === 'TEXTAREA' || 
            activeEl.contentEditable === 'true'
        );
        
        // Allow Escape even while typing
        if (e.code === 'Escape') {
            this.handleEscape();
            return;
        }
        
        // Skip other shortcuts if typing
        if (isTyping) return;
        
        // Fly mode toggle works in both editor and test mode
        if (e.code === 'KeyG') {
            e.preventDefault();
                this.setTool(EditorTool.FLY);
            return;
        }
        
        // Other shortcuts only work in editor mode
        if (!isEditorMode) return;

        // Don't intercept browser shortcuts with Ctrl/Cmd
        if (e.ctrlKey || e.metaKey) return;
        
        switch (e.code) {
            case 'KeyQ':
                e.preventDefault();
                this.setTool(EditorTool.ERASE);
                break;
            case 'KeyM':
                e.preventDefault();
                this.setTool(EditorTool.MOVE);
                break;
            case 'KeyC':
                e.preventDefault();
                this.setTool(EditorTool.DUPLICATE);
                break;
            case 'KeyR':
                e.preventDefault();
                this.setTool(EditorTool.ROTATE);
                break;
            case 'KeyH':
                e.preventDefault();
                this.toggleGrid();
                break;
            case 'KeyV':
                e.preventDefault();
                this.setTool(EditorTool.SELECT);
                break;
        }
    }

    handleEscape() {
        // Exit selection mode
        if (this.isSelectionActive) {
            this.exitSelectionMode();
            return;
        }
        
        // Cancel zone adjustment mode
        if (this.zoneAdjustment.active) {
            this.exitZoneAdjustmentMode();
            return;
        }
        
        // Cancel zone placement
        if (this.zonePlacement.isPlacing) {
            this.zonePlacement.isPlacing = false;
            return;
        }

        // Cancel obstacle placement (spinner)
        if (this.obstaclePlacement.isPlacing) {
            this.obstaclePlacement.isPlacing = false;
            return;
        }
        
        // Cancel button placement
        if (this.buttonPlacement.isPlacing) {
            this.buttonPlacement.isPlacing = false;
            return;
        }

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
            this.closeObjectEditPopup();
            this.closeZoneNamePopup();
            this.closeButtonEditPopup();
        }
    }

    handleMouseMove(e) {
        const isTestMode = this.engine.state === GameState.TESTING;
        const isEditorMode = this.engine.state === GameState.EDITOR;
        
        // Update inspect box in test mode
        if (isTestMode) {
            const hoveredObj = this.getObjectUnderMouse();
            this.updateInspectBox(hoveredObj);
            return;
        }
        
        if (!isEditorMode) return;

        const worldPos = this.engine.getMouseWorldPos();
        const gridPos = this.engine.getGridAlignedPos(worldPos.x, worldPos.y);
        
        // Selection mode handling
        if (this.isSelectionActive && this.engine.mouse.down) {
            if (this.selectionMode === SelectionMode.QUOT && this.selectionRect) {
                this.handleQuotSelectionMove(worldPos.x, worldPos.y);
                return;
            }
            if (this.selectionMode === SelectionMode.MOUSE && this.selectionMovingObjects) {
                this.handleMouseModeMove(worldPos.x, worldPos.y);
                return;
            }
            // In selection mode, allow camera pan with fly when not interacting with objects
            if (this.isFlying) {
                this.camera.targetX -= e.movementX / this.camera.zoom;
                this.camera.targetY -= e.movementY / this.camera.zoom;
            }
            return;
        }
        
        // Zone placement - update end corner
        if (this.zonePlacement.isPlacing) {
            this.zonePlacement.endX = gridPos.x;
            this.zonePlacement.endY = gridPos.y;
            return; // Don't do anything else during zone drawing
        }

        // Obstacle (spinner) placement - update end corner
        if (this.obstaclePlacement.isPlacing) {
            this.obstaclePlacement.endX = gridPos.x;
            this.obstaclePlacement.endY = gridPos.y;
            return;
        }
        
        // Button placement - update end corner
        if (this.buttonPlacement.isPlacing) {
            this.buttonPlacement.endX = gridPos.x;
            this.buttonPlacement.endY = gridPos.y;
            return;
        }
        
        // Zone adjustment - handle dragger movement
        if (this.zoneAdjustment.active && this.zoneAdjustment.draggerHeld && this.engine.mouse.down) {
            this.handleZoneDraggerMove(gridPos.x, gridPos.y);
            return;
        }

        // Fly mode camera movement
        if (this.isFlying && this.engine.mouse.down && this.placementMode === PlacementMode.NONE && !this.zonePlacement.isPlacing) {
            this.camera.targetX -= e.movementX / this.camera.zoom;
            this.camera.targetY -= e.movementY / this.camera.zoom;
        }

        // Brush-like placement - continue placing while mouse is held (except for teleportal, button, and obstacle with spinner appearance)
        const isSpinnerMode = this.placementMode === PlacementMode.OBSTACLE && this.obstacleSettings.appearanceType === 'spinner';
        if (this.isPlacing && this.engine.mouse.down && this.placementMode !== PlacementMode.NONE && this.placementMode !== PlacementMode.TELEPORTAL && this.placementMode !== PlacementMode.BUTTON && !isSpinnerMode && !this.isOverUI(e)) {
            this.placeObject(gridPos.x, gridPos.y);
        }

        // Moving object
        if (this.movingObject) {
            this.movingObject.x = gridPos.x;
            this.movingObject.y = gridPos.y;
            this.world._spatialDirty = true;
            this.world._editorMergedDirty = true;
        }
        
        // Rotating object (drag-based rotation)
        if (this.rotatingObject && this.rotationStartPos) {
            // Calculate angle from object center to mouse position
            const objCenterX = this.rotatingObject.x + this.rotatingObject.width / 2;
            const objCenterY = this.rotatingObject.y + this.rotatingObject.height / 2;
            
            const dx = worldPos.x - objCenterX;
            const dy = worldPos.y - objCenterY;
            
            // Calculate angle in degrees (0 = right, 90 = down, 180 = left, -90 = up)
            let angle = Math.atan2(dy, dx) * (180 / Math.PI);
            
            // Snap to nearest 90-degree increment
            angle = Math.round(angle / 90) * 90;
            
            // Convert to game rotation system (0 = up, 90 = right, 180 = down, 270 = left)
            // atan2 gives: 0 = right, 90 = down, 180/-180 = left, -90 = up
            // Game uses: 0 = default (up), 90 = right, 180 = down, 270 = left
            let rotation = (angle + 90 + 360) % 360;
            
            if (this.rotatingObject.rotation !== rotation) {
                this.rotatingObject.rotation = rotation;
            }
        }

        // Quick eraser
        if (this.isErasing && this.engine.mouse.down && !this.isOverUI(e)) {
            const objOrObjs = this.getObjectToErase(worldPos.x, worldPos.y);
            if (objOrObjs) {
                const gridPos = this.engine.getGridAlignedPos(worldPos.x, worldPos.y);
                const halfW = Math.floor(this.eraseSettings.width / 2) * GRID_SIZE;
                const halfH = Math.floor(this.eraseSettings.height / 2) * GRID_SIZE;
                const eX = gridPos.x - halfW;
                const eY = gridPos.y - halfH;
                const eW = this.eraseSettings.width * GRID_SIZE;
                const eH = this.eraseSettings.height * GRID_SIZE;
                if (this.eraseFromArea(objOrObjs, eX, eY, eW, eH)) {
                    this.triggerMapChange();
                }
            }
        }

        // Update hovered object
        this.hoveredObject = this.world.getObjectAt(worldPos.x, worldPos.y);
    }

    handleMouseDown(e) {
        if (this.engine.state !== GameState.EDITOR) return;
        if (this.isOverUI(e)) return;
        
        // Selection mode handling
        if (this.isSelectionActive) {
            const worldPos = this.engine.getMouseWorldPos();
            
            switch (this.selectionMode) {
                case SelectionMode.QUOT:
                    this.handleQuotSelectionDown(worldPos.x, worldPos.y);
                    return;
                case SelectionMode.MULTI:
                    this.handleMultiSelectClick(worldPos.x, worldPos.y);
                    return;
                case SelectionMode.MOUSE:
                    this.handleMouseModeDown(worldPos.x, worldPos.y);
                    return;
            }
        }
        
        // Handle zone adjustment draggers
        if (this.zoneAdjustment.active) {
            const worldPos = this.engine.getMouseWorldPos();
            const dragger = this.getZoneDraggerAtPoint(worldPos.x, worldPos.y);
            if (dragger) {
                this.zoneAdjustment.draggerHeld = dragger;
                return;
            }
            // If clicking outside draggers, allow camera panning
        }

        const worldPos = this.engine.getMouseWorldPos();
        const gridPos = this.engine.getGridAlignedPos(worldPos.x, worldPos.y);

        // Zone placement mode - start drawing region
        if (this.placementMode === PlacementMode.KOREEN && this.koreenSettings.appearanceType === 'zone') {
            this.zonePlacement.isPlacing = true;
            this.zonePlacement.startX = gridPos.x;
            this.zonePlacement.startY = gridPos.y;
            this.zonePlacement.endX = gridPos.x;
            this.zonePlacement.endY = gridPos.y;
            return;
        }

        // Obstacle placement mode with spinner appearance - start drawing region (like zone)
        if (this.placementMode === PlacementMode.OBSTACLE && this.obstacleSettings.appearanceType === 'spinner') {
            this.obstaclePlacement.isPlacing = true;
            this.obstaclePlacement.startX = gridPos.x;
            this.obstaclePlacement.startY = gridPos.y;
            this.obstaclePlacement.endX = gridPos.x;
            this.obstaclePlacement.endY = gridPos.y;
            return;
        }

        // Button placement mode - start drawing region (like zone)
        if (this.placementMode === PlacementMode.BUTTON) {
            this.buttonPlacement.isPlacing = true;
            this.buttonPlacement.startX = gridPos.x;
            this.buttonPlacement.startY = gridPos.y;
            this.buttonPlacement.endX = gridPos.x;
            this.buttonPlacement.endY = gridPos.y;
            return;
        }

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
                    this.rotatingObject = objToRotate;
                    this.rotationStartPos = { x: worldPos.x, y: worldPos.y };
                }
                break;
            
            case EditorTool.ROTATE_LEFT: {
                const obj = this.world.getObjectAt(worldPos.x, worldPos.y);
                if (obj) {
                    obj.rotation = (obj.rotation - 90 + 360) % 360;
                    this.triggerMapChange();
                }
                break;
            }
            
            case EditorTool.ROTATE_RIGHT: {
                const obj = this.world.getObjectAt(worldPos.x, worldPos.y);
                if (obj) {
                    obj.rotation = (obj.rotation + 90) % 360;
                    this.triggerMapChange();
                }
                break;
            }
            
            case EditorTool.ERASE: {
                const objOrObjsToErase = this.getObjectToErase(worldPos.x, worldPos.y);
                if (objOrObjsToErase) {
                    const gridPos = this.engine.getGridAlignedPos(worldPos.x, worldPos.y);
                    const halfW = Math.floor(this.eraseSettings.width / 2) * GRID_SIZE;
                    const halfH = Math.floor(this.eraseSettings.height / 2) * GRID_SIZE;
                    const eX = gridPos.x - halfW;
                    const eY = gridPos.y - halfH;
                    const eW = this.eraseSettings.width * GRID_SIZE;
                    const eH = this.eraseSettings.height * GRID_SIZE;
                    if (this.eraseFromArea(objOrObjsToErase, eX, eY, eW, eH)) {
                        this.triggerMapChange();
                    }
                }
                break;
            }
            
            case EditorTool.NONE:
                // If no tool is active, open edit popup on click
                if (this.isFlying) {
                    // In fly mode, record click start to detect click vs drag
                    this.flyClickStart = { x: e.clientX, y: e.clientY, worldPos: { ...worldPos } };
                } else {
                    const objToEdit = this.world.getObjectAt(worldPos.x, worldPos.y);
                    if (objToEdit) {
                        this.openObjectEditPopup(objToEdit);
                    }
                }
                break;
        }
    }

    handleMouseUp(e) {
        // Selection mode handling
        if (this.isSelectionActive) {
            const worldPos = this.engine.getMouseWorldPos();
            if (this.selectionMode === SelectionMode.QUOT && this.selectionRect) {
                this.handleQuotSelectionUp();
                return;
            }
            if (this.selectionMode === SelectionMode.MOUSE) {
                this.handleMouseModeUp(worldPos.x, worldPos.y);
                return;
            }
        }
        
        // Handle fly mode click (vs drag) - open object popup if minimal movement
        if (this.flyClickStart && this.currentTool === EditorTool.NONE) {
            const dx = e.clientX - this.flyClickStart.x;
            const dy = e.clientY - this.flyClickStart.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // If mouse moved less than 5 pixels, treat as a click
            if (distance < 5) {
                const objToEdit = this.world.getObjectAt(this.flyClickStart.worldPos.x, this.flyClickStart.worldPos.y);
                if (objToEdit) {
                    this.openObjectEditPopup(objToEdit);
                }
            }
            this.flyClickStart = null;
        }
        // Complete zone placement
        if (this.zonePlacement.isPlacing) {
            this.zonePlacement.isPlacing = false;
            this.completeZonePlacement();
            return;
        }

        // Complete obstacle (spinner) placement
        if (this.obstaclePlacement.isPlacing) {
            this.obstaclePlacement.isPlacing = false;
            this.completeSpinnerPlacement();
            return;
        }
        
        // Complete button placement
        if (this.buttonPlacement.isPlacing) {
            this.buttonPlacement.isPlacing = false;
            this.completeButtonPlacement();
            return;
        }
        
        // Release zone adjustment dragger
        if (this.zoneAdjustment.draggerHeld) {
            this.zoneAdjustment.draggerHeld = null;
            this.triggerMapChange();
            return;
        }
        
        // Stop brush placement
        this.isPlacing = false;
        
        if (this.movingObject) {
            this.movingObject.snapToGrid();
            this.movingObject = null;
            this.setTool(EditorTool.NONE);
            this.triggerMapChange();
        }
        
        // Finish rotation drag
        if (this.rotatingObject) {
            this.rotatingObject = null;
            this.rotationStartPos = null;
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
            el.closest('.modal-overlay') ||
            el.closest('.object-edit-popup') ||
            el.closest('.object-edit-panel') ||
            el.closest('.zone-name-panel') ||
            el.closest('.zone-edit-panel') ||
            el.closest('.zone-adjust-stop')
        );
    }

    // ========================================
    // OBJECT ERASING
    // ========================================
    getObjectsInEraserArea(x, y) {
        // Get eraser dimensions in pixels
        const eraserWidth = this.eraseSettings.width * GRID_SIZE;
        const eraserHeight = this.eraseSettings.height * GRID_SIZE;
        
        // Center the eraser on the mouse position (grid-aligned)
        const gridPos = this.engine.getGridAlignedPos(x, y);
        const halfW = Math.floor(this.eraseSettings.width / 2) * GRID_SIZE;
        const halfH = Math.floor(this.eraseSettings.height / 2) * GRID_SIZE;
        const eraserX = gridPos.x - halfW;
        const eraserY = gridPos.y - halfH;
        
        // Get all objects that intersect with the eraser area
        const objectsInArea = this.world.objects.filter(obj => {
            return obj.x < eraserX + eraserWidth &&
                   obj.x + obj.width > eraserX &&
                   obj.y < eraserY + eraserHeight &&
                   obj.y + obj.height > eraserY;
        });
        
        return objectsInArea;
    }
    
    getObjectToErase(x, y) {
        // Get all objects in eraser area
        const objectsInArea = this.getObjectsInEraserArea(x, y);
        
        if (objectsInArea.length === 0) return null;
        if (objectsInArea.length === 1) return objectsInArea[0];
        
        // Sort by array index (layer order in world.objects)
        objectsInArea.sort((a, b) => {
            const indexA = this.world.objects.indexOf(a);
            const indexB = this.world.objects.indexOf(b);
            return indexA - indexB;
        });
        
        switch (this.eraseSettings.eraseType) {
            case 'all':
                // Return ALL objects in the area for bulk erase
                return objectsInArea;
            case 'top':
                // Return the topmost object (highest index)
                return objectsInArea[objectsInArea.length - 1];
            case 'bottom':
                // Return the bottommost object (lowest index)
                return objectsInArea[0];
            default:
                return objectsInArea[objectsInArea.length - 1];
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
        } else if (this.placementMode === PlacementMode.OBSTACLE && this.obstacleSettings.appearanceType === 'spike') {
            settings = this.obstacleSettings;
            type = 'block';
        } else if (this.placementMode === PlacementMode.KOREEN) {
            settings = this.koreenSettings;
            type = 'koreen';
        } else if (this.placementMode === PlacementMode.TEXT) {
            settings = this.textSettings;
            type = 'text';
        } else if (this.placementMode === PlacementMode.TELEPORTAL) {
            // Teleportal placement - single click only, opens naming popup
            this.placeTeleportal(x, y);
            return;
        } else {
            return;
        }

        // Check fill mode
        // 'add' - Only place if nothing exists
        // 'replace' - Remove existing and place new
        // 'overlap' - Place on top without removing existing
        const fillMode = settings.fillMode || 'add';
        const existingObj = this.world.getObjectAt(x + GRID_SIZE / 2, y + GRID_SIZE / 2);

        if (fillMode === 'add' && existingObj) {
            return; // Don't place if something exists
        }

        if (fillMode === 'replace' && existingObj) {
            this.world.removeObject(existingObj.id);
        }
        
        // 'overlap' mode - no checks, just place on top

        // Determine object dimensions (Soul Statue is 3x10 blocks)
        let objWidth = GRID_SIZE;
        let objHeight = GRID_SIZE;
        let objX = x;
        let objY = y;
        if (settings.appearanceType === 'soulStatue') {
            objWidth = GRID_SIZE * 3; // 3 blocks wide (96px)
            objHeight = GRID_SIZE * 10; // 10 blocks tall (320px)
            objX = x - GRID_SIZE; // Center horizontally on click
            objY = y - GRID_SIZE * 9; // Place with click point at bottom
        }

        // Create object
        const obj = new WorldObject({
            x: objX,
            y: objY,
            width: objWidth,
            height: objHeight,
            type: type,
            appearanceType: settings.appearanceType || 'ground',
            actingType: settings.actingType || 'ground',
            texture: settings.texture || 'solid',
            collision: settings.collision !== undefined ? settings.collision : true,
            color: settings.color || '#787878',
            opacity: settings.opacity !== undefined ? settings.opacity : 1,
            content: settings.content || '',
            font: settings.font || 'Arial',
            fontSize: settings.fontSize || 24,
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
        this.mergeBlockWithAdjacent(obj);
        this.triggerMapChange();
    }

    eraseFromArea(objects, eraserX, eraserY, eraserW, eraserH) {
        let didErase = false;
        const toProcess = Array.isArray(objects) ? objects : [objects];

        for (const obj of toProcess) {
            const isMerged = obj.type === 'block' && obj.appearanceType === 'ground' &&
                obj.rotation === 0 && !obj.flipHorizontal &&
                (obj.width > GRID_SIZE || obj.height > GRID_SIZE);

            if (!isMerged) {
                this.world.removeObject(obj.id);
                didErase = true;
                continue;
            }

            const gs = GRID_SIZE;
            const cols = Math.round(obj.width / gs);
            const rows = Math.round(obj.height / gs);
            const kept = [];

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const cx = obj.x + c * gs;
                    const cy = obj.y + r * gs;
                    const inside = cx < eraserX + eraserW && cx + gs > eraserX &&
                                   cy < eraserY + eraserH && cy + gs > eraserY;
                    if (!inside) {
                        kept.push({ x: cx, y: cy });
                    }
                }
            }

            if (kept.length === cols * rows) continue;
            didErase = true;

            this.world.removeObject(obj.id);

            for (const cell of kept) {
                this.world.addObject(new WorldObject({
                    type: obj.type,
                    x: cell.x,
                    y: cell.y,
                    width: gs,
                    height: gs,
                    color: obj.color,
                    texture: obj.texture,
                    opacity: obj.opacity,
                    layer: obj.layer,
                    collision: obj.collision,
                    appearanceType: obj.appearanceType,
                    actingType: obj.actingType
                }));
            }
        }
        return didErase;
    }

    mergeBlockWithAdjacent(obj) {
        if (obj.type !== 'block') return;
        const at = obj.appearanceType;
        if (at === 'spike' || at === 'spinner' || at === 'checkpoint' ||
            at === 'soulStatue' || at === 'button') return;
        if (obj.rotation !== 0 || obj.flipHorizontal) return;

        const propKey = (o) =>
            `${o.color}|${o.texture || 'solid'}|${o.opacity}|${o.layer || 1}|${o.collision}|${o.appearanceType}|${o.actingType}`;
        const myKey = propKey(obj);

        let changed = true;
        while (changed) {
            changed = false;
            const near = this.world.queryNear(
                obj.x - 1, obj.y - 1, obj.width + 2, obj.height + 2
            );
            for (let i = 0; i < near.length; i++) {
                const other = near[i];
                if (other === obj || other.id === obj.id) continue;
                if (other.type !== 'block') continue;
                if (other.rotation !== 0 || other.flipHorizontal) continue;
                if (propKey(other) !== myKey) continue;

                // Right: other is directly to the right, same top & height
                if (obj.x + obj.width === other.x && obj.y === other.y && obj.height === other.height) {
                    obj.width += other.width;
                    this.world.removeObject(other.id);
                    changed = true; break;
                }
                // Left
                if (other.x + other.width === obj.x && obj.y === other.y && obj.height === other.height) {
                    obj.x = other.x;
                    obj.width += other.width;
                    this.world.removeObject(other.id);
                    changed = true; break;
                }
                // Below
                if (obj.y + obj.height === other.y && obj.x === other.x && obj.width === other.width) {
                    obj.height += other.height;
                    this.world.removeObject(other.id);
                    changed = true; break;
                }
                // Above
                if (other.y + other.height === obj.y && obj.x === other.x && obj.width === other.width) {
                    obj.y = other.y;
                    obj.height += other.height;
                    this.world.removeObject(other.id);
                    changed = true; break;
                }
            }
        }

        this.world._spatialDirty = true;
        this.world._tileCacheReady = false;
        this.world._mergedBlockCache = null;
        this.world._editorMergedDirty = true;
    }

    // ========================================
    // INSPECT BOX (Test Mode)
    // ========================================
    createInspectBox() {
        if (this.inspectBox) return;
        
        const container = document.createElement('div');
        container.className = 'inspect-box-container';
        container.id = 'inspect-box-container';
        container.innerHTML = `
            <div class="inspect-box">
                <div class="inspect-box-title">Object Inspector</div>
                <div class="inspect-box-content" id="inspect-box-content">
                    <div class="inspect-box-empty">(Hover over an object)</div>
                </div>
            </div>
            <button class="inspect-toggle-btn" id="inspect-toggle-btn" title="Hide Inspector">
                <span class="material-symbols-outlined" style="font-size: 18px;">keyboard_double_arrow_left</span>
            </button>
        `;
        document.body.appendChild(container);
        
        this.inspectBox = container;
        this.inspectBoxContent = document.getElementById('inspect-box-content');
        
        // Toggle button
        const toggleBtn = document.getElementById('inspect-toggle-btn');
        const toggleIcon = toggleBtn.querySelector('.material-symbols-outlined');
        toggleBtn.addEventListener('click', () => {
            const isHidden = container.classList.toggle('hidden');
            toggleBtn.title = isHidden ? 'Show Inspector' : 'Hide Inspector';
            toggleIcon.textContent = isHidden ? 'visibility' : 'keyboard_double_arrow_left';
        });
    }
    
    showInspectBox() {
        if (!this.inspectBox) this.createInspectBox();
        this.inspectBox.style.display = 'block';
    }
    
    hideInspectBox() {
        if (this.inspectBox) {
            this.inspectBox.style.display = 'none';
        }
    }
    
    updateInspectBox(obj) {
        if (!this.inspectBoxContent) return;
        
        if (!obj) {
            this.inspectBoxContent.innerHTML = '<div class="inspect-box-empty">(Hover over an object)</div>';
            return;
        }
        
        const data = {
            'Type': obj.type || 'unknown',
            'Appearance': obj.appearanceType || '-',
            'Acting As': obj.actingType || '-',
            'Name': obj.name || '-',
            'Position': `(${Math.round(obj.x)}, ${Math.round(obj.y)})`,
            'Size': `${obj.width} × ${obj.height}`,
            'Color': obj.color || '-',
            'Opacity': obj.opacity !== undefined ? Math.round(obj.opacity * 100) + '%' : '-',
            'Collision': obj.collision ? 'Yes' : 'No',
            'Rotation': obj.rotation ? obj.rotation + '°' : '0°',
            'Layer': obj.layer || 1
        };
        
        // Add type-specific data
        if (obj.type === 'teleportal') {
            data['Portal Name'] = obj.teleportalName || '-';
            const sendCount = (obj.sendTo || []).filter(c => c?.enabled !== false).length;
            const receiveCount = (obj.receiveFrom || []).filter(c => c?.enabled !== false).length;
            data['Send To'] = sendCount > 0 ? `${sendCount} connection(s)` : 'None';
            data['Receive From'] = receiveCount > 0 ? `${receiveCount} connection(s)` : 'None';
        }
        
        if (obj.type === 'text') {
            data['Content'] = obj.content || '-';
            data['Font'] = obj.font || 'Default';
            data['Font Size'] = obj.fontSize || 24;
        }
        
        if (obj.appearanceType === 'zone') {
            data['Zone Name'] = obj.zoneName || '-';
        }
        
        // Show spike settings only for actual spikes, not spinners
        const isSpinnerObj = obj.type === 'spinner' || obj.appearanceType === 'spinner';
        if (!isSpinnerObj && (obj.appearanceType === 'spike' || obj.actingType === 'spike')) {
            data['Touchbox'] = obj.spikeTouchbox || 'default';
            data['Drop Hurt Only'] = obj.dropHurtOnly === true ? 'Yes' : (obj.dropHurtOnly === false ? 'No' : 'World Default');
        }
        
        if (obj.flipHorizontal) {
            data['Flipped'] = 'Yes';
        }
        
        // Build HTML
        let html = '';
        for (const [key, value] of Object.entries(data)) {
            if (value && value !== '-') {
                html += `<div class="inspect-box-row"><span class="inspect-box-key">${key}:</span><span class="inspect-box-value">${value}</span></div>`;
            }
        }
        
        if (!html) {
            html = '<div class="inspect-box-empty">(Data empty)</div>';
        }
        
        this.inspectBoxContent.innerHTML = html;
    }
    
    getObjectUnderMouse() {
        const worldPos = this.engine.getMouseWorldPos();
        if (!worldPos) return null;
        
        // Check from top layer to bottom
        const sortedObjects = [...this.world.objects].sort((a, b) => (b.layer || 1) - (a.layer || 1));
        
        for (const obj of sortedObjects) {
            if (worldPos.x >= obj.x && worldPos.x <= obj.x + obj.width &&
                worldPos.y >= obj.y && worldPos.y <= obj.y + obj.height) {
                return obj;
            }
        }
        return null;
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
        
        // Reset fly mode to OFF for test mode
        this.isFlying = false;
        if (this.engine.localPlayer) {
            this.engine.localPlayer.isFlying = false;
        }
        
        // Update fly button UI to show inactive state
        const flyBtn = this.ui.toolbar.querySelector('[data-tool="fly"]');
        if (flyBtn) {
            flyBtn.classList.remove('active');
        }
        
        // Update UI
        this.ui.btnConfig.classList.add('hidden');
        this.ui.btnAdd.classList.add('hidden');
        this.ui.btnLayers.classList.add('hidden');
        this.ui.btnStopTest.classList.remove('hidden');
        this.ui.placementToolbar.classList.remove('active');
        
        // Start music playback
        this.startMusicPlayback();
        
        // Show limited toolbar (fly, zoom in, zoom out only)
        this.ui.toolbar.classList.remove('hidden');
        this.ui.toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
            const tool = btn.dataset.tool;
            const action = btn.dataset.action;
            if (tool === 'fly' || action === 'zoom-in' || action === 'zoom-out') {
                btn.classList.remove('hidden');
            } else if (btn.classList.contains('test-mode-tool')) {
                btn.classList.remove('hidden');
            } else {
                btn.classList.add('hidden');
            }
        });
        this.ui.toolbar.querySelectorAll('.toolbar-divider').forEach(div => {
            div.classList.add('hidden');
        });
        const extraEl = document.getElementById('toolbar-extra');
        if (extraEl) extraEl.classList.add('hidden');
        
        this.closePanel('config');
        this.closePanel('layers');
        this.closeAddMenu();
        this.stopPlacement();
        
        // Show inspect box
        this.showInspectBox();
    }

    stopTest() {
        this.engine.stopGame();
        
        this.stopMusicPlayback();
        this.hideInspectBox();
        
        // Reset debug overlays
        this.showTouchboxes = false;
        this.invincibilityEnabled = false;
        
        // Reset tool state
        this.currentTool = EditorTool.NONE;
        this.isErasing = false;
        this.hideEraseMode();
        
        // Sync fly mode with the editor player (createEditorPlayer sets isFlying=true)
        this.isFlying = true;
        
        // Restore UI
        this.ui.btnConfig.classList.remove('hidden');
        this.ui.btnAdd.classList.remove('hidden');
        this.ui.btnLayers.classList.remove('hidden');
        this.ui.btnStopTest.classList.add('hidden');
        
        // Restore full toolbar
        this.ui.toolbar.classList.remove('hidden');
        this.ui.toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
            if (btn.classList.contains('test-mode-tool')) {
                btn.classList.add('hidden');
            } else {
            btn.classList.remove('hidden');
            }
        });
        this.ui.toolbar.querySelectorAll('.toolbar-divider').forEach(div => {
            div.classList.remove('hidden');
        });
        const extraEl = document.getElementById('toolbar-extra');
        if (extraEl) extraEl.classList.remove('hidden');
        
        // Restore correct button active states
        this.ui.toolbar.querySelectorAll('.toolbar-btn[data-tool]').forEach(btn => {
            btn.classList.remove('active');
        });
        const flyBtn = this.ui.toolbar.querySelector('[data-tool="fly"]');
        if (flyBtn) flyBtn.classList.toggle('active', this.isFlying);
    }

    // ========================================
    // EXPORT/IMPORT
    // ========================================
    async exportMap() {
        try {
            const exportManager = new ExportManager();
            await exportManager.exportToFile(this.world, this.world.mapName, this.world.storedDataType);
        this.showToast('Map exported successfully!', 'success');
        } catch (err) {
            console.error('Export failed:', err);
            this.showToast('Export failed: ' + err.message, 'error');
        }
    }

    async importMap(e) {
        const file = e.target.files[0];
        if (!file) return;

            try {
            const importManager = new ImportManager();
            const data = await importManager.importFromFile(file);
                this.world.fromJSON(data);
                
                // Initialize plugins from imported world data
                if (window.PluginManager) {
                    await window.PluginManager.initFromWorld(this.world);
                }
                
                this.updateBackground();
            this.syncConfigPanel();
                this.triggerMapChange();
                this.showToast('Map imported successfully!', 'success');
            } catch (err) {
            console.error('Import failed:', err);
            this.showToast('Import failed: ' + err.message, 'error');
            }
        
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

        // Remove existing custom background elements
        const existingCustomBg = bgElement.querySelector('.custom-bg-element');
        if (existingCustomBg) existingCustomBg.remove();

        if (this.world.background === 'custom' && this.world.customBackground.enabled) {
            bgElement.className = 'game-bg custom';
            
            // Create custom background element
            const cb = this.world.customBackground;
            if (cb.data) {
                if (cb.type === 'video') {
                    const video = document.createElement('video');
                    video.className = 'custom-bg-element';
                    video.src = cb.data;
                    video.autoplay = true;
                    video.muted = true;
                    video.loop = cb.playMode === 'loop' && cb.loopCount === -1;
                    video.playsInline = true;
                    video.style.cssText = 'position: absolute; top: 50%; left: 50%; min-width: 100%; min-height: 100%; transform: translate(-50%, -50%); object-fit: cover;';
                    bgElement.appendChild(video);
                    
                    if (cb.reverse) {
                        video.playbackRate = -1; // Note: negative playback rate not widely supported
                    }
                } else {
                    const img = document.createElement('img');
                    img.className = 'custom-bg-element';
                    img.src = cb.data;
                    img.style.cssText = 'position: absolute; top: 50%; left: 50%; min-width: 100%; min-height: 100%; transform: translate(-50%, -50%); object-fit: cover;';
                    bgElement.appendChild(img);
                }
            }
        } else {
        bgElement.className = `game-bg ${this.world.background}`;
        }
        
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
        
        // Cloud colors
        const cloudSkyColor = document.getElementById('config-cloud-sky');
        const cloudSkyPreview = document.getElementById('config-cloud-sky-preview');
        if (cloudSkyColor) cloudSkyColor.value = this.world.cloudColorSky || '#ffffff';
        if (cloudSkyPreview) cloudSkyPreview.style.background = this.world.cloudColorSky || '#ffffff';
        
        const cloudGalaxyColor = document.getElementById('config-cloud-galaxy');
        const cloudGalaxyPreview = document.getElementById('config-cloud-galaxy-preview');
        if (cloudGalaxyColor) cloudGalaxyColor.value = this.world.cloudColorGalaxy || '#9382a8';
        if (cloudGalaxyPreview) cloudGalaxyPreview.style.background = this.world.cloudColorGalaxy || '#9382a8';

        // Checkpoint colors
        const cpDefaultColor = document.getElementById('config-checkpoint-default');
        const cpDefaultPreview = document.getElementById('config-checkpoint-default-preview');
        if (cpDefaultColor) cpDefaultColor.value = this.world.checkpointDefaultColor || '#808080';
        if (cpDefaultPreview) cpDefaultPreview.style.background = this.world.checkpointDefaultColor || '#808080';
        
        const cpActiveColor = document.getElementById('config-checkpoint-active');
        const cpActivePreview = document.getElementById('config-checkpoint-active-preview');
        if (cpActiveColor) cpActiveColor.value = this.world.checkpointActiveColor || '#4CAF50';
        if (cpActivePreview) cpActivePreview.style.background = this.world.checkpointActiveColor || '#4CAF50';
        
        const cpTouchedColor = document.getElementById('config-checkpoint-touched');
        const cpTouchedPreview = document.getElementById('config-checkpoint-touched-preview');
        if (cpTouchedColor) cpTouchedColor.value = this.world.checkpointTouchedColor || '#2196F3';
        if (cpTouchedPreview) cpTouchedPreview.style.background = this.world.checkpointTouchedColor || '#2196F3';
        
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
        
        const cameraLerpX = document.getElementById('config-camera-lerp-x');
        const cameraLerpXValue = document.getElementById('config-camera-lerp-x-value');
        if (cameraLerpX) {
            cameraLerpX.value = this.world.cameraLerpX || 0.12;
            if (cameraLerpXValue) cameraLerpXValue.textContent = (this.world.cameraLerpX || 0.12).toFixed(2);
        }
        
        const cameraLerpY = document.getElementById('config-camera-lerp-y');
        const cameraLerpYValue = document.getElementById('config-camera-lerp-y-value');
        if (cameraLerpY) {
            cameraLerpY.value = this.world.cameraLerpY || 0.12;
            if (cameraLerpYValue) cameraLerpYValue.textContent = (this.world.cameraLerpY || 0.12).toFixed(2);
        }
        
        // Spike touchbox
        const spikeTouchbox = document.getElementById('config-spike-touchbox');
        if (spikeTouchbox) {
            spikeTouchbox.value = this.world.spikeTouchbox || 'normal';
            this.updateSpikeTouchboxDescription(this.world.spikeTouchbox || 'normal');
        }
        
        // Drop Hurt Only
        const dropHurtOnly = document.getElementById('config-drop-hurt-only');
        if (dropHurtOnly) {
            dropHurtOnly.checked = this.world.dropHurtOnly || false;
        }
        
        // Stored data type
        const storedDataType = document.getElementById('config-stored-data-type');
        if (storedDataType) {
            storedDataType.value = this.world.storedDataType || 'json';
            this.updateStoredDataTypeDescription(this.world.storedDataType || 'json');
        }
        
        // Keyboard layout
        const keyboardLayout = document.getElementById('config-keyboard-layout');
        if (keyboardLayout) {
            keyboardLayout.value = this.world.keyboardLayout || 'jimmyqrg';
            this.updateKeyboardLayoutInfo(this.world.keyboardLayout || 'jimmyqrg');
            this.updateKeyboardLayoutOptions();
        }
        
        // Music settings
        const musicSelect = document.getElementById('config-music');
        const customMusicOptions = document.getElementById('custom-music-options');
        const musicVolume = document.getElementById('config-music-volume');
        const musicVolumeLabel = document.getElementById('config-music-volume-label');
        const musicLoop = document.getElementById('config-music-loop');
        
        if (musicSelect && this.world.music) {
            musicSelect.value = this.world.music.type || 'none';
            
            if (this.world.music.type === 'custom') {
                customMusicOptions.classList.remove('hidden');
                
                // If there's custom music data, show the preview
                if (this.world.music.customData) {
                    const preview = document.getElementById('custom-music-preview');
                    const dropzone = document.getElementById('custom-music-dropzone');
                    const nameEl = document.getElementById('custom-music-name');
                    
                    nameEl.textContent = this.world.music.customName || 'Custom Music';
                    preview.classList.remove('hidden');
                    dropzone.classList.add('hidden');
                    
                    if (this.previewAudio) {
                        this.previewAudio.src = this.world.music.customData;
                        this.previewAudio.volume = this.world.music.volume / 100;
                    }
                }
            } else {
                customMusicOptions.classList.add('hidden');
            }
        }
        
        if (musicVolume) {
            musicVolume.value = this.world.music?.volume ?? 50;
        }
        if (musicVolumeLabel) {
            musicVolumeLabel.textContent = (this.world.music?.volume ?? 50) + '%';
        }
        if (musicLoop) {
            musicLoop.checked = this.world.music?.loop !== false;
        }
        
        // Plugin settings
        this.syncPluginSettings();
        
        // Custom background
        this.syncCustomBackgroundUI();
    }
    
    syncPluginSettings() {
        // Update plugin config sections visibility
        this.updatePluginConfigSections();
        
        // HP settings
        const hpDefault = document.getElementById('config-hp-default');
        if (hpDefault) {
            hpDefault.value = this.world.plugins?.hp?.defaultHP ?? 3;
        }
        
        // Hollow Knight settings
        const hkGravity = document.getElementById('config-hk-gravity');
        const hkMaxSoul = document.getElementById('config-hk-maxsoul');
        const hkMonarchWing = document.getElementById('config-hk-monarchwing');
        const hkMonarchWingAmount = document.getElementById('config-hk-monarchwing-amount');
        const hkMonarchWingAmountGroup = document.getElementById('config-hk-monarchwing-amount-group');
        const hkDash = document.getElementById('config-hk-dash');
        const hkSuperDash = document.getElementById('config-hk-superdash');
        const hkMantisClaw = document.getElementById('config-hk-mantisclaw');
        
        const hk = this.world.plugins?.hk;
        if (hkGravity) hkGravity.value = hk?.defaultGravity ?? 1.14;
        if (hkMaxSoul) hkMaxSoul.value = hk?.maxSoul ?? 99;
        if (hkMonarchWing) hkMonarchWing.checked = hk?.monarchWing ?? false;
        if (hkMonarchWingAmount) hkMonarchWingAmount.value = hk?.monarchWingAmount ?? 1;
        if (hkMonarchWingAmountGroup) hkMonarchWingAmountGroup.classList.toggle('hidden', !(hk?.monarchWing));
        if (hkDash) hkDash.checked = hk?.dash ?? false;
        if (hkSuperDash) hkSuperDash.checked = hk?.superDash ?? false;
        if (hkMantisClaw) hkMantisClaw.checked = hk?.mantisClaw ?? false;
        
        // HK Camera settings
        const hkCameraX = document.getElementById('config-hk-camera-x');
        const hkCameraXValue = document.getElementById('config-hk-camera-x-value');
        const hkCameraY = document.getElementById('config-hk-camera-y');
        const hkCameraYValue = document.getElementById('config-hk-camera-y-value');
        if (hkCameraX) hkCameraX.value = hk?.defaultCameraLerpX ?? 0.04;
        if (hkCameraXValue) hkCameraXValue.textContent = (hk?.defaultCameraLerpX ?? 0.04).toFixed(2);
        if (hkCameraY) hkCameraY.value = hk?.defaultCameraLerpY ?? 0.15;
        if (hkCameraYValue) hkCameraYValue.textContent = (hk?.defaultCameraLerpY ?? 0.15).toFixed(2);
        
        // Code plugin settings
        const codeAutoRespawn = document.getElementById('config-code-autorespawn');
        const code = this.world.plugins?.code;
        if (codeAutoRespawn) codeAutoRespawn.checked = code?.autoRespawn ?? true;
        
        // Update zone button state
        this.updateZoneButtonState();
    }
    
    syncCustomBackgroundUI() {
        const customOptions = document.getElementById('custom-bg-options');
        const dropzone = document.getElementById('custom-bg-dropzone');
        const preview = document.getElementById('custom-bg-preview');
        const previewImg = document.getElementById('custom-bg-preview-img');
        const previewVideo = document.getElementById('custom-bg-preview-video');
        const videoOptions = document.getElementById('custom-bg-video-options');
        const playMode = document.getElementById('custom-bg-playmode');
        const loopType = document.getElementById('custom-bg-loop-type');
        const loopCount = document.getElementById('custom-bg-loop-count');
        const loopOptions = document.getElementById('custom-bg-loop-options');
        const endOptions = document.getElementById('custom-bg-end-options');
        const endType = document.getElementById('custom-bg-endtype');
        const syncCheckbox = document.getElementById('custom-bg-sync');
        const reverseCheckbox = document.getElementById('custom-bg-reverse');
        
        const cb = this.world.customBackground;
        
        // Show/hide custom options based on background type
        if (this.world.background === 'custom') {
            customOptions.classList.remove('hidden');
        } else {
            customOptions.classList.add('hidden');
            return;
        }
        
        if (cb.enabled && cb.data) {
            // Show preview
            preview.classList.remove('hidden');
            dropzone.classList.add('hidden');
            
            if (cb.type === 'video') {
                previewImg.style.display = 'none';
                previewVideo.style.display = 'block';
                previewVideo.src = cb.data;
                previewVideo.play();
                videoOptions.classList.remove('hidden');
            } else if (cb.type === 'gif') {
                previewImg.style.display = 'block';
                previewVideo.style.display = 'none';
                previewImg.src = cb.data;
                videoOptions.classList.remove('hidden');
            } else {
                previewImg.style.display = 'block';
                previewVideo.style.display = 'none';
                previewImg.src = cb.data;
                videoOptions.classList.add('hidden');
            }
            
            // Sync video options
            if (playMode) playMode.value = cb.playMode || 'loop';
            if (loopType) loopType.value = cb.loopCount === -1 ? 'infinite' : 'set';
            if (loopCount) {
                loopCount.value = cb.loopCount > 0 ? cb.loopCount : 1;
                loopCount.style.display = cb.loopCount === -1 ? 'none' : 'block';
            }
            
            // Show/hide based on play mode
            if (cb.playMode === 'once') {
                loopOptions.classList.add('hidden');
                endOptions.classList.remove('hidden');
            } else {
                loopOptions.classList.remove('hidden');
                if (cb.loopCount === -1) {
                    endOptions.classList.add('hidden');
                } else {
                    endOptions.classList.remove('hidden');
                }
            }
            
            // Update loop label
            const loopLabel = loopOptions.querySelector('.form-label');
            if (loopLabel) {
                loopLabel.textContent = cb.playMode === 'bounce' ? 'Bounce Amount' : 'Loop Amount';
            }
            
            if (endType) endType.value = cb.endType || 'freeze';
            if (syncCheckbox) syncCheckbox.checked = cb.sameAcrossScreens || false;
            if (reverseCheckbox) reverseCheckbox.checked = cb.reverse || false;
        } else {
            // No custom background - show upload
            preview.classList.add('hidden');
            dropzone.classList.remove('hidden');
            videoOptions.classList.add('hidden');
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
    
    updateStoredDataTypeDescription(type) {
        const descEl = document.getElementById('stored-data-type-description');
        if (!descEl) return;
        
        const descriptions = {
            'json': '<strong style="color: #6bcb77;">.json:</strong> Human-readable format. Easier to debug and edit manually. Recommended for smaller maps or during development.',
            'dat': '<strong style="color: #4d96ff;">.dat:</strong> Binary format with compression. Smaller file size, faster loading. Recommended for extremely large maps with many objects or media files.'
        };
        
        descEl.innerHTML = descriptions[type] || descriptions['json'];
    }
    
    updateKeyboardLayoutInfo(layout) {
        const layouts = ['default', 'hk', 'jimmyqrg'];
        layouts.forEach(l => {
            const el = document.getElementById(`keyboard-info-${l}`);
            if (el) {
                el.style.display = l === layout ? 'block' : 'none';
            }
        });
    }
    
    updateKeyboardLayoutOptions() {
        const layoutSelect = document.getElementById('config-keyboard-layout');
        if (!layoutSelect) return;
        
        const hkEnabled = this.world.plugins.enabled.includes('hk');
        const hkOption = layoutSelect.querySelector('option[value="hk"]');
        
        if (hkOption) {
            // Disable/enable the HK layout option based on plugin status
            hkOption.disabled = !hkEnabled;
            hkOption.textContent = hkEnabled ? 'Hollow Knight Original' : 'Hollow Knight Original (requires HK plugin)';
            
            // If HK layout is selected but plugin is disabled, switch to default
            if (!hkEnabled && this.world.keyboardLayout === 'hk') {
                this.world.keyboardLayout = 'default';
                layoutSelect.value = 'default';
                this.updateKeyboardLayoutInfo('default');
            }
        }
    }
    
    handleMusicUpload(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.world.music.customData = e.target.result;
            this.world.music.customName = file.name;
            
            // Update UI
            const preview = document.getElementById('custom-music-preview');
            const dropzone = document.getElementById('custom-music-dropzone');
            const nameEl = document.getElementById('custom-music-name');
            
            nameEl.textContent = file.name;
            preview.classList.remove('hidden');
            dropzone.classList.add('hidden');
            
            // Set audio source for preview
            this.previewAudio.src = e.target.result;
            this.previewAudio.volume = this.world.music.volume / 100;
            
            this.triggerMapChange();
            this.updateMusicPlayback();
        };
        reader.readAsDataURL(file);
    }
    
    updateMusicPlayback() {
        // Stop any existing music
        if (this.bgMusic) {
            this.bgMusic.pause();
            this.bgMusic.src = '';
        }
        
        const music = this.world.music;
        if (music.type === 'none') {
            return;
        }
        
        if (!this.bgMusic) {
            this.bgMusic = new Audio();
        }
        
        let src = null;
        if (music.type === 'custom' && music.customData) {
            src = music.customData;
        } else if (music.type !== 'none') {
            // Built-in music files
            const musicFiles = {
                'maccary-bay': 'assets/mp3/maccary-bay.mp3',
                'reggae-party': 'assets/mp3/reggae-party.mp3'
            };
            src = musicFiles[music.type];
        }
        
        if (src) {
            this.bgMusic.src = src;
            this.bgMusic.volume = music.volume / 100;
            this.bgMusic.loop = music.loop;
            // Don't auto-play in editor
        }
    }
    
    startMusicPlayback() {
        // Set up the music if not already done
        this.updateMusicPlayback();
        
        // Start playing if there's music to play
        if (this.bgMusic && this.bgMusic.src && this.world.music.type !== 'none') {
            this.bgMusic.currentTime = 0;
            this.bgMusic.play().catch(err => {
                console.log('Music playback blocked by browser:', err);
            });
        }
    }
    
    stopMusicPlayback() {
        if (this.bgMusic) {
            this.bgMusic.pause();
            this.bgMusic.currentTime = 0;
        }
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
    
    setupCustomBackgroundListeners() {
        const dropzone = document.getElementById('custom-bg-dropzone');
        const fileInput = document.getElementById('custom-bg-file');
        const preview = document.getElementById('custom-bg-preview');
        const previewImg = document.getElementById('custom-bg-preview-img');
        const previewVideo = document.getElementById('custom-bg-preview-video');
        const removeBtn = document.getElementById('custom-bg-remove');
        const videoOptions = document.getElementById('custom-bg-video-options');
        const playMode = document.getElementById('custom-bg-playmode');
        const loopOptions = document.getElementById('custom-bg-loop-options');
        const loopType = document.getElementById('custom-bg-loop-type');
        const loopCount = document.getElementById('custom-bg-loop-count');
        const endOptions = document.getElementById('custom-bg-end-options');
        const endType = document.getElementById('custom-bg-endtype');
        const endUpload = document.getElementById('custom-bg-end-upload');
        const syncCheckbox = document.getElementById('custom-bg-sync');
        const reverseCheckbox = document.getElementById('custom-bg-reverse');
        
        // Dropzone click
        dropzone.addEventListener('click', () => fileInput.click());
        
        // Drag and drop
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--primary)';
            dropzone.style.background = 'rgba(45, 90, 39, 0.1)';
        });
        
        dropzone.addEventListener('dragleave', () => {
            dropzone.style.borderColor = 'var(--surface-light)';
            dropzone.style.background = 'transparent';
        });
        
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--surface-light)';
            dropzone.style.background = 'transparent';
            
            const file = e.dataTransfer.files[0];
            if (file) this.handleCustomBackgroundFile(file);
        });
        
        // File input change
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.handleCustomBackgroundFile(file);
        });
        
        // Remove button
        removeBtn.addEventListener('click', () => {
            this.world.customBackground.enabled = false;
            this.world.customBackground.type = null;
            this.world.customBackground.data = null;
            
            preview.classList.add('hidden');
            previewImg.style.display = 'none';
            previewVideo.style.display = 'none';
            videoOptions.classList.add('hidden');
            dropzone.classList.remove('hidden');
            
            this.updateBackground();
            this.triggerMapChange();
        });
        
        // Play mode change
        playMode.addEventListener('change', (e) => {
            const mode = e.target.value;
            this.world.customBackground.playMode = mode;
            
            // Update loop options label
            const loopLabel = loopOptions.querySelector('.form-label');
            if (mode === 'bounce') {
                loopLabel.textContent = 'Bounce Amount';
            } else {
                loopLabel.textContent = 'Loop Amount';
            }
            
            // Show/hide options based on mode
            if (mode === 'once') {
                loopOptions.classList.add('hidden');
                endOptions.classList.remove('hidden');
            } else {
                loopOptions.classList.remove('hidden');
                this.updateEndOptionsVisibility();
            }
            
            this.triggerMapChange();
        });
        
        // Loop type change
        loopType.addEventListener('change', (e) => {
            if (e.target.value === 'set') {
                loopCount.style.display = 'block';
                this.world.customBackground.loopCount = parseInt(loopCount.value) || 1;
            } else {
                loopCount.style.display = 'none';
                this.world.customBackground.loopCount = -1;
            }
            this.updateEndOptionsVisibility();
            this.triggerMapChange();
        });
        
        // Loop count change
        loopCount.addEventListener('change', (e) => {
            // Don't auto-correct while typing
            if (e.target.value === '') return;
            
            const val = parseInt(e.target.value);
            if (isNaN(val) || val < 1) {
                e.target.value = 1;
                this.world.customBackground.loopCount = 1;
            } else {
                this.world.customBackground.loopCount = val;
            }
            this.triggerMapChange();
        });
        
        // Handle blur to auto-correct empty value
        loopCount.addEventListener('blur', (e) => {
            if (e.target.value === '' || parseInt(e.target.value) < 1) {
                e.target.value = 1;
                this.world.customBackground.loopCount = 1;
                this.triggerMapChange();
            }
        });
        
        // End type change
        endType.addEventListener('change', (e) => {
            this.world.customBackground.endType = e.target.value;
            endUpload.classList.toggle('hidden', e.target.value !== 'replace');
            this.triggerMapChange();
        });
        
        // Sync checkbox
        syncCheckbox.addEventListener('change', (e) => {
            this.world.customBackground.sameAcrossScreens = e.target.checked;
            this.triggerMapChange();
        });
        
        // Reverse checkbox
        reverseCheckbox.addEventListener('change', (e) => {
            this.world.customBackground.reverse = e.target.checked;
            this.triggerMapChange();
        });
    }
    
    updateEndOptionsVisibility() {
        const loopType = document.getElementById('custom-bg-loop-type');
        const endOptions = document.getElementById('custom-bg-end-options');
        const playMode = document.getElementById('custom-bg-playmode');
        
        // Show end options if play once or limited loops/bounces
        if (playMode.value === 'once' || loopType.value === 'set') {
            endOptions.classList.remove('hidden');
        } else {
            endOptions.classList.add('hidden');
        }
    }
    
    handleCustomBackgroundFile(file) {
        const preview = document.getElementById('custom-bg-preview');
        const previewImg = document.getElementById('custom-bg-preview-img');
        const previewVideo = document.getElementById('custom-bg-preview-video');
        const videoOptions = document.getElementById('custom-bg-video-options');
        const dropzone = document.getElementById('custom-bg-dropzone');
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const data = e.target.result;
            const isVideo = file.type.startsWith('video/');
            const isGif = file.type === 'image/gif';
            
            this.world.customBackground.enabled = true;
            this.world.customBackground.data = data;
            this.world.customBackground.type = isVideo ? 'video' : (isGif ? 'gif' : 'image');
            
            // Show preview
            preview.classList.remove('hidden');
            dropzone.classList.add('hidden');
            
            if (isVideo) {
                previewImg.style.display = 'none';
                previewVideo.style.display = 'block';
                previewVideo.src = data;
                previewVideo.play();
                videoOptions.classList.remove('hidden');
            } else if (isGif) {
                previewImg.style.display = 'block';
                previewVideo.style.display = 'none';
                previewImg.src = data;
                videoOptions.classList.remove('hidden');
            } else {
                previewImg.style.display = 'block';
                previewVideo.style.display = 'none';
                previewImg.src = data;
                videoOptions.classList.add('hidden');
            }
            
            this.updateBackground();
            this.triggerMapChange();
        };
        
        reader.readAsDataURL(file);
    }

    // ========================================
    // TOUCH CONTROLS - Multi-touch enabled
    // ========================================
    updateTouchControls() {
        let touchControls = document.getElementById('touch-controls');
        
        if (this.engine.touchscreenMode) {
            if (!touchControls) {
                touchControls = document.createElement('div');
                touchControls.id = 'touch-controls';
                touchControls.className = 'touch-controls active';
                
                // Check if HK plugin is enabled and which abilities are active
                const hkEnabled = window.PluginManager?.isEnabled('hk');
                const hkConfig = this.world?.plugins?.hk || {};
                
                // Attack is always available when HK is enabled
                const hasAttack = hkEnabled;
                // Dash requires the dash ability to be enabled
                const hasDash = hkEnabled && hkConfig.dash;
                // Heal is always available when HK is enabled (uses soul)
                const hasHeal = hkEnabled;
                
                touchControls.innerHTML = `
                    <div class="touch-joystick-container">
                        <div class="touch-joystick-base" id="touch-joystick">
                            <div class="touch-joystick-stick"></div>
                    </div>
                    </div>
                    <div class="touch-buttons-right">
                        <button class="touch-btn touch-jump" data-action="jump">
                            <span class="material-symbols-outlined">keyboard_double_arrow_up</span>
                        </button>
                        ${hasAttack ? `
                        <button class="touch-btn touch-attack" data-action="attack">
                            <span class="material-symbols-outlined">swords</span>
                        </button>
                        ` : ''}
                        ${hasDash ? `
                        <button class="touch-btn touch-dash" data-action="dash">
                            <span class="material-symbols-outlined">bolt</span>
                        </button>
                        ` : ''}
                        ${hasHeal ? `
                        <button class="touch-btn touch-heal" data-action="heal">
                            <span class="material-symbols-outlined">favorite</span>
                        </button>
                        ` : ''}
                    </div>
                `;
                document.body.appendChild(touchControls);

                // Initialize multi-touch state
                this.touchState = {
                    joystick: { touchId: null, x: 0, y: 0 },
                    buttons: new Map() // action -> touchId
                };
                
                const joystickBase = document.getElementById('touch-joystick');
                const joystickStick = joystickBase.querySelector('.touch-joystick-stick');
                const maxDistance = 50;
                
                // Helper: Find touch by ID in a TouchList
                const findTouch = (touches, id) => {
                    for (let i = 0; i < touches.length; i++) {
                        if (touches[i].identifier === id) return touches[i];
                    }
                    return null;
                };
                
                // Joystick movement handler
                const handleJoystickMove = (touch) => {
                    const rect = joystickBase.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    
                    let dx = touch.clientX - centerX;
                    let dy = touch.clientY - centerY;
                    
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance > maxDistance) {
                        dx = (dx / distance) * maxDistance;
                        dy = (dy / distance) * maxDistance;
                    }
                    
                    joystickStick.style.transform = `translate(${dx}px, ${dy}px)`;
                    
                    // Normalize to -1 to 1
                    this.touchState.joystick.x = dx / maxDistance;
                    this.touchState.joystick.y = dy / maxDistance;
                    
                    // Update engine input
                    const threshold = 0.3;
                    const isPlayMode = this.engine.state === GameState.PLAYING;
                    const isFlying = !isPlayMode && (this.isFlying || (this.engine.localPlayer?.isFlying));
                    
                    this.engine.setTouchInput('left', this.touchState.joystick.x < -threshold);
                    this.engine.setTouchInput('right', this.touchState.joystick.x > threshold);
                    
                    if (isFlying) {
                        this.engine.setTouchInput('up', this.touchState.joystick.y < -threshold);
                        this.engine.setTouchInput('down', this.touchState.joystick.y > threshold);
                    }
                };
                
                const resetJoystick = () => {
                    joystickStick.style.transform = 'translate(0, 0)';
                    this.touchState.joystick.touchId = null;
                    this.touchState.joystick.x = 0;
                    this.touchState.joystick.y = 0;
                    
                    this.engine.setTouchInput('left', false);
                    this.engine.setTouchInput('right', false);
                    this.engine.setTouchInput('up', false);
                    this.engine.setTouchInput('down', false);
                };
                
                // JOYSTICK EVENTS - Track specific touch
                joystickBase.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Only claim if not already tracking a touch
                    if (this.touchState.joystick.touchId === null) {
                        const touch = e.changedTouches[0];
                        this.touchState.joystick.touchId = touch.identifier;
                        joystickBase.classList.add('active');
                        handleJoystickMove(touch);
                        
                        // Haptic feedback
                        if (navigator.vibrate) navigator.vibrate(10);
                    }
                }, { passive: false });
                
                joystickBase.addEventListener('touchmove', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (this.touchState.joystick.touchId !== null) {
                        const touch = findTouch(e.touches, this.touchState.joystick.touchId);
                        if (touch) {
                            handleJoystickMove(touch);
                        }
                    }
                }, { passive: false });
                
                joystickBase.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Check if our tracked touch ended
                    for (let i = 0; i < e.changedTouches.length; i++) {
                        if (e.changedTouches[i].identifier === this.touchState.joystick.touchId) {
                            joystickBase.classList.remove('active');
                            resetJoystick();
                            break;
                        }
                    }
                }, { passive: false });
                
                joystickBase.addEventListener('touchcancel', (e) => {
                    e.preventDefault();
                    joystickBase.classList.remove('active');
                    resetJoystick();
                }, { passive: false });
                
                // ACTION BUTTONS - Each tracks its own touch
                const actionButtons = touchControls.querySelectorAll('.touch-btn');
                actionButtons.forEach(btn => {
                    const action = btn.dataset.action;
                    
                    btn.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Only claim if not already tracking
                        if (!this.touchState.buttons.has(action)) {
                            const touch = e.changedTouches[0];
                            this.touchState.buttons.set(action, touch.identifier);
                            btn.classList.add('active');
                            
                            // Set input based on action
                            if (action === 'jump') {
                                this.engine.setTouchInput('jump', true);
                            } else if (action === 'attack') {
                                this.engine.setTouchInput('attack', true);
                            } else if (action === 'dash') {
                                this.engine.setTouchInput('dash', true);
                            } else if (action === 'heal') {
                                this.engine.setTouchInput('heal', true);
                            }
                            
                            // Haptic feedback
                            if (navigator.vibrate) navigator.vibrate(15);
                        }
                    }, { passive: false });
                    
                    btn.addEventListener('touchend', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Check if our tracked touch ended
                        const trackedId = this.touchState.buttons.get(action);
                        for (let i = 0; i < e.changedTouches.length; i++) {
                            if (e.changedTouches[i].identifier === trackedId) {
                                this.touchState.buttons.delete(action);
                                btn.classList.remove('active');
                                
                                // Release input
                                if (action === 'jump') {
                                    this.engine.setTouchInput('jump', false);
                                } else if (action === 'attack') {
                                    this.engine.setTouchInput('attack', false);
                                } else if (action === 'dash') {
                                    this.engine.setTouchInput('dash', false);
                                } else if (action === 'heal') {
                                    this.engine.setTouchInput('heal', false);
                                }
                                break;
                            }
                        }
                    }, { passive: false });
                    
                    btn.addEventListener('touchcancel', (e) => {
                        e.preventDefault();
                        this.touchState.buttons.delete(action);
                        btn.classList.remove('active');
                        
                        if (action === 'jump') {
                            this.engine.setTouchInput('jump', false);
                        } else if (action === 'attack') {
                            this.engine.setTouchInput('attack', false);
                        } else if (action === 'dash') {
                            this.engine.setTouchInput('dash', false);
                        } else if (action === 'heal') {
                            this.engine.setTouchInput('heal', false);
                        }
                    }, { passive: false });
                });
            }
            
            // Update button visibility based on HK plugin state
            this.updateTouchButtonVisibility();
            touchControls.classList.add('active');
            document.body.classList.add('touch-active');
        } else if (touchControls) {
            touchControls.classList.remove('active');
            document.body.classList.remove('touch-active');
        }
    }
    
    // Update which touch buttons are visible based on enabled plugins and abilities
    updateTouchButtonVisibility() {
        const touchControls = document.getElementById('touch-controls');
        if (!touchControls) return;
        
        const hkEnabled = window.PluginManager?.isEnabled('hk');
        const hkConfig = this.world?.plugins?.hk || {};
        const buttonsContainer = touchControls.querySelector('.touch-buttons-right');
        
        if (buttonsContainer) {
            const attackBtn = buttonsContainer.querySelector('.touch-attack');
            const dashBtn = buttonsContainer.querySelector('.touch-dash');
            const healBtn = buttonsContainer.querySelector('.touch-heal');
            
            // Check what should be visible
            const shouldShowAttack = hkEnabled;
            const shouldShowDash = hkEnabled && hkConfig.dash;
            const shouldShowHeal = hkEnabled;
            
            // Check if we need to recreate (button exists but shouldn't, or should exist but doesn't)
            const needsRecreate = 
                (shouldShowAttack && !attackBtn) || 
                (!shouldShowAttack && attackBtn) ||
                (shouldShowDash && !dashBtn) || 
                (!shouldShowDash && dashBtn) ||
                (shouldShowHeal && !healBtn) || 
                (!shouldShowHeal && healBtn);
            
            if (needsRecreate) {
                touchControls.remove();
                this.updateTouchControls();
                return;
            }
            
            // Update visibility of existing buttons
            if (attackBtn) attackBtn.style.display = shouldShowAttack ? '' : 'none';
            if (dashBtn) dashBtn.style.display = shouldShowDash ? '' : 'none';
            if (healBtn) healBtn.style.display = shouldShowHeal ? '' : 'none';
        }
    }
    
    // Called when plugin settings change to refresh touch controls
    refreshTouchControls() {
        const touchControls = document.getElementById('touch-controls');
        if (touchControls && this.engine.touchscreenMode) {
            touchControls.remove();
            this.updateTouchControls();
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

        // Selection highlights
        if (this.isSelectionActive && this.selectedObjects.size > 0 && this.engine.state === GameState.EDITOR) {
            ctx.save();
            for (const obj of this.selectedObjects) {
                const sx = obj.x - camera.x;
                const sy = obj.y - camera.y;
                const w = obj.width;
                const h = obj.height;
                
                // Fill with semi-transparent blue
                ctx.fillStyle = 'rgba(66, 133, 244, 0.2)';
                ctx.fillRect(sx, sy, w, h);
                
                // Border
                ctx.strokeStyle = '#4285f4';
                ctx.lineWidth = 2 / camera.zoom;
                ctx.setLineDash([6 / camera.zoom, 3 / camera.zoom]);
                ctx.strokeRect(sx, sy, w, h);
            }
            ctx.setLineDash([]);
            ctx.restore();
        }
        
        // Quot selection rectangle preview
        if (this.isSelectionActive && this.selectionRect && this.engine.state === GameState.EDITOR) {
            const { startX, startY, endX, endY } = this.selectionRect;
            const rx = Math.min(startX, endX) - camera.x;
            const ry = Math.min(startY, endY) - camera.y;
            const rw = Math.abs(endX - startX) + GRID_SIZE;
            const rh = Math.abs(endY - startY) + GRID_SIZE;
            
            const isDeselect = this.selectionAction === SelectionAction.DESELECT;
            
            ctx.fillStyle = isDeselect ? 'rgba(244, 67, 54, 0.15)' : 'rgba(66, 133, 244, 0.15)';
            ctx.fillRect(rx, ry, rw, rh);
            ctx.strokeStyle = isDeselect ? '#f44336' : '#4285f4';
            ctx.lineWidth = 2 / camera.zoom;
            ctx.setLineDash([8 / camera.zoom, 4 / camera.zoom]);
            ctx.strokeRect(rx, ry, rw, rh);
            ctx.setLineDash([]);
        }

        // Hover highlight (from canvas hover)
        // Note: ctx already has camera.zoom applied via ctx.scale()
        if (this.hoveredObject && this.engine.state === GameState.EDITOR) {
            const screenX = this.hoveredObject.x - camera.x;
            const screenY = this.hoveredObject.y - camera.y;
            const width = this.hoveredObject.width;
            const height = this.hoveredObject.height;

            ctx.strokeStyle = '#f4a261';
            ctx.lineWidth = 2 / camera.zoom;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(screenX, screenY, width, height);
            ctx.setLineDash([]);
        }
        
        // Layer panel hover highlight - inverse color box
        if (this.highlightedLayerObject && this.engine.state === GameState.EDITOR) {
            const obj = this.highlightedLayerObject;
            const screenX = obj.x - camera.x;
            const screenY = obj.y - camera.y;
            const width = obj.width;
            const height = obj.height;
            
            // Draw inverse color highlight box
            ctx.save();
            ctx.globalCompositeOperation = 'difference';
            ctx.fillStyle = '#FFFFFF';
            const pad = 4 / camera.zoom;
            ctx.fillRect(screenX - pad, screenY - pad, width + pad * 2, height + pad * 2);
            ctx.restore();
            
            // Also draw a bright border for visibility
            ctx.strokeStyle = '#00FFFF';
            ctx.lineWidth = 3 / camera.zoom;
            const pad2 = 2 / camera.zoom;
            ctx.strokeRect(screenX - pad2, screenY - pad2, width + pad2 * 2, height + pad2 * 2);
        }
        
        // Eraser size indicator
        if (this.isErasing && this.engine.state === GameState.EDITOR) {
            const worldPos = this.engine.getMouseWorldPos();
            const gridPos = this.engine.getGridAlignedPos(worldPos.x, worldPos.y);
            
            // Calculate eraser rectangle (centered on grid position)
            const eraserWidth = this.eraseSettings.width * GRID_SIZE;
            const eraserHeight = this.eraseSettings.height * GRID_SIZE;
            const halfW = Math.floor(this.eraseSettings.width / 2) * GRID_SIZE;
            const halfH = Math.floor(this.eraseSettings.height / 2) * GRID_SIZE;
            const eraserX = gridPos.x - halfW;
            const eraserY = gridPos.y - halfH;
            
            const screenX = eraserX - camera.x;
            const screenY = eraserY - camera.y;
            
            // Draw eraser area
            ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
            ctx.fillRect(screenX, screenY, eraserWidth, eraserHeight);
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 2 / camera.zoom;
            ctx.setLineDash([6 / camera.zoom, 3 / camera.zoom]);
            ctx.strokeRect(screenX, screenY, eraserWidth, eraserHeight);
            ctx.setLineDash([]);
        }

        // Placement preview
        if (this.placementMode !== PlacementMode.NONE) {
            // Zone placement preview (rectangle)
            if (this.zonePlacement.isPlacing) {
                const { startX, startY, endX, endY } = this.zonePlacement;
                const x = Math.min(startX, endX);
                const y = Math.min(startY, endY);
                const width = Math.abs(endX - startX) + GRID_SIZE;
                const height = Math.abs(endY - startY) + GRID_SIZE;
                
                const screenX = x - camera.x;
                const screenY = y - camera.y;
                const screenW = width;
                const screenH = height;
                
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.fillRect(screenX, screenY, screenW, screenH);
                ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
                ctx.lineWidth = 2 / camera.zoom;
                ctx.setLineDash([8 / camera.zoom, 4 / camera.zoom]);
                ctx.strokeRect(screenX, screenY, screenW, screenH);
                ctx.setLineDash([]);
            } else if (this.obstaclePlacement.isPlacing) {
                // Spinner placement preview (oval/rectangle)
                const { startX, startY, endX, endY } = this.obstaclePlacement;
                const x = Math.min(startX, endX);
                const y = Math.min(startY, endY);
                const width = Math.max(Math.abs(endX - startX) + GRID_SIZE, GRID_SIZE * 2);
                const height = Math.max(Math.abs(endY - startY) + GRID_SIZE, GRID_SIZE * 2);
                
                const screenX = x - camera.x;
                const screenY = y - camera.y;
                const centerX = screenX + width / 2;
                const centerY = screenY + height / 2;
                
                // Draw ellipse preview
                ctx.beginPath();
                ctx.ellipse(centerX, centerY, width / 2, height / 2, 0, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 100, 100, 1)';
                ctx.lineWidth = 2 / camera.zoom;
                ctx.setLineDash([8 / camera.zoom, 4 / camera.zoom]);
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (this.buttonPlacement.isPlacing) {
                // Button placement preview
                const { startX, startY, endX, endY } = this.buttonPlacement;
                const x = Math.min(startX, endX);
                const y = Math.min(startY, endY);
                const width = Math.abs(endX - startX) + GRID_SIZE;
                const height = Math.abs(endY - startY) + GRID_SIZE;
                
                const screenX = x - camera.x;
                const screenY = y - camera.y;
                
                ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
                ctx.fillRect(screenX, screenY, width, height);
                ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)';
                ctx.lineWidth = 2 / camera.zoom;
                ctx.setLineDash([8 / camera.zoom, 4 / camera.zoom]);
                ctx.strokeRect(screenX, screenY, width, height);
                ctx.setLineDash([]);
            } else {
                // Normal placement preview
            const worldPos = this.engine.getMouseWorldPos();
            const gridPos = this.engine.getGridAlignedPos(worldPos.x, worldPos.y);
                const screenX = gridPos.x - camera.x;
                const screenY = gridPos.y - camera.y;
                const size = GRID_SIZE;

            ctx.fillStyle = 'rgba(45, 90, 39, 0.5)';
            ctx.fillRect(screenX, screenY, size, size);
            ctx.strokeStyle = '#4a8c3f';
                ctx.lineWidth = 2 / camera.zoom;
            ctx.strokeRect(screenX, screenY, size, size);
            }
        }
        
        // Zone adjustment handles
        if (this.zoneAdjustment.active && this.zoneAdjustment.zone) {
            this.renderZoneAdjustmentHandles(ctx, camera);
        }
        
        // Touchbox debug overlay (works in both editor and test modes)
        if (this.showTouchboxes) {
            this.renderTouchboxes(ctx, camera);
        }
    }
    
    renderZoneAdjustmentHandles(ctx, camera) {
        const zone = this.zoneAdjustment.zone;
        const handleSize = 12 / camera.zoom;
        
        const screenX = zone.x - camera.x;
        const screenY = zone.y - camera.y;
        const screenW = zone.width;
        const screenH = zone.height;
        
        // Draw zone highlight (white to match zone style)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 / camera.zoom;
        ctx.setLineDash([]);
        ctx.strokeRect(screenX, screenY, screenW, screenH);
        
        // Dragger positions
        const draggers = [
            { x: screenX, y: screenY, cursor: 'nw-resize', name: 'top-left' },
            { x: screenX + screenW / 2, y: screenY, cursor: 'n-resize', name: 'top' },
            { x: screenX + screenW, y: screenY, cursor: 'ne-resize', name: 'top-right' },
            { x: screenX, y: screenY + screenH / 2, cursor: 'w-resize', name: 'left' },
            { x: screenX + screenW, y: screenY + screenH / 2, cursor: 'e-resize', name: 'right' },
            { x: screenX, y: screenY + screenH, cursor: 'sw-resize', name: 'bottom-left' },
            { x: screenX + screenW / 2, y: screenY + screenH, cursor: 'n-resize', name: 'bottom' },
            { x: screenX + screenW, y: screenY + screenH, cursor: 'se-resize', name: 'bottom-right' }
        ];
        
        for (const d of draggers) {
            // Handle background (dark for contrast against white border)
            ctx.fillStyle = '#333';
            ctx.fillRect(d.x - handleSize / 2, d.y - handleSize / 2, handleSize, handleSize);
            
            // Handle border (white to match zone)
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2 / camera.zoom;
            ctx.strokeRect(d.x - handleSize / 2, d.y - handleSize / 2, handleSize, handleSize);
        }
    }
    
    renderDieLine(ctx, camera) {
        const dieLineY = this.world.dieLineY ?? 2000;
        const screenY = (dieLineY - camera.y) * camera.zoom;

        if (screenY < -100 || screenY > camera.height + 100) return;

        // Draw in screen pixel coordinates to guarantee viewport-relative positioning
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        ctx.strokeStyle = '#ff3333';
        ctx.lineWidth = 3;
        ctx.setLineDash([15, 10]);

        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(camera.width, screenY);
        ctx.stroke();

        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = '#ff3333';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.setLineDash([]);

        const text = '☠ DEATH LINE - Players die below this point';
        const textWidth = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, screenY - 24, textWidth + 10, 22);

        ctx.fillStyle = '#ff3333';
        ctx.fillText(text, 15, screenY - 6);

        ctx.restore();
    }

    renderTouchboxes(ctx, camera) {
        const lw = 2 / camera.zoom;
        const vpW = camera.width / camera.zoom;
        const vpH = camera.height / camera.zoom;

        ctx.save();
        ctx.lineWidth = lw;
        ctx.setLineDash([]);

        const drawBox = (bx, by, bw, bh, color) => {
            const sx = bx - camera.x;
            const sy = by - camera.y;
            if (sx + bw < 0 || sx > vpW || sy + bh < 0 || sy > vpH) return;
            ctx.strokeStyle = color;
            ctx.strokeRect(sx, sy, bw, bh);
        };

        const objects = this.world?.objects;
        if (objects) {
            const gs = GRID_SIZE;
            const collisionBlocks = [];
            const nonMergeableCollision = [];

            for (let i = 0; i < objects.length; i++) {
                const obj = objects[i];
                const at = obj.appearanceType;
                const act = obj.actingType;

                if (act === 'spike' || obj.type === 'spinner' || at === 'spinner') {
                    if (obj.type === 'spinner' || at === 'spinner') {
                        const cx = obj.x + obj.width / 2 - camera.x;
                        const cy = obj.y + obj.height / 2 - camera.y;
                        const r = Math.min(obj.width, obj.height) / 2;
                        ctx.strokeStyle = '#ff0000';
                        ctx.beginPath();
                        ctx.arc(cx, cy, r, 0, Math.PI * 2);
                        ctx.stroke();
                    } else {
                        const spikeMode = obj.spikeTouchbox || this.world?.spikeTouchbox || 'normal';
                        const player = this.engine.localPlayer;
                        if (spikeMode === 'full') {
                            drawBox(obj.x, obj.y, obj.width, obj.height, '#ff0000');
                        } else if (spikeMode === 'ground') {
                            drawBox(obj.x, obj.y, obj.width, obj.height, '#2196f3');
                        } else if (player && (spikeMode === 'normal' || spikeMode === 'tip')) {
                            if (spikeMode === 'normal') {
                                const d = player.getSpikeDanger(obj);
                                drawBox(d.x, d.y, d.width, d.height, '#ff0000');
                            } else {
                                const t = player.getSpikeTip(obj);
                                drawBox(t.x, t.y, t.width, t.height, '#ff0000');
                            }
                            const f = player.getSpikeFlat(obj);
                            drawBox(f.x, f.y, f.width, f.height, '#2196f3');
                        }
                    }
                } else if (at === 'zone' || at === 'button') {
                    drawBox(obj.x, obj.y, obj.width, obj.height, '#a855f7');
                } else if (obj.type === 'teleportal' || at === 'teleportal') {
                    drawBox(obj.x, obj.y, obj.width, obj.height, '#00e5ff');
                } else if (at === 'spawnpoint' || at === 'endpoint' || at === 'checkpoint') {
                    drawBox(obj.x, obj.y, obj.width, obj.height, '#4caf50');
                } else if (obj.collision) {
                    if (obj.type === 'block' && obj.rotation === 0 && !obj.flipHorizontal &&
                        obj.width === gs && obj.height === gs &&
                        Math.round(obj.x) % gs === 0 && Math.round(obj.y) % gs === 0) {
                        collisionBlocks.push(obj);
                    } else {
                        nonMergeableCollision.push(obj);
                    }
                }
            }

            // Greedy-merge collision blocks into larger rectangles
            if (collisionBlocks.length > 0) {
                const grid = new Set();
                for (let i = 0; i < collisionBlocks.length; i++) {
                    const gx = Math.round(collisionBlocks[i].x / gs);
                    const gy = Math.round(collisionBlocks[i].y / gs);
                    grid.add(`${gx},${gy}`);
                }
                collisionBlocks.sort((a, b) => {
                    const ay = Math.round(a.y / gs), by = Math.round(b.y / gs);
                    if (ay !== by) return ay - by;
                    return Math.round(a.x / gs) - Math.round(b.x / gs);
                });
                const visited = new Set();
                for (let i = 0; i < collisionBlocks.length; i++) {
                    const startGx = Math.round(collisionBlocks[i].x / gs);
                    const startGy = Math.round(collisionBlocks[i].y / gs);
                    const sk = `${startGx},${startGy}`;
                    if (visited.has(sk)) continue;

                    let endGx = startGx;
                    while (grid.has(`${endGx + 1},${startGy}`) && !visited.has(`${endGx + 1},${startGy}`)) endGx++;

                    let endGy = startGy;
                    let canExtend = true;
                    while (canExtend) {
                        const ny = endGy + 1;
                        for (let gx = startGx; gx <= endGx; gx++) {
                            if (!grid.has(`${gx},${ny}`) || visited.has(`${gx},${ny}`)) { canExtend = false; break; }
                        }
                        if (canExtend) endGy = ny;
                    }

                    for (let gy = startGy; gy <= endGy; gy++) {
                        for (let gx = startGx; gx <= endGx; gx++) {
                            visited.add(`${gx},${gy}`);
                        }
                    }

                    drawBox(startGx * gs, startGy * gs, (endGx - startGx + 1) * gs, (endGy - startGy + 1) * gs, '#2196f3');
                }
            }

            for (let i = 0; i < nonMergeableCollision.length; i++) {
                const obj = nonMergeableCollision[i];
                drawBox(obj.x, obj.y, obj.width, obj.height, '#2196f3');
            }
        }

        // Player touchboxes
        const player = this.engine.localPlayer;
        if (player && !player.isDead) {
            const gt = player.getGroundTouchbox();
            drawBox(gt.x, gt.y, gt.width, gt.height, '#ffeb3b');

            const ht = player.getHurtTouchbox();
            drawBox(ht.x, ht.y, ht.width, ht.height, '#ff9800');
        }
        
        ctx.restore();
    }

    renderGrid(ctx, camera) {
        if (!this.showGrid) return;
        
        const bg = this.world?.background || 'sky';
        const useDark = (bg === 'sky');
        const r = useDark ? 0 : 255;
        const g = useDark ? 0 : 255;
        const b = useDark ? 0 : 255;
        
        const startX = Math.floor(camera.x / GRID_SIZE) * GRID_SIZE;
        const startY = Math.floor(camera.y / GRID_SIZE) * GRID_SIZE;
        const endX = camera.x + camera.width / camera.zoom + GRID_SIZE;
        const endY = camera.y + camera.height / camera.zoom + GRID_SIZE;

        const viewStartX = startX - camera.x;
        const viewStartY = startY - camera.y;
        const viewEndX = viewStartX + (endX - startX);
        const viewEndY = viewStartY + (endY - startY);

        // Minor grid lines
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
        ctx.lineWidth = 0.5 / camera.zoom;

            ctx.beginPath();
        for (let x = startX; x < endX; x += GRID_SIZE) {
            if (x % (GRID_SIZE * 5) === 0) continue;
            const screenX = x - camera.x;
            ctx.moveTo(screenX, viewStartY);
            ctx.lineTo(screenX, viewEndY);
        }
        for (let y = startY; y < endY; y += GRID_SIZE) {
            if (y % (GRID_SIZE * 5) === 0) continue;
            const screenY = y - camera.y;
            ctx.moveTo(viewStartX, screenY);
            ctx.lineTo(viewEndX, screenY);
        }
        ctx.stroke();
        
        // Major grid lines (every 5 cells)
        const majorStart = Math.floor(camera.x / (GRID_SIZE * 5)) * GRID_SIZE * 5;
        const majorStartY = Math.floor(camera.y / (GRID_SIZE * 5)) * GRID_SIZE * 5;
        
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.55)`;
        ctx.lineWidth = 1 / camera.zoom;
        
            ctx.beginPath();
        for (let x = majorStart; x < endX; x += GRID_SIZE * 5) {
            const screenX = x - camera.x;
            ctx.moveTo(screenX, viewStartY);
            ctx.lineTo(screenX, viewEndY);
        }
        for (let y = majorStartY; y < endY; y += GRID_SIZE * 5) {
            const screenY = y - camera.y;
            ctx.moveTo(viewStartX, screenY);
            ctx.lineTo(viewEndX, screenY);
        }
            ctx.stroke();
        
        // Origin lines (x=0 and y=0)
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.75)`;
        ctx.lineWidth = 2 / camera.zoom;
        
        ctx.beginPath();
        if (0 >= camera.x - GRID_SIZE && 0 <= camera.x + camera.width / camera.zoom + GRID_SIZE) {
            const originScreenX = 0 - camera.x;
            ctx.moveTo(originScreenX, viewStartY);
            ctx.lineTo(originScreenX, viewEndY);
        }
        if (0 >= camera.y - GRID_SIZE && 0 <= camera.y + camera.height / camera.zoom + GRID_SIZE) {
            const originScreenY = 0 - camera.y;
            ctx.moveTo(viewStartX, originScreenY);
            ctx.lineTo(viewEndX, originScreenY);
        }
        ctx.stroke();
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
