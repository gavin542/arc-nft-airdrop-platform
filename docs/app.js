import { CONTRACTS } from "./contracts.js";

// ============ Config ============
const RPC = "https://rpc.testnet.arc.network";
const ARC_CHAIN_ID = "0x4cef52"; // 5042002
const ARC_CHAIN_CONFIG = {
  chainId: ARC_CHAIN_ID,
  chainName: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: [RPC],
  blockExplorerUrls: ["https://testnet.arcscan.circle.com"],
};

// Default deployed contracts
const DEFAULT_PLATFORM = "0x81eb0527141bdA04A19acd26d5da503aDc5a519A";
const DEFAULT_NFT721 = "0x1269b2a9a2d779B8D74997B2859BFB93E9c98Af1";
const DEFAULT_NFT1155 = "0x8c54E2e709ba7C6B60fD55a49E32086099389332";

// Platform ABI (only what we need)
const PLATFORM_ABI = [
  "function totalCampaigns() view returns (uint256)",
  "function getCampaign(uint256) view returns (tuple(string name, address nftContract, uint8 tokenType, uint256 erc1155TokenId, uint256 erc1155Amount, address creator, uint256 totalAirdropped, bool active))",
  "function createERC721Campaign(string,address) returns (uint256)",
  "function createERC1155Campaign(string,address,uint256,uint256) returns (uint256)",
  "function airdropERC721(uint256,address[])",
  "function airdropERC1155(uint256,address[])",
  "function closeCampaign(uint256)",
];

// ============ State ============
let provider = null;  // read-only
let signer = null;    // connected wallet
let userAddress = null;

// ============ Helpers ============
function log(boxId, msg, type = "info") {
  const box = document.getElementById(boxId);
  const span = document.createElement("div");
  span.className = `log-${type}`;
  span.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  box.appendChild(span);
  box.scrollTop = box.scrollHeight;
}

function txLog(msg, type = "info") { log("txLog", msg, type); }

function getPlatformAddress() {
  return document.getElementById("platformAddr").value.trim() || DEFAULT_PLATFORM;
}

// Minimal ethers-like helpers using raw JSON-RPC
async function ethCall(to, data) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
  });
  return (await res.json()).result;
}

// ABI encoding helpers
function selector(sig) {
  // Pre-computed selectors
  const map = {
    "totalCampaigns()": "0x02932f56",
    "getCampaign(uint256)": "0x5598f8cc",
    "createERC721Campaign(string,address)": "0xb51a3307",
    "createERC1155Campaign(string,address,uint256,uint256)": "0x16f18607",
    "airdropERC721(uint256,address[])": "0xe5b3cf2b",
    "airdropERC1155(uint256,address[])": "0x6e4e26a1",
    "closeCampaign(uint256)": "0xb0e1c1e1",
    "balanceOf(address)": "0x70a08231",
    "balanceOf(address,uint256)": "0x00fdd58e",
    "mint(address)": "0x6a627842",
    "mint(address,uint256,uint256)": "0x156e29f6",
  };
  return map[sig];
}

function pad32(hexOrNum) {
  const val = typeof hexOrNum === "string" && hexOrNum.startsWith("0x")
    ? hexOrNum.slice(2) : BigInt(hexOrNum).toString(16);
  return val.padStart(64, "0");
}

function encodeString(str) {
  const hex = Array.from(new TextEncoder().encode(str)).map(b => b.toString(16).padStart(2, "0")).join("");
  const len = pad32(str.length);
  const padded = hex.padEnd(Math.ceil(hex.length / 64) * 64, "0");
  return len + padded;
}

function encodeAddressArray(addrs) {
  let data = pad32(addrs.length);
  for (const a of addrs) data += pad32(a);
  return data;
}

function decodeUint(hex) { return BigInt("0x" + (hex.startsWith("0x") ? hex.slice(2) : hex)); }

function decodeString(hex, offset) {
  const strOffset = parseInt(hex.slice(offset, offset + 64), 16) * 2;
  const actualOffset = 2 + strOffset;
  const len = parseInt(hex.slice(actualOffset, actualOffset + 64), 16);
  const strHex = hex.slice(actualOffset + 64, actualOffset + 64 + len * 2);
  let str = "";
  for (let i = 0; i < strHex.length; i += 2) {
    str += String.fromCharCode(parseInt(strHex.slice(i, i + 2), 16));
  }
  return str;
}

