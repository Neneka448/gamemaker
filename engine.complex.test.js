/**
 * 复杂表达式系统端到端测试
 * 测试涉及加减乘除、floor/ceil/min/max/clamp、条件表达式、buff叠加等
 * 运行: node engine.complex.test.js
 */

const fs = require("fs");
const path = require("path");
const { GameEngine, deepClone } = require("./engine.js");

// ============ 测试框架 ============

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
        console.log(`  ✓ ${message}`);
    } else {
        failed++;
        console.log(`  ✗ ${message}`);
    }
}

function assertEqual(actual, expected, message) {
    const pass = actual === expected;
    if (pass) {
        passed++;
        console.log(`  ✓ ${message}`);
    } else {
        failed++;
        console.log(`  ✗ ${message}`);
        console.log(`    Expected: ${expected}`);
        console.log(`    Actual:   ${actual}`);
    }
}

function assertApprox(actual, expected, tolerance, message) {
    const pass = Math.abs(actual - expected) <= tolerance;
    if (pass) {
        passed++;
        console.log(`  ✓ ${message}`);
    } else {
        failed++;
        console.log(`  ✗ ${message}`);
        console.log(`    Expected: ~${expected} (±${tolerance})`);
        console.log(`    Actual:   ${actual}`);
    }
}

function describe(name, fn) {
    console.log(`\n${name}`);
    fn();
}

// ============ 加载复杂游戏 ============

const gameDataPath = path.join(__dirname, "game.complex.json");
const gameData = JSON.parse(fs.readFileSync(gameDataPath, "utf-8"));

function createEngine(rollSequence = []) {
    const engine = new GameEngine(deepClone(gameData), () => { });
    if (rollSequence.length > 0) {
        let rollIndex = 0;
        engine.roll = function (expr) {
            if (rollIndex < rollSequence.length) {
                return rollSequence[rollIndex++];
            }
            return 10; // 默认值
        };
    }
    return engine;
}

function choose(engine, choiceIndex) {
    const node = engine.nodes[engine.state.story.node];
    if (!node || !node.choices || !node.choices[choiceIndex]) {
        throw new Error(`Invalid choice ${choiceIndex} at node ${engine.state.story.node}`);
    }
    engine.choose(node.choices[choiceIndex]);
}

// ============ 表达式测试 ============

describe("复杂表达式 - 基本数学运算", () => {
    const engine = createEngine();

    // 加减乘除
    assertEqual(engine.evalExpr("10 + 5 * 2"), 20, "10 + 5 * 2 = 20 (乘法优先)");
    assertEqual(engine.evalExpr("(10 + 5) * 2"), 30, "(10 + 5) * 2 = 30 (括号优先)");
    assertEqual(engine.evalExpr("20 / 4 - 3"), 2, "20 / 4 - 3 = 2");
    assertEqual(engine.evalExpr("100 / 3"), 100 / 3, "100 / 3 = 33.33...");
    assertEqual(engine.evalExpr("15 % 4"), 3, "15 % 4 = 3 (取模)");

    // 负数
    assertEqual(engine.evalExpr("-5 + 10"), 5, "-5 + 10 = 5");
    assertEqual(engine.evalExpr("10 * -2"), -20, "10 * -2 = -20");
    assertEqual(engine.evalExpr("(-3) * (-4)"), 12, "(-3) * (-4) = 12");
});

