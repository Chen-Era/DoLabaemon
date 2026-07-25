import { listRuntimeSkills } from "@/lib/skills/registry";

export function loadServerPublishedSkills() {
  return listRuntimeSkills();
}
