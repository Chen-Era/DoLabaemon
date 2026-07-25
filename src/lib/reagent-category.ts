const reagentCategoryLabels: Record<string, string> = {
  ANTIBODY: "抗体",
  BUFFER: "缓冲液",
  KIT: "试剂盒",
  PRIMER: "引物",
  BIOLOGICAL: "生物制剂",
  CHEMICAL: "化学试剂",
  CONSUMABLE: "耗材",
  OTHER: "其他",
};

export function reagentCategoryLabel(category?: string | null) {
  if (!category) return "未分类";
  return reagentCategoryLabels[category] ?? category;
}
