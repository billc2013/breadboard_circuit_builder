# Development Tasks & Future Work

> Internal task tracking for breadboard circuit builder POC refinement and expansion

**Last Updated**: December 12, 2025
**Current Phase**: Enhanced POC - MicroPython Parser, Abstract Layout System

---

## Recently Completed (December 2025 Sessions)

### ✅ MicroPython Parser for Circuit Explorer
**Completed**: December 12, 2025

**Goal**: Parse annotated MicroPython code to extract circuit information and visualize in Circuit Explorer mode WITHOUT requiring breadboard hole placements.

**What was delivered**:
- **MicroPython Parser** (`micropython-parser.js`):
  - Regex-based extraction of `Pin()`, `PWM()`, `ADC()` declarations
  - Inline comment annotations: `led = Pin(15, Pin.OUT)  # led-red-5mm`
  - Component resolution against library with validation
  - Auto-generation of support components (resistors) from `functionalGroup.requires`
  - Wire generation with proper roles (signal, power, ground) and colors
- **UI Integration** in `circuit-explorer.html`:
  - MicroPython input panel with code textarea
  - Parse & Visualize button
  - Error/success display with component/wire counts
- **Abstract Layout Rendering** (bypasses CircuitLoader):
  - `loadFromMicroPython()` directly uses `AbstractLayoutSystem`
  - `buildFunctionalGroupsFromParser()` creates groups from parsed data
  - `renderMicroPythonComponents()` places components in slots
  - `renderMicroPythonWires()` draws bezier curves from Pico to groups
  - No breadboard hole placements needed for conceptual visualization
  - Sensors at top, outputs at bottom

**Test Results**:
- LED + Button + Photocell circuit: 3 functional groups, 6 components, 8 wires ✓
- Sensors (button, photocell) positioned in top region ✓
- Output (LED) positioned in bottom region ✓
- Support resistors auto-generated and grouped with primaries ✓
- Wire colors follow component metadata wireOrder ✓

**Architecture Decision**:
The MicroPython parser generates circuit data that is intentionally **different** from the full JSON format used by CircuitLoader. For Explorer mode (conceptual visualization), we bypass CircuitLoader entirely and render directly using the abstract layout system. This is by design - Explorer mode doesn't need physical breadboard placements.

**Future Extension** (see Medium Priority section):
A separate system will be needed to generate **full breadboard-placement JSON** from MicroPython code, compatible with the guided wiring system. This would allow:
1. MicroPython code → Conceptual visualization (Explorer) ✓ COMPLETED
2. MicroPython code → Physical build instructions (Guided Wiring) → Future work

**Files created**: `micropython-parser.js`
**Files modified**: `circuit-explorer.html`, `styles/circuit-explorer.css`, `explorer-app.js`

---

### ✅ Abstract Layout System & Bus Format Parsing
**Completed**: December 11, 2025

**What was delivered**:
- **Abstract slot-based layout** (`abstract-layout.js`) for Circuit Explorer:
  - Canvas divided into sensor region (top) and output region (bottom)
  - Dynamic slot sizing based on group count (1 group: large centered, 2: side-by-side, 3+: smaller distributed)
  - Categories pulled from component library JSON metadata (`functionalGroup.category`)
  - Group-to-slot mapping for component positioning
- **Bus format wire parsing** in `explorer-app.js`:
  - Added `parseBusFormat()` to handle `Bus{column}{rowStart}-{rowEnd}` format (e.g., `Bus1J-F` → `1J`)
  - Added `normalizeEndpoint()` to unify both standard (`5C`) and Bus formats
  - Updated `findComponentForEndpoint()` and `wireEndpointOnBus()` to use normalization
- **Wire opacity fix**:
  - Removed inline `opacity: 0.9` that was overriding CSS classes
  - CSS now correctly controls opacity (`.bundled-wire` = 0.5, `.wire-active` = 1.0)
  - Group selection highlighting works properly
- **Debug logging cleanup**:
  - Removed excessive per-component traces from `parseBusFormat()`
  - Removed slot mapping and categorization logs from `abstract-layout.js`
  - Clean console output for production use

**Key Implementation Details**:
```javascript
parseBusFormat(endpoint) {
    const busMatch = endpoint.match(/^Bus(\d+)([A-J])-([A-J])$/i);
    if (!busMatch) return null;
    return `${busMatch[1]}${busMatch[2].toUpperCase()}`;
}

normalizeEndpoint(endpoint) {
    const busHole = this.parseBusFormat(endpoint);
    if (busHole) return busHole;
    if (/^\d+[A-J]$/i.test(endpoint)) return endpoint.toUpperCase();
    return null;
}
```

