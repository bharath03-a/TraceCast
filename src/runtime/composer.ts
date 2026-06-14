import { spawn } from "node:child_process";
import path from "node:path";

export type OutputFormat = "webm" | "mp4" | "gif";

export type ComposeOptions = {
  outputFormat: OutputFormat;
  outputDir: string;
  titleCard?: string;
  endCard?: string;
};

export type ComposeResult =
  | { ok: true; outputPath: string }
  | { ok: false; reason: "ffmpeg-not-found" | "ffmpeg-error"; message: string };

export async function composeBrowserVideo(
  videoPath: string,
  options: ComposeOptions
): Promise<ComposeResult> {
  if (options.outputFormat === "webm") {
    return { ok: true, outputPath: videoPath };
  }

  const available = await isFfmpegAvailable();
  if (!available) {
    console.warn(
      "TraceCast: ffmpeg not found — skipping video composition. Install ffmpeg to enable GIF/MP4 export."
    );
    return {
      ok: false,
      reason: "ffmpeg-not-found",
      message: "ffmpeg not found in PATH. Install with: brew install ffmpeg"
    };
  }

  // Title/end cards need the drawtext filter (libfreetype). Many ffmpeg builds
  // omit it — degrade gracefully by dropping the cards rather than failing the
  // whole export.
  const wantsCards = Boolean(options.titleCard || options.endCard);
  const drawtextAvailable = wantsCards ? await isFilterAvailable("drawtext") : false;
  if (wantsCards && !drawtextAvailable) {
    console.warn(
      "TraceCast: ffmpeg has no 'drawtext' filter — skipping title/end cards. " +
        "Install an ffmpeg built with libfreetype to enable them."
    );
  }

  const baseName = path.basename(videoPath, path.extname(videoPath));
  const ext = options.outputFormat === "gif" ? "gif" : "mp4";
  const outputPath = path.join(options.outputDir, `${baseName}.${ext}`);

  const result =
    options.outputFormat === "gif"
      ? await encodeGif(videoPath, outputPath, options, drawtextAvailable)
      : await encodeMp4(videoPath, outputPath, options, drawtextAvailable);

  return result;
}

export async function isFfmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

/** Check whether the installed ffmpeg exposes a given filter (e.g. drawtext). */
export async function isFilterAvailable(filterName: string): Promise<boolean> {
  return new Promise((resolve) => {
    let stdout = "";
    const proc = spawn("ffmpeg", ["-hide_banner", "-filters"], { stdio: ["ignore", "pipe", "ignore"] });
    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.on("error", () => resolve(false));
    proc.on("close", () => resolve(new RegExp(`\\b${filterName}\\b`, "u").test(stdout)));
  });
}

async function encodeMp4(
  inputPath: string,
  outputPath: string,
  options: ComposeOptions,
  drawtextAvailable: boolean
): Promise<ComposeResult> {
  const filters = buildVideoFilters(options, drawtextAvailable);
  const args = [
    "-y",
    "-i", inputPath,
    ...(filters.length > 0 ? ["-vf", filters.join(",")] : []),
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outputPath
  ];

  return runFfmpeg(args, outputPath);
}

async function encodeGif(
  inputPath: string,
  outputPath: string,
  options: ComposeOptions,
  drawtextAvailable: boolean
): Promise<ComposeResult> {
  // Two-pass GIF encoding for high quality output
  const palettePath = outputPath.replace(/\.gif$/, "-palette.png");
  const filters = buildVideoFilters(options, drawtextAvailable);
  const baseFilter = filters.length > 0 ? `${filters.join(",")},` : "";

  // Pass 1: generate palette
  const paletteArgs = [
    "-y",
    "-i", inputPath,
    "-vf", `${baseFilter}fps=15,scale=iw:-1:flags=lanczos,palettegen`,
    palettePath
  ];
  const paletteResult = await runFfmpeg(paletteArgs, palettePath);
  if (!paletteResult.ok) {
    return paletteResult;
  }

  // Pass 2: encode GIF using palette
  const gifArgs = [
    "-y",
    "-i", inputPath,
    "-i", palettePath,
    "-lavfi", `${baseFilter}fps=15,scale=iw:-1:flags=lanczos[x];[x][1:v]paletteuse`,
    outputPath
  ];
  return runFfmpeg(gifArgs, outputPath);
}

function buildVideoFilters(options: ComposeOptions, drawtextAvailable: boolean): string[] {
  const filters: string[] = [];

  // Skip card filters entirely when drawtext is unavailable.
  if (!drawtextAvailable) {
    return filters;
  }

  if (options.titleCard) {
    const escaped = options.titleCard.replace(/'/g, "\\'").replace(/:/g, "\\:");
    // Show title card for first 2 seconds: black box with white text centered
    filters.push(
      `drawtext=text='${escaped}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,0,2)':box=1:boxcolor=black@0.7:boxborderw=12`
    );
  }

  if (options.endCard) {
    const escaped = options.endCard.replace(/'/g, "\\'").replace(/:/g, "\\:");
    // Show end card for last 2 seconds
    filters.push(
      `drawtext=text='${escaped}':fontcolor=white:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2:enable='gte(t,duration-2)':box=1:boxcolor=black@0.7:boxborderw=10`
    );
  }

  return filters;
}

async function runFfmpeg(args: string[], outputPath: string): Promise<ComposeResult> {
  return new Promise((resolve) => {
    let stderr = "";
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      resolve({ ok: false, reason: "ffmpeg-error", message: err.message });
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true, outputPath });
      } else {
        resolve({
          ok: false,
          reason: "ffmpeg-error",
          message: `ffmpeg exited with code ${code}: ${stderr.slice(-500)}`
        });
      }
    });
  });
}
