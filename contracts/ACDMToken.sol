// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./interfaces/IACDMToken.sol";

contract ACDMToken is ERC20("ACADEM Coin", "ACDM"), IACDMToken {
    address owner;
    address platform;

    constructor() {
        owner = msg.sender;
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    function mint(address account, uint256 amount) external override onlyPlatform {
        _mint(account, amount);
    }

    function burn(uint256 amount) external override {
        _burn(msg.sender, amount);
    }

    function setPlatform(address _platform) external override onlyOwner {
        platform = _platform;
    }

    modifier onlyOwner {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier onlyPlatform {
        require(msg.sender == platform, "only platform");
        _;
    }
}