**Test Results**:
- Button-LED circuit: 2 functional groups (1 sensor, 1 output) ✓
- Traffic Light circuit: 5 functional groups (2 sensors, 3 outputs) ✓
- Sensors positioned at y=35, outputs at y=120 ✓
- Wire opacity correctly dims/brightens on group selection ✓

**Files modified**: `explorer-app.js`, `abstract-layout.js`

**Impact**: Complex circuits with Bus-format wire endpoints now render correctly in Circuit Explorer mode with proper functional group detection and visual feedback.

---

### ✅ Unified Circuit Explorer View
**Completed**: December 10, 2025

**What was delivered**:
- **Unified view** combining best elements: physical Pico with real pins, faded breadboard, always-visible wire labels
- **Functional group highlighting** - Click any component to highlight its entire functional group:
  - LED click → highlights LED + current-limiting resistor + all their wires + Pico pins
  - Button click → highlights button + pull-down resistor + all their wires + Pico pins
  - Support components (resistors) automatically detected via `functionalGroup.requires` metadata in component JSON
- **Always-visible wire labels** positioned near Pico pins (faded by default, bright when group highlighted)
- **Component click interaction** with visual feedback (glow effects, transitions)
- **Pico pin highlighting** when connected wires are selected
- **Info panel** showing functional group label and all components in group

**Key Implementation Details**:
- `detectFunctionalGroups()` reads `functionalGroup.requires` from component JSON metadata
- `componentToGroup` map enables any component in a group to highlight the whole group
- Bus connectivity detection finds support components sharing electrical connections with primary
- CSS transitions for smooth faded/bright label states

**Files modified**: `explorer-app.js`, `styles/circuit-explorer.css`

**Impact**: Students see circuits as conceptual units (LED Circuit, Button Input) rather than individual components, building better mental models

---

### ✅ Layout Engine Architecture (Archived for Future Use)
**Completed**: December 10, 2025 (then archived in favor of unified view)

**What was built**:
- Pluggable layout engine system with base class and registry
- `PhysicalLayoutEngine` - wrapper for breadboard-based positioning
- `HierarchicalLayoutEngine` - tree layout with Pico at center, functional groups branching outward
- `PicoAbstractRenderer` - simplified Pico representation for abstract view
- Bezier curve wire routing calculations
- Layout toggle UI (Physical | Abstract)
- View toggle UI (All Wires | Wire Groups)

**Decision**: Archived multi-view approach in favor of unified view that combines bezier wires + physical Pico + faded breadboard + always-visible labels. The layout engine code remains in `layouts/` directory for future exploration.

**Files created**: `layouts/layout-engine.js`, `layouts/layout-registry.js`, `layouts/physical-layout.js`, `layouts/hierarchical-layout.js`, `components/abstract/pico-abstract.js`

---

### ✅ Contextual Floating Wire Instruction Box
**Completed**: December 8, 2025

**What was delivered**:
- Floating instruction box positioned near wire endpoints (not fixed header)
- Progressive disclosure: SPACEBAR toggle to show/hide "why" explanations for each wire
- Smart bidirectional guidance: box repositions to guide toward whichever endpoint student hasn't clicked yet
- Arrow key repositioning with SVG coordinate logging for manual adjustment
- Visual feedback: pulsing endpoints, orange start marker, live preview wire
- Box automatically hides when guided wiring completes

**Files modified**: `index.html`, `styles.css`, `guided-wiring.js`

**Impact**: Reduced eye movement for students, contextual learning with "why" information invites deeper circuit topology understanding, more intuitive guidance system

---

### ✅ Multi-Circuit Panel Management System
**Completed**: December 8, 2025

**What was delivered**:
- Side panel system for managing multiple circuit configurations
- Add/edit/delete circuit panels with expandable/collapsible UI
- JSON editing directly in panel text areas
- Load circuits from files, save circuits to files
- Copy current breadboard state to any panel
- Wire completion indicators showing progress (⚡ pending, 🔌 X/Y in progress, ✓ complete)
- Auto-save wire data to active panel after each wire placement
- localStorage persistence for all circuit panels

