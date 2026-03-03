// Breadboard configuration based on standard half-size breadboard
const BREADBOARD_CONFIG = {
    canvas: {
        viewBox: "0 0 400 300"
    },
    breadboard: {
        // Reference to DOM element
        svg_element_id: "breadboard-image",
        expected_position: null,  // Disable position validation
        
        // Dimensions and internal structure (LLM-readable)
        dimensions: {
            width: 292.41,
            height: 189
        },
        
        // Internal offset (measurement within SVG to first holes)
        internal_offset: {
            x_main_grid: 13.9,      // Distance to first main grid column
            x_power_rails: 17.3,    // Distance to first power rail column (13.9 - 3.35)
            y: 9.15                    // Will be added to y_from_svg_top values
        },
        
        // Expected position (for validation)
        expected_position: {
            x: 50,
            y: 50
        }
    },
    grid: {
        hole_spacing: 8.982,
        hole_radius: 1.0
    },
    layout: {
        main_grid: {
            columns: 30,
            rows: {
                top: ['J', 'I', 'H', 'G', 'F'],
                bottom: ['E', 'D', 'C', 'B', 'A']
            },
            // Y positions relative to SVG top edge
            y_from_svg_top: {
                top: 35.9,       // 45.05 - 9.15 (adjusting from your absolute to relative)
                bottom: 98.744   // 107.894 - 9.15
            }
        },
        power_rails: {
            top: {
                rows: ['W', 'X'],
                y_from_svg_top: [0, 9],  // Relative to SVG top (9.15 was absolute)
                type: ['power', 'ground']
            },
            bottom: {
                rows: ['Y', 'Z'],
                y_from_svg_top: [161.648, 170.648],  // 170.798 - 9.15, 179.798 - 9.15
                type: ['power', 'ground']
            }
        }
    }
};

// Initialize: Read actual position from DOM and validate
function initializeBreadboard() {
    const img = document.getElementById(BREADBOARD_CONFIG.breadboard.svg_element_id);
    
    if (!img) {
        console.error('Breadboard image not found! Check svg_element_id');
        return { x: 0, y: 0 };
    }
    
    const actualX = parseFloat(img.getAttribute('x'));
    const actualY = parseFloat(img.getAttribute('y'));
    
    
    console.log('Breadboard initialized at:', { x: actualX, y: actualY });
    return { x: actualX, y: actualY };
}

// Generate all hole coordinates
function generateBreadboardData() {
    const holes = [];
    const { grid, layout, breadboard } = BREADBOARD_CONFIG;
    const { hole_spacing } = grid;
    
    // Get actual breadboard position from DOM
    const breadboardPos = initializeBreadboard();
    
    // Calculate base positions
    const mainGridBaseX = breadboardPos.x + breadboard.internal_offset.x_main_grid;
    const powerRailBaseX = breadboardPos.x + breadboard.internal_offset.x_power_rails;
    const svgBaseY = breadboardPos.y + breadboard.internal_offset.y;
    
    // Main grid - top section (J-I-H-G-F)
    layout.main_grid.rows.top.forEach((row, rowIndex) => {
        for (let col = 1; col <= layout.main_grid.columns; col++) {
            holes.push({
                id: `${col}${row}`,
                column: col,
                row: row,
                x: mainGridBaseX + (col - 1) * hole_spacing,
                y: svgBaseY + layout.main_grid.y_from_svg_top.top + rowIndex * hole_spacing,
                type: 'main',
                bus: `bus${col}-top` // Vertical connectivity
            });
        }
    });
    
    // Main grid - bottom section (E-D-C-B-A)
    layout.main_grid.rows.bottom.forEach((row, rowIndex) => {
        for (let col = 1; col <= layout.main_grid.columns; col++) {
            holes.push({
                id: `${col}${row}`,
                column: col,
                row: row,
                x: mainGridBaseX + (col - 1) * hole_spacing,
                y: svgBaseY + layout.main_grid.y_from_svg_top.bottom + rowIndex * hole_spacing,
                type: 'main',
                bus: `bus${col}-bottom` // Vertical connectivity
            });
        }
    });
    
    // Power rails - top
    layout.power_rails.top.rows.forEach((row, rowIndex) => {
        let holeCounter = 1;
        
        for (let group = 0; group < 5; group++) {
            for (let holeInGroup = 0; holeInGroup < 5; holeInGroup++) {
                holes.push({
                    id: `${holeCounter}${row}`,
                    column: holeCounter,
                    row: row,
                    x: powerRailBaseX + (group * 6 + holeInGroup) * hole_spacing,
                    y: svgBaseY + layout.power_rails.top.y_from_svg_top[rowIndex],
                    type: layout.power_rails.top.type[rowIndex],
                    bus: `rail-top-${row}-group${group}` // Each group of 5 is isolated
                });
                holeCounter++;
            }
        }
    });
    
    // Power rails - bottom
    layout.power_rails.bottom.rows.forEach((row, rowIndex) => {
        let holeCounter = 1;

        for (let group = 0; group < 5; group++) {
            for (let holeInGroup = 0; holeInGroup < 5; holeInGroup++) {
                holes.push({
                    id: `${holeCounter}${row}`,
                    column: holeCounter,
                    row: row,
                    x: powerRailBaseX + (group * 6 + holeInGroup) * hole_spacing,
                    y: svgBaseY + layout.power_rails.bottom.y_from_svg_top[rowIndex],
                    type: layout.power_rails.bottom.type[rowIndex],
                    bus: `rail-bottom-${row}-group${group}` // Each group of 5 is isolated
                });
                holeCounter++;
            }
        }
    });
    
    return holes;
}

