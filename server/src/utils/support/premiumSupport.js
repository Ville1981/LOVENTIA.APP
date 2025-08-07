// Premium Support Workflow

function createTicket(userId, issue) {
  // Create support ticket with high priority
  return SupportSystem.create({ userId, issue, priority: 'high', sla: '24h' });
}

function getSLADetails(plan) {
  const slas = {
    basic: '72h response time',
    premium: '24h response time',
    enterprise: '4h response time',
  };
  return slas[plan] || slas.basic;
}

module.exports = {
  createTicket,
  getSLADetails,
};