// photocell-geometry.js
// Geometry for Light Dependent Resistor (LDR/Photocell)

const PHOTOCELL_CONFIG = {
    component_type: 'photocell',

    // SVG rendering info
    svg: {
        file: 'components_svg/ldr.svg',
        viewBox: '0 0 24.328 10.932',
        width: 24.328,
        height: 10.932,

        // Connector positions (from Fritzing SVG)
        connectors: {
            pin0: {
                id: 'connector0leg',
                x: 1.05,
                y: 5.42
            },
            pin1: {
                id: 'connector1leg',
                x: 23.278,
                y: 5.42
            }
        },

        // Body dimensions
        body: {
            startX: 4.864,
            endX: 19.469,
            centerX: 12.164,
            centerY: 5.466,
            width: 14.605,
            height: 10.932
        },

        // Pin spacing in SVG
        pinSpacing: 22.228
    },

    // Pin spacing options on breadboard
    pin_spacing: {
        standard: 26.982,   // 3 holes (300 mil)
        min: 8.982,         // 1 hole
        max: 44.91,         // 5 holes
        increment: 8.982
    },

    // Visual rendering settings
    rendering: {
        dynamicScale: true,
        minScale: 0.5,
        maxScale: 1.1
    },

    default_orientation: 'horizontal',
    polarity: 'non-polarized',

    // Electrical properties
    electrical: {
        darkResistance: 300000,     // 300kΩ at 0.01 lux
        lightResistance: 400,       // 400Ω at 100 lux
        maxPower: 0.25,             // Watts
        responseCurve: 'logarithmic'
    }
};

/**
 * Calculate photocell rendering position
 */
function calculatePhotocellPosition(placement, breadboardHoles) {
    if (!placement.pin0 || !placement.pin1) {
        console.error('Photocell placement requires both pin0 and pin1');
        return null;
    }

    const pin0Hole = breadboardHoles.find(h => h.id === placement.pin0);
    const pin1Hole = breadboardHoles.find(h => h.id === placement.pin1);

    if (!pin0Hole || !pin1Hole) {
        console.error('Photocell holes not found:', placement);
        return null;
    }

    // Calculate center position
    const centerX = (pin0Hole.x + pin1Hole.x) / 2;
    const centerY = (pin0Hole.y + pin1Hole.y) / 2;

    // Calculate actual distance between pins
    const actualPinSpacing = Math.sqrt(
        Math.pow(pin1Hole.x - pin0Hole.x, 2) +
        Math.pow(pin1Hole.y - pin0Hole.y, 2)
    );

    // Calculate dynamic scale based on pin spacing
    const svgPinSpacing = PHOTOCELL_CONFIG.svg.pinSpacing;
    let scale = actualPinSpacing / svgPinSpacing;

    // Clamp scale to min/max
    const { minScale, maxScale } = PHOTOCELL_CONFIG.rendering;
    scale = Math.max(minScale, Math.min(maxScale, scale));

    // Determine orientation
    const deltaX = Math.abs(pin1Hole.x - pin0Hole.x);
    const deltaY = Math.abs(pin1Hole.y - pin0Hole.y);

    let orientation, rotation;
    if (deltaX > deltaY) {
        orientation = 'horizontal';
        rotation = 0;
    } else {
        orientation = 'vertical';
        rotation = 90;
    }

    return {
        centerX,
        centerY,
        orientation,
        rotation,
        scale,
        actualPinSpacing,
        pin0Coords: { x: pin0Hole.x, y: pin0Hole.y },
        pin1Coords: { x: pin1Hole.x, y: pin1Hole.y },
        pin0HoleId: placement.pin0,
        pin1HoleId: placement.pin1,
        componentType: PHOTOCELL_CONFIG.component_type
    };
}

/**
 * Validate photocell placement
 */
function validatePhotocellPlacement(placement, breadboardHoles) {
    if (!placement.pin0 || !placement.pin1) {
        return {
            valid: false,
            error: 'Photocell requires both pin0 and pin1 placement'
        };
    }

    const pin0Hole = breadboardHoles.find(h => h.id === placement.pin0);
    const pin1Hole = breadboardHoles.find(h => h.id === placement.pin1);

    if (!pin0Hole) {
        return {
            valid: false,
            error: `Pin0 hole "${placement.pin0}" not found`
        };
    }
    if (!pin1Hole) {
        return {
            valid: false,
            error: `Pin1 hole "${placement.pin1}" not found`
        };
    }

    // Check pin spacing
    const deltaX = Math.abs(pin1Hole.x - pin0Hole.x);
    const deltaY = Math.abs(pin1Hole.y - pin0Hole.y);
    const actualDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    const { min, max } = PHOTOCELL_CONFIG.pin_spacing;

    if (actualDistance < min || actualDistance > max) {
        return {
            valid: false,
            error: `Photocell pin spacing ${actualDistance.toFixed(1)}px out of range (${min}-${max}px)`
        };
    }

    // Non-polarized component, no bus checking needed (unlike LEDs)

    return { valid: true };
}

console.log('Photocell geometry helper loaded');

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PHOTOCELL_CONFIG,
        calculatePhotocellPosition,
        validatePhotocellPlacement
    };
}
