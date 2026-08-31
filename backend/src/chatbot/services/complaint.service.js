const storage = require('./storage.service');

const COMPLAINT_CATEGORIES = [
  { id: 'SERVICE_QUALITY', label: '⭐ Service was not good', desc: 'The job was not done properly' },
  { id: 'PROPERTY_DAMAGE', label: '🚨 Something was damaged', desc: 'Scratch on car, plant damage, or broken item' },
  { id: 'PROVIDER_NO_SHOW', label: '⏳ Provider was late / never came', desc: 'No one arrived or provider was very late' },
  { id: 'PROVIDER_BEHAVIOR', label: '👤 Provider behavior', desc: 'Unfriendly or unprofessional conduct' },
  { id: 'PAYMENT_ISSUE', label: '💳 Payment or Token issue', desc: 'Wrong charge or missing token' },
  { id: 'OTHER', label: '📝 Something else', desc: 'Other problem or question' }
];

function startComplaintWizard(initialDetails = {}) {
  return {
    state: 'STEP_1_CATEGORY',
    category: initialDetails.category || null,
    service: initialDetails.service || 'Auto Care',
    bookingId: initialDetails.bookingId || 'BK-' + Math.floor(1000 + Math.random() * 9000),
    description: initialDetails.description || '',
    attachments: []
  };
}

function handleComplaintStep(draft, stepPayload) {
  const { action, value, text, files } = stepPayload;

  if (action === 'CANCEL') {
    return {
      role: 'assistant',
      text: 'I have cancelled this report. What else can I help you with?',
      cancelled: true
    };
  }

  if (action === 'GO_BACK') {
    if (draft.state === 'STEP_4_SUMMARY') draft.state = 'STEP_3_ATTACHMENTS';
    else if (draft.state === 'STEP_3_ATTACHMENTS') draft.state = 'STEP_2_DESCRIPTION';
    else if (draft.state === 'STEP_2_DESCRIPTION') draft.state = 'STEP_1_CATEGORY';
    return getComplaintPrompt(draft);
  }

  switch (draft.state) {
    case 'STEP_1_CATEGORY': {
      if (value) draft.category = value;
      draft.state = 'STEP_2_DESCRIPTION';
      return getComplaintPrompt(draft);
    }

    case 'STEP_2_DESCRIPTION': {
      draft.description = (text || value || draft.description || '').trim();
      draft.state = 'STEP_3_ATTACHMENTS';
      return getComplaintPrompt(draft);
    }

    case 'STEP_3_ATTACHMENTS': {
      if (files && Array.isArray(files)) {
        draft.attachments = files;
      }
      draft.state = 'STEP_4_SUMMARY';
      return getComplaintPrompt(draft);
    }

    case 'STEP_4_SUMMARY': {
      if (action === 'CONFIRM') {
        const ticketId = 'LX-' + Math.floor(100000 + Math.random() * 900000);
        const catObj = COMPLAINT_CATEGORIES.find(c => c.id === draft.category) || { label: 'General Issue' };

        storage.saveSupportTicket({
          id: ticketId,
          ticketNumber: ticketId,
          bookingId: draft.bookingId,
          category: catObj.label,
          categoryId: draft.category,
          service: draft.service,
          description: draft.description || 'Issue reported',
          attachments: draft.attachments || [],
          status: 'Under Review',
          priority: draft.category === 'PROPERTY_DAMAGE' ? 'URGENT' : 'HIGH',
          createdAt: new Date().toISOString()
        });

        return {
          role: 'assistant',
          completed: true,
          ticketId,
          text: `✅ **Your report has been received.**\n\nYour ticket number is **#${ticketId}**.\n\n* **Issue:** ${catObj.label}\n* **Booking:** #${draft.bookingId}\n* **What happens next:** A member of our team will review what happened and contact you within **2 to 4 hours** to make things right.`,
          actionButtons: [
            { label: 'Talk to Us', action: 'CONTACT_SUPPORT' },
            { label: 'Ask Another Question', action: 'NEW_CONVERSATION' }
          ]
        };
      } else {
        draft.state = 'STEP_1_CATEGORY';
        return getComplaintPrompt(draft);
      }
    }

    default:
      return getComplaintPrompt(draft);
  }
}

function getComplaintPrompt(draft) {
  switch (draft.state) {
    case 'STEP_1_CATEGORY':
      return {
        role: 'assistant',
        text: 'I\'m sorry to hear that. What went wrong?',
        inlineComponent: {
          type: 'RADIO_CARDS',
          name: 'complaint_category_selector',
          options: COMPLAINT_CATEGORIES.map(c => ({
            id: c.id,
            label: c.label,
            description: c.desc
          })),
          selected: draft.category
        }
      };

    case 'STEP_2_DESCRIPTION':
      return {
        role: 'assistant',
        text: `Please tell us what happened during booking **#${draft.bookingId}**:`,
        inlineComponent: {
          type: 'INLINE_TEXT_INPUT',
          name: 'complaint_description',
          value: draft.description || '',
          placeholder: 'Explain what went wrong in your own words...',
          submitLabel: 'Continue →',
          hasBack: true
        }
      };

    case 'STEP_3_ATTACHMENTS':
      return {
        role: 'assistant',
        text: 'Would you like to add photos of the issue? (e.g. photos of damage)',
        inlineComponent: {
          type: 'IMAGE_UPLOADER',
          name: 'complaint_uploader',
          allowSkip: true,
          skipLabel: 'Skip for now →',
          submitLabel: 'Attach & Continue →',
          hasBack: true
        }
      };

    case 'STEP_4_SUMMARY': {
      const catObj = COMPLAINT_CATEGORIES.find(c => c.id === draft.category) || { label: 'Service Problem' };
      return {
        role: 'assistant',
        text: 'Here is what you told us:',
        inlineComponent: {
          type: 'COMPLAINT_SUMMARY_CARD',
          title: 'Your Issue Report',
          data: {
            bookingId: draft.bookingId,
            service: draft.service,
            category: catObj.label,
            description: draft.description || 'Issue reported',
            attachmentsCount: (draft.attachments || []).length
          },
          actions: [
            { label: 'Submit Report', action: 'CONFIRM', primary: true, isDestructive: true },
            { label: 'Go Back', action: 'GO_BACK', primary: false },
            { label: 'Cancel', action: 'CANCEL', primary: false }
          ]
        }
      };
    }
  }
}

module.exports = {
  COMPLAINT_CATEGORIES,
  startComplaintWizard,
  handleComplaintStep,
  getComplaintPrompt
};
