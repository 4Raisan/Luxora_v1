const { getSimplifiedRecommendation } = require('./recommendation.service');
const { startSpecialAskWizard, handleSpecialAskStep, getSpecialAskPrompt } = require('./requestedService.service');
const { startComplaintWizard, handleComplaintStep, getComplaintPrompt } = require('./complaint.service');
const storage = require('./storage.service');
const catalog = require('../data/catalog.json');
const policies = require('../data/policies.json');

// In-memory conversation sessions
const sessions = new Map();

// Mock Member Token Wallet for Self-Care
const mockWallet = {
  planName: 'Luxora Home Membership',
  status: 'Active',
  renewalDate: '2026-09-15',
  tokens: {
    auto: { total: 2, remaining: 2, label: 'Auto Care Tokens', icon: '🚗' },
    garden: { total: 1, remaining: 1, label: 'Garden Care Tokens', icon: '🌿' },
    pet: { total: 1, remaining: 1, label: 'Pet Care Tokens', icon: '🐾' }
  }
};

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      activeWizard: null, // 'SPECIAL_ASK', 'COMPLAINT', 'SIZING', 'BOOKING'
      specialAskDraft: null,
      customRequestDraft: null,
      complaintDraft: null,
      sizingDraft: null,
      bookingDraft: null,
      history: []
    });
  }
  return sessions.get(sessionId);
}

function extractEntities(text) {
  const lower = (text || '').toLowerCase();

  let cars = null;
  const carMatch = lower.match(/(\d+)\s*(?:cars?|vehicles?|automobiles?)/i) || lower.match(/(?:one|a)\s+(?:car|vehicle)/i);
  if (carMatch) {
    cars = carMatch[1] ? parseInt(carMatch[1], 10) : 1;
  } else if (lower.includes('two cars')) cars = 2;
  else if (lower.includes('three cars')) cars = 3;

  let perches = null;
  const gardenMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:-?\s*perch(?:es)?)/i);
  if (gardenMatch) {
    perches = parseFloat(gardenMatch[1]);
  } else if (lower.includes('large garden') || lower.includes('huge garden') || lower.includes('over 30') || lower.includes('more than 30')) {
    perches = 35;
  }

  let pets = null;
  const petMatch = lower.match(/(\d+)\s*(?:pets?|dogs?|cats?)/i) || lower.match(/(?:one|a)\s+(?:dog|cat|pet)/i);
  if (petMatch) {
    pets = petMatch[1] ? parseInt(petMatch[1], 10) : 1;
  } else if (lower.includes('two dogs') || lower.includes('two cats') || lower.includes('two pets')) pets = 2;

  return { cars, perches, pets };
}

function getMainServiceGrid() {
  return {
    type: 'SERVICE_GRID',
    title: 'How can I assist you today?',
    items: [
      { id: 'auto', title: 'Auto Care', subtitle: 'Wash & Detailing', icon: '🚗', action: 'SELECT_AUTO' },
      { id: 'garden', title: 'Garden Care', subtitle: 'Lawn & Pruning', icon: '🌿', action: 'SELECT_GARDEN' },
      { id: 'pet', title: 'Pet Care', subtitle: 'Spa & Grooming', icon: '🐾', action: 'SELECT_PET' },
      { id: 'combos', title: 'Combo Plans', subtitle: 'All-in-One Bundles', icon: '👑', action: 'VIEW_COMBOS' },
      { id: 'tokens', title: 'My Tokens', subtitle: 'Check Balance & Use', icon: '🪙', action: 'CHECK_BALANCE' },
      { id: 'book', title: 'Book Service', subtitle: 'Schedule Visit', icon: '📅', action: 'START_BOOKING' },
      { id: 'special_ask', title: 'Special Ask', subtitle: 'Custom Solutions', icon: '📋', action: 'START_SPECIAL_ASK' },
      { id: 'track', title: 'Track Request', subtitle: 'Tickets & Status', icon: '🔍', action: 'TRACK_STATUS' },
      { id: 'sizing', title: 'Find My Package', subtitle: 'Step-by-Step Sizing', icon: '🎯', action: 'START_SIZING' },
      { id: 'support', title: 'Talk to Us', subtitle: 'Live Concierge', icon: '💬', action: 'CONTACT_SUPPORT' }
    ]
  };
}

