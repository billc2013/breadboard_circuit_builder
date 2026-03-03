// Breadboard configuration based on standard half-size breadboard
const BREADBOARD_CONFIG = {
    canvas: {
        width: 292.41,
        height: 189,
        units: "mm",
        // Extend canvas for components that go beyond breadboard
        extended: {
            width: 400,
            height: 300
        }
    },
    grid: {
        hole_spacing: 8.982,
        hole_radius: 1.0
    },
    // Global origin for entire scene
    origin: {
        x: 50,  // Offset from left edge
        y: 50   // Offset from top edge
    },
    // Breadboard-specific positioning (relative to origin)
    breadboard: {
        offset: {
            x: 0,
            y: 0
        },
        power_rails: {
            x_offset: -3.35,  // Power rails are offset left from main grid
            top: {
                rows: ['W', 'X'],
                y_offset: [0, 9],  // Relative to breadboard top
                type: ['power', 'ground']
            },
            bottom: {
                rows: ['Y', 'Z'],
                y_offset: [161.648, 170.648],  // Relative to breadboard top
                type: ['power', 'ground']
            }
        },
        main_grid: {
            columns: 30,
            rows: {
                top: ['J', 'I', 'H', 'G', 'F'],
                bottom: ['E', 'D', 'C', 'B', 'A']
            },
            x_offset: 0,  // Main grid x baseline
            y_offset: {
                top: 35.9,      // Relative to breadboard top
                bottom: 98.744  // Relative to breadboard top
            }
        }
    }
};

// Generate all hole coordinates
function generateBreadboardData() {
    const holes = [];
    const { grid, origin, breadboard } = BREADBOARD_CONFIG;
    const { hole_spacing } = grid;
    
    // Calculate absolute breadboard origin
    const breadboardOriginX = origin.x + breadboard.offset.x;
    const breadboardOriginY = origin.y + breadboard.offset.y;
    
    // Main grid - top section (J-I-H-G-F)
    breadboard.main_grid.rows.top.forEach((row, rowIndex) => {
        for (let col = 1; col <= breadboard.main_grid.columns; col++) {
            holes.push({
                id: `${col}${row}`,
                column: col,
                row: row,
                x: breadboardOriginX + breadboard.main_grid.x_offset + (col - 1) * hole_spacing,
                y: breadboardOriginY + breadboard.main_grid.y_offset.top + rowIndex * hole_spacing,
                type: 'main',
                bus: `bus${col}-top` // Vertical connectivity
            });
        }
    });
    
    // Main grid - bottom section (E-D-C-B-A)
    breadboard.main_grid.rows.bottom.forEach((row, rowIndex) => {
        for (let col = 1; col <= breadboard.main_grid.columns; col++) {
            holes.push({
                id: `${col}${row}`,
                column: col,
                row: row,
                x: breadboardOriginX + breadboard.main_grid.x_offset + (col - 1) * hole_spacing,
                y: breadboardOriginY + breadboard.main_grid.y_offset.bottom + rowIndex * hole_spacing,
                type: 'main',
                bus: `bus${col}-bottom` // Vertical connectivity
            });
        }
    });
    
    // Power rails - top
    breadboard.power_rails.top.rows.forEach((row, rowIndex) => {
        let holeCounter = 1;
        
        for (let group = 0; group < 5; group++) {
            for (let holeInGroup = 0; holeInGroup < 5; holeInGroup++) {
                holes.push({
                    id: `${holeCounter}${row}`,
                    column: holeCounter,
                    row: row,
                    x: breadboardOriginX + breadboard.power_rails.x_offset + (group * 6 + holeInGroup) * hole_spacing,
                    y: breadboardOriginY + breadboard.power_rails.top.y_offset[rowIndex],
                    type: breadboard.power_rails.top.type[rowIndex],
                    bus: `rail-top-${row}` // Horizontal connectivity
                });
                holeCounter++;
            }
        }
    });
    
    // Power rails - bottom
    breadboard.power_rails.bottom.rows.forEach((row, rowIndex) => {
        let holeCounter = 1;

        for (let group = 0; group < 5; group++) {
            for (let holeInGroup = 0; holeInGroup < 5; holeInGroup++) {
                holes.push({
                    id: `${holeCounter}${row}`,
                    column: holeCounter,
                    row: row,
                    x: breadboardOriginX + breadboard.power_rails.x_offset + (group * 6 + holeInGroup) * hole_spacing,
                    y: breadboardOriginY + breadboard.power_rails.bottom.y_offset[rowIndex],
                    type: breadboard.power_rails.bottom.type[rowIndex],
                    bus: `rail-bottom-${row}` // Horizontal connectivity
                });
                holeCounter++;
            }
        }
    });
    
    return holes;
}

const BREADBOARD_HOLES = generateBreadboardData();

// Helper function to convert relative coordinates to absolute
function getAbsolutePosition(relativeX, relativeY) {
    const { origin } = BREADBOARD_CONFIG;
    return {
        x: origin.x + relativeX,
        y: origin.y + relativeY
    };
}

// Helper function to get breadboard bounds
function getBreadboardBounds() {
    const { origin, breadboard } = BREADBOARD_CONFIG;
    return {
        x: origin.x + breadboard.offset.x,
        y: origin.y + breadboard.offset.y,
        width: 292.41,
        height: 189
    };
}
