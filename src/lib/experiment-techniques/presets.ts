import { createHash } from "node:crypto";

import type {
  TechniqueBlueprint,
  TechniquePresetCode,
} from "@/lib/experiment-techniques/data/blueprint";
import type {
  ExperimentTechnique,
  LocalizedLabel,
  TechniqueProfile,
  TechniqueRequirement,
} from "@/lib/experiment-techniques/types";
import { resolveTechniqueReagentCapability } from "@/lib/experiment-techniques/reagent-capabilities";
import type { ExperimentTag } from "@/lib/rules/catalog";

type PresetDefinition = {
  workflow: Array<[string, string]>;
  reagent: [string, string];
  consumable: [string, string];
  instrument: [string, string];
  sample: [string, string];
  control: [string, string];
  software: [string, string];
  qc: [string, string];
  limitation: [string, string];
  troubleshooting: {
    symptom: [string, string];
    action: [string, string];
  };
};

const presetDefinitions: Record<TechniquePresetCode, PresetDefinition> = {
  SAMPLE_PREPARATION: preset(
    ["样本接收与身份核验", "Receive and verify sample identity"],
    ["预处理与分装", "Pre-process and aliquot"],
    ["保存并记录去向", "Preserve and record disposition"],
    ["样本处理试剂", "Sample-processing reagent"],
    ["低吸附容器与移液耗材", "Low-binding containers and pipetting supplies"],
    ["样本处理与温控设备", "Sample-processing and temperature-control equipment"],
    ["待处理的合格样本", "Qualified sample for processing"],
    ["空白处理对照或参考样本", "Process blank or reference sample"],
    ["样本追踪与温度记录工具", "Sample-tracking and temperature-recording tool"],
    ["身份、回收率与完整性满足本地预设标准", "Identity, recovery and integrity meet the locally predefined criteria"],
  ),
  CELL_CULTURE: preset(
    ["培养物与培养基检查", "Inspect culture and medium"],
    ["接种、培养与处理", "Seed, culture and treat"],
    ["收获并记录状态", "Harvest and record state"],
    ["细胞培养基与补充物", "Cell-culture medium and supplements"],
    ["无菌培养耗材", "Sterile culture consumables"],
    ["生物安全柜与培养设备", "Biosafety cabinet and culture equipment"],
    ["身份已确认的细胞材料", "Identity-confirmed cellular material"],
    ["阴性培养对照与已知状态参考细胞", "Negative culture control and known-state reference cells"],
    ["培养记录与污染监测工具", "Culture-record and contamination-monitoring tool"],
    ["培养物身份、活率和污染状态合格", "Culture identity, viability and contamination status are acceptable"],
  ),
  TISSUE_MODEL: preset(
    ["模型建立前检查", "Pre-model checks"],
    ["组织或三维模型构建", "Construct tissue or three-dimensional model"],
    ["成熟度与功能确认", "Confirm maturity and function"],
    ["组织模型培养与基质试剂", "Tissue-model culture and matrix reagents"],
    ["模型培养载体与无菌耗材", "Model supports and sterile consumables"],
    ["组织培养与环境控制设备", "Tissue-culture and environmental-control equipment"],
    ["适配的组织、细胞或类器官材料", "Compatible tissue, cell or organoid material"],
    ["基线模型与处理对照", "Baseline model and treatment control"],
    ["模型培养和成像记录软件", "Model culture and imaging record software"],
    ["形态、活率和预定义功能指标合格", "Morphology, viability and predefined functional indicators are acceptable"],
  ),
  NUCLEIC_ACID_EXTRACTION: preset(
    ["样本裂解", "Lyse sample"],
    ["核酸分离与洗涤", "Isolate and wash nucleic acid"],
    ["洗脱、定量与保存", "Elute, quantify and store"],
    ["核酸提取与纯化试剂", "Nucleic-acid extraction and purification reagents"],
    ["无核酸酶耗材与分离载体", "Nuclease-free consumables and separation matrix"],
    ["离心、磁分离与定量设备", "Centrifugation, magnetic-separation and quantification equipment"],
    ["来源与保存条件明确的生物样本", "Biological sample with documented origin and storage"],
    ["提取空白与阳性过程对照", "Extraction blank and positive process control"],
    ["核酸定量与样本追踪软件", "Nucleic-acid quantification and sample-tracking software"],
    ["产量、纯度、完整性和污染检查达到下游要求", "Yield, purity, integrity and contamination checks meet downstream requirements"],
  ),
  PCR_AMPLIFICATION: preset(
    ["反应设计与模板检查", "Design reaction and inspect template"],
    ["反应配置与扩增", "Configure reaction and amplify"],
    ["信号判读与质量复核", "Interpret signal and review quality"],
    ["扩增酶、引物与反应体系", "Amplification enzyme, primers and reaction chemistry"],
    ["无核酸酶反应耗材", "Nuclease-free reaction consumables"],
    ["校准合格的扩增与检测仪", "Qualified amplification and detection instrument"],
    ["质量合格的核酸模板", "Quality-qualified nucleic-acid template"],
    ["无模板、阴性与阳性扩增对照", "No-template, negative and positive amplification controls"],
    ["仪器采集与扩增分析软件", "Instrument-acquisition and amplification-analysis software"],
    ["对照行为、扩增特异性和重复性满足预设判据", "Control behavior, amplification specificity and repeatability meet predefined criteria"],
  ),
  MOLECULAR_CLONING: preset(
    ["构建设计与片段准备", "Design construct and prepare fragments"],
    ["组装、转化与筛选", "Assemble, transform and select"],
    ["克隆鉴定与归档", "Verify and archive clone"],
    ["克隆、组装与筛选试剂", "Cloning, assembly and selection reagents"],
    ["无菌培养与分子克隆耗材", "Sterile culture and molecular-cloning consumables"],
    ["温控、培养与核酸检测设备", "Temperature-control, culture and nucleic-acid detection equipment"],
    ["载体和目标核酸片段", "Vector and target nucleic-acid fragments"],
    ["载体背景、阴性和已知阳性对照", "Vector-background, negative and known-positive controls"],
    ["序列设计、质粒记录与结果审阅软件", "Sequence-design, plasmid-record and result-review software"],
    ["连接边界、插入方向和全长序列验证合格", "Junctions, insert orientation and full-length sequence verification are acceptable"],
  ),
  GENE_DELIVERY: preset(
    ["递送体系和细胞检查", "Inspect delivery system and cells"],
    ["递送与恢复", "Deliver cargo and recover"],
    ["效率、毒性与表达评估", "Assess efficiency, toxicity and expression"],
    ["基因递送试剂或载体", "Gene-delivery reagent or vector"],
    ["无菌细胞操作耗材", "Sterile cell-handling consumables"],
    ["细胞培养与递送辅助设备", "Cell-culture and delivery-support equipment"],
    ["状态合格的受体细胞与核酸货物", "Qualified recipient cells and nucleic-acid cargo"],
    ["未处理、模拟处理与阳性递送对照", "Untreated, mock-treated and positive-delivery controls"],
    ["递送参数与表达结果记录软件", "Delivery-parameter and expression-result software"],
    ["递送效率、细胞活率和非特异效应满足预设判据", "Delivery efficiency, cell viability and nonspecific effects meet predefined criteria"],
  ),
  GENE_EDITING: preset(
    ["编辑方案与脱靶风险设计", "Design editing strategy and off-target assessment"],
    ["编辑组分递送与恢复", "Deliver editing components and recover"],
    ["基因型与表型验证", "Verify genotype and phenotype"],
    ["基因编辑酶、向导和修复模板", "Gene-editing enzyme, guide and repair template"],
    ["无菌培养与基因分型耗材", "Sterile culture and genotyping consumables"],
    ["递送、培养与基因分型设备", "Delivery, culture and genotyping equipment"],
    ["身份已确认的受体材料", "Identity-confirmed recipient material"],
    ["未编辑、模拟编辑和阳性编辑对照", "Unedited, mock-edited and positive-edit controls"],
    ["向导设计、序列分析与谱系追踪软件", "Guide-design, sequence-review and lineage-tracking software"],
    ["目标编辑、克隆纯度、潜在脱靶和表型一致性合格", "On-target edit, clone purity, potential off-targets and phenotype concordance are acceptable"],
  ),
  NUCLEIC_ACID_HYBRIDIZATION: preset(
    ["探针与样本准备", "Prepare probe and sample"],
    ["杂交与严格洗涤", "Hybridize and perform stringent washes"],
    ["信号采集与背景评估", "Acquire signal and assess background"],
    ["标记探针与杂交试剂", "Labeled probe and hybridization reagents"],
    ["无核酸酶杂交耗材", "Nuclease-free hybridization consumables"],
    ["杂交、洗涤与信号检测设备", "Hybridization, washing and signal-detection equipment"],
    ["固定或提取的核酸样本", "Fixed or extracted nucleic-acid sample"],
    ["错配、阴性和阳性探针对照", "Mismatch, negative and positive probe controls"],
    ["探针设计与信号定量软件", "Probe-design and signal-quantification software"],
    ["探针特异性、背景和动态范围满足预设判据", "Probe specificity, background and dynamic range meet predefined criteria"],
  ),
  PROTEIN_ANALYSIS: preset(
    ["蛋白样本与定量检查", "Inspect and quantify protein sample"],
    ["分离、反应或检测", "Separate, react or detect"],
    ["信号归一化与复核", "Normalize and review signal"],
    ["蛋白分析、标记与检测试剂", "Protein-analysis, labeling and detection reagents"],
    ["低吸附蛋白实验耗材", "Low-binding protein-analysis consumables"],
    ["蛋白分离与信号采集设备", "Protein-separation and signal-acquisition equipment"],
    ["质量合格的蛋白或裂解物", "Quality-qualified protein or lysate"],
    ["上样、阴性和已知阳性对照", "Loading, negative and known-positive controls"],
    ["采集、定量与归一化软件", "Acquisition, quantification and normalization software"],
    ["对照、线性范围、重复性和归一化指标合格", "Controls, linear range, repeatability and normalization metrics are acceptable"],
  ),
  IMMUNOASSAY: preset(
    ["抗体与样本适用性检查", "Inspect antibody and sample suitability"],
    ["结合、洗涤与信号产生", "Bind, wash and generate signal"],
    ["对照审阅与结果计算", "Review controls and calculate result"],
    ["经验证的抗体与免疫检测试剂", "Validated antibody and immunoassay reagents"],
    ["低吸附反应与洗涤耗材", "Low-binding reaction and washing consumables"],
    ["孵育、洗涤与信号检测设备", "Incubation, washing and signal-detection equipment"],
    ["与检测基质匹配的样本", "Sample compatible with the assay matrix"],
    ["空白、阴性、阳性和基质对照", "Blank, negative, positive and matrix controls"],
    ["仪器采集与免疫分析软件", "Instrument-acquisition and immunoassay software"],
    ["标准曲线或参考信号、背景、平行性和重复性合格", "Calibration or reference signal, background, parallelism and repeatability are acceptable"],
  ),
  PROTEIN_PURIFICATION: preset(
    ["样本澄清与柱条件准备", "Clarify sample and prepare separation conditions"],
    ["捕获、洗涤与洗脱", "Capture, wash and elute"],
    ["组分评估、合并与保存", "Assess, pool and store fractions"],
    ["纯化介质、缓冲液与稳定剂", "Purification matrix, buffers and stabilizers"],
    ["低吸附管路、柱与收集耗材", "Low-binding tubing, columns and collection consumables"],
    ["层析、离心与蛋白检测设备", "Chromatography, centrifugation and protein-detection equipment"],
    ["可溶且稳定的蛋白样本", "Soluble and stable protein sample"],
    ["过程空白与已知蛋白参考物", "Process blank and known-protein reference"],
    ["层析采集、峰处理与批次记录软件", "Chromatography-acquisition, peak-processing and batch-record software"],
    ["回收率、纯度、聚集状态和活性满足用途要求", "Recovery, purity, aggregation state and activity meet intended-use requirements"],
  ),
  MICROSCOPY: preset(
    ["样本、标记与成像条件检查", "Inspect sample, labeling and imaging conditions"],
    ["图像采集", "Acquire images"],
    ["图像质控、定量与归档", "Quality-control, quantify and archive images"],
    ["成像标记、封片与抗淬灭试剂", "Imaging-label, mounting and antifade reagents"],
    ["光学级载体与成像耗材", "Optical-grade supports and imaging consumables"],
    ["校准合格的显微成像系统", "Qualified microscopy imaging system"],
    ["固定或活体成像样本", "Fixed or live imaging sample"],
    ["未标记、单标记和已知结构对照", "Unlabeled, single-label and known-structure controls"],
    ["仪器采集、元数据与图像分析软件", "Instrument-acquisition, metadata and image-analysis software"],
    ["照明、焦点、信噪比、饱和度和空间标定合格", "Illumination, focus, signal-to-noise, saturation and spatial calibration are acceptable"],
  ),
  HISTOLOGY: preset(
    ["组织固定与处理检查", "Inspect tissue fixation and processing"],
    ["包埋、切片与染色", "Embed, section and stain"],
    ["成像、判读与归档", "Image, interpret and archive"],
    ["固定、处理与组织染色试剂", "Fixation, processing and histology-staining reagents"],
    ["组织盒、载玻片与切片耗材", "Tissue cassettes, slides and sectioning consumables"],
    ["组织处理、切片与成像设备", "Tissue-processing, sectioning and imaging equipment"],
    ["取向和临床前信息明确的组织", "Tissue with documented orientation and pre-analytical history"],
    ["阴性、已知阳性与批内组织对照", "Negative, known-positive and within-batch tissue controls"],
    ["切片追踪、扫描与图像审阅软件", "Section-tracking, scanning and image-review software"],
    ["组织完整性、染色一致性、背景和对照表现合格", "Tissue integrity, staining consistency, background and control performance are acceptable"],
  ),
  FLOW_CYTOMETRY: preset(
    ["样本与面板检查", "Inspect sample and panel"],
    ["染色、仪器设置与采集", "Stain, configure instrument and acquire"],
    ["补偿、门控与结果复核", "Compensate, gate and review results"],
    ["荧光抗体、活性染料与染色缓冲液", "Fluorescent antibodies, viability dye and staining buffers"],
    ["过滤管、反应板与低吸附耗材", "Filter tubes, plates and low-binding consumables"],
    ["质量控制合格的流式细胞仪或分选仪", "Quality-controlled flow cytometer or sorter"],
    ["可形成合格单细胞悬液的样本", "Sample yielding a qualified single-cell suspension"],
    ["未染、单染、FMO、生物阴性和阳性对照", "Unstained, single-stain, FMO, biological negative and positive controls"],
    ["采集、补偿、门控与审计软件", "Acquisition, compensation, gating and audit software"],
    ["仪器追踪、补偿、事件质量、门控稳定性和对照合格", "Instrument tracking, compensation, event quality, gating stability and controls are acceptable"],
  ),
  CELL_BASED_ASSAY: preset(
    ["细胞、处理和板图检查", "Inspect cells, treatments and plate map"],
    ["接种、处理与反应", "Seed, treat and run reaction"],
    ["读数、归一化与复核", "Read, normalize and review"],
    ["细胞功能检测试剂", "Cell-function assay reagents"],
    ["无菌培养板与细胞实验耗材", "Sterile plates and cell-assay consumables"],
    ["培养、液体处理与读数设备", "Culture, liquid-handling and readout equipment"],
    ["身份、活率和传代状态合格的细胞", "Cells with acceptable identity, viability and passage state"],
    ["载体、未处理、阴性和阳性功能对照", "Vehicle, untreated, negative and positive functional controls"],
    ["板图、仪器采集与剂量反应分析软件", "Plate-map, instrument-acquisition and dose-response software"],
    ["板内均一性、窗口、变异和对照效应满足预设判据", "Within-plate uniformity, assay window, variability and control effect meet predefined criteria"],
  ),
  MICROBIAL_CULTURE: preset(
    ["样本与培养条件检查", "Inspect sample and culture conditions"],
    ["接种、培养与观察", "Inoculate, culture and observe"],
    ["鉴定、计数与保存", "Identify, enumerate and preserve"],
    ["适配的培养基与选择试剂", "Compatible culture media and selection reagents"],
    ["无菌接种、培养与废弃耗材", "Sterile inoculation, culture and waste consumables"],
    ["生物安全、培养与鉴定设备", "Biosafety, incubation and identification equipment"],
    ["风险分级和来源明确的微生物样本", "Risk-classified microbial sample with documented origin"],
    ["培养基空白、阴性和参考菌株对照", "Media blank, negative and reference-strain controls"],
    ["培养记录、鉴定与菌株追踪软件", "Culture-record, identification and strain-tracking software"],
    ["无菌性、菌落形态、身份和重复计数满足预设判据", "Sterility, colony morphology, identity and repeat counts meet predefined criteria"],
  ),
  INFECTION_ASSAY: preset(
    ["宿主、病原体与暴露条件检查", "Inspect host, pathogen and exposure conditions"],
    ["感染、孵育与干预", "Infect, incubate and intervene"],
    ["感染负荷与宿主反应评估", "Assess infection burden and host response"],
    ["感染、培养与检测试剂", "Infection, culture and detection reagents"],
    ["封闭操作与生物危害废弃耗材", "Containment-operation and biohazard-waste consumables"],
    ["匹配风险等级的生物安全与培养设备", "Biosafety and culture equipment matched to risk level"],
    ["合格宿主模型与经过鉴定的感染材料", "Qualified host model and identified infectious material"],
    ["未感染、模拟感染、灭活和参考感染对照", "Uninfected, mock-infected, inactivated and reference-infection controls"],
    ["暴露记录、图像或感染负荷分析软件", "Exposure-record, imaging or infection-burden software"],
    ["接种量、宿主状态、感染一致性和对照反应合格", "Inoculum, host state, infection consistency and control response are acceptable"],
  ),
  SPECTROSCOPY: preset(
    ["仪器与样本检查", "Inspect instrument and sample"],
    ["空白、标准与样本采集", "Acquire blanks, standards and samples"],
    ["基线处理、定量与复核", "Process baseline, quantify and review"],
    ["光谱分析缓冲液与参考材料", "Spectroscopy buffers and reference materials"],
    ["光学级比色皿或样品池", "Optical-grade cuvettes or sample cells"],
    ["校准合格的光谱仪", "Qualified spectrometer"],
    ["浓度和基质适配的分析样本", "Analytical sample with compatible concentration and matrix"],
    ["空白、校准物与系统适用性参考物", "Blank, calibrator and system-suitability reference"],
    ["仪器采集、基线和光谱分析软件", "Instrument-acquisition, baseline and spectral-analysis software"],
    ["波长/频率校准、基线、线性和重复性合格", "Wavelength/frequency calibration, baseline, linearity and repeatability are acceptable"],
  ),
  CHROMATOGRAPHY: preset(
    ["系统平衡与适用性检查", "Equilibrate system and assess suitability"],
    ["进样、分离与检测", "Inject, separate and detect"],
    ["积分、定量与批次复核", "Integrate, quantify and review batch"],
    ["流动相、标准品与分离试剂", "Mobile phases, standards and separation reagents"],
    ["色谱柱、样品瓶与流路耗材", "Columns, vials and fluidic consumables"],
    ["校准合格的色谱与检测系统", "Qualified chromatography and detection system"],
    ["澄清且与流动相兼容的样本", "Clarified sample compatible with the mobile phase"],
    ["溶剂空白、校准物、质控样和系统适用性对照", "Solvent blank, calibrator, QC sample and system-suitability control"],
    ["色谱采集、积分、审计与定量软件", "Chromatography acquisition, integration, audit and quantification software"],
    ["保留、分离度、峰形、携带污染和质控样合格", "Retention, resolution, peak shape, carryover and QC samples are acceptable"],
  ),
  MASS_SPECTROMETRY: preset(
    ["系统校准与样本队列检查", "Calibrate system and inspect sample queue"],
    ["离子化、采集与批内质控", "Ionize, acquire and perform within-batch QC"],
    ["峰处理、鉴定或定量复核", "Review peak processing, identification or quantification"],
    ["质谱级溶剂、内标与校准物", "Mass-spectrometry-grade solvents, internal standards and calibrants"],
    ["低吸附样品瓶与兼容流路耗材", "Low-binding vials and compatible fluidic consumables"],
    ["校准合格的质谱与接口系统", "Qualified mass spectrometer and interface"],
    ["脱盐、澄清且适配离子化的样本", "Desalted, clarified sample compatible with ionization"],
    ["空白、内标、混合质控和系统适用性样", "Blank, internal standard, pooled QC and system-suitability sample"],
    ["质谱采集、谱图处理、鉴定与审计软件", "Mass-spectrometry acquisition, spectrum-processing, identification and audit software"],
    ["质量准确度、灵敏度、携带污染、漂移和质控稳定性合格", "Mass accuracy, sensitivity, carryover, drift and QC stability are acceptable"],
  ),
  BIOPHYSICAL_MEASUREMENT: preset(
    ["仪器、缓冲液和样本检查", "Inspect instrument, buffer and sample"],
    ["参考与样本测量", "Measure references and samples"],
    ["模型拟合和质量复核", "Fit model and review quality"],
    ["测量缓冲液、参考物与传感耗材试剂", "Measurement buffer, references and sensor reagents"],
    ["低吸附样品池、传感芯片或测量耗材", "Low-binding sample cells, sensor chips or measurement consumables"],
    ["校准合格的生物物理测量系统", "Qualified biophysical measurement system"],
    ["均一、稳定且浓度适配的样本", "Homogeneous, stable sample at a compatible concentration"],
    ["缓冲液空白、参考物和非结合/非反应对照", "Buffer blank, reference and nonbinding/nonreactive controls"],
    ["仪器采集、模型拟合与残差审阅软件", "Instrument-acquisition, model-fitting and residual-review software"],
    ["校准、基线、重复性、模型残差和参数可辨识性合格", "Calibration, baseline, repeatability, model residuals and parameter identifiability are acceptable"],
  ),
  SEQUENCING: preset(
    ["文库与运行设计检查", "Inspect library and run design"],
    ["上机、采集与运行监控", "Load, acquire and monitor run"],
    ["基础信号转换与运行质控", "Convert primary signal and assess run quality"],
    ["平台适配的测序与运行试剂", "Platform-compatible sequencing and run reagents"],
    ["测序流动槽、芯片与低吸附耗材", "Sequencing flow cells, chips and low-binding consumables"],
    ["维护和校准合格的测序平台", "Maintained and qualified sequencing platform"],
    ["定量、片段分布和纯度合格的文库", "Library with acceptable quantity, fragment distribution and purity"],
    ["无模板/空白、已知文库与平台运行对照", "No-template/blank, known-library and platform-run controls"],
    ["仪器控制、基础信号转换、样本表与运行质控软件", "Instrument-control, primary-signal conversion, sample-sheet and run-QC software"],
    ["装载、信号、错误率、产出、对照和样本索引质量合格", "Loading, signal, error rate, yield, controls and sample-index quality are acceptable"],
  ),
  OMICS_SAMPLE_PREP: preset(
    ["研究设计、样本与批次检查", "Inspect study design, samples and batches"],
    ["提取、处理与文库/分析物制备", "Extract, process and prepare library/analyte"],
    ["定量、归一化与批次放行", "Quantify, normalize and release batch"],
    ["组学制备与标记试剂", "Omics-preparation and labeling reagents"],
    ["低吸附、无污染的制备耗材", "Low-binding, contamination-controlled preparation consumables"],
    ["自动化、温控、定量与片段分析设备", "Automation, temperature-control, quantification and fragment-analysis equipment"],
    ["按研究设计采集并妥善保存的样本", "Samples collected and preserved according to study design"],
    ["过程空白、批内参考、阳性和外源添加对照", "Process blank, within-batch reference, positive and spike-in controls"],
    ["样本表、批次随机化、仪器采集与制备质控软件", "Sample-sheet, batch-randomization, instrument-acquisition and preparation-QC software"],
    ["回收率、完整性、污染、批次平衡和制备产物分布合格", "Recovery, integrity, contamination, batch balance and preparation-product distribution are acceptable"],
  ),
  STRUCTURAL_ANALYSIS: preset(
    ["样本与仪器适用性检查", "Inspect sample and instrument suitability"],
    ["结构数据采集", "Acquire structural data"],
    ["重建、模型验证与归档", "Reconstruct, validate model and archive"],
    ["结构稳定缓冲液、对比或制样试剂", "Structure-stabilizing buffer, contrast or preparation reagents"],
    ["平台适配的载网、毛细管或样品池", "Platform-compatible grids, capillaries or sample cells"],
    ["校准合格的结构数据采集系统", "Qualified structural-data acquisition system"],
    ["均一、稳定且纯度合格的结构样本", "Homogeneous, stable structural sample with acceptable purity"],
    ["缓冲空白、标准物和已知结构参考样", "Buffer blank, standard and known-structure reference"],
    ["仪器控制、重建、模型构建和验证软件", "Instrument-control, reconstruction, model-building and validation software"],
    ["数据完整性、分辨能力、模型几何和独立验证指标合格", "Data completeness, resolving power, model geometry and independent validation metrics are acceptable"],
  ),
  ANIMAL_PROCEDURE: preset(
    ["伦理许可、随机化与动物状态检查", "Inspect ethics approval, randomization and animal status"],
    ["操作、干预与福利监测", "Perform procedure, intervention and welfare monitoring"],
    ["结局测量、取样与人道终点记录", "Measure outcomes, sample and record humane endpoints"],
    ["麻醉、镇痛、干预与采样试剂", "Anesthesia, analgesia, intervention and sampling reagents"],
    ["无菌操作、标识、饲养和采样耗材", "Sterile procedure, identification, housing and sampling consumables"],
    ["经批准并维护合格的在体操作与监测设备", "Approved and maintained in-vivo procedure and monitoring equipment"],
    ["纳入标准明确且健康状态已知的实验动物", "Research animals with defined eligibility and known health status"],
    ["假手术/载体、基线、阳性和随机化对照组", "Sham/vehicle, baseline, positive and randomized control groups"],
    ["随机化、盲法、福利、操作与结局记录软件", "Randomization, blinding, welfare, procedure and outcome-record software"],
    ["许可、分组平衡、福利指标、操作一致性和缺失数据记录合格", "Approval, group balance, welfare indicators, procedural consistency and missing-data records are acceptable"],
  ),
  FIELD_SAMPLING: preset(
    ["许可、点位与采样设计检查", "Inspect permits, sites and sampling design"],
    ["现场采集、空白和环境记录", "Collect field samples, blanks and environmental records"],
    ["保存、运输与交接", "Preserve, transport and transfer custody"],
    ["现场保存、清洁与校准试剂", "Field preservation, cleaning and calibration reagents"],
    ["无污染采样、标识与冷链耗材", "Contamination-controlled sampling, labeling and cold-chain consumables"],
    ["校准合格的现场采样与环境测量设备", "Qualified field-sampling and environmental-measurement equipment"],
    ["按设计定义的环境、生物或生态样本", "Environmental, biological or ecological sample defined by the design"],
    ["现场空白、运输空白、重复点位和参考材料", "Field blank, trip blank, replicate site and reference material"],
    ["定位、时间戳、环境元数据与样本交接软件", "Geolocation, timestamp, environmental-metadata and chain-of-custody software"],
    ["点位、时间、重复、空白、保存条件和交接记录完整", "Site, time, replicates, blanks, preservation and chain-of-custody records are complete"],
  ),
};