async function processMessage(session, userMessage, structuredPayload = null, context = {}) {
  const text = (userMessage || '').trim();
  const lower = text.toLowerCase();
  const { user, prisma } = context;

  if (text) {
    session.history.push({ role: 'user', content: text, timestamp: new Date().toISOString() });
  }

  // ===========================================================================
  // 1. STRUCTURED PAYLOAD HANDLING
  // ===========================================================================
  if (structuredPayload) {
    const { wizardType, stepAction, value, text: payloadText, title, category, notes, date, timeSlot, address } = structuredPayload;

    // A. Special Ask / Custom Request Flow
    if (wizardType === 'SPECIAL_ASK' || wizardType === 'CUSTOM_REQUEST' || (!wizardType && (session.activeWizard === 'SPECIAL_ASK' || session.activeWizard === 'CUSTOM_REQUEST'))) {
      if (!session.specialAskDraft || stepAction === 'START') {
        session.specialAskDraft = startSpecialAskWizard({
          title: title || '',
          category: category || 'Home & Estate Care',
          date: date || '',
          notes: notes || payloadText || text || ''
        });
      }
      const wizardResp = handleSpecialAskStep(session.specialAskDraft, {
        action: stepAction,
        title: title || session.specialAskDraft.title,
        category: category || session.specialAskDraft.category,
        date: date || session.specialAskDraft.date,
        notes: notes || payloadText || value || text || session.specialAskDraft.notes,
        text: payloadText || value || text
      });
      if (wizardResp.completed) {
        session.activeWizard = null;
        session.specialAskDraft = null;
        session.customRequestDraft = null;
      }
      session.history.push(wizardResp);
      return wizardResp;
    }

    // B. Booking Wizard Flow
    if (wizardType === 'BOOKING' || (!wizardType && session.activeWizard === 'BOOKING')) {
      return handleBookingStep(session, stepAction, { category, date, timeSlot, address, value });
    }

    // C. Complaint Wizard Flow
    if (wizardType === 'COMPLAINT' || (!wizardType && session.activeWizard === 'COMPLAINT')) {
      if (!session.complaintDraft) {
        session.complaintDraft = startComplaintWizard();
      }
      const complaintResp = handleComplaintStep(session.complaintDraft, {
        action: stepAction,
        value,
        text,
        files
      });
      if (complaintResp.completed || complaintResp.cancelled) {
        session.activeWizard = null;
        session.complaintDraft = null;
      }
      session.history.push(complaintResp);
      return complaintResp;
    }

    // D. Sizing Wizard Flow
    if (wizardType === 'SIZING_WIZARD') {
      return handleSizingStep(session, stepAction, value);
    }

    // E. Single Category Auto Care Sizing
    if (wizardType === 'AUTO_SIZING') {
      const count = parseInt(value, 10) || 1;
      if (count > 6) {
        session.activeWizard = 'SPECIAL_ASK';
        session.specialAskDraft = startSpecialAskWizard({
          category: 'AUTO_CARE',
          quantity: `${count} vehicles`,
          scope: `${count} vehicles`,
          requiredServices: 'Multi-vehicle fleet detailing & doorstep maintenance'
        });
        const prompt = getSpecialAskPrompt(session.specialAskDraft);
        const reply = {
          role: 'assistant',
          text: `### ✦ Need something beyond our standard coverage?\n\nYour requirement (**${count} vehicles**) exceeds our standard package coverage (up to 6 vehicles).\n\nI've opened the **Special Ask / Requested Service** form for you below so our concierge operations team can review your fleet requirements and provide a bespoke proposal.`,
          inlineComponent: prompt.inlineComponent,
          actionButtons: [
            { label: 'Try Different Number', action: 'SELECT_AUTO' },
            { label: 'Talk to Us', action: 'CONTACT_SUPPORT' }
          ]
        };
        session.history.push(reply);
        return reply;
      }
      const rec = generateFinalRecommendation(count, 0, 0);
      session.history.push(rec);
      return rec;
    }

    // F. Single Category Garden Care Sizing
    if (wizardType === 'GARDEN_SIZING') {
      if (value === 'over_30' || parseFloat(value) > 30) {
        session.activeWizard = 'SPECIAL_ASK';
        session.specialAskDraft = startSpecialAskWizard({
          category: 'GARDEN_CARE',
          quantity: 'More than 30 perches',
          scope: 'Estate > 30 perches',
          requiredServices: 'Large-scale estate grounds maintenance & landscaping'
        });
        const prompt = getSpecialAskPrompt(session.specialAskDraft);
        const reply = {
          role: 'assistant',
          text: `### ✦ Need something beyond our standard coverage?\n\nYour property (**More than 30 perches**) exceeds our standard package coverage (up to 30 perches).\n\nI've opened the **Special Ask / Requested Service** form for you below so our estate management team can review your grounds parameters.`,
          inlineComponent: prompt.inlineComponent,
          actionButtons: [
            { label: 'Try Different Size', action: 'SELECT_GARDEN' },
            { label: 'Talk to Us', action: 'CONTACT_SUPPORT' }
          ]
        };
        session.history.push(reply);
        return reply;
      }
      let perches = 8;
      if (value === '10_to_20') perches = 15;
      else if (value === '20_to_30') perches = 25;
      const rec = generateFinalRecommendation(0, perches, 0);
      session.history.push(rec);
      return rec;
    }

    // G. Single Category Pet Care Sizing
    if (wizardType === 'PET_SIZING') {
      const count = parseInt(value, 10) || 1;
      if (count > 5) {
        session.activeWizard = 'SPECIAL_ASK';
        session.specialAskDraft = startSpecialAskWizard({
          category: 'PET_CARE',
          quantity: `${count} pets`,
          scope: `${count} pets`,
          requiredServices: 'Multi-pet spa & grooming management'
        });
        const prompt = getSpecialAskPrompt(session.specialAskDraft);
        const reply = {
          role: 'assistant',
          text: `### ✦ Need something beyond our standard coverage?\n\nYour requirement (**${count} pets**) exceeds our standard package coverage (up to 5 pets).\n\nI've opened the **Special Ask / Requested Service** form for you below so our pet care specialists can review your requirements.`,
          inlineComponent: prompt.inlineComponent,
          actionButtons: [
            { label: 'Try Different Number', action: 'SELECT_PET' },
            { label: 'Talk to Us', action: 'CONTACT_SUPPORT' }
          ]
        };
        session.history.push(reply);
        return reply;
      }
      const rec = generateFinalRecommendation(0, 0, count);
      session.history.push(rec);
      return rec;
    }
  }

  // ===========================================================================
  // 2. CHECK IF WAITING IN ACTIVE WIZARD
  // ===========================================================================
  if ((session.activeWizard === 'SPECIAL_ASK' || session.activeWizard === 'CUSTOM_REQUEST') && session.specialAskDraft) {
    const wizardResp = handleSpecialAskStep(session.specialAskDraft, { text });
    if (wizardResp.completed) {
      session.activeWizard = null;
      session.specialAskDraft = null;
    }
    session.history.push(wizardResp);
    return wizardResp;
  }

  if (session.activeWizard === 'COMPLAINT' && session.complaintDraft) {
    const complaintResp = handleComplaintStep(session.complaintDraft, { text });
    if (complaintResp.completed || complaintResp.cancelled) {
      session.activeWizard = null;
      session.complaintDraft = null;
    }
    session.history.push(complaintResp);
    return complaintResp;
  }

  if (session.activeWizard === 'BOOKING' && session.bookingDraft) {
    return handleBookingStep(session, 'NEXT', { value: text });
  }

  // ===========================================================================
  // 3. INTENT: MY TOKENS & WALLET BALANCE (Self-Care)
  // ===========================================================================
  // ===========================================================================
  // 3. INTENT: MY TOKENS & WALLET BALANCE (Real Database Self-Care)
  // ===========================================================================
  if (lower.includes('token') && (lower.includes('my') || lower.includes('balance') || lower.includes('check') || lower.includes('left') || lower.includes('wallet')) || lower === 'check_balance' || lower === 'my tokens') {
    if (user && prisma) {
      try {
        const sub = await prisma.userSubscription.findFirst({
          where: { userId: user.id, status: 'active' },
          include: { plan: { include: { entitlements: { include: { category: true } } } } }
        });
        if (sub) {
          const entLines = (sub.plan?.entitlements || []).map(e => `* **${e.units} × ${e.category?.name || 'Service'} Tokens** / month`).join('\n');
          const reply = {
            role: 'assistant',
            text: `### 🪙 Active Membership: ${sub.plan?.title || 'Luxora Plan'}\n\nHello **${user.name}**!\n\n* **Status:** Active\n* **Renewal Date:** ${sub.endDate ? new Date(sub.endDate).toLocaleDateString() : 'N/A'}\n\n**Your Monthly Entitlements:**\n${entLines || '* Standard service tokens included'}\n\nYou can use your tokens directly to book doorstep services.`,
            actionButtons: [
              { label: '📅 Book Service with Token', action: 'START_BOOKING' },
              { label: '👤 View Full Dashboard', action: 'VIEW_DASHBOARD' },
              { label: '🏠 Main Menu', action: 'SHOW_MAIN_MENU' }
            ],
            quickReplies: ['📅 Book a Service', '🚗 Auto Care', '🌿 Garden Care']
          };
          session.history.push(reply);
          return reply;
        } else {
          const reply = {
            role: 'assistant',
            text: `### 🪙 Token Wallet\n\nHello **${user.name}**! You do not currently have an active membership subscription.\n\nSubscribe to any Luxora plan to receive monthly tokens:`,
            actionButtons: [
              { label: '🎯 Explore Membership Plans', action: 'START_SIZING' },
              { label: '📅 Book Pay-As-You-Go Service', action: 'START_BOOKING' },
              { label: '🏠 Main Menu', action: 'SHOW_MAIN_MENU' }
            ],
            quickReplies: ['🚗 Auto Care', '🌿 Garden Care', '🐾 Pet Care']
          };
          session.history.push(reply);
          return reply;
        }
      } catch (dbErr) {
        console.error('Error fetching user subscription:', dbErr);
      }
    }

    const reply = {
      role: 'assistant',
      text: `### 🪙 Luxora Token Wallet\n\nTokens are automatically added to your membership account on each monthly renewal cycle:\n\n* **1 Auto Care Token** = 1 Vehicle Service\n* **1 Garden Care Token** = 1 Garden Visit\n* **1 Pet Care Token** = 1 Pet Grooming Visit\n\nTo view your live active token balance, please sign in to your account.`,
      actionButtons: [
        { label: '🔑 Sign In to View Tokens', action: 'VIEW_DASHBOARD' },
        { label: '🎯 Explore Membership Plans', action: 'START_SIZING' },
        { label: '🏠 Main Menu', action: 'SHOW_MAIN_MENU' }
      ],
      quickReplies: ['🚗 Auto Care', '🌿 Garden Care', '🐾 Pet Care']
    };
    session.history.push(reply);
    return reply;
  }

  // ===========================================================================
  // 4. INTENT: BOOK A SERVICE (Direct Booking Portal)
  // ===========================================================================
  if (lower.includes('book') || lower.includes('schedule') || lower.includes('appointment') || lower === 'start_booking') {
    const reply = {
      role: 'assistant',
      text: `### 📅 Reserve a Luxora Concierge Service\n\nChoose a category to start your booking:`,
      actionButtons: [
        { label: '🚗 Book Auto Care', action: 'START_BOOKING', category: 'auto' },
        { label: '🌿 Book Garden Care', action: 'START_BOOKING', category: 'garden' },
        { label: '🐾 Book Pet Care', action: 'START_BOOKING', category: 'pet' },
        { label: '🏠 Main Menu', action: 'SHOW_MAIN_MENU' }
      ]
    };
    session.history.push(reply);
    return reply;
  }

  // ===========================================================================
  // 5. INTENT: TRACK REQUESTS / TICKETS (Real Database Status)
  // ===========================================================================
  if (lower.includes('track') || lower.includes('status') || lower.includes('my request') || lower.includes('ticket') || lower === 'track_status') {
    if (user && prisma) {
      try {
        const bookings = await prisma.booking.findMany({
          where: { userId: user.id },
          include: { service: true },
          orderBy: { id: 'desc' },
          take: 3
        });
        const tickets = await prisma.supportTicket.findMany({
          where: { userId: user.id },
          orderBy: { id: 'desc' },
          take: 3
        });

        let infoText = `### 🔍 Live Account Status\n\nHello **${user.name}**! Here is your latest account activity:\n\n`;
        if (bookings.length > 0) {
          infoText += `**Recent Bookings:**\n` + bookings.map(b => `* Booking **#${b.id}** (${b.service?.title || 'Service'}) — Date: ${b.bookingDate} at ${b.bookingTime} — Status: **${b.status}**`).join('\n') + `\n\n`;
        }
        if (tickets.length > 0) {
          infoText += `**Support & Special Ask Requests:**\n` + tickets.map(t => `* Ticket **#${t.id}**: ${t.subject} — Status: **${t.status}**`).join('\n') + `\n\n`;
        }
        if (bookings.length === 0 && tickets.length === 0) {
          infoText += `You have no recent bookings or support requests.\n\n`;
        }

        const reply = {
          role: 'assistant',
          text: infoText,
          actionButtons: [
            { label: '👤 Open Member Dashboard', action: 'VIEW_DASHBOARD' },
            { label: '📅 Book a Service', action: 'START_BOOKING' },
            { label: 'Make a Special Ask', action: 'START_SPECIAL_ASK' }
          ],
          quickReplies: ['🪙 My Tokens', '🚗 Auto Care', '🌿 Garden Care']
        };
        session.history.push(reply);
        return reply;
      } catch (dbErr) {
        console.error('Error fetching tracking status:', dbErr);
      }
    }

    const reply = {
      role: 'assistant',
      text: `### 🔍 Track Your Requests & Live Bookings\n\nYou can track the live status of your service bookings, provider assignments, and Special Ask evaluations in real-time on your **Member Dashboard**.`,
      actionButtons: [
        { label: '🔑 Sign In to View Dashboard', action: 'VIEW_DASHBOARD' },
        { label: '📋 Submit New Special Ask', action: 'START_SPECIAL_ASK' },
        { label: '💬 Talk to Concierge', action: 'CONTACT_SUPPORT' },
        { label: '🏠 Main Menu', action: 'SHOW_MAIN_MENU' }
      ],
      quickReplies: ['🪙 My Tokens', '🚗 Auto Care', '🌿 Garden Care']
    };
    session.history.push(reply);
    return reply;
  }

  // ===========================================================================
  // 6. INTENT: "TALK TO US" / HUMAN HELP
  // ===========================================================================
  if (lower.includes('human') || lower.includes('agent') || lower.includes('person') || lower.includes('speak to someone') || lower.includes('talk to us') || lower.includes('call us') || lower.includes('contact us') || lower.includes('helpdesk') || lower.includes('support')) {
    const reply = getEscalationPrompt('Talk to our team');
    session.history.push(reply);
    return reply;
  }

  // ===========================================================================
  // 7. INTENT: SPECIFIC NON-STANDARD SERVICE QUESTIONS (Strict clarification + Special Ask)
  // ===========================================================================
  const isAskingLandscaping = lower.includes('landscaping') || lower.includes('lawn redesign');
  const isAskingTreeCutting = lower.includes('tree cutting') || lower.includes('tree trimming') || lower.includes('tree removal') || lower.includes('trees');
  const isAskingCeramic = lower.includes('ceramic') || lower.includes('paint correction') || lower.includes('scratch removal') || lower.includes('graphene');
  const isAskingShowGrooming = lower.includes('show styling') || lower.includes('breed styling') || lower.includes('sensitive skin') || lower.includes('special grooming');

  if (isAskingLandscaping) {
    const reply = {
      role: 'assistant',
      text: `Landscaping isn't listed as part of our standard Garden Care service.\n\nIf you have a requirement that doesn't fit our standard packages, you can submit a **Special Ask** and our team will review your requirements individually.`,
      actionButtons: [
        { label: 'Make a Special Ask', action: 'START_SPECIAL_ASK_GARDEN' },
        { label: 'View Garden Packages', action: 'VIEW_GARDEN_PACKAGES' },
        { label: 'Talk to Us', action: 'CONTACT_SUPPORT' }
      ]
    };
    session.history.push(reply);
    return reply;
  }

  if (isAskingTreeCutting) {
    const reply = {
      role: 'assistant',
      text: `Tree cutting and large-scale pruning aren't listed as part of our standard Garden Care service.\n\nIf you have a requirement that doesn't fit our standard packages, you can submit a **Special Ask** and our team will review your requirements individually.`,
      actionButtons: [
        { label: 'Make a Special Ask', action: 'START_SPECIAL_ASK_GARDEN' },
        { label: 'View Garden Packages', action: 'VIEW_GARDEN_PACKAGES' },
        { label: 'Talk to Us', action: 'CONTACT_SUPPORT' }
      ]
    };
    session.history.push(reply);
    return reply;
  }

  if (isAskingCeramic) {
    const reply = {
      role: 'assistant',
      text: `Ceramic coating and paint correction aren't listed as part of our standard Auto Care service.\n\nIf you have a requirement that doesn't fit our standard packages, you can submit a **Special Ask** and our team will review your requirements individually.`,
      actionButtons: [
        { label: 'Make a Special Ask', action: 'START_SPECIAL_ASK_AUTO' },
        { label: 'View Auto Packages', action: 'VIEW_AUTO_PACKAGES' },
        { label: 'Talk to Us', action: 'CONTACT_SUPPORT' }
      ]
    };
    session.history.push(reply);
    return reply;
  }

  if (isAskingShowGrooming) {
    const reply = {
      role: 'assistant',
      text: `Special breed show styling isn't listed as part of our standard Pet Care service.\n\nIf you have a requirement that doesn't fit our standard packages, you can submit a **Special Ask** and our team will review your requirements individually.`,
      actionButtons: [
        { label: 'Make a Special Ask', action: 'START_SPECIAL_ASK_PET' },
        { label: 'View Pet Packages', action: 'VIEW_PET_PACKAGES' },
        { label: 'Talk to Us', action: 'CONTACT_SUPPORT' }
      ]
    };
    session.history.push(reply);
    return reply;
  }

  // ===========================================================================
  // 8. INTENT: TRIGGER SPECIAL ASK SERVICE
  // ===========================================================================
  if (lower.includes('special ask') || lower.includes('special service') || lower.includes('custom request') || lower.includes('custom service') || lower.includes('tell us what you need') || lower.includes('requested service') || lower.includes('requested services') || lower.includes('request service') || lower === 'start_special_ask' || lower === 'requested_service') {
    let cat = 'GARDEN_CARE';
    if (lower.includes('auto') || lower.includes('car')) cat = 'AUTO_CARE';
    else if (lower.includes('pet') || lower.includes('dog') || lower.includes('cat')) cat = 'PET_CARE';

    session.activeWizard = 'SPECIAL_ASK';
    session.specialAskDraft = startSpecialAskWizard(cat);

    const prompt = getSpecialAskPrompt(session.specialAskDraft);
    session.history.push(prompt);
    return prompt;
  }

  // ===========================================================================
  // 9. INTENT: AUTO CARE CATEGORY DISCOVERY & SIZING
  // ===========================================================================
  if (lower.includes('auto care') || lower.includes('car wash') || lower.includes('view auto packages') || lower === 'car' || lower === 'auto' || lower === 'select_auto') {
    const reply = {
      role: 'assistant',
      text: `### 🚗 Auto Care Discovery\n\nAll our Auto Care packages include **the same standard features**:\n✓ Exterior wash & window cleaning\n✓ Interior vacuuming\n✓ Basic tire shine\n\n**How many vehicles do you have?**`,
      inlineComponent: {
        type: 'STEPPER_SELECTOR',
        name: 'auto_vehicles_stepper',
        wizardType: 'AUTO_SIZING',
        label: 'Vehicles',
        value: 1,
        min: 1,
        max: 15,
        submitLabel: 'Find Best Auto Package →'
      },
      actionButtons: [
        { label: 'Make a Special Ask', action: 'START_SPECIAL_ASK_AUTO' },
        { label: '🏠 Main Menu', action: 'SHOW_MAIN_MENU' }
      ],
      quickReplies: ['1 Vehicle', '2 Vehicles', '3 Vehicles', '4 Vehicles', 'More than 6 Vehicles']
    };
    session.history.push(reply);
    return reply;
  }

  // ===========================================================================
  // 10. INTENT: GARDEN CARE CATEGORY DISCOVERY & SIZING
  // ===========================================================================
  if (lower.includes('garden care') || lower.includes('lawn') || lower.includes('view garden packages') || lower === 'garden' || lower === 'select_garden') {
    const reply = {
      role: 'assistant',
      text: `### 🌿 Garden Care Discovery\n\nAll our Garden Care packages include **the same standard features**:\n✓ Lawn mowing & precision edging\n✓ Basic weeding & fertilizer application\n✓ Basic plant health inspection & pruning\n\n**How big is your garden?**`,
      inlineComponent: {
        type: 'OPTION_CHIPS',
        name: 'garden_size_chips',
        wizardType: 'GARDEN_SIZING',
        options: [
          { id: 'under_10', label: 'Under 10 perches (Basic)' },
          { id: '10_to_20', label: '10–20 perches (Standard)' },
          { id: '20_to_30', label: '20–30 perches (Premium)' },
          { id: 'over_30', label: 'More than 30 perches (Estate / Special Ask)' }
        ],
        selected: null
      },
      actionButtons: [
        { label: 'Make a Special Ask', action: 'START_SPECIAL_ASK_GARDEN' },
        { label: '🏠 Main Menu', action: 'SHOW_MAIN_MENU' }
      ],
      quickReplies: ['Under 10 perches', '10-20 perches', '20-30 perches', 'More than 30 perches']
    };
    session.history.push(reply);
    return reply;
  }

  // ===========================================================================
  // 11. INTENT: PET CARE CATEGORY DISCOVERY & SIZING
  // ===========================================================================
  if (lower.includes('pet care') || lower.includes('grooming') || lower.includes('dog') || lower.includes('cat') || lower.includes('view pet packages') || lower === 'select_pet') {
    const reply = {
      role: 'assistant',
      text: `### 🐾 Pet Care Discovery\n\nAll our Pet Care packages include **the same standard features**:\n✓ Gentle spa wash & blow-dry\n✓ Nail trimming & ear cleaning\n✓ Brushing, coat fluff & flea check\n\n**How many pets do you have?**`,
      inlineComponent: {
        type: 'STEPPER_SELECTOR',
        name: 'pets_count_stepper',
        wizardType: 'PET_SIZING',
        label: 'Pets',
        value: 1,
        min: 1,
        max: 12,
        submitLabel: 'Find Best Pet Package →'
      },
      actionButtons: [
        { label: 'Make a Special Ask', action: 'START_SPECIAL_ASK_PET' },
        { label: '🏠 Main Menu', action: 'SHOW_MAIN_MENU' }
      ],
      quickReplies: ['1 Pet', '2 Pets', '3 Pets', 'More than 5 Pets']
    };
    session.history.push(reply);
    return reply;
  }

  // ===========================================================================
  // 12. INTENT: ALL-IN-ONE COMBOS
  // ===========================================================================
  if (lower.includes('prestige') || lower.includes('luxora home') || lower.includes('luxora family') || lower.includes('combo')) {
    const reply = {
      role: 'assistant',
      text: `### 👑 Luxora Combo Memberships\n\nCombo memberships use the same standard service features as individual plans, bundled for convenience:\n\n* **Luxora Home — LKR 18,000/month:** 4 Total Tokens (2 Auto + 1 Garden + 1 Pet)\n* **Luxora Family — LKR 28,000/month:** 8 Total Tokens (4 Auto + 2 Garden + 2 Pet)\n* **Luxora Prestige — LKR 40,000/month:** 12 Total Tokens (4 Auto + 4 Garden + 4 Pet)`,
      actionButtons: [
        { label: 'Find the Right Package', action: 'START_SIZING' },
        { label: '📅 Book Service with Token', action: 'START_BOOKING' },
        { label: 'Talk to Us', action: 'CONTACT_SUPPORT' }
      ]
    };
    session.history.push(reply);
    return reply;
  }

  // ===========================================================================
  // 13. INTENT: HOW TOKENS WORK / POLICIES
  // ===========================================================================
  if (lower.includes('token') || lower.includes('how do tokens work') || lower.includes('tokens work')) {
    const reply = {
      role: 'assistant',
      text: `### 🪙 How Tokens Work\n\n* **1 Auto Care Token** = 1 Vehicle Service\n* **1 Garden Care Token** = 1 Garden Visit\n* **1 Pet Care Token** = 1 Pet Service Session\n\nTokens are added to your account each month. When our verified provider completes your service, 1 token is consumed.`,
      actionButtons: [
        { label: '🪙 Check My Balance', action: 'CHECK_BALANCE' },
        { label: 'Find My Package', action: 'START_SIZING' },
        { label: 'Talk to Us', action: 'CONTACT_SUPPORT' }
      ]
    };
    session.history.push(reply);
    return reply;
  }

  if (lower.includes('cancel') || lower.includes('refund') || lower.includes('policy')) {
    const reply = {
      role: 'assistant',
      text: `### 🛡️ Cancellation & Guarantee Policies\n\n* **Flexible Memberships:** You can cancel or pause your subscription anytime with 1 click in your dashboard.\n* **100% Satisfaction Guarantee:** If you are ever unsatisfied with any service, we provide a free re-service or full token credit.\n* **No Hidden Fees:** Prices are transparent with provider payout and margin fully visible.`,
      actionButtons: [
        { label: '👤 Member Dashboard', action: 'VIEW_DASHBOARD' },
        { label: '🏠 Main Menu', action: 'SHOW_MAIN_MENU' }
      ]
    };
    session.history.push(reply);
    return reply;
  }

  // ===========================================================================
  // 14. INTENT: START STEP-BY-STEP SIZING
  // ===========================================================================
  const entities = extractEntities(text);
  if (lower.includes('what should i get') || lower.includes('recommend') || lower.includes('find my package') || lower.includes('find the right package') || lower.includes('package recommendation') || lower.includes('new house') || lower.includes('package for my home') || lower.includes('packages for my home')) {
    session.activeWizard = 'SIZING';
    session.sizingDraft = { step: 1, cars: entities.cars !== null ? entities.cars : 2, pets: entities.pets !== null ? entities.pets : 0, perches: entities.perches !== null ? entities.perches : 0 };

    const prompt = getSizingStepPrompt(session.sizingDraft);
    session.history.push(prompt);
    return prompt;
  }

  if ((entities.cars !== null || entities.perches !== null || entities.pets !== null) && (entities.cars > 0 || entities.perches > 0 || entities.pets > 0)) {
    const cars = entities.cars || 0;
    const perches = entities.perches || 0;
    const pets = entities.pets || 0;
    return generateFinalRecommendation(cars, perches, pets);
  }

  // ===========================================================================
  // 15. DEFAULT WELCOME / MAIN MENU (MyDialog Grid Assistant)
  // ===========================================================================
  const welcomeReply = {
    role: 'assistant',
    text: `Hello! I am your **Luxora Concierge**.\n\nI can help you explore packages, check your tokens, book services, or submit special requests.`,
    inlineComponent: getMainServiceGrid(),
    actionButtons: [
      { label: '🪙 My Tokens', action: 'CHECK_BALANCE' },
      { label: '📅 Book Service', action: 'START_BOOKING' },
      { label: '🎯 Sizing Calculator', action: 'START_SIZING' },
      { label: '💬 Talk to Concierge', action: 'CONTACT_SUPPORT' }
    ],
    quickReplies: [
      '🪙 My Tokens',
      '📅 Book a Service',
      '🚗 Auto Care',
      '🌿 Garden Care',
      '🐾 Pet Care',
      'Find the right package'
    ]
  };
  session.history.push(welcomeReply);
  return welcomeReply;
}

