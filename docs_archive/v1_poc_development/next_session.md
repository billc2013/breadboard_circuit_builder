# Quick Start - Next Session

## Start Server
```bash
cd breadboard-circuit-builder
python3 -m http.server 8000
# Open http://localhost:8000
```

## Verify Current State
1. Hover over holes - should show coordinates
2. Click two holes - should draw red wire
3. Check console - should show "Breadboard initialized at: {x: 50, y: 50}"
4. Toggle labels - should show hole IDs

## Key Questions to Address
1. **Pico orientation** - Horizontal or vertical on breadboard?
2. **Component anchor point** - Which pin defines position (pin 1, center, etc.)?
3. **SVG extraction** - Parse Fritzing XML or use raw SVG files?
4. **Rotation handling** - Fixed orientations or allow rotation?

## Files to Create
- `components.js` - Component library and rendering
- `circuit-loader.js` - JSON import/validation
- `circuits/simple_led_circuit.json` - Example circuit

## Prompt for Next AI Session

"I'm continuing development of a breadboard circuit builder web app. 

**Current state:**
- Interactive breadboard with accurate hole positioning
- Wire drawing works (click-to-click)
- Hybrid coordinate system implemented

**Files attached:**
- DESIGN_DECISIONS.md - Architecture documentation
- PROJECT_STATE.md - Current configuration values
- breadboard-data.js - Coordinate system implementation
- index.html - HTML structure

**Next goal:**
Implement Pico, LED, and Resistor rendering from circuit JSON.

**Available resources:**
- Fritzing XML files for all components in components_svg/
- Target circuit JSON schema defined in DESIGN_DECISIONS.md

**Specific task:**
Create components.js to render components from Fritzing XML and position them on breadboard using hole ID references.

Please help me implement component rendering."

## What to Attach to New Conversation

**Essential files:**
1. `DESIGN_DECISIONS.md` (updated with current state)
2. `PROJECT_STATE.md` (new - snapshot of config values)
3. `breadboard-data.js` (current working version)
4. `index.html` (current working version)
5. One Fritzing XML file (e.g., LED or Pico) as example

**Optional but helpful:**
6. Screenshot of current working app
7. `NEXT_SESSION.md` (quick start guide)

---

## In Your Next Prompt, Say:

"I'm continuing a breadboard circuit builder POC. Attached are:
- DESIGN_DECISIONS.md - architecture and decisions made
- PROJECT_STATE.md - current configuration snapshot  
- Working code files (breadboard-data.js, index.html)
- Fritzing XML component definitions

Current state: Breadboard rendering works, holes are positioned correctly, wire drawing works.

Next goal: Implement component rendering (Pico, LED, Resistor) from circuit JSON using the Fritzing XML files.

Please review the attached context and help me create components.js for rendering components."

# October 31, 2025 #



## Next Session Goals

### Priority 1: Fix Validator Issues
1. Implement bus-aware connection checking in warnings
2. Add comprehensive LED polarity validation (net tracing)
3. Test validator with more complex circuits

### Priority 2: Component Rendering (Original Goal)
1. Create `components.js` for component rendering
2. Implement component positioning from hole IDs
3. Render LED on breadboard from circuit JSON
4. Render resistor on breadboard from circuit JSON
5. Render Pico off-breadboard with pin labels

### Priority 3: Circuit Loading
1. Create `circuit-loader.js` for JSON → rendering
2. Implement wire auto-rendering from circuit JSON
3. Add "Load & Render Circuit" button to UI
4. Integrate validator → renderer pipeline

## Key Metrics

### Code
- Validator: ~800 lines (circuit-validator.js)
- Parser: ~400 lines (parse-fritzing.js)
- Component files: 3 complete definitions
- Test circuits: 2 (valid + invalid)

### Validation Coverage
- Structural checks: 100%
- Reference checks: 100%
- Electrical rules: 80% (bus warnings disabled)
- Topology: 90% (basic polarity only)
- Component rules: 75% (PWM done, advanced polarity TODO)

## Testing Status

### Validator Tests
- ✅ Valid LED circuit: Passes (0 errors, 0 warnings)
- ✅ Invalid LED circuit: Catches 5-6 errors correctly
- ✅ Short circuit detection: Working
- ✅ Open circuit detection: Working
- ✅ PWM pin validation: Working
- ⚠️ Unconnected warnings: Disabled (false positives)

### Component Library
- ✅ LED definition: Complete with validation rules
- ✅ Resistor definition: Complete with properties
- ✅ Pico definition: All 40 pins with PWM flags

## Architecture Decisions Made

1. **Separate component files** (vs monolithic JSON)
2. **Graph-based validation** (vs SPICE simulation)
3. **Slide-out validator panel** (vs modal/tabs)
4. **Fritzing XML extraction** (vs manual component creation)
5. **5-layer validation architecture** (structural → component-specific)

See `DESIGN_DECISIONS.md` for detailed rationale.

---

## Quick Reference

### Run Fritzing Parser
```bash
./scripts/parse-all-components.sh
```

### Test Validator
1. Open `index.html`
2. Click "🔍 Circuit Validator"
3. Load test file or drag & drop JSON
4. Click "Validate"

### Component JSON Location
- LEDs: `components/basic/`
- Resistors: `components/basic/`
- Microcontrollers: `components/microcontrollers/`

### Test Circuits
- Valid: `circuits/test-valid-led-circuit.json`
- Invalid: `circuits/test-invalid-led-circuit.json`