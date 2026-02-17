/**
 * Hollow Knight Plugin - Global Variables
 */

// Default configuration
const HK_DEFAULTS = {
    maxSoul: 99,
    soulPerHit: 16.5,
    healCost: 33,
    healDuration: 900, // ms
    dashDuration: 150, // ms
    dashCooldown: 400, // ms
    dashSpeed: 12,
    superDashChargeDuration: 800, // ms
    superDashSpeed: 20,
    attackDuration: 200, // ms
    attackCooldown: 100, // ms
    attackRange: 40,
    pogoBouncePower: 0.4, // Fraction of normal jump
    monarchWingJumpPower: 0.9 // Fraction of normal jump
};

// Player HK state (will be attached to player objects)
const HK_PLAYER_PROPS = {
    // Soul
    soul: 0,
    maxSoul: 99,
    
    // Facing direction (1 = right, -1 = left)
    facingDirection: 1,
    
    // Attack state
    isAttacking: false,
    attackDirection: 'forward', // 'forward', 'up', 'down'
    attackStartTime: 0,
    attackCooldown: 0,
    
    // Monarch Wing
    hasMonarchWing: false,
    monarchWingAmount: 1,
    monarchWingsUsed: 0,
    
    // Dash
    hasDash: false,
    isDashing: false,
    dashStartTime: 0,
    dashCooldown: 0,
    dashDirection: 1,
    
    // Super Dash
    hasSuperDash: false,
    isSuperDashing: false,
    superDashCharging: false,
    superDashChargeStart: 0,
    superDashDirection: 1,
    _playedCharge2: false,
    
    // Heal
    isHealing: false,
    healStartTime: 0,
    
    // Mantis Claw
    hasMantisClaw: false,
    isWallClinging: false,
    wallClingDirection: 0,
    wallJumpCooldown: 0,
    wallSlideSpeed: 2
};

// Input bindings
const HK_INPUTS = {
    attack: 'KeyX',
    dash: 'Comma',
    superDash: 'Period',
    heal: 'KeyF'
};
