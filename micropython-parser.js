/**
 * MicroPython Parser for Circuit Explorer
 *
 * Parses annotated MicroPython code to extract circuit information:
 *   led = Pin(15, Pin.OUT)  # led-red-5mm
 *   button = Pin(14, Pin.IN, Pin.PULL_DOWN)  # button-tactile-6mm
 *   sensor = ADC(Pin(26))  # photocell-ldr
 *
 * Uses the "One Truth" component library to:
 * - Resolve component types to full metadata
 * - Auto-generate support components (resistors)
 * - Generate wire definitions with roles and colors
 */

class MicroPythonParser {
    constructor() {
        this.componentLibrary = null;
        this.componentMetadataCache = new Map();
        this.errors = [];
        this.warnings = [];
    }

    /**
     * Main entry point - parse MicroPython code and return circuit data
     * @param {string} micropythonCode - Annotated MicroPython source code
     * @returns {Promise<{success: boolean, circuitData: object, errors: array, warnings: array}>}
     */
    async parse(micropythonCode) {
        this.errors = [];
        this.warnings = [];

        console.log('[MicroPythonParser] Starting parse...');
        console.log('[MicroPythonParser] Input code:', micropythonCode);

        // Load component library if not cached
        if (!this.componentLibrary) {
            try {
                console.log('[MicroPythonParser] Loading component library...');
                const response = await fetch('components/library.json');
                const data = await response.json();
                this.componentLibrary = data.library;
                console.log('[MicroPythonParser] Component library loaded:', Object.keys(this.componentLibrary.index));
            } catch (err) {
                console.error('[MicroPythonParser] Failed to load library:', err);
                this.errors.push({
                    type: 'library_load_error',
                    message: 'Failed to load component library',
                    detail: err.message
                });
                return { success: false, circuitData: null, errors: this.errors, warnings: this.warnings };
            }
        }

        // Extract declarations from code
        const declarations = this.extractDeclarations(micropythonCode);
        console.log('[MicroPythonParser] Extracted declarations:', declarations);

        if (declarations.length === 0) {
            console.warn('[MicroPythonParser] No declarations found!');
            this.errors.push({
                type: 'no_declarations',
                message: 'No valid Pin/PWM/ADC declarations found',
                suggestion: 'Use format: variable = Pin(N, Pin.MODE)  # component-type'
            });
            return { success: false, circuitData: null, errors: this.errors, warnings: this.warnings };
        }

        // Resolve component types and load metadata
        console.log('[MicroPythonParser] Resolving components...');
        const resolvedComponents = [];
        for (const decl of declarations) {
            console.log('[MicroPythonParser] Resolving:', decl.variableName, decl.componentType);
            const resolved = await this.resolveComponent(decl);
            console.log('[MicroPythonParser] Resolved result:', resolved);
            if (resolved) {
                resolvedComponents.push(resolved);
            }
        }

        console.log('[MicroPythonParser] Resolved components:', resolvedComponents.length);

        if (resolvedComponents.length === 0) {
            console.error('[MicroPythonParser] No components resolved! Errors:', this.errors);
            return { success: false, circuitData: null, errors: this.errors, warnings: this.warnings };
        }

        // Generate support components (resistors)
        const supportComponents = this.generateSupportComponents(resolvedComponents);
        console.log('[MicroPythonParser] Support components:', supportComponents);

        // Generate wires
        const wires = this.generateWires(resolvedComponents);
        console.log('[MicroPythonParser] Generated wires:', wires);

        // Build circuit data structure
        const circuitData = this.buildCircuitData(resolvedComponents, supportComponents, wires);
        console.log('[MicroPythonParser] Final circuit data:', JSON.stringify(circuitData, null, 2));

        console.log('[MicroPythonParser] Parse complete. Errors:', this.errors.length, 'Warnings:', this.warnings.length);

        return {
            success: this.errors.length === 0,
            circuitData,
            errors: this.errors,
            warnings: this.warnings
        };
    }