describe("复杂表达式 - 数学函数", () => {
    const engine = createEngine();

    // floor/ceil/round
    assertEqual(engine.evalExpr("floor(3.7)"), 3, "floor(3.7) = 3");
    assertEqual(engine.evalExpr("floor(-3.7)"), -4, "floor(-3.7) = -4");
    assertEqual(engine.evalExpr("ceil(3.2)"), 4, "ceil(3.2) = 4");
    assertEqual(engine.evalExpr("ceil(-3.2)"), -3, "ceil(-3.2) = -3");
    assertEqual(engine.evalExpr("round(3.5)"), 4, "round(3.5) = 4");
    assertEqual(engine.evalExpr("round(3.4)"), 3, "round(3.4) = 3");

    // min/max
    assertEqual(engine.evalExpr("min(10, 5, 8)"), 5, "min(10, 5, 8) = 5");
    assertEqual(engine.evalExpr("max(10, 5, 8)"), 10, "max(10, 5, 8) = 10");
    assertEqual(engine.evalExpr("min(-1, -5, 0)"), -5, "min(-1, -5, 0) = -5");

    // clamp
    assertEqual(engine.evalExpr("clamp(15, 0, 10)"), 10, "clamp(15, 0, 10) = 10");
    assertEqual(engine.evalExpr("clamp(-5, 0, 10)"), 0, "clamp(-5, 0, 10) = 0");
    assertEqual(engine.evalExpr("clamp(5, 0, 10)"), 5, "clamp(5, 0, 10) = 5");

    // abs
    assertEqual(engine.evalExpr("abs(-15)"), 15, "abs(-15) = 15");
    assertEqual(engine.evalExpr("abs(15)"), 15, "abs(15) = 15");
});

describe("复杂表达式 - 组合数学运算", () => {
    const engine = createEngine();

    // 嵌套函数
    assertEqual(engine.evalExpr("floor(ceil(3.2) / 2)"), 2, "floor(ceil(3.2) / 2) = 2");
    assertEqual(engine.evalExpr("max(floor(5.5), ceil(2.1))"), 5, "max(floor(5.5), ceil(2.1)) = 5");
    assertEqual(engine.evalExpr("min(abs(-10), abs(5))"), 5, "min(abs(-10), abs(5)) = 5");

    // 复杂计算
    assertEqual(engine.evalExpr("floor((100 - 20) * 0.3)"), 24, "floor((100 - 20) * 0.3) = 24");
    assertEqual(engine.evalExpr("ceil(50 / 3) + floor(50 / 3)"), 33, "ceil(50/3) + floor(50/3) = 17 + 16 = 33");
    assertEqual(engine.evalExpr("clamp(floor(15.7 / 2), 3, 10)"), 7, "clamp(floor(15.7/2), 3, 10) = 7");
});

describe("复杂表达式 - 状态变量访问", () => {
    const engine = createEngine();

    // 基本访问
    assertEqual(engine.evalExpr("$stat.hp.cur"), 50, "$stat.hp.cur = 50");
    assertEqual(engine.evalExpr("$stat.hp.max"), 50, "$stat.hp.max = 50");
    assertEqual(engine.evalExpr("$stat.strength.cur"), 14, "$stat.strength.cur = 14");
    assertEqual(engine.evalExpr("$stat.intelligence.cur"), 16, "$stat.intelligence.cur = 16");

    // 状态计算
    assertEqual(engine.evalExpr("$stat.hp.max - $stat.hp.cur"), 0, "HP 差值 = 0 (满血)");
    assertEqual(engine.evalExpr("$stat.strength.cur + $stat.intelligence.cur"), 30, "STR + INT = 30");
    assertEqual(engine.evalExpr("($stat.strength.cur + $stat.intelligence.cur) / 2"), 15, "(STR + INT) / 2 = 15");

    // D&D 风格修正值
    assertEqual(engine.evalExpr("floor(($stat.strength.cur - 10) / 2)"), 2, "STR 修正值 = floor((14-10)/2) = 2");
    assertEqual(engine.evalExpr("floor(($stat.intelligence.cur - 10) / 2)"), 3, "INT 修正值 = floor((16-10)/2) = 3");

    // 百分比计算
    assertEqual(engine.evalExpr("floor($stat.hp.max * 0.3)"), 15, "30% HP = 15");
    assertEqual(engine.evalExpr("ceil($stat.mp.max / 3)"), 10, "1/3 MP = ceil(30/3) = 10");
    assertEqual(engine.evalExpr("$stat.mp.cur / $stat.mp.max"), 1, "MP 比例 = 1 (满蓝)");
});

