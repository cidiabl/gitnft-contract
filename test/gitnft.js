const GitNFT = artifacts.require("GitNFT");

const ethUtil = require("ethereumjs-util");
const { TypedDataUtils, concatSig } = require("eth-sig-util");

const CID = require("cids");

const types = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
  Mint: [
    { name: "to", type: "address" },
    { name: "tokenId", type: "uint256" },
    { name: "tokenCID", type: "bytes" },
  ],
  MetaTransaction: [
    { name: "nonce", type: "uint256" },
    { name: "from", type: "address" },
    { name: "functionSignature", type: "bytes" },
  ],
};

contract("GitNFT", (accounts) => {
  const adminAccount = accounts[0];
  const minterAccount = accounts[0];
  const proxyAddress = accounts[8];
  const offlineMinter = web3.eth.accounts.create();

  let token;
  let domain;
  let chainId;

  beforeEach(async () => {
    const contractCID = new CID(
      "bafybeig6xv5nwphfmvcnektpnojts33jqcuam7bmye2pb54adnrtccjlsu"
    );

    token = await GitNFT.new(
      "ipfs://",
      "https://gitnft.io/",
      "0x" + Buffer.from(contractCID.bytes).toString("hex")
    );

    chainId = await web3.eth.getChainId();
    assert.equal(1337, chainId);

    domain = {
      name: "GitNFT",
      version: "1",
      chainId,
      verifyingContract: token.address,
    };
  });

  it("owner", async () => {
    assert.equal(adminAccount, await token.owner());
  });

  it("supports ERC721", async () => {
    assert.equal(true, await token.supportsInterface("0x80ac58cd"));
  });

  it("name", async () => {
    assert.equal("GitNFT", await token.name());
  });

  it("symbol", async () => {
    assert.equal("SHA", await token.symbol());
  });

  it("contractURI", async () => {
    assert.equal(
      "ipfs://bafybeig6xv5nwphfmvcnektpnojts33jqcuam7bmye2pb54adnrtccjlsu",
      await token.contractURI()
    );
  });

  it("set contractURI", async () => {
    const contractCID = new CID(
      "bafybeig6xv5nwphfmvcnektpnojts33jqcuam7bmye2pb54adnrtccjlsa"
    );

    await token.setContractCID(
      "0x" + Buffer.from(contractCID.bytes).toString("hex")
    );

    assert.equal(
      "ipfs://bafybeig6xv5nwphfmvcnektpnojts33jqcuam7bmye2pb54adnrtccjlsa",
      await token.contractURI()
    );
  });

  describe("mint", () => {
    it("from minter", async () => {
      await token.mint(
        accounts[4],
        "0x47de970443216b23ea3e06b897db3bbdde6183cf",
        "0x00",
        { from: minterAccount }
      );

      assert.equal(
        accounts[4],
        await token.ownerOf("0x47de970443216b23ea3e06b897db3bbdde6183cf")
      );
    });

    it("invalid git sha1", async () => {
      await assertThrows(async () => {
        await token.mint(
          accounts[0],
          "0xfffffffffffffffffffffffffffffffffffffffff",
          "0x00"
        );
      }, "invalid git sha1");
    });
  });

  async function signTypedData(primaryType, message, signer) {
    const data = { domain, primaryType, message, types };
    const hash = TypedDataUtils.sign(data);
    const privateKeyBuffer = Buffer.from(signer.privateKey.substring(2), "hex");
    const sig = ethUtil.ecsign(hash, privateKeyBuffer);
    const signature = ethUtil.bufferToHex(concatSig(sig.v, sig.r, sig.s));
    const result = {
      hash: ethUtil.bufferToHex(hash),
      signature,
      r: ethUtil.bufferToHex(sig.r),
      s: ethUtil.bufferToHex(sig.s),
      v: "0x" + sig.v.toString(16),
    };

    return result;
  }

  describe("mint (signed)", () => {
    beforeEach(async () => {
      const role = await token.MINTER_ROLE();
      await token.grantRole(role, offlineMinter.address);
    });

    it("valid signature to specific address", async () => {
      const sig = await signTypedData(
        "Mint",
        {
          to: accounts[4],
          tokenId: "0x47de970443216b23ea3e06b897db3bbdde6183cf",
          tokenCID: "0x00",
        },
        offlineMinter
      );

      await token.methods[
        "mint(address,uint256,bytes,uint8,bytes32,bytes32)"
      ](
        accounts[4],
        "0x47de970443216b23ea3e06b897db3bbdde6183cf",
        "0x00",
        sig.v,
        sig.r,
        sig.s,
        { from: accounts[4] }
      );

      assert.equal(
        accounts[4],
        await token.ownerOf("0x47de970443216b23ea3e06b897db3bbdde6183cf")
      );
    });

    it("valid signature to specific address by another user", async () => {
      const sig = await signTypedData(
        "Mint",
        {
          to: accounts[4],
          tokenId: "0x47de970443216b23ea3e06b897db3bbdde6183cf",
          tokenCID: "0x00",
        },
        offlineMinter
      );

      await token.methods[
        "mint(address,uint256,bytes,uint8,bytes32,bytes32)"
      ](
        accounts[4],
        "0x47de970443216b23ea3e06b897db3bbdde6183cf",
        "0x00",
        sig.v,
        sig.r,
        sig.s,
        { from: accounts[5] }
      );

      assert.equal(
        accounts[4],
        await token.ownerOf("0x47de970443216b23ea3e06b897db3bbdde6183cf")
      );
    });

    it("valid signature to wrong address", async () => {
      const sig = await signTypedData(
        "Mint",
        {
          to: accounts[5],
          tokenId: "0x47de970443216b23ea3e06b897db3bbdde6183cf",
          tokenCID: "0x00",
        },
        offlineMinter
      );

      await assertThrows(async () => {
        await token.methods[
          "mint(address,uint256,bytes,uint8,bytes32,bytes32)"
        ](
          accounts[4],
          "0x47de970443216b23ea3e06b897db3bbdde6183cf",
          "0x00",
          sig.v,
          sig.r,
          sig.s,
          { from: accounts[4] }
        );
      }, "signer must have minter role to mint");
    });
  });

  describe("tokenURI", () => {
    beforeEach(async () => {
      const role = await token.MINTER_ROLE();
      await token.grantRole(role, offlineMinter.address);
    });

    it("minted", async () => {
      await token.mint(
        accounts[0],
        "0x47de970443216b23ea3e06b897db3bbdde6183cf",
        "0x00"
      );

      assert.equal(
        "https://gitnft.io/47de970443216b23ea3e06b897db3bbdde6183cf.json",
        await token.tokenURI("0x47de970443216b23ea3e06b897db3bbdde6183cf")
      );
    });

    it("nonexistent", async () => {
      await assertThrows(async () => {
        await token.tokenURI("0x47de970443216b23ea3e06b897db3bbdde6183cf");
      }, "URI query for nonexistent token");
    });

    it("mint with update CID", async () => {
      const cid = new CID(
        "bafybeig6xv5nwphfmvcnektpnojts33jqcuam7bmye2pb54adnrtccjlsu"
      );
      const cidBytes = "0x" + Buffer.from(cid.bytes).toString("hex");

      const sig = await signTypedData(
        "Mint",
        {
          to: accounts[4],
          tokenId: "0x47de970443216b23ea3e06b897db3bbdde6183cf",
          tokenCID: cidBytes,
        },
        offlineMinter
      );

      await token.methods["mint(address,uint256,bytes,uint8,bytes32,bytes32)"](
        accounts[4],
        "0x47de970443216b23ea3e06b897db3bbdde6183cf",
        cidBytes,
        sig.v,
        sig.r,
        sig.s
      );

      assert.equal(
        "ipfs://bafybeig6xv5nwphfmvcnektpnojts33jqcuam7bmye2pb54adnrtccjlsu",
        await token.tokenURI("0x47de970443216b23ea3e06b897db3bbdde6183cf")
      );
    });

    it("minter can update CID", async () => {
      await token.mint(
        accounts[0],
        "0x47de970443216b23ea3e06b897db3bbdde6183cf",
        "0x00"
      );

      const cid = new CID(
        "bafybeig6xv5nwphfmvcnektpnojts33jqcuam7bmye2pb54adnrtccjlsu"
      );

      await token.setTokenCID(
        "0x47de970443216b23ea3e06b897db3bbdde6183cf",
        "0x" + Buffer.from(cid.bytes).toString("hex")
      );

      assert.equal(
        "ipfs://bafybeig6xv5nwphfmvcnektpnojts33jqcuam7bmye2pb54adnrtccjlsu",
        await token.tokenURI("0x47de970443216b23ea3e06b897db3bbdde6183cf")
      );

      it("update baseURI", async () => {
        await token.mint(
          accounts[0],
          "0x47de970443216b23ea3e06b897db3bbdde6183cf",
          "0x00"
        );

        assert.equal(
          "https://gitnft.io/47de970443216b23ea3e06b897db3bbdde6183cf.json",
          await token.tokenURI("0x47de970443216b23ea3e06b897db3bbdde6183cf")
        );

        await token.setBaseURI("https://metadata.gitnft.io/");

        assert.equal(
          "https://metadata.gitnft.io/47de970443216b23ea3e06b897db3bbdde6183cf.json",
          await token.baseURI()
        );
      });
    });
  });

  describe("burn", async () => {
    it("owner can destroy their token", async () => {
      await token.mint(
        accounts[0],
        "0x47de970443216b23ea3e06b897db3bbdde6183cf",
        "0x00"
      );

      assert.equal(
        accounts[0],
        await token.ownerOf("0x47de970443216b23ea3e06b897db3bbdde6183cf")
      );

      await token.burn("0x47de970443216b23ea3e06b897db3bbdde6183cf");

      await assertThrows(async () => {
        await token.ownerOf("0x47de970443216b23ea3e06b897db3bbdde6183cf");
      }, "owner query for nonexistent token");
    });

    it("clears token uri storage", async () => {
      await token.mint(
        accounts[0],
        "0x47de970443216b23ea3e06b897db3bbdde6183cf",
        "0x00"
      );

      const cid = new CID(
        "bafybeig6xv5nwphfmvcnektpnojts33jqcuam7bmye2pb54adnrtccjlsu"
      );

      await token.setTokenCID(
        "0x47de970443216b23ea3e06b897db3bbdde6183cf",
        "0x" + Buffer.from(cid.bytes).toString("hex")
      );

      assert.equal(
        "ipfs://bafybeig6xv5nwphfmvcnektpnojts33jqcuam7bmye2pb54adnrtccjlsu",
        await token.tokenURI("0x47de970443216b23ea3e06b897db3bbdde6183cf")
      );

      await token.burn("0x47de970443216b23ea3e06b897db3bbdde6183cf");

      await token.mint(
        accounts[0],
        "0x47de970443216b23ea3e06b897db3bbdde6183cf",
        "0x00"
      );

      assert.equal(
        "https://gitnft.io/47de970443216b23ea3e06b897db3bbdde6183cf.json",
        await token.tokenURI("0x47de970443216b23ea3e06b897db3bbdde6183cf")
      );
    });
  });

  describe("Pausable", async () => {
    it("pauses minting", async () => {
      await token.pause();

      await assertThrows(async () => {
        await token.mint(
          accounts[0],
          "0x47de970443216b23ea3e06b897db3bbdde6183cf",
          "0x00"
        );
      }, "token transfer while paused");

      await token.unpause();

      await token.mint(
        accounts[0],
        "0x47de970443216b23ea3e06b897db3bbdde6183cf",
        "0x00"
      );
    });

    it("pauses transfers", async () => {
      await token.mint(
        accounts[0],
        "0x47de970443216b23ea3e06b897db3bbdde6183cf",
        "0x00"
      );

      await token.pause();

      await assertThrows(async () => {
        await token.safeTransferFrom(
          accounts[0],
          accounts[1],
          "0x47de970443216b23ea3e06b897db3bbdde6183cf"
        );
      }, "token transfer while paused");

      await token.unpause();

      await token.safeTransferFrom(
        accounts[0],
        accounts[1],
        "0x47de970443216b23ea3e06b897db3bbdde6183cf"
      );
    });
  });

  describe("Meta Transactions", () => {
    beforeEach(async () => {
      const role = await token.MINTER_ROLE();
      await token.grantRole(role, offlineMinter.address);
    });

    it("mint via minter signature", async () => {
      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          name: "mint",
          type: "function",
          inputs: [
            {
              type: "address",
              name: "to",
            },
            {
              type: "uint256",
              name: "tokenId",
            },
            {
              type: "bytes",
              name: "tokenCID",
            },
          ],
        },
        [accounts[4], "0x47de970443216b23ea3e06b897db3bbdde6183cf", "0x00"]
      );

      const sig = await signTypedData(
        "MetaTransaction",
        {
          nonce: "0x00",
          from: offlineMinter.address,
          functionSignature: ethUtil.toBuffer(functionSignature),
        },
        offlineMinter
      );

      await token.executeMetaTransaction(
        offlineMinter.address,
        functionSignature,
        sig.r,
        sig.s,
        sig.v,
        { from: accounts[4] }
      );

      assert.equal(
        accounts[4],
        await token.ownerOf("0x47de970443216b23ea3e06b897db3bbdde6183cf")
      );
    });

    it("setApprovalForAll", async function () {
      const ownerAccount = web3.eth.accounts.create();
      const operatorAccount = web3.eth.accounts.create();

      const setApprovalForAll = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: "address",
              name: "operator",
              type: "address",
            },
            {
              internalType: "bool",
              name: "approved",
              type: "bool",
            },
          ],
          name: "setApprovalForAll",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
        [operatorAccount.address, true]
      );

      const sig = await signTypedData(
        "MetaTransaction",
        {
          nonce: "0x00",
          from: ownerAccount.address,
          functionSignature: ethUtil.toBuffer(setApprovalForAll),
        },
        ownerAccount
      );

      assert.equal(
        false,
        await token.isApprovedForAll(
          ownerAccount.address,
          operatorAccount.address
        )
      );

      await token.executeMetaTransaction(
        ownerAccount.address,
        setApprovalForAll,
        sig.r,
        sig.s,
        sig.v,
        { from: accounts[4] }
      );

      assert.equal(
        true,
        await token.isApprovedForAll(
          ownerAccount.address,
          operatorAccount.address
        )
      );
    });

    it("bad signature", async () => {
      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          name: "mint",
          type: "function",
          inputs: [
            {
              type: "address",
              name: "to",
            },
            {
              type: "uint256",
              name: "tokenId",
            },
          ],
        },
        [accounts[4], "0x47de970443216b23ea3e06b897db3bbdde6183cf"]
      );

      await assertThrows(async () => {
        await token.executeMetaTransaction(
          offlineMinter.address,
          functionSignature,
          "0x00",
          "0x00",
          "0x00",
          { from: accounts[4] }
        );
      }, "ECDSA: invalid signature 'v' value");
    });
  });

  describe("Proxy Transfers", () => {
    beforeEach(async () => {
      const role = await token.OPERATOR_ROLE();
      await token.grantRole(role, proxyAddress);
    });

    it("approved operator can safe transfer", async () => {
      await token.mint(
        accounts[1],
        "0x47de970443216b23ea3e06b897db3bbdde6183cf",
        "0x00",
        { from: minterAccount }
      );

      assert.equal(
        accounts[1],
        await token.ownerOf("0x47de970443216b23ea3e06b897db3bbdde6183cf")
      );

      assert.equal(
        true,
        await token.isApprovedForAll(accounts[1], proxyAddress)
      );

      await token.transferFrom(
        accounts[1],
        accounts[2],
        "0x47de970443216b23ea3e06b897db3bbdde6183cf",
        { from: proxyAddress }
      );

      assert.equal(
        accounts[2],
        await token.ownerOf("0x47de970443216b23ea3e06b897db3bbdde6183cf")
      );
    });
  });

  it("implode", async () => {
    await token.implode();
  });
});

async function assertThrows(afn, ...rest) {
  let fn;
  try {
    const value = await afn();
    fn = () => {
      return value;
    };
  } catch (error) {
    fn = () => {
      throw error;
    };
  }
  return assert.throws(fn, ...rest);
}
