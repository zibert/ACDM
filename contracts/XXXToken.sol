// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IXXXToken.sol";

contract XXXToken is ERC20("XXX Coin", "XXX"), IXXXToken {
    address owner;

    constructor() {
        owner = msg.sender;
    }

    function mint(address account, uint256 amount) external override onlyOwner {
        _mint(account, amount);
    }

    function burn(uint256 amount) external override {
        _burn(msg.sender, amount);
    }

    function setOwner(address _owner) external override onlyOwner {
        owner = _owner;
    }

    modifier onlyOwner {
        require(msg.sender == owner, "only owner");
        _;
    }

}