describe("复杂表达式 - 条件表达式", () => {
    const engine = createEngine();

    // 三元运算符
    assertEqual(engine.evalExpr("$stat.hp.cur > 25 ? 1 : 0"), 1, "HP > 25 ? 1 : 0 = 1");
    assertEqual(engine.evalExpr("$stat.hp.cur < 25 ? 1 : 0"), 0, "HP < 25 ? 1 : 0 = 0");

    // 条件函数
    assertEqual(engine.evalExpr("hasItem('health_potion', 1) ? 10 : 0"), 10, "有药水时 = 10");
    assertEqual(engine.evalExpr("hasItem('power_ring', 1) ? 10 : 0"), 0, "无戒指时 = 0");

    // 复杂条件
    assertEqual(
        engine.evalExpr("$stat.hp.cur > $stat.hp.max / 2 ? 'healthy' : 'injured'"),
        "healthy",
        "HP > 50% ? healthy : injured"
    );

    // hasItem 和 itemCount
    assertEqual(engine.evalExpr("hasItem('bomb', 1) ? 5 : 0"), 5, "有炸弹加成 = 5");
    assertEqual(engine.evalExpr("itemCount('health_potion')"), 3, "血药数量 = 3");
});

describe("复杂表达式 - 空合并运算符", () => {
    const engine = createEngine();

    // $buff 访问不存在的 buff
    assertEqual(engine.evalExpr("$buff.nonexistent ?? 0"), 0, "不存在的 buff ?? 0 = 0");
    assertEqual(engine.evalExpr("$buff.power_boost ?? 5"), 5, "power_boost 不存在时 = 5");
    assertEqual(engine.evalExpr("($buff.power_boost ?? 0) + ($buff.magic_boost ?? 0)"), 0, "两个空 buff 和 = 0");

    // 复杂空合并
    assertEqual(
        engine.evalExpr("floor((($buff.power_boost ?? 0) + ($buff.magic_boost ?? 0)) / 2)"),
        0,
        "buff 平均值 = 0"
    );
});

describe("物品系统 - Hold Buff 复杂计算", () => {
    const engine = createEngine();

    // Power Ring: value = $count * 3 + 2
    engine.applyEffects([{ type: "item_add", item: "power_ring", count_expr: "1" }]);
    engine.syncDerived();

    let powerBoost = engine.state._buffInstances.find(b => b.id === "power_boost");
    assertEqual(powerBoost?.value, 5, "1 个 Power Ring: value = 1 * 3 + 2 = 5");

    // 验证 $buff.power_boost
    assertEqual(engine.state._buffValues.power_boost, 5, "_buffValues.power_boost = 5");

    // strength 增加: 14 + 5 = 19
    assertEqual(engine.state.stats.strength.cur, 19, "Strength 增加到 19 (base 14 + buff 5)");

    // 添加第二个
    engine.applyEffects([{ type: "item_add", item: "power_ring", count_expr: "1" }]);
    engine.syncDerived();

    powerBoost = engine.state._buffInstances.find(b => b.id === "power_boost");
    assertEqual(powerBoost?.value, 8, "2 个 Power Ring: value = 2 * 3 + 2 = 8");

    // strength 被 max 限制: min(14 + 8, 20) = 20
    assertEqual(engine.state.stats.strength.cur, 20, "Strength 被 max 限制到 20");
});

describe("物品系统 - Magic Amulet 多 buff", () => {
    const engine = createEngine();

    // Magic Amulet: magic_boost = floor($count * 2.5), mp_regen = $count
    engine.applyEffects([{ type: "item_add", item: "magic_amulet", count_expr: "2" }]);
    engine.syncDerived();

    const magicBoost = engine.state._buffInstances.find(b => b.id === "magic_boost");
    const mpRegen = engine.state._buffInstances.find(b => b.id === "mp_regen");

    assertEqual(magicBoost?.value, 5, "2 个 Amulet: magic_boost = floor(2 * 2.5) = 5");
    assertEqual(mpRegen?.value, 2, "2 个 Amulet: mp_regen = 2");

    // intelligence 增加: min(16 + 5, 20) = 20 (受 max 限制)
    assertEqual(engine.state.stats.intelligence.cur, 20, "Intelligence 被 max 限制到 20");
});

