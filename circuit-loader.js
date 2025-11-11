// circuit-loader.js
// Load and render complete circuits from JSON files
// Dynamically loads component adapters and orchestrates rendering

/**
 * CircuitLoader - Loads circuit JSON and renders all components + wires
 * 
 * Architecture:
 * 1. Load component registry (library.json)
 * 2. Parse circuit JSON
 * 3. Load adapters dynamically for each component type
 * 4. Validate and render components
 * 5. Create wires
 */
class CircuitLoader {
    constructor(app) {
        this.app = app;  // Reference to BreadboardApp instance
        this.componentRegistry = null;
        this.loadedAdapters = new Map();     // Cache adapter instances
        this.loadedMetadata = new Map();     // Cache component metadata
        this.loadedGeometry = new Map();     // Cache geometry scripts
        this.renderedComponents = new Map(); // Track rendered components by ID
    }
    
    /**
     * Initialize - Load component registry from library.json
     */
    async init() {
        try {
            const response = await fetch('components/library.json');
            if (!response.ok) {
                throw new Error('Failed to load component library');
            }
            const data = await response.json();
            this.componentRegistry = data.library.index;
            
            console.log('✓ Component registry loaded:', Object.keys(this.componentRegistry).length, 'component types');
            
            return true;
        } catch (error) {
            console.error('❌ Error loading component registry:', error);
            this.componentRegistry = {};
            return false;
        }
    }
    
    /**
     * Load component metadata from JSON file
     * @param {string} componentType - Component type key (e.g., "led-red-5mm")
     * @returns {Object} Component metadata
     */
    async loadComponentMetadata(componentType) {
        // Check cache first
        if (this.loadedMetadata.has(componentType)) {
            return this.loadedMetadata.get(componentType);
        }
        
        // Get component info from registry
        const componentInfo = this.componentRegistry[componentType];
        if (!componentInfo || !componentInfo.metadata) {
            throw new Error(`Component type "${componentType}" not found in registry`);
        }
        
        // Load metadata file
        const metadataPath = `components/${componentInfo.metadata}`;
        const response = await fetch(metadataPath);
        if (!response.ok) {
            throw new Error(`Failed to load component metadata: ${metadataPath}`);
        }
        
        const data = await response.json();
        const metadata = data.component;
        
        // Cache it
        this.loadedMetadata.set(componentType, metadata);
        console.log(`  ✓ Loaded metadata for ${componentType}`);
        
        return metadata;
    }
    
    /**
     * Load geometry script for a component
     * @param {string} componentType - Component type key
     * @returns {Promise} Resolves when script is loaded
     */
    async loadGeometryScript(componentType) {
        // Check if already loaded
        if (this.loadedGeometry.has(componentType)) {
            return;
        }
        
            // SPECIAL CASE: Pico geometry is pre-loaded in HTML
        if (componentType === 'raspberry-pi-pico' && typeof PICO_CONFIG !== 'undefined') {
            console.log(`  ℹ️  Pico geometry already loaded (pre-loaded in HTML)`);
            this.loadedGeometry.set(componentType, true);
            return;
        }

        // Get component info from registry
        const componentInfo = this.componentRegistry[componentType];
        if (!componentInfo || !componentInfo.geometry) {
            throw new Error(`No geometry script defined for ${componentType}`);
        }
        
        const geometryPath = `components/${componentInfo.geometry}`;
        
        await this.loadScript(geometryPath);
        
        this.loadedGeometry.set(componentType, true);
        console.log(`  ✓ Loaded geometry for ${componentType}`);
    }
    
    /**
     * Load component adapter dynamically
     * @param {string} componentType - Component type key
     * @returns {Object} Adapter instance
     */
    async loadAdapter(componentType) {
        // Check cache
        if (this.loadedAdapters.has(componentType)) {
            return this.loadedAdapters.get(componentType);
        }
        
        // Get adapter info from registry
        const componentInfo = this.componentRegistry[componentType];
        if (!componentInfo || !componentInfo.adapter) {
            throw new Error(`No adapter defined for ${componentType}`);
        }
        
        // Load geometry script first (adapters depend on geometry functions)
        await this.loadGeometryScript(componentType);
        
        // Load adapter script
        const adapterPath = `components/${componentInfo.adapter}`;
        await this.loadScript(adapterPath);
        
        // Instantiate adapter class
        const AdapterClass = window[componentInfo.adapterClass];
        if (!AdapterClass) {
            throw new Error(`Adapter class ${componentInfo.adapterClass} not found after loading ${adapterPath}`);
        }
        
        const adapter = new AdapterClass();
        
        // Cache it
        this.loadedAdapters.set(componentType, adapter);
        console.log(`  ✓ Loaded adapter for ${componentType}`);
        
        return adapter;
    }
    
