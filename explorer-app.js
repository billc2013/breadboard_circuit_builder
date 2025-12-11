/**
 * Explorer App - Unified Circuit Explorer
 *
 * Single unified view combining:
 * - Physical breadboard with faded background
 * - Physical Pico with real pins
 * - Bezier curve wires for visual clarity
 * - Always-visible wire labels near Pico pins
 * - Component click → highlight all connected wires + Pico pins
 * - Wire click → highlight individual wire
 */
class ExplorerApp {
    constructor() {
        this.svg = document.getElementById('breadboard-svg');
        this.holesLayer = document.getElementById('holes-layer');
        this.wiresLayer = document.getElementById('wires-layer');
        this.labelsLayer = document.getElementById('labels-layer');
        this.wireLabelsLayer = document.getElementById('wire-labels-layer');
        this.picoPinsLayer = document.getElementById('pico-pins-layer');
        this.componentsLayer = document.getElementById('components-layer');
        this.infoPanel = document.getElementById('hover-info');

        // Merge breadboard holes and Pico pins into unified connection points
        this.connectablePoints = [
            ...BREADBOARD_HOLES,
            ...PICO_PINS
        ];

        // Build lookup map for fast access
        this.pointsById = new Map();
        this.connectablePoints.forEach(pt => {
            this.pointsById.set(pt.id, pt);
        });

        // Keep separate references
        this.holes = BREADBOARD_HOLES;
        this.picoPins = PICO_PINS;

        // Component metadata (loaded async)
        this.picoMetadata = null;

        // Circuit state
        this.circuitData = null;
        this.circuitLoader = null;

        // Interaction state
        this.highlightedWire = null;
        this.highlightedComponent = null;  // Currently selected component

        // Wire categorization
        this.wireCategories = {
            picoToComponent: [],
            componentToComponent: [],
            powerGround: []
        };

        // Functional groups (populated when circuit loads)
        this.functionalGroups = [];

        // Wires array (needed for CircuitLoader compatibility)
        this.wires = [];

        // Wire-to-component mapping (which wires connect to which components)
        this.wireToComponents = new Map();  // wireId -> [componentIds]
        this.componentToWires = new Map();  // componentId -> [wireIds]

        // Tooltip state
        this.tooltipElement = null;

        // Bundled wire mode state
        this.bundledWireMode = true;  // Enable by default
        this.groupBoundariesLayer = null;
        this.activeGroup = null;  // Currently selected functional group
        this.groupBoundaries = new Map();  // groupId -> { rect, label, bounds }

        // Component positions cache - stores canvas coordinates after rendering
        // Key: componentId, Value: { centerX, centerY, width, height }
        this.componentPositions = new Map();

        // Abstract layout system for slot-based visualization
        this.abstractLayout = null;
        this.useAbstractLayout = true;  // Enable by default in explorer mode

        // Event handler references (for cleanup)
        this.boundHandleWireClick = this.handleWireClick.bind(this);
        this.boundHandleComponentClick = this.handleComponentClick.bind(this);
        this.boundHandleKeydown = this.handleKeydown.bind(this);
        this.boundHandleGroupClick = this.handleGroupClick.bind(this);

        this.init();
    }

    async init() {
        await this.loadComponentMetadata();
        this.circuitLoader = new CircuitLoader(this);
        await this.circuitLoader.init();

        // Get the group boundaries layer
        this.groupBoundariesLayer = document.getElementById('group-boundaries-layer');

        // Initialize abstract layout system
        if (typeof AbstractLayoutSystem !== 'undefined') {
            this.abstractLayout = new AbstractLayoutSystem({
                canvasWidth: 400,
                canvasHeight: 200,
                picoAreaWidth: 85  // Space for Pico on the left
            });
            console.log('[Explorer] Abstract layout system initialized');
        } else {
            console.warn('[Explorer] AbstractLayoutSystem not loaded - using physical layout');
            this.useAbstractLayout = false;
        }

        // In explorer mode, we don't render breadboard holes (visual clutter)
        // The holes layer remains empty - breadboard is just a faded background
        // this.renderHoles();  // REMOVED for explorer mode

        this.renderPicoPins();
        this.attachEventListeners();
        this.setupKeyboardListeners();

        // Enable bundled wire mode styling
        if (this.bundledWireMode) {
            document.body.classList.add('bundled-wire-mode');
        }

        console.log('[Explorer] Unified explorer initialized with bundled wire mode:', this.bundledWireMode);
    }

    async loadComponentMetadata() {
        try {
            const response = await fetch('components/microcontrollers/pico.json');
            if (!response.ok) {
                throw new Error('Failed to load pico.json');
            }
            const data = await response.json();
            this.picoMetadata = data.component;
            console.log('Pico metadata loaded:', Object.keys(this.picoMetadata.pins).length, 'pins');
        } catch (error) {
            console.error('Error loading Pico metadata:', error);
            this.picoMetadata = null;
        }
    }

    // ==================== Rendering ====================

    renderHoles() {
        this.holes.forEach(hole => {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.classList.add('hole');
            group.setAttribute('data-hole-id', hole.id);

            if (hole.type === 'power') {
                group.classList.add('power-rail');
            } else if (hole.type === 'ground') {
                group.classList.add('ground-rail');
            }

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', hole.x);
            circle.setAttribute('cy', hole.y);
            circle.setAttribute('r', BREADBOARD_CONFIG.grid.hole_radius);
            group.appendChild(circle);

            group._holeData = hole;
            this.holesLayer.appendChild(group);
        });
    }

    renderPicoPins() {
        if (!this.picoPinsLayer) {
            console.error('Pico pins layer not found');
            return;
        }

        this.picoPins.forEach(pinPos => {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.classList.add('pin');
            group.setAttribute('data-pin-id', pinPos.id);

            const pinMeta = this.picoMetadata?.pins[pinPos.pinKey];

            if (pinMeta) {
                group.classList.add(`pin-${pinMeta.electricalType}`);
            }

            const square = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            square.setAttribute('x', pinPos.x - 1.5);
            square.setAttribute('y', pinPos.y - 1.5);
            square.setAttribute('width', 3);
            square.setAttribute('height', 3);
            square.setAttribute('rx', 0.3);
            group.appendChild(square);

            group._pinData = {
                ...pinPos,
                metadata: pinMeta
            };

            this.picoPinsLayer.appendChild(group);
        });

        console.log('Rendered', this.picoPins.length, 'Pico pins');
    }

    // ==================== Wire Management (CircuitLoader compatibility) ====================

    /**
     * Create a wire between two points (called by CircuitLoader)
     */
    createWire(startPoint, endPoint, options = {}) {
        const wire = {
            id: options.id || `wire-${this.wires.length + 1}`,
            from: startPoint.id,
            to: endPoint.id,
            fromCoords: { x: startPoint.x, y: startPoint.y },
            toCoords: { x: endPoint.x, y: endPoint.y },
            waypoints: options.waypoints || [],
            routingMode: options.routingMode || 'straight',
            description: options.description || null
        };

        this.wires.push(wire);

        // In bundled wire mode, don't render wires here - they're rendered later via renderBundledWires()
        if (!this.bundledWireMode) {
            this.renderWire(wire);
        }

        this.updateWireCount();

        console.log('[Explorer] Wire created:', wire.id);
    }

    /**
     * Render a single wire to the SVG
     */
    renderWire(wire) {
        if (wire.waypoints && wire.waypoints.length > 0) {
            const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            polyline.classList.add('wire');
            polyline.setAttribute('data-wire-id', wire.id);

            let points = `${wire.fromCoords.x},${wire.fromCoords.y}`;
            wire.waypoints.forEach(waypoint => {
                points += ` ${waypoint.x},${waypoint.y}`;
            });
            points += ` ${wire.toCoords.x},${wire.toCoords.y}`;
            polyline.setAttribute('points', points);

            this.wiresLayer.appendChild(polyline);
        } else {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.classList.add('wire');
            line.setAttribute('x1', wire.fromCoords.x);
            line.setAttribute('y1', wire.fromCoords.y);
            line.setAttribute('x2', wire.toCoords.x);
            line.setAttribute('y2', wire.toCoords.y);
            line.setAttribute('data-wire-id', wire.id);
            this.wiresLayer.appendChild(line);
        }
    }

    /**
     * Clear all wires (called by CircuitLoader before loading new circuit)
     */
    clearAllWires() {
        this.wires = [];
        this.wiresLayer.innerHTML = '';
        this.clearWireLabels();
        this.clearHighlights();
        this.updateWireCount();
        console.log('[Explorer] All wires cleared');
    }

    /**
     * Register a component's canvas position after it's rendered
     * Called by CircuitLoader after rendering each component
     * @param {string} componentId - The component ID
     * @param {Object} position - Position object from adapter.calculatePosition()
     */
    registerComponentPosition(componentId, position) {
        if (!position) {
            console.warn(`[Explorer] Cannot register position for ${componentId}: no position data`);
            return;
        }

        // Extract center coordinates - different components return different formats
        let centerX, centerY;

        if (position.centerX !== undefined && position.centerY !== undefined) {
            // LED, Button, etc. format
            centerX = position.centerX;
            centerY = position.centerY;
        } else if (position.center) {
            // Some formats use nested center object
            centerX = position.center.x;
            centerY = position.center.y;
        } else if (position.x !== undefined && position.y !== undefined) {
            // Simple x/y format (Pico, etc.)
            centerX = position.x;
            centerY = position.y;
        } else {
            console.warn(`[Explorer] Unknown position format for ${componentId}:`, position);
            return;
        }

        // Estimate component size (we can refine this later with actual bounds)
        const width = position.width || 30;
        const height = position.height || 30;

        this.componentPositions.set(componentId, {
            centerX,
            centerY,
            width,
            height,
            rawPosition: position  // Keep original for debugging
        });

        console.log(`[Explorer] Registered position for ${componentId}: (${centerX.toFixed(1)}, ${centerY.toFixed(1)})`);
    }

