import {
  AnchorProvider,
  Program,
  setProvider,
  workspace,
} from "@coral-xyz/anchor";
import BN from "bn.js";
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import type { Splitter } from "../target/types/splitter";

const AMOUNT = 90; // Adjust amount based on your needs
const decimals = 6;

// Anchor does not export this wallet interface from their provider
// so we will create it here for our usage
export interface IWallet {
  signTransaction<T extends Transaction | VersionedTransaction>(
    tx: T
  ): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(
    txs: T[]
  ): Promise<T[]>;
  publicKey: PublicKey;
}

// get the highest current priority fee for the given accounts
const getHighestCurrentPriorityFee = async (
  connection: Connection,
  writableAccounts: PublicKey[]
): Promise<number> => {
  const priorityFees = await connection.getRecentPrioritizationFees({
    lockedWritableAccounts: writableAccounts,
  });
  // get the highest priority fee
  return priorityFees.reduce((acc, fee) => {
    return fee.prioritizationFee > acc ? fee.prioritizationFee : acc;
  }, 0);
};

// add the priority fee to the instruction
const addPriorityFeeToInstructions = (
  instructions: TransactionInstruction[],
  priorityFee: number
): Array<TransactionInstruction> => {
  const computeUnitInstruction = ComputeBudgetProgram.setComputeUnitLimit({
    units: 2_000_000, // default to 2M
  });
  const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: priorityFee,
  });
  return [computeUnitInstruction, priorityFeeInstruction, ...instructions];
};

// sign and build the transaction
const signAndBuildTransaction = async (
  payer: IWallet,
  instructions: Array<TransactionInstruction>,
  blockhash: string
): Promise<VersionedTransaction> => {
  const messageV0 = new TransactionMessage({
    instructions: instructions,
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
  }).compileToV0Message();
  const transaction = new VersionedTransaction(messageV0);
  return await payer.signTransaction(transaction);
};

