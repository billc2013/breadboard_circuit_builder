/**
 * LLM-based MicroPython Parser
 *
 * Replaces regex-based extraction with an LLM call. The LLM analyzes
 * MicroPython code and returns structured declarations (component types,
 * GPIO pins, modes). Those declarations are then fed through the existing
 * MicroPythonParser pipeline (library lookup, support component generation,
 * wire generation) to produce the same circuitData the explorer expects.
 *
 * This means the LLM does NOT need to know about wire colors, resistor
 * requirements, or rendering — all of that still comes from the "One Truth"
 * component JSON files.
 */

class LLMParser {
    constructor() {
        this.micropythonParser = new MicroPythonParser();
        console.log('[LLMParser] Initialized LLM-based MicroPython parser');
    }

    /**
     * JSON schema for the LLM response.
     * The LLM returns declarations (what the regex parser used to extract)
     * plus optional analysis for user-facing messages.
     */
    static get JSON_SCHEMA() {
        return {
            type: 'object',
            properties: {
                declarations: {
                    type: 'array',
                    description: 'Each Pin/PWM/ADC declaration found in the code. One entry per hardware pin used.',
                    items: {
                        type: 'object',
                        properties: {
                            variableName: {
                                type: 'string',
                                description: 'The Python variable name (e.g. "led", "trig", "motor_pwm")'
                            },
                            gpioPin: {
                                type: 'integer',
                                description: 'GPIO pin number 0-28'
                            },
                            mode: {
                                type: 'string',
                                enum: ['OUT', 'IN'],
                                description: 'Pin direction: OUT for outputs/PWM, IN for inputs/ADC'
                            },
                            pullMode: {
                                type: ['string', 'null'],
                                enum: ['PULL_DOWN', 'PULL_UP', null],
                                description: 'Pull resistor mode, or null if not specified'
                            },
                            componentType: {
                                type: 'string',
                                enum: [
                                    'led-red-5mm', 'led-green-5mm', 'led-blue-5mm', 'led-yellow-5mm',
                                    'button-tactile-6mm', 'photocell-ldr',
                                    'us100-ultrasonic', 'tb6612-motor-driver'
                                ],
                                description: 'Component type from the library. Infer from context: LEDs are outputs, buttons are inputs with pull resistors, photocells use ADC, US-100 is ultrasonic sensor, TB6612 is motor driver.'
                            },
                            pinRole: {
                                type: ['string', 'null'],
                                description: 'For multi-pin components only. US-100 roles: "trig", "echo". TB6612 roles: "ain1", "ain2", "bin1", "bin2", "pwma", "pwmb", "stby". Null for single-pin components.'
                            },
                            isPWM: {
                                type: 'boolean',
                                description: 'True if declared with PWM() wrapper'
                            },
                            isADC: {
                                type: 'boolean',
                                description: 'True if declared with ADC() wrapper'
                            }
                        },
                        required: ['variableName', 'gpioPin', 'mode', 'pullMode', 'componentType', 'pinRole', 'isPWM', 'isADC'],
                        additionalProperties: false
                    }
                },
                analysis: {
                    type: 'object',
                    description: 'Human-readable analysis of the code for the student',
                    properties: {
                        summary: {
                            type: 'string',
                            description: 'One-sentence description of what the circuit does'
                        },
                        warnings: {
                            type: 'array',
                            description: 'Potential issues found in the code (wrong pin modes, missing components, etc.)',
                            items: {
                                type: 'object',
                                properties: {
                                    message: { type: 'string' },
                                    suggestion: { type: 'string' }
                                },
                                required: ['message', 'suggestion'],
                                additionalProperties: false
                            }
                        }
                    },
                    required: ['summary', 'warnings'],
                    additionalProperties: false
                }
            },
            required: ['declarations', 'analysis'],
            additionalProperties: false
        };
    }

    /**
     * System instructions for the LLM.
     * Tells it how to analyze MicroPython code and map hardware to our component library.
     */
    static get INSTRUCTIONS() {
        return `You are analyzing MicroPython code written for a Raspberry Pi Pico to identify electronic components and their GPIO connections.

Your job: extract every Pin(), PWM(Pin()), and ADC(Pin()) declaration and identify which physical component each one controls.

## Component identification rules

- **LEDs**: Pin(N, Pin.OUT) driving an LED. Pick color from context (variable name, comments) or default to led-red-5mm.
  Available: led-red-5mm, led-green-5mm, led-blue-5mm, led-yellow-5mm
- **Buttons**: Pin(N, Pin.IN) with PULL_DOWN or PULL_UP → button-tactile-6mm
- **Photocells/LDRs**: ADC(Pin(N)) reading a light sensor → photocell-ldr
- **US-100 Ultrasonic**: Two pins, trigger (OUT) and echo (IN) → us100-ultrasonic with pinRole "trig"/"echo"
- **TB6612 Motor Driver**: Multiple pins for motor control → tb6612-motor-driver with pinRoles "ain1","ain2","bin1","bin2","pwma","pwmb","stby"

## Important

- Only extract declarations that create hardware pin objects (Pin, PWM, ADC)
- If you cannot determine the component type, make your best guess from the variable name and usage context
- GPIO pins 26-28 can be used as ADC (analog) inputs
- PWM wraps a Pin for pulse-width modulation (servo control, LED brightness, motor speed)
- For multi-pin components (US-100, TB6612), each pin declaration gets its own entry with the same componentType but different pinRole
- Single-pin components (LEDs, buttons, photocells) should have pinRole set to null
- If the code has NO valid hardware declarations, return an empty declarations array`;
    }