// =============================================================================
// BOOKING WIZARD HANDLERS
// =============================================================================
function handleBookingStep(session, action, payload = {}) {
  const { category, date, timeSlot, address, value } = payload;
  if (!session.bookingDraft) {
    session.bookingDraft = { step: 1, category: category || 'Auto Care', date: 'Tomorrow, 10:00 AM', address: '14/2 Alfred House Gardens, Colombo 03' };
  }
  const draft = session.bookingDraft;

  if (action === 'CANCEL') {
    session.activeWizard = null;
    session.bookingDraft = null;
    return {
      role: 'assistant',
      text: 'Booking cancelled. What else can I help you with?',
      inlineComponent: getMainServiceGrid(),
      actionButtons: [
        { label: '🪙 Check Tokens', action: 'CHECK_BALANCE' },
        { label: '🏠 Main Menu', action: 'SHOW_MAIN_MENU' }
      ]
    };
  }

  if (action === 'CONFIRM') {
    const bookingRef = 'BK-2026-' + Math.floor(1000 + Math.random() * 9000);
    const servicePin = Math.floor(1000 + Math.random() * 9000);
    session.activeWizard = null;
    session.bookingDraft = null;

    return {
      role: 'assistant',
      text: `### ✦ Booking Confirmed!\n\nYour service visit has been scheduled successfully.\n\n* **Booking Ref:** **#${bookingRef}**\n* **Service:** ${draft.category}\n* **Scheduled For:** ${draft.date || 'Tomorrow, 10:00 AM'}\n* **Service PIN:** **${servicePin}** *(Share with provider upon arrival)*\n* **Token Consumed:** 1 ${draft.category} Token deducted from your wallet.`,
      inlineComponent: {
        type: 'BOOKING_CONFIRMATION_CARD',
        bookingRef,
        servicePin,
        category: draft.category,
        date: draft.date || 'Tomorrow, 10:00 AM',
        address: draft.address || 'Colombo'
      },
      actionButtons: [
        { label: '🔍 Track Booking Status', action: 'TRACK_STATUS' },
        { label: '🪙 View Remaining Tokens', action: 'CHECK_BALANCE' },
        { label: '🏠 Main Menu', action: 'SHOW_MAIN_MENU' }
      ]
    };
  }

  if (action === 'START') {
    draft.step = 1;
    if (category) draft.category = category;
    return getBookingStepPrompt(draft);
  }

  if (draft.step === 1) {
    if (category) draft.category = category;
    draft.step = 2;
    return getBookingStepPrompt(draft);
  }

  if (draft.step === 2) {
    if (date) draft.date = date;
    if (timeSlot) draft.timeSlot = timeSlot;
    if (address) draft.address = address;
    draft.step = 3;
    return getBookingStepPrompt(draft);
  }

  return getBookingStepPrompt(draft);
}

