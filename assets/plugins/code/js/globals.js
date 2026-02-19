/**
 * Code Plugin - Global Constants and Data Structures
 */

// Reserved trigger names (cannot be used, case-insensitive)
const CODE_RESERVED_NAMES = ['player', 'custom', 'trigger'];

// Trigger Types (sorted alphabetically by label for UI)
const CODE_TRIGGER_TYPES = {
    GAME_STARTS: 'gameStarts',
    PLAYER_ACTION_INPUT: 'playerActionInput',
    PLAYER_ENTER_ZONE: 'playerEnterZone',
    PLAYER_KEY_INPUT: 'playerKeyInput',
    PLAYER_LEAVE_ZONE: 'playerLeaveZone',
    PLAYER_STATS: 'playerStats',
    REPEAT: 'repeat'
};

// Trigger type labels and descriptions (for UI, sorted alphabetically)
const CODE_TRIGGER_TYPE_INFO = [
    { id: CODE_TRIGGER_TYPES.GAME_STARTS, label: 'Game Starts', description: 'Fires once when the game begins' },
    { id: CODE_TRIGGER_TYPES.PLAYER_ACTION_INPUT, label: 'Player Action Input', description: 'When player performs a specific action' },
    { id: CODE_TRIGGER_TYPES.PLAYER_ENTER_ZONE, label: 'Player Enter Zone', description: 'When player enters a zone' },
    { id: CODE_TRIGGER_TYPES.PLAYER_KEY_INPUT, label: 'Player Key Input', description: 'When specific keys are pressed' },
    { id: CODE_TRIGGER_TYPES.PLAYER_LEAVE_ZONE, label: 'Player Leave Zone', description: 'When player leaves a zone' },
    { id: CODE_TRIGGER_TYPES.PLAYER_STATS, label: 'Player Stats', description: 'When player stats match a condition' },
    { id: CODE_TRIGGER_TYPES.REPEAT, label: 'Repeat', description: 'Fires repeatedly at an interval' }
].sort((a, b) => a.label.localeCompare(b.label));

// Player Action Input Options (sorted alphabetically by label)
const CODE_PLAYER_ACTIONS = [
    { id: 'airJump', label: 'Air Jump' },
    { id: 'die', label: 'Die' },
    { id: 'doJumpForTime', label: 'Do a [number]s Jump', hasValue: true, valueType: 'number', valuePlaceholder: 'seconds' },
    { id: 'fall', label: 'Fall' },
    { id: 'fallForDistance', label: 'Fall for [distance]', hasValue: true, valueType: 'number', valuePlaceholder: 'pixels' },
    { id: 'fallForTime', label: 'Fall for [time]', hasValue: true, valueType: 'number', valuePlaceholder: 'seconds' },
    { id: 'groundJump', label: 'Ground Jump' },
    { id: 'jump', label: 'Jump' },
    { id: 'move', label: 'Move' },
    { id: 'moveHorizontally', label: 'Move Horizontally' },
    { id: 'moveLeft', label: 'Move Left' },
    { id: 'moveRight', label: 'Move Right' },
    { id: 'sendMessage', label: 'Send Message' },
    { id: 'sendMessageContains', label: 'Send Message that Contains Content [text]', hasValue: true, valueType: 'text', valuePlaceholder: 'text to contain' },
    { id: 'sendMessageExact', label: 'Send Message with Exact Content [text]', hasValue: true, valueType: 'text', valuePlaceholder: 'exact message' },
    { id: 'sendMessageExcludes', label: 'Send Message that Excludes Content [text]', hasValue: true, valueType: 'text', valuePlaceholder: 'text to exclude' },
    { id: 'teleport', label: 'Teleport' },
    { id: 'touchOtherPlayer', label: 'Touch Other Player' }
].sort((a, b) => a.label.localeCompare(b.label));

// Player Stats Options (sorted alphabetically by label)
const CODE_PLAYER_STATS = [
    { id: 'color', label: 'Color' },
    { id: 'displayName', label: 'Display Name' },
    { id: 'hostOrGuest', label: 'Host or Guest' },
    { id: 'tag', label: 'Tag' },
    { id: 'username', label: 'Username' }
].sort((a, b) => a.label.localeCompare(b.label));

