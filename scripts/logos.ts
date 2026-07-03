// Preview the komodo logo in colour. Run with:  make logos
// Block/pixel style (█ ▀ ▄) — renders in any font.

const R = "\x1b[0m";
const B = "\x1b[1m";
const c = (n: number) => `\x1b[38;5;${n}m`;

const G = c(71); // komodo body (green)
const G2 = c(65); // darker green
const EYE = c(226); // yellow
const TONGUE = c(197); // red
const NAME = c(51);
const GREY = c(244);
const TOOL = c(220);

function head(t: string) {
    console.log(`\n${B}${GREY}── ${t} ${"─".repeat(34 - t.length)}${R}`);
}

// Komodo dragon, facing right.
function komodo() {
    console.log(G + "                       ▄▄▄▄▄" + R);
    console.log(G + "    ▄▄            ▄▄████████████▄" + R);
    console.log(G + "  ▄█████▄▄▄▄▄▄▄▄███████████████████▄" + R);
    console.log(
        G + " ██████████████████████████" + EYE + "█" + G + "████ ██" + R + "  " + TONGUE + "~=<" + R,
    );
    console.log(G + "  ▀██████████████████████████████████▀" + R);
    console.log(G2 + "     ██   ██          ██   ██" + R);
    console.log(G2 + "     ▀▀   ▀▀          ▀▀   ▀▀" + R);
}

console.log(`${B}komodo — komodo dragon${R}`);
head("komodo");
komodo();

head("sample banner");
console.log(G + "                    ▄▄▄▄▄" + R);
console.log(G + "  ▄▄          ▄▄████████████▄" + R + `     ${B}${NAME}komodo${R}`);
console.log(G + "▄█████▄▄▄▄▄▄▄██████████████████▄" + R + `  ${GREY}docker · compose · make${R}`);
console.log(
    G + "████████████████████████" + EYE + "█" + G + "███ ██" + R + " " + TONGUE + "~=<" + R +
        `  ${GREY}engine 29.5.2 · 29 projects${R}`,
);
console.log(G + " ▀████████████████████████████████▀" + R);
console.log(G2 + "    ██   ██         ██   ██" + R);
console.log(G2 + "    ▀▀   ▀▀         ▀▀   ▀▀" + R);

head("make screen");
console.log(`  ${B}${TOOL}⚙${R}  ${B}Makefile${R}\n`);