    /**
     * Extract Pin/PWM/ADC declarations from MicroPython code
     * @param {string} code - MicroPython source code
     * @returns {Array} Array of declaration objects
     */
    extractDeclarations(code) {
        const declarations = [];

        // Normalize line endings
        const normalizedCode = code.replace(/\r\n/g, '\n');
        console.log('[MicroPythonParser] extractDeclarations - normalized code:', normalizedCode);

        // Pattern for Pin(N, Pin.MODE) with optional pull resistor
        // Matches: led = Pin(15, Pin.OUT)  # led-red-5mm
        const pinPattern = /(\w+)\s*=\s*Pin\s*\(\s*(\d+)\s*,\s*Pin\s*\.\s*(OUT|IN)(?:\s*,\s*Pin\s*\.\s*(PULL_DOWN|PULL_UP))?\s*\)\s*#\s*(\S+)/gi;

        // Pattern for PWM(Pin(N))
        // Matches: pwm_led = PWM(Pin(16))  # led-red-5mm
        const pwmPattern = /(\w+)\s*=\s*PWM\s*\(\s*Pin\s*\(\s*(\d+)\s*\)\s*\)\s*#\s*(\S+)/gi;

        // Pattern for ADC(Pin(N))
        // Matches: sensor = ADC(Pin(26))  # photocell-ldr
        const adcPattern = /(\w+)\s*=\s*ADC\s*\(\s*Pin\s*\(\s*(\d+)\s*\)\s*\)\s*#\s*(\S+)/gi;

        // Extract Pin declarations
        let match;
        console.log('[MicroPythonParser] Testing Pin pattern...');
        while ((match = pinPattern.exec(normalizedCode)) !== null) {
            console.log('[MicroPythonParser] Pin match found:', match);
            declarations.push({
                variableName: match[1],
                gpioPin: parseInt(match[2]),
                mode: match[3].toUpperCase(),
                pullMode: match[4] ? match[4].toUpperCase() : null,
                componentType: match[5].toLowerCase(),
                isPWM: false,
                isADC: false,
                lineText: match[0]
            });
        }

        // Extract PWM declarations
        console.log('[MicroPythonParser] Testing PWM pattern...');
        while ((match = pwmPattern.exec(normalizedCode)) !== null) {
            console.log('[MicroPythonParser] PWM match found:', match);
            declarations.push({
                variableName: match[1],
                gpioPin: parseInt(match[2]),
                mode: 'OUT',
                pullMode: null,
                componentType: match[3].toLowerCase(),
                isPWM: true,
                isADC: false,
                lineText: match[0]
            });
        }

        // Extract ADC declarations
        console.log('[MicroPythonParser] Testing ADC pattern...');
        while ((match = adcPattern.exec(normalizedCode)) !== null) {
            console.log('[MicroPythonParser] ADC match found:', match);
            declarations.push({
                variableName: match[1],
                gpioPin: parseInt(match[2]),
                mode: 'IN',
                pullMode: null,
                componentType: match[3].toLowerCase(),
                isPWM: false,
                isADC: true,
                lineText: match[0]
            });
        }

        console.log('[MicroPythonParser] Total declarations found:', declarations.length);

        // Check for duplicate variable names
        const seenVariables = new Set();
        for (const decl of declarations) {
            if (seenVariables.has(decl.variableName)) {
                this.warnings.push({
                    type: 'duplicate_variable',
                    message: `Variable '${decl.variableName}' declared multiple times`,
                    suggestion: 'Using first occurrence'
                });
            }
            seenVariables.add(decl.variableName);
        }

        return declarations;
    }

