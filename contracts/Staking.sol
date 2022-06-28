// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import "./interfaces/IDAO.sol";
import "./interfaces/IStaking.sol";

contract Staking is IStaking {
    using SafeERC20 for IERC20;

    uint64 constant rewardPercentage = 3;
    uint64 constant awardPeriod = 7 days;
    uint64 timeToUnstake = 3 days;
    uint64 count;

    bytes32 root;

    address dao;
    address owner;

    IERC20 xxxToken;
    IERC20 lpToken;    

    struct StakingItem {
        uint256 amount;
        uint256 stackedAt;
        uint256 lastUnstakedAt;
        address user;
    }

    mapping(address => uint256) balances;
    mapping(uint256 => StakingItem) stakings;

    event Stacked(address indexed user, uint256 indexed id, uint256 indexed amount);

    constructor(address _lpToken, address _xxxToken, bytes32 _root) {
        owner = msg.sender;
        lpToken = IERC20(_lpToken);
        xxxToken = IERC20(_xxxToken);
        root = _root;
    }

    function setDao(address _dao) external override {
        require(msg.sender == owner, "only owner");
        dao = _dao;
    }

    function getDao() external override view returns(address) {
        return dao;
    }

    function stake(uint256 _amount, bytes32[] calldata _proof) external override inWhiteList(_proof) {
        require(_amount > 0, "amount must be more then 0");

        lpToken.safeTransferFrom(msg.sender, address(this), _amount);
        stakings[count].amount = _amount;
        stakings[count].stackedAt = block.timestamp;
        stakings[count].lastUnstakedAt = block.timestamp;
        stakings[count].user = msg.sender;

        balances[msg.sender] += _amount;

        emit Stacked(msg.sender, _amount, count++);
    }

    function claim(uint64 _id) external override {
        require(stakings[_id].user == msg.sender, "you are not a owner");
        uint256 durationFromLastClaim = block.timestamp - stakings[_id].lastUnstakedAt;
        uint256 amount = (stakings[_id].amount * rewardPercentage / 100) 
                        * (durationFromLastClaim / awardPeriod);
        require(amount > 0, "nothing to transfer");

        stakings[_id].lastUnstakedAt = 
            stakings[_id].lastUnstakedAt + (durationFromLastClaim / awardPeriod) * awardPeriod;
        xxxToken.safeTransfer(msg.sender, amount);
    }

    function unstake(uint64 _id) external override {
        require(stakings[_id].user == msg.sender, "you are not a owner");
        require(stakings[_id].amount > 0, "already requested");
        require(stakings[_id].stackedAt + timeToUnstake < block.timestamp, 
                "time for unstaking has not come");
        require(IDAO(dao).getParticipationsCount(msg.sender) == 0, 
                "you have active votings");
        lpToken.safeTransfer(stakings[_id].user, stakings[_id].amount);
        balances[msg.sender] -= stakings[_id].amount;
        stakings[_id].amount = 0;
    }

    function getBalance(address _user) external override view returns (uint256) {
        return balances[_user];
    }

    function getTimeToUnstake() external override view returns (uint64) {
        return timeToUnstake;
    }

    function setTimeToUnstake(uint64 _timeToUnstake) external override onlyDao {
        timeToUnstake = _timeToUnstake;
    }

    function setRoot(bytes32 _root) external override onlyDao {
        root = _root;
    }

    function getRoot() external override view returns(bytes32) {
        return root;
    }

    modifier onlyDao() {
        require(dao != address(0), "dao isin't init");
        require(dao == msg.sender, "not allowed");
        _;
    }

    modifier inWhiteList(bytes32[] calldata _proof) {
        require(MerkleProof.verify(_proof, root, keccak256(abi.encode(msg.sender))), 
                "not in white list");
        _;
    }
}
