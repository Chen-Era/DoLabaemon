import { NextResponse } from "next/server";
import { z } from "zod";
import { getLlmClient } from "@/lib/llm/client";
import { getRuntimeLlmConfigForUser } from "@/lib/llm/runtime-config";
import { isDemoMode } from "@/lib/demo-mode";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";

const schema = z.object({
  labId: z.string().min(1),
  imageBase64: z.string().min(1),
  mimeType: z.string().min(1),
  lang: z.enum(["zh", "en"]).default("zh"),
});

function buildImagePrompt(lang: "zh" | "en") {
  if (lang === "en") {
    return "Convert the reagent list image into editable plain text. Preserve row order. Keep vendor, catalog number, host/species compatibility and note-like details when visible. Do not summarize.";
  }
  return "请把这张试剂清单图片转成可编辑纯文本，尽量保持原始行顺序，并保留厂家、货号、抗体宿主/适用种属兼容性及备注等细节。不要总结，只输出文本内容。";
}

function getVisionModel(config?: { visionModel?: string | null; model?: string | null }) {
  return config?.visionModel || config?.model || process.env.OPENAI_VISION_MODEL || process.env.OPENAI_IMAGE_MODEL || process.env.OPENAI_MODEL || "MiniMax-VL-01";
}

function isLikelyVisionRefusal(text: string) {
  const lowered = text.toLowerCase();
  return (
    lowered.includes("无法看到") ||
    lowered.includes("看不到") ||
    lowered.includes("请您上传图片") ||
    lowered.includes("i cannot see") ||
    lowered.includes("i can't see") ||
    lowered.includes("unable to view") ||
    lowered.includes("upload the image")
  );
}

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }

    if (!isDemoMode()) {
      await assertLabAccess(user.id, parsed.data.labId);
    }

    const llmConfig = await getRuntimeLlmConfigForUser(user.id);
    const client = getLlmClient({ apiKey: llmConfig.apiKey, baseURL: llmConfig.baseURL });
    const model = getVisionModel({ visionModel: llmConfig.visionModel, model: llmConfig.model });
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildImagePrompt(parsed.data.lang),
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${parsed.data.mimeType};base64,${parsed.data.imageBase64}`,
              },
            },
          ],
        },
      ],
      temperature: 0,
    });

    const text = response.choices[0]?.message?.content?.trim() || "";

    if (!text || isLikelyVisionRefusal(text)) {
      return NextResponse.json(
        {
          error: "当前图片识别模型未正确读取图片，请检查 `OPENAI_VISION_MODEL` 是否配置为支持视觉输入的模型。",
          code: "VISION_MODEL_UNAVAILABLE",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "NO_LAB_ACCESS") {
      return NextResponse.json({ error: "No lab access", code: "NO_LAB_ACCESS" }, { status: 403 });
    }
    console.error("[reagent-extract-image] request failed:", error);
    return NextResponse.json({ error: "Image extraction failed", code: "IMAGE_EXTRACTION_FAILED" }, { status: 500 });
  }
}
