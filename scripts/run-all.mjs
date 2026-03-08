// Run all phases sequentially
console.log("╔══════════════════════════════════════╗");
console.log("║   NFT Airdrop Platform - Full Run    ║");
console.log("╚══════════════════════════════════════╝\n");

console.log("Phase 2A: Creating campaigns via SCA wallet...\n");
await import("./create-campaign.mjs");

console.log("\n\nPhase 2B: Executing airdrops via SCA wallet...\n");
await import("./airdrop.mjs");

console.log("\n\nPhase 2C: Checking on-chain status...\n");
await import("./check-status.mjs");

console.log("\n\nPhase 2D: Setting up event monitor...\n");
await import("./monitor-events.mjs");

console.log("\n╔══════════════════════════════════════╗");
console.log("║          All phases complete!         ║");
console.log("╚══════════════════════════════════════╝");
