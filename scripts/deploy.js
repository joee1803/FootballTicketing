const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const Ticketing = await hre.ethers.getContractFactory("Ticketing");
  const contract = await Ticketing.deploy(deployer.address);
  await contract.waitForDeployment();

  console.log(`Ticketing deployed to: ${await contract.getAddress()}`);
  console.log(`Admin: ${deployer.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
