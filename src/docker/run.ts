export interface RunOptions {
    cwd: string;
    onLine?: (line: string) => void;
    signal?: AbortSignal;
}

export interface RunResult {
    code: number;
    ok: boolean;
}

/**
 * Spawn a command, streaming merged stdout+stderr line-by-line to `onLine`.
 * Resolves once the process exits.
 */
export async function runStreaming(cmd: string[], opts: RunOptions): Promise<RunResult> {
    const proc = Bun.spawn(cmd, {
        cwd: opts.cwd,
        stdout: "pipe",
        stderr: "pipe",
        env: process.env,
    });

    if (opts.signal) {
        opts.signal.addEventListener("abort", () => proc.kill(), { once: true });
    }

    const pump = async (stream: ReadableStream<Uint8Array>) => {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) opts.onLine?.(line);
        }
        if (buffer.length) opts.onLine?.(buffer);
    };

    await Promise.all([pump(proc.stdout as ReadableStream), pump(proc.stderr as ReadableStream)]);
    const code = await proc.exited;
    return { code, ok: code === 0 };
}