// Keyboard Keys (organized by category)
const CODE_KEYBOARD_KEYS = [
    // Special groups
    { id: 'any', label: 'Any Key', category: 'special' },
    { id: 'all', label: 'All Keys', category: 'special' },
    { id: 'allAlphabet', label: 'All Alphabet Keys', category: 'special' },
    { id: 'allNumbers', label: 'All Numbers', category: 'special' },
    { id: 'allAlphanumeric', label: 'All Numbers & Alphabet', category: 'special' },
    // Common
    { id: 'Space', label: 'Space', category: 'common' },
    { id: 'Enter', label: 'Enter', category: 'common' },
    { id: 'Tab', label: 'Tab', category: 'common' },
    { id: 'Escape', label: 'Escape', category: 'common' },
    { id: 'Backspace', label: 'Backspace', category: 'common' },
    // Mouse
    { id: 'Mouse0', label: 'Mouse1', category: 'mouse' },
    { id: 'Mouse1', label: 'Mouse2', category: 'mouse' },
    { id: 'Mouse2', label: 'Mouse3', category: 'mouse' },
    { id: 'Mouse3', label: 'Mouse4', category: 'mouse' },
    { id: 'Mouse4', label: 'Mouse5', category: 'mouse' },
    { id: 'Mouse5', label: 'Mouse6', category: 'mouse' },
    { id: 'Mouse6', label: 'Mouse7', category: 'mouse' },
    { id: 'Mouse7', label: 'Mouse8', category: 'mouse' },
    { id: 'Mouse8', label: 'Mouse9', category: 'mouse' },
    // Alphabet
    { id: 'KeyA', label: 'A', category: 'alphabet' },
    { id: 'KeyB', label: 'B', category: 'alphabet' },
    { id: 'KeyC', label: 'C', category: 'alphabet' },
    { id: 'KeyD', label: 'D', category: 'alphabet' },
    { id: 'KeyE', label: 'E', category: 'alphabet' },
    { id: 'KeyF', label: 'F', category: 'alphabet' },
    { id: 'KeyG', label: 'G', category: 'alphabet' },
    { id: 'KeyH', label: 'H', category: 'alphabet' },
    { id: 'KeyI', label: 'I', category: 'alphabet' },
    { id: 'KeyJ', label: 'J', category: 'alphabet' },
    { id: 'KeyK', label: 'K', category: 'alphabet' },
    { id: 'KeyL', label: 'L', category: 'alphabet' },
    { id: 'KeyM', label: 'M', category: 'alphabet' },
    { id: 'KeyN', label: 'N', category: 'alphabet' },
    { id: 'KeyO', label: 'O', category: 'alphabet' },
    { id: 'KeyP', label: 'P', category: 'alphabet' },
    { id: 'KeyQ', label: 'Q', category: 'alphabet' },
    { id: 'KeyR', label: 'R', category: 'alphabet' },
    { id: 'KeyS', label: 'S', category: 'alphabet' },
    { id: 'KeyT', label: 'T', category: 'alphabet' },
    { id: 'KeyU', label: 'U', category: 'alphabet' },
    { id: 'KeyV', label: 'V', category: 'alphabet' },
    { id: 'KeyW', label: 'W', category: 'alphabet' },
    { id: 'KeyX', label: 'X', category: 'alphabet' },
    { id: 'KeyY', label: 'Y', category: 'alphabet' },
    { id: 'KeyZ', label: 'Z', category: 'alphabet' },
    // Numbers
    { id: 'Digit0', label: '0', category: 'number' },
    { id: 'Digit1', label: '1', category: 'number' },
    { id: 'Digit2', label: '2', category: 'number' },
    { id: 'Digit3', label: '3', category: 'number' },
    { id: 'Digit4', label: '4', category: 'number' },
    { id: 'Digit5', label: '5', category: 'number' },
    { id: 'Digit6', label: '6', category: 'number' },
    { id: 'Digit7', label: '7', category: 'number' },
    { id: 'Digit8', label: '8', category: 'number' },
    { id: 'Digit9', label: '9', category: 'number' },
    // Modifiers
    { id: 'ShiftLeft', label: 'Left Shift', category: 'modifier' },
    { id: 'ShiftRight', label: 'Right Shift', category: 'modifier' },
    { id: 'ControlLeft', label: 'Control (Mac) / Ctrl (Windows)', category: 'modifier' },
    { id: 'ControlRight', label: 'Right Ctrl', category: 'modifier' },
    { id: 'MetaLeft', label: 'Command (Mac) / Win (Windows)', category: 'modifier' },
    { id: 'MetaRight', label: 'Right Command/Win', category: 'modifier' },
    { id: 'AltLeft', label: 'Option (Mac) / Alt (Windows)', category: 'modifier' },
    { id: 'AltRight', label: 'Right Option/Alt', category: 'modifier' },
    { id: 'CapsLock', label: 'Caps Lock', category: 'modifier' },
    // Arrows
    { id: 'ArrowUp', label: '↑ (Up)', category: 'arrow' },
    { id: 'ArrowDown', label: '↓ (Down)', category: 'arrow' },
    { id: 'ArrowLeft', label: '← (Left)', category: 'arrow' },
    { id: 'ArrowRight', label: '→ (Right)', category: 'arrow' },
    // Punctuation
    { id: 'Comma', label: ', (Comma)', category: 'punctuation' },
    { id: 'Period', label: '. (Period)', category: 'punctuation' },
    { id: 'Slash', label: '/ (Slash)', category: 'punctuation' },
    { id: 'Semicolon', label: '; (Semicolon)', category: 'punctuation' },
    { id: 'Quote', label: "' (Quote)", category: 'punctuation' },
    { id: 'BracketLeft', label: '[ (Left Bracket)', category: 'punctuation' },
    { id: 'BracketRight', label: '] (Right Bracket)', category: 'punctuation' },
    { id: 'Backslash', label: '\\ (Backslash)', category: 'punctuation' },
    { id: 'Backquote', label: '` (Backtick)', category: 'punctuation' },
    { id: 'Minus', label: '- (Minus)', category: 'punctuation' },
    { id: 'Equal', label: '= (Equal)', category: 'punctuation' },
    // Function keys
    { id: 'F1', label: 'F1', category: 'function' },
    { id: 'F2', label: 'F2', category: 'function' },
    { id: 'F3', label: 'F3', category: 'function' },
    { id: 'F4', label: 'F4', category: 'function' },
    { id: 'F5', label: 'F5', category: 'function' },
    { id: 'F6', label: 'F6', category: 'function' },
    { id: 'F7', label: 'F7', category: 'function' },
    { id: 'F8', label: 'F8', category: 'function' },
    { id: 'F9', label: 'F9', category: 'function' },
    { id: 'F10', label: 'F10', category: 'function' },
    { id: 'F11', label: 'F11', category: 'function' },
    { id: 'F12', label: 'F12', category: 'function' },
    // Navigation
    { id: 'Delete', label: 'Delete', category: 'navigation' },
    { id: 'Insert', label: 'Insert', category: 'navigation' },
    { id: 'Home', label: 'Home', category: 'navigation' },
    { id: 'End', label: 'End', category: 'navigation' },
    { id: 'PageUp', label: 'Page Up', category: 'navigation' },
    { id: 'PageDown', label: 'Page Down', category: 'navigation' },
    // Other (custom input - captures next keypress)
    { id: 'other', label: 'Other (Press to capture)', category: 'other' }
];

