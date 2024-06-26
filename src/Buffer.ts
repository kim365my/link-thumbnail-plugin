import { Platform } from "obsidian";

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const gBuffer = (Platform.isMobileApp) ? require("buffer/index.ts"): global.Buffer;