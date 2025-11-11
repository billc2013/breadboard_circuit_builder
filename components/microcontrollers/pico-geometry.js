// pico-geometry.js
// Geometry and positioning logic for Raspberry Pi Pico
// This file handles pin position calculations and board placement

const PICO_CONFIG = {
    component_type: 'raspberry-pi-pico',
    component_file: 'components/microcontrollers/pico.json',
    
    // SVG rendering info (extracted from Fritzing breadboard view)
    svg: {
        file: 'components/microcontrollers/pico-breadboard.svg',
        viewBox: '0 0 59.53 150.24',
        width: 59.53,    // mm
        height: 150.24,  // mm
        
        // Pin connector positions in SVG
        // These are the terminal rectangles that define pin centers
        // Format: connector{N}terminal where N is 0-39 (40 pins total)
        firstPin: {
            left: { x: 4.58154, y: 16.7411 },   // connector0terminal (GP0)
            right: { x: 55.0078, y: 16.6537 }   // connector38terminal (VBUS)
        },
        
        // Debug pins (on bottom, not part of main 40)
        debugPins: {
            swclk: { x: 29.76, y: 147.54 },     // connector40 (SWCLK)
            gnd: { x: 22.56, y: 147.54 },        // connector41 (GND)
            swdio: { x: 36.96, y: 147.54 }       // connector42 (SWDIO)
        }
    },
    
    // DOM element reference
    svg_element_id: 'pico-board',
    
    // Expected position in HTML (off-breadboard, below it)
    expected_position: null,

    default_position: {
        x: 20,
        y: 20
    },
    
    // Internal offset - distance from SVG edge to pin centers
    // Measured from Fritzing SVG connector terminal positions
    internal_offset: {
        left_pins_x: 4.56,     // Left side pin centers from left edge
        right_pins_x: 54.96,   // Right side pin centers from left edge
        first_pin_y: 9.54      // First pin Y position from top (adjusted for expected_position)
    },
    
    // Pin spacing (measured between connector centers in Fritzing SVG)
    pin_spacing: 7.2,  // mm between consecutive pins
    
    // Pin layout - defines physical order and pin keys
    // Keys MUST match the keys in pico.json pins object
    pin_layout: {
        // Left side (top to bottom) - Physical pins 1-20
        left: [
            'GP0',        // Pin 1
            'GP1',        // Pin 2
            'GND_3',      // Pin 3
            'GP2',        // Pin 4
            'GP3',        // Pin 5
            'GP4',        // Pin 6
            'GP5',        // Pin 7
            'GND_8',      // Pin 8
            'GP6',        // Pin 9
            'GP7',        // Pin 10
            'GP8',        // Pin 11
            'GP9',        // Pin 12
            'GND_13',     // Pin 13
            'GP10',       // Pin 14
            'GP11',       // Pin 15
            'GP12',       // Pin 16
            'GP13',       // Pin 17
            'GND_18',     // Pin 18
            'GP14',       // Pin 19
            'GP15'        // Pin 20
        ],
        
        // Right side (top to bottom) - Physical pins 40-21
        right: [
            'VBUS',       // Pin 40
            'VSYS',       // Pin 39
            'GND_38',     // Pin 38
            '3V3_EN',     // Pin 37
            '3V3_OUT',    // Pin 36
            'ADC_VREF',   // Pin 35
            'GP28_ADC2',  // Pin 34
            'AGND',       // Pin 33
            'GP27_ADC1',  // Pin 32
            'GP26_ADC0',  // Pin 31
            'RUN',        // Pin 30
            'GP22',       // Pin 29
            'GND_28',     // Pin 28
            'GP21',       // Pin 27
            'GP20',       // Pin 26
            'GP19',       // Pin 25
            'GP18',       // Pin 24
            'GND_23',     // Pin 23
            'GP17',       // Pin 22
            'GP16'        // Pin 21
        ]
    },
    
    // Rendering settings
    rendering: {
        // Pico is rendered off-breadboard (not inserted into holes)
        renderMode: 'off-breadboard',
        
        // Pin overlay styling
        pinOverlay: {
            width: 3,
            height: 3,
            cornerRadius: 0.3,
            shape: 'square'  // Matches female header holes
        }
    }
};

/**
 * Initialize Pico board position
 * Reads actual position from DOM for reporting
 * @returns {Object} {x, y} actual position from DOM
 */
function initializePico() {
    const img = document.getElementById(PICO_CONFIG.svg_element_id);
    
    if (!img) {
        console.error('Pico board image not found! Check svg_element_id:', PICO_CONFIG.svg_element_id);
        return { x: 0, y: 0 };
    }
    
    const actualX = parseFloat(img.getAttribute('x'));
    const actualY = parseFloat(img.getAttribute('y'));
    
    console.log('✓ Pico board initialized at:', { x: actualX, y: actualY });
    return { x: actualX, y: actualY };
}

/**
 * Generate all pin connection points (geometry only)
 * This creates the 40 pin position objects that get merged into app.connectablePoints
 * @returns {Array} Array of pin position objects
 */