function preset(
  stage1: [string, string],
  stage2: [string, string],
  stage3: [string, string],
  reagent: [string, string],
  consumable: [string, string],
  instrument: [string, string],
  sample: [string, string],
  control: [string, string],
  software: [string, string],
  qc: [string, string],
): PresetDefinition {
  return {
    workflow: [stage1, stage2, stage3],
    reagent,
    consumable,
    instrument,
    sample,
    control,
    software,
    qc,
    limitation: [
      "结果依赖样本前处理、设备状态和适用于具体应用的验证，不能替代实验室验证过的版本化 SOP。",
      "Results depend on pre-analytics, instrument state and application-specific validation; this guide does not replace a laboratory-validated, versioned SOP.",
    ],
    troubleshooting: {
      symptom: ["对照失败、背景异常或重复性不足", "Control failure, abnormal background or poor repeatability"],
      action: [
        "暂停结果放行；按顺序核对样本身份、试剂批号、设备质控、关键操作记录和对照，并依据本地偏差流程复测。",
        "Hold result release; sequentially verify sample identity, reagent lots, instrument QC, critical records and controls, then repeat according to the local deviation process.",
      ],
    },
  };
}

type PresetReagentRequirement = {
  key: string;
  label: [string, string];
  capabilityTags: ExperimentTag[];
  level: "REQUIRED" | "RECOMMENDED";
};

