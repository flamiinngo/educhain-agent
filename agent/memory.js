const memory = {
  // Agent start time
  startTime: Date.now(),
  
  // Cycle counter
  cycles: 0,
  
  // Action log
  actions: [],
  
  // Pending quizzes (waiting for student answers)
  pendingQuizzes: new Map(),
  
  // Pending submissions (waiting to be graded)
  pendingSubmissions: [],
  
  // Flagged accounts
  flaggedAccounts: [],
  
  // Survival mode log
  survivalLog: [],
  
  // Metrics
  metrics: {
    lessonsDelivered: 0,
    quizzesGraded: 0,
    paymentsReleased: 0,
    totalPaidCUSD: 0,
    studentsRegistered: 0,
    studentsBlacklisted: 0,
    nftsMinted: 0,
    nftsSold: 0,
    totalRaisedFromNFTs: 0
  },

  // Log an action
  logAction(action) {
    const entry = {
      id: this.actions.length + 1,
      timestamp: new Date().toISOString(),
      ...action,
      humanInvolved: false
    };
    this.actions.push(entry);
    
    // Keep only last 1000 actions in memory
    if (this.actions.length > 1000) {
      this.actions = this.actions.slice(-1000);
    }
    
    console.log(`[${new Date().toLocaleTimeString()}] ${action.type}: ${action.message}`);
    return entry;
  },

  // Get recent actions
  getRecentActions(count = 10) {
    return this.actions.slice(-count);
  },

  // Get uptime string
  getUptime() {
    const ms = Date.now() - this.startTime;
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  },

  // Get uptime in hours
  getUptimeHours() {
    return Math.floor((Date.now() - this.startTime) / 3600000);
  },

  // Store a pending quiz
  storeQuiz(quizId, data) {
    this.pendingQuizzes.set(quizId, {
      ...data,
      createdAt: Date.now()
    });
  },

  // Get a pending quiz
  getQuiz(quizId) {
    return this.pendingQuizzes.get(quizId);
  },

  // Remove a completed quiz
  removeQuiz(quizId) {
    this.pendingQuizzes.delete(quizId);
  },

  // Log survival mode activation
  logSurvival(data) {
    const entry = {
      activatedAt: new Date().toISOString(),
      ...data,
      humanInvolved: false
    };
    this.survivalLog.push(entry);
    return entry;
  },

  // Get full state for endpoints
  getState() {
    return {
      uptime: this.getUptime(),
      uptimeHours: this.getUptimeHours(),
      cycles: this.cycles,
      metrics: { ...this.metrics },
      recentActions: this.getRecentActions(10),
      survivalLog: [...this.survivalLog],
      flaggedAccounts: [...this.flaggedAccounts],
      humanInvolved: false
    };
  }
};

export default memory;