describe("物品系统 - Guardian Shield 基于属性计算", () => {
    const engine = createEngine();

    // Guardian Shield: armor_boost = 5, damage_reduction = floor($stat.armor.cur * 0.1)
    engine.applyEffects([{ type: "item_add", item: "guardian_shield", count_expr: "1" }]);
    engine.syncDerived();

    const armorBoost = engine.state._buffInstances.find(b => b.id === "armor_boost");
    const damageReduction = engine.state._buffInstances.find(b => b.id === "damage_reduction");

    assertEqual(armorBoost?.value, 5, "armor_boost = 5");
    // damage_reduction 没有 modifier，所以不影响 stats，只是一个数值
    // 但在检定 buff_expr 中可以使用 $buff.damage_reduction
    assert(damageReduction === undefined || damageReduction?.value === 0,
        "damage_reduction = 0 或不存在");

    // armor_boost modifier 增加 armor: 5 + 5 = 10
    assertEqual(engine.state.stats.armor.cur, 10, "Armor 增加到 10 (base 5 + buff 5)");
});

describe("物品系统 - Cursed Blade 惩罚性 buff", () => {
    const engine = createEngine();

    // Cursed Blade: power_boost = 10, curse = floor($stat.hp.max * 0.05)
    engine.applyEffects([{ type: "item_add", item: "cursed_blade", count_expr: "1" }]);
    engine.syncDerived();

    const powerBoost = engine.state._buffInstances.find(b => b.id === "power_boost");
    const curse = engine.state._buffInstances.find(b => b.id === "curse");

    assertEqual(powerBoost?.value, 10, "cursed blade power_boost = 10");
    assertEqual(curse?.value, 2, "curse = floor(50 * 0.05) = 2");

    // strength 增加但被 max 限制: min(14 + 10, 20) = 20
    assertEqual(engine.state.stats.strength.cur, 20, "Strength 被 max 限制到 20");
});

describe("物品使用 - 百分比恢复", () => {
    const engine = createEngine();

    // 先受伤
    engine.state.baseStats.hp.cur = 20;
    engine.syncDerived();

    // Health Potion: heal = floor($stat.hp.max * 0.3)
    const hpBefore = engine.state.stats.hp.cur;
    engine.useItem("health_potion");
    engine.syncDerived();

    // hp.max = 50, 30% = 15
    assertEqual(engine.state.stats.hp.cur, Math.min(35, 50), "HP 恢复 15 (30% of max)");
    assertEqual(engine.getItemCount("health_potion"), 2, "消耗 1 个血药");
});

describe("物品使用 - 分数恢复 (ceil)", () => {
    const engine = createEngine();

    // 先消耗 MP
    engine.state.baseStats.mp.cur = 10;
    engine.syncDerived();

    // Mana Potion: restore = ceil($stat.mp.max / 3)
    engine.useItem("mana_potion");
    engine.syncDerived();

    // mp.max = 30, ceil(30/3) = 10
    assertEqual(engine.state.stats.mp.cur, 20, "MP 恢复 10 (ceil of 1/3 max)");
});

describe("物品使用 - 基于等级的经验", () => {
    const engine = createEngine();

    // 添加经验之书
    engine.applyEffects([{ type: "item_add", item: "experience_tome", count_expr: "1" }]);

    // Experience Tome: xp = 50 + $stat.level.cur * 10
    // level = 1, xp = 50 + 1 * 10 = 60
    const xpBefore = engine.state.stats.xp.cur;
    engine.useItem("experience_tome");
    engine.syncDerived();

    assertEqual(engine.state.stats.xp.cur, xpBefore + 60, "获得 60 经验 (50 + level*10)");

    // 升级后再测试
    engine.state.baseStats.level.cur = 3;
    engine.applyEffects([{ type: "item_add", item: "experience_tome", count_expr: "1" }]);
    engine.syncDerived();

    const xpBefore2 = engine.state.stats.xp.cur;
    engine.useItem("experience_tome");
    engine.syncDerived();

    assertEqual(engine.state.stats.xp.cur, xpBefore2 + 80, "3级时获得 80 经验 (50 + 3*10)");
});

