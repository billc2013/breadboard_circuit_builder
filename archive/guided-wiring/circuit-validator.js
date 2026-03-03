// circuit-validator.js

/**
 * Circuit Validation Engine - Generic Version with Graph-Based Topology
 * Validates any breadboard circuit JSON against component library
 * 
 * Validation Layers:
 * 1. Structural Validation (JSON Schema)
 * 2. Reference Validation (IDs exist)
 * 3. Electrical Rule Check (shorts, conflicts)
 * 4. Graph-Based Topology (series connections, complete paths)
 * 5. Component-Specific Rules (PWM capability, polarity)
 */

class CircuitValidator {
    constructor(breadboardHoles) {
        this.holes = breadboardHoles;
        this.busMap = this.buildBusMap(breadboardHoles);
        this.holeMap = this.buildHoleMap(breadboardHoles);
        
        // Component library (loaded dynamically)
        this.componentLibrary = null;
        this.loadedComponents = new Map();
    }

    /**
     * Initialize validator by loading component library
     */
    async init() {
        try {
            const response = await fetch('components/library.json');
            if (!response.ok) {
                throw new Error('Failed to load component library');
            }
            const data = await response.json();
            this.componentLibrary = data.library;
            console.log('Component library loaded:', Object.keys(this.componentLibrary.index).length, 'components available');
            return true;
        } catch (error) {
            console.error('Error loading component library:', error);
            return false;
        }
    }

    /**
     * Load a component definition by type
     */
    async loadComponent(componentType) {
        // Check cache first
        if (this.loadedComponents.has(componentType)) {
            return this.loadedComponents.get(componentType);
        }

        // Check if component exists in library
        if (!this.componentLibrary) {
            throw new Error('Component library not initialized. Call init() first.');
        }

        const componentPath = this.componentLibrary.index[componentType];
        if (!componentPath) {
            throw new Error(`Component type "${componentType}" not found in library`);
        }

        // Load component file
        try {
            const response = await fetch(`components/${componentPath}`);
            if (!response.ok) {
                throw new Error(`Failed to load component: ${componentPath}`);
            }
            const data = await response.json();
            const component = data.component;
            
            // Cache it
            this.loadedComponents.set(componentType, component);
            
            return component;
        } catch (error) {
            throw new Error(`Error loading component "${componentType}": ${error.message}`);
        }
    }

    /**
     * Main validation entry point - GENERIC
     * @param {Object} circuitJSON - Any circuit definition to validate
     * @returns {Object} - { valid: boolean, errors: [], warnings: [] }
     */
    async validate(circuitJSON) {
        const errors = [];
        const warnings = [];

        console.log('=== Starting Circuit Validation ===');

        // Ensure component library is loaded
        if (!this.componentLibrary) {
            const loaded = await this.init();
            if (!loaded) {
                errors.push(this.createError('LIBRARY_LOAD_FAILED', 'validator', 
                    'Failed to load component library'));
                return { valid: false, errors, warnings };
            }
        }

        // Layer 1: Structural Validation
        console.log('Layer 1: Structural validation...');
        const structuralErrors = this.validateSchema(circuitJSON);
        errors.push(...structuralErrors);
        
        if (structuralErrors.length > 0) {
            console.error('❌ Structural validation failed - aborting further checks');
            return { valid: false, errors, warnings };
        }
        console.log('✓ Structural validation passed');

        // Layer 2: Reference Validation
        console.log('Layer 2: Reference validation...');
        const referenceErrors = await this.validateReferences(circuitJSON);
        errors.push(...referenceErrors);
        
        if (referenceErrors.length > 0) {
            console.warn('⚠ Reference validation found issues - continuing with other checks');
        } else {
            console.log('✓ Reference validation passed');
        }

        // Layer 3: Electrical Rule Check
        console.log('Layer 3: Electrical rules check...');
        const electricalErrors = await this.validateElectricalRules(circuitJSON);
        errors.push(...electricalErrors);
        
        const electricalWarnings = await this.checkElectricalWarnings(circuitJSON);
        warnings.push(...electricalWarnings);
        
        if (electricalErrors.length > 0) {
            console.warn('⚠ Electrical rule violations found');
        } else {
            console.log('✓ Electrical rules passed');
        }

        // Layer 4: Graph-Based Topology Validation
        console.log('Layer 4: Topology validation...');
        const topologyErrors = this.validateTopology(circuitJSON);
        errors.push(...topologyErrors);
        
        if (topologyErrors.length === 0) {
            console.log('✓ Topology validation passed');
        }

        // Layer 5: Component-Specific Rules with PWM
        console.log('Layer 5: Component-specific rules...');
        const componentErrors = await this.validateComponentRules(circuitJSON);
        errors.push(...componentErrors);
        
        if (componentErrors.length === 0) {
            console.log('✓ Component-specific rules passed');
        }

        const valid = errors.length === 0;
        
        console.log('\n=== Validation Complete ===');
        console.log(`Status: ${valid ? '✓ PASSED' : '✗ FAILED'}`);
        console.log(`Errors: ${errors.length}, Warnings: ${warnings.length}`);

        return { valid, errors, warnings };
    }

