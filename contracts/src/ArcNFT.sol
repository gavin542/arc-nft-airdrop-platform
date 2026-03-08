// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ArcNFT is ERC721 {
    uint256 private _nextTokenId;

    constructor() ERC721("Arc Test NFT", "ATNFT") {}

    function mint(address to) public {
        _mint(to, _nextTokenId++);
    }
}
