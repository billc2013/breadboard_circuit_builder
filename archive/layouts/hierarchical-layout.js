/**
 * Hierarchical Layout Engine
 *
 * Positions circuit components in a hierarchical tree structure with:
 * - Pico at the center
 * - Functional groups arranged radially around the Pico
 * - Support components (resistors) grouped with their primary component
 * - Bezier curve wire routing for clean visual connections
 *
 * Educational goal: Show conceptual relationships rather than physical placement,
 * helping students build mental models of circuit structure.
 *
 * @author Bill Church with Claude Code
 * @version 1.0.0
 */

class HierarchicalLayoutEngine extends LayoutEngine {
    constructor() {
        // Larger canvas for abstract view
        super(600, 500);

        // Pico positioning
        this.picoCenter = { x: 120, y: 250 };  // Left-center for tree expansion to right
        this.picoSize = { width: 80, height: 140 };

        // Group layout parameters
        this.groupRadius = 200;           // Distance from Pico to functional groups
        this.groupSpacing = 120;          // Vertical spacing between groups
        this.componentSpacing = 70;       // Space between components within a group
        this.pinSpacing = 10;             // Default spacing for component pins

        // Wire routing
        this.wireCurvature = 0.4;         // Bezier control point factor (0-1)
    }

    getName() {
        return 'Hierarchical Tree';
    }

    getDescription() {
        return 'Components arranged in a tree structure with Pico at the root';
    }

    /**
     * Calculate layout for entire circuit
     * @param {Object} circuitData - Full circuit JSON
     * @param {Array} functionalGroups - Detected functional groups
     */
    calculateLayout(circuitData, functionalGroups) {
        console.log('[HierarchicalLayout] Calculating layout for', functionalGroups.length, 'groups');

        this.clear();

        const components = circuitData?.circuit?.components || [];
        const wires = circuitData?.circuit?.wires || [];

        // Store component placement data for wire endpoint resolution
        this.componentPlacements = new Map();
        this.holeToComponent = new Map();  // Maps hole IDs to {componentId, pinName}

        for (const comp of components) {
            this.componentPlacements.set(comp.id, comp.placement);
            // Build reverse lookup: hole ID -> component pin
            if (comp.placement) {
                for (const [pinName, holeId] of Object.entries(comp.placement)) {
                    if (holeId && typeof holeId === 'string') {
                        this.holeToComponent.set(holeId.toUpperCase(), {
                            componentId: comp.id,
                            pinName: pinName
                        });
                    }
                }
            }
        }

        // Extract which Pico pins are actually used
        this.extractConnectedPicoPins(wires);

        // 1. Position Pico at center-left
        this.positionPico();

        // 2. Position functional groups in a tree structure
        this.positionFunctionalGroups(functionalGroups, components);

        // 3. Position any orphan components (not in a functional group)
        this.positionOrphanComponents(components, functionalGroups);

        // 4. Calculate wire routes
        this.calculateAllWireRoutes(wires);

        console.log('[HierarchicalLayout] Layout complete:',
                    this.componentPositions.size, 'components,',
                    this.wireRoutes.size, 'wires');
    }

    /**
     * Position the Pico representation
     */
    positionPico() {
        this.picoPosition = {
            centerX: this.picoCenter.x,
            centerY: this.picoCenter.y,
            width: this.picoSize.width,
            height: this.picoSize.height,
            type: 'pico-abstract'
        };

        // Also store as a component position for wire routing
        this.setComponentPosition('pico1', this.picoPosition);
    }

