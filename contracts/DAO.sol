// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./interfaces/IDAO.sol";
import "./interfaces/IStaking.sol";

contract DAO is IDAO {
    uint128 immutable minimumQuorum;
    uint128 immutable debatingPeriodDuration;

    address chairPerson;
    uint128 count;

    IStaking staking;

    mapping(address => uint256) participations;

    struct Proposal {
        uint256 trueVotes;
        uint256 falseVotes;
        uint256 endAt;
        bool inProgress;
        address recipient;
        bytes signature;
        string description;
        address[] members;
        mapping(address => bool) voted;
        mapping(address => uint256) delegatedTokens;
    }

    mapping(uint256 => Proposal) proposals;

    event AddProposal(uint128 indexed proposalId);
    event CallStatus(uint128 indexed proposalId, bool status);
    event ProposalRejected(uint128 indexed proposalId);
    event MinimumQuorumNotReached(uint128 indexed proposalId);

    constructor(address _chairPerson, address _staking,
                uint128 _minimumQuorum, uint128 _debatingPeriodDuration) {
        chairPerson = _chairPerson;
        staking = IStaking(_staking);
        minimumQuorum = _minimumQuorum;
        debatingPeriodDuration = _debatingPeriodDuration;
    }

    function delegate(uint128 _id, address _to) external override isExist(_id) {
        require(!proposals[_id].voted[msg.sender], "already voted or delegated");
        require(!proposals[_id].voted[_to], "delegation to voted");
        uint256 balance = staking.getBalance(msg.sender);
        require(balance > 0, "deposite is 0");

        proposals[_id].delegatedTokens[_to] += balance;
        proposals[_id].members.push(msg.sender);
        participations[msg.sender]++;
        proposals[_id].voted[msg.sender] = true;
    }

    function addProposal(address _recipient, bytes calldata _signature, string calldata _description) 
        external override onlyChairPerson {
        proposals[count].signature = _signature;
        proposals[count].description = _description;
        proposals[count].recipient = _recipient;
        proposals[count].endAt = block.timestamp + debatingPeriodDuration;
        proposals[count].inProgress = true;
        emit AddProposal(count++);
    }

    function vote(uint128 _id, bool _choice) external override isExist(_id) {
        require(proposals[_id].endAt > block.timestamp,
                "voting is over");
        require(!proposals[_id].voted[msg.sender], "already voted or delegated");
        uint256 tokens = staking.getBalance(msg.sender) + proposals[_id].delegatedTokens[msg.sender];
        require(tokens > 0, "voting tokens are 0");

        proposals[_id].voted[msg.sender] = true;
        if (_choice) {
            proposals[_id].trueVotes += tokens;
        } else {
            proposals[_id].falseVotes += tokens;
        }
        proposals[_id].members.push(msg.sender);
        participations[msg.sender]++;
    }

    function finishProposal(uint128 _id) external override isExist(_id) {
        require(proposals[_id].endAt < block.timestamp,
                "voting in progress");
        require(proposals[_id].inProgress, "voting is finished");
        proposals[_id].inProgress = false;
        if (proposals[_id].trueVotes + proposals[_id].falseVotes >= minimumQuorum) {
            if (proposals[_id].trueVotes > proposals[_id].falseVotes) {
                (bool success, ) = proposals[_id].recipient
                                        .call{value: 0}(proposals[_id].signature);
                emit CallStatus(_id, success);
            } else {
                emit ProposalRejected(_id);
            }
        } else {
            emit MinimumQuorumNotReached(_id);
        }

        address[] memory members = proposals[_id].members;
        for (uint256 i = 0; i < members.length; i++) {
            participations[members[i]]--;
        }
    }

    function getSignature(uint128 _proposalId) external override view isExist(_proposalId) 
        returns (bytes memory) {
        return proposals[_proposalId].signature;
    }

    function getDescription(uint128 _proposalId) external override view isExist(_proposalId) 
        returns (string memory) {
        return proposals[_proposalId].description;
    }

    function getVotes(uint128 _proposalId, bool _val) external override view isExist(_proposalId) 
        returns (uint256) {
        if (_val) {
            return proposals[_proposalId].trueVotes;
        } else {
            return proposals[_proposalId].falseVotes;
        }
    }

    function getRecipient(uint128 _proposalId) external override view isExist(_proposalId) 
        returns (address) {
        return proposals[_proposalId].recipient;
    }

    function getParticipationsCount(address _user) external override view returns (uint256) {
        return participations[_user];
    }

    modifier onlyChairPerson() {
        require(msg.sender == chairPerson, "not a chair person");
        _;
    }

    modifier isExist(uint256 _proposalId) {
        require(_proposalId < count, "not exist");
        _;
    }
}