    /**
     * Helper: Load external script dynamically
     * @param {string} src - Script source path
     * @returns {Promise} Resolves when script loads
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    }
    
    /**
     * Load complete circuit from JSON
     * @param {Object} circuitJson - Circuit definition
     * @returns {Object} Load result { success, errors, warnings, components, wires }
     */
    async loadCircuit(circuitJson) {
        console.log('\n' + '='.repeat(60));
        console.log('🔧 Loading Circuit');
        console.log('='.repeat(60));
        
        const circuit = circuitJson.circuit;
        const errors = [];
        const warnings = [];
        
        // Validate circuit structure
        if (!circuit) {
            errors.push('Invalid circuit JSON: missing "circuit" object');
            return { success: false, errors };
        }
        
        if (!circuit.components || !Array.isArray(circuit.components)) {
            errors.push('Invalid circuit JSON: missing "components" array');
            return { success: false, errors };
        }
        
        if (!circuit.wires || !Array.isArray(circuit.wires)) {
            warnings.push('No wires defined in circuit');
        }
        
        // Display metadata
        if (circuit.metadata) {
            console.log(`📋 Circuit: ${circuit.metadata.name || 'Untitled'}`);
            if (circuit.metadata.description) {
                console.log(`   ${circuit.metadata.description}`);
            }
            if (circuit.metadata.created) {
                console.log(`   Created: ${circuit.metadata.created}`);
            }
        }
        
        // Clear existing circuit
        console.log('\n🗑️  Clearing existing circuit...');
        this.clearCircuit();
        
        // Render components
        console.log('\n🔨 Rendering Components');
        console.log('-'.repeat(60));
        
        for (const comp of circuit.components) {
            try {
                await this.renderComponent(comp);
            } catch (error) {
                const errorMsg = `Failed to render ${comp.type} (${comp.id}): ${error.message}`;
                console.error(`❌ ${errorMsg}`);
                errors.push(errorMsg);
            }
        }
        
        // Render wires
        if (circuit.wires && circuit.wires.length > 0) {
            console.log('\n⚡ Rendering Wires');
            console.log('-'.repeat(60));
            
            for (const wire of circuit.wires) {
                try {
                    this.renderWire(wire);
                } catch (error) {
                    const errorMsg = `Failed to render wire ${wire.id || 'unnamed'}: ${error.message}`;
                    console.error(`❌ ${errorMsg}`);
                    errors.push(errorMsg);
                }
            }
        }
        
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('✅ Circuit Load Complete');
        console.log('='.repeat(60));
        console.log(`Components rendered: ${this.renderedComponents.size}`);
        console.log(`Wires created: ${this.app.wires.length}`);
        
        if (errors.length > 0) {
            console.log(`\n⚠️  Errors: ${errors.length}`);
            errors.forEach(err => console.error(`  ❌ ${err}`));
        }
        
        if (warnings.length > 0) {
            console.log(`\n⚠️  Warnings: ${warnings.length}`);
            warnings.forEach(warn => console.warn(`  ⚠️  ${warn}`));
        }
        
        console.log('='.repeat(60) + '\n');
        
        const success = errors.length === 0;
        return { 
            success, 
            errors, 
            warnings,
            components: this.renderedComponents.size,
            wires: this.app.wires.length
        };
    }
    
