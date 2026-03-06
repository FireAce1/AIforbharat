import request from 'supertest';
import app from '../index';
import database from '../config/database';
import redis from '../config/redis';
import weatherService from '../services/weatherService';

// Mock dependencies
jest.mock('../config/database');
jest.mock('../config/redis');
jest.mock('../services/weatherService');

describe('Weather Forecast Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/climate/weather/forecast', () => {
    it('should return 7-day weather forecast with hourly breakdown', async () => {
      const mockForecasts = [
        {
          time: new Date('2024-01-15T00:00:00Z'),
          location: { lat: 19.0760, lng: 72.8777 },
          temperature: 28.5,
          rainfall: 0,
          humidity: 65,
          windSpeed: 12,
          source: 'IMD',
        },
        {
          time: new Date('2024-01-15T06:00:00Z'),
          location: { lat: 19.0760, lng: 72.8777 },
          temperature: 32.0,
          rainfall: 0,
          humidity: 60,
          windSpeed: 15,
          source: 'IMD',
        },
      ];

      (weatherService.getWeatherForecast as jest.Mock).mockResolvedValue(mockForecasts);
      (redis.getJSON as jest.Mock).mockResolvedValue(null);
      (redis.setJSON as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/v1/climate/weather/forecast')
        .query({ lat: 19.0760, lng: 72.8777, days: 7 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('location');
      expect(response.body.data).toHaveProperty('forecasts');
      expect(response.body.data).toHaveProperty('criticalAlerts');
      expect(response.body.metadata.hyperlocalAccuracy).toBe('5km');
    });

    it('should detect critical weather conditions (heavy rainfall)', async () => {
      const mockForecasts = [
        {
          time: new Date('2024-01-15T00:00:00Z'),
          location: { lat: 19.0760, lng: 72.8777 },
          temperature: 28.5,
          rainfall: 120, // >100mm - critical
          humidity: 85,
          windSpeed: 12,
          source: 'IMD',
        },
      ];

      (weatherService.getWeatherForecast as jest.Mock).mockResolvedValue(mockForecasts);
      (redis.getJSON as jest.Mock).mockResolvedValue(null);
      (redis.setJSON as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/v1/climate/weather/forecast')
        .query({ lat: 19.0760, lng: 72.8777, days: 1 });

      expect(response.status).toBe(200);
      expect(response.body.data.criticalAlerts).toHaveLength(1);
      expect(response.body.data.criticalAlerts[0].type).toBe('HEAVY_RAINFALL');
      expect(response.body.data.criticalAlerts[0].severity).toBe('HIGH');
    });

    it('should detect extreme heat conditions', async () => {
      const mockForecasts = [
        {
          time: new Date('2024-01-15T12:00:00Z'),
          location: { lat: 19.0760, lng: 72.8777 },
          temperature: 46, // >45°C - critical
          rainfall: 0,
          humidity: 30,
          windSpeed: 8,
          source: 'IMD',
        },
      ];

      (weatherService.getWeatherForecast as jest.Mock).mockResolvedValue(mockForecasts);
      (redis.getJSON as jest.Mock).mockResolvedValue(null);
      (redis.setJSON as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/v1/climate/weather/forecast')
        .query({ lat: 19.0760, lng: 72.8777, days: 1 });

      expect(response.status).toBe(200);
      expect(response.body.data.criticalAlerts).toHaveLength(1);
      expect(response.body.data.criticalAlerts[0].type).toBe('EXTREME_HEAT');
    });

    it('should detect frost conditions', async () => {
      const mockForecasts = [
        {
          time: new Date('2024-01-15T06:00:00Z'),
          location: { lat: 19.0760, lng: 72.8777 },
          temperature: 3, // <5°C - critical
          rainfall: 0,
          humidity: 70,
          windSpeed: 5,
          source: 'IMD',
        },
      ];

      (weatherService.getWeatherForecast as jest.Mock).mockResolvedValue(mockForecasts);
      (redis.getJSON as jest.Mock).mockResolvedValue(null);
      (redis.setJSON as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/v1/climate/weather/forecast')
        .query({ lat: 19.0760, lng: 72.8777, days: 1 });

      expect(response.status).toBe(200);
      expect(response.body.data.criticalAlerts).toHaveLength(1);
      expect(response.body.data.criticalAlerts[0].type).toBe('FROST');
      expect(response.body.data.criticalAlerts[0].severity).toBe('CRITICAL');
    });

    it('should detect high wind conditions', async () => {
      const mockForecasts = [
        {
          time: new Date('2024-01-15T12:00:00Z'),
          location: { lat: 19.0760, lng: 72.8777 },
          temperature: 30,
          rainfall: 0,
          humidity: 60,
          windSpeed: 65, // >60km/h - critical
          source: 'IMD',
        },
      ];

      (weatherService.getWeatherForecast as jest.Mock).mockResolvedValue(mockForecasts);
      (redis.getJSON as jest.Mock).mockResolvedValue(null);
      (redis.setJSON as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/v1/climate/weather/forecast')
        .query({ lat: 19.0760, lng: 72.8777, days: 1 });

      expect(response.status).toBe(200);
      expect(response.body.data.criticalAlerts).toHaveLength(1);
      expect(response.body.data.criticalAlerts[0].type).toBe('HIGH_WIND');
    });

    it('should serve from cache when available', async () => {
      const cachedData = {
        location: { lat: 19.0760, lng: 72.8777 },
        forecasts: [],
        criticalAlerts: [],
      };

      (redis.getJSON as jest.Mock).mockResolvedValue(cachedData);

      const response = await request(app)
        .get('/api/v1/climate/weather/forecast')
        .query({ lat: 19.0760, lng: 72.8777, days: 7 });

      expect(response.status).toBe(200);
      expect(response.body.metadata.cached).toBe(true);
      expect(weatherService.getWeatherForecast).not.toHaveBeenCalled();
    });

    it('should cache forecast with 6-hour TTL', async () => {
      const mockForecasts = [
        {
          time: new Date('2024-01-15T00:00:00Z'),
          location: { lat: 19.0760, lng: 72.8777 },
          temperature: 28.5,
          rainfall: 0,
          humidity: 65,
          windSpeed: 12,
          source: 'IMD',
        },
      ];

      (weatherService.getWeatherForecast as jest.Mock).mockResolvedValue(mockForecasts);
      (redis.getJSON as jest.Mock).mockResolvedValue(null);
      (redis.setJSON as jest.Mock).mockResolvedValue(undefined);

      await request(app)
        .get('/api/v1/climate/weather/forecast')
        .query({ lat: 19.0760, lng: 72.8777, days: 7 });

      expect(redis.setJSON).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        21600 // 6 hours in seconds
      );
    });

    it('should validate latitude range', async () => {
      const response = await request(app)
        .get('/api/v1/climate/weather/forecast')
        .query({ lat: 100, lng: 72.8777, days: 7 });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_LATITUDE');
    });

    it('should validate longitude range', async () => {
      const response = await request(app)
        .get('/api/v1/climate/weather/forecast')
        .query({ lat: 19.0760, lng: 200, days: 7 });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_LONGITUDE');
    });

    it('should validate days parameter', async () => {
      const response = await request(app)
        .get('/api/v1/climate/weather/forecast')
        .query({ lat: 19.0760, lng: 72.8777, days: 20 });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_DAYS');
    });

    it('should require latitude and longitude', async () => {
      const response = await request(app)
        .get('/api/v1/climate/weather/forecast')
        .query({ days: 7 });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_PARAMETERS');
    });
  });
});