    /**
     * Position functional groups in a vertical tree layout
     * @param {Array} groups - Functional groups
     * @param {Array} components - All components
     */
    positionFunctionalGroups(groups, components) {
        if (groups.length === 0) {
            console.log('[HierarchicalLayout] No functional groups to position');
            return;
        }

        // Calculate vertical distribution of groups
        const totalHeight = (groups.length - 1) * this.groupSpacing;
        const startY = this.picoCenter.y - totalHeight / 2;

        groups.forEach((group, index) => {
            const groupY = startY + index * this.groupSpacing;
            const groupX = this.picoCenter.x + this.groupRadius;

            console.log(`[HierarchicalLayout] Positioning group "${group.id}" at (${groupX}, ${groupY})`);

            // Position primary component (LED, button, photocell)
            this.positionComponent(group.primaryComponent, groupX, groupY, components);

            // Position support components (resistors) to the right of primary
            if (group.supportComponents && group.supportComponents.length > 0) {
                group.supportComponents.forEach((supportId, supportIndex) => {
                    const supportX = groupX + this.componentSpacing;
                    const supportY = groupY + (supportIndex * 40);
                    this.positionComponent(supportId, supportX, supportY, components);
                });
            }

            // Store group bounds for potential group box rendering
            group.bounds = {
                x: groupX - 40,
                y: groupY - 40,
                width: this.componentSpacing + 80,
                height: 80
            };
        });
    }

    /**
     * Position a single component at the given coordinates
     * @param {string} componentId
     * @param {number} x - Center X
     * @param {number} y - Center Y
     * @param {Array} components - All components (to get type info)
     */
    positionComponent(componentId, x, y, components) {
        const componentData = components.find(c => c.id === componentId);

        if (!componentData) {
            console.warn(`[HierarchicalLayout] Component not found: ${componentId}`);
            return;
        }

        const componentType = componentData.type.toLowerCase();

        // Create position object compatible with existing adapters
        const position = {
            centerX: x,
            centerY: y,
            rotation: 0,
            flipHorizontal: false,
            orientation: 'horizontal',
            componentType: componentType
        };

        // Add pin coordinates based on component type
        if (componentType.includes('led')) {
            // LED: cathode on left, anode on right
            position.cathodeCoords = { x: x - this.pinSpacing, y: y };
            position.anodeCoords = { x: x + this.pinSpacing, y: y };
            position.cathodeHoleId = 'abstract-cathode';
            position.anodeHoleId = 'abstract-anode';
        } else if (componentType.includes('button')) {
            // Button: leg0 on left, leg1 on right
            position.pin0Coords = { x: x - this.pinSpacing, y: y };
            position.pin1Coords = { x: x + this.pinSpacing, y: y };
            position.pin0HoleId = 'abstract-leg0';
            position.pin1HoleId = 'abstract-leg1';
        } else if (componentType.includes('resistor')) {
            // Resistor: pin0 on left, pin1 on right
            position.pin0Coords = { x: x - this.pinSpacing * 2, y: y };
            position.pin1Coords = { x: x + this.pinSpacing * 2, y: y };
            position.pin0HoleId = 'abstract-pin0';
            position.pin1HoleId = 'abstract-pin1';
        } else if (componentType.includes('photocell')) {
            // Photocell: pin0 on left, pin1 on right
            position.pin0Coords = { x: x - this.pinSpacing, y: y };
            position.pin1Coords = { x: x + this.pinSpacing, y: y };
            position.pin0HoleId = 'abstract-pin0';
            position.pin1HoleId = 'abstract-pin1';
        } else {
            // Generic 2-pin component
            position.pin0Coords = { x: x - this.pinSpacing, y: y };
            position.pin1Coords = { x: x + this.pinSpacing, y: y };
        }

        this.setComponentPosition(componentId, position);
    }

    /**
     * Position components not belonging to any functional group
     * @param {Array} components - All components
     * @param {Array} groups - Functional groups
     */
    positionOrphanComponents(components, groups) {
        // Get IDs of components already positioned via groups
        const positionedIds = new Set();
        positionedIds.add('pico1');

        groups.forEach(group => {
            positionedIds.add(group.primaryComponent);
            if (group.supportComponents) {
                group.supportComponents.forEach(id => positionedIds.add(id));
            }
        });

        // Find orphans
        const orphans = components.filter(c => !positionedIds.has(c.id));

        if (orphans.length === 0) return;

        console.log('[HierarchicalLayout] Positioning', orphans.length, 'orphan components');

        // Position orphans below the main tree
        const orphanStartY = this.picoCenter.y + (groups.length * this.groupSpacing / 2) + 80;

        orphans.forEach((comp, index) => {
            const x = this.picoCenter.x + this.groupRadius;
            const y = orphanStartY + index * 50;
            this.positionComponent(comp.id, x, y, components);
        });
    }

