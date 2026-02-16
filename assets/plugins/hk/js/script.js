/**
 * Hollow Knight Plugin - Additional Script
 * Contains helper classes and utilities
 */

// Soul Status object type (can be placed in editor)
// This would be registered when the plugin system supports custom object types
const HK_SOUL_STATUS = {
    type: 'soulStatus',
    name: 'Soul Status',
    description: 'Enemies that give soul when attacked',
    icon: '👻',
    defaultWidth: 32,
    defaultHeight: 32,
    color: '#6bb3d9'
};

// Export for potential use
if (typeof window !== 'undefined') {
    window.HK_SOUL_STATUS = HK_SOUL_STATUS;
}
