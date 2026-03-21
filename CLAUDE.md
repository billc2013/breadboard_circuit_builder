# Claude Code Guide for Breadboard Circuit Builder

> Quick-start guide for Claude Code sessions on the `explorer-only` branch

## Getting Up to Speed

### Essential Files to Review

1. **README.md** - Project overview, features, architecture
2. **DEVELOPMENT_TASKS.md** - Current work, priorities, completed features
3. **~/.claude/plans/*.md** - Active plan files for in-progress work
4. **~/.claude/projects/-Users-williamchurch-Documents-CRCS-Tufts-Lily-Bot-2025-breadboard-circuit-builder/memory*.md** - Related memory files
4. **components/library.json** - Component registry (the "One Truth" index)

### Key Directories

```
├── explorer-app.js              # Circuit Explorer application (~2,000 lines)
├── llm-micropython-parser.js    # LLM-based parser — sends code to Modal endpoint (~316 lines)
├── llmResponse.js               # Streaming utility for Modal (kept for future use)
├── micropython-parser.js        # Regex-based parser — used as pipeline delegate by LLMParser (~860 lines)
├── abstract-layout.js           # Slot-based positioning system (~377 lines)
├── config.js                    # Runtime config (gitignored) — Modal endpoint URL
├── circuit-explorer.html        # Main HTML (loads 9 scripts)
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

## Branch Context: `parse_to_breadboard`

This branch merges the LLM-based MicroPython parsing (from `explorer-only`) with physical breadboard component placement. Components are placed at specific breadboard holes instead of abstract boxes.

- **Phases 1-3 complete**: Cropped breadboard SVG, coordinate system, placement registry, `BreadboardPlacementSystem`, `BreadboardRenderer`, full rendering pipeline
- **Tabbed sidebar**: Six tabs — Code (MicroPython input), Components (graphics test + Pico position), Comp Wires (wire preview + Bezier tuning), Pico Wires (per-pin entry angle tuning), Drag Wires (interactive wire placement test), Wire Styles (fade/glow tuning for group selection + wire isolation)
- **Components tab**: Toggle components on/off, drag-and-drop to reposition, fine-tune with keyboard (arrows=nudge, +/-=scale, R=rotate). Click Pico to select and reposition/rescale. Pico position/scale persists in `breadboard-placements.json` (`picoPosition` field) and loads on init. Pin markers scale with Pico via `pico-geometry.js`.
- **Comp Wires tab**: Toggle component type → renders component + mock wires to Pico. Click component to select wire group → `[`/`]` exit angle (10° increments), arrows=CP offset, B+arrows=brightness. "Copy Wire Settings" exports overrides to clipboard.
- **Pico Wires tab**: Select Pico pin → `[`/`]` entry angle, arrows=CP offset. Controls the Pico end of Bezier curves.
- **Wire rendering overrides**: `breadboard-wire-rendering.json` stores per-formFactor and per-Pico-pin Bezier curve overrides (exitAngleDeg, entryAngleDeg, cpOffsetX/Y, brightness). Applied to both wire preview and parsed circuits.
- **Rendering transforms**: Per-formFactor `rendering` block in `breadboard-placements.json` (offsetX, offsetY, scale, rotation). Support components use `supportRendering` section.
- **Wire Bezier curves**: Angle-based control points. Component end: exit angle (default perpendicular away from body). Pico end: entry angle (default 0° = horizontal). Both adjustable via wire tuning tabs.
- **Drag Wires tab**: Select a component type → component renders at breadboard slot → Pico pins strobe one at a time (cyan glow ring) → click and drag wire from Pico pin to strobing breadboard hole → wire preview (dashed Bezier) follows cursor, blending into final curve shape near target → release to snap wire into place → next pin strobes. Uses `renderSingleWire()` extracted from `BreadboardRenderer`.
- **Wire Styles tab**: Two preview modes (Group Fade / Wire Isolation). Renders test components with wires, applies fade/glow effect. Keyboard: `[`/`]` fade opacity, Up/Down active opacity, `+`/`-` stroke width, G+arrows glow radius. "Copy Wire Styles" exports to clipboard → `breadboard-wire-styles.json`.
- **Post-parse wiring modal**: After MicroPython code is parsed, a modal offers three wiring modes: Quick Render (instant), Step Through (SPACE to advance one wire at a time with strobe animations), Guided Wiring (click-and-drag each wire from Pico to component). Components render first, then the modal appears. The parse button stays disabled until wiring completes.
- **Shift+click wire isolation**: Shift+click any wire to fade all others and highlight the clicked wire with glow. Shift+click again or ESC to clear. Uses settings from `breadboard-wire-styles.json`.
- **Wire style overrides**: `breadboard-wire-styles.json` stores separate `groupSelection` and `wireIsolation` settings (fadedOpacity, activeOpacity, activeStrokeWidth, glowRadius). Applied as inline styles by `activateGroup()`, `fadeNonActiveWires()`, `isolateWire()`.
- **3V3 pin sharing**: Multiple components (US-100, TB6612) can share `pico1.3V3_OUT`. During guided wiring, placed wires use `pointer-events: none` so the pin stays clickable for subsequent wires. Bandaid — real fix is a power rail system (future work).
- **Copy Positions**: Exports all placements + rendering transforms to clipboard as JSON
- **9 scripts loaded**: `config.js`, `pico-geometry.js`, `breadboard-data.js`, `breadboard-placement.js`, `breadboard-renderer.js`, `abstract-layout.js`, `micropython-parser.js`, `llm-micropython-parser.js`, `llmResponse.js`, `explorer-app.js`
- **Active plan**: `~/.claude/plans/vivid-sniffing-cookie.md` — Wire Styles tuning tab (implemented).

### Prior branch: `explorer-only`

Created March 2026 from `Pin_and_component`. Stripped to MicroPython → Circuit Explorer workflow. LLM parser added March 12, 2026.
To restore guided wiring files: `git checkout Pin_and_component -- <filename>`
See `archive/guided-wiring/README.md` for the full file list.

---

## Project Overview

### Educational Purpose

This is an **educational tool for introductory robotics**. Students:
1. Describe a circuit goal to an LLM ("Make an LED blink when I press a button")
2. LLM generates MicroPython code
3. Student pastes code into Circuit Explorer — an LLM call identifies components automatically
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

### LLM Parser Flow (Primary — `llm-micropython-parser.js`)

```
MicroPython Code (no annotations needed)
    ↓ _callLLM() — POST to Modal endpoint
    ↓ LLM returns structured JSON declarations
Declarations Array (component types, GPIO pins, modes)
    ↓ MicroPythonParser.groupMultiPinDeclarations()
    ↓ MicroPythonParser.resolveComponent() — Library lookup
Resolved Components
    ↓ MicroPythonParser.generateSupportComponents() — From functionalGroup.requires
Support Components
    ↓ MicroPythonParser.generateWires() — From functionalGroup.wireOrder
Wires Array
    ↓ MicroPythonParser.buildCircuitData()
Circuit Data Structure
    ↓ loadFromLLMCall() in explorer-app.js
    ↓ buildFunctionalGroupsFromParser()
    ↓ _renderOnBreadboardComponentsOnly() — placements, highlights, components (no wires)
    ↓ _showWiringModeModal() — student chooses: Quick / Step Through / Guided
    ↓ Quick: bbRenderer.renderWires() — all wires at once
    ↓ Step Through: _autoShowNextWire() — SPACE to advance, strobe animations
    ↓ Guided: _guidedShowNextTarget() — click-and-drag each wire
    ↓ enableGroupInteraction() + enableWireInteraction()
Visual Output
```

### Legacy Regex Parser Flow (`micropython-parser.js`)

Still loaded as a dependency — LLMParser delegates to its pipeline methods.
Can be used directly via `loadFromMicroPython()` if LLM is unavailable.
Requires `# component-type` inline comment annotations.

### Breadboard Placement & Rendering

```
BreadboardPlacementSystem (breadboard-placement.js)
    ↓ assignPlacements() — maps components to breadboard holes via slots
    ↓ getRenderingTransforms(formFactor) — offsetX, offsetY, scale, rotation
BreadboardRenderer (breadboard-renderer.js)
    ↓ loadWireOverrides() — reads breadboard-wire-rendering.json
    ↓ renderComponents() — <image> SVGs with per-formFactor transforms
    ↓ renderSingleWire() — creates one Bezier path (does NOT append to DOM)
    ↓ renderWires() — calls renderSingleWire() for each wire, appends to wiresLayer
    ↓ renderGroupHighlights() — bounding boxes around functional groups
```

### Tabbed Sidebar System

```
Tab bar: Code | Components | Comp Wires | Pico Wires | Drag Wires | Wire Styles
    ↓ setupTabUI() — CSS show/hide via .tab-content.active
    ↓ _handleGlobalKey() dispatches to active tab's handler
    ↓ _wiringState?.active takes priority (during post-parse wiring)

Components tab:
    _gtestHandleKey() — component fine-tune (arrows, +/-, R)
    _handlePicoKey() — Pico position/scale (when Pico selected)
    Copy Positions → breadboard-placements.json to clipboard

Comp Wires tab:
    _cwireToggle() → _cwireRedraw() — renders component + mock wires
    _cwireHandleKey() — [/] exit angle, arrows CP offset, B brightness
    Copy Wire Settings → breadboard-wire-rendering.json to clipboard

Pico Wires tab:
    _pwireHandleKey() — [/] entry angle, arrows CP offset
    Controls Pico-side Bezier control points

Drag Wires tab:
    _dwireSelect() — render component + build wire queue
    _dwireShowNextTarget() — strobe pin + hole, attach mousedown
    _dwireStartDrag/Drag/EndDrag/SnapWire — click-and-drag flow

Wire Styles tab:
    _wstyleActivateMode('group'|'isolation') — render test + apply fade/glow
    _wstyleHandleKey() — [/] fade, arrows active, +/- stroke, G glow
    Copy Wire Styles → breadboard-wire-styles.json to clipboard
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

### 3V3 Pin Shared by Multiple Components
When parsing circuits with multiple power-needing components (e.g., US-100 + TB6612), both generate wires to `pico1.3V3_OUT`. Quick Render handles this fine. Guided wiring uses `pointer-events: none` on placed wires so the pin stays clickable. The real fix is a power rail system where 3V3/GND wires route through breadboard power rails — future work.

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
| LLM-based parser (primary) | No annotations needed; LLM infers components from code context |
| Regex parser as delegate | LLMParser reuses MicroPythonParser's pipeline (resolve, wires, support components) — no duplication |
| Modal serverless endpoint | Duncan's endpoint handles OpenAI API key and structured outputs server-side |
| config.js for endpoint URL | Plain `<script>` pattern — no build tools needed; gitignored for safety |
| Prefix-match for ADC pins | Gracefully handles GP26 vs GP26_ADC0 naming across parser and geometry |
| Rendering transforms per formFactor | offsetX/Y, scale, rotation stored in `breadboard-placements.json` — visual tuning separate from electrical pin-to-hole mapping |
| Rotation on SVG image only | R key rotates the component image, not pin markers or hole positions — keeps electrical model intact |
| Post-parse wiring modal | Components render first, then student chooses wiring mode — educational value scales with interactivity |
| renderSingleWire() doesn't append | Caller decides when/where to insert SVG path — enables drag preview, animation, and batch rendering |
| pointer-events:none during guided wiring | Placed wires don't block mousedown on Pico pins below (3V3 shared by multiple components) |
| Wire style overrides as inline styles | CSS classes remain as fallbacks; JSON-tuned values applied on top via JS for group selection + isolation |

---

## Resources

- **Fritzing**: Component SVG graphics (CC BY-SA 3.0)
- **Raspberry Pi Pico**: GPIO pinout reference
- **MicroPython**: `machine` module documentation
- **Mermaid diagrams**: `archive/docs/mermaid_diagrams/` — architecture analysis from Dec 2025 session

---

**Remember**: This is an educational tool. Prioritize clarity, correctness, and the "One Truth" architecture over clever optimizations.
