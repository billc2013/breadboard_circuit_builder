// led-5mm-geometry.js
// Generic geometry for ALL 5mm LEDs (red, green, blue, yellow, etc.)
// Color is specified in metadata JSON, not in geometry

const LED_5MM_CONFIG = {
    component_type: 'led-5mm',  // Generic type
    
    // SVG rendering info (same for all colors)
    svg: {
        file: 'components_svg/LED-5mm-red-leg.svg',  // We'll colorize this dynamically
        viewBox: '0 0 21.467 40.565',
        width: 21.467,
        height: 40.565,
        
        // Connector positions (from Fritzing SVG)
        connectors: {
            cathode: {
                id: 'connector0leg',
                x: 6.287,
                y: 40.565
            },
            anode: {
                id: 'connector1leg', 
                x: 16.29,
                y: 40.565
            }
        },
        
        // Body center point
        body: {
            centerX: 11.29,
            centerY: 20.28,
            baseY: 40.565
        },
        
        // Color elements in SVG (for dynamic colorization)
        colorElements: [
            '#color_path14',  // Main LED body color
            '#color_path20',
            '#color_path22',
            '#color_path26',
            '#color_ellipse26',
            '#color_path32'
        ]
    },
    
    // Pin spacing (standard for all 5mm LEDs)
    pin_spacing: {
        horizontal: 8.982,
        vertical: 8.982
    },
    
    // Visual rendering settings
    rendering: {
        scale: 0.8,
        insertionOffset: -8,
        stubLength: 11,
        
        cathodeStub: {
            color: '#6C6C6C',
            width: 1.5
        },
        anodeStub: {
            color: '#8C8C8C',
            width: 1.5
        }
    },
    
    default_orientation: 'horizontal',
    
    polarity: {
        type: 'polarized',
        cathode: {
            marker: 'flat-side',
            description: 'Negative terminal (shorter leg, connects to ground)',
            svgConnector: 'connector0'
        },
        anode: {
            marker: 'round-side',
            description: 'Positive terminal (longer leg, connects to signal)',
            svgConnector: 'connector1'
        }
    },
    
    // Color mapping for dynamic rendering
    colors: {
        'red': {
            hex: '#E60000',
            wavelength: 633,
            forwardVoltage: 1.8
        },
        'green': {
            hex: '#00CC00',
            wavelength: 565,
            forwardVoltage: 2.0
        },
        'blue': {
            hex: '#0066FF',
            wavelength: 470,
            forwardVoltage: 3.0
        },
        'yellow': {
            hex: '#FFCC00',
            wavelength: 590,
            forwardVoltage: 2.1
        },
        'white': {
            hex: '#FFFFFF',
            wavelength: null,
            forwardVoltage: 3.2
        }
    }
};

/**
 * Calculate LED rendering position (same for all colors)
 */
function calculateLEDPosition(placement, breadboardHoles) {
    if (!placement.cathode || !placement.anode) {
        console.error('LED placement requires both cathode and anode holes');
        return null;
    }
    
    const cathodeHole = breadboardHoles.find(h => h.id === placement.cathode);
    const anodeHole = breadboardHoles.find(h => h.id === placement.anode);
    
    if (!cathodeHole || !anodeHole) {
        console.error('LED holes not found:', placement);
        return null;
    }
    
    const centerX = (cathodeHole.x + anodeHole.x) / 2;
    const centerY = (cathodeHole.y + anodeHole.y) / 2;
    
    const deltaX = Math.abs(anodeHole.x - cathodeHole.x);
    const deltaY = Math.abs(anodeHole.y - cathodeHole.y);

    let orientation, rotation, flipHorizontal;
    if (deltaX > deltaY) {
        // Horizontal layout
        orientation = 'horizontal';
        rotation = 0;
        flipHorizontal = cathodeHole.x > anodeHole.x; // Flip if cathode is on the right
    } else {
        // Vertical layout
        orientation = 'vertical';
        rotation = 90;
        flipHorizontal = cathodeHole.y > anodeHole.y; // Flip if cathode is below anode
    }

    return {
        centerX,
        centerY,
        orientation,
        rotation,
        flipHorizontal,
        cathodeCoords: { x: cathodeHole.x, y: cathodeHole.y },
        anodeCoords: { x: anodeHole.x, y: anodeHole.y },
        cathodeHoleId: placement.cathode,
        anodeHoleId: placement.anode,
        componentType: LED_5MM_CONFIG.component_type
    };
}

