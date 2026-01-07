#!/usr/bin/env node
/**
 * Game Schema Validator
 * Validates game.json files against the GameEngine schema specification.
 * 
 * Usage: node scripts/validate-schema.js [path/to/game.json]
 * 
 * If no path is provided, validates ./game.json
 */

const fs = require("fs");
const path = require("path");

// ============ Validation Result ============

class ValidationResult {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  error(path, message) {
    this.errors.push({ path, message });
  }

  warn(path, message) {
    this.warnings.push({ path, message });
  }

  get isValid() {
    return this.errors.length === 0;
  }

  print() {
    if (this.errors.length > 0) {
      console.log("\n❌ Errors:");
      this.errors.forEach((e) => {
        console.log(`  [${e.path}] ${e.message}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log("\n⚠️  Warnings:");
      this.warnings.forEach((w) => {
        console.log(`  [${w.path}] ${w.message}`);
      });
    }

    if (this.isValid) {
      console.log("\n✅ Schema is valid!");
    } else {
      console.log(`\n❌ Schema has ${this.errors.length} error(s)`);
    }

    return this.isValid;
  }
}

// ============ Schema Validator ============

class SchemaValidator {
  constructor(schema) {
    this.schema = schema;
    this.result = new ValidationResult();

    // Collect all defined IDs
    this.definedStats = new Set(Object.keys(schema.stats || {}));
    this.definedItems = new Set(Object.keys(schema.items || {}));
    this.definedBuffs = new Set(Object.keys(schema.buffs || {}));
    this.definedShops = new Set(Object.keys(schema.shops || {}));
    this.definedNodes = new Set(Object.keys(schema.story?.nodes || {}));

    // Collect all referenced IDs
    this.referencedStats = new Set();
    this.referencedItems = new Set();
    this.referencedBuffs = new Set();
    this.referencedShops = new Set();
    this.referencedNodes = new Set();
  }

  validate() {
    this.validateMeta();
    this.validateStats();
    this.validateItems();
    this.validateBuffs();
    this.validateShops();
    this.validateEvents();
    this.validateStory();
    this.validateEndings();
    this.checkReferences();

    return this.result;
  }

  // ============ Top-level Validation ============

  validateMeta() {
    const meta = this.schema.meta;
    if (!meta) {
      this.result.warn("meta", "Missing meta field");
      return;
    }
    if (!meta.title) {
      this.result.warn("meta.title", "Missing title");
    }
  }

  validateStats() {
    const stats = this.schema.stats;
    if (!stats) {
      this.result.error("stats", "Missing stats field");
      return;
    }

    Object.entries(stats).forEach(([id, stat]) => {
      if (typeof stat !== "object") {
        this.result.error(`stats.${id}`, "Stat must be an object with cur/max");
        return;
      }
      if (typeof stat.cur !== "number") {
        this.result.error(`stats.${id}.cur`, "Missing or invalid cur value");
      }
      if (typeof stat.max !== "number") {
        this.result.error(`stats.${id}.max`, "Missing or invalid max value");
      }
      if (stat.cur > stat.max) {
        this.result.warn(`stats.${id}`, `cur (${stat.cur}) > max (${stat.max})`);
      }
    });
  }

  validateItems() {
    const items = this.schema.items;
    if (!items) return;

    Object.entries(items).forEach(([id, item]) => {
      const path = `items.${id}`;

      if (!item.name) {
        this.result.warn(`${path}.name`, "Missing item name");
      }

      // Validate use_effects
      if (item.use_effects) {
        this.validateEffects(item.use_effects, `${path}.use_effects`);
      }

      // Validate hold_buffs
      if (item.hold_buffs) {
        item.hold_buffs.forEach((hb, i) => {
          if (!hb.buff) {
            this.result.error(`${path}.hold_buffs[${i}].buff`, "Missing buff reference");
          } else {
            this.referencedBuffs.add(hb.buff);
          }
          if (hb.value_expr) {
            this.validateExpression(hb.value_expr, `${path}.hold_buffs[${i}].value_expr`);
          }
        });
      }
    });
  }

  validateBuffs() {
    const buffs = this.schema.buffs;
    if (!buffs) return;

    Object.entries(buffs).forEach(([id, buff]) => {
      const path = `buffs.${id}`;

      if (buff.value_expr) {
        this.validateExpression(buff.value_expr, `${path}.value_expr`);
      }

      // Validate modifiers
      if (buff.modifiers) {
        buff.modifiers.forEach((mod, i) => {
          const modPath = `${path}.modifiers[${i}]`;
          if (!mod.type) {
            this.result.error(`${modPath}.type`, "Missing modifier type");
          } else if (!["stat_add", "stat_add_max", "stat_set"].includes(mod.type)) {
            this.result.error(`${modPath}.type`, `Invalid modifier type: ${mod.type}`);
          }
          if (!mod.stat) {
            this.result.error(`${modPath}.stat`, "Missing stat reference");
          } else {
            this.referencedStats.add(mod.stat);
          }
          if (mod.value_expr) {
            this.validateExpression(mod.value_expr, `${modPath}.value_expr`);
          }
        });
      }

      // Validate periodic
      if (buff.periodic) {
        const periodicPath = `${path}.periodic`;
        if (!buff.periodic.every) {
          this.result.error(`${periodicPath}.every`, "Missing periodic trigger");
        }
        if (buff.periodic.effects) {
          this.validateEffects(buff.periodic.effects, `${periodicPath}.effects`);
        }
      }
    });
  }

  validateShops() {
    const shops = this.schema.shops;
    if (!shops) return;

    Object.entries(shops).forEach(([id, shop]) => {
      const path = `shops.${id}`;

      if (!shop.items || !Array.isArray(shop.items)) {
        this.result.error(`${path}.items`, "Shop must have items array");
        return;
      }

      shop.items.forEach((item, i) => {
        const itemPath = `${path}.items[${i}]`;
        if (!item.id) {
          this.result.error(`${itemPath}.id`, "Missing item id");
        } else {
          this.referencedItems.add(item.id);
        }
        if (item.conditions) {
          this.validateConditions(item.conditions, `${itemPath}.conditions`);
        }
        if (item.effects) {
          this.validateEffects(item.effects, `${itemPath}.effects`);
        }
      });
    });
  }

  validateEvents() {
    const events = this.schema.events;
    if (!events) return;

    if (!Array.isArray(events)) {
      this.result.error("events", "Events must be an array");
      return;
    }

    events.forEach((event, i) => {
      const path = `events[${i}]`;
      if (!event.trigger) {
        this.result.error(`${path}.trigger`, "Missing trigger");
      } else if (!["on_day_start", "on_day_end", "on_enter_node"].includes(event.trigger)) {
        this.result.warn(`${path}.trigger`, `Unknown trigger: ${event.trigger}`);
      }
      if (event.conditions) {
        this.validateConditions(event.conditions, `${path}.conditions`);
      }
      if (event.effects) {
        this.validateEffects(event.effects, `${path}.effects`);
      }
    });
  }

  validateStory() {
    const story = this.schema.story;
    if (!story) {
      this.result.error("story", "Missing story field");
      return;
    }

    if (!story.start) {
      this.result.error("story.start", "Missing start node");
    } else {
      this.referencedNodes.add(story.start);
    }

    if (!story.nodes || typeof story.nodes !== "object") {
      this.result.error("story.nodes", "Missing nodes object");
      return;
    }

    Object.entries(story.nodes).forEach(([id, node]) => {
      this.validateNode(id, node);
    });
  }

  validateNode(id, node) {
    const path = `story.nodes.${id}`;

    if (!node.title) {
      this.result.warn(`${path}.title`, "Missing node title");
    }

    // Validate shops reference
    if (node.shops) {
      node.shops.forEach((shopId) => {
        this.referencedShops.add(shopId);
      });
    }

    // Validate choices
    if (node.choices) {
      node.choices.forEach((choice, i) => {
        this.validateChoice(choice, `${path}.choices[${i}]`);
      });
    }
  }

  validateChoice(choice, path) {
    if (!choice.text) {
      this.result.warn(`${path}.text`, "Missing choice text");
    }

    if (choice.conditions) {
      this.validateConditions(choice.conditions, `${path}.conditions`);
    }

    if (choice.effects) {
      this.validateEffects(choice.effects, `${path}.effects`);
    }

    if (choice.check) {
      this.validateCheck(choice.check, `${path}.check`);
    }
  }

  validateCheck(check, path) {
    if (!check.name) {
      this.result.warn(`${path}.name`, "Missing check name");
    }
    if (!check.roll_expr) {
      this.result.error(`${path}.roll_expr`, "Missing roll expression");
    } else {
      this.validateExpression(check.roll_expr, `${path}.roll_expr`);
    }
    if (check.base_expr) {
      this.validateExpression(check.base_expr, `${path}.base_expr`);
    }
    if (check.buff_expr) {
      this.validateExpression(check.buff_expr, `${path}.buff_expr`);
    }
    if (check.dc === undefined) {
      this.result.error(`${path}.dc`, "Missing DC value");
    }

    // Validate branches
    ["success", "fail", "crit_success", "crit_fail"].forEach((branch) => {
      if (check[branch]?.effects) {
        this.validateEffects(check[branch].effects, `${path}.${branch}.effects`);
      }
    });
  }

  validateEndings() {
    const endings = this.schema.endings;
    if (!endings) return;

    if (!Array.isArray(endings)) {
      this.result.error("endings", "Endings must be an array");
      return;
    }

    endings.forEach((ending, i) => {
      const path = `endings[${i}]`;
      if (!ending.id) {
        this.result.error(`${path}.id`, "Missing ending id");
      }
      if (!ending.conditions) {
        this.result.error(`${path}.conditions`, "Missing conditions");
      } else {
        this.validateConditions(ending.conditions, `${path}.conditions`);
      }
      if (!ending.node) {
        this.result.error(`${path}.node`, "Missing ending node");
      } else {
        this.referencedNodes.add(ending.node);
      }
    });
  }

  // ============ Effect/Condition Validation ============

  validateEffects(effects, path) {
    if (!Array.isArray(effects)) {
      this.result.error(path, "Effects must be an array");
      return;
    }

    const validTypes = [
      "stat_add", "stat_set", "stat_add_max",
      "item_add", "item_remove",
      "buff_add", "buff_remove",
      "flag_set", "capacity_add",
      "advance_day", "goto", "log"
    ];

    effects.forEach((effect, i) => {
      const effectPath = `${path}[${i}]`;

      if (!effect.type) {
        this.result.error(`${effectPath}.type`, "Missing effect type");
        return;
      }

      if (!validTypes.includes(effect.type)) {
        this.result.error(`${effectPath}.type`, `Invalid effect type: ${effect.type}`);
        return;
      }

      // Type-specific validation
      switch (effect.type) {
        case "stat_add":
        case "stat_set":
        case "stat_add_max":
          if (!effect.stat) {
            this.result.error(`${effectPath}.stat`, "Missing stat");
          } else {
            this.referencedStats.add(effect.stat);
          }
          break;
        case "item_add":
        case "item_remove":
          if (!effect.item) {
            this.result.error(`${effectPath}.item`, "Missing item");
          } else {
            this.referencedItems.add(effect.item);
          }
          break;
        case "buff_add":
        case "buff_remove":
          if (!effect.buff) {
            this.result.error(`${effectPath}.buff`, "Missing buff");
          } else {
            this.referencedBuffs.add(effect.buff);
          }
          break;
        case "flag_set":
          if (!effect.flag) {
            this.result.error(`${effectPath}.flag`, "Missing flag");
          }
          break;
        case "goto":
          if (!effect.node) {
            this.result.error(`${effectPath}.node`, "Missing node");
          } else {
            this.referencedNodes.add(effect.node);
          }
          break;
        case "log":
          if (!effect.text && !effect.text_expr) {
            this.result.error(`${effectPath}`, "Missing text or text_expr");
          }
          break;
      }

      // Validate value expressions
      if (effect.value_expr) {
        this.validateExpression(effect.value_expr, `${effectPath}.value_expr`);
      }
      if (effect.count_expr) {
        this.validateExpression(effect.count_expr, `${effectPath}.count_expr`);
      }
    });
  }

  validateConditions(conditions, path) {
    const condList = Array.isArray(conditions) ? conditions : [conditions];
    condList.forEach((cond, i) => {
      this.validateExpression(cond, `${path}[${i}]`);
    });
  }

  // ============ Expression Validation ============

  validateExpression(expr, path) {
    if (typeof expr === "number" || typeof expr === "boolean") {
      return; // Valid literal
    }
    if (typeof expr !== "string") {
      this.result.error(path, `Invalid expression type: ${typeof expr}`);
      return;
    }

    // Basic syntax check - try to parse as JS
    try {
      // Replace $ variables with dummy values for syntax check
      const testExpr = expr
        .replace(/\$\w+(\.\w+)*/g, "1")
        .replace(/\?\?/g, "||"); // Handle nullish coalescing
      new Function(`return (${testExpr})`);
    } catch (e) {
      this.result.error(path, `Invalid expression syntax: ${expr}`);
    }

    // Extract referenced stats from $stat.xxx patterns
    const statMatches = expr.match(/\$stat\.(\w+)/g);
    if (statMatches) {
      statMatches.forEach((m) => {
        const stat = m.replace("$stat.", "").split(".")[0];
        this.referencedStats.add(stat);
      });
    }

    // Extract referenced buffs from $buff.xxx patterns
    const buffMatches = expr.match(/\$buff\.(\w+)/g);
    if (buffMatches) {
      buffMatches.forEach((m) => {
        const buff = m.replace("$buff.", "").split(".")[0];
        // Don't add to referenced if using ?? 0 pattern (optional)
      });
    }
  }

  // ============ Reference Checking ============

  checkReferences() {
    // Check stats
    this.referencedStats.forEach((stat) => {
      if (!this.definedStats.has(stat)) {
        this.result.error("references", `Undefined stat: ${stat}`);
      }
    });

    // Check items
    this.referencedItems.forEach((item) => {
      if (!this.definedItems.has(item)) {
        this.result.error("references", `Undefined item: ${item}`);
      }
    });

    // Check buffs
    this.referencedBuffs.forEach((buff) => {
      if (!this.definedBuffs.has(buff)) {
        this.result.error("references", `Undefined buff: ${buff}`);
      }
    });

    // Check shops
    this.referencedShops.forEach((shop) => {
      if (!this.definedShops.has(shop)) {
        this.result.error("references", `Undefined shop: ${shop}`);
      }
    });

    // Check nodes
    this.referencedNodes.forEach((node) => {
      if (!this.definedNodes.has(node)) {
        this.result.error("references", `Undefined node: ${node}`);
      }
    });

    // Check for orphan nodes (not reachable from start)
    const reachable = this.findReachableNodes();
    this.definedNodes.forEach((node) => {
      if (!reachable.has(node)) {
        this.result.warn("story", `Orphan node (not reachable from start): ${node}`);
      }
    });
  }

  findReachableNodes() {
    const reachable = new Set();
    const queue = [this.schema.story?.start];

    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (!nodeId || reachable.has(nodeId)) continue;

      reachable.add(nodeId);
      const node = this.schema.story?.nodes?.[nodeId];
      if (!node) continue;

      // Find all goto targets in this node
      const findGotoTargets = (effects) => {
        if (!effects) return [];
        return effects
          .filter((e) => e.type === "goto")
          .map((e) => e.node);
      };

      // Check choices
      if (node.choices) {
        node.choices.forEach((choice) => {
          const targets = findGotoTargets(choice.effects);
          targets.forEach((t) => queue.push(t));

          // Check in check branches
          if (choice.check) {
            ["success", "fail", "crit_success", "crit_fail"].forEach((branch) => {
              const branchTargets = findGotoTargets(choice.check[branch]?.effects);
              branchTargets.forEach((t) => queue.push(t));
            });
          }
        });
      }
    }

    // Also add ending nodes as reachable (they're destinations)
    this.schema.endings?.forEach((ending) => {
      if (ending.node) reachable.add(ending.node);
    });

    return reachable;
  }
}

// ============ Main ============

function main() {
  const args = process.argv.slice(2);
  const filePath = args[0] || "./game.json";

  console.log(`\n🎮 Validating schema: ${filePath}\n`);

  // Check file exists
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  // Read and parse JSON
  let schema;
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    schema = JSON.parse(content);
  } catch (e) {
    console.error(`❌ Failed to parse JSON: ${e.message}`);
    process.exit(1);
  }

  // Validate
  const validator = new SchemaValidator(schema);
  const result = validator.validate();

  // Print summary
  console.log(`📊 Schema Summary:`);
  console.log(`   Stats:   ${Object.keys(schema.stats || {}).length}`);
  console.log(`   Items:   ${Object.keys(schema.items || {}).length}`);
  console.log(`   Buffs:   ${Object.keys(schema.buffs || {}).length}`);
  console.log(`   Shops:   ${Object.keys(schema.shops || {}).length}`);
  console.log(`   Events:  ${(schema.events || []).length}`);
  console.log(`   Nodes:   ${Object.keys(schema.story?.nodes || {}).length}`);
  console.log(`   Endings: ${(schema.endings || []).length}`);

  const isValid = result.print();
  process.exit(isValid ? 0 : 1);
}

main();
