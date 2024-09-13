import assert from "assert";
import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  TransactionSignature,
} from "@solana/web3.js";
import {
  createInitializeMintInstruction,
  TOKEN_2022_PROGRAM_ID,
  getMintLen,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
} from "@solana/spl-token";
import type { Splitter } from "../target/types/splitter";
import { IWallet } from "../client/client";

// Configuration
const CONFIG = {
  DECIMALS: 6,
  CONFIRMATION_COMMITMENT: "confirmed" as anchor.web3.Commitment,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
};

// Custom error types
class SolanaError extends Error {
  constructor(message: string, public txSignature?: string) {
    super(message);
    this.name = "SolanaError";
  }
}

// Helper functions
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retry<T>(operation: () => Promise<T>, maxRetries: number = CONFIG.MAX_RETRIES): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.log(`Attempt ${attempt} failed, retrying in ${CONFIG.RETRY_DELAY}ms...`);
      await sleep(CONFIG.RETRY_DELAY);
    }
  }
  throw new SolanaError("Max retries reached");
}

async function confirmTransaction(connection: Connection, signature: string): Promise<void> {
  const latestBlockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    signature: signature,
  }, CONFIG.CONFIRMATION_COMMITMENT);
}

// Main functions
async function airdrop(connection: Connection, destination: PublicKey): Promise<void> {
  const amount = 2 * LAMPORTS_PER_SOL;
  console.log(`Airdropping ${amount / LAMPORTS_PER_SOL} SOL to ${destination.toBase58()}`);

  await retry(async () => {
    const airdropSig = await connection.requestAirdrop(destination, amount);
    await confirmTransaction(connection, airdropSig);
    console.log("Airdrop successful");
  });
}

async function createMint(connection: Connection, sender: IWallet, mint: Keypair, decimals: number): Promise<void> {
  console.log(`Creating mint ${mint.publicKey.toBase58()}`);

  await retry(async () => {
    const mintLen = getMintLen([]);
    const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen);
    const mintTransaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: sender.publicKey,
        newAccountPubkey: mint.publicKey,
        space: mintLen,
        lamports: mintLamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mint.publicKey,
        decimals,
        sender.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      )
    );

    const latestBlockhash = await connection.getLatestBlockhash();
    mintTransaction.recentBlockhash = latestBlockhash.blockhash;
    mintTransaction.feePayer = sender.publicKey;

    mintTransaction.sign(mint);
    const signedMintTransaction = await sender.signTransaction(mintTransaction);
    const newTokenTx = await connection.sendRawTransaction(signedMintTransaction.serialize());
    await confirmTransaction(connection, newTokenTx);

    console.log("New Token Created:", newTokenTx);
  });
}

async function mintToOwner(connection: Connection, owner: IWallet, mint: Keypair, amount: number, decimals: number): Promise<PublicKey> {
  console.log(`Minting ${amount} tokens to owner ${owner.publicKey.toBase58()}`);

  return retry(async () => {
    const mintAmount = BigInt(amount * Math.pow(10, decimals));
    const fromAta = getAssociatedTokenAddressSync(mint.publicKey, owner.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

    const transaction = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        owner.publicKey,
        fromAta,
        owner.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createMintToInstruction(
        mint.publicKey,
        fromAta,
        owner.publicKey,
        mintAmount,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    const latestBlockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.feePayer = owner.publicKey;

    const signedMintTransaction = await owner.signTransaction(transaction);
    const mintSig = await connection.sendRawTransaction(signedMintTransaction.serialize());
    await confirmTransaction(connection, mintSig);
    console.log("Tokens Minted:", mintSig);

    return fromAta;
  });
}

async function createAtas(connection: Connection, owner: IWallet, mint: Keypair, pubKeys: Array<PublicKey>): Promise<PublicKey[]> {
  console.log(`Creating ATAs for ${pubKeys.length} accounts`);

  return retry(async () => {
    const associatedTokens = pubKeys.map(addr =>
      getAssociatedTokenAddressSync(mint.publicKey, addr, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
    );

    const transaction = new Transaction();
    associatedTokens.forEach((addr, i) => {
      transaction.add(createAssociatedTokenAccountIdempotentInstruction(
        owner.publicKey,
        addr,
        pubKeys[i],
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ));
    });

    const latestBlockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.feePayer = owner.publicKey;

    const signedTransaction = await owner.signTransaction(transaction);
    const txHash = await connection.sendRawTransaction(signedTransaction.serialize());
    await confirmTransaction(connection, txHash);
    console.log("ATAs created:", associatedTokens.map(ata => ata.toBase58()));

    return associatedTokens;
  });
}

async function sendToAll(
  connection: Connection,
  program: Program<Splitter>,
  payer: IWallet,
  mint: Keypair,
  amount: number,
  decimals: number,
  fromAta: PublicKey,
  toAtas: PublicKey[]
): Promise<TransactionSignature> {
  console.log(`Sending ${amount} tokens to ${toAtas.length} accounts`);

  return retry(async () => {
    const data = new BN(amount * Math.pow(10, decimals));
    const tx = await program.methods
      .sendToAll(data)
      .accounts({
        from: fromAta,
        authority: payer.publicKey,
        mint: mint.publicKey,
      })
      .remainingAccounts(toAtas.map(addr => ({
        pubkey: addr,
        isSigner: false,
        isWritable: true,
      })))
      .transaction();

    const latestBlockhash = await connection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = payer.publicKey;
    const signedTransaction = await payer.signTransaction(tx);

    const txHash = await connection.sendRawTransaction(signedTransaction.serialize());
    await confirmTransaction(connection, txHash);
    console.log(`Transaction confirmed: ${txHash}`);
    return txHash;
  });
}

describe("Splitter", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Splitter as Program<Splitter>;

  it("sends SPL tokens", async () => {
    const connection = program.provider.connection;
    const payerWallet = provider.wallet;

    const toKp = Keypair.generate();
    const toKp2 = Keypair.generate();
    const mint = Keypair.generate();

    try {
      // Uncomment if you need SOL airdropped:
      // await airdrop(connection, payerWallet.publicKey);

      await createMint(connection, payerWallet, mint, CONFIG.DECIMALS);
      console.log("Mint created:", mint.publicKey.toBase58());

      const mintInfo = await connection.getTokenSupply(mint.publicKey);
      console.log("Mint info:", mintInfo);

      const amountToMint = 1000;
      const fromAta = await mintToOwner(connection, payerWallet, mint, amountToMint, CONFIG.DECIMALS);

      const toAtas = await createAtas(connection, payerWallet, mint, [toKp.publicKey, toKp2.publicKey]);

      const amount = 4;
      await sendToAll(connection, program, payerWallet, mint, amount, CONFIG.DECIMALS, fromAta, toAtas);

      // Assert tokens were sent
      const fromAtaBalance = await connection.getTokenAccountBalance(fromAta);
      assert.strictEqual(fromAtaBalance.value.uiAmount, amountToMint - (amount * toAtas.length));

      // Assert tokens were received
      for (const addr of toAtas) {
        const ataBalance = await connection.getTokenAccountBalance(addr);
        assert.strictEqual(ataBalance.value.uiAmount, amount);
      }

      console.log("Test completed successfully");
    } catch (error) {
      console.error("Test failed:", error);
      throw error;
    }
  });
});
