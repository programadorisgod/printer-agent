// transports/mockTransport.js

export class MockTransport {
  name = 'mock';

  isAvailable() {
    return true;
  }

  async send(buffer) {
    const rawText = buffer.toString('latin1');
    const cleanText = rawText.replace(/[\x00-\x09\x0b-\x1f\x7f-\xff]/g, '');
    const lines = cleanText.split('\n').filter(l => l.trim().length > 0);

    console.log('\n╔' + '═'.repeat(36) + '╗');
    console.log('║   [SIMULADOR TICKET 58MM]          ║');
    console.log('╠' + '═'.repeat(36) + '╣');
    for (const line of lines) {
      const clipped = line.trim().substring(0, 34);
      const pad = ' '.repeat(Math.max(0, 34 - clipped.length));
      console.log(`║ ${clipped}${pad} ║`);
    }
    console.log('╚' + '═'.repeat(36) + '╝\n');

    return {
      success: true,
      transport: this.name,
      simulated: true,
      bytes_sent: buffer.length
    };
  }

  getInfo() {
    return {
      name: this.name,
      available: true
    };
  }
}
