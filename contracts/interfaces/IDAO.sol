// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IDAO {
    function delegate(uint128 _proposalId, address _to) external;
    function addProposal(address _recipient, 
                        bytes calldata _signature, string calldata _description) external;
    function vote(uint128 _proposalId, bool _choice) external;
    function finishProposal(uint128 _proposalId) external;

    function getSignature(uint128 _proposalId) external returns (bytes memory);
    function getDescription(uint128 _proposalId) external returns (string memory);
    function getVotes(uint128 _proposalId, bool _val) external returns (uint256);
    function getRecipient(uint128 _proposalId) external returns (address);
    function getParticipationsCount(address _user) external view returns (uint256);
}