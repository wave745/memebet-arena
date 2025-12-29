use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::Discriminator;

declare_id!("6fQsRy2d91RaaHZrd9ymmaQuR4bWDL7x5hD6WqpdgLMV");

const ADMIN_PUBKEY: Pubkey = pubkey!("3zAjK7AzN7Wdor2i3kzcNrdRJc8PzysspjbgG8awp5NB");

#[program]
pub mod memebet_arena {
    use super::*;

    /// Creates a new market with immutable rules
    pub fn create_market(
        ctx: Context<CreateMarket>,
        token_mint: Pubkey,
        target_market_cap: u64,
        end_timestamp: i64,
        bump: u8,
    ) -> Result<()> {
        // SECURITY: Only authorized admin can create markets
        require!(
            ctx.accounts.creator.key() == ADMIN_PUBKEY,
            MemeBetError::Unauthorized
        );
        // Validate end_timestamp is in the future
        let clock = Clock::get()?;
        require!(
            end_timestamp > clock.unix_timestamp,
            MemeBetError::InvalidEndTimestamp
        );

        // Validate target_market_cap is greater than zero
        require!(target_market_cap > 0, MemeBetError::Overflow);

        // Derive PDA inside the program - this is the source of truth
        let seeds = &[
            b"market",
            token_mint.as_ref(),
            &target_market_cap.to_le_bytes(),
            &end_timestamp.to_le_bytes(),
        ];
        let (expected_pda, expected_bump) = Pubkey::find_program_address(seeds, ctx.program_id);

        // Validate the passed account matches our derivation
        require!(
            ctx.accounts.market.key() == expected_pda,
            MemeBetError::InvalidPool // Reuse error code for now
        );
        require!(
            bump == expected_bump,
            MemeBetError::InvalidPool
        );

        // Create the account manually using invoke_signed
        let market_space = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1;
        let rent = Rent::get()?;
        let lamports_required = rent.minimum_balance(market_space);

        let signer_seeds: &[&[&[u8]]] = &[&[
            b"market",
            token_mint.as_ref(),
            &target_market_cap.to_le_bytes(),
            &end_timestamp.to_le_bytes(),
            &[bump],
        ]];

        // Create account using CPI with invoke_signed
        let cpi_accounts = system_program::CreateAccount {
            from: ctx.accounts.creator.to_account_info(),
            to: ctx.accounts.market.to_account_info(),
        };
        let cpi_program = ctx.accounts.system_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        
        system_program::create_account(
            cpi_ctx,
            lamports_required,
            market_space as u64,
            ctx.program_id,
        )?;

        // Now initialize the account data manually
        let mut market_data = ctx.accounts.market.try_borrow_mut_data()?;
        let market_slice = market_data.as_mut();
        
        // Write discriminator (8 bytes) - Market account discriminator
        // This is the first 8 bytes of sha256("account:Market")
        market_slice[..8].copy_from_slice(&[219, 190, 213, 55, 0, 227, 198, 154]);
        
        // Write creator (32 bytes)
        market_slice[8..40].copy_from_slice(ctx.accounts.creator.key.as_ref());
        
        // Write token_mint (32 bytes)
        market_slice[40..72].copy_from_slice(token_mint.as_ref());
        
        // Write target_market_cap (8 bytes)
        market_slice[72..80].copy_from_slice(&target_market_cap.to_le_bytes());
        
        // Write end_timestamp (8 bytes)
        market_slice[80..88].copy_from_slice(&end_timestamp.to_le_bytes());
        
        // Write yes_pool (8 bytes) = 0
        market_slice[88..96].copy_from_slice(&0u64.to_le_bytes());
        
        // Write no_pool (8 bytes) = 0
        market_slice[96..104].copy_from_slice(&0u64.to_le_bytes());
        
        // Write resolved (1 byte) = false
        market_slice[104] = 0;
        
        // Write outcome: Option<bool> = None
        // Anchor/Borsh encodes Option<bool> as:
        // None: [0] (1 byte)
        // Some(false): [1, 0] (2 bytes)
        // Some(true): [1, 1] (2 bytes)
        // For None, we write just [0]
        market_slice[105] = 0;

        Ok(())
    }