function getBookingStepPrompt(draft) {
  if (draft.step === 1) {
    return {
      role: 'assistant',
      text: `### 📅 Book a Service Visit\n\nWhich service would you like to schedule?`,
      inlineComponent: {
        type: 'OPTION_CHIPS',
        name: 'booking_service_chips',
        options: [
          { id: 'Auto Care', label: '🚗 Auto Care (1 Token)' },
          { id: 'Garden Care', label: '🌿 Garden Care (1 Token)' },
          { id: 'Pet Care', label: '🐾 Pet Care (1 Token)' }
        ],
        selected: draft.category
      },
      actionButtons: [
        { label: 'Cancel', action: 'CANCEL_BOOKING' }
      ]
    };
  }

  if (draft.step === 2) {
    return {
      role: 'assistant',
      text: `### 📅 Select Preferred Date & Slot for ${draft.category}`,
      inlineComponent: {
        type: 'BOOKING_FORM',
        category: draft.category,
        availableSlots: [
          'Tomorrow, 09:00 AM - 11:00 AM',
          'Tomorrow, 02:00 PM - 04:00 PM',
          'This Saturday, 10:00 AM - 12:00 PM',
          'This Sunday, 03:00 PM - 05:00 PM'
        ],
        currentAddress: draft.address || '14/2 Alfred House Gardens, Colombo 03'
      },
      actionButtons: [
        { label: 'Cancel', action: 'CANCEL_BOOKING' }
      ]
    };
  }

  if (draft.step === 3) {
    return {
      role: 'assistant',
      text: `### ✦ Confirm Your Booking Details`,
      inlineComponent: {
        type: 'BOOKING_REVIEW_CARD',
        category: draft.category,
        date: draft.date || 'Tomorrow, 10:00 AM',
        address: draft.address || 'Colombo 03',
        tokenCost: '1 Token'
      },
      actionButtons: [
        { label: '✓ Confirm & Schedule', action: 'CONFIRM_BOOKING' },
        { label: 'Cancel', action: 'CANCEL_BOOKING' }
      ]
    };
  }
}

