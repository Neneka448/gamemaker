/**
 * engine.js 端到端测试
 * 基于 game.json 模拟完整游戏流程
 * 运行: node engine.e2e.test.js
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

function describe(name, fn) {
  console.log(`\n${name}`);
  fn();
}

// ============ 加载 game.json ============

const gameDataPath = path.join(__dirname, "game.json");
const gameData = JSON.parse(fs.readFileSync(gameDataPath, "utf-8"));

// ============ 辅助函数 ============

/**
 * 创建带有可控随机数的测试引擎
 * @param {number[]} rollSequence - 预定义的骰子结果序列
 */
function createTestEngine(rollSequence = []) {
  const engine = new GameEngine(deepClone(gameData), () => {});
  
  // Stub roll 函数，使用预定义序列
  let rollIndex = 0;
  const originalRoll = engine.roll.bind(engine);
  engine.roll = function(expr) {
    if (rollSequence.length > 0 && rollIndex < rollSequence.length) {
      return rollSequence[rollIndex++];
    }
    // 如果没有预定义值，使用原始 roll
    return originalRoll(expr);
  };
  
  // 记录 roll 次数以便调试
  engine._rollIndex = () => rollIndex;
  
  return engine;
}

/**
 * 执行选择
 */
function choose(engine, choiceIndex) {
  const node = engine.nodes[engine.state.story.node];
  if (!node || !node.choices || !node.choices[choiceIndex]) {
    throw new Error(`Invalid choice ${choiceIndex} at node ${engine.state.story.node}`);
  }
  engine.choose(node.choices[choiceIndex]);
}

/**
 * 获取可用选项
 */
function getAvailableChoices(engine) {
  const node = engine.nodes[engine.state.story.node];
  if (!node || !node.choices) return [];
  return node.choices.filter(c => engine.checkConditions(c.conditions));
}

/**
 * 获取最新日志文本
 */
function getLastLog(engine) {
  return engine.state.log[0]?.text || "";
}

/**
 * 获取所有日志文本
 */
function getAllLogs(engine) {
  return engine.state.log.map(l => l.text);
}

// ============ 端到端测试 ============

describe("E2E: 游戏初始化", () => {
  const engine = createTestEngine();
  
  assertEqual(engine.state.story.node, "n1", "初始节点为 n1 (Arrival)");
  assertEqual(engine.nodes["n1"].title, "Arrival", "节点标题正确");
  assertEqual(engine.state.stats.hp.cur, 20, "初始 HP = 20");
  assertEqual(engine.state.stats.money.cur, 20, "初始金币 = 20");
  assertEqual(engine.getItemCount("bread"), 2, "初始面包数量 = 2");
  assertEqual(engine.getItemCount("key"), 0, "初始钥匙数量 = 0");
  assertEqual(engine.state.time.day, 1, "初始天数 = 1");
});

describe("E2E: 购买物品流程", () => {
  const engine = createTestEngine();
  
  // 在起始节点，商店应该可用
  const node = engine.nodes[engine.state.story.node];
  assert(node.shops.includes("market"), "起始节点有 market 商店");
  
  // 购买面包
  const initialMoney = engine.state.stats.money.cur;
  const initialBread = engine.getItemCount("bread");
  engine.buy("market", "bread");
  
  assertEqual(engine.state.stats.money.cur, initialMoney - 4, "购买面包花费 4 金币");
  assertEqual(engine.getItemCount("bread"), initialBread + 1, "获得 1 个面包");
  assert(getLastLog(engine).includes("bought bread"), "日志记录购买行为");
  
  // 购买钥匙
  engine.buy("market", "key");
  assertEqual(engine.state.stats.money.cur, initialMoney - 4 - 12, "购买钥匙花费 12 金币");
  assertEqual(engine.getItemCount("key"), 1, "获得 1 把钥匙");
});

describe("E2E: 使用物品流程", () => {
  const engine = createTestEngine();
  
  const initialHunger = engine.state.stats.hunger.cur;
  const initialBread = engine.getItemCount("bread");
  
  engine.useItem("bread");
  
  // 饥饿减少 15，但不会低于 0
  const expectedHunger = Math.max(0, initialHunger - 15);
  assertEqual(engine.state.stats.hunger.cur, expectedHunger, `吃面包后饥饿 = ${expectedHunger}`);
  assertEqual(engine.getItemCount("bread"), initialBread - 1, "消耗 1 个面包");
  assert(getLastLog(engine).includes("eat bread"), "日志记录使用物品");
});

