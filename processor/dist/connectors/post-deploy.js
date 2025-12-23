"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function runPostDeployScripts() {
    try {
        const properties = new Map(Object.entries(process.env));
    }
    catch (error) {
        if (error instanceof Error) {
            process.stderr.write(`Post-deploy failed: ${error.message}\n`);
        }
        process.exitCode = 1;
    }
}
(async () => {
    await runPostDeployScripts();
})();
