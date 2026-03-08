// Set up Circle event monitor for the Platform contract
import { client, PLATFORM } from "./config.mjs";

console.log("=== Setting up Event Monitor ===\n");

try {
  const monitor = await client.createEventMonitor({
    subscriptions: [
      {
        address: PLATFORM,
        blockchain: "ARC-TESTNET",
        eventType: "OUTBOUND",
      },
    ],
  });
  console.log("Monitor created:", JSON.stringify(monitor.data, null, 2));
} catch (e) {
  console.error("Failed to create monitor:", e?.response?.data || e?.message);
}

// List existing monitors
try {
  const monitors = await client.listEventMonitors();
  console.log("\nAll monitors:", JSON.stringify(monitors.data, null, 2));
} catch (e) {
  console.error("Failed to list monitors:", e?.response?.data || e?.message);
}

// List recent event logs
try {
  const logs = await client.listEventLogs();
  const items = logs.data?.eventLogs || [];
  console.log(`\nRecent events: ${items.length}`);
  for (const log of items.slice(0, 5)) {
    console.log(`  ${log.eventType} | ${log.blockchain} | ${log.contractAddress} | ${log.transactionHash}`);
  }
} catch (e) {
  console.error("Failed to list events:", e?.response?.data || e?.message);
}
