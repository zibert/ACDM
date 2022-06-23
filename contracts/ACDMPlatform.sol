// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IACDMToken.sol";
import "./interfaces/IXXXToken.sol";
import "./interfaces/IUniswapV2Router02.sol";

contract ACDMPlatform {
    using SafeERC20 for IACDMToken;

    uint256 savedEthers;
    uint256 tradeEthersAmout;

    uint256 public acdmTokens;
    uint256 startedAt;

    uint64 sr1 = 50;
    uint64 sr2 = 30;
    uint64 tr = 25;
    uint64 public acdmPrice;

    uint256 ordersCount;

    uint32 constant decimals6 = 1000000;
    uint64 constant duration = 3 days;
    bool isSale;

    IACDMToken acdmToken;
    IUniswapV2Router02 uniswapV2Router02 = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    address xxxToken;
    address dao;
    address owner;

    mapping(address => address) referrals;
    mapping(uint256 => Order) orders;

    struct Order {
        address user;
        uint256 amount;
        uint256 tokenPriceInEther;
    }

    event AddOrder(uint256 indexed id, uint256 indexed amount, uint256 indexed tokenPriceInEther);
    event ChangeOrder(uint256 indexed id, uint256 indexed reduction);
    event BurnXXXToken(uint256 indexed xxxToken, uint256 indexed ethersAmount);

    constructor(address _acdmToken, address _dao, address _xxxToken) {
        owner = msg.sender;
        acdmToken = IACDMToken(_acdmToken);
        xxxToken = _xxxToken;
        dao = _dao;
    }

    function register(address _from) external {
        require(referrals[msg.sender] == address(0), "already registered");
        require(msg.sender != _from, "such registration is prohibited");
        require(address(0) != _from, "incorrect address");
        
        referrals[msg.sender] = _from; 
    }

    function startFirstSaleRound() external {
        require(startedAt == 0, "already started");

        acdmTokens = 100000;
        acdmPrice = 10000000000000;
        
        acdmToken.mint(address(this), acdmTokens * decimals6);

        isSale = true;
        startedAt = block.timestamp;
    }

    function startSaleRound() external isStarted isTradeRound {
        require(startedAt + duration < block.timestamp, "trade round in progress");

        acdmTokens = tradeEthersAmout / acdmPrice;
        acdmPrice = acdmPrice * 103 / 100 + 0.000004 ether;
        
        acdmToken.mint(address(this), acdmTokens * decimals6);

        isSale = true;
        startedAt = block.timestamp;
    }

    function startTradeRound() external isSaleRound {
        require(startedAt + duration < block.timestamp || acdmTokens == 0, "sale round in progress");

        if (acdmTokens > 0) { acdmToken.burn(acdmTokens * decimals6); }

        tradeEthersAmout = 0;

        startedAt = block.timestamp;
        isSale = false;
    }

    function buyACDM() external payable isStarted isSaleRound {
        require(msg.value > 0, "no ethers has been sent");
        require(msg.value / acdmPrice <= acdmTokens , "not enough tokens to sale");

        acdmToken.safeTransfer(msg.sender, msg.value * decimals6 / acdmPrice);

        if (referrals[msg.sender] != address(0)) {
            payable(referrals[msg.sender]).transfer(msg.value * sr1 / 1000);
            if (referrals[referrals[msg.sender]] != address(0)) {
                payable(referrals[referrals[msg.sender]]).transfer(msg.value * sr2 / 1000);
            }
        }

        acdmTokens -= msg.value / acdmPrice;
    }

    function buy(uint256 _id, uint256 _amount) external payable isStarted isTradeRound {
        require(msg.value >= _amount * orders[_id].tokenPriceInEther, "not enough ethers");
        require(_amount <= orders[_id].amount, "not enough tokens");

        payable(orders[_id].user).transfer(
            _amount * orders[_id].tokenPriceInEther * (1000 - tr * 2) / 1000);

        if (referrals[orders[_id].user] != address(0)) {
            payable(referrals[orders[_id].user]).transfer(msg.value * tr / 1000);
            if (referrals[referrals[orders[_id].user]] != address(0)) {
                payable(referrals[referrals[orders[_id].user]]).transfer(msg.value * tr / 1000);
            } else {
                 savedEthers += msg.value * tr / 1000;
            }
        } else {
            savedEthers += msg.value * tr * 2 / 1000;
        }

        payable(msg.sender).transfer(msg.value - _amount * orders[_id].tokenPriceInEther);
        acdmToken.safeTransfer(msg.sender, _amount * decimals6);

        orders[_id].amount -= _amount;
        tradeEthersAmout += _amount * orders[_id].tokenPriceInEther;

        emit ChangeOrder(_id,  _amount);
    }

    function addOrder(uint256 _amount, uint256 _tokenPriceInEther) external isStarted isTradeRound {
        acdmToken.safeTransferFrom(msg.sender, address(this), _amount * decimals6);

        orders[ordersCount].user = msg.sender;
        orders[ordersCount].amount = _amount;
        orders[ordersCount].tokenPriceInEther = _tokenPriceInEther;

        emit AddOrder(ordersCount++, _amount, _tokenPriceInEther);
    }

    function removeOrder(uint256 _id) external isStarted isTradeRound {
        require(orders[_id].user == msg.sender, "not a owner");

        acdmToken.safeTransfer(orders[_id].user, orders[_id].amount * decimals6);
        emit ChangeOrder(_id, orders[_id].amount);
        orders[_id].amount = 0;
    }

    function setFirstLevelSaleAward(uint64 _sr1) external onlyDao {
        sr1 = _sr1;
    }

    function setSecondLevelSaleAward(uint64 _sr2) external onlyDao {
        sr2 = _sr2;
    }

    function setTradeAward(uint64 _tr) external onlyDao {
        tr = _tr;
    }

    function sendSavedEthersToOwner() external onlyDao {
        payable(owner).transfer(savedEthers);
        savedEthers = 0;
    }

    function burnXXXToken() external onlyDao {
        address[] memory path = new address[](2);
        path[0] = uniswapV2Router02.WETH();
        path[1] = xxxToken;
        uint256[] memory swap = uniswapV2Router02.swapExactETHForTokens{value: savedEthers}
            (0, path, address(this), block.timestamp + 100);
        IXXXToken(xxxToken).burn(swap[1]);
        emit BurnXXXToken(swap[1], savedEthers);
        savedEthers = 0;
    }

    modifier onlyDao() {
        require(msg.sender == dao, "only dao");
        _;
    }

    modifier isStarted() {
        require(startedAt != 0, "the first sale round isn't stated");
        _;
    }

    modifier isSaleRound() {
        require(isSale, "not a sale round");
        _;
    }

    modifier isTradeRound() {
        require(!isSale, "not a trade round");
        _;
    }
}