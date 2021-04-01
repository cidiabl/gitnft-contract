var GitNFT = artifacts.require("GitNFT");

const CID = require("cids");

function cid(str) {
  return "0x" + Buffer.from(new CID(str).bytes).toString("hex");
}

module.exports = async function (deployer, network) {
  // contract.json
  const contractCID = cid(
    "bafkreigaktskowelbch3vsmbotgqtfstmvjjvimnbeknhwdow4ndknkfhq"
  );

  await deployer.deploy(GitNFT, "ipfs://", "https://gitnft.io/", contractCID);

  const token = await GitNFT.deployed();
  const MINTER_ROLE = await token.MINTER_ROLE();

  if (process.env.MINTER_ADDRESS) {
    await token.grantRole(MINTER_ROLE, process.env.MINTER_ADDRESS);
  }

  // Register OpenSea proxy registry addresses
  if (network == "live") {
    // Wyvern Proxy Registry v2
    // https://etherscan.io/address/0xa5409ec958C83C3f309868babACA7c86DCB077c1
    await token.setProxyRegistry("0xa5409ec958c83c3f309868babaca7c86dcb077c1");
  } else if (network === "rinkeby") {
    // https://rinkeby.etherscan.io/address/0xf57b2c51ded3a29e6891aba85459d600256cf317
    await token.setProxyRegistry("0xf57b2c51ded3a29e6891aba85459d600256cf317");
  }
};
