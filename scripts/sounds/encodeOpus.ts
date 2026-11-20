import { spawn } from "node:child_process";

export interface OpusOptions {
	sampleRate: number;
	channels: 1 | 2;
	bitrate: string;
}

export function encodeOpus(
	samples: Float32Array,
	file: string,
	options: OpusOptions,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const ffmpeg = spawn(
			"ffmpeg",
			[
				"-hide_banner",
				"-loglevel",
				"error",
				"-y",
				"-f",
				"f32le",
				"-ar",
				String(options.sampleRate),
				"-ac",
				String(options.channels),
				"-i",
				"pipe:0",
				"-c:a",
				"libopus",
				"-b:a",
				options.bitrate,
				"-vbr",
				"on",
				"-application",
				"audio",
				"-map_metadata",
				"-1",
				"-fflags",
				"+bitexact",
				"-flags:a",
				"+bitexact",
				file,
			],
			{ stdio: ["pipe", "inherit", "inherit"] },
		);
		ffmpeg.on("error", (error) =>
			reject(
				new Error(
					`Impossible de lancer ffmpeg (requis pour encoder les sons) : ${error.message}`,
				),
			),
		);
		ffmpeg.on("close", (code) =>
			code === 0
				? resolve()
				: reject(new Error(`ffmpeg a échoué (code ${code}) sur ${file}`)),
		);
		ffmpeg.stdin.end(
			Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength),
		);
	});
}
