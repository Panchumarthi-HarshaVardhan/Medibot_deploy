class BaseAgent {
  constructor(name, skills = []) {
    this.name = name;
    this.skills = skills;
    this.otherAgents = {};
  }

  connectToAgent(agent) {
    this.otherAgents[agent.name] = agent;
    agent.otherAgents[this.name] = this;
  }

  async sendMessage(toAgentName, message) {
    if (!this.otherAgents[toAgentName]) {
      return {
        type: 'agent_error',
        message: `${toAgentName} is not connected. Please restart the server.`,
        agent: this.name,
      };
    }
    try {
      return await this.otherAgents[toAgentName].receiveMessage(this.name, message);
    } catch (err) {
      console.error(`[${this.name}] Error sending to ${toAgentName}:`, err);
      return {
        type: 'agent_error',
        message: `I could not complete that action (${toAgentName}). Please try again.`,
        agent: this.name,
      };
    }
  }

  async receiveMessage(fromAgentName, message) {
    console.log(`[${this.name}] Received message from ${fromAgentName}:`, message);
    return await this.processMessage(fromAgentName, message);
  }

  async processMessage(fromAgentName, message) {
    throw new Error('processMessage must be implemented by subclass');
  }

  async execute(input) {
    throw new Error('execute must be implemented by subclass');
  }
}

export default BaseAgent;
