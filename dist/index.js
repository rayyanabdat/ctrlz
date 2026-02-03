import { getChain } from "./config/chains.js";
import { scanEvmContract } from "./engine/evm.js";
import { logHeader, logError } from "./utils/logger.js";
export async function main(contractAddress, chainName = "ethereum") {
    try {
        logHeader();
        const chain = getChain(chainName);
        await scanEvmContract(contractAddress, chain.key);
    }
    catch (error) {
        logError(error instanceof Error ? error.message : "Unknown error");
        process.exit(1);
    }
}
//# sourceMappingURL=index.js.map