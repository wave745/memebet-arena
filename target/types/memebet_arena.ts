/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/memebet_arena.json`.
 */
export type MemebetArena = {
  "address": "6fQsRy2d91RaaHZrd9ymmaQuR4bWDL7x5hD6WqpdgLMV",
  "metadata": {
    "name": "memebetArena",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "createMarket",
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
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "tokenMint"
              },
              {
                "kind": "arg",
                "path": "targetMarketCap"
              },
              {
                "kind": "arg",
                "path": "endTimestamp"
              }
            ]
          }
        },
        {
          "name": "marketVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "tokenMint"
              },
              {
                "kind": "arg",
                "path": "targetMarketCap"
              },
              {
                "kind": "arg",
                "path": "endTimestamp"
              }
            ]
          }
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
          "name": "marketBump",
          "type": "u8"
        },
        {
          "name": "vaultBump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initializeTreasury",
      "discriminator": [
        124,
        186,
        211,
        195,
        85,
        165,
        129,
        166
      ],
      "accounts": [
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "placeBet",
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
          "writable": true
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
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.token_mint",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.target_market_cap",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.end_timestamp",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "marketVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.token_mint",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.target_market_cap",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.end_timestamp",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "position",
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
      "args": [
        {
          "name": "outcome",
          "type": "bool"
        }
      ]
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
    },
    {
      "name": "sellShares",
      "discriminator": [
        184,
        164,
        169,
        16,
        231,
        158,
        199,
        196
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.token_mint",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.target_market_cap",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.end_timestamp",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "marketVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.token_mint",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.target_market_cap",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.end_timestamp",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true,
          "relations": [
            "position"
          ]
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
          "name": "amountToSell",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawFromTreasury",
      "docs": [
        "Withdraw from protocol treasury (unlimited, admin only)"
      ],
      "discriminator": [
        0,
        164,
        86,
        76,
        56,
        72,
        12,
        170
      ],
      "accounts": [
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
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
          "name": "amount",
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
    },
    {
      "name": "treasury",
      "discriminator": [
        238,
        239,
        123,
        238,
        89,
        1,
        168,
        253
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "marketResolved",
      "msg": "resolved"
    },
    {
      "code": 6001,
      "name": "marketExpired",
      "msg": "expired"
    },
    {
      "code": 6002,
      "name": "alreadyResolved",
      "msg": "done"
    },
    {
      "code": 6003,
      "name": "marketNotEnded",
      "msg": "active"
    },
    {
      "code": 6004,
      "name": "marketNotResolved",
      "msg": "open"
    },
    {
      "code": 6005,
      "name": "alreadyClaimed",
      "msg": "paid"
    },
    {
      "code": 6006,
      "name": "userDidNotWin",
      "msg": "loss"
    },
    {
      "code": 6007,
      "name": "noOutcome",
      "msg": "none"
    },
    {
      "code": 6008,
      "name": "overflow",
      "msg": "math"
    },
    {
      "code": 6009,
      "name": "invalidPool",
      "msg": "pool"
    },
    {
      "code": 6010,
      "name": "invalidEndTimestamp",
      "msg": "time"
    },
    {
      "code": 6011,
      "name": "invalidBetAmount",
      "msg": "amt"
    },
    {
      "code": 6012,
      "name": "marketNotExpired",
      "msg": "early"
    },
    {
      "code": 6013,
      "name": "positionNotWinner",
      "msg": "wrong"
    },
    {
      "code": 6014,
      "name": "positionAlreadyClaimed",
      "msg": "paid"
    },
    {
      "code": 6015,
      "name": "positionOutcomeMismatch",
      "msg": "side"
    },
    {
      "code": 6016,
      "name": "unauthorized",
      "msg": "auth"
    }
  ],
  "types": [
    {
      "name": "market",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
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
    },
    {
      "name": "treasury",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "totalFeesCollected",
            "type": "u64"
          },
          {
            "name": "lastWithdrawal",
            "type": "u32"
          }
        ]
      }
    }
  ]
};
