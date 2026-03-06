import request from 'supertest';
import express, { Application } from 'express';
import marketRoutes from '../routes/market';
import { priceService } from '../services/priceService';
import { forecastService } from '../services/forecastService';
import { alertService } from '../services/alertService';

// Mock services
jest.mock('../services/priceService');
jest.mock('../services/forecastService');
jest.mock('../services/alertService');
jest.mock('../utils/logger');
jest.mock('../config/database');
jest.mock('../config/redis');

describe('Market Routes', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/market', marketRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/v1/market/prices', () => {
    it('should return prices with valid parameters', async () => {
      const mockDate = new Date();
      const mockPrices = [
        {
          time: mockDate,
          crop_name: 'Tomato',
          market_name: 'Pune Mandi',
          location: { lat: 18.5204, lng: 73.8567 },
          price_per_kg: 25.5,
          quantity_traded: 1000,
        },
      ];

      const mockTrends = [
        {
          crop_name: 'Tomato',
          market_name: 'Pune Mandi',
          current_price: 25.5,
          previous_price: 24.0,
          trend: 'up' as const,
          change_percentage: 6.25,
        },
      ];

      const mockMandis = [
        {
          market_name: 'Pune Mandi',
          location: { lat: 18.5204, lng: 73.8567 },
          distance_km: 5.2,
        },
      ];

      (priceService.getPrices as jest.Mock).mockResolvedValue(mockPrices);
      (priceService.getPriceTrends as jest.Mock).mockResolvedValue(mockTrends);
      (priceService.getNearbyMandis as jest.Mock).mockResolvedValue(mockMandis);

      const response = await request(app)
        .get('/api/v1/market/prices')
        .query({
          crop_name: 'Tomato',
          latitude: '18.5204',
          longitude: '73.8567',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.prices).toHaveLength(1);
      expect(response.body.data.prices[0].crop_name).toBe('Tomato');
      expect(response.body.data.trends).toEqual(mockTrends);
      expect(response.body.data.nearby_mandis).toEqual(mockMandis);
    });

    it('should return 400 for missing parameters', async () => {
      const response = await request(app)
        .get('/api/v1/market/prices')
        .query({ crop_name: 'Tomato' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required parameters');
    });

    it('should return 400 for invalid coordinates', async () => {
      const response = await request(app)
        .get('/api/v1/market/prices')
        .query({
          crop_name: 'Tomato',
          latitude: '100',
          longitude: '73.8567',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Latitude must be between');
    });
  });

  describe('GET /api/v1/market/forecast', () => {
    it('should return forecast with valid parameters', async () => {
      const mockForecast = {
        crop_name: 'Tomato',
        market_name: 'Pune Mandi',
        forecast_days: 7,
        forecasts: [
          {
            date: '2024-01-08',
            predicted_price: 26.5,
            confidence_interval: { lower: 24.0, upper: 29.0 },
          },
        ],
        accuracy_mape: 12.5,
        model_type: 'ensemble' as const,
      };

      (forecastService.getForecast as jest.Mock).mockResolvedValue(mockForecast);

      const response = await request(app)
        .get('/api/v1/market/forecast')
        .query({
          crop_name: 'Tomato',
          market_name: 'Pune Mandi',
          days: '7',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockForecast);
    });

    it('should return 400 for invalid forecast days', async () => {
      const response = await request(app)
        .get('/api/v1/market/forecast')
        .query({
          crop_name: 'Tomato',
          market_name: 'Pune Mandi',
          days: '15',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid forecast days');
    });
  });

  describe('POST /api/v1/market/alerts', () => {
    it('should create alert with valid data', async () => {
      const mockDate = new Date();
      const mockAlert = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        phone: '+919876543210',
        crop_name: 'Tomato',
        market_name: 'Pune Mandi',
        target_price: 30.0,
        alert_type: 'above' as const,
        is_active: true,
        created_at: mockDate,
      };

      (alertService.createAlert as jest.Mock).mockResolvedValue(mockAlert);

      const response = await request(app)
        .post('/api/v1/market/alerts')
        .send({
          user_id: '123e4567-e89b-12d3-a456-426614174001',
          phone: '+919876543210',
          crop_name: 'Tomato',
          market_name: 'Pune Mandi',
          target_price: 30.0,
          alert_type: 'above',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockAlert.id);
      expect(response.body.data.crop_name).toBe('Tomato');
      expect(response.body.data.target_price).toBe(30.0);
    });

    it('should return 400 for invalid phone number', async () => {
      const response = await request(app)
        .post('/api/v1/market/alerts')
        .send({
          user_id: '123e4567-e89b-12d3-a456-426614174001',
          phone: '1234567890',
          crop_name: 'Tomato',
          market_name: 'Pune Mandi',
          target_price: 30.0,
          alert_type: 'above',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid phone number format');
    });

    it('should return 400 for invalid alert type', async () => {
      const response = await request(app)
        .post('/api/v1/market/alerts')
        .send({
          user_id: '123e4567-e89b-12d3-a456-426614174001',
          phone: '+919876543210',
          crop_name: 'Tomato',
          market_name: 'Pune Mandi',
          target_price: 30.0,
          alert_type: 'invalid',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid alert_type');
    });
  });

  describe('GET /api/v1/market/alerts/:userId', () => {
    it('should return user alerts', async () => {
      const mockDate = new Date();
      const mockAlerts = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          user_id: '123e4567-e89b-12d3-a456-426614174001',
          phone: '+919876543210',
          crop_name: 'Tomato',
          market_name: 'Pune Mandi',
          target_price: 30.0,
          alert_type: 'above' as const,
          is_active: true,
          created_at: mockDate,
        },
      ];

      (alertService.getUserAlerts as jest.Mock).mockResolvedValue(mockAlerts);

      const response = await request(app).get(
        '/api/v1/market/alerts/123e4567-e89b-12d3-a456-426614174001'
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].crop_name).toBe('Tomato');
      expect(response.body.count).toBe(1);
    });
  });

  describe('DELETE /api/v1/market/alerts/:alertId', () => {
    it('should deactivate alert', async () => {
      (alertService.deactivateAlert as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/v1/market/alerts/123e4567-e89b-12d3-a456-426614174000')
        .send({ user_id: '123e4567-e89b-12d3-a456-426614174001' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Alert deactivated successfully');
    });

    it('should return 400 for missing user_id', async () => {
      const response = await request(app)
        .delete('/api/v1/market/alerts/123e4567-e89b-12d3-a456-426614174000')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required field: user_id');
    });
  });

  describe('GET /api/v1/market/mandis', () => {
    it('should return nearby mandis', async () => {
      const mockMandis = [
        {
          market_name: 'Pune Mandi',
          location: { lat: 18.5204, lng: 73.8567 },
          distance_km: 5.2,
        },
      ];

      (priceService.getNearbyMandis as jest.Mock).mockResolvedValue(mockMandis);

      const response = await request(app)
        .get('/api/v1/market/mandis')
        .query({
          latitude: '18.5204',
          longitude: '73.8567',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.mandis).toEqual(mockMandis);
    });
  });
});