function decodeAddress(hex, offset) { return "0x" + hex.slice(offset + 24, offset + 64); }
function decodeUintAt(hex, offset) { return BigInt("0x" + hex.slice(offset, offset + 64)); }
function decodeBool(hex, offset) { return hex.slice(offset, offset + 64).endsWith("1"); }

// ============ Wallet Connection ============
window.connectWallet = async function () {
  if (!window.ethereum) {
    alert("Please install MetaMask to use this platform.");
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    userAddress = accounts[0];

    // Switch to Arc Testnet
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_CHAIN_ID }] });
    } catch (switchErr) {
      if (switchErr.code === 4902) {
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [ARC_CHAIN_CONFIG] });
      }
    }

    document.getElementById("connectBtn").textContent = "Connected";
    document.getElementById("connectBtn").classList.add("connected");
    document.getElementById("walletInfo").textContent = userAddress.slice(0, 6) + "..." + userAddress.slice(-4);
    txLog(`Wallet connected: ${userAddress}`, "ok");
  } catch (e) {
    txLog(`Connection failed: ${e.message}`, "err");
  }
};

// ============ Send Transaction via MetaMask ============
async function sendTx(to, data, logBoxId, label) {
  if (!userAddress) { alert("Please connect wallet first."); return null; }
  log(logBoxId, `${label} - sending tx...`, "info");
  try {
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from: userAddress, to, data, gas: "0x4C4B40" }], // 5M gas limit
    });
    log(logBoxId, `${label} - tx sent: ${txHash}`, "ok");
    txLog(`${label}: ${txHash}`, "ok");

    // Wait for receipt
    log(logBoxId, "Waiting for confirmation...", "info");
    let receipt = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [txHash] }),
      });
      const json = await res.json();
      if (json.result) { receipt = json.result; break; }
    }

    if (receipt && receipt.status === "0x1") {
      log(logBoxId, `Confirmed in block ${parseInt(receipt.blockNumber, 16)}`, "ok");
      return receipt;
    } else if (receipt) {
      log(logBoxId, `Transaction reverted!`, "err");
      return null;
    } else {
      log(logBoxId, `Timeout waiting for confirmation`, "warn");
      return null;
    }
  } catch (e) {
    log(logBoxId, `Failed: ${e.message}`, "err");
    txLog(`${label} failed: ${e.message}`, "err");
    return null;
  }
}

// ============ Step 1: Deploy Contracts ============
window.deployContract = async function (contractName) {
  if (!userAddress) { alert("Please connect wallet first."); return; }
  const { bytecode } = CONTRACTS[contractName];
  log("deployLog", `Deploying ${contractName}...`, "info");
  try {
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from: userAddress, data: bytecode, gas: "0x4C4B40" }],
    });
    log("deployLog", `Deploy tx sent: ${txHash}`, "ok");
    txLog(`Deploy ${contractName}: ${txHash}`, "ok");

    // Wait for receipt to get contract address
    log("deployLog", "Waiting for deployment...", "info");
    let receipt = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [txHash] }),
      });
      const json = await res.json();
      if (json.result) { receipt = json.result; break; }
    }

    if (receipt && receipt.contractAddress) {
      const addr = receipt.contractAddress;
      log("deployLog", `${contractName} deployed at: ${addr}`, "ok");
      txLog(`${contractName} deployed: ${addr}`, "ok");

      // Auto-fill fields
      if (contractName === "NFTAirdropPlatform") {
        document.getElementById("platformAddr").value = addr;
      } else if (contractName === "ArcNFT") {
        document.getElementById("nftContract").value = addr;
      } else if (contractName === "ArcMultiToken") {
        document.getElementById("nftContract").value = addr;
      }
    } else {
      log("deployLog", "Deployment failed or timeout", "err");
    }
  } catch (e) {
    log("deployLog", `Deploy failed: ${e.message}`, "err");
  }
};

// ============ Step 2: Create Campaign ============
window.toggleERC1155Fields = function () {
  const is1155 = document.getElementById("nftType").value === "1155";
  document.querySelectorAll(".erc1155-field").forEach(el => {
    el.style.display = is1155 ? "flex" : "none";
  });
};