describe("E2E: Buff 系统 - 添加 brave buff", () => {
  const engine = createTestEngine();
  
  // 初始无 brave buff
  assert(!engine.state.buffs.some(b => b.id === "brave"), "初始无 brave buff");
  
  // 选择 "Tell yourself to be brave" (index 2)
  choose(engine, 2);
  
  // 应该获得 brave buff
  assert(engine.state.buffs.some(b => b.id === "brave"), "获得 brave buff");
  
  // brave buff 增加 stamina
  engine.syncDerived();
  assertEqual(engine.state.stats.stamina.cur, 7, "brave 增加 stamina cur 到 7");
  assertEqual(engine.state.stats.stamina.max, 7, "brave 增加 stamina max 到 7");
  
  // 选项应该消失（条件 !hasBuff('brave')）
  engine.syncDerived();
  const availableChoices = getAvailableChoices(engine);
  assert(!availableChoices.some(c => c.text.includes("brave")), "brave 选项不再可用");
});

describe("E2E: Hold Buff 系统 - well_fed", () => {
  const engine = createTestEngine();
  
  // 初始有 2 个面包，应该有 well_fed buff (value = 2 * 2 = 4)
  engine.syncDerived();
  const wellFed = engine.state._buffInstances.find(b => b.id === "well_fed");
  assert(wellFed !== undefined, "持有面包时有 well_fed buff");
  assertEqual(wellFed.value, 4, "well_fed value = 2 * 2 = 4");
  
  // HP max 应该增加
  assertEqual(engine.state.stats.hp.max, 24, "HP max 增加到 24 (20 + 4)");
  
  // 消耗一个面包后，buff 值应该减少
  engine.useItem("bread");
  engine.syncDerived();
  const wellFed2 = engine.state._buffInstances.find(b => b.id === "well_fed");
  assertEqual(wellFed2.value, 2, "消耗面包后 well_fed value = 1 * 2 = 2");
  assertEqual(engine.state.stats.hp.max, 22, "HP max 变为 22 (20 + 2)");
});

describe("E2E: 时间系统 - 推进天数", () => {
  const engine = createTestEngine();
  
  const initialDay = engine.state.time.day;
  const initialHunger = engine.state.stats.hunger.cur;
  
  // 选择 "Rest for a day" (index 3)
  choose(engine, 3);
  
  assertEqual(engine.state.time.day, initialDay + 1, "天数推进 1");
  assertEqual(engine.state.stats.hunger.cur, initialHunger + 10, "饥饿增加 10 (on_day_start)");
  assert(getAllLogs(engine).some(l => l.includes("day passes")), "日志记录天数推进");
});

describe("E2E: 节点导航", () => {
  const engine = createTestEngine();
  
  // 从 n1 去 n_gate
  assertEqual(engine.state.story.node, "n1", "初始在 n1");
  choose(engine, 1); // "Walk to the gate"
  assertEqual(engine.state.story.node, "n_gate", "到达 n_gate");
  assertEqual(engine.nodes[engine.state.story.node].title, "Sealed Gate", "节点标题正确");
  
  // 返回 n1
  choose(engine, 1); // "Return to the square"
  assertEqual(engine.state.story.node, "n1", "返回 n1");
});

describe("E2E: 检定系统 - 成功", () => {
  // Stub roll 返回 18 (高值，应该成功)
  // stamina=6, base_expr = floor((6-10)/2) = -2
  // total = 18 + (-2) + 0 = 16 >= DC 12 → SUCCESS
  const engine = createTestEngine([18]);
  
  // 去 n_gate
  choose(engine, 1);
  assertEqual(engine.state.story.node, "n_gate", "到达 n_gate");
  
  const initialHp = engine.state.stats.hp.cur;
  
  // 选择 "Force the gate (check)" (index 0)
  choose(engine, 0);
  
  // 检定成功，应该进入 n_forest
  assertEqual(engine.state.story.node, "n_forest", "检定成功，进入 n_forest");
  assertEqual(engine.state.stats.hp.cur, initialHp, "成功时 HP 不变");
  assert(getAllLogs(engine).some(l => l.includes("gate gives way")), "日志记录成功");
  assert(getAllLogs(engine).some(l => l.includes("SUCCESS")), "日志显示 SUCCESS");
});

