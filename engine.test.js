/**
 * engine.js 单元测试
 * 直接实例化 GameEngine 测试实际代码
 * 运行: node engine.test.js
 */

const {
  GameEngine,
  DEFAULT_GAME_DATA,
  parseDiceBounds,
  parseRangeSet,
  fillSuccessFailBands,
  computeBandSets,
  deepClone
} = require("./engine.js");

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
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (pass) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
    console.log(`    Expected: ${JSON.stringify(expected)}`);
    console.log(`    Actual:   ${JSON.stringify(actual)}`);
  }
}

function assertSetEqual(actual, expected, message) {
  const actualArr = [...actual].sort((a, b) => a - b);
  const expectedArr = [...expected].sort((a, b) => a - b);
  assertEqual(actualArr, expectedArr, message);
}

function describe(name, fn) {
  console.log(`\n${name}`);
  fn();
}

// ============ 辅助函数 ============

// 创建一个测试用的 GameEngine 实例
function createTestEngine(dataOverrides = {}) {
  const testData = deepClone(DEFAULT_GAME_DATA);
  Object.assign(testData, dataOverrides);
  // 空的 render 函数
  return new GameEngine(testData, () => {});
}

// ============ 工具函数测试 ============

describe("parseDiceBounds - 骰子表达式解析", () => {
  assert(parseDiceBounds("1d20")?.min === 1, "1d20 min = 1");
  assert(parseDiceBounds("1d20")?.max === 20, "1d20 max = 20");
  
  assert(parseDiceBounds("2d6")?.min === 2, "2d6 min = 2");
  assert(parseDiceBounds("2d6")?.max === 12, "2d6 max = 12");
  
  assert(parseDiceBounds("1d20+5")?.min === 6, "1d20+5 min = 6");
  assert(parseDiceBounds("1d20+5")?.max === 25, "1d20+5 max = 25");
  
  assert(parseDiceBounds("1d20-3")?.min === -2, "1d20-3 min = -2");
  assert(parseDiceBounds("1d20-3")?.max === 17, "1d20-3 max = 17");
  
  assert(parseDiceBounds("roll('1d20')") === null, "roll('1d20') 应返回 null");
  assert(parseDiceBounds("invalid") === null, "invalid 应返回 null");
  assert(parseDiceBounds(123) === null, "非字符串应返回 null");
});

describe("parseRangeSet - 范围解析", () => {
  const bounds = { min: 1, max: 20 };
  
  assertSetEqual(parseRangeSet("1", bounds), new Set([1]), "单值 '1'");
  assertSetEqual(parseRangeSet("20", bounds), new Set([20]), "单值 '20'");
  assertSetEqual(parseRangeSet("1-5", bounds), new Set([1, 2, 3, 4, 5]), "范围 '1-5'");
  assertSetEqual(parseRangeSet("18-20", bounds), new Set([18, 19, 20]), "范围 '18-20'");
  
  assertSetEqual(parseRangeSet("0-3", bounds), new Set([1, 2, 3]), "超出下界的范围被截断");
  assertSetEqual(parseRangeSet("18-25", bounds), new Set([18, 19, 20]), "超出上界的范围被截断");
  
  assertSetEqual(parseRangeSet("", bounds), new Set(), "空字符串返回空集");
  assertSetEqual(parseRangeSet(null, bounds), new Set(), "null 返回空集");
});

describe("fillSuccessFailBands - 成功/失败区间分配", () => {
  const remaining = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  const result = fillSuccessFailBands(new Set(), new Set(), remaining);
  
  // 关键测试：较大的值应该是 success，较小的值应该是 fail
  assert(result.success.has(11), "11 应该在 success 集合中");
  assert(result.success.has(19), "19 应该在 success 集合中");
  assert(!result.success.has(2), "2 不应该在 success 集合中");
  assert(!result.success.has(10), "10 不应该在 success 集合中");
  
  assert(result.fail.has(2), "2 应该在 fail 集合中");
  assert(result.fail.has(10), "10 应该在 fail 集合中");
  assert(!result.fail.has(11), "11 不应该在 fail 集合中");
  assert(!result.fail.has(19), "19 不应该在 fail 集合中");
  
  const allValues = new Set([...result.success, ...result.fail]);
  assertSetEqual(allValues, remaining, "所有值都应被分配到 success 或 fail");
});

