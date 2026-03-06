import { Model } from '@nozbe/watermelondb';
import { field, date, children } from '@nozbe/watermelondb/decorators';
import type { Associations } from '@nozbe/watermelondb/Model';

export default class User extends Model {
  static table = 'users';
  static associations: Associations = {
    farms: { type: 'has_many', foreignKey: 'user_id' },
  };

  @field('phone') phone!: string;
  @field('name') name?: string;
  @field('language') language!: string;
  @date('created_at') createdAt!: Date;
  @date('last_active') lastActive?: Date;
}
