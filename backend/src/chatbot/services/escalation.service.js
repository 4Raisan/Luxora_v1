const ESCALATION_CHANNELS = [
  { id: 'phone', label: '📞 Direct Concierge Line', desc: '+94 11 234 5678 (Instant Call)' },
  { id: 'whatsapp', label: '💬 WhatsApp Concierge', desc: '+94 77 123 4567 (Chat with agent)' }
];

function getEscalationPrompt(reason = 'Talk to our team') {
  return {
    role: 'assistant',
    text: `I'd be happy to connect you with our team.\n\nHow would you like to talk to us?`,
    inlineComponent: {
      type: 'ESCALATION_MODAL',
      title: 'Talk to Us',
      reason,
      channels: ESCALATION_CHANNELS
    }
  };
}

module.exports = {
  ESCALATION_CHANNELS,
  getEscalationPrompt
};
