import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

const messages: Record<string, { error: string; status: number }> = {
  UNAUTHORIZED: { error: "Unauthorized", status: 401 },
  NO_LAB_ACCESS: { error: "No lab access", status: 403 },
  ANIMAL_RACK_NOT_FOUND: { error: "没有找到该笼架。", status: 404 },
  ANIMAL_CAGE_NOT_FOUND: { error: "没有找到该笼位。", status: 404 },
  ANIMAL_MOUSE_NOT_FOUND: { error: "没有找到指定的小鼠记录。", status: 404 },
  CAGE_POSITION_OCCUPIED: { error: "该笼位已有在用笼牌。", status: 409 },
  CAGE_POSITION_OUTSIDE_RACK: { error: "所选笼位超出笼架范围。", status: 422 },
  RACK_RESIZE_CONFLICT: { error: "缩小笼架前，请先清理范围外仍在用的笼位。", status: 409 },
  ANIMAL_CAGE_CLOSED: { error: "该笼牌已关闭，不能继续更新。", status: 409 },
  NO_ACTIVE_MICE: { error: "所选范围内没有在笼小鼠。", status: 422 },
  NO_ACTIVE_CAGES: { error: "所选范围内没有可入驻的在用笼牌。", status: 422 },
  INVALID_DATE: { error: "日期格式无效。", status: 400 },
};

export function animalErrorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
    return NextResponse.json(
      { error: "动物管理数据表尚未创建。请执行数据库迁移后重试。", code: "ANIMAL_MIGRATION_REQUIRED" },
      { status: 503 },
    );
  }
  if (
    error instanceof Prisma.PrismaClientValidationError ||
    code.includes("Cannot read properties of undefined")
  ) {
    return NextResponse.json(
      { error: "服务端 Prisma Client 尚未更新，请重启开发服务器后重试。", code: "PRISMA_CLIENT_OUTDATED" },
      { status: 503 },
    );
  }
  const mapped = messages[code];
  return mapped ? NextResponse.json({ error: mapped.error, code }, { status: mapped.status }) : null;
}