**Files created**: `circuits-manager.js`
**Files modified**: `index.html`, `styles.css`

**Impact**: Students can practice with multiple "teaching" circuits before attempting full project circuit, seamless workflow with automatic progress saving, visual feedback on completion status

---

### ✅ Automatic Wire Progress Saving
**Completed**: December 8, 2025

**What was delivered**:
- System tracks which circuit panel is currently loaded on breadboard
- After each wire placement, complete wire data auto-saves to panel JSON
- Wire data includes: coordinates, waypoints, routing mode, description
- Students can reload circuits and see their placed wires persist
- No manual "Copy Current" needed - happens automatically
- Wire completion indicators update in real-time as wires are placed

**Files modified**: `circuits-manager.js`, `circuit-loader.js`, `guided-wiring.js`

**Impact**: No lost progress, students can switch between circuits freely, encourages experimentation without fear of losing work

---

### ✅ Component Hover Information System
**Completed**: December 8, 2025

**What was delivered**:
- Removed static component labels cluttering the breadboard
- Added interactive hover info boxes that appear next to components
- Info boxes show:
  - Component ID, type, and description
  - Pin placements with hole IDs
  - Electrical properties (voltage, current, resistance, power rating, color)
- Dynamic positioning next to hovered component
- Professional styling with blue border and shadow

**Files modified**: `index.html`, `styles.css`, `app.js`, all 4 component adapters

**Impact**: Cleaner interface, better user experience, comprehensive component information on demand

---

### ✅ Bus Reference System for Wire Endpoints
**Completed**: December 8, 2025

**What was delivered**:
- LLMs can now specify buses instead of exact holes for wires
- Format: `"Bus{column}{startRow}-{endRow}"` (e.g., "Bus9A-D")
- System automatically selects first available unoccupied hole in bus
- Occupation checking accounts for both components AND wires
- During guided wiring, users can click ANY hole in the specified bus
- Clear console feedback showing resolution (e.g., "Resolved Bus9A-D → 9C (4 holes in bus)")

**Files modified**: `breadboard-data.js` (added 5 new functions), `guided-wiring.js`

**Impact**: Reduced LLM precision requirements, fewer placement errors, more robust circuit generation

---

### ✅ Comprehensive Case-Insensitive System
**Completed**: December 8, 2025

**What was delivered**:
- All component types now case-insensitive: `led-yellow-5mm`, `LED-Yellow-5mm`, `LED-YELLOW-5MM` all work
- All hole references case-insensitive: `2E`, `2e`, `20J`, `20j` all work
- All bus references case-insensitive: `Bus9A-D`, `bus9a-d`, `BUS9A-D` all work
- Normalization happens automatically in circuit loader

**Files modified**: `breadboard-data.js`, `circuit-loader.js`

**Impact**: System robust to LLM output variations, reduced errors from capitalization inconsistencies

---

## High Priority Tasks

### 1. MicroPython Parser Testing & Refinement ⭐ NEXT

**Description**: Test the MicroPython parser with more complex circuits and edge cases.

**Test Cases Needed**:
- [ ] Multiple LEDs (different colors)
- [ ] PWM-controlled LED brightness
- [ ] Multiple sensors (button + photocell + potentiometer)
- [ ] Edge cases: duplicate variable names, invalid GPIO pins, unsupported components
- [ ] Error handling: malformed code, missing annotations

**Potential Improvements**:
- Better error messages with line numbers
- Support for multi-line comments
- Support for variable reassignment detection
- Warn about unused GPIO pins

**Priority**: HIGH - Needed before LLM prompt creation

---

### 2. LLM Prompt for Compliant MicroPython Code ⭐ NEXT

**Description**: Create a prompt that instructs an LLM (Claude, GPT-4) to generate MicroPython code that is compliant with our parser and component library.

**Prompt Requirements**:
- Explain the inline annotation format: `variable = Pin(N, Pin.MODE)  # component-type`
- List available component types from `components/library.json`
- Explain GPIO pin constraints (0-28, ADC on 26-28)
- Explain mode constraints (OUT for outputs, IN for sensors)
- Provide examples of valid code

**Deliverable**: `prompts/micropython-generator.md`

