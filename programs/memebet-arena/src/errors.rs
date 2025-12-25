use anchor_lang::prelude::*;

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
}
