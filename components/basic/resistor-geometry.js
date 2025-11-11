// resistor-geometry.js
// Generic geometry for ALL through-hole resistors (220Ω, 1kΩ, 10kΩ, etc.)
// Resistance value is specified in metadata JSON, not in geometry

const RESISTOR_CONFIG = {
    component_type: 'resistor',  // Generic type
    
    // SVG rendering info (same for all resistance values)
    svg: {
        file: 'components_svg/resistor_220.svg',  // We'll update label/bands dynamically
        viewBox: '0 0 42.917 9.71',
        width: 42.917,
        height: 9.71,
        
        // Connector positions (from Fritzing SVG)
        connectors: {
            pin0: {
                id: 'connector0leg',
                x: 1.455,
                y: 5.045
            },
            pin1: {
                id: 'connector1leg',
                x: 41.462,
                y: 5.045
            }
        },
        
        // Body dimensions
        body: {
            startX: 8.563,
            endX: 34.303,
            width: 25.74,
            height: 9.71,
            centerY: 4.855
        },
        
        // Pin spacing in SVG
        pinSpacing: 40.007
    },
    
    // Pin spacing options on breadboard (same for all values)
    pin_spacing: {
        standard: 26.982,   // 3 holes (400 mil)
        min: 8.982,         // 1 hole
        max: 44.91,         // 5 holes
        increment: 8.982
    },
    
    // Visual rendering settings
    rendering: {
        dynamicScale: true,
        minScale: 0.4,
        maxScale: 1.2
    },
    
    default_orientation: 'horizontal',
    polarity: 'non-polarized',

    // Color band rendering (positions in SVG coordinates)
    colorBands: {
        positions: [
            { x: 11.5, width: 2.5 },  // Band 1 (first digit)
            { x: 15.5, width: 2.5 },  // Band 2 (second digit)
            { x: 19.5, width: 2.5 },  // Band 3 (multiplier)
            { x: 28.0, width: 2.0 }   // Band 4 (tolerance)
        ],
        y: 2.5,        // Top of bands
        height: 4.5,   // Height of bands (covers body)

        // Color mapping (resistor color code standard)
        colors: {
            'Black': '#000000',
            'Brown': '#8B4513',
            'Red': '#FF0000',
            'Orange': '#FF8C00',
            'Yellow': '#FFFF00',
            'Green': '#00FF00',
            'Blue': '#0000FF',
            'Violet': '#9400D3',
            'Grey': '#808080',
            'White': '#FFFFFF',
            'Gold': '#FFD700',
            'Silver': '#C0C0C0'
        }
    },

    // Common resistor values and their properties
    // Used for validation and label generation
    commonValues: {
        220: {
            colorBands: ['Red', 'Red', 'Brown', 'Gold'],  // 2-2-×10-±5%
            label: '220Ω',
            power: 0.25
        },
        470: {
            colorBands: ['Yellow', 'Violet', 'Brown', 'Gold'],  // 4-7-×10-±5%
            label: '470Ω',
            power: 0.25
        },
        '1k': {
            colorBands: ['Brown', 'Black', 'Red', 'Gold'],  // 1-0-×100-±5%
            label: '1kΩ',
            power: 0.25
        },
        '10k': {
            colorBands: ['Brown', 'Black', 'Orange', 'Gold'],  // 1-0-×1000-±5%
            label: '10kΩ',
            power: 0.25
        },
        '100k': {
            colorBands: ['Brown', 'Black', 'Yellow', 'Gold'],  // 1-0-×10000-±5%
            label: '100kΩ',
            power: 0.25
        }
    }
};

/**
 * Calculate resistor rendering position (same for all values)
 */
