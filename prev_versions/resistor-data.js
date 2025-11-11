// resistor-data.js - Resistor geometry for breadboard rendering
// All electrical metadata lives in components/passives/resistor-220.json
// This file ONLY handles positioning relative to breadboard holes

const RESISTOR_CONFIG = {
    // Reference to component definition file
    component_type: "resistor-220",
    component_file: "components/basic/resistor-220.json",
    
    // SVG rendering info (from Fritzing)
    svg: {
        file: "components_svg/resistor_220.svg",
        width: 42.917,   // From viewBox (0.42917 inches)
        height: 9.71,    // From viewBox (0.0971 inches)
        viewBox: "0 0 42.917 9.71"
    },
    
    // Pin spacing options
    pin_spacing: {
        standard: 26.982,  // 3 holes (400 mil = 3 × 8.982mm breadboard spacing)
        min: 8.982,        // 1 hole (can bend leads)
        max: 44.91         // 5 holes (stretched)
    },
    
    // Visual offsets (how SVG body relates to pin positions)
    // Measured from Fritzing SVG connector positions
    visual_offset: {
        pin0_x: 1.455,   // connector0leg x position in SVG
        pin1_x: 41.462,  // connector1leg x position in SVG
        pins_y: 5.045    // Center Y of pins
    },
    
    // Default orientation
    default_orientation: "horizontal",  // Resistors typically horizontal
    
    // Non-polarized (can be flipped)
    polarity: "non-polarized"
};

/**
 * Calculate resistor rendering position based on hole placement
 * @param {Object} placement - { pin0: "15F", pin1: "20F" }
 * @param {Array} breadboardHoles - Array of breadboard hole objects
 * @returns {Object} Rendering data { x, y, rotation, pin0Coords, pin1Coords }
 */
function calculateResistorPosition(placement, breadboardHoles) {
    if (!placement.pin0 || !placement.pin1) {
        console.error('Resistor placement requires both pin0 and pin1 holes');
        return null;
    }
    
    // Get hole coordinates
    const pin0Hole = breadboardHoles.find(h => h.id === placement.pin0);
    const pin1Hole = breadboardHoles.find(h => h.id === placement.pin1);
    
    if (!pin0Hole || !pin1Hole) {
        console.error('Resistor holes not found:', placement);
        return null;
    }
    
    // Calculate center point between holes
    const centerX = (pin0Hole.x + pin1Hole.x) / 2;
    const centerY = (pin0Hole.y + pin1Hole.y) / 2;
    
    // Determine orientation based on hole positions
    const deltaX = Math.abs(pin1Hole.x - pin0Hole.x);
    const deltaY = Math.abs(pin1Hole.y - pin0Hole.y);
    
    let orientation, rotation;
    if (deltaX > deltaY) {
        // Horizontal placement
        orientation = "horizontal";
        rotation = 0;
    } else {
        // Vertical placement
        orientation = "vertical";
        rotation = 90;
    }
    
    // Calculate actual pin spacing
    const actualSpacing = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    return {
        centerX,
        centerY,
        orientation,
        rotation,
        pin0Coords: { x: pin0Hole.x, y: pin0Hole.y },
        pin1Coords: { x: pin1Hole.x, y: pin1Hole.y },
        pin0HoleId: placement.pin0,
        pin1HoleId: placement.pin1,
        actualSpacing,
        componentType: RESISTOR_CONFIG.component_type
    };
}

/**
 * Validate resistor placement
 * @param {Object} placement - { pin0: "15F", pin1: "20F" }
 * @param {Array} breadboardHoles - Array of breadboard hole objects
 * @returns {Object} { valid: boolean, error?: string, warning?: string }
 */
function validateResistorPlacement(placement, breadboardHoles) {
    if (!placement.pin0 || !placement.pin1) {
        return { valid: false, error: 'Resistor requires both pin0 and pin1 placement' };
    }
    
    const pin0Hole = breadboardHoles.find(h => h.id === placement.pin0);
    const pin1Hole = breadboardHoles.find(h => h.id === placement.pin1);
    
    if (!pin0Hole) {
        return { valid: false, error: `Pin0 hole "${placement.pin0}" not found` };
    }
    if (!pin1Hole) {
        return { valid: false, error: `Pin1 hole "${placement.pin1}" not found` };
    }
    
    // Check if pins are on same bus (SHORT CIRCUIT!)
    if (pin0Hole.bus === pin1Hole.bus) {
        return { 
            valid: false, 
            error: `Resistor pins on same bus "${pin0Hole.bus}" - this creates a short circuit with no resistance` 
        };
    }
    
    // Calculate spacing
    const deltaX = Math.abs(pin1Hole.x - pin0Hole.x);
    const deltaY = Math.abs(pin1Hole.y - pin0Hole.y);
    const actualSpacing = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Check if spacing is within acceptable range
    if (actualSpacing < RESISTOR_CONFIG.pin_spacing.min) {
        return { 
            valid: false, 
            error: `Resistor pin spacing too small: ${actualSpacing.toFixed(2)}mm (min: ${RESISTOR_CONFIG.pin_spacing.min}mm)` 
        };
    }
    
    if (actualSpacing > RESISTOR_CONFIG.pin_spacing.max) {
        return { 
            valid: false, 
            error: `Resistor pin spacing too large: ${actualSpacing.toFixed(2)}mm (max: ${RESISTOR_CONFIG.pin_spacing.max}mm)` 
        };
    }
    
    // Warning for non-standard spacing
    if (Math.abs(actualSpacing - RESISTOR_CONFIG.pin_spacing.standard) > 1) {
        return { 
            valid: true, 
            warning: `Non-standard resistor spacing: ${actualSpacing.toFixed(2)}mm (standard: ${RESISTOR_CONFIG.pin_spacing.standard}mm)` 
        };
    }
    
    return { valid: true };
}

console.log('Resistor geometry helper loaded');

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        RESISTOR_CONFIG,
        calculateResistorPosition,
        validateResistorPlacement
    };
}
