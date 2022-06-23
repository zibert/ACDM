// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IXXXToken is IERC20 {
    function mint(address account, uint256 amount) external;
    function setOwner(address _owner) external;
    function burn(uint256 amount) external;
}