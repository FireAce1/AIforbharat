import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import {store} from '../store';
import {addToSyncQueue} from '../store/slices/syncSlice';
import {logout} from '../store/slices/authSlice';

// API Configuration
// Production uses HTTPS with TLS 1.3 and certificate pinning (configured in network_security_config.xml)
const API_BASE_URL = __DEV__
  ? 'http://10.0.2.2:3000' // Android emulator localhost (HTTP for development)
  : 'https://api.krishiai.com'; // Production API with TLS 1.3

const API_TIMEOUT = 30000; // 30 seconds

// Exponential backoff configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 8000, // 8 seconds
  backoffMultiplier: 2,
};

export interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
}

export interface QueuedRequest {
  action: string;
  payload: any;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

class ApiClient {
  private axiosInstance: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (value?: any) => void;
    reject: (reason?: any) => void;
  }> = [];

  constructor(config?: ApiClientConfig) {
    this.axiosInstance = axios.create({
      baseURL: config?.baseURL || API_BASE_URL,
      timeout: config?.timeout || API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Set up request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor - attach JWT token
    this.axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const state = store.getState();
        const token = state.auth.token;

        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      },
      (error: AxiosError) => {
        return Promise.reject(error);
      },
    );

    // Response interceptor - handle errors, token refresh, offline detection
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
          _retry?: boolean;
        };

        // Handle network errors (offline detection)
        if (!error.response) {
          console.log('Network error detected, queueing request for offline sync');
          this.queueOfflineRequest(originalRequest);
          return Promise.reject({
            message: 'Network error. Request queued for sync when online.',
            isOffline: true,
            originalError: error,
          });
        }

        // Handle 401 Unauthorized - token expired
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // Queue the request while token is being refreshed
            return new Promise((resolve, reject) => {
              this.failedQueue.push({resolve, reject});
            })
              .then(() => {
                return this.axiosInstance(originalRequest);
              })
              .catch(err => {
                return Promise.reject(err);
              });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const newToken = await this.refreshToken();
            this.isRefreshing = false;
            this.processQueue(null);

            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }

            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            this.isRefreshing = false;
            this.processQueue(refreshError);
            store.dispatch(logout());
            return Promise.reject(refreshError);
          }
        }

        // Handle 429 Too Many Requests - rate limiting
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;

          console.log(`Rate limited. Retrying after ${delay}ms`);

          await this.sleep(delay);
          return this.axiosInstance(originalRequest);
        }

        // Handle 5xx Server Errors - retry with exponential backoff
        if (
          error.response?.status &&
          error.response.status >= 500 &&
          error.response.status < 600
        ) {
          return this.retryWithBackoff(originalRequest);
        }

        return Promise.reject(error);
      },
    );
  }

  /**
   * Refresh JWT token
   */
  private async refreshToken(): Promise<string> {
    try {
      const state = store.getState();
      const token = state.auth.token;

      const response = await axios.post(
        `${API_BASE_URL}/api/v1/auth/refresh`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const newToken = response.data.token;

      // Update token in Redux store
      // Note: This would typically be handled by a saga or thunk
      // For now, we'll just return the token
      return newToken;
    } catch (error) {
      throw new Error('Failed to refresh token');
    }
  }

  /**
   * Process queued requests after token refresh
   */
  private processQueue(error: any): void {
    this.failedQueue.forEach(promise => {
      if (error) {
        promise.reject(error);
      } else {
        promise.resolve();
      }
    });

    this.failedQueue = [];
  }

  /**
   * Queue failed request for offline sync
   */
  private queueOfflineRequest(config: InternalAxiosRequestConfig): void {
    if (!config.method || !config.url) {
      return;
    }

    // Don't queue GET requests (read operations)
    if (config.method.toUpperCase() === 'GET') {
      return;
    }

    // Determine priority based on endpoint
    let priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';

    if (config.url.includes('/auth/')) {
      priority = 'CRITICAL';
    } else if (
      config.url.includes('/disease/detect') ||
      config.url.includes('/crop/recommend')
    ) {
      priority = 'HIGH';
    } else if (config.url.includes('/farm') || config.url.includes('/crop')) {
      priority = 'MEDIUM';
    } else {
      priority = 'LOW';
    }

    const queueItem: QueuedRequest = {
      action: `${config.method.toUpperCase()}_${config.url}`,
      payload: {
        method: config.method,
        url: config.url,
        data: config.data,
        headers: config.headers,
      },
      priority,
    };

    store.dispatch(addToSyncQueue(queueItem));
  }

  /**
   * Retry request with exponential backoff
   */
  private async retryWithBackoff(
    config: InternalAxiosRequestConfig & {_retryCount?: number},
  ): Promise<AxiosResponse> {
    const retryCount = config._retryCount || 0;

    if (retryCount >= RETRY_CONFIG.maxRetries) {
      throw new Error('Max retries exceeded');
    }

    const delay = Math.min(
      RETRY_CONFIG.initialDelay *
        Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount),
      RETRY_CONFIG.maxDelay,
    );

    console.log(
      `Retrying request (attempt ${retryCount + 1}/${RETRY_CONFIG.maxRetries}) after ${delay}ms`,
    );

    await this.sleep(delay);

    config._retryCount = retryCount + 1;
    return this.axiosInstance(config);
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * GET request
   */
  async get<T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.get<T>(url, config);
  }

  /**
   * POST request
   */
  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.post<T>(url, data, config);
  }

  /**
   * PUT request
   */
  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.put<T>(url, data, config);
  }

  /**
   * PATCH request
   */
  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.patch<T>(url, data, config);
  }

  /**
   * DELETE request
   */
  async delete<T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.delete<T>(url, config);
  }

  /**
   * Get the underlying axios instance for advanced usage
   */
  getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for testing
export default ApiClient;