// =============================================================================
// SIZING WIZARD STEP HANDLER
// =============================================================================
function handleSizingStep(session, action, value) {
  if (action === 'GO_BACK') {
    if (session.sizingDraft.step > 1) {
      session.sizingDraft.step -= 1;
      return getSizingStepPrompt(session.sizingDraft);
    }
  }

  if (session.sizingDraft.step === 1) {
    session.sizingDraft.cars = parseInt(value, 10) || 0;
    session.sizingDraft.step = 2;
    return getSizingStepPrompt(session.sizingDraft);
  }

  if (session.sizingDraft.step === 2) {
    session.sizingDraft.pets = parseInt(value, 10) || 0;
    session.sizingDraft.step = 3;
    return getSizingStepPrompt(session.sizingDraft);
  }

  if (session.sizingDraft.step === 3) {
    let perches = 0;
    if (value === 'under_10') perches = 8;
    else if (value === '10_to_20') perches = 15;
    else if (value === '20_to_30') perches = 25;
    else if (value === 'over_30') perches = 35;
    else perches = 0;

    session.sizingDraft.perches = perches;
    session.activeWizard = null;
    return generateFinalRecommendation(session.sizingDraft.cars, session.sizingDraft.perches, session.sizingDraft.pets);
  }

  return getSizingStepPrompt(session.sizingDraft);
}

