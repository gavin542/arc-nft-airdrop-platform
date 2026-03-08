// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface IArcNFT {
    function mint(address to) external;
}

interface IArcMultiToken {
    function mint(address to, uint256 id, uint256 amount) external;
}

contract NFTAirdropPlatform {
    enum TokenType { ERC721, ERC1155 }

    struct Campaign {
        string name;
        address nftContract;
        TokenType tokenType;
        uint256 erc1155TokenId;   // only used for ERC1155
        uint256 erc1155Amount;    // amount per recipient for ERC1155
        address creator;
        uint256 totalAirdropped;
        bool active;
    }

    Campaign[] public campaigns;

    event CampaignCreated(uint256 indexed campaignId, string name, address nftContract, TokenType tokenType, address creator);
    event AirdropExecuted(uint256 indexed campaignId, address[] recipients, uint256 count);
    event CampaignClosed(uint256 indexed campaignId);

    modifier onlyCreator(uint256 campaignId) {
        require(campaigns[campaignId].creator == msg.sender, "not creator");
        _;
    }

    // --- Create Campaign ---

    function createERC721Campaign(string calldata name, address nftContract) external returns (uint256) {
        uint256 id = campaigns.length;
        campaigns.push(Campaign({
            name: name,
            nftContract: nftContract,
            tokenType: TokenType.ERC721,
            erc1155TokenId: 0,
            erc1155Amount: 0,
            creator: msg.sender,
            totalAirdropped: 0,
            active: true
        }));
        emit CampaignCreated(id, name, nftContract, TokenType.ERC721, msg.sender);
        return id;
    }

    function createERC1155Campaign(
        string calldata name,
        address nftContract,
        uint256 tokenId,
        uint256 amountPerRecipient
    ) external returns (uint256) {
        require(amountPerRecipient > 0, "amount must be > 0");
        uint256 id = campaigns.length;
        campaigns.push(Campaign({
            name: name,
            nftContract: nftContract,
            tokenType: TokenType.ERC1155,
            erc1155TokenId: tokenId,
            erc1155Amount: amountPerRecipient,
            creator: msg.sender,
            totalAirdropped: 0,
            active: true
        }));
        emit CampaignCreated(id, name, nftContract, TokenType.ERC1155, msg.sender);
        return id;
    }

    // --- Airdrop ---

    function airdropERC721(uint256 campaignId, address[] calldata recipients) external onlyCreator(campaignId) {
        Campaign storage c = campaigns[campaignId];
        require(c.active, "campaign closed");
        require(c.tokenType == TokenType.ERC721, "not ERC721 campaign");

        for (uint256 i = 0; i < recipients.length; i++) {
            IArcNFT(c.nftContract).mint(recipients[i]);
        }
        c.totalAirdropped += recipients.length;
        emit AirdropExecuted(campaignId, recipients, recipients.length);
    }

    function airdropERC1155(uint256 campaignId, address[] calldata recipients) external onlyCreator(campaignId) {
        Campaign storage c = campaigns[campaignId];
        require(c.active, "campaign closed");
        require(c.tokenType == TokenType.ERC1155, "not ERC1155 campaign");

        for (uint256 i = 0; i < recipients.length; i++) {
            IArcMultiToken(c.nftContract).mint(recipients[i], c.erc1155TokenId, c.erc1155Amount);
        }
        c.totalAirdropped += recipients.length;
        emit AirdropExecuted(campaignId, recipients, recipients.length);
    }

    // --- Management ---

    function closeCampaign(uint256 campaignId) external onlyCreator(campaignId) {
        campaigns[campaignId].active = false;
        emit CampaignClosed(campaignId);
    }

    // --- View ---

    function totalCampaigns() external view returns (uint256) {
        return campaigns.length;
    }

    function getCampaign(uint256 campaignId) external view returns (Campaign memory) {
        return campaigns[campaignId];
    }
}
