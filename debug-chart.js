// Debug chart data generation
const { generateChartData } = require('./components/market-chart.tsx');

console.log('Testing chart data generation...');

// Test data
const testData = generateChartData("1D", 65, "YES");
console.log('Generated data points:', testData.length);
console.log('First few points:');
testData.slice(0, 3).forEach((point, i) => {
  console.log(`${i}: ${point.time} - ${point.value}`);
});

console.log('Data structure check:');
console.log('Sample point:', testData[0]);
console.log('Has time property:', testData[0].hasOwnProperty('time'));
console.log('Has value property:', testData[0].hasOwnProperty('value'));