function taggedReagent(
  key: string,
  label: [string, string],
  capabilityTags: ExperimentTag[],
  level: "REQUIRED" | "RECOMMENDED" = "RECOMMENDED",
): PresetReagentRequirement {
  return { key, label, capabilityTags, level };
}

function manualReagent(
  key: string,
  label: [string, string],
  level: "REQUIRED" | "RECOMMENDED" = "REQUIRED",
): PresetReagentRequirement {
  return taggedReagent(key, label, [], level);
}

// These are the baseline reagent sets for techniques whose source blueprint
// does not yet name every material. They keep the check useful without
// pretending that a broad category or a name substring proves compatibility.
// A blueprint's own reagentCapabilities are merged ahead of these entries.
const presetReagentRequirements: Record<TechniquePresetCode, PresetReagentRequirement[]> = {
  SAMPLE_PREPARATION: [
    manualReagent("processing", ["样本处理或稳定化试剂", "Sample-processing or stabilization reagent"]),
    taggedReagent("preservation", ["样本保存试剂", "Sample preservation reagent"], ["SAMPLE_PRESERVATION_REAGENT"]),
    taggedReagent("disinfection", ["污染控制/消毒试剂", "Contamination-control or disinfection reagent"], ["DISINFECTION_REAGENT"]),
  ],
  CELL_CULTURE: [
    taggedReagent("medium", ["适配的细胞培养基", "Compatible cell-culture medium"], ["CELL_CULTURE_MEDIUM"], "REQUIRED"),
    taggedReagent("serum", ["血清或定义补充物", "Serum or defined supplement"], ["SERUM_SUPPLEMENT"], "REQUIRED"),
    taggedReagent("mycoplasma", ["支原体检测或监测体系", "Mycoplasma testing or monitoring reagent"], ["MYCOPLASMA_TEST_REAGENT"]),
  ],
  TISSUE_MODEL: [
    taggedReagent("medium", ["模型培养基", "Model-culture medium"], ["CELL_CULTURE_MEDIUM"], "REQUIRED"),
    taggedReagent("matrix", ["细胞外基质包被或支撑材料", "Extracellular-matrix coating or support"], ["ECM_COATING_REAGENT"], "REQUIRED"),
    taggedReagent("matrix-gel", ["三维基质或干细胞基质", "Three-dimensional or stem-cell matrix"], ["STEM_CELL_MATRIX"]),
  ],
  NUCLEIC_ACID_EXTRACTION: [
    manualReagent("extraction", ["与目标核酸匹配的提取/纯化体系", "Extraction or purification chemistry matched to the target nucleic acid"]),
    taggedReagent("water", ["无核酸酶水", "Nuclease-free water"], ["NUCLEASE_FREE_WATER"]),
    taggedReagent("dnase", ["去除基因组DNA的DNase（按需）", "DNase for genomic-DNA removal when applicable"], ["DNASE_REAGENT"]),
  ],
  PCR_AMPLIFICATION: [
    taggedReagent("primers", ["目标特异性引物组", "Target-specific primer set"], ["PCR_PRIMER_SET"], "REQUIRED"),
    taggedReagent("water", ["无核酸酶水", "Nuclease-free water"], ["NUCLEASE_FREE_WATER"], "REQUIRED"),
    taggedReagent("dntp", ["dNTP混合液", "dNTP mix"], ["DNTP_MIX"]),
  ],
  MOLECULAR_CLONING: [
    manualReagent("assembly", ["与构建策略匹配的组装/克隆试剂", "Assembly or cloning chemistry matched to the construct strategy"]),
    taggedReagent("polymerase", ["DNA聚合酶（按需）", "DNA polymerase when applicable"], ["DNA_POLYMERASE"]),
    taggedReagent("water", ["无核酸酶水", "Nuclease-free water"], ["NUCLEASE_FREE_WATER"]),
  ],
  GENE_DELIVERY: [
    taggedReagent("medium", ["受体细胞培养基", "Recipient-cell culture medium"], ["CELL_CULTURE_MEDIUM"], "REQUIRED"),
    taggedReagent("delivery", ["递送试剂或载体", "Delivery reagent or vector"], ["GENE_DELIVERY_REAGENT"], "REQUIRED"),
    taggedReagent("selection", ["选择抗生素（按需）", "Selection antibiotic when applicable"], ["SELECTION_ANTIBIOTIC"]),
  ],
  GENE_EDITING: [
    taggedReagent("delivery", ["编辑组分递送试剂", "Editing-component delivery reagent"], ["GENE_DELIVERY_REAGENT"], "REQUIRED"),
    taggedReagent("primers", ["基因分型引物组", "Genotyping primer set"], ["PCR_PRIMER_SET"]),
    taggedReagent("polymerase", ["基因分型DNA聚合酶", "Genotyping DNA polymerase"], ["DNA_POLYMERASE"]),
  ],
  NUCLEIC_ACID_HYBRIDIZATION: [
    manualReagent("probe", ["标记探针和杂交体系", "Labeled probe and hybridization chemistry"]),
    taggedReagent("water", ["无核酸酶水", "Nuclease-free water"], ["NUCLEASE_FREE_WATER"]),
    taggedReagent("blocking", ["封闭或背景抑制试剂", "Blocking or background-suppression reagent"], ["BLOCKING_REAGENT"]),
  ],
  PROTEIN_ANALYSIS: [
    manualReagent("detection", ["与检测格式匹配的蛋白分析/检测试剂", "Protein-analysis or detection reagent matched to the assay format"]),
    taggedReagent("lysis", ["蛋白裂解或样本制备试剂", "Protein lysis or sample-preparation reagent"], ["WB_LYSIS_BUFFER"]),
    taggedReagent("quantification", ["蛋白定量试剂", "Protein-quantification reagent"], ["PROTEIN_QUANTIFICATION_REAGENT"]),
  ],
  IMMUNOASSAY: [
    manualReagent("binding", ["与分析物匹配的结合/检测试剂", "Analyte-matched binding or detection reagent"]),
    taggedReagent("blocking", ["免疫检测封闭试剂", "Immunoassay blocking reagent"], ["BLOCKING_REAGENT"]),
    taggedReagent("wash", ["免疫检测洗涤缓冲液", "Immunoassay wash buffer"], ["ELISA_WASH_BUFFER"]),
  ],
  PROTEIN_PURIFICATION: [
    manualReagent("matrix", ["与目标蛋白匹配的纯化介质/亲和材料", "Purification matrix or affinity material matched to the target protein"]),
    taggedReagent("protease", ["蛋白酶抑制剂", "Protease inhibitor"], ["PROTEASE_INHIBITOR"]),
    taggedReagent("quantification", ["蛋白定量试剂", "Protein-quantification reagent"], ["PROTEIN_QUANTIFICATION_REAGENT"]),
  ],
  MICROSCOPY: [
    manualReagent("label", ["与成像模式匹配的标记或染色试剂", "Labeling or staining reagent matched to the imaging mode"]),
    taggedReagent("fixative", ["固定液（固定样本时）", "Fixative for fixed specimens"], ["FIXATIVE"]),
    taggedReagent("mounting", ["封片/抗淬灭介质（按需）", "Mounting or antifade medium when applicable"], ["MOUNTING_MEDIUM"]),
  ],
  HISTOLOGY: [
    taggedReagent("fixative", ["组织固定液", "Tissue fixative"], ["FIXATIVE"], "REQUIRED"),
    taggedReagent("stain", ["组织学染色试剂", "Histology staining reagent"], ["HISTOLOGY_STAIN_REAGENT"], "REQUIRED"),
    taggedReagent("mounting", ["封片介质", "Mounting medium"], ["MOUNTING_MEDIUM"]),
  ],
  FLOW_CYTOMETRY: [
    taggedReagent("panel", ["流式抗体面板", "Flow-cytometry antibody panel"], ["FLOW_ANTIBODY_PANEL"], "REQUIRED"),
    taggedReagent("buffer", ["流式染色缓冲液", "Flow staining buffer"], ["FLOW_STAIN_BUFFER"], "REQUIRED"),
    taggedReagent("viability", ["活死染料", "Viability dye"], ["FLOW_VIABILITY_DYE"]),
  ],
  CELL_BASED_ASSAY: [
    taggedReagent("medium", ["细胞培养基", "Cell-culture medium"], ["CELL_CULTURE_MEDIUM"], "REQUIRED"),
    taggedReagent("viability", ["细胞活力/功能检测试剂", "Cell-viability or functional-assay reagent"], ["CELL_VIABILITY_ASSAY_REAGENT"]),
    taggedReagent("stain", ["细胞染色或读出试剂（按需）", "Cell-staining or readout reagent when applicable"], ["CELL_STAIN_REAGENT"]),
  ],
  MICROBIAL_CULTURE: [
    taggedReagent("medium", ["微生物培养基", "Microbial culture medium"], ["MICROBIAL_CULTURE_MEDIUM"], "REQUIRED"),
    taggedReagent("selection", ["选择性抗菌试剂（按需）", "Selective antimicrobial reagent when applicable"], ["SELECTION_ANTIBIOTIC"]),
    taggedReagent("stain", ["微生物染色或读出试剂（按需）", "Microbial staining or readout reagent when applicable"], ["CELL_STAIN_REAGENT"]),
  ],
  INFECTION_ASSAY: [
    manualReagent("agent", ["经鉴定的感染/干预试剂", "Identified infection or intervention reagent"]),
    taggedReagent("cell-medium", ["宿主细胞培养基（按需）", "Host-cell culture medium when applicable"], ["CELL_CULTURE_MEDIUM"]),
    taggedReagent("microbial-medium", ["微生物培养基（按需）", "Microbial culture medium when applicable"], ["MICROBIAL_CULTURE_MEDIUM"]),
  ],
  SPECTROSCOPY: [
    manualReagent("reference", ["与测量模式匹配的参考/显色/荧光试剂", "Reference, chromogenic, or fluorescent reagent matched to the measurement mode"]),
    taggedReagent("calibration", ["校准标准品", "Calibration standard"], ["CALIBRATION_STANDARD"]),
    taggedReagent("internal-standard", ["内标或加标参考物（按需）", "Internal standard or spike-in reference when applicable"], ["INTERNAL_STANDARD"]),
  ],
  CHROMATOGRAPHY: [
    manualReagent("mobile-phase", ["与分离模式匹配的流动相/缓冲液", "Mobile phase or buffer matched to the separation mode"]),
    taggedReagent("calibration", ["校准标准品", "Calibration standard"], ["CALIBRATION_STANDARD"]),
    taggedReagent("solvent", ["分析级溶剂", "Analytical-grade solvent"], ["SOLVENT_REAGENT"]),
  ],
  MASS_SPECTROMETRY: [
    manualReagent("preparation", ["与离子化模式匹配的制样/基质试剂", "Sample-preparation or matrix reagent matched to the ionization mode"]),
    taggedReagent("internal-standard", ["内标", "Internal standard"], ["INTERNAL_STANDARD"]),
    taggedReagent("solvent", ["质谱级溶剂", "Mass-spectrometry-grade solvent"], ["SOLVENT_REAGENT"]),
  ],
  BIOPHYSICAL_MEASUREMENT: [
    manualReagent("measurement", ["与测量平台匹配的缓冲液或结合试剂", "Buffer or binding reagent matched to the measurement platform"]),
    taggedReagent("calibration", ["校准标准品", "Calibration standard"], ["CALIBRATION_STANDARD"]),
    taggedReagent("internal-standard", ["内标或参考物（按需）", "Internal standard or reference material when applicable"], ["INTERNAL_STANDARD"]),
  ],
  SEQUENCING: [
    taggedReagent("library", ["文库制备试剂", "Library-preparation reagent"], ["LIBRARY_PREPARATION_REAGENT"], "REQUIRED"),
    taggedReagent("run", ["测序上机试剂", "Sequencing-run reagent"], ["SEQUENCING_RUN_REAGENT"], "REQUIRED"),
    taggedReagent("index", ["索引引物或接头", "Indexing primer or adapter"], ["INDEXING_PRIMER"]),
  ],
  OMICS_SAMPLE_PREP: [
    manualReagent("extraction", ["与组学分析物匹配的提取/制备试剂", "Extraction or preparation chemistry matched to the omics analyte"]),
    taggedReagent("labeling", ["组学标记或衍生化试剂", "Omics-labeling or derivatization reagent"], ["OMICS_LABELING_REAGENT"]),
    taggedReagent("internal-standard", ["内标或加标参考物", "Internal standard or spike-in reference"], ["INTERNAL_STANDARD"]),
  ],
  STRUCTURAL_ANALYSIS: [
    manualReagent("stabilization", ["结构稳定缓冲液或制样试剂", "Structure-stabilizing buffer or specimen-preparation reagent"]),
    taggedReagent("calibration", ["校准标准品", "Calibration standard"], ["CALIBRATION_STANDARD"]),
    taggedReagent("solvent", ["高纯度溶剂/缓冲液组分", "High-purity solvent or buffer component"], ["SOLVENT_REAGENT"]),
  ],
  ANIMAL_PROCEDURE: [
    manualReagent("intervention", ["与动物操作匹配的干预或给药试剂", "Intervention or administration reagent matched to the animal procedure"]),
    taggedReagent("anesthesia", ["麻醉剂（按需）", "Anesthetic when applicable"], ["ANESTHETIC_REAGENT"]),
    taggedReagent("analgesia", ["镇痛剂（按需）", "Analgesic when applicable"], ["ANALGESIC_REAGENT"]),
  ],
  FIELD_SAMPLING: [
    manualReagent("preservation", ["现场样本保存或稳定化试剂", "Field-sample preservation or stabilization reagent"]),
    taggedReagent("disinfection", ["现场消毒/去污染试剂", "Field disinfection or decontamination reagent"], ["DISINFECTION_REAGENT"]),
    taggedReagent("calibration", ["现场校准标准品", "Field calibration standard"], ["CALIBRATION_STANDARD"]),
  ],
};

