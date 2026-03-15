// Breadboard configuration for cropped half-size breadboard (no power rails)
// Based on archive/guided-wiring/breadboard-data.js, simplified for parse_to_breadboard branch
// SVG: components_svg/Half_breadboard_nopwr.svg (viewBox "0 33 292.41 120")

const BREADBOARD_CONFIG = {
    breadboard: {
        svg_element_id: "breadboard-image",
        dimensions: {
            width: 292.41,
            height: 120       // Cropped height (was 189 with power rails)
        },
        // Internal offset: distance from SVG content origin to first hole centers
        // x_main_grid: X offset to first column center within the SVG
        // viewBox_y: the viewBox Y origin (cropped SVG starts at y=33)
        // y_offset: original internal Y offset for hole calculations
        internal_offset: {
            x_main_grid: 13.9,
            viewBox_y: 33,      // Cropped viewBox starts here
            y_offset: 9.15      // Original internal Y offset
        }
    },
    grid: {
        hole_spacing: 8.982,
        hole_radius: 1.0
    },
    layout: {
        columns: 30,
        rows: {
            top: ['J', 'I', 'H', 'G', 'F'],     // Top section
            bottom: ['E', 'D', 'C', 'B', 'A']    // Bottom section
        },
        // Y positions relative to original SVG top (before cropping)
        y_from_svg_origin: {
            top: 35.9,        // Row J starts here (relative to SVG origin + y_offset)
            bottom: 98.744    // Row E starts here
        }
    }
};

/**
 * Read breadboard image position from DOM
 * @returns {{x: number, y: number}}
 */
function initializeBreadboard() {
    const img = document.getElementById(BREADBOARD_CONFIG.breadboard.svg_element_id);
    if (!img) {
        console.error('[BreadboardData] Breadboard image not found:', BREADBOARD_CONFIG.breadboard.svg_element_id);
        return { x: 0, y: 0 };
    }
    return {
        x: parseFloat(img.getAttribute('x')),
        y: parseFloat(img.getAttribute('y'))
    };
}

/**
 * Generate all breadboard hole coordinates in parent SVG space
 * Accounts for cropped viewBox offset
 * @returns {Array} Array of hole objects with {id, column, row, x, y, type, bus}
 */
function generateBreadboardData() {
    const holes = [];
    const { grid, layout, breadboard } = BREADBOARD_CONFIG;
    const { hole_spacing } = grid;

    const breadboardPos = initializeBreadboard();

    // X base: image position + internal offset to first column
    const baseX = breadboardPos.x + breadboard.internal_offset.x_main_grid;

    // Y base: image position + y_offset - viewBox_y (accounts for cropped viewport)
    const baseY = breadboardPos.y + breadboard.internal_offset.y_offset - breadboard.internal_offset.viewBox_y;

    // Top section (J-I-H-G-F)
    layout.rows.top.forEach((row, rowIndex) => {
        for (let col = 1; col <= layout.columns; col++) {
            holes.push({
                id: `${col}${row}`,
                column: col,
                row: row,
                x: baseX + (col - 1) * hole_spacing,
                y: baseY + layout.y_from_svg_origin.top + rowIndex * hole_spacing,
                type: 'main',
                bus: `bus${col}-top`
            });
        }
    });

    // Bottom section (E-D-C-B-A)
    layout.rows.bottom.forEach((row, rowIndex) => {
        for (let col = 1; col <= layout.columns; col++) {
            holes.push({
                id: `${col}${row}`,
                column: col,
                row: row,
                x: baseX + (col - 1) * hole_spacing,
                y: baseY + layout.y_from_svg_origin.bottom + rowIndex * hole_spacing,
                type: 'main',
                bus: `bus${col}-bottom`
            });
        }
    });

    return holes;
}

const BREADBOARD_HOLES = generateBreadboardData();

/**
 * Look up a hole by its ID string (e.g., "5J", "12E")
 * @param {string} holeId
 * @returns {Object|undefined}
 */
function getHoleById(holeId) {
    const normalized = holeId.toUpperCase();
    return BREADBOARD_HOLES.find(h => h.id === normalized);
}

/**
 * Get breadboard bounds in parent SVG coordinate space
 * @returns {{x: number, y: number, width: number, height: number}}
 */
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

/**
 * Parse bus reference from format "Bus9A-D" or "Bus2F-J"
 * @param {string} busRef
 * @returns {{column: number, rows: string[], section: string}}
 */
function parseBusReference(busRef) {
    const match = busRef.match(/^Bus(\d+)([A-J])-([A-J])$/i);
    if (!match) {
        throw new Error(`Invalid bus reference: ${busRef}. Expected: Bus9A-D`);
    }

    const column = parseInt(match[1]);
    const startRow = match[2].toUpperCase();
    const endRow = match[3].toUpperCase();

    const bottomRows = ['A', 'B', 'C', 'D', 'E'];
    const topRows = ['F', 'G', 'H', 'I', 'J'];

    let section, allRows;
    if (bottomRows.includes(startRow) && bottomRows.includes(endRow)) {
        section = 'bottom';
        allRows = bottomRows;
    } else if (topRows.includes(startRow) && topRows.includes(endRow)) {
        section = 'top';
        allRows = topRows;
    } else {
        throw new Error(`Bus spans both sections: ${busRef}. Use A-E or F-J only.`);
    }

    const startIdx = allRows.indexOf(startRow);
    const endIdx = allRows.indexOf(endRow);
    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);

    return { column, rows: allRows.slice(minIdx, maxIdx + 1), section };
}

/**
 * Get all holes matching a bus reference
 * @param {string} busRef - e.g., "Bus9A-D"
 * @returns {Array}
 */
function getHolesForBusReference(busRef) {
    const { column, rows, section } = parseBusReference(busRef);
    const busName = `bus${column}-${section}`;
    const matching = BREADBOARD_HOLES.filter(h => h.bus === busName && rows.includes(h.row));
    if (matching.length === 0) {
        throw new Error(`No holes found for: ${busRef}`);
    }
    return matching;
}

/**
 * Normalize hole reference to uppercase
 * @param {string} holeRef
 * @returns {string}
 */
function normalizeHoleReference(holeRef) {
    return holeRef.toUpperCase();
}

console.log('[BreadboardData] Generated', BREADBOARD_HOLES.length, 'holes (no power rails)');
