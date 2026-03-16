/**
 * Controllable Jump Plugin - Injection Script
 * Adds variable jump height: hold jump to go higher, release to cut velocity.
 */

(function(ctx) {
    const { pluginManager, pluginId, world } = ctx;

    function getConfig() {
        return world?.plugins?.cj || CJ_DEFAULTS;
    }

    pluginManager.registerHook('player.update', (data) => {
        const { player } = data;

        if (!player.input?.jump && player.vy < 0 && !player.isOnGround) {
            // Respect flags set by other plugins (e.g. HK pogo bounce)
            if (player._pogoJumping || player._hitUpward) return data;

            const config = getConfig();
            const jumpForce = world?.jumpForce ?? -11;
            const cutVy = jumpForce * (config.cutStrength ?? 0.4);
            player.vy = Math.max(player.vy, cutVy);
        }

        return data;
    }, pluginId, 50);

})(ctx);