describe("E2E: 检定系统 - 失败", () => {
  // Stub roll 返回 5 (低值)
  // total = 5 + (-2) + 0 = 3 < DC 12 → FAIL
  const engine = createTestEngine([5]);
  
  choose(engine, 1); // 去 n_gate
  const initialHp = engine.state.stats.hp.cur;
  
  choose(engine, 0); // Force the gate
  
  // 检定失败，应该留在 n_gate
  assertEqual(engine.state.story.node, "n_gate", "检定失败，留在 n_gate");
  assertEqual(engine.state.stats.hp.cur, initialHp - 3, "失败时 HP -3");
  assert(getAllLogs(engine).some(l => l.includes("fail and hurt")), "日志记录失败");
  assert(getAllLogs(engine).some(l => l.includes("FAIL")), "日志显示 FAIL");
});

describe("E2E: 检定系统 - 大成功 (Crit Success)", () => {
  // Stub roll 返回 20 (crit success)
  // crit_success 没有单独分支，回退到 success 分支
  const engine = createTestEngine([20]);
  
  choose(engine, 1);
  choose(engine, 0);
  
  assertEqual(engine.state.story.node, "n_forest", "Crit Success 回退到 success 分支，进入 n_forest");
  assert(getAllLogs(engine).some(l => l.includes("CRIT SUCCESS")), "日志显示 CRIT SUCCESS");
});

describe("E2E: 检定系统 - 大失败 (Crit Fail)", () => {
  // Stub roll 返回 1 (crit fail)
  // crit_fail 没有单独分支，回退到 fail 分支
  const engine = createTestEngine([1]);
  
  choose(engine, 1);
  const initialHp = engine.state.stats.hp.cur;
  
  choose(engine, 0);
  
  assertEqual(engine.state.story.node, "n_gate", "Crit Fail 回退到 fail 分支，留在 n_gate");
  assertEqual(engine.state.stats.hp.cur, initialHp - 3, "Crit Fail 回退到 fail 分支，HP -3");
  assert(getAllLogs(engine).some(l => l.includes("CRIT FAIL")), "日志显示 CRIT FAIL");
});

describe("E2E: 检定系统 - Brave buff 加成", () => {
  // 先获得 brave buff，再进行检定
  // roll=10, base=-2, buff=1 (brave)
  // total = 10 + (-2) + 1 = 9 < DC 12 → 仍然 FAIL
  const engine = createTestEngine([10]);
  
  // 获得 brave buff
  choose(engine, 2);
  
  // 验证 brave buff 存在
  engine.syncDerived();
  assert(engine.state._buffValues.brave === 1, "brave buff value = 1");
  
  // 去 n_gate 并尝试强行开门
  choose(engine, 1);
  choose(engine, 0);
  
  // 检查日志中的 buff 值
  const checkLog = getAllLogs(engine).find(l => l.includes("Force Gate"));
  assert(checkLog && checkLog.includes("buff 1"), "检定日志显示 buff = 1");
});

describe("E2E: 条件选项 - 钥匙解锁神殿", () => {
  // 使用新引擎直接测试有钥匙的情况
  const engine = createTestEngine([20]);
  engine.buy("market", "key"); // 先购买钥匙
  choose(engine, 1); // 去 n_gate
  choose(engine, 0); // 检定成功
  
  assertEqual(engine.state.story.node, "n_forest", "进入森林");
  assertEqual(engine.getItemCount("key"), 1, "有钥匙");
  
  // 有钥匙时，"Unlock the shrine door" 应该可用
  let availableChoices = getAvailableChoices(engine);
  assert(availableChoices.some(c => c.text.includes("Unlock")), "有钥匙时解锁选项可用");
  
  // 使用钥匙进入神殿 - 找到 Unlock 选项的索引
  const unlockIdx = engine.nodes[engine.state.story.node].choices.findIndex(c => c.text.includes("Unlock"));
  choose(engine, unlockIdx);
  assertEqual(engine.state.story.node, "n_shrine", "进入神殿");
  assertEqual(engine.getItemCount("key"), 0, "钥匙被消耗");
  
  // 测试无钥匙时不可用
  const engine2 = createTestEngine([20]);
  choose(engine2, 1);
  choose(engine2, 0);
  assertEqual(engine2.state.story.node, "n_forest", "进入森林（无钥匙）");
  
  availableChoices = getAvailableChoices(engine2);
  assert(!availableChoices.some(c => c.text.includes("Unlock")), "无钥匙时解锁选项不可用");
});

