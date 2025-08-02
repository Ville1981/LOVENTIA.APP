// src/api/services/EventShareService.js

import Event from '../models/Event.js';

/**
 * Server-side service: vastaa paikallisten tapahtumien jakamisesta
 */
export class EventShareService {
  /**
   * Luo ja palauttaa jaetun tapahtuman tiedot
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
