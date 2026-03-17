require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    baseSepolia: {
      url: "https://sepolia.base.org",
      accounts: [AGENT_PRIVATE_KEY],
      chainId: 84532
    },
    celoAlfajores: {
      url: "https://alfajores-forno.celo-testnet.org",
      accounts: [AGENT_PRIVATE_KEY],
      chainId: 44787
    },
    celoSepolia: {
      url: "https://celo-sepolia.drpc.org",
      accounts: [AGENT_PRIVATE_KEY],
      chainId: 11142220
    }
  }
};
