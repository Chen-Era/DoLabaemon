# 分类体系速查（摘自项目内置知识库 catalog.json）

> 数据来源：`src/lib/reagent-knowledge/catalog.json`（项目内置基线知识库）。
> 当前基线只覆盖 `BIOLOGICAL` 与 `CHEMICAL` 两个大类，其余大类暂无真实条目——
> 不要据此推断"这些大类不受理"，只是基线尚未收录，产出时按 SKILL.md 的枚举正常使用即可。

## BIOLOGICAL · 生物制品（基线共 12 条，示例 3 条）

| canonicalName | subCategory | experimentTags | evidenceType |
|---------------|-------------|----------------|--------------|
| `RANKL` | Recombinant Protein | CELL_STIMULATION_REAGENT, SIGNALING_MODULATOR, OSTEOCLAST_DIFFERENTIATION_REAGENT, BONE_REMODELING_SIGNAL | exact_alias |
| `IL6` | Recombinant Cytokine | CELL_STIMULATION_REAGENT, SIGNALING_MODULATOR, IMMUNE_CYTOKINE_REAGENT | exact_alias |
| `Matrigel` | Extracellular Matrix Coating | ECM_COATING_REAGENT, STEM_CELL_MATRIX | keyword_family |

其余条目（供参考风格）：`BMP2`、`M-CSF`、`OPG`、`TGF-beta1`、`ECM coating protein`、`Expression Plasmid`、`siRNA`、`shRNA`、`CRISPR`。

观察：

- 单一分子（RANKL/IL6 等）多为 `exact_alias`，`aliases` 收录官方名/缩写/全名/基因名（如 `TNFSF11`）。
- 产品家族（Matrigel、siRNA、CRISPR）多为 `keyword_family`，`aliases` 收录商品名与同义家族词。
- 蛋白/核酸类条目普遍用 `excludedKeywords: ["antibody","primer","probe"]` 做结构互斥。

## CHEMICAL · 化学试剂（基线共 2 条，全部列出）

| canonicalName | subCategory | experimentTags | evidenceType |
|---------------|-------------|----------------|--------------|
| `AKT inhibitor` | Pathway Inhibitor | SIGNALING_MODULATOR | keyword_family |
| `Gamma Secretase inhibitor` | Pathway Inhibitor | SIGNALING_MODULATOR | keyword_family |

观察：小分子抑制剂以"通路 + inhibitor"命名，`aliases` 收录代表化合物编号（`MK-2206`、`DAPT`）。

## 其余大类（基线暂无条目）

| category | 说明与产出提示 |
|----------|----------------|
| `ANTIBODY` | 暂无示例。子分类参考项目代码语义：`Primary Antibody` / `Secondary Antibody`；标签用 `WB_PRIMARY_ANTIBODY`、`IF_PRIMARY_ANTIBODY`、`WB_SECONDARY_ANTIBODY`、`IF_FLUORESCENT_SECONDARY_ANTIBODY`、`FLOW_*_ANTIBODY` 等。 |
| `BUFFER` | 暂无示例。标签即用途：`WB_LYSIS_BUFFER`、`WB_WASH_BUFFER`、`FLOW_STAIN_BUFFER`、`ELISA_WASH_BUFFER` 等。 |
| `KIT` | 暂无示例。整体试剂盒（如提取试剂盒、ELISA 试剂盒）按用途打标签。 |
| `PRIMER` | 暂无示例。qPCR 引物本身没有专属 experimentTag（规则引擎按靶点匹配引物），通常留空数组即可。 |
| `CONSUMABLE` | 暂无示例。耗材类（膜、板等），如 `WB_TRANSFER_MEMBRANE`。 |
| `OTHER` | 兜底分类，能归入前 7 类就不要用。 |

## 子分类（subCategory）用词参考

以下来自项目代码 `src/lib/reagent-tagging.ts` 中实际使用的子分类字符串（非枚举，可自由取值，但优先复用既有写法）：

- 蛋白/因子：`Recombinant Protein`、`Recombinant Cytokine`、`Recombinant Growth Factor`、`Growth Factor`、`Cytokine`、`Chemokine`、`Ligand Protein`、`Peptide`、`Hormone`
- 酶与核酸工具：`Enzyme`、`Nuclease`
- 基因递送：`Expression Plasmid`、`siRNA`、`shRNA`、`CRISPR Reagent`、`AAV Vector`、`Adenoviral Vector`、`Gene Delivery Reagent`
- 基质与包被：`Extracellular Matrix Coating`
- 小分子：`Pathway Inhibitor`、`Agonist / Activator`、`Small Molecule Compound`

新增子分类时保持"英文短语、首字母大写"的既有风格（如 `RNA Extraction Reagent`、`Chemiluminescent Substrate`）。
