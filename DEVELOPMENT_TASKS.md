# Development Tasks & Future Work

> Internal task tracking for breadboard circuit builder POC refinement and expansion

**Last Updated**: March 12, 2026
**Current Phase**: Explorer-Only Branch — LLM-Based MicroPython → Block Diagram Visualization
**Branch**: `explorer-only` (created from `Pin_and_component`)

---

## Recently Completed (March 12, 2026 Session)

### ✅ LLM-Based Parser — Replace Regex Extraction with LLM Call
**Completed**: March 12, 2026

**Goal**: Replace the regex-based MicroPython parser (which required `# component-type` inline annotations) with an LLM call that can analyze any MicroPython code and infer component types automatically.

**What was delivered**:

**1. `llm-micropython-parser.js` — LLMParser class**
- Sends MicroPython code to Modal serverless endpoint (Duncan Johnson's infrastructure)
- LLM returns structured JSON declarations: component types, GPIO pins, modes, pin roles
- Declarations feed into existing `MicroPythonParser` pipeline (resolve → support components → wires → circuitData)
- JSON schema with `strict: true` enforces structured output (OpenAI Structured Outputs)
- System instructions guide component identification from code context
- LLM also returns `analysis.summary` and `analysis.warnings` for student-facing messages

**2. `llmResponse.js` — Streaming utility (kept for future use)**
- Originally designed for SSE streaming; Modal endpoint returns plain JSON
- `_callLLM()` in LLMParser makes direct fetch instead

**3. `config.js` — Runtime configuration (gitignored)**
- Holds `window.APP_CONFIG.MODAL_ENDPOINT_URL`
- Replaces `.env.local` + Vite pattern (project doesn't use a bundler)

**4. `circuit-explorer.html` — Updated script loading**
- Loads 6 scripts: `config.js`, `pico-geometry.js`, `abstract-layout.js`, `micropython-parser.js`, `llm-micropython-parser.js`, `llmResponse.js`, `explorer-app.js`

**5. `explorer-app.js` — `loadFromLLMCall()` replaces `loadFromMicroPython()`**
- Parse button calls `loadFromLLMCall()` which instantiates `LLMParser`
- Old `loadFromMicroPython()` commented out but preserved

**Architecture Decision**: The LLM only replaces the regex extraction step. All component metadata, wire colors, support component generation, and rendering still derive from the "One Truth" component JSON files. This means the LLM doesn't need to know about rendering internals — it just identifies what's in the code.

**Test Results**:
- LED blink (single component, no annotations): ✓ — LED Circuit with auto-generated resistor
- Wall-follower (complex, 3 functional groups, no annotations): ✓ — Distance Sensor + LED Circuit + Motor Controller, 4 components, 15 wires

**Files created**: `llm-micropython-parser.js`, `llmResponse.js`, `config.js`
**Files modified**: `circuit-explorer.html`, `explorer-app.js`, `.gitignore`

---

## Previously Completed (March 3, 2026 Session)

### ✅ Explorer-Only Branch: Codebase Cleanup & Streamlining
**Completed**: March 3, 2026

**Goal**: Create a focused branch containing only the MicroPython → Circuit Explorer workflow, archiving the guided wiring system for future restoration.

**What was delivered**:

**1. Archived 17 guided wiring files** to `archive/guided-wiring/`:
- `guided-wiring.html`, `guided-wiring.js`, `guided-app.js`, `guided-wiring.css`
- `circuit-loader.js`, `circuit-explorer.js`, `circuits-manager.js`
- `circuit-validator.js`, `validator-panel-ui.js`, `breadboard-data.js`
- `app.js`, `json-text-input.js`, `components-library.js`, `styles.css`
- `test-validator.html`, `test-validator.js`
- `index.html` (archived as `index-landing.html`)
- Created `archive/guided-wiring/README.md` with restoration instructions

**2. Trimmed `explorer-app.js`** from 3,401 → 1,485 lines (56% reduction):
- Removed entire JSON loading pipeline (`loadCircuit`, `categorizeWires`, `detectFunctionalGroups`, etc.)
- Removed physical layout methods (`calculateGroupPositions`, `renderGroupBoundaries`, etc.)
- Removed legacy rendering (`renderHoles`, `createWire`, `renderWire`, `renderWireLabels`)
- Removed component interaction for JSON mode, filter listeners
- Removed 6 compatibility stub global functions
- Simplified `findComponentConnectionGuide`, `handleComponentClick`, `getComponentDisplayName`
- Renamed ambiguous methods: `loadComponentMetadata` → `loadPicoMetadata` / `loadComponentMetadataByType`

**3. Cleaned up `circuit-explorer.html`**:
- Removed 4 script tags (`breadboard-data.js`, `circuit-loader.js`, `circuit-explorer.js`, `circuits-manager.js`)
- Removed "Circuits (JSON)" sidebar panel
- Removed "Back to mode selection" link
- Remaining scripts: `pico-geometry.js`, `abstract-layout.js`, `micropython-parser.js`, `explorer-app.js`

**4. Created `index.html`** as simple redirect to `circuit-explorer.html`

**5. Updated README.md and CLAUDE.md** for branch context

**Commits**: 5 commits on `explorer-only` branch (archive → trim → HTML cleanup → bug fix → docs)

**Files modified**: `explorer-app.js`, `circuit-explorer.html`, `index.html`, `README.md`, `CLAUDE.md`
**Files archived**: 17 files moved to `archive/guided-wiring/`

---

### ✅ Fix: ADC-Capable Pin Wire Routing
**Completed**: March 3, 2026

**Problem**: When using `Pin(26, Pin.OUT)` (GPIO 26 as digital output), the signal wire rendered to the center of the Pico instead of the correct GP26 pin position. Same issue affected GP27 and GP28.

**Root Cause**: `pico-geometry.js` registers ADC-capable pins as `GP26_ADC0`, `GP27_ADC1`, `GP28_ADC2`. The MicroPython parser generates `pico1.GP26` (without ADC suffix) when pins are used as digital GPIO. The exact-match lookup in `renderMicroPythonWireBundle` failed, falling back to the default center position `(50, 100)`.

**Fix**: Added prefix-match fallback in two places in `explorer-app.js`:
1. Wire endpoint rendering (line ~1342): `picoPins.find(p => p.pinKey.startsWith(pinName + '_'))`
2. Pin highlighting (line ~360): `querySelector('[data-pin-id^="pico1.${pinName}_"]')`

**Files modified**: `explorer-app.js`

---

### Known Issues (explorer-only branch)

| Issue | Severity | Description |
|-------|----------|-------------|
| Wire count display | Minor | "Wires: 0" in bottom-left doesn't update when loading via MicroPython |
| `layouts/` directory | Cleanup | Contains archived layout engine code not loaded by any script; could be moved to archive |

---

## Recently Completed (December 2025 Sessions)

### ✅ US-100 Ultrasonic Sensor & TB6612 Motor Driver Components
**Completed**: December 11, 2025

**What was delivered**:
- **US-100 Ultrasonic Sensor** (`us100-ultrasonic`):
  - 5 pins: VCC, Trig, Echo, GND, GND2
  - Supports both Trigger/Echo mode and UART mode
  - Functional group category: "sensor" with groupLabel "Distance Sensor"
  - Wire colors: Yellow (trigger), Green (echo)
  - Files: `components/basic/us100-ultrasonic.json`, `us100-geometry.js`, `us100-adapter.js`
  - SVG: `components_svg/US-100_ultrasonic-distance-sensor.svg`

- **TB6612 Dual Motor Driver** (`tb6612-motor-driver`):
  - 14 essential pins for 2-motor control: VM, VCC, GND, STBY, AIN1, AIN2, PWMA, BIN1, BIN2, PWMB, MotorA1/2, MotorB1/2
  - Functional group category: "output" with groupLabel "Motor Controller"
  - Wire colors: Yellow (Motor A signals), Green (Motor B signals), Purple (PWM), Orange (standby)
  - Files: `components/basic/tb6612-motor-driver.json`, `tb6612-geometry.js`, `tb6612-adapter.js`
  - SVG: `components_svg/tb6612-motor-driver.svg`

- **Library Registration**: Both components added to `components/library.json`

---

### ✅ Multi-Pin Component Support in MicroPython Parser
**Completed**: December 11, 2025

**Goal**: Enable the MicroPython parser to handle complex components like US-100 and TB6612 that require multiple Pin declarations.

**What was delivered**:
- **Enhanced annotation format**: `variable = Pin(N, Pin.MODE)  # component-type:pinRole`
  - The `:pinRole` suffix identifies which pin of a multi-pin component this declaration represents
  - Example: `trig = Pin(2, Pin.OUT)  # us100-ultrasonic:trig`
- **Pin grouping logic** (`groupMultiPinDeclarations()`):
  - Groups multiple Pin declarations by component type
  - Creates single component instances with all pins collected
  - Maintains `multiPinComponents` Set for types that need grouping
- **Wire generation for multi-pin components** (`generateMultiPinWires()`):
  - Uses component metadata to determine wire properties
  - Applies correct colors based on pin role (getPinRoleColor helper)
  - Generates wires from Pico to each pin of the grouped component
- **Color scheme by pin role**:
  - Motor A signals (ain1, ain2, motora1, motora2): Yellow (#ffcc00)
  - Motor B signals (bin1, bin2, motorb1, motorb2): Green (#33cc33)
  - PWM signals (pwma, pwmb): Purple (#9933ff)
  - Trigger: Yellow (#ffcc00)
  - Echo: Green (#33cc33)
  - Standby/Logic power: Orange (#ff8800)
  - Power: Red (#ff4444)
  - Ground: Dark gray (#333333)

**Test Results** (wall-follower.py):
- 9 raw Pin declarations → 2 grouped components (US-100 + TB6612)
- 13 wires generated with correct colors
- Functional groups detected: "Distance Sensor" (sensor), "Motor Controller" (output)

**Example MicroPython Code**: `circuits/micropython_examples/wall-follower.py`

**Files modified**: `micropython-parser.js`

---

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

## High Priority Tasks (explorer-only branch)

### 1. LLM Parser Testing & Edge Cases ⭐ NEXT

**Description**: Test the LLM-based parser with various circuits and edge cases.

**Test Cases Needed**:
- [x] Single LED (led_blink.py) — verified March 12
- [x] Complex multi-component (wall-follower with US-100 + TB6612 + LED) — verified March 12
- [ ] Multiple LEDs (different colors)
- [ ] PWM-controlled LED brightness
- [ ] Multiple sensors (button + photocell)
- [ ] Edge cases: unsupported components, ambiguous variable names
- [ ] Error handling: code with no hardware declarations, non-MicroPython code
- [ ] ADC pins used as digital GPIO (GP26-28 with Pin.OUT)

**Potential Improvements**:
- Update panel text to remove "component annotations" instruction (no longer needed)
- Display LLM analysis summary to students
- Show LLM warnings in the UI
- Fix wire count display ("Wires: 0" doesn't update)
- Add loading spinner/progress during LLM call
- Handle LLM timeout gracefully

**Priority**: HIGH

---

### 2. LLM Prompt for Compliant MicroPython Code ✅ COMPLETED

**Completed**: March 3, 2026

**Deliverable**: `prompts/micropython-generator.md`

Covers all 10 component types, annotation format (single-pin and multi-pin `:pinRole`), GPIO pin rules, auto-generated support components, and 5 complete examples (LED blink, button LED, night light, traffic light, wall-follower).

---

### 3. MicroPython Parser Warning Cleanup

**Description**: Clean up console warnings and deprecation notices in the MicroPython parser.

**Tasks**:
- [ ] Review all console.warn() calls in `micropython-parser.js`
- [ ] Remove or consolidate redundant warnings
- [ ] Add a debug mode flag to control verbose logging
- [ ] Remove any unused helper functions or code paths
- [ ] Test parser still works correctly after cleanup

**Priority**: HIGH - Code cleanup for maintainability

---

### 4. Component Rendering Issues

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

### 3. MicroPython to Guided Wiring JSON Generation ⭐ DEFERRED

**Status**: Deferred — requires guided wiring system (archived on this branch)

**Description**: Extend the MicroPython parser to generate **full breadboard-placement JSON** compatible with the Guided Wiring system. This would enable:
1. MicroPython code → Conceptual visualization (Explorer) ✅ COMPLETED
2. MicroPython code → Physical build instructions (Guided Wiring) → Future work

**To resume**: Restore guided wiring from `archive/guided-wiring/` or work on `Pin_and_component` branch.

**Priority**: MEDIUM - Deferred on `explorer-only`, relevant when guided wiring is re-integrated

---

### 4. Component Library Expansion

**Candidates for Next Components**:

#### 4.1 Potentiometer (Variable Resistor)
- **Fritzing available**: Yes
- **Pins**: 3 (wiper + 2 ends)
- **Complexity**: Medium (3-pin placement)
- **Use case**: Analog input, voltage divider

#### 4.2 Servo Motor
- **Fritzing available**: Yes
- **Pins**: 3 (signal, power, ground)
- **Complexity**: Low-Medium (3-pin, PWM control)
- **Use case**: Robotics, precise position control

#### 4.3 DHT11 Temperature/Humidity Sensor
- **Fritzing available**: Yes
- **Pins**: 3-4 (data, power, ground, optional NC)
- **Complexity**: Medium (single-wire protocol)
- **Use case**: Environmental monitoring

**Recently Completed**:
- ✅ Ultrasonic Sensor (US-100) - December 11, 2025
- ✅ Motor Controller (TB6612) - December 11, 2025




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
1. MicroPython parser testing with edge cases (ADC-as-digital, multi-LED, PWM)
2. ~~LLM prompt for compliant MicroPython code generation~~ ✅ `prompts/micropython-generator.md`
3. Fix wire count display (currently stays "Wires: 0" after MicroPython load)
4. Parser warning cleanup (reduce verbose console output)

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
