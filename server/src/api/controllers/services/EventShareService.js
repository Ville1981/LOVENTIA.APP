// --- REPLACE START: convert ESM import/export to CommonJS; keep logic intact ---
'use strict';

const Event = require('../models/Event.js');

/**
 * Server-side service: responsible for sharing local events.
 */
class EventShareService {
  /**
   * Creates and returns the shared event document.
   * @param {String} userId
   * @param {{ title:string, date:Date, location:string, description:string }} eventData
   */
  static async shareEvent(userId, eventData) {
    const event = await Event.create({
      ...eventData,
      sharedBy: userId,
      sharedAt: new Date(),
    });
    return event;
  }
}

module.exports = { EventShareService };
// --- REPLACE END ---