**Example Prompt Structure**:
```markdown
# MicroPython Code Generator for Circuit Explorer

You are generating MicroPython code for the Raspberry Pi Pico that will be
visualized in the Breadboard Circuit Builder's Circuit Explorer.

## Required Format
Each component declaration MUST include an inline comment with the component type:
```python
variable_name = Pin(gpio_number, Pin.MODE)  # component-type
```

## Available Components
- led-red-5mm, led-green-5mm, led-blue-5mm, led-yellow-5mm (outputs)
- button-tactile-6mm (sensor, use Pin.PULL_DOWN)
- photocell-ldr (sensor, use ADC)

## GPIO Pin Rules
- Digital pins: GP0-GP22
- ADC pins: GP26, GP27, GP28 (for analog sensors)
- ...
```

**Priority**: HIGH - Enables end-to-end workflow

---

### 3. Component Library Expansion: TB6612 Motor Controller ⭐ NEXT

**Description**: Add the TB6612 dual H-bridge motor controller to the component library.

**Component Details**:
- **Type ID**: `motor-controller-tb6612`
- **Pins**: 16 (VM, VCC, GND×3, AIN1, AIN2, PWMA, BIN1, BIN2, PWMB, STBY, A01, A02, B01, B02)
- **Category**: `output` (motor driver)
- **Fritzing SVG**: Available

**Files to Create**:
- `components/motors/tb6612.json` - Component metadata
- `components/motors/tb6612-geometry.js` - Position calculations
- `components/motors/tb6612-adapter.js` - Rendering adapter

**functionalGroup Metadata**:
```json
{
  "functionalGroup": {
    "groupLabel": "Motor Controller",
    "category": "output",
    "wireOrder": [
      { "role": "power", "color": "#ff4444", "label": "Motor Power (VM)" },
      { "role": "logic-power", "color": "#ff8800", "label": "Logic Power (VCC)" },
      { "role": "signal", "color": "#ffcc00", "label": "Control Signals" },
      { "role": "ground", "color": "#333333", "label": "Ground" }
    ]
  }
}
```

**Priority**: HIGH - Key robotics component

---

### 4. Component Library Expansion: US-100 Ultrasonic Sensor ⭐ NEXT

**Description**: Add the US-100 ultrasonic distance sensor to the component library.

**Component Details**:
- **Type ID**: `ultrasonic-us100`
- **Pins**: 5 (VCC, Trig/TX, Echo/RX, GND, GND)
- **Category**: `sensor` (distance)
- **Modes**: Trigger/Echo mode OR UART mode

**Files to Create**:
- `components/sensors/us100.json` - Component metadata
- `components/sensors/us100-geometry.js` - Position calculations
- `components/sensors/us100-adapter.js` - Rendering adapter

**functionalGroup Metadata**:
```json
{
  "functionalGroup": {
    "groupLabel": "Distance Sensor",
    "category": "sensor",
    "wireOrder": [
      { "role": "power", "color": "#ff4444", "label": "Power 5V" },
      { "role": "signal", "color": "#ffcc00", "label": "Trigger" },
      { "role": "signal", "color": "#33cc33", "label": "Echo" },
      { "role": "ground", "color": "#333333", "label": "Ground" }
    ]
  }
}
```

**Priority**: HIGH - Key robotics component

---

### 5. JSON Text Input Feature (COMPLETED)

**Description**: Add a text box/text area where users can paste circuit JSON directly from LLMs, eliminating the need to save as a file first.

**User Story**:
- User asks Claude/GPT-4 for a circuit design
- LLM responds with JSON in chat
- User copies JSON from chat
- User pastes into text box in our application
- User clicks "Load from Text" button
- Circuit renders immediately
- **Bonus**: User can edit JSON in the text box to make quick changes

**Benefits**:
- Faster workflow (no file save/upload step)
- Better LLM integration (stay in chat interface)
- Enables quick experimentation (edit and reload)
- Reduces friction for students

**Implementation Notes**:
```javascript
// Add to UI:
// - <textarea id="circuit-json-input"> (large, monospace font)
// - "Load from Text" button
// - "Copy Current Circuit" button (populate textarea with exported JSON)
// - Syntax highlighting (optional, use a lightweight lib like Prism.js)

// Validation:
// - Parse JSON, catch SyntaxError
// - Show line number of error
// - Highlight problematic line in textarea

// Integration:
// - Reuse existing circuit-loader.js loadCircuit() method
// - Add parseJSONFromText() wrapper
```

