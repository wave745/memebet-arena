// Test chart data generation
const { generateChartData } = require('./components/market-chart.tsx');

console.log('Testing chart data generation...');

// Simulate YES at 65%, NO at 35%
const yesPercent = 65;
const noPercent = 35;

console.log('\nYES Chart Data (first 5 points):');
const yesData = generateChartData("1D", yesPercent, "YES");
yesData.slice(0, 5).forEach(point => {
  console.log(`${point.time}: ${point.value.toFixed(1)}%`);
});

console.log('\nNO Chart Data (first 5 points):');
const noData = generateChartData("1D", noPercent, "NO");
noData.slice(0, 5).forEach(point => {
  console.log(`${point.time}: ${point.value.toFixed(1)}%`);
});

console.log(`\nCurrent YES: ${yesPercent}%, Current NO: ${noPercent}%`);
console.log('Chart generation test complete!');