/**
 * ChatbotScreen
 * Voice-enabled chatbot for farming queries
 */

import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {database} from '../database';
import ChatConversation from '../database/models/ChatConversation';
import {Q} from '@nozbe/watermelondb';
import {voiceService} from '../services/voiceService';
import {apiClient} from '../services/apiClient';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  intent?: string;
  confidence?: number;
}

interface QuickReply {
  text: string;
  intent: string;
}

const QUICK_REPLIES: QuickReply[] = [
  {text: 'मौसम कैसा रहेगा?', intent: 'weather_query'},
  {text: 'आज का भाव क्या है?', intent: 'price_query'},
  {text: 'रोग की पहचान', intent: 'disease_identification'},
  {text: 'फसल की सिफारिश', intent: 'crop_recommendation'},
  {text: 'सिंचाई की सलाह', intent: 'irrigation_advice'},
  {text: 'योजनाएं', intent: 'scheme_information'},
];

export default function ChatbotScreen() {
  const {t, i18n} = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadConversationHistory();
  }, []);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({animated: true});
      }, 100);
    }
  }, [messages]);

  const loadConversationHistory = async () => {
    try {
      const conversationsCollection = database.collections.get<ChatConversation>('chat_conversations');
      const conversations = await conversationsCollection
        .query(Q.sortBy('created_at', Q.desc), Q.take(50))
        .fetch();

      const loadedMessages: Message[] = conversations.reverse().map(conv => [
        {
          id: `${conv.id}-query`,
          text: conv.queryText,
          isUser: true,
          timestamp: conv.createdAt,
        },
        {
          id: `${conv.id}-response`,
          text: conv.responseText,
          isUser: false,
          timestamp: conv.createdAt,
          intent: conv.intent,
          confidence: conv.confidence,
        },
      ]).flat();

      setMessages(loadedMessages);
    } catch (error) {
      console.error('Failed to load conversation history:', error);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: text.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setShowQuickReplies(false);
    setIsProcessing(true);

    try {
      // Send query to chatbot API
      const response = await apiClient.post('/api/v1/chatbot/query', {
        query: text.trim(),
        language: i18n.language,
      });

      const botMessage: Message = {
        id: `bot-${Date.now()}`,
        text: response.data.response,
        isUser: false,
        timestamp: new Date(),
        intent: response.data.intent,
        confidence: response.data.confidence,
      };

      setMessages(prev => [...prev, botMessage]);

      // Save to local database
      await saveConversation(
        text.trim(),
        response.data.response,
        response.data.intent,
        response.data.confidence,
        false,
      );
    } catch (error) {
      console.error('Failed to get chatbot response:', error);
      
      // Fallback response
      const fallbackMessage: Message = {
        id: `bot-${Date.now()}`,
        text: t('chatbot.fallbackMessage'),
        isUser: false,
        timestamp: new Date(),
        intent: 'fallback',
        confidence: 0,
      };

      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoiceInput = async () => {
    try {
      setIsListening(true);
      const result = await voiceService.startListening(i18n.language);
      
      if (result && result.length > 0) {
        const text = result[0];
        setInputText(text);
        
        // Automatically send the voice input
        await handleSendMessage(text);
      }
    } catch (error: any) {
      console.error('Voice input error:', error);
      
      if (error.message?.includes('permission')) {
        Alert.alert(
          t('errors.permissionDenied'),
          t('chatbot.microphonePermission'),
        );
      } else {
        Alert.alert(
          t('common.error'),
          t('chatbot.voiceNotAvailable'),
        );
      }
    } finally {
      setIsListening(false);
    }
  };

  const handleQuickReply = (reply: QuickReply) => {
    handleSendMessage(reply.text);
  };

  const handleClearHistory = () => {
    Alert.alert(
      t('chatbot.clearHistory'),
      t('chatbot.clearHistoryConfirm'),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              const conversationsCollection = database.collections.get<ChatConversation>('chat_conversations');
              const conversations = await conversationsCollection.query().fetch();
              
              await database.write(async () => {
                await Promise.all(conversations.map(c => c.markAsDeleted()));
              });
              
              setMessages([]);
              setShowQuickReplies(true);
            } catch (error) {
              console.error('Failed to clear history:', error);
            }
          },
        },
      ],
    );
  };

  const saveConversation = async (
    query: string,
    response: string,
    intent: string,
    confidence: number,
    isVoice: boolean,
  ) => {
    try {
      const conversationsCollection = database.collections.get<ChatConversation>('chat_conversations');
      
      await database.write(async () => {
        await conversationsCollection.create(conversation => {
          conversation.queryText = query;
          conversation.responseText = response;
          conversation.intent = intent;
          conversation.confidence = confidence;
          conversation.language = i18n.language;
          conversation.isVoice = isVoice;
        });
      });
    } catch (error) {
      console.error('Failed to save conversation:', error);
    }
  };

  const renderMessage = ({item}: {item: Message}) => (
    <View
      style={[
        styles.messageContainer,
        item.isUser ? styles.userMessageContainer : styles.botMessageContainer,
      ]}>
      <View
        style={[
          styles.messageBubble,
          item.isUser ? styles.userBubble : styles.botBubble,
        ]}>
        <Text
          style={[
            styles.messageText,
            item.isUser ? styles.userMessageText : styles.botMessageText,
          ]}>
          {item.text}
        </Text>
        {!item.isUser && item.confidence !== undefined && item.confidence < 0.85 && (
          <View style={styles.lowConfidenceBadge}>
            <Icon name="info" size={12} color="#FF9800" />
            <Text style={styles.lowConfidenceText}>
              {t('chatbot.lowConfidence')}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.timestamp}>
        {item.timestamp.toLocaleTimeString(i18n.language === 'hi' ? 'hi-IN' : 'mr-IN', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
    </View>
  );

  const renderQuickReplies = () => {
    if (!showQuickReplies || messages.length > 0) return null;

    return (
      <View style={styles.quickRepliesContainer}>
        <Text style={styles.quickRepliesTitle}>{t('chatbot.quickReplies')}</Text>
        <View style={styles.quickRepliesGrid}>
          {QUICK_REPLIES.map((reply, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickReplyButton}
              onPress={() => handleQuickReply(reply)}>
              <Text style={styles.quickReplyText}>{reply.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="chat" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>{t('chatbot.askQuestion')}</Text>
      <Text style={styles.emptySubtitle}>{t('chatbot.tapToSpeak')}</Text>
    </View>
  );

  const renderTypingIndicator = () => {
    if (!isProcessing) return null;

    return (
      <View style={styles.typingContainer}>
        <View style={styles.typingBubble}>
          <View style={styles.typingDots}>
            <View style={[styles.typingDot, styles.typingDot1]} />
            <View style={[styles.typingDot, styles.typingDot2]} />
            <View style={[styles.typingDot, styles.typingDot3]} />
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('chatbot.askQuestion')}</Text>
        {messages.length > 0 && (
          <TouchableOpacity onPress={handleClearHistory}>
            <Icon name="delete-outline" size={24} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
        ListEmptyComponent={renderEmpty}
        ListHeaderComponent={renderQuickReplies}
        ListFooterComponent={renderTypingIndicator}
      />

      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={[
            styles.voiceButton,
            isListening && styles.voiceButtonActive,
          ]}
          onPress={handleVoiceInput}
          disabled={isProcessing}>
          <Icon
            name={isListening ? 'mic' : 'mic-none'}
            size={24}
            color={isListening ? '#fff' : '#4CAF50'}
          />
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          placeholder={t('chatbot.typeMessage')}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          editable={!isProcessing}
          placeholderTextColor="#999"
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            (!inputText.trim() || isProcessing) && styles.sendButtonDisabled,
          ]}
          onPress={() => handleSendMessage(inputText)}
          disabled={!inputText.trim() || isProcessing}>
          <Icon
            name="send"
            size={24}
            color={inputText.trim() && !isProcessing ? '#4CAF50' : '#ccc'}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  messagesList: {
    flexGrow: 1,
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  quickRepliesContainer: {
    marginBottom: 16,
  },
  quickRepliesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  quickRepliesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickReplyButton: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  quickReplyText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '80%',
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
  },
  botMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#4CAF50',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  botMessageText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    marginHorizontal: 4,
  },
  lowConfidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  lowConfidenceText: {
    fontSize: 12,
    color: '#FF9800',
    marginLeft: 4,
  },
  typingContainer: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  typingBubble: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
  },
  typingDot1: {
    animation: 'pulse 1.4s infinite',
  },
  typingDot2: {
    animation: 'pulse 1.4s infinite 0.2s',
  },
  typingDot3: {
    animation: 'pulse 1.4s infinite 0.4s',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 8,
  },
  voiceButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButtonActive: {
    backgroundColor: '#4CAF50',
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: '#f5f5f5',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#f5f5f5',
  },
});
