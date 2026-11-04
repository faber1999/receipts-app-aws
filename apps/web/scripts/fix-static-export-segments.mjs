// Works around a Next.js static-export bug on Windows.
//
// For each page, `next build` with `output: 'export'` writes the client router's segment
// prefetch files as flat names such as `expenses/__next.expenses.__PAGE__.txt`. It builds that
// name by replacing "/" with "." in the segment path, but on Windows the path uses "\", so the
// export writes nested folders (`expenses/__next.expenses/__PAGE__.txt`) instead. The router
// then requests the flat name and gets a 404 (navigation still works, prefetching doesn't).
//
// This script flattens those folders back into the expected file names. On Linux/macOS the
// export is already correct and there is nothing to fix, so it's a no-op.
//
// Upstream: https://github.com/vercel/next.js/issues/85374 (fix proposed in PR #92340).
// Delete this script once a Next.js release includes the fix.
import { readdir, rename, rm, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const OUT_DIR = new URL('../out', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** Lists every file under a directory, recursively. */
async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return nested.flat();
}

/** Flattens every `__next.*` folder found directly inside `directory`. Returns how many files moved. */
async function flattenSegmentFolders(directory) {
  let moved = 0;
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const entryPath = join(directory, entry.name);

    if (!entry.name.startsWith('__next.')) {
      // A route folder (e.g. `expenses/`): its own segment folders live inside it.
      if (entry.name !== '_next') {
        moved += await flattenSegmentFolders(entryPath);
      }
      continue;
    }

    for (const file of await listFiles(entryPath)) {
      const flatName = `${entry.name}.${relative(entryPath, file).split(sep).join('.')}`;
      await rename(file, join(directory, flatName));
      moved += 1;
    }
    await rm(entryPath, { recursive: true });
  }

  return moved;
}

try {
  await stat(OUT_DIR);
} catch {
  console.error(`fix-static-export-segments: ${OUT_DIR} not found; run next build first.`);
  process.exit(1);
}

const moved = await flattenSegmentFolders(OUT_DIR);
console.log(
  moved > 0
    ? `fix-static-export-segments: flattened ${moved} segment prefetch file(s).`
    : 'fix-static-export-segments: nothing to fix.',
);