    /**
     * Build lookup map: holeId -> bus
     */
    buildBusMap(holes) {
        const map = new Map();
        holes.forEach(hole => map.set(hole.id, hole.bus));
        return map;
    }

    /**
     * Build lookup map: holeId -> hole object
     */
    buildHoleMap(holes) {
        const map = new Map();
        holes.forEach(hole => map.set(hole.id, hole));
        return map;
    }

    // ============================================================
    // LAYER 1: STRUCTURAL VALIDATION (JSON Schema)
    // ============================================================

    validateSchema(circuitJSON) {
        const errors = [];

        // Check top-level structure
        if (!circuitJSON || typeof circuitJSON !== 'object') {
            errors.push(this.createError('INVALID_JSON', 'Root', 
                'Circuit data must be a valid JSON object'));
            return errors;
        }

        if (!circuitJSON.circuit) {
            errors.push(this.createError('MISSING_CIRCUIT', 'Root', 
                'Missing required "circuit" field'));
            return errors;
        }

        const circuit = circuitJSON.circuit;

        // Check required top-level fields
        if (!circuit.metadata) {
            errors.push(this.createError('MISSING_METADATA', 'circuit', 
                'Missing required "metadata" field'));
        }

        if (!circuit.components || !Array.isArray(circuit.components)) {
            errors.push(this.createError('MISSING_COMPONENTS', 'circuit', 
                'Missing or invalid "components" array'));
        }

        if (!circuit.wires || !Array.isArray(circuit.wires)) {
            errors.push(this.createError('MISSING_WIRES', 'circuit', 
                'Missing or invalid "wires" array'));
        }

        // Validate metadata structure
        if (circuit.metadata) {
            errors.push(...this.validateMetadata(circuit.metadata));
        }

        // Validate each component structure
        if (Array.isArray(circuit.components)) {
            circuit.components.forEach((comp, index) => {
                errors.push(...this.validateComponentSchema(comp, index));
            });
        }

        // Validate each wire structure
        if (Array.isArray(circuit.wires)) {
            circuit.wires.forEach((wire, index) => {
                errors.push(...this.validateWireSchema(wire, index));
            });
        }

        return errors;
    }

    validateMetadata(metadata) {
        const errors = [];
        const required = ['name', 'description'];

        required.forEach(field => {
            if (!metadata[field] || typeof metadata[field] !== 'string') {
                errors.push(this.createError('INVALID_METADATA', 'metadata', 
                    `Missing or invalid "${field}" field`));
            }
        });

        return errors;
    }

