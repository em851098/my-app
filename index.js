// Configuration
const config = {
  loginURL: 'https://dppj1ypy65ita.cloudfront.net/v1/user/login',
  updateURL: 'https://dppj1ypy65ita.cloudfront.net/v1/user/user-count',
  walletAddress: '0x8aD41d836C820Ad6872aB1da02bf84CFCDFFaEbb', // Updated wallet address
  requestDelay: 100, // 10 seconds between updates (no longer used)
  retryDelay: 10000, // 10 seconds after an error
  maxSlaps: 300,
  minSlaps: 200 // Minimum slap count updated
};

let authToken = null;

// Logging and Tracking
const requestLog = {
  successful: [],
  failed: []
};

// Utility Functions
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const logRequest = (type, details = {}) => {
  const timestamp = new Date();
  const logEntry = { timestamp: timestamp.toISOString(), type, ...details };

  if (type === 'successful') {
    requestLog.successful.push(logEntry);
  } else {
    requestLog.failed.push(logEntry);
  }

  console.log(`[${timestamp.toISOString()}] ${type.toUpperCase()}:`, details);
};

// Random slapCount generator
const generateSlapCount = () => {
  return Math.floor(Math.random() * (config.maxSlaps - config.minSlaps + 1)) + config.minSlaps;
};

// Utility function to generate a random delay between min and max
const getRandomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Login Function
async function login() {
  try {
    const response = await fetch(config.loginURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: config.walletAddress })
    });

    const data = await response.json();
    if (response.ok && data.status === 'SUCCESS') {
      authToken = data.data.token;
      logRequest('successful', { action: 'login', message: 'Login successful' });
    } else {
      throw new Error(`Login failed: ${data.message}`);
    }
  } catch (error) {
    logRequest('failed', { action: 'login', error: error.message });
    throw error;
  }
}

// Update Function
async function sendUpdate() {
  try {
    const slapCount = generateSlapCount();

    const response = await fetch(config.updateURL, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ slapCount })
    });

    const data = await response.json();

    if (response.ok && data.status === 'SUCCESS') {
      logRequest('successful', {
        action: 'update',
        slapCountSent: slapCount,
        totalUserSlaps: data.data.userData.slapCount,
        contribution: ((data.data.userData.slapCount / data.data.leaderboardData.count) * 100).toFixed(2) + '%',
        isActive: data.data.userData.isActive ? 'Active' : 'Inactive'
      });
    } else {
      throw new Error(`Update failed: ${data.message}`);
    }
  } catch (error) {
    if (error.message.includes('not authorized')) {
      logRequest('failed', { action: 'update', message: 'Token expired, re-authenticating...' });
      await login();
      await sendUpdate();
    } else {
      logRequest('failed', { action: 'update', error: error.message });
      throw error;
    }
  }
}

// Modified execution loop to handle custom delays for requests 1 to 7
async function executeUpdates() {
  let cycle = 0;

  while (true) {
    try {
      console.log(`\n--- Cycle ${++cycle}: Starting Updates ---`);
      
      // Calculate delays for requests 1 to 7
      let totalDelay = 61;  // Total delay for requests 1 to 7
      let delays = [];

      // Generate delays for requests 1 to 6
      let sumOfFirst6Delays = 0;
      for (let i = 0; i < 6; i++) {
        const delay = getRandomDelay(5, 15);
        delays.push(delay);
        sumOfFirst6Delays += delay;
      }

      // Calculate the delay for the 7th request to make the total delay exactly 61 seconds
      const remainingDelay = totalDelay - sumOfFirst6Delays;
      delays.push(remainingDelay);

      // Check if remainingDelay is a valid value, otherwise adjust
      if (remainingDelay < 5 || remainingDelay > 15) {
        console.log("Adjustment required for delays to maintain the total of 61 seconds.");
        delays = delays.slice(0, 6);
        sumOfFirst6Delays = delays.reduce((acc, delay) => acc + delay, 0);
        delays.push(totalDelay - sumOfFirst6Delays);
      }

      // Log delays for requests 1 to 7
      console.log('Delays for requests 1 to 7:', delays);

      // Send updates with delays 1 to 7
      for (let i = 0; i < 7; i++) {
        await sendUpdate();
        await sleep(delays[i] * 1000); // Convert delay to milliseconds
      }

      // Send updates from request 8 onwards with random delays
      for (let i = 7; i < 6; i++) {
        const randomDelay = getRandomDelay(5, 15);
        await sendUpdate();
        await sleep(randomDelay * 1000); // Convert delay to milliseconds
      }

    } catch (error) {
      console.error('Error during execution:', error.message);
      console.log(`Retrying in ${config.retryDelay / 1000} seconds...`);
      await sleep(config.retryDelay);
    }
  }
}

// Main Execution
(async function main() {
  try {
    console.log('Starting the process...');
    await login();
    await executeUpdates();
  } catch (error) {
    console.error('Critical error. Exiting:', error.message);
  }
})();