    /// Place a bet on YES or NO
    pub fn place_bet(ctx: Context<PlaceBet>, outcome: bool, amount: u64) -> Result<()> {
        // Validate bet amount is greater than zero
        require!(amount > 0, MemeBetError::InvalidBetAmount);

        let market = &mut ctx.accounts.market;

        // CRITICAL: Validate escrow matches market PDA
        require!(
            ctx.accounts.market_escrow.key() == market.key(),
            MemeBetError::InvalidPool
        );

        require!(!market.resolved, MemeBetError::MarketResolved);

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp < market.end_timestamp,
            MemeBetError::MarketExpired
        );

        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.market_escrow.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, amount)?;

        if outcome {
            market.yes_pool = market
                .yes_pool
                .checked_add(amount)
                .ok_or(MemeBetError::Overflow)?;
        } else {
            market.no_pool = market
                .no_pool
                .checked_add(amount)
                .ok_or(MemeBetError::Overflow)?;
        }

        let position = &mut ctx.accounts.position;
        
        // Position PDA includes outcome in seeds, so each outcome has its own account
        // Check if position already exists (for multiple buys on same outcome)
        if position.market == Pubkey::default() || position.amount == 0 {
            // New position - initialize (init_if_needed creates account, we set the data)
        position.market = market.key();
        position.user = ctx.accounts.user.key();
        position.outcome = outcome;
        position.amount = amount;
        position.claimed = false;
        } else {
            // Position exists with same outcome - add to existing amount
            // Note: outcome is already validated by PDA seeds, so this will always match
            position.amount = position
                .amount
                .checked_add(amount)
                .ok_or(MemeBetError::Overflow)?;
        }

        Ok(())
    }

    /// Resolve market based on deterministic rules
    /// Anyone can call this. The logic is immutable.
    pub fn resolve_market(ctx: Context<ResolveMarket>, final_market_cap: u64) -> Result<()> {
        let market = &mut ctx.accounts.market;

        // SECURITY: Only authorized admin can resolve markets
        require!(
            ctx.accounts.resolver.key() == ADMIN_PUBKEY,
            MemeBetError::Unauthorized
        );

        require!(!market.resolved, MemeBetError::AlreadyResolved);

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= market.end_timestamp,
            MemeBetError::MarketNotExpired
        );

        let outcome = final_market_cap >= market.target_market_cap;

        market.resolved = true;
        market.outcome = Some(outcome);

        Ok(())
    }

    /// Redeem winning position
    pub fn redeem(ctx: Context<Redeem>, _outcome: bool) -> Result<()> {
        let market = &ctx.accounts.market;
        let position = &mut ctx.accounts.position;

        require!(market.resolved, MemeBetError::MarketNotResolved);

        require!(!position.claimed, MemeBetError::PositionAlreadyClaimed);

        require_eq!(
            position.outcome,
            market.outcome.ok_or(MemeBetError::NoOutcome)?,
            MemeBetError::PositionNotWinner
        );

        let losing_pool = if position.outcome {
            market.no_pool
        } else {
            market.yes_pool
        };

        let winning_pool = if position.outcome {
            market.yes_pool
        } else {
            market.no_pool
        };

        let user_share = (position.amount as u128)
            .checked_mul(losing_pool as u128)
            .ok_or(MemeBetError::Overflow)?
            .checked_div(winning_pool as u128)
            .ok_or(MemeBetError::InvalidPool)?;

        let payout = position
            .amount
            .checked_add(user_share as u64)
            .ok_or(MemeBetError::Overflow)?;

        **ctx.accounts.market_escrow.lamports.borrow_mut() -= payout;
        **ctx.accounts.user.lamports.borrow_mut() += payout;

        position.claimed = true;

        Ok(())
    }

    /// Sell shares before market resolution (with 0.01 SOL fee)
    /// Allows partial or full exit from position
    pub fn sell_shares(ctx: Context<SellShares>, _outcome: bool, amount_to_sell: u64) -> Result<()> {
        let position = &mut ctx.accounts.position;

        // Validations
        require!(!ctx.accounts.market.resolved, MemeBetError::MarketResolved);
        require!(amount_to_sell > 0, MemeBetError::InvalidBetAmount);
        require!(amount_to_sell <= position.amount, MemeBetError::InvalidBetAmount);

        // Get pool values before mutable borrow
        let your_pool = if position.outcome {
            ctx.accounts.market.yes_pool
        } else {
            ctx.accounts.market.no_pool
        };

        let other_pool = if position.outcome {
            ctx.accounts.market.no_pool
        } else {
            ctx.accounts.market.yes_pool
        };

        // Calculate refund: what you'd get if market resolved now, with early exit discount
        // At resolution: payout = amount + (amount * other_pool / your_pool)
        // For early exit: apply 95% discount to account for uncertainty
        let refund = if your_pool > 0 {
            // Calculate proportional share of other pool
            let share_of_other = (amount_to_sell as u128)
                .checked_mul(other_pool as u128)
                .ok_or(MemeBetError::Overflow)?
                .checked_div(your_pool as u128)
                .ok_or(MemeBetError::InvalidPool)?;
            
            // Total refund = amount + share of other pool, with 95% discount for early exit
            let total_potential = (amount_to_sell as u128)
                .checked_add(share_of_other)
                .ok_or(MemeBetError::Overflow)?;
            
            // Apply 95% discount (early exit penalty)
            total_potential
                .checked_mul(95)
                .ok_or(MemeBetError::Overflow)?
                .checked_div(100)
                .ok_or(MemeBetError::InvalidPool)?
        } else {
            // If pool is empty, just return the amount (shouldn't happen)
            amount_to_sell as u128
        };

        // Deduct 0.01 SOL fee (10,000,000 lamports)
        let fee = 10_000_000u64;
        let refund_u64 = refund as u64;
        
        // Ensure refund is at least the fee, otherwise it's not worth selling
        require!(refund_u64 > fee, MemeBetError::InvalidBetAmount);
        
        let net_refund = refund_u64
            .checked_sub(fee)
            .ok_or(MemeBetError::Overflow)?;

        // Transfer net refund to user using direct lamport manipulation
        // Cannot use system_program::transfer because Market PDA has data
        // Direct manipulation is safe because we own the Market PDA
        // Only subtract net_refund from market (fee stays in market)
        **ctx.accounts.market.to_account_info().lamports.borrow_mut() -= net_refund;
        **ctx.accounts.user.to_account_info().lamports.borrow_mut() += net_refund;
        // Fee stays in Market PDA (can be collected later or burned)

        // Update position amount
        position.amount = position
            .amount
            .checked_sub(amount_to_sell)
            .ok_or(MemeBetError::Overflow)?;

        // Update market pools (reduce the pool by the refund amount)
        let market = &mut ctx.accounts.market;
        if position.outcome {
            market.yes_pool = market
                .yes_pool
                .checked_sub(refund_u64)
                .ok_or(MemeBetError::Overflow)?;
        } else {
            market.no_pool = market
                .no_pool
                .checked_sub(refund_u64)
                .ok_or(MemeBetError::Overflow)?;
        }

        Ok(())
    }
}

