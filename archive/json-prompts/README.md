# Archived: JSON Circuit Generation Prompts

These LLM prompt templates instruct Claude/GPT to generate JSON circuit definitions with breadboard hole placements, bus references, and component positions. They are not used on the `explorer-only` branch, which uses MicroPython code input instead.

## What's Here

| File | Description |
|------|-------------|
| `llm_prompt_v01.md` - `llm_prompt_v06.md` | Iterative prompt versions for JSON circuit generation |

The prompts cover:
- Breadboard hole naming conventions (direct holes and bus references)
- Component library reference and placement rules
- Pico pin capabilities (GPIO, PWM, ADC)
- Bus reference format: `Bus{column}{startRow}-{endRow}`
- JSON schema specification for circuit definitions

## Active Prompts

The `prompts/` directory in the project root will contain MicroPython-focused prompts (e.g., `micropython-generator.md`) for the explorer-only workflow.

## How to Restore

```bash
git checkout Pin_and_component -- prompts/
```

## Archived

March 2026, from `explorer-only` branch.
