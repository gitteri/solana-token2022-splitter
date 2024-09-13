# Solana Workshop: Integrating and Developing with PYUSD

Welcome to our hands-on workshop focused on developing Solana programs using PayPal's PYUSD stablecoin. This workshop will guide you through the process of working with a token extensions (token-2022) mint, building, testing, and deploying a Solana program, as well as handling a client that interacts with the deployed program.

## Introduction to PYUSD

PYUSD is a stablecoin issued by PayPal, designed to maintain a stable value relative to the US dollar. In this workshop, we'll be working with PYUSD on the Solana blockchain, leveraging Solana's speed and efficiency for transactions. If you need any devnet PYUSD, please visit [Paxos' PYUSD Faucet](https://faucet.paxos.com/).

## Token Extensions (Token-2022)

Token extensions, sometimes referred to as Token-2022, provide enhanced functionality for tokens on Solana. These extensions allow for features like transfer fees, interest-bearing tokens, and more. In this workshop, we'll be working a token that uses token extensions.

## Prerequisites Knowledge

Before starting this workshop, it's helpful to have a basic understanding of:
- Blockchain technology and cryptocurrencies
- Basic programming concepts
- JavaScript and/or Rust (depending on which parts you'll be focusing on)
- Command-line interface usage

Don't worry if you're not an expert in all these areas – the workshop is designed to guide you through the process!

## Quick Start

To get started quickly, we recommend using the Solana Playground examples instead of setting up your local environment. This allows you to focus on learning without worrying about setup complexities.

## Option 1: Using Solana Playground (Recommended for Beginners)

The Solana Playground is an online IDE that lets you write, deploy, and test Solana programs without local setup. This is the recommended way to follow along during the workshop for a seamless experience.

### Getting Started on Solana Playground

1. **Setting up your Wallet**: 
   - When you first load the Solana Playground, you'll need to set up your wallet. 
   - Click the red circle in the bottom left to create your own wallet (keypair). 
   - Your wallet address will be visible at the bottom of your browser window.

2. **Get devnet SOL**: 
   - In the Playground terminal, enter `solana airdrop 5` to get some test tokens. 
   - If this doesn't work, visit the [Solana Faucet](https://faucet.solana.com/) to get some devnet SOL.

3. **Accessing Exercises**: 
   - You'll find individual links to each exercise in the [Workshop Exercises](#workshop-exercises) section below.

## Option 2: Setting Up Your Local Machine

For those who prefer working on their local machine or want to set up a full development environment, follow these setup instructions:

### Prerequisites

1. **Node.js**: 
   - Download and install from the [Node.js official site](https://nodejs.org/).
   - Node.js is a JavaScript runtime that allows you to run JavaScript on your machine.

2. **Rust**: 
   - Follow the setup instructions on the [Rust official site](https://rust-lang.org).
   - Rust is the primary language used for writing Solana programs.

### Installing Solana CLI

The Solana Command Line Interface (CLI) allows you to interact with the Solana network from your terminal.
```bash
brew install solana
```

If you're not on macOS or don't use Homebrew, check the [Solana docs](https://docs.solana.com/cli/install-solana-cli-tools) for alternative installation methods.

### Installing Anchor
Anchor is a framework for Solana's Sealevel runtime providing several convenient developer tools.

```bash
npm install -g anchor-cli
```

### Configuring Your Development Environment

1. **Create a Solana wallet**:
   ```bash
   solana-keygen new
   ```
   This command creates a new Solana keypair (your wallet) and saves it to your computer.

2. **Set Solana to use the devnet**:
   ```bash
   solana config set --url https://api.devnet.solana.com
   ```
   This configures your Solana CLI to interact with the devnet (development network) instead of the mainnet.

## Workshop Exercises

Each exercise is designed to teach you a specific aspect of Solana development. If you are using your local machine, each exercise is available as a git branch that you can checkout (e.g., `git checkout exercise-1`). If you are using the Solana Playground, use the links provided below.

Each exercise has a task marked by a "TODO" flag in one of the three files (lib.rs, anchor.test.ts, or client.ts). Your goal is to complete the "TODO" to finish the exercise!

*Warning: The main git branch contains the completed code for all exercises.*

- **Exercise-1**: Complete the program setup and deploy. ([Solana Playground](https://beta.solpg.io/6657ed47cffcf4b13384d11d))
    - Run `anchor build` to compile your program
    - Run `anchor deploy` to deploy your program to the Solana devnet
    - Note: You may need to run `solana airdrop 5` to get devnet tokens for deployment
    - After building, update your `Anchor.toml` file with the correct Program ID

- **Exercise-2**: Implement and run tests. ([Solana Playground](https://beta.solpg.io/6658126bcffcf4b13384d125))
    - To run tests, use the command `anchor test`
    - This exercise focuses on writing and running tests for your Solana program

- **Exercise-3**: Complete the client implementation and test client-server interaction. ([Solana Playground](https://beta.solpg.io/6658139ecffcf4b13384d129))
    - To run the client, use the command `anchor run client`
    - This exercise teaches you how to interact with your deployed program from a client application

- **Exercise-4**: Add custom error handling. ([Solana Playground](https://beta.solpg.io/6658135bcffcf4b13384d128))
    - This exercise focuses on improving your program's error handling
    - To test your error handling, try passing an invalid destination address to the test or client

- **Exercise-5**: Learn production practices. ([Solana Playground](https://beta.solpg.io/665812a8cffcf4b13384d126))
    - This exercise introduces best practices for production-ready Solana programs
    - Explore the new client code that handles things like rebroadcasting, priority fees, and more!

## Additional Resources

To deepen your understanding of Solana development and the tools used in this workshop, check out these resources:

- [Solana Documentation](https://docs.solana.com/): Comprehensive guide to Solana's architecture and development
- [Anchor Framework Documentation](https://project-serum.github.io/anchor/getting-started/introduction.html): Detailed guide to using the Anchor framework
- [Brianna Migliaccio's (Solana Foundation) presentation on token extensions](https://docs.google.com/presentation/d/1j_EPi9gMLHz0bSvmjpgpLDrgDpncfjBvqYjOfRe10NM/edit?usp=sharing): In-depth look at Solana's token extensions

## Troubleshooting

If you encounter issues during the workshop:
1. Check that you have the latest versions of all required software.
2. Ensure you're connected to the Solana devnet for testing.
3. Verify that you have sufficient SOL in your devnet wallet for transactions.
4. If using Solana Playground, try refreshing the page if you encounter unexpected behavior.

If problems persist, don't hesitate to open an issue in this repo.

Thank you for participating in this workshop. Happy coding, and enjoy your journey into Solana development!