const reportingRequirements: Record<string, string[]> = {
  MIQE_2_0: ["experimental_design", "sample", "assay", "controls", "analysis"],
  DMIQE_2020: ["partition", "threshold", "concentration", "controls", "uncertainty"],
  MIFLOWCYT_1_0: ["specimen", "reagent", "instrument", "acquisition", "analysis"],
  REMBI_1_0: ["study", "biosample", "specimen", "acquisition", "image_data", "analysis"],
  MIXS_6_3_1: ["checklist", "environment", "sample", "library", "platform", "accession"],
  STRENDA_1_8: ["enzyme", "reaction", "conditions", "kinetics", "uncertainty"],
  WWPDB_MMCIF_5: ["entity", "method", "data", "model", "validation"],
  ARRIVE_2_0: ["design", "sample_size", "randomization", "blinding", "procedures", "results"],
};

const reportingApplicability: Record<string, LocalizedLabel> = {
  MIQE_2_0: { zh: "适用于实时定量 PCR 的设计、实施和报告。", en: "Applies to real-time quantitative PCR design, execution and reporting." },
  DMIQE_2020: { zh: "适用于数字 PCR 的设计、实施和报告。", en: "Applies to digital PCR design, execution and reporting." },
  MIFLOWCYT_1_0: { zh: "适用于流式细胞术的样本、试剂、设备、采集和分析元数据。", en: "Applies to flow-cytometry specimen, reagent, instrument, acquisition and analysis metadata." },
  REMBI_1_0: { zh: "适用于生物图像的研究、样本、采集、图像数据和分析元数据。", en: "Applies to study, specimen, acquisition, image-data and analysis metadata for biological imaging." },
  MIXS_6_3_1: { zh: "适用于序列及相关样本和环境元数据。", en: "Applies to sequence, sample and environmental metadata." },
  STRENDA_1_8: { zh: "适用于酶学实验条件、动力学参数和结果报告。", en: "Applies to enzyme assay conditions, kinetic parameters and reporting." },
  WWPDB_MMCIF_5: { zh: "适用于大分子结构数据、模型和验证元数据。", en: "Applies to macromolecular structural data, models and validation metadata." },
  ARRIVE_2_0: { zh: "适用于动物研究设计、操作、福利和结果报告。", en: "Applies to animal-study design, procedures, welfare and result reporting." },
};

function requirement(
  techniqueCode: string,
  kind: TechniqueRequirement["kind"],
  label: [string, string],
  options?: Partial<Pick<TechniqueRequirement, "level" | "verificationMode" | "capabilityTags" | "matcherValues">>,
): TechniqueRequirement {
  return {
    id: `${techniqueCode}:requirement:${kind.toLowerCase()}`,
    kind,
    level: options?.level ?? "REQUIRED",
    verificationMode: options?.verificationMode ?? "MANUAL_CONFIRMATION",
    label: { zh: label[0], en: label[1] },
    capabilityTags: options?.capabilityTags ?? [],
    matcherValues: options?.matcherValues ?? [],
  };
}

function controlRequirements(blueprint: TechniqueBlueprint, definition: PresetDefinition) {
  const controls = blueprint.requiredControlOverrides?.length
    ? blueprint.requiredControlOverrides.map((item) => [item.labelZh, item.labelEn] as [string, string])
    : [definition.control];

  return controls.map((label, index) => ({
    ...requirement(blueprint.code, "CONTROL", label),
    id: `${blueprint.code}:requirement:control:${index + 1}`,
  }));
}

function manualProfileRequirement(
  techniqueCode: string,
  profileCode: string,
  suffix: string,
  kind: TechniqueRequirement["kind"],
  label: [string, string],
): TechniqueRequirement {
  return {
    ...requirement(techniqueCode, kind, label),
    id: `${techniqueCode}:profile:${profileCode}:${suffix}`,
  };
}

// These profiles turn broad integrative-biology labels into study-specific
// checklists. Target identity is intentionally confirmed manually: an
// inventory record can prove that a reagent class exists, but cannot prove it
// addresses the investigator's biological question.
function integrativeProfilesFor(blueprint: TechniqueBlueprint): TechniqueProfile[] {
  const requirementFor = (
    profileCode: string,
    suffix: string,
    kind: TechniqueRequirement["kind"],
    label: [string, string],
  ) => manualProfileRequirement(blueprint.code, profileCode, suffix, kind, label);

  switch (blueprint.code) {
    case "CHIP_QPCR": {
      const profileCode = "REGULATORY_LOCUS_VALIDATION";
      return [{
        code: profileCode,
        name: { zh: "调控位点验证", en: "Regulatory-locus validation" },
        description: {
          zh: "用于验证特定转录因子或组蛋白修饰在预设调控区域的富集；目标、阴性位点与输入归一化必须在实验前定义。",
          en: "Validates enrichment of a specified transcription factor or histone mark at predefined regulatory regions; targets, negative loci, and input normalization must be set before the run.",
        },
        additionalRequirements: [
          requirementFor(profileCode, "target-antibody", "REAGENT", ["与目标转录因子或组蛋白修饰匹配的 ChIP 验证抗体", "ChIP-validated antibody matched to the target transcription factor or histone mark"]),
          requirementFor(profileCode, "locus-primers", "REAGENT", ["目标位点与阴性位点的成对 qPCR 引物", "Paired qPCR primers for target and negative-control loci"]),
          requirementFor(profileCode, "controls", "CONTROL", ["Input、IgG 与阴性位点富集对照", "Input, IgG, and negative-locus enrichment controls"]),
        ],
      }];
    }
    case "WHOLE_GENOME_BISULFITE_SEQUENCING": {
      const profileCode = "METHYLATION_REPROGRAMMING";
      return [{
        code: profileCode,
        name: { zh: "甲基化重编程研究", en: "Methylation-reprogramming study" },
        description: {
          zh: "用于比较预定义细胞状态或处理之间的甲基化重编程；转换效率和目标CpG区域应与生物学假设一起登记。",
          en: "Compares methylation reprogramming across predefined cell states or conditions; conversion efficiency and target CpG regions must be registered with the biological hypothesis.",
        },
        additionalRequirements: [
          requirementFor(profileCode, "conversion-control", "CONTROL", ["未甲基化与甲基化转换效率参考物", "Unmethylated and methylated conversion-efficiency references"]),
          requirementFor(profileCode, "target-regions", "SAMPLE", ["已登记的目标CpG区域、差异甲基化阈值与细胞组成校正计划", "Registered target CpG regions, differential-methylation threshold, and cell-composition correction plan"]),
        ],
      }];
    }
    case "SINGLE_CELL_MULTIOME_RNA_ATAC_SEQUENCING": {
      const profileCode = "CELL_ATLAS_REGULATORY_NETWORK";
      return [{
        code: profileCode,
        name: { zh: "细胞图谱与调控网络", en: "Cell atlas and regulatory network" },
        description: {
          zh: "将同一细胞的RNA和可及性用于构建细胞类型特异调控网络；需在上机前确定目标细胞数、批次平衡和QC阈值。",
          en: "Uses paired RNA and accessibility from the same cells to build cell-type-specific regulatory networks; target cell count, batch balancing, and QC thresholds must be fixed before sequencing.",
        },
        additionalRequirements: [
          requirementFor(profileCode, "cell-state-markers", "REAGENT", ["用于确认目标细胞类型/状态的验证性标记物面板", "Validation marker panel for the target cell types or states"]),
          requirementFor(profileCode, "multiplet-controls", "CONTROL", ["双细胞、环境RNA与跨批次混样控制", "Doublet, ambient-RNA, and cross-batch multiplexing controls"]),
          requirementFor(profileCode, "analysis-plan", "SOFTWARE", ["预定义的细胞注释、峰-基因关联和批次校正分析方案", "Prespecified cell annotation, peak-to-gene linking, and batch-correction analysis plan"]),
        ],
      }];
    }
    case "CITE_SEQUENCING": {
      const profileCode = "IMMUNE_PHENOTYPE_RNA_PROTEIN";
      return [{
        code: profileCode,
        name: { zh: "免疫表型RNA-蛋白联测", en: "Immune phenotype RNA–protein integration" },
        description: {
          zh: "将转录组与表面蛋白联合用于免疫分型；面板必须围绕预定义的谱系、活化和耗竭状态设计。",
          en: "Combines transcriptome and surface proteins for immune phenotyping; the panel must be designed around predefined lineage, activation, and exhaustion states.",
        },
        additionalRequirements: [
          requirementFor(profileCode, "target-panel", "REAGENT", ["面向预定义免疫谱系与状态标志物的寡核苷酸条形码抗体面板", "Oligonucleotide-barcoded antibody panel for predefined immune lineage and state markers"]),
          requirementFor(profileCode, "background-controls", "CONTROL", ["同型、无细胞背景和抗体滴定控制", "Isotype, cell-free background, and antibody-titration controls"]),
        ],
      }];
    }
    case "IMAGING_BASED_SPATIAL_TRANSCRIPTOMICS": {
      const profileCode = "SPATIAL_TARGETED_PANEL";
      return [{
        code: profileCode,
        name: { zh: "靶向空间转录图谱", en: "Targeted spatial transcriptome" },
        description: {
          zh: "以原位靶向面板验证组织区域和细胞邻域假设；需同时设置区域阳性和无探针对照。",
          en: "Uses an in-situ target panel to test tissue-region and cellular-neighborhood hypotheses; region-positive and no-probe controls are both required.",
        },
        additionalRequirements: [
          requirementFor(profileCode, "target-probes", "REAGENT", ["覆盖目标基因、细胞类型与阴性探针的空间探针面板", "Spatial probe panel covering target genes, cell types, and negative probes"]),
          requirementFor(profileCode, "tissue-controls", "CONTROL", ["已知阳性组织区、无探针和组织自发荧光控制", "Known-positive tissue region, no-probe, and tissue-autofluorescence controls"]),
        ],
      }];
    }
    case "SPATIAL_PROTEOMICS": {
      const profileCode = "TISSUE_MICROENVIRONMENT";
      return [{
        code: profileCode,
        name: { zh: "组织微环境多重蛋白表型", en: "Multiplex tissue-microenvironment phenotyping" },
        description: {
          zh: "用于解析组织微环境与细胞邻域；每个抗体靶点须与组织定位、批次和分割策略一并验证。",
          en: "Resolves tissue microenvironments and cellular neighborhoods; each antibody target must be validated with tissue localization, batch, and segmentation strategy.",
        },
        additionalRequirements: [
          requirementFor(profileCode, "antibody-panel", "REAGENT", ["覆盖谱系、功能、检查点和结构标志物的多重抗体面板", "Multiplex antibody panel covering lineage, functional, checkpoint, and structural markers"]),
          requirementFor(profileCode, "segmentation-controls", "CONTROL", ["组织阳性/阴性区、同型与细胞分割复核控制", "Tissue positive/negative regions, isotype controls, and cell-segmentation review controls"]),
        ],
      }];
    }
    case "PHOSPHOPROTEOMICS": {
      const profileCode = "SIGNALING_NETWORK";
      return [{
        code: profileCode,
        name: { zh: "信号通路与磷酸化网络", en: "Signaling and phosphosite network" },
        description: {
          zh: "用于药物或刺激响应中的激酶-底物网络；采样时间、去磷酸化抑制和位点级正交验证是关键。",
          en: "Profiles kinase–substrate networks after drugs or stimuli; sampling time, phosphatase inhibition, and site-level orthogonal validation are critical.",
        },
        additionalRequirements: [
          requirementFor(profileCode, "time-course", "SAMPLE", ["按预定义信号动力学采集并立即抑制去磷酸化的样本", "Samples collected at prespecified signaling time points with immediate phosphatase inhibition"]),
          requirementFor(profileCode, "site-validation", "REAGENT", ["针对关键磷酸化位点的正交验证抗体或标准肽", "Orthogonal validation antibodies or standard peptides for key phosphosites"]),
          requirementFor(profileCode, "stimulus-controls", "CONTROL", ["未处理、载体和已知通路响应控制", "Untreated, vehicle, and known pathway-response controls"]),
        ],
      }];
    }
    case "STABLE_ISOTOPE_TRACING_METABOLOMICS": {
      const profileCode = "METABOLIC_FLUX";
      return [{
        code: profileCode,
        name: { zh: "稳定同位素代谢通量", en: "Stable-isotope metabolic flux" },
        description: {
          zh: "通过示踪底物追踪碳/氮流向；示踪纯度、暴露时间和代谢淬灭条件必须与通量假设绑定。",
          en: "Tracks carbon or nitrogen flow with labelled substrates; tracer purity, exposure time, and metabolic quenching must be tied to the flux hypothesis.",
        },
        additionalRequirements: [
          requirementFor(profileCode, "tracer-target", "REAGENT", ["与预设碳/氮流向假设匹配的稳定同位素示踪底物", "Stable-isotope tracer substrate matched to the prespecified carbon/nitrogen-flow hypothesis"]),
          requirementFor(profileCode, "quench-control", "CONTROL", ["未标记培养基、提取空白和淬灭回收控制", "Unlabelled medium, extraction blank, and quench-recovery controls"]),
        ],
      }];
    }
    case "POOLED_CRISPR_CAS9_SCREEN": {
      const profileCode = "CAUSAL_GENE_SCREEN";
      return [{
        code: profileCode,
        name: { zh: "因果基因筛选", en: "Causal gene screen" },
        description: {
          zh: "用于池化扰动发现因果基因；需把目标基因集、每基因向导数、覆盖度、MOI与对照向导预先锁定。",
          en: "Discovers causal genes through pooled perturbation; target genes, guides per gene, representation, MOI, and control guides must be locked in advance.",
        },
        additionalRequirements: [
          requirementFor(profileCode, "guide-library", "REAGENT", ["与目标基因集和阳性/阴性对照匹配、经测序验证的sgRNA文库", "Sequence-verified sgRNA library matched to the target gene set and positive/negative controls"]),
          requirementFor(profileCode, "representation-control", "CONTROL", ["起始与终点文库覆盖度、MOI和编辑效率控制", "Baseline and endpoint library representation, MOI, and editing-efficiency controls"]),
        ],
      }];
    }
    case "SHOTGUN_METAGENOMIC_SEQUENCING": {
      const profileCode = "HOST_MICROBIOME_FUNCTION";
      return [{
        code: profileCode,
        name: { zh: "宿主-微生物组功能分析", en: "Host–microbiome functional analysis" },
        description: {
          zh: "用于将微生物分类和功能通路与宿主表型关联；低生物量污染与宿主DNA比例必须在设计中控制。",
          en: "Links microbial taxonomy and functional pathways to host phenotypes; low-biomass contamination and host-DNA fraction must be controlled in the design.",
        },
        additionalRequirements: [
          requirementFor(profileCode, "depletion-strategy", "REAGENT", ["适用于样本基质的宿主DNA去除或微生物DNA富集体系", "Host-DNA depletion or microbial-DNA enrichment chemistry appropriate to the sample matrix"]),
          requirementFor(profileCode, "community-controls", "CONTROL", ["采样空白、提取空白和模拟微生物群落控制", "Sampling blanks, extraction blanks, and mock microbial-community controls"]),
          requirementFor(profileCode, "functional-targets", "SOFTWARE", ["预定义分类群、功能通路或耐药基因的注释数据库与阈值", "Prespecified annotation database and thresholds for taxonomic, pathway, or resistance-gene targets"]),
        ],
      }];
    }
    case "ORGANOID_CULTURE": {
      const profileCode = "DEVELOPMENTAL_DISEASE_MODEL";
      return [{
        code: profileCode,
        name: { zh: "发育与疾病类器官模型", en: "Developmental and disease organoid model" },
        description: {
          zh: "用于将发育、疾病或药物响应表型与组学研究连接；模型身份、成熟度和批次放行须可追溯。",
          en: "Connects developmental, disease, or drug-response phenotypes to omics studies; model identity, maturity, and batch release must be traceable.",
        },
        additionalRequirements: [
          requirementFor(profileCode, "lineage-factors", "REAGENT", ["与目标组织谱系和成熟阶段匹配的基质与分化因子组合", "Matrix and differentiation-factor combination matched to the target tissue lineage and maturation stage"]),
          requirementFor(profileCode, "identity-controls", "CONTROL", ["谱系身份、成熟度、支原体和批次内形态放行控制", "Lineage-identity, maturity, mycoplasma, and within-batch morphology release controls"]),
        ],
      }];
    }
    default:
      return [];
  }
}

