// us100-geometry.js
// Geometry calculations for US-100 Ultrasonic Distance Sensor
// 5-pin module: VCC, TRIG, ECHO, GND, GND-2

const US100_CONFIG = {
    component_type: 'us100-ultrasonic',

    // SVG rendering info (from Fritzing SVG)
    // Original SVG: viewBox="0 0 44 26" in mm units
    // The SVG has a transform="translate(22,0)" on the breadboard group
    svg: {
        file: 'components_svg/US-100_ultrasonic-distance-sensor.svg',
        viewBox: '0 0 44 26',
        width: 44,    // mm
        height: 26,   // mm

        // Pin positions relative to SVG center (after translate(22,0))
        // Pins are at y=20 in SVG, with 2.54mm spacing
        // Pin order left to right: VCC, TRIG, ECHO, GND, GND-2
        // x positions: -5.08, -2.54, 0, 2.54, 5.08 (relative to center)
        connectors: {
            vcc: {
                id: 'connector0pin',
                x: -5.08,  // mm from center
                y: 25.25   // bottom of pin (connector rect y + height)
            },
            trig: {
                id: 'connector1pin',
                x: -2.54,
                y: 25.25
            },
            echo: {
                id: 'connector2pin',
                x: 0,
                y: 25.25
            },
            gnd: {
                id: 'connector3pin',
                x: 2.54,
                y: 25.25
            },
            gnd2: {
                id: 'connector4pin',
                x: 5.08,
                y: 25.25
            }
        },

        // Body dimensions
        body: {
            centerX: 22,   // Center of viewBox (44/2)
            centerY: 13,   // Center of viewBox (26/2)
            width: 44,
            height: 26
        },

        // Pin spacing
        pinSpacing: 2.54  // mm between pins
    },

    // Pin spacing on breadboard (in pixels at default scale)
    // Standard breadboard hole spacing is 2.54mm = 0.1" = ~8.982px
    pin_spacing: {
        standard: 8.982,   // 1 hole apart
        total_width: 35.928  // 4 holes span (5 pins)
    },

    // Visual rendering settings
    rendering: {
        scale: 3.5,  // Scale factor to convert mm to px (approximate)
        verticalOffset: -70  // Offset so pins align with holes
    },

    default_orientation: 'vertical',
    polarity: 'polarized'
};

/**
 * Calculate US-100 rendering position
 * The sensor spans 5 breadboard holes
 * Placement specifies: vcc, trig, echo, gnd, gnd2 holes
 */
function calculateUS100Position(placement, breadboardHoles) {
    // We need at least vcc and gnd to calculate position
    // Ideally all 5 pins are specified, but we can work with fewer
    const requiredPins = ['vcc', 'gnd'];
    for (const pin of requiredPins) {
        if (!placement[pin]) {
            console.error(`US-100 placement requires at least ${pin} hole`);
            return null;
        }
    }

    // Get hole positions for specified pins
    const holes = {};
    const pinNames = ['vcc', 'trig', 'echo', 'gnd', 'gnd2'];

    for (const pin of pinNames) {
        if (placement[pin]) {
            const hole = breadboardHoles.find(h => h.id === placement[pin]);
            if (hole) {
                holes[pin] = hole;
            } else {
                console.warn(`US-100: Hole "${placement[pin]}" not found for pin ${pin}`);
            }
        }
    }

    if (!holes.vcc || !holes.gnd) {
        console.error('US-100: Could not find required holes');
        return null;
    }

    // Calculate center position from the holes we have
    // VCC is leftmost, GND-2 is rightmost
    // Center should be at ECHO position (middle pin)
    let centerX, centerY;

    if (holes.echo) {
        centerX = holes.echo.x;
        centerY = holes.echo.y;
    } else {
        // Estimate center from vcc and gnd
        centerX = (holes.vcc.x + holes.gnd.x) / 2;
        centerY = holes.vcc.y;  // All pins on same row
    }

    // Determine orientation based on pin positions
    const deltaX = Math.abs(holes.gnd.x - holes.vcc.x);
    const deltaY = Math.abs(holes.gnd.y - holes.vcc.y);

    let orientation, rotation;
    if (deltaX > deltaY) {
        orientation = 'horizontal';
        rotation = 0;
    } else {
        orientation = 'vertical';
        rotation = 90;
    }

    // Calculate actual spacing
    const actualSpacing = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    return {
        centerX,
        centerY,
        orientation,
        rotation,
        holes,
        actualSpacing,
        componentType: US100_CONFIG.component_type,
        // Store hole IDs for reference
        vccHoleId: placement.vcc,
        trigHoleId: placement.trig,
        echoHoleId: placement.echo,
        gndHoleId: placement.gnd,
        gnd2HoleId: placement.gnd2
    };
}

/**
 * Validate US-100 placement
 */
function validateUS100Placement(placement, breadboardHoles) {
    const requiredPins = ['vcc', 'trig', 'echo', 'gnd'];

    // Check required pins are specified
    for (const pin of requiredPins) {
        if (!placement[pin]) {
            return {
                valid: false,
                error: `US-100 requires ${pin} pin placement`
            };
        }
    }

    // Validate all specified holes exist
    const pinNames = ['vcc', 'trig', 'echo', 'gnd', 'gnd2'];
    const holes = {};

    for (const pin of pinNames) {
        if (placement[pin]) {
            const hole = breadboardHoles.find(h => h.id === placement[pin]);
            if (!hole) {
                return {
                    valid: false,
                    error: `Hole "${placement[pin]}" not found for pin ${pin}`
                };
            }
            holes[pin] = hole;
        }
    }

    // Check that pins are in correct order (VCC, TRIG, ECHO, GND, GND2)
    // They should be consecutive holes
    const presentPins = pinNames.filter(p => holes[p]);

    // Check pins are on same row (same Y coordinate)
    const yValues = presentPins.map(p => holes[p].y);
    const allSameY = yValues.every(y => Math.abs(y - yValues[0]) < 1);

    if (!allSameY) {
        // Check if they're in a column (vertical orientation)
        const xValues = presentPins.map(p => holes[p].x);
        const allSameX = xValues.every(x => Math.abs(x - xValues[0]) < 1);

        if (!allSameX) {
            return {
                valid: false,
                error: 'US-100 pins must be in a straight line (same row or column)'
            };
        }
    }

    // Check spacing between consecutive pins
    for (let i = 0; i < presentPins.length - 1; i++) {
        const pin1 = presentPins[i];
        const pin2 = presentPins[i + 1];
        const h1 = holes[pin1];
        const h2 = holes[pin2];

        const distance = Math.sqrt(
            Math.pow(h2.x - h1.x, 2) + Math.pow(h2.y - h1.y, 2)
        );

        // Should be approximately 1 hole spacing (8.982px)
        if (distance < 7 || distance > 11) {
            return {
                valid: false,
                error: `Pin spacing between ${pin1} and ${pin2} is incorrect (${distance.toFixed(2)}px, expected ~8.98px)`
            };
        }
    }

    return { valid: true };
}

/**
 * Get required holes for US-100
 */
function getUS100RequiredHoles(placement) {
    const holes = [];
    const pinNames = ['vcc', 'trig', 'echo', 'gnd', 'gnd2'];

    for (const pin of pinNames) {
        if (placement[pin]) {
            holes.push(placement[pin]);
        }
    }

    return holes;
}

console.log('US-100 geometry helper loaded');

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        US100_CONFIG,
        calculateUS100Position,
        validateUS100Placement,
        getUS100RequiredHoles
    };
}
