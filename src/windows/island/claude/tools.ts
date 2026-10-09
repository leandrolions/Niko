import type { CodingTool } from "../../../bridge/claudeCode";
import type { BrandId } from "../../../brands/Brand";
import { T } from "../../../i18n/ptBR";

export const BRAND_TOOL: Record<CodingTool, BrandId> = {
  claude: "claudecode",
  codex: "codex",
  copilot: "copilot",
  opencode: "opencode",
  antigravity: "antigravity",
  kimi: "kimi",
};

export const COLOR_TOOL: Record<CodingTool, string> = {
  claude: "#d97757",
  codex: "#7a9dff",
  copilot: "#a371f7",
  opencode: "#cfcfcf",
  antigravity: "#3186ff",
  kimi: "#5b8cff",
};

export function nameTool(tool: CodingTool | undefined): string {
  return T.ilha.claude.nomes[tool ?? "claude"] ?? tool ?? "";
}
