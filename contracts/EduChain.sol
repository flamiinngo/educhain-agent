// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IImpactNFT {
    function mint(
        address student,
        string calldata topic,
        uint8 score,
        uint256 amountPaid,
        string calldata filecoinCID,
        string calldata paymentTxHash
    ) external returns (uint256);
}

contract EduChain is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ════════════════════════════════════════════
    // CONSTANTS
    // ════════════════════════════════════════════
    uint256 public constant REWARD_PASS = 0.25 ether;       // 0.25 cUSD (4/5)
    uint256 public constant REWARD_PERFECT = 0.50 ether;    // 0.50 cUSD (5/5)
    uint256 public constant DAILY_CAP = 0.50 ether;         // max per student per day
    uint256 public constant COOLDOWN = 1 hours;             // between lessons
    uint256 public constant MIN_QUIZ_TIME = 180;            // 3 minutes in seconds
    uint256 public constant SURVIVAL_THRESHOLD = 7;         // days of runway
    uint256 public constant NFT_PRICE = 1 ether;            // 1 cUSD per Impact NFT

    // ════════════════════════════════════════════
    // STATE
    // ════════════════════════════════════════════
    IERC20 public cUSD;
    IImpactNFT public impactNFT;

    struct Student {
        bytes32 phoneHash;
        bool verified;
        bool blacklisted;
        uint256 lastLessonTime;
        uint256 dailyEarned;
        uint256 lastDayReset;
        uint256 totalEarned;
        uint256 lessonsCompleted;
    }

    mapping(address => Student) public students;
    mapping(bytes32 => bool) public phoneHashUsed;

    uint256 public totalStudents;
    uint256 public totalPaid;
    uint256 public totalLessons;
    bool public survivalMode;
    uint256 public survivalActivations;

    // ════════════════════════════════════════════
    // EVENTS
    // ════════════════════════════════════════════
    event StudentRegistered(address indexed student, bytes32 phoneHash);
    event StudentVerified(address indexed student);
    event StudentPaid(
        address indexed student,
        uint8 score,
        string topic,
        uint256 amount,
        string filecoinCID
    );
    event StudentBlacklisted(address indexed student, string reason);
    event PoolFunded(address indexed funder, uint256 amount);
    event SurvivalModeActivated(uint256 balance, uint256 runwayDays);
    event SurvivalModeDeactivated(uint256 balance);

    // ════════════════════════════════════════════
    // CONSTRUCTOR
    // ════════════════════════════════════════════
    constructor(address _cUSD) Ownable(msg.sender) {
        cUSD = IERC20(_cUSD);
    }

    // ════════════════════════════════════════════
    // SETUP
    // ════════════════════════════════════════════
    function setImpactNFT(address _impactNFT) external onlyOwner {
        impactNFT = IImpactNFT(_impactNFT);
    }

    // ════════════════════════════════════════════
    // STUDENT REGISTRATION
    // ════════════════════════════════════════════
    function register(bytes32 phoneHash) external {
        require(students[msg.sender].phoneHash == bytes32(0), "Already registered");
        require(!phoneHashUsed[phoneHash], "Phone already used");

        students[msg.sender] = Student({
            phoneHash: phoneHash,
            verified: false,
            blacklisted: false,
            lastLessonTime: 0,
            dailyEarned: 0,
            lastDayReset: block.timestamp,
            totalEarned: 0,
            lessonsCompleted: 0
        });

        phoneHashUsed[phoneHash] = true;
        totalStudents++;

        emit StudentRegistered(msg.sender, phoneHash);
    }

    // ════════════════════════════════════════════
    // VERIFICATION (Self Protocol — agent only)
    // ════════════════════════════════════════════
    function verifyStudent(address student) external onlyOwner {
        require(students[student].phoneHash != bytes32(0), "Not registered");
        require(!students[student].verified, "Already verified");

        students[student].verified = true;

        emit StudentVerified(student);
    }

    // ════════════════════════════════════════════
    // REWARD STUDENT (agent only)
    // ════════════════════════════════════════════
    function rewardStudent(
        address student,
        uint8 score,
        string calldata topic,
        string calldata filecoinCID,
        string calldata paymentTxHash,
        uint256 quizStartTime
    ) external onlyOwner nonReentrant {
        Student storage s = students[student];

        require(s.phoneHash != bytes32(0), "Not registered");
        require(s.verified, "Not verified");
        require(!s.blacklisted, "Blacklisted");
        require(score >= 4, "Score too low for reward");
        require(
            block.timestamp - s.lastLessonTime >= COOLDOWN || s.lastLessonTime == 0,
            "Cooldown not passed"
        );
        require(
            block.timestamp - quizStartTime >= MIN_QUIZ_TIME,
            "Quiz completed too fast"
        );

        // Reset daily earned if new day
        if (block.timestamp - s.lastDayReset >= 1 days) {
            s.dailyEarned = 0;
            s.lastDayReset = block.timestamp;
        }

        // Calculate reward
        uint256 reward = score == 5 ? REWARD_PERFECT : REWARD_PASS;

        require(s.dailyEarned + reward <= DAILY_CAP, "Daily cap reached");

        // Check treasury has enough
        uint256 treasuryBalance = cUSD.balanceOf(address(this));
        require(treasuryBalance >= reward, "Insufficient treasury");

        // Pay student
        cUSD.safeTransfer(student, reward);

        // Update student record
        s.lastLessonTime = block.timestamp;
        s.dailyEarned += reward;
        s.totalEarned += reward;
        s.lessonsCompleted++;

        // Update globals
        totalPaid += reward;
        totalLessons++;

        // Mint Impact NFT
        if (address(impactNFT) != address(0)) {
            impactNFT.mint(
                student,
                topic,
                score,
                reward,
                filecoinCID,
                paymentTxHash
            );
        }

        // Check survival mode
        _checkSurvivalMode();

        emit StudentPaid(student, score, topic, reward, filecoinCID);
    }

    // ════════════════════════════════════════════
    // BLACKLIST (agent only)
    // ════════════════════════════════════════════
    function blacklistStudent(address student, string calldata reason) external onlyOwner {
        require(students[student].phoneHash != bytes32(0), "Not registered");

        students[student].blacklisted = true;

        emit StudentBlacklisted(student, reason);
    }

    // ════════════════════════════════════════════
    // FUND THE POOL (anyone can call)
    // ════════════════════════════════════════════
    function fundPool(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");

        cUSD.safeTransferFrom(msg.sender, address(this), amount);

        // Check if we can exit survival mode
        _checkSurvivalMode();

        emit PoolFunded(msg.sender, amount);
    }

    // ════════════════════════════════════════════
    // SURVIVAL MODE CHECK
    // ════════════════════════════════════════════
    function _checkSurvivalMode() internal {
        uint256 balance = cUSD.balanceOf(address(this));
        uint256 dailyCost = REWARD_PERFECT * 10; // estimate 10 students/day
        uint256 runwayDays = dailyCost > 0 ? balance / dailyCost : 0;

        if (runwayDays < SURVIVAL_THRESHOLD && !survivalMode) {
            survivalMode = true;
            survivalActivations++;
            emit SurvivalModeActivated(balance, runwayDays);
        } else if (runwayDays >= SURVIVAL_THRESHOLD && survivalMode) {
            survivalMode = false;
            emit SurvivalModeDeactivated(balance);
        }
    }

    // ════════════════════════════════════════════
    // PUBLIC VIEW FUNCTIONS
    // ════════════════════════════════════════════
    function getStats() external view returns (
        uint256 _totalStudents,
        uint256 _totalLessons,
        uint256 _totalPaid,
        uint256 _treasuryBalance,
        uint256 _runwayDays,
        bool _survivalMode,
        uint256 _survivalActivations
    ) {
        uint256 balance = cUSD.balanceOf(address(this));
        uint256 dailyCost = REWARD_PERFECT * 10;
        uint256 runway = dailyCost > 0 ? balance / dailyCost : 0;

        return (
            totalStudents,
            totalLessons,
            totalPaid,
            balance,
            runway,
            survivalMode,
            survivalActivations
        );
    }

    function getStudent(address student) external view returns (Student memory) {
        return students[student];
    }

    function getTreasuryBalance() external view returns (uint256) {
        return cUSD.balanceOf(address(this));
    }
}