/**
 * Layout Engine - Abstract Base Class
 *
 * Defines the interface for layout algorithms that compute positions
 * for circuit components and wire routing. Layouts are decoupled from
 * the physical breadboard - they just produce position objects that
 * existing component adapters can render.
 *
 * @author Bill Church with Claude Code
 * @version 1.0.0
 */

class LayoutEngine {
    /**
     * @param {number} width - SVG canvas width
     * @param {number} height - SVG canvas height
     */
    constructor(width = 400, height = 200) {
        this.width = width;
        this.height = height;

        // Computed positions stored here
        this.componentPositions = new Map();  // componentId -> Position
        this.wireRoutes = new Map();          // wireId -> WireRoute
        this.picoPosition = null;             // Special position for Pico

        // Connected pins (for abstract Pico rendering)
        this.connectedPicoPins = new Set();
    }

    // ==================== Abstract Methods (Override in subclasses) ====================

    /**
     * Calculate layout for entire circuit
     * @param {Object} circuitData - Full circuit JSON
     * @param {Array} functionalGroups - Detected functional groups
     */
    calculateLayout(circuitData, functionalGroups) {
        throw new Error('calculateLayout() must be implemented by subclass');
    }

    /**
     * Get computed position for a component
     * @param {string} componentId - Component identifier
     * @returns {Object|null} Position object compatible with adapter.render()
     */
    getComponentPosition(componentId) {
        return this.componentPositions.get(componentId) || null;
    }

    /**
     * Get computed route for a wire
     * @param {string} wireId - Wire identifier
     * @returns {Object|null} WireRoute object
     */
    getWireRoute(wireId) {
        return this.wireRoutes.get(wireId) || null;
    }

    /**
     * Get canvas bounds required for this layout
     * @returns {{width: number, height: number}}
     */
    getRequiredBounds() {
        return { width: this.width, height: this.height };
    }

    /**
     * Get human-readable name for this layout
     * @returns {string}
     */
    getName() {
        return 'Base Layout';
    }

    /**
     * Get description of this layout
     * @returns {string}
     */
    getDescription() {
        return 'Abstract base layout engine';
    }

    // ==================== Helper Methods ====================

    /**
     * Store a component position
     * @param {string} componentId
     * @param {Object} position
     */
    setComponentPosition(componentId, position) {
        this.componentPositions.set(componentId, position);
    }

    /**
     * Store a wire route
     * @param {string} wireId
     * @param {Object} route
     */
    setWireRoute(wireId, route) {
        this.wireRoutes.set(wireId, route);
    }

    /**
     * Clear all computed positions
     */
    clear() {
        this.componentPositions.clear();
        this.wireRoutes.clear();
        this.connectedPicoPins.clear();
        this.picoPosition = null;
    }

    /**
     * Extract Pico pins that have wire connections
     * @param {Array} wires - Wire definitions
     */
    extractConnectedPicoPins(wires) {
        this.connectedPicoPins.clear();

        for (const wire of wires) {
            if (this.isPicoEndpoint(wire.from)) {
                const pinName = wire.from.split('.')[1];
                this.connectedPicoPins.add(pinName);
            }
            if (this.isPicoEndpoint(wire.to)) {
                const pinName = wire.to.split('.')[1];
                this.connectedPicoPins.add(pinName);
            }
        }

        console.log(`[LayoutEngine] Found ${this.connectedPicoPins.size} connected Pico pins:`,
                    Array.from(this.connectedPicoPins));
    }

    /**
     * Check if an endpoint references a Pico pin
     * @param {string} endpoint - Wire endpoint (e.g., "pico1.GP15")
     * @returns {boolean}
     */
    isPicoEndpoint(endpoint) {
        if (!endpoint) return false;
        return endpoint.toLowerCase().startsWith('pico') && endpoint.includes('.');
    }

    /**
     * Check if an endpoint is a power or ground connection
     * @param {string} endpoint
     * @returns {boolean}
     */
    isPowerOrGround(endpoint) {
        if (!endpoint) return false;
        const upper = endpoint.toUpperCase();

        // Pico power/ground pins
        if (upper.includes('GND') || upper.includes('3V3') ||
            upper.includes('VBUS') || upper.includes('VSYS')) {
            return true;
        }

        // Power rail holes (W, X = power; Y, Z = ground)
        if (/^[WXYZ]\d+$/i.test(endpoint)) {
            return true;
        }

        return false;
    }

    /**
     * Get all component positions
     * @returns {Map}
     */
    getAllComponentPositions() {
        return this.componentPositions;
    }

    /**
     * Get all wire routes
     * @returns {Map}
     */
    getAllWireRoutes() {
        return this.wireRoutes;
    }
}

// Export for browser
window.LayoutEngine = LayoutEngine;

console.log('[LayoutEngine] Base class loaded');
