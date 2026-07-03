/**
 * Run a command attached directly to the real terminal (inherited stdio), for
 * interactive sessions like `docker compose exec … sh`. The caller is expected
 * to have released the TTY (e.g. unmounted Ink) first. Resolves with the exit code.
 */
export async function runInteractive(cmd: string[], cwd: string): Promise<number> {
    const proc = Bun.spawn(cmd, {
        cwd,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
        env: process.env,
    });
    return await proc.exited;
}
