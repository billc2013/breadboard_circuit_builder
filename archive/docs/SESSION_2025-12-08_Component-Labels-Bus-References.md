# Development Session: Component Labels & Bus References
**Date:** December 8, 2025
**Focus:** Component hover info, bus-based wire routing, case-insensitive system

---

## Summary

This session implemented three major improvements to make the breadboard circuit builder more user-friendly and robust against LLM input variations:

1. **Interactive Component Info System** - Removed cluttered static labels, added hover info boxes
2. **Bus Reference System for Wires** - Allow LLMs to specify buses instead of exact holes for wires
3. **Comprehensive Case-Insensitivity** - Handle any capitalization in component types, hole references, and bus references

---

## 1. Component Hover Information System

### Problem
- Static component labels cluttered the breadboard interface
- Labels overlapped with components and wires
- Limited space for showing comprehensive component information
- Screenshot showed strikethrough text artifacts on labels

### Solution
Implemented an interactive hover-based information system:

#### Features
- **Clean Interface**: No static labels by default, uncluttered breadboard view
- **Hover to Reveal**: Info box appears next to component on mouseover
- **Comprehensive Details**: Shows full component information including:
  - Component ID and type
  - Description
  - Pin placements (with hole IDs)
  - Electrical properties (voltage, current, resistance, etc.)
- **Smart Positioning**: Info box positioned to the right of hovered component
- **Professional Styling**: White box with blue border, clean typography

#### Implementation Details

**Files Modified:**

1. **index.html**
   - Added `#component-info-box` div with title and details sections

2. **styles.css** (lines 1004-1058)
   - Fixed positioning with dynamic coordinates
   - Professional styling with shadow and border
   - Structured sections for organized information display

3. **app.js** (lines 530-607)
   - Added `showComponentInfo(componentId, metadata, placement, position)` method
   - Added `hideComponentInfo()` method
   - Position calculation using SVG viewport transformation
   - HTML generation for structured info display

4. **Component Adapters** (All 4 adapters updated)
   - **led-5mm-adapter.js**: Removed static label, added hover listeners
   - **resistor-adapter.js**: Removed static label, added hover listeners
   - **button-adapter.js**: Removed static label, added hover listeners
   - **photocell-adapter.js**: Removed static label, added hover listeners
   - Each adapter passes component position for info box placement

#### Code Example
```javascript
// Hover event listener in adapter
ledGroup.addEventListener('mouseover', () => {
    if (window.breadboardApp) {
        window.breadboardApp.showComponentInfo(componentId, metadata, placement, position);
    }
});

ledGroup.addEventListener('mouseout', () => {
    if (window.breadboardApp) {
        window.breadboardApp.hideComponentInfo();
    }
});
```

---

## 2. Bus Reference System for Wire Endpoints

### Problem
- LLMs had to specify exact holes for wire endpoints (e.g., "9A")
- Easy for LLMs to make errors placing wires in occupied holes
- Multiple wires to same bus required different specific holes
- Increased chance of placement conflicts

### Solution
Implemented bus reference system allowing LLMs to specify entire buses:

#### Features
- **Bus References**: LLMs can specify `"Bus9A-D"` instead of exact hole
- **Automatic Hole Selection**: System finds first available unoccupied hole in bus
- **Occupation Checking**: Accounts for components AND wires already placed
- **Flexible User Input**: During guided wiring, user can click ANY hole in the bus
- **Clear Feedback**: Console shows resolution (e.g., "Resolved Bus9A-D → 9C")

#### Bus Reference Format
```
Bus{column}{startRow}-{endRow}

Examples:
- "Bus9A-D"   → Column 9, rows A through D (bottom section)
- "Bus2F-J"   → Column 2, rows F through J (top section)
- "Bus15A-E"  → Column 15, rows A through E (bottom section)
```

#### Implementation Details

**Files Modified:**

1. **breadboard-data.js** (lines 190-330)

   Added four key functions:

   a. **`parseBusReference(busRef)`** (lines 195-238)
   - Parses bus format using regex: `/^Bus(\d+)([A-J])-([A-J])$/i`
   - Validates row range (A-E for bottom, F-J for top)
   - Returns: `{ column, rows, section }`

   b. **`getHolesForBusReference(busRef)`** (lines 245-259)
   - Finds all holes matching the bus reference
   - Filters by column, section, and row range
   - Returns array of hole objects

   c. **`getAvailableHoleFromBus(busRef)`** (lines 266-280)
   - Checks each hole for `.occupied` class
   - Returns first unoccupied hole
   - Falls back to first hole with warning if all occupied

   d. **`resolveWireEndpoint(endpoint)`** (lines 288-319)
   - Handles three types of endpoints:
     - Pico pins: `pico1.GP0` → pass through
     - Bus references: `Bus9A-D` → resolve to available hole
     - Direct holes: `20J` → normalize case
   - Returns object with `resolvedId`, `busReference`, and `validHoles`

   e. **`normalizeHoleReference(holeRef)`** (lines 327-330)
   - Converts hole references to uppercase for consistency

