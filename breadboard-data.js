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