describe("computeBandSets - 完整区间计算", () => {
  // 只定义 crit bands 时，不应自动填充 success/fail
  const bands1 = { crit_fail: { range: "1" }, crit_success: { range: "20" } };
  const bounds = { min: 1, max: 20 };
  const result1 = computeBandSets(bands1, bounds, false, false);
  
  assert(result1.hasCritBands === true, "hasCritBands 应为 true");
  assert(result1.hasExplicitSuccessFail === false, "hasExplicitSuccessFail 应为 false（未定义）");
  assertSetEqual(result1.critFail, new Set([1]), "critFail = {1}");
  assertSetEqual(result1.critSuccess, new Set([20]), "critSuccess = {20}");
  assert(result1.success.size === 0, "未定义 success bands 时 success 应为空");
  assert(result1.fail.size === 0, "未定义 fail bands 时 fail 应为空");
  
  // 明确定义 success/fail bands 时，应该填充
  const bands2 = { 
    crit_fail: { range: "1" }, 
    crit_success: { range: "20" },
    success: { range: "15-19" }  // 明确定义 success
  };
  const result2 = computeBandSets(bands2, bounds, false, false);
  
  assert(result2.hasExplicitSuccessFail === true, "hasExplicitSuccessFail 应为 true（已定义）");
  assert(result2.success.has(15), "success 包含 15");
  assert(result2.success.has(19), "success 包含 19");
  // 剩余的 2-14 应该填充到 fail
  assert(result2.fail.has(2), "fail 包含 2（自动填充）");
  assert(result2.fail.has(14), "fail 包含 14（自动填充）");
});

// ============ GameEngine 实例测试 ============

describe("GameEngine - 初始化", () => {
  const engine = createTestEngine();
  
  assert(engine.state !== undefined, "state 应该被初始化");
  assert(engine.state.stats !== undefined, "stats 应该被初始化");
  assert(engine.state.stats.hp.cur === 20, "HP 初始值为 20");
  assert(engine.state.stats.stamina.cur === 6, "Stamina 初始值为 6");
  assert(engine.state.time.day === 1, "初始天数为 1");
});

describe("GameEngine.evalExpr - 表达式求值", () => {
  const engine = createTestEngine();
  
  // 基本算术
  assertEqual(engine.evalExpr("1 + 2"), 3, "1 + 2 = 3");
  assertEqual(engine.evalExpr("10 * 2"), 20, "10 * 2 = 20");
  assertEqual(engine.evalExpr("floor(5.7)"), 5, "floor(5.7) = 5");
  
  // 状态变量
  assertEqual(engine.evalExpr("$stat.hp.cur"), 20, "$stat.hp.cur = 20");
  assertEqual(engine.evalExpr("$stat.stamina.cur"), 6, "$stat.stamina.cur = 6");
  assertEqual(engine.evalExpr("$day"), 1, "$day = 1");
  
  // 复杂表达式
  assertEqual(engine.evalExpr("floor(($stat.stamina.cur - 10) / 2)"), -2, 
    "stamina 修正值 = floor((6-10)/2) = -2");
  
  // 带 extra 参数
  assertEqual(engine.evalExpr("$roll + $base", { $roll: 15, $base: 3 }), 18, 
    "$roll + $base with extra = 18");
  assertEqual(engine.evalExpr("$roll + $base + $buff_sum", { $roll: 10, $base: -2, $buff_sum: 1 }), 9,
    "$roll + $base + $buff_sum = 9");
  
  // 空合并运算符
  assertEqual(engine.evalExpr("$buff.brave ?? 0"), 0, "$buff.brave ?? 0 = 0");
  
  // 数字和布尔值直接返回
  assertEqual(engine.evalExpr(42), 42, "数字 42 直接返回");
  assertEqual(engine.evalExpr(true), true, "布尔值 true 直接返回");
  assertEqual(engine.evalExpr(null), 0, "null 返回 0");
  assertEqual(engine.evalExpr(""), 0, "空字符串返回 0");
});