**Acceptance Criteria**:
- [x] Text area with monospace font
- [x] "Load from Text" button triggers circuit render
- [x] Clear error messages for invalid JSON (with line number)
- [x] "Copy Current Circuit" button exports to textarea
- [x] Textarea persists between loads (localStorage)
- [x] Tab key inserts tabs (not focus change)

**Priority**: HIGH - Significant UX improvement for LLM workflow

**Status**: ✅ **COMPLETED** - November 2025

---

### 2. Component Rendering Issues

**Description**: Document and fix various component rendering alignment and visual issues discovered during testing.

#### 2.1 Hole/Pin Alignment Issues

**Observed Problems**:
- [ ] Component legs don't always perfectly align with breadboard hole centers
- [ ] Some components slightly offset (< 1-2px) from intended position
- [ ] Rotation calculations occasionally off by small amounts

**Investigation Needed**:
- Check SVG viewBox vs actual connector positions in Fritzing files
- Verify breadboard hole spacing calculations (currently 8.982mm)
- Test with different browser zoom levels
- Measure actual vs expected positions in browser dev tools

**Files to Review**:
- `components/basic/*-geometry.js` (position calculations)
- `breadboard-data.js` (hole coordinate calculations)
- Each component's `calculatePosition()` function

#### 2.2 Component Stub Legs

**Observed Problems**:
- [ ] LED stubs sometimes too long (extend beyond hole)
- [ ] Resistor has no stubs (just SVG legs, may be too short)
- [ ] Stub visual style inconsistent between components
- [ ] Photocell stubs commented out (need to decide: keep or remove?)

**Decisions Needed**:
- Standard stub length? (currently LED uses 8px)
- Standard stub width/color?
- Which components need stubs vs just using SVG legs?
- Should stubs be slightly tapered (wider at body, narrower at hole)?

**Files to Review**:
- `components/basic/led-5mm-adapter.js` (stub implementation)
- `components/basic/photocell-adapter.js` (stubs commented out)
- `components/basic/resistor-adapter.js` (no stubs currently)

#### 2.3 Component Orientation Issues

**Observed Problems**:
- [ ] Some components don't flip properly when pin order is reversed
- [ ] Rotation angles sometimes off by 90° for vertical placements
- [ ] Resistor orientation calculation needs verification

**Known Fixed**:
- ✅ LED horizontal flip (working correctly)
- ✅ Resistor horizontal flip (fixed in latest session)

**Testing Needed**:
- Verify all components with reversed pin orders
- Test vertical orientations (rotation = 90°)
- Ensure polarity indicators stay correct after flip

**Files to Review**:
- All `*-geometry.js` files (`flipHorizontal` flag logic)
- All `*-adapter.js` files (transform application)

#### 2.4 Component Label Text Position

**Status**: ✅ **COMPLETED** - December 8, 2025

**Solution Implemented**: Interactive hover-based information system instead of static labels

**What was delivered**:
- Removed static component labels to eliminate clutter
- Implemented hover info boxes that appear next to components on mouseover
- Info boxes show comprehensive details:
  - Component ID, type, and description
  - Pin placements with hole IDs
  - Electrical properties (voltage, current, resistance, power rating, color)
- Dynamic positioning next to hovered component
- Professional styling with blue border and shadow

**Files Modified**:
- `index.html` - Added component info box HTML
- `styles.css` - Added info box styling
- `app.js` - Added showComponentInfo() and hideComponentInfo() methods
- All 4 component adapters - Removed static labels, added hover listeners

**Outcome**: Cleaner interface with comprehensive information available on demand

---

## Medium Priority Tasks

### 3. MicroPython to Guided Wiring JSON Generation ⭐ FUTURE

**Description**: Extend the MicroPython parser to generate **full breadboard-placement JSON** compatible with the Guided Wiring system, just like LLM-generated circuits.

**Context**:
Currently, we have two circuit input paths:
1. **LLM-generated JSON** → Full placement data → Works with both Explorer AND Guided Wiring
2. **MicroPython Parser** → Abstract data (no placements) → Works with Explorer only

**Goal**: Add a third capability:
3. **MicroPython Parser + Layout Generator** → Full placement data → Works with BOTH modes

**User Story**:
- Student writes MicroPython code for their project
- Student can visualize conceptually in Explorer (current work)
- Student can ALSO generate a buildable circuit with physical hole placements
- Generated JSON is identical in format to LLM-generated circuits
- Student uses Guided Wiring mode to build the physical circuit

