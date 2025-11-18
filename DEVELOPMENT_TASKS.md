# Development Tasks & Future Work

> Internal task tracking for breadboard circuit builder POC refinement and expansion

**Last Updated**: November 2025
**Current Phase**: POC Refinement & Expansion

---

## High Priority Tasks

### 1. JSON Text Input Feature ⭐ NEW

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

**Observed Problems**:
- [ ] No component labels currently rendered (ID, type, value)
- [ ] Need to decide: show labels by default or on hover?
- [ ] Where to position labels? (above component, below, to side?)
- [ ] Label text size/style for different components?

**Decisions Needed**:
- Show component ID? (e.g., "R1", "LED1")
- Show component value? (e.g., "220Ω", "Red LED")
- Toggle visibility? (button to show/hide all labels)
- Collision detection? (prevent labels from overlapping)

**Implementation Ideas**:
```javascript
// In adapter render():
createComponentLabel(componentId, metadata, position) {
    const label = document.createElementNS(SVG_NS, 'text');
    label.textContent = `${componentId} (${metadata.properties.value})`;
    label.setAttribute('x', position.centerX);
    label.setAttribute('y', position.centerY - 15);  // Above component
    label.setAttribute('class', 'component-label');
    return label;
}
```

**Files to Create/Modify**:
- `styles.css` (add `.component-label` styling)
- All `*-adapter.js` files (add label creation)
- `app.js` (add "Toggle Labels" button)

---

## Medium Priority Tasks

### 3. Component Library Expansion

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
4. JSON text input feature
5. Component rendering issue investigation/fixes
6. Consider adding button component (high demand, low complexity)

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