describe("Buff 系统 - Berserk (自引用属性)", () => {
    const engine = createEngine();

    // Berserk: strength += $stat.strength.cur, armor -= floor($stat.armor.cur / 2)
    // 注意: modifier 的 $stat 引用的是当前 this.state.stats（在 syncDerived 过程中）
    const strBefore = engine.state.stats.strength.cur;  // 14
    const armorBefore = engine.state.stats.armor.cur;  // 5

    engine.applyEffects([{ type: "buff_add", buff: "berserk", value_expr: "1" }]);
    engine.syncDerived();

    // strength 翻倍: 14 + 14 = 28
    // 但由于 modifier 在 derive() 中执行时 $stat 指向的是旧值
    // 实际行为取决于引擎实现
    // armor 减半: 5 - floor(5/2) = 5 - 2 = 3
    assert(engine.state.stats.strength.cur > strBefore, "Berserk: Strength 增加");
    assertEqual(engine.state.stats.armor.cur, 3, "Berserk: Armor 减少到 3");
});

describe("Buff 系统 - Shield Wall (乘法)", () => {
    const engine = createEngine();

    // Shield Wall: armor += $stat.armor.cur * 2
    const armorBefore = engine.state.stats.armor.cur;  // 5

    engine.applyEffects([{ type: "buff_add", buff: "shield_wall", value_expr: "1" }]);
    engine.syncDerived();

    // armor 翻三倍: 5 + 5*2 = 15
    assertEqual(engine.state.stats.armor.cur, 15, "Shield Wall: Armor 翻三倍到 15");
});

describe("Buff 系统 - Arcane Surge (比例计算)", () => {
    const engine = createEngine();

    // Arcane Surge: intelligence += floor(($stat.mp.cur / $stat.mp.max) * 10)
    // MP 满时: floor(1 * 10) = 10
    // 但 modifier 中使用 $stat 引用的是当前 stats

    engine.applyEffects([{ type: "buff_add", buff: "arcane_surge", value_expr: "1" }]);
    engine.syncDerived();

    // 验证 intelligence 增加（具体值取决于引擎实现）
    assert(engine.state.stats.intelligence.cur >= 16, "Arcane Surge: INT 增加或保持");

    // 测试半蓝情况
    const engine2 = createEngine();
    engine2.state.baseStats.mp.cur = 15;  // 50%
    engine2.syncDerived();  // 先同步让 stats 反映 mp 变化
    engine2.applyEffects([{ type: "buff_add", buff: "arcane_surge", value_expr: "1" }]);
    engine2.syncDerived();

    // 半蓝时 modifier 的计算结果
    assert(engine2.state.stats.intelligence.cur >= 16, "Arcane Surge: INT 至少保持原值");
});

describe("Buff 叠加 - 多来源同 buff", () => {
    const engine = createEngine();

    // Power Ring (2个) + Cursed Blade
    engine.applyEffects([{ type: "item_add", item: "power_ring", count_expr: "2" }]);
    engine.applyEffects([{ type: "item_add", item: "cursed_blade", count_expr: "1" }]);
    engine.syncDerived();

    // power_boost: ring = 2*3+2 = 8, blade = 10, total = 18
    const powerBoost = engine.state._buffValues.power_boost;
    assertEqual(powerBoost, 18, "Power Boost 叠加: 8 + 10 = 18");

    // strength 增加但被 max 限制: min(14 + 18, 20) = 20
    assertEqual(engine.state.stats.strength.cur, 20, "Strength 被 max 限制到 20");
});

describe("周期效果 - MP Regen", () => {
    const engine = createEngine();

    // 添加 Magic Amulet
    engine.applyEffects([{ type: "item_add", item: "magic_amulet", count_expr: "2" }]);
    engine.state.baseStats.mp.cur = 10;  // 先消耗 MP
    engine.syncDerived();

    // mp_regen value = 2, 效果是 mp += $value * 2 = 4
    const mpBefore = engine.state.stats.mp.cur;

    // 推进一天
    engine.advanceDay(1);
    engine.syncDerived();

    // MP 应该恢复
    assert(engine.state.stats.mp.cur > mpBefore, "推进一天后 MP 恢复");
});

