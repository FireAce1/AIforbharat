import { Model, Q } from '@nozbe/watermelondb';
import { field, date, relation, children } from '@nozbe/watermelondb/decorators';
import type { Associations } from '@nozbe/watermelondb/Model';
import type User from './User';
import type Crop from './Crop';

export default class Farm extends Model {
  static table = 'farms';
  static associations: Associations = {
    users: { type: 'belongs_to', key: 'user_id' },
    crops: { type: 'has_many', foreignKey: 'farm_id' },
  };

  @field('user_id') userId!: string;
  @field('location_lat') locationLat!: number;
  @field('location_lng') locationLng!: number;
  @field('size_hectares') sizeHectares!: number;
  @field('soil_type') soilType!: string;
  @field('irrigation_type') irrigationType!: string;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @relation('users', 'user_id') user!: User;
  @children('crops') crops!: Q.Query<Crop>;
}
