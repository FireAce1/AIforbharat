import Joi from 'joi';
import {
  phoneSchema,
  nameSchema,
  latitudeSchema,
  longitudeSchema,
  coordinatesSchema,
  uuidSchema,
  emailSchema,
  positiveIntSchema,
  positiveNumberSchema,
  dateSchema,
  languageSchema,
} from './validation';

/**
 * Common validation schemas used across multiple services
 */

// Farm-related schemas
export const farmProfileSchema = Joi.object({
  name: nameSchema.optional(),
  location: coordinatesSchema.required(),
  size_hectares: positiveNumberSchema.required().max(1000).messages({
    'number.max': 'Farm size cannot exceed 1000 hectares',
  }),
  soil_type: Joi.string()
    .valid('Alluvial', 'Black', 'Red', 'Laterite', 'Desert', 'Mountain')
    .required()
    .messages({
      'any.only': 'Soil type must be one of: Alluvial, Black, Red, Laterite, Desert, Mountain',
      'any.required': 'Soil type is required',
    }),
  irrigation_type: Joi.string()
    .valid('Rainfed', 'Borewell', 'Canal', 'Drip', 'Sprinkler')
    .required()
    .messages({
      'any.only': 'Irrigation type must be one of: Rainfed, Borewell, Canal, Drip, Sprinkler',
      'any.required': 'Irrigation type is required',
    }),
});

// Crop-related schemas
export const cropSchema = Joi.object({
  crop_name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Crop name must be at least 2 characters',
    'string.max': 'Crop name must not exceed 100 characters',
    'any.required': 'Crop name is required',
  }),
  variety: Joi.string().max(100).optional(),
  sowing_date: dateSchema.optional(),
  expected_harvest: dateSchema.optional(),
});

// Location query schema (for geospatial queries)
export const locationQuerySchema = Joi.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  radius_km: positiveNumberSchema.optional().max(100).default(50).messages({
    'number.max': 'Radius cannot exceed 100 kilometers',
  }),
});

// Pagination schema
export const paginationSchema = Joi.object({
  page: positiveIntSchema.optional().default(1),
  limit: positiveIntSchema.optional().min(1).max(100).default(20).messages({
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 100',
  }),
  offset: Joi.number().integer().min(0).optional(),
});

// Date range schema
export const dateRangeSchema = Joi.object({
  start_date: dateSchema.required(),
  end_date: dateSchema.required().greater(Joi.ref('start_date')).messages({
    'date.greater': 'End date must be after start date',
  }),
});

// User profile update schema
export const userProfileSchema = Joi.object({
  name: nameSchema.optional(),
  language: languageSchema.optional(),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
});

// Image upload schema
export const imageUploadSchema = Joi.object({
  image: Joi.string().required().messages({
    'any.required': 'Image is required',
    'string.base': 'Image must be a base64 string',
  }),
  crop_id: uuidSchema.optional(),
  farm_id: uuidSchema.optional(),
});

// Search query schema
export const searchQuerySchema = Joi.object({
  query: Joi.string().min(1).max(200).required().trim().messages({
    'string.min': 'Search query must be at least 1 character',
    'string.max': 'Search query must not exceed 200 characters',
    'any.required': 'Search query is required',
  }),
  language: languageSchema.optional(),
  ...paginationSchema.describe().keys,
});

// Filter schema for schemes/crops/etc
export const filterSchema = Joi.object({
  category: Joi.string().max(50).optional(),
  state: Joi.string().max(50).optional(),
  district: Joi.string().max(100).optional(),
  is_active: Joi.boolean().optional(),
  ...paginationSchema.describe().keys,
});

export {
  phoneSchema,
  nameSchema,
  latitudeSchema,
  longitudeSchema,
  coordinatesSchema,
  uuidSchema,
  emailSchema,
  positiveIntSchema,
  positiveNumberSchema,
  dateSchema,
  languageSchema,
};
