import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import dotenv from "dotenv";
dotenv.config();

export const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

export const walletId = process.env.SCA_WALLET_ID;
export const walletAddress = process.env.SCA_WALLET_ADDRESS;
export const castWallet = process.env.CAST_WALLET;
export const wallet1 = process.env.WALLET1;
export const wallet2 = process.env.WALLET2;

export const ARCNFT = process.env.ARCNFT_ADDRESS;
export const ARCMULTITOKEN = process.env.ARCMULTITOKEN_ADDRESS;
export const PLATFORM = process.env.PLATFORM_ADDRESS;

export async function run(label, contractAddress, abiFunctionSignature, abiParameters) {
  console.log(`\n=== ${label} ===`);
  try {
    const tx = await client.createContractExecutionTransaction({
      walletId,
      contractAddress,
      abiFunctionSignature,
      abiParameters,
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });
    const state = tx.data?.state;
    const id = tx.data?.id;
    console.log(`  State: ${state}, TxID: ${id}`);
    if (state === "INITIATED" || state === "QUEUED") {
      console.log("  Waiting 8s for confirmation...");
      await new Promise(r => setTimeout(r, 8000));
    }
    return tx.data;
  } catch (e) {
    console.error(`  Failed:`, e?.response?.data || e?.message);
    return null;
  }
}
