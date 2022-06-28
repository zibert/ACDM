// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IStaking {
    function stake(uint256 _amount, bytes32[] calldata _proof) external;
    function claim(uint64 _id) external;
    function unstake(uint64 _id) external;
    function getBalance(address _user) external view returns (uint256);
    function setTimeToUnstake(uint64 _timeToUnstake) external;
    function setDao(address _dao) external;
    function getDao() external view returns(address);
    function getTimeToUnstake() external view returns (uint64);
    function setRoot(bytes32 _root) external;
    function getRoot() external view returns(bytes32);
}