/**
 * HP Plugin - Global Variables
 */

// Default configuration
const HP_DEFAULTS = {
    defaultHP: 3,
    invincibilityTime: 1000, // ms of invincibility after taking damage
    safeGroundHistorySize: 60 // Number of safe ground positions to track
};

// Player HP state (will be attached to player objects)
// This defines what properties HP plugin adds to players
const HP_PLAYER_PROPS = {
    hp: 3,
    maxHP: 3,
    useHPSystem: true,
    invincibleUntil: 0,
    safeGroundHistory: [] // Array of { x, y, time }
};
