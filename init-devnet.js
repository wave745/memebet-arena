const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');

async function main() {
  // Connect to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // Load the keypair from WSL path
  const keypairPath = '/home/caesa/.config/solana/id.json';
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));

  console.log('Admin:', keypair.publicKey.toString());

  // Program ID
  const programId = new PublicKey('G3ctDAx46fPX4cTZgzcgzW1rDCe7e8qCqhCUTSf3a7LP');

  // Derive treasury PDA
  const [treasuryPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('treasury')],
    programId
  );

  console.log('Treasury PDA:', treasuryPDA.toString());

  // Check if treasury already exists
  const treasuryAccount = await connection.getAccountInfo(treasuryPDA);
  if (treasuryAccount) {
    console.log('Treasury already exists!');
    return;
  }

  // Create initialize treasury instruction
  // Discriminator for initialize_treasury: [124, 186, 211, 195, 85, 165, 129, 166]
  const discriminator = Buffer.from([124, 186, 211, 195, 85, 165, 129, 166]);

  // Create the instruction data
  const instructionData = Buffer.concat([discriminator]);

  // Create the transaction
  const transaction = new Transaction().add({
    keys: [
      { pubkey: treasuryPDA, isSigner: false, isWritable: true },
      { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data: instructionData,
  });

  // Sign and send
  console.log('Sending transaction...');
  const signature = await connection.sendTransaction(transaction, [keypair]);
  console.log('Initialize treasury tx:', signature);

  // Confirm
  console.log('Waiting for confirmation...');
  await connection.confirmTransaction(signature);
  console.log('Treasury initialized successfully!');
}

main().catch(console.error);
