/**
 * ChatConversation Model
 * WatermelonDB model for chatbot conversation history
 */

import {Model} from '@nozbe/watermelondb';
import {field, date, readonly} from '@nozbe/watermelondb/decorators';

export default class ChatConversation extends Model {
  static table = 'chat_conversations';

  @field('query_text') queryText!: string;
  @field('response_text') responseText!: string;
  @field('intent') intent!: string;
  @field('confidence') confidence!: number;
  @field('language') language!: string;
  @field('is_voice') isVoice!: boolean;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