// Phenotype/pathway profiles are deliberately separate from platform profiles
// above.  They make the biological question actionable: every selected
// pathway names the target panel and the perturbation or interpretation
// control that must be registered.  Target identity remains a manual
// confirmation because a stock record alone cannot establish biological
// suitability for a particular model or species.
function phenotypeProfilesFor(blueprint: TechniqueBlueprint): TechniqueProfile[] {
  const requirementFor = (
    profileCode: string,
    suffix: string,
    kind: TechniqueRequirement["kind"],
    label: [string, string],
  ) => manualProfileRequirement(blueprint.code, profileCode, suffix, kind, label);

  const profile = (
    code: string,
    name: [string, string],
    description: [string, string],
    additionalRequirements: TechniqueRequirement[],
  ): TechniqueProfile => ({
    code,
    name: { zh: name[0], en: name[1] },
    description: { zh: description[0], en: description[1] },
    additionalRequirements,
  });

  switch (blueprint.code) {
    case "WB": {
      const autophagy = "AUTOPHAGY_FLUX_WB";
      const ecm = "ECM_REMODELING_WB";
      const mitochondrial = "MITOCHONDRIAL_BIOENERGETICS_WB";
      return [
        profile(
          autophagy,
          ["自噬通量 WB", "Autophagic-flux western blot"],
          ["以 LC3 脂化与 p62 周转共同判定自噬通量，必须配合阻断溶酶体降解的对照，不能只报告单一静态蛋白量。", "Interprets autophagic flux from LC3 lipidation and p62 turnover together; a lysosomal-degradation block is required, rather than a single static protein measurement."],
          [
            requirementFor(autophagy, "marker-antibodies", "REAGENT", ["LC3B（LC3-I/II）与 SQSTM1/p62 抗体，并按模型需要加入 ATG5、ATG7 或 Beclin-1", "Antibodies to LC3B (LC3-I/II) and SQSTM1/p62, with ATG5, ATG7, or Beclin-1 as model-appropriate additions"]),
            requirementFor(autophagy, "flux-block", "REAGENT", ["用于通量判读的溶酶体抑制剂（如 bafilomycin A1 或 chloroquine）及载体", "Lysosomal inhibitor for flux interpretation (such as bafilomycin A1 or chloroquine) with matched vehicle"]),
            requirementFor(autophagy, "time-course", "CONTROL", ["未处理、诱导和溶酶体阻断条件下的预定义采样时间序列", "Prespecified sampling time course across untreated, inducing, and lysosomal-block conditions"]),
          ],
        ),
        profile(
          ecm,
          ["细胞外基质重塑 WB", "Extracellular-matrix remodeling western blot"],
          ["将基质沉积、降解与黏附信号放在同一判读框架中，靶点须与样本来源和组织区室相匹配。", "Places matrix deposition, degradation, and adhesion signaling in one interpretation framework; targets must match the sample source and tissue compartment."],
          [
            requirementFor(ecm, "matrix-panel", "REAGENT", ["COL1A1/COL3A1、FN1、Laminin 或对应基质蛋白的验证抗体面板", "Validated antibody panel for COL1A1/COL3A1, FN1, laminin, or the relevant matrix proteins"]),
            requirementFor(ecm, "turnover-panel", "REAGENT", ["MMP2/MMP9、TIMP1/TIMP2 及需要时 ITGB1、FAK/p-FAK 的重塑/黏附抗体", "Remodeling/adhesion antibodies for MMP2/MMP9, TIMP1/TIMP2, and, when indicated, ITGB1 and FAK/p-FAK"]),
            requirementFor(ecm, "matrix-control", "CONTROL", ["基线与重塑诱导（如 TGF-β）或抑制条件，以及适配的上清/细胞层分离策略", "Baseline and remodeling-inducing (such as TGF-β) or inhibiting conditions, with an appropriate supernatant/cell-layer fractionation strategy"]),
          ],
        ),
        profile(
          mitochondrial,
          ["线粒体生物能学 WB", "Mitochondrial-bioenergetics western blot"],
          ["同时评估线粒体含量、呼吸链复合体和应激响应；全细胞上样量不能替代线粒体含量归一化。", "Evaluates mitochondrial content, respiratory-chain complexes, and stress response together; whole-cell loading alone cannot substitute for mitochondrial-content normalization."],
          [
            requirementFor(mitochondrial, "oxphos-panel", "REAGENT", ["OXPHOS 复合体 I–V 抗体鸡尾酒，或 NDUFS1、SDHB、UQCRC2、MTCO1、ATP5F1A 的目标抗体", "OXPHOS complex I–V antibody cocktail, or target antibodies to NDUFS1, SDHB, UQCRC2, MTCO1, and ATP5F1A"]),
            requirementFor(mitochondrial, "content-normalizer", "REAGENT", ["线粒体含量归一化标记（VDAC1、TOMM20 或 citrate synthase）及总蛋白归一化方案", "Mitochondrial-content normalizer (VDAC1, TOMM20, or citrate synthase) and a total-protein normalization plan"]),
            requirementFor(mitochondrial, "functional-control", "CONTROL", ["呼吸抑制/解偶联或营养应激的阳性响应控制，并预定义细胞数和活性门槛", "Positive response control using respiratory inhibition/uncoupling or nutrient stress, with prespecified cell-number and viability thresholds"]),
          ],
        ),
      ];
    }
    case "QPCR": {
      const autophagy = "AUTOPHAGY_TRANSCRIPTIONAL_QPCR";
      const ecm = "ECM_REMODELING_QPCR";
      const mitochondrial = "MITOCHONDRIAL_BIOGENESIS_QPCR";
      return [
        profile(autophagy, ["自噬转录响应 qPCR", "Autophagy transcriptional-response qPCR"], ["用核心自噬与溶酶体基因的组合描述通路响应，同时用通量实验避免把 mRNA 变化误作通量。", "Describes pathway response with a core autophagy/lysosome gene set and pairs it with a flux assay to avoid equating mRNA changes with flux."], [
          requirementFor(autophagy, "primer-panel", "REAGENT", ["MAP1LC3B、SQSTM1、ATG5/ATG7、BECN1 和模型相关溶酶体基因的经验证引物", "Validated primers for MAP1LC3B, SQSTM1, ATG5/ATG7, BECN1, and model-relevant lysosomal genes"]),
          requirementFor(autophagy, "flux-orthogonal-control", "CONTROL", ["与转录采样配对的自噬通量正交读出及未处理/诱导对照", "Orthogonal autophagic-flux readout paired with transcriptional sampling, plus untreated/induced controls"]),
        ]),
        profile(ecm, ["细胞外基质重塑 qPCR", "Extracellular-matrix remodeling qPCR"], ["区分基质合成、降解和交联表达模块，并预定义细胞组成或组织区室校正。", "Separates matrix synthesis, degradation, and cross-linking expression modules, with prespecified cell-composition or tissue-compartment correction."], [
          requirementFor(ecm, "primer-panel", "REAGENT", ["COL1A1、COL3A1、FN1、MMP2/MMP9、TIMP1/TIMP2 与 LOX 的目标引物面板", "Target primer panel for COL1A1, COL3A1, FN1, MMP2/MMP9, TIMP1/TIMP2, and LOX"]),
          requirementFor(ecm, "remodeling-control", "CONTROL", ["基线与诱导/抑制重塑条件，并登记培养基血清、细胞密度和归一化基因稳定性", "Baseline and remodeling-inducing/inhibiting conditions, with recorded medium serum, cell density, and reference-gene stability"]),
        ]),
        profile(mitochondrial, ["线粒体生物发生与代谢 qPCR", "Mitochondrial-biogenesis and metabolism qPCR"], ["以核编码生物发生基因、线粒体转录本和 mtDNA 拷贝数共同判定，避免只用单一线粒体基因。", "Uses nuclear-encoded biogenesis genes, mitochondrial transcripts, and mtDNA copy number together, avoiding reliance on one mitochondrial gene."], [
          requirementFor(mitochondrial, "primer-panel", "REAGENT", ["PPARGC1A、TFAM、NRF1、NDUFS1/COX5B 及 mtDNA/核 DNA 拷贝数配对引物", "Paired primers for PPARGC1A, TFAM, NRF1, NDUFS1/COX5B, and mtDNA/nuclear-DNA copy number"]),
          requirementFor(mitochondrial, "normalization-control", "CONTROL", ["细胞数、细胞周期和活性校正，以及氧张力/底物条件的预定义记录", "Cell-number, cell-cycle, and viability correction, with prespecified recording of oxygen and substrate conditions"]),
        ]),
      ];
    }
    case "IF": {
      const autophagy = "AUTOPHAGY_PUNCTA_IF";
      const ecm = "ECM_DEPOSITION_IF";
      const mitochondrial = "MITOCHONDRIAL_MORPHOLOGY_IF";
      return [
        profile(autophagy, ["自噬斑点 IF", "Autophagy-puncta immunofluorescence"], ["通过 LC3 与 p62/溶酶体共定位和每细胞定量评估自噬结构，必须结合通量阻断条件。", "Assesses autophagic structures using LC3 colocalization with p62/lysosomes and per-cell quantification, with a flux-block condition."], [
          requirementFor(autophagy, "marker-panel", "REAGENT", ["LC3B、SQSTM1/p62 与 LAMP1/LysoTracker 的兼容抗体/探针组合", "Compatible LC3B, SQSTM1/p62, and LAMP1/LysoTracker antibody/probe combination"]),
          requirementFor(autophagy, "imaging-control", "CONTROL", ["未处理、诱导和溶酶体阻断对照；预定义盲法视野选择、阈值与每细胞斑点计数规则", "Untreated, induced, and lysosomal-block controls; prespecified blinded field selection, thresholding, and per-cell puncta-counting rules"]),
        ]),
        profile(ecm, ["细胞外基质沉积 IF", "Extracellular-matrix deposition immunofluorescence"], ["同时显示 ECM 蛋白的空间沉积和细胞黏附/收缩状态，适用于单层、3D 基质或组织切片。", "Visualizes spatial ECM deposition together with cellular adhesion/contractility, for monolayers, 3D matrices, or tissue sections."], [
          requirementFor(ecm, "matrix-panel", "REAGENT", ["COL I、FN1、Laminin 或组织相关 ECM 抗体，及需要时 α-SMA、ITGB1 或 p-FAK 标记", "Antibodies to collagen I, FN1, laminin, or tissue-relevant ECM, with α-SMA, ITGB1, or p-FAK when indicated"]),
          requirementFor(ecm, "deposition-control", "CONTROL", ["无一抗、已知 ECM 阳性区和基质重塑诱导/抑制条件；区分细胞内信号与胞外沉积", "No-primary, known ECM-positive region, and remodeling-inducing/inhibiting controls; distinguish intracellular signal from extracellular deposition"]),
        ]),
        profile(mitochondrial, ["线粒体形态 IF", "Mitochondrial-morphology immunofluorescence"], ["以线粒体网络形态联合分裂/融合标志物评估应激，不把单纯染料强度视作线粒体质量。", "Assesses stress through mitochondrial-network morphology and fission/fusion markers, rather than treating dye intensity alone as mitochondrial mass."], [
          requirementFor(mitochondrial, "morphology-panel", "REAGENT", ["TOMM20 或 HSP60 抗体/经验证的 MitoTracker，以及 DRP1、MFN1/MFN2、OPA1 标记", "TOMM20 or HSP60 antibody/validated MitoTracker, with DRP1, MFN1/MFN2, and OPA1 markers"]),
          requirementFor(mitochondrial, "morphology-control", "CONTROL", ["膜电位依赖染料的染色活性控制、细胞周期/密度控制和预定义网络分割分析", "Staining-viability control for membrane-potential-dependent dyes, cell-cycle/density control, and prespecified network-segmentation analysis"]),
        ]),
      ];
    }
    case "FLOW": {
      const innate = "INNATE_INFLAMMATION_FLOW";
      const tCell = "T_CELL_IMMUNITY_FLOW";
      const bCell = "B_CELL_HUMORAL_FLOW";
      const nk = "NK_CELL_CYTOTOXICITY_FLOW";
      const myeloid = "MYELOID_INNATE_FLOW";
      const checkpoint = "IMMUNE_CHECKPOINT_FLOW";
      const metabolism = "IMMUNE_METABOLISM_FLOW";
      const antigen = "ANTIGEN_PRESENTATION_FLOW";
      return [
        profile(innate, ["先天炎症/炎性小体流式", "Innate-inflammation/inflammasome flow cytometry"], ["区分炎性小体预激、caspase-1 活化和焦亡执行，避免只以单一细胞因子推断炎性小体。", "Distinguishes inflammasome priming, caspase-1 activation, and pyroptotic execution rather than inferring inflammasome activity from one cytokine."], [
          requirementFor(innate, "panel", "REAGENT", ["髓系谱系标记、活/死染、活性 caspase-1/ASC 或 GSDMD 读出，并按模型加入 IL-1β/IL-18", "Myeloid-lineage markers, viability dye, active caspase-1/ASC or GSDMD readout, with IL-1β/IL-18 as model-appropriate"]),
          requirementFor(innate, "controls", "CONTROL", ["priming 与 activation 分步条件、caspase-1 或 NLRP3 阻断、FMO 和双ts/碎片排除门控", "Separate priming and activation conditions, caspase-1 or NLRP3 blockade, FMO, and doublet/debris-exclusion gating"]),
        ]),
        profile(tCell, ["T 细胞免疫分型流式", "T-cell immunity flow cytometry"], ["将谱系、分化、活化、功能与耗竭分开建模，面板不应只由检查点分子构成。", "Models lineage, differentiation, activation, function, and exhaustion separately; the panel should not consist solely of checkpoint markers."], [
          requirementFor(tCell, "panel", "REAGENT", ["CD3、CD4、CD8、CD45RA/RO、CCR7、CD25/CD127、Ki-67，以及功能/耗竭标志（如 IFN-γ、TNF、GZMB、PD-1、TIGIT）", "CD3, CD4, CD8, CD45RA/RO, CCR7, CD25/CD127, Ki-67, and functional/exhaustion markers such as IFN-γ, TNF, GZMB, PD-1, and TIGIT"]),
          requirementFor(tCell, "controls", "CONTROL", ["单染补偿、FMO、刺激/未刺激、细胞内因子阻断和活细胞/双ts门控控制", "Single-stain compensation, FMO, stimulated/unstimulated, intracellular-cytokine-blockade, and live-cell/doublet-gating controls"]),
        ]),
        profile(bCell, ["B 细胞与体液免疫流式", "B-cell and humoral-immunity flow cytometry"], ["以 B 细胞成熟、浆母细胞分化和抗原经验为主线，必要时与抗体分泌读出配对。", "Tracks B-cell maturation, plasmablast differentiation, and antigen experience, paired with an antibody-secretion readout when needed."], [
          requirementFor(bCell, "panel", "REAGENT", ["CD19 或 CD20、CD27、IgD、IgM、CD38、CD138、CD24/CD21 和必要的抗原特异探针", "CD19 or CD20, CD27, IgD, IgM, CD38, CD138, CD24/CD21, and antigen-specific probes when needed"]),
          requirementFor(bCell, "controls", "CONTROL", ["FMO、双联体/死细胞排除、荧光抗原探针去骨架或竞争控制，以及血浆细胞门控预注册", "FMO, doublet/dead-cell exclusion, fluorescent-antigen probe decoy or competition controls, and preregistered plasma-cell gating"]),
        ]),
        profile(nk, ["NK 细胞细胞毒性流式", "NK-cell cytotoxicity flow cytometry"], ["同时测定 NK 谱系、抑制/激活受体、脱颗粒和靶细胞杀伤，不以单个表面标志替代功能。", "Measures NK lineage, inhibitory/activating receptors, degranulation, and target-cell killing together; a single surface marker cannot substitute for function."], [
          requirementFor(nk, "panel", "REAGENT", ["CD45、CD3、CD56、CD16、NKG2D、NKp46、KIR、CD107a、GZMB/PRF1 及靶细胞示踪染料", "CD45, CD3, CD56, CD16, NKG2D, NKp46, KIR, CD107a, GZMB/PRF1, and target-cell tracking dye"]),
          requirementFor(nk, "controls", "CONTROL", ["无靶、敏感/耐受靶细胞、效靶比梯度、去颗粒阻断与活性/死亡门控控制", "No-target, sensitive/resistant target, effector-to-target ratio gradient, degranulation-blockade, and viability/death-gating controls"]),
        ]),
        profile(myeloid, ["髓系先天免疫流式", "Myeloid innate-immunity flow cytometry"], ["区分单核细胞、中性粒细胞、巨噬细胞和树突细胞的身份与状态，并针对组织消化偏倚设定控制。", "Distinguishes identity and state of monocytes, neutrophils, macrophages, and dendritic cells, with controls for tissue-dissociation bias."], [
          requirementFor(myeloid, "panel", "REAGENT", ["CD45、CD11b、CD14、CD16、HLA-DR、CD11c、CD64、CD163、CD206、CD66b 和 CD80/CD86 的模块化面板", "Modular panel for CD45, CD11b, CD14, CD16, HLA-DR, CD11c, CD64, CD163, CD206, CD66b, and CD80/CD86"]),
          requirementFor(myeloid, "controls", "CONTROL", ["组织消化前后标志稳定性、FMO、绝对计数珠和预定义的谱系排除门控", "Marker-stability checks before/after tissue dissociation, FMO, counting beads, and prespecified lineage-exclusion gates"]),
        ]),
        profile(checkpoint, ["免疫检查点/抑制流式", "Immune-checkpoint/suppression flow cytometry"], ["在明确的 T、NK、髓系或肿瘤细胞区室中解释抑制轴，并配套活化/功能读出。", "Interprets suppressive axes within defined T, NK, myeloid, or tumor compartments and pairs them with activation/function readouts."], [
          requirementFor(checkpoint, "panel", "REAGENT", ["PD-1、PD-L1、CTLA-4、LAG-3、TIGIT、TIM-3、VISTA 或 CD39/CD73，并包含相关谱系和功能标志", "PD-1, PD-L1, CTLA-4, LAG-3, TIGIT, TIM-3, VISTA, or CD39/CD73, with relevant lineage and functional markers"]),
          requirementFor(checkpoint, "controls", "CONTROL", ["FMO、受体占位/克隆竞争评估、诱导阳性细胞与同批未诱导细胞，以及批次一致的门控模板", "FMO, receptor-occupancy/clone-competition assessment, induced positive and matched uninduced cells, and a batch-consistent gating template"]),
        ]),
        profile(metabolism, ["免疫代谢流式", "Immunometabolism flow cytometry"], ["在免疫细胞亚群内同时解释营养摄取、线粒体状态和效应功能，需避免染料受细胞大小/活性影响造成的假差异。", "Interprets nutrient uptake, mitochondrial state, and effector function within immune subsets, controlling for dye artifacts from cell size and viability."], [
          requirementFor(metabolism, "panel", "REAGENT", ["谱系/活性标记、2-NBDG 或葡萄糖摄取探针、MitoTracker/TMRE、脂质摄取探针及功能细胞因子面板", "Lineage/viability markers, 2-NBDG or glucose-uptake probe, MitoTracker/TMRE, lipid-uptake probe, and functional cytokine panel"]),
          requirementFor(metabolism, "controls", "CONTROL", ["无探针、竞争抑制、呼吸抑制/解偶联、细胞大小校正和基于活细胞的门控控制", "No-probe, competitive-inhibition, respiratory inhibition/uncoupling, cell-size correction, and live-cell-based gating controls"]),
        ]),
        profile(antigen, ["抗原呈递流式", "Antigen-presentation flow cytometry"], ["评估抗原加工和 MHC 呈递能力时，需同时读出 APC 身份、共刺激和 T 细胞功能后果。", "Assessment of antigen processing and MHC presentation must include APC identity, costimulation, and a T-cell functional consequence."], [
          requirementFor(antigen, "panel", "REAGENT", ["HLA-DR/MHC-II、MHC-I、CD80、CD86、CD40、CD83 及对应 APC 谱系标记；需要时加入抗原/MHC 四聚体", "HLA-DR/MHC-II, MHC-I, CD80, CD86, CD40, CD83, and corresponding APC lineage markers; antigen/MHC multimers when needed"]),
          requirementFor(antigen, "controls", "CONTROL", ["无关抗原、加工/呈递阻断、FMO，以及 APC–T 细胞共培养功能对照", "Irrelevant-antigen, processing/presentation-blockade, FMO, and APC–T-cell coculture functional controls"]),
        ]),
      ];
    }
    case "SANDWICH_ELISA": {
      const inflammasome = "INFLAMMASOME_CYTOKINE_ELISA";
      const complement = "COMPLEMENT_FC_EFFECTOR_ELISA";
      return [
        profile(inflammasome, ["炎性小体细胞因子 ELISA", "Inflammasome-cytokine ELISA"], ["以成熟 IL-1β/IL-18 分泌为一个读出，并用细胞死亡和 caspase-1 读出避免将裂解泄漏误判为分泌。", "Uses mature IL-1β/IL-18 secretion as one readout and pairs it with cell-death and caspase-1 measurements to avoid confusing lysis leakage with secretion."], [
          requirementFor(inflammasome, "target-kit", "REAGENT", ["成熟 IL-1β 和/或 IL-18 的特异夹心 ELISA 抗体对/试剂盒", "Specific sandwich-ELISA antibody pair/kit for mature IL-1β and/or IL-18"]),
          requirementFor(inflammasome, "release-controls", "CONTROL", ["priming/activation 分步、caspase-1 或 NLRP3 阻断、LDH/活性控制和重组细胞因子标准", "Separate priming/activation, caspase-1 or NLRP3 blockade, LDH/viability control, and recombinant cytokine standards"]),
        ]),
        profile(complement, ["补体/Fc 效应 ELISA", "Complement/Fc-effector ELISA"], ["在补体或 Fc 相关读出中控制血清来源、热灭活和抗体同种型，不能将单一结合信号等同于效应功能。", "Complement or Fc-related readouts must control serum source, heat inactivation, and antibody isotype; one binding signal is not equivalent to effector function."], [
          requirementFor(complement, "target-kit", "REAGENT", ["C3a、C5a、sC5b-9 或 Fc 结合/效应目标的经验证 ELISA 试剂", "Validated ELISA reagents for C3a, C5a, sC5b-9, or the Fc binding/effector target"]),
          requirementFor(complement, "serum-controls", "CONTROL", ["新鲜与热灭活血清、无抗体/同种型对照、EDTA 阻断和标准曲线控制", "Fresh and heat-inactivated serum, no-antibody/isotype controls, EDTA blockade, and standard-curve controls"]),
        ]),
      ];
    }
    case "SEAHORSE_OCR_ECAR": {
      const mitochondrial = "MITOCHONDRIAL_STRESS_TEST";
      return [profile(mitochondrial, ["线粒体压力测试", "Mitochondrial stress test"], ["以基线呼吸、ATP 偶联、最大呼吸和非线粒体耗氧共同解释生物能学，并以细胞数和活性归一化。", "Interprets bioenergetics from basal respiration, ATP coupling, maximal respiration, and non-mitochondrial oxygen consumption, normalized to cell number and viability."], [
        requirementFor(mitochondrial, "inhibitor-series", "REAGENT", ["寡霉素、FCCP 和 rotenone/antimycin A 的滴定优化抑制剂组合", "Titration-optimized inhibitor series of oligomycin, FCCP, and rotenone/antimycin A"]),
        requirementFor(mitochondrial, "normalization", "CONTROL", ["细胞数/蛋白/DNA 归一化、铺板均一性、培养基底物条件和边缘孔控制", "Cell-number/protein/DNA normalization, seeding uniformity, medium substrate conditions, and edge-well controls"]),
      ])];
    }
    case "MITOCHONDRIAL_MEMBRANE_POTENTIAL": {
      const mitochondrial = "MITOCHONDRIAL_POTENTIAL_CONTROL";
      return [profile(mitochondrial, ["线粒体膜电位表型", "Mitochondrial membrane-potential phenotype"], ["膜电位是线粒体状态的一个维度，必须与线粒体质量、细胞活性和去极化阳性控制一起解释。", "Membrane potential is one dimension of mitochondrial state and must be interpreted with mitochondrial mass, viability, and a depolarization positive control."], [
        requirementFor(mitochondrial, "dye-pair", "REAGENT", ["TMRE/TMRM 或 JC-1 膜电位探针，配合线粒体质量标记（如 MitoTracker Green）", "TMRE/TMRM or JC-1 membrane-potential probe paired with a mitochondrial-mass marker such as MitoTracker Green"]),
        requirementFor(mitochondrial, "depolarization-control", "CONTROL", ["CCCP/FCCP 去极化阳性控制、活/死染、探针滴定及按细胞大小/质量的归一化", "CCCP/FCCP depolarization positive control, viability dye, probe titration, and normalization by cell size/mass"]),
      ])];
    }
    default:
      return [];
  }
}

