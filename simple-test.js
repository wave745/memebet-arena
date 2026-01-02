// Simple test to verify our DexScreener integration
async function testAPI() {
  try {
    console.log('Testing DexScreener API...');

    const response = await fetch('https://api.dexscreener.com/tokens/v1/solana/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const pair = data[0]; // First pair

    console.log('✅ API Response received');
    console.log(`Token: ${pair.baseToken.name} (${pair.baseToken.symbol})`);
    console.log(`Price: $${pair.priceUsd}`);
    console.log(`Market Cap: $${pair.marketCap.toLocaleString()}`);
    console.log(`Image: ${pair.info?.imageUrl || 'No image'}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAPI();