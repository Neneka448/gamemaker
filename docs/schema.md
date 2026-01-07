# JSON DSL 说明（简要版）

## 顶层字段
- `meta`: 基本信息，例如 `{ "title": "...", "version": 1 }`
- `resources`: 资源（目前只用到容量 `capacity`）
- `stats`: 数值，形如 `{ hp: { cur, max }, money: { cur, max } }`
- `items`: 道具定义（堆叠、使用效果、持有触发的 buff）
- `buffs`: Buff 定义（数值、属性修饰、周期效果）
- `shops`: 商店及商品（花费/条件/效果）
- `events`: 全局事件（按触发时机执行）
- `story`: 剧情图，包含 `start` 与 `nodes`
- `endings`: 结局判定（全局条件，命中后跳到结局节点）

## 表达式与上下文
- 统一使用 JS 子集表达式，变量全部 `$` 前缀。
- 全局可用变量：
  - `$stat`：例如 `$stat.hp.cur`
  - `$item`：背包数量
  - `$flag`：标记
  - `$capacity`：容量
  - `$day`：当前天数
  - `$buff`：聚合后的 buff 数值，例如 `$buff.brave`
- 函数：`roll("2d6+1")`, `itemCount(id)`, `hasItem(id, n)`, `hasBuff(id)`, `flag(id)`, `min/max/clamp/floor/ceil/abs/round/random`
- 临时上下文：
  - 在检查（检定）中提供 `$check`：`{ name, roll, base, buff, total, dc, result }`
  - 在检查时还会注入 `$roll`, `$base`, `$buff_sum`, `$total`, `$dc`
- 持有 buff 时，`hold_buffs.value_expr` 会拿到 `$count`（道具数量）。

## Buff 定义
```json
"buffs": {
  "brave": {
    "desc": "描述",
    "value_expr": "1",               // 给表达式系统暴露的数值，出现在 $buff.brave
    "modifiers": [                  // 对属性的影响
      { "type": "stat_add_max", "stat": "stamina", "value_expr": "1" },
      { "type": "stat_add", "stat": "stamina", "value_expr": "1" }
    ],
    "periodic": {                   // 可选，周期触发
      "every": "day",
      "conditions": [],
      "effects": [ ... ]
    }
  }
}
```
- 同名 buff 叠加时，`value_expr` 计算后求和，得到 `$buff.<id>`。

## 道具定义（持有 buff）
```json
"items": {
  "food": {
    "name": "Bread",
    "stackable": true,
    "start_count": 2,
    "use_effects": [ ... ],
    "hold_buffs": [
      { "buff": "well_fed", "value_expr": "$count * 2" }  // 按数量叠加
    ]
  }
}
```

## 效果（Effects）支持的类型
- `capacity_add`
- `stat_add`, `stat_set`, `stat_add_max`
- `item_add`, `item_remove`
- `buff_add`, `buff_remove`
- `flag_set`
- `advance_day`, `goto`, `log`

## 事件（Events）
```json
{ "trigger": "on_day_start", "conditions": [ ... ], "effects": [ ... ] }
```

## 商店（Shops）
```json
"shops": {
  "market": {
    "items": [
      {
        "id": "bread",
        "price": 4,                      // 展示用
        "conditions": ["$stat.money.cur >= 4"],
        "effects": [
          { "type": "stat_add", "stat": "money", "value_expr": "-4" },
          { "type": "item_add", "item": "bread", "count_expr": "1" }
        ]
      }
    ]
  }
}
```

## 剧情节点与选择
```json
"story": {
  "start": "n1",
  "nodes": {
    "n1": {
      "title": "...",
      "text": "...",
      "shops": ["market"],   // 可选，节点上显示的商店
      "choices": [
        { "text": "Go", "effects": [ { "type": "goto", "node": "n2" } ] },
        { "text": "Rest", "effects": [ { "type": "advance_day", "value_expr": "1" } ] },
        { "text": "Try force", "check": { ...见下... } }
      ]
    }
  }
}
```

## 检定（Check）结构
```json
"check": {
  "name": "Force Gate",
  "roll_expr": "roll('1d20')",                 // 骰子
  "base_expr": "floor(($stat.stamina.cur - 10) / 2)", // 属性映射
  "buff_expr": "$buff.brave ?? 0",             // buff 修正组合
  "total_expr": "$roll + $base + $buff_sum",   // 可选，总公式
  "dc": 12,                                    // 难度
  "bands": {                                   // 可选，分级范围（按骰子点数）
    "crit_fail": { "range": "1" },             // 不写则默认最小值
    "crit_success": { "range": "20" }          // 不写则默认最大值
    // success/fail 未写时，会把剩余点数按比例或平均分配
  },
  "success": { "effects": [ ... ] },
  "fail": { "effects": [ ... ] },
  "crit_success": { "effects": [ ... ] },      // 可选
  "crit_fail": { "effects": [ ... ] }          // 可选
}
```
判定流程：
1) 计算 `roll`、`base`、`buff_sum`、`total`。
2) 先看是否命中 `crit_fail/crit_success` 范围；否则按 success/fail 范围；若未配置范围则使用 `total >= dc` 判断。
3) 执行对应分支 `effects`（可选 `goto`）。
4) 日志输出：`名称 | roll R + base B + buff C = T vs DC -> 结果等级`。

范围分配规则（缺省时）：
- 如配置了大成/大败但未写范围，默认取最小值/最大值。
- success/fail 未写范围时，将除去大成/大败后的点数平均分；如果部分范围已写，剩余点数按写定范围长度比例补齐。

## 结局（Endings）
```json
{ "id": "dead", "conditions": ["$stat.hp.cur <= 0"], "node": "end_dead" }
```

## 变量汇总
- `$stat.*` 数值
- `$item.*` 道具数量
- `$flag.*` 标记
- `$buff.*` Buff 聚合数值
- `$capacity`, `$day`
- 检定时：`$roll`, `$base`, `$buff_sum`, `$total`, `$dc`, `$check`