describe("GameEngine.evalExpr - 复杂表达式深度测试", () => {
  const engine = createTestEngine();
  
  // 用户报告的关键表达式
  assertEqual(
    engine.evalExpr("$roll + $base + $buff_sum", { $roll: 15, $base: 0, $buff_sum: 0 }), 
    15, 
    "检定总值表达式: $roll=15, $base=0, $buff_sum=0 => 15"
  );
  
  assertEqual(
    engine.evalExpr("$roll + $base + $buff_sum", { $roll: 7, $base: -2, $buff_sum: 0 }), 
    5, 
    "检定总值表达式: $roll=7, $base=-2, $buff_sum=0 => 5"
  );
  
  // 属性修正值计算 (D&D 风格)
  assertEqual(
    engine.evalExpr("floor(($stat.stamina.cur - 10) / 2)"), 
    -2, 
    "stamina=6 的修正值 = floor((6-10)/2) = -2"
  );
  
  // 修改 stamina 后再测试
  engine.state.stats.stamina.cur = 14;
  assertEqual(
    engine.evalExpr("floor(($stat.stamina.cur - 10) / 2)"), 
    2, 
    "stamina=14 的修正值 = floor((14-10)/2) = 2"
  );
  
  engine.state.stats.stamina.cur = 10;
  assertEqual(
    engine.evalExpr("floor(($stat.stamina.cur - 10) / 2)"), 
    0, 
    "stamina=10 的修正值 = floor((10-10)/2) = 0"
  );
  
  // 重置
  engine.state.stats.stamina.cur = 6;
  
  // Buff 表达式 - 使用新引擎避免干扰
  const engine2 = createTestEngine();
  assertEqual(
    engine2.evalExpr("$buff.brave ?? 0"), 
    0, 
    "$buff.brave 不存在时返回 0"
  );
  
  // 设置 buff 值后测试
  engine2.state._buffValues = { brave: 2 };
  assertEqual(
    engine2.evalExpr("$buff.brave ?? 0"), 
    2, 
    "$buff.brave=2 时返回 2"
  );
  
  // 嵌套对象访问 - 使用新引擎
  const engine3 = createTestEngine();
  // 移除持有 buff 影响，清空物品
  engine3.state.items = {};
  engine3.syncDerived();
  
  assertEqual(
    engine3.evalExpr("$stat.hp.max - $stat.hp.cur"), 
    0, 
    "HP 差值: 20 - 20 = 0"
  );
  
  engine3.state.stats.hp.cur = 15;
  assertEqual(
    engine3.evalExpr("$stat.hp.max - $stat.hp.cur"), 
    5, 
    "HP 差值: 20 - 15 = 5"
  );
  
  // 数学函数
  assertEqual(engine.evalExpr("min(10, 5)"), 5, "min(10, 5) = 5");
  assertEqual(engine.evalExpr("max(10, 5)"), 10, "max(10, 5) = 10");
  assertEqual(engine.evalExpr("abs(-5)"), 5, "abs(-5) = 5");
  assertEqual(engine.evalExpr("ceil(4.2)"), 5, "ceil(4.2) = 5");
  assertEqual(engine.evalExpr("round(4.6)"), 5, "round(4.6) = 5");
  assertEqual(engine.evalExpr("clamp(15, 0, 10)"), 10, "clamp(15, 0, 10) = 10");
  assertEqual(engine.evalExpr("clamp(-5, 0, 10)"), 0, "clamp(-5, 0, 10) = 0");
  assertEqual(engine.evalExpr("clamp(5, 0, 10)"), 5, "clamp(5, 0, 10) = 5");
  
  // 条件表达式 - 使用新引擎
  const engine4 = createTestEngine();
  engine4.state.items = {};
  engine4.syncDerived();
  
  assertEqual(engine4.evalExpr("$stat.hp.cur > 10 ? 1 : 0"), 1, "三元运算符: HP > 10 => 1");
  engine4.state.stats.hp.cur = 5;
  assertEqual(engine4.evalExpr("$stat.hp.cur > 10 ? 1 : 0"), 0, "三元运算符: HP <= 10 => 0");
  
  // 布尔运算
  assertEqual(engine4.evalExpr("$stat.hp.cur > 0 && $stat.stamina.cur > 0"), true, "AND 运算");
  assertEqual(engine4.evalExpr("$stat.hp.cur > 100 || $stat.stamina.cur > 0"), true, "OR 运算");
  assertEqual(engine4.evalExpr("!($stat.hp.cur > 100)"), true, "NOT 运算");
  
  // 复合表达式
  assertEqual(
    engine4.evalExpr("floor($stat.hp.cur / 2) + ceil($stat.stamina.cur / 2)"), 
    5, 
    "floor(5/2) + ceil(6/2) = 2 + 3 = 5"
  );
  
  // 带 $count 的物品表达式
  assertEqual(
    engine.evalExpr("$count * 2", { $count: 3 }), 
    6, 
    "物品数量表达式: $count=3 => 6"
  );
  
  // 带 $value 的 buff 表达式
  assertEqual(
    engine.evalExpr("$value + 1", { $value: 4 }), 
    5, 
    "Buff 值表达式: $value=4 => 5"
  );
});

