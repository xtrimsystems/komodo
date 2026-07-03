# Komodo

A rich terminal UI for managing your local `docker compose` projects — like `claude code` or `vite`, but for Docker. It scans configured folders for `docker-compose.(yml|yaml)` (with `Dockerfile` as a fallback), correlates them with live containers via the Docker Engine API, and lets you start/stop projects and run their `make` targets from a keyboard-driven TUI.

Built with **TypeScript + [Ink](https://github.com/vadimdemedes/ink)** (React for the terminal), runs on **[bun](https://bun.sh)**, and ships as a single self-contained binary.

The welcome banner is a pixel-art **komodo dragon** rendered in truecolor half-blocks, shown atop the list screen (falls back to a compact one-line header on short terminals). Preview it with `make komodo` (full) or `make komodo-small` (banner size). The sprite is drawn from shapes by `scripts/komodo_gen.py` and embedded into the app as `src/ui/komodoSprite.ts`.

## What it does

- **Discovers projects** across the folders you configure (added on first run via the setup screen — nothing is assumed). A directory is a project if it has a compose file or a `Dockerfile` at its top level.
- **Live status** — reads the Docker socket (`/var/run/docker.sock`) and correlates running containers back to projects via the `com.docker.compose.project.working_dir` / `project` labels. Shows `running` / `partial` / `stopped` plus a running/total service count. Updates instantly via the Docker **events stream** (with a slow safety poll and automatic fallback to polling if the stream drops).
- **Start / stop** — `s` / `x` / `d` / `e` run `docker compose up -d` / `stop` / `down` / `restart` inside the project dir, using compose's default file resolution (base + `docker-compose.override.yml`) — the same thing your project's own `make up` does.
- **Make palette** — `m` opens a **fuzzy-searchable** list of the project's `make` targets (the `## `-annotated "public" ones first), so bespoke setups (DB rebuilds, `init`, `xon`, etc.) are one keypress away without the Start button triggering them by surprise.
- **Live logs** — `l` opens a streaming `docker compose logs -f` pane for the project (or a single service, from the detail screen).
- **Shell in** — `S` suspends the TUI and drops you into an interactive shell inside a running service (`docker compose exec … bash||sh`); exit the shell and komodo resumes exactly where you left off.
- **Fuzzy filter** — `/` filters the project list as you type.
- **Favorites & folder groups** — `f` pins a project to a `★ Favorites` section at the top; the rest are grouped under their parent folder (`work`, `Projects`, …), each an underlined header. Favorites persist in the config file.

## Screens

komodo is screen-based rather than cramming everything into one view:

- **List** — all projects with status, grouped into `★ Favorites` and per-folder sections; the home screen.
- **Detail** (`⏎`) — one project's services/containers with their live status, plus an action output log; pick a service with `↑↓` for service-scoped logs/shell.
- **Logs** (`l`) — full-screen streaming logs.

The whole UI is height-budgeted to the terminal and clips instead of overflowing, so panels never paint on top of each other.

## Requirements

- [bun](https://bun.sh) — only needed to build from source; the prebuilt binary (via the installer below) needs nothing.
- Docker with a reachable socket, and your user in the `docker` group.

## Install

### Quick install (prebuilt binary)

No toolchain required — this downloads the binary for your OS/arch, verifies its checksum, and drops it in `~/.local/bin`:

```sh
curl -fsSL https://raw.githubusercontent.com/xtrimsystems/komodo/main/install.sh | sh
```

- System-wide instead: prefix with `PREFIX=/usr/local` (may need `sudo`).
- Pin a version: `KOMODO_VERSION=v0.1.0`.
- If `~/.local/bin` isn't on your `PATH`, the script prints the line to add.

Once installed, update in place with `komodo --update` — or press `U` on the in-app hint. komodo checks for new releases in the background (once a day) and hints when one is available; set `KOMODO_NO_UPDATE=1` to disable that check.

### From source

Requires [bun](https://bun.sh). Clone, then build and install a standalone binary onto your `PATH`:

```sh
git clone https://github.com/xtrimsystems/komodo.git
cd komodo
make install
```

Use `make install-bin` instead to symlink `dist/komodo` into `~/.local/bin` (handy while hacking — a fresh `make build` is picked up live). Add `PREFIX=/usr/local` for a system-wide copy.

## Usage

```sh
make deps           # bun install (dependencies)
make dev            # run the TUI in dev mode
make list           # print discovered projects + status (no TUI) — good for scripts
make build          # compile a self-contained binary to dist/komodo
make install        # build + install a standalone binary onto your PATH (~/.local/bin)
make install-bin    # dev install: symlink dist/komodo into ~/.local/bin (live rebuilds)
make uninstall      # remove the installed binary
```

Once installed on your `PATH`:

```sh
komodo                 # launch the TUI
komodo --list          # headless table of projects + status
komodo --json          # same, as JSON
komodo --version       # tool + docker engine version
komodo --config        # print config path + current config
komodo --check-update  # check whether a newer release exists
komodo --update        # download + swap in the latest release
```

## Releasing

Releases are cut by CI, not by hand — you never run `git tag`:

1. Bump `VERSION` in `src/version.ts`.
2. Commit and push to `main`.

The release workflow runs the tests; **only if they pass** and that version has no tag yet does it create the `vX.Y.Z` tag, cross-compile the binaries, and publish the GitHub Release. A failing test suite therefore can't produce a tag or ship a binary to `komodo --update`.

## Keybindings

**List screen**

| Key | Action |
| --- | --- |
| `↑` `↓` / `k` `j` | Move selection |
| `g` / `G` | Jump to first / last |
| `⏎` | Open project detail |
| `s` `x` `d` `e` | compose `up -d` / `stop` / `down` / `restart` |
| `l` | Stream logs (whole project) |
| `S` | Shell into a running service |
| `f` | Toggle favorite (pins to the `★ Favorites` section) |
| `m` | Open the `make` target palette |
| `/` | Fuzzy-filter the list |
| `esc` | Clear an applied filter |
| `,` | Open the folders/settings screen |
| `r` / `R` | Refresh status / rescan folders |
| `q` / `Ctrl-C` | Quit |

**Detail screen** — `↑↓` pick a service · `s/x/d/e` project actions · `l` logs (selected service) · `S` shell (selected service) · `m` make · `esc` back.

**Logs screen** — `c` clear · `esc` back.

**Make palette / filter** — type to fuzzy-filter · `↑↓` select · `⏎` run/apply · `esc` cancel.

## Configuration

**First run** opens a setup screen (no config file yet) with an empty folder list — `a` to add a folder (opens an interactive directory browser), `d` to remove, then `esc` to finish. That writes `~/.config/komodo/config.json`. Open the same screen anytime with `,` to change folders later; edits persist immediately and trigger a rescan. To re-trigger the first-run setup, delete the config file.

In the **add-folder browser**: `↑↓` move · `⏎`/`→` open a folder · `←` up a level · `.` toggle hidden · `a`/`space` add the **highlighted** folder as a scan root (on the `..` row it adds the current folder) · `esc` done. The browser stays open after adding so you can add several folders in one pass. Folders containing a compose file or Dockerfile are flagged `· project`, and ones already configured show `· added`.

The file looks like:

```json
{
    "roots": ["/home/you/Projects", "/home/you/work"],
    "scanDepth": 2,
    "dockerSocket": "/var/run/docker.sock",
    "refreshMs": 2000,
    "favorites": []
}
```

- `roots` — folders to scan (empty until you add some in the setup screen). Each becomes a group header (its basename) in the list.
- `scanDepth` — how many levels below each root to search for project dirs (a dir stops being descended into once it's identified as a project).
- `dockerSocket` — override if you use a non-default socket (also respects `DOCKER_HOST=unix://…`).
- `refreshMs` — status poll interval (safety net; live updates come from the events stream).
- `favorites` — absolute project dirs pinned to the top; managed with `f` in the UI, but editable here too.

## Design notes

- **Compose-first, make-aware.** Start/Stop use plain `docker compose` for predictability (no surprise DB rebuilds); the richer per-project `make` targets live in the palette. This suits repos where nearly every project pairs a compose file with a `Makefile` wrapping it.
- **No Docker SDK dependency.** Status uses bun's native `fetch({ unix })` straight against the Engine API — both the container list and the `/events` stream.
- **Screen-based, height-budgeted layout.** The root is clamped to the terminal height with `overflow: hidden`; each screen renders exactly `rows` lines so frames overwrite cleanly and panels never overlap.
- **Interactive shell via suspend/resume.** `S` unmounts Ink to hand the real TTY to `docker compose exec`, then re-mounts and restores the selected project afterwards.
- **Bundling quirk.** Ink imports `react-devtools-core` (only when `DEV=true`). It isn't shipped, so `src/stubs/react-devtools-core.ts` aliases it via `tsconfig` `paths` to keep the compiled binary self-contained.

## Project layout

```
src/
  cli.tsx              entry: headless flags (--list/--json/--version/--config) or the TUI loop
  config.ts            load/create ~/.config/komodo/config.json
  discovery/
    scan.ts            walk roots -> Project[]
    parseCompose.ts    compose YAML -> services + project name
    parseMakefile.ts   Makefile -> targets + `## help`
  docker/
    engine.ts          Engine API over the unix socket: container list + events stream
    run.ts             streaming child-process runner
    interactive.ts     inherited-stdio runner for shell suspend/resume
    actions.ts         compose up/stop/down/restart/logs, exec, make target
  model/
    types.ts           shared types
    state.ts           reconcile(...) -> ProjectView[] + serviceRows()
  ui/
    App.tsx            state machine, input routing, effects
    ListScreen.tsx     grouped project list + filter line
    DetailScreen.tsx   services + action output for one project
    LogsScreen.tsx     streaming log tail
    PaletteScreen.tsx  fuzzy make-target palette
    WelcomeBanner.tsx  komodo dragon banner (list home)
    komodoArt.ts       renders the sprite as truecolor half-blocks
    komodoSprite.ts    embedded sprite data (generated)
    SettingsScreen.tsx first-run / folders editor
    BrowseScreen.tsx   interactive directory picker
    sections.ts        favorites + per-root grouping
    components.tsx     Header / Divider / Footer / Key
    filter.ts          fuzzy subsequence scorer
    theme.ts           status glyphs + colors
```

## Roadmap ideas

- Scrollback / search within the logs pane (currently auto-tails).
- Multi-select to start/stop several projects at once.
- Per-project custom start command override in config.
- Docker events surfaced as a toast/activity line.
