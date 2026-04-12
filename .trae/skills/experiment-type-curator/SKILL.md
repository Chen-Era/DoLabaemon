---
name: "experiment-type-curator"
description: "扩展实验类型、流程阶段与试剂配置知识。遇到新增实验、手动实验名解析不稳或需要审查模型生成试剂清单时调用。"
---

# 实验类型扩展助手

## 何时调用

- 需要为项目新增一个正式实验类型时
- 需要为某个实验补充最低必需试剂、推荐试剂和流程阶段时
- 手动输入实验名称无法稳定匹配已有类型，需要设计别名与判定模板时
- 模型生成了新的实验类型候选，需要审查其试剂配置是否符合学术规范时

## 目标

- 把实验类型知识维护成可复用、可审阅、可被项目运行时直接消费的结构化资产
- 让“人工扩展方法”和“API 模型增强上下文”共享同一套知识
- 输出结果优先服务于：
  - 实验可行性判定
  - 手动输入实验名称的匹配
  - 低匹配场景下的模型候选生成

## 工作原则

### 1. 先拆流程，再列试剂

新增实验类型时，先把流程拆成 3-5 个稳定阶段，再为每个阶段列试剂需求。

常见阶段示例：

- 样本/细胞准备
- 反应或孵育
- 检测或染色
- 洗涤或显影
- 结果读取前质控

不要一上来就堆商品名或品牌。

### 2. 只沉淀“试剂语义”，不混入系统边界外要素

本项目优先维护：

- 缓冲液
- 抗体
- 引物
- 检测试剂
- 分离/提取/转染/刺激相关试剂

本项目不应直接把以下内容写成阻断试剂配置：

- 仪器
- 耗材
- 培养箱
- 显微镜
- 离心机
- 人员操作习惯

如确有必要，只能作为 `warnings` 或说明，不应伪装成试剂规则。

### 3. 区分最低必需与推荐补充

- `MIN_REQUIRED`
  - 缺失时实验不可开展或结论高度不可靠
- `RECOMMENDED`
  - 缺失时不阻断，但应提示补充以提高质量、解释性或规范性

判断标准要保守，不要把“最好有”误写成“必须有”。

### 4. 优先复用现有标签和匹配器

列试剂配置时，优先映射到项目已有：

- `experimentTags`
- `matcherType`
- `matcherValues`

优先使用：

- `TAG_ANY`
- `ANTIBODY_TARGET_ANY`
- `PRIMER_TARGET_ANY`
- `PRIMER_REFERENCE`

不要随意创造新的匹配语义，除非现有结构无法表达。

### 5. 优先维护结构化知识资产

新增实验类型时，应优先更新：

- `src/lib/experiment-knowledge/catalog.json`
- `src/lib/rules/catalog.ts`

不要只在 prompt 里补一段经验文本。

## 实验扩展步骤

1. 明确实验的标准名称、英文名、常见缩写和中文别名
2. 识别该实验的核心读出：
   - 蛋白条带
   - 基因表达
   - 荧光成像
   - 板上显色
   - 细胞表型
3. 将流程拆成稳定阶段
4. 为每个阶段列出最低必需试剂模板
5. 再列推荐补充试剂模板
6. 判断哪些条目可复用现有 `experimentTags`
7. 输出结构化条目，供代码库与运行时共同消费

## 学术规范审查清单

- 该实验是否把“检测读出所需核心试剂”列为最低必需
- 是否把常见自配缓冲液过度提升为阻断项
- 是否把方向性 marker 与基础实验试剂混在一起
- 是否把某个课题组特定设计误当成通用共识
- 是否把仪器、耗材或操作步骤误写成试剂需求
- 是否给出了必要的 warning，而不是强行给出过高置信度

## 推荐输出结构

```json
{
  "canonicalName": "ELISA",
  "aliases": ["Enzyme-linked immunosorbent assay", "酶联免疫吸附实验"],
  "normalizedCode": "ELISA",
  "workflowStages": [
    { "key": "coat", "labelZh": "包被与封闭", "relatedExperimentTags": ["ELISA_COATING_REAGENT", "ELISA_BLOCKING_REAGENT"] },
    { "key": "wash", "labelZh": "洗板", "relatedExperimentTags": ["ELISA_WASH_BUFFER"] },
    { "key": "detect", "labelZh": "检测与显色", "relatedExperimentTags": ["ELISA_DETECTION_ANTIBODY", "ELISA_SUBSTRATE"] }
  ],
  "requiredReagentTemplates": [
    { "nameZh": "ELISA 需要包被相关试剂", "level": "MIN_REQUIRED", "matcherType": "TAG_ANY", "matcherValues": ["ELISA_COATING_REAGENT"] }
  ],
  "recommendedReagentTemplates": [
    { "nameZh": "推荐补充刺激或处理试剂", "level": "RECOMMENDED", "matcherType": "TAG_ANY", "matcherValues": ["CELL_STIMULATION_REAGENT"] }
  ]
}
```

## 审查模型候选时的要求

- 若模型把模糊实验名归一到已有类型，先检查是否真的存在共识性别名
- 若模型提出新实验类型，必须检查：
  - 名称是否规范
  - 流程阶段是否完整
  - 最低必需试剂是否足以支撑实验读出
  - 推荐项是否与读出质量或规范性相关
- 若证据不足，应保留 `needsConfirmation`，而不是自动落库

## 示例

### 输入

`conditioned medium cytokine secretion assay`

### 推荐思路

- 先判断是否可归一到已有 `ELISA`
- 若上下文强调“细胞上清细胞因子定量”，可把 `ELISA` 作为候选已有类型
- 若证据不足，则返回候选：
  - `proposedExperimentName`: `Secreted cytokine ELISA`
  - `matchedExistingCode`: `ELISA`
  - `needsConfirmation`: `true`
- 最低必需仍应围绕：
  - 包被/捕获
  - 封闭
  - 洗板
  - 检测抗体
  - 底物

### 不应输出

- “酶标仪”为试剂
- “96 孔板”为试剂
- “严格按照课题组 SOP 操作”作为阻断规则
