// tb6612-geometry.js
// Geometry calculations for Adafruit TB6612 Dual Motor Driver
// Essential pins for basic 2-motor control

const TB6612_CONFIG = {
    component_type: 'tb6612-motor-driver',

    // SVG rendering info (from Fritzing SVG)
    // viewBox="0 0 54 75.725"
    svg: {
        file: 'components_svg/tb6612-motor-driver.svg',
        viewBox: '0 0 54 75.725',
        width: 54,      // px (in viewBox units)
        height: 75.725, // px

        // Pin positions from SVG analysis
        // Left side pins (control header) at x ≈ 7.2, spaced 7.2 apart vertically
        // Right side pins (motor outputs) at x ≈ 50.4
        // Top screw terminals for motor power
        connectors: {
            // Essential control pins (left side, from top to bottom)
            // connector8 = PWRIN at y=5.525 (internally connected to VM)
            // connector9 = VCC at y=12.725
            // connector10 = GND at y=19.925
            // connector11 = PWMB at y=27.125
            // connector12 = BIN2 at y=34.325
            // connector13 = BIN1 at y=41.525
            // connector14 = STBY at y=48.725
            // connector15 = AIN1 at y=55.925
            // connector16 = AIN2 at y=63.125
            // connector17 = PWMA at y=70.325
            vcc: { id: 'connector9pin', x: 7.2, y: 12.725 },
            gnd: { id: 'connector10pin', x: 7.2, y: 19.925 },
            pwmb: { id: 'connector11pin', x: 7.2, y: 27.125 },
            bin2: { id: 'connector12pin', x: 7.2, y: 34.325 },
            bin1: { id: 'connector13pin', x: 7.2, y: 41.525 },
            stby: { id: 'connector14pin', x: 7.2, y: 48.725 },
            ain1: { id: 'connector15pin', x: 7.2, y: 55.925 },
            ain2: { id: 'connector16pin', x: 7.2, y: 63.125 },
            pwma: { id: 'connector17pin', x: 7.2, y: 70.325 },

            // Motor output pins (right side)
            motora1: { id: 'connector18pin', x: 50.4, y: 55.925 },
            motora2: { id: 'connector19pin', x: 50.4, y: 48.725 },
            motorb2: { id: 'connector22pin', x: 50.4, y: 27.125 },
            motorb1: { id: 'connector23pin', x: 50.4, y: 19.925 },

            // Power terminals (top screw terminals)
            // VM (motor power) - connector6pin
            // GND - connector7pin
            vm: { id: 'connector6pin', x: 20.268, y: 48.462 }  // Approximate from screw terminal
        },

        // Body dimensions
        body: {
            centerX: 27,      // Center of viewBox (54/2)
            centerY: 37.86,   // Center of viewBox (75.725/2)
            width: 54,
            height: 75.725
        },

        // Pin spacing (standard 0.1" = 2.54mm ≈ 7.2 SVG units on this board)
        pinSpacingY: 7.2
    },

    // Visual rendering settings
    rendering: {
        scale: 1.25,       // Scale factor for rendering
        verticalOffset: 0  // Offset adjustment
    },

    default_orientation: 'vertical',
    polarity: 'polarized'
};

/**
 * Calculate TB6612 rendering position
 * The board is positioned based on control header pins (left side)
 */