function profilesFor(blueprint: TechniqueBlueprint): TechniqueProfile[] {
  const integrativeProfiles = integrativeProfilesFor(blueprint);
  const phenotypeProfiles = phenotypeProfilesFor(blueprint);
  if (blueprint.code === "WB") {
    return [{
      code: "EXOSOME_CHARACTERIZATION",
      name: { zh: "外泌体蛋白标志物表征", en: "Exosome protein-marker characterization" },
      description: {
        zh: "在 WB 基础要求上增加外泌体阳性标志物、阴性/污染标志物及来源细胞对照。",
        en: "Adds exosome-positive markers, negative/contamination markers and source-cell controls to the core WB requirements.",
      },
      additionalRequirements: [
        {
          ...requirement(
            blueprint.code,
            "REAGENT",
            ["CD9/CD63/CD81 与 TSG101/ALIX 的阳性标志物抗体，以及 Calnexin/GM130（细胞器污染）和 ApoA1/ApoB（血浆脂蛋白）等样本匹配的阴性标志物", "Positive-marker antibodies to CD9/CD63/CD81 and TSG101/ALIX, plus sample-matched negative markers such as Calnexin/GM130 (organelle contamination) and ApoA1/ApoB (plasma lipoproteins)"],
          ),
          id: `${blueprint.code}:profile:EXOSOME_CHARACTERIZATION:marker-panel`,
        },
        {
          ...requirement(
            blueprint.code,
            "CONTROL",
            ["来源细胞裂解物或适配的参考制备物，并登记上样归一化方式（颗粒数、蛋白量或来源细胞数）", "Source-cell lysate or compatible reference preparation, with a recorded loading normalization strategy (particle count, protein mass, or source-cell number)"],
          ),
          id: `${blueprint.code}:profile:EXOSOME_CHARACTERIZATION:reference`,
        },
      ],
    }, ...integrativeProfiles, ...phenotypeProfiles];
  }
  if (blueprint.code === "QPCR") {
    return [
      {
        code: "INTERCALATING_DYE",
        name: { zh: "嵌入染料法 qPCR", en: "Intercalating-dye qPCR" },
        description: {
          zh: "使用双链 DNA 嵌入染料报告扩增，必须以熔解曲线和产物特异性检查排除非特异信号。",
          en: "Uses a double-stranded-DNA intercalating dye and requires melt-curve and product-specificity checks for nonspecific signal.",
        },
        additionalRequirements: [
          {
            ...requirement(
              blueprint.code,
              "REAGENT",
              ["嵌入染料型 qPCR 反应体系", "Intercalating-dye qPCR chemistry"],
              {
                verificationMode: "AUTO_INVENTORY",
                capabilityTags: ["QPCR_MASTER_MIX"],
                matcherValues: ["SYBR qPCR master mix", "intercalating dye qPCR"],
              },
            ),
            id: `${blueprint.code}:profile:INTERCALATING_DYE:chemistry`,
          },
          {
            ...requirement(
              blueprint.code,
              "CONTROL",
              ["单一特异产物与熔解曲线对照", "Single-specific-product and melt-curve control"],
            ),
            id: `${blueprint.code}:profile:INTERCALATING_DYE:specificity-control`,
          },
        ],
      },
      {
        code: "HYDROLYSIS_PROBE",
        name: { zh: "水解探针法 qPCR", en: "Hydrolysis-probe qPCR" },
        description: {
          zh: "序列特异性水解探针提供附加识别层，探针是该 profile 的独立必需试剂。",
          en: "A sequence-specific hydrolysis probe adds an identification layer and is an independently required reagent for this profile.",
        },
        additionalRequirements: [
          {
            ...requirement(
              blueprint.code,
              "REAGENT",
              ["靶标特异性荧光水解探针", "Target-specific fluorescent hydrolysis probe"],
              {
                verificationMode: "AUTO_INVENTORY",
                capabilityTags: ["QPCR_PROBE"],
                matcherValues: ["TaqMan probe", "qPCR hydrolysis probe"],
              },
            ),
            id: `${blueprint.code}:profile:HYDROLYSIS_PROBE:probe`,
          },
        ],
      },
      ...integrativeProfiles,
      ...phenotypeProfiles,
    ];
  }
  if (blueprint.code === "RT_QPCR") {
    return [
      {
        code: "ONE_STEP",
        name: { zh: "一步法 RT-qPCR", en: "One-step RT-qPCR" },
        description: {
          zh: "逆转录与实时扩增在同一封闭反应中连续完成。",
          en: "Reverse transcription and real-time amplification occur sequentially in one closed reaction.",
        },
        additionalRequirements: [
          {
            ...requirement(
              blueprint.code,
              "REAGENT",
              ["一步法 RT-qPCR 反应体系", "One-step RT-qPCR reaction chemistry"],
              {
                verificationMode: "AUTO_INVENTORY",
                capabilityTags: ["QPCR_MASTER_MIX"],
                matcherValues: ["one-step RT-qPCR mix"],
              },
            ),
            id: `${blueprint.code}:profile:ONE_STEP:chemistry`,
          },
        ],
      },
      {
        code: "TWO_STEP",
        name: { zh: "两步法 RT-qPCR", en: "Two-step RT-qPCR" },
        description: {
          zh: "先独立合成并质控 cDNA，再取等量 cDNA 进行实时定量扩增。",
          en: "cDNA is synthesized and quality-controlled separately before equalized cDNA input is amplified by qPCR.",
        },
        additionalRequirements: [
          {
            ...requirement(
              blueprint.code,
              "REAGENT",
              ["独立 cDNA 合成体系", "Standalone cDNA-synthesis chemistry"],
              {
                verificationMode: "AUTO_INVENTORY",
                capabilityTags: ["REVERSE_TRANSCRIPTION_REAGENT"],
                matcherValues: ["reverse transcription kit", "cDNA synthesis kit"],
              },
            ),
            id: `${blueprint.code}:profile:TWO_STEP:cdna-chemistry`,
          },
          {
            ...requirement(
              blueprint.code,
              "SAMPLE",
              ["定量并按计划稀释的 cDNA", "Quantified and plan-diluted cDNA"],
            ),
            id: `${blueprint.code}:profile:TWO_STEP:cdna-input`,
          },
        ],
      },
      ...integrativeProfiles,
      ...phenotypeProfiles,
    ];
  }
  return [...integrativeProfiles, ...phenotypeProfiles];
}

