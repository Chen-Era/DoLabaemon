export const LEGACY_REAGENT_UPLOADER_NAME = "历史记录（上传者未知）";

export type ReagentUploader = {
  id: string;
  name?: string | null;
  email?: string | null;
};

export function buildReagentUploadProvenance(uploader: ReagentUploader) {
  const uploadedByName = uploader.name?.trim() || uploader.email?.trim() || "未知用户";
  return {
    uploadedById: uploader.id,
    uploadedByName,
  };
}
