# Archived: JSON Circuit Files

These JSON circuit definition files were used with the guided wiring and JSON-based circuit loading system. They are not used on the `explorer-only` branch, which loads circuits from MicroPython code instead.

## What's Here

| Directory | Contents |
|-----------|----------|
| `*.json` (top-level) | LLM-generated circuits from ChatGPT, Haiku, Sonnet (night lights, traffic lights, etc.) |
| `explorer_test/` | Test circuits for the JSON-based Circuit Explorer (simple LED, button, RGB) |
| `teaching_circuits/` | Multi-step teaching sequences (Alarm Prompt, Button LED prompt) |
| `test-*.json` | Validation and bus reference test circuits |

## Active MicroPython Examples

MicroPython example files remain in `circuits/micropython_examples/` (not archived).

## How to Restore

```bash
git checkout Pin_and_component -- circuits/
```

Or restore individual files:
```bash
git checkout Pin_and_component -- circuits/sonnet_night_light.json
```

## Archived

March 2026, from `explorer-only` branch.
