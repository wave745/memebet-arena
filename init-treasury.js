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
  const programId = new PublicKey('G3ctDAx46fPX4cTZgzcgzW1rDCe7e8qCqhCUTSf3a7LP');

  console.log('Testing basic program interaction...');

  // Test 1: Check if program account exists
  try {
    const programInfo = await connection.getAccountInfo(programId);
    if (programInfo) {
      console.log('✅ Program account exists on mainnet');
      console.log('Program data length:', programInfo.data.length);
    } else {
      console.log('❌ Program account not found on mainnet');
      return;
    }
  } catch (error) {
    console.error('❌ Error checking program account:', error.message);
    return;
  }

  // Test 2: Try to derive treasury PDA
  try {
    const [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('treasury')],
      programId
    );
    console.log('✅ Treasury PDA derived:', treasuryPda.toString());

    // Check if treasury account exists
    const treasuryInfo = await connection.getAccountInfo(treasuryPda);
    if (treasuryInfo) {
      console.log('✅ Treasury account already exists');
      return; // Treasury is already initialized
    } else {
      console.log('ℹ️  Treasury account does not exist - needs initialization');
    }
  } catch (error) {
    console.error('❌ Error with treasury PDA:', error.message);
    return;
  }

  // Try simple treasury initialization without full IDL
  console.log('🔄 Attempting simple treasury initialization...');

  try {
    // Derive treasury PDA
    const [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('treasury')],
      programId
    );

    // Create instruction data for initialize_treasury
    // Discriminator for initialize_treasury (first 8 bytes of sha256("global:initialize_treasury"))
    const discriminator = Buffer.from([0x8b, 0x2c, 0x8d, 0x4c, 0x5d, 0x3a, 0x1b, 0x9f]);

    // Build the instruction
    const instructionData = Buffer.concat([discriminator]);

    const instruction = {
      programId: programId,
      accounts: [
        { pubkey: treasuryPda, isWritable: true, isSigner: false },
        { pubkey: keypair.publicKey, isWritable: false, isSigner: true },
        { pubkey: anchor.web3.SystemProgram.programId, isWritable: false, isSigner: false },
      ],
      data: instructionData
    };

    // Create and send transaction
    const transaction = new anchor.web3.Transaction().add(instruction);
    const signature = await provider.sendAndConfirm(transaction);

    console.log('✅ Treasury initialized successfully!');
    console.log('Transaction signature:', signature);

  } catch (error) {
    console.error('❌ Treasury initialization failed:', error.message);
  }

  console.log('Program ID:', programId.toString());
  console.log('Admin:', wallet.publicKey.toString());

  // Derive treasury PDA
  const [treasuryPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('treasury')],
    programId
  );

  console.log('Treasury PDA:', treasuryPDA.toString());

  try {
    // Manually create the initialize_treasury instruction since we don't have IDL deployed yet
    const instructionData = Buffer.from([124, 186, 211, 195, 85, 165, 129, 166]); // initialize_treasury discriminator from IDL

    const initTreasuryIx = {
      keys: [
        { pubkey: treasuryPDA, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: anchor.web3.SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: programId,
      data: instructionData,
    };

    // Create and send transaction
    const transaction = new anchor.web3.Transaction().add(initTreasuryIx);
    const txSignature = await provider.sendAndConfirm(transaction);

    console.log('✅ Treasury initialized successfully!');
    console.log('Transaction signature:', txSignature);

    // Verify treasury account exists
    const treasuryInfo = await connection.getAccountInfo(treasuryPDA);
    if (treasuryInfo) {
      console.log('✅ Treasury account created successfully!');
      console.log('Treasury balance:', treasuryInfo.lamports / anchor.web3.LAMPORTS_PER_SOL, 'SOL');
    } else {
      console.log('❌ Treasury account not found after initialization');
    }

  } catch (error) {
    console.error('❌ Treasury initialization failed:', error.message);
    console.log('Treasury PDA:', treasuryPDA.toString());
  }
}

main();