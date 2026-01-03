import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { MemeBetArena } from "../target/types/memebet_arena";
import { expect } from "chai";

describe("Treasury Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MemeBetArena as Program<MemeBetArena>;
  const admin = provider.wallet.publicKey;

  it("Initialize treasury", async () => {
    // Derive treasury PDA
    const [treasuryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      program.programId
    );

    console.log("Treasury PDA:", treasuryPDA.toString());
    console.log("Admin:", admin.toString());

    // Initialize treasury
    const tx = await program.methods
      .initializeTreasury()
      .accounts({
        treasury: treasuryPDA,
        admin: admin,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Initialize treasury tx:", tx);

    // Verify treasury was created
    const treasuryAccount = await program.account.treasury.fetch(treasuryPDA);
    console.log("Treasury account:", treasuryAccount);

    expect(treasuryAccount.admin.toString()).to.equal(admin.toString());
    expect(treasuryAccount.totalFeesCollected.toString()).to.equal("0");
  });
});