// ============ ACCOUNT STRUCTURES ============

#[account]
pub struct Market {
    pub creator: Pubkey,
    pub token_mint: Pubkey,
    pub target_market_cap: u64,
    pub end_timestamp: i64,
    pub yes_pool: u64,
    pub no_pool: u64,
    pub resolved: bool,
    pub outcome: Option<bool>,
}

#[account]
pub struct Position {
    pub market: Pubkey,
    pub user: Pubkey,
    pub outcome: bool,
    pub amount: u64,
    pub claimed: bool,
}

// ============ CONTEXT STRUCTURES ============

#[derive(Accounts)]
#[instruction(token_mint: Pubkey, target_market_cap: u64, end_timestamp: i64, bump: u8)]
pub struct CreateMarket<'info> {
    #[account(
        mut,
        seeds = [b"market", token_mint.as_ref(), target_market_cap.to_le_bytes().as_ref(), end_timestamp.to_le_bytes().as_ref()],
        bump
    )]
    pub market: UncheckedAccount<'info>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(outcome: bool)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 32 + 32 + 1 + 8 + 1,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref(), &[outcome as u8]],
        bump
    )]
    pub position: Account<'info, Position>,
    #[account(mut)]
    pub market_escrow: UncheckedAccount<'info>, // Market PDA itself - holds SOL escrow
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    pub resolver: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(outcome: bool)]
pub struct Redeem<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        has_one = user,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref(), &[outcome as u8]],
        bump
    )]
    pub position: Account<'info, Position>,
    #[account(mut)]
    pub market_escrow: SystemAccount<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(outcome: bool)]
pub struct SellShares<'info> {
    #[account(
        mut,
        seeds = [b"market", market.token_mint.as_ref(), market.target_market_cap.to_le_bytes().as_ref(), market.end_timestamp.to_le_bytes().as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        has_one = user,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref(), &[outcome as u8]],
        bump
    )]
    pub position: Account<'info, Position>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ============ ERRORS ============

#[error_code]
pub enum MemeBetError {
    #[msg("Market already resolved")]
    MarketResolved,
    #[msg("Market has expired")]
    MarketExpired,
    #[msg("Market already resolved")]
    AlreadyResolved,
    #[msg("Market has not ended yet")]
    MarketNotEnded,
    #[msg("Market not resolved")]
    MarketNotResolved,
    #[msg("Position already claimed")]
    AlreadyClaimed,
    #[msg("User did not win")]
    UserDidNotWin,
    #[msg("No outcome set")]
    NoOutcome,
    #[msg("Overflow error")]
    Overflow,
    #[msg("Invalid pool")]
    InvalidPool,
    // Additional error codes for test compatibility
    #[msg("Invalid end timestamp - must be in the future")]
    InvalidEndTimestamp,
    #[msg("Invalid bet amount - must be greater than zero")]
    InvalidBetAmount,
    #[msg("Market has not expired yet")]
    MarketNotExpired,
    #[msg("Position did not win")]
    PositionNotWinner,
    #[msg("Position already claimed")]
    PositionAlreadyClaimed,
    #[msg("Cannot bet on different outcome. You already have a position on the opposite side.")]
    PositionOutcomeMismatch,
    #[msg("Unauthorized: Only admin can perform this action")]
    Unauthorized,
}
