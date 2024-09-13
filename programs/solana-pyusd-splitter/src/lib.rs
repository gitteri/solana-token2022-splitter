use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, TransferChecked};
use anchor_spl::token_interface::{ Mint, Token2022, TokenAccount };

// Program ID created by the playground
declare_id!("Gm5A2qTMjz3TMESWvBQoApGm8VuzXF1X2y7DEpJnUpda");

#[program]
pub mod splitter {
    use super::*;

    /// Distributes `amount` of tokens from the `from` account to multiple recipient accounts.
    /// Each recipient must have an initialized and valid TokenAccount.
    /// 
    /// # Arguments
    /// * `ctx` - The context containing all accounts needed for the transaction.
    /// * `amount` - The amount of tokens to be sent to each recipient.
    /// 
    /// # Errors
    /// Returns `InvalidTokenAccount` if any recipient account cannot be deserialized properly.
    pub fn send_to_all<'a, 'b, 'life>(
        ctx: Context<'a, 'b, 'life, 'life, SendTokens<'life>>,
        amount: u64,
    ) -> Result<()> {
        let from_account = ctx.accounts.from.to_account_info();
        let token_program = ctx.accounts.token_program.to_account_info();
        let authority_info = ctx.accounts.authority.to_account_info();
        let mint = ctx.accounts.mint.to_account_info();

        // Iterate over each recipient account and send tokens to them.
        // Note: remaining_accounts is a way to accept an undetermined number of accounts for an action.
        //       Use caution when using "remaining_accounts" as they are not validated prior to use.
        //       Do all validation and error handling and do not blindly trust an account within "remaining_accounts".
        for recipient in ctx.remaining_accounts.iter() {
            // Attempt to borrow and deserialize the recipient's data to validate initialization.
            let recipient_data = recipient.try_borrow_data()?;
            let mut slice_ref: &[u8] = &recipient_data;
            TokenAccount::try_deserialize(&mut slice_ref)
                .map_err(|_| error!(ErrorCode::InvalidTokenAccount))?;
            // Drop the borrow explicitly to avoid borrowing a reference for an account which is already borrowed.
            drop(recipient_data);

            // Setup the accounts for the transfer checked operation (note: transfer is now deprecated).
            let transfer_cpi_accounts = TransferChecked {
                from: from_account.clone(),
                to: recipient.clone(),
                authority: authority_info.clone(),
                mint: mint.clone()
            };

            // Create a context for the transfer and execute the transfer_checked instruction.
            // For more details on token extensions (token-2022), see the following presentation by Brianna Migliaccio @Solana Foundation:
            // https://docs.google.com/presentation/d/1j_EPi9gMLHz0bSvmjpgpLDrgDpncfjBvqYjOfRe10NM/edit?usp=sharing
            let cpi_ctx = CpiContext::new(token_program.clone(), transfer_cpi_accounts);
            token_2022::transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;
        }

        Ok(())
    }
}

// Define the data structure for the accounts involved in the send_to_all function.
#[derive(Accounts)]
pub struct SendTokens<'info> {
    #[account(mut)]
    pub from: Box<InterfaceAccount<'info, TokenAccount>>,
    pub authority: Signer<'info>,
    #[account()]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Program<'info, Token2022>,
}

// Custom errors returned from this program.
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid Token Account. Please ensure the account is correctly initialized.")]
    InvalidTokenAccount,
}
