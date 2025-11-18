# Breadboard Circuit Builder

> An interactive web-based system for visualizing and validating breadboard circuits, designed to help students learn electronics and robotics through LLM-generated circuit designs.

## Overview

The Breadboard Circuit Builder is a proof-of-concept educational tool that renders physical breadboard circuits from JSON descriptions. Students can receive circuit designs from Large Language Models (like Claude or GPT-4) and immediately see them visualized on an interactive breadboard with the Raspberry Pi Pico microcontroller.

**Key Features:**
- Interactive breadboard visualization (400 holes with accurate positioning)
- Component rendering (LEDs, resistors, Raspberry Pi Pico, photocells)
- Automated circuit loading from JSON files
- 5-layer circuit validation system (in progress)
- Guided wiring workflow with step-by-step instructions
- Extensible component adapter architecture
- LLM-ready JSON schema

## Quick Start

### Prerequisites
- Modern web browser (Chrome, Safari, Firefox)
- Local web server (Python's http.server, Node's http-server, etc.)

### Running the Application

```bash
# Clone or download the repository
cd breadboard_circuit_builder

# Start a local web server
python3 -m http.server 8000

# Open in browser
# Navigate to http://localhost:8000
```

### Loading a Circuit

1. **From File**: Click "Load Circuit" → Select a JSON file from `circuits/` directory
2. **Manual Mode**: Click holes and Pico pins to create wires interactively
3. **Validation**: Use the "Circuit Validator" panel to check circuit correctness

## Current Capabilities

### Supported Components

| Component | Type | Features |
|-----------|------|----------|
| **Raspberry Pi Pico** | Microcontroller | 40 interactive pins, PWM indicators, pre-rendered |
| **LED (Red/Green/Blue/Yellow 5mm)** | Output | Polarity-aware, dynamic positioning, Fritzing graphics |
| **Resistor (220Ω, 10KΩ)** | Passive | Dynamic scaling, orientation-aware, color bands |
| **Photocell (LDR)** | Sensor | Light-dependent resistor, 2-pin placement |
| **Push Button (STSP)** | Sensor | Momentary - Single Throew Single Pole, 2-pin placement |

### Core Features

- **Accurate Hole Positioning**: 400 breadboard holes with correct spacing (8.982mm)
- **Power Rails**: 4 power rails (top/bottom power/ground) with 5-hole grouping
- **Bus Connectivity**: Automatic electrical bus definitions (5 holes per column)
- **Hole Occupation**: Physical enforcement (one component/wire per hole)
- **Wire Routing**: Click-to-click wire creation between any connection points
- **Guided Wiring**: Step-by-step wire placement with visual cues and LLM descriptions
- **Component Validation**: Pre-render checks for placement validity
- **Circuit Export**: Save current circuit state as JSON

### Validation System

5-layer validation architecture (in progress):
1. **Structural**: JSON schema validation
2. **Reference**: Component types and pin references
3. **Electrical**: Short circuits, bus conflicts, power-to-ground shorts
4. **Topology**: Complete paths, connectivity graphs
5. **Component-Specific**: PWM capability, polarity, electrical properties

## Architecture

### Directory Structure

```
breadboard_circuit_builder/
├── index.html                  # Main application
├── styles.css                  # UI styling
├── app.js                      # Core application logic
├── breadboard-data.js          # Breadboard geometry and coordinates
├── circuit-loader.js           # Circuit JSON parser and renderer
├── circuit-validator.js        # 5-layer validation system
├── guided-wiring.js            # Step-by-step wiring workflow
│
├── components/                 # Component library
│   ├── library.json           # Component registry
│   ├── basic/                 # LEDs, resistors, sensors
│   │   ├── button-tactile-6mm.json
│   │   ├── button-geometry.js
│   │   ├── button-adapter.js
│   │   ├── led-red-5mm.json
│   │   ├── led-red-5mm-geometry.js
│   │   ├── led-red-5mm-adapter.js
│   │   ├── led-green-5mm.json
│   │   ├── led-blue-5mm.json
│   │   ├── led-yellow-5mm.json
│   │   ├── led-5mm-adapter.js
│   │   ├── led-5mm-geometry.js
│   │   ├── resistor-220.json
│   │   ├── resistor-10k.json
│   │   ├── resistor-geometry.js
│   │   ├── resistor-adapter.js
│   │   ├── photocell.json
│   │   ├── photocell-geometry.js
│   │   └── photocell-adapter.js
│   └── microcontrollers/      # Development boards
│       └── pico.json
│
├── components_svg/             # Fritzing SVG graphics
│   ├── Half_breadboard56a.svg
│   ├── pico-breadboard.svg
│   ├── LED-5mm-red-leg.svg
│   ├── ldr.svg
│   └── resistor_220.svg
│   └── Pushbuttonc.svg
│
├── circuits/                   # Example circuits
│   └── *.json                 # Circuit definition files
│
├── prompts/                    # LLM prompt templates
│   └── llm_prompt_v*.md       # Instructions for LLMs
│
└── docs_archive/               # Historical documentation
    └── v1_poc_development/    # Zero-to-POC development docs
```