    /**
     * Clear all component positions (called when loading new circuit)
     */
    clearComponentPositions() {
        this.componentPositions.clear();
        console.log('[Explorer] Component positions cleared');
    }

    // ==================== Circuit Loading ====================

    /**
     * Load and display a circuit (called by CircuitsManager)
     * @param {Object} circuitJson - The circuit data
     */
    loadCircuit(circuitJson) {
        console.log('[Explorer] Loading circuit:', circuitJson?.circuit?.metadata?.name);

        this.circuitData = circuitJson;

        // Clear previous state
        this.clearHighlights();
        this.hideTooltip();
        this.activeGroup = null;
        this.clearGroupBoundaries();
        // Note: componentPositions is populated by CircuitLoader during renderComponent()
        // Don't clear here - it's already populated by the time loadCircuit is called

        // Categorize wires and build component mappings
        if (circuitJson?.circuit?.wires && circuitJson?.circuit?.components) {
            this.categorizeWires(circuitJson.circuit.wires, circuitJson.circuit.components);
            this.buildWireComponentMappings(circuitJson.circuit.wires, circuitJson.circuit.components);
            this.detectFunctionalGroups(circuitJson.circuit.components, circuitJson.circuit.wires);
        }

        // Apply visual styles
        this.applyBreadboardFade();

        if (this.bundledWireMode) {
            // Bundled wire mode: render group boundaries and bundled wires
            if (this.useAbstractLayout && this.abstractLayout) {
                // Abstract layout mode: use slot-based positioning
                this.abstractLayout.calculateSlots(this.functionalGroups);
                this.renderAbstractComponents();  // Re-render components at slot positions
                this.renderGroupBoundariesAbstract();
                this.renderBundledWiresAbstract();
            } else {
                // Physical layout mode: use actual breadboard positions
                this.calculateGroupPositions();
                this.renderGroupBoundaries();
                this.renderBundledWires();
            }
            this.enableGroupInteraction();
        } else {
            // Legacy mode: original wire rendering
            this.applyWireCategories();
            this.renderWireLabels();
            this.enableWireInteraction();
            this.enableComponentInteraction();
        }

        console.log('[Explorer] Circuit loaded with', circuitJson?.circuit?.wires?.length, 'wires');
    }

    /**
     * Build mappings between wires and components
     * Used for component-click highlighting
     */
    buildWireComponentMappings(wires, components) {
        this.wireToComponents.clear();
        this.componentToWires.clear();

        // Build hole-to-component lookup
        const holeToComponent = new Map();
        for (const comp of components) {
            if (comp.placement) {
                for (const [pinName, holeId] of Object.entries(comp.placement)) {
                    if (holeId) {
                        holeToComponent.set(holeId.toUpperCase(), comp.id);
                        // Also add same-bus holes
                        this.addBusHoles(holeId, comp.id, holeToComponent);
                    }
                }
            }
        }

        // Map wires to their connected components
        for (const wire of wires) {
            const connectedComponents = new Set();

            // Check 'from' endpoint
            const fromCompId = this.findComponentForEndpoint(wire.from, holeToComponent);
            if (fromCompId) connectedComponents.add(fromCompId);

            // Check 'to' endpoint
            const toCompId = this.findComponentForEndpoint(wire.to, holeToComponent);
            if (toCompId) connectedComponents.add(toCompId);

            // Store wire -> components mapping
            this.wireToComponents.set(wire.id, Array.from(connectedComponents));

            // Store component -> wires mapping
            for (const compId of connectedComponents) {
                if (!this.componentToWires.has(compId)) {
                    this.componentToWires.set(compId, []);
                }
                this.componentToWires.get(compId).push(wire.id);
            }
        }

        console.log('[Explorer] Built wire-component mappings:',
                    this.componentToWires.size, 'components with wires');
    }

    /**
     * Add holes on the same bus to the lookup
     */
    addBusHoles(holeId, componentId, holeToComponent) {
        const match = holeId.match(/^(\d+)([A-J])$/i);
        if (!match) return;

        const col = match[1];
        const row = match[2].toUpperCase();

        // Determine which rows are on the same bus
        const topRows = ['F', 'G', 'H', 'I', 'J'];
        const bottomRows = ['A', 'B', 'C', 'D', 'E'];

        const sameBusRows = topRows.includes(row) ? topRows : bottomRows;

        // Add all holes on the same bus
        for (const r of sameBusRows) {
            const busHoleId = `${col}${r}`;
            if (!holeToComponent.has(busHoleId)) {
                holeToComponent.set(busHoleId, componentId);
            }
        }
    }

    /**
     * Parse BusXX-Y format to extract a standard hole ID
     * Examples: "Bus1J-F" -> "1J", "Bus6J-F" -> "6J", "Bus2A-E" -> "2A"
     * @param {string} endpoint - Wire endpoint (may be Bus format or standard)
     * @returns {string|null} Standard hole ID or null if not Bus format
     */
    parseBusFormat(endpoint) {
        if (!endpoint) return null;

        // Match Bus{column}{rowRange} format: Bus1J-F, Bus10A-E, etc.
        const busMatch = endpoint.match(/^Bus(\d+)([A-J])-([A-J])$/i);
        if (!busMatch) return null;

        const column = busMatch[1];
        const startRow = busMatch[2].toUpperCase();
        // Return the first row of the range as the canonical hole
        const result = `${column}${startRow}`;
        // Debug logging removed - Bus format parsing working correctly
        return result;
    }

    /**
     * Normalize a wire endpoint to a standard hole ID
     * Handles both standard format (5C) and Bus format (Bus5A-E)
     * @param {string} endpoint - Wire endpoint
     * @returns {string|null} Normalized hole ID or null
     */
    normalizeEndpoint(endpoint) {
        if (!endpoint) return null;

        // Try Bus format first
        const busHole = this.parseBusFormat(endpoint);
        if (busHole) return busHole;

        // Standard hole format (already normalized)
        if (/^\d+[A-J]$/i.test(endpoint)) {
            return endpoint.toUpperCase();
        }

        return null;
    }

    /**
     * Find which component is connected to a wire endpoint
     */
    findComponentForEndpoint(endpoint, holeToComponent) {
        if (!endpoint) return null;

        // Pico pin - return 'pico1' as a pseudo-component
        if (this.isPicoPin(endpoint)) {
            return 'pico1';
        }

        // Normalize endpoint (handles Bus format and standard format)
        const normalizedHole = this.normalizeEndpoint(endpoint);
        if (normalizedHole && holeToComponent.has(normalizedHole)) {
            return holeToComponent.get(normalizedHole);
        }

        // Direct lookup as fallback
        const normalized = endpoint.toUpperCase();
        if (holeToComponent.has(normalized)) {
            return holeToComponent.get(normalized);
        }

        return null;
    }

    // ==================== Wire Categorization ====================

    categorizeWires(wires, components) {
        this.wireCategories = {
            picoToComponent: [],
            componentToComponent: [],
            powerGround: []
        };

        const componentIds = new Set(components.map(c => c.id));

        for (const wire of wires) {
            const category = this.getWireCategory(wire, componentIds);
            this.wireCategories[category].push(wire.id);
        }

        console.log('[Explorer] Wire categories:', {
            picoToComponent: this.wireCategories.picoToComponent.length,
            componentToComponent: this.wireCategories.componentToComponent.length,
            powerGround: this.wireCategories.powerGround.length
        });
    }

    getWireCategory(wire, componentIds) {
        const fromIsPico = this.isPicoPin(wire.from);
        const toIsPico = this.isPicoPin(wire.to);
        const fromIsPowerGround = this.isPowerOrGround(wire.from);
        const toIsPowerGround = this.isPowerOrGround(wire.to);

        if (fromIsPowerGround || toIsPowerGround) {
            return 'powerGround';
        }

        if (fromIsPico || toIsPico) {
            return 'picoToComponent';
        }

        return 'componentToComponent';
    }

    isPicoPin(pointId) {
        if (!pointId) return false;
        const normalized = pointId.toLowerCase();
        return normalized.startsWith('pico') && normalized.includes('.');
    }

    isPowerOrGround(pointId) {
        if (!pointId) return false;
        const normalized = pointId.toUpperCase();

        if (normalized.includes('GND') ||
            normalized.includes('3V3') ||
            normalized.includes('VBUS') ||
            normalized.includes('VSYS')) {
            return true;
        }

        if (/^[WXYZ]\d+$/i.test(pointId)) {
            return true;
        }

        return false;
    }

    // ==================== Functional Groups ====================

