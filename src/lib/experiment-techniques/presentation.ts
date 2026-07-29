/**
 * 将技术目录中的简写用途说明改为便于阅读的完整句，不改变原有事实。
 */
export function toPlainLanguageTechniqueScope(scope: string): string {
  const clauses = scope
    .trim()
    .split("；")
    .map((clause) => clause.trim())
    .filter(Boolean);

  return clauses
    .map((clause, index) => {
      if (index === 0) {
        if (clause.startsWith("适用于")) return `这项实验适合用于${clause.slice(3)}`.replace(/须/g, "需要");
        if (clause.startsWith("用于")) return `这项实验可用于${clause.slice(2)}`.replace(/须/g, "需要");
        if (clause.startsWith("可用于")) return `这项实验可用于${clause.slice(3)}`.replace(/须/g, "需要");
        return clause.replace(/须/g, "需要");
      }

      if (clause.startsWith("需")) return `还需要${clause.slice(1)}`;
      if (clause.startsWith("应")) return `还应${clause.slice(1)}`;
      if (clause.startsWith("必须")) return `还必须${clause.slice(2)}`;
      if (clause.startsWith("不适用于")) return `这项实验不适用于${clause.slice(4)}`.replace(/须/g, "需要");
      if (clause.startsWith("不用于")) return `这项实验不用于${clause.slice(3)}`.replace(/须/g, "需要");
      return clause.replace(/须/g, "需要");
    })
    .join("。");
}