type HazardClass = ExperimentTechnique["safety"]["hazardClasses"][number];

function inferSafety(blueprint: TechniqueBlueprint) {
  const classes = new Set<HazardClass>();
  const identity = [
    blueprint.code,
    blueprint.preset,
    blueprint.categoryCode,
    ...blueprint.sampleTypes,
    ...(blueprint.hazards ?? []),
  ]
    .join(" ")
    .toLocaleUpperCase("en-US");

  if (
    [
      "SAMPLE_MODELS",
      "NUCLEIC_ACID_GENETIC_ENGINEERING",
      "PROTEIN_IMMUNOASSAYS",
      "IMAGING_HISTOLOGY",
      "CYTOMETRY_SORTING",
      "CELL_FUNCTION",
      "MICROBIOLOGY_INFECTION",
      "SEQUENCING_OMICS",
      "ANIMAL_IN_VIVO",
    ].includes(blueprint.categoryCode)
  ) {
    classes.add("BIOLOGICAL");
  }
  if (
    [
      "ANALYTICAL_BIOPHYSICS",
      "PROTEIN_IMMUNOASSAYS",
      "NUCLEIC_ACID_GENETIC_ENGINEERING",
      "IMAGING_HISTOLOGY",
      "SEQUENCING_OMICS",
      "STRUCTURAL_BIOLOGY",
    ].includes(blueprint.categoryCode)
  ) {
    classes.add("CHEMICAL");
  }
  if (
    ["MICROSCOPY", "FLOW_CYTOMETRY", "SPECTROSCOPY"].includes(blueprint.preset)
  ) {
    classes.add("LASER_OPTICAL");
  }
  if (
    ["CHROMATOGRAPHY", "MASS_SPECTROMETRY"].includes(blueprint.preset) ||
    /\b(HPLC|LC_MS|LC-MS|CHROMATOGRAPHY)\b/.test(identity)
  ) {
    classes.add("HIGH_PRESSURE");
    classes.add("CHEMICAL");
  }
  if (/X_RAY|X-RAY|RADIOIMMUNO|RADIOACTIVE|RADIATION/.test(identity)) {
    classes.add("IONIZING_RADIATION");
  }
  if (/CRYO|LIQUID NITROGEN|CRYOPRESERVATION/.test(identity)) {
    classes.add("CRYOGENIC");
  }
  if (/CENTRIFUG|ULTRACENTRIFUG/.test(identity)) {
    classes.add("ROTATING_EQUIPMENT");
  }
  if (/ELECTROPOR|ELECTROPHORES|ELECTRON MICROSCOPY|_EM\b/.test(identity)) {
    classes.add("HIGH_VOLTAGE");
  }
  if (blueprint.categoryCode === "ANIMAL_IN_VIVO") {
    classes.add("ANIMAL_WELFARE");
    classes.add("SHARPS");
  }
  if (blueprint.categoryCode === "ECOLOGY_FIELD") {
    classes.add("FIELD_ENVIRONMENT");
    classes.add("BIOLOGICAL");
  }
  if (!classes.size) classes.add("CHEMICAL");

  const biosafetyLevel =
    blueprint.biosafetyLevel ??
    (blueprint.categoryCode === "ANIMAL_IN_VIVO"
      ? "ABSL1"
      : blueprint.categoryCode === "MICROBIOLOGY_INFECTION" ||
          /\b(HUMAN|BLOOD|CLINICAL|TISSUE)\b/.test(identity)
        ? "BSL2"
        : "NA");
  const riskLevel = ["BSL4", "ABSL4"].includes(biosafetyLevel)
    ? ("RESTRICTED" as const)
    : ["BSL3", "ABSL3"].includes(biosafetyLevel) ||
        classes.has("IONIZING_RADIATION")
      ? ("HIGH" as const)
      : biosafetyLevel === "BSL2" ||
          biosafetyLevel === "ABSL2" ||
          classes.has("ANIMAL_WELFARE") ||
          classes.has("HIGH_VOLTAGE") ||
          classes.has("HIGH_PRESSURE") ||
          classes.has("LASER_OPTICAL") ||
          classes.has("CRYOGENIC") ||
          classes.has("FIELD_ENVIRONMENT")
        ? ("MODERATE" as const)
        : ("LOW" as const);
  const evidenceSourceIds = new Set<string>();
  if (classes.has("BIOLOGICAL")) evidenceSourceIds.add("CDC_BMBL_6");
  if (
    [...classes].some((item) =>
      [
        "CHEMICAL",
        "LASER_OPTICAL",
        "HIGH_VOLTAGE",
        "HIGH_PRESSURE",
        "CRYOGENIC",
        "ROTATING_EQUIPMENT",
        "SHARPS",
        "FIELD_ENVIRONMENT",
      ].includes(item),
    )
  ) {
    evidenceSourceIds.add("OSHA_LAB_SAFETY_2011");
  }
  if (classes.has("IONIZING_RADIATION")) {
    evidenceSourceIds.add("US_NRC_10_CFR_20");
  }
  if (classes.has("ANIMAL_WELFARE")) {
    evidenceSourceIds.add("NASEM_LAB_ANIMALS_8");
  }
  if (!evidenceSourceIds.size) evidenceSourceIds.add("OSHA_LAB_SAFETY_2011");

  return {
    biosafetyLevel,
    riskLevel,
    hazardClasses: [...classes],
    evidenceSourceIds: [...evidenceSourceIds],
  };
}

const safetyClaimLocators: Record<string, string> = {
  CDC_BMBL_6: "BMBL 6th edition, Section II: Biological Risk Assessment",
  US_NRC_10_CFR_20: "10 CFR Part 20.1101: radiation protection programs",
  NASEM_LAB_ANIMALS_8:
    "Guide for the Care and Use of Laboratory Animals 8th ed: occupational health and safety",
  OSHA_LAB_SAFETY_2011:
    "OSHA 3404-11R Laboratory Safety Guidance: hazard assessment and controls",
};

const presetSopSourceIds: Record<TechniqueBlueprint["preset"], string> = {
  SAMPLE_PREPARATION: "WHO_PHLEBOTOMY_2010",
  CELL_CULTURE: "CP_CELL_BIO_2025",
  TISSUE_MODEL: "CP_CELL_BIO_2025",
  NUCLEIC_ACID_EXTRACTION: "CP_MOL_BIO_2025",
  PCR_AMPLIFICATION: "CP_MOL_BIO_2025",
  MOLECULAR_CLONING: "CP_MOL_BIO_2025",
  GENE_DELIVERY: "CP_MOL_BIO_2025",
  GENE_EDITING: "CP_MOL_BIO_2025",
  NUCLEIC_ACID_HYBRIDIZATION: "CP_MOL_BIO_2025",
  PROTEIN_ANALYSIS: "CP_PROTEIN_SCI_2025",
  IMMUNOASSAY: "CP_PROTEIN_SCI_2025",
  PROTEIN_PURIFICATION: "CP_PROTEIN_SCI_2025",
  MICROSCOPY: "MURPHY_LIGHT_MICROSCOPY_2E",
  HISTOLOGY: "BANCROFT_HISTO_8",
  FLOW_CYTOMETRY: "CP_CYTOMETRY_2025",
  CELL_BASED_ASSAY: "CP_CELL_BIO_2025",
  MICROBIAL_CULTURE: "ASM_MCM_12E",
  INFECTION_ASSAY: "ASM_MCM_12E",
  SPECTROSCOPY: "CP_PROTEIN_SCI_2025",
  CHROMATOGRAPHY: "AOAC_OMA_22_2023",
  MASS_SPECTROMETRY: "AOAC_OMA_22_2023",
  BIOPHYSICAL_MEASUREMENT: "CP_PROTEIN_SCI_2025",
  SEQUENCING: "CP_MOL_BIO_2025",
  OMICS_SAMPLE_PREP: "CP_MOL_BIO_2025",
  STRUCTURAL_ANALYSIS: "CP_PROTEIN_SCI_2025",
  ANIMAL_PROCEDURE: "LAB_RAT_3_2020",
  FIELD_SAMPLING: "USGS_NFM_TM9",
};