    /**
     * Calculate routes for all wires
     * @param {Array} wires - Wire definitions
     */
    calculateAllWireRoutes(wires) {
        for (const wire of wires) {
            const route = this.calculateWireRoute(wire);
            if (route) {
                this.setWireRoute(wire.id, route);
            }
        }
    }

    /**
     * Calculate route for a single wire
     * @param {Object} wire - Wire definition
     * @returns {Object} WireRoute object
     */
    calculateWireRoute(wire) {
        const fromPos = this.resolveEndpoint(wire.from);
        const toPos = this.resolveEndpoint(wire.to);

        if (!fromPos || !toPos) {
            console.warn(`[HierarchicalLayout] Could not resolve wire endpoints: ${wire.from} → ${wire.to}`);
            return null;
        }

        // Calculate bezier curve control points
        const path = this.calculateBezierPath(fromPos, toPos);

        return {
            from: fromPos,
            to: toPos,
            type: 'bezier',
            path: path,
            wireId: wire.id,
            description: wire.description
        };
    }

    /**
     * Resolve a wire endpoint to coordinates
     * @param {string} endpoint - Endpoint identifier (e.g., "pico1.GP15" or "led1.anode")
     * @returns {{x: number, y: number}|null}
     */
    resolveEndpoint(endpoint) {
        if (!endpoint) return null;

        // Check if it's a Pico pin
        if (this.isPicoEndpoint(endpoint)) {
            return this.resolvePicoPin(endpoint);
        }

        // Check if it's a component pin (e.g., "led1.anode")
        if (endpoint.includes('.')) {
            const [componentId, pinName] = endpoint.split('.');
            return this.resolveComponentPin(componentId, pinName);
        }

        // It might be a breadboard hole reference - try to find component at that location
        // In abstract mode, we resolve based on component positions
        return this.resolveHoleReference(endpoint);
    }

    /**
     * Resolve a Pico pin to coordinates
     * @param {string} endpoint - e.g., "pico1.GP15"
     * @returns {{x: number, y: number}}
     */
    resolvePicoPin(endpoint) {
        const pinName = endpoint.split('.')[1];

        // Position pins along the right edge of the Pico box
        const pinIndex = this.getPicoPinIndex(pinName);
        const totalPins = Math.max(this.connectedPicoPins.size, 1);

        // Distribute connected pins evenly along Pico's right edge
        const pinHeight = this.picoSize.height - 20;
        const spacing = pinHeight / (totalPins + 1);

        const x = this.picoCenter.x + this.picoSize.width / 2;
        const y = this.picoCenter.y - this.picoSize.height / 2 + 10 + spacing * (pinIndex + 1);

        return { x, y, pinName };
    }

    /**
     * Get index of a pin among connected pins (for vertical distribution)
     * @param {string} pinName
     * @returns {number}
     */
    getPicoPinIndex(pinName) {
        const connectedArray = Array.from(this.connectedPicoPins);
        const index = connectedArray.indexOf(pinName);
        return index >= 0 ? index : 0;
    }

    /**
     * Resolve a component pin to coordinates
     * @param {string} componentId
     * @param {string} pinName
     * @returns {{x: number, y: number}|null}
     */
    resolveComponentPin(componentId, pinName) {
        const position = this.getComponentPosition(componentId);
        if (!position) return null;

        // Map pin name to coordinates
        const pinLower = pinName.toLowerCase();

        if (pinLower === 'cathode' && position.cathodeCoords) {
            return position.cathodeCoords;
        }
        if (pinLower === 'anode' && position.anodeCoords) {
            return position.anodeCoords;
        }
        if ((pinLower === 'pin0' || pinLower === 'leg0') && position.pin0Coords) {
            return position.pin0Coords;
        }
        if ((pinLower === 'pin1' || pinLower === 'leg1') && position.pin1Coords) {
            return position.pin1Coords;
        }

        // Default to component center
        return { x: position.centerX, y: position.centerY };
    }