### Component Adapter Pattern

Each component implements a standardized adapter interface:

```javascript
class ComponentAdapter {
    validate(placement, breadboardHoles)
    calculatePosition(placement, breadboardHoles)
    getRequiredHoles(placement)
    async render(componentId, position, metadata)
}
```

**Benefits:**
- Add new components without modifying core code
- Each component is self-contained (geometry + metadata + adapter + SVG)
- Dynamic loading (only load adapters for components in use)
- Testable (adapters can be tested independently)

### Data Flow

```
Circuit JSON
    ↓
CircuitLoader parses structure
    ↓
Validator checks electrical rules
    ↓
ComponentAdapter dynamically loaded
    ↓
Geometry calculated from hole positions
    ↓
SVG rendered with transforms
    ↓
Holes marked as occupied
    ↓
Wires created between connection points
```

## LLM Integration

### Circuit JSON Schema

LLMs generate circuit descriptions in this format:

```json
{
  "circuit": {
    "metadata": {
      "name": "Night Light Circuit",
      "description": "Photocell-controlled LED with transistor switching"
    },
    "components": [
      {
        "id": "pico1",
        "type": "raspberry-pi-pico",
        "placement": { "position": { "x": 50, "y": 320 } }
      },
      {
        "id": "led1",
        "type": "led-red-5mm",
        "placement": { "cathode": "14E", "anode": "15E" }
      },
      {
        "id": "r1",
        "type": "resistor-220",
        "placement": { "pin0": "20J", "pin1": "25J" }
      }
    ],
    "wires": [
      {
        "id": "w1",
        "from": "pico1.GP0",
        "to": "20J",
        "description": "PWM signal from Pico to current-limiting resistor"
      },
      {
        "id": "w2",
        "from": "25J",
        "to": "14E",
        "description": "Resistor to LED cathode (negative)"
      },
      {
        "id": "w3",
        "from": "15E",
        "to": "pico1.GND_3",
        "description": "LED anode to ground, completing the circuit"
      }
    ]
  }
}
```

### LLM Prompts

See `prompts/` directory for detailed instructions to give LLMs:
- Component library reference
- Breadboard hole naming conventions
- Pico pin capabilities (GPIO, PWM, ADC)
- Electrical best practices
- JSON schema specification

## Extending the System

### Adding a New Component

1. **Create component metadata** (`components/category/component-name.json`):
   ```json
   {
     "component": {
       "metadata": {
         "id": "component-name",
         "name": "Friendly Name",
         "description": "What it does"
       },
       "properties": { /* electrical properties */ },
       "pins": { /* pin definitions */ }
     }
   }
   ```

2. **Create geometry file** (`components/category/component-name-geometry.js`):
   - Define SVG configuration (file, viewBox, connector positions)
   - Implement `calculatePosition()` function
   - Implement `validatePlacement()` function

3. **Create adapter class** (`components/category/component-name-adapter.js`):
   ```javascript
   class ComponentNameAdapter {
       validate(placement, breadboardHoles) { /* validation logic */ }
       calculatePosition(placement, breadboardHoles) { /* position calc */ }
       getRequiredHoles(placement) { /* hole list */ }
       async render(componentId, position, metadata) { /* rendering */ }
   }
   window.ComponentNameAdapter = ComponentNameAdapter;
   ```

4. **Register in library** (`components/library.json`):
   ```json
   {
     "component-name": {
       "metadata": "category/component-name.json",
       "geometry": "category/component-name-geometry.js",
       "adapter": "category/component-name-adapter.js",
       "adapterClass": "ComponentNameAdapter"
     }
   }
   ```

