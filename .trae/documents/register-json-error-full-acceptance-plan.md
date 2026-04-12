# 注册 JSON 解析错误与全项目验收修复计划

## Summary
- 目标：修复注册时 `Failed to execute 'json' on 'Response': Unexpected end of JSON input`，并完成项目核心链路的完整验收与稳定性加固。
- 范围：覆盖注册、登录、实验室查询/邀请、试剂解析与确认入库、实验可行性判定、前端请求容错、后端错误返回一致性。
- 结果标准：前端不再因空响应/非 JSON 响应崩溃；关键 API 出错时统一返回结构化 JSON；核心流程可复测通过。

## Current State Analysis
- 已定位当前报错风险点：
  - 注册页直接 `await res.json()`，未做响应体与内容类型保护：`src/app/(auth)/register/page.tsx`。
  - 同类风险还存在于多个页面：`src/app/(dashboard)/experiment-check/page.tsx`、`src/components/reagent/reagent-form.tsx`、`src/app/(dashboard)/labs/page.tsx`。
- 已定位后端触发源之一：
  - `src/app/api/register/route.ts` 未使用 `try/catch` 包裹数据库操作，若 Prisma 抛异常会导致非预期响应（可能非 JSON 或空体），从而触发前端 `res.json()` 解析失败。
- 已确认其他 API 大部分已有异常兜底：
  - `src/app/api/labs/*`、`src/app/api/reagents/*`、`src/app/api/experiment/check/route.ts` 已有 `try/catch` 并返回 JSON。
- 已知非阻断告警（不直接导致本次注册异常）：
  - `middleware` 未来需迁移到 `proxy`（Next 16 提示）。

## Proposed Changes

### 1) 注册 API 异常统一化
- 文件：`src/app/api/register/route.ts`
- 修改：
  - 用 `try/catch` 包裹 `req.json()`、校验、Prisma 查询/写入。
  - 对可预期错误返回统一 JSON：`{ error: string, code?: string }`。
  - 对不可预期错误返回 `500` JSON，避免空体/HTML 响应泄漏到前端。
- Why：
  - 消除注册接口在异常路径下的非 JSON 返回，根治前端解析异常来源。

### 2) 前端统一安全解析响应
- 新增文件：`src/lib/http.ts`
- 新增能力：
  - `safeReadJson(response)`：先读 `response.text()`，空串返回 `null`，再 `try/catch` JSON.parse。
  - `requestJson`（可选）：统一封装 `fetch` + 状态码判断 + 错误信息归一化。
- Why：
  - 避免页面直接 `res.json()` 导致同类崩溃，形成全局可复用防线。

### 3) 替换高风险调用点
- 文件：
  - `src/app/(auth)/register/page.tsx`
  - `src/app/(dashboard)/experiment-check/page.tsx`
  - `src/components/reagent/reagent-form.tsx`
  - `src/app/(dashboard)/labs/page.tsx`
- 修改：
  - 将 `await res.json()` 改为安全解析工具。
  - 处理空响应、非 JSON、网络异常三类场景，给出用户可读错误文案。
  - 保持现有成功路径交互不变（注册成功提示、实验判定结果展示、邀请反馈等）。
- Why：
  - 完成“完整验收”里的前端稳定性加固，不只修一个页面。

### 4) 核心 API 错误格式对齐（轻量）
- 文件：
  - `src/app/api/reagents/parse/route.ts`
  - `src/app/api/reagents/confirm/route.ts`
  - `src/app/api/reagents/list/route.ts`
  - `src/app/api/labs/invite/route.ts`
  - `src/app/api/labs/my/route.ts`
  - `src/app/api/experiment/check/route.ts`
- 修改：
  - 统一错误字段为 `error`（保留现有行为），必要时补充 `code` 便于前端分支处理。
- Why：
  - 减少前端分支复杂度，方便后续持续验收与问题定位。

### 5) 完整验收清单执行
- 验收场景：
  - 注册成功（新邮箱）/注册失败（重复邮箱、非法 payload、数据库异常模拟）。
  - 登录成功/失败。
  - 拉取实验室列表、发邀请（权限不足/成功）。
  - 试剂解析、确认入库（含失败路径文案）。
  - 实验判定返回最低缺失、推荐缺失、前置提醒与兼容性提示。
- 验收方式：
  - 本地手工链路 + 构建校验：`npm run lint`、`npm run build`。
  - 必要时补充最小化日志，确保错误可定位但不泄露敏感信息。

## Assumptions & Decisions
- 本次以“稳定性修复”为主，不引入新业务功能、不调整现有数据模型。
- 不改动认证策略与路由结构，仅加强异常处理与前端容错。
- `middleware -> proxy` 迁移不纳入本次主修复，仅保留为后续兼容优化项。

## Verification Steps
- 静态检查：
  - `npm run lint` 无新增错误。
  - `npm run build` 通过。
- 功能回归：
  - 注册页不再出现 `Unexpected end of JSON input`。
  - 任一接口异常时，页面显示错误提示而非崩溃。
  - 关键页面（注册/实验室/试剂/实验判定）成功与失败路径均可达。
- 结果确认：
  - 提供修复摘要（改动文件 + 触发条件 + 验收结果）供最终确认。