const BREADBOARD_HOLES = generateBreadboardData();

// Helper functions
function getAbsolutePosition(relativeX, relativeY) {
    const breadboardPos = initializeBreadboard();
    return {
        x: breadboardPos.x + relativeX,
        y: breadboardPos.y + relativeY
    };
}

function getBreadboardBounds() {
    const breadboardPos = initializeBreadboard();
    const { dimensions } = BREADBOARD_CONFIG.breadboard;
    return {
        x: breadboardPos.x,
        y: breadboardPos.y,
        width: dimensions.width,
        height: dimensions.height
    };
}

console.log('Breadboard data generated:', BREADBOARD_HOLES.length, 'holes');

/**
 * Parse bus reference from LLM format (e.g., "Bus9A-D", "Bus2F-J")
 * @param {string} busRef - Bus reference string
 * @returns {Object} - { column: number, rows: string[], section: 'top'|'bottom' }
 */
function parseBusReference(busRef) {
    // Match pattern: Bus[number][row]-[row]
    // Examples: "Bus9A-D", "Bus2F-J", "Bus15E-A"
    const match = busRef.match(/^Bus(\d+)([A-J])-([A-J])$/i);

    if (!match) {
        throw new Error(`Invalid bus reference format: ${busRef}. Expected format: Bus9A-D`);
    }

    const column = parseInt(match[1]);
    const startRow = match[2].toUpperCase();
    const endRow = match[3].toUpperCase();

    // Define row order for each section
    const bottomRows = ['A', 'B', 'C', 'D', 'E'];  // Bottom section
    const topRows = ['F', 'G', 'H', 'I', 'J'];     // Top section

    // Determine which section
    let section, allRows;
    if (bottomRows.includes(startRow) && bottomRows.includes(endRow)) {
        section = 'bottom';
        allRows = bottomRows;
    } else if (topRows.includes(startRow) && topRows.includes(endRow)) {
        section = 'top';
        allRows = topRows;
    } else {
        throw new Error(`Bus reference spans both sections: ${busRef}. Use A-E or F-J only.`);
    }

    // Get row range
    const startIdx = allRows.indexOf(startRow);
    const endIdx = allRows.indexOf(endRow);

    if (startIdx === -1 || endIdx === -1) {
        throw new Error(`Invalid rows in bus reference: ${busRef}`);
    }

    // Support both directions (A-D or D-A)
    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);
    const rows = allRows.slice(minIdx, maxIdx + 1);

    return { column, rows, section };
}

/**
 * Get all holes matching a bus reference
 * @param {string} busRef - Bus reference (e.g., "Bus9A-D")
 * @returns {Array} - Array of matching holes
 */
function getHolesForBusReference(busRef) {
    const { column, rows, section } = parseBusReference(busRef);
    const busName = `bus${column}-${section}`;

    // Find all holes in this bus matching the row constraints
    const matchingHoles = BREADBOARD_HOLES.filter(hole => {
        return hole.bus === busName && rows.includes(hole.row);
    });

    if (matchingHoles.length === 0) {
        throw new Error(`No holes found for bus reference: ${busRef}`);
    }

    return matchingHoles;
}

/**
 * Get first available hole from bus reference
 * @param {string} busRef - Bus reference (e.g., "Bus9A-D")
 * @returns {Object} - First available hole, or null if all occupied
 */
function getAvailableHoleFromBus(busRef) {
    const holes = getHolesForBusReference(busRef);

    // Find first unoccupied hole
    for (const hole of holes) {
        const holeElement = document.querySelector(`[data-hole-id="${hole.id}"]`);
        if (holeElement && !holeElement.classList.contains('occupied')) {
            return hole;
        }
    }

    // If all occupied, return first hole (will trigger warning)
    console.warn(`⚠️  All holes in ${busRef} are occupied, using first hole: ${holes[0].id}`);
    return holes[0];
}

/**
 * Resolve wire endpoint to hole ID
 * Supports both direct hole references (e.g., "20J") and bus references (e.g., "Bus9A-D")
 * @param {string} endpoint - Wire endpoint reference
 * @returns {Object} - { resolvedId: string, busReference: string|null, validHoles: Array|null }
 */
function resolveWireEndpoint(endpoint) {
    // Check if it's a Pico pin reference
    if (endpoint.startsWith('pico1.')) {
        return {
            resolvedId: endpoint,
            busReference: null,
            validHoles: null
        };
    }

    // Check if it's a bus reference (case-insensitive)
    if (endpoint.toLowerCase().startsWith('bus')) {
        const allHoles = getHolesForBusReference(endpoint);
        const availableHole = getAvailableHoleFromBus(endpoint);
        console.log(`  ℹ️  Resolved ${endpoint} → ${availableHole.id} (${allHoles.length} holes in bus)`);

        return {
            resolvedId: availableHole.id,
            busReference: endpoint,
            validHoles: allHoles.map(h => h.id)  // All hole IDs in this bus
        };
    }

    // Otherwise, treat as direct hole reference (e.g., "20J" or "20j")
    // Normalize to uppercase to match stored hole IDs
    const normalizedEndpoint = normalizeHoleReference(endpoint);
    return {
        resolvedId: normalizedEndpoint,
        busReference: null,
        validHoles: null
    };
}

/**
 * Normalize hole reference to uppercase
 * Converts "2e" → "2E", "10j" → "10J", etc.
 * @param {string} holeRef - Hole reference
 * @returns {string} - Normalized uppercase reference
 */
function normalizeHoleReference(holeRef) {
    // Convert to uppercase for consistency with stored hole IDs
    return holeRef.toUpperCase();
}
