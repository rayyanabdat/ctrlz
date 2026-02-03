import { PublicClient } from "viem";

export interface TokenIdentity {
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  isNonStandard: boolean;
  hasCode: boolean;
}

// Function selectors
const SELECTORS = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567"
};

export async function getTokenIdentity(
  client: PublicClient,
  tokenAddress: string
): Promise<TokenIdentity> {
  const result: TokenIdentity = {
    name: null,
    symbol: null,
    decimals: null,
    isNonStandard: false,
    hasCode: false
  };

  // First check if contract has code
  try {
    const code = await client.getCode({ address: tokenAddress as `0x${string}` });
    result.hasCode = code !== undefined && code !== "0x" && code.length > 2;
  } catch {
    result.hasCode = false;
  }

  if (!result.hasCode) {
    result.isNonStandard = true;
    return result;
  }

  // Get name
  result.name = await fetchStringProperty(client, tokenAddress, SELECTORS.name);
  
  // Get symbol
  result.symbol = await fetchStringProperty(client, tokenAddress, SELECTORS.symbol);
  
  // Get decimals
  result.decimals = await fetchDecimals(client, tokenAddress);

  // Mark as non-standard if basic functions missing
  if (!result.name && !result.symbol) {
    result.isNonStandard = true;
  }

  return result;
}

async function fetchStringProperty(
  client: PublicClient,
  address: string,
  selector: string
): Promise<string | null> {
  // Try standard string return
  try {
    const response = await client.call({
      to: address as `0x${string}`,
      data: selector as `0x${string}`
    });

    if (response.data && response.data.length > 2) {
      const decoded = decodeStringResponse(response.data);
      if (decoded && decoded.trim().length > 0) {
        return decoded.trim();
      }
    }
  } catch {
    // Continue to fallback
  }

  // Try bytes32 return (legacy tokens)
  try {
    const response = await client.call({
      to: address as `0x${string}`,
      data: selector as `0x${string}`
    });

    if (response.data && response.data.length >= 66) {
      const decoded = decodeBytes32(response.data);
      if (decoded && decoded.trim().length > 0) {
        return decoded.trim();
      }
    }
  } catch {
    // Property not available
  }

  return null;
}

async function fetchDecimals(
  client: PublicClient,
  address: string
): Promise<number | null> {
  try {
    const response = await client.call({
      to: address as `0x${string}`,
      data: SELECTORS.decimals as `0x${string}`
    });

    if (response.data && response.data.length >= 66) {
      // Decimals is uint8, but returned as uint256
      const hex = response.data.slice(-2);
      const value = parseInt(hex, 16);
      if (!isNaN(value) && value >= 0 && value <= 77) {
        return value;
      }
      
      // Try last 64 chars
      const fullHex = response.data.slice(-64);
      const fullValue = parseInt(fullHex, 16);
      if (!isNaN(fullValue) && fullValue >= 0 && fullValue <= 77) {
        return fullValue;
      }
    }
  } catch {
    // Decimals not available
  }

  return null;
}

function decodeStringResponse(data: string): string | null {
  if (!data || data === "0x" || data.length < 66) return null;

  try {
    // Remove 0x prefix
    const hex = data.slice(2);
    
    // Standard ABI-encoded string:
    // First 32 bytes (64 chars): offset to string data
    // Next 32 bytes: string length
    // Following: string data
    
    if (hex.length >= 128) {
      const offset = parseInt(hex.slice(0, 64), 16) * 2;
      if (offset < hex.length) {
        const lengthStart = offset;
        const length = parseInt(hex.slice(lengthStart, lengthStart + 64), 16);
        
        if (length > 0 && length < 1000) {
          const dataStart = lengthStart + 64;
          const stringHex = hex.slice(dataStart, dataStart + length * 2);
          return hexToUtf8(stringHex);
        }
      }
    }
    
    // Fallback: try to decode as raw bytes32
    return decodeBytes32(data);
  } catch {
    return null;
  }
}

function decodeBytes32(data: string): string | null {
  if (!data || data === "0x") return null;
  
  try {
    // Remove 0x and take first 64 chars (32 bytes)
    const hex = data.slice(2, 66).replace(/00+$/, "");
    return hexToUtf8(hex);
  } catch {
    return null;
  }
}

function hexToUtf8(hex: string): string {
  if (!hex || hex.length === 0) return "";
  
  // Ensure even length
  if (hex.length % 2 !== 0) hex = "0" + hex;
  
  let str = "";
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (byte > 0 && byte < 128) { // Printable ASCII
      str += String.fromCharCode(byte);
    }
  }
  return str;
}