    validateComponentSchema(component, index) {
        const errors = [];
        const location = `components[${index}]`;

        // Required fields
        if (!component.id || typeof component.id !== 'string') {
            errors.push(this.createError('MISSING_COMPONENT_ID', location, 
                'Component missing required "id" field'));
        }

        if (!component.type || typeof component.type !== 'string') {
            errors.push(this.createError('MISSING_COMPONENT_TYPE', location, 
                `Component "${component.id}" missing required "type" field`));
        }

        if (!component.placement || typeof component.placement !== 'object') {
            errors.push(this.createError('MISSING_PLACEMENT', location, 
                `Component "${component.id}" missing required "placement" field`));
        } else {
            // Check that placement has at least one pin
            if (Object.keys(component.placement).length === 0) {
                errors.push(this.createError('EMPTY_PLACEMENT', location, 
                    `Component "${component.id}" has empty placement object`));
            }

            // Check that all placement values are strings (hole IDs)
            Object.entries(component.placement).forEach(([pin, holeId]) => {
                if (typeof holeId !== 'string') {
                    errors.push(this.createError('INVALID_HOLE_ID', location, 
                        `Component "${component.id}" pin "${pin}" has invalid hole ID (must be string)`));
                }
            });
        }

        // Properties should be an object if present
        if (component.properties && typeof component.properties !== 'object') {
            errors.push(this.createError('INVALID_PROPERTIES', location, 
                `Component "${component.id}" has invalid "properties" field (must be object)`));
        }

        return errors;
    }

    validateWireSchema(wire, index) {
        const errors = [];
        const location = `wires[${index}]`;

        // Required fields
        if (!wire.id || typeof wire.id !== 'string') {
            errors.push(this.createError('MISSING_WIRE_ID', location, 
                'Wire missing required "id" field'));
        }

        if (!wire.from || typeof wire.from !== 'string') {
            errors.push(this.createError('MISSING_WIRE_FROM', location, 
                `Wire "${wire.id}" missing required "from" field`));
        }

        if (!wire.to || typeof wire.to !== 'string') {
            errors.push(this.createError('MISSING_WIRE_TO', location, 
                `Wire "${wire.id}" missing required "to" field`));
        }

        return errors;
    }

    // ============================================================
    // LAYER 2: REFERENCE VALIDATION (GENERIC - loads components dynamically)
    // ============================================================

    async validateReferences(circuitJSON) {
        const errors = [];
        const circuit = circuitJSON.circuit;

        // Collect all component IDs
        const componentIds = new Set();
        circuit.components.forEach(comp => {
            if (comp.id) {
                if (componentIds.has(comp.id)) {
                    errors.push(this.createError('DUPLICATE_COMPONENT_ID', comp.id, 
                        `Component ID "${comp.id}" is used more than once`));
                }
                componentIds.add(comp.id);
            }
        });

        // Validate component type references (GENERIC - checks library dynamically)
        for (const comp of circuit.components) {
            if (comp.type) {
                try {
                    const componentDef = await this.loadComponent(comp.type);
                    console.log(`  ✓ Component type "${comp.type}" found in library`);
                    
                    // Validate that placement pins match component definition
                    if (comp.placement && componentDef.pins) {
                        const definedPins = Object.keys(componentDef.pins);
                        const placedPins = Object.keys(comp.placement);
                        
                        placedPins.forEach(pin => {
                            if (!definedPins.includes(pin)) {
                                errors.push(this.createError('INVALID_PIN_NAME', comp.id, 
                                    `Pin "${pin}" not defined in component type "${comp.type}". Valid pins: ${definedPins.join(', ')}`));
                            }
                        });
                    }
                } catch (error) {
                    errors.push(this.createError('UNKNOWN_COMPONENT_TYPE', comp.id, 
                        `Component type "${comp.type}" not found in library: ${error.message}`));
                }
            }
        }

        // Validate hole ID references in component placements
        circuit.components.forEach(comp => {
            if (comp.placement) {
                Object.entries(comp.placement).forEach(([pin, holeId]) => {
                    if (!this.holeMap.has(holeId)) {
                        errors.push(this.createError('INVALID_HOLE_REFERENCE', comp.id, 
                            `Pin "${pin}" references non-existent hole "${holeId}"`));
                    }
                });
            }
        });

        // Validate wire endpoint references
        circuit.wires.forEach(wire => {
            // Check "from" endpoint
            errors.push(...this.validateWireEndpoint(wire, 'from', componentIds));
            
            // Check "to" endpoint
            errors.push(...this.validateWireEndpoint(wire, 'to', componentIds));
        });

        // Validate wire ID uniqueness
        const wireIds = new Set();
        circuit.wires.forEach(wire => {
            if (wire.id) {
                if (wireIds.has(wire.id)) {
                    errors.push(this.createError('DUPLICATE_WIRE_ID', wire.id, 
                        `Wire ID "${wire.id}" is used more than once`));
                }
                wireIds.add(wire.id);
            }
        });

        return errors;
    }

