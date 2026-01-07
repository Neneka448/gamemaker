# Skill: Game Schema Generator

## Description
Expert assistant for designing, implementing, and validating game schemas for the GameEngine DSL. This skill ensures that `game.json` files are structurally sound, logically consistent, and provide a compelling player experience.

## Operational Rules
1. **Naming Convention**: All IDs (items, buffs, nodes, stats) **MUST** use `snake_case`.
2. **Stat Integrity**: Every `stat_add` or `stat_set` effect must target a stat defined in the global `stats` block.
3. **Validation Mandatory**: After **EVERY** modification to a schema file, run `node scripts/validate-schema.js <path_to_file>` to ensure correctness.
4. **Unique IDs**: Never duplicate IDs within the same category (e.g., two items with the same key).
5. **Connectivity**: Ensure every story node (except endings) has at least one path to another node or an ending.

## When to Use
- User wants to create a new game or adventure.
- User needs to add new gameplay elements (items, buffs, shops, or story nodes).
- User wants to debug or validate a `game.json` file.
- User asks about the game DSL syntax or capabilities.

## Standard Procedures

### Procedure: Creating a New Game
1.  **Define Core Stats**: Determine the primary resources (hp, money, stamina, etc.).
2.  **Sketch Story Nodes**: Create a list of key locations/nodes and their connections.
3.  **Implement Mechanics**: Add items and buffs that interact with the core stats.
4.  **Assemble and Validate**: Combine into a JSON structure and run the validator.

### Procedure: Adding an Item/Buff
1.  **Check Prerequisites**: Ensure any stats referenced in `use_effects` or `modifiers` already exist.
2.  **Define the Object**: Create the item/buff with a unique ID and descriptive text.
3.  **Integrate**: Add the item to a shop or as an effect in a story node.
4.  **Validate**: Run the schema validator.

## Schema Reference

The game schema is a JSON file with the following top-level structure:

```json
{
  "meta": { "title": "Game Title", "version": 1 },
  "resources": { "capacity": 10 },
  "stats": { ... },
  "items": { ... },
  "buffs": { ... },
  "shops": { ... },
  "events": [ ... ],
  "story": { "start": "node_id", "nodes": { ... } },
  "endings": [ ... ]
}
```

### Stats Definition
Stats have `cur` (current) and `max` values:
```json
"stats": {
  "hp": { "cur": 20, "max": 20 },
  "money": { "cur": 10, "max": 9999 },
  "stamina": { "cur": 6, "max": 10 },
  "hunger": { "cur": 10, "max": 100 }
}
```

### Items Definition
```json
"items": {
  "item_id": {
    "name": "Display Name",
    "stackable": true,
    "start_count": 0,
    "use_effects": [
      { "type": "stat_add", "stat": "hp", "value_expr": "10" },
      { "type": "log", "text": "You used the item." }
    ],
    "hold_buffs": [
      { "buff": "buff_id", "value_expr": "$count * 2" }
    ]
  }
}
```

### Buffs Definition
```json
"buffs": {
  "buff_id": {
    "desc": "Description",
    "value_expr": "1",
    "modifiers": [
      { "type": "stat_add", "stat": "strength", "value_expr": "$value" },
      { "type": "stat_add_max", "stat": "hp", "value_expr": "$value * 2" }
    ],
    "periodic": {
      "every": "day",
      "conditions": [],
      "effects": [
        { "type": "stat_add", "stat": "hp", "value_expr": "-$value" }
      ]
    }
  }
}
```

### Shops Definition
```json
"shops": {
  "shop_id": {
    "name": "Shop Name",
    "items": [
      {
        "id": "item_id",
        "price": 10,
        "conditions": ["$stat.money.cur >= 10"],
        "effects": [
          { "type": "stat_add", "stat": "money", "value_expr": "-10" },
          { "type": "item_add", "item": "item_id", "count_expr": "1" }
        ]
      }
    ]
  }
}
```

### Events Definition
```json
"events": [
  {
    "trigger": "on_day_start",
    "conditions": ["$stat.hunger.cur >= 80"],
    "effects": [
      { "type": "stat_add", "stat": "hp", "value_expr": "-2" },
      { "type": "log", "text": "Hunger hurts you." }
    ]
  }
]
```