**Technical Approach**:
```
MicroPython Code
      ↓
[MicroPythonParser] → Parsed components + wires (abstract)
      ↓
[BreadboardLayoutGenerator] → Assigns physical hole placements
      ↓
Full Circuit JSON (compatible with CircuitLoader + Guided Wiring)
```

**Layout Algorithm Considerations**:
- Assign breadboard columns based on functional groups
- Sensors on left side, outputs on right side (or configurable)
- Auto-route wires avoiding conflicts
- Respect electrical rules (bus connectivity, no shorts)
- Consider component physical sizes

**Key Design Principle** ("One Truth"):
- The component library JSON (`functionalGroup.requires`, `pins`, etc.) should drive ALL placement decisions
- Same metadata used for Explorer visualization AND guided wiring generation
- No duplication of component knowledge

**Acceptance Criteria**:
- [ ] `BreadboardLayoutGenerator` class that takes parsed MicroPython data
- [ ] Generates valid `placement` objects for all components
- [ ] Generates wire endpoints with actual hole IDs (not abstract like `led.signal`)
- [ ] Output JSON passes CircuitLoader validation
- [ ] Works in Guided Wiring mode for step-by-step building

**Priority**: MEDIUM - Important for complete MicroPython workflow, but Explorer visualization is the first step

---

### 4. Component Library Expansion

**Candidates for Next Components**:

#### 3.1 Ultrasonic Sensor (HC-SR04)
- **Fritzing available**: Yes
- **Pins**: 4 (VCC, Trig, Echo, GND)
- **Complexity**: Medium (4-pin + larger physical size)
- **Use case**: Distance measurement, robotics

#### 3.2 Two Motor Controller (TB6612 - Adafruit)
- **Fritzing available**: Yes
- **Pins**: 16 (Power: VM, VCC, 3×GND | Signal: AIN1, AIN2, PWMA, BIN1, BIN2, PWMB, STBY | Motor Out: A01, A02, B01, B02)
- **Complexity**: Medium++ (16-pin + larger physical size)
- **Use case**: Dual H-Bridge for powering and controlling speed and direction of two DC motors independently

#### 3.3 Potentiometer (Variable Resistor)
- **Fritzing available**: Yes
- **Pins**: 3 (wiper + 2 ends)
- **Complexity**: Medium (3-pin placement)
- **Use case**: Analog input, voltage divider




**Implementation Pattern**:
For each component:
1. Find/create Fritzing SVG
2. Create `component-name.json` metadata
3. Create `component-name-geometry.js`
4. Create `component-name-adapter.js`
5. Add to `library.json`
6. Create test circuit JSON
7. Test rendering and validation

---

### 4. Wire Management Improvements

#### 4.1 Individual Wire Deletion
**Current**: Clear all wires at once
**Desired**: Click wire to select, then delete

**Implementation**:
- Make wire lines clickable
- Show selection highlight (thicker stroke, different color)
- Add "Delete Selected Wire" button
- Clear hole occupation for deleted wire endpoints
- Update wire IDs/numbering after deletion

#### 4.2 Wire Editing
**Current**: Wires are permanent once created
**Desired**: Drag wire endpoints to different holes

**Implementation**:
- Click wire endpoint to enter edit mode
- Drag to new hole (show preview)
- Validate new connection
- Update wire coordinates
- Update hole occupation (free old hole, mark new hole)

#### 4.3 Wire Styling
**Current**: All wires red, 2px width
**Desired**: Color-coded wires based on function

**Ideas**:
- Power wires: Red
- Ground wires: Black
- Signal wires: Yellow, green, blue (rotating)
- User-selectable wire colors
- Store color in wire JSON

---

### 5. Validation Enhancements

#### 5.1 Real-Time Validation
**Current**: Validation runs only on circuit load
**Desired**: Validation updates as user modifies circuit

**Implementation**:
- Run validation after each wire added
- Show errors/warnings in a persistent panel
- Highlight problematic components/wires in red
- Update as issues are resolved

#### 5.2 Voltage/Current Calculations
**Current**: No electrical calculations
**Desired**: Warn about over-current, under-voltage

**Implementation**:
- Calculate voltage drops across resistors
- Calculate current through LEDs
- Check power dissipation in resistors
- Warn if LED current too high (>20mA typical)
- Warn if resistor power exceeds rating

