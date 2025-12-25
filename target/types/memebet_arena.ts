/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/memebet_arena.json`.
 */
export type MemebetArena = {
  "address": "9Can7fzpUB1JABLVtHXq2HuGsWU38wUpBLTRtxEgNwzs",
  "metadata": {
    "name": "memebetArena",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "createMarket",
      "docs": [
        "Creates a new market with immutable rules"
      ],
      "discriminator": [
        103,
        226,
        97,
        235,
        200,
        188,
        251,
        254
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "signer": true
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "marketId",
          "type": "u64"
        },
        {
          "name": "tokenMint",
          "type": "pubkey"
        },
        {
          "name": "targetMarketCap",
          "type": "u64"
        },
        {
          "name": "endTimestamp",
          "type": "i64"
        }
      ]
    },
    {
      "name": "placeBet",
      "docs": [
        "Place a bet on YES or NO"
      ],
      "discriminator": [
        222,
        62,
        67,
        220,
        63,
        166,
        126,
        33
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "position",
          "writable": true,
          "signer": true
        },
        {
          "name": "marketEscrow",
          "writable": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "outcome",
          "type": "bool"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "redeem",
      "docs": [
        "Redeem winning position"
      ],
      "discriminator": [
        184,
        12,
        86,
        149,
        70,
        196,
        97,
        225
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "marketEscrow",
          "writable": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true,
          "relations": [
            "position"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "resolveMarket",
      "docs": [
        "Resolve market based on deterministic rules",
        "Anyone can call this. The logic is immutable."
      ],
      "discriminator": [
        155,
        23,
        80,
        173,
        46,
        74,
        23,
        239
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "resolver",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "finalMarketCap",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "market",
      "discriminator": [
        219,
        190,
        213,
        55,
        0,
        227,
        198,
        154
      ]
    },
    {
      "name": "position",
      "discriminator": [
        170,
        188,
        143,
        228,
        122,
        64,
        247,
        208
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "marketResolved",
      "msg": "Market already resolved"
    },
    {
      "code": 6001,
      "name": "marketExpired",
      "msg": "Market has expired"
    },
    {
      "code": 6002,
      "name": "alreadyResolved",
      "msg": "Market already resolved"
    },
    {
      "code": 6003,
      "name": "marketNotEnded",
      "msg": "Market has not ended yet"
    },
    {
      "code": 6004,
      "name": "marketNotResolved",
      "msg": "Market not resolved"
    },
    {
      "code": 6005,
      "name": "alreadyClaimed",
      "msg": "Position already claimed"
    },
    {
      "code": 6006,
      "name": "userDidNotWin",
      "msg": "User did not win"
    },
    {
      "code": 6007,
      "name": "noOutcome",
      "msg": "No outcome set"
    },
    {
      "code": 6008,
      "name": "overflow",
      "msg": "Overflow error"
    },
    {
      "code": 6009,
      "name": "invalidPool",
      "msg": "Invalid pool"
    },
    {
      "code": 6010,
      "name": "invalidEndTimestamp",
      "msg": "Invalid end timestamp - must be in the future"
    },
    {
      "code": 6011,
      "name": "invalidBetAmount",
      "msg": "Invalid bet amount - must be greater than zero"
    },
    {
      "code": 6012,
      "name": "marketNotExpired",
      "msg": "Market has not expired yet"
    },
    {
      "code": 6013,
      "name": "positionNotWinner",
      "msg": "Position did not win"
    },
    {
      "code": 6014,
      "name": "positionAlreadyClaimed",
      "msg": "Position already claimed"
    }
  ],
  "types": [
    {
      "name": "market",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "targetMarketCap",
            "type": "u64"
          },
          {
            "name": "endTimestamp",
            "type": "i64"
          },
          {
            "name": "yesPool",
            "type": "u64"
          },
          {
            "name": "noPool",
            "type": "u64"
          },
          {
            "name": "resolved",
            "type": "bool"
          },
          {
            "name": "outcome",
            "type": {
              "option": "bool"
            }
          }
        ]
      }
    },
    {
      "name": "position",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "outcome",
            "type": "bool"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "claimed",
            "type": "bool"
          }
        ]
      }
    }
  ]
};