    /**
     * Resolve a declaration to component metadata
     * @param {object} declaration - Extracted declaration
     * @returns {Promise<object|null>} Resolved component or null on error
     */
    async resolveComponent(declaration) {
        const componentType = declaration.componentType;

        // Check if component exists in library
        const libraryEntry = this.componentLibrary.index[componentType];
        if (!libraryEntry) {
            this.errors.push({
                type: 'unknown_component',
                message: `Unknown component type: "${componentType}"`,
                suggestion: `Available types: ${Object.keys(this.componentLibrary.index).filter(k => k !== 'raspberry-pi-pico').join(', ')}`
            });
            return null;
        }

        // Load component metadata (with caching)
        let metadata;
        if (this.componentMetadataCache.has(componentType)) {
            metadata = this.componentMetadataCache.get(componentType);
        } else {
            try {
                const response = await fetch(`components/${libraryEntry.metadata}`);
                const data = await response.json();
                metadata = data.component;
                this.componentMetadataCache.set(componentType, metadata);
            } catch (err) {
                this.errors.push({
                    type: 'metadata_load_error',
                    message: `Failed to load metadata for ${componentType}`,
                    detail: err.message
                });
                return null;
            }
        }

        // Validate mode matches component category
        const category = metadata.functionalGroup?.category;

        if (category === 'output' && declaration.mode !== 'OUT') {
            this.warnings.push({
                type: 'mode_mismatch',
                message: `${componentType} is an output but pin mode is ${declaration.mode}`,
                suggestion: 'Consider using Pin.OUT for output components'
            });
        }

        if (category === 'sensor' && declaration.mode !== 'IN') {
            this.warnings.push({
                type: 'mode_mismatch',
                message: `${componentType} is a sensor but pin mode is ${declaration.mode}`,
                suggestion: 'Consider using Pin.IN for sensor components'
            });
        }

        // Validate ADC usage
        if (declaration.isADC) {
            const validAdcPins = [26, 27, 28];
            if (!validAdcPins.includes(declaration.gpioPin)) {
                this.errors.push({
                    type: 'invalid_adc_pin',
                    message: `GPIO ${declaration.gpioPin} is not an ADC-capable pin`,
                    suggestion: 'Use GP26, GP27, or GP28 for ADC'
                });
                return null;
            }
        }

        // Validate GPIO pin range
        if (declaration.gpioPin < 0 || declaration.gpioPin > 28) {
            this.errors.push({
                type: 'invalid_gpio_pin',
                message: `GPIO ${declaration.gpioPin} is out of range`,
                suggestion: 'Use GPIO pins 0-28'
            });
            return null;
        }

        return {
            id: declaration.variableName,
            type: componentType,
            gpioPin: declaration.gpioPin,
            mode: declaration.mode,
            pullMode: declaration.pullMode,
            isPWM: declaration.isPWM,
            isADC: declaration.isADC,
            metadata: metadata
        };
    }

    /**
     * Generate support components based on functionalGroup.requires
     * @param {Array} primaryComponents - Resolved primary components
     * @returns {Array} Support components to add
     */
    generateSupportComponents(primaryComponents) {
        const supportComponents = [];

        for (const primary of primaryComponents) {
            const requires = primary.metadata.functionalGroup?.requires || [];

            for (const req of requires) {
                if (req.type === 'resistor') {
                    // Determine resistor type from role and typical resistance
                    let resistorType;
                    if (req.typicalResistance === 220 || req.role === 'current-limiting') {
                        resistorType = 'resistor-220';
                    } else if (req.typicalResistance === 10000 || req.role === 'pull-down' || req.role === 'voltage-divider') {
                        resistorType = 'resistor-10k';
                    } else {
                        // Default to 220 for unknown
                        resistorType = 'resistor-220';
                        this.warnings.push({
                            type: 'unknown_resistor_value',
                            message: `Unknown resistor requirement for ${primary.id}, defaulting to 220Ω`,
                            suggestion: `Specified: ${req.typicalValue || 'none'}`
                        });
                    }

                    supportComponents.push({
                        id: `${primary.id}-resistor`,
                        type: resistorType,
                        role: req.role,
                        parentId: primary.id,
                        autoGenerated: true
                    });
                }
            }
        }

        return supportComponents;
    }

