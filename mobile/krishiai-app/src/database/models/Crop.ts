import { Model } from '@nozbe/watermelondb';
import { field, date, relation } from '@nozbe/watermelondb/decorators';
import type { Associations } from '@nozbe/watermelondb/Model';
import type Farm from './Farm';

export default class Crop extends Model {
  static table = 'crops';
  static associations: Associations = {
    farms: { type: 'belongs_to', key: 'farm_id' },
  };

  @field('farm_id') farmId!: string;
  @field('crop_name') cropName!: string;
  @field('variety') variety?: string;
  @date('sowing_date') sowingDate?: Date;
  @date('expected_harvest') expectedHarvest?: Date;
  @field('status') status!: string;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @relation('farms', 'farm_id') farm!: Farm;
}