### Story Nodes
```json
"story": {
  "start": "start_node",
  "nodes": {
    "start_node": {
      "title": "Node Title",
      "text": "Description text shown to player.",
      "shops": ["shop_id"],
      "choices": [
        {
          "text": "Choice text",
          "conditions": ["$stat.hp.cur > 10"],
          "effects": [{ "type": "goto", "node": "other_node" }]
        },
        {
          "text": "Skill check",
          "check": {
            "name": "Check Name",
            "roll_expr": "roll('1d20')",
            "base_expr": "floor(($stat.stamina.cur - 10) / 2)",
            "buff_expr": "$buff.brave ?? 0",
            "dc": 12,
            "bands": {
              "crit_fail": { "range": "1" },
              "crit_success": { "range": "20" }
            },
            "success": {
              "effects": [
                { "type": "log", "text": "Success!" },
                { "type": "goto", "node": "success_node" }
              ]
            },
            "fail": {
              "effects": [
                { "type": "stat_add", "stat": "hp", "value_expr": "-3" },
                { "type": "log", "text": "Failed!" }
              ]
            }
          }
        }
      ]
    },
    "ending_node": {
      "type": "ending",
      "title": "Ending Title",
      "text": "Ending description."
    }
  }
}
```

### Endings
```json
"endings": [
  { "id": "dead", "conditions": ["$stat.hp.cur <= 0"], "node": "end_dead" },
  { "id": "win", "conditions": ["flag('victory')"], "node": "end_win" }
]
```

### Effect Types
| Type | Parameters | Description |
|------|------------|-------------|
| `stat_add` | `stat`, `value_expr` | Add value to stat.cur |
| `stat_set` | `stat`, `value_expr` | Set stat.cur to value |
| `stat_add_max` | `stat`, `value_expr` | Add value to stat.max |
| `item_add` | `item`, `count_expr` | Add items to inventory |
| `item_remove` | `item`, `count_expr` | Remove items |
| `buff_add` | `buff`, `value_expr`, `duration_days` | Add buff |
| `buff_remove` | `buff` | Remove buff |
| `flag_set` | `flag`, `value_expr` | Set flag value |
| `capacity_add` | `value_expr` | Increase inventory capacity |
| `advance_day` | `value_expr` | Advance time by days |
| `goto` | `node` | Navigate to story node |
| `log` | `text` or `text_expr` | Add log message |

### Expression Context
Available variables in expressions:
- `$stat.<name>.cur` / `$stat.<name>.max` - Stat values
- `$item.<id>` - Item count
- `$buff.<id>` - Aggregated buff value
- `$flag.<id>` - Flag value
- `$day` - Current day
- `$capacity` - Inventory capacity
- `$count` - Item count (in hold_buffs)
- `$value` - Buff value (in modifiers/periodic)

Available functions:
- `roll("NdM+K")` - Roll dice (e.g., "2d6+3")
- `itemCount(id)` - Get item count
- `hasItem(id, n)` - Check if has at least n items
- `hasBuff(id)` - Check if buff is active
- `flag(id)` - Get flag value
- `min()`, `max()`, `clamp()`, `floor()`, `ceil()`, `abs()`, `round()`, `random()`

## Validation

To validate a schema, run:
```bash
node scripts/validate-schema.js path/to/game.json
```

The validator checks:
1. Required top-level fields exist
2. All referenced items, buffs, shops, and nodes exist
3. Expression syntax is valid
4. Effect types are valid
5. Story graph connectivity

## Agent Workflow Examples

### Example: Adding a "Fatigue" Mechanic
**Task**: Add a stamina/hunger system that damages player HP when empty.
1. **Plan**: Add `stamina` and `hunger` to `stats`. Add a periodic event.
2. **Execute**: 
   - Add `"stamina": { "cur": 10, "max": 10 }` to `stats`.
   - Add `"hunger": { "cur": 0, "max": 100 }` to `stats`.
   - Add an event trigger `on_day_start` checking `$stat.hunger.cur >= 100` to apply `stat_add` HP `-5`.
3. **Verify**: Run `node scripts/validate-schema.js game.json`.

### Example: Fixing a Broken Link
**Task**: Resolver says story node `mountain_path` is missing.
1. **Search**: Find where `mountain_path` is referenced (in `choices` or `effects`).
2. **Resolve**: Either create the `mountain_path` node or fix the typo if it should be `mountain_pass`.
3. **Verify**: Re-run validator until 0 errors.

## Troubleshooting Checklist
- [ ] Is every `value_expr` wrapped in quotes as a string?
- [ ] Do all `$stat.<name>.cur` references use names that actually exist in the `stats` block?
- [ ] Does the `story.start` ID actually exist in `story.nodes`?
- [ ] Are all `item_add` effects using IDs present in the `items` block?
