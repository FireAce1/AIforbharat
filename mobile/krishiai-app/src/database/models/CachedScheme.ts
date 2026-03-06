/**
 * CachedScheme Model
 * WatermelonDB model for cached government schemes
 */

import {Model} from '@nozbe/watermelondb';
import {field, date, json, readonly} from '@nozbe/watermelondb/decorators';

export interface EligibilityCriteria {
  maxLandHectares?: number;
  minLandHectares?: number;
  cropTypes?: string[];
  states?: string[];
  farmerCategories?: string[];
}

export interface SchemeDescription {
  en?: string;
  hi?: string;
  mr?: string;
}

export default class CachedScheme extends Model {
  static table = 'cached_schemes';

  @field('scheme_id') schemeId!: string;
  @field('scheme_name') schemeName!: string;
  @field('scheme_name_hi') schemeNameHi!: string;
  @field('scheme_name_mr') schemeNameMr!: string;
  @json('description', (json: SchemeDescription) => json) description!: SchemeDescription;
  @field('benefits_amount') benefitsAmount!: number;
  @field('benefits_description') benefitsDescription!: string;
  @field('benefits_description_hi') benefitsDescriptionHi!: string;
  @field('benefits_description_mr') benefitsDescriptionMr!: string;
  @json('eligibility', (json: EligibilityCriteria) => json) eligibility!: EligibilityCriteria;
  @json('documents', (json: string[]) => json) documents!: string[];
  @date('deadline') deadline!: Date;
  @field('application_link') applicationLink!: string;
  @field('scheme_type') schemeType!: string;
  @field('state') state!: string;
  @field('is_eligible') isEligible!: boolean; // Computed based on user profile
  @date('cached_at') cachedAt!: Date;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