    /**
     * Detect functional groups from component metadata
     * Groups include primary components (LED, button) and their support components (resistors)
     * based on the 'requires' field in component JSON functionalGroup metadata
     * @param {Array} components - Circuit components
     * @param {Array} wires - Circuit wires
     */
    detectFunctionalGroups(components, wires) {
        this.functionalGroups = [];
        this.componentToGroup = new Map();  // Maps any component ID to its group

        // Build bus connectivity map for finding support components
        const holeToBus = new Map();
        for (const hole of this.holes) {
            if (hole.bus) {
                holeToBus.set(hole.id.toUpperCase(), hole.bus);
            }
        }

        // Build component placement lookup - which holes each component occupies (including bus-connected)
        const componentHoles = new Map();  // componentId -> Set of hole IDs
        for (const comp of components) {
            const holes = new Set();
            if (comp.placement) {
                for (const [pinName, holeId] of Object.entries(comp.placement)) {
                    if (holeId && typeof holeId === 'string') {
                        const normalizedHole = holeId.toUpperCase();
                        holes.add(normalizedHole);
                        // Add all holes on same bus
                        const bus = holeToBus.get(normalizedHole);
                        if (bus) {
                            for (const [h, b] of holeToBus) {
                                if (b === bus) holes.add(h);
                            }
                        }
                    }
                }
            }
            componentHoles.set(comp.id, holes);
        }

        // For each component with functionalGroup metadata, build the group
        for (const component of components) {
            const metadata = this.circuitLoader?.renderedComponents?.get(component.id)?.metadata;

            if (metadata?.functionalGroup) {
                const group = {
                    id: `${component.id}-group`,
                    label: metadata.functionalGroup.groupLabel || component.id,
                    primaryComponent: component.id,
                    primaryMetadata: metadata,
                    allComponents: [component.id],  // All components in this group
                    supportComponents: [],
                    wires: [],
                    wireLabels: metadata.functionalGroup.wireLabels || {}
                };

                // Find support components based on 'requires' in metadata
                const requires = metadata.functionalGroup.requires || [];
                for (const req of requires) {
                    // Find resistors (or other support components) that share a bus with primary
                    const primaryHoles = componentHoles.get(component.id);

                    for (const otherComp of components) {
                        if (otherComp.id === component.id) continue;

                        // Check if this component matches the required type
                        const otherType = otherComp.type?.toLowerCase() || '';
                        if (req.type === 'resistor' && otherType.includes('resistor')) {
                            // Check if it shares a bus with the primary component
                            const otherHoles = componentHoles.get(otherComp.id);
                            const sharesConnection = [...primaryHoles].some(h => otherHoles.has(h));

                            if (sharesConnection) {
                                group.supportComponents.push(otherComp.id);
                                group.allComponents.push(otherComp.id);
                                console.log(`[Explorer] Found support component ${otherComp.id} for ${component.id}`);
                            }
                        }
                    }
                }

                // Find all wires connected to ANY component in this group
                for (const compId of group.allComponents) {
                    const compData = components.find(c => c.id === compId);
                    if (!compData?.placement) continue;

                    const compHoles = componentHoles.get(compId);

                    for (const wire of wires) {
                        // Check if wire connects to this component's holes/buses
                        const fromNorm = wire.from?.toUpperCase();
                        const toNorm = wire.to?.toUpperCase();

                        const fromConnects = compHoles.has(fromNorm) || this.wireEndpointOnBus(wire.from, compHoles, holeToBus);
                        const toConnects = compHoles.has(toNorm) || this.wireEndpointOnBus(wire.to, compHoles, holeToBus);

                        if ((fromConnects || toConnects) && !group.wires.includes(wire.id)) {
                            group.wires.push(wire.id);
                        }
                    }
                }

                if (group.wires.length > 0) {
                    this.functionalGroups.push(group);

                    // Map all components in group back to the group
                    for (const compId of group.allComponents) {
                        this.componentToGroup.set(compId, group);
                    }

                }
            }
        }

        console.log('[Explorer] Total functional groups:', this.functionalGroups.length);
    }

    /**
     * Check if a wire endpoint is on a bus that connects to component holes
     */
    wireEndpointOnBus(endpoint, compHoles, holeToBus) {
        if (!endpoint || this.isPicoPin(endpoint)) return false;

        // Normalize endpoint (handles Bus format)
        const normalizedHole = this.normalizeEndpoint(endpoint);
        const holeToCheck = normalizedHole || endpoint.toUpperCase();

        const bus = holeToBus.get(holeToCheck);
        if (!bus) return false;

        // Check if any compHole shares this bus
        for (const h of compHoles) {
            if (holeToBus.get(h) === bus) return true;
        }
        return false;
    }

    /**
     * Find which functional group a component belongs to
     * @param {string} componentId - Component identifier
     * @returns {Object|null} Functional group or null
     */
    findGroupForComponent(componentId) {
        return this.componentToGroup.get(componentId) || null;
    }

    /**
     * Find which functional group a wire belongs to
     * @param {string} wireId - Wire identifier
     * @returns {Object|null} Functional group or null
     */
    findGroupForWire(wireId) {
        return this.functionalGroups.find(g => g.wires.includes(wireId)) || null;
    }

    // ==================== Visual Rendering ====================

    applyBreadboardFade() {
        const overlay = document.getElementById('breadboard-fade-overlay');
        if (overlay) {
            overlay.style.display = 'block';
        }
    }

