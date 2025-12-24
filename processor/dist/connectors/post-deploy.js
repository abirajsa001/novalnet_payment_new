"use strict";

Object.defineProperty(exports, "__esModule", { value: true });

async function runPostDeployScripts() {
  // Connect requires this hook to NOT crash
  return { status: "OK" };
}

(async () => {
  try {
    await runPostDeployScripts();
  } catch (error) {
    // NEVER throw during publish
    process.stderr.write(
      `Post-deploy warning: ${error?.message ?? error}\n`
    );
  }
})();