**Complexity**: High (requires circuit solver, Ohm's law)

#### 5.3 Component Compatibility Checking
**Current**: No checks for component compatibility
**Desired**: Warn about incompatible component combinations

**Examples**:
- 5V supply with 3.3V sensor (damage risk)
- No current-limiting resistor with LED
- Motor connected directly to GPIO (needs driver)
- I2C devices without pull-up resistors

---

## Low Priority Tasks

### 6. User Experience Improvements

#### 6.1 Undo/Redo System
- Track action history (wire additions, component placements)
- Undo button (Ctrl+Z)
- Redo button (Ctrl+Y)
- Max history depth (e.g., 20 actions)

#### 6.2 Drag-and-Drop Component Placement
- Drag components from palette onto breadboard
- Snap to valid hole positions
- Visual preview during drag
- Update JSON automatically

#### 6.3 Breadboard/Pico Repositioning
- Allow drag-and-drop of entire breadboard SVG
- Allow drag-and-drop of Pico board
- Update all coordinates automatically
- Persist positions in localStorage

#### 6.4 Zoom and Pan
- Mouse wheel zoom
- Click-drag pan
- Reset view button
- Zoom to fit all components

#### 6.5 Keyboard Shortcuts
- `Ctrl+S`: Export circuit JSON
- `Ctrl+L`: Load circuit
- `Ctrl+Z`: Undo
- `Ctrl+Y`: Redo
- `Delete`: Delete selected wire/component
- `Escape`: Cancel current action

---

### 7. Advanced Features

#### 7.1 Manhattan Wire Routing
- Auto-route wires with 90° angles only
- Pathfinding algorithm (A* or Dijkstra)
- Avoid component bodies
- Show wire routing preview before commit

#### 7.2 Circuit Simulation
- Simulate LED brightness (based on current)
- Simulate motor speed (based on PWM duty cycle)
- Interactive simulation controls (start/stop/step)
- Show voltage/current on wires (on hover)

#### 7.3 Code Generation
- Generate MicroPython code from circuit
- Generate CircuitPython code
- Include pin definitions, setup, and basic loop
- Copy to clipboard button

#### 7.4 Multi-Breadboard Layouts
- Support multiple breadboards in one circuit
- Connect between breadboards with wires
- Position breadboards relative to each other
- Useful for complex projects

#### 7.5 Bill of Materials (BOM) Export
- List all components used
- Include quantities
- Include part numbers/supplier links
- Export as CSV, PDF, or HTML

---

## Task Prioritization Guidelines

**P0 (Critical)**: Blocks core functionality, user-facing bugs
**P1 (High)**: Significant UX improvements, high user demand
**P2 (Medium)**: Nice to have, improves experience
**P3 (Low)**: Future enhancements, exploration

**Current P1 Tasks (Next Session Focus)**:
1. ✅ Archive old documentation
2. ✅ Create new README.md
3. ✅ Create this DEVELOPMENT_TASKS.md
4. ✅ JSON text input feature (Completed November 2025)
5. ✅ Component hover information system (Completed December 8, 2025)
6. ✅ Bus reference system for wires (Completed December 8, 2025)
7. ✅ Case-insensitive system (Completed December 8, 2025)
8. Component rendering issue investigation/fixes (Ongoing - see section 2)
9. Consider adding button component (✅ Completed - button already in library)

---

## Notes for Contributors

### Before Starting a Task
1. Check if task is still relevant (some may be completed)
2. Review related files listed in task description
3. Create a branch: `feature/task-name` or `fix/issue-name`
4. Update this file to mark task as "In Progress"

### While Working
1. Follow code style guidelines in README.md
2. Test changes thoroughly
3. Add comments explaining complex logic
4. Update relevant documentation

### Before Committing
1. Test with multiple circuits
2. Check console for errors/warnings
3. Verify no regression in existing features
4. Update this file to mark task as "Completed"
5. Cross off [ ] checkboxes in task description

### Commit Message Format
```
[Category] Brief description

- Detailed change 1
- Detailed change 2

Fixes: #issue-number (if applicable)
Relates to: DEVELOPMENT_TASKS.md section X.Y
```

**Examples**:
- `[Feature] Add JSON text input for circuit loading`
- `[Fix] Correct LED stub alignment with breadboard holes`
- `[Docs] Add component developer guide`
- `[Refactor] Extract wire rendering to separate module`

---

**Remember**: This is a living document. Update it as tasks are completed, new issues are discovered, or priorities change.
