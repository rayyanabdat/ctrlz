#!/usr/bin/env node

import { scanEvmContract } from "./engine/evm.js";
import { getSupportedChains } from "./config/chains.js";
import chalk from "chalk";

// ASCII Banner
function printBanner() {
  console.log(chalk.blue(`
   █████████   █████              ████              ███████████
  ███░░░░░███ ░░███              ░░███      ███    ░█░░░░░░███ 
 ███     ░░░  ███████   ████████  ░███     ░███    ░     ███░  
░███         ░░░███░   ░░███░░███ ░███  ███████████     ███    
░███           ░███     ░███ ░░░  ░███ ░░░░░███░░░     ███     
░░███     ███  ░███ ███ ░███      ░███     ░███      ████     █
 ░░█████████   ░░█████  █████     █████    ░░░      ███████████
  ░░░░░░░░░     ░░░░░  ░░░░░     ░░░░░             ░░░░░░░░░░░ 
  `));
  console.log(chalk.blue.bold("Ctrl+Z — On-chain Risk Scanner"));
  console.log(chalk.blue("Made with passion by gogetrekt"));
  console.log("");
}

async function main() {
  printBanner();

  const args = process.argv.slice(2);

  // Show help
  if (args.includes("--help") || args.includes("-h")) {
    console.log(chalk.white("Usage: ") + chalk.cyan("ctrlz-cli [contractAddress] [--chain <chainKey>]"));
    console.log("");
    console.log(chalk.yellow("Modes:"));
    console.log(chalk.white("  Interactive    Run without arguments to enter interactive mode"));
    console.log(chalk.white("  One-shot       Provide contract address for immediate scan"));
    console.log("");
    console.log(chalk.yellow("Arguments:"));
    console.log(chalk.white("  <contractAddress>  EVM contract address (0x...)"));
    console.log("");
    console.log(chalk.yellow("Options:"));
    console.log(chalk.white(`  --chain <key>      Chain key (default: ethereum)`));
    console.log(chalk.gray(`                     Supported: ${getSupportedChains().join(", ")}`));
    console.log("");
    console.log(chalk.yellow("Examples:"));
    console.log(chalk.gray("  ctrlz-cli                          # Interactive mode"));
    console.log(chalk.gray("  ctrlz-cli 0x1234...                # One-shot scan"));
    console.log(chalk.gray("  ctrlz-cli 0x1234... --chain base   # One-shot with chain"));
    process.exit(0);
  }

  // Parse CLI arguments
  let contractAddress: string | null = null;
  let rawChain: unknown = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    // Handle --chain flag
    if (arg === "--chain" && i + 1 < args.length) {
      rawChain = args[i + 1];
      i++;
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

  // Interactive mode: no contract address provided
  if (!contractAddress) {
    const { default: inquirer } = await import("inquirer");

    const addressAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "address",
        message: chalk.cyan("Enter contract address:"),
        validate: (input: string) => {
          if (!input || !input.startsWith("0x")) {
            return chalk.red("Please enter a valid contract address starting with 0x");
          }
          return true;
        }
      }
    ]);
    contractAddress = addressAnswer.address;

    if (!rawChain) {
      const chainAnswer = await inquirer.prompt([
        {
          type: "list",
          name: "chain",
          message: chalk.cyan("Select blockchain:"),
          choices: [
            { name: chalk.white("Ethereum"), value: "ethereum" },
            { name: chalk.white("Base"), value: "base" },
            { name: chalk.white("BSC"), value: "bsc" }
          ]
        }
      ]);
      rawChain = chainAnswer.chain;
    }
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

  console.log("");

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