describe("E2E: 神殿休息恢复", () => {
  const engine = createTestEngine([20]);
  
  // 购买钥匙并进入神殿
  engine.buy("market", "key");
  choose(engine, 1);
  choose(engine, 0); // 检定成功进入森林
  choose(engine, 0); // Unlock shrine
  
  assertEqual(engine.state.story.node, "n_shrine", "进入神殿");
  
  // 先受点伤 - 直接设置 baseStats
  engine.state.baseStats.hp.cur = 10;
  engine.syncDerived();
  
  // 记录当前状态
  const hpBefore = engine.state.stats.hp.cur;
  const initialDay = engine.state.time.day;
  
  // 休息恢复
  choose(engine, 0); // Rest and recover
  
  // HP 恢复 6（但可能受 well_fed 周期效果影响）
  // 简化测试：只验证 HP 增加了
  assert(engine.state.stats.hp.cur > hpBefore, "HP 恢复增加");
  assertEqual(engine.state.time.day, initialDay + 1, "天数 +1");
});

describe("E2E: 饥饿伤害", () => {
  const engine = createTestEngine();
  
  // 清空面包避免 well_fed 的周期效果干扰
  engine.state.items = {};
  engine.syncDerived();
  
  // 将饥饿提高到 80+
  engine.state.baseStats.hunger.cur = 85;
  engine.syncDerived();
  
  const initialHp = engine.state.stats.hp.cur;
  
  // 推进一天，触发饥饿伤害
  choose(engine, 3); // Rest for a day
  
  // on_day_start 增加 10 饥饿，且饥饿 >= 80 时扣 2 HP
  assertEqual(engine.state.stats.hp.cur, initialHp - 2, "饥饿 >= 80 时扣 2 HP");
  assert(getAllLogs(engine).some(l => l.includes("Hunger hurts")), "日志记录饥饿伤害");
});

describe("E2E: 死亡结局", () => {
  const engine = createTestEngine([1, 1, 1, 1, 1, 1, 1, 1]); // 多次失败
  
  // 多次尝试开门直到死亡
  // 每次失败 HP -3，初始 HP = 20，需要 7 次失败
  for (let i = 0; i < 7; i++) {
    if (engine.state.ending) break;
    
    if (engine.state.story.node === "n1") {
      choose(engine, 1); // 去 n_gate
    }
    if (engine.state.story.node === "n_gate") {
      choose(engine, 0); // 强行开门 (失败)
    }
  }
  
  assertEqual(engine.state.ending, "dead", "HP 降到 0 触发死亡结局");
  assertEqual(engine.state.story.node, "end_dead", "跳转到死亡结局节点");
});

describe("E2E: 完整游戏流程 - 成功通关", () => {
  // 模拟一次完整的成功游戏流程
  const engine = createTestEngine([18]); // 第一次检定成功
  
  console.log("  [流程] 起始状态:");
  console.log(`    节点: ${engine.state.story.node}, HP: ${engine.state.stats.hp.cur}, 金币: ${engine.state.stats.money.cur}`);
  
  // 1. 先获得 brave buff
  choose(engine, 2);
  assert(engine.state.buffs.some(b => b.id === "brave"), "[1] 获得 brave buff");
  
  // 2. 购买钥匙
  engine.buy("market", "key");
  assert(engine.getItemCount("key") === 1, "[2] 购买钥匙");
  
  // 3. 去 n_gate 并强行开门
  choose(engine, 1);
  choose(engine, 0);
  assert(engine.state.story.node === "n_forest", "[3] 成功进入森林");
  
  // 4. 使用钥匙进入神殿
  choose(engine, 0);
  assert(engine.state.story.node === "n_shrine", "[4] 进入神殿");
  
  // 5. 休息恢复
  const hpBefore = engine.state.stats.hp.cur;
  choose(engine, 0);
  assert(engine.state.stats.hp.cur >= hpBefore, "[5] 休息后 HP 恢复或保持");
  
  console.log("  [流程] 最终状态:");
  console.log(`    节点: ${engine.state.story.node}, HP: ${engine.state.stats.hp.cur}, 天数: ${engine.state.time.day}`);
  console.log("  [流程] 游戏通关成功!");
});