    /**
     * Resolve a breadboard hole reference to the nearest component pin
     * In abstract mode, we map holes to the components that were placed there
     * @param {string} holeId - e.g., "5E", "5C", "10E"
     * @returns {{x: number, y: number}|null}
     */
    resolveHoleReference(holeId) {
        const normalizedHole = holeId.toUpperCase();

        // First, check the hole-to-component mapping built from placements
        const mapping = this.holeToComponent.get(normalizedHole);
        if (mapping) {
            return this.resolveComponentPin(mapping.componentId, mapping.pinName);
        }

        // For holes on same bus as a component pin, find the connected component
        // This handles cases like wire to "5C" when button is on "5E" (same bus)
        // We need to find which component has a pin on the same bus
        for (const [compHoleId, compMapping] of this.holeToComponent) {
            // Check if holes are on same bus (same column, different row for main grid)
            if (this.holesOnSameBus(normalizedHole, compHoleId)) {
                console.log(`[HierarchicalLayout] Hole ${normalizedHole} on same bus as ${compHoleId} (${compMapping.componentId}.${compMapping.pinName})`);
                return this.resolveComponentPin(compMapping.componentId, compMapping.pinName);
            }
        }

        console.warn(`[HierarchicalLayout] Could not resolve hole reference: ${holeId}`);
        return null;
    }

    /**
     * Check if two hole IDs are on the same breadboard bus
     * @param {string} hole1 - e.g., "5C"
     * @param {string} hole2 - e.g., "5E"
     * @returns {boolean}
     */
    holesOnSameBus(hole1, hole2) {
        // Parse hole IDs: column number + row letter (e.g., "5C" = column 5, row C)
        const match1 = hole1.match(/^(\d+)([A-J])$/i);
        const match2 = hole2.match(/^(\d+)([A-J])$/i);

        if (!match1 || !match2) return false;

        const col1 = parseInt(match1[1]);
        const row1 = match1[2].toUpperCase();
        const col2 = parseInt(match2[1]);
        const row2 = match2[2].toUpperCase();

        // Same column = same vertical bus
        if (col1 !== col2) return false;

        // Check if both on same side of the gap
        // Top: F, G, H, I, J | Bottom: A, B, C, D, E
        const topRows = ['F', 'G', 'H', 'I', 'J'];
        const bottomRows = ['A', 'B', 'C', 'D', 'E'];

        const both1Top = topRows.includes(row1) && topRows.includes(row2);
        const bothBottom = bottomRows.includes(row1) && bottomRows.includes(row2);

        return both1Top || bothBottom;
    }

    /**
     * Calculate bezier curve path between two points
     * @param {{x: number, y: number}} from
     * @param {{x: number, y: number}} to
     * @returns {Object} Path with control points
     */
    calculateBezierPath(from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;

        // Control points create a smooth S-curve
        // Horizontal bias for left-to-right tree layout
        const cp1X = from.x + dx * this.wireCurvature;
        const cp1Y = from.y;
        const cp2X = to.x - dx * this.wireCurvature;
        const cp2Y = to.y;

        return {
            startX: from.x,
            startY: from.y,
            cp1X,
            cp1Y,
            cp2X,
            cp2Y,
            endX: to.x,
            endY: to.y
        };
    }

    /**
     * Generate SVG path data string for a bezier wire
     * @param {Object} route - Wire route object
     * @returns {string} SVG path d attribute
     */
    static getPathData(route) {
        const p = route.path;
        return `M ${p.startX} ${p.startY} C ${p.cp1X} ${p.cp1Y}, ${p.cp2X} ${p.cp2Y}, ${p.endX} ${p.endY}`;
    }
}

// Register with layout registry
if (window.layoutRegistry) {
    window.layoutRegistry.register('hierarchical', HierarchicalLayoutEngine);
}

// Export for browser
window.HierarchicalLayoutEngine = HierarchicalLayoutEngine;

console.log('[HierarchicalLayout] Layout engine loaded');
