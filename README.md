# ACDM PLATFORM

# Install package

npm i <br />

# Test

npx hardhat coverage <br />

# Deploy

## Deploy XXX tokens
npx hardhat run --network rinkeby scripts/deployXXXToken.ts <br />

## Deploy ACDM platform
npx hardhat run --network rinkeby scripts/deploy.ts <br />

# Verify

## XXXToken

npx hardhat verify --network rinkeby 0xB1EA2A3D11d3B3a76EBA2656E2DfFdc86bFF6274 <br />
https://rinkeby.etherscan.io/address/0xB1EA2A3D11d3B3a76EBA2656E2DfFdc86bFF6274#code <br />

## Staking

npx hardhat verify --network rinkeby --constructor-args argumentsStaking.js 0xfdE1041511Fa31F527863a3BCbfE9c5901A5e4AB <br />
https://rinkeby.etherscan.io/address/0xfdE1041511Fa31F527863a3BCbfE9c5901A5e4AB#code <br />

## DAO

npx hardhat verify --network rinkeby --constructor-args argumentsDao.js 0x31EfcEE576248575ca09d62979A2c8901310d3A6 <br />
https://rinkeby.etherscan.io/address/0x31EfcEE576248575ca09d62979A2c8901310d3A6#code <br />

## ACDMToken

npx hardhat verify --network rinkeby 0x8Fe322522ba5ae470B88C28B088e2B7599d16189 <br />
https://rinkeby.etherscan.io/address/0x8Fe322522ba5ae470B88C28B088e2B7599d16189#code <br />

## ACDMPlatform

npx hardhat verify --network rinkeby --constructor-args argumentsAcdmPlatform.js 0x05C49f96ab07B689e9128BCe6024d44031715Db1 <br />
https://rinkeby.etherscan.io/address/0x05C49f96ab07B689e9128BCe6024d44031715Db1#code <br />

# Tasks 

## mint XXX tokens example: 

npx hardhat mintXXX --network rinkeby --to 0x624c31357a67344f6d0278a6ef1F839E2136D735 --xxx 100.0 <br />
npx hardhat mintXXX --network rinkeby --to 0xfdE1041511Fa31F527863a3BCbfE9c5901A5e4AB --xxx 100.0 <br />

## addLiquidityETH example: 

npx hardhat addLiquidityETH --network rinkeby --ether 0.001 --xxx 100.0 <br />

## create a liquidity pool: 

npx hardhat createPairXxxEth --network rinkeby <br />

## stake example: 

npx hardhat stake --network rinkeby --amount 0.1 <br />

## claim example: 

npx hardhat claim --network rinkeby --id 0 <br />

## unstake example: 

npx hardhat unstake --network rinkeby --id 0 <br />

## addProposal example: 

npx hardhat addProposal --network rinkeby --recipient 0x05C49f96ab07B689e9128BCe6024d44031715Db1 --signature 0xd314f8ca --description "burnXXXToken()" <br />

## vote example: 

npx hardhat vote --network rinkeby --id 0 --choice false <br />

## delegate example: 

npx hardhat delegate --network rinkeby --id 1 --to 0xC413AeD1E837F528670f8bf27C4Eed9AFCDB7bB5 <br />

## register example:

npx hardhat register --network rinkeby --from 0xC413AeD1E837F528670f8bf27C4Eed9AFCDB7bB5 <br />

## startFirstSaleRound at the acdm platform:

npx hardhat startFirstSaleRound --network rinkeby  <br />

## startSaleRound at the acdm platform:

npx hardhat startSaleRound --network rinkeby  <br />

## startTradeRound at the acdm platform:

npx hardhat startTradeRound --network rinkeby  <br />

## buy acdm token on the acdm platform example:

npx hardhat buyACDM --network rinkeby --ethers 0.01  <br />

## addOrder example:

npx hardhat addOrder --network rinkeby --amount 100 --price 0.000012  <br />

## removeOrder example:
npx hardhat removeOrder --network rinkeby --id 0 <br />

## buy acdm tokens in trade round example:

npx hardhat buy --network rinkeby --id 0 --amount 42 <br />












