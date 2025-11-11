// led-data.js - LED geometry for breadboard rendering
// All electrical metadata lives in components/passives/led-red-5mm.json
// This file ONLY handles positioning relative to breadboard holes

const LED_CONFIG = {
    // Reference to component definition file
    component_type: "led-red-5mm",
    component_file: "components/basic/led-red-5mm.json",
    
    // SVG rendering info (from Fritzing)
    svg: {
        file: "components_svg/LED-5mm-red-leg.svg",
        width: 21.467,   // From viewBox
        height: 40.565,
        viewBox: "0 0 21.467 40.565"
    },
    
    // Pin spacing on breadboard (standard 0.1" spacing)
    pin_spacing: {
        horizontal: 8.982,  // One breadboard hole (same as BREADBOARD_CONFIG.grid.hole_spacing)
        vertical: 8.982     // For vertical orientation
    },
    
    // Visual offsets (how SVG body relates to pin positions)
    // Measured from Fritzing SVG connector positions
    visual_offset: {
        anode_x: 6.287,   // connector1leg x position in SVG
        cathode_x: 16.29, // connector0leg x position in SVG
        pins_y: 40.565    // Bottom of legs (where they connect to holes)
    },
    
    // Default orientation
    default_orientation: "vertical",  // LED typically goes across the gap (E to F)
    
    // Polarity indicator (visual styling)
    cathode_marker: {
        type: "flat-side",  // Flat side of lens indicates cathode
        color: "#8C8C8C"    // Grey lead for cathode (shorter leg)
    },
    anode_marker: {
        color: "#8C8C8C"    // Grey lead for anode (longer leg)
    }
};

/**
 * Calculate LED rendering position based on hole placement
 * @param {Object} placement - { anode: "15E", cathode: "15F" }
 * @param {Array} breadboardHoles - Array of breadboard hole objects
 * @returns {Object} Rendering data { x, y, rotation, anodeCoords, cathodeCoords }
 */
function calculateLEDPosition(placement, breadboardHoles) {
    if (!placement.anode || !placement.cathode) {
        console.error('LED placement requires both anode and cathode holes');
        return null;
    }
    
    // Get hole coordinates
    const anodeHole = breadboardHoles.find(h => h.id === placement.anode);
    const cathodeHole = breadboardHoles.find(h => h.id === placement.cathode);
    
    if (!anodeHole || !cathodeHole) {
        console.error('LED holes not found:', placement);
        return null;
    }
    
    // Calculate center point between holes
    const centerX = (anodeHole.x + cathodeHole.x) / 2;
    const centerY = (anodeHole.y + cathodeHole.y) / 2;
    
    // Determine orientation based on hole positions
    const deltaX = Math.abs(cathodeHole.x - anodeHole.x);
    const deltaY = Math.abs(cathodeHole.y - anodeHole.y);
    
    let orientation, rotation;
    if (deltaX > deltaY) {
        // Horizontal placement
        orientation = "horizontal";
        rotation = anodeHole.x < cathodeHole.x ? 0 : 180; // Anode on left = 0°
    } else {
        // Vertical placement
        orientation = "vertical";
        rotation = anodeHole.y < cathodeHole.y ? 90 : 270; // Anode on top = 90°
    }
    
    return {
        centerX,
        centerY,
        orientation,
        rotation,
        anodeCoords: { x: anodeHole.x, y: anodeHole.y },
        cathodeCoords: { x: cathodeHole.x, y: cathodeHole.y },
        anodeHoleId: placement.anode,
        cathodeHoleId: placement.cathode,
        componentType: LED_CONFIG.component_type
    };
}

/**
 * Validate LED placement
 * @param {Object} placement - { anode: "15E", cathode: "15F" }
 * @param {Array} breadboardHoles - Array of breadboard hole objects
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateLEDPlacement(placement, breadboardHoles) {
    if (!placement.anode || !placement.cathode) {
        return { valid: false, error: 'LED requires both anode and cathode placement' };
    }
    
    const anodeHole = breadboardHoles.find(h => h.id === placement.anode);
    const cathodeHole = breadboardHoles.find(h => h.id === placement.cathode);
    
    if (!anodeHole) {
        return { valid: false, error: `Anode hole "${placement.anode}" not found` };
    }
    if (!cathodeHole) {
        return { valid: false, error: `Cathode hole "${placement.cathode}" not found` };
    }
    
    // Check if holes are adjacent (1 hole spacing)
    const deltaX = Math.abs(cathodeHole.x - anodeHole.x);
    const deltaY = Math.abs(cathodeHole.y - anodeHole.y);
    const spacing = LED_CONFIG.pin_spacing.horizontal;
    
    const isAdjacent = (deltaX < spacing + 1 && deltaY < 1) || // Horizontal adjacent
                       (deltaY < spacing + 1 && deltaX < 1);   // Vertical adjacent
    
    if (!isAdjacent) {
        return { 
            valid: false, 
            error: `LED pins must be in adjacent holes (spacing: ${spacing}mm). Current distance: ${Math.sqrt(deltaX*deltaX + deltaY*deltaY).toFixed(2)}mm` 
        };
    }
    
    // Check if anode and cathode are on opposite sides of breadboard gap
    // This is typical for LEDs (e.g., 15E and 15F)
    const anodeRow = placement.anode.match(/[A-Z]+$/)[0];
    const cathodeRow = placement.cathode.match(/[A-Z]+$/)[0];
    
    const topRows = ['J', 'I', 'H', 'G', 'F'];
    const bottomRows = ['E', 'D', 'C', 'B', 'A'];
    
    const anodeOnTop = topRows.includes(anodeRow);
    const cathodeOnBottom = bottomRows.includes(cathodeRow);
    
    if (anodeOnTop && cathodeOnBottom) {
        // Typical configuration - spans the gap
        return { valid: true };
    } else if (topRows.includes(anodeRow) && topRows.includes(cathodeRow)) {
        // Both on top - unusual but valid
        return { valid: true, warning: 'LED pins on same side of gap (top)' };
    } else if (bottomRows.includes(anodeRow) && bottomRows.includes(cathodeRow)) {
        // Both on bottom - unusual but valid
        return { valid: true, warning: 'LED pins on same side of gap (bottom)' };
    }
    
    return { valid: true };
}

console.log('LED geometry helper loaded');

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        LED_CONFIG,
        calculateLEDPosition,
        validateLEDPlacement
    };
}