describe("GameEngine.evalExpr - 内置函数测试", () => {
  const engine = createTestEngine();
  
  // hasItem 函数
  assertEqual(engine.evalExpr("hasItem('bread', 1)"), true, "hasItem('bread', 1) = true (有2个)");
  assertEqual(engine.evalExpr("hasItem('bread', 2)"), true, "hasItem('bread', 2) = true (有2个)");
  assertEqual(engine.evalExpr("hasItem('bread', 3)"), false, "hasItem('bread', 3) = false (只有2个)");
  assertEqual(engine.evalExpr("hasItem('key', 1)"), false, "hasItem('key', 1) = false (0个)");
  
  // itemCount 函数
  assertEqual(engine.evalExpr("itemCount('bread')"), 2, "itemCount('bread') = 2");
  assertEqual(engine.evalExpr("itemCount('key')"), 0, "itemCount('key') = 0");
  
  // hasBuff 函数
  assertEqual(engine.evalExpr("hasBuff('brave')"), false, "hasBuff('brave') = false (未添加)");
  engine.applyEffects([{ type: "buff_add", buff: "brave", value_expr: "1" }]);
  engine.syncDerived(); // 需要同步才能更新 _buffInstances
  assertEqual(engine.evalExpr("hasBuff('brave')"), true, "hasBuff('brave') = true (已添加并同步)");
  
  // flag 函数
  assertEqual(engine.evalExpr("flag('test_flag')"), false, "flag('test_flag') = false (未设置)");
  engine.state.flags.test_flag = true;
  assertEqual(engine.evalExpr("flag('test_flag')"), true, "flag('test_flag') = true (已设置)");
  
  // roll 函数 - 多次测试确保范围正确
  for (let i = 0; i < 10; i++) {
    const result = engine.evalExpr("roll('1d6')");
    assert(result >= 1 && result <= 6, `roll('1d6') 结果 ${result} 在 1-6 范围内`);
  }
});

describe("GameEngine.evalExpr - 错误处理", () => {
  const engine = createTestEngine();
  
  // 未定义变量应该返回 0 (被 catch 捕获)
  assertEqual(engine.evalExpr("$undefined_var + 1"), 0, "未定义变量表达式返回 0");
  
  // 检查日志是否记录了错误
  const hasErrorLog = engine.state.log.some(l => l.text.includes("Expr error"));
  assert(hasErrorLog, "未定义变量导致 Expr error 日志");
  
  // 清空日志继续测试
  engine.state.log = [];
  
  // 真正的语法错误
  assertEqual(engine.evalExpr("1 + * 2"), 0, "语法错误表达式返回 0");
  
  // 除以零 - JavaScript 返回 Infinity
  assert(Number.isFinite(engine.evalExpr("1 / 0")) === false, "1/0 返回 Infinity");
});

