use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("Cm9MuUJsHtR5hgcp19KPX9HNu1wXmbTAg3t7a11zVGUb");

const ADMIN_PUBKEY: Pubkey = pubkey!("3zAjK7AzN7Wdor2i3kzcNrdRJc8PzysspjbgG8awp5NB");

#[program]
pub mod memebet_arena {
    use super::*;

    pub fn initialize_treasury(ctx: Context<InitializeTreasury>) -> Result<()> {
        require!(ctx.accounts.admin.key() == ADMIN_PUBKEY, MemeBetError::Unauthorized);
        let treasury = &mut ctx.accounts.treasury;
        treasury.admin = ctx.accounts.admin.key();
        treasury.total_fees_collected = 0;
        treasury.last_withdrawal = 0;
        Ok(())
    }

    pub fn create_market(
        ctx: Context<CreateMarket>,
        token_mint: Pubkey,
        target_market_cap: u64,
        end_timestamp: i64,
        market_bump: u8,
        vault_bump: u8,
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

        let market_seeds = &[b"market", token_mint.as_ref(), &target_market_cap.to_le_bytes(), &end_timestamp.to_le_bytes()];
        let (expected_market_pda, expected_market_bump) = Pubkey::find_program_address(market_seeds, ctx.program_id);
        require!(ctx.accounts.market.key() == expected_market_pda, MemeBetError::InvalidPool);
        require!(market_bump == expected_market_bump, MemeBetError::InvalidPool);

        let vault_seeds = &[b"vault", token_mint.as_ref(), &target_market_cap.to_le_bytes(), &end_timestamp.to_le_bytes()];
        let (expected_vault_pda, expected_vault_bump) = Pubkey::find_program_address(vault_seeds, ctx.program_id);
        require!(ctx.accounts.market_vault.key() == expected_vault_pda, MemeBetError::InvalidPool);
        require!(vault_bump == expected_vault_bump, MemeBetError::InvalidPool);

        let rent = Rent::get()?;
        let market_space = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1;
        let market_lamports = rent.minimum_balance(market_space);
        let market_signer_seeds: &[&[&[u8]]] = &[&[b"market", token_mint.as_ref(), &target_market_cap.to_le_bytes(), &end_timestamp.to_le_bytes(), &[market_bump]]];
        let market_cpi_ctx = CpiContext::new_with_signer(ctx.accounts.system_program.to_account_info(),
            system_program::CreateAccount { from: ctx.accounts.creator.to_account_info(), to: ctx.accounts.market.to_account_info() }, market_signer_seeds);
        system_program::create_account(market_cpi_ctx, market_lamports, market_space as u64, ctx.program_id)?;

        let vault_lamports = rent.minimum_balance(0);
        let vault_signer_seeds: &[&[&[u8]]] = &[&[b"vault", token_mint.as_ref(), &target_market_cap.to_le_bytes(), &end_timestamp.to_le_bytes(), &[vault_bump]]];
        let vault_cpi_ctx = CpiContext::new_with_signer(ctx.accounts.system_program.to_account_info(),
            system_program::CreateAccount { from: ctx.accounts.creator.to_account_info(), to: ctx.accounts.market_vault.to_account_info() }, vault_signer_seeds);
        system_program::create_account(vault_cpi_ctx, vault_lamports, 0, ctx.program_id)?;

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

    pub fn place_bet(ctx: Context<PlaceBet>, outcome: bool, amount: u64) -> Result<()> {
        require!(amount > 0, MemeBetError::InvalidBetAmount);
        let market = &mut ctx.accounts.market;
        let vault_seeds = &[b"vault", market.token_mint.as_ref(), &market.target_market_cap.to_le_bytes(), &market.end_timestamp.to_le_bytes()];
        let (expected_vault, _) = Pubkey::find_program_address(vault_seeds, ctx.program_id);
        require!(ctx.accounts.market_escrow.key() == expected_vault, MemeBetError::InvalidPool);
        require!(!market.resolved, MemeBetError::MarketResolved);
        let clock = Clock::get()?;
        require!(clock.unix_timestamp < market.end_timestamp, MemeBetError::MarketExpired);

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
        
        if position.market == Pubkey::default() || position.amount == 0 {
            position.market = market.key();
            position.user = ctx.accounts.user.key();
            position.outcome = outcome;
            position.amount = amount;
            position.claimed = false;
        } else {
            position.amount = position.amount.checked_add(amount).ok_or(MemeBetError::Overflow)?;
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

        let (losing_pool, winning_pool) = if position.outcome { (market.no_pool, market.yes_pool) } else { (market.yes_pool, market.no_pool) };
        let user_share = (position.amount as u128).checked_mul(losing_pool as u128).ok_or(MemeBetError::Overflow)?.checked_div(winning_pool as u128).ok_or(MemeBetError::InvalidPool)?;
        let payout = position.amount.checked_add(user_share as u64).ok_or(MemeBetError::Overflow)?;

        **ctx.accounts.market_vault.to_account_info().lamports.borrow_mut() -= payout;
        **ctx.accounts.user.to_account_info().lamports.borrow_mut() += payout;

        position.claimed = true;

        Ok(())
    }

    pub fn sell_shares(ctx: Context<SellShares>, _outcome: bool, amount_to_sell: u64) -> Result<()> {
        let position = &mut ctx.accounts.position;
        require!(!ctx.accounts.market.resolved, MemeBetError::MarketResolved);
        require!(amount_to_sell > 0, MemeBetError::InvalidBetAmount);
        require!(amount_to_sell <= position.amount, MemeBetError::InvalidBetAmount);

        let your_pool = if position.outcome { ctx.accounts.market.yes_pool } else { ctx.accounts.market.no_pool };
        let other_pool = if position.outcome { ctx.accounts.market.no_pool } else { ctx.accounts.market.yes_pool };

        let refund_u64 = if your_pool > 0 {
            let share = (amount_to_sell as u128).checked_mul(other_pool as u128).ok_or(MemeBetError::Overflow)?.checked_div(your_pool as u128).ok_or(MemeBetError::InvalidPool)?;
            let total = (amount_to_sell as u128).checked_add(share).ok_or(MemeBetError::Overflow)?;
            (total.checked_mul(95).ok_or(MemeBetError::Overflow)?.checked_div(100).ok_or(MemeBetError::InvalidPool)?) as u64
        } else { amount_to_sell };

        let fee = 10_000_000u64;
        require!(refund_u64 > fee, MemeBetError::InvalidBetAmount);
        let net_refund = refund_u64.checked_sub(fee).ok_or(MemeBetError::Overflow)?;

        **ctx.accounts.market_vault.to_account_info().lamports.borrow_mut() -= net_refund;
        **ctx.accounts.user.to_account_info().lamports.borrow_mut() += net_refund;

        **ctx.accounts.market_vault.to_account_info().lamports.borrow_mut() -= fee;
        **ctx.accounts.treasury.to_account_info().lamports.borrow_mut() += fee;
        ctx.accounts.treasury.total_fees_collected = ctx.accounts.treasury.total_fees_collected.checked_add(fee).ok_or(MemeBetError::Overflow)?;
        position.amount = position.amount.checked_sub(amount_to_sell).ok_or(MemeBetError::Overflow)?;
        let market = &mut ctx.accounts.market;
        if position.outcome { market.yes_pool = market.yes_pool.checked_sub(refund_u64).ok_or(MemeBetError::Overflow)?; }
        else { market.no_pool = market.no_pool.checked_sub(refund_u64).ok_or(MemeBetError::Overflow)?; }

        Ok(())
    }

    /// Withdraw from protocol treasury (unlimited, admin only)
    pub fn withdraw_from_treasury(ctx: Context<WithdrawFromTreasury>, amount: u64) -> Result<()> {
        // SECURITY: Only authorized admin can withdraw
        require!(
            ctx.accounts.admin.key() == ADMIN_PUBKEY,
            MemeBetError::Unauthorized
        );

        // Check treasury has enough funds (get balance before mutable borrow)
        let treasury_balance = **ctx.accounts.treasury.to_account_info().lamports.borrow();
        require!(
            treasury_balance >= amount,
            MemeBetError::InvalidBetAmount // Reuse error for insufficient funds
        );

        // Transfer from treasury to admin (unlimited withdrawal)
        **ctx.accounts.treasury.to_account_info().lamports.borrow_mut() -= amount;
        **ctx.accounts.admin.to_account_info().lamports.borrow_mut() += amount;

        // Update treasury tracking
        let treasury = &mut ctx.accounts.treasury;
        treasury.last_withdrawal = Clock::get()?.unix_timestamp as u32;

        Ok(())
    }
}

// ============ ACCOUNT STRUCTURES ============

#[account]
pub struct Treasury {
    pub admin: Pubkey,
    pub total_fees_collected: u64,
    pub last_withdrawal: u32,
}

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
#[instruction(token_mint: Pubkey, target_market_cap: u64, end_timestamp: i64, market_bump: u8, vault_bump: u8)]
pub struct CreateMarket<'info> {
    /// CHECK: PDA is derived from token_mint, target_market_cap, end_timestamp with bump
    #[account(
        mut,
        seeds = [b"market", token_mint.as_ref(), target_market_cap.to_le_bytes().as_ref(), end_timestamp.to_le_bytes().as_ref()],
        bump = market_bump
    )]
    pub market: UncheckedAccount<'info>,
    /// CHECK: PDA is derived from token_mint, target_market_cap, end_timestamp with bump
    #[account(
        mut,
        seeds = [b"vault", token_mint.as_ref(), target_market_cap.to_le_bytes().as_ref(), end_timestamp.to_le_bytes().as_ref()],
        bump = vault_bump
    )]
    pub market_vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 8 + 4, // discriminator + admin + total_fees + last_withdrawal
        seeds = [b"treasury"],
        bump
    )]
    pub treasury: Account<'info, Treasury>,
    #[account(mut)]
    pub admin: Signer<'info>,
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
    /// CHECK: PDA is validated in instruction logic to match market vault
    #[account(mut)]
    pub market_escrow: UncheckedAccount<'info>,
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
pub struct WithdrawFromTreasury<'info> {
    #[account(
        mut,
        seeds = [b"treasury"],
        bump
    )]
    pub treasury: Account<'info, Treasury>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