    validateWireEndpoint(wire, endpoint, componentIds) {
        const errors = [];
        const reference = wire[endpoint];

        if (!reference) return errors;

        // Check if it's a component pin reference (format: "componentId.pinName")
        if (reference.includes('.')) {
            const [compId, pinName] = reference.split('.');
            
            if (!componentIds.has(compId)) {
                errors.push(this.createError('INVALID_WIRE_COMPONENT', wire.id, 
                    `Wire ${endpoint} references non-existent component "${compId}"`));
            }
        } else {
            // It's a hole ID reference
            if (!this.holeMap.has(reference)) {
                errors.push(this.createError('INVALID_WIRE_HOLE', wire.id, 
                    `Wire ${endpoint} references non-existent hole "${reference}"`));
            }
        }

        return errors;
    }

    // ============================================================
    // LAYER 3: ELECTRICAL RULE CHECK (ERC)
    // ============================================================

    async validateElectricalRules(circuitJSON) {
        const errors = [];
        const circuit = circuitJSON.circuit;

        // Check for bus conflicts (multiple pins on same bus = short circuit)
        circuit.components.forEach(comp => {
            errors.push(...this.checkBusConflicts(comp));
        });

        // Check for direct power-to-ground shorts
        errors.push(...this.checkPowerGroundShorts(circuit));

        return errors;
    }

    checkBusConflicts(component) {
        const errors = [];

        if (!component.placement) return errors;

        // Map each pin to its bus
        const pinBuses = [];
        Object.entries(component.placement).forEach(([pinName, holeId]) => {
            const bus = this.busMap.get(holeId);
            if (bus) {
                pinBuses.push({ pin: pinName, hole: holeId, bus });
            }
        });

        // Group pins by bus
        const busCounts = {};
        pinBuses.forEach(pb => {
            if (!busCounts[pb.bus]) {
                busCounts[pb.bus] = [];
            }
            busCounts[pb.bus].push(pb.pin);
        });

        // Find buses with multiple pins (SHORT CIRCUIT)
        Object.entries(busCounts).forEach(([bus, pins]) => {
            if (pins.length > 1) {
                errors.push(this.createError('SHORT_CIRCUIT', component.id, 
                    `Multiple pins (${pins.join(', ')}) connected to same bus "${bus}" - this creates a short circuit`,
                    { bus, pins, holes: pinBuses.filter(pb => pb.bus === bus).map(pb => pb.hole) }
                ));
            }
        });

        return errors;
    }

    checkPowerGroundShorts(circuit) {
        const errors = [];

        // Build net connectivity map from wires
        const nets = this.buildNets(circuit);

        // Check if any net connects power and ground rails
        nets.forEach((nodes, netId) => {
            const holeNodes = Array.from(nodes).filter(n => !n.includes('.'));
            const holes = holeNodes.map(holeId => this.holeMap.get(holeId)).filter(Boolean);
            
            const hasPower = holes.some(h => h.type === 'power');
            const hasGround = holes.some(h => h.type === 'ground');

            if (hasPower && hasGround) {
                errors.push(this.createError('POWER_GROUND_SHORT', `net-${netId}`, 
                    `Net connects both power and ground rails directly - this is a short circuit`,
                    { powerHoles: holes.filter(h => h.type === 'power').map(h => h.id),
                      groundHoles: holes.filter(h => h.type === 'ground').map(h => h.id) }
                ));
            }
        });

        return errors;
    }