describe("GameEngine.roll - 骰子投掷", () => {
  const engine = createTestEngine();
  
  // 多次投掷验证范围
  for (let i = 0; i < 20; i++) {
    const result = engine.roll("1d20");
    assert(result >= 1 && result <= 20, `1d20 结果 ${result} 在 1-20 范围内`);
  }
  
  for (let i = 0; i < 10; i++) {
    const result = engine.roll("2d6");
    assert(result >= 2 && result <= 12, `2d6 结果 ${result} 在 2-12 范围内`);
  }
  
  assertEqual(engine.roll("invalid"), 0, "无效骰子表达式返回 0");
  assertEqual(engine.roll(123), 0, "非字符串返回 0");
});

describe("GameEngine.checkConditions - 条件检查", () => {
  const engine = createTestEngine();
  
  assertEqual(engine.checkConditions([]), true, "空条件返回 true");
  assertEqual(engine.checkConditions(null), true, "null 条件返回 true");
  
  assertEqual(engine.checkConditions(["$stat.hp.cur >= 10"]), true, "HP >= 10 为真");
  assertEqual(engine.checkConditions(["$stat.hp.cur <= 10"]), false, "HP <= 10 为假 (HP=20)");
  
  assertEqual(engine.checkConditions(["$stat.hp.cur > 0", "$stat.stamina.cur > 0"]), true, 
    "多条件全部为真");
  assertEqual(engine.checkConditions(["$stat.hp.cur > 0", "$stat.hp.cur < 10"]), false, 
    "多条件有一个为假");
});

describe("GameEngine - 状态修改", () => {
  const engine = createTestEngine();
  
  // 测试 stat_add 效果 - 直接修改 baseStats
  const initialHp = engine.state.baseStats.hp.cur;
  engine.applyEffects([{ type: "stat_add", stat: "hp", value_expr: "-5" }]);
  assertEqual(engine.state.baseStats.hp.cur, initialHp - 5, "stat_add -5 HP (baseStats)");
  
  // syncDerived 后 stats 也应该反映变化
  engine.syncDerived();
  assertEqual(engine.state.stats.hp.cur, initialHp - 5, "syncDerived 后 stats.hp 也更新");
  
  // 测试物品添加
  const initialBread = engine.getItemCount("bread");
  engine.applyEffects([{ type: "item_add", item: "bread", count_expr: "2" }]);
  assertEqual(engine.getItemCount("bread"), initialBread + 2, "添加 2 个面包");
  
  // 测试物品移除
  engine.applyEffects([{ type: "item_remove", item: "bread", count_expr: "1" }]);
  assertEqual(engine.getItemCount("bread"), initialBread + 1, "移除 1 个面包");
});

describe("GameEngine - Buff 系统", () => {
  const engine = createTestEngine();
  
  // 初始状态无 brave buff
  assert(!engine.state.buffs.some(b => b.id === "brave"), "初始无 brave buff");
  
  // 添加 buff
  engine.applyEffects([{ type: "buff_add", buff: "brave", value_expr: "1" }]);
  assert(engine.state.buffs.some(b => b.id === "brave"), "添加 brave buff 后存在");
  
  // syncDerived 后检查 buff 效果
  engine.syncDerived();
  // brave buff 应该增加 stamina max 和 cur
  assert(engine.state.stats.stamina.max >= 7, "brave 增加 stamina max");
});

describe("GameEngine.runCheck - 检定系统", () => {
  const engine = createTestEngine();
  
  // 测试一个简单的检定
  // 由于随机性，我们多次运行并检查日志格式
  const check = {
    name: "Test Check",
    roll_expr: "roll('1d20')",
    base_expr: "0",
    buff_expr: "0",
    dc: 10,
    success: { effects: [{ type: "flag_set", flag: "test_success", value_expr: "true" }] },
    fail: { effects: [{ type: "flag_set", flag: "test_fail", value_expr: "true" }] }
  };
  
  engine.runCheck(check);
  
  // 检查日志是否正确生成
  const log = engine.state.log[0];
  assert(log && log.text.includes("Test Check"), "日志包含检定名称");
  assert(log && log.text.includes("roll"), "日志包含 roll 信息");
  assert(log && log.text.includes("DC 10"), "日志包含 DC 信息");
  
  // 检查是否设置了标志（成功或失败）
  const hasResult = engine.state.flags.test_success || engine.state.flags.test_fail;
  assert(hasResult, "检定应该触发成功或失败效果");
});

