require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    }
  },
  solidity: {
    version: "0.8.26",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
};