// ============ 真实随机系统测试 ============

/**
 * 从检定日志中解析结果
 * 日志格式: "Force Gate | roll 12 + base -2 + buff 0 = 10 vs DC 12 -> SUCCESS"
 */
function parseCheckLog(logText) {
  const match = logText.match(/roll (\d+) \+ base (-?\d+) \+ buff (-?\d+) = (-?\d+) vs DC (\d+) -> ([\w\s]+)/);
  if (!match) return null;
  return {
    roll: parseInt(match[1]),
    base: parseInt(match[2]),
    buff: parseInt(match[3]),
    total: parseInt(match[4]),
    dc: parseInt(match[5]),
    result: match[6].trim()
  };
}

/**
 * 根据 roll/total/DC 判断预期结果
 */
function getExpectedResult(roll, total, dc, bands = { critFail: 1, critSuccess: 20 }) {
  if (roll === bands.critFail) return "CRIT FAIL";
  if (roll === bands.critSuccess) return "CRIT SUCCESS";
  return total >= dc ? "SUCCESS" : "FAIL";
}

describe("E2E: 真实随机 - 检定逻辑验证", () => {
  // 多次执行检定，每次验证结果是否符合预期逻辑
  const iterations = 20;
  
  for (let i = 0; i < iterations; i++) {
    // 创建引擎（不 stub，使用真实随机）
    const engine = new GameEngine(deepClone(gameData), () => {});
    
    // 去 n_gate 执行检定
    choose(engine, 1); // 去 n_gate
    const hpBefore = engine.state.stats.hp.cur;
    const nodeBefore = engine.state.story.node;
    
    choose(engine, 0); // Force the gate (check)
    
    // 从日志解析检定结果
    const checkLog = getAllLogs(engine).find(l => l.includes("Force Gate"));
    const parsed = parseCheckLog(checkLog);
    
    if (!parsed) {
      failed++;
      console.log(`  ✗ [${i + 1}] 无法解析检定日志: ${checkLog}`);
      continue;
    }
    
    // 验证 total 计算正确
    const expectedTotal = parsed.roll + parsed.base + parsed.buff;
    if (parsed.total !== expectedTotal) {
      failed++;
      console.log(`  ✗ [${i + 1}] total 计算错误: ${parsed.roll} + ${parsed.base} + ${parsed.buff} 应为 ${expectedTotal}, 实际 ${parsed.total}`);
      continue;
    }
    
    // 验证结果符合预期
    const expectedResult = getExpectedResult(parsed.roll, parsed.total, parsed.dc);
    if (parsed.result !== expectedResult) {
      failed++;
      console.log(`  ✗ [${i + 1}] 结果错误: roll=${parsed.roll}, total=${parsed.total}, DC=${parsed.dc} 应为 ${expectedResult}, 实际 ${parsed.result}`);
      continue;
    }
    
    // 验证状态变化符合结果
    const isSuccess = parsed.result === "SUCCESS" || parsed.result === "CRIT SUCCESS";
    const isFail = parsed.result === "FAIL" || parsed.result === "CRIT FAIL";
    
    if (isSuccess) {
      // 成功应该进入 n_forest，HP 不变
      if (engine.state.story.node !== "n_forest") {
        failed++;
        console.log(`  ✗ [${i + 1}] 成功但未进入 n_forest (实际: ${engine.state.story.node})`);
        continue;
      }
      if (engine.state.stats.hp.cur !== hpBefore) {
        failed++;
        console.log(`  ✗ [${i + 1}] 成功但 HP 改变了 (${hpBefore} -> ${engine.state.stats.hp.cur})`);
        continue;
      }
    } else if (isFail) {
      // 失败应该留在 n_gate，HP -3
      if (engine.state.story.node !== "n_gate") {
        failed++;
        console.log(`  ✗ [${i + 1}] 失败但离开了 n_gate (实际: ${engine.state.story.node})`);
        continue;
      }
      if (engine.state.stats.hp.cur !== hpBefore - 3) {
        failed++;
        console.log(`  ✗ [${i + 1}] 失败但 HP 变化不对 (${hpBefore} -> ${engine.state.stats.hp.cur}, 预期 ${hpBefore - 3})`);
        continue;
      }
    }
    
    passed++;
    console.log(`  ✓ [${i + 1}] roll=${parsed.roll}, total=${parsed.total}, DC=${parsed.dc} -> ${parsed.result} (正确)`);
  }
});