// Repeat Time Units
const CODE_TIME_UNITS = [
    { id: 'ticks', label: 'ticks', labelSingular: 'tick' },
    { id: 'seconds', label: 'seconds', labelSingular: 'second' },
    { id: 'minutes', label: 'minutes', labelSingular: 'minute' }
];

// Code Block Types
const CODE_BLOCK_TYPES = {
    TRIGGER: 'trigger',
    ACTION: 'action'
};

// Default trigger template
const CODE_DEFAULT_TRIGGER = {
    id: '',
    name: 'New Trigger',
    type: CODE_BLOCK_TYPES.TRIGGER,
    enabled: true,
    triggerType: CODE_TRIGGER_TYPES.GAME_STARTS,
    config: {}
};

// Default action template
const CODE_DEFAULT_ACTION = {
    id: '',
    name: 'New Action',
    type: CODE_BLOCK_TYPES.ACTION,
    enabled: true,
    code: ''
};

// Plugin state (runtime, not persisted)
const CODE_STATE = {
    isEditorOpen: false,
    hasUnsavedChanges: false
};

// Export for use in other files
if (typeof window !== 'undefined') {
    window.CODE_RESERVED_NAMES = CODE_RESERVED_NAMES;
    window.CODE_TRIGGER_TYPES = CODE_TRIGGER_TYPES;
    window.CODE_TRIGGER_TYPE_INFO = CODE_TRIGGER_TYPE_INFO;
    window.CODE_PLAYER_ACTIONS = CODE_PLAYER_ACTIONS;
    window.CODE_PLAYER_STATS = CODE_PLAYER_STATS;
    window.CODE_KEYBOARD_KEYS = CODE_KEYBOARD_KEYS;
    window.CODE_TIME_UNITS = CODE_TIME_UNITS;
    window.CODE_BLOCK_TYPES = CODE_BLOCK_TYPES;
    window.CODE_DEFAULT_TRIGGER = CODE_DEFAULT_TRIGGER;
    window.CODE_DEFAULT_ACTION = CODE_DEFAULT_ACTION;
    window.CODE_STATE = CODE_STATE;
}