describe("GameEngine.runCheck - 带 bands 的检定", () => {
  // 模拟检定逻辑
  const simulateCheckResult = (rollValue, totalValue, dcValue, bands) => {
    const bounds = { min: 1, max: 20 };
    const bandSets = computeBandSets(bands, bounds, false, false);
    const inSet = (set) => set && set.size > 0 && set.has(Math.round(rollValue));
    
    let result = null;
    
    // 1. 先检查 crit bands
    if (bandSets && bandSets.hasCritBands) {
      if (inSet(bandSets.critFail)) {
        result = "crit_fail";
      } else if (inSet(bandSets.critSuccess)) {
        result = "crit_success";
      }
    }
    
    // 2. 如果用户明确定义了 success/fail bands
    if (!result && bandSets && bandSets.hasExplicitSuccessFail) {
      if (inSet(bandSets.success)) {
        result = "success";
      } else if (inSet(bandSets.fail)) {
        result = "fail";
      }
    }
    
    // 3. 否则使用 total vs DC
    if (!result) {
      result = totalValue >= dcValue ? "success" : "fail";
    }
    
    return result;
  };
  
  // 只有 crit bands 的情况 - 普通结果应基于 total vs DC
  const bandsOnlyCrit = { crit_fail: { range: "1" }, crit_success: { range: "20" } };
  
  // crit 情况
  assertEqual(simulateCheckResult(1, 5, 12, bandsOnlyCrit), "crit_fail", "roll=1 是 crit_fail");
  assertEqual(simulateCheckResult(20, 25, 30, bandsOnlyCrit), "crit_success", "roll=20 是 crit_success（即使 total < DC）");
  
  // 用户报告的问题场景: roll=12, total=10, DC=12
  assertEqual(simulateCheckResult(12, 10, 12, bandsOnlyCrit), "fail", "roll=12, total=10 vs DC=12 应该 FAIL");
  
  // 更多 total vs DC 测试
  assertEqual(simulateCheckResult(15, 13, 12, bandsOnlyCrit), "success", "total=13 >= DC=12 应该 SUCCESS");
  assertEqual(simulateCheckResult(5, 3, 12, bandsOnlyCrit), "fail", "total=3 < DC=12 应该 FAIL");
  assertEqual(simulateCheckResult(10, 12, 12, bandsOnlyCrit), "success", "total=12 >= DC=12 应该 SUCCESS");
  assertEqual(simulateCheckResult(10, 11, 12, bandsOnlyCrit), "fail", "total=11 < DC=12 应该 FAIL");
  
  // 明确定义 success/fail bands 的情况
  const bandsExplicit = { 
    crit_fail: { range: "1" }, 
    crit_success: { range: "20" },
    success: { range: "15-19" },
    fail: { range: "2-10" }
  };
  
  assertEqual(simulateCheckResult(15, 5, 12, bandsExplicit), "success", "roll=15 在 success band（忽略 total）");
  assertEqual(simulateCheckResult(5, 20, 12, bandsExplicit), "fail", "roll=5 在 fail band（忽略 total）");
});

describe("GameEngine - 时间系统", () => {
  const engine = createTestEngine();
  
  const initialDay = engine.state.time.day;
  engine.applyEffects([{ type: "advance_day", value_expr: "1" }]);
  assertEqual(engine.state.time.day, initialDay + 1, "推进 1 天");
  
  engine.applyEffects([{ type: "advance_day", value_expr: "3" }]);
  assertEqual(engine.state.time.day, initialDay + 4, "再推进 3 天");
});

