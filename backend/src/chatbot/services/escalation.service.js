// Single source for concierge escalation contacts. Operations can override the
// numbers with env vars without a code change; the defaults match the frontend
// chatbot config so both ends never drift apart again.
function getChannels() {
  const phone = process.env.CHATBOT_CONCIERGE_PHONE || '+94 11 234 5678';
  const whatsapp = process.env.CHATBOT_CONCIERGE_WHATSAPP || '+94 77 100 0001';
  return [
    { id: 'phone', label: '📞 Direct Concierge Line', desc: `${phone} (Instant Call)` },
    { id: 'whatsapp', label: '💬 WhatsApp Concierge', desc: `${whatsapp} (Chat with agent)` },
  ];
}

function getEscalationPrompt(reason = 'Talk to our team') {
  return {
    role: 'assistant',
    text: `I'd be happy to connect you with our team.\n\nHow would you like to talk to us?`,
    inlineComponent: {
      type: 'ESCALATION_MODAL',
      title: 'Talk to Us',
      reason,
      channels: getChannels(),
    },
  };
}

module.exports = {
  getEscalationPrompt,
  getChannels,
};
