// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import "./OwnableDelegateProxy.sol";

/// @dev Wyvern Proxy Registry v2
// <https://github.com/ProjectWyvern/wyvern-ethereum/blob/bfca101b2407e4938398fccd8d1c485394db7e01/contracts/registry/ProxyRegistry.sol#L15>
contract ProxyRegistry {
    mapping(address => OwnableDelegateProxy) public proxies;
}