    /**
     * Generate wire definitions based on components and their functional groups
     * @param {Array} components - Resolved components
     * @returns {Array} Wire definitions
     */
    generateWires(components) {
        const wires = [];
        let gndPinIndex = 0;
        const gndPins = ['GND_3', 'GND_8', 'GND_13', 'GND_18', 'GND_23', 'GND_28', 'GND_33', 'GND_38'];

        for (const component of components) {
            const category = component.metadata.functionalGroup?.category;
            const wireOrder = component.metadata.functionalGroup?.wireOrder || [];

            // Get next GND pin (rotate through available)
            const getNextGnd = () => {
                const pin = gndPins[gndPinIndex % gndPins.length];
                gndPinIndex++;
                return pin;
            };

            // Signal wire (GPIO to component)
            const signalWire = wireOrder.find(w => w.role === 'signal');
            if (signalWire) {
                let pinName = `GP${component.gpioPin}`;
                // ADC pins have special names
                if (component.isADC) {
                    const adcChannel = component.gpioPin - 26;
                    pinName = `GP${component.gpioPin}_ADC${adcChannel}`;
                }

                wires.push({
                    id: `${component.id}-signal`,
                    from: `pico1.${pinName}`,
                    to: `${component.id}.signal`,
                    description: `${signalWire.label || 'Signal'} for ${component.id}`,
                    role: 'signal',
                    color: signalWire.color || '#ffcc00'
                });
            }

            // Ground wire
            const groundWire = wireOrder.find(w => w.role === 'ground');
            if (groundWire) {
                wires.push({
                    id: `${component.id}-ground`,
                    from: `pico1.${getNextGnd()}`,
                    to: `${component.id}.ground`,
                    description: `${groundWire.label || 'Ground'} for ${component.id}`,
                    role: 'ground',
                    color: groundWire.color || '#333333'
                });
            }

            // Power wire (for sensors that need 3.3V)
            const powerWire = wireOrder.find(w => w.role === 'power');
            if (powerWire && category === 'sensor') {
                wires.push({
                    id: `${component.id}-power`,
                    from: 'pico1.3V3_OUT',
                    to: `${component.id}.power`,
                    description: `${powerWire.label || 'Power 3.3V'} for ${component.id}`,
                    role: 'power',
                    color: powerWire.color || '#ff4444'
                });
            }
        }

        return wires;
    }

    /**
     * Build the final circuit data structure
     * @param {Array} primaryComponents - Primary components
     * @param {Array} supportComponents - Auto-generated support components
     * @param {Array} wires - Wire definitions
     * @returns {object} Circuit data in explorer-compatible format
     */
    buildCircuitData(primaryComponents, supportComponents, wires) {
        const components = [];

        // Add Pico (always present)
        components.push({
            id: 'pico1',
            type: 'raspberry-pi-pico',
            placement: {
                position: { x: 20, y: 20 }
            }
        });

        // Add primary components
        for (const comp of primaryComponents) {
            components.push({
                id: comp.id,
                type: comp.type,
                placement: {}, // Empty - abstract layout handles positioning
                picoConnection: {
                    pin: `GP${comp.gpioPin}`,
                    mode: comp.mode,
                    isPWM: comp.isPWM,
                    isADC: comp.isADC,
                    pullMode: comp.pullMode
                }
            });
        }

        // Add support components
        for (const support of supportComponents) {
            components.push({
                id: support.id,
                type: support.type,
                placement: {},
                parentId: support.parentId,
                autoGenerated: true,
                role: support.role
            });
        }

        return {
            circuit: {
                metadata: {
                    name: 'MicroPython Circuit',
                    description: 'Auto-generated from MicroPython code',
                    source: 'micropython-parser',
                    created: new Date().toISOString()
                },
                components,
                wires
            }
        };
    }

    /**
     * Get list of available component types (for suggestions)
     * @returns {Array<string>} Component type names
     */
    getAvailableComponentTypes() {
        if (!this.componentLibrary) return [];
        return Object.keys(this.componentLibrary.index).filter(k => k !== 'raspberry-pi-pico');
    }
}

// Export for use in browser
window.MicroPythonParser = MicroPythonParser;
