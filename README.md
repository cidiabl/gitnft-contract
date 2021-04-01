# GitNFT

An [ERC-721](https://eips.ethereum.org/EIPS/eip-721) contract that mints tokens for git commit SHA-1s.

This contract is currently deployed to the Rinkeby Testnet Network at [0x325EF499a355C2dDE9A97DFa30a1f6E3c8D7eA73](https://rinkeby.etherscan.io/address/0x325EF499a355C2dDE9A97DFa30a1f6E3c8D7eA73).

## Token Format

[ERC-721](https://eips.ethereum.org/EIPS/eip-721) represents tokens as `uint256` IDs. Rather than using a incrementing counter as the token ID, the git SHA-1 digest itself is used. Since the digest is only 160 bits, they fit into the `uint256` with room to spare.

The SHA-1 6ac86aae89289121db784161fe318819778f7f2a would be encoded as:

Hex (padded): `0x0000000000000000000000006ac86aae89289121db784161fe318819778f7f2a`\
Decimal: `609622464040788595955176936628242429798209519402`

Because of this one to one mapping, only a single SHA-1 can exist at a time and belong to a single owner. The current owner can be checked with `ownerOf(uint256 tokenId)`.

A token can also be associated with optional IPFS metadata. This is currently unused at the moment.

## Minting Process

Only a sender with a `MINTER_ROLE` role can call the main minting function `mint(address to, uint256 tokenId, bytes memory)`. The minter is responsible for authenticating the original git commit author. In this flow, the minter must pay the transaction gas fee. It uses around 134801 gas, which at todays ridiculous gas prices, is about 0.014 ETH.

Because of this, the alternative flow that's implemented allows the minter to sign a mint meta-transaction without submitting it to the blockchain. This can be done entirely offline and does not cost the minter any gas.

The minter can then give the signed ticket to the token receiver and have them submit the actual transaction and pay the underlying gas fees. Think of it like signing a coupon for the user to redeem.

An encoded ticket for minting the SHA-1 `6ac86aae89289121db784161fe318819778f7f2a` to the `0xdc25ef3f5b8a186996338a2ada83795fba2d695a` would look something like:

```
0xedcf9ed3 # mint function ABI code
000000000000000000000000dc25ef3f5b8a186996338a2ada83795fba2d695a # to
0000000000000000000000006ac86aae89289121db784161fe318819778f7f2a # tokenId
0000000000000000000000000000000000000000000000000000000000000... # tokenCID
18954d95e97ead26b87da4a771db45f04ac895b0f3e8ecca32d06c509ce76... # signature
```

## Metadata

A url for off-chain metadata can be retrieved with the `tokenURI(uint256 tokenId)` function.

```py
# Get metadata for SHA-1 6ac86aae89289121db784161fe318819778f7f2a
tokenURI(0x6ac86aae89289121db784161fe318819778f7f2a)
# "https://gitnft.io/6ac86aae89289121db784161fe318819778f7f2a.json"
```

Eventually we'd like to migrate this to IPFS.

## OpenSea integration

This contract whitelists [OpenSea](https://opensea.io)'s proxy registry to enable gas-less listings. [See more details on OpenSea's sparse documentation](https://docs.opensea.io/docs/1-structuring-your-smart-contract#section-open-sea-whitelisting-optional).