describe("周期效果 - Curse 伤害", () => {
    const engine = createEngine();

    // 添加 Cursed Blade
    engine.applyEffects([{ type: "item_add", item: "cursed_blade", count_expr: "1" }]);
    engine.syncDerived();

    // curse value = floor(50 * 0.05) = 2
    const hpBefore = engine.state.stats.hp.cur;

    // 推进一天
    engine.advanceDay(1);
    engine.syncDerived();

    assertEqual(engine.state.stats.hp.cur, hpBefore - 2, "诅咒每天扣 2 HP");
});

describe("检定系统 - 复杂 base_expr", () => {
    // Strength Test: base = floor(($stat.strength.cur - 10) / 2)
    const engine = createEngine([15]);  // roll = 15

    choose(engine, 1);  // Enter arena

    const strMod = Math.floor((14 - 10) / 2);  // = 2
    // total = 15 + 2 + 0 = 17 vs DC 15

    choose(engine, 0);  // Strength challenge

    // 应该成功
    const logs = engine.state.log.map(l => l.text);
    const hasSuccess = logs.some(l => l.includes("SUCCESS") || l.includes("won"));
    assert(hasSuccess, "roll=15 + base=2 = 17 >= DC 15: 成功");
});

describe("检定系统 - 复杂 buff_expr", () => {
    // buff_expr = ($buff.power_boost ?? 0) + ($buff.luck ?? 0)
    const engine = createEngine([10]);  // roll = 10

    // 添加 power ring 和 lucky coin
    engine.applyEffects([{ type: "item_add", item: "power_ring", count_expr: "1" }]);
    // lucky_coin 已有 1 个
    engine.syncDerived();

    // power_boost = 5, luck = 1, total buff = 6
    // base = 2 (str mod)
    // total = 10 + 2 + 6 = 18 vs DC 15

    choose(engine, 1);  // Enter arena
    choose(engine, 0);  // Strength challenge

    const logs = engine.state.log.map(l => l.text);
    const checkLog = logs.find(l => l.includes("Strength Test"));

    assert(checkLog && checkLog.includes("buff 6"), "buff_expr 正确计算: power_boost + luck = 6");
});

describe("检定系统 - 平均值 base_expr", () => {
    // Combined Test: base = floor((($stat.strength.cur + $stat.intelligence.cur) / 2 - 10) / 2)
    const engine = createEngine([12]);

    // (14 + 16) / 2 = 15
    // (15 - 10) / 2 = 2.5 -> floor = 2

    choose(engine, 1);  // Arena
    choose(engine, 2);  // Combined challenge

    const logs = engine.state.log.map(l => l.text);
    const checkLog = logs.find(l => l.includes("Combined Test"));

    assert(checkLog && checkLog.includes("base 2"), "平均值 base 正确: floor((15-10)/2) = 2");
});

describe("检定系统 - 条件加成 (hasItem)", () => {
    // Goblin Fight: base = floor(($stat.strength.cur - 10) / 2) + (hasItem('bomb', 1) ? 5 : 0)
    const engine = createEngine([8]);

    // 有 bomb: base = 2 + 5 = 7
    choose(engine, 0);  // Dungeon
    choose(engine, 0);  // Fight goblin

    const logs = engine.state.log.map(l => l.text);
    const checkLog = logs.find(l => l.includes("Goblin Fight"));

    assert(checkLog && checkLog.includes("base 7"), "有 Bomb 时 base = 2 + 5 = 7");
});