2. **guided-wiring.js** (lines 131-152, 350-413)

   a. **Updated `loadWires()`** method:
   ```javascript
   const resolvedWires = wires.map(wire => {
       const fromResolution = resolveWireEndpoint(wire.from);
       resolvedWire.from = fromResolution.resolvedId;
       resolvedWire.fromBusReference = fromResolution.busReference;
       resolvedWire.fromValidHoles = fromResolution.validHoles;
       // Same for 'to' endpoint
   });
   ```

   b. **Updated `handlePointClick()`** method:
   - Checks if clicked hole is in `validHoles` array
   - Accepts any hole within the specified bus
   - Shows bus reference in error messages

#### Occupation Tracking System

**How It Works:**

1. **Components mark holes** (all adapters):
   ```javascript
   markHoleOccupied(position.cathodeHoleId, 'component', componentId);
   ```

2. **Wires mark holes** (app.js line 399-402):
   ```javascript
   markHoleOccupied(startPoint.id, 'wire', wire.id);
   markHoleOccupied(endPoint.id, 'wire', wire.id);
   ```

3. **`markHoleOccupied()` adds CSS class** (app.js lines 631-639):
   ```javascript
   function markHoleOccupied(holeId, occupantType, occupantId) {
       const holeElement = document.querySelector(`[data-hole-id="${holeId}"]`);
       holeElement.classList.add('occupied');
       holeElement.setAttribute('data-occupied-by', occupantId);
       holeElement.setAttribute('data-occupant-type', occupantType);
   }
   ```

4. **`getAvailableHoleFromBus()` checks occupation**:
   ```javascript
   if (holeElement && !holeElement.classList.contains('occupied')) {
       return hole;  // Found available hole!
   }
   ```

#### Example Usage

**Old Format (Exact Hole):**
```json
{
  "id": "w1",
  "from": "pico1.GP16",
  "to": "9A"
}
```

**New Format (Bus Reference):**
```json
{
  "id": "w1",
  "from": "pico1.GP16",
  "to": "Bus9A-D"
}
```

**What Happens:**
1. System parses `"Bus9A-D"` → column 9, rows A-D, bottom section
2. Finds holes: 9A, 9B, 9C, 9D
3. Checks occupation:
   - 9A: occupied by resistor ❌
   - 9B: occupied by previous wire ❌
   - 9C: available ✅ (selected!)
4. User can click any of 9A, 9B, 9C, or 9D during guided wiring
5. Console shows: `"Resolved Bus9A-D → 9C (4 holes in bus)"`

---

## 3. Comprehensive Case-Insensitivity

### Problem
- LLMs are inconsistent with capitalization
- System required exact case matches:
  - Component types: `"led-yellow-5mm"` only
  - Hole references: `"2E"` only (not `"2e"`)
  - Bus references: Case-sensitive
- Failed silently on case mismatches

### Solution
Made entire system case-insensitive for all user-facing identifiers:

#### What's Now Case-Insensitive

1. **Bus References**
   - `"Bus9A-E"` ✓
   - `"bus9a-e"` ✓
   - `"BUS9A-E"` ✓
   - `"bUs9a-E"` ✓

2. **Hole References**
   - `"2E"` ✓
   - `"2e"` ✓
   - `"20J"` ✓
   - `"20j"` ✓

3. **Component Types**
   - `"led-yellow-5mm"` ✓
   - `"LED-Yellow-5mm"` ✓
   - `"LED-YELLOW-5MM"` ✓
   - `"Led-yellow-5Mm"` ✓

#### Implementation Details

**1. Bus References** (breadboard-data.js)

Already case-insensitive via regex flag and `.toUpperCase()`:
```javascript
const match = busRef.match(/^Bus(\d+)([A-J])-([A-J])$/i);  // 'i' flag
const startRow = match[2].toUpperCase();
const endRow = match[3].toUpperCase();
```

Enhanced with case-insensitive check:
```javascript
if (endpoint.toLowerCase().startsWith('bus')) {
    // Handle bus reference
}
```

**2. Hole References** (breadboard-data.js lines 321-330)

Added normalization in `resolveWireEndpoint()`:
```javascript
// Direct hole reference - normalize to uppercase
const normalizedEndpoint = normalizeHoleReference(endpoint);
return {
    resolvedId: normalizedEndpoint,
    busReference: null,
    validHoles: null
};
```

Helper function:
```javascript
function normalizeHoleReference(holeRef) {
    return holeRef.toUpperCase();
}
```

**3. Component Placements** (circuit-loader.js lines 295-296, 362-399)

Added normalization before processing:
```javascript
async renderComponent(componentData) {
    const { id, type, placement } = componentData;

    // Normalize all hole references to uppercase
    const normalizedPlacement = this.normalizePlacement(placement);

    // Use normalizedPlacement in all subsequent calls
    const validation = adapter.validate(normalizedPlacement, BREADBOARD_HOLES);
    const position = adapter.calculatePosition(normalizedPlacement, BREADBOARD_HOLES);
}
```

