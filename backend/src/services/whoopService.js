const axios = require('axios');

const WHOOP_API_BASE = 'https://api.prod.whoop.com';
const WHOOP_AUTH_BASE = 'https://api.prod.whoop.com/oauth/oauth2';

class WhoopService {
  constructor() {
    this.clientId = process.env.WHOOP_CLIENT_ID;
    this.clientSecret = process.env.WHOOP_CLIENT_SECRET;
    this.redirectUri = process.env.WHOOP_REDIRECT_URI;
    // In-memory token storage - in production, use a database
    this.tokenStore = new Map();
  }

  /**
   * Get authorization URL for OAuth 2.0 flow
   * Reference: https://developer.whoop.com/docs/developing/oauth-2.0
   * Note: Whoop requires state parameter to be at least 8 characters long
   */
  getAuthorizationUrl(userId, state) {
    if (!this.clientId || !this.redirectUri) {
      throw new Error('Whoop client credentials not configured');
    }

    // State must be at least 8 characters long (Whoop requirement)
    let stateValue = state;
    if (!stateValue || stateValue.length < 8) {
      stateValue = this.generateState();
    }
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'read:recovery read:cycles read:workout read:sleep read:profile offline',
      state: stateValue,
    });

    return `${WHOOP_AUTH_BASE}/auth?${params.toString()}`;
  }

  /**
   * Generate a random 8-character state string for CSRF protection
   */
  generateState() {
    return Math.random().toString(36).substring(2, 10);
  }

  /**
   * Exchange authorization code for access token
   * Reference: https://developer.whoop.com/docs/developing/oauth-2.0
   */
  async exchangeCodeForToken(code) {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error('Whoop client credentials not configured');
    }

    try {
      const response = await axios.post(
        `${WHOOP_AUTH_BASE}/token`,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      
      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in,
        expiresAt: Date.now() + (expires_in * 1000),
      };
    } catch (error) {
      console.error('Whoop token exchange failed:', error.response?.data || error.message);
      throw new Error(`Failed to exchange code for token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   * Reference: https://developer.whoop.com/docs/developing/oauth-2.0
   * Note: Must include client_id, client_secret, and scope in POST body
   */
  async refreshAccessToken(refreshToken) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Whoop client credentials not configured');
    }

    try {
      const response = await axios.post(
        `${WHOOP_AUTH_BASE}/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'offline read:recovery read:cycles read:workout read:sleep read:profile',
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      
      return {
        accessToken: access_token,
        refreshToken: refresh_token || refreshToken, // Use new refresh token if provided
        expiresIn: expires_in,
        expiresAt: Date.now() + (expires_in * 1000),
      };
    } catch (error) {
      console.error('Whoop token refresh failed:', error.response?.data || error.message);
      throw new Error(`Failed to refresh token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getValidAccessToken(userId, storedTokens) {
    if (!storedTokens || !storedTokens.accessToken) {
      throw new Error('No access token available. Please re-authenticate.');
    }

    // Check if token is expired (with 5 minute buffer)
    const buffer = 5 * 60 * 1000; // 5 minutes
    if (storedTokens.expiresAt && Date.now() >= storedTokens.expiresAt - buffer) {
      if (!storedTokens.refreshToken) {
        throw new Error('Token expired and no refresh token available. Please re-authenticate.');
      }
      
      const refreshed = await this.refreshAccessToken(storedTokens.refreshToken);
      // Update stored tokens (in production, persist to database)
      this.tokenStore.set(userId, refreshed);
      return refreshed.accessToken;
    }

    return storedTokens.accessToken;
  }

  /**
   * Make authenticated API request
   */
  async makeAuthenticatedRequest(userId, endpoint, method = 'GET', data = null, params = null) {
    const storedTokens = this.tokenStore.get(userId) || {};
    const accessToken = await this.getValidAccessToken(userId, storedTokens);

    try {
      const fullUrl = `${WHOOP_API_BASE}${endpoint}`;
      const config = {
        method,
        url: fullUrl,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      };

      if (params && method === 'GET') {
        config.params = params;
      }

      if (data && method !== 'GET') {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      const errorUrl = `${WHOOP_API_BASE}${endpoint}`;
      console.error(`Whoop API Error: ${method} ${errorUrl}`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });

      if (error.response?.status === 401) {
        // Token might be invalid, try refreshing
        if (storedTokens.refreshToken) {
          try {
            const refreshed = await this.refreshAccessToken(storedTokens.refreshToken);
            this.tokenStore.set(userId, refreshed);
            
            // Retry request with new token
            const retryConfig = {
              method,
              url: errorUrl,
              headers: {
                Authorization: `Bearer ${refreshed.accessToken}`,
                'Content-Type': 'application/json',
              },
            };
            if (params && method === 'GET') {
              retryConfig.params = params;
            }
            if (data && method !== 'GET') {
              retryConfig.data = data;
            }
            const retryResponse = await axios(retryConfig);
            return retryResponse.data;
          } catch (refreshError) {
            throw new Error('Authentication failed. Please re-authenticate.');
          }
        }
      }
      
      // Provide more helpful error messages
      if (error.response?.status === 404) {
        throw new Error(`Whoop API endpoint not found: ${errorUrl}. Please check the API documentation.`);
      }
      
      throw error;
    }
  }

  /**
   * Store tokens for a user (in production, persist to database)
   */
  storeTokens(userId, tokens) {
    this.tokenStore.set(userId, tokens);
  }

  /**
   * Get stored tokens for a user
   */
  getStoredTokens(userId) {
    return this.tokenStore.get(userId) || null;
  }

  /**
   * Test API connection by fetching user profile
   * Useful for verifying authentication and API connectivity
   */
  async testApiConnection(userId) {
    try {
      const response = await this.makeAuthenticatedRequest(userId, '/developer/v2/user/profile/basic', 'GET');
      return { endpoint: '/developer/v2/user/profile/basic', data: response };
    } catch (error) {
      throw new Error(`API connection test failed: ${error.message}`);
    }
  }

  /**
   * Fetch latest recovery data
   * Whoop API v2: GET /developer/v2/recovery or /developer/v2/cycle
   * Reference: https://developer.whoop.com/api
   */
  async getRecovery(userId) {
    // Get recovery data with date range (last 7 days to get latest)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const params = {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    };

    // Try /developer/v2/recovery endpoint first
    let response;
    try {
      response = await this.makeAuthenticatedRequest(userId, '/developer/v2/recovery', 'GET', null, params);
    } catch (error) {
      // Try /developer/v2/cycle as fallback (cycles contain recovery data)
      console.warn('Failed to fetch recovery from /developer/v2/recovery, trying /developer/v2/cycle:', error.message);
      try {
        response = await this.makeAuthenticatedRequest(userId, '/developer/v2/cycle', 'GET', null, params);
      } catch (cycleError) {
        throw new Error(`Failed to fetch recovery data. Tried /developer/v2/recovery and /developer/v2/cycle. Last error: ${cycleError.message}`);
      }
    }
    
    // Handle different response formats
    let recoveries = Array.isArray(response) ? response : response.records || response.data || [];
    
    // If response is a single object (not an array), use it directly
    if (!Array.isArray(recoveries) && response && typeof response === 'object') {
      return response;
    }
    
    if (!recoveries || recoveries.length === 0) {
      throw new Error('No recovery data available');
    }

    // Get the most recent recovery (first in array should be latest)
    return recoveries[0];
  }

  /**
   * Fetch latest sleep data
   * Whoop API v2: GET /developer/v2/activity/sleep - returns sleep sessions
   * Reference: https://developer.whoop.com/api
   */
  async getSleep(userId) {
    // Get sleep with date range (last 7 days to get latest)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const params = {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    };

    let response;
    try {
      response = await this.makeAuthenticatedRequest(userId, '/developer/v2/activity/sleep', 'GET', null, params);
    } catch (error) {
      throw new Error(`Failed to fetch sleep data from /developer/v2/activity/sleep: ${error.message}`);
    }
    
    // Handle different response formats
    let sleeps = Array.isArray(response) ? response : response.records || response.data || [];
    
    // If response is a single object (not an array), use it directly
    if (!Array.isArray(sleeps) && response && typeof response === 'object') {
      return response;
    }
    
    if (!sleeps || sleeps.length === 0) {
      throw new Error('No sleep data available');
    }

    // Get the most recent sleep (first in array should be latest)
    return sleeps[0];
  }

  /**
   * Fetch latest workout/strain data
   * Whoop API v2: GET /developer/v2/activity/workout - returns workouts with strain data
   * Reference: https://developer.whoop.com/api
   */
  async getWorkouts(userId) {
    // Get workouts with date range (last 7 days to get latest)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const params = {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    };

    let response;
    try {
      response = await this.makeAuthenticatedRequest(userId, '/developer/v2/activity/workout', 'GET', null, params);
    } catch (error) {
      // Workouts are optional, so return null instead of throwing
      console.warn('Could not fetch workout data from /developer/v2/activity/workout:', error.message);
      return null;
    }
    
    // Handle different response formats
    let workouts = Array.isArray(response) ? response : response.records || response.data || [];
    
    // If response is a single object (not an array), use it directly
    if (!Array.isArray(workouts) && response && typeof response === 'object') {
      return response;
    }
    
    if (!workouts || workouts.length === 0) {
      return null; // No workouts is valid
    }

    // Get the most recent workout (first in array should be latest)
    return workouts[0];
  }

  /**
   * Fetch all relevant data for mood inference
   * Returns data in format compatible with whoopAdapter normalization
   */
  async fetchLatestData(userId) {
    try {
      const [recovery, sleep, workout] = await Promise.allSettled([
        this.getRecovery(userId),
        this.getSleep(userId),
        this.getWorkouts(userId),
      ]);

      // Extract data from Whoop API v2 format
      const recoveryData = recovery.status === 'fulfilled' ? recovery.value : null;
      const sleepData = sleep.status === 'fulfilled' ? sleep.value : null;
      const workoutData = workout.status === 'fulfilled' ? workout.value : null;

      // Transform to format expected by whoopAdapter
      // Whoop API v2 response structure: { records: [...], next_token: "..." }
      // Recovery: score.recovery_score, score.hrv_rmssd_milli, score.resting_heart_rate
      // Sleep: score.sleep_performance_percentage, score.stage_summary.total_sleep_time_milli
      // Workout: score.strain
      const payload = {
        timestamp: new Date().toISOString(),
        recovery: recoveryData ? {
          score: recoveryData.score?.recovery_score ?? recoveryData.recovery_score ?? recoveryData.score,
          hrv: recoveryData.score?.hrv_rmssd_milli ?? recoveryData.hrv_rmssd_milli ?? recoveryData.hrv,
          heart_rate_variability: recoveryData.score?.hrv_rmssd_milli ?? recoveryData.hrv_rmssd_milli ?? recoveryData.hrv,
          resting_heart_rate: recoveryData.score?.resting_heart_rate ?? recoveryData.resting_heart_rate,
          timestamp: recoveryData.start ?? recoveryData.timestamp,
        } : {},
        sleep: sleepData ? {
          score: sleepData.score?.sleep_performance_percentage ?? sleepData.score?.total ?? sleepData.score,
          quality_score: sleepData.score?.sleep_performance_percentage ?? sleepData.score?.total ?? sleepData.score,
          duration: sleepData.score?.stage_summary?.total_sleep_time_milli ?? sleepData.duration?.total_sleep_time_ms ?? sleepData.total_sleep_time_ms,
        } : {},
        strain: workoutData ? (workoutData.score?.strain ?? workoutData.strain) : null,
        training_load: workoutData ? {
          strain: workoutData.score?.strain ?? workoutData.strain,
        } : null,
      };

      return payload;
    } catch (error) {
      console.error('Error fetching Whoop data:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new WhoopService();

