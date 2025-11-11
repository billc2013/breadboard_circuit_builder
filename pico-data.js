// pico-data.js - Raspberry Pi Pico geometry and positioning
// All electrical metadata lives in components/pico.json
// This file ONLY handles SVG positioning and coordinate calculations

const PICO_CONFIG = {
    // Reference to component definition file
    component_type: "raspberry-pi-pico",
    
    // Reference to DOM element
    svg_element_id: "pico-board",
    
    // SVG dimensions (from Fritzing viewBox: 0 0 59.53 150.24)
    dimensions: {
        width: 59.53,
        height: 150.24
    },
    
    // Expected position in HTML (for validation)
    expected_position: {
        x: 50,
        y: 320  // Below breadboard
    },
    
    // Internal offset - distance from SVG edge to pin centers
    // Measured from Fritzing SVG connector positions
    internal_offset: {
        left_pins_x: 4.56,    // Left side pin centers from left edge
        right_pins_x: 54.96,  // Right side pin centers from left edge
        first_pin_y: 9.54     // First pin Y position from top
    },
    
    // Pin spacing (measured between connector centers in Fritzing SVG)
    pin_spacing: 7.2
};

// Pin layout - defines physical order and pin keys
// Keys MUST match the keys in pico.json pins object
const PICO_PIN_LAYOUT = {
    // Left side (top to bottom) - Physical pins 1-20
    left: [
        "GP0",        // Pin 1
        "GP1",        // Pin 2
        "GND_3",      // Pin 3
        "GP2",        // Pin 4
        "GP3",        // Pin 5
        "GP4",        // Pin 6
        "GP5",        // Pin 7
        "GND_8",      // Pin 8
        "GP6",        // Pin 9
        "GP7",        // Pin 10
        "GP8",        // Pin 11
        "GP9",        // Pin 12
        "GND_13",     // Pin 13
        "GP10",       // Pin 14
        "GP11",       // Pin 15
        "GP12",       // Pin 16
        "GP13",       // Pin 17
        "GND_18",     // Pin 18
        "GP14",       // Pin 19
        "GP15"        // Pin 20
    ],
    
    // Right side (top to bottom) - Physical pins 40-21
    right: [
        "VBUS",       // Pin 40
        "VSYS",       // Pin 39
        "GND_38",     // Pin 38
        "3V3_EN",     // Pin 37
        "3V3_OUT",    // Pin 36
        "ADC_VREF",   // Pin 35
        "GP28_ADC2",  // Pin 34
        "AGND",       // Pin 33
        "GP27_ADC1",  // Pin 32
        "GP26_ADC0",  // Pin 31
        "RUN",        // Pin 30
        "GP22",       // Pin 29
        "GND_28",     // Pin 28
        "GP21",       // Pin 27
        "GP20",       // Pin 26
        "GP19",       // Pin 25
        "GP18",       // Pin 24
        "GND_23",     // Pin 23
        "GP17",       // Pin 22
        "GP16"        // Pin 21
    ]
};

// Initialize: Read actual position from DOM and validate
function initializePico() {
    const img = document.getElementById(PICO_CONFIG.svg_element_id);
    
    if (!img) {
        console.error('Pico board image not found! Check svg_element_id');
        return { x: 0, y: 0 };
    }
    
    const actualX = parseFloat(img.getAttribute('x'));
    const actualY = parseFloat(img.getAttribute('y'));
    
    // Warn if HTML doesn't match expected
    if (actualX !== PICO_CONFIG.expected_position.x ||
        actualY !== PICO_CONFIG.expected_position.y) {
        console.warn('Pico position mismatch!', 
            `Expected: (${PICO_CONFIG.expected_position.x}, ${PICO_CONFIG.expected_position.y})`,
            `Actual: (${actualX}, ${actualY})`);
    }
    
    console.log('Pico board initialized at:', { x: actualX, y: actualY });
    return { x: actualX, y: actualY };
}

// Generate all pin connection points (geometry only)
function generatePicoConnectablePoints() {
    const points = [];
    const { internal_offset, pin_spacing } = PICO_CONFIG;
    
    // Get actual board position from DOM
    const boardPos = initializePico();
    
    // Calculate absolute positions for pin centers
    const leftPinX = boardPos.x + internal_offset.left_pins_x;
    const rightPinX = boardPos.x + internal_offset.right_pins_x;
    const firstPinY = boardPos.y + internal_offset.first_pin_y;
    
    // Generate left side pins (top to bottom)
    PICO_PIN_LAYOUT.left.forEach((pinKey, index) => {
        points.push({
            id: `pico1.${pinKey}`,           // Full reference for wiring (e.g., "pico1.GP0")
            componentId: "pico1",
            componentType: PICO_CONFIG.component_type,
            pinKey: pinKey,                  // Key to lookup in pico.json (e.g., "GP0", "GND_3")
            x: leftPinX,
            y: firstPinY + (index * pin_spacing),
            side: "left",
            index: index                     // Position in side array
        });
    });
    
    // Generate right side pins (top to bottom)
    PICO_PIN_LAYOUT.right.forEach((pinKey, index) => {
        points.push({
            id: `pico1.${pinKey}`,
            componentId: "pico1",
            componentType: PICO_CONFIG.component_type,
            pinKey: pinKey,
            x: rightPinX,
            y: firstPinY + (index * pin_spacing),
            side: "right",
            index: index
        });
    });
    
    return points;
}

// Generate pin positions
const PICO_PINS = generatePicoConnectablePoints();

// Helper functions for pin lookup

/**
 * Get pin position data by reference
 * @param {string} pinRef - Pin reference (e.g., "pico1.GP0" or "GP0")
 * @returns {Object|undefined} Pin position object or undefined
 */
function getPicoPin(pinRef) {
    // Normalize reference to full format
    let fullRef = pinRef;
    if (!pinRef.includes('.')) {
        fullRef = `pico1.${pinRef}`;
    }
    
    return PICO_PINS.find(pin => pin.id === fullRef);
}

/**
 * Get pin position by key (matches pico.json keys)
 * @param {string} pinKey - Pin key from pico.json (e.g., "GP0", "GND_3")
 * @returns {Object|undefined} Pin position object or undefined
 */
function getPicoPinByKey(pinKey) {
    return PICO_PINS.find(pin => pin.pinKey === pinKey);
}

/**
 * Get all pins on one side
 * @param {string} side - "left" or "right"
 * @returns {Array} Array of pin position objects
 */
function getPicoPinsBySide(side) {
    return PICO_PINS.filter(pin => pin.side === side);
}

/**
 * Get absolute position for component placement
 * Used when positioning entire Pico component
 * @returns {Object} {x, y, width, height}
 */
function getPicoBounds() {
    const boardPos = initializePico();
    const { dimensions } = PICO_CONFIG;
    
    return {
        x: boardPos.x,
        y: boardPos.y,
        width: dimensions.width,
        height: dimensions.height
    };
}

// Log initialization
console.log('Pico pin geometry generated:', PICO_PINS.length, 'pin positions');
console.log('Left side pins:', getPicoPinsBySide('left').length);
console.log('Right side pins:', getPicoPinsBySide('right').length);

// Export for use in other modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PICO_CONFIG,
        PICO_PINS,
        getPicoPin,
        getPicoPinByKey,
        getPicoPinsBySide,
        getPicoBounds
    };
}