describe("E2E: 真实随机 - Brave buff 加成验证", () => {
  const iterations = 10;
  
  for (let i = 0; i < iterations; i++) {
    const engine = new GameEngine(deepClone(gameData), () => {});
    
    // 获得 brave buff
    choose(engine, 2);
    
    // 去 n_gate 执行检定
    choose(engine, 1);
    choose(engine, 0);
    
    const checkLog = getAllLogs(engine).find(l => l.includes("Force Gate"));
    const parsed = parseCheckLog(checkLog);
    
    if (!parsed) {
      failed++;
      console.log(`  ✗ [${i + 1}] 无法解析检定日志`);
      continue;
    }
    
    // 验证 buff 值为 1（brave 的值）
    if (parsed.buff !== 1) {
      failed++;
      console.log(`  ✗ [${i + 1}] buff 应为 1 (brave), 实际 ${parsed.buff}`);
      continue;
    }
    
    // 验证 total 计算包含 buff
    const expectedTotal = parsed.roll + parsed.base + parsed.buff;
    if (parsed.total !== expectedTotal) {
      failed++;
      console.log(`  ✗ [${i + 1}] total 计算错误`);
      continue;
    }
    
    // 验证结果符合逻辑
    const expectedResult = getExpectedResult(parsed.roll, parsed.total, parsed.dc);
    if (parsed.result !== expectedResult) {
      failed++;
      console.log(`  ✗ [${i + 1}] 结果错误`);
      continue;
    }
    
    passed++;
    console.log(`  ✓ [${i + 1}] roll=${parsed.roll} + base=${parsed.base} + buff=${parsed.buff} = ${parsed.total} vs DC=${parsed.dc} -> ${parsed.result}`);
  }
});

describe("E2E: 真实随机 - 骰子分布验证", () => {
  // 验证骰子结果在合理范围内，且分布相对均匀
  const rolls = [];
  const iterations = 100;
  
  for (let i = 0; i < iterations; i++) {
    const engine = new GameEngine(deepClone(gameData), () => {});
    choose(engine, 1);
    choose(engine, 0);
    
    const checkLog = getAllLogs(engine).find(l => l.includes("Force Gate"));
    const parsed = parseCheckLog(checkLog);
    if (parsed) {
      rolls.push(parsed.roll);
    }
  }
  
  // 验证所有 roll 在 1-20 范围内
  const allInRange = rolls.every(r => r >= 1 && r <= 20);
  assert(allInRange, `所有 ${rolls.length} 次投掷都在 1-20 范围内`);
  
  // 验证有多样性（不是所有都一样）
  const uniqueRolls = new Set(rolls);
  assert(uniqueRolls.size > 5, `骰子结果有足够多样性 (${uniqueRolls.size} 种不同值)`);
  
  // 验证大致分布（允许一定偏差）
  const lowRolls = rolls.filter(r => r <= 10).length;
  const highRolls = rolls.filter(r => r > 10).length;
  const ratio = lowRolls / highRolls;
  assert(ratio > 0.3 && ratio < 3, `低/高投掷比例合理: ${lowRolls}/${highRolls} = ${ratio.toFixed(2)}`);
  
  // 统计成功/失败次数
  const successes = rolls.filter((r, i) => {
    const engine = new GameEngine(deepClone(gameData), () => {});
    // base = floor((6-10)/2) = -2, buff = 0
    const total = r + (-2) + 0;
    return r === 20 || (r !== 1 && total >= 12);
  }).length;
  
  console.log(`  [统计] ${iterations} 次检定: ${successes} 成功, ${iterations - successes} 失败`);
});

// ============ 运行总结 ============

console.log("\n" + "=".repeat(50));
console.log(`E2E 测试完成: ${passed} 通过, ${failed} 失败`);
console.log("=".repeat(50));

if (failed > 0) {
  process.exit(1);
}
