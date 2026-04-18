// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract Ticketing is ERC721, AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GATE_ROLE = keccak256("GATE_ROLE");

    enum TicketStatus {
        Valid,
        Used,
        Revoked
    }

    struct MatchInfo {
        uint256 matchId;
        string homeTeam;
        string awayTeam;
        string stadium;
        uint256 matchDate;
        uint256 transferCutoff;
        bool exists;
    }

    struct Ticket {
        uint256 ticketId;
        uint256 matchId;
        TicketStatus status;
        uint8 transferCount;
        uint8 maxTransfers;
        uint256 issuedAt;
        uint256 usedAt;
        uint256 revokedAt;
    }

    error MatchAlreadyExists(uint256 matchId);
    error MatchDoesNotExist(uint256 matchId);
    error MatchAlreadyStarted(uint256 matchId);
    error TransferWindowClosed(uint256 matchId);
    error TicketNotValid(uint256 ticketId);
    error TransferLimitReached(uint256 ticketId);
    error TicketAlreadyUsed(uint256 ticketId);
    error TicketAlreadyRevoked(uint256 ticketId);
    error TicketNotOwnedByClaimedAddress(uint256 ticketId, address claimedOwner);

    mapping(uint256 => MatchInfo) private _matches;
    mapping(uint256 => Ticket) private _tickets;
    mapping(uint256 => address[]) private _ownershipHistory;

    event MatchCreated(uint256 indexed matchId, string homeTeam, string awayTeam, uint256 matchDate, uint256 transferCutoff);
    event TicketMinted(uint256 indexed ticketId, uint256 indexed matchId, address indexed owner, uint8 maxTransfers);
    event TicketUsed(uint256 indexed ticketId, address indexed gateStaff, uint256 usedAt);
    event TicketRevoked(uint256 indexed ticketId, address indexed revokedBy, uint256 revokedAt);

    constructor(address admin) ERC721("FootballTicket", "FTIX") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(GATE_ROLE, admin);
    }

    function createMatch(
        uint256 matchId,
        string calldata homeTeam,
        string calldata awayTeam,
        string calldata stadium,
        uint256 matchDate,
        uint256 transferCutoff
    ) external onlyRole(ADMIN_ROLE) {
        if (_matches[matchId].exists) {
            revert MatchAlreadyExists(matchId);
        }
        if (matchDate <= block.timestamp) {
            revert MatchAlreadyStarted(matchId);
        }
        if (transferCutoff != 0 && transferCutoff > matchDate) {
            transferCutoff = matchDate;
        }

        _matches[matchId] = MatchInfo({
            matchId: matchId,
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            stadium: stadium,
            matchDate: matchDate,
            transferCutoff: transferCutoff,
            exists: true
        });

        emit MatchCreated(matchId, homeTeam, awayTeam, matchDate, transferCutoff);
    }

    function mintTicket(address to, uint256 ticketId, uint256 matchId, uint8 maxTransfers) external onlyRole(ADMIN_ROLE) {
        MatchInfo memory m = _matches[matchId];
        if (!m.exists) {
            revert MatchDoesNotExist(matchId);
        }
        if (m.matchDate <= block.timestamp) {
            revert MatchAlreadyStarted(matchId);
        }

        _safeMint(to, ticketId);

        _tickets[ticketId] = Ticket({
            ticketId: ticketId,
            matchId: matchId,
            status: TicketStatus.Valid,
            transferCount: 0,
            maxTransfers: maxTransfers,
            issuedAt: block.timestamp,
            usedAt: 0,
            revokedAt: 0
        });

        emit TicketMinted(ticketId, matchId, to, maxTransfers);
    }

    function markTicketAsUsed(uint256 ticketId) external onlyRole(GATE_ROLE) {
        _requireOwned(ticketId);
        Ticket storage t = _tickets[ticketId];
        if (t.status == TicketStatus.Used) {
            revert TicketAlreadyUsed(ticketId);
        }
        if (t.status == TicketStatus.Revoked) {
            revert TicketAlreadyRevoked(ticketId);
        }

        t.status = TicketStatus.Used;
        t.usedAt = block.timestamp;

        emit TicketUsed(ticketId, msg.sender, block.timestamp);
    }

    function revokeTicket(uint256 ticketId) external onlyRole(ADMIN_ROLE) {
        _requireOwned(ticketId);
        Ticket storage t = _tickets[ticketId];
        if (t.status == TicketStatus.Revoked) {
            revert TicketAlreadyRevoked(ticketId);
        }

        t.status = TicketStatus.Revoked;
        t.revokedAt = block.timestamp;

        emit TicketRevoked(ticketId, msg.sender, block.timestamp);
    }

    function verifyTicket(uint256 ticketId, address claimedOwner)
        external
        view
        returns (bool valid, TicketStatus status, address currentOwner, uint256 matchId)
    {
        if (!_ownerExists(ticketId)) {
            return (false, TicketStatus.Revoked, address(0), 0);
        }

        Ticket memory t = _tickets[ticketId];
        currentOwner = ownerOf(ticketId);
        if (currentOwner != claimedOwner) {
            return (false, t.status, currentOwner, t.matchId);
        }
        if (t.status != TicketStatus.Valid) {
            return (false, t.status, currentOwner, t.matchId);
        }

        return (true, t.status, currentOwner, t.matchId);
    }

    function getMatch(uint256 matchId) external view returns (MatchInfo memory) {
        if (!_matches[matchId].exists) {
            revert MatchDoesNotExist(matchId);
        }
        return _matches[matchId];
    }

    function getTicket(uint256 ticketId) external view returns (Ticket memory) {
        _requireOwned(ticketId);
        return _tickets[ticketId];
    }

    function getOwnershipHistory(uint256 ticketId) external view returns (address[] memory) {
        _requireOwned(ticketId);
        return _ownershipHistory[ticketId];
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);

        if (from == address(0)) {
            _ownershipHistory[tokenId].push(to);
            return from;
        }

        if (to == address(0)) {
            return from;
        }

        Ticket storage t = _tickets[tokenId];
        MatchInfo memory m = _matches[t.matchId];

        if (t.status != TicketStatus.Valid) {
            revert TicketNotValid(tokenId);
        }
        if (m.transferCutoff != 0 && block.timestamp > m.transferCutoff) {
            revert TransferWindowClosed(m.matchId);
        }
        if (block.timestamp >= m.matchDate) {
            revert MatchAlreadyStarted(m.matchId);
        }
        if (t.transferCount >= t.maxTransfers) {
            revert TransferLimitReached(tokenId);
        }

        unchecked {
            t.transferCount += 1;
        }

        _ownershipHistory[tokenId].push(to);
        return from;
    }

    function _ownerExists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
}
