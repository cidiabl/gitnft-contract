// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./ProxyRegistry.sol";

/// @title An ERC721 non-fungible token for Git SHA1 commits.
/// @author Joshua Peek
contract GitNFT is
    Ownable,
    AccessControl,
    EIP712,
    ERC721,
    ERC721Enumerable,
    ERC721Burnable,
    ERC721Pausable,
    ERC2771Context
{
    using Counters for Counters.Counter;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    bytes32 private constant MINT_TYPEHASH =
        keccak256("Mint(address to,uint256 tokenId,bytes tokenCID)");
    bytes32 private constant META_TRANSACTION_TYPEHASH =
        keccak256(
            bytes(
                "MetaTransaction(uint256 nonce,address from,bytes functionSignature)"
            )
        );

    bytes16 private constant base16alpha = "0123456789abcdef";
    bytes32 private constant base32alpha = "abcdefghijklmnopqrstuvwxyz234567";

    struct MetaTransaction {
        uint256 nonce;
        address from;
        bytes functionSignature;
    }

    string private baseIPFSURI;
    string private baseTokenURI;
    bytes private contractCID;
    address private proxyRegistryAddress;
    mapping(uint256 => bytes) private tokenCIDs;
    mapping(address => Counters.Counter) private nonces;

    event MetaTransactionExecuted(
        address userAddress,
        address payable relayerAddress,
        bytes functionSignature
    );

    constructor(
        string memory baseIPFSURI_,
        string memory baseTokenURI_,
        bytes memory contractCID_
    ) ERC721("GitNFT", "SHA") EIP712("GitNFT", "1") ERC2771Context(address(0)) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);

        baseIPFSURI = baseIPFSURI_;
        baseTokenURI = baseTokenURI_;
        contractCID = contractCID_;
    }

    /// @dev Mint a new token for a git commit.
    /// @param to The address of the new token's owner.
    /// @param tokenId The commit SHA1 bytes represented as uint.
    /// @param tokenCID Optional IPFS metadata CIDv1 as bytes.
    function mint(
        address to,
        uint256 tokenId,
        bytes memory tokenCID
    ) external {
        require(
            hasRole(MINTER_ROLE, _msgSender()),
            "GitNFT: must have minter role to mint"
        );
        _safeMint(to, tokenId);

        if (tokenCID.length > 1) {
            tokenCIDs[tokenId] = tokenCID;
        }
    }

    /// @dev Mint a new token for a git commit.
    /// @param to The address of the new token's owner.
    /// @param tokenId The commit SHA1 bytes represented as uint.
    /// @param tokenCID Optional IPFS metadata CIDv1 as bytes.
    /// @param v signature v value.
    /// @param r signature r value.
    /// @param s signature s value.
    function mint(
        address to,
        uint256 tokenId,
        bytes memory tokenCID,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        bytes32 structHash =
            keccak256(
                abi.encode(MINT_TYPEHASH, to, tokenId, keccak256(tokenCID))
            );
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, v, r, s);

        require(
            hasRole(MINTER_ROLE, signer),
            "GitNFT: signer must have minter role to mint"
        );

        _safeMint(to, tokenId);

        if (tokenCID.length > 1) {
            tokenCIDs[tokenId] = tokenCID;
        }
    }

    /// @dev Set IPFS metdata for a token. Overrides fallback.
    /// @param tokenId The commit SHA1 bytes represented as uint.
    /// @param tokenCID Optional IPFS metadata CIDv1 as bytes.
    function setTokenCID(uint256 tokenId, bytes memory tokenCID) external {
        require(
            hasRole(MINTER_ROLE, _msgSender()),
            "GitNFT: must have minter to change token cid"
        );
        tokenCIDs[tokenId] = tokenCID;
    }

    /// @dev Execute signed transaction.
    /// @param userAddress the original message sender address.
    /// @param functionSignature the RLP encoded transaction data.
    /// @param sigR signature r value.
    /// @param sigS signature s value.
    /// @param sigV signature v value.
    function executeMetaTransaction(
        address userAddress,
        bytes memory functionSignature,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    ) external payable returns (bytes memory) {
        MetaTransaction memory metaTx =
            MetaTransaction({
                nonce: nonces[userAddress].current(),
                from: userAddress,
                functionSignature: functionSignature
            });

        bytes32 structHash =
            keccak256(
                abi.encode(
                    META_TRANSACTION_TYPEHASH,
                    metaTx.nonce,
                    metaTx.from,
                    keccak256(metaTx.functionSignature)
                )
            );

        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, sigV, sigR, sigS);

        require(
            signer == userAddress,
            "GitNFT: Signer and signature do not match"
        );

        nonces[userAddress].increment();

        emit MetaTransactionExecuted(
            userAddress,
            payable(msg.sender),
            functionSignature
        );

        (bool success, bytes memory returnData) =
            address(this).call(
                abi.encodePacked(functionSignature, userAddress)
            );

        require(success, "GitNFT: Function call not successful");

        return returnData;
    }

    /// @dev Pause token minting and transfers.
    function pause() external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "GitNFT: must have admin role to pause"
        );
        _pause();
    }

    /// @dev Unpause token minting and transfers.
    function unpause() external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "GitNFT: must have admin role to unpause"
        );
        _unpause();
    }

    /// @dev Wipe out rinkeby test contract when redeploying.
    /// TODO: remove before deploying to mainnet.
    function implode() external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "GitNFT: must have admin role to implode"
        );

        selfdestruct(payable(msg.sender));
    }

    /// @dev Update IPFS gateway URI.
    function setIPFSBaseURI(string memory baseIPFSURI_) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "GitNFT: must have admin role to change IPFS base uri"
        );
        baseIPFSURI = baseIPFSURI_;
    }

    /// @dev Update OpenSea contract level metadata.
    function setContractCID(bytes memory contractCID_) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "GitNFT: must have admin role to change contract CID"
        );
        contractCID = contractCID_;
    }

    /// @dev Update metadata fallback base URI.
    function setBaseURI(string memory baseURI_) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "GitNFT: must have admin role to change base uri"
        );
        baseTokenURI = baseURI_;
    }

    /// @dev Update OpenSea proxy address.
    function setProxyRegistry(address proxyRegistryAddress_) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "GitNFT: must have admin role to change proxy registry address"
        );
        proxyRegistryAddress = proxyRegistryAddress_;
    }

    /// @dev Get OpenSea contract level metadata.
    /// <https://docs.opensea.io/docs/contract-level-metadata>
    /// @return a URL for the storefront-level metadata.
    function contractURI() external view returns (string memory) {
        return cidURI(contractCID);
    }

    /// @dev Get nonce for meta-transaction sender.
    /// @param user sender address.
    /// @return meta-transaction nonce.
    function getNonce(address user) external view returns (uint256) {
        return nonces[user].current();
    }

    /// @dev Check if commit has been minted.
    /// @param tokenId The commit SHA1 bytes represented as uint.
    /// @return true if commit has been minted.
    function exists(uint256 tokenId) external view returns (bool) {
        return _exists(tokenId);
    }

    /// @dev Get token metadata.
    /// @return a URL for JSON metadata.
    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(_exists(tokenId), "GitNFT: URI query for nonexistent token");

        bytes memory tokenCID = tokenCIDs[tokenId];
        if (tokenCID.length > 0) {
            return cidURI(tokenCID);
        }

        return
            string(
                abi.encodePacked(baseTokenURI, base16encode(tokenId), ".json")
            );
    }

    /// @dev Enable OpenSea gas-less listings by approving their proxy address.
    function isApprovedForAll(address owner, address operator)
        public
        view
        override
        returns (bool)
    {
        if (hasRole(OPERATOR_ROLE, operator)) {
            return true;
        }

        if (proxyRegistryAddress != address(0)) {
            ProxyRegistry proxyRegistry = ProxyRegistry(proxyRegistryAddress);
            if (address(proxyRegistry.proxies(owner)) == operator) {
                return true;
            }
        }

        return super.isApprovedForAll(owner, operator);
    }

    /// @dev Ourself is the only trusted forwarder for meta transaction dispatch.
    function isTrustedForwarder(address forwarder)
        public
        view
        override
        returns (bool)
    {
        return forwarder == address(this);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl, ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /// @dev Hook that is called before any token transfer.
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721, ERC721Enumerable, ERC721Pausable) {
        super._beforeTokenTransfer(from, to, tokenId);

        require(tokenId >> 160 == 0, "GitNFT: invalid git sha1");
    }

    /// @dev Override base _burn function to cleanup associated CID.
    /// @param tokenId The commit SHA1 bytes represented as uint.
    function _burn(uint256 tokenId) internal virtual override {
        super._burn(tokenId);

        if (tokenCIDs[tokenId].length != 0) {
            delete tokenCIDs[tokenId];
        }
    }

    /// @dev Redefine ERC721._isApprovedOrOwner to fix isApprovedForAll dispatch.
    /// Bug in openzeppelin-contracts.
    function _isApprovedOrOwner(address spender, uint256 tokenId)
        internal
        view
        override
        returns (bool)
    {
        require(
            _exists(tokenId),
            "ERC721: operator query for nonexistent token"
        );
        address owner = ERC721.ownerOf(tokenId);
        return (spender == owner ||
            getApproved(tokenId) == spender ||
            isApprovedForAll(owner, spender));
    }

    function _msgSender()
        internal
        view
        override(Context, ERC2771Context)
        returns (address)
    {
        return super._msgSender();
    }

    function _msgData()
        internal
        view
        override(Context, ERC2771Context)
        returns (bytes calldata)
    {
        return super._msgData();
    }

    /// @dev Get IPFS gateway URI for a CIDv1.
    /// @return string URI.
    function cidURI(bytes memory cid) private view returns (string memory) {
        return string(abi.encodePacked(baseIPFSURI, base32encode(cid)));
    }

    /// @dev encode uint256 as a familiar git sha1.
    /// @return 40 character hex string.
    function base16encode(uint256 value) private pure returns (string memory) {
        bytes memory buffer = new bytes(40);
        for (uint256 i = 39; i > 0; i--) {
            buffer[i] = base16alpha[value & 0xf];
            value >>= 4;
        }
        buffer[0] = base16alpha[value];
        return string(buffer);
    }

    /// @dev Encode CIDv1 bytes as multibase base32 string.
    /// <https://github.com/multiformats/multibase>
    /// @return CIDv1 string.
    function base32encode(bytes memory buffer)
        private
        pure
        returns (string memory)
    {
        uint256 encodedBitLen = buffer.length * 8;
        uint256 encodedByteLen = encodedBitLen / 5;
        if (encodedBitLen % 5 > 0) encodedByteLen++;
        encodedByteLen++;

        bytes memory encoded = new bytes(encodedByteLen);

        uint256 i = 0;
        uint256 j = 0;
        uint256 len = buffer.length;

        encoded[j++] = "b";

        while (i < len) {
            uint8 b0 = uint8(buffer[i]);
            uint8 b1 = (i + 1 < len) ? uint8(buffer[i + 1]) : 0;
            uint8 b2 = (i + 2 < len) ? uint8(buffer[i + 2]) : 0;
            uint8 b3 = (i + 3 < len) ? uint8(buffer[i + 3]) : 0;
            uint8 b4 = (i + 4 < len) ? uint8(buffer[i + 4]) : 0;

            encoded[j++] = base32alpha[(b0 & 0xF8) >> 3];
            encoded[j++] = base32alpha[((b0 & 0x07) << 2) | ((b1 & 0xC0) >> 6)];
            if (i + 1 >= len) break;
            encoded[j++] = base32alpha[(b1 & 0x3E) >> 1];
            encoded[j++] = base32alpha[((b1 & 0x01) << 4) | ((b2 & 0xF0) >> 4)];
            if (i + 2 >= len) break;
            encoded[j++] = base32alpha[((b2 & 0x0F) << 1) | (b3 >> 7)];
            if (i + 3 >= len) break;
            encoded[j++] = base32alpha[(b3 & 0x7C) >> 2];
            encoded[j++] = base32alpha[((b3 & 0x03) << 3) | ((b4 & 0xE0) >> 5)];
            if (i + 4 >= len) break;
            encoded[j++] = base32alpha[b4 & 0x1F];

            i += 5;
        }

        return string(encoded);
    }
}