    async checkElectricalWarnings(circuitJSON) {
    const warnings = [];
    const circuit = circuitJSON.circuit;

    // TODO: Fix unconnected component detection
    // Current implementation only checks for direct wire-to-pin references (e.g., "led1.anode")
    // but doesn't detect connections via breadboard buses.
    // 
    // Example: If LED cathode is at "18E" and wire connects to "18A", they're on the same bus
    // (bus18-bottom), so the LED IS connected, but this check misses it.
    //
    // Need to implement bus-aware connection checking:
    // 1. Get all buses for component pins
    // 2. Check if any wires connect to those buses (not just direct pin references)
    // 3. Use getEndpointBus() to resolve wire endpoints to buses
    //
    // For now: DISABLED to avoid false positives
    // See: https://github.com/yourproject/issues/XXX (when you create the issue)
    
    /* DISABLED - False positives on bus-connected components
    circuit.components.forEach(comp => {
        const placedPins = Object.keys(comp.placement || {});
        
        // Count how many wires connect to this component
        const connectedPins = new Set();
        circuit.wires.forEach(wire => {
            ['from', 'to'].forEach(endpoint => {
                if (wire[endpoint].startsWith(`${comp.id}.`)) {
                    const pinName = wire[endpoint].split('.')[1];
                    connectedPins.add(pinName);
                }
            });
        });

        // Warn if component has pins placed but no wires connected
        if (placedPins.length > 0 && connectedPins.size === 0) {
            warnings.push(this.createWarning('UNCONNECTED_COMPONENT', comp.id, 
                `Component has no wires connected - may be floating`));
        }
    });
    */

    return warnings;
}
    // ============================================================
    // LAYER 4: GRAPH-BASED TOPOLOGY VALIDATION
    // ============================================================

    validateTopology(circuitJSON) {
        const errors = [];
        const circuit = circuitJSON.circuit;

        // Basic checks
        if (circuit.components.length === 0) {
            errors.push(this.createError('EMPTY_CIRCUIT', 'circuit', 
                'Circuit has no components'));
            return errors;
        }

        if (circuit.wires.length === 0 && circuit.components.length > 0) {
            errors.push(this.createError('NO_CONNECTIONS', 'circuit', 
                'Circuit has components but no wires - nothing is connected'));
            return errors;
        }

        // Build connectivity graph from wires AND component placements
        const graph = this.buildBusConnectivityGraph(circuit);
        
        console.log('  → Built connectivity graph with', graph.size, 'nodes');

        // Check series connections (resistor → LED connectivity)
        const seriesErrors = this.checkSeriesConnections(circuit, graph);
        errors.push(...seriesErrors);

        // Check for complete paths (source → component → ground)
        const pathErrors = this.checkCompletePaths(circuit, graph);
        errors.push(...pathErrors);

        // Check for isolated component groups
        const isolationErrors = this.checkIsolatedComponents(circuit, graph);
        errors.push(...isolationErrors);

        return errors;
    }

    buildBusConnectivityGraph(circuit) {
        const graph = new Map();

        const addEdge = (bus1, bus2) => {
            if (!bus1 || !bus2 || bus1 === bus2) return;
            
            if (!graph.has(bus1)) graph.set(bus1, new Set());
            if (!graph.has(bus2)) graph.set(bus2, new Set());
            
            graph.get(bus1).add(bus2);
            graph.get(bus2).add(bus1);
        };

        // Add edges from component placements
        circuit.components.forEach(comp => {
            const buses = Object.values(comp.placement || {})
                .map(holeId => this.busMap.get(holeId))
                .filter(Boolean);
            
            for (let i = 0; i < buses.length; i++) {
                for (let j = i + 1; j < buses.length; j++) {
                    addEdge(buses[i], buses[j]);
                }
            }
        });

        // Add edges from wires
        circuit.wires.forEach(wire => {
            const fromBus = this.getEndpointBus(wire.from, circuit);
            const toBus = this.getEndpointBus(wire.to, circuit);
            
            if (fromBus && toBus) {
                addEdge(fromBus, toBus);
            }
        });

        return graph;
    }

    getEndpointBus(endpoint, circuit) {
        if (!endpoint.includes('.')) {
            return this.busMap.get(endpoint);
        }

        const [compId, pinName] = endpoint.split('.');
        const component = circuit.components.find(c => c.id === compId);
        
        if (!component || !component.placement) return null;

        const holeId = component.placement[pinName];
        return holeId ? this.busMap.get(holeId) : null;
    }

