const { getSimplifiedRecommendation, loadActivePlans, formatPrice } = require('./recommendation.service');
const { startSpecialAskWizard, handleSpecialAskStep, getSpecialAskPrompt } = require('./requestedService.service');
const { getEscalationPrompt } = require('./escalation.service');

// In-memory conversation sessions
const sessions = new Map();

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      activeWizard: null, // 'SPECIAL_ASK', 'SIZING'
      specialAskDraft: null,
      sizingDraft: null,
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

// Remaining tokens per category across the customer's active subscriptions.
// Mirrors the entitlement service: usage is the count of non-cancelled
// bookings tied to each subscription, so cancellations restore tokens
// implicitly and no balance is ever invented here.
async function getTokenSnapshot(prisma, userId) {
  const [subscriptions, bookings] = await Promise.all([
    prisma.userSubscription.findMany({
      where: { userId, status: 'active', endDate: { gt: new Date() } },
      include: { plan: { include: { entitlements: { include: { category: true } } } } },
      orderBy: { startDate: 'desc' },
    }),
    prisma.booking.findMany({
      where: { userId, subscriptionId: { not: null }, status: { not: 'CANCELLED' } },
      select: { subscriptionId: true, service: { select: { categoryId: true } } },
    }),
  ]);

  const used = new Map();
  for (const booking of bookings) {
    const key = `${booking.subscriptionId}:${booking.service.categoryId}`;
    used.set(key, (used.get(key) || 0) + 1);
  }

  const byCategory = new Map();
  for (const subscription of subscriptions) {
    const entitlements = (subscription.entitlements?.length ? subscription.entitlements : subscription.plan?.entitlements) || [];
    for (const entitlement of entitlements) {
      const aggregate = byCategory.get(entitlement.categoryId) || {
        name: entitlement.category?.name || 'Service',
        total: 0,
        used: 0,
      };
      aggregate.total += entitlement.units;
      aggregate.used += used.get(`${subscription.id}:${entitlement.categoryId}`) || 0;
      byCategory.set(entitlement.categoryId, aggregate);
    }
  }

  return { subscriptions, tokens: [...byCategory.values()] };
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
    const { wizardType, stepAction, value, text: payloadText, title, category, notes, date } = structuredPayload;

    // A. Special Ask / Custom Request Flow (hands off to the real bespoke
    //    submission on the customer dashboard — nothing is persisted here)
    if (wizardType === 'SPECIAL_ASK' || wizardType === 'CUSTOM_REQUEST' || (!wizardType && (session.activeWizard === 'SPECIAL_ASK' || session.activeWizard === 'CUSTOM_REQUEST'))) {
      if (!session.specialAskDraft || stepAction === 'START') {
        session.activeWizard = 'SPECIAL_ASK';
        session.specialAskDraft = startSpecialAskWizard({
          title: title || '',
          category: category || 'Auto Care',
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
      }
      session.history.push(wizardResp);
      return wizardResp;
    }

    // B. Sizing Wizard Flow
    if (wizardType === 'SIZING_WIZARD') {
      return handleSizingStep(session, prisma, stepAction, value);
    }

    // C. Single Category Auto Care Sizing
    if (wizardType === 'AUTO_SIZING') {
      const count = parseInt(value, 10) || 1;
      if (count > 6) {
        session.activeWizard = 'SPECIAL_ASK';
        session.specialAskDraft = startSpecialAskWizard({
          category: 'AUTO_CARE',
          notes: `${count} vehicles — multi-vehicle fleet detailing & doorstep maintenance`
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
      const rec = await generateFinalRecommendation(prisma, count, 0, 0);
      session.history.push(rec);
      return rec;
    }

    // D. Single Category Garden Care Sizing
    if (wizardType === 'GARDEN_SIZING') {
      if (value === 'over_30' || parseFloat(value) > 30) {
        session.activeWizard = 'SPECIAL_ASK';
        session.specialAskDraft = startSpecialAskWizard({
          category: 'GARDEN_CARE',
          notes: 'More than 30 perches — large-scale estate grounds maintenance & landscaping'
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
      const rec = await generateFinalRecommendation(prisma, 0, perches, 0);
      session.history.push(rec);
      return rec;
    }

    // E. Single Category Pet Care Sizing
    if (wizardType === 'PET_SIZING') {
      const count = parseInt(value, 10) || 1;
      if (count > 5) {
        session.activeWizard = 'SPECIAL_ASK';
        session.specialAskDraft = startSpecialAskWizard({
          category: 'PET_CARE',
          notes: `${count} pets — multi-pet spa & grooming management`
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
      const rec = await generateFinalRecommendation(prisma, 0, 0, count);
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

  if (session.activeWizard === 'SIZING' && session.sizingDraft) {
    return handleSizingStep(session, prisma, 'NEXT', text);
  }

  // ===========================================================================
  // 3. INTENT: MY TOKENS & WALLET BALANCE (Real Database Self-Care)
  // ===========================================================================
  if (lower.includes('token') && (lower.includes('my') || lower.includes('balance') || lower.includes('check') || lower.includes('left') || lower.includes('wallet')) || lower === 'check_balance' || lower === 'my tokens') {
    if (user && prisma) {
      try {
        const { subscriptions, tokens } = await getTokenSnapshot(prisma, user.id);
        if (subscriptions.length > 0) {
          const tokenLines = tokens.length > 0
            ? tokens.map((token) => {
                const remaining = Math.max(0, token.total - token.used);
                return `* **${remaining} of ${token.total} ${token.name} token${token.total === 1 ? '' : 's'} remaining** this cycle`;
              }).join('\n')
            : '* No category entitlements on your current plan';
          const reply = {
            role: 'assistant',
            text: `### 🪙 Active Membership: ${subscriptions[0].plan?.title || 'Luxora Plan'}\n\nHello **${user.name}**!\n\n* **Status:** Active\n* **Renews:** ${subscriptions[0].endDate ? new Date(subscriptions[0].endDate).toLocaleDateString() : 'N/A'}\n* **Your Token Balance:**\n${tokenLines}\n\nA token is consumed when your booking is placed, and restored automatically if the booking is cancelled before the service starts.`,
            actionButtons: [
              { label: '📅 Book Service with Token', action: 'START_BOOKING' },
              { label: '👤 View Full Dashboard', action: 'VIEW_DASHBOARD' },
              { label: '🏠 Main Menu', action: 'SHOW_MAIN_MENU' }
            ],
            quickReplies: ['📅 Book a Service', '🚗 Auto Care', '🌿 Garden Care']
          };
          session.history.push(reply);
          return reply;
        }
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
      } catch (dbErr) {
        console.error('Error fetching user subscription:', dbErr);
      }
    }

    const reply = {
      role: 'assistant',
      text: `### 🪙 Luxora Token Wallet\n\nTokens come from your package entitlements:\n\n* **1 Auto Care Token** = 1 Vehicle Service\n* **1 Garden Care Token** = 1 Garden Visit\n* **1 Pet Care Token** = 1 Pet Grooming Visit\n\nTo view your live active token balance, please sign in to your account.`,
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
  // 4. INTENT: TRACK REQUESTS / TICKETS (checked before booking — a message
  //    like "track my booking status" contains the word "book" but is a
  //    tracking request, not a new booking)
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
  // 5. INTENT: BOOK A SERVICE (Hands off to the real booking page — the
  //    chatbot never creates bookings or PINs itself)
  // ===========================================================================
  if (lower.includes('book') || lower.includes('schedule') || lower.includes('appointment') || lower === 'start_booking') {
    const reply = {
      role: 'assistant',
      text: `### 📅 Reserve a Luxora Concierge Service\n\nBookings are confirmed on our secure booking page with your entitlement tokens. Choose a category and I'll take you there:`,
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
  // 6. INTENT: "TALK TO US" / HUMAN HELP
  // ===========================================================================
  if (lower.includes('human') || lower.includes('agent') || lower.includes('person') || lower.includes('speak to someone') || lower.includes('talk to us') || lower.includes('call us') || lower.includes('contact us') || lower.includes('helpdesk') || lower.includes('support')) {
    const reply = getEscalationPrompt('Talk to our team');
    session.history.push(reply);
    return reply;
  }

  // ===========================================================================
  // 7. INTENT: COMPLAINTS / NO-SHOWS (Honest handoff — the chatbot does not
  //    fabricate ticket numbers; complaints are filed from the dashboard so
  //    they link to the real booking and reach the admin queue)
  // ===========================================================================
  const isComplaint = ['complain', 'complaint', 'no show', 'no-show', 'not arrived', 'never arrived', 'not arrive', 'was late', 'damaged', 'damage', 'broken', 'unsatisfied', 'unhappy', 'not happy']
    .some((keyword) => lower.includes(keyword));
  if (isComplaint) {
    const reply = {
      role: 'assistant',
      text: `I'm sorry to hear that — I've noted what you told me.\n\nTo make sure our admin team properly reviews it, please file it from your dashboard: the complaint form links the issue to the exact booking and reaches the team directly.`,
      actionButtons: [
        { label: '👤 Open Dashboard & File Complaint', action: 'VIEW_DASHBOARD' },
        { label: '💬 Talk to Concierge', action: 'CONTACT_SUPPORT' },
        { label: '🏠 Main Menu', action: 'SHOW_MAIN_MENU' }
      ]
    };
    session.history.push(reply);
    return reply;
  }

  // ===========================================================================
  // 8. INTENT: SPECIFIC NON-STANDARD SERVICE QUESTIONS (Strict clarification + Special Ask)
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
  // 9. INTENT: TRIGGER SPECIAL ASK SERVICE
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
  // 10. INTENT: AUTO CARE CATEGORY DISCOVERY & SIZING
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
  // 11. INTENT: GARDEN CARE CATEGORY DISCOVERY & SIZING
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
  // 12. INTENT: PET CARE CATEGORY DISCOVERY & SIZING
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
  // 13. INTENT: ALL-IN-ONE COMBOS (Live catalog — titles, prices, and coin
  //     splits always come from the admin-managed SubscriptionPlan table)
  // ===========================================================================
  if (lower.includes('prestige') || lower.includes('luxora home') || lower.includes('luxora family') || lower.includes('combo')) {
    let combos = null;
    try {
      const plans = prisma ? await loadActivePlans(prisma) : [];
      combos = plans.filter((plan) => plan.categoryKey === 'combo');
    } catch (dbErr) {
      console.error('[chatbot] combo catalog lookup failed:', dbErr.message);
    }

    if (combos && combos.length > 0) {
      const cards = combos.slice(0, 3).map((plan, index) => ({
        badge: index === 0 ? '⭐ Recommended Combo' : `Combo option ${index + 1}`,
        name: plan.title,
        planId: plan.id,
        planType: 'Combo Package',
        categoryKey: 'combo',
        price: formatPrice(plan.discounted) + (plan.discountPct > 0 ? ` (${plan.discountPct}% promo applied)` : ''),
        features: plan.units.map((unit) => `${unit.units} ${unit.category || 'Service'} visit${unit.units === 1 ? '' : 's'} / month`),
        why: 'Bundled care visits in one membership — 1 token is consumed per booking.',
      }));
      const reply = {
        role: 'assistant',
        text: `### 👑 Luxora Combo Memberships\n\nThese are the combo packages currently active in our catalog — select one to continue:`,
        inlineComponent: {
          type: 'RECOMMENDATION_CARDS',
          cards
        },
        actionButtons: [
          { label: 'Find the Right Package', action: 'START_SIZING' },
          { label: '📅 Book Service with Token', action: 'START_BOOKING' },
          { label: 'Talk to Us', action: 'CONTACT_SUPPORT' }
        ]
      };
      session.history.push(reply);
      return reply;
    }

    const reply = {
      role: 'assistant',
      text: `### 👑 Luxora Combo Memberships\n\nI can't retrieve the live combo catalog right now, so I won't quote prices from memory. You can see current packages with exact prices on our homepage, or ask our team directly.`,
      actionButtons: [
        { label: '🎯 Find the Right Package', action: 'START_SIZING' },
        { label: 'Talk to Us', action: 'CONTACT_SUPPORT' },
        { label: '🏠 Main Menu', action: 'SHOW_MAIN_MENU' }
      ]
    };
    session.history.push(reply);
    return reply;
  }

  // ===========================================================================
  // 14. INTENT: HOW TOKENS WORK
  // ===========================================================================
  if (lower.includes('token') || lower.includes('how do tokens work') || lower.includes('tokens work')) {
    const reply = {
      role: 'assistant',
      text: `### 🪙 How Tokens Work\n\n* **1 Auto Care Token** = 1 Vehicle Service\n* **1 Garden Care Token** = 1 Garden Visit\n* **1 Pet Care Token** = 1 Pet Service Session\n\nTokens come from your package entitlements and are valid while your 30-day plan is active. A token is consumed when your booking is placed — and restored automatically if the booking is cancelled before the service starts.`,
      actionButtons: [
        { label: '🪙 Check My Balance', action: 'CHECK_BALANCE' },
        { label: 'Find My Package', action: 'START_SIZING' },
        { label: 'Talk to Us', action: 'CONTACT_SUPPORT' }
      ]
    };
    session.history.push(reply);
    return reply;
  }

  // ===========================================================================
  // 15. INTENT: CANCELLATION & REFUND POLICIES (Confirmed V1 product rules)
  // ===========================================================================
  if (lower.includes('cancel') || lower.includes('refund') || lower.includes('policy')) {
    const reply = {
      role: 'assistant',
      text: `### 🛡️ Cancellation & Refund Policies\n\n* **No refunds in V1:** all package purchases are final.\n* **Subscriptions:** you can cancel or turn off auto-renewal anytime from your dashboard — this stops future renewals for the next cycle.\n* **Booking cancellation:** you can cancel a booking while it is pending or assigned. Once a service is in progress it cannot be cancelled.\n* **Provider cancellations:** providers may cancel assigned future jobs with at least 4 hours' notice. If no replacement provider is found, your booking is cancelled and the token returns to your balance automatically.`,
      actionButtons: [
        { label: '👤 Member Dashboard', action: 'VIEW_DASHBOARD' },
        { label: '🏠 Main Menu', action: 'SHOW_MAIN_MENU' }
      ]
    };
    session.history.push(reply);
    return reply;
  }

  // ===========================================================================
  // 16. INTENT: START STEP-BY-STEP SIZING
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
    const rec = await generateFinalRecommendation(prisma, cars, perches, pets);
    session.history.push(rec);
    return rec;
  }

  // ===========================================================================
  // 17. DEFAULT WELCOME / MAIN MENU
  // ===========================================================================
  const welcomeReply = {
    role: 'assistant',
    text: `Hello! I am your **Luxora Concierge**.\n\nI can help you explore packages, check your tokens, book services, or submit special requests.`,
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
// SIZING WIZARD STEP HANDLER
// =============================================================================
function handleSizingStep(session, prisma, action, value) {
  // A SIZING_WIZARD payload can arrive on a fresh session (widget replay or
  // direct API call) — initialize the draft instead of crashing on null.
  if (!session.sizingDraft) {
    session.sizingDraft = { step: 1, cars: 2, pets: 0, perches: 0 };
    session.activeWizard = 'SIZING';
  }

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
    const { cars, pets } = session.sizingDraft;
    session.activeWizard = null;
    session.sizingDraft = null;
    return generateFinalRecommendation(prisma, cars, perches, pets);
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

async function generateFinalRecommendation(prisma, cars, perches, pets) {
  const result = await getSimplifiedRecommendation(prisma, { cars, perches, pets });

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

  if (result.unavailable) {
    return {
      role: 'assistant',
      text: `### 📦 Package Catalog Unavailable\n\nI can't reach our live package catalog right now, so I won't quote prices from memory. You can view current packages with exact prices on our homepage, or ask our team directly.`,
      actionButtons: [
        { label: 'Talk to Us', action: 'CONTACT_SUPPORT' },
        { label: '🏠 Main Menu', action: 'SHOW_MAIN_MENU' }
      ]
    };
  }

  // When customer requirement exceeds standard coverage
  if (result.exceedsLimit) {
    const cat = result.categoryKey || 'GARDEN_CARE';
    session.activeWizard = 'SPECIAL_ASK';
    session.specialAskDraft = startSpecialAskWizard({
      category: cat,
      notes: result.enteredQuantity ? `${result.enteredQuantity} — beyond standard package coverage` : ''
    });
    const prompt = getSpecialAskPrompt(session.specialAskDraft);
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

  // When within standard limits: show live catalog matches AND offer optional Special Ask
  return {
    role: 'assistant',
    text: `Based on what you told me, here are the closest matches from our current catalog:`,
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

module.exports = {
  getSession,
  processMessage
};
