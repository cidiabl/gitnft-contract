const HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
  networks: {
    live: {
      provider: () => {
        return new HDWalletProvider({
          privateKeys: [process.env.PRIVATE_KEY],
          providerOrUrl: process.env.MAINNET_API_URL,
        });
      },
      gas: 5000000,
      network_id: 1,
    },
    rinkeby: {
      provider: () => {
        return new HDWalletProvider({
          privateKeys: [process.env.PRIVATE_KEY],
          providerOrUrl: process.env.RINKEBY_API_URL,
        });
      },
      gas: 5000000,
      network_id: 4,
    },
  },
  compilers: {
    solc: {
      version: "scripts/solc-custom.js",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },
  db: {
    enabled: false,
  },
};