5. **Add Fritzing SVG** (if available) to `components_svg/`

6. **Test** with a circuit JSON file

**No changes to core code required!** The circuit loader automatically handles new components.

### Example Components to Add

- **Button/Switch**: 2-pin momentary push button
- **Ultrasonic Sensor (HC-SR04)**: 4-pin distance sensor
- **Servo Motor**: 3-pin PWM-controlled servo
- **Motor Controller (TB6612)**: H-bridge motor driver
- **Temperature Sensor (DHT11)**: Digital temp/humidity sensor
- **OLED Display**: I2C small display

## Technical Stack

- **Vanilla JavaScript (ES6+)**: No frameworks, pure DOM manipulation
- **SVG**: All rendering (breadboard, components, wires)
- **JSON**: Component metadata and circuit definitions
- **CSS3**: Styling, animations, and visual feedback
- **DOMParser**: SVG manipulation and Fritzing integration
- **Fetch API**: Dynamic module loading

### Design Patterns Used
- **Adapter Pattern**: Component rendering interface
- **Observer Pattern**: Hole occupation tracking
- **Strategy Pattern**: Dynamic geometry calculations
- **Factory Pattern**: Component adapter loading

## Browser Compatibility

- **Chrome 120+** (primary development platform)
- **Safari 17+** (tested)
- **Firefox 121+** (expected to work)

**Required Features:**
- ES6 modules
- Async/await
- Fetch API
- DOMParser
- SVG support
- CSS3 animations

## Known Limitations

This is a proof-of-concept system with intentional scope limitations:

- **No wire deletion**: Wires can be cleared all at once, not individually
- **No component deletion**: Components are permanent once placed
- **No undo/redo**: No action history
- **Simple wire routing**: Straight lines only (no Manhattan routing or pathfinding)
- **No drag-and-drop**: Components placed via JSON only
- **Pico is pre-rendered**: Not dynamically positioned from JSON
- **No real-time validation**: Validation runs on circuit load, not during manual editing

## License and Attribution

This project uses component graphics from [Fritzing](https://fritzing.org), which are licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

**Component Graphics:**
- Raspberry Pi Pico, Breadboard, LED, Resistor, Photocell graphics © Fritzing contributors

## Educational Context

This tool is designed for introductory robotics and electronics education. Students:
1. Describe a circuit goal to an LLM (e.g., "Make an LED blink")
2. LLM generates circuit JSON with component placement and connections
3. Student loads JSON into this tool
4. System validates circuit for electrical correctness
5. Student sees visual representation of breadboard assembly
6. Student uses guided wiring feature for step-by-step assembly
7. Student builds physical circuit following on-screen layout

## Contributing

### Development Setup

```bash
# Clone repository
git clone <repository-url>
cd breadboard_circuit_builder

# Start development server
python3 -m http.server 8000

# Open browser to http://localhost:8000
# Make changes to files
# Refresh browser to see changes
```

### Code Style
- Use ES6+ JavaScript features
- Prefer `const` over `let`, avoid `var`
- Use async/await over promises
- Comment complex algorithms and magic numbers
- Document SVG measurements with source references

### Testing
- Test with multiple browsers
- Validate all changes with example circuits
- Check console for errors/warnings
- Verify hole occupation enforcement
- Test component rendering at different scales

## Future Enhancements

See `DEVELOPMENT_TASKS.md` for detailed internal task tracking.

**High Priority:**
- JSON text input (paste from LLM without file upload)
- Component rendering refinements (alignment, stub length, label positions)
- Wire deletion with occupation cleanup
- Additional component library expansion

**Medium Priority:**
- Drag-and-drop component positioning
- Undo/redo system
- Manhattan routing for wires
- Component rotation support
- Real-time validation during manual editing

**Low Priority:**
- Multi-breadboard layouts
- Circuit simulation (LED brightness, motor speed)
- Code generation (MicroPython/CircuitPython)
- Bill of materials export

## Contact and Support

For questions, issues, or contributions, please refer to the project repository or contact the development team.

---

**Last Updated**: November 2025
**Status**: Proof of Concept Complete - Ready for Refinement and Extension
**Version**: 1.0-POC
