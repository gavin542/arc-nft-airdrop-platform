// Check campaign status by reading on-chain data via viem
import { createPublicClient, http } from "viem";
import dotenv from "dotenv";
dotenv.config();

const PLATFORM = process.env.PLATFORM_ADDRESS;
const RPC = process.env.RPC_URL;

const abi = [
  {
    name: "totalCampaigns",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getCampaign",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "campaignId", type: "uint256" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "name", type: "string" },
        { name: "nftContract", type: "address" },
        { name: "tokenType", type: "uint8" },
        { name: "erc1155TokenId", type: "uint256" },
        { name: "erc1155Amount", type: "uint256" },
        { name: "creator", type: "address" },
        { name: "totalAirdropped", type: "uint256" },
        { name: "active", type: "bool" },
      ],
    }],
  },
];

const publicClient = createPublicClient({ transport: http(RPC) });

const total = await publicClient.readContract({
  address: PLATFORM,
  abi,
  functionName: "totalCampaigns",
});

console.log(`=== NFT Airdrop Platform Status ===`);
console.log(`Platform: ${PLATFORM}`);
console.log(`Total Campaigns: ${total}\n`);

for (let i = 0; i < Number(total); i++) {
  const c = await publicClient.readContract({
    address: PLATFORM,
    abi,
    functionName: "getCampaign",
    args: [BigInt(i)],
  });
  const typeLabel = c.tokenType === 0 ? "ERC-721" : "ERC-1155";
  console.log(`--- Campaign #${i}: ${c.name} ---`);
  console.log(`  Type: ${typeLabel}`);
  console.log(`  NFT Contract: ${c.nftContract}`);
  if (c.tokenType === 1) {
    console.log(`  Token ID: ${c.erc1155TokenId}, Amount/recipient: ${c.erc1155Amount}`);
  }
  console.log(`  Creator: ${c.creator}`);
  console.log(`  Total Airdropped: ${c.totalAirdropped}`);
  console.log(`  Active: ${c.active}`);
  console.log();
}
