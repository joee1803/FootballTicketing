const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Ticketing", function () {
  async function deployFixture() {
    const [admin, fanA, fanB, gate, attacker] = await ethers.getSigners();

    const Ticketing = await ethers.getContractFactory("Ticketing");
    const contract = await Ticketing.deploy(admin.address);
    await contract.waitForDeployment();

    await contract.grantRole(await contract.GATE_ROLE(), gate.address);

    return { contract, admin, fanA, fanB, gate, attacker };
  }

  it("creates a match and mints a ticket", async function () {
    const { contract, fanA } = await deployFixture();

    const now = await time.latest();
    const matchDate = now + 24 * 60 * 60;
    const cutoff = now + 12 * 60 * 60;

    await contract.createMatch(1, "Manchester United", "Arsenal", "Old Trafford", matchDate, cutoff);
    await contract.mintTicket(fanA.address, 1001, 1, 2);

    expect(await contract.ownerOf(1001)).to.equal(fanA.address);
    const ticket = await contract.getTicket(1001);
    expect(ticket.matchId).to.equal(1);
    expect(ticket.transferCount).to.equal(0);
    expect(ticket.maxTransfers).to.equal(2);
  });

  it("blocks non-admin minting", async function () {
    const { contract, fanA, attacker } = await deployFixture();

    const now = await time.latest();
    const matchDate = now + 24 * 60 * 60;

    await contract.createMatch(1, "MU", "CFC", "Old Trafford", matchDate, 0);

    await expect(
      contract.connect(attacker).mintTicket(fanA.address, 1001, 1, 1)
    ).to.be.reverted;
  });

  it("enforces transfer count limit", async function () {
    const { contract, fanA, fanB, admin } = await deployFixture();

    const now = await time.latest();
    const matchDate = now + 24 * 60 * 60;

    await contract.createMatch(1, "MU", "AFC", "Old Trafford", matchDate, 0);
    await contract.mintTicket(fanA.address, 1001, 1, 1);

    await contract.connect(fanA).transferFrom(fanA.address, fanB.address, 1001);
    expect(await contract.ownerOf(1001)).to.equal(fanB.address);

    await expect(
      contract.connect(fanB).transferFrom(fanB.address, admin.address, 1001)
    ).to.be.revertedWithCustomError(contract, "TransferLimitReached");
  });

  it("marks ticket as used and rejects second check-in", async function () {
    const { contract, fanA, gate } = await deployFixture();

    const now = await time.latest();
    const matchDate = now + 24 * 60 * 60;

    await contract.createMatch(1, "MU", "AFC", "Old Trafford", matchDate, 0);
    await contract.mintTicket(fanA.address, 1001, 1, 2);

    await contract.connect(gate).markTicketAsUsed(1001);
    const ticket = await contract.getTicket(1001);
    expect(ticket.status).to.equal(1);

    await expect(
      contract.connect(gate).markTicketAsUsed(1001)
    ).to.be.revertedWithCustomError(contract, "TicketAlreadyUsed");
  });

  it("revoked ticket fails verification", async function () {
    const { contract, fanA } = await deployFixture();

    const now = await time.latest();
    const matchDate = now + 24 * 60 * 60;

    await contract.createMatch(1, "MU", "AFC", "Old Trafford", matchDate, 0);
    await contract.mintTicket(fanA.address, 1001, 1, 2);
    await contract.revokeTicket(1001);

    const verification = await contract.verifyTicket(1001, fanA.address);
    expect(verification[0]).to.equal(false);
    expect(verification[1]).to.equal(2);
  });

  it("tracks ownership history", async function () {
    const { contract, fanA, fanB, admin } = await deployFixture();

    const now = await time.latest();
    const matchDate = now + 24 * 60 * 60;

    await contract.createMatch(1, "MU", "AFC", "Old Trafford", matchDate, 0);
    await contract.mintTicket(fanA.address, 1001, 1, 3);

    await contract.connect(fanA).transferFrom(fanA.address, fanB.address, 1001);
    await contract.connect(fanB).transferFrom(fanB.address, admin.address, 1001);

    const history = await contract.getOwnershipHistory(1001);
    expect(history).to.deep.equal([fanA.address, fanB.address, admin.address]);
  });
});
