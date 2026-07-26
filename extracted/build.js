/**
 * Build script for Local Pocket Reader
 * Bundles background scripts and generates source maps.
 *
 * Usage:
 *   node build.js          — production build (minified)
 *   node build.js --dev    — development build (unminified + source maps)
 */

const esbuild = require('esbuild');
const path = require('path');

const isDev = process.argv.includes('--dev');
const srcDir = __dirname;
const outDir = path.join(srcDir, 'dist');

async function build() {
  console.log(`Building Local Pocket Reader (${isDev ? 'development' : 'production'})...`);

  try {
    // Bundle background scripts into a single file
    // Each script is an IIFE that exposes globals, so we concatenate them
    await esbuild.build({
      entryPoints: [path.join(srcDir, 'background.js')],
      bundle: false, // Don't bundle — keep separate for manifest loading
      outdir: outDir,
      sourcemap: isDev,
      minify: !isDev,
      target: 'firefox140',
      logLevel: 'info',
    });

    // Build content scripts (self-contained, no external deps) in parallel
    const contentScripts = [
      'contentScript.js',
      'contentScriptGpt.js',
      'contentScriptClaude.js',
      'contentScriptSidebarAi.js',
      'contentScriptSidebarUi.js',
      'floatingButton.js',
      'floatingButtonFull.js',
      'gesture-matcher.js',
      'shortcutInterceptor.js',
      'pomodoroOverlay.js',
      'notesOverlay.js',
      'aiOverlay.js',
      'jarvisOverlay.js',
      'core/jarvisCore.js',
      'core/jarvisCacheCore.js',
    ];

    await Promise.all(contentScripts.map((script) => {
      const entry = path.join(srcDir, script);
      return esbuild.build({
        entryPoints: [entry],
        bundle: false,
        outdir: outDir,
        sourcemap: isDev,
        minify: !isDev,
        target: 'firefox140',
        logLevel: 'info',
      }).catch((e) => {
        // Some scripts may not exist, skip them
        if (e.message && e.message.includes('No such file')) {
          console.log(`  Skipping ${script} (not found)`);
        } else {
          throw e;
        }
      });
    }));

    console.log('Build complete!');
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

build();
