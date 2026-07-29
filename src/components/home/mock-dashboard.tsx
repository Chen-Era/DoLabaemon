import {
  SidebarExperimentCheckIcon,
  SidebarLabsIcon,
  SidebarReagentsIcon,
} from "@/components/common/app-icons";
import { useLocale } from "@/components/common/locale-provider";
import styles from "./mock-dashboard.module.css";

type DashboardRow = {
  name: readonly [string, string];
  catalog: string;
  status: readonly [string, string];
  warning?: boolean;
};

const rows: readonly DashboardRow[] = [
  { name: ["Anti-GAPDH 兔单抗", "Anti-GAPDH rabbit monoclonal antibody"], catalog: "AB-1024", status: ["已确认", "Confirmed"] },
  { name: ["TRIzol 裂解液", "TRIzol lysis reagent"], catalog: "TR-208", status: ["已确认", "Confirmed"] },
  { name: ["SYBR Green Mix", "SYBR Green Mix"], catalog: "QP-5510", status: ["待确认", "Needs review"], warning: true },
] as const;

export function MockDashboard() {
  const { localize } = useLocale();

  return (
    <aside className={styles.dashboard} aria-label={localize("Dorlabaemon 工作区预览", "Dorlabaemon workspace preview")}>
      <header className={styles.windowBar}>
        <span className={styles.windowTitle}>{localize("Dorlabaemon · 试剂管理", "Dorlabaemon · Reagent management")}</span>
        <span className={styles.syncState}>{localize("已同步", "Synced")}</span>
      </header>

      <div className={styles.shell}>
        <nav className={styles.sidebar} aria-label={localize("工作区预览导航", "Workspace preview navigation")}>
          <span className={styles.productMark}>D</span>
          <span className={`${styles.navItem} ${styles.navItemActive}`}>
            <SidebarReagentsIcon />
            <span>{localize("试剂", "Reagents")}</span>
          </span>
          <span className={styles.navItem}>
            <SidebarExperimentCheckIcon />
            <span>{localize("检查", "Checks")}</span>
          </span>
          <span className={styles.navItem}>
            <SidebarLabsIcon />
            <span>{localize("实验室", "Labs")}</span>
          </span>
        </nav>

        <section className={styles.workspace}>
          <div className={styles.workspaceHeader}>
            <div>
              <p>{localize("试剂清单", "Reagent list")}</p>
              <h3>{localize("试剂库", "Reagent library")}</h3>
            </div>
            <span>{localize("本周更新", "Updated this week")}</span>
          </div>

          <div className={styles.metrics}>
            <div>
              <span>{localize("在库", "In stock")}</span>
              <strong>1,284</strong>
            </div>
            <div>
              <span>{localize("待确认", "Needs review")}</span>
              <strong>06</strong>
            </div>
            <div>
              <span>{localize("本周入库", "Added this week")}</span>
              <strong>12</strong>
            </div>
          </div>

          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>{localize("试剂", "Reagent")}</span>
              <span>{localize("货号", "Catalog no.")}</span>
              <span>{localize("状态", "Status")}</span>
            </div>
            {rows.map((row) => (
              <div key={row.catalog} className={styles.tableRow}>
                <span className={styles.reagentName}>{localize(row.name[0], row.name[1])}</span>
                <span className={styles.catalog}>{row.catalog}</span>
                <span className={`${styles.rowState} ${row.warning ? styles.rowWarning : ""}`}>{localize(row.status[0], row.status[1])}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
