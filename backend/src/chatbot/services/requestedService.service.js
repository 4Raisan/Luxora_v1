// Only real catalog categories — the bespoke submission on the customer
// dashboard and POST /support/service-requests both validate against these.
const VALID_CATEGORIES = [
  'Auto Care',
  'Garden Care',
  'Pet Care'
];

function normalizeCategory(cat) {
  if (!cat) return 'Auto Care';
  const match = VALID_CATEGORIES.find(c => c.toLowerCase() === String(cat).toLowerCase() || c.toLowerCase().includes(String(cat).toLowerCase()));
  if (match) return match;
  if (cat === 'AUTO_CARE' || cat === 'auto') return 'Auto Care';
  if (cat === 'GARDEN_CARE' || cat === 'garden') return 'Garden Care';
  if (cat === 'PET_CARE' || cat === 'pet') return 'Pet Care';
  return 'Auto Care';
}

function startSpecialAskWizard(initialData = {}) {
  let category = 'Home & Estate Care';
  if (typeof initialData === 'string') {
    category = normalizeCategory(initialData);
    initialData = {};
  } else if (initialData.category) {
    category = normalizeCategory(initialData.category);
  }

  return {
    state: 'STEP_FORM_INPUT',
    title: initialData.title || initialData.subject || '',
    category: category,
    date: initialData.date || initialData.preferredDate || '',
    notes: initialData.notes || initialData.details || initialData.description || '',
    error: null
  };
}

function handleSpecialAskStep(draft, stepPayload = {}) {
  const { action, title, category, date, notes, text } = stepPayload;

  if (action === 'START') {
    draft.state = 'STEP_FORM_INPUT';
    draft.error = null;
    if (title) draft.title = String(title).trim();
    if (category) draft.category = normalizeCategory(category);
    if (date) draft.date = String(date).trim();
    if (notes || text) draft.notes = String(notes || text).trim();
    return getSpecialAskPrompt(draft);
  }

  if (action === 'EDIT') {
    draft.state = 'STEP_FORM_INPUT';
    draft.error = null;
    return getSpecialAskPrompt(draft);
  }

  switch (draft.state) {
    case 'STEP_FORM_INPUT': {
      const cleanTitle = (title !== undefined ? String(title) : draft.title || '').trim();
      const cleanCategory = normalizeCategory(category || draft.category);
      const cleanDate = (date !== undefined ? String(date) : draft.date || '').trim();
      const cleanNotes = (notes !== undefined ? String(notes) : (text !== undefined ? String(text) : draft.notes || '')).trim();

      draft.title = cleanTitle;
      draft.category = cleanCategory;
      draft.date = cleanDate;
      draft.notes = cleanNotes;

      // Backend Validation: All 4 fields must be provided and valid
      if (!cleanTitle) {
        draft.error = 'Service Subject / Title is required.';
        return getSpecialAskPrompt(draft);
      }
      if (!VALID_CATEGORIES.includes(cleanCategory)) {
        draft.error = 'Please select a valid category from the options.';
        return getSpecialAskPrompt(draft);
      }
      if (!cleanDate) {
        draft.error = 'Preferred Date is required.';
        return getSpecialAskPrompt(draft);
      }
      if (!cleanNotes) {
        draft.error = 'Special Requirements & Details are required.';
        return getSpecialAskPrompt(draft);
      }

      draft.error = null;
      draft.state = 'STEP_SUMMARY';
      return getSpecialAskPrompt(draft);
    }

    case 'STEP_SUMMARY': {
      if (action === 'CONFIRM' || action === 'CONTINUE') {
        return {
          role: 'assistant',
          completed: true,
          action: 'CONTINUE_BESPOKE',
          requestData: {
            title: draft.title,
            category: draft.category,
            date: draft.date,
            notes: draft.notes
          },
          text: `### ✦ Bespoke Concierge Request Prepared\n\nYour request has been recorded:\n\n* **Service Subject:** ${draft.title}\n* **Category:** ${draft.category}\n* **Preferred Date:** ${draft.date}\n* **Special Requirements:** ${draft.notes}\n\nClick below to open the **Bespoke Concierge Submission Form** on your dashboard to review and finalize your request.`,
          actionButtons: [
            {
              label: 'Proceed to Bespoke Request Form →',
              action: 'CONTINUE_BESPOKE',
              requestData: {
                title: draft.title,
                category: draft.category,
                date: draft.date,
                notes: draft.notes
              }
            }
          ]
        };
      } else {
        draft.state = 'STEP_FORM_INPUT';
        draft.error = null;
        return getSpecialAskPrompt(draft);
      }
    }

    default:
      return getSpecialAskPrompt(draft);
  }
}

function getSpecialAskPrompt(draft) {
  switch (draft.state) {
    case 'STEP_FORM_INPUT':
      return {
        role: 'assistant',
        text: `### ✦ Bespoke Concierge / Requested Service\n\nPlease fill out your service details below:`,
        inlineComponent: {
          type: 'SPECIAL_ASK_INPUT',
          title: draft.title || '',
          category: draft.category || 'Home & Estate Care',
          categories: VALID_CATEGORIES,
          date: draft.date || '',
          notes: draft.notes || '',
          error: draft.error || null,
          submitLabel: 'Review Request Summary →'
        }
      };

    case 'STEP_SUMMARY':
      return {
        role: 'assistant',
        text: '### ✦ Review Your Service Request',
        inlineComponent: {
          type: 'SPECIAL_ASK_SUMMARY',
          title: draft.title,
          category: draft.category,
          date: draft.date,
          notes: draft.notes,
          actions: [
            { label: 'Continue & Submit →', action: 'CONFIRM', primary: true },
            { label: '✎ Edit Request', action: 'EDIT', primary: false }
          ]
        }
      };
  }
}

module.exports = {
  startSpecialAskWizard,
  handleSpecialAskStep,
  getSpecialAskPrompt,
  VALID_CATEGORIES,
  // Backward compatibility aliases
  startCustomRequestWizard: startSpecialAskWizard,
  handleCustomRequestStep: handleSpecialAskStep,
  getCustomRequestPrompt: getSpecialAskPrompt
};
