// Test token image fetching
const { getTokenData } = require('./lib/dexscreener.ts');

async function testTokenImage() {
  try {
    console.log('Testing token image fetch...');
    const tokenData = await getTokenData('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'); // BONK
    console.log('Token data result:', tokenData);
    console.log('Image URL:', tokenData?.image);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testTokenImage();