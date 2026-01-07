((exports) => {
  const DEFAULT_GAME_DATA = {
    meta: { title: "Dusty Gate", version: 1 },
    resources: { capacity: 6 },
    stats: {
      hp: { cur: 20, max: 20 },
      stamina: { cur: 6, max: 6 },
      hunger: { cur: 10, max: 100 },
      money: { cur: 20, max: 9999 }
    },
    items: {
      bread: {
        name: "Bread",
        stackable: true,
        start_count: 2,
        use_effects: [
          { type: "stat_add", stat: "hunger", value_expr: "-15" },
          { type: "log", text: "You eat bread and feel better." }
        ],
        hold_buffs: [{ buff: "well_fed", value_expr: "$count * 2" }]
      },
      key: {
        name: "Rusty Key",
        stackable: true,
        start_count: 0
      }
    },
    buffs: {
      well_fed: {
        desc: "Max HP bonus from food.",
        modifiers: [{ type: "stat_add_max", stat: "hp", value_expr: "$value" }],
        periodic: {
          every: "day",
          effects: [{ type: "stat_add", stat: "hp", value_expr: "1" }]
        }
      },
      brave: {
        desc: "Stamina feels lighter.",
        modifiers: [
          { type: "stat_add_max", stat: "stamina", value_expr: "1" },
          { type: "stat_add", stat: "stamina", value_expr: "1" }
        ]
      }
    },
    shops: {
      market: {
        name: "Market Stall",
        items: [
          {
            id: "bread",
            price: 4,
            conditions: ["$stat.money.cur >= 4"],
            effects: [
              { type: "stat_add", stat: "money", value_expr: "-4" },
              { type: "item_add", item: "bread", count_expr: "1" },
              { type: "log", text: "You bought bread." }
            ]
          },
          {
            id: "key",
            price: 12,
            conditions: ["$stat.money.cur >= 12"],
            effects: [
              { type: "stat_add", stat: "money", value_expr: "-12" },
              { type: "item_add", item: "key", count_expr: "1" },
              { type: "log", text: "You bought a rusty key." }
            ]
          }
        ]
      }
    },
    events: [
      {
        trigger: "on_day_start",
        effects: [
          { type: "stat_add", stat: "hunger", value_expr: "10" },
          { type: "log", text: "A day passes. Hunger rises." }
        ]
      },
      {
        trigger: "on_day_start",
        conditions: ["$stat.hunger.cur >= 80"],
        effects: [
          { type: "stat_add", stat: "hp", value_expr: "-2" },
          { type: "log", text: "Hunger hurts you." }
        ]
      }
    ],
    story: {
      start: "n1",
      nodes: {
        n1: {
          title: "Arrival",
          text:
            "Dust swirls around the old town. A market stall hums nearby while a sealed gate waits at the far end.",
          shops: ["market"],
          choices: [
            {
              text: "Visit the market",
              effects: [{ type: "goto", node: "n_market" }]
            },
            {
              text: "Walk to the gate",
              effects: [{ type: "goto", node: "n_gate" }]
            },
            {
              text: "Tell yourself to be brave",
              conditions: ["!hasBuff('brave')"],
              effects: [{ type: "buff_add", buff: "brave", value_expr: "1" }]
            },
            {
              text: "Rest for a day",
              effects: [{ type: "advance_day", value_expr: "1" }]
            }
          ]
        },
        n_market: {
          title: "Market Stall",
          text: "The vendor eyes you and waits for your choice.",
          shops: ["market"],
          choices: [{ text: "Return to the square", effects: [{ type: "goto", node: "n1" }] }]
        },
        n_gate: {
          title: "Sealed Gate",
          text: "The iron gate is locked and worn.",
          choices: [
            {
              text: "Force the gate (check)",
              check: {
                expr: "roll('1d20') + $stat.stamina.cur",
                dc: 12,
                success: {
                  effects: [
                    { type: "log", text: "The gate gives way." },
                    { type: "goto", node: "n_forest" }
                  ]
                },
                fail: {
                  effects: [
                    { type: "stat_add", stat: "hp", value_expr: "-3" },
                    { type: "log", text: "You fail and hurt yourself." }
                  ]
                }
              }
            },
            {
              text: "Return to the square",
              effects: [{ type: "goto", node: "n1" }]
            }
          ]
        },
        n_forest: {
          title: "Outer Forest",
          text:
            "Beyond the gate, a narrow trail leads into the forest. A small shrine glows faintly.",
          choices: [
            {
              text: "Unlock the shrine door",
              conditions: ["hasItem('key', 1)"],
              effects: [
                { type: "item_remove", item: "key", count_expr: "1" },
                { type: "goto", node: "n_shrine" }
              ]
            },
            {
              text: "Camp for the night",
              effects: [{ type: "advance_day", value_expr: "1" }]
            },
            {
              text: "Head back",
              effects: [{ type: "goto", node: "n1" }]
            }
          ]
        },
        n_shrine: {
          title: "Shrine",
          text: "Warm light fills the room. You feel safe enough to rest.",
          choices: [
            {
              text: "Rest and recover",
              effects: [
                { type: "stat_add", stat: "hp", value_expr: "6" },
                { type: "stat_add", stat: "hunger", value_expr: "-10" },
                { type: "advance_day", value_expr: "1" }
              ]
            },
            {
              text: "Leave quietly",
              effects: [{ type: "goto", node: "n1" }]
            }
          ]
        },
        end_dead: {
          type: "ending",
          title: "Silence",
          text: "Your journey ends here."
        }
      }
    },
    endings: [{ id: "dead", conditions: ["$stat.hp.cur <= 0"], node: "end_dead" }]
  };

  // DOM 元素只在浏览器环境下获取
  const dom = typeof document !== "undefined" ? {
    title: document.getElementById("game-title"),
    day: document.getElementById("hud-day"),
    storyTitle: document.getElementById("story-title"),
    storyText: document.getElementById("story-text"),
    choices: document.getElementById("story-choices"),
    stats: document.getElementById("stats"),
    invCapacity: document.getElementById("inv-capacity"),
    inventory: document.getElementById("inventory"),
    buffs: document.getElementById("buffs"),
    shops: document.getElementById("shops"),
    log: document.getElementById("log"),
    fileInput: document.getElementById("file-input"),
    reset: document.getElementById("btn-reset")
  } : {};

  const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

  const parseDiceBounds = (expr) => {
    if (typeof expr !== "string") {
      return null;
    }
    const match = expr.trim().match(/^(\d+)\s*d\s*(\d+)\s*([+-]\s*\d+)?$/i);
    if (!match) {
      return null;
    }
    const count = Number.parseInt(match[1], 10);
    const sides = Number.parseInt(match[2], 10);
    const mod = match[3] ? Number.parseInt(match[3].replace(/\s+/g, ""), 10) : 0;
    return {
      min: count * 1 + mod,
      max: count * sides + mod
    };
  };

  const parseRangeSet = (rangeStr, bounds) => {
    if (!rangeStr || !bounds) {
      return new Set();
    }
    const trimmed = String(rangeStr).trim();
    const m = trimmed.match(/^(-?\d+)\s*(?:-\s*(-?\d+))?$/);
    if (!m) {
      return new Set();
    }
    const start = Number.parseInt(m[1], 10);
    const end = m[2] ? Number.parseInt(m[2], 10) : start;
    const lo = Math.max(Math.min(start, end), bounds.min);
    const hi = Math.min(Math.max(start, end), bounds.max);
    const set = new Set();
    for (let v = lo; v <= hi; v += 1) {
      set.add(v);
    }
    return set;
  };

  const fillSuccessFailBands = (successSet, failSet, remaining) => {
    const result = { success: new Set(successSet), fail: new Set(failSet) };
    const pool = Array.from(remaining).sort((a, b) => a - b);
    if (pool.length === 0) {
      return result;
    }
    if (result.success.size === 0 && result.fail.size === 0) {
      // 平分剩余：较大的值为 success，较小的值为 fail
      const half = Math.floor(pool.length / 2);
      pool.forEach((val, idx) => {
        if (idx < half) {
          result.fail.add(val);
        } else {
          result.success.add(val);
        }
      });
      return result;
    }
    if (result.success.size === 0) {
      pool.forEach((val) => result.success.add(val));
      return result;
    }
    if (result.fail.size === 0) {
      pool.forEach((val) => result.fail.add(val));
      return result;
    }

    const weightS = result.success.size;
    const weightF = result.fail.size;
    const totalWeight = weightS + weightF || 1;
    const addSuccess = Math.round((pool.length * weightS) / totalWeight);
    const addFail = pool.length - addSuccess;
    pool.slice(0, addSuccess).forEach((val) => result.success.add(val));
    pool.slice(addSuccess, addSuccess + addFail).forEach((val) => result.fail.add(val));
    return result;
  };

  const aggregateBuffValues = (instances) => {
    const agg = {};
    instances.forEach((instance) => {
      if (!Number.isFinite(instance.value)) {
        return;
      }
      agg[instance.id] = (agg[instance.id] || 0) + instance.value;
    });
    return agg;
  };

  const computeBandSets = (bands, bounds, hasCritFail, hasCritSuccess) => {
    const rangeAll = bounds
      ? new Set(Array.from({ length: bounds.max - bounds.min + 1 }, (_, i) => bounds.min + i))
      : new Set();

    const critFailSet =
      (bands?.crit_fail && parseRangeSet(bands.crit_fail.range, bounds)) ||
      (hasCritFail && bounds ? new Set([bounds.min]) : new Set());
    const critSuccessSet =
      (bands?.crit_success && parseRangeSet(bands.crit_success.range, bounds)) ||
      (hasCritSuccess && bounds ? new Set([bounds.max]) : new Set());

    const occupied = new Set([...critFailSet, ...critSuccessSet]);
    const remainingAfterCrit = new Set([...rangeAll].filter((v) => !occupied.has(v)));

    // 只有当用户明确定义了 success 或 fail bands 时才解析
    const hasExplicitSuccessFail = Boolean(bands?.success || bands?.fail);
    const successSet = bands?.success ? parseRangeSet(bands.success.range, bounds) : new Set();
    const failSet = bands?.fail ? parseRangeSet(bands.fail.range, bounds) : new Set();

    // 只有当用户明确定义了 success/fail bands 时才自动填充剩余值
    let filledSuccess = successSet;
    let filledFail = failSet;
    if (hasExplicitSuccessFail) {
      const occupied2 = new Set([...successSet, ...failSet]);
      const remaining = new Set([...remainingAfterCrit].filter((v) => !occupied2.has(v)));
      const filled = fillSuccessFailBands(successSet, failSet, remaining);
      filledSuccess = filled.success;
      filledFail = filled.fail;
    }

    return {
      critFail: critFailSet,
      critSuccess: critSuccessSet,
      success: filledSuccess,
      fail: filledFail,
      // hasBands 表示是否有 crit bands 需要检查（普通 success/fail 由 DC 决定）
      hasCritBands: critFailSet.size > 0 || critSuccessSet.size > 0,
      hasExplicitSuccessFail: hasExplicitSuccessFail
    };
  };

  class GameEngine {
    constructor(data, render) {
      this.render = render;
      this.exprCache = new Map();
      this.load(data);
    }

    load(data) {
      this.data = data;
      this.compile();
      this.initState();
      this.syncDerived();
      this.render(this);
    }

    compile() {
      this.items = this.data.items || {};
      this.buffs = this.data.buffs || {};
      this.shops = this.data.shops || {};
      this.nodes = (this.data.story && this.data.story.nodes) || {};
      this.startNode = this.data.story && this.data.story.start;
      this.events = this.data.events || [];
      this.endings = this.data.endings || [];
    }

    initState() {
      const baseStats = deepClone(this.data.stats || {});
      const baseResources = deepClone(this.data.resources || {});
      const items = {};

      Object.keys(this.items).forEach((id) => {
        const startCount = this.items[id].start_count || 0;
        items[id] = startCount;
      });

      this.state = {
        baseStats,
        stats: deepClone(baseStats),
        resources: baseResources,
        items,
        flags: {},
        time: { day: 1 },
        story: { node: this.startNode },
        buffs: [],
        log: []
      };
    }

    buildContext(extra = {}) {
      const buffInstances = this.state._buffInstances || [];
      const buffValues = this.state._buffValues || {};
      const ctx = {
        ...extra,
        $capacity: this.state.resources.capacity ?? null,
        $day: this.state.time.day,
        $stat: this.state.stats,
        $item: this.state.items,
        $flag: this.state.flags,
        $buff: extra.$buff ?? buffValues,
        $check: extra.$check,
        $node: this.state.story.node,
        roll: (expr) => this.roll(expr),
        itemCount: (id) => this.getItemCount(id),
        hasItem: (id, count = 1) => this.getItemCount(id) >= count,
        hasBuff: (id) => buffInstances.some((b) => b.id === id),
        flag: (id) => Boolean(this.state.flags[id]),
        min: Math.min,
        max: Math.max,
        clamp: (value, min, max) => Math.min(Math.max(value, min), max),
        floor: Math.floor,
        ceil: Math.ceil,
        abs: Math.abs,
        round: Math.round,
        random: Math.random
      };
      return ctx;
    }

    evalExpr(expr, extra = {}) {
      if (expr === null || expr === undefined) {
        return 0;
      }
      if (typeof expr === "number" || typeof expr === "boolean") {
        return expr;
      }
      if (typeof expr !== "string") {
        return expr;
      }
      const trimmed = expr.trim();
      if (!trimmed) {
        return 0;
      }

      let fn = this.exprCache.get(trimmed);
      if (!fn) {
        try {
          fn = new Function("ctx", `with (ctx) { return (${trimmed}); }`);
          this.exprCache.set(trimmed, fn);
        } catch (syntaxError) {
          this.addLog(`Expr error: ${trimmed}`);
          console.warn("Expression syntax error:", trimmed, syntaxError);
          return 0;
        }
      }
      try {
        return fn(this.buildContext(extra));
      } catch (error) {
        this.addLog(`Expr error: ${trimmed}`);
        console.warn("Expression error:", trimmed, error);
        return 0;
      }
    }

    checkConditions(conditions, extra = {}) {
      if (!conditions || conditions.length === 0) {
        return true;
      }
      const list = Array.isArray(conditions) ? conditions : [conditions];
      return list.every((expr) => Boolean(this.evalExpr(expr, extra)));
    }

    roll(expr) {
      if (typeof expr !== "string") {
        return 0;
      }
      const match = expr.trim().match(/^(\d+)\s*d\s*(\d+)\s*([+-]\s*\d+)?$/i);
      if (!match) {
        return 0;
      }
      const count = Number.parseInt(match[1], 10);
      const sides = Number.parseInt(match[2], 10);
      const mod = match[3] ? Number.parseInt(match[3].replace(/\s+/g, ""), 10) : 0;
      let total = mod;
      for (let i = 0; i < count; i += 1) {
        total += Math.floor(Math.random() * sides) + 1;
      }
      return total;
    }

    addLog(text) {
      if (!text) {
        return;
      }
      this.state.log.unshift({ text, at: Date.now() });
      this.state.log = this.state.log.slice(0, 12);
    }

    getItemCount(id) {
      return this.state.items[id] || 0;
    }

    inventoryCount() {
      return Object.values(this.state.items).reduce((sum, count) => sum + count, 0);
    }

    applyEffects(effects, extra = {}) {
      if (!effects || effects.length === 0) {
        return;
      }
      effects.forEach((effect) => this.applyEffect(effect, extra));
    }

    applyEffect(effect, extra = {}) {
      if (!effect || !effect.type) {
        return;
      }
      switch (effect.type) {
        case "money_add": {
          const value = Number(this.evalExpr(effect.value_expr ?? effect.value ?? 0, extra));
          this.updateStat("money", (current) => current + value);
          break;
        }
        case "capacity_add": {
          const value = Number(this.evalExpr(effect.value_expr ?? effect.value ?? 0, extra));
          this.state.resources.capacity = (this.state.resources.capacity || 0) + value;
          break;
        }
        case "stat_add": {
          const value = Number(this.evalExpr(effect.value_expr ?? effect.value ?? 0, extra));
          const change = this.updateStat(effect.stat, (current) => current + value);
          const changeLog = this.formatStatChange(change);
          if (changeLog) this.addLog(changeLog);
          break;
        }
        case "stat_set": {
          const value = Number(this.evalExpr(effect.value_expr ?? effect.value ?? 0, extra));
          const change = this.updateStat(effect.stat, () => value);
          const changeLog = this.formatStatChange(change);
          if (changeLog) this.addLog(changeLog);
          break;
        }
        case "stat_add_max": {
          const value = Number(this.evalExpr(effect.value_expr ?? effect.value ?? 0, extra));
          if (this.state.baseStats[effect.stat]) {
            const before = this.state.baseStats[effect.stat].max;
            this.state.baseStats[effect.stat].max += value;
            const after = this.state.baseStats[effect.stat].max;
            if (before !== after) {
              const sign = value > 0 ? "+" : "";
              this.addLog(`${effect.stat}.max: ${before} -> ${after} (${sign}${value})`);
            }
          }
          break;
        }
        case "item_add": {
          const count = Number(this.evalExpr(effect.count_expr ?? effect.value_expr ?? effect.count ?? 1, extra));
          this.addItem(effect.item, count);
          break;
        }
        case "item_remove": {
          const count = Number(this.evalExpr(effect.count_expr ?? effect.value_expr ?? effect.count ?? 1, extra));
          this.addItem(effect.item, -count);
          break;
        }
        case "buff_add": {
          this.addBuff(effect.buff, effect.value_expr ?? effect.value ?? "1", effect.duration_days);
          break;
        }
        case "buff_remove": {
          this.removeBuff(effect.buff);
          break;
        }
        case "flag_set": {
          const value = this.evalExpr(effect.value_expr ?? effect.value ?? true, extra);
          this.state.flags[effect.flag] = value;
          break;
        }
        case "advance_day": {
          const days = Number(this.evalExpr(effect.value_expr ?? effect.value ?? 1, extra));
          this.advanceDay(days);
          break;
        }
        case "goto": {
          this.gotoNode(effect.node);
          break;
        }
        case "log": {
          const text = effect.text_expr
            ? String(this.evalExpr(effect.text_expr, extra))
            : effect.text;
          this.addLog(text);
          break;
        }
        default:
          console.warn("Unknown effect:", effect.type);
      }
    }

    updateStat(stat, updater, options = {}) {
      if (!stat || !this.state.baseStats[stat]) {
        return null;
      }
      const before = this.state.baseStats[stat].cur;
      this.state.baseStats[stat].cur = updater(before);
      const after = this.state.baseStats[stat].cur;
      
      // 返回变化信息
      return { stat, before, after, delta: after - before };
    }

    /**
     * 格式化 stat 变化为日志字符串
     */
    formatStatChange(change) {
      if (!change || change.delta === 0) return null;
      const sign = change.delta > 0 ? "+" : "";
      return `${change.stat}: ${change.before} -> ${change.after} (${sign}${change.delta})`;
    }

    addItem(itemId, count) {
      if (!itemId || !Number.isFinite(count)) {
        return;
      }
      const current = this.state.items[itemId] || 0;
      if (count > 0) {
        const capacity = this.state.resources.capacity;
        if (Number.isFinite(capacity) && capacity >= 0) {
          const total = this.inventoryCount();
          if (total + count > capacity) {
            this.addLog("Inventory is full.");
            return;
          }
        }
      }
      const next = Math.max(0, current + count);
      this.state.items[itemId] = next;
    }

    addBuff(buffId, valueExpr, durationDays) {
      if (!buffId || !this.buffs[buffId]) {
        return;
      }
      const def = this.buffs[buffId];
      this.state.buffs.push({
        id: buffId,
        value_expr: valueExpr ?? def.value_expr ?? "1",
        duration_days: durationDays ?? null
      });
    }

    removeBuff(buffId) {
      this.state.buffs = this.state.buffs.filter((buff) => buff.id !== buffId);
    }

    advanceDay(days) {
      const total = Math.max(1, days || 1);
      for (let i = 0; i < total; i += 1) {
        this.syncDerived();
        this.state.time.day += 1;
        this.runEvents("on_day_start");
        this.runBuffPeriodic("day");
        this.tickBuffDurations();
      }
    }

    tickBuffDurations() {
      this.state.buffs = this.state.buffs
        .map((buff) => {
          if (buff.duration_days === null || buff.duration_days === undefined) {
            return buff;
          }
          return { ...buff, duration_days: buff.duration_days - 1 };
        })
        .filter((buff) => buff.duration_days === null || buff.duration_days > 0);
    }

    gotoNode(nodeId) {
      if (!nodeId || !this.nodes[nodeId]) {
        return;
      }
      this.state.story.node = nodeId;
      const node = this.nodes[nodeId];
      if (node.on_enter) {
        this.applyEffects(node.on_enter);
      }
      this.runEvents("on_enter_node", { $node: nodeId });
    }

    runEvents(trigger, extra = {}) {
      this.events.forEach((event) => {
        if (event.trigger !== trigger) {
          return;
        }
        if (!this.checkConditions(event.conditions, extra)) {
          return;
        }
        this.applyEffects(event.effects, extra);
      });
    }

    runBuffPeriodic(every) {
      const buffInstances = this.computeBuffInstances();
      buffInstances.forEach((instance) => {
        const buffDef = this.buffs[instance.id];
        if (!buffDef || !buffDef.periodic || buffDef.periodic.every !== every) {
          return;
        }
        const extra = { $value: instance.value };
        if (!this.checkConditions(buffDef.periodic.conditions, extra)) {
          return;
        }
        this.applyEffects(buffDef.periodic.effects, extra);
      });
    }

    runCheck(check) {
      const buffValues = this.state._buffValues || {};
      const rollExpr = check.roll_expr || check.expr || "roll('1d20')";
      const rollValue = Number(this.evalExpr(rollExpr));
      const baseValue = Number(this.evalExpr(check.base_expr || "0", { $roll: rollValue }));
      const buffSum = Number(
        this.evalExpr(check.buff_expr || "0", {
          $roll: rollValue,
          $base: baseValue,
          $buff: buffValues
        })
      );
      const totalValue = Number(
        this.evalExpr(check.total_expr || "$roll + $base + $buff_sum", {
          $roll: rollValue,
          $base: baseValue,
          $buff_sum: buffSum,
          $buff: buffValues
        })
      );
      const dcValue = Number(
        this.evalExpr(check.dc ?? 0, {
          $roll: rollValue,
          $base: baseValue,
          $buff_sum: buffSum,
          $total: totalValue,
          $buff: buffValues
        })
      );

      const bounds = parseDiceBounds(rollExpr) || parseDiceBounds("1d20");
      const bandSets = computeBandSets(
        check.bands || {},
        bounds,
        Boolean(check.crit_fail),
        Boolean(check.crit_success)
      );
      const inSet = (set) => set && set.size > 0 && set.has(Math.round(rollValue));
      let result = null;
      
      // 1. 先检查 crit bands（基于 roll 值）
      if (bandSets && bandSets.hasCritBands) {
        if (inSet(bandSets.critFail)) {
          result = "crit_fail";
        } else if (inSet(bandSets.critSuccess)) {
          result = "crit_success";
        }
      }
      
      // 2. 如果用户明确定义了 success/fail bands，使用它们（基于 roll 值）
      if (!result && bandSets && bandSets.hasExplicitSuccessFail) {
        if (inSet(bandSets.success)) {
          result = "success";
        } else if (inSet(bandSets.fail)) {
          result = "fail";
        }
      }
      
      // 3. 否则，使用 total vs DC 判断
      if (!result) {
        result = totalValue >= dcValue ? "success" : "fail";
      }
      // 选择效果分支，crit 结果可以回退到普通结果
      const branch =
        (result === "crit_fail" && (check.crit_fail || check.fail)) ||
        (result === "crit_success" && (check.crit_success || check.success)) ||
        (result === "success" && check.success) ||
        (result === "fail" && check.fail);

      const checkCtx = {
        name: check.name || "Check",
        roll: rollValue,
        base: baseValue,
        buff: buffSum,
        total: totalValue,
        dc: dcValue,
        result
      };
      const resultLabel =
        result === "crit_success"
          ? "CRIT SUCCESS"
          : result === "crit_fail"
            ? "CRIT FAIL"
            : result.toUpperCase();
      this.addLog(
        `${checkCtx.name} | roll ${rollValue} + base ${baseValue} + buff ${buffSum} = ${totalValue} vs DC ${dcValue} -> ${resultLabel}`
      );

      if (branch) {
        this.applyEffects(branch.effects, { $check: checkCtx });
        if (branch.goto) {
          this.gotoNode(branch.goto);
        }
      }
    }

    computeBuffInstances() {
      const instances = [];

      this.state.buffs.forEach((buff) => {
        const value = Number(this.evalExpr(buff.value_expr ?? "1"));
        if (!Number.isFinite(value)) {
          return;
        }
        instances.push({ id: buff.id, value, source: "active" });
      });

      Object.entries(this.items).forEach(([itemId, itemDef]) => {
        const count = this.getItemCount(itemId);
        if (!count || !itemDef.hold_buffs) {
          return;
        }
        itemDef.hold_buffs.forEach((hold) => {
          const value = Number(this.evalExpr(hold.value_expr ?? "1", { $count: count }));
          if (!Number.isFinite(value) || value === 0) {
            return;
          }
          instances.push({ id: hold.buff, value, source: `hold:${itemId}` });
        });
      });

      return instances;
    }

    syncDerived() {
      const previousBuffs = this.state._buffInstances || [];
      this.state.stats = deepClone(this.state.baseStats);
      this.state._buffInstances = previousBuffs;

      const buffInstances = this.computeBuffInstances();
      const buffValues = aggregateBuffValues(buffInstances);
      const derive = () => {
        const derived = deepClone(this.state.baseStats);
        buffInstances.forEach((instance) => {
          const buffDef = this.buffs[instance.id];
          if (!buffDef || !buffDef.modifiers) {
            return;
          }
          buffDef.modifiers.forEach((modifier) => {
            const value = Number(this.evalExpr(modifier.value_expr ?? "$value", { $value: instance.value }));
            if (!derived[modifier.stat]) {
              return;
            }
            switch (modifier.type) {
              case "stat_add_max":
                derived[modifier.stat].max += value;
                break;
              case "stat_add":
                derived[modifier.stat].cur += value;
                break;
              default:
                break;
            }
          });
        });

        Object.keys(derived).forEach((stat) => {
          const data = derived[stat];
          data.max = Math.max(0, data.max);
          data.cur = Math.min(Math.max(0, data.cur), data.max);
        });
        return derived;
      };

      let derived = derive();
      Object.keys(this.state.baseStats).forEach((stat) => {
        if (this.state.baseStats[stat].cur > derived[stat].max) {
          this.state.baseStats[stat].cur = derived[stat].max;
        }
        if (this.state.baseStats[stat].cur < 0) {
          this.state.baseStats[stat].cur = 0;
        }
      });
      derived = derive();

      this.state.stats = derived;
      this.state._buffInstances = buffInstances;
      this.state._buffValues = buffValues;
    }

    checkEndings() {
      if (!this.endings || this.endings.length === 0) {
        return;
      }
      if (this.state.ending) {
        return;
      }
      for (const ending of this.endings) {
        if (this.checkConditions(ending.conditions)) {
          this.state.ending = ending.id;
          if (ending.node) {
            this.gotoNode(ending.node);
          }
          break;
        }
      }
    }

    choose(choice) {
      if (!choice) {
        return;
      }
      if (!this.checkConditions(choice.conditions)) {
        return;
      }

      if (choice.check) {
        this.runCheck(choice.check);
      } else {
        this.applyEffects(choice.effects);
        if (choice.goto) {
          this.gotoNode(choice.goto);
        }
      }
      this.afterAction();
    }

    buy(shopId, itemId) {
      const shop = this.shops[shopId];
      if (!shop) {
        return;
      }
      const entry = shop.items.find((item) => item.id === itemId);
      if (!entry) {
        return;
      }
      if (!this.checkConditions(entry.conditions)) {
        return;
      }
      this.applyEffects(entry.effects);
      this.afterAction();
    }

    useItem(itemId) {
      const item = this.items[itemId];
      if (!item) {
        return;
      }
      if (this.getItemCount(itemId) <= 0) {
        return;
      }
      if (item.use_effects && item.use_effects.length > 0) {
        this.applyEffects(item.use_effects);
      }
      this.addItem(itemId, -1);
      this.afterAction();
    }

    afterAction() {
      this.syncDerived();
      this.checkEndings();
      this.render(this);
    }
  }

  const render = (engine) => {
    const node = engine.nodes[engine.state.story.node] || {};
    dom.title.textContent = engine.data.meta?.title || "GameEdit Demo";
    dom.day.textContent = engine.state.time.day;

    dom.storyTitle.textContent = node.title || "Story";
    dom.storyText.textContent = node.text || "";

    dom.choices.innerHTML = "";
    const choices = node.choices || [];
    choices.forEach((choice) => {
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = choice.text || "Choice";
      const canChoose = engine.checkConditions(choice.conditions);
      btn.disabled = !canChoose || node.type === "ending";
      btn.addEventListener("click", () => engine.choose(choice));
      dom.choices.appendChild(btn);
    });

    dom.stats.innerHTML = "";
    Object.entries(engine.state.stats).forEach(([stat, data]) => {
      const row = document.createElement("div");
      row.className = "stat-row";
      const label = document.createElement("div");
      label.className = "stat-name";
      label.textContent = `${stat.toUpperCase()} ${Math.round(data.cur)}/${Math.round(data.max)}`;
      const bar = document.createElement("div");
      bar.className = "stat-bar";
      const fill = document.createElement("div");
      fill.className = "stat-fill";
      const pct = data.max > 0 ? Math.max(0, Math.min(1, data.cur / data.max)) * 100 : 0;
      fill.style.width = `${pct}%`;
      bar.appendChild(fill);
      const wrapper = document.createElement("div");
      wrapper.appendChild(label);
      wrapper.appendChild(bar);
      row.appendChild(wrapper);
      dom.stats.appendChild(row);
    });

    const capacity = engine.state.resources.capacity;
    dom.invCapacity.textContent = Number.isFinite(capacity)
      ? `Capacity ${engine.inventoryCount()}/${capacity}`
      : `Capacity ${engine.inventoryCount()}`;

    dom.inventory.innerHTML = "";
    Object.entries(engine.items).forEach(([id, item]) => {
      const count = engine.getItemCount(id);
      if (!count) {
        return;
      }
      const line = document.createElement("div");
      line.className = "inv-item";
      const info = document.createElement("div");
      info.textContent = `${item.name || id} x${count}`;
      line.appendChild(info);
      if (item.use_effects && item.use_effects.length > 0) {
        const btn = document.createElement("button");
        btn.className = "btn secondary";
        btn.textContent = "Use";
        btn.addEventListener("click", () => engine.useItem(id));
        line.appendChild(btn);
      }
      dom.inventory.appendChild(line);
    });

    dom.buffs.innerHTML = "";
    const buffInstances = engine.state._buffInstances || [];
    if (buffInstances.length === 0) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "No active buffs.";
      dom.buffs.appendChild(empty);
    } else {
      buffInstances.forEach((instance) => {
        const buffDef = engine.buffs[instance.id];
        const line = document.createElement("div");
        line.className = "buff-item";
        const info = document.createElement("div");
        const name = buffDef?.desc || instance.id;
        info.textContent = `${name} (${instance.value})`;
        line.appendChild(info);
        dom.buffs.appendChild(line);
      });
    }

    dom.shops.innerHTML = "";
    const shopIds = node.shops || [];
    shopIds.forEach((shopId) => {
      const shop = engine.shops[shopId];
      if (!shop) {
        return;
      }
      const title = document.createElement("div");
      title.className = "side-title";
      title.textContent = shop.name || shopId;
      dom.shops.appendChild(title);
      shop.items.forEach((entry) => {
        const line = document.createElement("div");
        line.className = "shop-item";
        const info = document.createElement("div");
        const itemName = engine.items[entry.id]?.name || entry.id;
        info.textContent = `${itemName} - ${entry.price ?? ""}`;
        line.appendChild(info);
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.textContent = "Buy";
        btn.disabled = !engine.checkConditions(entry.conditions);
        btn.addEventListener("click", () => engine.buy(shopId, entry.id));
        line.appendChild(btn);
        dom.shops.appendChild(line);
      });
    });

    dom.log.innerHTML = "";
    engine.state.log.forEach((entry) => {
      const line = document.createElement("div");
      line.className = "log-entry";
      line.textContent = entry.text;
      dom.log.appendChild(line);
    });
  };

  const loadJsonFromFile = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(reader.result));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });

  const boot = async () => {
    let data = null;
    try {
      const response = await fetch("game.json");
      if (response.ok) {
        data = await response.json();
      }
    } catch (error) {
      console.warn("Failed to load game.json, using default demo.", error);
    }
    if (!data) {
      data = DEFAULT_GAME_DATA;
    }

    const engine = new GameEngine(data, render);
    dom.reset.addEventListener("click", () => engine.load(data));
    dom.fileInput.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) {
        return;
      }
      try {
        const json = await loadJsonFromFile(file);
        engine.load(json);
      } catch (error) {
        engine.addLog("Invalid JSON file.");
        engine.render(engine);
      }
    });
  };

  // 导出供测试使用
  if (exports) {
    exports.GameEngine = GameEngine;
    exports.DEFAULT_GAME_DATA = DEFAULT_GAME_DATA;
    exports.parseDiceBounds = parseDiceBounds;
    exports.parseRangeSet = parseRangeSet;
    exports.fillSuccessFailBands = fillSuccessFailBands;
    exports.computeBandSets = computeBandSets;
    exports.aggregateBuffValues = aggregateBuffValues;
    exports.deepClone = deepClone;
  }

  // 浏览器环境下自动启动
  if (typeof window !== "undefined") {
    boot();
  }
})(typeof module !== "undefined" ? module.exports : null);
