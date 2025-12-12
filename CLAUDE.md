# Claude Code Guide for Breadboard Circuit Builder

> Quick-start guide for Claude Code sessions working on this project

## Getting Up to Speed

### Essential Files to Review

1. **README.md** - Project overview, features, architecture
2. **DEVELOPMENT_TASKS.md** - Current work, priorities, completed features
3. **~/.claude/plans/*.md** - Active plan files for in-progress work
4. **components/library.json** - Component registry (the "One Truth" index)

### Key Directories

```
├── explorer-app.js          # Circuit Explorer main application (~2800 lines)
├── micropython-parser.js    # MicroPython code → circuit visualization
├── abstract-layout.js       # Slot-based positioning system
├── circuit-loader.js        # JSON → breadboard rendering
├── guided-wiring.js         # Step-by-step wire placement
├── components/              # Component library ("One Truth")
│   ├── library.json         # Master index
│   ├── basic/               # LEDs, resistors, buttons, photocells
│   └── microcontrollers/    # Pico
└── circuits/                # Example circuit JSON files
└── screenshots/             # Used for feedback during dev testing
└── prompts/                 # For LLM prompts to generate circuits
```

### Quick Exploration Commands

```bash
# See recent changes
git log --oneline -10

# Find functional group logic
grep -r "functionalGroup" components/basic/*.json

# Find where components are rendered
grep -n "renderComponent" explorer-app.js
```

---

## Project Overview

### Educational Purpose

This is an **educational tool for introductory robotics**. Students:
1. Describe a circuit goal or micropython goal to an LLM ("Make an LED blink when I press a button")
2. LLM generates circuit description that includes JSON per format outlined in ./prompts or MicroPython as outlined in ./prompts or ./prompts/micropython)
3. Student loads into Circuit Explorer to understand conceptually
4. Student uses Guided Wiring to build the physical circuit step-by-step
5. Student learns circuit topology through interactive visualization

**Key insight**: The tool bridges the gap between abstract circuit concepts and physical breadboard assembly.

### Two Modes

| Mode | File | Purpose |
|------|------|---------|
| **Circuit Explorer** | `circuit-explorer.html` | Conceptual visualization - sensors top, outputs bottom, functional groups |
| **Guided Wiring** | `guided-wiring.html` | Step-by-step physical build instructions |

---

## Architecture: "One Truth" System

### Core Principle

**Component JSON files are the single source of truth.** All behavior derives from component metadata:

```
components/basic/led-red-5mm.json
    ↓
functionalGroup.category: "output"     → Slot positioning (bottom region)
functionalGroup.requires: [resistor]   → Auto-generate support components
functionalGroup.wireOrder: [...]       → Wire colors and roles
pins: {cathode, anode}                 → Electrical connections
rendering.breadboard.svg               → Visual representation
```

### Why This Matters

- **No duplication**: Wire colors, resistor requirements, pin names all come from ONE place
- **Extensibility**: Add a new component by creating ONE JSON file + adapter
- **Consistency**: MicroPython parser AND JSON loader use the SAME metadata
- **Maintainability**: Change a component's behavior in ONE place

### Component Adapter Pattern

Each component type has:
1. **Metadata JSON** - Properties, pins, functionalGroup, rendering info
2. **Geometry JS** - Position calculations from breadboard holes
3. **Adapter JS** - Rendering logic, validation

```javascript
// Example: Adding a new component
// 1. Create components/sensors/new-sensor.json (metadata)
// 2. Create components/sensors/new-sensor-geometry.js
// 3. Create components/sensors/new-sensor-adapter.js
// 4. Add to components/library.json index
// No changes to core code!
```

---

## Code Style & Best Practices

### Modular Design

- **Separate concerns**: Parser, layout, rendering are distinct modules
- **Single responsibility**: Each class/function does ONE thing well
- **Avoid globals**: Pass dependencies explicitly

### Naming Conventions

```javascript
// Classes: PascalCase
class MicroPythonParser { }
class AbstractLayoutSystem { }

// Methods: camelCase, verb-first
loadFromMicroPython()
buildFunctionalGroupsFromParser()
renderMicroPythonWires()

// Constants: SCREAMING_SNAKE_CASE
const MAX_SLOTS_PER_ROW = 3;

// Files: kebab-case
micropython-parser.js
abstract-layout.js
```

### Console Logging

Use prefixed logs for traceability:
```javascript
console.log('[MicroPythonParser] Extracted declarations:', declarations);
console.log('[Explorer] Built functional group:', group.label);
console.log('[AbstractLayout] Slot slot-sensor-0:', slot);
```

### Error Handling

Return structured error objects:
```javascript
return {
    success: false,
    errors: [{
        type: 'unknown_component',
        message: `Unknown component type: "${componentType}"`,
        suggestion: `Available types: ${availableTypes.join(', ')}`
    }],
    warnings: []
};
```

---

## Current Architecture Patterns

### MicroPython Parser Flow

```
MicroPython Code
    ↓ extractDeclarations() - Regex extraction
Declarations Array
    ↓ resolveComponent() - Library lookup
Resolved Components
    ↓ generateSupportComponents() - From functionalGroup.requires
Support Components
    ↓ generateWires() - From functionalGroup.wireOrder
Wires Array
    ↓ buildCircuitData()
Circuit Data Structure
    ↓ loadFromMicroPython() in explorer-app.js
    ↓ buildFunctionalGroupsFromParser()
    ↓ abstractLayout.calculateSlots()
    ↓ renderMicroPythonComponents()
    ↓ renderMicroPythonWires()
Visual Output
```

### Abstract Layout System

```
Functional Groups
    ↓ categorize by functionalGroup.category
Sensors (top) | Outputs (bottom)
    ↓ calculateRegionSlots()
Slot positions with bounds, wireEntry points
    ↓ getAbstractPosition()
Component positions within slots
```

---

## Common Tasks

### Adding a New Component

1. Find/create Fritzing SVG → `components_svg/`
2. Create metadata JSON → `components/{category}/{name}.json`
3. Create geometry JS → `components/{category}/{name}-geometry.js`
4. Create adapter JS → `components/{category}/{name}-adapter.js`
5. Register in `components/library.json`
6. Test with a circuit JSON file

### Debugging Circuit Explorer

```javascript
// Check functional groups
console.log(window.explorerApp.functionalGroups);

// Check slot assignments
console.log(window.explorerApp.abstractLayout.slots);

// Check component positions
console.log(window.explorerApp.componentPositions);
```

### Testing MicroPython Parser

```javascript
const parser = new MicroPythonParser();
const result = await parser.parse(`
led = Pin(15, Pin.OUT)  # led-red-5mm
button = Pin(14, Pin.IN, Pin.PULL_DOWN)  # button-tactile-6mm
`);
console.log(result);
```

---

## Session Workflow

### Starting a Session

1. Review `DEVELOPMENT_TASKS.md` for current priorities
2. Check `~/.claude/plans/` for active plan files
3. Run `git status` to see any uncommitted changes
4. Identify the specific task to work on

### During Development

- Update todo list with `TodoWrite` tool for multi-step tasks
- Test changes in browser with `python3 -m http.server 8000`
- Check console for errors and trace logs
- Commit incrementally with descriptive messages

### Ending a Session

1. Update `DEVELOPMENT_TASKS.md` with completed work
2. Update plan file if applicable
3. Note any issues discovered for next session
4. Commit all changes

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Bypass CircuitLoader for MicroPython | Explorer mode doesn't need physical placements |
| Auto-generate support components | Reduces user/LLM burden, ensures correctness |
| Slot-based abstract layout | Conceptual understanding over physical accuracy |
| Regex-based parser | Simple, sufficient for annotated code format |
| Inline comment annotations | Minimal syntax, easy for LLMs to generate |

---

## Resources

- **Fritzing**: Component SVG graphics (CC BY-SA 3.0)
- **Raspberry Pi Pico**: GPIO pinout reference
- **MicroPython**: `machine` module documentation

---

**Remember**: This is an educational tool. Prioritize clarity, correctness, and the "One Truth" architecture over clever optimizations.