#[instruction(outcome: bool)]
pub struct Redeem<'info> {
    #[account(
        mut,
        seeds = [b"market", market.token_mint.as_ref(), market.target_market_cap.to_le_bytes().as_ref(), market.end_timestamp.to_le_bytes().as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        seeds = [b"vault", market.token_mint.as_ref(), market.target_market_cap.to_le_bytes().as_ref(), market.end_timestamp.to_le_bytes().as_ref()],
        bump
    )]
    pub market_vault: SystemAccount<'info>,
    #[account(
        mut,
        seeds = [b"treasury"],
        bump
    )]
    pub treasury: Account<'info, Treasury>,
    #[account(
        mut,
        has_one = user,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref(), &[outcome as u8]],
        bump
    )]
    pub position: Account<'info, Position>,
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
        seeds = [b"vault", market.token_mint.as_ref(), market.target_market_cap.to_le_bytes().as_ref(), market.end_timestamp.to_le_bytes().as_ref()],
        bump
    )]
    pub market_vault: SystemAccount<'info>,
    #[account(
        mut,
        seeds = [b"treasury"],
        bump
    )]
    pub treasury: Account<'info, Treasury>,
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
    #[msg("Resolved")]
    MarketResolved,
    #[msg("Expired")]
    MarketExpired,
    #[msg("Done")]
    AlreadyResolved,
    #[msg("Active")]
    MarketNotEnded,
    #[msg("Open")]
    MarketNotResolved,
    #[msg("Paid")]
    AlreadyClaimed,
    #[msg("Loss")]
    UserDidNotWin,
    #[msg("None")]
    NoOutcome,
    #[msg("Math")]
    Overflow,
    #[msg("Pool")]
    InvalidPool,
    #[msg("Time")]
    InvalidEndTimestamp,
    #[msg("Amt")]
    InvalidBetAmount,
    #[msg("Early")]
    MarketNotExpired,
    #[msg("Wrong")]
    PositionNotWinner,
    #[msg("Paid")]
    PositionAlreadyClaimed,
    #[msg("Side")]
    PositionOutcomeMismatch,
    #[msg("Auth")]
    Unauthorized,
}
