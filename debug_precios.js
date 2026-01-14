console.log('=== DIAGNÓSTICO DE ACTUALIZACIÓN DE PRECIOS ===');
console.log('selectedDuration:', selectedDuration);
console.log('selectedVolume:', selectedVolume);
console.log('selectedPack:', selectedPack);

// Forzar recarga de precios
updatePrices();

console.log('=== Después de updatePrices() ===');
console.log('Precio mensual manual:', document.getElementById('manual-price-monthly')?.innerText);
console.log('Precio total manual:', document.getElementById('manual-price-total')?.innerText);
