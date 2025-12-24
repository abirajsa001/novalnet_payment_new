import dotenv from "dotenv";
dotenv.config();


async function runPostDeployScripts() {
  try {
    const properties = new Map(Object.entries(process.env));
  } catch (error) {
    if (error instanceof Error) {
      process.stderr.write(`Post-deploy failed: ${error.message}\n`);
    }
    process.exitCode = 1;
  }
}

(async () => {
  await runPostDeployScripts();
})();
