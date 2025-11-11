// pico-adapter.js
// Adapter for Raspberry Pi Pico microcontroller
// NOTE: Pico is special - it's pre-rendered during app initialization
// This adapter just VERIFIES the Pico is present, not render it

/**
 * Adapter for Raspberry Pi Pico
 * Unlike LED/Resistor, Pico is already rendered by app.init()
 * This adapter validates placement and provides consistent interface
 */
class PicoAdapter {
    constructor() {
        this.componentType = 'raspberry-pi-pico';
        this.isPreRendered = true;  // Flag indicating this component is special
    }
    
    /**
     * Validate component placement
     * @param {Object} placement - { position: { x: 50, y: 320 } }
     * @param {Array} breadboardHoles - Not used (Pico doesn't use holes)
     * @returns {Object} {valid: boolean, error?: string, warning?: string}
     */
    validate(placement, breadboardHoles) {
        return validatePicoPlacement(placement, breadboardHoles);
    }
    
    /**
     * Calculate rendering position from placement
     * @param {Object} placement - { position: { x: 50, y: 320 } }
     * @param {Array} breadboardHoles - Not used
     * @returns {Object} Position data
     */
    calculatePosition(placement, breadboardHoles) {
        return calculatePicoPosition(placement, breadboardHoles);
    }
    
    /**
     * Get list of holes required by this component
     * @param {Object} placement - { position: { x: 50, y: 320 } }
     * @returns {Array<string>} Empty array - Pico doesn't occupy breadboard holes
     */
    getRequiredHoles(placement) {
        // Pico is off-breadboard, doesn't occupy any holes
        return [];
    }
    
    /**
     * "Render" the Pico component
     * Since Pico is pre-rendered during app.init(), this just verifies it exists
     * @param {string} componentId - Should always be "pico1"
     * @param {Object} position - Expected position {x, y}
     * @param {Object} metadata - Component metadata from JSON file
     */
    async render(componentId, position, metadata) {
        // Verify Pico SVG element exists in DOM
        const picoElement = document.getElementById(PICO_CONFIG.svg_element_id);
        
        if (!picoElement) {
            throw new Error(`Pico board element not found in DOM (id: ${PICO_CONFIG.svg_element_id}). Pico must be rendered during app initialization.`);
        }
        
        // Get actual position from DOM
        const actualX = parseFloat(picoElement.getAttribute('x'));
        const actualY = parseFloat(picoElement.getAttribute('y'));
        
        // CHANGED: Only check position if circuit JSON specifies one
        // Don't compare to expected_position from config
        if (position && position.x !== undefined && position.y !== undefined) {
            const xDiff = Math.abs(actualX - position.x);
            const yDiff = Math.abs(actualY - position.y);
            
            // Only warn if difference is significant (>5 pixels)
            if (xDiff > 5 || yDiff > 5) {
                console.warn(`⚠️ Pico position in circuit JSON differs from HTML:`);
                console.warn(`  Circuit JSON: (${position.x}, ${position.y})`);
                console.warn(`  HTML actual: (${actualX}, ${actualY})`);
                console.warn(`  Using HTML position for pin coordinates.`);
            }
        }
        
        // Verify pin overlays exist
        const picoPinsLayer = document.getElementById('pico-pins-layer');
        if (!picoPinsLayer) {
            throw new Error('Pico pins layer not found. Pins must be rendered during app initialization.');
        }
        
        const renderedPins = picoPinsLayer.querySelectorAll('.pin');
        const expectedPinCount = 40;
        
        if (renderedPins.length !== expectedPinCount) {
            throw new Error(`Pico pin count mismatch. Expected ${expectedPinCount}, found ${renderedPins.length}`);
        }
        
        // Verify pins are in app.connectablePoints
        const picoPoints = window.breadboardApp.connectablePoints.filter(
            pt => pt.componentType === this.componentType
        );
        
        if (picoPoints.length !== expectedPinCount) {
            throw new Error(`Pico pins not in connectablePoints. Expected ${expectedPinCount}, found ${picoPoints.length}`);
        }
        
        // All checks passed
        console.log(`✓ Pico verified: ${componentId} at (${actualX}, ${actualY})`);
        console.log(`  - ${renderedPins.length} pins rendered`);
        console.log(`  - ${picoPoints.length} pins connectable`);
        
        // Mark as verified by storing metadata
        picoElement._componentData = {
            position,
            metadata,
            config: PICO_CONFIG,
            verified: true,
            verifiedAt: new Date().toISOString()
        };
    }
}

// Register adapter globally
window.PicoAdapter = PicoAdapter;

console.log('PicoAdapter loaded (pre-rendered component verifier)');