window.createCampaign = async function () {
  const platform = getPlatformAddress();
  const name = document.getElementById("campaignName").value.trim();
  const nftType = document.getElementById("nftType").value;
  const nftContract = document.getElementById("nftContract").value.trim();

  if (!name) { alert("Please enter a campaign name."); return; }
  if (!nftContract) { alert("Please enter the NFT contract address."); return; }

  let data;
  if (nftType === "721") {
    // createERC721Campaign(string, address)
    const sel = selector("createERC721Campaign(string,address)");
    // ABI encode: offset to string (0x40), address, string data
    const addrPad = pad32(nftContract);
    const strEncoded = encodeString(name);
    data = sel + pad32(64) + addrPad + strEncoded; // offset=0x40=64 bytes
  } else {
    // createERC1155Campaign(string, address, uint256, uint256)
    const sel = selector("createERC1155Campaign(string,address,uint256,uint256)");
    const addrPad = pad32(nftContract);
    const tokenId = document.getElementById("erc1155TokenId").value;
    const amount = document.getElementById("erc1155Amount").value;
    // offset to string (0x80=128), address, tokenId, amount, string
    data = sel + pad32(128) + addrPad + pad32(tokenId) + pad32(amount) + encodeString(name);
  }

  const receipt = await sendTx(platform, data, "createLog", `Create campaign "${name}"`);
  if (receipt) {
    log("createLog", "Campaign created successfully!", "ok");
    loadCampaigns();
  }
};

// ============ Step 3: Airdrop ============
window.loadCSV = function (event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    // Extract all 0x addresses from the file
    const addresses = text.match(/0x[a-fA-F0-9]{40}/g) || [];
    document.getElementById("recipientList").value = addresses.join("\n");
    log("airdropLog", `Loaded ${addresses.length} addresses from CSV`, "ok");
  };
  reader.readAsText(file);
};

window.executeAirdrop = async function () {
  const platform = getPlatformAddress();
  const campaignId = document.getElementById("airdropCampaignId").value;
  const rawAddresses = document.getElementById("recipientList").value.trim();

  if (!rawAddresses) { alert("Please enter recipient addresses."); return; }

  // Parse addresses
  const addresses = rawAddresses.match(/0x[a-fA-F0-9]{40}/gi) || [];
  if (addresses.length === 0) { alert("No valid addresses found."); return; }

  log("airdropLog", `Airdropping to ${addresses.length} recipients for campaign #${campaignId}...`, "info");

  // Determine campaign type by reading on-chain
  const getCampaignData = selector("getCampaign(uint256)") + pad32(campaignId);
  const campaignResult = await ethCall(platform, getCampaignData);
  const fields = campaignResult.slice(2 + 64); // skip 0x + outer offset
  const tokenType = Number(decodeUintAt(fields, 128));

  let fnSel, data;
  if (tokenType === 0) {
    fnSel = selector("airdropERC721(uint256,address[])");
    // airdropERC721(uint256, address[])
    // campaignId, offset to array, array data
    data = fnSel + pad32(campaignId) + pad32(64) + encodeAddressArray(addresses);
  } else {
    fnSel = selector("airdropERC1155(uint256,address[])");
    data = fnSel + pad32(campaignId) + pad32(64) + encodeAddressArray(addresses);
  }

  const receipt = await sendTx(platform, data, "airdropLog",
    `Airdrop ${tokenType === 0 ? "ERC-721" : "ERC-1155"} to ${addresses.length} recipients`);
  if (receipt) {
    log("airdropLog", `Airdrop complete! ${addresses.length} recipients received NFTs.`, "ok");
    loadCampaigns();
  }
};