    checkSeriesConnections(circuit, graph) {
        const errors = [];

        const led = circuit.components.find(c => c.type === 'led' || c.type === 'led-red-5mm');
        const resistor = circuit.components.find(c => c.type === 'resistor' || c.type === 'resistor-220');

        if (!led || !resistor) return errors;

        const ledAnodeBus = this.busMap.get(led.placement.anode);
        const ledCathodeBus = this.busMap.get(led.placement.cathode);

        const resistorBuses = Object.values(resistor.placement || {})
            .map(holeId => this.busMap.get(holeId))
            .filter(Boolean);

        const directConnection = resistorBuses.includes(ledAnodeBus) || 
                                resistorBuses.includes(ledCathodeBus);

        if (!directConnection) {
            const connected = resistorBuses.some(rBus => 
                this.pathExists(graph, rBus, ledAnodeBus) ||
                this.pathExists(graph, rBus, ledCathodeBus)
            );

            if (!connected) {
                errors.push(this.createError('OPEN_CIRCUIT', 'led-resistor',
                    'LED and resistor are not connected. They must share a common bus or be connected via wires.',
                    { 
                        ledBuses: [ledAnodeBus, ledCathodeBus],
                        resistorBuses: resistorBuses
                    }
                ));
            }
        }

        return errors;
    }

    checkCompletePaths(circuit, graph) {
        const errors = [];

        const led = circuit.components.find(c => c.type === 'led' || c.type === 'led-red-5mm');
        
        if (!led) return errors;

        const ledCathodeBus = this.busMap.get(led.placement.cathode);
        const ledAnodeBus = this.busMap.get(led.placement.anode);

        const cathodeToGround = this.pathToGround(ledCathodeBus, graph, circuit);
        
        if (!cathodeToGround) {
            errors.push(this.createError('NO_GROUND_PATH', led.id,
                'LED cathode does not have a path to ground. Check wiring and ground connections.',
                { cathodeBus: ledCathodeBus }
            ));
        }

        const anodeToSource = this.pathToPowerSource(ledAnodeBus, graph, circuit);
        
        if (!anodeToSource.found) {
            errors.push(this.createError('NO_SOURCE_PATH', led.id,
                'LED anode does not have a path to a power source (Pico GPIO). Check wiring.',
                { anodeBus: ledAnodeBus }
            ));
        }

        return errors;
    }

pathExists(graph, startBus, targetBus) {
        if (startBus === targetBus) return true;

        const visited = new Set();
        const queue = [startBus];

        while (queue.length > 0) {
            const currentBus = queue.shift();
            
            if (visited.has(currentBus)) continue;
            visited.add(currentBus);

            if (currentBus === targetBus) return true;

            const neighbors = graph.get(currentBus) || new Set();
            neighbors.forEach(neighbor => queue.push(neighbor));
        }

        return false;
    }

    pathToGround(startBus, graph, circuit) {
        if (!startBus) return false;

        const visited = new Set();
        const queue = [startBus];

        while (queue.length > 0) {
            const currentBus = queue.shift();
            
            if (visited.has(currentBus)) continue;
            visited.add(currentBus);

            const busHoles = this.holes.filter(h => h.bus === currentBus);
            if (busHoles.some(h => h.type === 'ground')) {
                return true;
            }

            const wiresOnBus = circuit.wires.filter(w => {
                const fromBus = this.getEndpointBus(w.from, circuit);
                const toBus = this.getEndpointBus(w.to, circuit);
                return fromBus === currentBus || toBus === currentBus;
            });

            for (const wire of wiresOnBus) {
                if (this.isGroundPin(wire.from, circuit) || this.isGroundPin(wire.to, circuit)) {
                    return true;
                }
            }

            const neighbors = graph.get(currentBus) || new Set();
            neighbors.forEach(neighbor => queue.push(neighbor));
        }

        return false;
    }