    /**
     * Parse MicroPython code by sending it to the LLM, then running the
     * declarations through the existing MicroPythonParser pipeline.
     *
     * @param {string} code - MicroPython source code (no annotations needed)
     * @returns {Promise<{success: boolean, circuitData: object|null, errors: array, warnings: array}>}
     */
    async parse(code) {
        console.log('[LLMParser] Sending code to LLM for analysis...');

        // Step 1: Get declarations from LLM
        let llmResult;
        try {
            llmResult = await this._callLLM(code);
        } catch (error) {
            console.error('[LLMParser] LLM call failed:', error);
            return {
                success: false,
                circuitData: null,
                errors: [{
                    type: 'llm_error',
                    message: `LLM analysis failed: ${error.message}`,
                    suggestion: 'Check your network connection and try again'
                }],
                warnings: []
            };
        }

        console.log('[LLMParser] LLM returned declarations:', llmResult.declarations);
        console.log('[LLMParser] LLM analysis:', llmResult.analysis);

        if (!llmResult.declarations || llmResult.declarations.length === 0) {
            return {
                success: false,
                circuitData: null,
                errors: [{
                    type: 'no_declarations',
                    message: 'No hardware pin declarations found in the code',
                    suggestion: 'Make sure your code uses Pin(), PWM(), or ADC() to control components'
                }],
                warnings: llmResult.analysis?.warnings?.map(w => ({
                    type: 'llm_warning',
                    message: w.message,
                    suggestion: w.suggestion
                })) || []
            };
        }

        // Step 2: Feed declarations into MicroPythonParser pipeline
        // (resolveComponent, generateSupportComponents, generateWires, buildCircuitData)
        const parser = this.micropythonParser;

        // Ensure component library is loaded
        if (!parser.componentLibrary) {
            try {
                const response = await fetch('components/library.json');
                const data = await response.json();
                parser.componentLibrary = data.library;
            } catch (err) {
                return {
                    success: false,
                    circuitData: null,
                    errors: [{
                        type: 'library_load_error',
                        message: 'Failed to load component library',
                        detail: err.message
                    }],
                    warnings: []
                };
            }
        }

        // Reset parser state
        parser.errors = [];
        parser.warnings = [];

        // Add LLM warnings to parser warnings
        if (llmResult.analysis?.warnings) {
            for (const w of llmResult.analysis.warnings) {
                parser.warnings.push({
                    type: 'llm_warning',
                    message: w.message,
                    suggestion: w.suggestion
                });
            }
        }

        // Group multi-pin declarations (same logic as MicroPythonParser)
        const grouped = parser.groupMultiPinDeclarations(llmResult.declarations);

        // Resolve components against library
        const resolvedComponents = [];
        for (const decl of grouped) {
            const resolved = await parser.resolveComponent(decl);
            if (resolved) {
                resolvedComponents.push(resolved);
            }
        }

        if (resolvedComponents.length === 0) {
            return {
                success: false,
                circuitData: null,
                errors: parser.errors.length > 0 ? parser.errors : [{
                    type: 'no_components_resolved',
                    message: 'Could not resolve any components from the code'
                }],
                warnings: parser.warnings
            };
        }

        // Generate support components and wires
        const supportComponents = parser.generateSupportComponents(resolvedComponents);
        const wires = parser.generateWires(resolvedComponents);
        const circuitData = parser.buildCircuitData(resolvedComponents, supportComponents, wires);

        // Add LLM summary to circuit metadata
        if (llmResult.analysis?.summary) {
            circuitData.circuit.metadata.description = llmResult.analysis.summary;
        }

        console.log('[LLMParser] Circuit data built successfully:', circuitData);

        return {
            success: parser.errors.length === 0,
            circuitData,
            errors: parser.errors,
            warnings: parser.warnings
        };
    }

    /**
     * Call the LLM via a direct fetch to the Modal endpoint.
     * Duncan's endpoint returns a plain JSON response (not SSE streaming).
     * Response shape: { result: { ...schema fields }, usage: { ... } }
     * @param {string} code - MicroPython code to analyze
     * @returns {Promise<object>} Parsed JSON from the LLM
     * @private
     */
    async _callLLM(code) {
        const endpoint = window.APP_CONFIG?.MODAL_ENDPOINT_URL;
        if (!endpoint) {
            throw new Error('MODAL_ENDPOINT_URL is not configured — check config.js');
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code,
                model: 'gpt-5-nano',
                instructions: LLMParser.INSTRUCTIONS,
                json_schema: LLMParser.JSON_SCHEMA
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[LLMParser] Modal endpoint error:', response.status, errorText);
            throw new Error(`Modal endpoint returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('[LLMParser] Modal response:', data);

        // Duncan's endpoint wraps the LLM output in { result: { ... }, usage: { ... } }
        return data.result || data;
    }
}


// Export for use in browser
window.LLMParser = LLMParser;
