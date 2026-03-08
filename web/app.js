const RPC = "https://rpc.testnet.arc.network";
const PLATFORM = "0x81eb0527141bdA04A19acd26d5da503aDc5a519A";
const ARCNFT = "0x1269b2a9a2d779B8D74997B2859BFB93E9c98Af1";
const ARCMULTITOKEN = "0x8c54E2e709ba7C6B60fD55a49E32086099389332";

// Minimal ABI encoding/decoding helpers (no ethers.js dependency)
function encodeFunctionCall(sig, args = []) {
  const selector = sig.slice(0, 10);
  let data = selector;
  for (const arg of args) {
    data += BigInt(arg).toString(16).padStart(64, "0");
  }
  return data;
}

async function ethCall(to, data) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
  });
  const json = await res.json();
  return json.result;
}

// Function selectors (pre-computed keccak256)
const SEL_TOTAL = "0x7cfc2115"; // totalCampaigns()
const SEL_GET = "0x4dda7b28";   // getCampaign(uint256)
const SEL_BALANCE721 = "0x70a08231"; // balanceOf(address)
const SEL_BALANCE1155 = "0x00fdd58e"; // balanceOf(address,uint256)

function decodeUint(hex) {
  return BigInt("0x" + hex.slice(2));
}

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

function decodeAddress(hex, offset) {
  return "0x" + hex.slice(offset + 24, offset + 64);
}

function decodeUintAt(hex, offset) {
  return BigInt("0x" + hex.slice(offset, offset + 64));
}

function decodeBool(hex, offset) {
  return hex.slice(offset, offset + 64).endsWith("1");
}

async function loadCampaigns() {
  document.getElementById("platformAddr").textContent = PLATFORM;

  // Get total campaigns
  const totalHex = await ethCall(PLATFORM, SEL_TOTAL);
  const total = Number(decodeUint(totalHex));

  let totalAirdropped = 0;
  let activeCount = 0;
  const campaigns = [];

  for (let i = 0; i < total; i++) {
    const data = SEL_GET + BigInt(i).toString(16).padStart(64, "0");
    const result = await ethCall(PLATFORM, data);
    // Remove 0x prefix, then parse tuple
    const hex = result;
    // Tuple has dynamic offset at start
    const tupleOffset = 2; // skip 0x
    // Fields: string(dynamic), address, uint8, uint256, uint256, address, uint256, bool
    // Offset to tuple data: first 32 bytes = offset to string
    const fields = hex.slice(tupleOffset + 64); // skip the outer tuple offset (0x20)

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

  // Update stats
  document.getElementById("totalCampaigns").textContent = total;
  document.getElementById("totalAirdropped").textContent = totalAirdropped;
  document.getElementById("activeCampaigns").textContent = activeCount;

  // Render campaigns
  const grid = document.getElementById("campaignList");
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
      </div>
    `;
  }).join("");
}

// Balance lookup
window.lookupBalance = async function () {
  const addr = document.getElementById("lookupAddress").value.trim();
  const resultDiv = document.getElementById("balanceResult");
  if (!addr || !addr.startsWith("0x")) {
    resultDiv.textContent = "Please enter a valid address";
    resultDiv.classList.add("show");
    return;
  }

  const paddedAddr = addr.toLowerCase().slice(2).padStart(64, "0");

  // ERC-721 balance
  const bal721Hex = await ethCall(ARCNFT, SEL_BALANCE721 + paddedAddr);
  const bal721 = Number(decodeUint(bal721Hex));

  // ERC-1155 balances for token IDs 0-3
  const balances1155 = [];
  for (let id = 0; id <= 3; id++) {
    const data = SEL_BALANCE1155 + paddedAddr + BigInt(id).toString(16).padStart(64, "0");
    const balHex = await ethCall(ARCMULTITOKEN, data);
    const bal = Number(decodeUint(balHex));
    if (bal > 0) balances1155.push({ id, bal });
  }

  let html = `<strong>${addr.slice(0, 8)}...${addr.slice(-4)}</strong><br>`;
  html += `ERC-721 (ArcNFT): ${bal721} NFTs<br>`;
  if (balances1155.length > 0) {
    html += `ERC-1155 (ArcMultiToken): `;
    html += balances1155.map(b => `Token#${b.id}: ${b.bal}`).join(", ");
  } else {
    html += `ERC-1155 (ArcMultiToken): none`;
  }

  resultDiv.innerHTML = html;
  resultDiv.classList.add("show");
};

// Load on page ready
loadCampaigns().catch(console.error);
