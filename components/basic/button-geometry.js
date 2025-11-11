// button-geometry.js
// Generic geometry for tactile pushbuttons
// Button state (pressed/not pressed) handled in metadata/circuit logic

const BUTTON_CONFIG = {
    component_type: 'button',  // Generic type
    
    // SVG rendering info
    svg: {
        file: 'components_svg/Pushbuttonc.svg',
        viewBox: '0 0 50.562 56.168',
        width: 50.562,
        height: 56.168,
        
        // Connector positions (from Fritzing SVG)
        connectors: {
            leg0: {
                id: 'connector0pin',
                x: 21.143,  // Center of pin: 20.073 + (2.14/2)
                y: 54.592   // Center: 53.018 + (3.148/2)
            },
            leg1: {
                id: 'connector1pin',
                x: 28.372,  // Center of pin: 27.292 + (2.159/2)
                y: 54.590   // Center: 53.018 + (3.146/2)
            }
        },
        
        // Body dimensions
        body: {
            centerX: 25.281,   // Center between pins
            centerY: 28.084,   // Half of viewBox height
            width: 50.562,
            height: 56.168
        },
        
        // Pin spacing in SVG
        pinSpacing: 7.229  // 28.372 - 21.143
    },
    
    // Pin spacing options on breadboard
    pin_spacing: {
        standard: 8.982,   // 1 hole apart (typical for small buttons)
        min: 8.982,        // Must be at least 1 hole
        max: 17.964        // 2 holes max for this button size
    },
    
    // Visual rendering settings
    rendering: {
        scale: 0.7,  // Smaller for better fit on breadboard
        verticalOffset: -10  // Adjusted so button legs insert into holes (like LED)
    },
    
    default_orientation: 'vertical',
    polarity: 'non-polarized',
    
    // Typical configurations
    typical_use: {
        'pull-down': {
            description: 'Button to 3.3V, pull-down resistor to GND',
            wiring: [
                'GPIO → Button leg → 3.3V',
                'GPIO → 10kΩ resistor → GND'
            ]
        },
        'pull-up': {
            description: 'Button to GND, pull-up resistor to 3.3V',
            wiring: [
                'GPIO → Button leg → GND',
                'GPIO → 10kΩ resistor → 3.3V'
            ]
        },
        'internal-pull': {
            description: 'Use Pico internal pull-down (software)',
            wiring: [
                'GPIO → Button leg → 3.3V',
                'Configure GPIO with internal pull-down in code'
            ]
        }
    }
};

/**
 * Calculate button rendering position
 * Buttons are simple 2-pin components
 */
function calculateButtonPosition(placement, breadboardHoles) {
    if (!placement.leg0 || !placement.leg1) {
        console.error('Button placement requires both leg0 and leg1 holes');
        return null;
    }
    
    const leg0Hole = breadboardHoles.find(h => h.id === placement.leg0);
    const leg1Hole = breadboardHoles.find(h => h.id === placement.leg1);
    
    if (!leg0Hole || !leg1Hole) {
        console.error('Button holes not found:', placement);
        return null;
    }
    
    const centerX = (leg0Hole.x + leg1Hole.x) / 2;
    const centerY = (leg0Hole.y + leg1Hole.y) / 2;
    
    const deltaX = Math.abs(leg1Hole.x - leg0Hole.x);
    const deltaY = Math.abs(leg1Hole.y - leg0Hole.y);

    let orientation, rotation;
    if (deltaX > deltaY) {
        orientation = 'horizontal';
        rotation = 0;  // No rotation for horizontal placement (legs left-right)
    } else {
        orientation = 'vertical';
        rotation = 90;  // Rotate 90° for vertical placement (legs up-down)
    }
    
    const actualSpacing = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    return {
        centerX,
        centerY,
        orientation,
        rotation,
        leg0Coords: { x: leg0Hole.x, y: leg0Hole.y },
        leg1Coords: { x: leg1Hole.x, y: leg1Hole.y },
        leg0HoleId: placement.leg0,
        leg1HoleId: placement.leg1,
        actualSpacing,
        componentType: BUTTON_CONFIG.component_type
    };
}

/**
 * Validate button placement
 */
function validateButtonPlacement(placement, breadboardHoles) {
    if (!placement.leg0 || !placement.leg1) {
        return { 
            valid: false, 
            error: 'Button requires both leg0 and leg1 placement' 
        };
    }
    
    const leg0Hole = breadboardHoles.find(h => h.id === placement.leg0);
    const leg1Hole = breadboardHoles.find(h => h.id === placement.leg1);
    
    if (!leg0Hole) {
        return { 
            valid: false, 
            error: `Leg0 hole "${placement.leg0}" not found` 
        };
    }
    if (!leg1Hole) {
        return { 
            valid: false, 
            error: `Leg1 hole "${placement.leg1}" not found` 
        };
    }
    
    // Check if legs are on same bus (would not work!)
    if (leg0Hole.bus === leg1Hole.bus) {
        return { 
            valid: false, 
            error: `Button legs on same bus "${leg0Hole.bus}" - button would never disconnect the circuit` 
        };
    }
    
    // Calculate spacing
    const deltaX = Math.abs(leg1Hole.x - leg0Hole.x);
    const deltaY = Math.abs(leg1Hole.y - leg0Hole.y);
    const actualSpacing = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    const { min, max } = BUTTON_CONFIG.pin_spacing;
    
    if (actualSpacing < min) {
        return { 
            valid: false, 
            error: `Button leg spacing too small: ${actualSpacing.toFixed(2)}mm (min: ${min}mm)` 
        };
    }
    
    if (actualSpacing > max) {
        return { 
            valid: false, 
            error: `Button leg spacing too large: ${actualSpacing.toFixed(2)}mm (max: ${max}mm)` 
        };
    }
    
    return { valid: true };
}

/**
 * Calculate scale factor for button (typically fixed)
 */
function calculateButtonScale(actualSpacing) {
    const { scale } = BUTTON_CONFIG.rendering;
    return scale;  // Buttons typically don't scale dynamically
}

console.log('Button geometry helper loaded (generic for tactile buttons)');

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BUTTON_CONFIG,
        calculateButtonPosition,
        validateButtonPlacement,
        calculateButtonScale
    };
}
