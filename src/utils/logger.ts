export function log(message: string): void {
  console.log(message);
}

export function logError(message: string): void {
  console.error(`Error: ${message}`);
}

export function logHeader(): void {
  log("Ctrl+Z — EVM Risk Scanner");
  log("------------------------");
}