    /**
     * Render a single component
     * @param {Object} componentData - Component definition from circuit JSON
     */
    async renderComponent(componentData) {
        const { id, type, placement } = componentData;
        
        if (!id || !type || !placement) {
            throw new Error('Component missing required fields: id, type, or placement');
        }
        
        console.log(`\n📦 ${id} (${type})`);
        
        // Load metadata
        const metadata = await this.loadComponentMetadata(type);
        
        // Load adapter
        const adapter = await this.loadAdapter(type);
        
        // Validate placement
        console.log(`  🔍 Validating placement...`);
        const validation = adapter.validate(placement, BREADBOARD_HOLES);
        
        if (!validation.valid) {
            throw new Error(`Invalid placement: ${validation.error}`);
        }
        
        if (validation.warning) {
            console.warn(`  ⚠️  ${validation.warning}`);
        }
        
        // Calculate position
        console.log(`  📐 Calculating position...`);
        const position = adapter.calculatePosition(placement, BREADBOARD_HOLES);
        
        if (!position) {
            throw new Error('Failed to calculate position');
        }
        
        // Check hole availability (only for components that use holes)
        const requiredHoles = adapter.getRequiredHoles(placement);
        if (requiredHoles.length > 0) {
            console.log(`  🔒 Checking ${requiredHoles.length} required holes...`);
            
            for (const holeId of requiredHoles) {
                // Skip Pico pins (they're not breadboard holes)
                if (holeId.includes('.')) continue;
                
                if (!isHoleAvailable(holeId)) {
                    throw new Error(`Required hole ${holeId} is occupied`);
                }
            }
        }
        
        // Render component
        console.log(`  🎨 Rendering...`);
        await adapter.render(id, position, metadata);
        
        // Track it
        this.renderedComponents.set(id, { 
            type, 
            placement, 
            metadata,
            adapter,
            position
        });
        
        console.log(`  ✅ ${id} rendered successfully`);
    }
    
    /**
     * Render a wire connection
     * @param {Object} wireData - Wire definition { from, to, id?, description? }
     */
    renderWire(wireData) {
        const { from, to, id, description } = wireData;
        
        if (!from || !to) {
            throw new Error('Wire missing from or to endpoint');
        }
        
        // Look up connection points by ID
        const fromPoint = this.app.pointsById.get(from);
        const toPoint = this.app.pointsById.get(to);
        
        if (!fromPoint) {
            throw new Error(`Wire 'from' point not found: ${from}`);
        }
        if (!toPoint) {
            throw new Error(`Wire 'to' point not found: ${to}`);
        }
        
        // Check hole availability (only for breadboard holes, not Pico pins)
        if (!from.includes('.') && !isHoleAvailable(from)) {
            throw new Error(`Wire 'from' hole ${from} is occupied`);
        }
        if (!to.includes('.') && !isHoleAvailable(to)) {
            throw new Error(`Wire 'to' hole ${to} is occupied`);
        }
        
        // Create wire using existing app method
        this.app.createWire(fromPoint, toPoint);
        
        const wireId = id || `wire-${this.app.wires.length}`;
        const desc = description ? ` (${description})` : '';
        console.log(`  ✓ ${wireId}: ${from} → ${to}${desc}`);
    }
    
    /**
     * Clear all components and wires
     */
    clearCircuit() {
        // Clear wires (this also clears hole occupation for wires)
        this.app.clearAllWires();
        
        // Clear components (except Pico which is permanent)
        const componentsLayer = document.getElementById('components-layer');
        if (componentsLayer) {
            // Remove all component groups and their stubs
            componentsLayer.querySelectorAll('.component').forEach(el => {
                const compId = el.getAttribute('data-component-id');
                const compType = el.getAttribute('data-component-type');
                
                // Get holes that were occupied by this component
                const holes = document.querySelectorAll(`[data-occupied-by="${compId}"]`);
                holes.forEach(hole => {
                    clearHoleOccupation(hole.getAttribute('data-hole-id'));
                });
                
                el.remove();
                console.log(`  Removed ${compType} (${compId})`);
            });
            
            // Remove component labels
            componentsLayer.querySelectorAll('.component-label').forEach(el => el.remove());
            
            // Remove LED/resistor stub legs (they have specific classes)
            componentsLayer.querySelectorAll('.led-stub, .resistor-stub').forEach(el => el.remove());
            
            // Remove any orphaned lines (backup cleanup)
            componentsLayer.querySelectorAll('line').forEach(el => el.remove());
        }
        
        this.renderedComponents.clear();
        console.log('  Circuit cleared');
    }
    
    /**
     * Export current circuit to JSON format
     * @returns {Object} Circuit JSON
     */
    exportCircuit() {
        const components = [];
        
        // Export rendered components
        this.renderedComponents.forEach((data, id) => {
            components.push({
                id,
                type: data.type,
                placement: data.placement
            });
        });
        
        // Export wires
        const wires = this.app.wires.map(wire => ({
            id: wire.id,
            from: wire.from,
            to: wire.to
        }));
        
        return {
            circuit: {
                metadata: {
                    name: "Exported Circuit",
                    description: "Circuit exported from Breadboard Builder",
                    exported: new Date().toISOString()
                },
                components,
                wires
            }
        };
    }
}

// Make CircuitLoader globally available
window.CircuitLoader = CircuitLoader;

console.log('✓ CircuitLoader module loaded');