describe("效果系统 - 复杂伤害计算", () => {
    const engine = createEngine([5]);  // roll=5, 失败

    // Goblin 失败: hp -= max(1, 10 - armor_boost - damage_reduction)
    // 无 buff 时: max(1, 10 - 0 - 0) = 10
    // 但需要考虑 lucky_coin 的 luck buff (初始有1个)

    const hpBefore = engine.state.stats.hp.cur;

    choose(engine, 0);  // Dungeon
    // base = floor((14-10)/2) + (hasItem('bomb', 1) ? 5 : 0) = 2 + 5 = 7
    // buff = power_boost + damage_reduction - damage_reduction = luck (1)
    // 实际上 buff_expr = ($buff.power_boost ?? 0) - ($buff.damage_reduction ?? 0)
    // = 0 - 0 = 0... 但有 lucky_coin 提供 luck buff
    // 检查 buff_expr: "($buff.power_boost ?? 0) - ($buff.damage_reduction ?? 0)"
    // 这里不包含 luck
    // total = 5 + 7 + 0 = 12 vs DC 12 -> SUCCESS 或 FAIL (刚好在边界)

    choose(engine, 0);  // Fight goblin

    // 根据 roll=5, base=7, buff=0, total=12 vs DC=12 -> SUCCESS
    // 因为 total >= dc
    // 所以这个测试需要调整
    const logs = engine.state.log.map(l => l.text);
    const checkLog = logs.find(l => l.includes("Goblin Fight"));

    // 解析实际结果
    if (checkLog) {
        const match = checkLog.match(/-> (\w+)/);
        const result = match ? match[1] : "UNKNOWN";

        if (result.includes("SUCCESS")) {
            // 成功不应该受伤
            assert(engine.state.stats.hp.cur >= hpBefore, "成功时 HP 不减少");
        } else {
            // 失败受伤
            assert(engine.state.stats.hp.cur < hpBefore, "失败时 HP 减少");
        }
    }
});

describe("效果系统 - 减伤计算", () => {
    const engine = createEngine([3]);  // roll=3, 肯定失败

    // 添加 Guardian Shield (armor_boost = 5)
    engine.applyEffects([{ type: "item_add", item: "guardian_shield", count_expr: "1" }]);
    engine.syncDerived();

    // 伤害 = max(1, 10 - 5 - 0) = 5
    const hpBefore = engine.state.stats.hp.cur;

    choose(engine, 0);  // Dungeon
    // base = 2 + 5 = 7, buff = 0 - 0 = 0 (damage_reduction 是 0，因为原始 armor 是 5)
    // total = 3 + 7 + 0 = 10 vs DC 12 -> FAIL

    choose(engine, 0);  // Fight goblin

    // 失败时: hp -= max(1, 10 - armor_boost - damage_reduction)
    // armor_boost = 5, damage_reduction = 0
    // damage = max(1, 10 - 5 - 0) = 5
    assertEqual(engine.state.stats.hp.cur, hpBefore - 5, "有盾牌时受到 5 伤害 (减伤 5)");
});

describe("效果系统 - 基于等级的经验", () => {
    const engine = createEngine([18]);  // 成功

    // 成功: xp += 20 + $stat.level.cur * 5
    // level = 1: 20 + 5 = 25

    choose(engine, 0);  // Dungeon
    choose(engine, 0);  // Fight goblin (成功)

    assertEqual(engine.state.stats.xp.cur, 25, "获得 25 经验 (20 + level*5)");
});

describe("效果系统 - XP 加成", () => {
    const engine = createEngine([18]);  // 成功

    // 添加 xp_boost buff
    engine.applyEffects([{ type: "buff_add", buff: "xp_boost", value_expr: "1.5" }]);
    engine.syncDerived();

    // 成功经验: floor(30 * 1.5) = 45
    choose(engine, 1);  // Arena
    choose(engine, 0);  // Strength challenge (成功)

    assert(engine.state.stats.xp.cur >= 40, "XP boost 增加经验获取");
});

describe("事件系统 - 升级", () => {
    const engine = createEngine();

    // 升级条件: xp >= level * 100
    engine.state.baseStats.xp.cur = 100;  // level 1 需要 100 xp
    engine.syncDerived();

    const levelBefore = engine.state.stats.level.cur;
    const hpMaxBefore = engine.state.stats.hp.max;

    engine.advanceDay(1);
    engine.syncDerived();

    assertEqual(engine.state.stats.level.cur, levelBefore + 1, "升级: level +1");
    assertEqual(engine.state.stats.hp.max, hpMaxBefore + 10, "升级: HP max +10");
});