function calculateTB6612Position(placement, breadboardHoles) {
    // Minimum required pins to position the board
    const requiredPins = ['vcc', 'gnd'];

    for (const pin of requiredPins) {
        if (!placement[pin]) {
            console.error(`TB6612 placement requires at least ${pin} hole`);
            return null;
        }
    }

    // Get hole positions for all specified pins
    const holes = {};
    const allPins = [
        'vm', 'vcc', 'gnd', 'stby',
        'ain1', 'ain2', 'pwma',
        'bin1', 'bin2', 'pwmb',
        'motora1', 'motora2', 'motorb1', 'motorb2'
    ];

    for (const pin of allPins) {
        if (placement[pin]) {
            const hole = breadboardHoles.find(h => h.id === placement[pin]);
            if (hole) {
                holes[pin] = hole;
            } else {
                console.warn(`TB6612: Hole "${placement[pin]}" not found for pin ${pin}`);
            }
        }
    }

    if (!holes.vcc || !holes.gnd) {
        console.error('TB6612: Could not find required holes (vcc, gnd)');
        return null;
    }

    // Calculate board center based on VCC pin position
    // VCC is at x=7.2 in SVG, so board center is offset from there
    const { scale } = TB6612_CONFIG.rendering;
    const svgVccX = TB6612_CONFIG.svg.connectors.vcc.x;
    const svgCenterX = TB6612_CONFIG.svg.body.centerX;

    // Board center X is offset from VCC hole position
    const centerX = holes.vcc.x + (svgCenterX - svgVccX) * scale;

    // Calculate Y position - VCC is near top of control header
    const svgVccY = TB6612_CONFIG.svg.connectors.vcc.y;
    const svgCenterY = TB6612_CONFIG.svg.body.centerY;
    const centerY = holes.vcc.y + (svgCenterY - svgVccY) * scale;

    // Build position object with all hole IDs
    const position = {
        centerX,
        centerY,
        orientation: 'vertical',
        rotation: 0,
        holes,
        componentType: TB6612_CONFIG.component_type
    };

    // Add all hole IDs to position
    for (const pin of allPins) {
        position[`${pin}HoleId`] = placement[pin] || null;
    }

    return position;
}

/**
 * Validate TB6612 placement
 */
function validateTB6612Placement(placement, breadboardHoles) {
    // Essential pins for basic operation
    const essentialPins = ['vcc', 'gnd'];

    for (const pin of essentialPins) {
        if (!placement[pin]) {
            return {
                valid: false,
                error: `TB6612 requires ${pin} pin placement for basic operation`
            };
        }
    }

    // Validate all specified holes exist
    const allPins = [
        'vm', 'vcc', 'gnd', 'stby',
        'ain1', 'ain2', 'pwma',
        'bin1', 'bin2', 'pwmb',
        'motora1', 'motora2', 'motorb1', 'motorb2'
    ];

    for (const pin of allPins) {
        if (placement[pin]) {
            const hole = breadboardHoles.find(h => h.id === placement[pin]);
            if (!hole) {
                return {
                    valid: false,
                    error: `Hole "${placement[pin]}" not found for pin ${pin}`
                };
            }
        }
    }

    // Validate control header pins are in a column (same X)
    const controlPins = ['vcc', 'gnd', 'stby', 'ain1', 'ain2', 'pwma', 'bin1', 'bin2', 'pwmb'];
    const specifiedControlPins = controlPins.filter(p => placement[p]);

    if (specifiedControlPins.length > 1) {
        const holes = specifiedControlPins.map(p =>
            breadboardHoles.find(h => h.id === placement[p])
        );

        // Check they're roughly aligned (same column, tolerance for breadboard layout)
        const xValues = holes.map(h => h.x);
        const xMin = Math.min(...xValues);
        const xMax = Math.max(...xValues);

        if (xMax - xMin > 5) {  // Allow small tolerance
            return {
                valid: false,
                error: 'TB6612 control pins should be in a single column'
            };
        }
    }

    return { valid: true };
}

/**
 * Get required holes for TB6612
 */
function getTB6612RequiredHoles(placement) {
    const holes = [];
    const allPins = [
        'vm', 'vcc', 'gnd', 'stby',
        'ain1', 'ain2', 'pwma',
        'bin1', 'bin2', 'pwmb',
        'motora1', 'motora2', 'motorb1', 'motorb2'
    ];

    for (const pin of allPins) {
        if (placement[pin]) {
            holes.push(placement[pin]);
        }
    }

    return holes;
}

console.log('TB6612 geometry helper loaded');

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TB6612_CONFIG,
        calculateTB6612Position,
        validateTB6612Placement,
        getTB6612RequiredHoles
    };
}
