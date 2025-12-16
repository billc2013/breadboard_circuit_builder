/**
 * MicroPython Parser for Circuit Explorer
 *
 * Parses annotated MicroPython code to extract circuit information:
 *   led = Pin(15, Pin.OUT)  # led-red-5mm
 *   button = Pin(14, Pin.IN, Pin.PULL_DOWN)  # button-tactile-6mm
 *   sensor = ADC(Pin(26))  # photocell-ldr
 *
 * Enhanced annotation format for multi-pin components:
 *   trig = Pin(14, Pin.OUT)  # us100-ultrasonic:trig
 *   echo = Pin(15, Pin.IN)   # us100-ultrasonic:echo
 *
 *   ain1 = Pin(2, Pin.OUT)   # tb6612-motor-driver:ain1
 *   pwma = PWM(Pin(4))       # tb6612-motor-driver:pwma
 *
 * Uses the "One Truth" component library to:
 * - Resolve component types to full metadata
 * - Group multiple pins into single multi-pin components
 * - Auto-generate support components (resistors)
 * - Generate wire definitions with roles and colors from pin metadata
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
        const rawDeclarations = this.extractDeclarations(micropythonCode);
        console.log('[MicroPythonParser] Extracted raw declarations:', rawDeclarations);

        if (rawDeclarations.length === 0) {
            console.warn('[MicroPythonParser] No declarations found!');
            this.errors.push({
                type: 'no_declarations',
                message: 'No valid Pin/PWM/ADC declarations found',
                suggestion: 'Use format: variable = Pin(N, Pin.MODE)  # component-type'
            });
            return { success: false, circuitData: null, errors: this.errors, warnings: this.warnings };
        }

        // Group multi-pin components (US-100, TB6612, etc.)
        const declarations = this.groupMultiPinDeclarations(rawDeclarations);
        console.log('[MicroPythonParser] Grouped declarations:', declarations);

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
        // Enhanced: trig = Pin(14, Pin.OUT)  # us100-ultrasonic:trig
        // Capture group 5 is component-type, group 6 is optional :pinRole
        const pinPattern = /(\w+)\s*=\s*Pin\s*\(\s*(\d+)\s*,\s*Pin\s*\.\s*(OUT|IN)(?:\s*,\s*Pin\s*\.\s*(PULL_DOWN|PULL_UP))?\s*\)\s*#\s*([\w-]+)(?::([\w]+))?/gi;

        // Pattern for PWM(Pin(N))
        // Matches: pwm_led = PWM(Pin(16))  # led-red-5mm
        // Enhanced: pwma = PWM(Pin(4))  # tb6612-motor-driver:pwma
        const pwmPattern = /(\w+)\s*=\s*PWM\s*\(\s*Pin\s*\(\s*(\d+)\s*\)\s*\)\s*#\s*([\w-]+)(?::([\w]+))?/gi;

        // Pattern for ADC(Pin(N))
        // Matches: sensor = ADC(Pin(26))  # photocell-ldr
        // Enhanced: light = ADC(Pin(26))  # photocell-ldr:signal
        const adcPattern = /(\w+)\s*=\s*ADC\s*\(\s*Pin\s*\(\s*(\d+)\s*\)\s*\)\s*#\s*([\w-]+)(?::([\w]+))?/gi;

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
                pinRole: match[6] ? match[6].toLowerCase() : null,  // New: pin role
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
                pinRole: match[4] ? match[4].toLowerCase() : null,  // New: pin role
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
                pinRole: match[4] ? match[4].toLowerCase() : null,  // New: pin role
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
     * Group declarations by component type for multi-pin components
     * Single-pin components (LED, button, photocell) remain as-is
     * Multi-pin components (US-100, TB6612) are grouped into one entry
     * @param {Array} declarations - Raw declarations from extractDeclarations
     * @returns {Array} Grouped declarations
     */
    groupMultiPinDeclarations(declarations) {
        // Components that need multiple pins (from our library knowledge)
        const multiPinComponents = new Set([
            'us100-ultrasonic',
            'tb6612-motor-driver'
        ]);

        const grouped = [];
        const multiPinGroups = new Map();  // componentType -> array of declarations

        for (const decl of declarations) {
            if (multiPinComponents.has(decl.componentType)) {
                // Multi-pin component: group by type
                if (!multiPinGroups.has(decl.componentType)) {
                    multiPinGroups.set(decl.componentType, []);
                }
                multiPinGroups.get(decl.componentType).push(decl);
            } else {
                // Single-pin component: add directly
                grouped.push(decl);
            }
        }

        // Convert multi-pin groups into single declarations with pins array
        for (const [componentType, decls] of multiPinGroups) {
            // Generate an ID from the first variable name or the component type
            const primaryVar = decls[0].variableName;
            const componentId = primaryVar.replace(/_?(trig|echo|ain\d|bin\d|pwm[ab]|stby|vcc|gnd)$/i, '') || componentType.split('-')[0];

            const pins = decls.map(d => ({
                variableName: d.variableName,
                gpioPin: d.gpioPin,
                mode: d.mode,
                pullMode: d.pullMode,
                pinRole: d.pinRole,  // e.g., 'trig', 'echo', 'ain1', 'pwma'
                isPWM: d.isPWM,
                isADC: d.isADC
            }));

            // Validate that pin roles are specified for multi-pin components
            const missingRoles = pins.filter(p => !p.pinRole);
            if (missingRoles.length > 0) {
                this.warnings.push({
                    type: 'missing_pin_role',
                    message: `Multi-pin component ${componentType} has pins without roles: ${missingRoles.map(p => p.variableName).join(', ')}`,
                    suggestion: `Use format: var = Pin(N, Pin.MODE)  # ${componentType}:pinRole`
                });
            }

            grouped.push({
                variableName: componentId,
                componentType: componentType,
                isMultiPin: true,
                pins: pins,
                // Legacy fields for backward compatibility
                gpioPin: pins[0]?.gpioPin,
                mode: pins[0]?.mode,
                pullMode: pins[0]?.pullMode,
                isPWM: pins.some(p => p.isPWM),
                isADC: pins.some(p => p.isADC),
                lineText: decls.map(d => d.lineText).join('\n')
            });
        }

        console.log('[MicroPythonParser] Grouped declarations:', grouped.length,
            '(from', declarations.length, 'raw declarations)');

        return grouped;
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

        // Build resolved component object
        const resolved = {
            id: declaration.variableName,
            type: componentType,
            gpioPin: declaration.gpioPin,
            mode: declaration.mode,
            pullMode: declaration.pullMode,
            isPWM: declaration.isPWM,
            isADC: declaration.isADC,
            metadata: metadata
        };

        // For multi-pin components, include the pins array with roles
        if (declaration.isMultiPin && declaration.pins) {
            resolved.isMultiPin = true;
            resolved.pins = declaration.pins;

            // Validate pin roles against component metadata
            const validPinNames = Object.keys(metadata.pins || {});
            for (const pin of declaration.pins) {
                if (pin.pinRole && !validPinNames.includes(pin.pinRole)) {
                    this.warnings.push({
                        type: 'invalid_pin_role',
                        message: `Pin role '${pin.pinRole}' not found in ${componentType} definition`,
                        suggestion: `Valid pin roles: ${validPinNames.join(', ')}`
                    });
                }
            }
        } else if (declaration.pinRole) {
            // Single declaration with pin role (shouldn't happen for single-pin components, but handle it)
            resolved.pinRole = declaration.pinRole;
        }

        return resolved;
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

        // Get next GND pin (rotate through available)
        const getNextGnd = () => {
            const pin = gndPins[gndPinIndex % gndPins.length];
            gndPinIndex++;
            return pin;
        };

        for (const component of components) {
            const category = component.metadata.functionalGroup?.category;
            const wireOrder = component.metadata.functionalGroup?.wireOrder || [];

            // Handle multi-pin components differently
            if (component.isMultiPin && component.pins) {
                this.generateMultiPinWires(component, wires, getNextGnd);
                continue;
            }

            // Single-pin component wire generation (original logic)
            // Signal wire (GPIO to component)
            const signalWire = wireOrder.find(w => w.role === 'signal');
            if (signalWire) {
                let pinName = `GP${component.gpioPin}`;
                // ADC pins have special names
                if (component.isADC) {
                    const adcChannel = component.gpioPin - 26;
                    pinName = `GP${component.gpioPin}_ADC${adcChannel}`;
                }

                // Get the target pin from wireLabels
                const signalLabel = component.metadata.functionalGroup?.wireLabels?.signal;
                const targetPinKey = signalLabel?.pinConnection;
                const targetPin = targetPinKey ? component.metadata.pins?.[targetPinKey] : null;

                wires.push({
                    id: `${component.id}-signal`,
                    from: `pico1.${pinName}`,
                    to: `${component.id}.signal`,
                    description: `${signalWire.label || 'Signal'} for ${component.id}`,
                    role: 'signal',
                    color: signalWire.color || '#ffcc00',
                    // Extended data for UI display
                    variableName: component.id,
                    gpioPin: component.gpioPin,
                    componentPinName: targetPin?.name || targetPinKey || 'signal',
                    componentPinDescription: targetPin?.description || null,
                    connectionGuide: targetPin?.connectionGuide || null
                });
            }

            // Ground wire
            const groundWire = wireOrder.find(w => w.role === 'ground');
            if (groundWire) {
                // Get the target pin from wireLabels
                const groundLabel = component.metadata.functionalGroup?.wireLabels?.ground;
                const targetPinKey = groundLabel?.pinConnection;
                const targetPin = targetPinKey ? component.metadata.pins?.[targetPinKey] : null;

                wires.push({
                    id: `${component.id}-ground`,
                    from: `pico1.${getNextGnd()}`,
                    to: `${component.id}.ground`,
                    description: `${groundWire.label || 'Ground'} for ${component.id}`,
                    role: 'ground',
                    color: groundWire.color || '#333333',
                    // Extended data for UI display
                    variableName: null,  // Ground wires don't have a code variable
                    gpioPin: null,
                    componentPinName: targetPin?.name || targetPinKey || 'ground',
                    componentPinDescription: targetPin?.description || null,
                    connectionGuide: targetPin?.connectionGuide || null
                });
            }

            // Power wire (for sensors that need 3.3V)
            const powerWire = wireOrder.find(w => w.role === 'power');
            if (powerWire && category === 'sensor') {
                // Get the target pin from wireLabels
                const powerLabel = component.metadata.functionalGroup?.wireLabels?.power;
                const targetPinKey = powerLabel?.pinConnection;
                const targetPin = targetPinKey ? component.metadata.pins?.[targetPinKey] : null;

                wires.push({
                    id: `${component.id}-power`,
                    from: 'pico1.3V3_OUT',
                    to: `${component.id}.power`,
                    description: `${powerWire.label || 'Power 3.3V'} for ${component.id}`,
                    role: 'power',
                    color: powerWire.color || '#ff4444',
                    // Extended data for UI display
                    variableName: null,  // Power wires don't have a code variable
                    gpioPin: null,
                    componentPinName: targetPin?.name || targetPinKey || 'power',
                    componentPinDescription: targetPin?.description || null,
                    connectionGuide: targetPin?.connectionGuide || null
                });
            }
        }

        return wires;
    }

    /**
     * Generate wires for multi-pin components (US-100, TB6612, etc.)
     * @param {object} component - Resolved multi-pin component
     * @param {Array} wires - Array to add wires to
     * @param {Function} getNextGnd - Function to get next available GND pin
     */
    generateMultiPinWires(component, wires, getNextGnd) {
        const wireOrder = component.metadata.functionalGroup?.wireOrder || [];
        const wireLabels = component.metadata.functionalGroup?.wireLabels || {};
        const pinDefinitions = component.metadata.pins || {};
        const category = component.metadata.functionalGroup?.category;

        console.log(`[MicroPythonParser] Generating wires for multi-pin component: ${component.id}`);

        // Generate wires for each pin that was declared
        for (const pin of component.pins) {
            const pinRole = pin.pinRole;
            if (!pinRole) {
                console.warn(`[MicroPythonParser] Pin ${pin.variableName} has no role, skipping wire generation`);
                continue;
            }

            // Look up pin definition in component metadata
            const pinDef = pinDefinitions[pinRole];
            if (!pinDef) {
                console.warn(`[MicroPythonParser] No pin definition for role '${pinRole}' in ${component.type}`);
                continue;
            }

            // Determine wire properties based on pin type
            let wireRole = 'signal';
            let wireColor = '#ffcc00';  // Default signal color
            let wireLabel = pinDef.name || pinRole;

            // Check pin electrical type
            const electricalType = pinDef.electricalType;
            if (electricalType === 'power') {
                wireRole = 'power';
                wireColor = '#ff4444';
            } else if (electricalType === 'ground') {
                wireRole = 'ground';
                wireColor = '#333333';
            } else if (electricalType === 'input' || electricalType === 'output') {
                wireRole = 'signal';
                // Try to get color from wireLabels or wireOrder
                const labelInfo = wireLabels[pinRole] || wireLabels[wireLabel.toLowerCase()];
                if (labelInfo?.colorHint) {
                    wireColor = this.colorHintToHex(labelInfo.colorHint);
                } else {
                    // Assign colors based on pin role patterns
                    wireColor = this.getPinRoleColor(pinRole, pin.isPWM);
                }
            }

            // Build Pico pin name
            let picoPinName = `GP${pin.gpioPin}`;
            if (pin.isADC) {
                const adcChannel = pin.gpioPin - 26;
                picoPinName = `GP${pin.gpioPin}_ADC${adcChannel}`;
            }

            // Create wire with extended data for UI display
            wires.push({
                id: `${component.id}-${pinRole}`,
                from: `pico1.${picoPinName}`,
                to: `${component.id}.${pinRole}`,
                description: `${wireLabel} (GP${pin.gpioPin}) for ${component.id}`,
                role: wireRole,
                color: wireColor,
                pinRole: pinRole,
                // Extended data for UI display
                variableName: pin.variableName,
                gpioPin: pin.gpioPin,
                componentPinName: pinDef.name || pinRole,
                componentPinDescription: pinDef.description || null,
                connectionGuide: pinDef.connectionGuide || null
            });
        }

        // Add power wire if component needs it (sensors need 3.3V or 5V)
        const powerWire = wireOrder.find(w => w.role === 'power');
        if (powerWire && category === 'sensor') {
            const vccPin = pinDefinitions['vcc'];
            wires.push({
                id: `${component.id}-power`,
                from: 'pico1.3V3_OUT',
                to: `${component.id}.vcc`,
                description: `${powerWire.label || 'Power'} for ${component.id}`,
                role: 'power',
                color: powerWire.color || '#ff4444',
                // Extended data for UI display
                variableName: null,
                gpioPin: null,
                componentPinName: vccPin?.name || 'VCC',
                componentPinDescription: vccPin?.description || null,
                connectionGuide: vccPin?.connectionGuide || null
            });
        }

        // Add ground wire
        const groundWire = wireOrder.find(w => w.role === 'ground');
        if (groundWire) {
            const gndPin = pinDefinitions['gnd'];
            wires.push({
                id: `${component.id}-ground`,
                from: `pico1.${getNextGnd()}`,
                to: `${component.id}.gnd`,
                description: `${groundWire.label || 'Ground'} for ${component.id}`,
                role: 'ground',
                color: groundWire.color || '#333333',
                // Extended data for UI display
                variableName: null,
                gpioPin: null,
                componentPinName: gndPin?.name || 'GND',
                componentPinDescription: gndPin?.description || null,
                connectionGuide: gndPin?.connectionGuide || null
            });
        }

        // For motor drivers, add logic power (VCC) if not already present
        if (component.type === 'tb6612-motor-driver') {
            const logicPowerWire = wireOrder.find(w => w.role === 'logic-power');
            if (logicPowerWire) {
                const vccPin = pinDefinitions['vcc'];
                wires.push({
                    id: `${component.id}-vcc`,
                    from: 'pico1.3V3_OUT',
                    to: `${component.id}.vcc`,
                    description: `${logicPowerWire.label || 'Logic Power 3.3V'} for ${component.id}`,
                    role: 'power',
                    color: logicPowerWire.color || '#ff8800',
                    // Extended data for UI display
                    variableName: null,
                    gpioPin: null,
                    componentPinName: vccPin?.name || 'VCC',
                    componentPinDescription: vccPin?.description || null,
                    connectionGuide: vccPin?.connectionGuide || null
                });
            }
        }
    }

    /**
     * Convert color hint to hex color
     * @param {string} hint - Color hint from component metadata
     * @returns {string} Hex color code
     */
    colorHintToHex(hint) {
        const colorMap = {
            'red': '#ff4444',
            'orange': '#ff8800',
            'yellow': '#ffcc00',
            'green': '#33cc33',
            'blue': '#3388ff',
            'purple': '#9944ff',
            'black': '#333333',
            'white': '#ffffff',
            'any': '#ffcc00'
        };
        return colorMap[hint.toLowerCase()] || '#ffcc00';
    }

    /**
     * Get wire color based on pin role pattern
     * @param {string} pinRole - Pin role (e.g., 'trig', 'ain1', 'pwma')
     * @param {boolean} isPWM - Whether this is a PWM pin
     * @returns {string} Hex color code
     */
    getPinRoleColor(pinRole, isPWM) {
        const role = pinRole.toLowerCase();

        // PWM pins
        if (isPWM || role.startsWith('pwm')) {
            return '#9944ff';  // Purple for PWM
        }

        // Motor A control
        if (role.startsWith('ain') || role === 'motora1' || role === 'motora2') {
            return '#ffcc00';  // Yellow for Motor A
        }

        // Motor B control
        if (role.startsWith('bin') || role === 'motorb1' || role === 'motorb2') {
            return '#33cc33';  // Green for Motor B
        }

        // Ultrasonic trigger/echo
        if (role === 'trig' || role === 'trigger') {
            return '#ffcc00';  // Yellow for trigger
        }
        if (role === 'echo') {
            return '#33cc33';  // Green for echo
        }

        // Standby
        if (role === 'stby' || role === 'standby') {
            return '#ff8800';  // Orange for standby
        }

        // Default signal color
        return '#ffcc00';
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
            const componentData = {
                id: comp.id,
                type: comp.type,
                placement: {} // Empty - abstract layout handles positioning
            };

            // Handle multi-pin components
            if (comp.isMultiPin && comp.pins) {
                componentData.isMultiPin = true;
                componentData.picoConnections = comp.pins.map(pin => ({
                    pinRole: pin.pinRole,
                    gpioPin: pin.gpioPin,
                    pin: `GP${pin.gpioPin}`,
                    mode: pin.mode,
                    isPWM: pin.isPWM,
                    isADC: pin.isADC,
                    pullMode: pin.pullMode,
                    variableName: pin.variableName
                }));
            } else {
                // Single-pin component
                componentData.picoConnection = {
                    pin: `GP${comp.gpioPin}`,
                    mode: comp.mode,
                    isPWM: comp.isPWM,
                    isADC: comp.isADC,
                    pullMode: comp.pullMode
                };
            }

            components.push(componentData);
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
