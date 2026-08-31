const storage = require('./storage.service');

function startSpecialAskWizard(initialData = {}) {
  let category = 'GARDEN_CARE';
  if (typeof initialData === 'string') {
    category = initialData;
    initialData = {};
  } else if (initialData.category) {
    category = initialData.category;
  }

  return {
    state: 'STEP_FORM_INPUT',
    category: category,
    scope: initialData.quantity || initialData.scope || '',
    requiredServices: initialData.requiredServices || '',
    preferredSchedule: initialData.preferredSchedule || '',
    customerName: initialData.customerName || '',
    contactInfo: initialData.contactInfo || '',
    notes: initialData.notes || initialData.description || '',
    attachments: initialData.attachments || []
  };
}

function handleSpecialAskStep(draft, stepPayload) {
  const { action, text, files, customerName, contactInfo, scope, requiredServices, preferredSchedule, notes } = stepPayload;

  if (action === 'START') {
    draft.state = 'STEP_FORM_INPUT';
    if (scope) draft.scope = scope;
    if (text) draft.notes = text;
    return getSpecialAskPrompt(draft);
  }

  if (action === 'EDIT') {
    draft.state = 'STEP_FORM_INPUT';
    return getSpecialAskPrompt(draft);
  }

  switch (draft.state) {
    case 'STEP_FORM_INPUT': {
      if (customerName) draft.customerName = customerName.trim();
      if (contactInfo) draft.contactInfo = contactInfo.trim();
      if (scope) draft.scope = scope.trim();
      if (requiredServices) draft.requiredServices = requiredServices.trim();
      if (preferredSchedule) draft.preferredSchedule = preferredSchedule.trim();
      if (notes || text) draft.notes = (notes || text || '').trim();
      if (files && Array.isArray(files)) draft.attachments = files;

      draft.state = 'STEP_SUMMARY';
      return getSpecialAskPrompt(draft);
    }

    case 'STEP_SUMMARY': {
      if (action === 'CONFIRM') {
        const year = new Date().getFullYear();
        const randomCode = Math.floor(1000 + Math.random() * 9000);
        const requestId = `SA-${year}-${randomCode}`;

        let catName = 'Garden Care';
        if (draft.category === 'AUTO_CARE') catName = 'Auto Care';
        else if (draft.category === 'PET_CARE') catName = 'Pet Care';
        else if (draft.category === 'OTHER') catName = 'Custom Service';

        storage.saveRequestedService({
          id: requestId,
          type: 'SPECIAL_ASK',
          category: catName,
          categoryId: draft.category,
          scope: draft.scope || 'Custom scope',
          requiredServices: draft.requiredServices || 'Tailored assessment',
          preferredSchedule: draft.preferredSchedule || 'Flexible',
          customerName: draft.customerName || 'Customer',
          contactInfo: draft.contactInfo || 'Provided via Concierge',
          selectedRequirements: [draft.scope ? `Scope: ${draft.scope}` : 'Special Ask Requirement'],
          openDescription: draft.notes || 'Special Ask Service evaluation',
          attachments: draft.attachments || [],
          status: 'Pending Review',
          quoteLKR: null,
          adminNotes: ''
        });

        return {
          role: 'assistant',
          completed: true,
          requestId,
          text: `### ✦ Special Ask Submitted\n\nThanks! Your request has been sent to our Luxora concierge team.\n\nYour reference number is **#${requestId}**.\n\n* **Service:** ${catName}\n* **Scope:** ${draft.scope || 'Custom requirement'}\n* **Next Step:** Our team will review your requirements individually and get back to you within **2 to 4 hours** with the appropriate solution and pricing.`,
          actionButtons: [
            { label: 'View Customer Dashboard', action: 'VIEW_DASHBOARD' },
            { label: 'Talk to Us', action: 'CONTACT_SUPPORT' },
            { label: 'Ask Another Question', action: 'NEW_CONVERSATION' }
          ]
        };
      } else {
        draft.state = 'STEP_FORM_INPUT';
        return getSpecialAskPrompt(draft);
      }
    }

    default:
      return getSpecialAskPrompt(draft);
  }
}

function getSpecialAskPrompt(draft) {
  let catName = 'Garden Care';
  if (draft.category === 'AUTO_CARE') catName = 'Auto Care';
  else if (draft.category === 'PET_CARE') catName = 'Pet Care';

  switch (draft.state) {
    case 'STEP_FORM_INPUT':
      return {
        role: 'assistant',
        text: `### ✦ Special Ask Service (${catName})\n\nHave a requirement that doesn't fit our standard packages? Submit a special request and our Luxora team will review your requirements and get back to you with the appropriate solution.`,
        inlineComponent: {
          type: 'SPECIAL_ASK_INPUT',
          category: draft.category,
          categoryName: catName,
          scope: draft.scope || '',
          requiredServices: draft.requiredServices || '',
          preferredSchedule: draft.preferredSchedule || '',
          customerName: draft.customerName || '',
          contactInfo: draft.contactInfo || '',
          initialNotes: draft.notes || '',
          submitLabel: 'Submit Special Ask'
        }
      };

    case 'STEP_SUMMARY':
      return {
        role: 'assistant',
        text: '### ✦ Review Your Special Ask',
        inlineComponent: {
          type: 'SPECIAL_ASK_SUMMARY',
          categoryName: catName,
          scope: draft.scope || 'Not specified',
          requiredServices: draft.requiredServices || 'Standard & Custom combinations',
          preferredSchedule: draft.preferredSchedule || 'Flexible',
          customerName: draft.customerName || 'Customer',
          contactInfo: draft.contactInfo || 'On File',
          notes: draft.notes || 'No extra notes provided',
          attachmentsCount: (draft.attachments || []).length,
          actions: [
            { label: 'Submit Special Ask', action: 'CONFIRM', primary: true },
            { label: '✎ Edit', action: 'EDIT', primary: false }
          ]
        }
      };
  }
}

module.exports = {
  startSpecialAskWizard,
  handleSpecialAskStep,
  getSpecialAskPrompt,
  // Backward compatibility aliases
  startCustomRequestWizard: startSpecialAskWizard,
  handleCustomRequestStep: handleSpecialAskStep,
  getCustomRequestPrompt: getSpecialAskPrompt
};