Normalization method:
```javascript
normalizePlacement(placement) {
    const normalized = {};
    for (const [key, value] of Object.entries(placement)) {
        if (typeof value === 'string' && !value.startsWith('pico')) {
            normalized[key] = value.toUpperCase();  // "2e" → "2E"
        } else if (typeof value === 'object' && value !== null) {
            normalized[key] = this.normalizePlacement(value);  // Recursive
        } else {
            normalized[key] = value;
        }
    }
    return normalized;
}
```

**4. Component Types** (circuit-loader.js lines 52-82, 89-117, 124-159, 366-374)

Added normalization in all loader methods:

```javascript
normalizeComponentType(componentType) {
    return componentType.toLowerCase();
}
```

Applied in:
- `loadComponentMetadata()` - Line 54
- `loadGeometryScript()` - Line 91
- `loadAdapter()` - Line 126

All caches use normalized keys for consistency.

#### Benefits

1. **Robustness**: Handles LLM inconsistencies automatically
2. **User-Friendly**: Manual JSON editing more forgiving
3. **Future-Proof**: Works with any LLM output variations
4. **No Breaking Changes**: Original formats still work perfectly

---

## Testing & Validation

### Test Cases Created

1. **test-bus-references.json**
   - Circuit using bus references for all wires
   - Button + pull-down resistor circuit
   - Demonstrates `"Bus9A-D"` and `"Bus2A-D"` format

### Recommended Testing

1. **Component Hover**:
   - Load any circuit
   - Hover over each component type
   - Verify info box appears with correct details
   - Check positioning next to component

2. **Bus References**:
   - Load `test-bus-references.json`
   - Observe console for resolution messages
   - Verify wires connect to appropriate holes
   - Try clicking different holes in same bus during guided wiring

3. **Case Variations**:
   - Test circuit with mixed case component types
   - Test with lowercase hole references
   - Test with various bus reference cases
   - All should load without errors

---

## Files Modified Summary

### New Files
- `/docs/SESSION_2025-12-08_Component-Labels-Bus-References.md` (this file)
- `/circuits/test-bus-references.json`

### Modified Files

**Core System:**
- `index.html` - Added component info box HTML
- `styles.css` - Added info box styling (lines 1004-1058)
- `app.js` - Added info box methods (lines 530-607)
- `breadboard-data.js` - Added bus reference system (lines 190-330)
- `circuit-loader.js` - Added case-insensitive component loading (lines 52-82, 89-117, 124-159, 362-399)
- `guided-wiring.js` - Added bus-aware endpoint validation (lines 131-152, 350-413)

**Component Adapters:**
- `components/basic/led-5mm-adapter.js` - Removed label, added hover
- `components/basic/resistor-adapter.js` - Removed label, added hover
- `components/basic/button-adapter.js` - Removed label, added hover
- `components/basic/photocell-adapter.js` - Removed label, added hover

---

## Future Enhancements

### Potential Improvements

1. **Touch Device Support**
   - Implement tap-and-hold for hover info on mobile/tablets
   - Currently only works with mouse hover

2. **Bus Reference Expansion**
   - Support power rail buses (e.g., "Bus1W-5W")
   - Allow cross-section buses if needed

3. **Smart Bus Selection**
   - Prefer holes closer to component connections
   - Optimize for shorter wire routing

4. **Visual Bus Highlighting**
   - Highlight all holes in bus when hovering wire endpoint
   - Show available vs occupied holes in different colors

5. **Collision-Aware Labels** (Low Priority)
   - Optional static labels with collision detection
   - For users who prefer always-visible labels

---

## LLM Prompt Updates

### Updated llm_prompt_v06.md

Key changes to guide LLMs:
- Introduced bus reference format: `"Bus{column}{startRow}-{endRow}"`
- Emphasized bus usage over exact holes for wires
- Clarified that any case works for all identifiers
- Examples show bus references throughout

### Benefits for LLM Prompting
- Reduced precision requirements
- Fewer placement errors
- More natural circuit descriptions
- Better error recovery

---

## Lessons Learned

1. **Progressive Enhancement**: Hover info improved UX without breaking existing functionality
2. **Abstraction Benefits**: Bus references reduced coupling between LLM output and physical placement
3. **Defensive Programming**: Case-insensitivity made system robust to variations
4. **Clear Feedback**: Console logging helped debug bus resolution and occupation checking

---

## Session Metrics

- **Duration**: ~3 hours
- **Files Modified**: 11 files
- **Lines Added**: ~400+ lines
- **Features Completed**: 3 major features
- **Test Circuits Created**: 1
- **Bugs Fixed**: 0 (no pre-existing bugs addressed)
- **Breaking Changes**: 0 (fully backward compatible)

---

## Contributors

- Development & Implementation: Claude (Sonnet 4.5)
- Product Direction & Testing: William Church