function selectSafetyClaimSource(inferredSafety: {
  hazardClasses: string[];
  evidenceSourceIds: string[];
}) {
  const preferred = inferredSafety.hazardClasses.includes("BIOLOGICAL")
    ? "CDC_BMBL_6"
    : inferredSafety.hazardClasses.includes("IONIZING_RADIATION")
      ? "US_NRC_10_CFR_20"
      : inferredSafety.hazardClasses.includes("ANIMAL_WELFARE")
        ? "NASEM_LAB_ANIMALS_8"
        : "OSHA_LAB_SAFETY_2011";
  return inferredSafety.evidenceSourceIds.includes(preferred)
    ? preferred
    : inferredSafety.evidenceSourceIds[0];
}

export function buildTechnique(blueprint: TechniqueBlueprint): ExperimentTechnique {
  const definition = presetDefinitions[blueprint.preset];
  const inferredSafety = inferSafety(blueprint);
  const safetyClaimSourceId = selectSafetyClaimSource(inferredSafety);
  const terminologySourceId = ["ANALYTICAL_BIOPHYSICS", "STRUCTURAL_BIOLOGY"].includes(
    blueprint.categoryCode,
  )
    ? "CHMO_2025"
    : "OBI_2025";
  const evidenceSourceIds = Array.from(
    new Set([
      terminologySourceId,
      ...blueprint.evidenceSourceIds,
      ...(blueprint.reportingStandardIds ?? []),
      "MDAR_2021",
      presetSopSourceIds[blueprint.preset],
      ...inferredSafety.evidenceSourceIds,
    ]),
  );
  const declaredReagentRequirements: TechniqueRequirement[] =
    blueprint.reagentCapabilities?.length
      ? blueprint.reagentCapabilities.map((capability, index) => {
          const resolved = resolveTechniqueReagentCapability(capability);
          return {
            ...requirement(
            blueprint.code,
            "REAGENT",
            [
              `${definition.reagent[0]}：${capability}`,
              `${definition.reagent[1]}: ${capability}`,
            ],
            {
              verificationMode: resolved.verificationMode,
              capabilityTags: resolved.capabilityTags,
              matcherValues: resolved.matcherValues,
            },
          ),
          id: `${blueprint.code}:requirement:reagent:${index + 1}`,
          };
        })
      : [];
  const declaredTags = new Set(
    declaredReagentRequirements.flatMap((requirement) => requirement.capabilityTags),
  );
  const defaultReagentRequirements = presetReagentRequirements[blueprint.preset]
    .filter(
      (template) =>
        !blueprint.omitBaselineReagentKeys?.includes(template.key) &&
        (!template.capabilityTags.length ||
          !template.capabilityTags.some((tag) => declaredTags.has(tag))),
    )
    .map((template) => ({
      ...requirement(blueprint.code, "REAGENT", template.label, {
        level: template.level,
        verificationMode:
          template.capabilityTags.length > 0 ? "AUTO_INVENTORY" : "MANUAL_CONFIRMATION",
        capabilityTags: template.capabilityTags,
      }),
      id: `${blueprint.code}:requirement:baseline-reagent:${template.key}`,
    }));
  const reagentRequirements = [
    ...declaredReagentRequirements,
    ...defaultReagentRequirements,
  ];

  const contentWithoutHash = {
    id: `system:${blueprint.code}`,
    code: blueprint.code,
    slug: blueprint.slug,
    revision: 1,
    status: "PUBLISHED" as const,
    source: "SYSTEM" as const,
    isAbstract: false,
    parentCode: null,
    name: { zh: blueprint.nameZh, en: blueprint.nameEn },
    aliases: Array.from(new Set(blueprint.aliases)),
    categoryCode: blueprint.categoryCode,
    subcategoryCode: blueprint.subcategoryCode,
    principle: { zh: blueprint.principleZh, en: blueprint.principleEn },
    scope: { zh: blueprint.scopeZh, en: blueprint.scopeEn },
    sampleTypes: blueprint.sampleTypes,
    inputTypes: blueprint.sampleTypes,
    outputTypes: blueprint.readoutModes.map((readout) => `${readout} result`),
    readoutModes: blueprint.readoutModes,
    throughput: blueprint.throughput ?? "MEDIUM",
    destructive: blueprint.destructive ?? false,
    workflowStages: (blueprint.workflowOverrides?.length
      ? blueprint.workflowOverrides.map((item) => [item.labelZh, item.labelEn] as [string, string])
      : definition.workflow
    ).map(([zh, en], index) => ({
      key: `${blueprint.code.toLowerCase()}-stage-${index + 1}`,
      order: index + 1,
      label: { zh, en },
      objective: {
        zh: `完成${blueprint.nameZh}的“${zh}”阶段并保留可审计记录。`,
        en: `Complete the “${en}” stage of ${blueprint.nameEn} and retain an auditable record.`,
      },
    })),
    keyParameters: [
      {
        id: `${blueprint.code}:parameter:sample-input`,
        category: "SAMPLE_INPUT" as const,
        label: { zh: "样本身份与输入质量", en: "Sample identity and input quality" },
        recordingRule: {
          zh: "记录样本标识、来源、前处理历史和技术适用的输入质量指标。",
          en: "Record sample identity, origin, pre-analytical history and technique-appropriate input-quality metrics.",
        },
      },
      {
        id: `${blueprint.code}:parameter:reagent-identity`,
        category: "REAGENT_IDENTITY" as const,
        label: { zh: "关键试剂身份与批次", en: "Critical reagent identity and lot" },
        recordingRule: {
          zh: "记录关键试剂名称、批号、有效状态及适用性验证记录。",
          en: "Record critical reagent name, lot, validity status and fitness-for-purpose verification.",
        },
      },
      {
        id: `${blueprint.code}:parameter:instrument`,
        category: "INSTRUMENT_CONFIGURATION" as const,
        label: { zh: "设备配置与质控状态", en: "Instrument configuration and QC state" },
        recordingRule: {
          zh: "记录设备标识、关键配置、校准/维护状态和采集软件版本。",
          en: "Record instrument identity, critical configuration, calibration/maintenance state and acquisition-software version.",
        },
      },
      {
        id: `${blueprint.code}:parameter:controls`,
        category: "CONTROL_RESULT" as const,
        label: { zh: "对照结果与放行判定", en: "Control results and release decision" },
        recordingRule: {
          zh: "按预先定义的判据逐项记录对照结果、偏差及是否允许结果放行。",
          en: "Record each control result, deviation and release decision against predefined criteria.",
        },
      },
    ],
    requirements: [
      ...reagentRequirements,
      requirement(blueprint.code, "CONSUMABLE", definition.consumable),
      requirement(
        blueprint.code,
        "INSTRUMENT",
        blueprint.instrumentOverride
          ? [
              blueprint.instrumentOverride.labelZh,
              blueprint.instrumentOverride.labelEn,
            ]
          : definition.instrument,
      ),
      requirement(blueprint.code, "SAMPLE", definition.sample),
      ...controlRequirements(blueprint, definition),
      requirement(blueprint.code, "SOFTWARE", definition.software),
    ],
    profiles: profilesFor(blueprint),
    qcMetrics: (blueprint.qcOverrides?.length
      ? blueprint.qcOverrides.map((item) => [item.labelZh, item.labelEn] as [string, string])
      : [definition.qc]
    ).map(([zh, en], index) => ({
      id: `${blueprint.code}:qc:${index + 1}`,
      label: {
        zh: `${blueprint.nameZh}质量控制`,
        en: `${blueprint.nameEn} quality control`,
      },
      acceptance: { zh, en },
      evidenceSourceIds: [
        blueprint.reportingStandardIds?.[0] ?? "MDAR_2021",
      ],
    })),
    limitations: {
      zh: blueprint.limitationsZh ?? [definition.limitation[0]],
      en: blueprint.limitationsEn ?? [definition.limitation[1]],
    },
    troubleshooting: [
      {
        symptom: {
          zh: definition.troubleshooting.symptom[0],
          en: definition.troubleshooting.symptom[1],
        },
        action: {
          zh: definition.troubleshooting.action[0],
          en: definition.troubleshooting.action[1],
        },
      },
    ],
    safety: {
      biosafetyLevel: inferredSafety.biosafetyLevel,
      riskLevel: inferredSafety.riskLevel,
      hazardClasses: inferredSafety.hazardClasses,
      hazards: Array.from(
        new Set([
          ...(blueprint.hazards ?? []),
          ...inferredSafety.hazardClasses,
        ]),
      ),
      controls: [
        {
          zh: "开始前完成本地风险评估，采用与风险等级相匹配的工程控制、PPE、培训和应急措施。",
          en: "Complete a local risk assessment before work and use engineering controls, PPE, training and emergency measures matched to the risk.",
        },
      ],
      waste: {
        zh: "按机构批准的生物、化学和锐器废物流分类处置；未知或混合危害按更严格类别处理。",
        en: "Segregate waste into institution-approved biological, chemical and sharps streams; handle unknown or mixed hazards under the more stringent category.",
      },
      requiresLocalRiskAssessment: true,
      evidenceSourceIds: inferredSafety.evidenceSourceIds,
    },
    evidenceSourceIds,
    claimEvidence: [
      {
        claimId: `${blueprint.code}:claim:minimum-reporting`,
        fieldPath: "keyParameters",
        statement: {
          zh: "应记录材料、实验设计、分析和报告所需的可审计元数据。",
          en: "Auditable metadata for materials, experimental design, analysis and reporting should be recorded.",
        },
        evidenceSourceId: "MDAR_2021",
        locator: "MDAR Framework checklist: Materials, Design, Analysis and Reporting sections",
        claimType: "QUALITY" as const,
      },
      {
        claimId: `${blueprint.code}:claim:safety`,
        fieldPath: "safety.requiresLocalRiskAssessment",
        statement: {
          zh: "开始工作前必须依据样本、化学品、设备和操作场景完成本地风险评估。",
          en: "A local risk assessment based on samples, chemicals, equipment and the operating context is required before work.",
        },
        evidenceSourceId: safetyClaimSourceId,
        locator:
          safetyClaimLocators[safetyClaimSourceId] ??
          `${safetyClaimSourceId}: local risk assessment requirements`,
        claimType: "SAFETY" as const,
      },
      ...(blueprint.reportingStandardIds?.[0]
        ? [
            {
              claimId: `${blueprint.code}:claim:domain-reporting`,
              fieldPath: "reportingStandards[0]",
              statement:
                reportingApplicability[blueprint.reportingStandardIds[0]] ?? {
                  zh: "应按适用的领域标准记录本技术的最小信息。",
                  en: "The technique's minimum information should be recorded under the applicable domain standard.",
                },
              evidenceSourceId: blueprint.reportingStandardIds[0],
              locator: `${blueprint.reportingStandardIds[0]} versioned minimum-information checklist: ${(
                reportingRequirements[blueprint.reportingStandardIds[0]] ?? [
                  "materials",
                  "methods",
                  "quality",
                  "results",
                ]
              )
                .slice(0, 3)
                .join(", ")} sections`,
              claimType: "QUALITY" as const,
            },
          ]
        : []),
    ],
    ontologyMappings: blueprint.ontologyMappings ?? [],
    ontologyUnmappedReason: blueprint.ontologyMappings?.length
      ? null
      : {
          zh: "截至当前来源版本未核验到可安全使用的精确本体标识；保留名称与来源，等待人工策展。",
          en: "No safely verified exact ontology identifier was available in the current source versions; names and sources are retained for manual curation.",
        },
    reportingStandards: (blueprint.reportingStandardIds ?? []).map((standardId) => ({
      standardId,
      version: standardId.replace(/_/g, " "),
      applicability: reportingApplicability[standardId] ?? {
        zh: "按该标准记录适用于本技术的最小信息。",
        en: "Record the minimum information from this standard that applies to the technique.",
      },
      requirementIds: reportingRequirements[standardId] ?? ["materials", "methods", "quality", "results"],
    })),
    resolutionExamples: {
      positive: [
        {
          query: blueprint.aliases[0] ?? blueprint.nameEn,
          context: `计划执行${blueprint.nameZh}并核对实验室资源。`,
          expectedCode: blueprint.code,
          excludedCode: null,
          reason: "The query uses a declared name or alias in an experimental context.",
        },
      ],
      negative: [
        {
          query: `${blueprint.categoryCode} related technique`,
          context: `描述只表达${blueprint.categoryCode}类别目的，未给出${blueprint.nameZh}的名称或别名。`,
          expectedCode: null,
          excludedCode: blueprint.code,
          reason: "A category-level goal without a leaf-technique name must not auto-select this technique.",
        },
      ],
    },
    reviewedAt: "2026-07-26T00:00:00.000Z",
    nextReviewDue: "2027-07-26T00:00:00.000Z",
  };

  return {
    ...contentWithoutHash,
    contentHash: createHash("sha256")
      .update(JSON.stringify(contentWithoutHash))
      .digest("hex"),
  };
}