function generatePicoConnectablePoints() {
    const points = [];
    const { internal_offset, pin_spacing, pin_layout } = PICO_CONFIG;
    
    // Get actual board position from DOM
    const boardPos = initializePico();
    
    // Calculate absolute positions for pin centers
    const leftPinX = boardPos.x + internal_offset.left_pins_x;
    const rightPinX = boardPos.x + internal_offset.right_pins_x;
    const firstPinY = boardPos.y + internal_offset.first_pin_y;
    
    // Generate left side pins (top to bottom)
    pin_layout.left.forEach((pinKey, index) => {
        points.push({
            id: `pico1.${pinKey}`,           // Full reference for wiring (e.g., "pico1.GP0")
            componentId: 'pico1',
            componentType: PICO_CONFIG.component_type,
            pinKey: pinKey,                  // Key to lookup in pico.json (e.g., "GP0", "GND_3")
            x: leftPinX,
            y: firstPinY + (index * pin_spacing),
            side: 'left',
            index: index                     // Position in side array
        });
    });
    
    // Generate right side pins (top to bottom)
    pin_layout.right.forEach((pinKey, index) => {
        points.push({
            id: `pico1.${pinKey}`,
            componentId: 'pico1',
            componentType: PICO_CONFIG.component_type,
            pinKey: pinKey,
            x: rightPinX,
            y: firstPinY + (index * pin_spacing),
            side: 'right',
            index: index
        });
    });
    
    return points;
}

/**
 * Get Pico board bounds (for collision detection, placement validation)
 * @returns {Object} {x, y, width, height}
 */
function getPicoBounds() {
    const boardPos = initializePico();
    const { width, height } = PICO_CONFIG.svg;
    
    return {
        x: boardPos.x,
        y: boardPos.y,
        width: width,
        height: height
    };
}

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
    
    const PICO_PINS = generatePicoConnectablePoints();
    return PICO_PINS.find(pin => pin.id === fullRef);
}

/**
 * Get pin position by key (matches pico.json keys)
 * @param {string} pinKey - Pin key from pico.json (e.g., "GP0", "GND_3")
 * @returns {Object|undefined} Pin position object or undefined
 */
function getPicoPinByKey(pinKey) {
    const PICO_PINS = generatePicoConnectablePoints();
    return PICO_PINS.find(pin => pin.pinKey === pinKey);
}

/**
 * Get all pins on one side
 * @param {string} side - "left" or "right"
 * @returns {Array} Array of pin position objects
 */
function getPicoPinsBySide(side) {
    const PICO_PINS = generatePicoConnectablePoints();
    return PICO_PINS.filter(pin => pin.side === side);
}

/**
 * Validate Pico placement
 * Since Pico is pre-rendered, this is lenient
 * @param {Object} placement - { position: { x: 20, y: 20 } }
 * @param {Array} breadboardHoles - Not used (Pico doesn't use holes)
 * @returns {Object} { valid: boolean, error?: string, warning?: string }
 */
function validatePicoPlacement(placement, breadboardHoles) {
    // Pico placement must have position object
    if (!placement.position) {
        return {
            valid: false,
            error: 'Pico placement requires position object with x and y coordinates'
        };
    }
    
    const { x, y } = placement.position;
    
    if (typeof x !== 'number' || typeof y !== 'number') {
        return {
            valid: false,
            error: 'Pico position x and y must be numbers'
        };
    }
    
    // Just validate the numbers are reasonable (within SVG bounds)
    const MAX_COORD = 1000;  // Arbitrary but reasonable max
    
    if (x < 0 || y < 0 || x > MAX_COORD || y > MAX_COORD) {
        return {
            valid: false,
            error: `Pico position (${x}, ${y}) out of reasonable bounds (0-${MAX_COORD})`
        };
    }
    
    return { valid: true };
}

/**
 * Calculate Pico position
 * For Pico, this is a no-op since position is pre-defined
 * Just returns the placement position for consistency with other components
 * @param {Object} placement - { position: { x: 50, y: 320 } }
 * @param {Array} breadboardHoles - Not used
 * @returns {Object} Position object (just passes through placement)
 */
function calculatePicoPosition(placement, breadboardHoles) {
    if (!placement.position) {
        console.error('Pico placement requires position object');
        return null;
    }
    
    return {
        x: placement.position.x,
        y: placement.position.y,
        componentType: PICO_CONFIG.component_type
    };
}

// Generate pin positions (this gets called during app initialization)
const PICO_PINS = generatePicoConnectablePoints();

// Log initialization
console.log('✓ Pico pin geometry generated:', PICO_PINS.length, 'pin positions');
console.log('  Left side pins:', getPicoPinsBySide('left').length);
console.log('  Right side pins:', getPicoPinsBySide('right').length);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PICO_CONFIG,
        PICO_PINS,
        initializePico,
        getPicoPin,
        getPicoPinByKey,
        getPicoPinsBySide,
        getPicoBounds,
        validatePicoPlacement,
        calculatePicoPosition,
        generatePicoConnectablePoints
    };
}