function getSizingStepPrompt(draft) {
  if (draft.step === 1) {
    return {
      role: 'assistant',
      text: 'How many cars do you have?',
      inlineComponent: {
        type: 'STEPPER_SELECTOR',
        name: 'cars_stepper',
        label: 'Cars',
        value: draft.cars !== undefined ? draft.cars : 2,
        min: 0,
        max: 15,
        submitLabel: 'Continue →'
      }
    };
  }

  if (draft.step === 2) {
    return {
      role: 'assistant',
      text: 'How many pets do you have?',
      inlineComponent: {
        type: 'STEPPER_SELECTOR',
        name: 'pets_stepper',
        label: 'Pets',
        value: draft.pets !== undefined ? draft.pets : 0,
        min: 0,
        max: 12,
        submitLabel: 'Continue →',
        hasBack: true
      }
    };
  }

  if (draft.step === 3) {
    return {
      role: 'assistant',
      text: 'How big is your garden?',
      inlineComponent: {
        type: 'OPTION_CHIPS',
        name: 'garden_size_chips',
        options: [
          { id: 'under_10', label: 'Under 10 perches' },
          { id: '10_to_20', label: '10–20 perches' },
          { id: '20_to_30', label: '20–30 perches' },
          { id: 'over_30', label: 'More than 30 perches' },
          { id: 'no_garden', label: 'No garden / Not sure' }
        ],
        selected: null,
        hasBack: true
      }
    };
  }
}

