# Archived: Guided Wiring System

These files were archived from the `explorer-only` branch to focus the codebase on the MicroPython -> Circuit Explorer workflow. The guided wiring system provides step-by-step physical breadboard wire placement instructions.

## What's Here

| File | Purpose |
|------|---------|
| `guided-wiring.html` | Guided wiring mode entry point |
| `guided-wiring.js` | Step-by-step wire placement engine |
| `guided-app.js` | Guided wiring application wrapper |
| `guided-wiring.css` | Guided wiring UI styles |
| `circuit-loader.js` | JSON circuit -> physical breadboard rendering |
| `circuit-explorer.js` | Old JSON-based CircuitExplorerManager class |
| `circuits-manager.js` | JSON circuit panel sidebar manager |
| `circuit-validator.js` | Circuit wire validation logic |
| `validator-panel-ui.js` | Validator UI panel |
| `breadboard-data.js` | BREADBOARD_HOLES, PICO_PINS, BREADBOARD_CONFIG |
| `app.js` | Original unified application (superseded) |
| `json-text-input.js` | JSON text input handler |
| `components-library.js` | Old component library loader |
| `styles.css` | Original monolithic stylesheet |
| `index-landing.html` | Original landing page with mode selection |
| `test-validator.html` | Validator test page |
| `test-validator.js` | Validator test script |

## Source Branch

These files are fully intact on the `Pin_and_component` and `main` branches.

## How to Restore

To restore any individual file to its original location:
```bash
git checkout Pin_and_component -- <filename>
```

To restore the entire guided wiring system, merge or cherry-pick from `Pin_and_component`.

## Archived

March 2026, from `Pin_and_component` branch.
