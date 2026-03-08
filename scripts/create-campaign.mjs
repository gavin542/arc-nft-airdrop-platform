// Create airdrop campaigns via Circle SCA wallet
import { run, PLATFORM, ARCNFT, ARCMULTITOKEN } from "./config.mjs";

console.log("=== Creating Airdrop Campaigns via SCA Wallet ===\n");
console.log(`Platform: ${PLATFORM}`);
console.log(`ArcNFT (ERC-721): ${ARCNFT}`);
console.log(`ArcMultiToken (ERC-1155): ${ARCMULTITOKEN}`);

// Campaign 2: ERC-721 (SCA wallet as creator)
await run(
  "Create ERC-721 Campaign: Early Supporter Badge",
  PLATFORM,
  "createERC721Campaign(string,address)",
  ["Early Supporter Badge", ARCNFT]
);

// Campaign 3: ERC-1155 (SCA wallet as creator)
await run(
  "Create ERC-1155 Campaign: Community Reward",
  PLATFORM,
  "createERC1155Campaign(string,address,uint256,uint256)",
  ["Community Reward", ARCMULTITOKEN, "2", "5"]
);

// Campaign 4: Another ERC-721
await run(
  "Create ERC-721 Campaign: Builder Pass",
  PLATFORM,
  "createERC721Campaign(string,address)",
  ["Builder Pass", ARCNFT]
);

console.log("\n=== All campaigns created! ===");