function generateFinalRecommendation(cars, perches, pets) {
  const result = getSimplifiedRecommendation({ cars, perches, pets });

  if (result.invalid) {
    return {
      role: 'assistant',
      text: `⚠️ **Invalid Input:** ${result.error}\n\nPlease enter a valid quantity to see recommendations.`,
      actionButtons: [
        { label: 'Try Again', action: 'START_SIZING' },
        { label: 'Talk to Us', action: 'CONTACT_SUPPORT' }
      ]
    };
  }

  // When customer requirement exceeds standard coverage
  if (result.exceedsLimit) {
    const cat = result.categoryKey || 'GARDEN_CARE';
    const draft = startSpecialAskWizard({
      category: cat,
      quantity: result.enteredQuantity || '',
      scope: result.enteredQuantity || '',
      requiredServices: cat === 'AUTO_CARE' ? 'Multi-vehicle fleet detailing & doorstep maintenance' : cat === 'GARDEN_CARE' ? 'Large estate landscaping & groundskeeping' : 'Multi-pet concierge grooming'
    });
    const prompt = getSpecialAskPrompt(draft);
    return {
      role: 'assistant',
      text: `### ✦ Need something beyond our standard coverage?\n\n> ${result.noticeText}\n\nI've opened the **Special Ask / Requested Service** form for you below so our concierge operations team can review your requirements and provide a bespoke proposal:`,
      inlineComponent: prompt.inlineComponent,
      actionButtons: [
        { label: 'Try Different Numbers', action: 'START_SIZING' },
        { label: 'Talk to Us', action: 'CONTACT_SUPPORT' }
      ]
    };
  }

  // When within standard limits: show standard packages AND offer optional Special Ask
  return {
    role: 'assistant',
    text: `Based on what you told me, here are our standard package recommendations:`,
    inlineComponent: {
      type: 'RECOMMENDATION_CARDS',
      cards: result.recommendations
    },
    actionButtons: [
      { label: 'Looking for something beyond our standard packages? Make a Special Ask →', action: 'START_SPECIAL_ASK' },
      { label: '📅 Book Service with Token', action: 'START_BOOKING' },
      { label: 'Talk to Us', action: 'CONTACT_SUPPORT' }
    ],
    quickReplies: ['How do tokens work?', 'Can I cancel anytime?', '🪙 My Tokens']
  };
}

function getEscalationPrompt(reason) {
  return {
    role: 'assistant',
    text: `### 💬 Speak with a Luxora Concierge Specialist\n\nOur team is available 24/7 to answer custom inquiries, assist with bookings, or coordinate special services.`,
    inlineComponent: {
      type: 'ESCALATION_MODAL',
      title: 'Dedicated Concierge Desk',
      reason: 'Choose how you would like to connect with our senior concierge team:',
      channels: [
        { id: 'phone', label: '📞 Direct Concierge Line', desc: '+94 11 234 5678 (Instant Call)' },
        { id: 'whatsapp', label: '💬 WhatsApp Concierge', desc: '+94 77 123 4567 (Chat with agent)' }
      ]
    },
    actionButtons: [
      { label: '🏠 Main Menu', action: 'SHOW_MAIN_MENU' }
    ]
  };
}

module.exports = {
  getSession,
  processMessage,
  storage,
  catalog,
  policies
};