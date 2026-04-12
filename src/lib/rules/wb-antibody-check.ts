type AntibodyMetaLike = {
  role: "PRIMARY" | "SECONDARY";
  hostSpecies?: string | null;
  targetSpecies?: string | null;
};

export function checkWbAntibodyCompatibility(metaList: AntibodyMetaLike[]) {
  const primary = metaList.filter((x) => x.role === "PRIMARY");
  const secondary = metaList.filter((x) => x.role === "SECONDARY");
  const issues: string[] = [];

  for (const pri of primary) {
    const matched = secondary.some((sec) => {
      if (!sec.targetSpecies || !pri.hostSpecies) {
        return false;
      }
      return sec.targetSpecies.toLowerCase() === pri.hostSpecies.toLowerCase();
    });
    if (!matched) {
      issues.push(`No secondary antibody matches primary host species: ${pri.hostSpecies ?? "unknown"}`);
    }
  }
  return issues;
}