describe("GameEngine - 商店系统", () => {
  const engine = createTestEngine();
  
  // 检查商店定义
  assert(engine.shops.market !== undefined, "market 商店存在");
  assert(engine.shops.market.items.length > 0, "market 有商品");
  
  // 测试购买
  const initialMoney = engine.state.stats.money.cur;
  const initialBread = engine.getItemCount("bread");
  
  engine.buy("market", "bread");
  
  assertEqual(engine.state.stats.money.cur, initialMoney - 4, "购买面包花费 4 金币");
  assertEqual(engine.getItemCount("bread"), initialBread + 1, "获得 1 个面包");
});

describe("GameEngine - 物品使用", () => {
  const engine = createTestEngine();
  
  // 确保有面包
  assert(engine.getItemCount("bread") > 0, "有面包可用");
  
  const initialHunger = engine.state.stats.hunger.cur;
  const initialBread = engine.getItemCount("bread");
  
  engine.useItem("bread");
  
  // 吃面包减少饥饿
  assert(engine.state.stats.hunger.cur < initialHunger, "吃面包减少饥饿");
  assertEqual(engine.getItemCount("bread"), initialBread - 1, "消耗 1 个面包");
});

describe("GameEngine - 故事节点", () => {
  const engine = createTestEngine();
  
  // 检查初始节点
  assertEqual(engine.state.story.node, "n1", "初始节点为 n1");
  
  // 测试 goto
  engine.applyEffects([{ type: "goto", node: "n_gate" }]);
  assertEqual(engine.state.story.node, "n_gate", "跳转到 n_gate");
  
  // 验证节点存在
  assert(engine.nodes["n_gate"] !== undefined, "n_gate 节点存在");
  assert(engine.nodes["n_gate"].title === "Sealed Gate", "n_gate 标题正确");
});

describe("GameEngine - 日志系统", () => {
  const engine = createTestEngine();
  
  engine.addLog("Test message 1");
  engine.addLog("Test message 2");
  
  assertEqual(engine.state.log.length, 2, "日志有 2 条");
  assertEqual(engine.state.log[0].text, "Test message 2", "最新日志在前");
  assertEqual(engine.state.log[1].text, "Test message 1", "旧日志在后");
  
  // 空日志不添加
  engine.addLog("");
  engine.addLog(null);
  assertEqual(engine.state.log.length, 2, "空日志不添加");
});

describe("GameEngine - 结局检查", () => {
  const engine = createTestEngine();
  
  // 初始状态无结局
  assert(engine.state.ending === undefined, "初始无结局");
  
  // 把 HP 降到 0
  engine.state.baseStats.hp.cur = 0;
  engine.syncDerived();
  engine.checkEndings();
  
  assertEqual(engine.state.ending, "dead", "HP=0 触发死亡结局");
});

describe("GameEngine - 持有 Buff", () => {
  const engine = createTestEngine();
  
  // 面包的 hold_buffs 应该给 well_fed
  assert(engine.getItemCount("bread") > 0, "有面包");
  
  engine.syncDerived();
  const instances = engine.state._buffInstances;
  const hasWellFed = instances.some(b => b.id === "well_fed");
  assert(hasWellFed, "持有面包时有 well_fed buff");
  
  // well_fed 增加最大 HP
  const baseMaxHp = engine.state.baseStats.hp.max;
  assert(engine.state.stats.hp.max > baseMaxHp, "well_fed 增加最大 HP");
});

describe("GameEngine.load - 重新加载", () => {
  const engine = createTestEngine();
  
  // 修改一些状态
  engine.state.stats.hp.cur = 5;
  engine.state.time.day = 10;
  
  // 重新加载
  engine.load(DEFAULT_GAME_DATA);
  
  // 状态应该重置
  assertEqual(engine.state.stats.hp.cur, 20, "HP 重置");
  assertEqual(engine.state.time.day, 1, "天数重置");
});

// ============ 运行总结 ============

console.log("\n" + "=".repeat(50));
console.log(`测试完成: ${passed} 通过, ${failed} 失败`);
console.log("=".repeat(50));

if (failed > 0) {
  process.exit(1);
}