function calculateResistorPosition(placement, breadboardHoles) {
    if (!placement.pin0 || !placement.pin1) {
        console.error('Resistor placement requires both pin0 and pin1 holes');
        return null;
    }
    
    const pin0Hole = breadboardHoles.find(h => h.id === placement.pin0);
    const pin1Hole = breadboardHoles.find(h => h.id === placement.pin1);
    
    if (!pin0Hole || !pin1Hole) {
        console.error('Resistor holes not found:', placement);
        return null;
    }
    
    const centerX = (pin0Hole.x + pin1Hole.x) / 2;
    const centerY = (pin0Hole.y + pin1Hole.y) / 2;
    
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
 * Validate resistor placement (same for all values)
 */
function validateResistorPlacement(placement, breadboardHoles) {
    if (!placement.pin0 || !placement.pin1) {
        return { 
            valid: false, 
            error: 'Resistor requires both pin0 and pin1 placement' 
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
    
    if (pin0Hole.bus === pin1Hole.bus) {
        return { 
            valid: false, 
            error: `Resistor pins on same bus "${pin0Hole.bus}" - this creates a short circuit with no resistance!` 
        };
    }
    
    const deltaX = Math.abs(pin1Hole.x - pin0Hole.x);
    const deltaY = Math.abs(pin1Hole.y - pin0Hole.y);
    const actualSpacing = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    const { min, max, standard } = RESISTOR_CONFIG.pin_spacing;
    
    if (actualSpacing < min) {
        return { 
            valid: false, 
            error: `Resistor pin spacing too small: ${actualSpacing.toFixed(2)}mm (min: ${min}mm)` 
        };
    }
    
    if (actualSpacing > max) {
        return { 
            valid: false, 
            error: `Resistor pin spacing too large: ${actualSpacing.toFixed(2)}mm (max: ${max}mm). Leads cannot stretch this far.` 
        };
    }
    
    const spacingDifference = Math.abs(actualSpacing - standard);
    if (spacingDifference > 1) {
        const numHoles = Math.round(actualSpacing / RESISTOR_CONFIG.pin_spacing.increment);
        return { 
            valid: true, 
            warning: `Non-standard resistor spacing: ${numHoles} holes (${actualSpacing.toFixed(2)}mm). Standard is 3 holes (${standard}mm).` 
        };
    }
    
    return { valid: true };
}

/**
 * Calculate dynamic scale factor for resistor body
 */
function calculateResistorScale(actualSpacing) {
    const svgPinSpacing = RESISTOR_CONFIG.svg.pinSpacing;
    const { minScale, maxScale } = RESISTOR_CONFIG.rendering;
    
    let scale = actualSpacing / svgPinSpacing;
    scale = Math.max(minScale, Math.min(maxScale, scale));
    
    return scale;
}

/**
 * Extract resistance value from metadata
 * Returns standardized key like '220', '1k', '10k'
 */
function extractResistanceValue(metadata) {
    if (!metadata || !metadata.properties) {
        return '220';  // Default
    }
    
    const resistance = metadata.properties.resistance;
    
    if (!resistance) return '220';
    
    // Convert to standard key
    if (resistance >= 1000) {
        const kValue = resistance / 1000;
        return `${kValue}k`;  // e.g., '10k', '100k'
    }
    
    return resistance.toString();  // e.g., '220', '470'
}

/**
 * Get resistor label text (e.g., "220Ω", "10kΩ")
 */
function getResistorLabel(metadata) {
    const valueKey = extractResistanceValue(metadata);
    const commonValue = RESISTOR_CONFIG.commonValues[valueKey];

    if (commonValue) {
        return commonValue.label;
    }

    // Fallback: format from raw resistance value
    const resistance = metadata?.properties?.resistance || 220;

    if (resistance >= 1000000) {
        return `${(resistance / 1000000).toFixed(1)}MΩ`;
    } else if (resistance >= 1000) {
        return `${(resistance / 1000).toFixed(1)}kΩ`;
    } else {
        return `${resistance}Ω`;
    }
}

/**
 * Get color bands for a resistance value
 * @param {Object} metadata - Component metadata
 * @returns {Array} Array of color names ['Red', 'Red', 'Brown', 'Gold']
 */
function getResistorColorBands(metadata) {
    const valueKey = extractResistanceValue(metadata);
    const commonValue = RESISTOR_CONFIG.commonValues[valueKey];

    if (commonValue && commonValue.colorBands) {
        return commonValue.colorBands;
    }

    // Fallback to default (220Ω)
    console.warn(`No color bands defined for ${valueKey}, using 220Ω default`);
    return ['Red', 'Red', 'Brown', 'Gold'];
}

console.log('Resistor geometry helper loaded (generic for all values)');

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        RESISTOR_CONFIG,
        calculateResistorPosition,
        validateResistorPlacement,
        calculateResistorScale,
        extractResistanceValue,
        getResistorLabel,
        getResistorColorBands
    };
}