    pathToPowerSource(startBus, graph, circuit) {
        if (!startBus) return { found: false };

        const visited = new Set();
        const queue = [startBus];

        while (queue.length > 0) {
            const currentBus = queue.shift();
            
            if (visited.has(currentBus)) continue;
            visited.add(currentBus);

            const busHoles = this.holes.filter(h => h.bus === currentBus);
            if (busHoles.some(h => h.type === 'power')) {
                return { found: true, isPowerRail: true };
            }

            const wiresOnBus = circuit.wires.filter(w => {
                const fromBus = this.getEndpointBus(w.from, circuit);
                const toBus = this.getEndpointBus(w.to, circuit);
                return fromBus === currentBus || toBus === currentBus;
            });

            for (const wire of wiresOnBus) {
                if (this.isGPIOPin(wire.from, circuit)) {
                    return { found: true, isPowerRail: false, pin: wire.from };
                }
                if (this.isGPIOPin(wire.to, circuit)) {
                    return { found: true, isPowerRail: false, pin: wire.to };
                }
            }

            const neighbors = graph.get(currentBus) || new Set();
            neighbors.forEach(neighbor => queue.push(neighbor));
        }

        return { found: false };
    }

    isGroundPin(endpoint, circuit) {
        if (!endpoint.includes('.')) return false;

        const [compId, pinName] = endpoint.split('.');
        const component = circuit.components.find(c => c.id === compId);
        
        if (!component) return false;

        return pinName.includes('GND');
    }

    isGPIOPin(endpoint, circuit) {
        if (!endpoint.includes('.')) return false;

        const [compId, pinName] = endpoint.split('.');
        const component = circuit.components.find(c => c.id === compId);
        
        if (!component) return false;

        return pinName.startsWith('GP');
    }

    checkIsolatedComponents(circuit, graph) {
        const errors = [];

        const connectedGroups = this.findConnectedGroups(graph);

        if (connectedGroups.length > 1) {
            errors.push(this.createError('DISCONNECTED_GROUPS', 'circuit',
                `Circuit has ${connectedGroups.length} disconnected groups. All components must be part of the same circuit.`,
                { groupCount: connectedGroups.length, groupSizes: connectedGroups.map(g => g.length) }
            ));
        }

        return errors;
    }

    findConnectedGroups(graph) {
        const visited = new Set();
        const groups = [];

        for (const startNode of graph.keys()) {
            if (visited.has(startNode)) continue;

            const group = [];
            const queue = [startNode];

            while (queue.length > 0) {
                const node = queue.shift();
                
                if (visited.has(node)) continue;
                visited.add(node);
                group.push(node);

                const neighbors = graph.get(node) || new Set();
                neighbors.forEach(neighbor => queue.push(neighbor));
            }

            groups.push(group);
        }

        return groups;
    }

    // ============================================================
    // LAYER 5: COMPONENT-SPECIFIC RULES WITH PWM
    // ============================================================

    async validateComponentRules(circuitJSON) {
        const errors = [];
        const circuit = circuitJSON.circuit;

        for (const comp of circuit.components) {
            try {
                const componentDef = await this.loadComponent(comp.type);
                
                if (componentDef.validation) {
                    errors.push(...await this.validateAgainstComponentRules(comp, componentDef, circuit));
                }
            } catch (error) {
                continue;
            }
        }

        return errors;
    }

