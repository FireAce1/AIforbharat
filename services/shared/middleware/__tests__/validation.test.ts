import { Request, Response, NextFunction } from 'express';
import {
  validate,
  phoneSchema,
  nameSchema,
  latitudeSchema,
  longitudeSchema,
  coordinatesSchema,
  sanitizeString,
  sanitizeObject,
  preventSQLInjection,
  preventXSS,
  ValidationException,
} from '../validation';
import Joi from 'joi';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
    };
    mockRes = {};
    mockNext = jest.fn();
  });

  describe('validate middleware', () => {
    it('should pass validation with valid data', () => {
      const schema = Joi.object({
        name: Joi.string().required(),
        age: Joi.number().required(),
      });

      mockReq.body = { name: 'John Doe', age: 30 };

      const middleware = validate(schema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body).toEqual({ name: 'John Doe', age: 30 });
    });

    it('should fail validation with invalid data', () => {
      const schema = Joi.object({
        name: Joi.string().required(),
        age: Joi.number().required(),
      });

      mockReq.body = { name: 'John Doe' }; // Missing age

      const middleware = validate(schema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationException));
      const error = (mockNext as jest.Mock).mock.calls[0][0] as ValidationException;
      expect(error.errors).toHaveLength(1);
      expect(error.errors[0].field).toBe('age');
    });

    it('should strip unknown fields', () => {
      const schema = Joi.object({
        name: Joi.string().required(),
      });

      mockReq.body = { name: 'John Doe', extra: 'field' };

      const middleware = validate(schema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body).toEqual({ name: 'John Doe' });
      expect(mockReq.body).not.toHaveProperty('extra');
    });

    it('should validate query parameters', () => {
      const schema = Joi.object({
        page: Joi.number().integer().min(1).required(),
      });

      mockReq.query = { page: '5' };

      const middleware = validate(schema, 'query');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.query).toEqual({ page: 5 }); // Converted to number
    });
  });

  describe('phoneSchema', () => {
    it('should validate correct Indian phone numbers', () => {
      const validPhones = ['+919876543210', '+918765432109', '+917654321098'];

      validPhones.forEach((phone) => {
        const { error } = phoneSchema.validate(phone);
        expect(error).toBeUndefined();
      });
    });

    it('should reject invalid phone numbers', () => {
      const invalidPhones = [
        '9876543210', // Missing +91
        '+91123456789', // Invalid starting digit
        '+9198765432', // Too short
        '+919876543210123', // Too long
        '+91abcdefghij', // Contains letters
      ];

      invalidPhones.forEach((phone) => {
        const { error } = phoneSchema.validate(phone);
        expect(error).toBeDefined();
      });
    });
  });

  describe('nameSchema', () => {
    it('should validate correct names', () => {
      const validNames = [
        'John Doe',
        'Ram Kumar',
        "O'Brien",
        'Jean-Pierre',
        'Name123',
      ];

      validNames.forEach((name) => {
        const { error } = nameSchema.validate(name);
        expect(error).toBeUndefined();
      });
    });

    it('should reject invalid names', () => {
      const invalidNames = [
        'A', // Too short
        'A'.repeat(101), // Too long
        'Name<script>', // Contains HTML
        'Name@#$', // Invalid characters
      ];

      invalidNames.forEach((name) => {
        const { error } = nameSchema.validate(name);
        expect(error).toBeDefined();
      });
    });

    it('should trim whitespace', () => {
      const { value } = nameSchema.validate('  John Doe  ');
      expect(value).toBe('John Doe');
    });
  });

  describe('latitudeSchema', () => {
    it('should validate correct latitudes', () => {
      const validLatitudes = [-90, -45.5, 0, 45.5, 90];

      validLatitudes.forEach((lat) => {
        const { error } = latitudeSchema.validate(lat);
        expect(error).toBeUndefined();
      });
    });

    it('should reject invalid latitudes', () => {
      const invalidLatitudes = [-91, 91, 'abc'];

      invalidLatitudes.forEach((lat) => {
        const { error } = latitudeSchema.validate(lat);
        expect(error).toBeDefined();
      });
    });
  });

  describe('longitudeSchema', () => {
    it('should validate correct longitudes', () => {
      const validLongitudes = [-180, -90.5, 0, 90.5, 180];

      validLongitudes.forEach((lon) => {
        const { error } = longitudeSchema.validate(lon);
        expect(error).toBeUndefined();
      });
    });

    it('should reject invalid longitudes', () => {
      const invalidLongitudes = [-181, 181, 'xyz'];

      invalidLongitudes.forEach((lon) => {
        const { error } = longitudeSchema.validate(lon);
        expect(error).toBeDefined();
      });
    });
  });

  describe('coordinatesSchema', () => {
    it('should validate correct coordinates', () => {
      const { error } = coordinatesSchema.validate({
        latitude: 28.6139,
        longitude: 77.209,
      });
      expect(error).toBeUndefined();
    });

    it('should reject invalid coordinates', () => {
      const { error } = coordinatesSchema.validate({
        latitude: 100,
        longitude: 77.209,
      });
      expect(error).toBeDefined();
    });
  });

  describe('sanitizeString', () => {
    it('should remove script tags', () => {
      const input = 'Hello<script>alert("XSS")</script>World';
      const output = sanitizeString(input);
      expect(output).toBe('HelloWorld');
    });

    it('should remove HTML tags', () => {
      const input = 'Hello<div>World</div>';
      const output = sanitizeString(input);
      expect(output).toBe('HelloWorld');
    });

    it('should escape dangerous characters', () => {
      const input = 'Hello<>"\'World';
      const output = sanitizeString(input);
      expect(output).not.toContain('<');
      expect(output).not.toContain('>');
      expect(output).not.toContain('"');
      expect(output).not.toContain("'");
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const output = sanitizeString(input);
      expect(output).toBe('Hello World');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize string values in object', () => {
      const input = {
        name: 'John<script>alert("XSS")</script>',
        age: 30,
      };
      const output = sanitizeObject(input);
      expect(output.name).toBe('John');
      expect(output.age).toBe(30);
    });

    it('should sanitize nested objects', () => {
      const input = {
        user: {
          name: 'John<div>Test</div>',
          email: 'john@example.com',
        },
      };
      const output = sanitizeObject(input);
      expect(output.user.name).toBe('JohnTest');
      expect(output.user.email).toBe('john@example.com');
    });

    it('should sanitize arrays', () => {
      const input = ['Hello<script>', 'World<div>'];
      const output = sanitizeObject(input);
      expect(output).toEqual(['Hello', 'World']);
    });
  });

  describe('preventSQLInjection middleware', () => {
    it('should allow safe input', () => {
      mockReq.body = { name: 'John Doe', age: 30 };

      preventSQLInjection(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should block SQL injection attempts in body', () => {
      mockReq.body = { name: "John'; DROP TABLE users; --" };

      preventSQLInjection(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationException));
    });

    it('should block SQL injection attempts in query', () => {
      mockReq.query = { search: 'test UNION SELECT * FROM users' };

      preventSQLInjection(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationException));
    });

    it('should block SQL injection attempts in params', () => {
      mockReq.params = { id: "1 OR 1=1; DELETE FROM users" };

      preventSQLInjection(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationException));
    });
  });

  describe('preventXSS middleware', () => {
    it('should sanitize body', () => {
      mockReq.body = { name: 'John<script>alert("XSS")</script>' };

      preventXSS(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.name).toBe('John');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should sanitize query', () => {
      mockReq.query = { search: 'test<div>content</div>' };

      preventXSS(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query.search).toBe('testcontent');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should sanitize params', () => {
      mockReq.params = { name: 'John<b>Bold</b>' };

      preventXSS(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.params.name).toBe('JohnBold');
      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
