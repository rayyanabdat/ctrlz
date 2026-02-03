import { scanEvmContract } from "./engine/evm.js";
import { getSupportedChains } from "./config/chains.js";
import chalk from "chalk";
import inquirer from "inquirer";

// ASCII Banner
function printBanner() {
  console.log(chalk.cyan(`
   █████████   █████              ████              ███████████
  ███░░░░░███ ░░███              ░░███      ███    ░█░░░░░░███ 
 ███     ░░░  ███████   ████████  ░███     ░███    ░     ███░  
░███         ░░░███░   ░░███░░███ ░███  ███████████     ███    
░███           ░███     ░███ ░░░  ░███ ░░░░░███░░░     ███     
░░███     ███  ░███ ███ ░███      ░███     ░███      ████     █
 ░░█████████   ░░█████  █████     █████    ░░░      ███████████
  ░░░░░░░░░     ░░░░░  ░░░░░     ░░░░░             ░░░░░░░░░░░ 
  `));
  console.log(chalk.gray("Ctrl+Z — On-chain Risk Scanner"));
  console.log(chalk.gray("Made with passion by gogetrekt"));
  console.log("");
}

async function main() {
  printBanner();

  const args = process.argv.slice(2);

  // Show help
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: ctrlz [contractAddress] [--chain <chainKey>] [chainKey]");
    console.log("");
    console.log("Arguments:");
    console.log("  <contractAddress>  EVM contract address (0x...)");
    console.log("");
    console.log("Options:");
    console.log(`  --chain <key>      Chain key (default: ethereum)`);
    console.log(`                     Supported: ${getSupportedChains().join(", ")}`);
    console.log("");
    console.log("Examples:");
    console.log("  ctrlz 0x1234... ");
    console.log("  ctrlz 0x1234... --chain base");
    console.log("  ctrlz 0x1234... base");
    process.exit(0);
  }

  // Parse CLI arguments first
  let contractAddress: string | null = null;
  let rawChain: unknown = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    // Handle --chain flag
    if (arg === "--chain" && i + 1 < args.length) {
      rawChain = args[i + 1];
      i++; // Skip next arg
      continue;
    }
    
    // Skip flags
    if (typeof arg === "string" && arg.startsWith("--")) {
      continue;
    }
    
    // First positional = contract address
    if (!contractAddress && typeof arg === "string" && arg.startsWith("0x")) {
      contractAddress = arg;
      continue;
    }
    
    // Second positional = chain (if not already set via flag)
    if (contractAddress && !rawChain && typeof arg === "string") {
      rawChain = arg;
      continue;
    }
  }

  // Interactive prompts if not provided via CLI
  if (!contractAddress) {
    const addressAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "address",
        message: "Enter contract address:",
        validate: (input: string) => {
          if (!input || !input.startsWith("0x")) {
            return "Please enter a valid contract address starting with 0x";
          }
          return true;
        }
      }
    ]);
    contractAddress = addressAnswer.address;
  }

  if (!rawChain) {
    const chainAnswer = await inquirer.prompt([
      {
        type: "list",
        name: "chain",
        message: "Select blockchain:",
        choices: [
          { name: "Ethereum", value: "ethereum" },
          { name: "Base", value: "base" },
          { name: "BSC", value: "bsc" }
        ]
      }
    ]);
    rawChain = chainAnswer.chain;
  }

  // Safe chain normalization
  const chainKey = String(rawChain ?? "ethereum").toLowerCase();

  // Validate chain key
  const supportedChains = getSupportedChains();
  if (!supportedChains.includes(chainKey)) {
    console.error(chalk.red(`Error: Chain '${chainKey}' not supported. Available: ${supportedChains.join(", ")}`));
    process.exit(1);
  }

  // Validate contract address
  if (!contractAddress) {
    console.error(chalk.red("Error: Contract address is required"));
    process.exit(1);
  }

  console.log(""); // Add spacing before scan results

  // Run scanner
  try {
    await scanEvmContract(contractAddress, chainKey);
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown error"}`));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(chalk.red(`Fatal error: ${error instanceof Error ? error.message : "Unknown error"}`));
  process.exit(1);
});
