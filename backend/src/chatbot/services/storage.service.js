const fs = require('fs');
const path = require('path');

const REQUESTED_SERVICES_FILE = path.join(__dirname, '../data/requested_services.json');
const SUPPORT_TICKETS_FILE = path.join(__dirname, '../data/support_tickets.json');

function readJsonFile(filePath, defaultValue = []) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content || '[]');
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultValue;
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// In-Memory caches backed by JSON persistence
let requestedServices = readJsonFile(REQUESTED_SERVICES_FILE, []);
let supportTickets = readJsonFile(SUPPORT_TICKETS_FILE, []);

module.exports = {
  getRequestedServices: () => requestedServices,
  getRequestedServiceById: (id) => requestedServices.find(r => r.id === id),
  saveRequestedService: (serviceData) => {
    const existingIndex = requestedServices.findIndex(r => r.id === serviceData.id);
    if (existingIndex >= 0) {
      requestedServices[existingIndex] = { ...requestedServices[existingIndex], ...serviceData, updatedAt: new Date().toISOString() };
    } else {
      requestedServices.unshift({ ...serviceData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    writeJsonFile(REQUESTED_SERVICES_FILE, requestedServices);
    return serviceData;
  },
  updateRequestedServiceStatus: (id, status, notes = '', quoteLKR = null) => {
    const req = requestedServices.find(r => r.id === id);
    if (!req) return null;
    req.status = status;
    if (notes) req.adminNotes = notes;
    if (quoteLKR !== null) req.quoteLKR = quoteLKR;
    req.updatedAt = new Date().toISOString();
    writeJsonFile(REQUESTED_SERVICES_FILE, requestedServices);
    return req;
  },
  getSupportTickets: () => supportTickets,
  getSupportTicketById: (id) => supportTickets.find(t => t.id === id),
  saveSupportTicket: (ticketData) => {
    const existingIndex = supportTickets.findIndex(t => t.id === ticketData.id);
    if (existingIndex >= 0) {
      supportTickets[existingIndex] = { ...supportTickets[existingIndex], ...ticketData, updatedAt: new Date().toISOString() };
    } else {
      supportTickets.unshift({ ...ticketData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    writeJsonFile(SUPPORT_TICKETS_FILE, supportTickets);
    return ticketData;
  }
};
