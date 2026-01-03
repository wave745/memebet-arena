const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const fs = require('fs');

async function main() {
  // Connect to mainnet
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

  // Load the keypair
  const keypairPath = '/home/caesa/.config/solana/id.json';
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
  const wallet = new anchor.Wallet(keypair);

  // Create provider
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });

  // Set provider
  anchor.setProvider(provider);

  // Program ID
  const programId = new PublicKey('Cm9MuUJsHtR5hgcp19KPX9HNu1wXmbTAg3t7a11zVGUb');

  // Create program instance
  const idl = JSON.parse(fs.readFileSync('./target/idl/memebet_arena.json', 'utf8'));
  const program = new anchor.Program(idl, programId, provider);

  console.log('Program ID:', programId.toString());
  console.log('Admin:', wallet.publicKey.toString());

  // Derive treasury PDA
  const [treasuryPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('treasury')],
    programId
  );

  console.log('Treasury PDA:', treasuryPDA.toString());

  try {
    // Initialize treasury
    const tx = await program.methods
      .initializeTreasury()
      .accounts({
        treasury: treasuryPDA,
        admin: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log('Initialize treasury tx:', tx);

    // Verify treasury was created
    const treasuryAccount = await program.account.treasury.fetch(treasuryPDA);
    console.log('Treasury initialized successfully!');
    console.log('Treasury admin:', treasuryAccount.admin.toString());
    console.log('Total fees collected:', treasuryAccount.totalFeesCollected.toString());

  } catch (error) {
    console.error('Error initializing treasury:', error);
  }
}

main();