    async validateAgainstComponentRules(component, componentDef, circuit) {
        const errors = [];
        const validation = componentDef.validation;

        if (!validation || !validation.rules) return errors;

        const rules = validation.rules;

        // LED-specific
        if (validation.electricalType === 'led') {
            if (!component.placement.anode || !component.placement.cathode) {
                errors.push(this.createError('INVALID_LED_PLACEMENT', component.id, 
                    'LED must have both "anode" and "cathode" pins defined in placement'));
            }

            if (component.placement.anode && component.placement.cathode) {
                const anodeBus = this.busMap.get(component.placement.anode);
                const cathodeBus = this.busMap.get(component.placement.cathode);

                const cathodeHoles = this.holes.filter(h => h.bus === cathodeBus);
                const anodeHoles = this.holes.filter(h => h.bus === anodeBus);

                if (cathodeHoles.some(h => h.type === 'power')) {
                    errors.push(this.createError('LED_REVERSED', component.id,
                        'LED appears to be reversed - cathode is connected to power rail instead of ground'));
                }

                if (anodeHoles.some(h => h.type === 'ground')) {
                    errors.push(this.createError('LED_REVERSED', component.id,
                        'LED appears to be reversed - anode is connected to ground rail instead of power'));
                }
            }
        }

        // Resistor-specific
        if (validation.electricalType === 'resistor') {
            const pins = Object.keys(component.placement || {});
            if (pins.length !== 2) {
                errors.push(this.createError('INVALID_RESISTOR_PLACEMENT', component.id, 
                    'Resistor must have exactly 2 pins defined in placement'));
            }
        }

        // Microcontroller-specific
        if (validation.electricalType === 'microcontroller') {
            const picoWires = circuit.wires.filter(w => 
                w.from.startsWith(`${component.id}.`) || w.to.startsWith(`${component.id}.`)
            );

            for (const wire of picoWires) {
                const isPWMSignal = wire.properties?.signal_type === 'pwm' || 
                                   wire.properties?.function === 'signal';

                if (isPWMSignal) {
                    const endpoint = wire.from.startsWith(`${component.id}.`) ? wire.from : wire.to;
                    const pinName = endpoint.split('.')[1];

                    const pinDef = componentDef.pins[pinName];
                    
                    if (pinDef && pinDef.pwmCapable === false) {
                        errors.push(this.createError('INVALID_PWM_PIN', component.id,
                            `Pin ${pinName} does not support PWM. Choose a PWM-capable GPIO pin (e.g., GP0-GP28).`,
                            { pin: pinName, wireId: wire.id }
                        ));
                    }

                    if (pinDef && pinDef.pwmCapable === true) {
                        console.log(`  ✓ Pin ${pinName} is PWM-capable (channel ${pinDef.pwmChannel})`);
                    }
                }
            }
        }

        return errors;
    }

    // ============================================================
    // HELPER METHODS
    // ============================================================

    buildNets(circuit) {
        const nets = new Map();
        let netId = 0;

        circuit.wires.forEach(wire => {
            const nodes = new Set([wire.from, wire.to]);
            nets.set(netId++, nodes);
        });

        return nets;
    }

    createError(type, location, message, metadata = {}) {
        return {
            type,
            severity: 'error',
            location,
            message,
            ...metadata
        };
    }

    createWarning(type, location, message, metadata = {}) {
        return {
            type,
            severity: 'warning',
            location,
            message,
            ...metadata
        };
    }

    generateReport(validationResult) {
        const lines = [];
        
        lines.push('╔════════════════════════════════════════════════════════╗');
        lines.push('║         CIRCUIT VALIDATION REPORT                      ║');
        lines.push('╚════════════════════════════════════════════════════════╝\n');
        lines.push(`Status: ${validationResult.valid ? '✓ PASSED' : '✗ FAILED'}\n`);
        lines.push(`Errors: ${validationResult.errors.length}`);
        lines.push(`Warnings: ${validationResult.warnings.length}\n`);

        if (validationResult.errors.length > 0) {
            lines.push('\n━━━ ERRORS ━━━');
            validationResult.errors.forEach((err, i) => {
                lines.push(`\n${i + 1}. [${err.type}] ${err.location}`);
                lines.push(`   ${err.message}`);
                if (err.bus || err.pins) {
                    lines.push(`   Details: ${JSON.stringify({ bus: err.bus, pins: err.pins }, null, 2)}`);
                }
            });
        }

        if (validationResult.warnings.length > 0) {
            lines.push('\n\n━━━ WARNINGS ━━━');
            validationResult.warnings.forEach((warn, i) => {
                lines.push(`\n${i + 1}. [${warn.type}] ${warn.location}`);
                lines.push(`   ${warn.message}`);
            });
        }

        if (validationResult.valid) {
            lines.push('\n\n✓ Circuit is valid and ready to render!');
        } else {
            lines.push('\n\n✗ Circuit has errors and cannot be rendered.');
            lines.push('Please fix the errors above and try again.');
        }

        return lines.join('\n');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CircuitValidator;
}