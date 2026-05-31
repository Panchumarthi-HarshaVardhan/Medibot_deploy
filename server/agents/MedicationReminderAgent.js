import BaseAgent from './BaseAgent.js';
import MedicationReminder from '../models/MedicationReminder.js';

class MedicationReminderAgent extends BaseAgent {
  constructor() {
    super('MedicationReminderAgent', ['medication_reminders', 'adherence_support']);
  }

  async processMessage(fromAgentName, message) {
    if (fromAgentName === 'ChatbotAgent' && message.type === 'create_medication_reminder') {
      return await this.execute(message.payload);
    }
    return `[${this.name}] Processed message from ${fromAgentName}`;
  }

  async execute(input) {
    try {
      const {
        user_id: userId,
        name,
        dosage = '1 tablet',
        timesPerDay = 1,
        duration = '7 days',
        times = [],
        reminderEnabled = true
      } = input || {};

      if (!userId) {
        return {
          type: 'missing_information',
          missingFields: ['user_id'],
          message: 'Please login first so I can save reminders to your account.',
          agent: this.name
        };
      }

      if (!name) {
        return {
          type: 'missing_information',
          missingFields: ['name'],
          message: 'Please provide the medicine name to create a reminder.',
          agent: this.name
        };
      }

      const reminder = new MedicationReminder({
        user_id: userId,
        name,
        dosage,
        timesPerDay,
        duration,
        times,
        reminderEnabled
      });
      await reminder.save();

      return {
        type: 'medication_reminder_created',
        message: `Reminder created for ${name} (${dosage}) ${timesPerDay}x daily for ${duration}.`,
        reminder: {
          id: reminder._id,
          name: reminder.name,
          dosage: reminder.dosage,
          timesPerDay: reminder.timesPerDay,
          duration: reminder.duration,
          times: reminder.times,
          reminderEnabled: reminder.reminderEnabled
        },
        agent: this.name
      };
    } catch (error) {
      console.error('MedicationReminderAgent error:', error);
      return {
        type: 'error',
        message: 'I could not create the medication reminder. Please try again.',
        agent: this.name
      };
    }
  }
}

export default MedicationReminderAgent;