// ============ Load Campaigns (read-only) ============
async function loadCampaigns() {
  const platform = getPlatformAddress();
  try {
    const totalHex = await ethCall(platform, selector("totalCampaigns()"));
    const total = Number(decodeUint(totalHex));

    let totalAirdropped = 0;
    let activeCount = 0;
    const campaigns = [];

    for (let i = 0; i < total; i++) {
      const data = selector("getCampaign(uint256)") + pad32(i);
      const result = await ethCall(platform, data);
      const fields = result.slice(2 + 64);

      const name = decodeString(fields, 0);
      const nftContract = decodeAddress(fields, 64);
      const tokenType = Number(decodeUintAt(fields, 128));
      const erc1155TokenId = Number(decodeUintAt(fields, 192));
      const erc1155Amount = Number(decodeUintAt(fields, 256));
      const creator = decodeAddress(fields, 320);
      const airdropped = Number(decodeUintAt(fields, 384));
      const active = decodeBool(fields, 448);

      campaigns.push({ id: i, name, nftContract, tokenType, erc1155TokenId, erc1155Amount, creator, airdropped, active });
      totalAirdropped += airdropped;
      if (active) activeCount++;
    }

    document.getElementById("totalCampaigns").textContent = total;
    document.getElementById("totalAirdropped").textContent = totalAirdropped;
    document.getElementById("activeCampaigns").textContent = activeCount;

    const grid = document.getElementById("campaignList");
    if (campaigns.length === 0) {
      grid.innerHTML = '<p style="color:#6b7280;text-align:center;padding:2rem">No campaigns yet. Create one above!</p>';
      return;
    }

    grid.innerHTML = campaigns.map(c => {
      const typeLabel = c.tokenType === 0 ? "ERC-721" : "ERC-1155";
      const typeBadge = c.tokenType === 0 ? "badge-721" : "badge-1155";
      const statusBadge = c.active ? "badge-active" : "badge-closed";
      const statusText = c.active ? "Active" : "Closed";
      const extra = c.tokenType === 1 ? `Token#${c.erc1155TokenId} x${c.erc1155Amount}/ea` : "";

      return `
        <div class="campaign-card">
          <div class="campaign-info">
            <h3>#${c.id} ${c.name}
              <span class="badge ${typeBadge}">${typeLabel}</span>
              <span class="badge ${statusBadge}">${statusText}</span>
            </h3>
            <div class="campaign-meta">
              <span>NFT: ${c.nftContract.slice(0, 8)}...${c.nftContract.slice(-4)}</span>
              <span>Creator: ${c.creator.slice(0, 8)}...${c.creator.slice(-4)}</span>
              ${extra ? `<span>${extra}</span>` : ""}
            </div>
          </div>
          <div class="campaign-stats">
            <div class="count">${c.airdropped}</div>
            <div class="label">airdropped</div>
          </div>
        </div>`;
    }).join("");
  } catch (e) {
    console.error("Failed to load campaigns:", e);
  }
}

// ============ Balance Lookup ============
window.lookupBalance = async function () {
  const addr = document.getElementById("lookupAddress").value.trim();
  const nftAddr = document.getElementById("lookupNFT").value.trim() || DEFAULT_NFT721;
  const resultDiv = document.getElementById("balanceResult");

  if (!addr || !addr.startsWith("0x")) {
    resultDiv.textContent = "Please enter a valid address.";
    resultDiv.classList.add("show");
    return;
  }

  const paddedAddr = addr.toLowerCase().slice(2).padStart(64, "0");

  // Try ERC-721 balanceOf
  const bal721Hex = await ethCall(nftAddr, selector("balanceOf(address)") + paddedAddr);
  const bal721 = Number(decodeUint(bal721Hex));

  // Try ERC-1155 balanceOf for token IDs 0-5
  const balances1155 = [];
  for (let id = 0; id <= 5; id++) {
    try {
      const data = selector("balanceOf(address,uint256)") + paddedAddr + pad32(id);
      const balHex = await ethCall(nftAddr, data);
      if (balHex && balHex !== "0x") {
        const bal = Number(decodeUint(balHex));
        if (bal > 0) balances1155.push({ id, bal });
      }
    } catch (_) {}
  }

  let html = `<strong>${addr.slice(0, 6)}...${addr.slice(-4)}</strong> on <strong>${nftAddr.slice(0, 8)}...${nftAddr.slice(-4)}</strong><br>`;
  html += `ERC-721 balance: ${bal721} NFTs<br>`;
  if (balances1155.length > 0) {
    html += `ERC-1155: ${balances1155.map(b => `Token#${b.id}: ${b.bal}`).join(", ")}`;
  }

  resultDiv.innerHTML = html;
  resultDiv.classList.add("show");
};

// ============ Init ============
loadCampaigns().catch(console.error);
