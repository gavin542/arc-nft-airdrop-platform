// Execute airdrops via Circle SCA wallet
import { run, PLATFORM, ARCNFT, ARCMULTITOKEN, walletAddress, castWallet, wallet1, wallet2 } from "./config.mjs";

console.log("=== Executing Airdrops via SCA Wallet ===\n");

// First, mint some NFTs directly (extra interactions)
await run("Mint ERC-721 to SCA wallet", ARCNFT, "mint(address)", [walletAddress]);
await run("Mint ERC-721 to Cast wallet", ARCNFT, "mint(address)", [castWallet]);
await run("Mint ERC-1155 (tokenId=2) to SCA wallet", ARCMULTITOKEN, "mint(address,uint256,uint256)", [walletAddress, "2", "100"]);
await run("Mint ERC-1155 (tokenId=3) to SCA wallet", ARCMULTITOKEN, "mint(address,uint256,uint256)", [walletAddress, "3", "50"]);

// Airdrop via Platform contract (campaigns created by SCA wallet)
// Note: These campaigns (2,3,4) were created by SCA wallet in create-campaign.mjs
await run(
  "Airdrop ERC-721 Campaign#2 to W1+W2",
  PLATFORM,
  "airdropERC721(uint256,address[])",
  ["2", [wallet1, wallet2]]
);

await run(
  "Airdrop ERC-1155 Campaign#3 to W1+W2+Cast",
  PLATFORM,
  "airdropERC1155(uint256,address[])",
  ["3", [wallet1, wallet2, castWallet]]
);

await run(
  "Airdrop ERC-721 Campaign#4 to Cast+W1",
  PLATFORM,
  "airdropERC721(uint256,address[])",
  ["4", [castWallet, wallet1]]
);

// Close one campaign
await run("Close Campaign#2", PLATFORM, "closeCampaign(uint256)", ["2"]);

console.log("\n=== All airdrops executed! ===");
