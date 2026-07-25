import { ExperimentIcon, LabsIcon, ReagentsIcon } from "@/components/common/app-icons";
import styles from "./mock-dashboard.module.css";

const rows = [
  { name: "Anti-GAPDH 兔单抗", catalog: "AB-1024", status: "已确认" },
  { name: "TRIzol 裂解液", catalog: "TR-208", status: "已确认" },
  { name: "SYBR Green Mix", catalog: "QP-5510", status: "待确认", warning: true },
];

export function MockDashboard() {
  return (
    <aside className={styles.dashboard} aria-label="Dorlabaemon 工作区预览">
      <header className={styles.windowBar}>
        <span className={styles.windowTitle}>Dorlabaemon · 试剂管理</span>
        <span className={styles.syncState}>已同步</span>
      </header>

      <div className={styles.shell}>
        <nav className={styles.sidebar} aria-label="工作区预览导航">
          <span className={styles.productMark}>D</span>
          <span className={`${styles.navItem} ${styles.navItemActive}`}>
            <ReagentsIcon />
            <span>试剂</span>
          </span>
          <span className={styles.navItem}>
            <ExperimentIcon />
            <span>检查</span>
          </span>
          <span className={styles.navItem}>
            <LabsIcon />
            <span>实验室</span>
          </span>
        </nav>

        <section className={styles.workspace}>
          <div className={styles.workspaceHeader}>
            <div>
              <p>试剂清单</p>
              <h3>试剂库</h3>
            </div>
            <span>本周更新</span>
          </div>

          <div className={styles.metrics}>
            <div>
              <span>在库</span>
              <strong>1,284</strong>
            </div>
            <div>
              <span>待确认</span>
              <strong>06</strong>
            </div>
            <div>
              <span>本周入库</span>
              <strong>12</strong>
            </div>
          </div>

          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>试剂</span>
              <span>货号</span>
              <span>状态</span>
            </div>
            {rows.map((row) => (
              <div key={row.catalog} className={styles.tableRow}>
                <span className={styles.reagentName}>{row.name}</span>
                <span className={styles.catalog}>{row.catalog}</span>
                <span className={`${styles.rowState} ${row.warning ? styles.rowWarning : ""}`}>{row.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
