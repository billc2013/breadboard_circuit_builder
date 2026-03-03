# Claude Code Guide for Breadboard Circuit Builder

> Quick-start guide for Claude Code sessions on the `explorer-only` branch

## Getting Up to Speed

### Essential Files to Review

1. **README.md** - Project overview, features, architecture
2. **DEVELOPMENT_TASKS.md** - Current work, priorities, completed features
3. **~/.claude/plans/*.md** - Active plan files for in-progress work
4. **components/library.json** - Component registry (the "One Truth" index)

### Key Directories

```
├── explorer-app.js              # Circuit Explorer application (~1,485 lines)
├── micropython-parser.js        # MicroPython code → circuit data (~860 lines)
├── abstract-layout.js           # Slot-based positioning system (~377 lines)
├── circuit-explorer.html        # Main HTML (loads 4 scripts)
├── index.html                   # Redirect → circuit-explorer.html
├── components/                  # Component library ("One Truth")
│   ├── library.json             # Master index
│   ├── basic/                   # LEDs, resistors, buttons, photocells, sensors, motors
│   └── microcontrollers/        # Pico (pico.json + pico-geometry.js)
├── components_svg/              # Fritzing SVG graphics (rendered in diagrams)
├── micropython_examples/        # Example MicroPython files (led_blink, night_light, wall-follower)
├── styles/                      # common.css + circuit-explorer.css
├── prompts/                     # LLM prompt templates (micropython-generator.md)
├── fritzing_data/               # Fritzing XML source files + pico-data.js
├── scripts/                     # Fritzing parser utilities (parse-fritzing.js)
├── circuit_json_files/          # JSON circuit examples (legacy reference)
├── archive/                     # All archived files
│   ├── guided-wiring/           # Guided wiring system (17 files)
│   ├── json-circuits/           # LLM-generated JSON circuits
│   ├── json-prompts/            # JSON circuit generation prompts (v01-v06)
│   ├── layouts/                 # Layout engine experiments
│   ├── prev_versions/           # Earlier code versions
│   ├── screenshots/             # Development screenshots
│   ├── docs/                    # Session notes + mermaid diagrams (Dec 2025)
│   └── docs_archive/            # v1 POC development docs
└── screenshots/                 # (empty — active screenshots go here)
```

### Quick Exploration Commands

```bash
# See recent changes
git log --oneline -10

# Find functional group logic
grep -r "functionalGroup" components/basic/*.json

# Find where components are rendered
grep -n "renderMicroPython" explorer-app.js
```

---

## Branch Context: `explorer-only`

This branch was created March 2026 from `Pin_and_component`. It strips the codebase to just the MicroPython → Circuit Explorer workflow:

- **Removed**: JSON circuit loading, guided wiring, physical layout, CircuitLoader, CircuitsManager, breadboard-data.js
- **Archived**: 17 files in `archive/guided-wiring/` with restoration instructions
- **Trimmed**: `explorer-app.js` from 3,401 → ~1,485 lines (56% reduction)
- **4 scripts loaded**: `pico-geometry.js`, `abstract-layout.js`, `micropython-parser.js`, `explorer-app.js`

### Restoration

To restore guided wiring files: `git checkout Pin_and_component -- <filename>`
See `archive/guided-wiring/README.md` for the full file list.

---

## Project Overview

### Educational Purpose

This is an **educational tool for introductory robotics**. Students:
1. Describe a circuit goal to an LLM ("Make an LED blink when I press a button")
2. LLM generates annotated MicroPython code (see `prompts/`)
3. Student pastes code into Circuit Explorer to understand the circuit conceptually
4. Student learns circuit topology through interactive block diagram visualization

**Key insight**: The tool bridges the gap between abstract circuit concepts and physical breadboard assembly.

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
- **Consistency**: MicroPython parser uses the same metadata as rendering
- **Maintainability**: Change a component's behavior in ONE place

### Component Adapter Pattern

Each component type has:
1. **Metadata JSON** - Properties, pins, functionalGroup, rendering info
2. **Geometry JS** - Position calculations
3. **Adapter JS** - Rendering logic

```javascript
// Adding a new component:
// 1. Create components/{category}/new-component.json (metadata)
// 2. Create new-component-geometry.js + new-component-adapter.js
// 3. Add to components/library.json index
// No changes to core code!
```

---

## Code Style & Best Practices

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
    ↓ extractDeclarations() — Regex extraction
Declarations Array
    ↓ resolveComponent() — Library lookup
Resolved Components
    ↓ generateSupportComponents() — From functionalGroup.requires
Support Components
    ↓ generateWires() — From functionalGroup.wireOrder
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
6. Test by parsing MicroPython code with the component annotation

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

## Known Issues & Gotchas

### ADC Pin Name Mismatch
Pico GPIO pins 26-28 are ADC-capable. `pico-geometry.js` registers them as `GP26_ADC0`, `GP27_ADC1`, `GP28_ADC2`. The MicroPython parser generates `GP26` (without suffix) when used as digital pins (`Pin(26, Pin.OUT)`). Wire rendering and pin highlighting use a prefix-match fallback to handle this. If adding new pin lookup code, use the same pattern:
```javascript
const pin = this.picoPins.find(p => p.pinKey === name) ||
            this.picoPins.find(p => p.pinKey.startsWith(name + '_'));
```

### Wire Count Display
The "Wires: 0" counter in the bottom-left does not update when loading via MicroPython. This is a known minor UI issue.

---

## Session Workflow

### Starting a Session

1. Check which branch you're on (`git branch`)
2. Review `DEVELOPMENT_TASKS.md` for current priorities
3. Check `~/.claude/plans/` for active plan files
4. Run `git status` to see any uncommitted changes

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
| Explorer-only branch | Focus development on MicroPython visualization; guided wiring archived for later |
| No CircuitLoader dependency | Explorer renders directly from parser output, no physical placement needed |
| Auto-generate support components | Reduces user/LLM burden, ensures correctness |
| Slot-based abstract layout | Conceptual understanding over physical accuracy |
| Regex-based parser | Simple, sufficient for annotated code format |
| Inline comment annotations | Minimal syntax, easy for LLMs to generate |
| Prefix-match for ADC pins | Gracefully handles GP26 vs GP26_ADC0 naming across parser and geometry |

---

## Resources

- **Fritzing**: Component SVG graphics (CC BY-SA 3.0)
- **Raspberry Pi Pico**: GPIO pinout reference
- **MicroPython**: `machine` module documentation
- **Mermaid diagrams**: `archive/docs/mermaid_diagrams/` — architecture analysis from Dec 2025 session

---

**Remember**: This is an educational tool. Prioritize clarity, correctness, and the "One Truth" architecture over clever optimizations.
