// Token Radar's program: the sealed snapshot in, the ranked board, the
// dashboard and its dossier out.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json
//
// The grade runs this twice and both runs must write the same bytes, so the
// program reads no clock, no network and no random source: every number it
// writes comes from lib/model.ts, which scores each protocol from the
// snapshot's own figures alone, and every file is written in a fixed order
// from those same figures.
//
// What lands in the output directory:
//   board.json    the ranked board, one row per launch candidate
//   data.js       the same board, compact, for the dashboard page
//   dashboard/    the page itself, copied from this repository
//   screenshots/  the page's screenshots, copied from this repository
//   dossier.json  what buildDossier writes from dashboard/ and screenshots/
//
// Options: --input <snapshot.json> (default /input/snapshot.json),
// --output <dir> (default $MAKEFUN_OUTPUT_DIR, else /output).

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-board.ts';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import type { BoardRow, Snapshot } from './lib/model.ts';

const DEFAULT_INPUT = '/input/snapshot.json';
const DEFAULT_OUTPUT = '/output';
const DOSSIER_TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_MAX = 4;
const SCREENSHOT_MAX_BYTES = 512 * 1024;
const DASHBOARD_MAX_FILES = 400;
const DASHBOARD_MAX_BYTES = 4 * 1024 * 1024;

interface Options {
  input: string;
  output: string;
}

/** The command line's --input/--output, over the program's defaults. */
function readOptions(argv: string[]): Options {
  const options: Options = {
    input: DEFAULT_INPUT,
    output: process.env.MAKEFUN_OUTPUT_DIR ?? DEFAULT_OUTPUT,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--input' && i + 1 < argv.length) {
      options.input = argv[i + 1] as string;
      i++;
    } else if (arg === '--output' && i + 1 < argv.length) {
      options.output = argv[i + 1] as string;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node main.ts [--input <snapshot.json>] [--output <dir>]');
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return options;
}

/** Where this file lives: the repository root, whose dashboard/ and screenshots/ ship. */
function repoRoot(): string {
  return dirname(fileURLToPath(import.meta.url));
}

/** Refuse an output directory that would wipe the repository or the disk root. */
function guardOutput(output: string, repo: string): void {
  const out = resolve(output);
  if (out === resolve('/') || out === resolve(repo)) {
    throw new Error(`refusing to write the output into ${out}`);
  }
}

/** The snapshot, read and checked, from its file. */
function loadSnapshot(path: string): Snapshot {
  return parseSnapshot(readFileSync(path, 'utf8'));
}

/** Copy a whole directory tree, files only, in a fixed order. */
function copyTree(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

/** The dossier's caps: the gate's own limits, so a violation fails here, not on the server. */
function dossierCaps(): { text_max_bytes: number; screenshots: { max: number; max_bytes: number }; dashboard: { max_files: number; max_bytes: number } } {
  return {
    text_max_bytes: DOSSIER_TEXT_MAX_BYTES,
    screenshots: { max: SCREENSHOT_MAX, max_bytes: SCREENSHOT_MAX_BYTES },
    dashboard: { max_files: DASHBOARD_MAX_FILES, max_bytes: DASHBOARD_MAX_BYTES },
  };
}

/** The output, read back from disk: the board parses and still passes, and the dossier rebuilds byte for byte. */
function verifyWritten(output: string, board: BoardRow[], snapshot: Snapshot, dossier: Uint8Array): void {
  const parsed = JSON.parse(readFileSync(join(output, 'board.json'), 'utf8')) as { rows: BoardRow[] };
  if (!Array.isArray(parsed.rows) || parsed.rows.length !== board.length) {
    throw new Error('board.json on disk does not hold the board that was built');
  }
  const issue = boardIssue(parsed.rows, snapshot);
  if (issue !== null) throw new Error(`board.json on disk fails the gate: ${issue}`);
  const rebuilt = buildDossier(output, dossierCaps());
  if (!Buffer.from(rebuilt).equals(Buffer.from(dossier))) {
    throw new Error('dossier.json on disk is not what buildDossier writes from the output');
  }
}

function main(): void {
  const started = Date.now();
  const options = readOptions(process.argv.slice(2));
  const repo = repoRoot();
  const output = resolve(options.output);
  guardOutput(output, repo);

  const snapshot = loadSnapshot(options.input);
  const { board, radar } = buildRadar(snapshot);
  const issue = boardIssue(board, snapshot);
  if (issue !== null) throw new Error(`the board fails the gate: ${issue}`);

  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, 'board.json'), `${JSON.stringify({ rows: board }, null, 2)}\n`, 'utf8');
  writeFileSync(join(output, 'data.js'), dataScript(radar), 'utf8');
  copyTree(join(repo, 'dashboard'), join(output, 'dashboard'));
  copyTree(join(repo, 'screenshots'), join(output, 'screenshots'));
  const dossier = buildDossier(output, dossierCaps());
  writeFileSync(join(output, 'dossier.json'), dossier);

  verifyWritten(output, board, snapshot, dossier);
  console.log(
    `token-radar (${radar.model_version}): ${board.length} rows (${radar.watchlist_size} watchlist, ${radar.early_size} early), ` +
      `${radar.live_size} live-token set aside, dossier ${dossier.length} bytes in ${Date.now() - started} ms -> ${output}`,
  );
}

main();