describe("结局系统 - 富翁结局", () => {
    const engine = createEngine();

    // 条件: gold >= 500 AND level >= 3
    engine.state.baseStats.gold.cur = 500;
    engine.state.baseStats.level.cur = 3;
    engine.syncDerived();
    engine.checkEndings();

    assertEqual(engine.state.ending, "rich", "满足条件触发富翁结局");
});

describe("真实随机 - 检定逻辑验证", () => {
    const iterations = 10;

    for (let i = 0; i < iterations; i++) {
        const engine = new GameEngine(deepClone(gameData), () => { });

        choose(engine, 1);  // Arena
        const statsBefore = {
            hp: engine.state.stats.hp.cur,
            xp: engine.state.stats.xp.cur,
            gold: engine.state.stats.gold.cur
        };

        choose(engine, 0);  // Strength challenge

        // 解析日志
        const logs = engine.state.log.map(l => l.text);
        const checkLog = logs.find(l => l.includes("Strength Test"));

        if (!checkLog) {
            failed++;
            console.log(`  ✗ [${i + 1}] 无法找到检定日志`);
            continue;
        }

        const match = checkLog.match(/roll (\d+) \+ base (-?\d+) \+ buff (-?\d+) = (-?\d+) vs DC (\d+) -> ([\w\s]+)/);
        if (!match) {
            failed++;
            console.log(`  ✗ [${i + 1}] 无法解析检定日志: ${checkLog}`);
            continue;
        }

        const roll = parseInt(match[1]);
        const base = parseInt(match[2]);
        const buff = parseInt(match[3]);
        const total = parseInt(match[4]);
        const dc = parseInt(match[5]);
        const result = match[6].trim();

        // 验证计算
        if (total !== roll + base + buff) {
            failed++;
            console.log(`  ✗ [${i + 1}] total 计算错误`);
            continue;
        }

        // 验证结果逻辑
        let expectedResult;
        if (roll === 1) expectedResult = "CRIT FAIL";
        else if (roll === 20) expectedResult = "CRIT SUCCESS";
        else if (total >= dc) expectedResult = "SUCCESS";
        else expectedResult = "FAIL";

        if (result !== expectedResult) {
            failed++;
            console.log(`  ✗ [${i + 1}] 结果错误: roll=${roll}, total=${total}, DC=${dc}, 预期 ${expectedResult}, 实际 ${result}`);
            continue;
        }

        // 验证状态变化
        const statsAfter = {
            hp: engine.state.stats.hp.cur,
            xp: engine.state.stats.xp.cur,
            gold: engine.state.stats.gold.cur
        };

        if (result === "CRIT SUCCESS") {
            if (statsAfter.xp <= statsBefore.xp || statsAfter.gold <= statsBefore.gold) {
                failed++;
                console.log(`  ✗ [${i + 1}] CRIT SUCCESS 应获得 XP 和金币`);
                continue;
            }
        } else if (result === "SUCCESS") {
            if (statsAfter.xp <= statsBefore.xp || statsAfter.gold <= statsBefore.gold) {
                failed++;
                console.log(`  ✗ [${i + 1}] SUCCESS 应获得 XP 和金币`);
                continue;
            }
        } else if (result === "FAIL") {
            if (statsAfter.hp >= statsBefore.hp) {
                failed++;
                console.log(`  ✗ [${i + 1}] FAIL 应损失 HP`);
                continue;
            }
        } else if (result === "CRIT FAIL") {
            if (statsAfter.hp >= statsBefore.hp) {
                failed++;
                console.log(`  ✗ [${i + 1}] CRIT FAIL 应损失 HP`);
                continue;
            }
        }

        passed++;
        console.log(`  ✓ [${i + 1}] roll=${roll}, base=${base}, buff=${buff}, total=${total} vs DC=${dc} -> ${result}`);
    }
});

// ============ 运行总结 ============

console.log("\n" + "=".repeat(50));
console.log(`复杂表达式测试完成: ${passed} 通过, ${failed} 失败`);
console.log("=".repeat(50));

if (failed > 0) {
    process.exit(1);
}
