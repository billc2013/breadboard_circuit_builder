# Breadboard Circuit Builder — Circuit Explorer

> An interactive web-based tool for visualizing MicroPython circuits as block diagrams, designed to help students learn electronics and robotics.

## Overview

The Circuit Explorer transforms annotated MicroPython code into interactive block diagrams showing how components connect to a Raspberry Pi Pico. Students paste MicroPython code, and the tool renders a conceptual visualization with functional groups, color-coded wires, and educational tooltips.

**Branch**: `explorer-only` — focused on the MicroPython → block diagram workflow. The guided wiring system is archived in `archive/guided-wiring/` for future restoration.

**Key Features:**
- **MicroPython Parser** — Paste annotated MicroPython code to visualize circuits:
  ```python
  # Single-pin components
  led = Pin(15, Pin.OUT)  # led-red-5mm
  button = Pin(14, Pin.IN, Pin.PULL_DOWN)  # button-tactile-6mm
  sensor = ADC(Pin(26))  # photocell-ldr

  # Multi-pin components (use :pinRole suffix)
  trig = Pin(2, Pin.OUT)   # us100-ultrasonic:trig
  echo = Pin(3, Pin.IN)    # us100-ultrasonic:echo
  ain1 = Pin(4, Pin.OUT)   # tb6612-motor-driver:ain1
  pwma = Pin(5, Pin.OUT)   # tb6612-motor-driver:pwma
  ```
- **Abstract slot-based layout** — Sensors at top, outputs at bottom, dynamically sized slots
- **Functional group highlighting** — Click a component to highlight its entire circuit (LED + resistor + wires + Pico pins)
- **Bezier curve wires** — Color-coded by role (signal, ground, power) from Pico pins to component groups
- **Educational tooltips** — Hover/click wires for connection details and circuit explanations
- **Auto-generated support components** — Resistors added automatically from component library metadata
- **Faded breadboard background** — Provides visual context without physical placement complexity

## Quick Start

### Prerequisites
- Modern web browser (Chrome, Safari, Firefox)
- Local web server (Python's http.server, Node's http-server, etc.)

### Running the Application

```bash
cd breadboard-circuit-builder

# Start a local web server
python3 -m http.server 8000

# Open http://localhost:8000
# (index.html redirects to circuit-explorer.html)
```

### Using the Explorer

1. Paste annotated MicroPython code into the sidebar panel
2. Click **Parse & Visualize**
3. Explore the block diagram:
   - Click functional group boundaries to highlight connected wires and Pico pins
   - Hover over wires to see connection details
   - Hover over Pico pins to see pin capabilities

## Supported Components

| Component | Type | Features |
|-----------|------|----------|
| **Raspberry Pi Pico** | Microcontroller | 40 interactive pins, PWM/ADC indicators |
| **LED (Red/Green/Blue/Yellow 5mm)** | Output | Auto-generates 220Ω current-limiting resistor |
| **Resistor (220Ω, 10KΩ)** | Passive | Auto-generated as support components |
| **Photocell (LDR)** | Sensor | Light-dependent resistor with voltage divider |
| **Push Button (STSP)** | Sensor | Momentary switch with pull-down resistor |
| **US-100 Ultrasonic** | Sensor | Multi-pin: Trigger/Echo, 5-pin |
| **TB6612 Motor Driver** | Output | Multi-pin: Dual H-bridge, 14 essential pins |

## Architecture

### Directory Structure

```
breadboard-circuit-builder/
├── index.html                  # Redirect to circuit-explorer.html
├── circuit-explorer.html       # Main application page
├── explorer-app.js             # Circuit Explorer application (~1,485 lines)
├── micropython-parser.js       # MicroPython code → circuit data (~860 lines)
├── abstract-layout.js          # Slot-based positioning system (~377 lines)
│
├── components/                 # Component library ("One Truth")
│   ├── library.json           # Master component index
│   ├── basic/                 # LEDs, resistors, buttons, photocells, sensors, motors
│   │   ├── led-red-5mm.json / -geometry.js / -adapter.js
│   │   ├── button-tactile-6mm.json / -geometry.js / -adapter.js
│   │   ├── photocell-ldr.json / -geometry.js / -adapter.js
│   │   ├── us100-ultrasonic.json / -geometry.js / -adapter.js
│   │   ├── tb6612-motor-driver.json / -geometry.js / -adapter.js
│   │   └── ...
│   └── microcontrollers/
│       ├── pico.json           # Pico pin metadata
│       └── pico-geometry.js    # PICO_PINS positions
│
├── components_svg/             # Fritzing SVG graphics
├── circuits/                   # Example circuits and MicroPython examples
├── styles/                     # CSS
│   ├── common.css
│   └── circuit-explorer.css
├── prompts/                    # LLM prompt templates
│
├── archive/                    # Archived for future restoration
│   └── guided-wiring/         # Guided wiring mode (17 files)
│       └── README.md          # Restoration instructions
│
└── docs/                       # Documentation
    └── mermaid_diagrams/       # Architecture analysis diagrams
```

