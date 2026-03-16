// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ImpactNFT is ERC721, ERC721URIStorage, Ownable {
    using SafeERC20 for IERC20;

    // ════════════════════════════════════════════
    // STATE
    // ════════════════════════════════════════════
    uint256 public nextTokenId;
    uint256 public totalSold;
    uint256 public totalRaised;

    IERC20 public cUSD;
    address public eduChainContract;
    uint256 public constant NFT_PRICE = 1 ether; // 1 cUSD

    struct NFTData {
        address student;
        string topic;
        uint8 score;
        uint256 amountPaid;
        string filecoinCID;
        string paymentTxHash;
        uint256 timestamp;
        bool forSale;
        uint256 price;
    }

    mapping(uint256 => NFTData) public nftData;
    uint256[] public allTokenIds;

    // ════════════════════════════════════════════
    // EVENTS
    // ════════════════════════════════════════════
    event ImpactNFTMinted(
        uint256 indexed tokenId,
        address indexed student,
        string topic,
        uint8 score
    );
    event ImpactNFTSold(
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 price
    );

    // ════════════════════════════════════════════
    // CONSTRUCTOR
    // ════════════════════════════════════════════
    constructor(address _cUSD) ERC721("EduChain Impact", "IMPACT") Ownable(msg.sender) {
        cUSD = IERC20(_cUSD);
    }

    // ════════════════════════════════════════════
    // SETUP
    // ════════════════════════════════════════════
    function setEduChainContract(address _eduChain) external onlyOwner {
        eduChainContract = _eduChain;
    }

    // ════════════════════════════════════════════
    // MINT (only EduChain contract can call)
    // ════════════════════════════════════════════
    function mint(
        address student,
        string calldata topic,
        uint8 score,
        uint256 amountPaid,
        string calldata filecoinCID,
        string calldata paymentTxHash
    ) external returns (uint256) {
        require(
            msg.sender == eduChainContract || msg.sender == owner(),
            "Only EduChain contract or owner"
        );

        uint256 tokenId = nextTokenId;
        nextTokenId++;

        _safeMint(address(this), tokenId);

        nftData[tokenId] = NFTData({
            student: student,
            topic: topic,
            score: score,
            amountPaid: amountPaid,
            filecoinCID: filecoinCID,
            paymentTxHash: paymentTxHash,
            timestamp: block.timestamp,
            forSale: true,
            price: NFT_PRICE
        });

        allTokenIds.push(tokenId);

        emit ImpactNFTMinted(tokenId, student, topic, score);

        return tokenId;
    }

    // ════════════════════════════════════════════
    // BUY NFT (anyone can call)
    // 100% goes to EduChain reward pool
    // ════════════════════════════════════════════
    function buyNFT(uint256 tokenId) external {
        NFTData storage data = nftData[tokenId];
        require(data.forSale, "Not for sale");
        require(data.timestamp > 0, "NFT does not exist");

        // Take payment in cUSD
        cUSD.safeTransferFrom(msg.sender, address(this), NFT_PRICE);

        // Send 100% to EduChain reward pool
        if (eduChainContract != address(0)) {
            cUSD.safeTransfer(eduChainContract, NFT_PRICE);
        }

        // Transfer NFT to buyer
        _transfer(address(this), msg.sender, tokenId);

        data.forSale = false;
        totalSold++;
        totalRaised += NFT_PRICE;

        emit ImpactNFTSold(tokenId, msg.sender, NFT_PRICE);
    }

    // ════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ════════════════════════════════════════════
    function getAllNFTs() external view returns (NFTData[] memory) {
        NFTData[] memory all = new NFTData[](allTokenIds.length);
        for (uint256 i = 0; i < allTokenIds.length; i++) {
            all[i] = nftData[allTokenIds[i]];
        }
        return all;
    }

    function getNFTsByStudent(address student) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < allTokenIds.length; i++) {
            if (nftData[allTokenIds[i]].student == student) {
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allTokenIds.length; i++) {
            if (nftData[allTokenIds[i]].student == student) {
                result[index] = allTokenIds[i];
                index++;
            }
        }
        return result;
    }

    function getTotalMinted() external view returns (uint256) {
        return nextTokenId;
    }

    function getForSaleCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < allTokenIds.length; i++) {
            if (nftData[allTokenIds[i]].forSale) {
                count++;
            }
        }
        return count;
    }

    // ════════════════════════════════════════════
    // REQUIRED OVERRIDES
    // ════════════════════════════════════════════
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // Allow contract to receive ERC721
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}