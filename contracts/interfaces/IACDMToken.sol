// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IACDMToken is IERC20 {
    function mint(address account, uint256 amount) external;
    function burn(uint256 amount) external;
    function setPlatform(address _platform) external;
}