### Data Flow: MicroPython → Visualization

```
MicroPython Code (with # component-type annotations)
    ↓ extractDeclarations() — Regex extraction
Declarations Array
    ↓ resolveComponent() — Library JSON lookup
Resolved Components
    ↓ generateSupportComponents() — From functionalGroup.requires
Support Components (resistors, etc.)
    ↓ generateWires() — From functionalGroup.wireOrder
Wires Array (with colors, roles, Pico pin endpoints)
    ↓ buildCircuitData()
Circuit Data Structure
    ↓ loadFromMicroPython() in explorer-app.js
    ↓ buildFunctionalGroupsFromParser()
    ↓ abstractLayout.calculateSlots()
    ↓ renderMicroPythonComponents() — SVG images in slots
    ↓ renderMicroPythonWires() — Bezier curves from Pico to groups
Interactive Block Diagram
```

### "One Truth" Component System

Component JSON files are the single source of truth. All behavior derives from metadata:

```
components/basic/led-red-5mm.json
    ↓
functionalGroup.category: "output"     → Slot positioning (bottom region)
functionalGroup.requires: [resistor]   → Auto-generate support components
functionalGroup.wireOrder: [...]       → Wire colors and roles
pins: {cathode, anode}                 → Electrical connections
rendering.breadboard.svg               → Visual representation
```

Adding a new component requires only:
1. Create `components/{category}/{name}.json` (metadata)
2. Create geometry JS + adapter JS files
3. Register in `components/library.json`
4. No changes to core application code

## Technical Stack

- **Vanilla JavaScript (ES6+)**: No frameworks, pure DOM manipulation
- **SVG**: All rendering (breadboard, components, wires)
- **JSON**: Component metadata and circuit definitions
- **CSS3**: Styling, animations, visual feedback
- **Fetch API**: Dynamic component loading

## Branch Information

### `explorer-only` (this branch)
Focused on the MicroPython → Circuit Explorer workflow. Created March 2026 from `Pin_and_component`.

**What was removed** (archived, not deleted):
- JSON circuit loading pipeline
- Guided wiring step-by-step system
- Physical breadboard layout code
- Circuit validation system
- `explorer-app.js` trimmed from 3,401 to ~1,485 lines (56% reduction)

**How to restore guided wiring:**
```bash
git checkout Pin_and_component -- <filename>
# Or see archive/guided-wiring/README.md for full list
```

### `Pin_and_component` / `main`
Full codebase with both Circuit Explorer and Guided Wiring modes.

## Known Limitations

- **Explorer only**: No guided wiring on this branch (archived for future restoration)
- **Pico is pre-rendered**: Fixed position, not dynamically placed
- **Desktop-optimized**: Touch devices don't support hover tooltips
- **Regex-based parser**: Handles standard `Pin()`, `PWM()`, `ADC()` patterns; complex MicroPython may not parse

## License and Attribution

Component graphics from [Fritzing](https://fritzing.org) are licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

## Educational Context

This tool is designed for introductory robotics and electronics education. Students:
1. Describe a circuit goal to an LLM ("Make an LED blink when I press a button")
2. LLM generates annotated MicroPython code (see `prompts/` for templates)
3. Student pastes code into Circuit Explorer
4. Tool visualizes the circuit as a block diagram with functional groups
5. Student explores connections: clicking groups highlights wires and Pico pins
6. Student builds understanding of circuit topology before physical assembly

---

**Last Updated**: March 2026
**Branch**: `explorer-only`
**Status**: MicroPython → Block Diagram Circuit Explorer
