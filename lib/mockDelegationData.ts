function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i); 
  }
  return Math.abs(hash);
}

export function getDeterministicDelegation(address: string) {
  const hash = djb2Hash(address.toLowerCase());
  
  const inboundCount = 5 + (hash % 85);
  const totalPower = 1500 + (hash % 2500000);
  const isTopDelegate = inboundCount > 40;

  const protocolPairs = [
    "Lido Finance & ENS",
    "Arbitrum & Optimism",
    "Aave & Compound",
    "MakerDAO & Curve",
    "Uniswap & Optimism"
  ];

  return {
    inboundWallets: inboundCount,
    // Safely format power
    totalPowerFormatted: totalPower > 1000000 
      ? (totalPower / 1000000).toFixed(1) + 'M' 
      : (totalPower / 1000).toFixed(1) + 'k',
    totalPowerRaw: totalPower,
    isTopDelegate,
    outboundProtocols: protocolPairs[hash % protocolPairs.length],
    outboundPowerFormatted: (500 + (hash % 5000)).toLocaleString()
  };
}
