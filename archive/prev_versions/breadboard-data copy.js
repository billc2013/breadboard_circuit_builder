// Breadboard configuration based on standard half-size breadboard
const BREADBOARD_CONFIG = {
    canvas: {
        width: 292.41,
        height: 189,
        units: "mm"
    },
    grid: {
        hole_spacing: 8.982,
        hole_radius: 1.0,
        origin: { x: 17.25, y: 9.15, offset: 3.35 }
    },
    layout: {
        main_grid: {
            columns: 30,
            rows: {
                top: ['J', 'I', 'H', 'G', 'F'],
                bottom: ['E', 'D', 'C', 'B', 'A']
            },
            start_y_top: 45.05,      // Adjusted to match image
            start_y_bottom: 107.894,   // Adjusted for bottom section
            section_gap: 7.62
        },
        power_rails: {
            top: {
                rows: ['W', 'X'],
                y_positions: [9.15, 18.15],  // Adjusted for top rails
                type: ['power', 'ground']
            },
            bottom: {
                rows: ['Y', 'Z'],
                y_positions: [170.798, 179.798], // Adjusted for bottom rails
                type: ['power', 'ground']
            }
        }
    }

};

// Generate all hole coordinates
function generateBreadboardData() {
    const holes = [];
    const { grid, layout } = BREADBOARD_CONFIG;
    const { hole_spacing, origin } = grid;
    
    // Main grid - top section (A-E)
    layout.main_grid.rows.top.forEach((row, rowIndex) => {
        for (let col = 1; col <= layout.main_grid.columns; col++) {
            holes.push({
                id: `${col}${row}`,
                column: col,
                row: row,
                x: origin.x - origin.offset + (col - 1) * hole_spacing,
                y: layout.main_grid.start_y_top + rowIndex * hole_spacing,
                type: 'main',
                bus: `bus${col}-top` // Vertical connectivity
            });
        }
    });
    
    // Main grid - bottom section (F-J)
    layout.main_grid.rows.bottom.forEach((row, rowIndex) => {
        for (let col = 1; col <= layout.main_grid.columns; col++) {
            holes.push({
                id: `${col}${row}`,
                column: col,
                row: row,
                x: origin.x - origin.offset + (col - 1) * hole_spacing,
                y: layout.main_grid.start_y_bottom + rowIndex * hole_spacing,
                type: 'main',
                bus: `bus${col}-bottom` // Vertical connectivity
            });
        }
    });
    
    // Power rails - top
    layout.power_rails.top.rows.forEach((row, rowIndex) => {
        let holeCounter = 1; // For creating unique IDs
        
        for (let group = 0; group < 5; group++) { // 6 groups of 5 holes each = 30 total
            for (let holeInGroup = 0; holeInGroup < 5; holeInGroup++) {
                holes.push({
                    id: `${holeCounter}${row}`,
                    column: holeCounter,
                    row: row,
                    x: origin.x + (group * 6 + holeInGroup) * hole_spacing, // 6 holes per group (5 holes + 1 gap)
                    y: layout.power_rails.top.y_positions[rowIndex],
                    type: layout.power_rails.top.type[rowIndex],
                    bus: `rail-top-${row}-group${group}` // Each group of 5 is isolated
                });
                holeCounter++;
            }
        }
    });
    
    // Power rails - bottom
    layout.power_rails.bottom.rows.forEach((row, rowIndex) => {
        let holeCounter = 1; // For creating unique IDs

        for (let group = 0; group < 5; group++) { // 6 groups of 5 holes each = 30 total
            for (let holeInGroup = 0; holeInGroup < 5; holeInGroup++) {
                holes.push({
                    id: `${holeCounter}${row}`,
                    column: holeCounter,
                    row: row,
                    x: origin.x + (group * 6 + holeInGroup) * hole_spacing, // 6 holes per group (5 holes + 1 gap)
                    y: layout.power_rails.bottom.y_positions[rowIndex],
                    type: layout.power_rails.bottom.type[rowIndex],
                    bus: `rail-bottom-${row}-group${group}` // Each group of 5 is isolated
                });
            }
        }
    });
    
    return holes;
}

const BREADBOARD_HOLES = generateBreadboardData();