const sleep = async (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// sign and send the transaction until it is confirmed
// this is necessary because of occassional mainnet congestion
const signAndSendTransactionUntilConfirmed = async (
  connection: Connection,
  senderKeypair: IWallet,
  instructions: Array<TransactionInstruction>
): Promise<string> => {
  let latestBlockhash = await connection.getLatestBlockhash("confirmed");
  const transaction = await signAndBuildTransaction(
    senderKeypair,
    instructions,
    latestBlockhash.blockhash
  );

  let txHash: string;
  let loggedSendMessage = false;
  while (true) {
    try {
      txHash = await connection.sendTransaction(transaction, {
        skipPreflight: true,
        preflightCommitment: "confirmed",
        maxRetries: 0,
      });
      if (!loggedSendMessage) {
        console.log("sending transaction", txHash);
        loggedSendMessage = true;
      }
      const sigStatus = await connection.getSignatureStatus(txHash);
      if (!sigStatus.value) {
        sleep(200);
        continue;
      }
      if (sigStatus.value?.err) {
        throw new Error(
          `Transaction failed with error: ${sigStatus.value.err.toString()}`
        );
      }
      console.log("Transaction confirmed: ", txHash);
      break;
    } catch (e) {
      console.error(e.message);
      // keep going
      console.log("Retrying transaction with new blockhash...");
      return await signAndSendTransactionUntilConfirmed(
        connection,
        senderKeypair,
        instructions
      );
    }
  }
  console.log("Transaction confirmed: ", txHash);
  return txHash;
};

// get the PYUSD mint address for the given environment
const getMintForEnv = (env: string): PublicKey => {
  switch (env) {
    case "devnet":
      return new PublicKey("CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM");
    case "mainnet":
      return new PublicKey("2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo");
    default:
      throw new Error("Invalid environment");
  }
};

// get the environment from the command line arguments
const getEnvFromArgs = (args: string[]): string => {
  if (args.length > 0) {
    if (args[0] !== "mainnet" && args[0] !== "devnet" && args[0] !== "local") {
      throw new Error("Invalid environment. Use 'mainnet' or 'devnet'");
    }
    return args[0];
  }
  return "devnet";
};

async function setupEnvironment(args: string[]): Promise<{
  env: string;
  provider: AnchorProvider;
  program: Program<Splitter>;
  payerWallet: IWallet;
}> {
  console.log("Setting up environment...");
  const env = getEnvFromArgs(args);
  console.log(`Environment: ${env}`);
  
  const provider = AnchorProvider.env();
  provider.opts.preflightCommitment = "confirmed";
  provider.opts.commitment = "confirmed";
  provider.opts.skipPreflight = true;
  setProvider(provider);
  console.log("Connection established to cluster");

  const payerWallet = provider.wallet;
  console.log(`Payer public key: ${payerWallet.publicKey.toString()}`);

  const program = workspace.Splitter as Program<Splitter>;
  console.log(`Program ID: ${program.rawIdl.address.toString()}`);

  console.log("Environment setup complete");
  return { env, provider, program, payerWallet };
}

async function createRecipientATAs(
  connection: Connection,
  payerWallet: IWallet,
  mintAddress: PublicKey,
  recipientAddresses: string[]
): Promise<PublicKey[]> {
  console.log("Creating Associated Token Accounts (ATAs) for recipients...");
  const senderAta = getAssociatedTokenAddressSync(
    mintAddress,
    payerWallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  console.log(`Sender ATA: ${senderAta.toString()}`);

  const priorityFeeForAta = await getHighestCurrentPriorityFee(connection, [senderAta]);
  console.log(`Priority fee for ATA creation: ${priorityFeeForAta}`);

  const recipientAtas = recipientAddresses.map(addr => 
    getAssociatedTokenAddressSync(
      mintAddress,
      new PublicKey(addr),
      false,
      TOKEN_2022_PROGRAM_ID
    )
  );
  console.log(`Number of recipient ATAs to create: ${recipientAtas.length}`);

  const createATAInstructions = recipientAtas.map((ata, i) => 
    createAssociatedTokenAccountIdempotentInstruction(
      payerWallet.publicKey,
      ata,
      new PublicKey(recipientAddresses[i]),
      mintAddress,
      TOKEN_2022_PROGRAM_ID
    )
  );

  const createATAInstructionsWithPriorityFee = addPriorityFeeToInstructions(
    createATAInstructions,
    priorityFeeForAta
  );

  console.log("Sending transaction to create ATAs...");
  await signAndSendTransactionUntilConfirmed(
    connection,
    payerWallet,
    createATAInstructionsWithPriorityFee
  );

  console.log("All ATAs created successfully");
  recipientAtas.forEach((ata, index) => {
    console.log(`Recipient ${index + 1} ATA: ${ata.toString()}`);
  });
  return recipientAtas;
}

async function sendTokensToAll(
  connection: Connection,
  program: Program<Splitter>,
  payerWallet: IWallet,
  mintAddress: PublicKey,
  senderAta: PublicKey,
  recipientAtas: PublicKey[],
  amount: number,
  decimals: number
): Promise<string> {
  console.log("Preparing to send tokens to all recipients...");
  const destinationAtas = recipientAtas.map(addr => ({
    pubkey: new PublicKey(addr),
    isSigner: false,
    isWritable: true,
  }));

  const bnAmount = new BN(amount * Math.pow(10, decimals));
  console.log(`Amount to send per recipient: ${amount} tokens (${bnAmount.toString()} base units)`);

  console.log("Creating sendToAll instruction...");
  const sendToAllInstruction = await program.methods
    .sendToAll(bnAmount)
    .accounts({
      from: senderAta,
      authority: payerWallet.publicKey,
      mint: mintAddress,
    })
    .remainingAccounts(destinationAtas)
    .instruction();

  const priorityFeeForSendToAll = await getHighestCurrentPriorityFee(
    connection,
    sendToAllInstruction.keys.map((key) => key.pubkey)
  );
  console.log(`Priority fee for 'send to all' operation: ${priorityFeeForSendToAll}`);

  const instructions = addPriorityFeeToInstructions(
    [sendToAllInstruction],
    priorityFeeForSendToAll
  );

  console.log("Sending transaction to distribute tokens...");
  const txHash = await signAndSendTransactionUntilConfirmed(
    connection,
    payerWallet,
    instructions
  );
  console.log("Token distribution transaction sent");
  return txHash;
}

async function main() {
  console.log("Starting token distribution script...");
  try {
    const { env, provider, program, payerWallet } = await setupEnvironment(process.argv.slice(2));

    const MINT_ADDRESS = getMintForEnv(env);
    console.log(`PYUSD Mint Address: ${MINT_ADDRESS.toString()}`);

    const RECIPIENT_ADDRESSES = [
      // add addresses here
    ];
    console.log(`Number of recipients: ${RECIPIENT_ADDRESSES.length}`);

    const senderAta = getAssociatedTokenAddressSync(
      MINT_ADDRESS,
      payerWallet.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    console.log(`Sender's Associated Token Account: ${senderAta.toString()}`);

    const recipientAtas = await createRecipientATAs(
      provider.connection,
      payerWallet,
      MINT_ADDRESS,
      RECIPIENT_ADDRESSES
    );

    console.log("Initiating token distribution...");
    const txHash = await sendTokensToAll(
      provider.connection,
      program,
      payerWallet,
      MINT_ADDRESS,
      senderAta,
      recipientAtas,
      AMOUNT,
      decimals
    );

    console.log(`Token distribution completed successfully`);
    console.log(`Transaction signature: ${txHash}`);
    console.log(`Use 'solana confirm -v ${txHash}' to view transaction details`);
  } catch (error) {
    console.error("An error occurred during token distribution:");
    console.error(error);
  }
  console.log("Script execution completed");
}

main().catch(console.error);