    removeBreadboardFade() {
        const overlay = document.getElementById('breadboard-fade-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    applyWireCategories() {
        const categoryClassMap = {
            picoToComponent: 'category-pico-component',
            componentToComponent: 'category-component-component',
            powerGround: 'category-power-ground'
        };

        for (const [category, wireIds] of Object.entries(this.wireCategories)) {
            const cssClass = categoryClassMap[category];
            for (const wireId of wireIds) {
                const wireElement = document.querySelector(`[data-wire-id="${wireId}"]`);
                if (wireElement) {
                    wireElement.classList.add(cssClass);
                }
            }
        }
    }

    updateWireVisibility() {
        const categoryKeyMap = {
            picoToComponent: 'pico-component',
            componentToComponent: 'component-component',
            powerGround: 'power-ground'
        };

        for (const [category, wireIds] of Object.entries(this.wireCategories)) {
            const isVisible = this.wireFilterState[category];
            for (const wireId of wireIds) {
                const wireElement = document.querySelector(`[data-wire-id="${wireId}"]`);
                if (wireElement) {
                    wireElement.classList.toggle('hidden', !isVisible);
                }
            }
        }
    }

    // ==================== Wire Labels (Always visible near Pico) ====================

    renderWireLabels() {
        this.clearWireLabels();

        if (!this.wireLabelsLayer || !this.circuitData) return;

        const wires = this.circuitData.circuit.wires || [];

        // Render labels for all wires that connect to Pico
        for (const wire of wires) {
            // Only label wires that have a Pico endpoint
            const picoEndpoint = this.isPicoPin(wire.from) ? wire.from :
                                this.isPicoPin(wire.to) ? wire.to : null;

            if (!picoEndpoint) continue;

            const wireElement = document.querySelector(`[data-wire-id="${wire.id}"]`);
            if (!wireElement) continue;

            // Determine label text
            const labelText = this.determineLabelForWire(wire, {});
            if (!labelText) continue;

            // Position label near the Pico pin (not at wire endpoint)
            const position = this.getLabelPositionNearPico(wire, picoEndpoint);
            if (!position) continue;

            // Create label group
            const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            labelGroup.classList.add('wire-label-group');
            labelGroup.setAttribute('data-wire-id', wire.id);

            // Create background
            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bg.classList.add('wire-label-bg');

            // Create text
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.classList.add('wire-label');
            text.setAttribute('x', position.x);
            text.setAttribute('y', position.y);
            text.textContent = labelText;

            // Add signal/ground/power class for coloring
            if (labelText.toLowerCase().includes('signal')) {
                text.classList.add('signal');
            } else if (labelText.toLowerCase().includes('ground')) {
                text.classList.add('ground');
            } else if (labelText.toLowerCase().includes('power') || labelText.toLowerCase().includes('3v')) {
                text.classList.add('power');
            }

            labelGroup.appendChild(bg);
            labelGroup.appendChild(text);
            this.wireLabelsLayer.appendChild(labelGroup);

            // Size background to fit text
            requestAnimationFrame(() => {
                const bbox = text.getBBox();
                bg.setAttribute('x', bbox.x - 3);
                bg.setAttribute('y', bbox.y - 2);
                bg.setAttribute('width', bbox.width + 6);
                bg.setAttribute('height', bbox.height + 4);
            });
        }
    }

    /**
     * Get position for label near the Pico pin
     */
    getLabelPositionNearPico(wire, picoEndpoint) {
        const pinName = picoEndpoint.split('.')[1];

        // Find the Pico pin coordinates
        const picoPin = this.picoPins.find(p => p.pinKey === pinName);
        if (!picoPin) return null;

        // Position label slightly offset from Pico pin
        // Labels go to the left of the Pico (since Pico is on the left side)
        return {
            x: picoPin.x - 8,  // Offset to left of pin
            y: picoPin.y + 2   // Slightly below center for readability
        };
    }

    /**
     * Determine label text for a wire based on its connections
     */
    determineLabelForWire(wire, wireLabels) {
        // Check if wire connects to Pico GPIO
        const picoEndpoint = this.isPicoPin(wire.from) ? wire.from :
                            this.isPicoPin(wire.to) ? wire.to : null;

        if (picoEndpoint) {
            const pinName = picoEndpoint.split('.')[1];
            const pinMeta = this.picoMetadata?.pins?.[pinName];

            if (pinMeta?.electricalType === 'gpio') {
                return `Signal ${pinMeta.name}`;
            }
            if (pinMeta?.electricalType === 'ground') {
                return 'Ground';
            }
            if (pinMeta?.electricalType === 'power') {
                return `Power ${pinMeta.name}`;
            }
        }

        // Check power/ground rails
        if (this.isPowerOrGround(wire.from) || this.isPowerOrGround(wire.to)) {
            const endpoint = this.isPowerOrGround(wire.from) ? wire.from : wire.to;
            if (endpoint.toUpperCase().includes('GND') || /^[YZ]\d+$/i.test(endpoint)) {
                return 'Ground';
            }
            if (endpoint.toUpperCase().includes('3V3') || /^[WX]\d+$/i.test(endpoint)) {
                return 'Power 3.3V';
            }
        }

        return null;
    }

    getWireEndpointPosition(wireElement) {
        let x, y;

        if (wireElement.tagName === 'line') {
            // Use the endpoint farther from Pico (usually x2, y2)
            x = parseFloat(wireElement.getAttribute('x2'));
            y = parseFloat(wireElement.getAttribute('y2')) - 4;
        } else if (wireElement.tagName === 'polyline') {
            const points = wireElement.getAttribute('points').split(' ');
            const lastPoint = points[points.length - 1].split(',');
            x = parseFloat(lastPoint[0]);
            y = parseFloat(lastPoint[1]) - 4;
        }

        return x !== undefined ? { x, y } : null;
    }

    clearWireLabels() {
        if (this.wireLabelsLayer) {
            this.wireLabelsLayer.innerHTML = '';
        }
    }

    // ==================== Wire Interaction ====================

    enableWireInteraction() {
        if (this.wiresLayer) {
            this.wiresLayer.addEventListener('click', this.boundHandleWireClick);
        }
    }

    disableWireInteraction() {
        if (this.wiresLayer) {
            this.wiresLayer.removeEventListener('click', this.boundHandleWireClick);
        }
    }

    handleWireClick(event) {
        const wireElement = event.target.closest('.wire');
        if (!wireElement) return;

        const wireId = wireElement.getAttribute('data-wire-id');
        if (!wireId) return;

        console.log('[Explorer] Wire clicked:', wireId);

        // Clear any component highlight first
        if (this.highlightedComponent) {
            this.unhighlightComponent(this.highlightedComponent);
            this.highlightedComponent = null;
        }

        this.handleSingleWireClick(wireId);
    }

    handleSingleWireClick(wireId) {
        // Unhighlight previous wire
        if (this.highlightedWire && this.highlightedWire !== wireId) {
            this.unhighlightWire(this.highlightedWire);
        }

        // Toggle highlight
        if (this.highlightedWire === wireId) {
            this.unhighlightWire(wireId);
            this.highlightedWire = null;
            this.hideTooltip();
        } else {
            this.highlightWire(wireId);
            this.highlightedWire = wireId;
        }
    }

    // ==================== Component Interaction ====================

    enableComponentInteraction() {
        if (this.componentsLayer) {
            this.componentsLayer.addEventListener('click', this.boundHandleComponentClick);
        }
    }

    disableComponentInteraction() {
        if (this.componentsLayer) {
            this.componentsLayer.removeEventListener('click', this.boundHandleComponentClick);
        }
    }

    handleComponentClick(event) {
        const componentElement = event.target.closest('.component');
        if (!componentElement) return;

        const componentId = componentElement.getAttribute('data-component-id');
        if (!componentId) return;

        console.log('[Explorer] Component clicked:', componentId);

        // In bundled wire mode, redirect to group selection
        if (this.bundledWireMode) {
            const group = this.findGroupForComponent(componentId);
            if (group) {
                this.toggleGroupHighlight(group.id);
                return;
            }
        }

        // Clear any wire-only highlight first
        if (this.highlightedWire) {
            this.unhighlightWire(this.highlightedWire);
            this.highlightedWire = null;
            this.hideTooltip();
        }

        // Toggle component highlight
        if (this.highlightedComponent === componentId) {
            this.unhighlightComponent(componentId);
            this.highlightedComponent = null;
        } else {
            // Unhighlight previous component
            if (this.highlightedComponent) {
                this.unhighlightComponent(this.highlightedComponent);
            }
            this.highlightComponent(componentId);
            this.highlightedComponent = componentId;
        }
    }

    /**
     * Highlight a component and its entire functional group
     * (all components in group, all wires, all Pico pins)
     */
    highlightComponent(componentId) {
        console.log('[Explorer] Highlighting component:', componentId);

        // Check if this component belongs to a functional group
        const group = this.findGroupForComponent(componentId);

        if (group) {
            // Highlight the entire functional group
            console.log(`[Explorer] Highlighting functional group "${group.label}":`, group.allComponents);

            // Highlight all components in the group
            for (const compId of group.allComponents) {
                const compElement = document.querySelector(`[data-component-id="${compId}"]`);
                if (compElement) {
                    compElement.classList.add('component-highlighted');
                }
            }

            // Highlight all wires in the group
            for (const wireId of group.wires) {
                this.highlightWire(wireId);
                this.highlightWireLabel(wireId);
            }

            // Highlight connected Pico pins
            this.highlightConnectedPicoPins(group.wires);

            // Update info panel with group info
            if (this.infoPanel) {
                const componentNames = group.allComponents.map(id => this.getComponentDisplayName(id)).join(' + ');
                this.infoPanel.textContent = `${group.label}: ${componentNames} | ${group.wires.length} wires`;
            }
        } else {
            // No functional group - just highlight this component's wires
            const wireIds = this.componentToWires.get(componentId) || [];

            // Highlight all connected wires
            for (const wireId of wireIds) {
                this.highlightWire(wireId);
                this.highlightWireLabel(wireId);
            }

            // Highlight the component itself
            const componentElement = document.querySelector(`[data-component-id="${componentId}"]`);
            if (componentElement) {
                componentElement.classList.add('component-highlighted');
            }

            // Highlight connected Pico pins
            this.highlightConnectedPicoPins(wireIds);

            // Update info panel
            if (this.infoPanel) {
                const compName = this.getComponentDisplayName(componentId);
                this.infoPanel.textContent = `${compName}: ${wireIds.length} connected wires`;
            }
        }
    }

    /**
     * Remove highlight from a component and its entire functional group
     */
    unhighlightComponent(componentId) {
        console.log('[Explorer] Unhighlighting component:', componentId);

        // Check if this component belongs to a functional group
        const group = this.findGroupForComponent(componentId);

        if (group) {
            // Unhighlight the entire functional group
            for (const compId of group.allComponents) {
                const compElement = document.querySelector(`[data-component-id="${compId}"]`);
                if (compElement) {
                    compElement.classList.remove('component-highlighted');
                }
            }

            // Unhighlight all wires in the group
            for (const wireId of group.wires) {
                this.unhighlightWire(wireId);
                this.unhighlightWireLabel(wireId);
            }
        } else {
            // No functional group - just unhighlight this component's wires
            const wireIds = this.componentToWires.get(componentId) || [];

            for (const wireId of wireIds) {
                this.unhighlightWire(wireId);
                this.unhighlightWireLabel(wireId);
            }

            const componentElement = document.querySelector(`[data-component-id="${componentId}"]`);
            if (componentElement) {
                componentElement.classList.remove('component-highlighted');
            }
        }

        // Unhighlight all Pico pins
        this.unhighlightAllPicoPins();

        // Reset info panel
        if (this.infoPanel) {
            this.infoPanel.textContent = 'Click on components or wires to explore connections';
        }
    }

    /**
     * Highlight wire label (make it bright)
     */
    highlightWireLabel(wireId) {
        const labelGroup = document.querySelector(`.wire-label-group[data-wire-id="${wireId}"]`);
        if (labelGroup) {
            labelGroup.classList.add('label-highlighted');
        }
    }

    /**
     * Unhighlight wire label (make it faded)
     */
    unhighlightWireLabel(wireId) {
        const labelGroup = document.querySelector(`.wire-label-group[data-wire-id="${wireId}"]`);
        if (labelGroup) {
            labelGroup.classList.remove('label-highlighted');
        }
    }

    /**
     * Highlight Pico pins connected to given wires
     */
    highlightConnectedPicoPins(wireIds) {
        const wires = this.circuitData?.circuit?.wires || [];

        for (const wireId of wireIds) {
            const wire = wires.find(w => w.id === wireId);
            if (!wire) continue;

            // Check both endpoints for Pico pins
            for (const endpoint of [wire.from, wire.to]) {
                if (this.isPicoPin(endpoint)) {
                    const pinName = endpoint.split('.')[1];
                    this.highlightPicoPin(pinName);
                }
            }
        }
    }

    /**
     * Highlight a specific Pico pin
     */
    highlightPicoPin(pinName) {
        // Find the pin element in pico-pins-layer
        const pinElement = document.querySelector(`[data-pin-id="pico1.${pinName}"]`);
        if (pinElement) {
            pinElement.classList.add('pin-highlighted');
        }
    }

    /**
     * Unhighlight all Pico pins
     */
    unhighlightAllPicoPins() {
        const highlightedPins = document.querySelectorAll('.pin-highlighted');
        highlightedPins.forEach(pin => pin.classList.remove('pin-highlighted'));
    }

    /**
     * Get a display-friendly name for a component
     */
    getComponentDisplayName(componentId) {
        const metadata = this.circuitLoader?.renderedComponents?.get(componentId)?.metadata;
        if (metadata?.metadata?.name) {
            return metadata.metadata.name;
        }
        // Fallback to formatted ID
        return componentId.replace(/(\d+)/, ' $1').replace(/^./, s => s.toUpperCase());
    }

    highlightWire(wireId) {
        const wireElement = document.querySelector(`[data-wire-id="${wireId}"]`);
        if (wireElement) {
            wireElement.classList.add('highlighted');
        }
    }

    unhighlightWire(wireId) {
        const wireElement = document.querySelector(`[data-wire-id="${wireId}"]`);
        if (wireElement) {
            wireElement.classList.remove('highlighted');
        }
    }

    highlightGroup(groupId) {
        const group = this.functionalGroups.find(g => g.id === groupId);
        if (!group) return;

        for (const wireId of group.wires) {
            const wireElement = document.querySelector(`[data-wire-id="${wireId}"]`);
            if (wireElement) {
                wireElement.classList.add('group-highlighted');
            }
        }
    }

    unhighlightGroup(groupId) {
        const group = this.functionalGroups.find(g => g.id === groupId);
        if (!group) return;

        for (const wireId of group.wires) {
            const wireElement = document.querySelector(`[data-wire-id="${wireId}"]`);
            if (wireElement) {
                wireElement.classList.remove('group-highlighted');
            }
        }
    }

    clearHighlights() {
        document.querySelectorAll('.wire.highlighted').forEach(el => {
            el.classList.remove('highlighted');
        });
        document.querySelectorAll('.wire.group-highlighted').forEach(el => {
            el.classList.remove('group-highlighted');
        });
        this.highlightedWire = null;
        this.highlightedGroup = null;
    }

    // ==================== Group Info Panel ====================

    showGroupInfo(group) {
        const panel = document.querySelector('.group-info-panel');
        if (!panel) return;

        const title = panel.querySelector('.group-info-title');
        const components = panel.querySelector('.group-info-components');

        if (title) {
            title.textContent = group.primaryMetadata?.functionalGroup?.groupLabel ||
                               group.primaryMetadata?.name ||
                               'Functional Group';
        }

        if (components) {
            components.textContent = `Primary: ${group.primaryComponent} | ${group.wires.length} wires`;
        }

        panel.classList.add('visible');
    }

    hideGroupInfo() {
        const panel = document.querySelector('.group-info-panel');
        if (panel) {
            panel.classList.remove('visible');
        }
    }

    // ==================== Educational Tooltip ====================

    showTooltip(wireId) {
        if (!wireId || !this.circuitData) return;

        const wire = this.circuitData.circuit.wires.find(w => w.id === wireId);
        if (!wire) return;

        const guideContent = this.getConnectionGuideContent(wire);

        this.tooltipElement = document.getElementById('explorer-tooltip');
        if (!this.tooltipElement) return;

        const titleEl = this.tooltipElement.querySelector('.tooltip-title');
        const purposeEl = this.tooltipElement.querySelector('.tooltip-purpose');
        const warningsEl = this.tooltipElement.querySelector('.tooltip-warnings');
        const troubleshootingEl = this.tooltipElement.querySelector('.tooltip-troubleshooting');

        if (titleEl) titleEl.textContent = guideContent.title || 'Connection Info';
        if (purposeEl) purposeEl.textContent = guideContent.purpose || '';
        if (warningsEl) {
            warningsEl.innerHTML = guideContent.warnings?.length
                ? '<strong>Warnings:</strong><ul>' +
                  guideContent.warnings.map(w => `<li>${w}</li>`).join('') + '</ul>'
                : '';
        }
        if (troubleshootingEl) {
            troubleshootingEl.innerHTML = guideContent.troubleshooting?.length
                ? '<strong>Troubleshooting:</strong><ul>' +
                  guideContent.troubleshooting.map(t => `<li>${t}</li>`).join('') + '</ul>'
                : '';
        }

        this.positionTooltipNearWire(wireId);
        this.tooltipElement.classList.add('visible');
    }

    hideTooltip() {
        if (this.tooltipElement) {
            this.tooltipElement.classList.remove('visible');
        }
        // Also try by ID
        const tooltip = document.getElementById('explorer-tooltip');
        if (tooltip) {
            tooltip.classList.remove('visible');
        }
    }

    getConnectionGuideContent(wire) {
        const content = {
            title: `Wire: ${wire.from} → ${wire.to}`,
            purpose: wire.description || 'Connection between circuit elements',
            warnings: [],
            troubleshooting: []
        };

        // Try to get component-specific guide
        const componentGuide = this.findComponentConnectionGuide(wire);
        if (componentGuide) {
            content.purpose = componentGuide.purpose || content.purpose;
            content.warnings = componentGuide.warnings || [];
            content.troubleshooting = componentGuide.troubleshooting || [];
        }

        return content;
    }

    findComponentConnectionGuide(wire) {
        if (!this.circuitLoader?.renderedComponents) return null;

        for (const endpoint of [wire.from, wire.to]) {
            if (endpoint?.includes('.')) {
                const [componentId, pinName] = endpoint.split('.');
                const componentData = this.circuitLoader.renderedComponents.get(componentId);

                if (componentData?.metadata?.pins?.[pinName]?.connectionGuide) {
                    return componentData.metadata.pins[pinName].connectionGuide;
                }
            }
        }

        return null;
    }

    positionTooltipNearWire(wireId) {
        const wireElement = document.querySelector(`[data-wire-id="${wireId}"]`);
        if (!wireElement || !this.tooltipElement) return;

        const position = this.getWireEndpointPosition(wireElement);
        if (!position) return;

        const svg = this.svg;
        const svgRect = svg.getBoundingClientRect();
        const viewBox = svg.viewBox.baseVal;

        const scaleX = svgRect.width / viewBox.width;
        const scaleY = svgRect.height / viewBox.height;

        const screenX = svgRect.left + (position.x * scaleX) + 20;
        const screenY = svgRect.top + (position.y * scaleY) - 60;

        this.tooltipElement.style.left = `${screenX}px`;
        this.tooltipElement.style.top = `${screenY}px`;
    }

    // ==================== Filter UI ====================

    setupFilterListeners() {
        const checkboxes = document.querySelectorAll('.wire-filter-checkbox input[type="checkbox"]');

        checkboxes.forEach(checkbox => {
            const label = checkbox.closest('.wire-filter-checkbox');
            const category = label?.getAttribute('data-category');

            if (category) {
                const categoryKey = this.filterCategoryToKey(category);
                checkbox.checked = this.wireFilterState[categoryKey];

                checkbox.addEventListener('change', (e) => {
                    this.wireFilterState[categoryKey] = e.target.checked;
                    this.updateWireVisibility();
                    console.log('[Explorer] Filter changed:', categoryKey, e.target.checked);
                });
            }
        });

        // Show filters initially (All Wires view)
        const filters = document.getElementById('wire-filters');
        if (filters) {
            filters.classList.add('visible');
        }
    }

    filterCategoryToKey(category) {
        const map = {
            'pico-component': 'picoToComponent',
            'component-component': 'componentToComponent',
            'power-ground': 'powerGround'
        };
        return map[category] || category;
    }

    // ==================== Keyboard Handling ====================

    setupKeyboardListeners() {
        document.addEventListener('keydown', this.boundHandleKeydown);
    }

    handleKeydown(event) {
        // Spacebar - toggle tooltip for highlighted wire
        if (event.code === 'Space' && this.highlightedWire) {
            event.preventDefault();
            const tooltip = document.getElementById('explorer-tooltip');
            if (tooltip?.classList.contains('visible')) {
                this.hideTooltip();
            } else {
                this.showTooltip(this.highlightedWire);
            }
        }
    }

    // ==================== UI Updates ====================

    updateWireCount() {
        if (this.wireCountDisplay && this.circuitData?.circuit?.wires) {
            this.wireCountDisplay.textContent = `Wires: ${this.circuitData.circuit.wires.length}`;
        }
    }

    updateSelectedInfo(wireId) {
        if (!this.selectedInfo) return;

        if (wireId && this.circuitData) {
            const wire = this.circuitData.circuit.wires.find(w => w.id === wireId);
            if (wire) {
                this.selectedInfo.textContent = `Selected: ${wire.from} → ${wire.to}`;
                return;
            }
        }

        this.selectedInfo.textContent = '';
    }

    // ==================== Event Listeners ====================

    attachEventListeners() {
        // Hover info for holes
        this.holesLayer.addEventListener('mouseenter', (e) => {
            if (e.target.closest('.hole')) {
                const hole = e.target.closest('.hole')._holeData;
                this.infoPanel.textContent = `Hole: ${hole.id} | Bus: ${hole.bus}`;
            }
        }, true);

        // Hover info for pins
        this.picoPinsLayer.addEventListener('mouseenter', (e) => {
            if (e.target.closest('.pin')) {
                const pin = e.target.closest('.pin')._pinData;
                const meta = pin.metadata;
                if (meta) {
                    this.infoPanel.textContent = `Pin: ${meta.name} | ${meta.description}`;
                }
            }
        }, true);
    }

    // ==================== Component Info Box ====================

    showComponentInfo(componentId, metadata, placement, position) {
        const infoBox = document.getElementById('component-info-box');
        const infoTitle = document.getElementById('info-box-title');
        const infoDetails = document.getElementById('info-box-details');

        infoTitle.textContent = componentId.toUpperCase();

        let detailsHTML = '';

        if (metadata?.name) {
            detailsHTML += `<div class="info-section">
                <span class="info-label">Type:</span>
                <span class="info-value">${metadata.name}</span>
            </div>`;
        }

        if (metadata?.description) {
            detailsHTML += `<div class="info-section">
                <span class="info-label">Description:</span>
                <span class="info-value">${metadata.description}</span>
            </div>`;
        }

        infoDetails.innerHTML = detailsHTML;

        if (position) {
            const svgRect = this.svg.getBoundingClientRect();
            const viewBox = this.svg.viewBox.baseVal;
            const scaleX = svgRect.width / viewBox.width;
            const scaleY = svgRect.height / viewBox.height;

            const screenX = svgRect.left + (position.centerX * scaleX) + 30;
            const screenY = svgRect.top + (position.centerY * scaleY) - 20;

            infoBox.style.left = `${screenX}px`;
            infoBox.style.top = `${screenY}px`;
        }

        infoBox.style.display = 'block';
    }

    hideComponentInfo() {
        const infoBox = document.getElementById('component-info-box');
        infoBox.style.display = 'none';
    }

    // ==================== Bundled Wire Mode ====================

    /**
     * Calculate positions for functional group boundaries
     * Sensors at top, outputs at bottom, dynamically spaced
     */
    calculateGroupPositions() {
        if (!this.functionalGroups.length) {
            console.log('[Explorer] calculateGroupPositions: No functional groups found');
            return;
        }

        console.log('[Explorer] calculateGroupPositions: Processing', this.functionalGroups.length, 'groups');
        console.log('[Explorer] Groups:', this.functionalGroups.map(g => ({
            id: g.id,
            label: g.label,
            category: g.primaryMetadata?.functionalGroup?.category,
            allComponents: g.allComponents,
            wires: g.wires
        })));

        // Separate groups by category
        const sensors = this.functionalGroups.filter(g =>
            g.primaryMetadata?.functionalGroup?.category === 'sensor'
        );
        const outputs = this.functionalGroups.filter(g =>
            g.primaryMetadata?.functionalGroup?.category === 'output'
        );
        const others = this.functionalGroups.filter(g => {
            const cat = g.primaryMetadata?.functionalGroup?.category;
            return cat !== 'sensor' && cat !== 'output';
        });

        console.log('[Explorer] Category breakdown - Sensors:', sensors.length, 'Outputs:', outputs.length, 'Others:', others.length);

        // Layout configuration
        const config = {
            boundaryWidth: 70,
            boundaryHeight: 50,
            boundaryPadding: 10,
            startX: 280,  // Right side of breadboard area
            topY: 40,     // Top area for sensors
            bottomY: 150, // Bottom area for outputs
            middleY: 95,  // Middle for others
            spacing: 15
        };

        // Position sensors at top
        this.positionGroupRow(sensors, config.startX, config.topY, config);

        // Position outputs at bottom
        this.positionGroupRow(outputs, config.startX, config.bottomY, config);

        // Position others in middle
        this.positionGroupRow(others, config.startX, config.middleY, config);

        console.log('[Explorer] Final group positions:');
        for (const group of this.functionalGroups) {
            console.log(`  ${group.label}:`, group.bounds);
        }
    }

    /**
     * Position a row of groups horizontally
     */
    positionGroupRow(groups, startX, y, config) {
        let currentX = startX;

        console.log('[Explorer] positionGroupRow called with startX:', startX, 'y:', y, 'groups:', groups.length);

        for (const group of groups) {
            // Calculate bounds based on component positions
            const componentBounds = this.getGroupComponentBounds(group);

            console.log(`[Explorer] Group "${group.label}" componentBounds:`, componentBounds);

            // Use actual component bounds or default size
            const width = componentBounds ?
                Math.max(componentBounds.width + config.boundaryPadding * 2, config.boundaryWidth) :
                config.boundaryWidth;
            const height = componentBounds ?
                Math.max(componentBounds.height + config.boundaryPadding * 2, config.boundaryHeight) :
                config.boundaryHeight;

            // Use component center if available, otherwise calculated position
            const centerX = componentBounds ? componentBounds.centerX : currentX + width / 2;
            const centerY = componentBounds ? componentBounds.centerY : y + height / 2;

            console.log(`[Explorer] Group "${group.label}" calculated: centerX=${centerX}, centerY=${centerY}, width=${width}, height=${height}`);
            console.log(`[Explorer] Group "${group.label}" using componentBounds:`, !!componentBounds);

            group.bounds = {
                x: centerX - width / 2,
                y: centerY - height / 2,
                width,
                height,
                centerX,
                centerY,
                // Wire entry point (left edge, vertically centered)
                wireEntryX: centerX - width / 2,
                wireEntryY: centerY
            };

            currentX += width + config.spacing;
        }
    }

    /**
     * Get the bounding box of all components in a group
     * Uses cached positions from registerComponentPosition() - these are the
     * canvas coordinates calculated by component adapters, avoiding transform issues
     */
    getGroupComponentBounds(group) {
        console.log(`[Explorer] getGroupComponentBounds for "${group.label}", looking for components:`, group.allComponents);
        console.log(`[Explorer]   Cached positions available:`, Array.from(this.componentPositions.keys()));

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let foundCount = 0;

        for (const compId of group.allComponents) {
            const pos = this.componentPositions.get(compId);

            if (pos) {
                foundCount++;
                // Use cached center coordinates directly (these are in canvas space)
                const halfWidth = (pos.width || 30) / 2;
                const halfHeight = (pos.height || 30) / 2;

                minX = Math.min(minX, pos.centerX - halfWidth);
                minY = Math.min(minY, pos.centerY - halfHeight);
                maxX = Math.max(maxX, pos.centerX + halfWidth);
                maxY = Math.max(maxY, pos.centerY + halfHeight);

                console.log(`[Explorer]   Component "${compId}" cached position: center=(${pos.centerX.toFixed(1)}, ${pos.centerY.toFixed(1)})`);
            } else {
                console.warn(`[Explorer]   Component "${compId}" not found in position cache`);
            }
        }

        console.log(`[Explorer]   Found ${foundCount}/${group.allComponents.length} component positions in cache`);

        if (minX === Infinity) {
            console.warn(`[Explorer]   No valid positions found for group "${group.label}"`);
            return null;
        }

        const result = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
        console.log(`[Explorer]   Final bounds for "${group.label}":`, result);
        return result;
    }

    /**
     * Render rounded rectangle boundaries for each functional group
     */
    renderGroupBoundaries() {
        if (!this.groupBoundariesLayer) return;

        this.clearGroupBoundaries();

        for (const group of this.functionalGroups) {
            if (!group.bounds) continue;

            const { x, y, width, height, centerX } = group.bounds;

            // Create boundary group
            const boundaryGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            boundaryGroup.classList.add('group-boundary-container');
            boundaryGroup.setAttribute('data-group-id', group.id);

            // Create rounded rectangle
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.classList.add('group-boundary');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', width);
            rect.setAttribute('height', height);
            rect.setAttribute('data-group-id', group.id);

            // Create label (positioned above boundary)
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.classList.add('group-boundary-label');
            label.setAttribute('x', centerX);
            label.setAttribute('y', y - 4);
            label.textContent = group.label;

            boundaryGroup.appendChild(rect);
            boundaryGroup.appendChild(label);
            this.groupBoundariesLayer.appendChild(boundaryGroup);

            // Store reference
            this.groupBoundaries.set(group.id, {
                rect,
                label,
                bounds: group.bounds,
                group
            });
        }

        console.log('[Explorer] Rendered', this.groupBoundaries.size, 'group boundaries');
    }

    /**
     * Clear all group boundaries
     */
    clearGroupBoundaries() {
        if (this.groupBoundariesLayer) {
            this.groupBoundariesLayer.innerHTML = '';
        }
        this.groupBoundaries.clear();
    }

    /**
     * Render bundled wires from Pico pins to group boundaries
     */
    renderBundledWires() {
        if (!this.circuitData?.circuit?.wires) return;

        // Clear existing wires
        this.wiresLayer.innerHTML = '';

        const wires = this.circuitData.circuit.wires;

        for (const group of this.functionalGroups) {
            if (!group.bounds) continue;

            // Get wire order from component metadata
            const wireOrder = group.primaryMetadata?.functionalGroup?.wireOrder || [];

            // Find wires for this group and classify them by role
            const groupWires = this.classifyGroupWires(group, wires, wireOrder);

            // Render each wire as a bundled bezier curve
            this.renderGroupWireBundle(group, groupWires, wireOrder);
        }
    }

    /**
     * Classify wires in a group by their role (power, signal, ground)
     */
    classifyGroupWires(group, allWires, wireOrder) {
        const classifiedWires = [];

        for (const wireId of group.wires) {
            const wire = allWires.find(w => w.id === wireId);
            if (!wire) continue;

            // Determine wire role based on Pico pin type
            const picoEndpoint = this.isPicoPin(wire.from) ? wire.from :
                                this.isPicoPin(wire.to) ? wire.to : null;

            let role = 'signal';
            let color = '#ffcc00';  // Default signal color

            if (picoEndpoint) {
                const pinName = picoEndpoint.split('.')[1];
                const pinMeta = this.picoMetadata?.pins?.[pinName];

                if (pinMeta?.electricalType === 'ground') {
                    role = 'ground';
                    color = '#333333';
                } else if (pinMeta?.electricalType === 'power') {
                    role = 'power';
                    color = '#ff4444';
                } else if (pinMeta?.electricalType === 'gpio') {
                    // Check if it's ADC (analog)
                    if (pinMeta.capabilities?.includes('ADC')) {
                        role = 'signal';
                        color = '#33cc33';  // Green for analog
                    } else if (pinMeta.capabilities?.includes('PWM')) {
                        role = 'signal';
                        color = '#ff9900';  // Orange for PWM
                    }
                }
            }

            // Override with wireOrder color if defined
            const orderEntry = wireOrder.find(wo => wo.role === role);
            if (orderEntry?.color) {
                color = orderEntry.color;
            }

            classifiedWires.push({
                wire,
                role,
                color,
                picoEndpoint
            });
        }

        // Sort by wire order (power first, then signals, then ground)
        const roleOrder = wireOrder.map(wo => wo.role);
        if (roleOrder.length === 0) {
            // Default order if not specified
            roleOrder.push('power', 'signal', 'ground');
        }

        classifiedWires.sort((a, b) => {
            const aIndex = roleOrder.indexOf(a.role);
            const bIndex = roleOrder.indexOf(b.role);
            return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        });

        return classifiedWires;
    }

    /**
     * Render a bundle of wires for a functional group
     */
    renderGroupWireBundle(group, classifiedWires, wireOrder) {
        if (!group.bounds || classifiedWires.length === 0) {
            console.log(`[Explorer] renderGroupWireBundle: Skipping "${group.label}" - bounds:`, group.bounds, 'wires:', classifiedWires.length);
            return;
        }

        const { wireEntryX, wireEntryY, height } = group.bounds;
        console.log(`[Explorer] renderGroupWireBundle for "${group.label}": wireEntryX=${wireEntryX}, wireEntryY=${wireEntryY}`);

        // Calculate vertical spacing for wires at the boundary
        const wireCount = classifiedWires.length;
        const verticalSpacing = Math.min(8, (height - 10) / (wireCount + 1));
        const startY = wireEntryY - ((wireCount - 1) * verticalSpacing) / 2;

        // Bundle point (where wires come together before entering group)
        const bundleX = wireEntryX - 25;
        console.log(`[Explorer]   bundleX=${bundleX}, wireCount=${wireCount}, verticalSpacing=${verticalSpacing}`);

        classifiedWires.forEach((classified, index) => {
            const { wire, color, role } = classified;

            // Get Pico pin coordinates
            const picoEndpoint = this.isPicoPin(wire.from) ? wire.from : wire.to;
            let startX, startY_wire;

            if (picoEndpoint) {
                const pinName = picoEndpoint.split('.')[1];
                const picoPin = this.picoPins.find(p => p.pinKey === pinName);
                if (picoPin) {
                    startX = picoPin.x;
                    startY_wire = picoPin.y;
                    console.log(`[Explorer]   Wire "${wire.id}" (${role}): Pico pin ${pinName} at (${startX}, ${startY_wire})`);
                } else {
                    // Fallback to stored coords
                    startX = wire.fromCoords?.x || 50;
                    startY_wire = wire.fromCoords?.y || 100;
                    console.log(`[Explorer]   Wire "${wire.id}" (${role}): Pico pin ${pinName} NOT FOUND, using fallback (${startX}, ${startY_wire})`);
                }
            } else {
                startX = wire.fromCoords?.x || 50;
                startY_wire = wire.fromCoords?.y || 100;
                console.log(`[Explorer]   Wire "${wire.id}" (${role}): No Pico endpoint, using coords (${startX}, ${startY_wire})`);
            }

            // End point at group boundary
            const endX = wireEntryX;
            const endY = startY + index * verticalSpacing;

            console.log(`[Explorer]   Wire "${wire.id}": START (${startX}, ${startY_wire}) -> END (${endX}, ${endY})`);

            // Bundle point Y (align with destination)
            const bundleY = endY;

            // Create bezier path: Pico pin -> bundle point -> group boundary
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.classList.add('bundled-wire');
            path.classList.add(`wire-${role}`);
            path.setAttribute('data-wire-id', wire.id);
            path.setAttribute('data-group-id', group.id);
            path.style.stroke = color;

            // Calculate control points for smooth curve
            // First segment: Pico to bundle point
            const cp1x = startX + (bundleX - startX) * 0.5;
            const cp1y = startY_wire;
            const cp2x = bundleX - 20;
            const cp2y = bundleY;

            // Path: Move to start, curve to bundle, line to boundary
            const d = `M ${startX} ${startY_wire}
                       C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${bundleX} ${bundleY}
                       L ${endX} ${endY}`;

            path.setAttribute('d', d);

            this.wiresLayer.appendChild(path);

            // Store wire-to-group mapping for interactions
            if (!this.wireToGroup) this.wireToGroup = new Map();
            this.wireToGroup.set(wire.id, group.id);
        });
    }

    /**
     * Enable click interaction on group boundaries
     */
    enableGroupInteraction() {
        if (this.groupBoundariesLayer) {
            this.groupBoundariesLayer.addEventListener('click', this.boundHandleGroupClick);
        }

        // Also enable component clicks to trigger group selection
        if (this.componentsLayer) {
            this.componentsLayer.addEventListener('click', this.boundHandleComponentClick);
        }
    }

    /**
     * Handle click on a group boundary
     */
    handleGroupClick(event) {
        const boundaryElement = event.target.closest('.group-boundary');
        if (!boundaryElement) return;

        const groupId = boundaryElement.getAttribute('data-group-id');
        if (!groupId) return;

        console.log('[Explorer] Group boundary clicked:', groupId);

        this.toggleGroupHighlight(groupId);
    }

    /**
     * Toggle highlight for a functional group
     */
    toggleGroupHighlight(groupId) {
        // If clicking the same group, deselect it
        if (this.activeGroup === groupId) {
            this.deactivateGroup(groupId);
            this.activeGroup = null;
            this.resetAllWireFade();
        } else {
            // Deactivate previous group if any
            if (this.activeGroup) {
                this.deactivateGroup(this.activeGroup);
            }

            // Activate new group
            this.activateGroup(groupId);
            this.activeGroup = groupId;
            this.fadeNonActiveWires(groupId);
        }

        // Update info panel
        this.updateGroupInfoPanel();
    }

    /**
     * Activate (highlight) a group
     */
    activateGroup(groupId) {
        const boundary = this.groupBoundaries.get(groupId);
        if (!boundary) return;

        // Activate boundary
        boundary.rect.classList.add('group-active');
        boundary.label.classList.add('label-active');

        // Activate wires for this group
        const group = boundary.group;
        for (const wireId of group.wires) {
            const wireEl = document.querySelector(`[data-wire-id="${wireId}"]`);
            if (wireEl) {
                wireEl.classList.add('wire-active');
                wireEl.classList.remove('wire-faded');
            }
        }

        // Highlight components in the group
        for (const compId of group.allComponents) {
            const compEl = document.querySelector(`[data-component-id="${compId}"]`);
            if (compEl) {
                compEl.classList.add('component-highlighted');
            }
        }

        // Highlight connected Pico pins
        this.highlightConnectedPicoPins(group.wires);
    }

    /**
     * Deactivate (unhighlight) a group
     */
    deactivateGroup(groupId) {
        const boundary = this.groupBoundaries.get(groupId);
        if (!boundary) return;

        // Deactivate boundary
        boundary.rect.classList.remove('group-active');
        boundary.label.classList.remove('label-active');

        // Deactivate wires for this group
        const group = boundary.group;
        for (const wireId of group.wires) {
            const wireEl = document.querySelector(`[data-wire-id="${wireId}"]`);
            if (wireEl) {
                wireEl.classList.remove('wire-active');
            }
        }

        // Unhighlight components
        for (const compId of group.allComponents) {
            const compEl = document.querySelector(`[data-component-id="${compId}"]`);
            if (compEl) {
                compEl.classList.remove('component-highlighted');
            }
        }

        // Unhighlight Pico pins
        this.unhighlightAllPicoPins();
    }

    /**
     * Fade wires that don't belong to the active group
     */
    fadeNonActiveWires(activeGroupId) {
        const activeGroup = this.groupBoundaries.get(activeGroupId)?.group;
        if (!activeGroup) return;

        // Get all wire elements
        const allWires = document.querySelectorAll('.bundled-wire');

        for (const wireEl of allWires) {
            const wireId = wireEl.getAttribute('data-wire-id');
            if (!activeGroup.wires.includes(wireId)) {
                wireEl.classList.add('wire-faded');
            }
        }
    }

    /**
     * Reset all wire fading
     */
    resetAllWireFade() {
        const allWires = document.querySelectorAll('.bundled-wire');
        for (const wireEl of allWires) {
            wireEl.classList.remove('wire-faded');
            wireEl.classList.remove('wire-active');
        }
    }

    /**
     * Update info panel with active group information
     */
    updateGroupInfoPanel() {
        if (!this.infoPanel) return;

        if (this.activeGroup) {
            const boundary = this.groupBoundaries.get(this.activeGroup);
            if (boundary?.group) {
                const group = boundary.group;
                const componentNames = group.allComponents.map(id =>
                    this.getComponentDisplayName(id)
                ).join(' + ');
                this.infoPanel.textContent = `${group.label}: ${componentNames}`;
            }
        } else {
            this.infoPanel.textContent = 'Click on a component or group to explore connections';
        }
    }

    /**
     * Override component click to handle group selection in bundled mode
     */
    handleComponentClickBundled(event) {
        const componentElement = event.target.closest('.component');
        if (!componentElement) return;

        const componentId = componentElement.getAttribute('data-component-id');
        if (!componentId) return;

        // Find the group this component belongs to
        const group = this.findGroupForComponent(componentId);
        if (group) {
            this.toggleGroupHighlight(group.id);
        }
    }

    // ==================== Abstract Layout Methods ====================

    /**
     * Re-render components at their abstract slot positions
     * Components are moved from physical breadboard locations to slot positions
     */
    renderAbstractComponents() {
        if (!this.abstractLayout || !this.circuitData?.circuit?.components) {
            console.log('[Explorer] renderAbstractComponents: No layout or components');
            return;
        }

        console.log('[Explorer] Rendering components at abstract positions');

        // Clear existing components layer
        const componentsLayer = document.getElementById('components-layer');
        if (!componentsLayer) return;

        // Keep track of which components we need to re-render
        const componentsToRender = [];

        for (const group of this.functionalGroups) {
            const slot = this.abstractLayout.getSlotForGroup(group.id);
            console.log('[Explorer] renderAbstractComponents: group', group.id, 'slot:', slot ? 'found' : 'NULL');
            if (!slot) continue;

            for (const compId of group.allComponents) {
                const compData = this.circuitLoader?.renderedComponents?.get(compId);
                if (!compData) continue;

                // Get physical position from cache
                const physicalPos = this.componentPositions.get(compId);

                // Calculate abstract position in slot
                const abstractPos = this.abstractLayout.getAbstractPosition(
                    compId,
                    group.id,
                    physicalPos
                );

                componentsToRender.push({
                    id: compId,
                    data: compData,
                    physicalPos,
                    abstractPos,
                    group
                });
            }
        }

        // First, remove ALL stub elements (LED stubs, resistor stubs, etc.)
        // These don't have data-component-id, just class names
        componentsLayer.querySelectorAll('.led-stub, .cathode-stub, .anode-stub, .resistor-stub, .component-stub').forEach(el => el.remove());

        // Remove existing component elements and re-render at new positions
        for (const comp of componentsToRender) {
            // Find and remove existing element
            const existingEl = componentsLayer.querySelector(`[data-component-id="${comp.id}"]`);
            if (existingEl) {
                existingEl.remove();
            }

            // Render at abstract position (no stubs in abstract mode)
            this.renderComponentAtPosition(comp.id, comp.data, comp.abstractPos);

            // Update the position cache with abstract position
            this.componentPositions.set(comp.id, {
                centerX: comp.abstractPos.centerX,
                centerY: comp.abstractPos.centerY,
                width: comp.abstractPos.width || 30,
                height: comp.abstractPos.height || 30,
                isAbstract: true
            });
        }

        console.log('[Explorer] Rendered', componentsToRender.length, 'components at abstract positions');
    }

    /**
     * Render a single component at a specific position
     * @param {string} componentId - Component ID
     * @param {Object} compData - Component data from renderedComponents
     * @param {Object} position - Position { centerX, centerY, width, height }
     */
    renderComponentAtPosition(componentId, compData, position) {
        const componentsLayer = document.getElementById('components-layer');
        if (!componentsLayer) return;

        const metadata = compData.metadata;
        const rendering = metadata?.rendering?.breadboard;

        if (!rendering?.svg) {
            console.warn(`[Explorer] No SVG for component ${componentId}`);
            return;
        }

        // Create component group
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.classList.add('component', 'abstract-component');
        group.setAttribute('data-component-id', componentId);
        group.setAttribute('data-component-type', compData.type);

        // Create image element for component SVG
        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('href', rendering.svg);

        // Scale component to fit in slot (smaller than physical)
        const scale = 0.7;  // 70% of original size for abstract view
        const displayWidth = (rendering.width || 30) * scale;
        const displayHeight = (rendering.height || 30) * scale;

        img.setAttribute('width', displayWidth);
        img.setAttribute('height', displayHeight);
        img.setAttribute('x', position.centerX - displayWidth / 2);
        img.setAttribute('y', position.centerY - displayHeight / 2);
        img.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        group.appendChild(img);

        // Add component label below
        // Use the component name from the library metadata (single source of truth)
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.classList.add('component-label', 'abstract-label');
        label.setAttribute('x', position.centerX);
        label.setAttribute('y', position.centerY + displayHeight / 2 + 8);
        label.setAttribute('text-anchor', 'middle');

        // Get display name from metadata hierarchy
        const displayName = metadata?.metadata?.name  // e.g., "Red LED - 5mm", "220Ω Resistor"
                         || metadata?.name
                         || componentId;
        label.textContent = displayName;

        group.appendChild(label);
        componentsLayer.appendChild(group);
    }

    /**
     * Render group boundaries using abstract slot positions
     */
    renderGroupBoundariesAbstract() {
        if (!this.groupBoundariesLayer || !this.abstractLayout) {
            console.log('[Explorer] renderGroupBoundariesAbstract: Missing layer or layout');
            return;
        }

        this.clearGroupBoundaries();
        console.log('[Explorer] renderGroupBoundariesAbstract: Rendering for', this.functionalGroups.length, 'groups');

        for (const group of this.functionalGroups) {
            const bounds = this.abstractLayout.getGroupBounds(group);
            console.log('[Explorer] Group bounds for', group.label, ':', bounds);
            if (!bounds) continue;

            const { x, y, width, height, centerX } = bounds;

            // Create boundary group
            const boundaryGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            boundaryGroup.classList.add('group-boundary-container', 'abstract-boundary');
            boundaryGroup.setAttribute('data-group-id', group.id);

            // Create rounded rectangle with inline styles to ensure visibility
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.classList.add('group-boundary');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', width);
            rect.setAttribute('height', height);
            rect.setAttribute('rx', '8');
            rect.setAttribute('ry', '8');
            rect.setAttribute('data-group-id', group.id);
            // Force visibility with inline styles
            rect.style.opacity = '0.6';
            rect.style.fill = 'rgba(50, 50, 60, 0.7)';
            rect.style.stroke = '#00ccff';
            rect.style.strokeWidth = '1';

            // Create label (positioned above boundary) with inline styles
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.classList.add('group-boundary-label');
            label.setAttribute('x', centerX);
            label.setAttribute('y', y - 4);
            label.setAttribute('text-anchor', 'middle');
            label.style.fill = '#00ccff';
            label.style.fontSize = '8px';
            label.style.fontWeight = 'bold';
            label.style.opacity = '1';
            label.textContent = group.label;

            boundaryGroup.appendChild(rect);
            boundaryGroup.appendChild(label);
            this.groupBoundariesLayer.appendChild(boundaryGroup);
            console.log('[Explorer] Created boundary for', group.label, 'at', x, y, width, height);

            // Store reference with abstract bounds
            this.groupBoundaries.set(group.id, {
                rect,
                label,
                bounds: bounds,
                group
            });
        }

        console.log('[Explorer] Rendered', this.groupBoundaries.size, 'abstract group boundaries');
    }

    /**
     * Render bundled wires using abstract slot positions
     * Wires route from Pico pins to slot entry points
     */
    renderBundledWiresAbstract() {
        if (!this.circuitData?.circuit?.wires || !this.abstractLayout) {
            console.log('[Explorer] renderBundledWiresAbstract: Missing data or layout');
            return;
        }

        // Clear existing wires
        this.wiresLayer.innerHTML = '';
        console.log('[Explorer] renderBundledWiresAbstract: Processing', this.functionalGroups.length, 'groups');

        const wires = this.circuitData.circuit.wires;

        for (const group of this.functionalGroups) {
            const bounds = this.abstractLayout.getGroupBounds(group);
            console.log('[Explorer] Wire bounds for', group.label, ':', bounds ? 'found' : 'NULL');
            if (!bounds) continue;

            // Get wire order from component metadata
            const wireOrder = group.primaryMetadata?.functionalGroup?.wireOrder || [];

            // Find wires for this group and classify them by role
            const groupWires = this.classifyGroupWires(group, wires, wireOrder);

            // Render each wire as a bundled bezier curve to abstract position
            this.renderGroupWireBundleAbstract(group, groupWires, bounds, wireOrder);
        }

        console.log('[Explorer] Rendered bundled wires to abstract positions');
    }

    /**
     * Render a bundle of wires for a functional group using abstract positions
     */
    renderGroupWireBundleAbstract(group, classifiedWires, bounds, wireOrder) {
        if (!bounds || classifiedWires.length === 0) {
            return;
        }

        const { wireEntryX, wireEntryY, height } = bounds;

        // Calculate vertical spacing for wires at the boundary
        const wireCount = classifiedWires.length;
        const verticalSpacing = Math.min(8, (height - 10) / (wireCount + 1));
        const startY = wireEntryY - ((wireCount - 1) * verticalSpacing) / 2;

        // Bundle point (where wires come together before entering group)
        const bundleX = wireEntryX - 20;

        classifiedWires.forEach((classified, index) => {
            const { wire, color, role } = classified;

            // Get Pico pin coordinates
            const picoEndpoint = this.isPicoPin(wire.from) ? wire.from : wire.to;
            let startX, startY_wire;

            if (picoEndpoint) {
                const pinName = picoEndpoint.split('.')[1];
                const picoPin = this.picoPins.find(p => p.pinKey === pinName);
                if (picoPin) {
                    startX = picoPin.x;
                    startY_wire = picoPin.y;
                } else {
                    startX = wire.fromCoords?.x || 50;
                    startY_wire = wire.fromCoords?.y || 100;
                }
            } else {
                startX = wire.fromCoords?.x || 50;
                startY_wire = wire.fromCoords?.y || 100;
            }

            // End point at abstract slot boundary
            const endX = wireEntryX;
            const endY = startY + index * verticalSpacing;

            // Bundle point Y (align with destination)
            const bundleY = endY;

            // Create bezier path: Pico pin -> bundle point -> slot boundary
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.classList.add('bundled-wire', 'abstract-wire');
            path.classList.add(`wire-${role}`);
            path.setAttribute('data-wire-id', wire.id);
            path.setAttribute('data-group-id', group.id);

            // Set stroke color inline (CSS handles opacity based on active state)
            path.style.stroke = color;
            path.style.fill = 'none';
            // Let CSS control opacity - .bundled-wire has opacity: 0.5 by default
            // and .wire-active has opacity: 1

            // Calculate control points for smooth curve
            const cp1x = startX + (bundleX - startX) * 0.5;
            const cp1y = startY_wire;
            const cp2x = bundleX - 15;
            const cp2y = bundleY;

            // Path: Move to start, curve to bundle, line to boundary
            const d = `M ${startX} ${startY_wire}
                       C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${bundleX} ${bundleY}
                       L ${endX} ${endY}`;

            path.setAttribute('d', d);
            this.wiresLayer.appendChild(path);

            // Store wire-to-group mapping for interactions
            if (!this.wireToGroup) this.wireToGroup = new Map();
            this.wireToGroup.set(wire.id, group.id);
        });
    }
}

// ==================== Helper Functions (CircuitLoader compatibility) ====================

/**
 * Check if a hole is available (in explorer mode, always returns true)
 * In explorer mode we're rendering complete circuits, not doing guided wiring
 */
function isHoleAvailable(holeId) {
    // In explorer mode, we trust the circuit JSON and render everything
    return true;
}

/**
 * Mark a hole as occupied (no-op in explorer mode)
 */
function markHoleOccupied(holeId, occupantType, occupantId) {
    // In explorer mode, we don't track hole occupation
    // Just log for debugging
    console.log(`[Explorer] Hole ${holeId} used by ${occupantType}: ${occupantId}`);
}

/**
 * Clear hole occupation (no-op in explorer mode)
 */
function clearHoleOccupation(holeId) {
    // No-op in explorer mode
}

/**
 * Suggest alternative holes (not needed in explorer mode)
 */
function suggestAlternativeHoles(occupiedHoleId) {
    return [];
}

/**
 * Highlight alternative holes (no-op in explorer mode)
 */
function highlightAlternativeHoles(holeIds) {
    // No-op in explorer mode
}

/**
 * Clear alternative highlights (no-op in explorer mode)
 */
function clearAlternativeHighlights() {
    // No-op in explorer mode
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.explorerApp = new ExplorerApp();
    console.log('Circuit Explorer app initialized');
});
