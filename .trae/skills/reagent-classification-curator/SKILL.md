---
name: "reagent-classification-curator"
description: "扩展和维护试剂分类知识，并指导如何识别未知商品名与补充标签。遇到新试剂名、分类不准或需要扩充词库时调用。"
---

# 试剂分类扩展助手

## 何时调用

- 遇到新的商品名，现有规则、提示词或词库无法稳定识别时
- 现有分类结果过粗，需要补充更细的 `category`、`subCategory` 或 `experimentTags` 时
- 需要为一个试剂家族批量补充别名、排除词、证据规则时
- 需要把临时人工判断沉淀为统一机器可读词库时

## 目标

- 将试剂分类知识维护为统一事实源，而不是把经验散落在 prompt、正则和测试里
- 优先扩展可复用的类别、子类、标签和识别证据
- 输出应同时利于：
  - Trae/Agent 后续复用
  - 项目运行时直接消费
  - 测试与回归验证

## 工作原则

### 1. 先拆商品名，再决定分类

按以下顺序识别：

1. 核心试剂家族
   - 抗体、引物、缓冲液、试剂盒、化学品、生物活性试剂、耗材
2. 作用性质
   - 重组蛋白、细胞因子、生长因子、配体、激动剂、抑制剂、酶、核酸、载体
3. 实验用途
   - 培养、转染、筛选、WB、IF、qPCR、ELISA、流式、外泌体等
4. 附加元信息
   - 物种、宿主、靶标、厂商、货号线索

### 2. 优先维护统一词库

遇到新知识时，优先把它落到统一词库，而不是直接：

- 临时改 prompt
- 只补一个正则
- 只在测试里硬编码例子

词库应作为单一事实源，供运行时检索层、prompt 和 fallback 共同消费。

### 3. 一条知识要完整

新增词库项时，尽量同时补齐：

- `canonicalName`
- `aliases`
- `category`
- `subCategory`
- `experimentTags`
- `namePatterns`
- `requiredKeywords`
- `excludedKeywords`
- `confidenceHint`
- `notes`

不要只补一个别名而不补分类结果。

### 4. 标签遵循“实验语义”

标签优先表达实验用途或作用逻辑，而不是重复类别名称。

示例：

- `Recombinant human IL-6`
  - `category`: `BIOLOGICAL`
  - `subCategory`: `Recombinant Cytokine`
  - `experimentTags`: `CELL_STIMULATION_REAGENT`, `SIGNALING_MODULATOR`

- `LC3B siRNA smartpool`
  - `category`: `BIOLOGICAL`
  - `subCategory`: `siRNA`
  - `experimentTags`: `GENE_DELIVERY_REAGENT`

- `MK-2206 AKT inhibitor`
  - `category`: `CHEMICAL`
  - `subCategory`: `Pathway Inhibitor`
  - `experimentTags`: `SIGNALING_MODULATOR`

## 分类优先级

当一个商品名命中多个候选时，按以下优先级决策：

1. 明确结构性证据
   - `antibody`, `primer`, `probe`, `buffer`, `kit`, `membrane`
2. 明确家族词
   - `recombinant`, `cytokine`, `growth factor`, `ligand`, `siRNA`, `plasmid`, `lentivirus`
3. 明确实验用途词
   - `transfection`, `selection`, `lysis`, `mounting`, `SYBR`
4. 模糊通用词
   - `protein`, `reagent`, `solution`

若出现冲突：

- 有明确结构性证据时，不被模糊词覆盖
- 有排除词命中时，应降低置信度或拒绝匹配

## 歧义处理

### 情况 1：只有缩写，没有上下文

例如：

- `sRANKL`
- `IL6`
- `MK2206`

处理方式：

- 先查别名是否命中
- 再结合 `catalogNo` 与 `note`
- 若仍不够，输出候选并降低 `confidenceHint`
- 不要强行过拟合

### 情况 2：同名可属于多个家族

例如某些词既可表示蛋白，也可表示抗体靶点。

处理方式：

- 优先看结构性后缀：`antibody`、`protein`、`primer`
- 再结合实验标签候选和上下文

### 情况 3：商品名混入营销文本

例如：

- `Premium recombinant human IL-6 for cell culture`

处理方式：

- 忽略营销形容词
- 提取真正决定分类的核心词

## 推荐输出格式

当你判断需要新增或修正词库项时，优先产出以下信息：

```json
{
  "canonicalName": "RANKL",
  "aliases": ["sRANKL", "Soluble RANK Ligand", "TNFSF11"],
  "category": "BIOLOGICAL",
  "subCategory": "Recombinant Protein",
  "experimentTags": ["CELL_STIMULATION_REAGENT", "SIGNALING_MODULATOR"],
  "namePatterns": ["rankl", "soluble rank ligand"],
  "requiredKeywords": ["recombinant", "protein"],
  "excludedKeywords": ["antibody", "primer"],
  "confidenceHint": 0.95,
  "notes": "配体型重组蛋白，常用于细胞刺激与信号调节研究"
}
```

## 执行步骤

1. 提取商品名中的核心词、结构词、实验词
2. 判断是否命中现有词库
3. 若命中不足，提出新增或修订的词库项
4. 明确 `category`、`subCategory`、`experimentTags`
5. 明确需要新增的别名、排除词和证据词
6. 给出建议测试样例

## 维护建议

- 高频家族优先整组维护，不要只修一个单品
- 每次新增知识时，至少补一个正样例和一个容易误判的反样例
- 对生物活性试剂，优先关注：
  - `CELL_STIMULATION_REAGENT`
  - `SIGNALING_MODULATOR`
  - `GENE_DELIVERY_REAGENT`

## 示例

### 输入

`Soluble RANK Ligand (sRANKL) Protein, Recombinant human`

### 分析

- `Protein` 指向蛋白类
- `Recombinant` 指向重组制备
- `RANK Ligand` 指向配体型信号调节分子
- 不含 `antibody`、`primer` 等排除结构词

### 输出建议

- `category`: `BIOLOGICAL`
- `subCategory`: `Recombinant Protein`
- `experimentTags`:
  - `CELL_STIMULATION_REAGENT`
  - `SIGNALING_MODULATOR`
- 新增别名：
  - `sRANKL`
  - `Soluble RANK Ligand`
  - `RANKL`