/**
 * Validate LED placement (same for all colors)
 */
function validateLEDPlacement(placement, breadboardHoles) {
    if (!placement.cathode || !placement.anode) {
        return { 
            valid: false, 
            error: 'LED requires both cathode and anode placement' 
        };
    }
    
    const cathodeHole = breadboardHoles.find(h => h.id === placement.cathode);
    const anodeHole = breadboardHoles.find(h => h.id === placement.anode);
    
    if (!cathodeHole) {
        return { 
            valid: false, 
            error: `Cathode hole "${placement.cathode}" not found` 
        };
    }
    if (!anodeHole) {
        return { 
            valid: false, 
            error: `Anode hole "${placement.anode}" not found` 
        };
    }
    
    const deltaX = Math.abs(anodeHole.x - cathodeHole.x);
    const deltaY = Math.abs(anodeHole.y - cathodeHole.y);
    const spacing = LED_5MM_CONFIG.pin_spacing.horizontal;
    
    const isAdjacent = (deltaX < spacing + 1 && deltaY < 1) ||
                       (deltaY < spacing + 1 && deltaX < 1);
    
    if (!isAdjacent) {
        const distance = Math.sqrt(deltaX*deltaX + deltaY*deltaY).toFixed(2);
        return { 
            valid: false, 
            error: `LED pins must be in adjacent holes (spacing: ${spacing}mm). Current distance: ${distance}mm` 
        };
    }
    
    if (cathodeHole.bus === anodeHole.bus) {
        return {
            valid: false,
            error: `LED pins on same bus "${cathodeHole.bus}" - this creates a short circuit`
        };
    }
    
    const cathodeRow = placement.cathode.match(/[A-Z]+$/)[0];
    const anodeRow = placement.anode.match(/[A-Z]+$/)[0];
    
    const topRows = ['J', 'I', 'H', 'G', 'F'];
    const bottomRows = ['E', 'D', 'C', 'B', 'A'];
    
    const cathodeOnTop = topRows.includes(cathodeRow);
    const anodeOnTop = topRows.includes(anodeRow);
    const cathodeOnBottom = bottomRows.includes(cathodeRow);
    const anodeOnBottom = bottomRows.includes(anodeRow);
    
    if ((cathodeOnTop && anodeOnBottom) || (cathodeOnBottom && anodeOnTop)) {
        return { valid: true };
    }
    
    if ((cathodeOnTop && anodeOnTop) || (cathodeOnBottom && anodeOnBottom)) {
        return { 
            valid: true, 
            warning: 'LED pins on same side of gap (unusual but valid)' 
        };
    }
    
    return { valid: true };
}

/**
 * Extract color from metadata
 * Looks in properties.color field for color name
 */
function extractLEDColor(metadata) {
    if (!metadata || !metadata.properties || !metadata.properties.color) {
        return 'red';  // Default
    }
    
    const colorString = metadata.properties.color.toLowerCase();
    
    // Match color name in the string
    if (colorString.includes('red')) return 'red';
    if (colorString.includes('green')) return 'green';
    if (colorString.includes('blue')) return 'blue';
    if (colorString.includes('yellow')) return 'yellow';
    if (colorString.includes('white')) return 'white';
    
    return 'red';  // Default fallback
}

console.log('LED 5mm geometry helper loaded (generic for all colors)');

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        LED_5MM_CONFIG,
        calculateLEDPosition,
        validateLEDPlacement,
        extractLEDColor
    };
}
