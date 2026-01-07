# GameEdit Demo Engine

This is a minimal H5 engine that runs a JSON-configured story game. The runtime is pure browser JavaScript with a small UI so you can edit the DSL and see results quickly.

## Run

Because the browser blocks `file://` fetches, run a tiny server:

```bash
python3 -m http.server
```

Then open `http://localhost:8000/index.html`.

You can also use **Load JSON** to load a local file without restarting the server.

## DSL Overview

The engine loads `game.json` and expects these top-level sections:

- `resources`: capacity, etc.
- `stats`: each stat has `cur` and `max`.
- `items`: stackable items, `use_effects`, and `hold_buffs`.
- `buffs`: `modifiers` and optional `periodic` effects.
- `shops`: items with price, conditions, effects.
- `events`: triggers like `on_day_start`.
- `story`: `start` + `nodes` with `choices`.
- `endings`: global conditions that route to an ending node.

Currency is modeled as a stat (for example, `stats.money`) so any stat can be spent or rewarded.

### Checks (dice)
- Use `check` on a choice: `roll_expr`, `base_expr`, `buff_expr`, optional `total_expr`, `dc`, `bands` (crit ranges), and branches `success/fail/crit_success/crit_fail`.
- During a check, the context provides `$roll`, `$base`, `$buff_sum`, `$total`, `$dc`, `$buff.*`, and `$check` (object).

### Buff values
- Each buff can expose a `value_expr`, summed into `$buff.<id>` for expressions (e.g., checks).
- `hold_buffs` on items can scale with `$count` and contribute to `$buff`.

More detailed Chinese schema notes: `docs/schema.md`.

### Expression Context

Expressions are JS-like and can use:

- Variables: `$capacity`, `$day`, `$stat`, `$item`, `$flag`, `$count`, `$value`
- Functions: `roll("2d6+1")`, `itemCount("id")`, `hasItem("id", n)`, `hasBuff("id")`, `flag("id")`, `min`, `max`, `clamp`
  plus `floor`, `ceil`, `abs`, `round`, `random` for common math helpers.

### Effects Supported

- `capacity_add`
- `stat_add`, `stat_set`, `stat_add_max`
- `item_add`, `item_remove`
- `buff_add`, `buff_remove`
- `flag_set`
- `advance_day`, `goto`, `log`

### Holding Buffs Example

```json
"hold_buffs": [
  { "buff": "well_fed", "value_expr": "$count * 2" }
]
```

If you want a non-stacking buff, use a constant value:

```json
{ "buff": "well_fed", "value_expr": "5" }
```

## Notes

- All gameplay logic is data-driven via `conditions` and `effects`.
- UI is intentionally simple so you can replace it with your own H5 layout later.
